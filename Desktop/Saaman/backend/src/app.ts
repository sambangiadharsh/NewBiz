import express, { Express, Request, Response } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiV1Router } from './routes/index.js';
import { sendError } from './utils/response.js';

// Global polyfill for BigInt JSON serialization across Express responses
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

export const createApp = (): Express => {
  const app = express();

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Portals will communicate over REST API
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS configuration for portals (with credentials enabled for cookies)
  app.use(
    cors({
      origin: (origin, callback) => {
        // In local development, reflect origin so withCredentials works seamlessly
        if (!origin || config.NODE_ENV === 'development') {
          return callback(null, true);
        }
        if (config.corsOriginsList.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Portal-Type'],
    })
  );
  
  
  // Cookie parser
  app.use(cookieParser());

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Static file serving for uploads (KYC docs, product assets)
  
  app.use(
    '/uploads',
    express.static(path.join(process.cwd(), 'uploads'), {
      setHeaders: (res) => {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      },
    })
  );

  // Request logging
  app.use(requestLogger);

  // Mount API v1 router
  app.use('/api/v1', apiV1Router);

  // Unmatched routes (404)
  app.use((req: Request, res: Response) => {
    sendError(res, 'ROUTE_NOT_FOUND', `Cannot ${req.method} ${req.originalUrl}`, 404);
  });

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
};
