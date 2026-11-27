import { describe, expect, it } from 'vitest';
import {
  ALL_PACKS,
  EXPERTISE_LEVELS,
  createSpecialCard,
  getSpecialCardPool,
  mergePacks,
} from './data';
import { GameState } from './types';
import {
  SKIP_VOTE_ID,
  addBotPlayer,
  addOrReconnectPlayer,
  castVote,
  computeKicksSchedule,
  createInitialState,
  evaluateBunkerSurvival,
  getPlayerView,
  hostRerollPlayerTrait,
  hostUpdatePlayerTrait,
  proceedAfterRoundResult,
  removeBotPlayer,
  revealBonusTrait,
  revealTrait,
  runBotTurn,
  startGame,
  startRevealPhase,
  startVotingPhase,
  useSpecialCard,
  useTraitAbility,
} from './engine';
import { scorePlayer, scoreTraitCard } from './scoring';

describe('Bunker game engine', () => {
  it('computes kicks schedule matching playerCount - capacity', () => {
    expect(computeKicksSchedule(6, 3).reduce((a, b) => a + b, 0)).toBe(3);
    expect(computeKicksSchedule(10, 5).reduce((a, b) => a + b, 0)).toBe(5);
    expect(computeKicksSchedule(4, 2).reduce((a, b) => a + b, 0)).toBe(2);
  });

  it('sanitizes hidden traits in getPlayerView', () => {
    let state = createInitialState('TEST1', 'p1', 'Алиса');
    state = addOrReconnectPlayer(state, 'p2', 'Боб').state;
    state = addOrReconnectPlayer(state, 'p3', 'Вика').state;
    state = addOrReconnectPlayer(state, 'p4', 'Глеб').state;

    const started = startGame(state);
    expect(started.error).toBeUndefined();
    state = started.state;

    const viewForP1 = getPlayerView(state, 'p1');
    expect(viewForP1.me?.traits.profession.value).not.toBe('—');
    const bobPublic = viewForP1.players.find((p) => p.id === 'p2');
    expect(bobPublic?.revealedTraits.profession).toBeUndefined();
  });

  it('runs a full round with reveal, discussion, voting, and exile', () => {
    let state = createInitialState('TEST2', 'p1', 'Хост');
    state = addOrReconnectPlayer(state, 'p2', 'Игрок 2').state;
    state = addOrReconnectPlayer(state, 'p3', 'Игрок 3').state;
    state = addOrReconnectPlayer(state, 'p4', 'Игрок 4').state;
    state = startGame(state).state;
    state = startRevealPhase(state);

    for (let i = 0; i < 4; i++) {
      const currentId = state.turnOrder[state.currentTurnIndex];
      const res = revealTrait(state, currentId, 'profession');
      expect(res.error).toBeUndefined();
      state = res.state;
    }

    expect(state.phase).toBe('discussion');
    state = startVotingPhase(state);
    expect(state.phase).toBe('round_result');

    state = proceedAfterRoundResult(state, true);
    expect(state.round).toBe(2);
    expect(state.phase).toBe('reveal');

    for (let i = 0; i < 4; i++) {
      const currentId = state.turnOrder[state.currentTurnIndex];
      state = revealTrait(state, currentId, 'health').state;
    }
    expect(state.phase).toBe('discussion');

    state = startVotingPhase(state);
    expect(state.phase).toBe('voting');

    state = castVote(state, 'p1', 'p4').state;
    state = castVote(state, 'p2', 'p4').state;
    state = castVote(state, 'p3', 'p4').state;
    state = castVote(state, 'p4', 'p1').state;

    expect(state.phase).toBe('round_result');
    expect(state.lastRoundResult?.exiledIds).toEqual(['p4']);
    expect(state.players.find((p) => p.id === 'p4')?.alive).toBe(false);
  });

  it('supports solo start, fantasy pack, expertise, and biology rolls', () => {
    const merged = mergePacks(['classic', 'fantasy']);
    expect(merged.catastrophes.length).toBe(
      ALL_PACKS.classic.catastrophes.length + ALL_PACKS.fantasy.catastrophes.length
    );

    let state = createInitialState('SOLO1', 'p1', 'Маг');
    state = { ...state, settings: { ...state.settings, packs: ['fantasy'] } };
    const started = startGame(state);
    expect(started.error).toBeUndefined();

    const p1 = started.state.players[0];
    expect(EXPERTISE_LEVELS.some((lvl) => p1.traits.profession.value.includes(lvl))).toBe(true);
    expect(p1.traits.biology.value).toMatch(/\d+ лет/);
    expect(p1.traits.biology.value).toMatch(/(плодовит|бесплод|беременна)/);
  });

  it('supports staged heal/harm, prevents healing healthy, and supports skip vote', () => {
    let state = createInitialState('ABIL1', 'p1', 'Хост');
    state = addOrReconnectPlayer(state, 'p2', 'Ассасин').state;
    state = addOrReconnectPlayer(state, 'p3', 'Медик').state;
    state = startGame(state).state;

    state = hostUpdatePlayerTrait(state, 'p1', 'health', 'Полностью здоров', false);
    state = hostUpdatePlayerTrait(state, 'p2', 'pocket', 'Отравленный кинжал ассасина', false);
    state = hostUpdatePlayerTrait(state, 'p3', 'profession', 'Хирург-травматолог (Опытный)', false);

    // Cannot heal healthy player
    const failHeal = useTraitAbility(state, 'p3', 'profession', 'p1');
    expect(failHeal.error).toBeDefined();

    // p2 harms healthy p1 -> Лёгкая стадия
    const harmed = useTraitAbility(state, 'p2', 'pocket', 'p1');
    expect(harmed.error).toBeUndefined();
    expect(harmed.state.players[0].traits.health.value).toContain('Лёгкая стадия');

    // p3 heals p1 from Лёгкая стадия -> Полностью здоров
    const healed = useTraitAbility(harmed.state, 'p3', 'profession', 'p1');
    expect(healed.error).toBeUndefined();
    expect(healed.state.players[0].traits.health.value).toBe('Полностью здоров');

    // Host blind reroll changes value
    const beforeExtra = healed.state.players[1].traits.extra.value;
    const rerolled = hostRerollPlayerTrait(healed.state, 'p2', 'extra');
    expect(rerolled.players[1].traits.extra.value).not.toBe(beforeExtra);

    // Skip vote
    let voteState: GameState = { ...rerolled, round: 2, phase: 'voting', kicksPerRound: [0, 1] };
    voteState = castVote(voteState, 'p1', SKIP_VOTE_ID).state;
    voteState = castVote(voteState, 'p2', SKIP_VOTE_ID).state;
    voteState = castVote(voteState, 'p3', 'p2').state;
    expect(voteState.phase).toBe('round_result');
    expect(voteState.lastRoundResult?.exiledIds).toEqual([]);
  });

  it('filters 18+ content by enableAdultContent in packs and special cards', () => {
    const safeMerged = mergePacks(['classic'], false);
    const adultMerged = mergePacks(['classic'], true);

    expect(safeMerged.catastrophes.some((c) => c.isAdult)).toBe(false);
    expect(adultMerged.catastrophes.some((c) => c.isAdult)).toBe(true);
    expect(adultMerged.traits.profession.length).toBeGreaterThan(safeMerged.traits.profession.length);

    const safeSpecials = getSpecialCardPool(false);
    const adultSpecials = getSpecialCardPool(true);
    expect(safeSpecials.some((s) => s.isAdult)).toBe(false);
    expect(adultSpecials.some((s) => s.isAdult)).toBe(true);
    expect(adultSpecials.length).toBe(28);

    const onlyAdultMerged = mergePacks(['classic'], true, 'only');
    expect(onlyAdultMerged.catastrophes.every((c) => c.isAdult)).toBe(true);
    const onlyAdultSpecials = getSpecialCardPool(true, 'only');
    expect(onlyAdultSpecials.every((s) => s.isAdult)).toBe(true);
    expect(onlyAdultSpecials.length).toBe(6);

    const highAdultSpecials = getSpecialCardPool(true, 'high');
    expect(highAdultSpecials.length).toBeGreaterThan(adultSpecials.length);
  });

  it('supports enabledTraits, customFields, bonusTraits, revealBonusTrait, and specialCardsPerPlayer', () => {
    let state = createInitialState('CUST1', 'p1', 'Хост');
    state = addOrReconnectPlayer(state, 'p2', 'Игрок 2').state;
    state = {
      ...state,
      settings: {
        ...state.settings,
        specialCardsPerPlayer: 3,
        enabledTraits: ['profession', 'health', 'gear', 'pocket'],
        customFields: [{ id: 'cf-1', label: 'Тату', pool: ['Дракон на плече'] }],
      },
    };

    const started = startGame(state);
    expect(started.error).toBeUndefined();
    state = started.state;

    const p1 = state.players.find((p) => p.id === 'p1')!;
    expect(p1.specialCards.length).toBe(3);
    expect(p1.traits.phobia.removed).toBe(true);
    expect(p1.bonusTraits.length).toBe(1);
    expect(p1.bonusTraits[0].label).toBe('Тату');
    expect(p1.bonusTraits[0].value).toBe('Дракон на плече');
    expect(p1.bonusTraits[0].revealed).toBe(false);

    // Disabled field cannot be revealed
    state = startRevealPhase(state);
    const currentId = state.turnOrder[state.currentTurnIndex];
    const failDisabled = revealTrait(state, currentId, 'phobia');
    expect(failDisabled.error).toBeDefined();

    // Bonus trait is hidden from others until revealed
    const beforeView = getPlayerView(state, 'p2');
    expect(beforeView.players.find((p) => p.id === 'p1')?.revealedBonusTraits).toEqual([]);
    expect(beforeView.players.find((p) => p.id === 'p1')?.removedCategories).toContain('phobia');

    const revealedBonus = revealBonusTrait(state, 'p1', p1.bonusTraits[0].id);
    expect(revealedBonus.error).toBeUndefined();
    const afterView = getPlayerView(revealedBonus.state, 'p2');
    expect(afterView.players.find((p) => p.id === 'p1')?.revealedBonusTraits).toHaveLength(1);
  });

  it('supports erase_field, steal_pocket, calm_phobia, and remove_trait', () => {
    let state = createInitialState('ABIL2', 'p1', 'Юрист');
    state = addOrReconnectPlayer(state, 'p2', 'Вор').state;
    state = addOrReconnectPlayer(state, 'p3', 'Бард').state;
    state = startGame(state).state;

    state = hostUpdatePlayerTrait(state, 'p1', 'profession', 'Юрист по корпоративному праву (Мастер)', false);
    state = hostUpdatePlayerTrait(state, 'p2', 'profession', 'Вор-тень (Опытный)', false);
    state = hostUpdatePlayerTrait(state, 'p2', 'pocket', 'Набор отмычек', false);
    state = hostUpdatePlayerTrait(state, 'p3', 'profession', 'Бард-сказитель (Эксперт)', false);
    state = hostUpdatePlayerTrait(state, 'p3', 'phobia', 'Клаустрофобия', false);

    // steal_pocket: p2 steals p1's pocket
    const p1Pocket = state.players[0].traits.pocket.value;
    const stolen = useTraitAbility(state, 'p2', 'profession', 'p1');
    expect(stolen.error).toBeUndefined();
    expect(stolen.state.players[0].traits.pocket.removed).toBe(true);
    expect(stolen.state.players[1].bonusTraits.some((b) => b.value === p1Pocket)).toBe(true);

    // erase_field: p1 erases p2's gear
    const erased = useTraitAbility(stolen.state, 'p1', 'profession', 'p2', 'gear');
    expect(erased.error).toBeUndefined();
    expect(erased.state.players[1].traits.gear.removed).toBe(true);
    const p1View = getPlayerView(erased.state, 'p1');
    expect(p1View.players.find((p) => p.id === 'p2')?.removedCategories).toContain('gear');

    // calm_phobia: p3 calms own phobia
    const calmed = useTraitAbility(erased.state, 'p3', 'profession', 'p3');
    expect(calmed.error).toBeUndefined();
    expect(calmed.state.players[2].traits.phobia.value).toContain('Успокоена');

    // remove_trait special card
    const card = createSpecialCard('remove_trait', 'sc-rem');
    let cardState: GameState = {
      ...calmed.state,
      players: calmed.state.players.map((p) =>
        p.id === 'p1' ? { ...p, specialCards: [card] } : p
      ),
    };
    const removedRes = useSpecialCard(cardState, 'p1', 'sc-rem', 'p3', 'hobby');
    expect(removedRes.error).toBeUndefined();
    expect(removedRes.state.players[2].traits.hobby.removed).toBe(true);
  });

  it('supports silence_vote / bribe_bunker, sabotage_bunker, and clone_trait', () => {
    let state = createInitialState('SPEC1', 'p1', 'Алиса');
    state = addOrReconnectPlayer(state, 'p2', 'Боб').state;
    state = addOrReconnectPlayer(state, 'p3', 'Вика').state;
    state = startGame(state).state;

    const bribe = createSpecialCard('bribe_bunker', 'sc-bribe');
    const sabotage = createSpecialCard('sabotage_bunker', 'sc-sab');
    const clone = createSpecialCard('clone_trait', 'sc-clone');

    state = {
      ...state,
      round: 2,
      kicksPerRound: [0, 1],
      players: state.players.map((p) =>
        p.id === 'p1' ? { ...p, specialCards: [bribe, sabotage, clone] } : p
      ),
    };

    // sabotage_bunker adds a revealed threat
    const beforeCards = state.bunker!.cards.length;
    const sabRes = useSpecialCard(state, 'p1', 'sc-sab');
    expect(sabRes.error).toBeUndefined();
    expect(sabRes.state.bunker!.cards.length).toBe(beforeCards + 1);
    expect(sabRes.state.bunker!.cards[beforeCards].isThreat).toBe(true);
    expect(sabRes.state.bunker!.cards[beforeCards].revealed).toBe(true);

    // clone_trait copies revealed trait from p2
    const withRevealedP2 = hostUpdatePlayerTrait(sabRes.state, 'p2', 'fact', 'Тайный агент', true);
    const cloneRes = useSpecialCard(withRevealedP2, 'p1', 'sc-clone', 'p2', 'fact');
    expect(cloneRes.error).toBeUndefined();
    expect(cloneRes.state.players[0].traits.fact.value).toBe('Тайный агент');

    // bribe_bunker silences p2 and boosts p1 voteWeight
    const bribeRes = useSpecialCard(cloneRes.state, 'p1', 'sc-bribe', 'p2');
    expect(bribeRes.error).toBeUndefined();
    expect(bribeRes.state.players[1].voteWeight).toBe(0);
    expect(bribeRes.state.players[0].voteWeight).toBe(2);

    const view = getPlayerView(bribeRes.state, 'p1');
    expect(view.players.find((p) => p.id === 'p2')?.silenced).toBe(true);

    // Voting rejects silenced player and auto-resolves with remaining voters
    let voteState = startVotingPhase(bribeRes.state);
    const silencedVote = castVote(voteState, 'p2', 'p1');
    expect(silencedVote.error).toBeDefined();

    voteState = castVote(voteState, 'p1', 'p3').state;
    voteState = castVote(voteState, 'p3', 'p2').state;
    expect(voteState.phase).toBe('round_result');
    expect(voteState.lastRoundResult?.exiledIds).toEqual(['p3']);
  });

  it('keeps votes secret during voting and reveals voteDetails in round_result', () => {
    let state = createInitialState('VOTE1', 'p1', 'Алиса');
    state = addOrReconnectPlayer(state, 'p2', 'Боб').state;
    state = addOrReconnectPlayer(state, 'p3', 'Вика').state;
    state = startGame(state).state;
    state = { ...state, round: 2, kicksPerRound: [0, 1] };
    state = startVotingPhase(state);

    // p1 votes for p3; p2 hasn't voted yet
    state = castVote(state, 'p1', 'p3').state;
    const viewForP2 = getPlayerView(state, 'p2');
    expect(viewForP2.phase).toBe('voting');
    expect(viewForP2.votedPlayerIds).toEqual(['p1']);
    expect(viewForP2.myVote).toBeNull();
    expect(viewForP2.lastRoundResult).toBeNull();

    // Remaining votes complete voting -> round_result has full voteDetails
    state = castVote(state, 'p2', 'p3').state;
    state = castVote(state, 'p3', SKIP_VOTE_ID).state;
    expect(state.phase).toBe('round_result');

    const resultView = getPlayerView(state, 'p2');
    expect(resultView.lastRoundResult?.voteDetails).toEqual([
      { voterId: 'p1', voterName: 'Алиса', targetId: 'p3', targetName: 'Вика', weight: 1 },
      { voterId: 'p2', voterName: 'Боб', targetId: 'p3', targetName: 'Вика', weight: 1 },
      { voterId: 'p3', voterName: 'Вика', targetId: SKIP_VOTE_ID, targetName: 'Скипнуть раунд', weight: 1 },
    ]);
  });

  it('evaluates bunker survival verdict based on threats, catastrophe, and survivor skills', () => {
    const strongView = {
      catastrophe: {
        id: 'nuclear',
        title: 'Ядерная зима',
        description: 'Радиация и мороз на поверхности.',
        duration: '3 года',
        survivalRate: '12%',
      },
      bunker: {
        title: 'Советский объект ГО-42',
        location: 'В толще гранитной скалы',
        layoutNote: 'Толстые гермодвери и длинный коридор.',
        areaSqm: 140,
        capacity: 2,
        supplies: 'Консервы на 100% срока',
        rooms: [
          { id: 'r1', name: 'Генераторная', status: 'ok' as const, effect: 'Даёт энергию.' },
          { id: 'r2', name: 'Медблок', status: 'ok' as const, effect: 'Лечит раненых.' },
        ],
        stats: { energy: 75, supplies: 80, defense: 70, morale: 75 },
        cards: [
          {
            id: 'b1',
            title: 'Гидропонная ферма',
            description: 'Выращивание зелени.',
            isThreat: false,
            revealed: true,
          },
          {
            id: 'b2',
            title: 'Утечка в системе вентиляции',
            description: 'Нужен инженер.',
            isThreat: true,
            revealed: true,
          },
        ],
      },
      players: [
        {
          id: 'p1',
          name: 'Алиса',
          isHost: true,
          connected: true,
          alive: true,
          revealedTraits: {
            profession: 'Инженер-энергетик (Мастер)',
            biology: 'Женщина, 28 лет (плодовитая)',
            health: 'Полностью здоров',
          },
          revealedBonusTraits: [],
          removedCategories: [],
          revealedCount: 3,
          revealedThisRound: true,
          hasImmunity: false,
          silenced: false,
        },
        {
          id: 'p2',
          name: 'Боб',
          isHost: false,
          connected: true,
          alive: true,
          revealedTraits: {
            profession: 'Хирург-травматолог (Эксперт)',
            biology: 'Мужчина, 32 года (плодовитый)',
            health: 'Полностью здоров',
          },
          revealedBonusTraits: [],
          removedCategories: [],
          revealedCount: 3,
          revealedThisRound: true,
          hasImmunity: false,
          silenced: false,
        },
      ],
    };

    const strongEval = evaluateBunkerSurvival(strongView);
    expect(strongEval.status).toBe('survived');
    expect(strongEval.title).toBe('Бункер выстоял');
    expect(strongEval.unresolvedIssues).toEqual([]);
    expect(strongEval.score).toBeGreaterThanOrEqual(75);

    const weakView = {
      ...strongView,
      bunker: {
        ...strongView.bunker,
        supplies: 'Острый дефицит воды и еды',
        rooms: [
          { id: 'r1', name: 'Генераторная', status: 'damaged' as const, effect: 'Даёт энергию.' },
          { id: 'r2', name: 'Шлюз', status: 'locked' as const, effect: 'Оборона.' },
        ],
        stats: { energy: 25, supplies: 20, defense: 30, morale: 30 },
        cards: [
          {
            id: 'b2',
            title: 'Утечка в системе вентиляции',
            description: 'Нужен инженер.',
            isThreat: true,
            revealed: true,
          },
          {
            id: 'b3',
            title: 'Нашествие мутировавших крыс',
            description: 'Нужна борьба с вредителями.',
            isThreat: true,
            revealed: true,
          },
        ],
      },
      players: [
        {
          ...strongView.players[0],
          revealedTraits: {
            profession: 'Менеджер по продажам (Новичок)',
            biology: 'Женщина, 50 лет (бесплодна)',
            health: 'Пневмония [Тяжёлая стадия]',
          },
        },
        {
          ...strongView.players[1],
          revealedTraits: {
            profession: 'Стендап-комик (Любитель)',
            biology: 'Мужчина, 52 года (бесплоден)',
            health: 'Язва желудка [Тяжёлая стадия]',
          },
        },
      ],
    };

    const weakEval = evaluateBunkerSurvival(weakView);
    expect(weakEval.status).toBe('fallen');
    expect(weakEval.title).toBe('Бункер пал');
    expect(weakEval.unresolvedIssues.length).toBeGreaterThanOrEqual(4);
    expect(weakEval.score).toBeLessThan(40);
  });

  it('generates rich BunkerInfo with rooms and stats, and updates them on sabotage and repair', () => {
    let state = createInitialState('BNK1', 'p1', 'Инженер');
    state = addOrReconnectPlayer(state, 'p2', 'Диверсант').state;
    state = startGame(state).state;

    const b = state.bunker!;
    expect(b.title.length).toBeGreaterThan(0);
    expect(b.location.length).toBeGreaterThan(0);
    expect(b.layoutNote.length).toBeGreaterThan(0);
    expect(b.areaSqm).toBeGreaterThanOrEqual(35);
    expect(b.areaSqm).toBeLessThanOrEqual(340);
    expect(b.rooms.length).toBeGreaterThanOrEqual(3);
    expect(b.rooms.length).toBeLessThanOrEqual(5);
    expect(b.stats.energy).toBeGreaterThanOrEqual(0);
    expect(b.stats.energy).toBeLessThanOrEqual(100);

    // Sabotage damages an ok room and reduces defense/morale
    const sabotage = createSpecialCard('sabotage_bunker', 'sc-sab2');
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === 'p2' ? { ...p, specialCards: [sabotage] } : p
      ),
    };
    const defenseBeforeSab = state.bunker!.stats.defense;
    const sabRes = useSpecialCard(state, 'p2', 'sc-sab2');
    expect(sabRes.error).toBeUndefined();
    expect(sabRes.state.bunker!.stats.defense).toBeLessThan(defenseBeforeSab);

    // Repair ability fixes a threat and/or broken room and raises stats
    state = hostUpdatePlayerTrait(sabRes.state, 'p1', 'profession', 'Инженер-энергетик (Мастер)', true);
    const brokenBefore = state.bunker!.rooms.filter((r) => r.status !== 'ok').length;
    const energyBefore = state.bunker!.stats.energy;
    const repRes = useTraitAbility(state, 'p1', 'profession');
    expect(repRes.error).toBeUndefined();
    const brokenAfter = repRes.state.bunker!.rooms.filter((r) => r.status !== 'ok').length;
    expect(brokenAfter).toBeLessThan(brokenBefore);
    expect(repRes.state.bunker!.stats.energy).toBeGreaterThan(energyBefore);
  });

  it('scores trait cards with tags and evaluates players in scoring.ts', () => {
    const surgeon = scoreTraitCard('profession', 'Хирург-травматолог (Эксперт)');
    expect(surgeon.tags).toContain('med');
    expect(surgeon.score).toBeGreaterThanOrEqual(10);

    const sick = scoreTraitCard('health', 'Пневмония [Тяжёлая стадия]');
    expect(sick.tags).toContain('liability');
    expect(sick.score).toBeLessThan(0);

    const healthy = scoreTraitCard('health', 'Полностью здоров');
    expect(healthy.tags).toContain('survival');
    expect(healthy.score).toBeGreaterThan(0);

    let state = createInitialState('SCR1', 'p1', 'Алиса');
    state = startGame(state).state;
    const fullScore = scorePlayer(state.players[0], false);
    const revealedOnlyScore = scorePlayer(state.players[0], true);
    expect(typeof fullScore).toBe('number');
    expect(revealedOnlyScore).toBe(0);
  });

  it('supports adding/removing AI bots and running bot reveal and voting turns', () => {
    let state = createInitialState('BOT1', 'p1', 'Хост');
    const b1Res = addBotPlayer(state);
    expect(b1Res.error).toBeUndefined();
    state = b1Res.state;
    state = addBotPlayer(state).state;
    state = addBotPlayer(state).state;
    expect(state.players.filter((p) => p.isBot)).toHaveLength(3);

    const removedId = state.players.find((p) => p.isBot)!.id;
    state = removeBotPlayer(state, removedId);
    expect(state.players.filter((p) => p.isBot)).toHaveLength(2);

    state = startGame(state).state;
    state = startRevealPhase(state);

    // Run turns until human p1 or discussion
    let guard = 0;
    while (state.phase === 'reveal' && guard < 10) {
      const turnId = state.turnOrder[state.currentTurnIndex];
      const turnPlayer = state.players.find((p) => p.id === turnId)!;
      if (turnPlayer.isBot) {
        const res = runBotTurn(state);
        expect(res.acted).toBe(true);
        state = res.state;
      } else {
        state = revealTrait(state, turnPlayer.id, 'profession').state;
      }
      guard++;
    }
    expect(state.phase).toBe('discussion');

    // Make p1 have terrible revealed health so bots vote against p1
    state = { ...state, round: 2, kicksPerRound: [0, 1] };
    state = hostUpdatePlayerTrait(state, 'p1', 'health', 'Пневмония [Тяжёлая стадия]', true);
    const bots = state.players.filter((p) => p.isBot);
    state = hostUpdatePlayerTrait(state, bots[0].id, 'health', 'Полностью здоров', true);
    state = hostUpdatePlayerTrait(state, bots[1].id, 'health', 'Полностью здоров', true);

    state = startVotingPhase(state);
    state = runBotTurn(state).state;
    state = runBotTurn(state).state;
    // Bots voted, p1 still needs to vote
    expect(Object.keys(state.votes)).toHaveLength(2);
  });

  it('skips round on a tie without exiling any random player, and continues until alive <= capacity', () => {
    let state = createInitialState('TIE1', 'p1', 'Алиса');
    state = addOrReconnectPlayer(state, 'p2', 'Боб').state;
    state = addOrReconnectPlayer(state, 'p3', 'Вика').state;
    state = addOrReconnectPlayer(state, 'p4', 'Глеб').state;
    state = startGame(state).state;

    // 4 players, capacity 2 -> kicksPerRound = [0, 1, 1] (never 2+ per round)
    expect(state.kicksPerRound).toEqual([0, 1, 1]);

    // Round 2 tie: p1->p2, p2->p1, p3->p4, p4->p3 (2 votes? No, 1 vote each for 4 players)
    state = { ...state, round: 2 };
    state = startVotingPhase(state);
    state = castVote(state, 'p1', 'p2').state;
    state = castVote(state, 'p2', 'p1').state;
    state = castVote(state, 'p3', 'p4').state;
    state = castVote(state, 'p4', 'p3').state;

    expect(state.phase).toBe('round_result');
    expect(state.lastRoundResult?.wasTie).toBe(true);
    expect(state.lastRoundResult?.exiledIds).toEqual([]);
    expect(state.players.filter((p) => p.alive)).toHaveLength(4);

    // Proceeding after skipped round continues game (does not end prematurely)
    state = proceedAfterRoundResult(state, true);
    expect(state.phase).toBe('reveal');
    expect(state.round).toBe(3);
  });

  it('supports Easter-egg bots and 3 new special cards (expand_bunker, shrink_bunker, revive_exiled)', () => {
    let state = createInitialState('EGG1', 'p1', 'Хост');
    state = addBotPlayer(state, true).state;
    state = addOrReconnectPlayer(state, 'p2', 'Боб').state;
    const eggBot = state.players.find((p) => p.isEasterEgg);
    expect(eggBot).toBeDefined();
    expect(eggBot?.isBot).toBe(true);

    state = startGame(state).state;
    const view = getPlayerView(state, 'p1');
    expect(view.players.find((p) => p.id === eggBot!.id)?.isEasterEgg).toBe(true);

    const initialCap = state.bunker!.capacity;
    const expand = createSpecialCard('expand_bunker', 'sc-exp');
    const shrink = createSpecialCard('shrink_bunker', 'sc-shr');
    const revive = createSpecialCard('revive_exiled', 'sc-rev');

    state = {
      ...state,
      players: state.players.map((p) => {
        if (p.id === 'p1') return { ...p, specialCards: [expand, shrink, revive] };
        if (p.id === 'p2') return { ...p, alive: false };
        return p;
      }),
    };

    const expRes = useSpecialCard(state, 'p1', 'sc-exp');
    expect(expRes.error).toBeUndefined();
    expect(expRes.state.bunker!.capacity).toBe(initialCap + 1);

    const shrRes = useSpecialCard(expRes.state, 'p1', 'sc-shr');
    expect(shrRes.error).toBeUndefined();
    expect(shrRes.state.bunker!.capacity).toBe(initialCap);

    const revRes = useSpecialCard(shrRes.state, 'p1', 'sc-rev', 'p2');
    expect(revRes.error).toBeUndefined();
    expect(revRes.state.players.find((p) => p.id === 'p2')?.alive).toBe(true);
  });

  it('includes separate physiology category and rolls natural biology fertility', () => {
    const strongPhys = scoreTraitCard('physiology', '185 см, атлет, высокий болевой порог');
    expect(strongPhys.tags).toContain('survival');
    expect(strongPhys.score).toBeGreaterThan(1);

    let state = createInitialState('FERT1', 'p1', 'Игрок 1');
    state = addOrReconnectPlayer(state, 'p2', 'Игрок 2').state;
    state = addOrReconnectPlayer(state, 'p3', 'Игрок 3').state;
    state = addOrReconnectPlayer(state, 'p4', 'Игрок 4').state;

    const started = startGame(state);
    expect(started.error).toBeUndefined();
    const players = started.state.players;

    for (const p of players) {
      expect(p.traits.physiology.value).toBeTruthy();
      expect(p.traits.physiology.value).not.toBe('—');
      expect(p.traits.biology.value.toLowerCase()).toMatch(/(плодовит|бесплод|беременна)/);
    }
  });
});
