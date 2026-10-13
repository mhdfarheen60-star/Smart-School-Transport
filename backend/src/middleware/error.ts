import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { ApiError } from '../utils/http';

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  let status = 500;
  let message = 'Internal server error';
  let details: unknown;

  if (err instanceof ApiError) {
    status = err.status;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    status = 422;
    message = 'Validation failed';
    details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 422;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid value for ${err.path}`;
  } else if (err?.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyPattern || {})[0] || 'value';
    message = `A record with this ${field} already exists`;
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body';
  }

  if (status >= 500) {
    console.error(err);
    if (env.isProd) message = 'Internal server error';
    else message = err?.message || message;
  }
  res.status(status).json({ success: false, message, ...(details ? { details } : {}) });
}
