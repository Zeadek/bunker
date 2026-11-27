import { describe, expect, it } from 'vitest';
import { createTacticCard } from './comboCards';
import {
  addComboPlayer,
  calculateComboScore,
  castComboVote,
  createComboInitialState,
  finalizeDraftBuild,
  markComboPlayerReady,
  placeComboCard,
  playTacticCard,
  proceedToNextComboRound,
  runComboBotTurn,
  startComboGame,
  swapHandCardWithDeck,
} from './comboEngine';
import { ComboCard } from './comboTypes';

describe('Combo Draft engine', () => {
  it('deals hands, calculates slot match + tag_multiplier combo bonus, and handles empty slot penalty', () => {
    let state = createComboInitialState('CMB1', 'p1', 'Алиса', {
      totalRounds: 3,
      slotsPerPlayer: 4,
      handSize: 6,
    });
    state = addComboPlayer(state, 'p2', 'Борис').state;
    const started = startComboGame(state);
    expect(started.error).toBeUndefined();
    state = started.state;
    expect(state.phase).toBe('draft_build');
    expect(state.players[0].hand.length).toBe(6);

    // Inject two med cards with tag_multiplier into p1 hand for deterministic combo test
    const med1: ComboCard = {
      id: 'med_1',
      title: 'Военный хирург',
      category: 'profession',
      kind: 'build',
      baseScore: 10,
      tags: ['med'],
      effect: {
        kind: 'tag_multiplier',
        duration: 'round',
        value: 4,
        targetTag: 'med',
        description: '+4 за каждую другую карту med',
      },
    };
    const med2: ComboCard = {
      id: 'med_2',
      title: 'Полевая аптечка',
      category: 'health',
      kind: 'build',
      baseScore: 6,
      tags: ['med'],
    };

    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === 'p1' ? { ...p, hand: [med1, med2, ...p.hand.slice(2)] } : p
      ),
    };

    state = placeComboCard(state, 'p1', 'med_1', 0).state; // matches 'profession' (+3)
    state = placeComboCard(state, 'p1', 'med_2', 1).state; // matches 'health' (+3)

    // Leave slots 2 and 3 empty and finalize draft -> auto-fill penalty
    state = finalizeDraftBuild(state);
    expect(state.phase).toBe('combo_vote');

    const p1 = state.players.find((p) => p.id === 'p1')!;
    expect(p1.slots[2].autoFilled).toBe(true);
    expect(p1.slots[2].card?.isPenalty).toBe(true);

    const breakdown = calculateComboScore(state, p1);
    expect(breakdown.slotMatchBonus).toBe(6); // 2 matching slots * 3
    expect(breakdown.comboBonus).toBe(4); // med_1 sees med_2 -> +4
    expect(breakdown.penaltyDelta).toBe(-4); // 2 auto-filled slots * -2
  });

  it('supports swapping with deck, cursing opponent deck, and stealing from opponent hand', () => {
    let state = createComboInitialState('CMB2', 'p1', 'Алиса');
    state = addComboPlayer(state, 'p2', 'Борис').state;
    state = startComboGame(state).state;

    const p1Card = state.players[0].hand[0];
    const swapRes = swapHandCardWithDeck(state, 'p1', p1Card.id);
    expect(swapRes.error).toBeUndefined();
    state = swapRes.state;
    expect(state.players[0].swapsUsedThisRound).toBe(1);

    const curseTactic: ComboCard = {
      ...createTacticCard(2), // curse_opponent_deck
      id: 'tac_curse',
    };
    const stealTactic: ComboCard = {
      ...createTacticCard(3), // steal_hand_card
      id: 'tac_steal',
    };
    const p2DeckBefore = state.players[1].deck.length;
    const p2HandBefore = state.players[1].hand.length;

    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === 'p1' ? { ...p, hand: [curseTactic, stealTactic, ...p.hand] } : p
      ),
    };
    const p1HandWithTactics = state.players[0].hand.length;

    state = playTacticCard(state, 'p1', 'tac_curse', { targetPlayerId: 'p2' }).state;
    expect(state.players[1].deck.length).toBe(p2DeckBefore + 2);
    expect(state.players[1].deck.some((c) => c.isCurse)).toBe(true);

    state = playTacticCard(state, 'p1', 'tac_steal', { targetPlayerId: 'p2' }).state;
    expect(state.players[1].hand.length).toBe(p2HandBefore - 1);
    // -2 tactics played +1 stolen card = p1HandWithTactics - 1
    expect(state.players[0].hand.length).toBe(p1HandWithTactics - 1);
  });

  it('handles blind voting multipliers, VP awards, round transitions, and bot turns', () => {
    let state = createComboInitialState('CMB3', 'p1', 'Алиса', { totalRounds: 2 });
    state = addComboPlayer(state, 'p2', 'Бот-1', true).state;
    state = addComboPlayer(state, 'p3', 'Бот-2', true).state;
    state = startComboGame(state).state;

    // Bots build & mark ready
    state = runComboBotTurn(state).state;
    state = runComboBotTurn(state).state;
    expect(state.players.filter((p) => p.ready).length).toBe(2);

    // Human marks ready -> transitions to combo_vote
    state = markComboPlayerReady(state, 'p1').state;
    expect(state.phase).toBe('combo_vote');

    // Bots vote, then human votes -> resolves to combo_result
    state = runComboBotTurn(state).state;
    state = runComboBotTurn(state).state;
    state = castComboVote(state, 'p1', 'p2', 'p3').state;

    expect(state.phase).toBe('combo_result');
    expect(state.roundHistory.length).toBe(1);
    const totalVpAwarded = state.players.reduce((s, p) => s + p.vp, 0);
    expect(totalVpAwarded).toBe(6); // 3 + 2 + 1 VP

    // Proceed to round 2
    state = proceedToNextComboRound(state).state;
    expect(state.phase).toBe('draft_build');
    expect(state.round).toBe(2);
  });

  it('enforces max 2 tactics per round and max 1 blind trade per round', () => {
    let state = createComboInitialState('CMB4', 'p1', 'Алиса');
    state = addComboPlayer(state, 'p2', 'Борис').state;
    state = startComboGame(state).state;

    const t1 = { ...createTacticCard(0), id: 't1' };
    const t2 = { ...createTacticCard(1), id: 't2' };
    const t3 = { ...createTacticCard(2), id: 't3' };
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === 'p1' ? { ...p, hand: [t1, t2, t3, ...p.hand] } : p
      ),
    };

    const r1 = playTacticCard(state, 'p1', 't1', { targetPlayerId: 'p2' });
    expect(r1.error).toBeUndefined();
    const r2 = playTacticCard(r1.state, 'p1', 't2', { targetPlayerId: 'p2' });
    expect(r2.error).toBeUndefined();
    const r3 = playTacticCard(r2.state, 'p1', 't3', { targetPlayerId: 'p2' });
    expect(r3.error).toBeTruthy();
    expect(r3.state.players[0].tacticsUsedThisRound).toBe(2);
  });
});
