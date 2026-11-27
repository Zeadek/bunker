import type { ComboGameState } from './combo/comboTypes';

export type TraitCategory =
  | 'profession'
  | 'biology'
  | 'physiology'
  | 'health'
  | 'hobby'
  | 'gear'
  | 'pocket'
  | 'fact'
  | 'phobia'
  | 'extra';

export const TRAIT_LABELS: Record<TraitCategory, string> = {
  profession: 'Профессия',
  biology: 'Биология',
  physiology: 'Физиология',
  health: 'Здоровье',
  hobby: 'Хобби',
  gear: 'Крупный багаж',
  pocket: 'Мелкий инвентарь',
  fact: 'Факт / Черта',
  phobia: 'Фобия',
  extra: 'Доп. информация',
};

export const TRAIT_ORDER: TraitCategory[] = [
  'profession',
  'biology',
  'physiology',
  'health',
  'hobby',
  'gear',
  'pocket',
  'fact',
  'phobia',
  'extra',
];

export interface TraitCard {
  category: TraitCategory;
  value: string;
  revealed: boolean;
  removed?: boolean;
}

export interface BonusTrait {
  id: string;
  label: string;
  value: string;
  revealed: boolean;
}

export type TraitAbilityKind =
  | 'heal'
  | 'harm'
  | 'infect'
  | 'repair_bunker'
  | 'reveal_bunker'
  | 'scout'
  | 'steal_pocket'
  | 'calm_phobia'
  | 'erase_field'
  | 'craft_bonus'
  | 'boost_vote'
  | 'silence_vote'
  | 'protect'
  | 'mutate_health';

export interface TraitAbilityInfo {
  kind: TraitAbilityKind;
  title: string;
  description: string;
  needsTargetPlayer: boolean;
  canTargetSelf?: boolean;
  needsTraitCategory?: boolean;
  allowedCategories?: TraitCategory[];
}

export type SpecialCardType =
  | 'heal'
  | 'harm_virus'
  | 'swap_trait'
  | 'steal_gear'
  | 'reroll_profession'
  | 'reroll_target_trait'
  | 'reroll_all_health'
  | 'force_reveal'
  | 'double_vote'
  | 'silence_vote'
  | 'immunity'
  | 'banish_add_kick'
  | 'skip_round_kick'
  | 'reroll_luggage'
  | 'reveal_bunker'
  | 'sabotage_bunker'
  | 'add_bonus_trait'
  | 'remove_trait'
  | 'clone_trait'
  | 'cursed_truth'
  | 'russian_roulette'
  | 'bribe_bunker'
  | 'truth_or_dare'
  | 'dark_deal'
  | 'organ_harvest'
  | 'expand_bunker'
  | 'shrink_bunker'
  | 'revive_exiled';

export interface SpecialCard {
  id: string;
  type: SpecialCardType;
  title: string;
  description: string;
  used: boolean;
  isAdult?: boolean;
  needsTargetPlayer?: boolean;
  allowSelfTarget?: boolean;
  allowDeadTarget?: boolean;
  needsTraitCategory?: boolean;
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isBot?: boolean;
  isEasterEgg?: boolean;
  connected: boolean;
  alive: boolean;
  traits: Record<TraitCategory, TraitCard>;
  bonusTraits: BonusTrait[];
  specialCards: SpecialCard[];
  usedTraitAbilities: TraitCategory[];
  revealedThisRound: boolean;
  hasImmunity: boolean;
  voteWeight: number;
}

export interface PublicPlayer {
  id: string;
  name: string;
  isHost: boolean;
  isBot?: boolean;
  isEasterEgg?: boolean;
  connected: boolean;
  alive: boolean;
  revealedTraits: Partial<Record<TraitCategory, string>>;
  revealedBonusTraits: Array<{ id: string; label: string; value: string }>;
  removedCategories: TraitCategory[];
  revealedCount: number;
  revealedThisRound: boolean;
  hasImmunity: boolean;
  silenced: boolean;
}

export interface Catastrophe {
  id: string;
  title: string;
  description: string;
  duration: string;
  survivalRate: string;
  isAdult?: boolean;
}

export interface BunkerFeature {
  title: string;
  description: string;
  isThreat: boolean;
  isAdult?: boolean;
}

export interface BunkerCard {
  id: string;
  title: string;
  description: string;
  isThreat: boolean;
  revealed: boolean;
}

export type BunkerRoomStatus = 'ok' | 'damaged' | 'locked';

export interface BunkerRoom {
  id: string;
  name: string;
  status: BunkerRoomStatus;
  effect: string;
}

export interface BunkerStats {
  energy: number;
  supplies: number;
  defense: number;
  morale: number;
}

export interface BunkerInfo {
  title: string;
  location: string;
  layoutNote: string;
  areaSqm: number;
  capacity: number;
  supplies: string;
  rooms: BunkerRoom[];
  stats: BunkerStats;
  cards: BunkerCard[];
}

export type PackId = 'classic' | 'fantasy';

export interface PackContentBlock {
  catastrophes: Catastrophe[];
  bunkerFeatures: BunkerFeature[];
  supplies: string[];
  traits: Record<TraitCategory, string[]>;
}

export interface GamePack extends PackContentBlock {
  id: PackId;
  name: string;
  description: string;
  adult: PackContentBlock;
}

export type GamePhase =
  | 'lobby'
  | 'briefing'
  | 'reveal'
  | 'discussion'
  | 'voting'
  | 'round_result'
  | 'game_over';

export interface CustomFieldDef {
  id: string;
  label: string;
  pool: string[];
}

export type AdultIntensity = 'mixed' | 'high' | 'only';

export type GameMode = 'classic' | 'combo';

export interface GameSettings {
  gameMode?: GameMode;
  comboRounds?: number;
  packs: PackId[];
  enableAdultContent: boolean;
  adultIntensity?: AdultIntensity;
  enabledTraits: TraitCategory[];
  customFields: CustomFieldDef[];
  specialCardsPerPlayer: number;
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

export interface VoteDetail {
  voterId: string;
  voterName: string;
  targetId: string;
  targetName: string;
  weight: number;
}

export interface RoundResult {
  round: number;
  exiledIds: string[];
  exiledNames: string[];
  wasTie: boolean;
  reason: string;
  voteDetails?: VoteDetail[];
}

export type SurvivalVerdictStatus = 'survived' | 'losses' | 'fallen';

export interface SurvivalEvaluation {
  status: SurvivalVerdictStatus;
  title: string;
  score: number;
  resolvedThreats: string[];
  unresolvedIssues: string[];
  summary: string;
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
  bunker: BunkerInfo | null;
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
  | { type: 'REVEAL_BONUS_TRAIT'; bonusId: string }
  | {
      type: 'USE_SPECIAL';
      cardId: string;
      targetPlayerId?: string;
      category?: TraitCategory;
    }
  | {
      type: 'USE_TRAIT_ABILITY';
      category: TraitCategory;
      targetPlayerId?: string;
      targetCategory?: TraitCategory;
    }
  | { type: 'CAST_VOTE'; targetPlayerId: string }
  | { type: 'CHAT'; text: string }
  | { type: 'COMBO_PLACE_CARD'; cardId: string; slotIndex: number }
  | { type: 'COMBO_SWAP_DECK'; cardId: string }
  | { type: 'COMBO_BLIND_TRADE'; myCardId: string; targetPlayerId: string }
  | {
      type: 'COMBO_PLAY_TACTIC';
      cardId: string;
      targetPlayerId?: string;
      slotIndex?: number;
      newCategory?: TraitCategory;
    }
  | { type: 'COMBO_READY' }
  | { type: 'COMBO_VOTE'; likeTargetId?: string; hateTargetId?: string };

export type HostPacket =
  | { type: 'STATE_SYNC'; view: PlayerView }
  | { type: 'COMBO_STATE_SYNC'; comboState: ComboGameState }
  | { type: 'ERROR'; message: string };
