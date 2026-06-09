import { Request, Response, NextFunction } from 'express';
import { verifyAccess } from '../utils/jwt';

export interface AuthRequest extends Request {
  user?: { userId: string; phone: string; activeRole: string };
}

export function verifyJWT(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }
  try {
    const decoded = verifyAccess(header.slice(7)) as any;
    req.user = { userId: decoded.userId, phone: decoded.phone, activeRole: decoded.activeRole };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
