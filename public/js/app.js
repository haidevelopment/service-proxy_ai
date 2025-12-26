class GeminiLiveClient {
  constructor() {
    this.ws = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.isConnected = false;
    this.audioContext = null;
    this.audioQueue = [];
    this.isPlayingAudio = false;
    this.nextStartTime = 0;
    
    this.elements = {
      statusBadge: document.getElementById('statusBadge'),
      statusText: document.querySelector('.status-text'),
      chatContainer: document.getElementById('chatContainer'),
      recordBtn: document.getElementById('recordBtn'),
      textInput: document.getElementById('textInput'),
      sendBtn: document.getElementById('sendBtn'),
      audioVisualizer: document.getElementById('audioVisualizer'),
      responseTime: document.getElementById('responseTime'),
    };

    this.init();
  }

  init() {
    this.connectWebSocket();
    this.setupEventListeners();
  }

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('✅ WebSocket connected');
      this.updateStatus('connected', 'Đã kết nối');
      
      // Get configuration from form
      const promptType = document.getElementById('promptType')?.value || 'BASIC_CONVERSATION';
      const level = document.getElementById('level')?.value || 'intermediate';
      const voiceName = document.getElementById('voiceName')?.value || 'Kore';
      
      this.ws.send(JSON.stringify({ 
        type: 'init',
        promptType,
        level,
        voiceName
      }));
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(JSON.parse(event.data));
    };

    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      this.updateStatus('error', 'Lỗi kết nối');
    };

    this.ws.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      this.updateStatus('disconnected', 'Mất kết nối');
      this.disableControls();
      
      setTimeout(() => {
        console.log('🔄 Reconnecting...');
        this.connectWebSocket();
      }, 3000);
    };
  }

  async handleMessage(data) {
    switch (data.type) {
      case 'ready':
        this.isConnected = true;
        this.enableControls();
        this.showNotification(data.message, 'success');
        break;

      case 'streaming_started':
        console.log('✅ Streaming started');
        break;

      case 'stream_ended':
        console.log('✅ Stream ended');
        break;

      case 'text_response':
        // Don't display text when audio is being used
        break;

      case 'audio_response':
        this.queueAudioResponse(data.audio, data.mimeType);
        break;

      case 'turn_complete':
        this.removeTypingIndicator();
        break;

      case 'interrupted':
        // Stop and clear audio queue when interrupted
        this.audioQueue = [];
        this.isPlayingAudio = false;
        this.nextStartTime = 0;
        if (this.audioContext) {
          try {
            await this.audioContext.close();
          } catch (e) {}
          this.audioContext = null;
        }
        break;

      case 'error':
        this.showNotification(data.message, 'error');
        this.removeTypingIndicator();
        break;

      case 'session_closed':
        this.showNotification('Session closed: ' + data.reason, 'info');
        this.isConnected = false;
        this.disableControls();
        break;

      case 'stopped':
        console.log('Live API session stopped');
        break;
    }
  }

  setupEventListeners() {
    this.elements.recordBtn.addEventListener('click', () => {
      if (this.isRecording) {
        this.stopRecording();
      } else {
        this.startRecording();
      }
    });

    this.elements.sendBtn.addEventListener('click', () => this.sendTextMessage());
    
    this.elements.textInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendTextMessage();
      }
    });
  }

  async startRecording() {
    if (!this.isConnected || this.isRecording) return;

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

      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });

      const source = this.audioContext.createMediaStreamSource(stream);
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      source.connect(processor);
      processor.connect(this.audioContext.destination);

      this.ws.send(JSON.stringify({ type: 'start_stream' }));

      let chunkCount = 0;
      processor.onaudioprocess = (e) => {
        if (!this.isRecording) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        const base64Audio = this.arrayBufferToBase64(pcm16.buffer);
        
        chunkCount++;
        if (chunkCount % 50 === 0) {
          console.log(`📤 Sent ${chunkCount} audio chunks`);
        }
        
        this.ws.send(JSON.stringify({
          type: 'audio_chunk',
          audio: {
            data: base64Audio,
            mimeType: 'audio/pcm;rate=16000'
          }
        }));

        this.visualizeAudio(inputData);
      };

      this.mediaStream = stream;
      this.audioProcessor = processor;
      this.isRecording = true;
      
      this.elements.recordBtn.classList.add('recording');
      this.elements.recordBtn.querySelector('.record-text').textContent = 'Nhấn để dừng';
      this.elements.audioVisualizer.classList.add('active');

      this.addUserMessage('🎤 Đang nói chuyện real-time...', true);

      console.log('🎤 Real-time streaming started');
    } catch (error) {
      console.error('❌ Error accessing microphone:', error);
      this.showNotification('Không thể truy cập microphone. Vui lòng cho phép quyền truy cập.', 'error');
    }
  }

  stopRecording() {
    if (!this.isRecording) return;

    this.isRecording = false;

    if (this.audioProcessor) {
      this.audioProcessor.disconnect();
      this.audioProcessor = null;
    }

    // Clear audio queue
    this.audioQueue = [];
    this.isPlayingAudio = false;
    this.nextStartTime = 0;

    if (this.audioContext) {
      this.audioContext.close().catch(e => {});
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    this.ws.send(JSON.stringify({ type: 'end_stream' }));
    
    this.elements.recordBtn.classList.remove('recording');
    this.elements.recordBtn.querySelector('.record-text').textContent = 'Bắt đầu nói chuyện';
    this.elements.audioVisualizer.classList.remove('active');

    console.log('⏹️ Real-time streaming stopped');
  }

  visualizeAudio(audioData) {
    const bars = this.elements.audioVisualizer.querySelectorAll('.visualizer-bar');
    const barCount = bars.length;
    const samplesPerBar = Math.floor(audioData.length / barCount);

    bars.forEach((bar, i) => {
      let sum = 0;
      for (let j = 0; j < samplesPerBar; j++) {
        sum += Math.abs(audioData[i * samplesPerBar + j]);
      }
      const average = sum / samplesPerBar;
      const height = Math.min(100, average * 200);
      bar.style.height = `${height}%`;
    });
  }

  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  async queueAudioResponse(base64Audio, mimeType) {
    try {
      console.log('🎵 Processing audio response:', {
        mimeType,
        base64Length: base64Audio?.length || 0,
        base64Sample: base64Audio?.substring(0, 50) || 'empty'
      });

      if (!base64Audio || base64Audio.length === 0) {
        console.error('❌ Empty audio data received');
        return;
      }

      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 24000
        });
        console.log('✅ Audio context created:', this.audioContext.sampleRate);
      }

      // Decode base64
      const binaryString = atob(base64Audio);
      console.log('📦 Decoded binary length:', binaryString.length);
      
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      console.log('📦 Bytes array length:', bytes.length);
      
      // Convert PCM16 to Float32
      const int16Array = new Int16Array(bytes.buffer);
      console.log('🔢 Int16 array length:', int16Array.length, 'samples');
      
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768;
      }
      
      // Create audio buffer
      const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);
      
      console.log('✅ Audio buffer created:', {
        duration: audioBuffer.duration.toFixed(2) + 's',
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
        samples: audioBuffer.length
      });
      
      this.audioQueue.push(audioBuffer);
      console.log('📋 Audio queue length:', this.audioQueue.length);
      
      if (!this.isPlayingAudio) {
        console.log('▶️ Starting audio playback');
        this.playNextAudio();
      }
    } catch (error) {
      console.error('❌ Error queueing audio:', {
        error: error.message,
        stack: error.stack,
        mimeType,
        dataLength: base64Audio?.length
      });
    }
  }

  playNextAudio() {
    if (this.audioQueue.length === 0) {
      console.log('⏹️ Audio queue empty, stopping playback');
      this.isPlayingAudio = false;
      this.nextStartTime = 0;
      return;
    }

    this.isPlayingAudio = true;
    const audioBuffer = this.audioQueue.shift();
    
    const ctx = this.audioContext;
    this.nextStartTime = Math.max(this.nextStartTime, ctx.currentTime);
    
    console.log('▶️ Playing audio:', {
      duration: audioBuffer.duration.toFixed(2) + 's',
      startTime: this.nextStartTime.toFixed(2) + 's',
      currentTime: ctx.currentTime.toFixed(2) + 's',
      queueRemaining: this.audioQueue.length
    });
    
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    
    source.onended = () => {
      console.log('✅ Audio chunk finished');
      this.playNextAudio();
    };
    
    try {
      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      console.log('✅ Audio playback started successfully');
    } catch (error) {
      console.error('❌ Audio playback error:', error);
      this.playNextAudio();
    }
  }


  sendTextMessage() {
    const text = this.elements.textInput.value.trim();
    if (!text || !this.isConnected) return;

    this.addUserMessage(text);
    this.addTypingIndicator();

    this.ws.send(JSON.stringify({
      type: 'text',
      text: text,
    }));

    this.elements.textInput.value = '';
    console.log('📤 Text sent:', text);
  }

  addUserMessage(text, isAudio = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    
    messageDiv.innerHTML = `
      <div class="message-content">
        ${isAudio ? text : this.escapeHtml(text)}
      </div>
    `;

    const welcomeMsg = this.elements.chatContainer.querySelector('.welcome-message');
    if (welcomeMsg) {
      welcomeMsg.remove();
    }

    this.elements.chatContainer.appendChild(messageDiv);
    this.scrollToBottom();
  }

  addTypingIndicator() {
    const existingIndicator = this.elements.chatContainer.querySelector('.typing-indicator');
    if (existingIndicator) return;

    const indicatorDiv = document.createElement('div');
    indicatorDiv.className = 'message assistant';
    indicatorDiv.innerHTML = `
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;

    this.elements.chatContainer.appendChild(indicatorDiv);
    this.scrollToBottom();
  }

  removeTypingIndicator() {
    const indicator = this.elements.chatContainer.querySelector('.typing-indicator');
    if (indicator) {
      indicator.parentElement.remove();
    }
  }

  updateAssistantMessage(text) {
    let messageDiv = this.elements.chatContainer.querySelector('.message.assistant:last-child');
    
    const hasTypingIndicator = messageDiv?.querySelector('.typing-indicator');
    
    if (hasTypingIndicator) {
      this.removeTypingIndicator();
      messageDiv = null;
    }

    if (!messageDiv || messageDiv.querySelector('.typing-indicator')) {
      messageDiv = document.createElement('div');
      messageDiv.className = 'message assistant';
      messageDiv.innerHTML = `<div class="message-content"></div>`;
      this.elements.chatContainer.appendChild(messageDiv);
    }

    const contentDiv = messageDiv.querySelector('.message-content');
    contentDiv.innerHTML = this.formatText(text);
    
    this.scrollToBottom();
  }

  finalizeAssistantMessage(text) {
    this.removeTypingIndicator();
    if (text) {
      this.updateAssistantMessage(text);
    }
  }

  formatText(text) {
    return this.escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  scrollToBottom() {
    this.elements.chatContainer.scrollTop = this.elements.chatContainer.scrollHeight;
  }

  updateStatus(status, text) {
    this.elements.statusBadge.className = `status-badge ${status}`;
    this.elements.statusText.textContent = text;
  }

  enableControls() {
    this.elements.recordBtn.disabled = false;
    this.elements.textInput.disabled = false;
    this.elements.sendBtn.disabled = false;
  }

  disableControls() {
    this.elements.recordBtn.disabled = true;
    this.elements.textInput.disabled = true;
    this.elements.sendBtn.disabled = true;
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 24px;
      background: ${type === 'error' ? '#ea4335' : type === 'success' ? '#34a853' : '#4285f4'};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      animation: slideInRight 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => {
  new GeminiLiveClient();
});
