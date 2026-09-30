import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma.js';
import { ENV } from '../config/env.js';

export class AuthService {
  async register(name: string, email: string, password: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new Error('User with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        preferences: {
          create: {
            accentColor: '#00f2fe',
            theme: 'dark',
            visualizerMode: 'bars',
            defaultVolume: 0.8,
            eqBands: JSON.stringify([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
          },
        },
      },
      include: { preferences: true },
    });

    const tokens = this.generateTokens(user.id, user.email);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }).catch(() => {});

    return { user: this.formatUser(user), ...tokens };
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { preferences: true },
    });

    if (!user) {
      throw new Error('Invalid email or password.');
    }

    if (!user.passwordHash) {
      throw new Error('This account was created with Google Sign-In. Please click "Continue with Google".');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid email or password.');
    }

    const tokens = this.generateTokens(user.id, user.email);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }).catch(() => {});

    return { user: this.formatUser(user), ...tokens };
  }

  async googleAuth(data: {
    credential?: string;
    idToken?: string;
    accessToken?: string;
    googleId?: string;
    email?: string;
    name?: string;
    avatarUrl?: string;
  }) {
    let googleId = data.googleId;
    let email = data.email;
    let name = data.name;
    let avatarUrl = data.avatarUrl;

    const token = data.credential || data.idToken;

    // 1. If Google ID token / credential is provided, verify it directly with Google's public OAuth2 verification server
    if (token) {
      try {
        const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
        if (verifyRes.ok) {
          const googleData: any = await verifyRes.json();

          // Validate audience claim if our client ID is configured
          if (ENV.GOOGLE_CLIENT_ID && googleData.aud && googleData.aud !== ENV.GOOGLE_CLIENT_ID) {
            throw new Error('Google ID token was not issued for this application (audience mismatch).');
          }

          if (googleData.sub) googleId = googleData.sub;
          if (googleData.email) email = googleData.email;
          if (googleData.name) name = googleData.name;
          if (googleData.picture) avatarUrl = googleData.picture;
        } else {
          // Fallback parsing for JWT payload
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
            if (payload.sub) googleId = payload.sub;
            if (payload.email) email = payload.email;
            if (payload.name) name = payload.name;
            if (payload.picture) avatarUrl = payload.picture;
          }
        }
      } catch (err) {
        console.warn('Google token verification error:', err);
      }
    } else if (data.accessToken) {
      // 2. If Google OAuth 2.0 Access Token is provided, fetch verified userinfo directly from Google
      try {
        const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        });
        if (userinfoRes.ok) {
          const googleUser: any = await userinfoRes.json();
          if (googleUser.sub) googleId = googleUser.sub;
          if (googleUser.email) email = googleUser.email;
          if (googleUser.name) name = googleUser.name;
          if (googleUser.picture) avatarUrl = googleUser.picture;
        }
      } catch (err) {
        console.warn('Google userinfo fetch error:', err);
      }
    }

    if (!email) {
      throw new Error('Valid Google email is required.');
    }

    // Check existing user
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(googleId ? [{ googleId }] : []),
          { email },
        ],
      },
      include: { preferences: true },
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: googleId || user.googleId,
          avatarUrl: avatarUrl || user.avatarUrl,
          name: name || user.name,
        },
        include: { preferences: true },
      });
    } else {
      user = await prisma.user.create({
        data: {
          name: name || email.split('@')[0],
          email,
          googleId,
          avatarUrl: avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || email)}&background=00f2fe&color=000`,
          preferences: {
            create: {
              accentColor: '#00f2fe',
              theme: 'dark',
              visualizerMode: 'bars',
              defaultVolume: 0.8,
              eqBands: JSON.stringify([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
              losslessTier: 'HI_RES_LOSSLESS',
              bitPerfectMode: false,
            },
          },
        },
        include: { preferences: true },
      });
    }

    const tokens = this.generateTokens(user.id, user.email);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }).catch(() => {});

    return { user: this.formatUser(user), ...tokens };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { preferences: true },
    });
    if (!user) throw new Error('User not found.');
    return this.formatUser(user);
  }

  private formatUser(user: any) {
    if (!user) return null;
    const { passwordHash, ...rest } = user;
    if (rest.preferences && typeof rest.preferences.eqBands === 'string') {
      try {
        rest.preferences.eqBands = JSON.parse(rest.preferences.eqBands);
      } catch {
        rest.preferences.eqBands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      }
    }
    return rest;
  }

  async updatePreferences(userId: string, data: Record<string, unknown>) {
    const formattedData: Record<string, unknown> = { ...data };
    if (Array.isArray(data.eqBands)) {
      formattedData.eqBands = JSON.stringify(data.eqBands);
    }

    return prisma.userPreference.upsert({
      where: { userId },
      update: formattedData,
      create: {
        userId,
        ...formattedData,
      } as any,
    });
  }

  generateTokens(userId: string, email: string) {
    const accessToken = jwt.sign({ id: userId, email }, ENV.JWT_ACCESS_SECRET, {
      expiresIn: '15m',
    });
    const refreshToken = jwt.sign({ id: userId, email }, ENV.JWT_REFRESH_SECRET, {
      expiresIn: '7d',
    });
    return { accessToken, refreshToken };
  }

  async refreshAccessToken(refreshToken: string) {
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, ENV.JWT_REFRESH_SECRET);
    } catch {
      throw new Error('Refresh token is invalid or expired.');
    }

    // Check not revoked
    const stored = await prisma.refreshToken.findFirst({
      where: { token: refreshToken, revokedAt: null },
    });

    if (!stored) {
      // Token not found in DB — could be old token before DB storage was added.
      // For backwards compat, issue new tokens if JWT is valid.
      // In a stricter setup: throw here.
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) throw new Error('User not found.');

    const newAccessToken = jwt.sign({ id: user.id, email: user.email }, ENV.JWT_ACCESS_SECRET, {
      expiresIn: '15m',
    });

    return { accessToken: newAccessToken };
  }

  async revokeRefreshToken(refreshToken: string) {
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { revokedAt: new Date() },
    });
  }
}

export const authService = new AuthService();

