import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { Role, User } from '../models';
import { ApiError, asyncHandler } from '../utils/http';

export function signToken(userId: string, role: Role): string {
  return jwt.sign({ sub: userId, role }, env.jwtSecret, { expiresIn: '7d' });
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) throw new ApiError(401, 'Authentication required');
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(header.slice(7), env.jwtSecret) as jwt.JwtPayload;
  } catch {
    throw new ApiError(401, 'Invalid or expired session. Please sign in again.');
  }
  const user = await User.findById(payload.sub).select('name role isActive');
  if (!user || !user.isActive) throw new ApiError(401, 'Account not found or disabled');
  req.user = { id: user.id, role: user.role as Role, name: user.name };
  next();
});

export const authorize =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new ApiError(401, 'Authentication required'));
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to perform this action'));
    }
    next();
  };
