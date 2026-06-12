import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env';
import { AdminJwtPayload } from './admin.types';
import prisma from '../../config/db';
import { AdminRole } from '@prisma/client';

export const adminAuthenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;

    // Look up admin by ID if present, otherwise fallback to email (to support user-flow login)
    const admin = await prisma.admin.findFirst({
      where: {
        OR: [
          { id: decoded.adminId || undefined },
          { email: decoded.email }
        ]
      }
    });

    if (!admin) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (admin.status === 'suspended') {
      return res.status(403).json({ message: 'Admin account is suspended' });
    }

    req.admin = {
      adminId: admin.id,
      email: admin.email,
      role: admin.role
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const authorizeRoles = (...roles: AdminRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.admin || !roles.includes(req.admin.role)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }
    next();
  };
};

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      admin?: AdminJwtPayload;
    }
  }
}
