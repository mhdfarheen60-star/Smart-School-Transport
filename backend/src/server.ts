import app from './app';
import { connectDB, disconnectDB } from './config/db';
import { env } from './config/env';

async function main() {
  await connectDB();
  const server = app.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}/api (${env.nodeEnv})`);
  });
  const shutdown = async () => {
    server.close();
    await disconnectDB();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
