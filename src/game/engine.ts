import {
  applyHarmToHealth,
  applyHealToHealth,
  getTraitAbility,
  isHealthyStatus,
} from './abilities';
import {
  ALL_PACKS,
  DISEASE_STAGES,
  EXPERTISE_LEVELS,
  createSpecialCard,
  getSpecialCardPool,
  mergePacks,
} from './data';
import {
  BonusTrait,
  BunkerCard,
  ChatMessage,
  GameState,
  Player,
  PlayerView,
  PublicPlayer,
  TRAIT_LABELS,
  TRAIT_ORDER,
  TraitCard,
  TraitCategory,
} from './types';

function shuffle<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function addSystemChat(state: GameState, text: string): GameState {
  const msg: ChatMessage = {
    id: uid('sys'),
    senderId: 'system',
    senderName: 'СИСТЕМА БУНКЕРА',
    text,
    timestamp: Date.now(),
    isSystem: true,
  };
  return {
    ...state,
    chat: [...state.chat.slice(-99), msg],
  };
}

export function createInitialState(
  roomCode: string,
  hostId: string,
  hostName: string
): GameState {
  const host: Player = createEmptyPlayer(hostId, hostName, true);
  return addSystemChat(
    {
      roomCode,
      phase: 'lobby',
      round: 0,
      totalRounds: 0,
      kicksPerRound: [],
      settings: {
        packs: ['classic'],
        enableAdultContent: false,
        enabledTraits: [...TRAIT_ORDER],
        customFields: [],
        specialCardsPerPlayer: 2,
        maxPlayers: 12,
        bunkerSeats: 0,
        turnSeconds: 45,
        discussionSeconds: 90,
        votingSeconds: 45,
      },
      players: [host],
      turnOrder: [],
      currentTurnIndex: 0,
      phaseEndsAt: null,
      catastrophe: null,
      bunker: null,
      votes: {},
      tiedCandidates: [],
      lastRoundResult: null,
      chat: [],
    },
    `Комната ${roomCode} создана. Хост: ${hostName}.`
  );
}

function createEmptyPlayer(id: string, name: string, isHost: boolean): Player {
  const traits = {} as Record<TraitCategory, TraitCard>;
  for (const cat of TRAIT_ORDER) {
    traits[cat] = { category: cat, value: '—', revealed: false };
  }
  return {
    id,
    name: name.trim() || 'Выживший',
    isHost,
    connected: true,
    alive: true,
    traits,
    bonusTraits: [],
    specialCards: [],
    usedTraitAbilities: [],
    revealedThisRound: false,
    hasImmunity: false,
    voteWeight: 1,
  };
}

export function addOrReconnectPlayer(
  state: GameState,
  playerId: string,
  rawName: string
): { state: GameState; error?: string } {
  const name = rawName.trim().slice(0, 24) || 'Выживший';
  const existing = state.players.find((p) => p.id === playerId);
  if (existing) {
    const updated = state.players.map((p) =>
      p.id === playerId
        ? { ...p, connected: true, name: state.phase === 'lobby' ? name : p.name }
        : p
    );
    return {
      state: addSystemChat(
        { ...state, players: updated },
        `${existing.name} переподключился.`
      ),
    };
  }

  if (state.phase !== 'lobby') {
    return { state, error: 'Игра уже началась. Новые игроки не могут войти.' };
  }

  if (state.players.length >= state.settings.maxPlayers) {
    return { state, error: 'Комната заполнена.' };
  }

  const newPlayer = createEmptyPlayer(playerId, name, false);
  return {
    state: addSystemChat(
      { ...state, players: [...state.players, newPlayer] },
      `${name} присоединился к лобби.`
    ),
  };
}

export function disconnectPlayer(state: GameState, playerId: string): GameState {
  const target = state.players.find((p) => p.id === playerId);
  if (!target) return state;

  if (state.phase === 'lobby' && !target.isHost) {
    return addSystemChat(
      { ...state, players: state.players.filter((p) => p.id !== playerId) },
      `${target.name} покинул лобби.`
    );
  }

  return addSystemChat(
    {
      ...state,
      players: state.players.map((p) =>
        p.id === playerId ? { ...p, connected: false } : p
      ),
    },
    `${target.name} потерял соединение.`
  );
}

export function computeKicksSchedule(playerCount: number, capacity: number): number[] {
  const totalKicks = Math.max(0, playerCount - capacity);
  if (totalKicks === 0) return [0];

  if (totalKicks <= 4) {
    // Round 1 is orientation (0 kicks), then 1 kick per round
    return [0, ...Array(totalKicks).fill(1)];
  }

  const rounds = 5;
  const schedule = Array(rounds).fill(0);
  for (let i = 0; i < totalKicks; i++) {
    schedule[i % rounds] += 1;
  }
  return schedule;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function formatRolledTrait(category: TraitCategory, rawValue: string): string {
  if (category === 'profession') {
    const level = EXPERTISE_LEVELS[randInt(0, EXPERTISE_LEVELS.length - 1)];
    return `${rawValue} (${level})`;
  }

  if (category === 'biology') {
    const lower = rawValue.toLowerCase();
    const isFemale = lower.includes('женщина');
    const isLongLived =
      lower.includes('эльф') ||
      lower.includes('гном') ||
      lower.includes('вампир') ||
      lower.includes('фея');
    const age = isLongLived ? randInt(45, 220) : randInt(19, 62);
    const roll = Math.random();
    let fertility: string;
    if (isFemale && roll < 0.06) {
      fertility = 'беременна';
    } else if (roll < 0.72) {
      fertility = isFemale ? 'плодовитая' : 'плодовитый';
    } else {
      fertility = isFemale ? 'бесплодна' : 'бесплоден';
    }
    return `${rawValue}, ${age} лет (${fertility})`;
  }

  if (category === 'health' && !isHealthyStatus(rawValue)) {
    const stage = DISEASE_STAGES[randInt(0, DISEASE_STAGES.length - 1)];
    return `${rawValue} [${stage}]`;
  }

  return rawValue;
}

export function startGame(state: GameState): { state: GameState; error?: string } {
  if (state.players.length < 1) {
    return { state, error: 'В комнате должен быть хотя бы 1 игрок.' };
  }

  const capacity =
    state.players.length === 1
      ? 1
      : state.settings.bunkerSeats > 0
        ? Math.min(state.settings.bunkerSeats, state.players.length - 1)
        : Math.max(1, Math.floor(state.players.length / 2));

  const pool = mergePacks(state.settings.packs, state.settings.enableAdultContent);
  const specialPool = getSpecialCardPool(state.settings.enableAdultContent);
  const specialCount = Math.max(0, Math.min(5, state.settings.specialCardsPerPlayer ?? 2));
  const enabledSet = new Set<TraitCategory>(
    state.settings.enabledTraits && state.settings.enabledTraits.length > 0
      ? state.settings.enabledTraits
      : TRAIT_ORDER
  );
  const kicksPerRound = computeKicksSchedule(state.players.length, capacity);
  const catastrophe = shuffle(pool.catastrophes)[0];
  const supplies = shuffle(pool.supplies)[0];
  const rawFeatures = shuffle(pool.bunkerFeatures).slice(0, 5);
  const bunkerCards: BunkerCard[] = rawFeatures.map((f, idx) => ({
    id: uid('bcard'),
    title: f.title,
    description: f.description,
    isThreat: f.isThreat,
    revealed: idx === 0,
  }));

  const shuffledPools = {} as Record<TraitCategory, string[]>;
  for (const cat of TRAIT_ORDER) {
    shuffledPools[cat] = shuffle(pool.traits[cat]);
  }

  const players: Player[] = state.players.map((p, idx) => {
    const traits = {} as Record<TraitCategory, TraitCard>;
    for (const cat of TRAIT_ORDER) {
      if (!enabledSet.has(cat)) {
        traits[cat] = {
          category: cat,
          value: 'Отключено',
          revealed: true,
          removed: true,
        };
      } else {
        const poolVals = shuffledPools[cat];
        traits[cat] = {
          category: cat,
          value: formatRolledTrait(cat, poolVals[idx % poolVals.length]),
          revealed: false,
        };
      }
    }

    const bonusTraits: BonusTrait[] = (state.settings.customFields ?? []).map((cf, cfIdx) => ({
      id: `${p.id}-cf-${cfIdx}-${Date.now()}`,
      label: cf.label,
      value: cf.pool.length > 0 ? shuffle(cf.pool)[0] : 'Не указано',
      revealed: false,
    }));

    const cardTypes = shuffle(specialPool).slice(0, specialCount);
    const specialCards = cardTypes.map((t, cIdx) =>
      createSpecialCard(t.type, `${p.id}-sc-${cIdx}-${Date.now()}`)
    );

    return {
      ...p,
      alive: true,
      traits,
      bonusTraits,
      specialCards,
      usedTraitAbilities: [],
      revealedThisRound: false,
      hasImmunity: false,
      voteWeight: 1,
    };
  });

  const turnOrder = shuffle(players.map((p) => p.id));

  let next: GameState = {
    ...state,
    phase: 'briefing',
    round: 1,
    totalRounds: kicksPerRound.length,
    kicksPerRound,
    players,
    turnOrder,
    currentTurnIndex: 0,
    phaseEndsAt: null,
    catastrophe,
    bunker: {
      areaSqm: 60 + capacity * 25,
      capacity,
      supplies,
      cards: bunkerCards,
    },
    votes: {},
    tiedCandidates: [],
    lastRoundResult: null,
  };

  const activePackNames = state.settings.packs
    .map((id) => ALL_PACKS[id]?.name)
    .filter(Boolean)
    .join(' + ');

  next = addSystemChat(
    next,
    `Наборы: ${activePackNames || 'Классический'}. Катастрофа: ${catastrophe.title}. Мест в бункере: ${capacity} из ${players.length}.`
  );
  return { state: next };
}

export function revealTrait(
  state: GameState,
  playerId: string,
  category: TraitCategory
): { state: GameState; error?: string } {
  if (state.phase !== 'reveal') {
    return { state, error: 'Сейчас не фаза вскрытия характеристик.' };
  }

  const player = state.players.find((p) => p.id === playerId);
  if (!player || !player.alive) {
    return { state, error: 'Игрок не может вскрывать карты.' };
  }

  const currentTurnId = state.turnOrder[state.currentTurnIndex];
  if (currentTurnId && currentTurnId !== playerId) {
    return { state, error: 'Сейчас ход другого игрока.' };
  }

  if (player.traits[category].removed) {
    return { state, error: 'Эта характеристика удалена или отключена.' };
  }

  if (player.traits[category].revealed) {
    return { state, error: 'Эта характеристика уже вскрыта.' };
  }

  const updatedPlayers = state.players.map((p) =>
    p.id === playerId
      ? {
          ...p,
          revealedThisRound: true,
          traits: {
            ...p.traits,
            [category]: { ...p.traits[category], revealed: true },
          },
        }
      : p
  );

  let next = addSystemChat(
    { ...state, players: updatedPlayers },
    `${player.name} вскрывает «${TRAIT_LABELS[category]}»: ${player.traits[category].value}`
  );

  // Advance turn to next alive player who hasn't revealed this round
  next = advanceRevealTurn(next);
  return { state: next };
}

export function revealBonusTrait(
  state: GameState,
  playerId: string,
  bonusId: string
): { state: GameState; error?: string } {
  if (state.phase === 'lobby' || state.phase === 'game_over') {
    return { state, error: 'Дополнительные поля можно вскрывать только во время игры.' };
  }

  const player = state.players.find((p) => p.id === playerId);
  if (!player || !player.alive) {
    return { state, error: 'Игрок не может вскрывать карты.' };
  }

  const bonus = player.bonusTraits.find((b) => b.id === bonusId);
  if (!bonus) {
    return { state, error: 'Дополнительное поле не найдено.' };
  }
  if (bonus.revealed) {
    return { state, error: 'Это поле уже вскрыто.' };
  }

  const updatedPlayers = state.players.map((p) =>
    p.id === playerId
      ? {
          ...p,
          bonusTraits: p.bonusTraits.map((b) =>
            b.id === bonusId ? { ...b, revealed: true } : b
          ),
        }
      : p
  );

  return {
    state: addSystemChat(
      { ...state, players: updatedPlayers },
      `${player.name} вскрывает доп. поле «${bonus.label}»: ${bonus.value}`
    ),
  };
}

function advanceRevealTurn(state: GameState): GameState {
  const aliveNotRevealed = state.turnOrder.filter((id) => {
    const p = state.players.find((pl) => pl.id === id);
    return p && p.alive && !p.revealedThisRound;
  });

  if (aliveNotRevealed.length === 0) {
    // Everyone revealed this round -> move to discussion
    return startDiscussionPhase(state);
  }

  const nextId = aliveNotRevealed[0];
  const nextIndex = state.turnOrder.indexOf(nextId);
  return {
    ...state,
    currentTurnIndex: nextIndex,
    phaseEndsAt:
      state.settings.turnSeconds > 0
        ? Date.now() + state.settings.turnSeconds * 1000
        : null,
  };
}

export function startRevealPhase(state: GameState): GameState {
  const aliveIds = state.turnOrder.filter((id) =>
    state.players.some((p) => p.id === id && p.alive)
  );
  const resetPlayers = state.players.map((p) => ({
    ...p,
    revealedThisRound: false,
  }));

  const firstIndex = aliveIds.length > 0 ? state.turnOrder.indexOf(aliveIds[0]) : 0;

  return addSystemChat(
    {
      ...state,
      phase: 'reveal',
      players: resetPlayers,
      currentTurnIndex: Math.max(0, firstIndex),
      phaseEndsAt:
        state.settings.turnSeconds > 0
          ? Date.now() + state.settings.turnSeconds * 1000
          : null,
    },
    `Раунд ${state.round}/${state.totalRounds}: фаза вскрытия характеристик.`
  );
}

export function startDiscussionPhase(state: GameState): GameState {
  return addSystemChat(
    {
      ...state,
      phase: 'discussion',
      phaseEndsAt:
        state.settings.discussionSeconds > 0
          ? Date.now() + state.settings.discussionSeconds * 1000
          : null,
    },
    'Все игроки вскрыли карты! Начинается общее обсуждение.'
  );
}

export function startVotingPhase(state: GameState): GameState {
  const kicksNeeded = state.kicksPerRound[state.round - 1] ?? 0;
  if (kicksNeeded === 0) {
    return proceedAfterRoundResult(
      addSystemChat(
        {
          ...state,
          phase: 'round_result',
          lastRoundResult: {
            round: state.round,
            exiledIds: [],
            exiledNames: [],
            wasTie: false,
            reason: 'В этом раунде изгнаний нет — все знакомятся с ситуацией.',
          },
        },
        'Раунд 1 завершён без изгнаний.'
      ),
      false
    );
  }

  return addSystemChat(
    {
      ...state,
      phase: 'voting',
      votes: {},
      tiedCandidates: [],
      phaseEndsAt:
        state.settings.votingSeconds > 0
          ? Date.now() + state.settings.votingSeconds * 1000
          : null,
    },
    `Голосование! В этом раунде нужно изгнать: ${kicksNeeded} чел.`
  );
}

export const SKIP_VOTE_ID = '__skip__';

export function castVote(
  state: GameState,
  voterId: string,
  targetPlayerId: string
): { state: GameState; error?: string } {
  if (state.phase !== 'voting') {
    return { state, error: 'Сейчас не фаза голосования.' };
  }

  const voter = state.players.find((p) => p.id === voterId);
  if (!voter || !voter.alive) {
    return { state, error: 'Вы не можете голосовать.' };
  }
  if (voter.voteWeight <= 0) {
    return { state, error: 'Вы лишены права голоса в этом раунде.' };
  }

  if (targetPlayerId !== SKIP_VOTE_ID) {
    const target = state.players.find((p) => p.id === targetPlayerId);
    if (!target || !target.alive) {
      return { state, error: 'Нельзя голосовать за выбывшего игрока.' };
    }
    if (voterId === targetPlayerId) {
      return { state, error: 'Нельзя голосовать против себя.' };
    }
    if (
      state.tiedCandidates.length > 0 &&
      !state.tiedCandidates.includes(targetPlayerId)
    ) {
      return { state, error: 'При переголосовании выберите одного из спорных кандидатов.' };
    }
  }

  const nextVotes = { ...state.votes, [voterId]: targetPlayerId };
  let next: GameState = { ...state, votes: nextVotes };

  const aliveVoters = next.players.filter((p) => p.alive && p.voteWeight > 0);
  if (Object.keys(nextVotes).length >= aliveVoters.length) {
    next = resolveVotes(next);
  }

  return { state: next };
}

export function resolveVotes(state: GameState): GameState {
  const kicksNeeded = state.kicksPerRound[state.round - 1] ?? 1;
  const alivePlayers = state.players.filter((p) => p.alive);
  const candidates =
    state.tiedCandidates.length > 0
      ? alivePlayers.filter((p) => state.tiedCandidates.includes(p.id))
      : alivePlayers;

  const tally = new Map<string, number>();
  for (const c of candidates) {
    if (!c.hasImmunity) {
      tally.set(c.id, 0);
    }
  }

  let skipVotes = 0;
  for (const [voterId, targetId] of Object.entries(state.votes)) {
    const voter = state.players.find((p) => p.id === voterId);
    if (!voter) continue;
    if (targetId === SKIP_VOTE_ID) {
      skipVotes += voter.voteWeight;
      continue;
    }
    const target = state.players.find((p) => p.id === targetId);
    if (!target || target.hasImmunity || !tally.has(targetId)) continue;
    tally.set(targetId, (tally.get(targetId) ?? 0) + voter.voteWeight);
  }

  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const topCandidateScore = sorted[0]?.[1] ?? 0;
  if (skipVotes > 0 && skipVotes >= topCandidateScore) {
    const resetPlayers = state.players.map((p) => ({
      ...p,
      hasImmunity: false,
      voteWeight: 1,
    }));
    return addSystemChat(
      {
        ...state,
        phase: 'round_result',
        players: resetPlayers,
        votes: {},
        tiedCandidates: [],
        phaseEndsAt: null,
        lastRoundResult: {
          round: state.round,
          exiledIds: [],
          exiledNames: [],
          wasTie: false,
          reason: 'Большинство воздержалось — в этом раунде никто не изгнан.',
        },
      },
      'Голосование пропущено — в этом раунде все остаются в бункере.'
    );
  }
  if (sorted.length === 0) {
    return {
      ...state,
      phase: 'round_result',
      lastRoundResult: {
        round: state.round,
        exiledIds: [],
        exiledNames: [],
        wasTie: false,
        reason: 'Никто не может быть изгнан (действует неприкосновенность).',
      },
    };
  }

  const slotsToFill = Math.min(kicksNeeded, sorted.length);
  const cutoffScore = sorted[slotsToFill - 1][1];
  const aboveCutoff = sorted.filter(([, score]) => score > cutoffScore).map(([id]) => id);
  const atCutoff = sorted.filter(([, score]) => score === cutoffScore).map(([id]) => id);

  // Tie check: if more players at cutoff than remaining slots and this wasn't already a revote
  if (
    aboveCutoff.length + atCutoff.length > slotsToFill &&
    state.tiedCandidates.length === 0 &&
    cutoffScore > 0
  ) {
    const tiedNames = atCutoff
      .map((id) => state.players.find((p) => p.id === id)?.name ?? '')
      .join(', ');
    return addSystemChat(
      {
        ...state,
        votes: {},
        tiedCandidates: atCutoff,
        phaseEndsAt:
          state.settings.votingSeconds > 0
            ? Date.now() + state.settings.votingSeconds * 1000
            : null,
      },
      `Ничья на голосовании! Переголосование между: ${tiedNames}.`
    );
  }

  const exiledIds = [...aboveCutoff, ...atCutoff].slice(0, slotsToFill);
  const exiledNames = exiledIds.map(
    (id) => state.players.find((p) => p.id === id)?.name ?? 'Игрок'
  );

  const updatedPlayers = state.players.map((p) =>
    exiledIds.includes(p.id)
      ? { ...p, alive: false, hasImmunity: false, voteWeight: 1 }
      : { ...p, hasImmunity: false, voteWeight: 1 }
  );

  return addSystemChat(
    {
      ...state,
      phase: 'round_result',
      players: updatedPlayers,
      votes: {},
      tiedCandidates: [],
      phaseEndsAt: null,
      lastRoundResult: {
        round: state.round,
        exiledIds,
        exiledNames,
        wasTie: false,
        reason: `По итогам голосования бункер покидает: ${exiledNames.join(', ')}.`,
      },
    },
    `Изгнаны из бункера: ${exiledNames.join(', ')}.`
  );
}

export function proceedAfterRoundResult(state: GameState, advanceFromRoundResult = true): GameState {
  if (!advanceFromRoundResult) {
    return state;
  }

  const aliveCount = state.players.filter((p) => p.alive).length;
  const capacity = state.bunker?.capacity ?? 1;

  if (aliveCount <= capacity || state.round >= state.totalRounds) {
    const survivors = state.players
      .filter((p) => p.alive)
      .map((p) => p.name)
      .join(', ');
    return addSystemChat(
      {
        ...state,
        phase: 'game_over',
        phaseEndsAt: null,
      },
      `Игра окончена! Двери бункера закрываются. Внутри остались: ${survivors}.`
    );
  }

  const nextRound = state.round + 1;
  const updatedBunker = state.bunker
    ? {
        ...state.bunker,
        cards: state.bunker.cards.map((c, idx) =>
          idx < nextRound ? { ...c, revealed: true } : c
        ),
      }
    : null;

  return startRevealPhase({
    ...state,
    round: nextRound,
    bunker: updatedBunker,
    lastRoundResult: null,
  });
}

export function useSpecialCard(
  state: GameState,
  playerId: string,
  cardId: string,
  targetPlayerId?: string,
  category?: TraitCategory
): { state: GameState; error?: string } {
  if (state.phase === 'lobby' || state.phase === 'game_over') {
    return { state, error: 'Спецкарты можно использовать только во время игры.' };
  }

  const player = state.players.find((p) => p.id === playerId);
  if (!player || !player.alive) {
    return { state, error: 'Выбывший игрок не может использовать спецкарты.' };
  }

  const card = player.specialCards.find((c) => c.id === cardId);
  if (!card || card.used) {
    return { state, error: 'Карта недоступна или уже использована.' };
  }

  let updatedPlayers = state.players.map((p) =>
    p.id === playerId
      ? {
          ...p,
          specialCards: p.specialCards.map((c) =>
            c.id === cardId ? { ...c, used: true } : c
          ),
        }
      : p
  );
  let updatedBunker = state.bunker;
  let updatedKicks = state.kicksPerRound;
  let logText = `${player.name} применил спецкарту «${card.title}».`;
  const pool = mergePacks(state.settings.packs, state.settings.enableAdultContent);

  switch (card.type) {
    case 'heal': {
      const target = updatedPlayers.find((p) => p.id === (targetPlayerId || playerId) && p.alive);
      if (!target) return { state, error: 'Выберите живого игрока для лечения.' };
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === target.id
          ? {
              ...p,
              traits: {
                ...p.traits,
                health: { ...p.traits.health, value: 'Полностью здоров' },
              },
            }
          : p
      );
      logText = `${player.name} применил «${card.title}» на ${target.name} — здоровье восстановлено!`;
      break;
    }

    case 'harm_virus': {
      const target = updatedPlayers.find(
        (p) => p.id === targetPlayerId && p.id !== playerId && p.alive
      );
      if (!target) return { state, error: 'Выберите другого живого игрока.' };
      let nextHealth: string;
      if (isHealthyStatus(target.traits.health.value)) {
        const diseases = pool.traits.health.filter((h) => !isHealthyStatus(h));
        const pickedDisease = shuffle(diseases)[0] ?? 'Острая инфекция';
        nextHealth = `${pickedDisease} [Лёгкая стадия]`;
      } else {
        nextHealth = applyHarmToHealth(target.traits.health.value);
      }
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === target.id
          ? {
              ...p,
              traits: {
                ...p.traits,
                health: { ...p.traits.health, value: nextHealth },
              },
            }
          : p
      );
      logText = `${player.name} применил «${card.title}» на ${target.name} -> ${nextHealth}!`;
      break;
    }

    case 'swap_trait': {
      const target = updatedPlayers.find(
        (p) => p.id === targetPlayerId && p.id !== playerId && p.alive
      );
      if (!target || !category) {
        return { state, error: 'Выберите другого игрока и категорию для обмена.' };
      }
      const myTrait = player.traits[category];
      const targetTrait = target.traits[category];
      if (myTrait.removed || targetTrait.removed) {
        return { state, error: 'Нельзя обмениваться удалённой или отключённой характеристикой.' };
      }
      updatedPlayers = updatedPlayers.map((p) => {
        if (p.id === playerId) {
          return {
            ...p,
            traits: { ...p.traits, [category]: { ...targetTrait, revealed: myTrait.revealed } },
          };
        }
        if (p.id === target.id) {
          return {
            ...p,
            traits: { ...p.traits, [category]: { ...myTrait, revealed: targetTrait.revealed } },
          };
        }
        return p;
      });
      logText = `${player.name} обменялся категорией «${TRAIT_LABELS[category]}» с ${target.name}!`;
      break;
    }

    case 'steal_gear': {
      const target = updatedPlayers.find(
        (p) => p.id === targetPlayerId && p.id !== playerId && p.alive
      );
      if (!target) return { state, error: 'Выберите другого живого игрока.' };
      if (target.traits.gear.removed) {
        return { state, error: 'У выбранного игрока уже нет крупного багажа.' };
      }
      const stolenValue = target.traits.gear.value;
      const trophy: BonusTrait = {
        id: uid('trophy'),
        label: 'Трофей',
        value: stolenValue,
        revealed: true,
      };
      updatedPlayers = updatedPlayers.map((p) => {
        if (p.id === target.id) {
          return {
            ...p,
            traits: {
              ...p.traits,
              gear: { ...p.traits.gear, removed: true, revealed: true },
            },
          };
        }
        if (p.id === playerId) {
          return {
            ...p,
            bonusTraits: [...p.bonusTraits, trophy],
          };
        }
        return p;
      });
      logText = `${player.name} экспроприировал крупный багаж у ${target.name} («${stolenValue}»)!`;
      break;
    }

    case 'reroll_profession': {
      const newProf = formatRolledTrait('profession', shuffle(pool.traits.profession)[0]);
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === playerId
          ? {
              ...p,
              traits: {
                ...p.traits,
                profession: { ...p.traits.profession, value: newProf, removed: false },
              },
            }
          : p
      );
      logText = `${player.name} применил «${card.title}» и сменил профессию.`;
      break;
    }

    case 'reroll_target_trait': {
      const target = updatedPlayers.find((p) => p.id === (targetPlayerId || playerId) && p.alive);
      if (!target || !category) {
        return { state, error: 'Выберите игрока и характеристику для переролла.' };
      }
      if (target.traits[category].removed) {
        return { state, error: 'Эта характеристика удалена или отключена.' };
      }
      const catPool = pool.traits[category];
      const candidates = catPool.filter((v) => v !== target.traits[category].value);
      const picked = shuffle(candidates.length > 0 ? candidates : catPool)[0];
      const nextVal = formatRolledTrait(category, picked);
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === target.id
          ? {
              ...p,
              traits: {
                ...p.traits,
                [category]: { ...p.traits[category], value: nextVal },
              },
            }
          : p
      );
      logText = `${player.name} перероллил «${TRAIT_LABELS[category]}» у игрока ${target.name}!`;
      break;
    }

    case 'reroll_all_health': {
      const healthPool = pool.traits.health;
      updatedPlayers = updatedPlayers.map((p) => {
        if (!p.alive || p.traits.health.removed) return p;
        const picked = formatRolledTrait('health', shuffle(healthPool)[0]);
        return {
          ...p,
          traits: {
            ...p.traits,
            health: { ...p.traits.health, value: picked },
          },
        };
      });
      logText = `${player.name} запустил «${card.title}» — здоровье всех живых игроков переброшено!`;
      break;
    }

    case 'force_reveal': {
      const target = updatedPlayers.find(
        (p) => p.id === targetPlayerId && p.id !== playerId && p.alive
      );
      if (!target || !category) {
        return { state, error: 'Выберите игрока и скрытую характеристику.' };
      }
      if (target.traits[category].removed || target.traits[category].revealed) {
        return { state, error: 'Эта характеристика уже вскрыта или удалена.' };
      }
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === target.id
          ? {
              ...p,
              traits: {
                ...p.traits,
                [category]: { ...p.traits[category], revealed: true },
              },
            }
          : p
      );
      logText = `${player.name} заставил ${target.name} вскрыть «${TRAIT_LABELS[category]}»: ${target.traits[category].value}`;
      break;
    }

    case 'double_vote': {
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === playerId ? { ...p, voteWeight: p.voteWeight + 1 } : p
      );
      logText = `${player.name} активировал «${card.title}» (+1 к весу голоса)!`;
      break;
    }

    case 'silence_vote': {
      const target = updatedPlayers.find(
        (p) => p.id === targetPlayerId && p.id !== playerId && p.alive
      );
      if (!target) return { state, error: 'Выберите другого живого игрока.' };
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === target.id ? { ...p, voteWeight: 0 } : p
      );
      logText = `${player.name} применил «${card.title}» — ${target.name} лишён права голоса в этом раунде!`;
      break;
    }

    case 'immunity': {
      const target = updatedPlayers.find((p) => p.id === (targetPlayerId || playerId) && p.alive);
      if (!target) return { state, error: 'Выберите живого игрока.' };
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === target.id ? { ...p, hasImmunity: true } : p
      );
      logText = `${player.name} дал неприкосновенность игроку ${target.name} в этом раунде!`;
      break;
    }

    case 'banish_add_kick': {
      const roundIdx = Math.max(0, state.round - 1);
      updatedKicks = [...state.kicksPerRound];
      while (updatedKicks.length <= roundIdx) updatedKicks.push(0);
      updatedKicks[roundIdx] = Math.max(1, updatedKicks[roundIdx] + 1);
      logText = `${player.name} активировал «${card.title}» — в этом раунде изгоняется на 1 игрока больше (${updatedKicks[roundIdx]})!`;
      break;
    }

    case 'skip_round_kick': {
      const roundIdx = Math.max(0, state.round - 1);
      updatedKicks = [...state.kicksPerRound];
      while (updatedKicks.length <= roundIdx) updatedKicks.push(0);
      updatedKicks[roundIdx] = 0;
      logText = `${player.name} применил «${card.title}» — изгнание в этом раунде отменено!`;
      break;
    }

    case 'reroll_luggage': {
      const newGear = shuffle(pool.traits.gear)[0];
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === playerId
          ? {
              ...p,
              traits: {
                ...p.traits,
                gear: { ...p.traits.gear, value: newGear, removed: false },
              },
            }
          : p
      );
      logText = `${player.name} применил «${card.title}» и обновил крупный багаж.`;
      break;
    }

    case 'reveal_bunker': {
      if (updatedBunker) {
        const hiddenIdx = updatedBunker.cards.findIndex((c) => !c.revealed);
        if (hiddenIdx !== -1) {
          const revealedCard = updatedBunker.cards[hiddenIdx];
          updatedBunker = {
            ...updatedBunker,
            cards: updatedBunker.cards.map((c, i) =>
              i === hiddenIdx ? { ...c, revealed: true } : c
            ),
          };
          logText = `${player.name} разведал отсек бункера: «${revealedCard.title}»!`;
        }
      }
      break;
    }

    case 'sabotage_bunker': {
      if (updatedBunker) {
        const threats = pool.bunkerFeatures.filter((f) => f.isThreat);
        const picked = shuffle(threats)[0];
        if (picked) {
          const newCard: BunkerCard = {
            id: uid('sabotage'),
            title: picked.title,
            description: picked.description,
            isThreat: true,
            revealed: true,
          };
          updatedBunker = {
            ...updatedBunker,
            cards: [...updatedBunker.cards, newCard],
          };
          logText = `${player.name} устроил диверсию в бункере: добавлена угроза «${picked.title}»!`;
        }
      }
      break;
    }

    case 'add_bonus_trait': {
      const target = updatedPlayers.find((p) => p.id === (targetPlayerId || playerId) && p.alive);
      if (!target) return { state, error: 'Выберите живого игрока.' };
      const bonusPool = Math.random() < 0.5 ? pool.traits.fact : pool.traits.pocket;
      const bonus: BonusTrait = {
        id: uid('bonus'),
        label: 'Тайный козырь',
        value: shuffle(bonusPool)[0],
        revealed: false,
      };
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === target.id ? { ...p, bonusTraits: [...p.bonusTraits, bonus] } : p
      );
      logText = `${player.name} добавил дополнительное поле игроку ${target.name}!`;
      break;
    }

    case 'remove_trait': {
      const target = updatedPlayers.find((p) => p.id === (targetPlayerId || playerId) && p.alive);
      if (!target || !category) {
        return { state, error: 'Выберите игрока и характеристику для удаления.' };
      }
      if (target.traits[category].removed) {
        return { state, error: 'Эта характеристика уже удалена.' };
      }
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === target.id
          ? {
              ...p,
              traits: {
                ...p.traits,
                [category]: { ...p.traits[category], removed: true, revealed: true },
              },
            }
          : p
      );
      logText = `${player.name} пропустил через шредер «${TRAIT_LABELS[category]}» у игрока ${target.name}!`;
      break;
    }

    case 'clone_trait': {
      const target = updatedPlayers.find(
        (p) => p.id === targetPlayerId && p.id !== playerId && p.alive
      );
      if (!target || !category) {
        return { state, error: 'Выберите другого игрока и вскрытую характеристику.' };
      }
      const targetTrait = target.traits[category];
      if (!targetTrait.revealed || targetTrait.removed) {
        return { state, error: 'Можно копировать только уже вскрытую и не удалённую характеристику.' };
      }
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === playerId
          ? {
              ...p,
              traits: {
                ...p.traits,
                [category]: {
                  ...p.traits[category],
                  value: targetTrait.value,
                  removed: false,
                },
              },
            }
          : p
      );
      logText = `${player.name} скопировал «${TRAIT_LABELS[category]}» у ${target.name} («${targetTrait.value}»)!`;
      break;
    }

    case 'cursed_truth': {
      const target = updatedPlayers.find(
        (p) => p.id === targetPlayerId && p.id !== playerId && p.alive
      );
      if (!target) return { state, error: 'Выберите другого живого игрока.' };
      const hiddenCats = shuffle(
        TRAIT_ORDER.filter((cat) => !target.traits[cat].revealed && !target.traits[cat].removed)
      ).slice(0, 2);
      const kompromatPool = [...pool.traits.fact, ...pool.traits.extra];
      const kompromat: BonusTrait = {
        id: uid('komp'),
        label: 'Компромат (18+)',
        value: shuffle(kompromatPool)[0],
        revealed: true,
      };
      updatedPlayers = updatedPlayers.map((p) => {
        if (p.id !== target.id) return p;
        const nextTraits = { ...p.traits };
        for (const cat of hiddenCats) {
          nextTraits[cat] = { ...nextTraits[cat], revealed: true };
        }
        return {
          ...p,
          traits: nextTraits,
          bonusTraits: [...p.bonusTraits, kompromat],
        };
      });
      const revealedNames = hiddenCats.map((c) => TRAIT_LABELS[c]).join(', ') || 'нет скрытых карт';
      logText = `${player.name} влил «${card.title}» в ${target.name}: вскрыто (${revealedNames}) + добавлен компромат «${kompromat.value}»!`;
      break;
    }

    case 'russian_roulette': {
      const lucky = Math.random() < 0.5;
      if (lucky) {
        updatedPlayers = updatedPlayers.map((p) =>
          p.id === playerId ? { ...p, hasImmunity: true } : p
        );
        logText = `${player.name} крутанул барабан «Русской рулетки» — ЩЕЛЧОК! Получена неприкосновенность на раунд!`;
      } else {
        const nextHealth = applyHarmToHealth(player.traits.health.value);
        updatedPlayers = updatedPlayers.map((p) =>
          p.id === playerId
            ? {
                ...p,
                traits: {
                  ...p.traits,
                  health: { ...p.traits.health, value: nextHealth, revealed: true },
                },
              }
            : p
        );
        logText = `${player.name} крутанул барабан «Русской рулетки» — ВЫСТРЕЛ! Здоровье: ${nextHealth}`;
      }
      break;
    }

    case 'bribe_bunker': {
      const target = updatedPlayers.find(
        (p) => p.id === targetPlayerId && p.id !== playerId && p.alive
      );
      if (!target) return { state, error: 'Выберите другого живого игрока.' };
      updatedPlayers = updatedPlayers.map((p) => {
        if (p.id === target.id) return { ...p, voteWeight: 0 };
        if (p.id === playerId) return { ...p, voteWeight: p.voteWeight + 1 };
        return p;
      });
      logText = `${player.name} провернул «${card.title}»: ${target.name} лишён голоса, а вес голоса ${player.name} вырос на +1!`;
      break;
    }
  }

  return {
    state: addSystemChat(
      {
        ...state,
        players: updatedPlayers,
        bunker: updatedBunker,
        kicksPerRound: updatedKicks,
      },
      logText
    ),
  };
}

export function useTraitAbility(
  state: GameState,
  playerId: string,
  category: TraitCategory,
  targetPlayerId?: string,
  targetCategory?: TraitCategory
): { state: GameState; error?: string } {
  if (state.phase === 'lobby' || state.phase === 'game_over') {
    return { state, error: 'Способности можно применять только во время игры.' };
  }

  const player = state.players.find((p) => p.id === playerId);
  if (!player || !player.alive) {
    return { state, error: 'Выбывший игрок не может применять способности.' };
  }

  if (player.usedTraitAbilities.includes(category)) {
    return { state, error: 'Способность этого слота уже использована.' };
  }

  const trait = player.traits[category];
  if (trait.removed) {
    return { state, error: 'Эта характеристика удалена или отключена.' };
  }
  const ability = getTraitAbility(category, trait.value);
  if (!ability) {
    return { state, error: 'У этой характеристики нет активной способности.' };
  }

  let updatedPlayers = state.players.map((p) =>
    p.id === playerId
      ? {
          ...p,
          usedTraitAbilities: [...p.usedTraitAbilities, category],
          traits: {
            ...p.traits,
            [category]: { ...p.traits[category], revealed: true },
          },
        }
      : p
  );
  let updatedBunker = state.bunker;
  let logText = `${player.name} применил способность «${ability.title}».`;
  const pool = mergePacks(state.settings.packs, state.settings.enableAdultContent);

  switch (ability.kind) {
    case 'heal': {
      const target = updatedPlayers.find((p) => p.id === (targetPlayerId || playerId) && p.alive);
      if (!target) return { state, error: 'Выберите живого игрока для лечения.' };
      const healedHealth = applyHealToHealth(target.traits.health.value);
      if (!healedHealth) {
        return { state, error: `${target.name} уже полностью здоров — лечение не требуется.` };
      }
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === target.id
          ? {
              ...p,
              traits: {
                ...p.traits,
                health: {
                  ...p.traits.health,
                  value: healedHealth,
                },
              },
            }
          : p
      );
      logText = `${player.name} («${trait.value}») подлечил игрока ${target.name} -> ${healedHealth}!`;
      break;
    }

    case 'harm': {
      const target = updatedPlayers.find(
        (p) => p.id === targetPlayerId && p.id !== playerId && p.alive
      );
      if (!target) return { state, error: 'Выберите другого живого игрока.' };
      const nextHealth = applyHarmToHealth(target.traits.health.value);
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === target.id
          ? {
              ...p,
              traits: {
                ...p.traits,
                health: { ...p.traits.health, value: nextHealth },
              },
            }
          : p
      );
      logText = `${player.name} применил «${trait.value}» против ${target.name} -> ${nextHealth}!`;
      break;
    }

    case 'infect': {
      const target = updatedPlayers.find(
        (p) => p.id === targetPlayerId && p.id !== playerId && p.alive
      );
      if (!target) return { state, error: 'Выберите другого живого игрока.' };
      let nextHealth: string;
      if (isHealthyStatus(target.traits.health.value)) {
        const diseases = pool.traits.health.filter((h) => !isHealthyStatus(h));
        const pickedDisease = shuffle(diseases)[0] ?? 'Острая инфекция';
        nextHealth = `${pickedDisease} [Лёгкая стадия]`;
      } else {
        nextHealth = applyHarmToHealth(target.traits.health.value);
      }
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === target.id
          ? {
              ...p,
              traits: {
                ...p.traits,
                health: { ...p.traits.health, value: nextHealth },
              },
            }
          : p
      );
      logText = `${player.name} («${trait.value}») заразил ${target.name} -> ${nextHealth}!`;
      break;
    }

    case 'repair_bunker': {
      if (!updatedBunker) return { state, error: 'Бункер не найден.' };
      const threat = updatedBunker.cards.find((c) => c.revealed && c.isThreat);
      if (!threat) {
        return { state, error: 'Сейчас нет открытых угроз бункера для устранения.' };
      }
      updatedBunker = {
        ...updatedBunker,
        cards: updatedBunker.cards.map((c) =>
          c.id === threat.id
            ? { ...c, isThreat: false, title: `Устранено: ${c.title}` }
            : c
        ),
      };
      logText = `${player.name} («${trait.value}») устранил угрозу «${threat.title}»!`;
      break;
    }

    case 'reveal_bunker': {
      if (!updatedBunker) return { state, error: 'Бункер не найден.' };
      const hiddenIdx = updatedBunker.cards.findIndex((c) => !c.revealed);
      if (hiddenIdx === -1) {
        return { state, error: 'Все карты бункера уже открыты.' };
      }
      const revealedCard = updatedBunker.cards[hiddenIdx];
      updatedBunker = {
        ...updatedBunker,
        cards: updatedBunker.cards.map((c, i) =>
          i === hiddenIdx ? { ...c, revealed: true } : c
        ),
      };
      logText = `${player.name} («${trait.value}») открыл отсек бункера: «${revealedCard.title}»!`;
      break;
    }

    case 'scout': {
      const target = updatedPlayers.find(
        (p) => p.id === targetPlayerId && p.id !== playerId && p.alive
      );
      if (!target) return { state, error: 'Выберите другого живого игрока для разведки.' };
      const hiddenCats = TRAIT_ORDER.filter(
        (cat) => !target.traits[cat].revealed && !target.traits[cat].removed
      );
      if (hiddenCats.length === 0) {
        return { state, error: 'У выбранного игрока уже все характеристики открыты.' };
      }
      const picked = shuffle(hiddenCats)[0];
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === target.id
          ? {
              ...p,
              traits: {
                ...p.traits,
                [picked]: { ...p.traits[picked], revealed: true },
              },
            }
          : p
      );
      logText = `${player.name} («${trait.value}») разведал «${TRAIT_LABELS[picked]}» у ${target.name}: ${target.traits[picked].value}`;
      break;
    }

    case 'steal_pocket': {
      const target = updatedPlayers.find(
        (p) => p.id === targetPlayerId && p.id !== playerId && p.alive
      );
      if (!target) return { state, error: 'Выберите другого живого игрока.' };
      if (target.traits.pocket.removed) {
        return { state, error: 'У выбранного игрока уже пусто в карманах.' };
      }
      const stolenPocket = target.traits.pocket.value;
      const trophy: BonusTrait = {
        id: uid('pocket'),
        label: 'Карманный трофей',
        value: stolenPocket,
        revealed: true,
      };
      updatedPlayers = updatedPlayers.map((p) => {
        if (p.id === target.id) {
          return {
            ...p,
            traits: {
              ...p.traits,
              pocket: { ...p.traits.pocket, removed: true, revealed: true },
            },
          };
        }
        if (p.id === playerId) {
          return {
            ...p,
            bonusTraits: [...p.bonusTraits, trophy],
          };
        }
        return p;
      });
      logText = `${player.name} («${trait.value}») стащил мелкий инвентарь у ${target.name}: «${stolenPocket}»!`;
      break;
    }

    case 'calm_phobia': {
      const target = updatedPlayers.find((p) => p.id === (targetPlayerId || playerId) && p.alive);
      if (!target) return { state, error: 'Выберите живого игрока.' };
      const phobiaLower = target.traits.phobia.value.toLowerCase();
      if (
        target.traits.phobia.removed ||
        phobiaLower.includes('нет фоби') ||
        phobiaLower.includes('нет выражен') ||
        phobiaLower.includes('нет страхов') ||
        phobiaLower.includes('успокоена')
      ) {
        return { state, error: `${target.name} не нуждается в терапии фобии.` };
      }
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === target.id
          ? {
              ...p,
              traits: {
                ...p.traits,
                phobia: { ...p.traits.phobia, value: 'Успокоена (без фобии)' },
              },
            }
          : p
      );
      logText = `${player.name} («${trait.value}») избавил ${target.name} от фобии!`;
      break;
    }

    case 'erase_field': {
      const target = updatedPlayers.find((p) => p.id === (targetPlayerId || playerId) && p.alive);
      if (!target || !targetCategory) {
        return { state, error: 'Выберите игрока и характеристику для удаления.' };
      }
      if (target.traits[targetCategory].removed) {
        return { state, error: 'Эта характеристика уже удалена.' };
      }
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === target.id
          ? {
              ...p,
              traits: {
                ...p.traits,
                [targetCategory]: { ...p.traits[targetCategory], removed: true, revealed: true },
              },
            }
          : p
      );
      logText = `${player.name} («${trait.value}») зачистил «${TRAIT_LABELS[targetCategory]}» у игрока ${target.name}!`;
      break;
    }

    case 'craft_bonus': {
      const target = updatedPlayers.find((p) => p.id === (targetPlayerId || playerId) && p.alive);
      if (!target) return { state, error: 'Выберите живого игрока.' };
      const craftPool = Math.random() < 0.5 ? pool.traits.pocket : pool.traits.gear;
      const crafted: BonusTrait = {
        id: uid('craft'),
        label: 'Крафт',
        value: shuffle(craftPool)[0],
        revealed: true,
      };
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === target.id ? { ...p, bonusTraits: [...p.bonusTraits, crafted] } : p
      );
      logText = `${player.name} («${trait.value}») смастерил для ${target.name}: «${crafted.value}»!`;
      break;
    }

    case 'boost_vote': {
      const target = updatedPlayers.find((p) => p.id === (targetPlayerId || playerId) && p.alive);
      if (!target) return { state, error: 'Выберите живого игрока.' };
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === target.id ? { ...p, voteWeight: p.voteWeight + 1 } : p
      );
      logText = `${player.name} («${trait.value}») усилил голос игрока ${target.name} (+1)!`;
      break;
    }

    case 'silence_vote': {
      const target = updatedPlayers.find(
        (p) => p.id === targetPlayerId && p.id !== playerId && p.alive
      );
      if (!target) return { state, error: 'Выберите другого живого игрока.' };
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === target.id ? { ...p, voteWeight: 0 } : p
      );
      logText = `${player.name} («${trait.value}») лишил ${target.name} права голоса в этом раунде!`;
      break;
    }

    case 'protect': {
      const target = updatedPlayers.find((p) => p.id === (targetPlayerId || playerId) && p.alive);
      if (!target) return { state, error: 'Выберите живого игрока.' };
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === target.id ? { ...p, hasImmunity: true } : p
      );
      logText = `${player.name} («${trait.value}») обеспечил неприкосновенность игроку ${target.name} на этот раунд!`;
      break;
    }

    case 'mutate_health': {
      const target = updatedPlayers.find((p) => p.id === (targetPlayerId || playerId) && p.alive);
      if (!target) return { state, error: 'Выберите живого игрока.' };
      const nextHealth = formatRolledTrait('health', shuffle(pool.traits.health)[0]);
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === target.id
          ? {
              ...p,
              traits: {
                ...p.traits,
                health: { ...p.traits.health, value: nextHealth },
              },
            }
          : p
      );
      logText = `${player.name} («${trait.value}») вызвал мутацию здоровья у ${target.name} -> ${nextHealth}!`;
      break;
    }
  }

  return {
    state: addSystemChat(
      { ...state, players: updatedPlayers, bunker: updatedBunker },
      logText
    ),
  };
}

export function hostRerollPlayerTrait(
  state: GameState,
  targetPlayerId: string,
  category: TraitCategory
): GameState {
  const target = state.players.find((p) => p.id === targetPlayerId);
  if (!target) return state;

  const pool = mergePacks(state.settings.packs, state.settings.enableAdultContent).traits[category];
  const currentVal = target.traits[category].value;
  const candidates = pool.filter((v) => v !== currentVal);
  const pickedRaw = shuffle(candidates.length > 0 ? candidates : pool)[0];
  const nextVal = formatRolledTrait(category, pickedRaw);

  const updatedPlayers = state.players.map((p) =>
    p.id === targetPlayerId
      ? {
          ...p,
          traits: {
            ...p.traits,
            [category]: { ...p.traits[category], value: nextVal },
          },
        }
      : p
  );

  return addSystemChat(
    { ...state, players: updatedPlayers },
    `Хост перероллил слот «${TRAIT_LABELS[category]}» у игрока ${target.name}.`
  );
}

export function hostUpdatePlayerTrait(
  state: GameState,
  targetPlayerId: string,
  category: TraitCategory,
  newValue: string,
  revealed?: boolean
): GameState {
  const target = state.players.find((p) => p.id === targetPlayerId);
  if (!target) return state;

  const clean = newValue.trim();
  const updatedPlayers = state.players.map((p) =>
    p.id === targetPlayerId
      ? {
          ...p,
          traits: {
            ...p.traits,
            [category]: {
              ...p.traits[category],
              value: clean || p.traits[category].value,
              revealed: revealed !== undefined ? revealed : p.traits[category].revealed,
            },
          },
        }
      : p
  );

  return addSystemChat(
    { ...state, players: updatedPlayers },
    `Хост обновил слот «${TRAIT_LABELS[category]}» у игрока ${target.name}.`
  );
}

export function addChatMessage(
  state: GameState,
  senderId: string,
  text: string
): GameState {
  const clean = text.trim().slice(0, 300);
  if (!clean) return state;
  const sender = state.players.find((p) => p.id === senderId);
  if (!sender) return state;

  const msg: ChatMessage = {
    id: uid('msg'),
    senderId,
    senderName: sender.name,
    text: clean,
    timestamp: Date.now(),
  };

  return {
    ...state,
    chat: [...state.chat.slice(-99), msg],
  };
}

export function getPlayerView(state: GameState, viewerId: string): PlayerView {
  const me = state.players.find((p) => p.id === viewerId) ?? null;

  const publicPlayers: PublicPlayer[] = state.players.map((p) => {
    const revealedTraits: Partial<Record<TraitCategory, string>> = {};
    const removedCategories: TraitCategory[] = [];
    let revealedCount = 0;
    for (const cat of TRAIT_ORDER) {
      if (p.traits[cat].removed) {
        removedCategories.push(cat);
        continue;
      }
      if (p.traits[cat].revealed || state.phase === 'game_over') {
        revealedTraits[cat] = p.traits[cat].value;
        revealedCount++;
      }
    }
    const revealedBonusTraits = p.bonusTraits
      .filter((b) => b.revealed || state.phase === 'game_over')
      .map(({ id, label, value }) => ({ id, label, value }));
    return {
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      connected: p.connected,
      alive: p.alive,
      revealedTraits,
      revealedBonusTraits,
      removedCategories,
      revealedCount,
      revealedThisRound: p.revealedThisRound,
      hasImmunity: p.hasImmunity,
      silenced: p.voteWeight <= 0,
    };
  });

  const bunker = state.bunker
    ? {
        areaSqm: state.bunker.areaSqm,
        capacity: state.bunker.capacity,
        supplies: state.bunker.supplies,
        cards: state.bunker.cards.map((c) =>
          c.revealed || state.phase === 'game_over'
            ? c
            : {
                id: c.id,
                title: 'Скрытая карта бункера',
                description: 'Откроется в следующих раундах или картой разведки.',
                isThreat: false,
                revealed: false,
              }
        ),
      }
    : null;

  return {
    roomCode: state.roomCode,
    phase: state.phase,
    round: state.round,
    totalRounds: state.totalRounds,
    kicksThisRound: state.kicksPerRound[state.round - 1] ?? 0,
    settings: state.settings,
    me,
    players: publicPlayers,
    currentTurnPlayerId:
      state.phase === 'reveal' ? state.turnOrder[state.currentTurnIndex] ?? null : null,
    phaseEndsAt: state.phaseEndsAt,
    catastrophe: state.catastrophe,
    bunker,
    votedPlayerIds: Object.keys(state.votes),
    myVote: state.votes[viewerId] ?? null,
    tiedCandidates: state.tiedCandidates,
    lastRoundResult: state.lastRoundResult,
    chat: state.chat,
  };
}
