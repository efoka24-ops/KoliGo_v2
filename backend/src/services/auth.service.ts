import bcrypt from 'bcryptjs';
import { prisma } from '../models/prisma';
import { generate4DigitCode } from '../utils/codes';
import { signAccess, signRefresh, verifyRefresh } from '../utils/jwt';

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 3;

export const authService = {
  async sendOtp(phone: string) {
    const code = generate4DigitCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await prisma.otpCode.create({ data: { phone, code, expiresAt } });
    // TODO: send via Twilio SMS / WhatsApp
    if (process.env.NODE_ENV !== 'production') console.log(`[OTP] ${phone} → ${code}`);
    return { sent: true };
  },

  async verifyOtp(phone: string, code: string): Promise<boolean> {
    const record = await prisma.otpCode.findFirst({
      where: { phone, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new Error('OTP expired or not found');
    if (record.attempts >= OTP_MAX_ATTEMPTS) throw new Error('Too many attempts');

    await prisma.otpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });

    if (record.code !== code) throw new Error('Invalid OTP');
    await prisma.otpCode.update({ where: { id: record.id }, data: { used: true } });
    return true;
  },

  async signup(payload: { name: string; phone: string; pin: string; role: 'VENDOR' | 'DELIVERER' }) {
    const existing = await prisma.user.findUnique({ where: { phone: payload.phone } });
    if (existing) throw new Error('Phone already registered');

    const pinHash = await bcrypt.hash(payload.pin, ROUNDS);
    const user = await prisma.user.create({
      data: {
        name: payload.name,
        phone: payload.phone,
        pinHash,
        roles: JSON.stringify([payload.role]),
        activeRole: payload.role,
        wallet: { create: { balanceXAF: 0 } },
      },
    });

    return authService.issueTokens(user);
  },

  async signin(phone: string, pin: string) {
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) throw new Error('User not found');
    if (user.isBlocked) throw new Error('Account blocked');
    const ok = await bcrypt.compare(pin, user.pinHash);
    if (!ok) throw new Error('Wrong PIN');
    return authService.issueTokens(user);
  },

  async refresh(refreshToken: string) {
    const payload = verifyRefresh(refreshToken) as any;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: payload.userId } });
    return authService.issueTokens(user);
  },

  async switchRole(userId: string, role: 'VENDOR' | 'DELIVERER') {
    const user = await prisma.user.update({ where: { id: userId }, data: { activeRole: role } });
    return authService.issueTokens(user);
  },

  issueTokens(user: { id: string; phone: string; activeRole: string }) {
    const payload = { userId: user.id, phone: user.phone, activeRole: user.activeRole };
    return {
      accessToken: signAccess(payload),
      refreshToken: signRefresh(payload),
      user: { id: user.id, phone: user.phone, activeRole: user.activeRole },
    };
  },
};
