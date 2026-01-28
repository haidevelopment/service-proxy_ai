import { getClientIP } from '../middleware/security.middleware.js';
import { AiEvalService } from '../services/ai-eval.service.js';

class AiEvalController {
  constructor(geminiApiKey) {
    this.service = new AiEvalService(geminiApiKey);
  }

  async evalAnswer(req, res) {
    const ip = getClientIP(req);
    console.log('[AI-EVAL] HTTP /api/eval-answer', {
      ip,
      headers: {
        'x-api-key': req.headers['x-api-key'],
      },
    });
    console.log('[AI-EVAL] Request body:', req.body);

    try {
      const { type, question, answer } = req.body || {};
      const result = await this.service.evaluateAnswer({
        type,
        question,
        answer,
        ip,
      });

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[AI-EVAL] evalAnswer error:', error);
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        error: error.message || 'Internal Server Error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async convToJson(req, res) {
    const ip = getClientIP(req);
    console.log('[AI-EVAL] HTTP /api/conv-to-json', {
      ip,
      headers: {
        'x-api-key': req.headers['x-api-key'],
      },
    });
    console.log('[AI-EVAL] Request body:', req.body);

    try {
      const { type, content } = req.body || {};
      const result = await this.service.convToJson({
        type,
        content,
        ip,
      });

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[AI-EVAL] convToJson error:', error);
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        error: error.message || 'Internal Server Error',
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export default AiEvalController;
