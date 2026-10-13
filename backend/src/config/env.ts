import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

export const env = {
  port: Number(process.env.PORT || 5000),
  mongoUri: required('MONGO_URI'),
  jwtSecret: required('JWT_SECRET'),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
};

if (env.jwtSecret.length < 16) {
  throw new Error('JWT_SECRET must be at least 16 characters long');
}
