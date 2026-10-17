import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { supabaseServer } from '../services/supabase.service.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication token required.' },
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  // 1. Try Supabase Auth verification if configured
  if (supabaseServer.isConfigured) {
    const sbUser = await supabaseServer.verifyToken(token);
    if (sbUser) {
      req.user = { id: sbUser.id, email: sbUser.email || '' };
      try {
        const { prisma } = await import('../services/prisma.js');
        await prisma.user.upsert({
          where: { id: sbUser.id },
          update: { email: sbUser.email || '' },
          create: {
            id: sbUser.id,
            email: sbUser.email || '',
            name: sbUser.user_metadata?.name || sbUser.email?.split('@')[0] || 'AURA Listener',
            avatarUrl: sbUser.user_metadata?.avatar_url || null,
          },
        });
      } catch {
        // Ignore background sync errors
      }
      next();
      return;
    }
  }

  // 2. Try legacy JWT verification
  try {
    const decoded = jwt.verify(token, ENV.JWT_ACCESS_SECRET) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Token is invalid or expired.' },
    });
  }
};

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    if (supabaseServer.isConfigured) {
      const sbUser = await supabaseServer.verifyToken(token);
      if (sbUser) {
        req.user = { id: sbUser.id, email: sbUser.email || '' };
        next();
        return;
      }
    }

    try {
      req.user = jwt.verify(token, ENV.JWT_ACCESS_SECRET) as AuthenticatedUser;
    } catch {
      // Ignore invalid token for optional auth
    }
  }
  next();
};

