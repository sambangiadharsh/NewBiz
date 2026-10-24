import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // 1. Zod Validation Error
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    logger.warn(`Validation error on ${req.method} ${req.originalUrl}`, formattedErrors, 'ErrorHandler');
    sendError(res, 'VALIDATION_ERROR', 'Validation failed for the request data', 422, formattedErrors);
    return;
  }

  // 2. Custom AppError (Operational errors)
  if (err instanceof AppError) {
    logger.warn(`AppError [${err.errorCode}]: ${err.message}`, err.details, 'ErrorHandler');
    sendError(res, err.errorCode, err.message, err.statusCode, err.details);
    return;
  }

  // 3. Syntax error in body JSON
  if (err instanceof SyntaxError && 'body' in err) {
    logger.warn('Malformed JSON received in request body', undefined, 'ErrorHandler');
    sendError(res, 'MALFORMED_JSON', 'Malformed JSON payload provided in request', 400);
    return;
  }

  // 4. Unexpected / Internal Errors
  const errorObj = err instanceof Error ? err : new Error(String(err));
  logger.error(`Unhandled Exception on ${req.method} ${req.originalUrl}: ${errorObj.message}`, errorObj, 'ErrorHandler');

  const isDev = config.NODE_ENV === 'development';
  sendError(
    res,
    'INTERNAL_SERVER_ERROR',
    errorObj.message || 'An unexpected internal error occurred. Please try again later.',
    500,
    isDev ? { stack: errorObj.stack } : undefined
  );
};
