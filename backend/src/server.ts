import { buildApp } from './app';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { setupWebSocket } from './plugins/websocket';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  const app = await buildApp({ logger: true });
  const httpServer = createServer(app.server);

  // Socket.IO setup
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
    pingInterval: 30000,
    pingTimeout: 10000,
  });

  setupWebSocket(io);

  // Decorate fastify with io for use in routes
  app.decorate('io', io);

  await app.ready();

  httpServer.listen(PORT, HOST, () => {
    app.log.info(`Server running on http://${HOST}:${PORT}`);
    app.log.info(`Swagger UI: http://${HOST}:${PORT}/api-docs`);
  });

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down gracefully...`);
      io.close();
      await app.close();
      httpServer.close(() => {
        process.exit(0);
      });
    });
  }
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
