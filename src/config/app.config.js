export const appConfig = {
  environment: process.env.NODE_ENV || 'development',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || '3306'),
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'partner',
  },
  settingType: {
    OPEN_AI_PROMPT: Number(process.env.OPEN_AI_PROMPT_SETTING_TYPE || '10'),
    WHITELIST_IP: Number(process.env.WHITELIST_IP_SETTING_TYPE || '8'),
    SPEECH_AI: Number(process.env.SPEECH_AI_SETTING_TYPE || '7'),
  },
  status: {
    ACTIVE: 1,
  },
  evaluationType: {
    IELTS: {
      SPEAKING: 'ielts_speaking',
      WRITING: 'ielts_writing',
    },
    GENERAL: {
      SPEAKING: 'speaking',
      WRITING: 'writing',
    },
    GERMAN: {
      SPEAKING: 'german_speaking',
      WRITING: 'german_writing',
    },
    CONV: {
      HTML_TO_JSON: 'conv_html_to_json',
    },
  },
  speech: {
    audioFormats: ['wav', 'mp3', 'opus', 'ogg', 'amr'],
    evaluationType: {
      ENG_WORD: 'word.eval.promax',
      ENG_SENT: 'sent.eval.promax',
      ENG_PARA: 'para.eval',
      ENG_SPEAK: 'speak.eval.pro',
      ENG_ASR: 'asr.eval',
      GER_PARA: 'para.eval.de',
    },
    settingKeys: {
      URL: 'SPEECH_URL',
      APP_KEY: 'SPEECH_APP_KEY',
      SECRET_KEY: 'SPEECH_SECRET_KEY',
    },
  },
};
