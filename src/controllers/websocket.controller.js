import GeminiService from '../services/gemini.service.js';

class WebSocketController {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  handleConnection(ws) {
    console.log('🔌 Client connected');

    const geminiService = new GeminiService(this.apiKey);
    let conversationHistory = [];

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);

        switch (data.type) {
          case 'init':
            await this.handleInit(ws, geminiService);
            break;

          case 'audio':
            await this.handleAudio(ws, geminiService, data, conversationHistory);
            break;

          case 'text':
            await this.handleText(ws, geminiService, data, conversationHistory);
            break;

          case 'stop':
            this.handleStop(ws, conversationHistory);
            break;

          default:
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Unknown message type',
            }));
        }
      } catch (error) {
        console.error('❌ Error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: error.message,
        }));
      }
    });

    ws.on('close', () => {
      console.log('🔌 Client disconnected');
      geminiService.reset();
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });
  }

  async handleInit(ws, geminiService) {
    geminiService.initialize();

    ws.send(JSON.stringify({
      type: 'ready',
      message: 'Gemini Live sẵn sàng! Bắt đầu nói chuyện nhé 🎤',
    }));

    console.log('✅ Gemini Live initialized');
  }

  async handleAudio(ws, geminiService, data, conversationHistory) {
    console.log('🎤 Processing audio...');

    const result = await geminiService.sendAudioStream(data.audio);

    let fullText = '';

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;

      ws.send(JSON.stringify({
        type: 'text_chunk',
        text: chunkText,
        fullText: fullText,
      }));
    }

    conversationHistory.push({
      role: 'user',
      audio: true,
      timestamp: new Date().toISOString(),
    });

    conversationHistory.push({
      role: 'model',
      text: fullText,
      timestamp: new Date().toISOString(),
    });

    ws.send(JSON.stringify({
      type: 'response_complete',
      text: fullText,
    }));

    console.log('✅ Audio response complete');
  }

  async handleText(ws, geminiService, data, conversationHistory) {
    console.log('💬 Processing text:', data.text);

    const result = await geminiService.sendTextStream(data.text);

    let fullText = '';

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;

      ws.send(JSON.stringify({
        type: 'text_chunk',
        text: chunkText,
        fullText: fullText,
      }));
    }

    conversationHistory.push({
      role: 'user',
      text: data.text,
      timestamp: new Date().toISOString(),
    });

    conversationHistory.push({
      role: 'model',
      text: fullText,
      timestamp: new Date().toISOString(),
    });

    ws.send(JSON.stringify({
      type: 'response_complete',
      text: fullText,
    }));

    console.log('✅ Text response complete');
  }

  handleStop(ws, conversationHistory) {
    console.log('⏹️ Conversation stopped');
    ws.send(JSON.stringify({
      type: 'stopped',
      history: conversationHistory,
    }));
  }
}

export default WebSocketController;
