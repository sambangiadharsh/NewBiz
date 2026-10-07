import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const { method, originalUrl, ip } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;

    const message = `${method} ${originalUrl} ${statusCode} - ${duration}ms [${ip}]`;

    if (statusCode >= 500) {
      logger.error(message, undefined, 'HTTP');
    } else if (statusCode >= 400) {
      logger.warn(message, undefined, 'HTTP');
    } else {
      logger.info(message, undefined, 'HTTP');
    }
  });

  next();
};
