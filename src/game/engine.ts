import {
  ALL_PACKS,
  SPECIAL_CARD_TEMPLATES,
  createSpecialCard,
  mergePacks,
} from './data';
import {
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
    specialCards: [],
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

export function startGame(state: GameState): { state: GameState; error?: string } {
  if (state.players.length < 2) {
    return { state, error: 'Для старта нужно минимум 2 игрока (рекомендуется 4–12).' };
  }

  const capacity =
    state.settings.bunkerSeats > 0
      ? Math.min(state.settings.bunkerSeats, state.players.length - 1)
      : Math.max(1, Math.floor(state.players.length / 2));

  const pool = mergePacks(state.settings.packs);
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
      const pool = shuffledPools[cat];
      traits[cat] = {
        category: cat,
        value: pool[idx % pool.length],
        revealed: false,
      };
    }

    const cardTypes = shuffle(SPECIAL_CARD_TEMPLATES).slice(0, 2);
    const specialCards = cardTypes.map((t, cIdx) =>
      createSpecialCard(t.type, `${p.id}-sc-${cIdx}-${Date.now()}`)
    );

    return {
      ...p,
      alive: true,
      traits,
      specialCards,
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

export function castVote(
  state: GameState,
  voterId: string,
  targetPlayerId: string
): { state: GameState; error?: string } {
  if (state.phase !== 'voting') {
    return { state, error: 'Сейчас не фаза голосования.' };
  }

  const voter = state.players.find((p) => p.id === voterId);
  const target = state.players.find((p) => p.id === targetPlayerId);
  if (!voter || !voter.alive) {
    return { state, error: 'Вы не можете голосовать.' };
  }
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

  const nextVotes = { ...state.votes, [voterId]: targetPlayerId };
  let next: GameState = { ...state, votes: nextVotes };

  const aliveVoters = next.players.filter((p) => p.alive);
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

  for (const [voterId, targetId] of Object.entries(state.votes)) {
    const voter = state.players.find((p) => p.id === voterId);
    const target = state.players.find((p) => p.id === targetId);
    if (!voter || !target || target.hasImmunity || !tally.has(targetId)) continue;
    tally.set(targetId, (tally.get(targetId) ?? 0) + voter.voteWeight);
  }

  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
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
  let logText = `${player.name} применил спецкарту «${card.title}».`;

  switch (card.type) {
    case 'heal': {
      const target = updatedPlayers.find((p) => p.id === targetPlayerId && p.alive);
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

    case 'swap_trait': {
      const target = updatedPlayers.find(
        (p) => p.id === targetPlayerId && p.id !== playerId && p.alive
      );
      if (!target || !category) {
        return { state, error: 'Выберите другого игрока и категорию для обмена.' };
      }
      const myTrait = player.traits[category];
      const targetTrait = target.traits[category];
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

    case 'reroll_profession': {
      const pool = mergePacks(state.settings.packs);
      const newProf = shuffle(pool.traits.profession)[0];
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === playerId
          ? { ...p, traits: { ...p.traits, profession: { ...p.traits.profession, value: newProf } } }
          : p
      );
      logText = `${player.name} применил «${card.title}» и сменил профессию.`;
      break;
    }

    case 'reroll_luggage': {
      const pool = mergePacks(state.settings.packs);
      const newLuggage = shuffle(pool.traits.luggage)[0];
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === playerId
          ? { ...p, traits: { ...p.traits, luggage: { ...p.traits.luggage, value: newLuggage } } }
          : p
      );
      logText = `${player.name} применил «${card.title}» и обновил багаж.`;
      break;
    }

    case 'force_reveal': {
      const target = updatedPlayers.find(
        (p) => p.id === targetPlayerId && p.id !== playerId && p.alive
      );
      if (!target || !category) {
        return { state, error: 'Выберите игрока и скрытую характеристику.' };
      }
      if (target.traits[category].revealed) {
        return { state, error: 'Эта характеристика уже вскрыта.' };
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
        p.id === playerId ? { ...p, voteWeight: 2 } : p
      );
      logText = `${player.name} активировал «Двойной голос» на ближайшем голосовании!`;
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
  }

  return {
    state: addSystemChat(
      { ...state, players: updatedPlayers, bunker: updatedBunker },
      logText
    ),
  };
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
    let revealedCount = 0;
    for (const cat of TRAIT_ORDER) {
      if (p.traits[cat].revealed || state.phase === 'game_over') {
        revealedTraits[cat] = p.traits[cat].value;
        revealedCount++;
      }
    }
    return {
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      connected: p.connected,
      alive: p.alive,
      revealedTraits,
      revealedCount,
      revealedThisRound: p.revealedThisRound,
      hasImmunity: p.hasImmunity,
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
