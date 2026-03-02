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
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBseW9maW54bXd2d2JpbnR2cWJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzI1MDQsImV4cCI6MjA4NDU0ODUwNH0.33Vps8a9w1zfh3s5y2lNiHAnbG-ABmc50tQjBxRgQqE',

    // Telegram Bot
    TELEGRAM_BOT_USERNAME: 'li_astrology_bot',

    // Products configuration
    PRODUCTS: {
        'intensiv': {
            name_uk: 'Інтенсив «Астрологія з 0»',
            name_ru: 'Интенсив «Астрология с 0»',
            price: 1199,
            currency: 'UAH',
            telegram_start: 'intensiv'
        },
        'kurs-aspekty': {
            name_uk: 'Алгоритм трактування аспектів',
            name_ru: 'Алгоритм трактовки аспектов',
            price: 1290,
            currency: 'UAH',
            telegram_start: 'kurs_aspekty'
        },
        'course-basic': {
            name_uk: 'Курс «Професія астролог» — Для себе',
            name_ru: 'Курс «Профессия астролог» — Для себя',
            price: 6000,
            currency: 'UAH',
            telegram_start: 'course_basic'
        },
        'course-advanced': {
            name_uk: 'Курс «Професія астролог» — Для професійного консультування',
            name_ru: 'Курс «Профессия астролог» — Для профессионального консультирования',
            price: 12500,
            currency: 'UAH',
            telegram_start: 'course_advanced'
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
