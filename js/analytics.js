/**
 * Li Astrology - Google Analytics 4
 */

(function() {
    // Load GA4 script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${CONFIG.GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);

    // Initialize GA4
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', CONFIG.GA_MEASUREMENT_ID);

    // Make gtag available globally
    window.gtag = gtag;

    // Track page views on language change
    window.addEventListener('languageChanged', (e) => {
        gtag('event', 'language_change', {
            'language': e.detail.lang
        });
    });
})();

/**
 * Meta (Facebook/Instagram) Pixel — loads only when CONFIG.META_PIXEL_ID is set.
 * Until you paste a Pixel ID in config.js this block does nothing, so it is
 * safe to ship now and "switch on" later by editing one line.
 */
(function() {
    const pixelId = (typeof CONFIG !== 'undefined') && CONFIG.META_PIXEL_ID;
    if (!pixelId) return;

    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
        n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
        document,'script','https://connect.facebook.net/en_US/fbevents.js');

    fbq('init', pixelId);
    fbq('track', 'PageView');
})();

/**
 * Auto-track clicks on call-to-action elements (top of the funnel).
 * Uses event delegation so no per-button wiring is needed: any <a>/<button>
 * carrying one of the CTA classes below reports a `button_click` to GA4
 * (and a Meta `Lead` event when the pixel is active).
 */
(function() {
    const CTA_SELECTOR =
        '.course-card__cta, .button--buy, .site-header__link, [data-product], [data-cta]';

    document.addEventListener('click', (event) => {
        const el = event.target.closest(CTA_SELECTOR);
        if (!el) return;

        const name =
            el.getAttribute('data-cta') ||
            el.getAttribute('data-i18n') ||
            (el.textContent || '').trim().slice(0, 60) ||
            'cta';
        const productId = el.getAttribute('data-product') || undefined;

        if (typeof Analytics !== 'undefined') {
            Analytics.trackButtonClick(name, productId);
        }
        if (typeof fbq !== 'undefined' && el.matches('.button--buy, [data-product]')) {
            fbq('track', 'Lead', { content_name: name });
        }
    }, true);
})();

/**
 * Track custom events
 */
const Analytics = {
    // Track button clicks
    trackButtonClick: function(buttonName, productId) {
        if (window.gtag) {
            gtag('event', 'button_click', {
                'button_name': buttonName,
                'product_id': productId || 'none'
            });
        }
    },

    // Track purchase initiation
    trackPurchaseStart: function(productId, price) {
        if (window.gtag) {
            gtag('event', 'begin_checkout', {
                'currency': 'UAH',
                'value': price,
                'items': [{
                    'item_id': productId,
                    'item_name': CONFIG.PRODUCTS[productId]?.name_uk || productId,
                    'price': price
                }]
            });
        }
        if (typeof fbq !== 'undefined') {
            fbq('track', 'InitiateCheckout', {
                currency: 'UAH',
                value: price,
                content_ids: [productId],
                content_name: CONFIG.PRODUCTS[productId]?.name_uk || productId
            });
        }
    },

    // Track purchase completion
    trackPurchaseComplete: function(orderId, productId, price) {
        if (window.gtag) {
            gtag('event', 'purchase', {
                'transaction_id': orderId,
                'currency': 'UAH',
                'value': price,
                'items': [{
                    'item_id': productId,
                    'item_name': CONFIG.PRODUCTS[productId]?.name_uk || productId,
                    'price': price
                }]
            });
        }
        if (typeof fbq !== 'undefined') {
            fbq('track', 'Purchase', {
                currency: 'UAH',
                value: price,
                content_ids: [productId],
                content_name: CONFIG.PRODUCTS[productId]?.name_uk || productId
            });
        }
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Analytics;
}
