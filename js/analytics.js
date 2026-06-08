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
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Analytics;
}
