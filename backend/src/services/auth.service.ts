import bcrypt from 'bcryptjs';
import { prisma } from '../models/prisma';
import { generate4DigitCode } from '../utils/codes';
import { signAccess, signRefresh, verifyRefresh } from '../utils/jwt';
import { emailService } from './email.service';
import { infobipService } from './infobip.service';

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 3;

export const authService = {
  async sendOtp(phone: string, email?: string, name?: string) {
    const code = generate4DigitCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await prisma.otpCode.create({ data: { phone, code, expiresAt } });
    // Always visible in terminal — never sent to client
    console.log(`\n\x1b[42m\x1b[30m  OTP CODE  \x1b[0m  📱 ${phone}  →  \x1b[1m\x1b[33m${code}\x1b[0m\n`);

    // Fire both channels in parallel — neither blocks the other
    const [, whatsAppSent] = await Promise.allSettled([
      // Email channel
      emailService.sendOtp(email ?? (process.env.SMTP_USER ?? 'infos@trugroup.cm'), code, name),
      // WhatsApp channel (Infobip) — sends to the phone directly
      infobipService.sendOtpWhatsApp(phone, code, name),
    ]);

    const viaWhatsApp = whatsAppSent.status === 'fulfilled' && whatsAppSent.value === true;

    // The code travels back to the client so the app fills and submits it on
    // its own, with no typing. Set OTP_RETURN_CODE=false to stop returning it.
    //
    // Understand the trade-off before leaving this on: whoever calls this
    // endpoint receives the code, so the OTP no longer proves that the person
    // signing up controls that email or phone number. Anyone can register with
    // someone else's address. Turning it off restores that guarantee, at the
    // cost of making the user read their inbox again.
    const returnCode = (process.env.OTP_RETURN_CODE ?? 'true').toLowerCase() !== 'false';
    return { sent: true, whatsApp: viaWhatsApp, devCode: returnCode ? code : undefined };
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

  async signup(payload: { name: string; phone: string; email?: string; pin: string; role: 'VENDOR' | 'DELIVERER'; gender?: string; shopName?: string }) {
    const existing = await prisma.user.findUnique({ where: { phone: payload.phone } });
    if (existing) throw new Error('Numéro déjà enregistré');

    const pinHash = await bcrypt.hash(payload.pin, ROUNDS);
    const user = await prisma.user.create({
      data: {
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        gender: payload.gender ?? null,
        shopName: payload.shopName?.trim() || null,
        pinHash,
        roles: JSON.stringify([payload.role]),
        activeRole: payload.role,
        wallet: { create: { balanceXAF: 0 } },
      },
    });

    // Send welcome email
    const dest = payload.email ?? process.env.SMTP_USER ?? 'infos@trugroup.cm';
    emailService.sendWelcome(dest, payload.name, payload.role).catch(() => {});

    return authService.issueTokens(user);
  },

  async signin(identifier: string, pin: string) {
    const isEmail = identifier.includes('@');
    let user = null;

    if (isEmail) {
      user = await prisma.user.findFirst({ where: { email: identifier } });
    } else {
      // Try as-is first, then with/without +237 prefix
      user = await prisma.user.findUnique({ where: { phone: identifier } });
      if (!user && !identifier.startsWith('+')) {
        user = await prisma.user.findUnique({ where: { phone: `+237${identifier}` } });
      }
      if (!user && identifier.startsWith('+237')) {
        user = await prisma.user.findUnique({ where: { phone: identifier.slice(4) } });
      }
    }

    if (!user) throw new Error('Identifiant introuvable');
    if (user.isBlocked) throw new Error('Compte bloqué');
    const ok = await bcrypt.compare(pin, user.pinHash);
    if (!ok) throw new Error('PIN incorrect');
    return authService.issueTokens(user);
  },

  async refresh(refreshToken: string) {
    const payload = verifyRefresh(refreshToken) as any;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: payload.userId } });
    return authService.issueTokens(user);
  },

  async switchRole(userId: string, role: 'VENDOR' | 'DELIVERER') {
    const existing = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    let roles: string[] = [];
    try { roles = JSON.parse(existing.roles); } catch { roles = [existing.activeRole]; }
    if (!roles.includes(role)) roles.push(role);
    const user = await prisma.user.update({
      where: { id: userId },
      data: { activeRole: role, roles: JSON.stringify(roles) },
    });
    return authService.issueTokens(user);
  },

  async forgotPin(identifier: string) {
    // identifier can be email or phone
    const isEmail = identifier.includes('@');
    const user = isEmail
      ? await prisma.user.findFirst({ where: { email: identifier } })
      : await prisma.user.findUnique({ where: { phone: identifier } });
    if (!user) throw new Error(isEmail ? 'Email introuvable' : 'Numéro introuvable');
    const code = generate4DigitCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await prisma.otpCode.create({ data: { phone: user.phone, code, expiresAt } });
    console.log(`\n\x1b[45m\x1b[37m  RESET PIN OTP  \x1b[0m  📱 ${user.phone}  →  \x1b[1m\x1b[33m${code}\x1b[0m\n`);
    const dest = user.email ?? process.env.SMTP_USER ?? 'infos@trugroup.cm';
    await emailService.sendOtp(dest, code, user.name ?? undefined);
    const [u, d] = dest.split('@');
    const emailHint = u.slice(0, 2) + '***@' + (d ?? '');
    // Return phoneRef so client can call verifyOtp/resetPin with the correct phone
    const [p1, p2] = user.phone.split('');
    const phoneRef = user.phone.slice(0, 3) + '***' + user.phone.slice(-2);
    return { sent: true, emailHint, phoneRef, _phone: user.phone };
  },

  async resetPin(identifier: string, otp: string, newPin: string) {
    // identifier can be email or phone
    const isEmail = identifier.includes('@');
    let phone = identifier;
    if (isEmail) {
      const user = await prisma.user.findFirst({ where: { email: identifier } });
      if (!user) throw new Error('Email introuvable');
      phone = user.phone;
    }
    await authService.verifyOtp(phone, otp);
    const pinHash = await bcrypt.hash(newPin, ROUNDS);
    await prisma.user.update({ where: { phone }, data: { pinHash } });
    return { reset: true };
  },

  issueTokens(user: { id: string; phone: string; name?: string; activeRole: string; roles?: string; kycStatus?: string; gender?: string | null; shopName?: string | null }) {
    const payload = { userId: user.id, phone: user.phone, activeRole: user.activeRole };
    let parsedRoles: string[] = [user.activeRole];
    try { parsedRoles = user.roles ? JSON.parse(user.roles) : [user.activeRole]; } catch {}
    return {
      accessToken: signAccess(payload),
      refreshToken: signRefresh(payload),
      user: { id: user.id, phone: user.phone, name: user.name ?? '', activeRole: user.activeRole, roles: parsedRoles, kycStatus: user.kycStatus ?? null, gender: user.gender ?? null, shopName: user.shopName ?? null },
    };
  },
};
