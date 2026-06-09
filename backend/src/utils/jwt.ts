import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

export function signAccess(payload: object): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRES ?? '15m' });
}

export function signRefresh(payload: object): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES ?? '7d' });
}

export function verifyAccess(token: string) {
  return jwt.verify(token, ACCESS_SECRET);
}

export function verifyRefresh(token: string) {
  return jwt.verify(token, REFRESH_SECRET);
}

export function signClientToken(deliveryId: string): string {
  return jwt.sign({ deliveryId, type: 'client' }, ACCESS_SECRET, { expiresIn: '7d' });
}
