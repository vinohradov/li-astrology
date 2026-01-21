/**
 * Li Astrology - LiqPay Payment Integration
 *
 * Note: For production, payment data should be signed server-side.
 * This implementation uses Supabase Edge Function for signing.
 */

const LiqPay = {
    /**
     * Initialize payment for a product
     * @param {string} productId - Product ID from CONFIG.PRODUCTS
     */
    async pay(productId) {
        const product = CONFIG.PRODUCTS[productId];
        if (!product) {
            console.error('Product not found:', productId);
            alert('Помилка: продукт не знайдено');
            return;
        }

        // Generate unique order ID
        const orderId = `${productId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Get current language for product name
        const lang = (typeof i18n !== 'undefined') ? i18n.getLang() : 'uk';
        const productName = lang === 'ru' ? product.name_ru : product.name_uk;

        // Track purchase initiation
        if (typeof Analytics !== 'undefined') {
            Analytics.trackPurchaseStart(productId, product.price);
        }

        try {
            // Call Supabase Edge Function to get signed payment data
            const response = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/create-payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({
                    order_id: orderId,
                    product_id: productId,
                    amount: product.price,
                    currency: product.currency,
                    description: productName,
                    result_url: `${CONFIG.SITE_URL}/payment/success.html?order_id=${orderId}&product=${productId}`,
                    server_url: `${CONFIG.SUPABASE_URL}/functions/v1/liqpay-callback`
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create payment');
            }

            const { data, signature } = await response.json();

            // Create and submit LiqPay form
            this.submitPaymentForm(data, signature);

        } catch (error) {
            console.error('Payment error:', error);
            alert('Помилка створення платежу. Спробуйте ще раз.');
        }
    },

    /**
     * Submit payment form to LiqPay
     */
    submitPaymentForm(data, signature) {
        // Create form
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = 'https://www.liqpay.ua/api/3/checkout';
        form.acceptCharset = 'utf-8';

        // Add data field
        const dataInput = document.createElement('input');
        dataInput.type = 'hidden';
        dataInput.name = 'data';
        dataInput.value = data;
        form.appendChild(dataInput);

        // Add signature field
        const signatureInput = document.createElement('input');
        signatureInput.type = 'hidden';
        signatureInput.name = 'signature';
        signatureInput.value = signature;
        form.appendChild(signatureInput);

        // Submit form
        document.body.appendChild(form);
        form.submit();
    },

    /**
     * Attach click handlers to buy buttons
     * Call this after DOM is loaded
     */
    initButtons() {
        // Find all buy buttons with data-product attribute
        document.querySelectorAll('[data-liqpay-product]').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const productId = button.getAttribute('data-liqpay-product');
                this.pay(productId);
            });
        });
    }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    LiqPay.initButtons();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LiqPay;
}
