import 'dotenv/config';
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import WebSocketLiveController from './src/controllers/websocket-live.controller.js';
import { verifyWebSocketClient, validateSecurityConfig } from './src/middleware/security.middleware.js';
import { setupRoutes } from './src/routes/api.routes.js';
import { appConfig } from './src/config/app.config.js';
import { execQuery } from './src/database/db-connection.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const server = createServer(app);
const wss = new WebSocketServer({ server, verifyClient: verifyWebSocketClient });

const PORT = process.env.PORT || 3000;
app.use((req, res) => res.status(404).json({ success: false, error: 'Not Found' }));
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({ success: false, error: 'Internal Server Error' });
});

function stripHtml(input) {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function getGeminiApiKeyFromDb() {
  const rows = await execQuery(
    'SELECT `value` FROM setting WHERE `group` = ? AND `key` = ? AND status = ? LIMIT 1',
    [appConfig.settingGroup.GEMINI, appConfig.gemini.settingKeys.API_KEY, appConfig.status.ACTIVE]
  );

  const rowCount = Array.isArray(rows) ? rows.length : 0;
  console.log('[BOOT] Gemini key query result:', { group: appConfig.settingGroup.GEMINI, rowCount });

  const rawValue = Array.isArray(rows) && rows[0] ? (rows[0].value || rows[0]['value']) : '';
  const apiKey = stripHtml(rawValue);
  return apiKey;
}

async function bootstrap() {
  const GEMINI_API_KEY = await getGeminiApiKeyFromDb();

  if (!GEMINI_API_KEY) {
    console.error('❌ Gemini API key is not configured in DB');
    process.exit(1);
  }

  validateSecurityConfig();
  setupRoutes(app, GEMINI_API_KEY);

  const wsController = new WebSocketLiveController(GEMINI_API_KEY);
  wss.on('connection', (ws, req) => wsController.handleConnection(ws, req));
  wss.on('error', (error) => console.error('❌ WebSocket error:', error));

  server.listen(PORT, () => {
    console.log(`\n🎤 Gemini Live Audio Streaming API`);
    console.log(`   Server: http://localhost:${PORT}`);
    console.log(`   Status: Running\n`);
  });

  process.on('SIGTERM', () => server.close(() => process.exit(0)));
  process.on('SIGINT', () => server.close(() => process.exit(0)));
}

bootstrap().catch((error) => {
  console.error('❌ Failed to bootstrap server:', error);
  process.exit(1);
});
