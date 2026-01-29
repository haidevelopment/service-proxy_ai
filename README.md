# 🎤 Gemini Live Audio Streaming API

Realtime AI conversation service với WebSocket audio streaming.

## 🚀 Quick Start

```bash
# Install
npm install

# Configure .env
cp .env.example .env
# Edit: GEMINI_API_KEY, API_KEY, PORT

# Run
node server.js
```

Server: `http://localhost:3001`

---

## 📡 API Endpoints

### **WebSocket Connection**

```
ws://localhost:3001/?apiKey=YOUR_API_KEY&userId=USER_ID&sessionId=SESSION_ID
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `apiKey` | ✅ | API key authentication |
| `userId` | ❌ | User identifier |
| `sessionId` | ❌ | Session ID (auto-generated) |
| `examId` | ❌ | Exam ID for tests |

---

## 📤 Client → Server Messages

| Type | Description | Payload |
|------|-------------|---------|
| `init` | Initialize session (required first) | `{ type, userId, sessionId, voiceName, promptType, level, examId?, studentInfo? }` |
| `start_stream` | Start audio streaming | `{ type, userId, sessionId }` |
| `audio_chunk` | Send audio data | `{ type, userId, sessionId, audio: { data, mimeType } }` |
| `end_stream` | End audio streaming | `{ type, userId, sessionId }` |
| `text` | Send text message | `{ type, userId, sessionId, text }` |
| `stop` | Stop session | `{ type, userId, sessionId }` |

**Prompt Types:** `BASIC_CONVERSATION`, `DAILY_LIFE`, `TRAVEL`, `WORK_CAREER`, `TECHNOLOGY`, `IELTS_PART1`, `IELTS_PART2`, `IELTS_PART3`

**Voice Names:** `Kore`, `Puck`, `Charon`, `Aoede`

**Levels:** `beginner`, `intermediate`, `advanced`

### Audio Format (Input)
- **Encoding:** PCM 16-bit, Base64
- **Sample Rate:** 16000 Hz
- **Channels:** Mono

---

## 📥 Server → Client Messages

| Type | Description | Payload |
|------|-------------|---------|
| `session_info` | Session created | `{ type, sessionId, userId, timestamp }` |
| `ready` | Session ready | `{ type, message, sessionId, userId, voiceName, promptType, level }` |
| `audio_response` | AI audio response | `{ type, audio, mimeType, sessionId, userId }` |
| `text_response` | AI text response | `{ type, text, sessionId, userId }` |
| `turn_complete` | AI turn finished | `{ type, sessionId, userId }` |
| `error` | Error occurred | `{ type, message, sessionId, userId }` |

### Audio Format (Output)
- **Encoding:** PCM 16-bit, Base64
- **Sample Rate:** 24000 Hz
- **Channels:** Mono

---

## 🔄 Connection Flow

```
1. Connect WebSocket → session_info
2. Send init → ready
3. Send start_stream
4. Send audio_chunk (continuous)
5. Receive audio_response + text_response
6. Receive turn_complete
7. Send end_stream
8. Repeat from step 3 or send stop
```

---

## 💻 Integration Example

### WebSocket Client
```javascript
const ws = new WebSocket('ws://localhost:3001/?apiKey=YOUR_KEY&userId=user123');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'init',
    userId: 'user123',
    sessionId: 'session_abc',
    voiceName: 'Kore',
    promptType: 'BASIC_CONVERSATION',
    level: 'intermediate'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle: session_info, ready, audio_response, text_response, turn_complete, error
};
```

### Audio Processing
```javascript
// Convert Float32 → PCM16 → Base64
const pcm16 = new Int16Array(audioData.length);
for (let i = 0; i < audioData.length; i++) {
  const s = Math.max(-1, Math.min(1, audioData[i]));
  pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
}
const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));

// Send
ws.send(JSON.stringify({
  type: 'audio_chunk',
  audio: { data: base64, mimeType: 'audio/pcm;rate=16000' }
}));
```

---

## 🔒 Security

- ✅ API key authentication
- ✅ IP whitelist support
- ✅ Session-based tracking
- ✅ Environment variables

---

## 📝 Features

- Multi-user concurrent sessions
- Real-time audio streaming
- Multiple AI voices & prompt types
- Exam mode support
- Session statistics tracking

---

**Built with Google Gemini Live API**
