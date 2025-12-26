/**
 * API Controller
 * Handles all HTTP API business logic
 */

import { getClientIP } from '../middleware/security.middleware.js';
import GeminiService from '../services/gemini.service.js';

class ApiController {
  constructor(geminiApiKey) {
    this.geminiService = new GeminiService(geminiApiKey);
  }

  /**
   * Health check endpoint
   */
  health(req, res) {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  }

  /**
   * Authentication status check
   */
  status(req, res) {
    res.json({
      success: true,
      status: 'authenticated',
      ip: getClientIP(req),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Check Gemini API quota and availability
   */
  async checkQuota(req, res) {
    try {
      const result = await this.geminiService.checkQuota();
      res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Quota check error:', error);
      
      const { message, quotaExceeded, statusCode } = this.parseGeminiError(error);
      
      res.status(statusCode).json({
        success: false,
        status: 'error',
        apiKeyValid: false,
        quotaExceeded,
        error: message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Parse Gemini API errors
   */
  parseGeminiError(error) {
    let message = 'Unknown error';
    let quotaExceeded = false;
    let statusCode = 500;

    if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      message = 'API quota exceeded';
      quotaExceeded = true;
      statusCode = 429;
    } else if (error.message?.includes('401') || error.message?.includes('invalid') || error.message?.includes('API_KEY_INVALID')) {
      message = 'Invalid Gemini API key';
      statusCode = 401;
    } else if (error.message?.includes('403')) {
      message = 'API access forbidden';
      statusCode = 403;
    } else {
      message = error.message || 'Failed to check API status';
    }

    return { message, quotaExceeded, statusCode };
  }
}

export default ApiController;
