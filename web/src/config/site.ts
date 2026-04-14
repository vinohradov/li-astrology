export const site = {
  name: 'Li Astrology',
  author: 'Анастасія Лісовська',
  domain: 'li-astrology.com.ua',
  url: 'https://li-astrology.com.ua',
  bot: {
    username: 'li_astrology_bot',
    url: 'https://t.me/li_astrology_bot',
  },
  instagram: 'https://www.instagram.com/li_astrology_',
  legal: {
    entity: 'ФОП Виноградов А.В.',
  },
  supabase: {
    url: 'https://plyofinxmwvwbintvqbx.supabase.co',
    anonKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBseW9maW54bXd2d2JpbnR2cWJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzI1MDQsImV4cCI6MjA4NDU0ODUwNH0.33Vps8a9w1zfh3s5y2lNiHAnbG-ABmc50tQjBxRgQqE',
  },
} as const;

export type ProductSlug = 'intensiv' | 'aspekty-basic' | 'aspekty-pro' | 'astro-z-0' | 'astro-z-0-pro';

export interface Product {
  slug: ProductSlug;
  title: string;
  tagline: string;
  priceUah: number;
  priceLabel: string;
  href: string;
  status: 'live' | 'coming-soon';
}

export const products: Record<ProductSlug, Product> = {
  intensiv: {
    slug: 'intensiv',
    title: 'Інтенсив «Астрологія з 0»',
    tagline: 'Твій перший крок у світ натальної карти',
    priceUah: 1199,
    priceLabel: '1 199 грн',
    href: '/intensiv/',
    status: 'live',
  },
  'aspekty-basic': {
    slug: 'aspekty-basic',
    title: 'Аспекти — Базовий тариф',
    tagline: 'Самостійне вивчення з готовими матеріалами',
    priceUah: 1290,
    priceLabel: '1 290 грн',
    href: '/aspekty/',
    status: 'live',
  },
  'aspekty-pro': {
    slug: 'aspekty-pro',
    title: 'Аспекти — Професійний тариф',
    tagline: 'Поглиблений курс з відео-розборами',
    priceUah: 2790,
    priceLabel: '2 790 грн',
    href: '/aspekty/#pro',
    status: 'live',
  },
  'astro-z-0': {
    slug: 'astro-z-0',
    title: 'Курс «Астрологія з 0» — Для себе',
    tagline: 'Повний курс від основ до синтезу натальної карти',
    priceUah: 6000,
    priceLabel: '6 000 грн',
    href: '/course/',
    status: 'coming-soon',
  },
  'astro-z-0-pro': {
    slug: 'astro-z-0-pro',
    title: 'Курс «Астрологія з 0» — Для професійного консультування',
    tagline: 'Повний курс + блок «Як консультувати» + зворотний зв\'язок + сертифікат',
    priceUah: 12500,
    priceLabel: '12 500 грн',
    href: '/course/#pro',
    status: 'coming-soon',
  },
};
