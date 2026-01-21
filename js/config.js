/**
 * Li Astrology - Configuration
 * Public keys only - private keys are stored in Supabase
 */

const CONFIG = {
    // Google Analytics
    GA_MEASUREMENT_ID: 'G-X0MBT0NMFG',

    // LiqPay (Sandbox mode)
    LIQPAY_PUBLIC_KEY: 'sandbox_i21449002699',

    // Supabase
    SUPABASE_URL: 'https://plyofinxmwvwbintvqbx.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_RvjwUMigftsBB-jg1VenHQ_beT_cZNx',

    // Telegram Bot
    TELEGRAM_BOT_USERNAME: 'li_astrology_bot',

    // Products configuration
    PRODUCTS: {
        'intensiv': {
            name_uk: 'Інтенсив «Астрологія з 0»',
            name_ru: 'Интенсив «Астрология с 0»',
            price: 490,
            currency: 'UAH',
            telegram_start: 'intensiv'
        },
        'kurs-aspekty-1': {
            name_uk: 'Тренінг по аспектах (текст)',
            name_ru: 'Тренинг по аспектам (текст)',
            price: 1290,
            currency: 'UAH',
            telegram_start: 'kurs_tariff1'
        },
        'kurs-aspekty-2': {
            name_uk: 'Тренінг + відео-розбір',
            name_ru: 'Тренинг + видео-разбор',
            price: 1690,
            currency: 'UAH',
            telegram_start: 'kurs_tariff2'
        },
        'kurs-aspekty-3': {
            name_uk: 'Професійний тариф',
            name_ru: 'Профессиональный тариф',
            price: 2790,
            currency: 'UAH',
            telegram_start: 'kurs_tariff3'
        }
    },

    // Site URL (update when domain is ready)
    SITE_URL: 'https://li-astrology.com.ua'
};

// Freeze config to prevent modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.PRODUCTS);

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
