import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProd = process.env.NODE_ENV === 'production';

interface Room {
  broadcaster: WebSocket | null;
  broadcasterId: string | null;
  viewers: Map<string, WebSocket>;
  cameraFacing: 'user' | 'environment';
  isTorchOn: boolean;
  isLowLight: boolean;
  createdAt: number;
}

const rooms = new Map<string, Room>();

function getOrCreateRoom(roomId: string): Room {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      broadcaster: null,
      broadcasterId: null,
      viewers: new Map(),
      cameraFacing: 'environment',
      isTorchOn: false,
      isLowLight: false,
      createdAt: Date.now(),
    };
    rooms.set(roomId, room);
  }
  return room;
}

wss.on('connection', (ws: WebSocket) => {
  let clientRoomId: string | null = null;
  let clientRole: 'broadcaster' | 'viewer' | null = null;
  const clientId = 'client_' + Math.random().toString(36).substring(2, 9);

  ws.on('message', (data: string | Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      const { type, roomId } = message;

      if (!roomId) return;
      const room = getOrCreateRoom(roomId);
      clientRoomId = roomId;

      switch (type) {
        case 'register-broadcaster': {
          clientRole = 'broadcaster';
          room.broadcaster = ws;
          room.broadcasterId = clientId;
          if (message.cameraFacing) {
            room.cameraFacing = message.cameraFacing;
          }

          ws.send(JSON.stringify({
            type: 'broadcaster-registered',
            clientId,
            viewersCount: room.viewers.size,
          }));

          // Notify existing viewers that broadcaster is online
          for (const [viewerId, viewerWs] of room.viewers.entries()) {
            if (viewerWs.readyState === WebSocket.OPEN) {
              viewerWs.send(JSON.stringify({
                type: 'broadcaster-joined',
                cameraFacing: room.cameraFacing,
                viewerId,
              }));
            }
          }
          break;
        }

        case 'join-viewer': {
          clientRole = 'viewer';
          room.viewers.set(clientId, ws);

          ws.send(JSON.stringify({
            type: 'viewer-joined-ack',
            clientId,
            hasBroadcaster: !!room.broadcaster && room.broadcaster.readyState === WebSocket.OPEN,
            cameraFacing: room.cameraFacing,
            isTorchOn: room.isTorchOn,
            isLowLight: room.isLowLight,
          }));

          // Notify broadcaster of new viewer
          if (room.broadcaster && room.broadcaster.readyState === WebSocket.OPEN) {
            room.broadcaster.send(JSON.stringify({
              type: 'viewer-joined',
              viewerId: clientId,
              totalViewers: room.viewers.size,
            }));
          }
          break;
        }

        case 'signal': {
          // WebRTC signaling: offer, answer, ice-candidate
          const { targetId, signalData } = message;
          if (targetId) {
            if (clientRole === 'broadcaster') {
              const targetWs = room.viewers.get(targetId);
              if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                targetWs.send(JSON.stringify({
                  type: 'signal',
                  fromId: clientId,
                  signalData,
                }));
              }
            } else if (clientRole === 'viewer') {
              if (room.broadcaster && room.broadcaster.readyState === WebSocket.OPEN) {
                room.broadcaster.send(JSON.stringify({
                  type: 'signal',
                  fromId: clientId,
                  signalData,
                }));
              }
            }
          }
          break;
        }

        case 'video-frame': {
          // Direct fallback frame streaming for low-latency visual feed
          if (clientRole === 'broadcaster') {
            const payload = JSON.stringify({
              type: 'video-frame',
              frame: message.frame,
              timestamp: message.timestamp,
              facing: room.cameraFacing,
              isLowLight: room.isLowLight,
            });
            for (const [, viewerWs] of room.viewers.entries()) {
              if (viewerWs.readyState === WebSocket.OPEN) {
                viewerWs.send(payload);
              }
            }
          }
          break;
        }

        case 'camera-state-update': {
          if (clientRole === 'broadcaster') {
            if (message.cameraFacing) room.cameraFacing = message.cameraFacing;
            if (typeof message.isTorchOn === 'boolean') room.isTorchOn = message.isTorchOn;
            if (typeof message.isLowLight === 'boolean') room.isLowLight = message.isLowLight;

            const updateMsg = JSON.stringify({
              type: 'camera-state-update',
              cameraFacing: room.cameraFacing,
              isTorchOn: room.isTorchOn,
              isLowLight: room.isLowLight,
            });

            for (const [, viewerWs] of room.viewers.entries()) {
              if (viewerWs.readyState === WebSocket.OPEN) {
                viewerWs.send(updateMsg);
              }
            }
          }
          break;
        }

        case 'viewer-command': {
          // Viewer requesting switch-camera or toggle-torch or snap
          if (clientRole === 'viewer' && room.broadcaster && room.broadcaster.readyState === WebSocket.OPEN) {
            room.broadcaster.send(JSON.stringify({
              type: 'viewer-command',
              fromViewerId: clientId,
              command: message.command,
              value: message.value,
            }));
          }
          break;
        }

        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('WebSocket message parsing error:', err);
    }
  });

  ws.on('close', () => {
    if (clientRoomId) {
      const room = rooms.get(clientRoomId);
      if (room) {
        if (clientRole === 'broadcaster' && room.broadcaster === ws) {
          room.broadcaster = null;
          room.broadcasterId = null;
          for (const [, viewerWs] of room.viewers.entries()) {
            if (viewerWs.readyState === WebSocket.OPEN) {
              viewerWs.send(JSON.stringify({
                type: 'broadcaster-disconnected',
              }));
            }
          }
        } else if (clientRole === 'viewer') {
          room.viewers.delete(clientId);
          if (room.broadcaster && room.broadcaster.readyState === WebSocket.OPEN) {
            room.broadcaster.send(JSON.stringify({
              type: 'viewer-left',
              viewerId: clientId,
              totalViewers: room.viewers.size,
            }));
          }
        }

        // Cleanup empty room after 10 minutes
        if (!room.broadcaster && room.viewers.size === 0) {
          setTimeout(() => {
            const current = rooms.get(clientRoomId!);
            if (current && !current.broadcaster && current.viewers.size === 0) {
              rooms.delete(clientRoomId!);
            }
          }, 600000);
        }
      }
    }
  });
});

app.use(express.json());

// API health endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    activeRooms: rooms.size,
  });
});

// App configuration and connection diagnostics
app.get('/api/stream-info/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId);
  res.json({
    exists: !!room,
    hasBroadcaster: !!room?.broadcaster,
    viewersCount: room?.viewers.size || 0,
    cameraFacing: room?.cameraFacing || 'unknown',
  });
});

async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`WiFi CamShare server running on port ${PORT}`);
  });
}

startServer();
