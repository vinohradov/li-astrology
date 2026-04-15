/**
 * Li Astrology — Payment Integration
 * Provider-agnostic frontend. Currently supports WayForPay; Monobank lands in Phase 3.
 */

const Payment = {
    _processing: false,

    async start(productId, provider = 'monobank') {
        if (this._processing) return;

        const product = CONFIG.PRODUCTS[productId];
        if (!product) {
            console.error('Product not found:', productId);
            return;
        }

        this._processing = true;
        this._setButtonsLoading(true);

        if (typeof Analytics !== 'undefined') {
            Analytics.trackPurchaseStart(productId, product.price);
        }

        const lang = (typeof i18n !== 'undefined') ? i18n.getLang() : 'uk';

        try {
            const response = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/create-payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                    provider,
                    product_slug: productId,
                    source: 'web',
                }),
            });

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || 'create-payment failed');
            }
            if (!payload.invoice_url) {
                throw new Error('no invoice_url in response');
            }

            window.location.href = payload.invoice_url;
        } catch (error) {
            console.error('Payment error:', error);
            this._processing = false;
            this._setButtonsLoading(false);
            const msg = (lang === 'ru')
                ? 'Ошибка создания платежа. Попробуйте ещё раз.'
                : 'Помилка створення платежу. Спробуйте ще раз.';
            alert(msg);
        }
    },

    _setButtonsLoading(loading) {
        document.querySelectorAll('[data-product]').forEach((btn) => {
            if (loading) {
                btn.setAttribute('data-original-text', btn.textContent);
                btn.classList.add('button--loading');
                btn.style.pointerEvents = 'none';
                btn.style.opacity = '0.7';
            } else {
                const original = btn.getAttribute('data-original-text');
                if (original) btn.textContent = original;
                btn.classList.remove('button--loading');
                btn.style.pointerEvents = '';
                btn.style.opacity = '';
            }
        });
    },

    initButtons() {
        document.querySelectorAll('[data-product]').forEach((button) => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const productId = button.getAttribute('data-product');
                const provider = button.getAttribute('data-provider') || 'monobank';
                this.start(productId, provider);
            });
        });
    },
};

document.addEventListener('DOMContentLoaded', () => {
    Payment.initButtons();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Payment;
}
