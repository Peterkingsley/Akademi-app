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

    // Check if user is deleted
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { is_deleted: true }
    });

    if (!user || user.is_deleted) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
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

    // Check if user is deleted
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { is_deleted: true }
    });

    if (user && !user.is_deleted) {
      req.user = decoded;
    }
    next();
  } catch (error) {
    // For optional authentication, we don't return 401 on error
    next();
  }
};
