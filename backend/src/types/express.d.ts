import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: 'student' | 'driver' | 'admin'; name: string };
    }
  }
}

export {};
