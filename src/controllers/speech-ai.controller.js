import { getClientIP } from '../middleware/security.middleware.js';
import { SpeechAiService } from '../services/speech-ai.service.js';

class SpeechAiController {
  constructor() {
    this.service = new SpeechAiService();
  }

  async evalAudio(req, res) {
    const ip = getClientIP(req);
    console.log('[SPEECH-AI] HTTP /api/speech/eval', {
      ip,
      headers: {
        'x-api-key': req.headers['x-api-key'],
      },
    });
    console.log('[SPEECH-AI] Request body:', req.body);

    try {
      const {
        audio_url: audioUrl,
        ref_text: refText,
        part,
        phoneme_output: phonemeOutput,
        scale,
        core_type: coreType,
        test_type: testType,
        dict_type: dictType,
        model,
        penalize_offtopic: penalizeOfftopic,
      } = req.body || {};

      const result = await this.service.evalAudio({
        audioUrl,
        refText,
        coreType,
        dictType,
        testType,
        model,
        part,
        phonemeOutput,
        scale,
        penalizeOfftopic,
        ip,
      });

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[SPEECH-AI] evalAudio error:', error);
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        error: error.message || 'Internal Server Error',
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export default SpeechAiController;
