import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.activeRole)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}
