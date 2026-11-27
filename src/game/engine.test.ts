import { describe, expect, it } from 'vitest';
import { ALL_PACKS, EXPERTISE_LEVELS, mergePacks } from './data';
import { GameState } from './types';
import {
  SKIP_VOTE_ID,
  addOrReconnectPlayer,
  castVote,
  computeKicksSchedule,
  createInitialState,
  getPlayerView,
  hostRerollPlayerTrait,
  hostUpdatePlayerTrait,
  proceedAfterRoundResult,
  revealTrait,
  startGame,
  startRevealPhase,
  startVotingPhase,
  useTraitAbility,
} from './engine';

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
});
