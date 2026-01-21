import { GoogleGenAI, Modality } from '@google/genai';

class GeminiLiveService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.ai = new GoogleGenAI({ apiKey });
    this.session = null;
    this.model = 'gemini-2.5-flash-native-audio-preview-12-2025';
  }

  async connect(callbacks, options = {}) {
    const { 
      voiceName = 'Puck', 
      systemInstruction = null,
      topic = null,
      level = 'intermediate'
    } = options;

    try {
      const config = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName
            }
          }
        },
        inputAudioTranscription: true,
        outputAudioTranscription: true
      };

      // Add system instruction if provided
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }

      this.session = await this.ai.live.connect({
        model: this.model,
        config,
        callbacks: {
          onopen: () => {
            console.log('✅ Live API session opened');
            if (callbacks.onopen) callbacks.onopen();
          },
          onmessage: (message) => {
            if (callbacks.onmessage) callbacks.onmessage(message);
          },
          onerror: (error) => {
            console.error('❌ Live API error:', error);
            if (callbacks.onerror) callbacks.onerror(error);
          },
          onclose: (event) => {
            console.log('🔌 Live API session closed:', event.reason);
            if (callbacks.onclose) callbacks.onclose(event);
          }
        }
      });

      return this.session;
    } catch (error) {
      console.error('❌ Failed to connect to Live API:', error);
      throw error;
    }
  }

  async sendRealtimeInput(audioBlob) {
    if (!this.session) {
      throw new Error('Session not connected');
    }

    try {
      // audioBlob should be { data: base64String, mimeType: 'audio/pcm;rate=16000' }
      if (typeof audioBlob === 'string') {
        // If just base64 string, wrap it
        await this.session.sendRealtimeInput({
          media: {
            mimeType: 'audio/pcm;rate=16000',
            data: audioBlob
          }
        });
      } else if (audioBlob && audioBlob.data && audioBlob.mimeType) {
        // If already a blob object
        await this.session.sendRealtimeInput({
          media: audioBlob
        });
      } else {
        console.error('❌ Invalid audio format:', typeof audioBlob, audioBlob);
        throw new Error('Invalid audio format');
      }
    } catch (error) {
      console.error('❌ Error sending realtime audio:', error.message);
      throw error;
    }
  }

  async endAudioStream() {
    // Don't send audioStreamEnd - just stop sending audio chunks
    // The API will handle it automatically
    console.log('🎙️ Audio stream ended (client side)');
  }

  async sendText(text) {
    if (!this.session) {
      throw new Error('Session not connected');
    }

    try {
      await this.session.sendClientContent({
        turns: [{
          role: 'user',
          parts: [{ text }]
        }],
        turnComplete: true
      });
    } catch (error) {
      console.error('❌ Error sending text:', error);
      throw error;
    }
  }

  close() {
    if (this.session) {
      this.session.close();
      this.session = null;
    }
  }
}

export default GeminiLiveService;
