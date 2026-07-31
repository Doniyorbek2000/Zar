import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';

async function main() {
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 ZarPOS API ishga tushdi: http://localhost:${env.PORT}/api`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} qabul qilindi, to'xtatilmoqda...`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'Server ishga tushmadi');
  process.exit(1);
});
