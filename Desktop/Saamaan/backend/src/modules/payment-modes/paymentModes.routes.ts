import { Router } from 'express';
import { paymentModesController } from './paymentModes.controller.js';

export const paymentModesRouter = Router();

// Public endpoint to retrieve active payment modes for checkout
paymentModesRouter.get('/', (req, res, next) => paymentModesController.listActive(req, res, next));
