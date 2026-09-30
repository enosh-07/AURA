import { Request, Response, NextFunction } from 'express';
import { aiService } from '../services/ai.service.js';

export const curateMusic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prompt, currentTrackId, userMood } = req.body;
    if (!prompt) {
      res.status(400).json({ success: false, error: { message: 'Prompt is required' } });
      return;
    }
    const result = await aiService.curateMusic(prompt, currentTrackId, userMood);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};
