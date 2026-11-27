import { SpecialCard, SpecialCardType } from './types';

export const SPECIAL_CARD_TEMPLATES: Array<Omit<SpecialCard, 'id' | 'used'>> = [
  {
    type: 'heal',
    title: 'Чудо-вакцина',
    description: 'Полностью излечивает здоровье выбранного игрока (или себя) до идеального состояния.',
    needsTargetPlayer: true,
    allowSelfTarget: true,
  },
  {
    type: 'harm_virus',
    title: 'Разбитая пробирка',
    description: 'Подбрасывает выбранному игроку случайную заразу или усиливает его недуг на 1 стадию.',
    needsTargetPlayer: true,
    allowSelfTarget: false,
  },
  {
    type: 'swap_trait',
    title: 'Рокировка',
    description: 'Обменяйтесь выбранной категорией характеристик с другим живым игроком.',
    needsTargetPlayer: true,
    allowSelfTarget: false,
    needsTraitCategory: true,
  },
  {
    type: 'steal_gear',
    title: 'Экспроприация',
    description: 'Отнимает крупный багаж у выбранного игрока и добавляет вам как дополнительный слот «Трофей».',
    needsTargetPlayer: true,
    allowSelfTarget: false,
  },
  {
    type: 'reroll_profession',
    title: 'Переквалификация',
    description: 'Заменяет вашу профессию на новую случайную из выбранных наборов.',
  },
  {
    type: 'reroll_target_trait',
    title: 'Пендель судьбы',
    description: 'Принудительно переролливает выбранную характеристику указанного игрока (или свою).',
    needsTargetPlayer: true,
    allowSelfTarget: true,
    needsTraitCategory: true,
  },
  {
    type: 'reroll_all_health',
    title: 'Тотальный медосмотр',
    description: 'Заново перебрасывает карты Здоровья ВСЕМ живым участникам бункера!',
  },
  {
    type: 'force_reveal',
    title: 'Допрос с пристрастием',
    description: 'Заставляет выбранного игрока немедленно вскрыть указанную характеристику.',
    needsTargetPlayer: true,
    allowSelfTarget: false,
    needsTraitCategory: true,
  },
  {
    type: 'double_vote',
    title: 'Двойной голос',
    description: 'Вес вашего голоса на ближайшем голосовании увеличивается на +1.',
  },
  {
    type: 'silence_vote',
    title: 'Кляп и скотч',
    description: 'Лишает выбранного игрока права голоса на ближайшем голосовании.',
    needsTargetPlayer: true,
    allowSelfTarget: false,
  },
  {
    type: 'immunity',
    title: 'Неприкосновенность',
    description: 'Защищает выбранного игрока (или себя) от изгнания в этом раунде.',
    needsTargetPlayer: true,
    allowSelfTarget: true,
  },
  {
    type: 'banish_add_kick',
    title: 'Охота на ведьм (+1)',
    description: 'В текущем раунде из бункера придётся выгнать на 1 человека больше!',
  },
  {
    type: 'skip_round_kick',
    title: 'Вето коменданта',
    description: 'Отменяет изгнание в текущем раунде — все временно остаются в бункере.',
  },
  {
    type: 'reroll_luggage',
    title: 'Заначка',
    description: 'Заменяет ваш крупный багаж на новый случайный предмет из колоды.',
  },
  {
    type: 'reveal_bunker',
    title: 'Разведка отсека',
    description: 'Немедленно открывает одну скрытую карту особенности или угрозы бункера.',
  },
  {
    type: 'sabotage_bunker',
    title: 'Случайная диверсия',
    description: 'Подбрасывает новую открытую угрозу бункера из колоды — пусть инженеры попотеют!',
  },
  {
    type: 'add_bonus_trait',
    title: 'Тайный козырь (+поле)',
    description: 'Добавляет выбранному игроку (или себе) новое дополнительное поле со случайным фактом или предметом.',
    needsTargetPlayer: true,
    allowSelfTarget: true,
  },
  {
    type: 'remove_trait',
    title: 'Шредер досье (-поле)',
    description: 'Безвозвратно удаляет указанную характеристику у выбранного игрока или у себя!',
    needsTargetPlayer: true,
    allowSelfTarget: true,
    needsTraitCategory: true,
  },
  {
    type: 'clone_trait',
    title: 'Наглый плагиат',
    description: 'Копирует уже вскрытую характеристику выбранного игрока и ставит её вам.',
    needsTargetPlayer: true,
    allowSelfTarget: false,
    needsTraitCategory: true,
  },
  {
    type: 'cursed_truth',
    title: 'Сыворотка пьяной правды',
    description: '18+: Вскрывает до 2 скрытых карт цели И добавляет ей жёсткий компромат в доп. поле!',
    isAdult: true,
    needsTargetPlayer: true,
    allowSelfTarget: false,
  },
  {
    type: 'russian_roulette',
    title: 'Русская рулетка',
    description: '18+: 50% шанс получить неприкосновенность на раунд или 50% шанс прострелить себе колено.',
    isAdult: true,
  },
  {
    type: 'bribe_bunker',
    title: 'Грязный шантаж',
    description: '18+: Отнимает голос у выбранного игрока и передаёт его в вес вашего голоса!',
    isAdult: true,
    needsTargetPlayer: true,
    allowSelfTarget: false,
  },
];

export function createSpecialCard(type: SpecialCardType, id: string): SpecialCard {
  const tpl = SPECIAL_CARD_TEMPLATES.find((t) => t.type === type) ?? SPECIAL_CARD_TEMPLATES[0];
  return { ...tpl, id, used: false };
}
