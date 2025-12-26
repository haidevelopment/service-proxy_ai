# 🎤 Gemini Live Audio Streaming API

API server cho phép nói chuyện realtime với AI thông qua WebSocket với audio streaming.

---

## 🚀 Quick Start

### 1. Cài đặt

```bash
npm install
```

### 2. Cấu hình `.env`

```env
# Server
PORT=3001
NODE_ENV=production

# Gemini AI API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Security
API_KEY=your_secure_api_key_here
WHITELIST_IPS=127.0.0.1,::1
```

### 3. Chạy server

```bash
node server.js
```

Server chạy tại: `http://localhost:3001`

---

## 📡 API Documentation

### **WebSocket Connection**

```
ws://localhost:3001/?apiKey=YOUR_API_KEY&userId=USER_ID&sessionId=SESSION_ID
```

**Query Parameters:**
- `apiKey` (required): API key để authentication
- `userId` (optional): ID của user
- `sessionId` (optional): Session ID (auto-generate nếu không có)
- `examId` (optional): Exam ID nếu là bài thi

---

## 📤 Messages gửi LÊN server

### **1. Initialize Session**

Khởi tạo session - **BẮT BUỘC gửi đầu tiên**

```javascript
{
  type: 'init',
  
  // User Info
  userId: 'user_123',
  sessionId: 'session_abc',
  
  // AI Config
  voiceName: 'Kore',              // Kore, Puck, Charon, Aoede
  promptType: 'BASIC_CONVERSATION', // Loại prompt
  level: 'intermediate',           // beginner, intermediate, advanced
  
  // Optional: Exam Info
  examId: 'exam_456',
  examType: 'speaking_test',
  timeLimit: 600,                  // seconds
  
  // Optional: Student Info
  studentInfo: {
    studentId: 'student_789',
    name: 'Nguyen Van A',
    email: 'student@example.com',
    class: '10A1'
  }
}
```

**Prompt Types:**
- `BASIC_CONVERSATION` - Hội thoại cơ bản
- `DAILY_LIFE` - Cuộc sống hàng ngày
- `TRAVEL` - Du lịch
- `WORK_CAREER` - Công việc
- `TECHNOLOGY` - Công nghệ
- `IELTS_PART1` - IELTS Speaking Part 1
- `IELTS_PART2` - IELTS Speaking Part 2
- `IELTS_PART3` - IELTS Speaking Part 3

---

### **2. Start Audio Stream**

Bắt đầu streaming audio

```javascript
{
  type: 'start_stream',
  userId: 'user_123',
  sessionId: 'session_abc'
}
```

---

### **3. Send Audio Chunk**

Gửi audio chunk (liên tục khi đang record)

```javascript
{
  type: 'audio_chunk',
  userId: 'user_123',
  sessionId: 'session_abc',
  audio: {
    data: 'BASE64_ENCODED_PCM_AUDIO',
    mimeType: 'audio/pcm;rate=16000'
  }
}
```

**Audio Format:**
- **Encoding:** PCM 16-bit signed integer
- **Sample Rate:** 16000 Hz
- **Channels:** 1 (mono)
- **Format:** Base64 string

**Convert audio to PCM16:**

```javascript
// 1. Get Float32 audio data from microphone
const inputData = audioBuffer.getChannelData(0);

// 2. Convert Float32 → PCM16
const pcm16 = new Int16Array(inputData.length);
for (let i = 0; i < inputData.length; i++) {
  const s = Math.max(-1, Math.min(1, inputData[i]));
  pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
}

// 3. Convert to Base64
const bytes = new Uint8Array(pcm16.buffer);
let binary = '';
for (let i = 0; i < bytes.byteLength; i++) {
  binary += String.fromCharCode(bytes[i]);
}
const base64Audio = btoa(binary);

// 4. Send
ws.send(JSON.stringify({
  type: 'audio_chunk',
  audio: {
    data: base64Audio,
    mimeType: 'audio/pcm;rate=16000'
  }
}));
```

---

### **4. End Audio Stream**

Kết thúc streaming

```javascript
{
  type: 'end_stream',
  userId: 'user_123',
  sessionId: 'session_abc'
}
```

---

### **5. Send Text**

Gửi text message (optional)

```javascript
{
  type: 'text',
  userId: 'user_123',
  sessionId: 'session_abc',
  text: 'Hello, how are you?'
}
```

---

### **6. Stop Session**

Dừng session

```javascript
{
  type: 'stop',
  userId: 'user_123',
  sessionId: 'session_abc'
}
```

---

## 📥 Messages nhận TỪ server

### **1. Session Info**

Thông tin session sau khi connect

```javascript
{
  type: 'session_info',
  sessionId: 'session_abc',
  userId: 'user_123',
  timestamp: 1703607000000
}
```

---

### **2. Ready**

Session đã sẵn sàng

```javascript
{
  type: 'ready',
  message: 'Gemini Live API ready',
  sessionId: 'session_abc',
  userId: 'user_123',
  voiceName: 'Kore',
  promptType: 'BASIC_CONVERSATION',
  level: 'intermediate'
}
```

---

### **3. Audio Response**

Nhận audio từ AI

```javascript
{
  type: 'audio_response',
  audio: 'BASE64_ENCODED_PCM_AUDIO',
  mimeType: 'audio/pcm;rate=24000',
  sessionId: 'session_abc',
  userId: 'user_123'
}
```

**Play audio:**

```javascript
// 1. Decode base64
const binaryString = atob(audioData);
const bytes = new Uint8Array(binaryString.length);
for (let i = 0; i < binaryString.length; i++) {
  bytes[i] = binaryString.charCodeAt(i);
}

// 2. Convert PCM16 → Float32
const int16Array = new Int16Array(bytes.buffer);
const float32Array = new Float32Array(int16Array.length);
for (let i = 0; i < int16Array.length; i++) {
  float32Array[i] = int16Array[i] / 32768;
}

// 3. Create AudioBuffer
const audioContext = new AudioContext({ sampleRate: 24000 });
const audioBuffer = audioContext.createBuffer(1, float32Array.length, 24000);
audioBuffer.getChannelData(0).set(float32Array);

// 4. Play with queue to prevent overlapping
audioQueue.push(audioBuffer);
if (!isPlayingAudio) {
  playNextAudio();
}
```

---

### **4. Text Response**

Nhận text từ AI

```javascript
{
  type: 'text_response',
  text: 'Hello! How can I help you?',
  sessionId: 'session_abc',
  userId: 'user_123'
}
```

---

### **5. Turn Complete**

AI đã hoàn thành lượt trả lời

```javascript
{
  type: 'turn_complete',
  sessionId: 'session_abc',
  userId: 'user_123'
}
```

---

### **6. Error**

Có lỗi xảy ra

```javascript
{
  type: 'error',
  message: 'Error description',
  sessionId: 'session_abc',
  userId: 'user_123'
}
```

---

## 🎯 Next.js 14 Integration

### **1. Install dependencies**

```bash
npm install
```

### **2. Create custom hook: `hooks/useGeminiLive.ts`**

```typescript
'use client';

import { useState, useRef, useCallback } from 'react';

interface UseGeminiLiveOptions {
  apiKey: string;
  serverUrl: string;
  userId: string;
  voiceName?: string;
  promptType?: string;
  level?: string;
}

export function useGeminiLive({
  apiKey,
  serverUrl,
  userId,
  voiceName = 'Kore',
  promptType = 'BASIC_CONVERSATION',
  level = 'intermediate'
}: UseGeminiLiveOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);

  // Connect to WebSocket
  const connect = useCallback(() => {
    const generatedSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const wsUrl = `${serverUrl}?apiKey=${apiKey}&userId=${userId}&sessionId=${generatedSessionId}`;
    
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('✅ Connected');
      setIsConnected(true);
      
      // Initialize session
      ws.send(JSON.stringify({
        type: 'init',
        userId,
        sessionId: generatedSessionId,
        voiceName,
        promptType,
        level
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleMessage(data);
    };

    ws.onerror = () => {
      console.error('❌ WebSocket error');
    };

    ws.onclose = () => {
      console.log('🔌 Disconnected');
      setIsConnected(false);
      wsRef.current = null;
    };

    wsRef.current = ws;
  }, [apiKey, serverUrl, userId, voiceName, promptType, level]);

  // Handle messages from server
  const handleMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'session_info':
        setSessionId(data.sessionId);
        console.log('📋 Session:', data.sessionId);
        break;
        
      case 'ready':
        console.log('✅ Ready');
        break;
        
      case 'audio_response':
        playAudioResponse(data.audio);
        break;
        
      case 'text_response':
        console.log('🤖 AI:', data.text);
        break;
        
      case 'turn_complete':
        console.log('✅ Turn complete');
        break;
    }
  }, []);

  // Play audio response
  const playAudioResponse = async (base64Audio: string) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }

    // Decode base64
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Convert PCM16 → Float32
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768;
    }

    // Create audio buffer
    const audioBuffer = audioContextRef.current.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);

    // Queue and play
    audioQueueRef.current.push(audioBuffer);
    if (!isPlayingRef.current) {
      playNextAudio();
    }
  };

  // Play next audio in queue
  const playNextAudio = () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const audioBuffer = audioQueueRef.current.shift()!;
    const ctx = audioContextRef.current!;

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.onended = () => playNextAudio();
    source.start(0);
  };

  // Start recording
  const startRecording = useCallback(async () => {
    if (!isConnected) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, sampleRate: 16000 }
    });

    const audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    source.connect(processor);
    processor.connect(audioContext.destination);

    wsRef.current?.send(JSON.stringify({ type: 'start_stream' }));

    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(inputData.length);

      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      const bytes = new Uint8Array(pcm16.buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Audio = btoa(binary);

      wsRef.current?.send(JSON.stringify({
        type: 'audio_chunk',
        audio: {
          data: base64Audio,
          mimeType: 'audio/pcm;rate=16000'
        }
      }));
    };

    setIsRecording(true);
  }, [isConnected]);

  // Stop recording
  const stopRecording = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'end_stream' }));
    setIsRecording(false);
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'stop' }));
    wsRef.current?.close();
  }, []);

  return {
    isConnected,
    isRecording,
    sessionId,
    connect,
    disconnect,
    startRecording,
    stopRecording
  };
}
```

---

### **3. Create component: `components/GeminiLiveChat.tsx`**

```typescript
'use client';

import { useGeminiLive } from '@/hooks/useGeminiLive';

export default function GeminiLiveChat() {
  const {
    isConnected,
    isRecording,
    sessionId,
    connect,
    disconnect,
    startRecording,
    stopRecording
  } = useGeminiLive({
    apiKey: process.env.NEXT_PUBLIC_API_KEY!,
    serverUrl: process.env.NEXT_PUBLIC_WS_URL!,
    userId: 'user_' + Math.random().toString(36).substr(2, 9),
    voiceName: 'Kore',
    promptType: 'BASIC_CONVERSATION',
    level: 'intermediate'
  });

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">🎤 Gemini Live Chat</h1>
      
      {/* Status */}
      <div className="mb-4">
        <span className={`px-4 py-2 rounded-full ${
          isConnected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {isConnected ? '🟢 Connected' : '⚫ Disconnected'}
        </span>
        {sessionId && (
          <span className="ml-4 text-sm text-gray-600">
            Session: {sessionId}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-4">
        {!isConnected ? (
          <button
            onClick={connect}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Connect
          </button>
        ) : (
          <>
            <button
              onClick={disconnect}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Disconnect
            </button>
            
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                🎙️ Start Recording
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 animate-pulse"
              >
                ⏹️ Stop Recording
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

---

### **4. Environment Variables: `.env.local`**

```env
NEXT_PUBLIC_API_KEY=your_api_key_here
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

---

### **5. Usage in page: `app/page.tsx`**

```typescript
import GeminiLiveChat from '@/components/GeminiLiveChat';

export default function Home() {
  return <GeminiLiveChat />;
}
```

---

## 🎯 Complete Flow

```
1. User connects → WebSocket với userId, sessionId
2. Server gửi session_info
3. Client gửi init với config
4. Server gửi ready
5. Client gửi start_stream
6. Client gửi audio_chunk liên tục
7. Server gửi audio_response (multiple chunks)
8. Client play audio sequentially (dùng queue)
9. Server gửi turn_complete
10. Client gửi end_stream
11. Lặp lại từ bước 5
```

---

## 📊 Technical Specs

### **Audio Input (gửi lên):**
- Format: PCM 16-bit signed integer
- Sample Rate: 16000 Hz
- Channels: 1 (mono)
- Encoding: Base64

### **Audio Output (nhận về):**
- Format: PCM 16-bit signed integer
- Sample Rate: 24000 Hz
- Channels: 1 (mono)
- Encoding: Base64

---

## 🔒 Security

- API key authentication
- IP whitelist
- Session-based tracking
- Environment variables

---

## 📝 Notes

- Mỗi user có `userId` riêng
- Mỗi connection có `sessionId` riêng
- Server track stats per session
- Hỗ trợ nhiều user cùng lúc
- Audio queue để tránh chồng chéo

---

## 🚀 Production Ready

✅ Clean architecture
✅ Session management
✅ Multi-user support
✅ Error handling
✅ Logging
✅ Security
✅ Scalable

---

**Built with ❤️ using Google Gemini Live API**
