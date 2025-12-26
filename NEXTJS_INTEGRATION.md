# Next.js 14 Integration Guide - Gemini Live Audio API

## 🎯 Overview

Hướng dẫn tích hợp Gemini Live Audio Streaming API vào Next.js 14 App Router.

---

## 📁 Project Structure

```
app/
├── api/
│   └── gemini-proxy/          # Optional: Proxy để ẩn API key
│       └── route.ts
├── components/
│   ├── GeminiLiveClient.tsx   # Main component
│   └── AudioVisualizer.tsx    # Audio visualizer
├── hooks/
│   └── useGeminiLive.ts       # Custom hook
└── page.tsx                   # Main page
```

---

## 🔧 1. Custom Hook: `useGeminiLive.ts`

```typescript
'use client';

import { useState, useRef, useCallback } from 'react';

interface UseGeminiLiveOptions {
  apiKey: string;
  serverUrl: string;
  voiceName?: string;
  promptType?: string;
  level?: string;
}

export function useGeminiLive({
  apiKey,
  serverUrl,
  voiceName = 'Kore',
  promptType = 'BASIC_CONVERSATION',
  level = 'intermediate'
}: UseGeminiLiveOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<'disconnected' | 'connected' | 'streaming'>('disconnected');
  const [logs, setLogs] = useState<Array<{ time: string; message: string; type: string }>>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<any>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);

  const log = useCallback((message: string, type: string = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { time, message, type }]);
    console.log(`[${time}] ${message}`);
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current) return;

    log('Connecting to server...', 'info');
    const ws = new WebSocket(`${serverUrl}?apiKey=${apiKey}`);

    ws.onopen = () => {
      log('✅ WebSocket connected', 'success');
      setIsConnected(true);
      setStatus('connected');

      // Initialize session
      ws.send(JSON.stringify({
        type: 'init',
        voiceName,
        promptType,
        level
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleMessage(data);
    };

    ws.onerror = (error) => {
      log('❌ WebSocket error', 'error');
      console.error(error);
    };

    ws.onclose = () => {
      log('WebSocket disconnected', 'info');
      setIsConnected(false);
      setStatus('disconnected');
      wsRef.current = null;
    };

    wsRef.current = ws;
  }, [apiKey, serverUrl, voiceName, promptType, level, log]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setStatus('disconnected');
  }, []);

  const handleMessage = useCallback(async (data: any) => {
    switch (data.type) {
      case 'ready':
        log('✅ Gemini Live ready', 'success');
        break;

      case 'audio_response':
        log('🔊 Received audio response', 'success');
        await playAudioResponse(data.audio, data.mimeType);
        break;

      case 'text_response':
        log(`🤖 AI: ${data.text}`, 'ai');
        break;

      case 'turn_complete':
        log('✅ Turn complete', 'success');
        break;

      case 'error':
        log(`❌ Error: ${data.message}`, 'error');
        break;
    }
  }, [log]);

  const playAudioResponse = async (base64Audio: string, mimeType: string) => {
    try {
      if (!base64Audio || base64Audio.length === 0) {
        log('❌ Empty audio data', 'error');
        return;
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000
        });
      }

      // Decode base64
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert PCM16 to Float32
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
    } catch (error: any) {
      log(`❌ Audio error: ${error.message}`, 'error');
    }
  };

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

    source.onended = () => {
      playNextAudio();
    };

    source.start(0);
  };

  const startRecording = useCallback(async () => {
    if (!isConnected || isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      source.connect(processor);
      processor.connect(audioContext.destination);

      wsRef.current?.send(JSON.stringify({ type: 'start_stream' }));

      processor.onaudioprocess = (e) => {
        if (!isRecording) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);

        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        const base64Audio = arrayBufferToBase64(pcm16.buffer);

        wsRef.current?.send(JSON.stringify({
          type: 'audio_chunk',
          audio: {
            data: base64Audio,
            mimeType: 'audio/pcm;rate=16000'
          }
        }));
      };

      mediaRecorderRef.current = { stream, processor, source, audioContext };
      setIsRecording(true);
      setStatus('streaming');
      log('🎙️ Recording started', 'success');

    } catch (error: any) {
      log(`❌ Microphone error: ${error.message}`, 'error');
    }
  }, [isConnected, isRecording, log]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      const { stream, processor, source, audioContext } = mediaRecorderRef.current;
      stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      processor.disconnect();
      source.disconnect();
      audioContext.close();
      mediaRecorderRef.current = null;
    }

    wsRef.current?.send(JSON.stringify({ type: 'end_stream' }));
    setIsRecording(false);
    setStatus('connected');
    log('⏹️ Recording stopped', 'info');
  }, [log]);

  return {
    isConnected,
    isRecording,
    status,
    logs,
    connect,
    disconnect,
    startRecording,
    stopRecording
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
```

---

## 🎨 2. Main Component: `GeminiLiveClient.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useGeminiLive } from '@/hooks/useGeminiLive';

export default function GeminiLiveClient() {
  const [apiKey, setApiKey] = useState('');
  const [serverUrl, setServerUrl] = useState('ws://localhost:3001');
  const [voiceName, setVoiceName] = useState('Kore');

  const {
    isConnected,
    isRecording,
    status,
    logs,
    connect,
    disconnect,
    startRecording,
    stopRecording
  } = useGeminiLive({
    apiKey,
    serverUrl,
    voiceName
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl p-8">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          🎤 Gemini Live Audio
        </h1>

        {/* Status Badge */}
        <div className="mb-6 text-center">
          <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${
            status === 'connected' ? 'bg-green-100 text-green-800' :
            status === 'streaming' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            <span className={`w-2 h-2 rounded-full mr-2 ${
              status === 'connected' ? 'bg-green-500' :
              status === 'streaming' ? 'bg-yellow-500 animate-pulse' :
              'bg-gray-500'
            }`} />
            {status === 'connected' ? 'Connected' :
             status === 'streaming' ? 'Recording...' :
             'Disconnected'}
          </span>
        </div>

        {/* Configuration */}
        {!isConnected && (
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key:
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter your API key"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Server URL:
              </label>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="ws://localhost:3001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Voice:
              </label>
              <select
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="Kore">Kore</option>
                <option value="Puck">Puck</option>
                <option value="Charon">Charon</option>
                <option value="Aoede">Aoede</option>
              </select>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-4 mb-6">
          {!isConnected ? (
            <button
              onClick={connect}
              disabled={!apiKey}
              className="flex-1 bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Connect
            </button>
          ) : (
            <>
              <button
                onClick={disconnect}
                className="flex-1 bg-gray-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-700 transition"
              >
                Disconnect
              </button>
              
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="flex-1 bg-red-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-red-700 transition"
                >
                  🎙️ Start Recording
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="flex-1 bg-orange-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-orange-700 transition animate-pulse"
                >
                  ⏹️ Stop Recording
                </button>
              )}
            </>
          )}
        </div>

        {/* Logs */}
        <div className="bg-gray-50 rounded-lg p-4 h-96 overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Logs:</h3>
          <div className="space-y-1 font-mono text-xs">
            {logs.map((log, i) => (
              <div
                key={i}
                className={`p-2 rounded ${
                  log.type === 'error' ? 'bg-red-50 text-red-800' :
                  log.type === 'success' ? 'bg-green-50 text-green-800' :
                  log.type === 'ai' ? 'bg-purple-50 text-purple-800' :
                  'bg-gray-100 text-gray-700'
                }`}
              >
                [{log.time}] {log.message}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 📄 3. Page: `app/page.tsx`

```typescript
import GeminiLiveClient from '@/components/GeminiLiveClient';

export default function Home() {
  return <GeminiLiveClient />;
}
```

---

## 🔐 4. Environment Variables: `.env.local`

```bash
NEXT_PUBLIC_GEMINI_API_KEY=your_api_key_here
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

---

## 🚀 5. Usage

```bash
# Install dependencies
npm install

# Run Next.js dev server
npm run dev

# Open browser
http://localhost:3000
```

---

## 📝 Key Points

### ✅ **Client-side Only**
- All WebSocket và audio processing chạy trên client
- Dùng `'use client'` directive
- API key có thể lưu trong localStorage hoặc environment variables

### ✅ **Web Audio API**
- Dùng AudioContext để xử lý PCM audio
- Sample rate: 24kHz (từ Gemini) và 16kHz (gửi lên)
- Convert PCM16 ↔ Float32

### ✅ **Real-time Streaming**
- WebSocket connection với query parameter API key
- Audio chunks streaming realtime
- Queue management cho smooth playback

### ✅ **Error Handling**
- Try-catch cho tất cả audio operations
- Logging chi tiết
- Graceful degradation

---

## 🎯 Production Considerations

### 1. **Security**
```typescript
// Không hardcode API key trong client code
// Option 1: Proxy qua Next.js API route
// Option 2: User nhập API key (như demo)
// Option 3: Server-side authentication
```

### 2. **Audio Queue Management**
```typescript
// Implement proper queue với max size
const MAX_QUEUE_SIZE = 10;
if (audioQueue.length > MAX_QUEUE_SIZE) {
  audioQueue.shift(); // Remove oldest
}
```

### 3. **Reconnection Logic**
```typescript
// Auto-reconnect khi disconnect
useEffect(() => {
  if (!isConnected && shouldReconnect) {
    const timer = setTimeout(connect, 3000);
    return () => clearTimeout(timer);
  }
}, [isConnected]);
```

### 4. **Mobile Support**
```typescript
// Check browser support
if (!navigator.mediaDevices?.getUserMedia) {
  alert('Browser không hỗ trợ audio recording');
}

// Handle iOS audio context
if (audioContext.state === 'suspended') {
  await audioContext.resume();
}
```

---

## 🎉 Done!

Bây giờ bạn có thể:
1. ✅ Test API với `test-gemini-live.html`
2. ✅ Integrate vào Next.js 14 với code trên
3. ✅ Customize UI/UX theo ý muốn

**Happy coding!** 🚀
