import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_CONFIG } from '../config/gemini.config.js';

class GeminiService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = null;
    this.chat = null;
  }

  /**
   * Check Gemini API quota and availability
   */
  async checkQuota() {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      status: 'ok',
      apiKeyValid: true,
      modelsCount: data.models?.length || 0,
      message: 'Gemini API key is valid and working',
      liveApiAvailable: data.models?.some(m => m.name?.includes('gemini-2.5-flash')) || false
    };
  }

  initialize() {
    this.model = this.genAI.getGenerativeModel({
      model: GEMINI_CONFIG.model,
      generationConfig: GEMINI_CONFIG.generationConfig,
      safetySettings: GEMINI_CONFIG.safetySettings,
    });

    this.chat = this.model.startChat({
      history: [],
      generationConfig: {
        temperature: GEMINI_CONFIG.generationConfig.temperature,
      },
    });

    return true;
  }

  async sendAudioStream(audioData, mimeType = 'audio/webm') {
    if (!this.chat) {
      throw new Error('Chat not initialized');
    }

    const result = await this.chat.sendMessageStream([
      {
        inlineData: {
          mimeType,
          data: audioData,
        },
      },
    ]);

    return result;
  }

  async sendTextStream(text) {
    if (!this.chat) {
      throw new Error('Chat not initialized');
    }

    const result = await this.chat.sendMessageStream(text);
    return result;
  }

  reset() {
    this.chat = null;
    this.model = null;
  }
}

export default GeminiService;
