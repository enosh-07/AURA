import { Response, NextFunction } from 'express';
import { analyticsService } from '../services/analytics.service.js';
import { AuthRequest } from '../middleware/auth.middleware.js';

export const logPlayback = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id || 'usr_demo_1';
    await analyticsService.logPlayback(userId, req.body);
    res.status(202).json({ success: true, data: { logged: true } });
  } catch (err) {
    next(err);
  }
};

export const getInsights = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id || 'usr_demo_1';
    const insights = await analyticsService.getInsights(userId);
    res.status(200).json({ success: true, data: insights });
  } catch (err) {
    next(err);
  }
};
