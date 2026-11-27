import { describe, expect, it } from 'vitest';
import { ALL_PACKS, mergePacks } from './data';
import {
  addOrReconnectPlayer,
  castVote,
  computeKicksSchedule,
  createInitialState,
  getPlayerView,
  proceedAfterRoundResult,
  revealTrait,
  startGame,
  startRevealPhase,
  startVotingPhase,
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

    // Each player reveals in turn order
    for (let i = 0; i < 4; i++) {
      const currentId = state.turnOrder[state.currentTurnIndex];
      const res = revealTrait(state, currentId, 'profession');
      expect(res.error).toBeUndefined();
      state = res.state;
    }

    expect(state.phase).toBe('discussion');

    // Round 1 has 0 kicks -> moves to round_result / game check
    state = startVotingPhase(state);
    expect(state.phase).toBe('round_result');

    // Advance to Round 2
    state = proceedAfterRoundResult(state, true);
    expect(state.round).toBe(2);
    expect(state.phase).toBe('reveal');

    // Reveal in Round 2
    for (let i = 0; i < 4; i++) {
      const currentId = state.turnOrder[state.currentTurnIndex];
      state = revealTrait(state, currentId, 'health').state;
    }
    expect(state.phase).toBe('discussion');

    // Vote in Round 2 (1 kick)
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

  it('supports fantasy pack and merging both packs', () => {
    const merged = mergePacks(['classic', 'fantasy']);
    expect(merged.catastrophes.length).toBe(
      ALL_PACKS.classic.catastrophes.length + ALL_PACKS.fantasy.catastrophes.length
    );
    expect(merged.traits.profession.length).toBe(
      ALL_PACKS.classic.traits.profession.length + ALL_PACKS.fantasy.traits.profession.length
    );

    let state = createInitialState('FANT1', 'p1', 'Маг');
    state = addOrReconnectPlayer(state, 'p2', 'Орк').state;
    state = { ...state, settings: { ...state.settings, packs: ['fantasy'] } };
    const started = startGame(state).state;

    expect(ALL_PACKS.fantasy.catastrophes.some((c) => c.id === started.catastrophe?.id)).toBe(true);
    expect(ALL_PACKS.fantasy.traits.profession).toContain(started.players[0].traits.profession.value);
    expect(ALL_PACKS.fantasy.traits.biology).toContain(started.players[0].traits.biology.value);
  });
});
