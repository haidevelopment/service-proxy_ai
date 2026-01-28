export const appConfig = {
  environment: process.env.NODE_ENV || 'development',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || '3306'),
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'partner',
  },
  settingGroup: {
    OPEN_AI_PROMPT: process.env.OPEN_AI_PROMPT_SETTING_GROUP || 'prompt',
    WHITELIST_IP: process.env.WHITELIST_IP_SETTING_GROUP || 'whiteIP',
    GEMINI: process.env.GEMINI_SETTING_GROUP || 'gemini',
    SPEECH: process.env.SPEECH_SETTING_GROUP || 'speech',
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
  gemini: {
    settingKeys: {
      API_KEY: 'GEMINI_API_KEY',
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
