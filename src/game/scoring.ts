import { getTraitAbility, isHealthyStatus } from './abilities';
import { Player, PublicPlayer, TRAIT_ORDER, TraitCategory } from './types';

export type CardTag =
  | 'med'
  | 'tech'
  | 'combat'
  | 'social'
  | 'survival'
  | 'chaos'
  | 'liability'
  | 'adult';

const TAG_RULES: Array<{ tag: CardTag; keywords: string[]; bonus: number }> = [
  {
    tag: 'med',
    keywords: [
      'хирург',
      'реаниматолог',
      'фармацевт',
      'стоматолог',
      'ветеринар',
      'психиатр',
      'нарколог',
      'жрец',
      'паладин',
      'алхимик',
      'друид',
      'знахар',
      'аптечк',
      'медицинск',
      'зелья лечения',
      'обезболива',
      'морфи',
      'антибиотик',
      'донор',
      'швы',
      'гипс',
    ],
    bonus: 5,
  },
  {
    tag: 'tech',
    keywords: [
      'инженер',
      'механик',
      'электрик',
      'сантехник',
      'строитель',
      'слесарь',
      'кузнец',
      'артефактор',
      'мастер рун',
      'архитектор',
      'геолог',
      'программист',
      'физик-ядерщик',
      'радиоинженер',
      'химик',
      'инструмент',
      'сварк',
      'солнечная панель',
      'генератор',
      'наковальн',
      'фильтр',
      'мультитул',
    ],
    bonus: 5,
  },
  {
    tag: 'combat',
    keywords: [
      'военный',
      'разведчик',
      'телохранитель',
      'пожарный',
      'варвар',
      'ведьмак',
      'ассасин',
      'инквизитор',
      'винтовк',
      'арбалет',
      'кинжал',
      'лук',
      'топор',
      'бронежилет',
      'щит',
      'боевые искусства',
      'охота',
      'лом и кувалда',
      'электрошокер',
    ],
    bonus: 4,
  },
  {
    tag: 'survival',
    keywords: [
      'агроном',
      'повар',
      'трактирщик',
      'гидропоника',
      'ферм',
      'семян',
      'теплица',
      'консерв',
      'противогаз',
      'дозиметр',
      'рация',
      'фонарь',
      'компас',
      'спальник',
      'палатка',
      'печка',
      'выживан',
      'иммунитет',
      'фотографической памятью',
    ],
    bonus: 4,
  },
  {
    tag: 'social',
    keywords: [
      'психотерапевт',
      'переговорщик',
      'лидер',
      'учитель',
      'переводчик',
      'юрист',
      'бард',
      'менеджер',
      'блогер',
      'стендап',
      'менестрель',
      'успокоения',
    ],
    bonus: 2,
  },
  {
    tag: 'chaos',
    keywords: [
      'вор',
      'карманник',
      'коллектор',
      'палач',
      'головорез',
      'некромант',
      'клоун',
      'контрабандист',
      'отравитель',
      'эгоистичен',
      'подделывать',
      'панике',
      'лунатизм',
      'бес',
      'мимик',
      'кукла вуду',
    ],
    bonus: -1,
  },
  {
    tag: 'adult',
    keywords: [
      '18+',
      'бдсм',
      'стриптиз',
      'порноактёр',
      'суккуб',
      'инкуб',
      'куртизанка',
      'лубрикант',
      'презерватив',
      'плётк',
      'орган',
      'компромат',
      'секс',
      'доминатор',
    ],
    bonus: 0,
  },
];

function clampScore(val: number): number {
  return Math.max(-6, Math.min(15, Math.round(val)));
}

export function scoreTraitCard(
  category: TraitCategory,
  value: string
): { score: number; tags: CardTag[] } {
  const clean = value.trim();
  if (!clean || clean === '—' || clean.toLowerCase().includes('отключено')) {
    return { score: 0, tags: [] };
  }

  const lower = clean.toLowerCase();
  const tags = new Set<CardTag>();
  let score = 1;

  for (const rule of TAG_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      tags.add(rule.tag);
      score += rule.bonus;
    }
  }

  const ability = getTraitAbility(category, clean);
  if (ability) {
    if (['heal', 'repair_bunker', 'protect', 'craft_bonus', 'calm_phobia'].includes(ability.kind)) {
      score += 3;
    } else if (['reveal_bunker', 'scout', 'boost_vote'].includes(ability.kind)) {
      score += 2;
    } else {
      score += 1;
    }
  }

  if (category === 'profession') {
    if (lower.includes('эксперт')) score += 5;
    else if (lower.includes('мастер')) score += 4;
    else if (lower.includes('опытный')) score += 3;
    else if (lower.includes('практик')) score += 2;
    else if (lower.includes('любитель')) score += 1;
    else if (lower.includes('новичок')) score -= 1;
  } else if (category === 'biology') {
    score = 0;
    if (lower.includes('плодовит') || lower.includes('беременна')) {
      score += 4;
      tags.add('survival');
    } else if (lower.includes('бесплод')) {
      score -= 2;
      tags.add('liability');
    }
    const ageMatch = lower.match(/(\d+)\s*лет/);
    if (ageMatch) {
      const age = Number(ageMatch[1]);
      if (age >= 19 && age <= 42) score += 1;
      else if (age > 58) score -= 1;
    }
  } else if (category === 'physiology') {
    score = 1;
    if (
      ['атлет', 'крепк', 'вынослив', 'сил', 'болевой порог', 'ночное зрение', 'регенерац', 'гибк', 'ловк', 'быстр', 'качок', 'гимнаст', 'марафон'].some((kw) =>
        lower.includes(kw)
      )
    ) {
      score += 3;
      tags.add('survival');
    }
    if (['хрупк', 'слаб', 'лишний вес', 'одышк', 'тяжело плавать', 'быстро устаёт'].some((kw) => lower.includes(kw))) {
      score -= 3;
      tags.add('liability');
    }
  } else if (category === 'health') {
    if (isHealthyStatus(clean)) {
      score = 6;
      tags.add('survival');
    } else {
      tags.add('liability');
      if (lower.includes('критическое')) score = -6;
      else if (lower.includes('тяжёлая стадия')) score = -5;
      else if (lower.includes('средняя стадия')) score = -3;
      else if (lower.includes('лёгкая стадия')) score = -1;
      else score = -2;
    }
  } else if (category === 'phobia') {
    if (
      lower.includes('нет фоби') ||
      lower.includes('нет выражен') ||
      lower.includes('нет страхов') ||
      lower.includes('успокоена')
    ) {
      score = 3;
      tags.add('survival');
    } else {
      tags.add('liability');
      if (
        lower.includes('клаустрофобия') ||
        lower.includes('никтофобия') ||
        lower.includes('тафефобия') ||
        lower.includes('социофобия')
      ) {
        score = -4;
      } else {
        score = -2;
      }
    }
  }

  return {
    score: clampScore(score),
    tags: [...tags],
  };
}

function abilityUtilityBonus(category: TraitCategory, value: string): number {
  const ab = getTraitAbility(category, value);
  if (!ab) return 0;
  if (['heal', 'repair_bunker', 'protect', 'calm_phobia', 'craft_bonus'].includes(ab.kind)) {
    return 5;
  }
  if (['reveal_bunker', 'scout', 'boost_vote'].includes(ab.kind)) {
    return 3;
  }
  return 1;
}

export function scorePlayer(player: Player | PublicPlayer, onlyRevealed: boolean): number {
  let total = 0;

  if ('traits' in player) {
    for (const cat of TRAIT_ORDER) {
      const t = player.traits[cat];
      if (!t || t.removed) continue;
      if (onlyRevealed && !t.revealed) continue;
      total += scoreTraitCard(cat, t.value).score;
      if (!player.usedTraitAbilities.includes(cat)) {
        total += abilityUtilityBonus(cat, t.value);
      }
    }
    for (const bt of player.bonusTraits) {
      if (onlyRevealed && !bt.revealed) continue;
      total += 2;
    }
    if (player.hasImmunity) total += 2;
    if (player.voteWeight <= 0) total -= 2;
  } else {
    for (const cat of TRAIT_ORDER) {
      if (player.removedCategories.includes(cat)) continue;
      const val = player.revealedTraits[cat];
      if (!val) continue;
      total += scoreTraitCard(cat, val).score;
      total += abilityUtilityBonus(cat, val);
    }
    total += player.revealedBonusTraits.length * 2;
    if (player.hasImmunity) total += 2;
    if (player.silenced) total -= 2;
  }

  return total;
}
