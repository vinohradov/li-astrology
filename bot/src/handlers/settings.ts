import { Bot, InlineKeyboard } from 'grammy';
import { BotContext } from '../bot.js';
import { cleanAndSend } from '../utils/chat.js';
import { getUser, setUserLang } from '../db/users.js';
import { getLocale, isSupportedLang } from '../locales/index.js';

export function registerSettingsHandler(bot: Bot<BotContext>) {
  bot.callbackQuery('settings', async (ctx) => {
    await ctx.answerCallbackQuery();
    await renderSettings(ctx);
  });

  bot.callbackQuery(/^set_lang:(.+)$/, async (ctx) => {
    const lang = ctx.match[1];
    if (!isSupportedLang(lang)) {
      await ctx.answerCallbackQuery();
      return;
    }

    await setUserLang(ctx.from.id, lang);
    // Swap ctx.t so the rest of this request renders in the new language.
    ctx.t = getLocale(lang);

    await ctx.answerCallbackQuery({ text: lang === 'ru' ? 'Язык сохранён' : 'Мову збережено' });
    await renderSettings(ctx);
  });
}

async function renderSettings(ctx: BotContext) {
  const user = await getUser(ctx.from!.id);
  const currentLang = user?.lang ?? 'uk';

  const ukLabel = currentLang === 'uk' ? '✅ 🇺🇦 Українська' : '🇺🇦 Українська';
  const ruLabel = currentLang === 'ru' ? '✅ 🇷🇺 Русский' : '🇷🇺 Русский';

  await cleanAndSend(ctx, `${ctx.t.settings.title}\n\n${ctx.t.settings.language}:`, {
    reply_markup: new InlineKeyboard()
      .text(ukLabel, 'set_lang:uk')
      .row()
      .text(ruLabel, 'set_lang:ru')
      .row()
      .text(ctx.t.common.home, 'home'),
  });
}
