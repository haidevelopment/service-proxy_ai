# Security Documentation - Gemini Live Audio Streaming API

## 🔒 Security Overview

This API implements **multi-layer security** to protect the Gemini Live Audio streaming service:

1. **IP Whitelist Protection** - Only allow connections from trusted IPs
2. **API Key Authentication** - Require valid API key for all requests
3. **WebSocket Security** - Verify clients before WebSocket upgrade
4. **Request Validation** - Validate all incoming requests

---

## 🛡️ Security Layers

### **Layer 1: IP Whitelist**

All requests (HTTP and WebSocket) are checked against a whitelist of allowed IP addresses.

**Configuration:**
```env
WHITELIST_IPS=127.0.0.1,192.168.1.100,10.0.0.50
```

**Features:**
- ✅ Comma-separated list of allowed IPs
- ✅ Supports IPv4 and IPv6
- ✅ Automatic IPv6 localhost normalization (`::1` → `127.0.0.1`)
- ✅ Handles proxy headers (`X-Forwarded-For`, `X-Real-IP`)
- ✅ Blocks non-whitelisted IPs with 403 Forbidden

**Example Response (Blocked IP):**
```json
{
  "success": false,
  "error": "Forbidden",
  "message": "Your IP address is not whitelisted",
  "ip": "192.168.1.200"
}
```

---

### **Layer 2: API Key Authentication**

All protected endpoints require a valid API key in the request header.

**Configuration:**
```env
API_KEY=your_secure_api_key_here_min_32_chars
```

**Header Required:**
```
X-API-Key: your_secure_api_key_here_min_32_chars
```

**Features:**
- ✅ Strong API key validation
- ✅ Constant-time comparison (prevents timing attacks)
- ✅ Blocks invalid keys with 401 Unauthorized
- ✅ Works for both HTTP and WebSocket connections

**Example Response (Invalid API Key):**
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid or missing API key. Please provide X-API-Key header",
  "ip": "127.0.0.1"
}
```

---

### **Layer 3: WebSocket Security**

WebSocket connections are verified **before** the upgrade handshake.

**Verification Process:**
1. Extract client IP from request
2. Check IP against whitelist
3. Validate API key from headers
4. Allow or reject connection

**Features:**
- ✅ Pre-upgrade verification (efficient)
- ✅ Prevents unauthorized WebSocket connections
- ✅ Logs all connection attempts
- ✅ Clear error messages for debugging

**Example (Blocked WebSocket):**
```
🚫 Blocked connection from non-whitelisted IP: 192.168.1.200
```

---

## 📋 API Endpoints

### **Public Endpoints (No Auth Required)**

#### `GET /health`
Health check endpoint - always accessible.

**Request:**
```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-26T14:00:00.000Z",
  "version": "1.0.0"
}
```

---

### **Protected Endpoints (Auth Required)**

All `/api/*` endpoints require:
- ✅ IP in whitelist
- ✅ Valid API key in `X-API-Key` header

#### `GET /api/status`
Check authentication status.

**Request:**
```bash
curl -H "X-API-Key: your_api_key" http://localhost:3000/api/status
```

**Response:**
```json
{
  "success": true,
  "status": "authenticated",
  "ip": "127.0.0.1",
  "timestamp": "2025-12-26T14:00:00.000Z"
}
```

---

#### `GET /api/check-quota`
Check Gemini API quota and availability.

**Request:**
```bash
curl -H "X-API-Key: your_api_key" http://localhost:3000/api/check-quota
```

**Response (Success):**
```json
{
  "success": true,
  "status": "ok",
  "apiKeyValid": true,
  "modelsCount": 15,
  "message": "Gemini API key is valid and working",
  "liveApiAvailable": true,
  "timestamp": "2025-12-26T14:00:00.000Z"
}
```

**Response (Quota Exceeded):**
```json
{
  "success": false,
  "status": "error",
  "apiKeyValid": false,
  "quotaExceeded": true,
  "error": "API quota exceeded. Please check your Gemini API usage limits",
  "timestamp": "2025-12-26T14:00:00.000Z"
}
```

---

#### `WebSocket /`
Real-time audio streaming connection.

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:3000', {
  headers: {
    'X-API-Key': 'your_api_key'
  }
});
```

**Note:** WebSocket headers may not work in browsers. Use query parameters instead:
```javascript
const ws = new WebSocket('ws://localhost:3000?apiKey=your_api_key');
```

Then modify server to check query params:
```javascript
const apiKey = info.req.headers['x-api-key'] || 
               new URL(info.req.url, 'ws://localhost').searchParams.get('apiKey');
```

---

## 🔐 Setup Instructions

### **1. Copy Environment File**

```bash
cp .env.example .env
```

### **2. Generate Secure API Key**

Generate a strong random API key (minimum 32 characters):

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32

# Using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Example output:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### **3. Configure .env File**

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Gemini AI API Key (get from https://aistudio.google.com/app/apikey)
GEMINI_API_KEY=AIzaSyD...your_actual_gemini_key

# Security Configuration
API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2

# IP Whitelist
# Add your production server IP and development machine IP
WHITELIST_IPS=127.0.0.1,::1,YOUR_PRODUCTION_IP,YOUR_DEV_IP
```

### **4. Start Server**

```bash
npm start
```

You should see:
```
🔒 Security Configuration:
   - API Key: a1b2c3d4...
   - Whitelisted IPs: 127.0.0.1, ::1, 203.0.113.10

╔════════════════════════════════════════════════════════════╗
║        🎤 GEMINI LIVE AUDIO STREAMING API 🎤              ║
║  Server: http://localhost:3000                            ║
╚════════════════════════════════════════════════════════════╝
```

---

## 🧪 Testing Security

### **Test 1: Health Check (No Auth)**

```bash
curl http://localhost:3000/health
```

✅ Should work without authentication.

---

### **Test 2: Protected Endpoint Without API Key**

```bash
curl http://localhost:3000/api/status
```

❌ Should return 401 Unauthorized:
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid or missing API key. Please provide X-API-Key header"
}
```

---

### **Test 3: Protected Endpoint With Valid API Key**

```bash
curl -H "X-API-Key: your_api_key" http://localhost:3000/api/status
```

✅ Should return 200 OK:
```json
{
  "success": true,
  "status": "authenticated",
  "ip": "127.0.0.1"
}
```

---

### **Test 4: WebSocket Connection**

```javascript
// Test with valid API key
const ws = new WebSocket('ws://localhost:3000', {
  headers: {
    'X-API-Key': 'your_api_key'
  }
});

ws.onopen = () => console.log('✅ Connected');
ws.onerror = (err) => console.error('❌ Error:', err);
```

---

### **Test 5: IP Whitelist (From Non-Whitelisted IP)**

If you connect from an IP not in `WHITELIST_IPS`:

```bash
curl http://localhost:3000/api/status
```

❌ Should return 403 Forbidden:
```json
{
  "success": false,
  "error": "Forbidden",
  "message": "Your IP address is not whitelisted",
  "ip": "192.168.1.200"
}
```

---

## 🚀 Production Deployment

### **1. Get Your Production Server IP**

```bash
curl ifconfig.me
# or
curl icanhazip.com
```

Example: `203.0.113.10`

### **2. Update .env for Production**

```env
NODE_ENV=production
PORT=3000

GEMINI_API_KEY=AIzaSyD...your_actual_key

# Strong API key (64+ characters recommended)
API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2

# Production IPs only
WHITELIST_IPS=203.0.113.10,203.0.113.11
```

### **3. Use HTTPS/WSS in Production**

Use a reverse proxy (Nginx, Caddy) with SSL:

```nginx
# Nginx example
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### **4. Use Process Manager**

```bash
# Install PM2
npm install -g pm2

# Start server
pm2 start server.js --name gemini-audio-api

# Save PM2 config
pm2 save

# Auto-start on reboot
pm2 startup
```

---

## 🔍 Security Monitoring

### **Server Logs**

The server logs all security events:

```
✅ Authorized connection from IP: 127.0.0.1
🚫 Blocked connection from non-whitelisted IP: 192.168.1.200
🚫 HTTP request with invalid API key from IP: 10.0.0.50
🔌 WebSocket connected from IP: 127.0.0.1
```

### **Monitor Failed Attempts**

```bash
# Watch logs in real-time
pm2 logs gemini-audio-api

# Filter blocked attempts
pm2 logs gemini-audio-api | grep "🚫"
```

---

## ⚠️ Security Best Practices

### **✅ DO:**

1. **Use strong API keys** (64+ characters, random)
2. **Limit IP whitelist** to only necessary IPs
3. **Use HTTPS/WSS** in production
4. **Rotate API keys** regularly
5. **Monitor logs** for suspicious activity
6. **Keep dependencies updated** (`npm audit`)
7. **Use environment variables** for secrets
8. **Enable rate limiting** (future enhancement)

### **❌ DON'T:**

1. **Don't commit .env** to version control
2. **Don't use weak API keys** (e.g., "123456")
3. **Don't whitelist 0.0.0.0** (allows all IPs)
4. **Don't expose Gemini API key** to clients
5. **Don't run as root** in production
6. **Don't disable security** for convenience

---

## 🛠️ Troubleshooting

### **Issue: "IP not whitelisted"**

**Solution:**
1. Check your current IP: `curl ifconfig.me`
2. Add it to `WHITELIST_IPS` in `.env`
3. Restart server: `pm2 restart gemini-audio-api`

---

### **Issue: "Invalid API key"**

**Solution:**
1. Verify API key in `.env` matches request header
2. Check for extra spaces or newlines
3. Ensure header name is exactly `X-API-Key`

---

### **Issue: WebSocket connection fails**

**Solution:**
1. Check browser console for errors
2. Verify API key is sent in headers or query params
3. Check server logs for rejection reason
4. Test with `wscat`:
   ```bash
   npm install -g wscat
   wscat -c ws://localhost:3000 -H "X-API-Key: your_key"
   ```

---

## 📊 Security Checklist

Before deploying to production:

- [ ] Strong API key generated (64+ chars)
- [ ] Production IPs added to whitelist
- [ ] HTTPS/WSS configured
- [ ] `.env` not in version control
- [ ] Process manager configured (PM2)
- [ ] Logs monitored
- [ ] Dependencies updated (`npm audit`)
- [ ] Firewall configured
- [ ] Backup strategy in place
- [ ] Documentation updated

---

## 🔄 Future Enhancements

Planned security improvements:

1. **Rate Limiting** - Limit requests per IP/API key
2. **JWT Authentication** - Token-based auth with expiration
3. **Database Integration** - Store API keys in database
4. **Role-Based Access** - Different permissions per API key
5. **Audit Logging** - Detailed logs to database
6. **CORS Configuration** - Fine-grained CORS control
7. **DDoS Protection** - Advanced traffic filtering
8. **API Key Rotation** - Automatic key rotation

---

## 📞 Support

For security issues or questions:
- Review this documentation
- Check server logs
- Test with provided examples
- Verify `.env` configuration

---

**Security is a continuous process. Stay vigilant! 🛡️**
