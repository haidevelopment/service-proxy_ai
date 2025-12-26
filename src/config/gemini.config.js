export const GEMINI_CONFIG = {
  model: 'gemini-2.0-flash-exp',
  generationConfig: {
    temperature: 0.9,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
  },
  safetySettings: [
    {
      category: 'HARM_CATEGORY_HARASSMENT',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE',
    },
    {
      category: 'HARM_CATEGORY_HATE_SPEECH',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE',
    },
  ],
};

export const AUDIO_CONFIG = {
  mimeType: 'audio/webm',
  sampleRate: 48000,
  channels: 1,
};

export const WEBSOCKET_CONFIG = {
  pingInterval: 30000,
  maxPayload: 10 * 1024 * 1024,
};
