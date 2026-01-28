import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_CONFIG } from '../config/gemini.config.js';
import { appConfig } from '../config/app.config.js';
import { execQuery } from '../database/db-connection.js';

function cleanJsonBlock(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }
  return input
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/```$/i, '');
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
    'SELECT * FROM setting WHERE type = ? AND `value` = ?',
    [appConfig.settingType.WHITELIST_IP, normalizedIp]
  );
  const rowCount = Array.isArray(rows) ? rows.length : 0;
  console.log('[AI-EVAL] DB whitelist check result:', { ip: normalizedIp, rowCount });
  return rowCount > 0;
}

async function getPromptByKey(key) {
  if (!key) {
    throw new Error('Prompt key is required');
  }

  const rows = await execQuery(
    'SELECT * FROM setting WHERE type = ? AND `key` = ? AND status = ?',
    [appConfig.settingType.OPEN_AI_PROMPT, key, appConfig.status.ACTIVE]
  );

  const rowCount = Array.isArray(rows) ? rows.length : 0;
  console.log('[AI-EVAL] Prompt query result:', { key, rowCount });

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('OpenAI Prompt setting is not configured for key: ' + key);
  }

  const row = rows[0];
  return row.value || row['value'];
}

function extractTextFromGeminiResponse(result) {
  if (!result || !result.response) {
    return '';
  }

  if (typeof result.response.text === 'function') {
    try {
      return result.response.text();
    } catch (e) {
      console.error('[AI-EVAL] Failed to extract text() from Gemini response:', e.message);
    }
  }

  const candidates = result.response.candidates || [];
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return '';
  }

  const parts = candidates[0].content && candidates[0].content.parts;
  if (!Array.isArray(parts)) {
    return '';
  }

  return parts
    .map((part) => {
      if (typeof part.text === 'string') {
        return part.text;
      }
      return '';
    })
    .join('');
}

export class AiEvalService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async evaluateAnswer({ type, question, answer, ip }) {
    console.log('[AI-EVAL] evaluateAnswer input:', { type, ip });

    if (!type || !question || !answer) {
      throw new Error('Missing required fields: type, question, answer');
    }

    const allowed = await isIpWhitelistedInDb(ip);
    if (!allowed) {
      const error = new Error('IP not whitelisted in database');
      error.statusCode = 403;
      throw error;
    }

    const prompt = await getPromptByKey(type);
    console.log('[AI-EVAL] Loaded prompt length:', prompt ? prompt.length : 0);

    const content = `Nội dung câu hỏi: "${question}"\r\nCâu trả lời của tôi: "${answer}"`;
    const fullPrompt = `${prompt}\n\n${content}`;

    const model = this.genAI.getGenerativeModel({
      model: GEMINI_CONFIG.model,
      generationConfig: GEMINI_CONFIG.generationConfig,
      safetySettings: GEMINI_CONFIG.safetySettings,
    });

    console.log('[AI-EVAL] Calling Gemini for evaluation');
    const result = await model.generateContent(fullPrompt);
    const rawText = extractTextFromGeminiResponse(result);

    console.log('[AI-EVAL] Raw Gemini response snippet:', rawText ? rawText.substring(0, 500) : '');

    if (!rawText) {
      throw new Error('Empty response from Gemini evaluation');
    }

    const clean = cleanJsonBlock(rawText);
    try {
      const parsed = JSON.parse(clean);
      return parsed;
    } catch (e) {
      console.error('[AI-EVAL] Failed to parse JSON response:', e.message);
      console.error('[AI-EVAL] Cleaned response snippet:', clean.substring(0, 1000));
      throw new Error('Failed to parse AI evaluation response as JSON');
    }
  }

  async convToJson({ type, content, ip }) {
    console.log('[AI-EVAL] convToJson input:', { type, ip });

    if (!type || !content) {
      throw new Error('Missing required fields: type, content');
    }

    const allowed = await isIpWhitelistedInDb(ip);
    if (!allowed) {
      const error = new Error('IP not whitelisted in database');
      error.statusCode = 403;
      throw error;
    }

    const prompt = await getPromptByKey(type);
    console.log('[AI-EVAL] Loaded prompt length:', prompt ? prompt.length : 0);

    const userContent = `Nội dung html: "${content}"`;
    const fullPrompt = `${prompt}\n\n${userContent}`;

    const model = this.genAI.getGenerativeModel({
      model: GEMINI_CONFIG.model,
      generationConfig: GEMINI_CONFIG.generationConfig,
      safetySettings: GEMINI_CONFIG.safetySettings,
    });

    console.log('[AI-EVAL] Calling Gemini for convToJson');
    const result = await model.generateContent(fullPrompt);
    const rawText = extractTextFromGeminiResponse(result);

    console.log('[AI-EVAL] Raw Gemini response snippet:', rawText ? rawText.substring(0, 500) : '');

    if (!rawText) {
      throw new Error('Empty response from Gemini convToJson');
    }

    const clean = cleanJsonBlock(rawText);
    try {
      const parsed = JSON.parse(clean);
      return parsed;
    } catch (e) {
      console.error('[AI-EVAL] Failed to parse JSON convToJson response:', e.message);
      console.error('[AI-EVAL] Cleaned response snippet:', clean.substring(0, 1000));
      throw new Error('Failed to parse AI convToJson response as JSON');
    }
  }
}
