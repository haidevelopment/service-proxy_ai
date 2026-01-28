/**
 * Security Middleware
 * Handles IP whitelist and API key authentication
 */

import { appConfig } from '../config/app.config.js';
import { execQuery } from '../database/db-connection.js';

const API_KEY = process.env.API_KEY;

const WHITELIST_CACHE_TTL_MS = Number(process.env.WHITELIST_CACHE_TTL_MS || '60000');

const whitelistCache = {
  ips: new Set(),
  fetchedAt: 0,
  fetchingPromise: null,
};

function normalizeIp(ip) {
  if (!ip) return ip;
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    return '127.0.0.1';
  }
  if (ip.startsWith('::ffff:')) {
    return ip.replace('::ffff:', '');
  }
  return ip;
}

function stripHtml(input) {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseWhitelistIps(rawValue) {
  const text = stripHtml(rawValue);
  if (!text) return [];

  // Support formats:
  // - single IP per row
  // - comma/newline separated
  // - values wrapped in <p>...</p>
  return text
    .split(/[\s,;]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

async function fetchWhitelistFromDb() {
  const rows = await execQuery('SELECT `value` FROM setting WHERE `group` = ?', [appConfig.settingGroup.WHITELIST_IP]);
  const ips = new Set();
  if (Array.isArray(rows)) {
    for (const row of rows) {
      const value = row.value || row['value'];
      if (value && typeof value === 'string') {
        for (const ip of parseWhitelistIps(value)) {
          ips.add(normalizeIp(ip));
        }
      }
    }
  }

  whitelistCache.ips = ips;
  whitelistCache.fetchedAt = Date.now();
  console.log('[SECURITY] Loaded whitelist IPs from DB:', {
    group: appConfig.settingGroup.WHITELIST_IP,
    count: whitelistCache.ips.size,
    fetchedAt: new Date(whitelistCache.fetchedAt).toISOString(),
  });
}

async function ensureWhitelistFresh() {
  const now = Date.now();
  const isExpired = !whitelistCache.fetchedAt || now - whitelistCache.fetchedAt > WHITELIST_CACHE_TTL_MS;

  if (!isExpired) {
    return;
  }

  if (!whitelistCache.fetchingPromise) {
    whitelistCache.fetchingPromise = (async () => {
      try {
        await fetchWhitelistFromDb();
      } catch (error) {
        console.error('[SECURITY] Failed to load whitelist IPs from DB:', error);
      } finally {
        whitelistCache.fetchingPromise = null;
      }
    })();
  }

  await whitelistCache.fetchingPromise;
}

/**
 * Get client IP address from request
 * Handles proxy headers (X-Forwarded-For, X-Real-IP)
 */
export function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return realIP.trim();
  }
  
  return req.socket.remoteAddress || req.connection.remoteAddress;
}

/**
 * Extract session info from WebSocket request
 */
export function getSessionInfo(req) {
  try {
    const url = new URL(req.url, 'ws://localhost');
    return {
      userId: url.searchParams.get('userId') || null,
      sessionId: url.searchParams.get('sessionId') || null,
      examId: url.searchParams.get('examId') || null
    };
  } catch (error) {
    return { userId: null, sessionId: null, examId: null };
  }
}

/**
 * Check if IP is in whitelist
 */
export async function isIPWhitelisted(ip) {
  await ensureWhitelistFresh();

  const normalizedIP = normalizeIp(ip);
  if (!normalizedIP) {
    return false;
  }

  if (whitelistCache.ips.size === 0) {
    console.warn('[SECURITY] Whitelist IP cache is empty - denying request by default', {
      ip: normalizedIP,
      group: appConfig.settingGroup.WHITELIST_IP,
    });
    return false;
  }

  for (const whitelistedIP of whitelistCache.ips) {
    if (normalizedIP === whitelistedIP || normalizedIP.startsWith(whitelistedIP)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate API key
 */
export function isValidAPIKey(apiKey) {
  if (!apiKey) return false;
  return apiKey === API_KEY;
}

/**
 * IP Whitelist Middleware for HTTP requests
 */
export function ipWhitelistMiddleware(req, res, next) {
  const ip = getClientIP(req);

  (async () => {
    const allowed = await isIPWhitelisted(ip);
    if (!allowed) {
      console.warn(`🚫 Blocked request from non-whitelisted IP (DB): ${ip}`);
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Your IP address is not whitelisted',
        ip: ip,
      });
      return;
    }
    next();
  })().catch((error) => {
    console.error('[SECURITY] ipWhitelistMiddleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to validate IP whitelist',
      ip: ip,
    });
  });
}

/**
 * API Key Authentication Middleware for HTTP requests
 */
export function apiKeyMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const ip = getClientIP(req);
  
  if (!isValidAPIKey(apiKey)) {
    console.warn(`🚫 Invalid API key from IP: ${ip}`);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid or missing API key. Please provide X-API-Key header',
      ip: ip
    });
  }
  
  next();
}

/**
 * WebSocket Security Verification
 * Use this in verifyClient callback
 */
export function verifyWebSocketClient(info, callback) {
  const ip = getClientIP(info.req);
  
  // Get API key from header OR query parameter (browser WebSocket doesn't support headers)
  let apiKey = info.req.headers['x-api-key'];
  
  if (!apiKey && info.req.url) {
    try {
      // Parse query string from URL
      const urlParts = info.req.url.split('?');
      if (urlParts.length > 1) {
        const params = new URLSearchParams(urlParts[1]);
        apiKey = params.get('apiKey');
        console.log(`🔍 Extracted API key from query: ${apiKey ? apiKey.substring(0, 8) + '...' : 'none'}`);
      }
    } catch (error) {
      console.warn(`🚫 Failed to parse URL: ${error.message}`);
    }
  }
  
  (async () => {
    const allowed = await isIPWhitelisted(ip);
    if (!allowed) {
      console.warn(`🚫 Blocked WebSocket from non-whitelisted IP (DB): ${ip}`);
      callback(false, 403, 'Forbidden: IP not whitelisted');
      return;
    }

    if (!isValidAPIKey(apiKey)) {
      console.warn(`🚫 Blocked WebSocket with invalid API key from IP: ${ip}`);
      callback(false, 401, 'Unauthorized: Invalid API key');
      return;
    }

    console.log(`✅ Authorized WebSocket connection from IP: ${ip}`);
    callback(true);
  })().catch((error) => {
    console.error('[SECURITY] verifyWebSocketClient error:', error);
    callback(false, 500, 'Internal Server Error');
  });
}

/**
 * Validate security configuration on startup
 */
export function validateSecurityConfig() {
  if (!API_KEY) {
    console.error('❌ API_KEY is required in .env file');
    process.exit(1);
  }

  console.log(`🔒 Security Configuration:`);
  console.log(`   - API Key: ${API_KEY.substring(0, 8)}...`);
  console.log(`   - Whitelist Source: MySQL setting (db=${appConfig.db.database}, group=${appConfig.settingGroup.WHITELIST_IP})`);
  console.log(`   - Whitelist Cache TTL: ${WHITELIST_CACHE_TTL_MS}ms`);

  // Warm up cache (non-blocking)
  ensureWhitelistFresh().catch((error) => console.error('[SECURITY] Failed to warm whitelist cache:', error));
}
