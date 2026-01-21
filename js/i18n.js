/**
 * Li Astrology - Internationalization System
 * Supports Ukrainian (uk) and Russian (ru)
 * Ukrainian is the default language
 */

class I18n {
    constructor(defaultLang = 'uk') {
        this.defaultLang = defaultLang;
        this.currentLang = this.getSavedLanguage() || defaultLang;
        this.translations = {};
        this.loaded = false;
    }

    /**
     * Get saved language from localStorage
     */
    getSavedLanguage() {
        try {
            return localStorage.getItem('li-astrology-lang');
        } catch (e) {
            return null;
        }
    }

    /**
     * Save language preference to localStorage
     */
    saveLanguage(lang) {
        try {
            localStorage.setItem('li-astrology-lang', lang);
        } catch (e) {
            console.warn('Could not save language preference');
        }
    }

    /**
     * Initialize the i18n system
     */
    async init() {
        await this.loadTranslations(this.currentLang);
        this.applyTranslations();
        this.setupLanguageSwitcher();
        this.updateHtmlLang();
        this.loaded = true;
    }

    /**
     * Load translations from JSON file
     */
    async loadTranslations(lang) {
        try {
            // Determine the base path based on current page location
            const basePath = this.getBasePath();
            const response = await fetch(`${basePath}/js/translations/${lang}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load translations for ${lang}`);
            }
            this.translations = await response.json();
        } catch (error) {
            console.error('Error loading translations:', error);
            // Fallback to default language if not already
            if (lang !== this.defaultLang) {
                await this.loadTranslations(this.defaultLang);
            }
        }
    }

    /**
     * Get base path for loading resources
     */
    getBasePath() {
        const path = window.location.pathname;
        // If we're in a subdirectory, go up one level
        if (path.includes('/intensiv/') || path.includes('/kurs-aspekty/') ||
            path.includes('/payment/') || path.includes('/legal/')) {
            return '..';
        }
        return '.';
    }

    /**
     * Apply translations to all elements with data-i18n attribute
     */
    applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.getTranslation(key);

            if (translation) {
                // Check if it's an input placeholder
                if (element.hasAttribute('placeholder')) {
                    element.placeholder = translation;
                } else if (element.hasAttribute('data-i18n-html')) {
                    // Allow HTML content for specific elements
                    element.innerHTML = translation;
                } else {
                    element.textContent = translation;
                }
            }
        });

        // Update language switcher display
        const langSelect = document.getElementById('lang-select');
        if (langSelect) {
            langSelect.value = this.currentLang;
        }
    }

    /**
     * Get nested translation value by dot-notation key
     */
    getTranslation(key) {
        return key.split('.').reduce((obj, k) => obj?.[k], this.translations);
    }

    /**
     * Switch to a different language
     */
    async switchLanguage(lang) {
        if (lang === this.currentLang) return;

        this.currentLang = lang;
        this.saveLanguage(lang);
        await this.loadTranslations(lang);
        this.applyTranslations();
        this.updateHtmlLang();

        // Dispatch event for any custom handlers
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
    }

    /**
     * Update the html lang attribute
     */
    updateHtmlLang() {
        document.documentElement.lang = this.currentLang;
    }

    /**
     * Setup language switcher dropdown
     */
    setupLanguageSwitcher() {
        const langSelect = document.getElementById('lang-select');
        if (langSelect) {
            langSelect.value = this.currentLang;
            langSelect.addEventListener('change', (e) => {
                this.switchLanguage(e.target.value);
            });
        }
    }

    /**
     * Get current language
     */
    getLang() {
        return this.currentLang;
    }

    /**
     * Translate a key programmatically
     */
    t(key) {
        return this.getTranslation(key) || key;
    }
}

// Create global instance
const i18n = new I18n('uk');

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    i18n.init();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { I18n, i18n };
}
