import express from 'express';
import { config } from './config.js';
import { createBot } from './bot.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/error.js';
import { registerStartHandler } from './handlers/start.js';
import { registerMenuHandler } from './handlers/menu.js';
import { registerMyCoursesHandler } from './handlers/my-courses.js';
import { registerCatalogHandler } from './handlers/catalog.js';
import { registerLessonHandler } from './handlers/lesson.js';
import { registerPurchaseHandler } from './handlers/purchase.js';
import { registerSupportHandler } from './handlers/support.js';
import { registerSettingsHandler } from './handlers/settings.js';
import { registerAdminCommands } from './admin/commands.js';
import { createLiqPayWebhook } from './payments/webhook.js';
import { startScheduler } from './jobs/scheduler.js';

async function main() {
  const bot = createBot();

  // Middleware
  bot.use(authMiddleware);

  // Handlers (order matters — more specific first)
  registerStartHandler(bot);
  registerMyCoursesHandler(bot);
  registerCatalogHandler(bot);
  registerLessonHandler(bot);
  registerPurchaseHandler(bot);
  registerSupportHandler(bot);
  registerSettingsHandler(bot);
  registerMenuHandler(bot);
  registerAdminCommands(bot);

  // Error handler
  bot.catch(errorHandler(bot));

  // Express server for LiqPay webhook
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  app.post('/webhook/liqpay', createLiqPayWebhook(bot));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.listen(config.PORT, () => {
    console.log(`Express server listening on port ${config.PORT}`);
  });

  // Cron jobs
  startScheduler(bot);

  // Start bot (long-polling)
  await bot.start({
    onStart: () => console.log('Bot started successfully'),
  });
}

main().catch(console.error);
