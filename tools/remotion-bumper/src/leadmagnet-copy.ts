// All copy for the lead-magnet ad, in one place so it can be retuned
// without touching animation code. Derived from the real guide:
// materials/documents/professional-purpose/ПРОФЕССИОНАЛЬНОЕ ПРЕДНАЗНАЧЕНИЕ.txt

export const LM = {
  // Scene 1 — hook
  hookLine1: "В чём твоё",
  hookLine2: "профессиональное",
  hookLine3: "предназначение?",
  hookSub: "Твоя натальная карта уже знает ответ",

  // Scene 2 — curiosity (short teasers pulled from the guide)
  teaseTitle: "10-й дом показывает путь\nк твоему призванию",
  teasers: [
    { sign: "Овен", line: "действовать смело и первым" },
    { sign: "Телец", line: "надёжность — твой капитал" },
    { sign: "Лев", line: "вдохновлять и быть на виду" },
    { sign: "Скорпион", line: "сила — в работе со сложным" },
  ],
  teaseHook: "…а что говорит твой знак?",

  // Scene 3 — the free offer
  offerLabel: "БЕСПЛАТНЫЙ ГАЙД",
  offerTitle: "Профессиональное\nпредназначение",
  offerSub: "10 дом в натальной карте",
  bullets: [
    "Твоё призвание по всем 12 знакам",
    "Что добавляют планеты в 10 доме",
    "Как найти дело, где ты на своём месте",
  ],

  // Scene 4 — CTA
  ctaLead: "Забери гайд бесплатно",
  ctaAction: "Напиши «ГАЙД» в Директ",
  handle: "@li_astrology_",
  url: "li-astrology.com.ua",
} as const;
