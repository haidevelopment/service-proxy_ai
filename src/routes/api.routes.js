/**
 * API Routes Configuration
 * All business logic handled in controllers
 */

import { ipWhitelistMiddleware, apiKeyMiddleware } from '../middleware/security.middleware.js';
import ApiController from '../controllers/api.controller.js';

export function setupRoutes(app, geminiApiKey) {
  const apiController = new ApiController(geminiApiKey);

  // Public routes
  app.get('/health', (req, res) => apiController.health(req, res));

  // Protected routes - require IP whitelist + API key
  app.use('/api', ipWhitelistMiddleware, apiKeyMiddleware);
  
  app.get('/api/status', (req, res) => apiController.status(req, res));
  app.get('/api/check-quota', (req, res) => apiController.checkQuota(req, res));
}
