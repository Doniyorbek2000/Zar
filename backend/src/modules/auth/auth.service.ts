import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { BadRequest, Unauthorized } from '../../lib/errors';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt';
import type { JwtPayload } from '../../lib/jwt';

const publicUser = (u: {
  id: string;
  fullName: string;
  username: string;
  role: string;
  branchId: string | null;
}) => ({ id: u.id, fullName: u.fullName, username: u.username, role: u.role, branchId: u.branchId });

function issueTokens(payload: JwtPayload) {
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

export const authService = {
  async login(username: string, password: string) {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) throw Unauthorized('Login yoki parol noto\'g\'ri');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw Unauthorized('Login yoki parol noto\'g\'ri');

    const payload: JwtPayload = { sub: user.id, role: user.role, branchId: user.branchId };
    return { user: publicUser(user), ...issueTokens(payload) };
  },

  // POS terminaliga PIN orqali tez kirish
  async loginWithPin(pin: string, branchId?: string) {
    if (!/^\d{4,6}$/.test(pin)) throw BadRequest('PIN 4-6 raqamdan iborat bo\'lishi kerak');

    const candidates = await prisma.user.findMany({
      where: { isActive: true, pinHash: { not: null }, ...(branchId ? { branchId } : {}) },
    });

    for (const user of candidates) {
      if (user.pinHash && (await bcrypt.compare(pin, user.pinHash))) {
        const payload: JwtPayload = { sub: user.id, role: user.role, branchId: user.branchId };
        return { user: publicUser(user), ...issueTokens(payload) };
      }
    }
    throw Unauthorized('PIN noto\'g\'ri');
  },

  async refresh(refreshToken: string) {
    let decoded: JwtPayload;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      throw Unauthorized('Refresh token yaroqsiz');
    }
    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user || !user.isActive) throw Unauthorized();
    const payload: JwtPayload = { sub: user.id, role: user.role, branchId: user.branchId };
    return issueTokens(payload);
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { branch: { select: { id: true, name: true } } },
    });
    if (!user) throw Unauthorized();
    return { ...publicUser(user), branch: user.branch };
  },
};
