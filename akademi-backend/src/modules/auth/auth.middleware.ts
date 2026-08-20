import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env';
import { JwtPayload } from './auth.types';
import prisma from '../../config/db';

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

    // Deny deleted or banned users even if they still hold a valid token.
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { is_deleted: true, is_banned: true }
    });

    if (!user || user.is_deleted || user.is_banned) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

/**
 * Temporary product gate for features still in internal testing. This uses the
 * authenticated user's email to verify an active admin record server-side;
 * the client-side role check is only for presentation and cannot be trusted.
 */
export const requireActiveAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.email) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const admin = await prisma.admin.findUnique({
      where: { email: req.user.email },
      select: { status: true },
    });

    if (!admin || admin.status === 'suspended') {
      return res.status(403).json({ message: 'AI Tutor is coming soon.' });
    }

    next();
  } catch {
    return res.status(500).json({ message: 'Could not verify AI Tutor access.' });
  }
};

export const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

    // Ignore deleted or banned accounts for optional auth.
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { is_deleted: true, is_banned: true }
    });

    if (user && !user.is_deleted && !user.is_banned) {
      req.user = decoded;
    }
    next();
  } catch (error) {
    // For optional authentication, we don't return 401 on error
    next();
  }
};
