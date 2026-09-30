import { Response, NextFunction } from 'express';
import { roomService } from '../services/room.service.js';
import { AuthRequest } from '../middleware/auth.middleware.js';

export const listRooms = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rooms = await roomService.listRooms();
    res.status(200).json({ success: true, data: rooms });
  } catch (err) {
    next(err);
  }
};

export const getRoom = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const room = await roomService.getRoom(req.params.id as string);
    res.status(200).json({ success: true, data: room });
  } catch (err) {
    next(err);
  }
};

export const createRoom = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const hostId = req.user?.id || 'usr_demo_1';
    const room = await roomService.createRoom(hostId, req.body.name || 'AURA Node');
    res.status(201).json({ success: true, data: room });
  } catch (err) {
    next(err);
  }
};
