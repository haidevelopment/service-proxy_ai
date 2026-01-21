import GeminiLiveService from '../services/gemini-live.service.js';
import { buildSystemInstruction, getGreeting } from '../config/prompts.js';
import { getClientIP, getSessionInfo } from '../middleware/security.middleware.js';

class WebSocketLiveController {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.activeSessions = new Map();
  }

  handleConnection(ws, req) {
    const ip = getClientIP(req);
    const sessionInfo = getSessionInfo(req);
    
    const sessionId = sessionInfo.sessionId || this.generateSessionId();
    const userId = sessionInfo.userId || 'anonymous';
    
    console.log(`🔌 WebSocket connected:`, {
      userId,
      sessionId,
      examId: sessionInfo.examId,
      ip
    });
    
    const session = {
      sessionId,
      userId,
      examId: sessionInfo.examId,
      ip,
      ws,
      liveService: null,
      startTime: Date.now(),
      lastActivity: Date.now(),
      isConnected: false,
      isStreaming: false,
      hasStarted: false,
      greetingMessage: null,
      stats: {
        audioChunksSent: 0,
        audioChunksReceived: 0,
        messagesSent: 0,
        messagesReceived: 0
      },
      studentInfo: null,
      examData: null
    };
    
    this.activeSessions.set(sessionId, session);
    
    ws.send(JSON.stringify({
      type: 'session_info',
      sessionId,
      userId,
      timestamp: Date.now()
    }));

    ws.on('message', async (message) => {
      try {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
          ws.send(JSON.stringify({ type: 'error', message: 'Session not found' }));
          return;
        }
        
        session.lastActivity = Date.now();
        session.stats.messagesReceived++;
        
        const data = JSON.parse(message);
        data.sessionId = sessionId;
        data.userId = userId;

        switch (data.type) {
          case 'init':
            await this.handleInit(session, data);
            break;
          case 'start_stream':
            await this.handleStartStream(session, data);
            break;
          case 'audio_chunk':
            session.stats.audioChunksReceived++;
            await this.handleAudioChunk(session, data);
            break;
          case 'end_stream':
            await this.handleEndStream(session, data);
            break;
          case 'text':
            await this.handleText(session, data);
            break;
          case 'stop':
            await this.handleStop(session);
            break;
          default:
            console.warn(`⚠️ Unknown message type: ${data.type} from session ${sessionId}`);
        }
        
        session.stats.messagesSent++;
        
      } catch (error) {
        console.error(`❌ Error handling message for session ${sessionId}:`, error);
        ws.send(JSON.stringify({
          type: 'error',
          message: error.message,
          sessionId
        }));
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(sessionId);
    });

    ws.on('error', (error) => {
      console.error(`❌ WebSocket error for session ${sessionId}:`, error);
      this.handleDisconnect(sessionId);
    });
  }

  async handleInit(session, data) {
    const { ws } = session;
    
    try {
      console.log(`🎬 Initializing session ${session.sessionId} for user ${session.userId}`);
      
      if (data.studentInfo) {
        session.studentInfo = data.studentInfo;
      }
      
      if (data.examId) {
        session.examData = {
          examId: data.examId,
          examType: data.examType,
          timeLimit: data.timeLimit,
          startTime: Date.now()
        };
      }
      
      const voiceName = data.voiceName || 'Kore';
      const promptType = data.promptType || 'BASIC_CONVERSATION';
      const level = data.level || 'intermediate';
      const topic = data.topic || null;

      const systemInstruction = buildSystemInstruction(promptType, level, topic);
      const greeting = getGreeting(promptType, level);

      session.liveService = new GeminiLiveService(this.apiKey);
      
      await session.liveService.connect({
        onopen: () => {
          ws.send(JSON.stringify({
            type: 'ready',
            message: 'Gemini Live API ready',
            sessionId: session.sessionId,
            userId: session.userId,
            voiceName,
            promptType,
            level
          }));
          console.log(`✅ Session ${session.sessionId} ready - User: ${session.userId}, Voice: ${voiceName}`);
        },
        onmessage: (message) => {
          if (message.serverContent) {
            const parts = message.serverContent.modelTurn?.parts || [];
            
            if (message.serverContent.inputTranscription?.text) {
              ws.send(JSON.stringify({
                type: 'user_transcript',
                text: message.serverContent.inputTranscription.text,
                sessionId: session.sessionId,
                userId: session.userId
              }));
            }

            if (message.serverContent.outputTranscription?.text) {
              ws.send(JSON.stringify({
                type: 'text_response',
                text: message.serverContent.outputTranscription.text,
                sessionId: session.sessionId,
                userId: session.userId
              }));
            }
            
            parts.forEach(part => {
              if (part.text) {
                ws.send(JSON.stringify({
                  type: 'text_response',
                  text: part.text,
                  sessionId: session.sessionId,
                  userId: session.userId
                }));
              }
              
              if (part.inlineData && part.inlineData.mimeType.startsWith('audio/')) {
                session.stats.audioChunksSent++;
                
                ws.send(JSON.stringify({
                  type: 'audio_response',
                  audio: part.inlineData.data,
                  mimeType: part.inlineData.mimeType,
                  sessionId: session.sessionId,
                  userId: session.userId
                }));
              }
            });

            if (message.serverContent.turnComplete) {
              ws.send(JSON.stringify({
                type: 'turn_complete',
                sessionId: session.sessionId,
                userId: session.userId
              }));
            }

            if (message.serverContent.interrupted) {
              ws.send(JSON.stringify({
                type: 'interrupted',
                message: 'Model was interrupted',
                sessionId: session.sessionId,
                userId: session.userId
              }));
            }
          }
        },
        onerror: (error) => {
          ws.send(JSON.stringify({
            type: 'error',
            message: error.message,
            sessionId: session.sessionId,
            userId: session.userId
          }));
        },
        onclose: (event) => {
          ws.send(JSON.stringify({
            type: 'session_closed',
            reason: event.reason,
            sessionId: session.sessionId,
            userId: session.userId
          }));
        }
      }, {
        voiceName,
        systemInstruction,
        topic,
        level
      });
      
      session.greetingMessage = greeting;
      session.isConnected = true;
      
    } catch (error) {
      console.error(`❌ Failed to initialize session ${session.sessionId}:`, error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to connect to Gemini Live API: ' + error.message,
        sessionId: session.sessionId,
        userId: session.userId
      }));
    }
  }

  async handleStartStream(session, data) {
    const { ws, liveService } = session;
    
    if (!session.isConnected) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Live API not connected',
        sessionId: session.sessionId
      }));
      return;
    }
    
    session.isStreaming = true;
    ws.send(JSON.stringify({
      type: 'streaming_started',
      message: 'Real-time audio streaming active',
      sessionId: session.sessionId,
      userId: session.userId
    }));
    
    console.log(`🎙️ Streaming started - Session: ${session.sessionId}, User: ${session.userId}`);
    
    if (!session.hasStarted && session.greetingMessage) {
      session.hasStarted = true;
      setTimeout(() => {
        liveService.sendText(session.greetingMessage);
        console.log(`👋 Greeting sent - Session: ${session.sessionId}`);
      }, 500);
    }
  }

  async handleAudioChunk(session, data) {
    const { ws, liveService } = session;
    
    if (!session.isStreaming) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Not in streaming mode',
        sessionId: session.sessionId
      }));
      return;
    }
    
    try {
      if (!data.audio) {
        console.error(`❌ No audio data - Session: ${session.sessionId}`);
        return;
      }
      
      await liveService.sendRealtimeInput(data.audio);
    } catch (error) {
      console.error(`❌ Error sending audio - Session: ${session.sessionId}:`, error.message);
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message,
        sessionId: session.sessionId
      }));
    }
  }

  async handleEndStream(session, data) {
    const { ws, liveService } = session;
    
    console.log(`🎙️ Ending stream - Session: ${session.sessionId}, User: ${session.userId}`);
    session.isStreaming = false;
    
    try {
      await liveService.endAudioStream();
      ws.send(JSON.stringify({
        type: 'stream_ended',
        sessionId: session.sessionId,
        userId: session.userId,
        stats: data.stats || null
      }));
    } catch (error) {
      console.error(`❌ Error ending stream - Session: ${session.sessionId}:`, error);
    }
  }

  async handleText(session, data) {
    const { ws, liveService } = session;
    
    if (!session.isConnected) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Live API not connected',
        sessionId: session.sessionId
      }));
      return;
    }
    
    try {
      console.log(`💬 Text message - Session: ${session.sessionId}:`, data.text);
      await liveService.sendText(data.text);
    } catch (error) {
      console.error(`❌ Error sending text - Session: ${session.sessionId}:`, error);
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message,
        sessionId: session.sessionId
      }));
    }
  }

  async handleStop(session) {
    const { ws, liveService } = session;
    
    console.log(`🛑 Stopping session ${session.sessionId}`);
    
    if (liveService) {
      await liveService.disconnect();
    }
    
    ws.send(JSON.stringify({
      type: 'stopped',
      message: 'Session stopped',
      sessionId: session.sessionId,
      userId: session.userId,
      stats: session.stats
    }));
  }

  handleDisconnect(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    
    const duration = ((Date.now() - session.startTime) / 1000).toFixed(2);
    
    console.log(`🔌 Disconnected - Session: ${sessionId}, User: ${session.userId}`);
    console.log(`📊 Stats:`, {
      duration: duration + 's',
      audioSent: session.stats.audioChunksSent,
      audioReceived: session.stats.audioChunksReceived,
      messages: session.stats.messagesReceived
    });
    
    if (session.liveService) {
      session.liveService.close();
    }
    
    this.activeSessions.delete(sessionId);
    console.log(`📊 Active sessions: ${this.activeSessions.size}`);
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getActiveSessions() {
    const sessions = [];
    this.activeSessions.forEach((session, sessionId) => {
      sessions.push({
        sessionId,
        userId: session.userId,
        examId: session.examId,
        ip: session.ip,
        startTime: session.startTime,
        duration: ((Date.now() - session.startTime) / 1000).toFixed(2) + 's',
        isConnected: session.isConnected,
        isStreaming: session.isStreaming,
        stats: session.stats
      });
    });
    return sessions;
  }
}

export default WebSocketLiveController;
