import { TraitCategory } from '../types';
import {
  COMBO_SLOT_CATEGORIES,
  buildComboDeck,
  createCursedCard,
  createPenaltySlotCard,
  nextComboId,
  shuffleCards,
} from './comboCards';
import {
  ComboCard,
  ComboGameState,
  ComboModifier,
  ComboPlayer,
  ComboRoundStanding,
  ComboScoreBreakdown,
  ComboSettings,
  ComboSlot,
} from './comboTypes';

export const DEFAULT_COMBO_SETTINGS: ComboSettings = {
  packs: ['classic'],
  enableAdultContent: false,
  adultIntensity: 'mixed',
  totalRounds: 5,
  slotsPerPlayer: 5,
  handSize: 6,
  deckSize: 22,
  maxSwapsPerRound: 2,
  maxTradesPerRound: 1,
  maxTacticsPerRound: 2,
};

function createEmptySlots(count: number): ComboSlot[] {
  const slots: ComboSlot[] = [];
  for (let i = 0; i < count; i++) {
    slots.push({
      index: i,
      category: COMBO_SLOT_CATEGORIES[i % COMBO_SLOT_CATEGORIES.length],
      card: null,
      autoFilled: false,
    });
  }
  return slots;
}

function drawCardsIntoHand(
  player: ComboPlayer,
  count: number
): { deck: ComboCard[]; hand: ComboCard[]; discard: ComboCard[] } {
  let deck = [...player.deck];
  const hand = [...player.hand];
  let discard = [...player.discard];

  for (let i = 0; i < count; i++) {
    if (deck.length === 0 && discard.length > 0) {
      deck = shuffleCards(discard);
      discard = [];
    }
    if (deck.length === 0) break;
    const top = deck.shift()!;
    hand.push(top);
  }

  return { deck, hand, discard };
}

export function createComboInitialState(
  roomCode: string,
  hostId: string,
  hostName: string,
  settings?: Partial<ComboSettings>
): ComboGameState {
  const mergedSettings: ComboSettings = {
    ...DEFAULT_COMBO_SETTINGS,
    ...settings,
  };

  return {
    roomCode,
    phase: 'lobby',
    round: 0,
    settings: mergedSettings,
    players: [
      {
        id: hostId,
        name: hostName.trim() || 'Хост',
        isHost: true,
        vp: 0,
        deck: [],
        hand: [],
        discard: [],
        slots: createEmptySlots(mergedSettings.slotsPerPlayer),
        swapsUsedThisRound: 0,
        tradesUsedThisRound: 0,
        tacticsUsedThisRound: 0,
        ready: false,
      },
    ],
    modifiers: [],
    votes: {},
    roundHistory: [],
    winnerIds: [],
    logs: [`Создана комната Combo Draft ${roomCode}.`],
  };
}

export function addComboPlayer(
  state: ComboGameState,
  playerId: string,
  name: string,
  isBot = false
): { state: ComboGameState; error?: string } {
  if (state.phase !== 'lobby') {
    return { state, error: 'Нельзя добавить игрока после старта игры.' };
  }
  if (state.players.some((p) => p.id === playerId)) {
    return { state, error: 'Игрок уже в комнате.' };
  }
  const cleanName = name.trim() || (isBot ? 'Бот' : 'Игрок');
  const nextPlayer: ComboPlayer = {
    id: playerId,
    name: cleanName,
    isHost: false,
    isBot,
    vp: 0,
    deck: [],
    hand: [],
    discard: [],
    slots: createEmptySlots(state.settings.slotsPerPlayer),
    swapsUsedThisRound: 0,
    tradesUsedThisRound: 0,
    tacticsUsedThisRound: 0,
    ready: false,
  };
  return {
    state: {
      ...state,
      players: [...state.players, nextPlayer],
      logs: [...state.logs, `${cleanName} присоединился к Combo Draft.`],
    },
  };
}

export function updateComboSettings(
  state: ComboGameState,
  partial: Partial<ComboSettings>
): ComboGameState {
  if (state.phase !== 'lobby') return state;
  const settings: ComboSettings = {
    ...state.settings,
    ...partial,
  };
  return {
    ...state,
    settings,
    players: state.players.map((p) => ({
      ...p,
      slots: createEmptySlots(settings.slotsPerPlayer),
    })),
  };
}

export function startComboGame(state: ComboGameState): { state: ComboGameState; error?: string } {
  if (state.players.length < 1) {
    return { state, error: 'Для запуска Combo Draft нужен хотя бы 1 игрок.' };
  }

  const players = state.players.map((p) => {
    const freshDeck = buildComboDeck(
      state.settings.packs,
      state.settings.enableAdultContent,
      state.settings.adultIntensity,
      state.settings.deckSize
    );
    const basePlayer: ComboPlayer = {
      ...p,
      vp: 0,
      deck: freshDeck,
      hand: [],
      discard: [],
      slots: createEmptySlots(state.settings.slotsPerPlayer),
      swapsUsedThisRound: 0,
      tradesUsedThisRound: 0,
      tacticsUsedThisRound: 0,
      ready: false,
    };
    const drawn = drawCardsIntoHand(basePlayer, state.settings.handSize);
    return {
      ...basePlayer,
      ...drawn,
    };
  });

  return {
    state: {
      ...state,
      phase: 'draft_build',
      round: 1,
      players,
      modifiers: [],
      votes: {},
      roundHistory: [],
      winnerIds: [],
      logs: [
        ...state.logs,
        `Игра началась! Раунд 1 из ${state.settings.totalRounds}. Соберите билд в слоты.`,
      ],
    },
  };
}

export function placeComboCard(
  state: ComboGameState,
  playerId: string,
  cardId: string,
  slotIndex: number
): { state: ComboGameState; error?: string } {
  if (state.phase !== 'draft_build') {
    return { state, error: 'Выкладывать карты можно только в фазе сборки.' };
  }
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { state, error: 'Игрок не найден.' };

  const card = player.hand.find((c) => c.id === cardId);
  if (!card) return { state, error: 'Карта не найдена в руке.' };
  if (card.kind === 'tactic') {
    return { state, error: 'Карту тактики нельзя положить в слот билда — её нужно разыграть.' };
  }
  if (slotIndex < 0 || slotIndex >= player.slots.length) {
    return { state, error: 'Некорректный индекс слота.' };
  }

  const existingSlotCard = player.slots[slotIndex].card;
  const nextHand = player.hand.filter((c) => c.id !== cardId);
  if (existingSlotCard && !existingSlotCard.isPenalty) {
    nextHand.push(existingSlotCard);
  }

  const nextSlots = player.slots.map((s, idx) =>
    idx === slotIndex ? { ...s, card, autoFilled: false } : s
  );

  return {
    state: {
      ...state,
      players: state.players.map((p) =>
        p.id === playerId ? { ...p, hand: nextHand, slots: nextSlots, ready: false } : p
      ),
    },
  };
}

export function swapHandCardWithDeck(
  state: ComboGameState,
  playerId: string,
  cardId: string
): { state: ComboGameState; error?: string } {
  if (state.phase !== 'draft_build') {
    return { state, error: 'Сброс и добор доступны только в фазе сборки.' };
  }
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { state, error: 'Игрок не найден.' };
  if (player.swapsUsedThisRound >= state.settings.maxSwapsPerRound) {
    return { state, error: 'Лимит обменов с колодой в этом раунде исчерпан.' };
  }

  const card = player.hand.find((c) => c.id === cardId);
  if (!card) return { state, error: 'Карта не найдена в руке.' };

  const tempPlayer: ComboPlayer = {
    ...player,
    hand: player.hand.filter((c) => c.id !== cardId),
    discard: [...player.discard, card],
  };
  const drawn = drawCardsIntoHand(tempPlayer, 1);

  return {
    state: {
      ...state,
      players: state.players.map((p) =>
        p.id === playerId
          ? {
              ...tempPlayer,
              ...drawn,
              swapsUsedThisRound: p.swapsUsedThisRound + 1,
            }
          : p
      ),
      logs: [...state.logs, `${player.name} сбросил карту и добрал новую из колоды.`],
    },
  };
}

export function tradeCardsBetweenPlayers(
  state: ComboGameState,
  playerId: string,
  myCardId: string,
  targetPlayerId: string,
  targetCardId?: string
): { state: ComboGameState; error?: string } {
  if (state.phase !== 'draft_build') {
    return { state, error: 'Обмен с игроком доступен только в фазе сборки.' };
  }
  if (playerId === targetPlayerId) {
    return { state, error: 'Нельзя обменяться картой с самим собой.' };
  }
  const actor = state.players.find((p) => p.id === playerId);
  const target = state.players.find((p) => p.id === targetPlayerId);
  if (!actor || !target) return { state, error: 'Игрок не найден.' };
  if (actor.tradesUsedThisRound >= state.settings.maxTradesPerRound) {
    return { state, error: 'Лимит слепого обмена с игроком в этом раунде исчерпан (макс. 1).' };
  }

  const myCard = actor.hand.find((c) => c.id === myCardId);
  if (!myCard) return { state, error: 'Ваша карта для обмена не найдена в руке.' };
  if (target.hand.length === 0) {
    return { state, error: `У ${target.name} пустая рука — нечем обменяться.` };
  }

  const theirCard = targetCardId
    ? target.hand.find((c) => c.id === targetCardId)
    : target.hand[Math.floor(Math.random() * target.hand.length)];
  if (!theirCard) return { state, error: 'Карта соперника для обмена не найдена в руке.' };

  return {
    state: {
      ...state,
      players: state.players.map((p) => {
        if (p.id === playerId) {
          return {
            ...p,
            hand: [...p.hand.filter((c) => c.id !== myCardId), theirCard],
            tradesUsedThisRound: p.tradesUsedThisRound + 1,
          };
        }
        if (p.id === targetPlayerId) {
          return {
            ...p,
            hand: [...p.hand.filter((c) => c.id !== theirCard.id), myCard],
          };
        }
        return p;
      }),
      logs: [...state.logs, `${actor.name} и ${target.name} совершили слепой обмен картами из рук.`],
    },
  };
}

export function playTacticCard(
  state: ComboGameState,
  playerId: string,
  cardId: string,
  options?: {
    targetPlayerId?: string;
    slotIndex?: number;
    newCategory?: TraitCategory;
  }
): { state: ComboGameState; error?: string } {
  if (state.phase !== 'draft_build') {
    return { state, error: 'Тактику можно применять только в фазе сборки.' };
  }
  const actor = state.players.find((p) => p.id === playerId);
  if (!actor) return { state, error: 'Игрок не найден.' };
  if (actor.tacticsUsedThisRound >= state.settings.maxTacticsPerRound) {
    return {
      state,
      error: `Лимит карт тактики на раунд исчерпан (макс. ${state.settings.maxTacticsPerRound}).`,
    };
  }

  const card = actor.hand.find((c) => c.id === cardId);
  if (!card || card.kind !== 'tactic' || !card.effect) {
    return { state, error: 'Выбранная карта не является картой тактики.' };
  }

  const effect = card.effect;
  let nextPlayers = state.players.map((p) =>
    p.id === playerId
      ? {
          ...p,
          hand: p.hand.filter((c) => c.id !== cardId),
          discard: [...p.discard, card],
          tacticsUsedThisRound: p.tacticsUsedThisRound + 1,
        }
      : p
  );
  let nextModifiers = [...state.modifiers];
  let logMsg = `${actor.name} применил тактику «${card.title}».`;

  const resolveTargetId = () => {
    if (options?.targetPlayerId && options.targetPlayerId !== playerId) {
      return options.targetPlayerId;
    }
    const idx = state.players.findIndex((p) => p.id === playerId);
    const nextIdx = (idx + 1) % state.players.length;
    return state.players[nextIdx]?.id;
  };

  if (effect.kind === 'neighbor_debuff') {
    const targetId = resolveTargetId();
    const target = nextPlayers.find((p) => p.id === targetId);
    if (!target || target.id === playerId) {
      return { state, error: 'Нет подходящей цели для ослабления.' };
    }
    const mod: ComboModifier = {
      id: nextComboId('mod'),
      sourcePlayerId: playerId,
      targetPlayerId: target.id,
      kind: 'score_debuff',
      value: effect.value,
      duration: effect.duration,
      label: `${card.title} (${effect.value})`,
    };
    nextModifiers = [...nextModifiers, mod];
    logMsg = `${actor.name} ослабил ${target.name} картой «${card.title}» (${effect.value} очков).`;
  } else if (effect.kind === 'curse_opponent_deck') {
    const targetId = resolveTargetId();
    const target = nextPlayers.find((p) => p.id === targetId);
    if (!target || target.id === playerId) {
      return { state, error: 'Нет подходящего соперника для подброса проклятых карт.' };
    }
    const count = Math.max(1, effect.value);
    const curses = Array.from({ length: count }, () => createCursedCard());
    nextPlayers = nextPlayers.map((p) =>
      p.id === target.id ? { ...p, deck: shuffleCards([...p.deck, ...curses]) } : p
    );
    logMsg = `${actor.name} замешал ${count} проклятых карт в колоду ${target.name}!`;
  } else if (effect.kind === 'steal_hand_card') {
    const targetId = resolveTargetId();
    const target = nextPlayers.find((p) => p.id === targetId);
    if (!target || target.id === playerId) {
      return { state, error: 'Соперник не найден.' };
    }
    if (target.hand.length === 0) {
      return { state, error: `У ${target.name} пустая рука — нечего красть.` };
    }
    const stolenIdx = Math.floor(Math.random() * target.hand.length);
    const stolenCard = target.hand[stolenIdx];
    nextPlayers = nextPlayers.map((p) => {
      if (p.id === target.id) {
        return { ...p, hand: p.hand.filter((_, i) => i !== stolenIdx) };
      }
      if (p.id === playerId) {
        return { ...p, hand: [...p.hand, stolenCard] };
      }
      return p;
    });
    logMsg = `${actor.name} украл карту из руки ${target.name}!`;
  } else if (effect.kind === 'draw_cards') {
    const updatedActor = nextPlayers.find((p) => p.id === playerId)!;
    const drawn = drawCardsIntoHand(updatedActor, Math.max(1, effect.value));
    nextPlayers = nextPlayers.map((p) => (p.id === playerId ? { ...p, ...drawn } : p));
    logMsg = `${actor.name} добрал ${effect.value} карт из колоды.`;
  } else if (effect.kind === 'change_category') {
    const updatedActor = nextPlayers.find((p) => p.id === playerId)!;
    const slotIdx = options?.slotIndex ?? updatedActor.slots.findIndex((s) => s.card !== null);
    if (slotIdx === -1 || !updatedActor.slots[slotIdx]?.card) {
      return { state, error: 'Сначала положите карту в слот, чтобы сменить её категорию.' };
    }
    const targetSlot = updatedActor.slots[slotIdx];
    const nextCat = options?.newCategory ?? targetSlot.category;
    nextPlayers = nextPlayers.map((p) =>
      p.id === playerId
        ? {
            ...p,
            slots: p.slots.map((s, idx) =>
              idx === slotIdx && s.card ? { ...s, card: { ...s.card, category: nextCat } } : s
            ),
          }
        : p
    );
    logMsg = `${actor.name} сменил категорию карты в слоте #${slotIdx + 1} на ${nextCat}.`;
  }

  return {
    state: {
      ...state,
      players: nextPlayers,
      modifiers: nextModifiers,
      logs: [...state.logs, logMsg],
    },
  };
}

export function finalizeDraftBuild(state: ComboGameState): ComboGameState {
  if (state.phase !== 'draft_build') return state;

  let autoFilledCount = 0;
  const players = state.players.map((p) => {
    const filledSlots = p.slots.map((slot) => {
      if (slot.card !== null) return slot;
      autoFilledCount += 1;
      return {
        ...slot,
        card: createPenaltySlotCard(slot.category),
        autoFilled: true,
      };
    });
    return {
      ...p,
      slots: filledSlots,
      ready: true,
    };
  });

  const extraNote =
    autoFilledCount > 0
      ? ` Незаполненные слоты (${autoFilledCount}) заполнены штрафными картами.`
      : '';

  const nextVoteState: ComboGameState = {
    ...state,
    phase: 'combo_vote',
    players,
    votes: {},
    logs: [
      ...state.logs,
      `Сборка раунда ${state.round} завершена.${extraNote}${
        players.length < 2 ? '' : ' Начинается слепое голосование (Лайк +25% / Хейт -15%).'
      }`,
    ],
  };

  if (players.length < 2) {
    return resolveComboVoting(nextVoteState);
  }
  return nextVoteState;
}

export function markComboPlayerReady(
  state: ComboGameState,
  playerId: string
): { state: ComboGameState; error?: string } {
  if (state.phase !== 'draft_build') {
    return { state, error: 'Готовность отмечается только в фазе сборки.' };
  }
  if (!state.players.some((p) => p.id === playerId)) {
    return { state, error: 'Игрок не найден.' };
  }

  const nextState: ComboGameState = {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, ready: true } : p)),
  };

  if (nextState.players.every((p) => p.ready)) {
    return { state: finalizeDraftBuild(nextState) };
  }
  return { state: nextState };
}

export function calculateComboScore(
  state: ComboGameState,
  player: ComboPlayer,
  likes = 0,
  hates = 0
): ComboScoreBreakdown {
  let baseTotal = 0;
  let slotMatchBonus = 0;
  let comboBonus = 0;
  let penaltyDelta = 0;
  const notes: string[] = [];

  const placedCards = player.slots.map((s) => s.card).filter((c): c is ComboCard => c !== null);
  const uniqueTags = new Set(placedCards.flatMap((c) => c.tags));

  for (let i = 0; i < player.slots.length; i++) {
    const slot = player.slots[i];
    const card = slot.card;
    if (!card) continue;

    baseTotal += card.baseScore;

    if (slot.autoFilled || card.isPenalty) {
      penaltyDelta -= 2;
      notes.push(`Штраф за пустой слот #${i + 1}: ${card.baseScore - 2} оч.`);
      continue;
    }

    if (card.category === slot.category) {
      slotMatchBonus += 3;
      notes.push(`Совпадение слота #${i + 1} (${slot.category}): +3 оч.`);
    }

    if (card.effect) {
      const eff = card.effect;
      if (eff.kind === 'tag_multiplier' && eff.targetTag) {
        const otherMatches = placedCards.filter(
          (c) => c.id !== card.id && c.tags.includes(eff.targetTag!)
        ).length;
        if (otherMatches > 0) {
          const gain = eff.value * otherMatches;
          comboBonus += gain;
          notes.push(`Комбо «${card.title}» (${eff.targetTag} x${otherMatches}): +${gain} оч.`);
        }
      } else if (eff.kind === 'adjacent_synergy' && eff.targetTag) {
        const left = player.slots[i - 1]?.card;
        const right = player.slots[i + 1]?.card;
        const hasNeighbor =
          Boolean(left?.tags.includes(eff.targetTag)) ||
          Boolean(right?.tags.includes(eff.targetTag));
        if (hasNeighbor) {
          comboBonus += eff.value;
          notes.push(`Соседняя синергия «${card.title}»: +${eff.value} оч.`);
        }
      } else if (eff.kind === 'unique_tags_bonus') {
        const gain = eff.value * uniqueTags.size;
        comboBonus += gain;
        notes.push(`Разнообразие тегов (${uniqueTags.size}): +${gain} оч.`);
      } else if (eff.kind === 'flat_bonus') {
        comboBonus += eff.value;
        notes.push(`${card.title}: ${eff.value >= 0 ? '+' : ''}${eff.value} оч.`);
      }
    }
  }

  let modifierDelta = 0;
  for (const mod of state.modifiers) {
    if (mod.targetPlayerId === player.id) {
      modifierDelta += mod.value;
      notes.push(`Эффект «${mod.label}»: ${mod.value >= 0 ? '+' : ''}${mod.value} оч.`);
    }
  }

  const rawScore = baseTotal + slotMatchBonus + comboBonus + modifierDelta + penaltyDelta;
  const voteMultiplier = Math.max(0.4, Math.round((1 + likes * 0.25 - hates * 0.15) * 100) / 100);
  const finalScore = Math.round(rawScore * voteMultiplier * 10) / 10;

  return {
    baseTotal,
    slotMatchBonus,
    comboBonus,
    modifierDelta,
    penaltyDelta,
    voteMultiplier,
    rawScore,
    finalScore,
    notes,
  };
}

export function resolveComboVoting(state: ComboGameState): ComboGameState {
  if (state.phase !== 'combo_vote') return state;

  const likesCount: Record<string, number> = {};
  const hatesCount: Record<string, number> = {};
  for (const p of state.players) {
    likesCount[p.id] = 0;
    hatesCount[p.id] = 0;
  }

  for (const v of Object.values(state.votes)) {
    if (v.likeTargetId && likesCount[v.likeTargetId] !== undefined) {
      likesCount[v.likeTargetId] += 1;
    }
    if (v.hateTargetId && hatesCount[v.hateTargetId] !== undefined) {
      hatesCount[v.hateTargetId] += 1;
    }
  }

  const unsorted = state.players.map((p) => {
    const likes = likesCount[p.id] ?? 0;
    const hates = hatesCount[p.id] ?? 0;
    const breakdown = calculateComboScore(state, p, likes, hates);
    return { player: p, breakdown, likes, hates };
  });

  unsorted.sort((a, b) => b.breakdown.finalScore - a.breakdown.finalScore);

  const vpAwards = state.players.length <= 2 ? [2, 0] : [3, 2, 1];
  const vpMap: Record<string, number> = {};
  const standings: ComboRoundStanding[] = unsorted.map((entry, idx) => {
    const vpEarned = vpAwards[idx] ?? 0;
    vpMap[entry.player.id] = vpEarned;
    return {
      playerId: entry.player.id,
      playerName: entry.player.name,
      breakdown: entry.breakdown,
      vpEarned,
      totalVp: entry.player.vp + vpEarned,
      likes: entry.likes,
      hates: entry.hates,
    };
  });

  const nextPlayers = state.players.map((p) => ({
    ...p,
    vp: p.vp + (vpMap[p.id] ?? 0),
  }));

  const isFinalRound = state.round >= state.settings.totalRounds;
  let winnerIds: string[] = [];
  if (isFinalRound) {
    const maxVp = Math.max(...nextPlayers.map((p) => p.vp));
    winnerIds = nextPlayers.filter((p) => p.vp === maxVp).map((p) => p.id);
  }

  return {
    ...state,
    phase: isFinalRound ? 'combo_over' : 'combo_result',
    players: nextPlayers,
    roundHistory: [...state.roundHistory, { round: state.round, standings }],
    winnerIds,
    logs: [
      ...state.logs,
      `Итоги раунда ${state.round}: лидер — ${standings[0]?.playerName} (${standings[0]?.breakdown.finalScore} оч., +${standings[0]?.vpEarned} VP).`,
    ],
  };
}

export function castComboVote(
  state: ComboGameState,
  voterId: string,
  likeTargetId?: string,
  hateTargetId?: string
): { state: ComboGameState; error?: string } {
  if (state.phase !== 'combo_vote') {
    return { state, error: 'Голосование сейчас не идёт.' };
  }
  if (!state.players.some((p) => p.id === voterId)) {
    return { state, error: 'Голосующий игрок не найден.' };
  }
  if (likeTargetId === voterId || hateTargetId === voterId) {
    return { state, error: 'Нельзя голосовать за самого себя.' };
  }
  if (likeTargetId && hateTargetId && likeTargetId === hateTargetId) {
    return { state, error: 'Нельзя поставить лайк и хейт одному и тому же игроку.' };
  }

  const nextVotes = {
    ...state.votes,
    [voterId]: { likeTargetId, hateTargetId },
  };

  const updated: ComboGameState = {
    ...state,
    votes: nextVotes,
  };

  if (state.players.every((p) => nextVotes[p.id] !== undefined)) {
    return { state: resolveComboVoting(updated) };
  }

  return { state: updated };
}

export function proceedToNextComboRound(state: ComboGameState): {
  state: ComboGameState;
  error?: string;
} {
  if (state.phase !== 'combo_result') {
    return { state, error: 'Переход к следующему раунду доступен только после итогов.' };
  }
  if (state.round >= state.settings.totalRounds) {
    const maxVp = Math.max(...state.players.map((p) => p.vp));
    return {
      state: {
        ...state,
        phase: 'combo_over',
        winnerIds: state.players.filter((p) => p.vp === maxVp).map((p) => p.id),
      },
    };
  }

  const nextRound = state.round + 1;
  // Clear round-only modifiers, keep persistent ones
  const persistentModifiers = state.modifiers.filter((m) => m.duration === 'persistent');

  const nextPlayers = state.players.map((p) => {
    const usedSlotCards = p.slots
      .map((s) => s.card)
      .filter((c): c is ComboCard => c !== null && !c.isPenalty);
    const updatedBase: ComboPlayer = {
      ...p,
      discard: [...p.discard, ...usedSlotCards],
      slots: createEmptySlots(state.settings.slotsPerPlayer),
      swapsUsedThisRound: 0,
      tradesUsedThisRound: 0,
      tacticsUsedThisRound: 0,
      ready: false,
    };
    const needToDraw = Math.max(0, state.settings.handSize - updatedBase.hand.length);
    const drawn = drawCardsIntoHand(updatedBase, needToDraw);
    return {
      ...updatedBase,
      ...drawn,
    };
  });

  return {
    state: {
      ...state,
      phase: 'draft_build',
      round: nextRound,
      players: nextPlayers,
      modifiers: persistentModifiers,
      votes: {},
      logs: [...state.logs, `Начался раунд ${nextRound} из ${state.settings.totalRounds}!`],
    },
  };
}

export function runComboBotTurn(state: ComboGameState): {
  state: ComboGameState;
  acted: boolean;
} {
  if (state.phase === 'draft_build') {
    const bot = state.players.find((p) => p.isBot && !p.ready);
    if (!bot) return { state, acted: false };

    let nextState = state;

    // 1. Play one tactic card if available
    const tactic = bot.hand.find((c) => c.kind === 'tactic');
    if (tactic) {
      const rivals = nextState.players.filter((p) => p.id !== bot.id);
      const topRival = [...rivals].sort((a, b) => b.vp - a.vp)[0];
      const tacticRes = playTacticCard(nextState, bot.id, tactic.id, {
        targetPlayerId: topRival?.id,
      });
      if (!tacticRes.error) {
        nextState = tacticRes.state;
      }
    }

    // 2. Fill empty slots using best matching cards from hand
    let currentBot = nextState.players.find((p) => p.id === bot.id)!;
    for (let idx = 0; idx < currentBot.slots.length; idx++) {
      if (currentBot.slots[idx].card !== null) continue;
      const buildCards = currentBot.hand.filter((c) => c.kind !== 'tactic');
      if (buildCards.length === 0) break;
      const slotCat = currentBot.slots[idx].category;
      const best = [...buildCards].sort((a, b) => {
        const aScore = a.baseScore + (a.category === slotCat ? 3 : 0);
        const bScore = b.baseScore + (b.category === slotCat ? 3 : 0);
        return bScore - aScore;
      })[0];
      const placeRes = placeComboCard(nextState, bot.id, best.id, idx);
      if (!placeRes.error) {
        nextState = placeRes.state;
        currentBot = nextState.players.find((p) => p.id === bot.id)!;
      }
    }

    const readyRes = markComboPlayerReady(nextState, bot.id);
    return { state: readyRes.state, acted: !readyRes.error };
  }

  if (state.phase === 'combo_vote') {
    const bot = state.players.find((p) => p.isBot && state.votes[p.id] === undefined);
    if (!bot) return { state, acted: false };

    const rivals = state.players
      .filter((p) => p.id !== bot.id)
      .map((r) => ({
        player: r,
        raw: calculateComboScore(state, r).rawScore,
      }))
      .sort((a, b) => b.raw - a.raw);

    if (rivals.length === 0) {
      const res = castComboVote(state, bot.id);
      return { state: res.state, acted: !res.error };
    }

    const hateTargetId = rivals[0].player.id;
    const likeTargetId = rivals.length > 1 ? rivals[rivals.length - 1].player.id : undefined;
    const res = castComboVote(state, bot.id, likeTargetId, hateTargetId);
    return { state: res.state, acted: !res.error };
  }

  return { state, acted: false };
}
