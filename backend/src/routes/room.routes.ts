import { Router } from 'express';
import { listRooms, getRoom, createRoom } from '../controllers/room.controller.js';
import { optionalAuth, requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', optionalAuth, listRooms);
router.get('/:id', optionalAuth, getRoom);
router.post('/', requireAuth, createRoom);

export default router;
