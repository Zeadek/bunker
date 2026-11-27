export type TraitCategory =
  | 'profession'
  | 'biology'
  | 'health'
  | 'hobby'
  | 'luggage'
  | 'fact'
  | 'phobia';

export const TRAIT_LABELS: Record<TraitCategory, string> = {
  profession: 'Профессия',
  biology: 'Биология',
  health: 'Здоровье',
  hobby: 'Хобби',
  luggage: 'Багаж',
  fact: 'Факт / Черта',
  phobia: 'Фобия',
};

export const TRAIT_ORDER: TraitCategory[] = [
  'profession',
  'biology',
  'health',
  'hobby',
  'luggage',
  'fact',
  'phobia',
];

export interface TraitCard {
  category: TraitCategory;
  value: string;
  revealed: boolean;
}

export type SpecialCardType =
  | 'swap_trait'
  | 'heal'
  | 'reroll_profession'
  | 'force_reveal'
  | 'double_vote'
  | 'immunity'
  | 'reroll_luggage'
  | 'reveal_bunker';

export interface SpecialCard {
  id: string;
  type: SpecialCardType;
  title: string;
  description: string;
  used: boolean;
  needsTargetPlayer?: boolean;
  needsTraitCategory?: boolean;
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  alive: boolean;
  traits: Record<TraitCategory, TraitCard>;
  specialCards: SpecialCard[];
  revealedThisRound: boolean;
  hasImmunity: boolean;
  voteWeight: number;
}

export interface PublicPlayer {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  alive: boolean;
  revealedTraits: Partial<Record<TraitCategory, string>>;
  revealedCount: number;
  revealedThisRound: boolean;
  hasImmunity: boolean;
}

export interface Catastrophe {
  id: string;
  title: string;
  description: string;
  duration: string;
  survivalRate: string;
}

export interface BunkerCard {
  id: string;
  title: string;
  description: string;
  isThreat: boolean;
  revealed: boolean;
}

export interface BunkerInfo {
  areaSqm: number;
  capacity: number;
  supplies: string;
  cards: BunkerCard[];
}

export type GamePhase =
  | 'lobby'
  | 'briefing'
  | 'reveal'
  | 'discussion'
  | 'voting'
  | 'round_result'
  | 'game_over';

export interface GameSettings {
  maxPlayers: number;
  bunkerSeats: number; // 0 = auto floor(players / 2)
  turnSeconds: number;
  discussionSeconds: number;
  votingSeconds: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface RoundResult {
  round: number;
  exiledIds: string[];
  exiledNames: string[];
  wasTie: boolean;
  reason: string;
}

export interface GameState {
  roomCode: string;
  phase: GamePhase;
  round: number;
  totalRounds: number;
  kicksPerRound: number[];
  settings: GameSettings;
  players: Player[];
  turnOrder: string[];
  currentTurnIndex: number;
  phaseEndsAt: number | null;
  catastrophe: Catastrophe | null;
  bunker: BunkerInfo | null;
  votes: Record<string, string>; // voterId -> targetId
  tiedCandidates: string[];
  lastRoundResult: RoundResult | null;
  chat: ChatMessage[];
}

export interface PlayerView {
  roomCode: string;
  phase: GamePhase;
  round: number;
  totalRounds: number;
  kicksThisRound: number;
  settings: GameSettings;
  me: Player | null;
  players: PublicPlayer[];
  currentTurnPlayerId: string | null;
  phaseEndsAt: number | null;
  catastrophe: Catastrophe | null;
  bunker: {
    areaSqm: number;
    capacity: number;
    supplies: string;
    cards: Array<{ id: string; title: string; description: string; isThreat: boolean; revealed: boolean }>;
  } | null;
  votedPlayerIds: string[];
  myVote: string | null;
  tiedCandidates: string[];
  lastRoundResult: RoundResult | null;
  chat: ChatMessage[];
}

// P2P Protocol Messages
export type ClientAction =
  | { type: 'HELLO'; playerId: string; name: string }
  | { type: 'REVEAL_TRAIT'; category: TraitCategory }
  | {
      type: 'USE_SPECIAL';
      cardId: string;
      targetPlayerId?: string;
      category?: TraitCategory;
    }
  | { type: 'CAST_VOTE'; targetPlayerId: string }
  | { type: 'CHAT'; text: string };

export type HostPacket =
  | { type: 'STATE_SYNC'; view: PlayerView }
  | { type: 'ERROR'; message: string };
