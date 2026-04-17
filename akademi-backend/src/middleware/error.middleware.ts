import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);

  // Send to Sentry if initialized
  if (err.status !== 404) {
    Sentry.captureException(err);
  }

  const status = err.status || 500;

  // Generic error message for production or if it's a Prisma/DB error
  let message = (status >= 500) ? 'An unexpected error occurred. Please try again later.' : (err.message || 'Internal Server Error');

  if (err.name?.includes('Prisma') || err.code?.startsWith('P')) {
     message = 'A database error occurred. Please try again later.';
  } else if (status === 500) {
     message = 'An unexpected error occurred. Please try again later.';
  }

  res.status(status).json({
    message,
    status
  });
};
