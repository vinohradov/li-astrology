# li-astrology.com.ua Implementation Plan

## Overview

**Website:** li-astrology.com.ua
**Products:**
- Intensiv "Астрологія з 0" - 490 грн (Ukrainian)
- Kurs "Алгоритм трактовки аспектів" - 1290/1690/2790 грн (Russian)

**Tech Stack:**
- Hosting: Netlify (free, auto-deploy from GitHub)
- Backend: Supabase (free tier - PostgreSQL + API)
- Payments: LiqPay
- Content Delivery: Telegram Bot + Private Channel Invites
- Analytics: Google Analytics 4
- i18n: JavaScript-based with UK/RU support (Ukrainian default)

**Telegram Bot:** @li_astrology_bot

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER FLOW                                │
└─────────────────────────────────────────────────────────────────┘

   User visits li-astrology.com.ua
              │
              ▼
   ┌─────────────────────┐
   │     Homepage        │
   │  (product selector) │
   └─────────────────────┘
         │           │
         ▼           ▼
   ┌──────────┐  ┌──────────────┐
   │/intensiv │  │/kurs-aspekty │
   └──────────┘  └──────────────┘
         │           │
         ▼           ▼
   Click "КУПИТИ/ПРИДБАТИ"
              │
              ▼
   ┌─────────────────────┐
   │   LiqPay Payment    │
   │   (redirect page)   │
   └─────────────────────┘
              │
              ├──── server_url ────► Supabase (store purchase)
              │
              ▼
   ┌─────────────────────┐
   │  result_url         │
   │  → Telegram Bot     │
   │  t.me/bot?start=... │
   └─────────────────────┘
              │
              ▼
   ┌─────────────────────┐
   │  Bot delivers       │
   │  course materials   │
   └─────────────────────┘
```

---

## Phase 1: External Registrations (Manual Steps)

### 1.1 Domain Registration
**Where:** nic.ua or hostiq.ua
**Domain:** li-astrology.com.ua
**Cost:** ~150-250 грн/year
**Steps:**
1. Go to https://nic.ua or https://hostiq.ua
2. Search for "li-astrology.com.ua"
3. Register with your details
4. Get DNS management access

### 1.2 Netlify Setup
**Where:** https://netlify.com
**Cost:** Free
**Steps:**
1. Sign up with GitHub account
2. Click "New site from Git"
3. Connect your astrology repository
4. Set build settings:
   - Build command: (leave empty - static site)
   - Publish directory: `.` (root)
5. After deploy, go to "Domain settings"
6. Add custom domain: li-astrology.com.ua
7. Copy Netlify DNS servers to your domain registrar

### 1.3 LiqPay Merchant Registration
**Where:** https://www.liqpay.ua/
**Requirements:** ФОП or company registration
**Steps:**
1. Go to https://www.liqpay.ua/authorization
2. Register business account
3. Add ФОП Виноградов А.В. details
4. Verify phone and email
5. Upload required documents
6. Wait for approval (1-3 business days)
7. Get credentials from Developer section:
   - `public_key`
   - `private_key`

### 1.4 Supabase Setup (Free Database)
**Where:** https://supabase.com
**Cost:** Free tier (500MB database, 50,000 requests/month)
**Steps:**
1. Sign up at https://supabase.com
2. Create new project: "li-astrology"
3. Save the project URL and anon key
4. Create purchases table (SQL provided below)

### 1.5 Telegram Bot Creation
**Where:** Telegram @BotFather
**Steps:**
1. Open Telegram, search @BotFather
2. Send `/newbot`
3. Name: "Li Astrology Bot" (or your choice)
4. Username: `li_astrology_bot` (must be unique)
5. Save the bot token
6. Send `/setdescription` to add bot description
7. Send `/setuserpic` to add bot avatar

### 1.6 Google Analytics Setup
**Where:** https://analytics.google.com
**Steps:**
1. Go to analytics.google.com
2. Create new GA4 property
3. Website: li-astrology.com.ua
4. Get Measurement ID (G-XXXXXXXXXX)

---

## Phase 2: Internationalization (i18n)

### 2.1 i18n Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     LANGUAGE SYSTEM                          │
└─────────────────────────────────────────────────────────────┘

  User visits site
        │
        ▼
  Check localStorage for 'lang' preference
        │
        ├── Found: Use stored language
        │
        └── Not found: Default to 'uk' (Ukrainian)
                │
                ▼
        Load translations from /js/i18n/{lang}.json
                │
                ▼
        Replace all [data-i18n] elements with translations
                │
                ▼
        User can switch language via dropdown (header)
                │
                ▼
        Save preference to localStorage
```

### 2.2 File Structure for i18n
```
js/
├── i18n.js                 # Translation engine
└── translations/
    ├── uk.json             # Ukrainian translations (default)
    └── ru.json             # Russian translations
```

### 2.3 Translation JSON Structure
```json
// uk.json (Ukrainian - DEFAULT)
{
  "common": {
    "buy": "Придбати",
    "price": "Ціна",
    "currency": "грн",
    "learnMore": "Дізнатись більше"
  },
  "header": {
    "langSwitch": "Мова",
    "home": "Головна"
  },
  "home": {
    "title": "Li Astrology",
    "subtitle": "Професійні курси астрології",
    "intensivCard": {
      "title": "Інтенсив «Астрологія з 0»",
      "description": "Твій легкий перший крок у світ астрології",
      "price": "490 грн",
      "cta": "Детальніше"
    },
    "courseCard": {
      "title": "Алгоритм трактування аспектів",
      "description": "Поглиблений курс для практикуючих астрологів",
      "price": "від 1290 грн",
      "cta": "Детальніше"
    }
  },
  "footer": {
    "copyright": "© 2026 Li Astrology. Всі права захищені.",
    "legal": "ФОП Виноградов А.В.",
    "privacy": "Політика конфіденційності",
    "offer": "Публічна оферта"
  }
}
```

```json
// ru.json (Russian)
{
  "common": {
    "buy": "Купить",
    "price": "Цена",
    "currency": "грн",
    "learnMore": "Узнать больше"
  },
  "header": {
    "langSwitch": "Язык",
    "home": "Главная"
  },
  "home": {
    "title": "Li Astrology",
    "subtitle": "Профессиональные курсы астрологии",
    "intensivCard": {
      "title": "Интенсив «Астрология с 0»",
      "description": "Твой лёгкий первый шаг в мир астрологии",
      "price": "490 грн",
      "cta": "Подробнее"
    },
    "courseCard": {
      "title": "Алгоритм трактовки аспектов",
      "description": "Углублённый курс для практикующих астрологов",
      "price": "от 1290 грн",
      "cta": "Подробнее"
    }
  },
  "footer": {
    "copyright": "© 2026 Li Astrology. Все права защищены.",
    "legal": "ФОП Виноградов А.В.",
    "privacy": "Политика конфиденциальности",
    "offer": "Публичная оферта"
  }
}
```

### 2.4 HTML Usage
```html
<!-- Language dropdown in header -->
<div class="lang-switcher">
  <select id="lang-select">
    <option value="uk">🇺🇦 Українська</option>
    <option value="ru">🇷🇺 Русский</option>
  </select>
</div>

<!-- Translatable elements use data-i18n attribute -->
<h1 data-i18n="home.title">Li Astrology</h1>
<p data-i18n="home.subtitle">Професійні курси астрології</p>
<button data-i18n="common.buy">Придбати</button>
```

### 2.5 i18n JavaScript Engine
```javascript
// js/i18n.js
class I18n {
  constructor(defaultLang = 'uk') {
    this.currentLang = localStorage.getItem('lang') || defaultLang;
    this.translations = {};
  }

  async init() {
    await this.loadTranslations(this.currentLang);
    this.applyTranslations();
    this.setupLangSwitcher();
  }

  async loadTranslations(lang) {
    const response = await fetch(`/js/translations/${lang}.json`);
    this.translations = await response.json();
  }

  applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translation = this.getNestedValue(this.translations, key);
      if (translation) {
        el.textContent = translation;
      }
    });
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  }

  async switchLanguage(lang) {
    this.currentLang = lang;
    localStorage.setItem('lang', lang);
    await this.loadTranslations(lang);
    this.applyTranslations();
  }

  setupLangSwitcher() {
    const select = document.getElementById('lang-select');
    if (select) {
      select.value = this.currentLang;
      select.addEventListener('change', (e) => {
        this.switchLanguage(e.target.value);
      });
    }
  }
}

// Initialize on page load
const i18n = new I18n('uk');
document.addEventListener('DOMContentLoaded', () => i18n.init());
```

### 2.6 Product Pages i18n Strategy
Since the intensiv page is primarily Ukrainian and the course page is primarily Russian, we have two options:

**Option A: Keep original language, add switcher for navigation elements only**
- Intensiv stays Ukrainian
- Course stays Russian
- Only header, footer, and common UI elements translate

**Option B: Full translation of both pages (more work)**
- Both pages fully available in both languages
- Requires translating all course content

**Recommendation:** Start with Option A (less work, ship faster), add Option B later if needed.

---

## Phase 3: Project Structure

### 3.1 New File Structure
```
astrology/
├── index.html                  # NEW: Homepage (product selector)
├── intensiv/                   # RENAMED from bootcamp/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── images/
├── kurs-aspekty/               # RENAMED from course/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── images/
├── payment/
│   └── success.html            # NEW: Payment success redirect page
├── legal/
│   ├── privacy.html            # NEW: Privacy policy
│   └── offer.html              # NEW: Public offer agreement
├── css/
│   └── common.css              # NEW: Shared styles (header, footer, lang-switcher)
├── js/
│   ├── i18n.js                 # NEW: Internationalization engine
│   ├── analytics.js            # NEW: GA4 tracking
│   ├── liqpay.js               # NEW: Payment integration
│   ├── config.js               # NEW: Configuration (API keys)
│   └── translations/
│       ├── uk.json             # NEW: Ukrainian translations
│       └── ru.json             # NEW: Russian translations
├── _redirects                  # NEW: Netlify redirects
├── netlify.toml                # NEW: Netlify configuration
├── .gitignore                  # NEW: Ignore .env and other files
└── IMPLEMENTATION_PLAN.md      # This file
```

### 2.2 Netlify Redirects (_redirects file)
```
# Old URLs redirect to new
/bootcamp/*    /intensiv/:splat    301
/course/*      /kurs-aspekty/:splat 301

# Clean URLs
/intensiv      /intensiv/index.html
/kurs-aspekty  /kurs-aspekty/index.html
```

---

## Phase 3: Database Schema (Supabase)

### 3.1 Purchases Table
```sql
CREATE TABLE purchases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- LiqPay data
    order_id VARCHAR(255) UNIQUE NOT NULL,
    liqpay_order_id VARCHAR(255),
    payment_id VARCHAR(255),
    status VARCHAR(50) NOT NULL,

    -- Product info
    product_type VARCHAR(50) NOT NULL, -- 'intensiv' or 'kurs-aspekty'
    tariff VARCHAR(50),                 -- 'tariff_1', 'tariff_2', 'tariff_3'
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'UAH',

    -- Customer info
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),
    customer_name VARCHAR(255),

    -- Telegram delivery
    telegram_sent BOOLEAN DEFAULT FALSE,
    telegram_chat_id VARCHAR(50),

    -- Raw LiqPay response
    liqpay_data JSONB
);

-- Index for fast lookups
CREATE INDEX idx_purchases_order_id ON purchases(order_id);
CREATE INDEX idx_purchases_status ON purchases(status);
CREATE INDEX idx_purchases_created ON purchases(created_at DESC);
```

### 3.2 Supabase Edge Function for LiqPay Callback
This will receive payment confirmations from LiqPay and store them.

---

## Phase 4: LiqPay Integration

### 4.1 Payment Flow
1. User clicks "КУПИТИ" button
2. JavaScript generates LiqPay payment data
3. User redirected to LiqPay payment page
4. After payment:
   - LiqPay calls `server_url` (Supabase function) → stores purchase
   - LiqPay redirects user to `result_url` → success page → Telegram bot

### 4.2 Product Configuration
```javascript
const PRODUCTS = {
    intensiv: {
        name: 'Інтенсив "Астрологія з 0"',
        price: 490,
        currency: 'UAH',
        telegram_start: 'intensiv'
    },
    'kurs-aspekty-1': {
        name: 'Тренинг по аспектам (текст)',
        price: 1290,
        currency: 'UAH',
        telegram_start: 'kurs_tariff1'
    },
    'kurs-aspekty-2': {
        name: 'Тренинг + видео-разбор',
        price: 1690,
        currency: 'UAH',
        telegram_start: 'kurs_tariff2'
    },
    'kurs-aspekty-3': {
        name: 'Профессиональный тариф',
        price: 2790,
        currency: 'UAH',
        telegram_start: 'kurs_tariff3'
    }
};
```

### 4.3 LiqPay Button Implementation
```javascript
// Generate LiqPay payment
function createPayment(productId) {
    const product = PRODUCTS[productId];
    const orderId = `${productId}_${Date.now()}`;

    const data = {
        public_key: CONFIG.LIQPAY_PUBLIC_KEY,
        version: '3',
        action: 'pay',
        amount: product.price,
        currency: product.currency,
        description: product.name,
        order_id: orderId,
        result_url: `https://li-astrology.com.ua/payment/success.html?product=${productId}`,
        server_url: CONFIG.SUPABASE_FUNCTION_URL
    };

    // Redirect to LiqPay
    // ... (signature generation required on backend for security)
}
```

---

## Phase 6: Telegram Bot + Private Channel Delivery

### 6.1 Architecture Overview
```
┌─────────────────────────────────────────────────────────────┐
│              TELEGRAM DELIVERY SYSTEM                        │
└─────────────────────────────────────────────────────────────┘

  Payment completed on LiqPay
           │
           ▼
  User redirected to success page
           │
           ▼
  Success page shows "Join Telegram" button
           │
           ▼
  t.me/li_astrology_bot?start={order_id}_{product}
           │
           ▼
  ┌─────────────────────────────────────────┐
  │  Bot receives /start command            │
  │  1. Verifies purchase in Supabase       │
  │  2. Generates unique invite link        │
  │  3. Sends invite to private channel     │
  │  4. Marks telegram_sent = true          │
  └─────────────────────────────────────────┘
           │
           ▼
  User joins private channel with materials
```

### 6.2 Private Channels Structure
Create separate private channels for each product:
```
@li_astrology_intensiv_channel    (private) - Intensiv materials
@li_astrology_kurs_t1_channel     (private) - Kurs Tariff 1 materials
@li_astrology_kurs_t2_channel     (private) - Kurs Tariff 2 materials
@li_astrology_kurs_t3_channel     (private) - Kurs Tariff 3 materials
```

**Setup Steps:**
1. Create each private channel in Telegram
2. Add @li_astrology_bot as admin to all channels
3. Upload course materials to respective channels
4. Bot generates unique invite links on demand

### 6.3 Bot Commands
```
/start              - Welcome message (no purchase)
/start {order_id}   - Verify purchase & send channel invite
/help               - Help and support info
/support            - Contact support
```

### 6.4 Bot Implementation (Supabase Edge Function)

**Location:** Supabase Edge Functions (serverless, free tier)

```javascript
// supabase/functions/telegram-bot/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_KEY')

const CHANNELS = {
  'intensiv': '-100xxxxxxxxxx',      // Channel ID for intensiv
  'kurs_tariff1': '-100xxxxxxxxxx',  // Channel ID for tariff 1
  'kurs_tariff2': '-100xxxxxxxxxx',  // Channel ID for tariff 2
  'kurs_tariff3': '-100xxxxxxxxxx',  // Channel ID for tariff 3
}

serve(async (req) => {
  const update = await req.json()

  if (update.message?.text?.startsWith('/start')) {
    const chatId = update.message.chat.id
    const params = update.message.text.split(' ')[1]

    if (params) {
      // Verify purchase and send invite
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
      const { data: purchase } = await supabase
        .from('purchases')
        .select('*')
        .eq('order_id', params.split('_')[0])
        .eq('status', 'success')
        .single()

      if (purchase && !purchase.telegram_sent) {
        // Generate invite link
        const channelId = CHANNELS[purchase.product_type]
        const inviteLink = await createInviteLink(channelId)

        // Send to user
        await sendMessage(chatId,
          `🎉 Вітаємо з покупкою!\n\n` +
          `Ваше посилання на курс:\n${inviteLink}\n\n` +
          `Посилання дійсне 24 години.`
        )

        // Mark as sent
        await supabase
          .from('purchases')
          .update({ telegram_sent: true, telegram_chat_id: chatId })
          .eq('id', purchase.id)
      } else {
        await sendMessage(chatId,
          'Покупку не знайдено або посилання вже було надіслано.\n' +
          'Зверніться до підтримки: @anastasia_support'
        )
      }
    } else {
      // Welcome message without purchase
      await sendMessage(chatId,
        '✨ Вітаємо в Li Astrology Bot!\n\n' +
        'Щоб отримати доступ до матеріалів, ' +
        'придбайте курс на нашому сайті:\n' +
        'https://li-astrology.com.ua'
      )
    }
  }

  return new Response('OK')
})

async function createInviteLink(channelId: string) {
  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/createChatInviteLink`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: channelId,
        member_limit: 1,  // Single use
        expire_date: Math.floor(Date.now() / 1000) + 86400  // 24 hours
      })
    }
  )
  const data = await response.json()
  return data.result.invite_link
}

async function sendMessage(chatId: number, text: string) {
  await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    }
  )
}
```

### 6.5 Setting Up Telegram Webhook
After deploying the Supabase function, set the webhook:
```bash
curl -X POST "https://api.telegram.org/bot{BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://{project}.supabase.co/functions/v1/telegram-bot"}'
```

### 6.6 Private Channel Setup Checklist
- [ ] Create private channel for Intensiv
- [ ] Create private channel for Kurs Tariff 1
- [ ] Create private channel for Kurs Tariff 2
- [ ] Create private channel for Kurs Tariff 3
- [ ] Add @li_astrology_bot as admin to all channels
- [ ] Upload materials to each channel
- [ ] Get channel IDs (forward message to @userinfobot)
- [ ] Configure channel IDs in bot code

---

## Phase 7: Implementation Checklist

### Manual Tasks (You Need to Do)
- [ ] Register domain li-astrology.com.ua (nic.ua or hostiq.ua)
- [ ] Create Netlify account and connect repository
- [ ] Register LiqPay merchant account (needs ФОП documents)
- [ ] Create Supabase project
- [ ] Create Telegram bot via @BotFather (@li_astrology_bot)
- [ ] Create 4 private Telegram channels for course materials
- [ ] Create Google Analytics property

### Development Tasks (I Will Do)

**Phase A: Project Structure & i18n**
- [ ] Rename bootcamp → intensiv
- [ ] Rename course → kurs-aspekty
- [ ] Create i18n system (js/i18n.js)
- [ ] Create Ukrainian translations (js/translations/uk.json)
- [ ] Create Russian translations (js/translations/ru.json)
- [ ] Add language switcher dropdown to header
- [ ] Create shared CSS (css/common.css)

**Phase B: Homepage**
- [ ] Create homepage (index.html) with product cards
- [ ] Add i18n support to homepage
- [ ] Style homepage to match existing design

**Phase C: Analytics & Config**
- [ ] Add Google Analytics to all pages
- [ ] Create config.js for API keys
- [ ] Create .gitignore for sensitive files
- [ ] Add Netlify configuration (_redirects, netlify.toml)

**Phase D: Payment Integration**
- [ ] Implement LiqPay payment buttons
- [ ] Create payment success page
- [ ] Create Supabase database schema (purchases table)
- [ ] Create Supabase Edge Function for LiqPay callbacks

**Phase E: Telegram Bot**
- [ ] Implement Telegram bot (Supabase Edge Function)
- [ ] Set up webhook
- [ ] Test invite link generation

**Phase F: Legal & Polish**
- [ ] Create privacy policy page (legal/privacy.html)
- [ ] Create public offer page (legal/offer.html)
- [ ] Update footers with legal links
- [ ] Test full payment flow end-to-end

---

## Phase 8: Credentials to Collect

After registrations, you'll need to provide these (keep them secret!):

```
# Credentials checklist (DO NOT SHARE PUBLICLY)

# LiqPay (from liqpay.ua Developer section)
LIQPAY_PUBLIC_KEY=sandbox_xxxxxxxxxx
LIQPAY_PRIVATE_KEY=sandbox_xxxxxxxxxx

# Supabase (from project settings)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbxxxxxxx
SUPABASE_SERVICE_KEY=eyJhbxxxxxxx

# Telegram (from @BotFather)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# Telegram Channel IDs (forward msg from channel to @userinfobot)
CHANNEL_INTENSIV=-100xxxxxxxxxx
CHANNEL_KURS_T1=-100xxxxxxxxxx
CHANNEL_KURS_T2=-100xxxxxxxxxx
CHANNEL_KURS_T3=-100xxxxxxxxxx

# Google Analytics (from analytics.google.com)
GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

---

## Decisions Made

| Question | Answer |
|----------|--------|
| Domain | li-astrology.com.ua |
| Hosting | Netlify (free, auto-deploy) |
| Homepage | Yes, with product selector |
| Bot username | @li_astrology_bot |
| Languages | Ukrainian (default) + Russian with switcher |
| Material delivery | Private Telegram channel invites |
| Purchase storage | Supabase (PostgreSQL) |

---

## Ready to Start?

You can start the **manual registrations** now (they can be done in parallel):
1. Domain registration
2. Netlify signup
3. LiqPay merchant application (takes 1-3 days for approval)
4. Supabase project creation
5. Telegram bot creation
6. Google Analytics setup

**Meanwhile, I can start implementing the code** - restructuring folders, adding i18n, creating homepage. Want me to begin?
