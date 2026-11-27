import { CardTag } from '../scoring';
import { AdultIntensity, PackId, TraitCategory } from '../types';

export type ComboPhase =
  | 'lobby'
  | 'draft_build'
  | 'combo_vote'
  | 'combo_result'
  | 'combo_over';

export type ComboCardKind = 'build' | 'tactic' | 'curse' | 'penalty';

export type ComboEffectKind =
  | 'tag_multiplier'
  | 'adjacent_synergy'
  | 'unique_tags_bonus'
  | 'neighbor_debuff'
  | 'change_category'
  | 'draw_cards'
  | 'steal_hand_card'
  | 'curse_opponent_deck'
  | 'flat_bonus';

export type ComboEffectDuration = 'round' | 'persistent';

export interface ComboCardEffect {
  kind: ComboEffectKind;
  duration: ComboEffectDuration;
  value: number;
  targetTag?: CardTag;
  description: string;
}

export interface ComboCard {
  id: string;
  title: string;
  category: TraitCategory;
  kind: ComboCardKind;
  baseScore: number;
  tags: CardTag[];
  effect?: ComboCardEffect;
  isCurse?: boolean;
  isPenalty?: boolean;
}

export interface ComboSlot {
  index: number;
  category: TraitCategory;
  card: ComboCard | null;
  autoFilled: boolean;
}

export interface ComboModifier {
  id: string;
  sourcePlayerId: string;
  targetPlayerId: string;
  kind: 'score_debuff' | 'score_buff';
  value: number;
  duration: ComboEffectDuration;
  label: string;
}

export interface ComboScoreBreakdown {
  baseTotal: number;
  slotMatchBonus: number;
  comboBonus: number;
  modifierDelta: number;
  penaltyDelta: number;
  voteMultiplier: number;
  rawScore: number;
  finalScore: number;
  notes: string[];
}

export type ComboVoteChoice = 'like' | 'hate';

export interface ComboPlayerVotes {
  likeTargetId?: string;
  hateTargetId?: string;
}

export interface ComboRoundStanding {
  playerId: string;
  playerName: string;
  breakdown: ComboScoreBreakdown;
  vpEarned: number;
  totalVp: number;
  likes: number;
  hates: number;
}

export interface ComboRoundResult {
  round: number;
  standings: ComboRoundStanding[];
}

export interface ComboPlayer {
  id: string;
  name: string;
  isHost: boolean;
  isBot?: boolean;
  vp: number;
  deck: ComboCard[];
  hand: ComboCard[];
  discard: ComboCard[];
  slots: ComboSlot[];
  swapsUsedThisRound: number;
  tradesUsedThisRound: number;
  tacticsUsedThisRound: number;
  ready: boolean;
}

export interface ComboSettings {
  packs: PackId[];
  enableAdultContent: boolean;
  adultIntensity: AdultIntensity;
  totalRounds: number;
  slotsPerPlayer: number;
  handSize: number;
  deckSize: number;
  maxSwapsPerRound: number;
  maxTradesPerRound: number;
  maxTacticsPerRound: number;
}

export interface ComboGameState {
  roomCode: string;
  phase: ComboPhase;
  round: number;
  settings: ComboSettings;
  players: ComboPlayer[];
  modifiers: ComboModifier[];
  votes: Record<string, ComboPlayerVotes>;
  roundHistory: ComboRoundResult[];
  winnerIds: string[];
  logs: string[];
}
