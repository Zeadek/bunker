import { TraitAbilityInfo, TraitCategory } from './types';

const HEAL_KEYWORDS = [
  'хирург',
  'ветеринар',
  'фармацевт',
  'стоматолог',
  'реаниматолог',
  'жрец',
  'паладин',
  'алхимик',
  'друид',
  'аптечк',
  'медицинский чемодан',
  'зелья лечения',
  'зелье лечения',
  'обезболива',
];

const HARM_KEYWORDS = [
  'кинжал',
  'винтовк',
  'лук',
  'посох огня',
  'топор',
  'лом и кувалд',
  'ядом василиска',
  'метательные ножи',
  'арбалет',
  'вор-тень',
  'ассасин',
  'варвар',
  'ведьмак',
  'разведчик',
  'телохранитель',
];

const REPAIR_KEYWORDS = [
  'инженер',
  'механик',
  'электрик',
  'сантехник',
  'строитель',
  'слесарь',
  'кузнец',
  'артефактор',
  'мастер рун',
  'инструмент',
  'наковальн',
];

const SCOUT_KEYWORDS = [
  'рация',
  'ворон',
  'ночного видения',
  'компас',
  'дрон',
  'следопыт',
  'программист',
  'криминалист',
  'чародей',
  'плащ-невидимка',
];

export function getTraitAbility(
  category: TraitCategory,
  value: string
): TraitAbilityInfo | null {
  if (category !== 'profession' && category !== 'gear' && category !== 'pocket') {
    return null;
  }

  const lower = value.toLowerCase();

  if (HEAL_KEYWORDS.some((kw) => lower.includes(kw))) {
    return {
      kind: 'heal',
      title: 'Вылечить игрока',
      description: 'Снижает стадию болезни/ранения на 1 шаг (1 раз за игру).',
      needsTargetPlayer: true,
    };
  }

  if (HARM_KEYWORDS.some((kw) => lower.includes(kw))) {
    return {
      kind: 'harm',
      title: 'Ранить игрока',
      description: 'Наносит ранение или усиливает стадию недуга на 1 шаг (1 раз за игру).',
      needsTargetPlayer: true,
    };
  }

  if (REPAIR_KEYWORDS.some((kw) => lower.includes(kw))) {
    return {
      kind: 'repair_bunker',
      title: 'Устранить угрозу',
      description: 'Нейтрализует одну открытую угрозу бункера (1 раз за игру).',
      needsTargetPlayer: false,
    };
  }

  if (SCOUT_KEYWORDS.some((kw) => lower.includes(kw))) {
    return {
      kind: 'scout',
      title: 'Разведка',
      description: 'Вскрывает случайную скрытую характеристику выбранного игрока (1 раз за игру).',
      needsTargetPlayer: true,
    };
  }

  return null;
}

export function getAbilityShortBadge(category: TraitCategory, value: string): string | null {
  const info = getTraitAbility(category, value);
  if (!info) return null;
  switch (info.kind) {
    case 'heal':
      return '⚡ Лечение';
    case 'harm':
      return '⚡ Атака';
    case 'repair_bunker':
      return '⚡ Ремонт';
    case 'scout':
      return '⚡ Разведка';
  }
}

export function isHealthyStatus(health: string): boolean {
  const lower = health.toLowerCase();
  return lower.includes('полностью здоров') || lower.includes('абсолютно здоров');
}

export function applyHealToHealth(health: string): string | null {
  if (isHealthyStatus(health)) {
    return null; // Cannot heal a healthy person
  }
  if (health.includes('Тяжёлая стадия')) {
    return health.replace('Тяжёлая стадия', 'Средняя стадия');
  }
  if (health.includes('Средняя стадия')) {
    return health.replace('Средняя стадия', 'Лёгкая стадия');
  }
  if (health.includes('Лёгкая стадия')) {
    return 'Полностью здоров';
  }
  // If no explicit stage tag, cure to healthy
  return 'Полностью здоров';
}

export function applyHarmToHealth(health: string): string {
  if (isHealthyStatus(health)) {
    return 'Ранение после стычки [Лёгкая стадия]';
  }
  if (health.includes('Лёгкая стадия')) {
    return health.replace('Лёгкая стадия', 'Средняя стадия');
  }
  if (health.includes('Средняя стадия')) {
    return health.replace('Средняя стадия', 'Тяжёлая стадия');
  }
  if (health.includes('Тяжёлая стадия')) {
    return health.includes('Критическое')
      ? health
      : `${health} (Критическое состояние)`;
  }
  return `${health} [Средняя стадия]`;
}
