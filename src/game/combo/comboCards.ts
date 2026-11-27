import { mergePacks } from '../data';
import { CardTag, scoreTraitCard } from '../scoring';
import { AdultIntensity, PackId, TraitCategory } from '../types';
import { ComboCard, ComboCardEffect } from './comboTypes';

export const COMBO_SLOT_CATEGORIES: TraitCategory[] = [
  'profession',
  'health',
  'hobby',
  'gear',
  'fact',
];

const BUILD_CATEGORIES: TraitCategory[] = [
  'profession',
  'biology',
  'physiology',
  'health',
  'hobby',
  'gear',
  'pocket',
  'fact',
];

const CURSED_CARD_TEMPLATES: Array<{
  title: string;
  category: TraitCategory;
  baseScore: number;
  tags: CardTag[];
  effect?: ComboCardEffect;
}> = [
  {
    title: 'Проклятие ржавой шестерёнки',
    category: 'gear',
    baseScore: -5,
    tags: ['liability', 'chaos'],
    effect: {
      kind: 'flat_bonus',
      duration: 'round',
      value: -2,
      description: 'Засоряет слот и отнимает ещё 2 очка раунда.',
    },
  },
  {
    title: 'Синдром хронической паники',
    category: 'health',
    baseScore: -6,
    tags: ['liability', 'chaos'],
    effect: {
      kind: 'flat_bonus',
      duration: 'round',
      value: -1,
      description: 'Мешает сосредоточиться: -1 дополнительное очко.',
    },
  },
  {
    title: 'Пустой ящик из-под пайка',
    category: 'pocket',
    baseScore: -4,
    tags: ['liability'],
  },
  {
    title: 'Саботаж вентиляции',
    category: 'fact',
    baseScore: -5,
    tags: ['chaos', 'liability'],
  },
];

const PENALTY_FILLER_TEMPLATES: Array<{ title: string; category: TraitCategory }> = [
  { title: 'Спешка вслепую (незаполненный слот)', category: 'fact' },
  { title: 'Случайный хлам из коридора (автозаполнение)', category: 'pocket' },
  { title: 'Нервный срыв на драфте (штрафной слот)', category: 'health' },
];

const TACTIC_TEMPLATES: Array<{
  title: string;
  category: TraitCategory;
  effect: ComboCardEffect;
}> = [
  {
    title: 'Межотсечный саботаж',
    category: 'fact',
    effect: {
      kind: 'neighbor_debuff',
      duration: 'round',
      value: -6,
      description: 'Снижает итоговые очки соседа на 6 в этом раунде.',
    },
  },
  {
    title: 'Хроническая диверсия',
    category: 'fact',
    effect: {
      kind: 'neighbor_debuff',
      duration: 'persistent',
      value: -3,
      description: 'Долгосрочно снижает очки соседа на 3 до конца игры.',
    },
  },
  {
    title: 'Подброс проклятой карты',
    category: 'pocket',
    effect: {
      kind: 'curse_opponent_deck',
      duration: 'persistent',
      value: 2,
      description: 'Замешивает 2 проклятые карты в личную колоду соперника.',
    },
  },
  {
    title: 'Ловкая кража из рукава',
    category: 'pocket',
    effect: {
      kind: 'steal_hand_card',
      duration: 'round',
      value: 1,
      description: 'Крадёт случайную карту из руки выбранного соперника.',
    },
  },
  {
    title: 'Экстренный добор припасов',
    category: 'gear',
    effect: {
      kind: 'draw_cards',
      duration: 'round',
      value: 2,
      description: 'Позволяет добрать 2 карты из своей колоды в руку.',
    },
  },
  {
    title: 'Переквалификация на ходу',
    category: 'profession',
    effect: {
      kind: 'change_category',
      duration: 'round',
      value: 1,
      description: 'Меняет категорию выбранной карты в слоте под тип слота.',
    },
  },
];

const BUILD_SYNERGY_EFFECTS: Array<{
  matchTags: CardTag[];
  effect: ComboCardEffect;
}> = [
  {
    matchTags: ['med'],
    effect: {
      kind: 'tag_multiplier',
      duration: 'round',
      value: 4,
      targetTag: 'med',
      description: '+4 очка за каждую другую карту с тегом «med» в билде.',
    },
  },
  {
    matchTags: ['tech'],
    effect: {
      kind: 'tag_multiplier',
      duration: 'round',
      value: 4,
      targetTag: 'tech',
      description: '+4 очка за каждую другую карту с тегом «tech» в билде.',
    },
  },
  {
    matchTags: ['combat'],
    effect: {
      kind: 'adjacent_synergy',
      duration: 'round',
      value: 5,
      targetTag: 'survival',
      description: '+5 очков, если в соседнем слоте есть карта с тегом «survival».',
    },
  },
  {
    matchTags: ['survival'],
    effect: {
      kind: 'adjacent_synergy',
      duration: 'round',
      value: 5,
      targetTag: 'tech',
      description: '+5 очков, если в соседнем слоте есть карта с тегом «tech».',
    },
  },
  {
    matchTags: ['social'],
    effect: {
      kind: 'unique_tags_bonus',
      duration: 'round',
      value: 2,
      description: '+2 очка за каждый уникальный тег в вашем билде.',
    },
  },
  {
    matchTags: ['chaos', 'adult'],
    effect: {
      kind: 'tag_multiplier',
      duration: 'round',
      value: 3,
      targetTag: 'chaos',
      description: '+3 очка за каждую другую карту с тегом «chaos» в билде.',
    },
  },
];

let comboUidCounter = 1;
export function nextComboId(prefix = 'cc'): string {
  comboUidCounter += 1;
  return `${prefix}_${comboUidCounter}_${Math.random().toString(36).slice(2, 6)}`;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffleCards<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createCursedCard(): ComboCard {
  const tpl = pickRandom(CURSED_CARD_TEMPLATES);
  return {
    id: nextComboId('curse'),
    title: tpl.title,
    category: tpl.category,
    kind: 'curse',
    baseScore: tpl.baseScore,
    tags: [...tpl.tags],
    effect: tpl.effect ? { ...tpl.effect } : undefined,
    isCurse: true,
  };
}

export function createPenaltySlotCard(slotCategory: TraitCategory): ComboCard {
  const tpl = pickRandom(PENALTY_FILLER_TEMPLATES);
  return {
    id: nextComboId('pen'),
    title: tpl.title,
    category: slotCategory,
    kind: 'penalty',
    baseScore: -4,
    tags: ['liability'],
    isPenalty: true,
  };
}

export function createTacticCard(indexHint?: number): ComboCard {
  const tpl =
    indexHint !== undefined
      ? TACTIC_TEMPLATES[indexHint % TACTIC_TEMPLATES.length]
      : pickRandom(TACTIC_TEMPLATES);
  return {
    id: nextComboId('tac'),
    title: tpl.title,
    category: tpl.category,
    kind: 'tactic',
    baseScore: 0,
    tags: tpl.effect.kind === 'neighbor_debuff' || tpl.effect.kind === 'curse_opponent_deck' ? ['chaos'] : ['social'],
    effect: { ...tpl.effect },
  };
}

export function buildComboDeck(
  packs: PackId[],
  enableAdultContent: boolean,
  adultIntensity: AdultIntensity,
  deckSize = 22
): ComboCard[] {
  const merged = mergePacks(packs, enableAdultContent, adultIntensity);
  const cards: ComboCard[] = [];

  // ~20% tactic cards, ~80% trait-based build cards
  const tacticCount = Math.max(3, Math.round(deckSize * 0.22));
  const buildCount = Math.max(8, deckSize - tacticCount);

  for (let i = 0; i < buildCount; i++) {
    const category = BUILD_CATEGORIES[i % BUILD_CATEGORIES.length];
    const pool = merged.traits[category];
    const rawValue = pool.length > 0 ? pickRandom(pool) : 'Универсальный навык выживания';
    const scored = scoreTraitCard(category, rawValue);
    // Normalize base score into playable Balatro-style range (2..16)
    const normalizedScore = Math.max(-2, Math.min(18, scored.score + 4));

    let effect: ComboCardEffect | undefined;
    const matchingSynergy = BUILD_SYNERGY_EFFECTS.find((s) =>
      s.matchTags.some((t) => scored.tags.includes(t))
    );
    if (matchingSynergy && Math.random() < 0.55) {
      effect = { ...matchingSynergy.effect };
    }

    cards.push({
      id: nextComboId('bld'),
      title: rawValue,
      category,
      kind: 'build',
      baseScore: normalizedScore,
      tags: scored.tags.length > 0 ? scored.tags : ['survival'],
      effect,
    });
  }

  for (let i = 0; i < tacticCount; i++) {
    cards.push(createTacticCard(i));
  }

  return shuffleCards(cards);
}
