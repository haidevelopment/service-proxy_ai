import 'dotenv/config';
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import WebSocketLiveController from './src/controllers/websocket-live.controller.js';
import { verifyWebSocketClient, validateSecurityConfig } from './src/middleware/security.middleware.js';
import { setupRoutes } from './src/routes/api.routes.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, verifyClient: verifyWebSocketClient });

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY required');
  process.exit(1);
}

validateSecurityConfig();
setupRoutes(app, GEMINI_API_KEY);

const wsController = new WebSocketLiveController(GEMINI_API_KEY);
wss.on('connection', (ws, req) => wsController.handleConnection(ws, req));
wss.on('error', (error) => console.error('❌ WebSocket error:', error));

app.use((req, res) => res.status(404).json({ success: false, error: 'Not Found' }));
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({ success: false, error: 'Internal Server Error' });
});

server.listen(PORT, () => {
  console.log(`\n🎤 Gemini Live Audio Streaming API`);
  console.log(`   Server: http://localhost:${PORT}`);
  console.log(`   Status: Running\n`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
