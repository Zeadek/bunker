import { TraitAbilityInfo, TraitAbilityKind, TraitCategory } from './types';

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
  'знахарк',
  'нарколог',
  'аптечк',
  'медицинский чемодан',
  'зелья лечения',
  'зелье лечения',
  'обезболива',
  'морфи',
  'донорск',
  'переливан',
  'зашивать',
  'накладывать гипс',
  'накладывать швы',
  'эликсира бодрости',
];

const HARM_KEYWORDS = [
  'кинжал',
  'винтовк',
  'лук',
  'посох огня',
  'топор',
  'лом и кувалд',
  'метательные ножи',
  'арбалет',
  'ассасин',
  'варвар',
  'ведьмак',
  'разведчик',
  'телохранитель',
  'палач',
  'головорез',
  'наёмник',
  'тесак',
  'бензопила',
  'бензорез',
  'гарпун',
  'перцов',
  'электрошокер',
  'кастет',
  'опасная бритва',
  'скальпель',
  'плётк',
  'метание ножей',
  'огненного шара',
  'бильярдным кием',
];

const INFECT_KEYWORDS = [
  'вирусолог',
  'микробиолог',
  'некромант',
  'тёмный жрец',
  'отравитель',
  'ядом василиска',
  'ядовитых грибов',
  'формалин',
  'взрыв трупа',
  'кислот',
  'ядах и травах',
  'пробирк',
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
  'сапёр',
  'сварк',
  'дезинсектор',
  'пожарный',
  '3d-принтер',
  'ремонт старой техники',
];

const REVEAL_BUNKER_KEYWORDS = [
  'архитектор',
  'геолог',
  'картограф',
  'стройке именно этого бункера',
  'схему скрытых труб',
  'ключ-вездеход',
  'карта секретных убежищ',
  'тайную карту туннелей',
  'тайный подземный ход',
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
  'судмедэксперт',
  'патологоанатом',
  'коллектор',
  'психиатр',
  'зеркало связи',
  'чтение людей',
  'подслушива',
  'пытать вопросами',
  'компромат',
  'кольцо телепатии',
  'чтения самых грязных мыслей',
  'папка с личными делами',
];

const STEAL_POCKET_KEYWORDS = [
  'вор',
  'карманник',
  'контрабандист',
  'отмычк',
  'локпикинг',
  'вскрытие сейфов',
  'грабёж',
  'стилет',
];

const CALM_PHOBIA_KEYWORDS = [
  'психотерапевт',
  'психоаналитик',
  'сексопатолог',
  'бард',
  'гитара',
  'лютня',
  'успокоения людей',
  'флейта',
  'йога',
  'абсент',
  'благовон',
  'антидепрес',
];

const ERASE_FIELD_KEYWORDS = [
  'юрист',
  'кризис-менеджер',
  'чистильщик мест преступлений',
  'подделывать подписи',
  'чужой паспорт',
  'инквизитор',
  'известь и 50 чёрных',
  'танатопрактик',
  'могильщик',
];

const CRAFT_BONUS_KEYWORDS = [
  'повар',
  'трактирщик',
  'пивоварение',
  'самогоноварен',
  'швея',
  'котёл для зелий',
  'теплица',
  'кулинария',
  'гидропоника',
  'агроном',
  'резьба по дереву',
  'самодельные фильтры',
];

const BOOST_VOTE_KEYWORDS = [
  'блогер',
  'менеджер по продажам',
  'переговорщик',
  'лидер',
  'стендап',
  'менестрель',
  'стриптизёр',
  'доминатор',
  'казино и борделя',
  'переспал с начальником',
  'торговец редкостями',
  'куртизанка',
];

const SILENCE_VOTE_KEYWORDS = [
  'кляп',
  'наручники',
  'кандалы',
  'сонный порошок',
  'снотворн',
  'проклятие немоты',
  'скотч и хомут',
  'транквилизатор',
  'стяжек',
];

const PROTECT_KEYWORDS = [
  'бронежилет',
  'щит',
  'амулет защиты',
  'освящён',
  'гварди',
  'камень ордена',
  'невосприимчив',
  'вытатуирован код',
];

const MUTATE_HEALTH_KEYWORDS = [
  'дозиметр',
  'экспериментальных зелий',
  'дикая магия',
  'проклятых безделушек',
  'коктейлей из аптечки',
  'приворотн',
  'ликантроп',
  'виверн',
];

const ABILITY_ELIGIBLE_CATEGORIES: TraitCategory[] = [
  'profession',
  'hobby',
  'gear',
  'pocket',
  'fact',
  'extra',
];

const ABILITY_BADGES: Record<TraitAbilityKind, string> = {
  heal: '⚡ Лечение',
  harm: '⚡ Атака',
  infect: '☣️ Заражение',
  repair_bunker: '🔧 Ремонт',
  reveal_bunker: '🗺️ Бункер',
  scout: '🔍 Разведка',
  steal_pocket: '🦝 Кража',
  calm_phobia: '🕊️ Терапия',
  erase_field: '✂️ Зачистка',
  craft_bonus: '🛠️ Крафт',
  boost_vote: '📢 Авторитет',
  silence_vote: '🤐 Кляп',
  protect: '🛡️ Защита',
  mutate_health: '🧬 Мутация',
};

export function getTraitAbility(
  category: TraitCategory,
  value: string
): TraitAbilityInfo | null {
  if (!ABILITY_ELIGIBLE_CATEGORIES.includes(category)) {
    return null;
  }

  const lower = value.toLowerCase();

  if (HEAL_KEYWORDS.some((kw) => lower.includes(kw))) {
    return {
      kind: 'heal',
      title: 'Вылечить игрока',
      description: 'Снижает стадию болезни/ранения на 1 шаг (1 раз за игру).',
      needsTargetPlayer: true,
      canTargetSelf: true,
    };
  }

  if (INFECT_KEYWORDS.some((kw) => lower.includes(kw))) {
    return {
      kind: 'infect',
      title: 'Заразить игрока',
      description: 'Подбрасывает недуг здоровому или усиливает болезнь цели (1 раз за игру).',
      needsTargetPlayer: true,
      canTargetSelf: false,
    };
  }

  if (HARM_KEYWORDS.some((kw) => lower.includes(kw))) {
    return {
      kind: 'harm',
      title: 'Ранить игрока',
      description: 'Наносит ранение или усиливает стадию недуга на 1 шаг (1 раз за игру).',
      needsTargetPlayer: true,
      canTargetSelf: false,
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

  if (REVEAL_BUNKER_KEYWORDS.some((kw) => lower.includes(kw))) {
    return {
      kind: 'reveal_bunker',
      title: 'Разведать бункер',
      description: 'Открывает одну скрытую карту особенности или угрозы бункера (1 раз за игру).',
      needsTargetPlayer: false,
    };
  }

  if (SCOUT_KEYWORDS.some((kw) => lower.includes(kw))) {
    return {
      kind: 'scout',
      title: 'Разведка досье',
      description: 'Вскрывает случайную скрытую характеристику выбранного игрока (1 раз за игру).',
      needsTargetPlayer: true,
      canTargetSelf: false,
    };
  }

  if (STEAL_POCKET_KEYWORDS.some((kw) => lower.includes(kw))) {
    return {
      kind: 'steal_pocket',
      title: 'Карманная кража',
      description: 'Забирает мелкий инвентарь цели себе как бонусный трофей (1 раз за игру).',
      needsTargetPlayer: true,
      canTargetSelf: false,
    };
  }

  if (CALM_PHOBIA_KEYWORDS.some((kw) => lower.includes(kw))) {
    return {
      kind: 'calm_phobia',
      title: 'Успокоить фобию',
      description: 'Избавляет выбранного игрока (или себя) от фобии (1 раз за игру).',
      needsTargetPlayer: true,
      canTargetSelf: true,
    };
  }

  if (ERASE_FIELD_KEYWORDS.some((kw) => lower.includes(kw))) {
    return {
      kind: 'erase_field',
      title: 'Стереть характеристику',
      description: 'Удаляет выбранную характеристику у цели или у себя (1 раз за игру).',
      needsTargetPlayer: true,
      canTargetSelf: true,
      needsTraitCategory: true,
    };
  }

  if (CRAFT_BONUS_KEYWORDS.some((kw) => lower.includes(kw))) {
    return {
      kind: 'craft_bonus',
      title: 'Создать припас',
      description: 'Добавляет игроку (или себе) полезное дополнительное поле (1 раз за игру).',
      needsTargetPlayer: true,
      canTargetSelf: true,
    };
  }

  if (BOOST_VOTE_KEYWORDS.some((kw) => lower.includes(kw))) {
    return {
      kind: 'boost_vote',
      title: 'Усилить голос',
      description: 'Добавляет +1 к весу голоса выбранного игрока на голосовании (1 раз за игру).',
      needsTargetPlayer: true,
      canTargetSelf: true,
    };
  }

  if (SILENCE_VOTE_KEYWORDS.some((kw) => lower.includes(kw))) {
    return {
      kind: 'silence_vote',
      title: 'Лишить голоса',
      description: 'Затыкает выбранного игрока на ближайшем голосовании (1 раз за игру).',
      needsTargetPlayer: true,
      canTargetSelf: false,
    };
  }

  if (PROTECT_KEYWORDS.some((kw) => lower.includes(kw))) {
    return {
      kind: 'protect',
      title: 'Прикрытие',
      description: 'Даёт неприкосновенность от изгнания в этом раунде (1 раз за игру).',
      needsTargetPlayer: true,
      canTargetSelf: true,
    };
  }

  if (MUTATE_HEALTH_KEYWORDS.some((kw) => lower.includes(kw))) {
    return {
      kind: 'mutate_health',
      title: 'Мутация здоровья',
      description: 'Непредсказуемо перебрасывает карту здоровья цели (1 раз за игру).',
      needsTargetPlayer: true,
      canTargetSelf: true,
    };
  }

  return null;
}

export function getAbilityShortBadge(category: TraitCategory, value: string): string | null {
  const info = getTraitAbility(category, value);
  if (!info) return null;
  return ABILITY_BADGES[info.kind];
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
