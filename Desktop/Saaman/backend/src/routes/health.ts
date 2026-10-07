import { Router, Request, Response } from 'express';
import { checkDbHealth } from '../database/db.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  try {
    let dbStatus = 'disconnected';
    let dbLatencyMs: number | undefined;
    try {
      const health = await checkDbHealth();
      dbStatus = health.status === 'healthy' ? 'connected' : 'unreachable';
      dbLatencyMs = health.latencyMs;
    } catch {
      dbStatus = 'unreachable';
    }

    sendSuccess(res, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: dbStatus,
      dbLatencyMs,
    });
  } catch (error) {
    sendError(res, 'HEALTH_CHECK_FAILED', 'Service health check failed', 503, error);
  }
});
