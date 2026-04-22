export const ru = {
  welcome: (name: string) =>
    `Привет, ${name}! Я бот Школы Астрологии LI.\n\nЗдесь ты можешь смотреть свои курсы, отслеживать прогресс и получать новые материалы.`,

  menu: {
    myCourses: 'Мои курсы',
    catalog: 'Каталог курсов',
    support: 'Поддержка',
    settings: 'Настройки',
  },

  myCourses: {
    empty: 'У тебя ещё нет курсов. Загляни в каталог!',
    progress: (completed: number, total: number) => `${completed}/${total} уроков`,
    toCatalog: 'В каталог',
    header: 'Мои курсы:\n',
    continueCourse: (title: string) => `Продолжить: ${title}`,
  },

  lessons: {
    title: (courseTitle: string, completed: number, total: number) =>
      `${courseTitle}\n\nПрогресс: ${completed}/${total} уроков`,
    markComplete: 'Завершено',
    alreadyComplete: 'Уже завершено',
    next: 'Следующий урок',
    prev: 'Предыдущий урок',
    backToLessons: 'К списку уроков',
    aboutCourse: 'ℹ️ О курсе',
    startLearning: 'Начать обучение →',
    noAccess: 'У вас нет доступа к этому курсу.',
    watchVideo: 'Смотреть видео',
    completedToast: '✅ Урок завершён!',
    markCompleteButton: '✅ Отметить как завершённый',
    completedLabel: '✅ Завершён',
    prevShort: '◄ Предыдущий',
    nextShort: 'Следующий ►',
    backToList: '📋 К списку уроков',
    progressLine: (completed: number, total: number) => `${completed}/${total} уроков`,
  },

  catalog: {
    title: 'Наши курсы:',
    price: (uah: number) => `${uah} грн`,
    priceLabel: 'Цена:',
    lessonsCount: (n: number) => `Уроков: ${n}`,
    details: 'Подробнее',
    buy: (price: string) => `Купить за ${price}`,
    promoCode: 'У меня есть промокод',
    owned: 'Уже приобретено',
    goToCourse: 'Перейти к курсу',
    aboutOnSite: 'ℹ️ О курсе (на сайте)',
    alreadyOwned: (title: string) => `У тебя уже есть доступ к "${title}"!`,
  },

  purchase: {
    success: (courseTitle: string) =>
      `Оплата получена! Курс "${courseTitle}" добавлен в твои курсы.`,
    goToCourse: 'Перейти к курсу',
    payViaLink: 'Для оплаты нажмите кнопку ниже:',
    payButton: 'Оплатить',
    error: 'Не удалось создать платёж. Попробуйте позже или обратитесь в поддержку.',
    pending: '⏳ Оплата ещё обрабатывается. Попробуйте через 1-2 минуты.',
    failed: 'Оплата не прошла или отменена. Если это ошибка — обратитесь в поддержку.',
    alreadyClaimed: 'Этот заказ уже активирован другим аккаунтом. Если это ошибка — обратитесь в поддержку.',
  },

  promo: {
    enterCode: 'Введите промокод:',
    invalid: 'Промокод не найден или уже недействителен.',
    applied: (pct: number, newPrice: string) =>
      `Скидка ${pct}% применена! Новая цена: ${newPrice}`,
  },

  support: {
    intro: 'Напишите ваш вопрос, и мы ответим как можно скорее.',
    received: 'Ваше обращение принято. Ожидайте ответ.',
  },

  settings: {
    title: 'Настройки',
    language: 'Язык',
    notifications: 'Уведомления',
    on: 'Включено',
    off: 'Выключено',
  },

  common: {
    back: '« Назад',
    home: 'Главное меню',
    error: 'Возникла ошибка. Попробуйте позже.',
  },

  reminder: {
    inactivity: (name: string, courseTitle: string, lesson: number, total: number) =>
      `Привет, ${name}! Ты не заходил(а) уже несколько дней.\nПродолжай курс "${courseTitle}" — ты на уроке ${lesson} из ${total}!`,
    continueCourse: 'Продолжить курс',
  },

  waitlist: {
    added:
      '✨ Ты в списке ожидания!\n\n' +
      'Тариф «Для профи» ещё в подготовке — блок «Как консультировать» записываем в течение ~2 месяцев. ' +
      'Напишу первой, как только откроем продажу.\n\n' +
      'А пока — загляни в каталог:',
    alreadyThere:
      'Ты уже в списке ожидания 🌙 Напишу, как только откроем продажу тарифа «Для профи».',
    browseCatalog: '📚 Каталог курсов',
  },
} as const;
