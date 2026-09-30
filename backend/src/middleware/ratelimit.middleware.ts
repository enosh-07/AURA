/**
 * Rate Limiting Middleware
 * Uses express-rate-limit.
 * Different tiers for different route sensitivity.
 */

import rateLimit from 'express-rate-limit';

const jsonHandler = (_req: any, res: any) => {
  res.status(429).json({
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please slow down and try again.',
    },
  });
};

/** General API rate limit: 200 req / 15 min */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler,
});

/** Auth routes: 20 req / 15 min */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler,
});

/** AI routes: 30 req / hour */
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler,
});

/** Upload routes: 10 req / 15 min */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler,
});
