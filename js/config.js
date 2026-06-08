/**
 * Li Astrology - Configuration
 * Public keys only - private keys are stored in Supabase
 */

const CONFIG = {
    // Google Analytics
    GA_MEASUREMENT_ID: 'G-X0MBT0NMFG',

    // Supabase
    SUPABASE_URL: 'https://plyofinxmwvwbintvqbx.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBseW9maW54bXd2d2JpbnR2cWJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzI1MDQsImV4cCI6MjA4NDU0ODUwNH0.33Vps8a9w1zfh3s5y2lNiHAnbG-ABmc50tQjBxRgQqE',

    // Telegram Bot
    TELEGRAM_BOT_USERNAME: 'li_astrology_bot',

    // Products — slugs must match `courses.slug` in Supabase DB
    PRODUCTS: {
        'intensiv': {
            name_uk: 'Інтенсив «Астрологія з 0»',
            name_ru: 'Интенсив «Астрология с 0»',
            price: 1199,
            currency: 'UAH'
        },
        'aspekty-basic': {
            name_uk: 'Аспекти — базовий тариф',
            name_ru: 'Аспекты — базовый тариф',
            price: 1290,
            currency: 'UAH'
        },
        'aspekty-pro': {
            name_uk: 'Аспекти — професійний тариф',
            name_ru: 'Аспекты — профессиональный тариф',
            price: 2790,
            currency: 'UAH'
        }
    },

    // Site URL
    SITE_URL: 'https://li-astrology.com.ua'
};

// Freeze config to prevent modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.PRODUCTS);

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
