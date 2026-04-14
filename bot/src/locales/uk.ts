export const uk = {
  welcome: (name: string) =>
    `Привіт, ${name}! Я бот Школи Астрології LI.\n\nТут ти можеш переглядати свої курси, відстежувати прогрес та отримувати нові матеріали.`,

  menu: {
    myCourses: 'Мої курси',
    catalog: 'Каталог курсів',
    support: 'Підтримка',
    settings: 'Налаштування',
  },

  myCourses: {
    empty: 'У тебе ще немає курсів. Завітай до каталогу!',
    progress: (completed: number, total: number) => `${completed}/${total} уроків`,
    toCatalog: 'До каталогу',
  },

  lessons: {
    title: (courseTitle: string, completed: number, total: number) =>
      `${courseTitle}\n\nПрогрес: ${completed}/${total} уроків`,
    markComplete: 'Завершено',
    alreadyComplete: 'Вже завершено',
    next: 'Наступний урок',
    prev: 'Попередній урок',
    backToLessons: 'До списку уроків',
  },

  catalog: {
    title: 'Наші курси:',
    price: (uah: number) => `${uah} грн`,
    details: 'Детальніше',
    buy: (price: string) => `Купити за ${price}`,
    promoCode: 'У мене є промокод',
    owned: 'Вже придбано',
    goToCourse: 'Перейти до курсу',
  },

  purchase: {
    success: (courseTitle: string) =>
      `Оплату отримано! Курс "${courseTitle}" додано до твоїх курсів.`,
    goToCourse: 'Перейти до курсу',
    payViaLink: 'Для оплати натисніть кнопку нижче:',
    payButton: 'Оплатити',
    error: 'Не вдалося створити платіж. Спробуйте пізніше або зверніться в підтримку.',
    pending: '⏳ Оплата ще обробляється. Спробуйте через 1-2 хвилини.',
    failed: 'Оплата не пройшла або скасована. Якщо це помилка — зверніться в підтримку.',
    alreadyClaimed: 'Це замовлення вже активоване іншим акаунтом. Якщо це помилка — зверніться в підтримку.',
  },

  promo: {
    enterCode: 'Введіть промокод:',
    invalid: 'Промокод не знайдено або вже не дійсний.',
    applied: (pct: number, newPrice: string) =>
      `Знижка ${pct}% застосована! Нова ціна: ${newPrice}`,
  },

  support: {
    intro: 'Напишіть ваше питання, і ми відповімо якнайшвидше.',
    received: 'Ваше звернення прийнято. Очікуйте відповідь.',
  },

  settings: {
    title: 'Налаштування',
    language: 'Мова',
    notifications: 'Сповіщення',
    on: 'Увімкнено',
    off: 'Вимкнено',
  },

  common: {
    back: '« Назад',
    home: 'Головне меню',
    error: 'Виникла помилка. Спробуйте пізніше.',
  },

  reminder: {
    inactivity: (name: string, courseTitle: string, lesson: number, total: number) =>
      `Привіт, ${name}! Ти не заходив(ла) вже кілька днів.\nПродовжуй курс "${courseTitle}" — ти на уроці ${lesson} з ${total}!`,
    continueCourse: 'Продовжити курс',
  },
} as const;
