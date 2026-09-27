import { Router, Request, Response } from 'express';
import { prisma } from '../database/prisma.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  try {
    // Attempt a lightweight DB ping
    let dbStatus = 'disconnected';
    try {
      await prisma.$queryRaw`SELECT 1 AS health_check`;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'unreachable';
    }

    sendSuccess(res, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: dbStatus,
    });
  } catch (error) {
    sendError(res, 'HEALTH_CHECK_FAILED', 'Service health check failed', 503, error);
  }
});
