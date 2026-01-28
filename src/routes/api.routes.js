/**
 * API Routes Configuration
 * All business logic handled in controllers
 */

import { ipWhitelistMiddleware, apiKeyMiddleware } from '../middleware/security.middleware.js';
import ApiController from '../controllers/api.controller.js';
import AiEvalController from '../controllers/ai-eval.controller.js';
import SpeechAiController from '../controllers/speech-ai.controller.js';

export function setupRoutes(app, geminiApiKey) {
  const apiController = new ApiController(geminiApiKey);
  const aiEvalController = new AiEvalController(geminiApiKey);
  const speechAiController = new SpeechAiController();

  // Public routes
  app.get('/health', (req, res) => apiController.health(req, res));

  // Protected routes - require IP whitelist + API key
  app.use('/api', ipWhitelistMiddleware, apiKeyMiddleware);
  
  app.get('/api/status', (req, res) => apiController.status(req, res));
  app.get('/api/check-quota', (req, res) => apiController.checkQuota(req, res));
  app.post('/api/eval-answer', (req, res) => aiEvalController.evalAnswer(req, res));
  app.post('/api/conv-to-json', (req, res) => aiEvalController.convToJson(req, res));
  app.post('/api/speech/eval', (req, res) => speechAiController.evalAudio(req, res));
}
