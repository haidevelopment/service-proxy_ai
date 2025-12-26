/**
 * Security Middleware
 * Handles IP whitelist and API key authentication
 */

const WHITELIST_IPS = process.env.WHITELIST_IPS?.split(',').map(ip => ip.trim()).filter(Boolean) || [];
const API_KEY = process.env.API_KEY;

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
export function isIPWhitelisted(ip) {
  // Normalize IPv6 localhost to IPv4
  const normalizedIP = ip === '::1' || ip === '::ffff:127.0.0.1' ? '127.0.0.1' : ip;
  
  return WHITELIST_IPS.some(whitelistedIP => {
    return normalizedIP === whitelistedIP || normalizedIP.startsWith(whitelistedIP);
  });
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
  
  if (!isIPWhitelisted(ip)) {
    console.warn(`🚫 Blocked request from non-whitelisted IP: ${ip}`);
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Your IP address is not whitelisted',
      ip: ip
    });
  }
  
  next();
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
  
  if (!isIPWhitelisted(ip)) {
    console.warn(`🚫 Blocked WebSocket from non-whitelisted IP: ${ip}`);
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
}

/**
 * Validate security configuration on startup
 */
export function validateSecurityConfig() {
  if (!API_KEY) {
    console.error('❌ API_KEY is required in .env file');
    process.exit(1);
  }
  
  if (WHITELIST_IPS.length === 0) {
    console.error('❌ WHITELIST_IPS is required in .env file (comma-separated list)');
    process.exit(1);
  }
  
  console.log(`🔒 Security Configuration:`);
  console.log(`   - API Key: ${API_KEY.substring(0, 8)}...`);
  console.log(`   - Whitelisted IPs: ${WHITELIST_IPS.join(', ')}`);
}
