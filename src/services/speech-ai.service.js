import axios from 'axios';
import FormData from 'form-data';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { PassThrough, Readable } from 'stream';
import crypto from 'crypto';

import { appConfig } from '../config/app.config.js';
import { execQuery } from '../database/db-connection.js';

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

function normalizeIp(ip) {
  if (!ip) return ip;
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    return '127.0.0.1';
  }
  if (ip.startsWith('::ffff:')) {
    return ip.replace('::ffff:', '');
  }
  return ip;
}

async function isIpWhitelistedInDb(ip) {
  const normalizedIp = normalizeIp(ip);
  if (!normalizedIp) {
    return false;
  }

  const rows = await execQuery(
    'SELECT * FROM setting WHERE `group` = ? AND `value` = ?',
    [appConfig.settingGroup.WHITELIST_IP, normalizedIp]
  );
  const rowCount = Array.isArray(rows) ? rows.length : 0;
  console.log('[SPEECH-AI] DB whitelist check result:', { ip: normalizedIp, rowCount });
  return rowCount > 0;
}

function getAudioFileExtension(path) {
  if (!path || typeof path !== 'string') return 'wav';
  const extensionRegex = /\.(mp3|wav|opus|ogg|amr)/i;
  const match = path.match(extensionRegex);
  return match ? match[1].toLowerCase() : 'wav';
}

async function fetchAudioFile(url) {
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer' });
    if (res.status !== 200) {
      throw new Error(`Failed to fetch audio: ${res.statusText}`);
    }

    return {
      size: res.headers['content-length'] ? Number(res.headers['content-length']) : undefined,
      data: Buffer.from(res.data),
    };
  } catch (error) {
    throw new Error(`Failed to fetch audio: ${error.message}`);
  }
}

async function fetchAudioFileToMp3(url) {
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer' });
    if (res.status !== 200) {
      throw new Error(`Failed to fetch audio: ${res.statusText}`);
    }
    const audioBuffer = Buffer.from(res.data);
    const mp3Buffer = await convertToMp3(audioBuffer);

    return {
      size: mp3Buffer.length,
      data: mp3Buffer,
    };
  } catch (error) {
    throw new Error(`Failed to fetch audio: ${error.message}`);
  }
}

async function convertToMp3(inputBuffer) {
  return new Promise((resolve, reject) => {
    const inputStream = new Readable();
    inputStream.push(inputBuffer);
    inputStream.push(null);

    const outputStream = new PassThrough();
    const dataChunks = [];

    outputStream.on('data', (chunk) => {
      dataChunks.push(chunk);
    });

    outputStream.on('end', () => {
      resolve(Buffer.concat(dataChunks));
    });

    outputStream.on('error', (err) => {
      console.error('[SPEECH-AI] convertToMp3 error:', err);
      reject(new Error('Failed to convert audio to mp3'));
    });

    ffmpeg(inputStream).outputFormat('mp3').pipe(outputStream);
  });
}

function encrypt(content) {
  return crypto.createHash('sha1').update(content).digest('hex');
}

function getConnectSig(appKey, secretKey) {
  const timestamp = Date.now().toString();
  const sig = encrypt(appKey + timestamp + secretKey);
  return { sig, timestamp };
}

function getStartSig(appKey, secretKey, userId) {
  const timestamp = Date.now().toString();
  const sig = encrypt(appKey + timestamp + userId + secretKey);
  return { sig, timestamp, userId };
}

function createUUID() {
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'
    .replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 3) | 8;
      return v.toString(16);
    })
    .toUpperCase();
}

function getCoreType(refText) {
  if (!refText) {
    return appConfig.speech.evaluationType.ENG_SPEAK;
  }

  if (refText.length <= 1) {
    return appConfig.speech.evaluationType.ENG_WORD;
  }

  if (refText.length <= 200) {
    return appConfig.speech.evaluationType.ENG_SENT;
  }

  return appConfig.speech.evaluationType.ENG_PARA;
}

function buildTextPayload(audioType, appKey, secretKey, requestParams) {
  return {
    connect: {
      cmd: 'connect',
      param: {
        sdk: {
          version: 16777472,
          source: 9,
          protocol: 2,
        },
        app: {
          applicationId: appKey,
          ...getConnectSig(appKey, secretKey),
        },
      },
    },
    start: {
      cmd: 'start',
      param: {
        app: {
          applicationId: appKey,
          ...getStartSig(appKey, secretKey, 'uid'),
        },
        audio: {
          audioType,
          sampleRate: 16000,
          channel: 1,
          sampleBytes: 2,
        },
        request: requestParams,
      },
    },
  };
}

async function getSpeechSettingsFromDb() {
  const rows = await execQuery(
    'SELECT * FROM setting WHERE `group` = ? AND `key` IN (?, ?, ?)',
    [
      appConfig.settingGroup.SPEECH,
      appConfig.speech.settingKeys.URL,
      appConfig.speech.settingKeys.APP_KEY,
      appConfig.speech.settingKeys.SECRET_KEY,
    ]
  );

  const rowCount = Array.isArray(rows) ? rows.length : 0;
  console.log('[SPEECH-AI] Speech settings query result:', { rowCount });

  if (!Array.isArray(rows) || rows.length < 3) {
    throw new Error('Speech setting is not configured in database');
  }

  let speechUrl;
  let speechAppKey;
  let speechSecretKey;

  for (const row of rows) {
    const key = row.key || row['key'];
    const value = row.value || row['value'];
    if (key === appConfig.speech.settingKeys.URL) {
      speechUrl = value;
    } else if (key === appConfig.speech.settingKeys.APP_KEY) {
      speechAppKey = value;
    } else if (key === appConfig.speech.settingKeys.SECRET_KEY) {
      speechSecretKey = value;
    }
  }

  if (!speechUrl || !speechAppKey || !speechSecretKey) {
    throw new Error('Speech setting is incomplete in database');
  }

  return { speechUrl, speechAppKey, speechSecretKey };
}

export class SpeechAiService {
  async evalAudio(dto) {
    console.log('[SPEECH-AI] evalAudio input:', JSON.stringify(dto));

    const allowed = await isIpWhitelistedInDb(dto.ip);
    if (!allowed) {
      const error = new Error('IP not whitelisted in database');
      error.statusCode = 403;
      throw error;
    }

    let coreType = dto.coreType;
    if (!coreType) {
      coreType = getCoreType(dto.refText);
    }

    const requestParams = {
      coreType,
      tokenId: createUUID(),
    };

    requestParams.model = 'native';

    if (coreType === appConfig.speech.evaluationType.ENG_SPEAK) {
      requestParams.test_type = dto.testType || 'ielts';
      requestParams.penalize_offtopic = dto.penalizeOfftopic;
      if (dto.part) {
        requestParams.task_type = `ielts_part${dto.part}`;
      }
    } else if (coreType === appConfig.speech.evaluationType.ENG_ASR) {
      requestParams.dict_type = dto.dictType || 'IPA88';
      requestParams.scale = dto.scale || 10;
      requestParams.slack = dto.slack || -0.5;
    } else if (coreType === appConfig.speech.evaluationType.GER_PARA) {
      requestParams.refText = dto.refText;
      requestParams.paragraph_need_word_score = 1;
    } else {
      requestParams.refText = dto.refText;
    }

    if (dto.phonemeOutput) {
      requestParams.phoneme_output = dto.phonemeOutput;
    }

    let audioType = getAudioFileExtension(dto.audioUrl);
    if (!audioType || !appConfig.speech.audioFormats.includes(audioType)) {
      throw new Error('Invalid audio format');
    }

    let audioFile;
    if (audioType === 'mp3') {
      audioFile = await fetchAudioFile(dto.audioUrl);
    } else {
      audioFile = await fetchAudioFileToMp3(dto.audioUrl);
      audioType = 'mp3';
    }

    const { speechUrl, speechAppKey, speechSecretKey } = await getSpeechSettingsFromDb();

    console.log('[SPEECH-AI] request params:', JSON.stringify(requestParams));
    const textPayload = buildTextPayload(audioType, speechAppKey, speechSecretKey, requestParams);
    console.log('[SPEECH-AI] text payload:', JSON.stringify(textPayload));

    const formData = new FormData();
    formData.append('text', JSON.stringify(textPayload));
    formData.append('audio', audioFile.data, {
      filename: 'audio.' + audioType,
      contentType: 'audio/' + audioType,
    });

    const host = speechUrl.replace(/^(http|https):\/\//, '');

    return new Promise((resolve, reject) => {
      formData.submit(
        {
          host,
          path: '/' + requestParams.coreType,
          method: 'POST',
          protocol: 'https:',
          headers: { 'Request-Index': '0' },
        },
        (err, res) => {
          if (err) {
            console.error('[SPEECH-AI] HTTP error:', err);
            reject(new Error(err.message));
            return;
          }

          if (res.statusCode && (res.statusCode < 200 || res.statusCode > 299)) {
            reject(new Error(`HTTP status code ${res.statusCode}`));
            return;
          }

          const body = [];
          res.on('data', (chunk) => body.push(chunk));
          res.on('end', () => {
            const resString = Buffer.concat(body).toString();
            try {
              const jsonRes = JSON.parse(resString);
              if (jsonRes.error) {
                console.error('[SPEECH-AI] Provider error response:', jsonRes);
                reject(new Error(jsonRes.error));
                return;
              }
              resolve(jsonRes);
            } catch (e) {
              console.error('[SPEECH-AI] Failed to parse provider response:', e.message);
              console.error('[SPEECH-AI] Raw response:', resString.substring(0, 2000));
              reject(new Error('Failed to parse speech AI response'));
            }
          });
        }
      );
    });
  }
}
