# Architecture - Gemini Live Audio Streaming API

## 📁 Project Structure

```
service-ai/
├── server.js                          # Main server file (ENTRY POINT)
├── .env                               # Environment variables (gitignored)
├── .env.example                       # Environment template
├── package.json                       # Dependencies
│
├── src/
│   ├── middleware/
│   │   └── security.middleware.js     # Security logic (IP + API Key)
│   │
│   ├── controllers/
│   │   └── websocket-live.controller.js  # WebSocket connection handler
│   │
│   ├── services/
│   │   └── gemini-live.service.js     # Gemini Live API integration
│   │
│   └── config/
│       └── prompts.js                 # AI prompts configuration
│
└── public/
    └── index.html                     # Test client (optional)
```

---

## 🎯 Main File: `server.js`

**Purpose:** Audio streaming server với Gemini Live API

**Features:**
- ✅ Real-time voice conversation với AI
- ✅ WebSocket streaming
- ✅ IP Whitelist + API Key security
- ✅ Production-ready

**Responsibilities:**
- Setup Express server
- Configure WebSocket server
- Apply security middleware
- Define API routes
- Handle graceful shutdown

**Code Structure:**
```javascript
// 1. Imports
import express from 'express';
import { WebSocketServer } from 'ws';
import WebSocketLiveController from './src/controllers/websocket-live.controller.js';
import { security middleware } from './src/middleware/security.middleware.js';

// 2. Server setup
const app = express();
const wss = new WebSocketServer({ verifyClient: verifyWebSocketClient });

// 3. Configuration
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 4. Routes
app.get('/health', ...);                    // Public
app.use('/api', ipWhitelist, apiKey);       // Protected
app.get('/api/status', ...);
app.get('/api/check-quota', ...);

// 5. WebSocket handler
wss.on('connection', (ws, req) => {
  wsController.handleConnection(ws);
});

// 6. Start server
server.listen(PORT);
```

---

## 🔒 Security Layer: `src/middleware/security.middleware.js`

**Purpose:** Centralized security logic

**Functions:**
```javascript
// IP handling
getClientIP(req)              // Extract client IP (handles proxies)
isIPWhitelisted(ip)           // Check if IP is allowed

// API Key validation
isValidAPIKey(apiKey)         // Validate API key

// Middleware
ipWhitelistMiddleware         // HTTP IP check
apiKeyMiddleware              // HTTP API key check
verifyWebSocketClient         // WebSocket security

// Validation
validateSecurityConfig()      // Startup validation
```

**Why separate file?**
- ✅ **Clean separation of concerns**
- ✅ **Reusable across routes**
- ✅ **Easy to test**
- ✅ **Professional architecture**

---

## 🎮 Controller: `src/controllers/websocket-live.controller.js`

**Purpose:** Handle WebSocket connections and messages

**Responsibilities:**
- Accept WebSocket connections
- Parse incoming messages
- Route to appropriate handlers
- Send responses to client

**Message Types:**
```javascript
'init'         → Initialize Gemini Live session
'start_stream' → Start audio streaming
'audio_chunk'  → Send audio data
'end_stream'   → End audio streaming
'text'         → Send text message
'stop'         → Stop session
```

---

## 🤖 Service: `src/services/gemini-live.service.js`

**Purpose:** Gemini Live API integration

**Responsibilities:**
- Connect to Gemini Live API
- Send audio/text to AI
- Receive AI responses
- Handle streaming

---

## 🔄 Request Flow

### **HTTP Request Flow:**
```
Client Request
    ↓
IP Whitelist Middleware (security.middleware.js)
    ↓ (if IP allowed)
API Key Middleware (security.middleware.js)
    ↓ (if API key valid)
Route Handler (server.js)
    ↓
Response
```

### **WebSocket Flow:**
```
Client WebSocket Connection
    ↓
verifyWebSocketClient (security.middleware.js)
    ↓ (check IP + API key)
WebSocket Upgrade
    ↓
WebSocketLiveController.handleConnection
    ↓
Message Routing
    ↓
GeminiLiveService
    ↓
AI Response → Client
```

---

## 🛡️ Security Architecture

### **Multi-Layer Security:**

**Layer 1: IP Whitelist**
- Location: `security.middleware.js`
- Applied: Before any processing
- Blocks: Non-whitelisted IPs immediately

**Layer 2: API Key**
- Location: `security.middleware.js`
- Applied: After IP check
- Blocks: Invalid/missing API keys

**Layer 3: WebSocket Verification**
- Location: `verifyWebSocketClient` in middleware
- Applied: Before WebSocket upgrade
- Blocks: Unauthorized WebSocket connections

---

## 📊 Environment Variables

```env
# Server
PORT=3000
NODE_ENV=production

# Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Security
API_KEY=your_secure_api_key_64_chars
WHITELIST_IPS=127.0.0.1,::1,YOUR_PRODUCTION_IP
```

---

## 🚀 Deployment

### **Development:**
```bash
npm start
```

### **Production:**
```bash
# Use PM2
pm2 start server.js --name gemini-audio-api
pm2 save
pm2 startup
```

---

## 🧪 Testing

### **Test Security:**
```bash
# 1. Health check (public)
curl http://localhost:3000/health

# 2. Protected endpoint without auth
curl http://localhost:3000/api/status
# → 401 Unauthorized

# 3. Protected endpoint with auth
curl -H "X-API-Key: your_key" http://localhost:3000/api/status
# → 200 OK
```

### **Test WebSocket:**
```javascript
const ws = new WebSocket('ws://localhost:3000', {
  headers: { 'X-API-Key': 'your_key' }
});

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'init',
    voiceName: 'Kore'
  }));
};
```

---

## 📝 Code Style

### **✅ Professional Practices:**

1. **Separation of Concerns**
   - Server setup → `server.js`
   - Security logic → `middleware/`
   - Business logic → `controllers/`
   - External APIs → `services/`

2. **Clean Code**
   - Clear function names
   - Single responsibility
   - No duplicate code
   - Proper error handling

3. **Security First**
   - Validate early
   - Fail securely
   - Log security events
   - Clear error messages

4. **Production Ready**
   - Environment variables
   - Graceful shutdown
   - Error handlers
   - Health checks

---

## 🔧 Maintenance

### **Adding New Routes:**
```javascript
// In server.js
app.get('/api/new-endpoint', ipWhitelistMiddleware, apiKeyMiddleware, (req, res) => {
  // Your logic
});
```

### **Modifying Security:**
```javascript
// In src/middleware/security.middleware.js
export function customSecurityCheck(req, res, next) {
  // Your custom logic
  next();
}
```

### **Adding New WebSocket Messages:**
```javascript
// In src/controllers/websocket-live.controller.js
case 'new_message_type':
  await this.handleNewMessageType(ws, liveService, data);
  break;
```

---

## 📚 Key Files Summary

| File | Purpose | Security |
|------|---------|----------|
| `server.js` | Main entry point | Uses middleware |
| `security.middleware.js` | Security logic | Implements checks |
| `websocket-live.controller.js` | WebSocket handler | Receives verified connections |
| `gemini-live.service.js` | AI integration | No security (internal) |

---

## ✅ Architecture Benefits

1. **Maintainable** - Clear structure, easy to find code
2. **Scalable** - Easy to add features
3. **Secure** - Centralized security logic
4. **Testable** - Separated concerns
5. **Professional** - Industry best practices

---

**This is the ONLY file for audio streaming: `server.js`**

All other files are supporting modules for clean architecture.
