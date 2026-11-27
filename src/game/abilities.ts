import { TraitAbilityInfo, TraitCategory } from './types';

const HEAL_KEYWORDS = [
  'хирург',
  'ветеринар',
  'фармацевт',
  'стоматолог',
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
  'вор-тень',
  'варвар',
  'ведьмак',
  'разведчик',
];

const REPAIR_KEYWORDS = [
  'инженер',
  'механик',
  'электрик',
  'сантехник',
  'строитель',
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
  'следопыт',
  'программист',
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
      description: 'Улучшает состояние здоровья выбранного игрока (1 раз за игру).',
      needsTargetPlayer: true,
    };
  }

  if (HARM_KEYWORDS.some((kw) => lower.includes(kw))) {
    return {
      kind: 'harm',
      title: 'Ранить игрока',
      description: 'Ухудшает здоровье выбранного игрока из-за стычки (1 раз за игру).',
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
