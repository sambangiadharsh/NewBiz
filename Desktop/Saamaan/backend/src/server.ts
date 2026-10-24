import http from 'http';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { closePool } from './database/db.js';
import { addProductHighlightsColumn } from './database/migrations/add_product_highlights_column.js';
import { upgradeWishlistsTable } from './database/migrations/upgrade_wishlists_table.js';

const app = createApp();
const server = http.createServer(app);

const startServer = async () => {
  try {
    await addProductHighlightsColumn();
    await upgradeWishlistsTable();

    server.listen(config.PORT, () => {
      logger.info(
        `🚀 Marketplace OMS/WMS Backend running in [${config.NODE_ENV}] mode on port ${config.PORT}`,
        undefined,
        'Server'
      );
      logger.info(`🔗 API Root: http://localhost:${config.PORT}/api/v1`, undefined, 'Server');
      logger.info(`🩺 Health Check: http://localhost:${config.PORT}/api/v1/health`, undefined, 'Server');
    });
  } catch (error) {
    logger.error('Failed to start server:', error, 'Server');
    process.exit(1);
  }
};

const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`, undefined, 'Server');

  server.close(async () => {
    logger.info('HTTP server closed.', undefined, 'Server');
    try {
      await closePool();
      logger.info('Database connection closed cleanly.', undefined, 'Server');
      process.exit(0);
    } catch (err) {
      logger.error('Error during database disconnection:', err, 'Server');
      process.exit(1);
    }
  });

  // Force termination after 10s if connections fail to close
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down', undefined, 'Server');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
