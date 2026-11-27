import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Flame,
  LogOut,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Send,
  Shield,
  SlidersHorizontal,
  Sparkles,
  User,
  Users,
  Vote,
  X,
  Zap,
} from 'lucide-react';
import { getTraitAbility } from '../game/abilities';
import { SKIP_VOTE_ID, evaluateBunkerSurvival } from '../game/engine';
import {
  GamePhase,
  Player,
  PlayerView,
  SpecialCard,
  TRAIT_LABELS,
  TRAIT_ORDER,
  TraitAbilityInfo,
  TraitCategory,
} from '../game/types';

interface GameScreenProps {
  view: PlayerView;
  isHost: boolean;
  errorText: string | null;
  onRevealTrait: (category: TraitCategory) => void;
  onRevealBonusTrait: (bonusId: string) => void;
  onUseSpecial: (cardId: string, targetPlayerId?: string, category?: TraitCategory) => void;
  onUseTraitAbility: (
    category: TraitCategory,
    targetPlayerId?: string,
    targetCategory?: TraitCategory
  ) => void;
  onCastVote: (targetPlayerId: string) => void;
  onSendChat: (text: string) => void;
  onHostNextPhase: () => void;
  onHostAutoReveal: () => void;
  onHostPlayAgain: () => void;
  onHostGetPlayer?: (playerId: string) => Player | null;
  onHostRerollTrait?: (playerId: string, category: TraitCategory) => void;
  onHostUpdateTrait?: (
    playerId: string,
    category: TraitCategory,
    value: string,
    revealed?: boolean
  ) => void;
  onHostRerollBonusTrait?: (playerId: string, bonusId: string) => void;
  onHostUpdateBonusTrait?: (
    playerId: string,
    bonusId: string,
    value: string,
    revealed?: boolean
  ) => void;
  onLeave: () => void;
}

const PHASE_TITLES: Record<GamePhase, string> = {
  lobby: 'Лобби',
  briefing: 'Брифинг катастрофы',
  reveal: 'Вскрытие характеристик',
  discussion: 'Общее обсуждение',
  voting: 'Голосование за изгнание',
  round_result: 'Итоги раунда',
  game_over: 'Двери бункера закрыты',
};

export const GameScreen: React.FC<GameScreenProps> = ({
  view,
  isHost,
  errorText,
  onRevealTrait,
  onRevealBonusTrait,
  onUseSpecial,
  onUseTraitAbility,
  onCastVote,
  onSendChat,
  onHostNextPhase,
  onHostAutoReveal,
  onHostPlayAgain,
  onHostGetPlayer,
  onHostRerollTrait,
  onHostUpdateTrait,
  onHostRerollBonusTrait,
  onHostUpdateBonusTrait,
  onLeave,
}) => {
  const [mobileTab, setMobileTab] = useState<'me' | 'players' | 'bunker' | 'chat'>('me');
  const [chatInput, setChatInput] = useState('');
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [activeSpecial, setActiveSpecial] = useState<SpecialCard | null>(null);
  const [activeAbility, setActiveAbility] = useState<{
    category: TraitCategory;
    info: TraitAbilityInfo;
  } | null>(null);
  const [targetPlayerId, setTargetPlayerId] = useState('');
  const [targetCategory, setTargetCategory] = useState<TraitCategory>('profession');
  const [showMasterPanel, setShowMasterPanel] = useState(false);
  const [masterPlayerId, setMasterPlayerId] = useState('');
  const [masterRevealSpoilers, setMasterRevealSpoilers] = useState(false);
  const [masterEdits, setMasterEdits] = useState<Partial<Record<TraitCategory, string>>>({});
  const [masterBonusEdits, setMasterBonusEdits] = useState<Record<string, string>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (activeSpecial) setActiveSpecial(null);
      else if (activeAbility) setActiveAbility(null);
      else if (showMasterPanel) setShowMasterPanel(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeSpecial, activeAbility, showMasterPanel]);

  useEffect(() => {
    if (!view.phaseEndsAt) {
      setSecondsLeft(null);
      return;
    }
    const update = () => {
      const diff = Math.max(0, Math.ceil((view.phaseEndsAt! - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    update();
    const timer = setInterval(update, 500);
    return () => clearInterval(timer);
  }, [view.phaseEndsAt]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [view.chat.length]);

  const me = view.me;
  const isMyTurn = Boolean(me && me.alive && view.currentTurnPlayerId === me.id);
  const currentTurnPlayer = view.players.find((p) => p.id === view.currentTurnPlayerId);

  const openSpecialModal = (card: SpecialCard) => {
    if (!card.needsTargetPlayer && !card.needsTraitCategory) {
      onUseSpecial(card.id);
      return;
    }
    const allowSelf = card.allowSelfTarget !== false;
    const firstTarget = allowSelf
      ? me?.id ?? view.players.find((p) => p.alive)?.id ?? ''
      : view.players.find((p) => p.alive && p.id !== me?.id)?.id ?? '';
    setTargetPlayerId(firstTarget);
    setTargetCategory('profession');
    setActiveSpecial(card);
  };

  const submitSpecialModal = () => {
    if (!activeSpecial) return;
    onUseSpecial(
      activeSpecial.id,
      activeSpecial.needsTargetPlayer ? targetPlayerId : undefined,
      activeSpecial.needsTraitCategory ? targetCategory : undefined
    );
    setActiveSpecial(null);
  };

  const openAbilityModal = (category: TraitCategory, info: TraitAbilityInfo) => {
    if (!info.needsTargetPlayer && !info.needsTraitCategory) {
      onUseTraitAbility(category);
      return;
    }
    const allowSelf = Boolean(info.canTargetSelf);
    const firstTarget = allowSelf
      ? me?.id ?? view.players.find((p) => p.alive)?.id ?? ''
      : view.players.find((p) => p.alive && p.id !== me?.id)?.id ?? '';
    setTargetPlayerId(firstTarget);
    setTargetCategory('profession');
    setActiveAbility({ category, info });
  };

  const openMasterPanel = () => {
    const firstId = view.players[0]?.id ?? '';
    setMasterPlayerId(firstId);
    setMasterRevealSpoilers(false);
    setMasterEdits({});
    setShowMasterPanel(true);
  };

  const renderMySection = () => (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, flexWrap: 'wrap' }}>
          <User size={18} color="var(--amber)" />
          Мой персонаж
          {me && !me.alive && <span className="badge badge-danger">Изгнан</span>}
          {me && me.alive && me.voteWeight <= 0 && <span className="badge badge-danger">🤐 Лишён голоса</span>}
          {me && me.alive && me.voteWeight > 1 && <span className="badge badge-amber">Голос ×{me.voteWeight}</span>}
        </div>
        {isMyTurn && <span className="badge badge-amber">Ваш ход: вскройте карту!</span>}
      </div>

      {me && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TRAIT_ORDER.map((cat) => {
              const trait = me.traits[cat];
              const isRemoved = Boolean(trait.removed);
              const canReveal =
                view.phase === 'reveal' && isMyTurn && !trait.revealed && !isRemoved && me.alive;
              const ability = isRemoved ? null : getTraitAbility(cat, trait.value);
              const abilityUsed = me.usedTraitAbilities.includes(cat);

              return (
                <div
                  key={cat}
                  className="card-subtle"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    opacity: isRemoved ? 0.55 : 1,
                    borderColor: isRemoved
                      ? 'rgba(239,68,68,0.3)'
                      : trait.revealed
                        ? 'rgba(16,185,129,0.35)'
                        : undefined,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>
                        {TRAIT_LABELS[cat]}
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          wordBreak: 'break-word',
                          textDecoration: isRemoved ? 'line-through' : undefined,
                        }}
                      >
                        {isRemoved ? 'Удалено / Отключено' : trait.value}
                      </div>
                    </div>
                    {isRemoved ? (
                      <span className="badge badge-danger" style={{ flexShrink: 0 }}>
                        Удалено
                      </span>
                    ) : trait.revealed || view.phase === 'game_over' ? (
                      <span className="badge badge-ok" style={{ flexShrink: 0 }}>
                        <Eye size={13} /> {trait.revealed ? 'Вскрыто' : 'Открыто'}
                      </span>
                    ) : canReveal ? (
                      <button
                        className="btn btn-primary"
                        style={{ padding: '7px 12px', fontSize: 12, flexShrink: 0 }}
                        onClick={() => onRevealTrait(cat)}
                      >
                        Вскрыть
                      </button>
                    ) : (
                      <span className="badge" style={{ flexShrink: 0 }}>Скрыто</span>
                    )}
                  </div>

                  {ability && me.alive && view.phase !== 'game_over' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {ability.description}
                        {!trait.revealed && !abilityUsed && ' (сначала вскройте эту характеристику)'}
                      </span>
                      {abilityUsed ? (
                        <span className="badge" style={{ flexShrink: 0 }}>Использовано</span>
                      ) : (
                        <button
                          className="btn btn-outline"
                          disabled={!trait.revealed}
                          title={!trait.revealed ? 'Сначала вскройте эту характеристику' : ability.description}
                          style={{
                            padding: '5px 10px',
                            fontSize: 12,
                            flexShrink: 0,
                            borderColor: trait.revealed ? 'var(--amber)' : 'var(--border)',
                            color: trait.revealed ? 'var(--amber)' : 'var(--muted)',
                            opacity: trait.revealed ? 1 : 0.55,
                          }}
                          onClick={() => openAbilityModal(cat, ability)}
                        >
                          <Zap size={13} /> {ability.title}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {me.bonusTraits && me.bonusTraits.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#34d399' }}>
                Дополнительные поля и трофеи
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {me.bonusTraits.map((bt) => (
                  <div
                    key={bt.id}
                    className="card-subtle"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                      borderColor: bt.revealed || view.phase === 'game_over' ? 'rgba(16,185,129,0.35)' : undefined,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: '#34d399', textTransform: 'uppercase' }}>
                        {bt.label}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-word' }}>
                        {bt.value}
                      </div>
                    </div>
                    {bt.revealed || view.phase === 'game_over' ? (
                      <span className="badge badge-ok" style={{ flexShrink: 0 }}>
                        <Eye size={13} /> {bt.revealed ? 'Вскрыто' : 'Открыто'}
                      </span>
                    ) : me.alive ? (
                      <button
                        className="btn btn-outline"
                        style={{ padding: '5px 10px', fontSize: 12, flexShrink: 0 }}
                        onClick={() => onRevealBonusTrait(bt.id)}
                      >
                        Вскрыть
                      </button>
                    ) : (
                      <span className="badge" style={{ flexShrink: 0 }}>Скрыто</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={16} color="var(--amber)" />
              Спецкарты действий
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
              {me.specialCards.map((sc) => (
                <div key={sc.id} className="card-subtle" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{sc.title}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {sc.isAdult && <span className="badge badge-danger">18+</span>}
                      {sc.used && <span className="badge">Использовано</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', flex: 1 }}>{sc.description}</div>
                  {!sc.used && me.alive && view.phase !== 'game_over' && (
                    <button
                      className="btn btn-outline"
                      style={{ padding: '6px 10px', fontSize: 12 }}
                      onClick={() => openSpecialModal(sc)}
                    >
                      Применить
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderPlayersSection = () => (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
          <Users size={18} color="var(--amber)" />
          Игроки ({view.players.filter((p) => p.alive).length} в игре / {view.bunker?.capacity ?? '?'} мест)
        </div>
        {view.phase === 'voting' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="badge badge-amber">
              Проголосовало: {view.votedPlayerIds.length} из {view.players.filter((p) => p.alive && !p.silenced).length}
            </span>
            {me?.alive && me.voteWeight <= 0 ? (
              <span className="badge badge-danger">🤐 Вы лишены голоса</span>
            ) : (
              <>
                {me?.alive && !view.myVote && (
                  <button
                    className="btn btn-outline"
                    style={{ padding: '4px 10px', fontSize: 12 }}
                    onClick={() => onCastVote(SKIP_VOTE_ID)}
                  >
                    Воздержаться
                  </button>
                )}
                {view.myVote === SKIP_VOTE_ID && (
                  <span className="badge">Вы воздержались</span>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {view.players.map((p) => {
          const isTurn = view.phase === 'reveal' && view.currentTurnPlayerId === p.id;
          const canVoteFor =
            view.phase === 'voting' &&
            me?.alive &&
            me.voteWeight > 0 &&
            p.alive &&
            p.id !== me.id &&
            !view.myVote &&
            (view.tiedCandidates.length === 0 || view.tiedCandidates.includes(p.id));

          return (
            <div
              key={p.id}
              className="card-subtle"
              style={{
                opacity: p.alive ? 1 : 0.55,
                borderColor: isTurn ? 'var(--amber)' : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700 }}>{p.name}</span>
                  {p.id === me?.id && <span className="badge">Вы</span>}
                  {p.hasImmunity && (
                    <span className="badge badge-ok">
                      <Shield size={12} /> Иммунитет
                    </span>
                  )}
                  {p.silenced && <span className="badge badge-danger">🤐 Лишён голоса</span>}
                  {view.phase === 'voting' && view.votedPlayerIds.includes(p.id) && (
                    <span className="badge badge-ok">✓ Голос отдан</span>
                  )}
                  {!p.alive && <span className="badge badge-danger">Изгнан</span>}
                  {!p.connected && <span className="badge">Офлайн</span>}
                  {isTurn && <span className="badge badge-amber">Ходит</span>}
                </div>

                {canVoteFor && (
                  <button
                    className="btn btn-danger"
                    style={{ padding: '6px 12px', fontSize: 12 }}
                    onClick={() => onCastVote(p.id)}
                  >
                    <Vote size={14} /> Изгнать
                  </button>
                )}
                {view.myVote === p.id && <span className="badge badge-danger">Ваш голос</span>}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {TRAIT_ORDER.map((cat) => {
                  if (p.removedCategories.includes(cat)) {
                    return (
                      <span
                        key={cat}
                        className="badge"
                        style={{ opacity: 0.5, textDecoration: 'line-through' }}
                      >
                        {TRAIT_LABELS[cat]}: удалено
                      </span>
                    );
                  }
                  const val = p.revealedTraits[cat];
                  if (!val) return null;
                  return (
                    <span key={cat} className="badge" style={{ color: 'var(--text)', whiteSpace: 'normal' }}>
                      <strong style={{ color: 'var(--amber)' }}>{TRAIT_LABELS[cat]}:</strong> {val}
                    </span>
                  );
                })}
                {p.revealedBonusTraits.map((bt) => (
                  <span key={bt.id} className="badge badge-ok" style={{ color: 'var(--text)', whiteSpace: 'normal' }}>
                    <strong style={{ color: '#34d399' }}>{bt.label}:</strong> {bt.value}
                  </span>
                ))}
                {p.revealedCount === 0 && p.revealedBonusTraits.length === 0 && p.removedCategories.length === 0 && (
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Характеристики ещё не вскрыты
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderBunkerSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {view.catastrophe && (
        <div className="card" style={{ borderColor: 'rgba(239,68,68,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f87171', fontWeight: 700, marginBottom: 6 }}>
            <Flame size={18} />
            КАТАСТРОФА: {view.catastrophe.title}
          </div>
          <p style={{ margin: '0 0 10px 0', fontSize: 14, lineHeight: 1.5 }}>{view.catastrophe.description}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="badge">Срок в бункере: {view.catastrophe.duration}</span>
            <span className="badge">Выживаемость снаружи: {view.catastrophe.survivalRate}</span>
          </div>
        </div>
      )}

      {view.bunker && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={18} color="var(--amber)" />
            Бункер: {view.bunker.areaSqm} м² • Мест: {view.bunker.capacity}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            <strong style={{ color: 'var(--text)' }}>Припасы:</strong> {view.bunker.supplies}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {view.bunker.cards.map((bc) => (
              <div
                key={bc.id}
                className="card-subtle"
                style={{
                  borderColor: (bc.revealed || view.phase === 'game_over') && bc.isThreat ? 'rgba(239,68,68,0.4)' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{bc.title}</span>
                  {bc.revealed || view.phase === 'game_over' ? (
                    <span className={`badge ${bc.isThreat ? 'badge-danger' : 'badge-ok'}`}>
                      {bc.isThreat ? 'Угроза' : 'Ресурс'}
                    </span>
                  ) : (
                    <span className="badge">Скрыто</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{bc.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderChatSection = () => (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
        <MessageSquare size={18} color="var(--amber)" />
        Лог и чат бункера
      </div>

      <div
        style={{
          height: 260,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: 8,
          background: '#0d131c',
          borderRadius: 10,
          border: '1px solid var(--border)',
        }}
      >
        {view.chat.map((m) => (
          <div key={m.id} style={{ fontSize: 13, lineHeight: 1.4 }}>
            {m.isSystem ? (
              <span style={{ color: 'var(--amber)' }}>• {m.text}</span>
            ) : (
              <>
                <strong style={{ color: '#93c5fd' }}>{m.senderName}: </strong>
                <span>{m.text}</span>
              </>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <form
        style={{ display: 'flex', gap: 8 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!chatInput.trim()) return;
          onSendChat(chatInput);
          setChatInput('');
        }}
      >
        <input
          className="input"
          placeholder="Написать в чат…"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" aria-label="Отправить сообщение" style={{ padding: '0 14px' }}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div className="hazard-bar" />

      <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        {/* Header Bar */}
        <div className="card" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="mono badge badge-amber">КОД {view.roomCode}</span>
            <span className="badge">Раунд {view.round}/{view.totalRounds}</span>
            <span className="badge badge-ok">{PHASE_TITLES[view.phase]}</span>
            {secondsLeft !== null && (
              <span className="badge badge-amber mono">
                <Clock size={13} /> {secondsLeft}с
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {isHost && view.phase === 'briefing' && (
              <button className="btn btn-primary" onClick={onHostNextPhase}>
                Начать вскрытие
              </button>
            )}
            {isHost && view.phase === 'reveal' && (
              <button className="btn btn-outline" onClick={onHostAutoReveal}>
                Автоход ({currentTurnPlayer?.name ?? 'игрок'})
              </button>
            )}
            {isHost && view.phase === 'discussion' && (
              <button className="btn btn-primary" onClick={onHostNextPhase}>
                {view.kicksThisRound > 0 ? 'К голосованию' : 'Завершить раунд'}
              </button>
            )}
            {isHost && view.phase === 'voting' && (
              <button className="btn btn-danger" onClick={onHostNextPhase}>
                Подвести итоги
              </button>
            )}
            {isHost && view.phase === 'round_result' && (
              <button className="btn btn-primary" onClick={onHostNextPhase}>
                Следующий раунд
              </button>
            )}
            {isHost && view.phase === 'game_over' && (
              <button className="btn btn-primary" onClick={onHostPlayAgain}>
                <RotateCcw size={15} /> Сыграть ещё
              </button>
            )}
            {isHost && (
              <button
                className="btn btn-outline"
                onClick={openMasterPanel}
                title="Мастер-панель (редактор слотов игроков)"
              >
                <SlidersHorizontal size={15} /> Редактор
              </button>
            )}
            <button className="btn btn-outline" onClick={onLeave} title="Выйти" aria-label="Выйти из комнаты">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Phase / Result Banner */}
        {errorText && (
          <div className="badge badge-danger" style={{ padding: 10 }}>
            <AlertTriangle size={15} /> {errorText}
          </div>
        )}

        {view.phase === 'round_result' && view.lastRoundResult && (
          <div className="card" style={{ borderColor: 'var(--amber)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 700 }}>Итоги раунда {view.lastRoundResult.round}</div>
            <div style={{ fontSize: 14 }}>{view.lastRoundResult.reason}</div>
            {view.lastRoundResult.voteDetails && view.lastRoundResult.voteDetails.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                {view.lastRoundResult.voteDetails.map((vd) => (
                  <span key={vd.voterId} className="badge" style={{ color: 'var(--text)' }}>
                    <strong>{vd.voterName}</strong> → {vd.targetName}
                    {vd.weight > 1 ? ` (×${vd.weight})` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {view.phase === 'game_over' && (() => {
          const survival = evaluateBunkerSurvival(view);
          const verdictBorder =
            survival.status === 'survived'
              ? 'var(--ok)'
              : survival.status === 'losses'
                ? 'var(--amber)'
                : '#ef4444';
          const verdictBg =
            survival.status === 'survived'
              ? 'rgba(16,185,129,0.08)'
              : survival.status === 'losses'
                ? 'rgba(245,158,11,0.08)'
                : 'rgba(239,68,68,0.08)';
          const verdictColor =
            survival.status === 'survived'
              ? '#34d399'
              : survival.status === 'losses'
                ? 'var(--amber)'
                : '#f87171';
          return (
            <div className="card" style={{ borderColor: verdictBorder, background: verdictBg, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 18, color: verdictColor }}>
                  <CheckCircle2 size={22} /> Разбор выживания: {survival.title}
                </div>
                <span className="badge badge-amber mono">Шанс выживания: {survival.score}%</span>
              </div>

              <div style={{ fontSize: 14 }}>
                Внутри остались:{' '}
                <strong>
                  {view.players
                    .filter((p) => p.alive)
                    .map((p) => p.name)
                    .join(', ') || 'никого'}
                </strong>
                . {survival.summary}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                {survival.resolvedThreats.length > 0 && (
                  <div className="card-subtle" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#34d399', marginBottom: 6 }}>
                      Закрытые угрозы и плюсы ({survival.resolvedThreats.length})
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {survival.resolvedThreats.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {survival.unresolvedIssues.length > 0 && (
                  <div className="card-subtle" style={{ borderColor: 'rgba(239,68,68,0.35)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171', marginBottom: 6 }}>
                      Незакрытые проблемы ({survival.unresolvedIssues.length})
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {survival.unresolvedIssues.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Desktop 2-column / Mobile tabbed content */}
        <div className="game-layout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className={mobileTab === 'me' ? '' : 'desktop-only-block'}>
              {(mobileTab === 'me' || window.innerWidth >= 960) && renderMySection()}
            </div>
            <div className={mobileTab === 'chat' ? '' : 'desktop-only-block'}>
              {(mobileTab === 'chat' || window.innerWidth >= 960) && renderChatSection()}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(mobileTab === 'players' || window.innerWidth >= 960) && renderPlayersSection()}
            {(mobileTab === 'bunker' || window.innerWidth >= 960) && renderBunkerSection()}
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <div className="mobile-tabs">
          <button
            className={`btn ${mobileTab === 'me' ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '8px 4px', fontSize: 12 }}
            onClick={() => setMobileTab('me')}
          >
            <User size={15} /> Карта
          </button>
          <button
            className={`btn ${mobileTab === 'players' ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '8px 4px', fontSize: 12 }}
            onClick={() => setMobileTab('players')}
          >
            <Users size={15} /> Игроки
          </button>
          <button
            className={`btn ${mobileTab === 'bunker' ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '8px 4px', fontSize: 12 }}
            onClick={() => setMobileTab('bunker')}
          >
            <Shield size={15} /> Бункер
          </button>
          <button
            className={`btn ${mobileTab === 'chat' ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '8px 4px', fontSize: 12 }}
            onClick={() => setMobileTab('chat')}
          >
            <MessageSquare size={15} /> Чат
          </button>
        </div>
      </div>

      {/* Special Card Modal */}
      {activeSpecial && (() => {
        const specialTargets = view.players.filter(
          (p) => p.alive && (activeSpecial.allowSelfTarget === false ? p.id !== me?.id : true)
        );
        const missingTarget = activeSpecial.needsTargetPlayer && (specialTargets.length === 0 || !targetPlayerId);
        return (
          <div className="modal-backdrop" onClick={() => setActiveSpecial(null)}>
            <div
              className="card"
              style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 12 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: 0 }}>{activeSpecial.title}</h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>{activeSpecial.description}</p>

              {activeSpecial.needsTargetPlayer && (
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)' }}>Выберите игрока</label>
                  {specialTargets.length === 0 ? (
                    <div className="badge badge-danger" style={{ marginTop: 4 }}>Нет доступных целей</div>
                  ) : (
                    <select
                      className="input"
                      value={targetPlayerId}
                      onChange={(e) => setTargetPlayerId(e.target.value)}
                    >
                      {specialTargets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.id === me?.id ? '(Вы)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {activeSpecial.needsTraitCategory && (
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)' }}>Выберите категорию</label>
                  <select
                    className="input"
                    value={targetCategory}
                    onChange={(e) => setTargetCategory(e.target.value as TraitCategory)}
                  >
                    {TRAIT_ORDER.map((cat) => (
                      <option key={cat} value={cat}>
                        {TRAIT_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn btn-outline" onClick={() => setActiveSpecial(null)}>
                  Отмена
                </button>
                <button
                  className="btn btn-primary"
                  disabled={missingTarget}
                  onClick={submitSpecialModal}
                >
                  Применить
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Trait Ability Modal */}
      {activeAbility && (() => {
        const abilityTargets = view.players.filter(
          (p) => p.alive && (activeAbility.info.canTargetSelf ? true : p.id !== me?.id)
        );
        const missingTarget = activeAbility.info.needsTargetPlayer && (abilityTargets.length === 0 || !targetPlayerId);
        return (
          <div className="modal-backdrop" onClick={() => setActiveAbility(null)}>
            <div
              className="card"
              style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 12 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: 0 }}>{activeAbility.info.title}</h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                {activeAbility.info.description}
              </p>
              {activeAbility.info.needsTargetPlayer && (
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)' }}>Выберите игрока</label>
                  {abilityTargets.length === 0 ? (
                    <div className="badge badge-danger" style={{ marginTop: 4 }}>Нет доступных целей</div>
                  ) : (
                    <select
                      className="input"
                      value={targetPlayerId}
                      onChange={(e) => setTargetPlayerId(e.target.value)}
                    >
                      {abilityTargets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.id === me?.id ? '(Вы)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              {activeAbility.info.needsTraitCategory && (
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)' }}>Выберите категорию</label>
                  <select
                    className="input"
                    value={targetCategory}
                    onChange={(e) => setTargetCategory(e.target.value as TraitCategory)}
                  >
                    {TRAIT_ORDER.map((cat) => (
                      <option key={cat} value={cat}>
                        {TRAIT_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn btn-outline" onClick={() => setActiveAbility(null)}>
                  Отмена
                </button>
                <button
                  className="btn btn-primary"
                  disabled={missingTarget}
                  onClick={() => {
                    onUseTraitAbility(
                      activeAbility.category,
                      activeAbility.info.needsTargetPlayer ? targetPlayerId : undefined,
                      activeAbility.info.needsTraitCategory ? targetCategory : undefined
                    );
                    setActiveAbility(null);
                  }}
                >
                  Применить
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Host Master Panel Modal */}
      {showMasterPanel && isHost && (() => {
        const masterTargetPublic = view.players.find((p) => p.id === masterPlayerId);
        const masterFullPlayer = onHostGetPlayer?.(masterPlayerId) ?? null;
        const enabledSet = new Set(view.settings.enabledTraits ?? TRAIT_ORDER);
        const visibleCats = TRAIT_ORDER.filter(
          (cat) => enabledSet.has(cat) && !masterTargetPublic?.removedCategories.includes(cat)
        );
        return (
          <div className="modal-backdrop" onClick={() => setShowMasterPanel(false)}>
            <div
              className="card"
              style={{
                width: '100%',
                maxWidth: 620,
                maxHeight: '85dvh',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0 }}>Мастер-панель хоста</h3>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Редактирование слотов игроков. По умолчанию работает вслепую (без спойлеров).
                  </div>
                </div>
                <button
                  className="btn btn-outline"
                  style={{ padding: 6 }}
                  aria-label="Закрыть редактор"
                  onClick={() => setShowMasterPanel(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  className="input"
                  style={{ flex: 1, minWidth: 180 }}
                  value={masterPlayerId}
                  onChange={(e) => {
                    setMasterPlayerId(e.target.value);
                    setMasterRevealSpoilers(false);
                    setMasterEdits({});
                    setMasterBonusEdits({});
                  }}
                >
                  {view.players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.id === me?.id ? '(Вы)' : ''}
                    </option>
                  ))}
                </select>

                <button
                  className={`btn ${masterRevealSpoilers ? 'btn-danger' : 'btn-outline'}`}
                  onClick={() => {
                    const next = !masterRevealSpoilers;
                    setMasterRevealSpoilers(next);
                    if (next && masterFullPlayer) {
                      const vals: Partial<Record<TraitCategory, string>> = {};
                      for (const c of TRAIT_ORDER) vals[c] = masterFullPlayer.traits[c].value;
                      setMasterEdits(vals);
                      const bVals: Record<string, string> = {};
                      for (const b of masterFullPlayer.bonusTraits) bVals[b.id] = b.value;
                      setMasterBonusEdits(bVals);
                    }
                  }}
                >
                  <Eye size={15} />
                  {masterRevealSpoilers ? 'Скрыть статы' : 'Показать вручную (спойлер)'}
                </button>
              </div>

              <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {visibleCats.map((cat) => {
                  const trait = masterRevealSpoilers ? masterFullPlayer?.traits[cat] : null;
                  return (
                    <div key={cat} className="card-subtle" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <strong style={{ fontSize: 12, color: 'var(--amber)' }}>
                          {TRAIT_LABELS[cat]}
                        </strong>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => {
                            onHostRerollTrait?.(masterPlayerId, cat);
                            if (masterRevealSpoilers && onHostGetPlayer) {
                              const updated = onHostGetPlayer(masterPlayerId);
                              if (updated) {
                                setMasterEdits((prev) => ({ ...prev, [cat]: updated.traits[cat].value }));
                              }
                            }
                          }}
                        >
                          <RefreshCw size={12} /> Перероллить вслепую
                        </button>
                      </div>

                      {masterRevealSpoilers && trait && (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            className="input"
                            style={{ padding: '6px 10px', fontSize: 13 }}
                            value={masterEdits[cat] ?? trait.value}
                            onChange={(e) =>
                              setMasterEdits((prev) => ({ ...prev, [cat]: e.target.value }))
                            }
                          />
                          <button
                            className="btn btn-primary"
                            style={{ padding: '6px 10px', fontSize: 12 }}
                            onClick={() =>
                              onHostUpdateTrait?.(
                                masterPlayerId,
                                cat,
                                masterEdits[cat] ?? trait.value
                              )
                            }
                          >
                            Сохр.
                          </button>
                          <button
                            className={`badge ${trait.revealed ? 'badge-ok' : ''}`}
                            style={{ cursor: 'pointer', flexShrink: 0 }}
                            onClick={() =>
                              onHostUpdateTrait?.(
                                masterPlayerId,
                                cat,
                                masterEdits[cat] ?? trait.value,
                                !trait.revealed
                              )
                            }
                          >
                            {trait.revealed ? 'Открыто' : 'Скрыто'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {masterFullPlayer && masterFullPlayer.bonusTraits.length > 0 && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#34d399', marginTop: 4 }}>
                      Дополнительные и кастомные поля
                    </div>
                    {masterFullPlayer.bonusTraits.map((bt) => (
                      <div key={bt.id} className="card-subtle" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <strong style={{ fontSize: 12, color: '#34d399' }}>
                            {bt.label}
                          </strong>
                          <button
                            className="btn btn-outline"
                            style={{ padding: '4px 10px', fontSize: 12 }}
                            onClick={() => {
                              onHostRerollBonusTrait?.(masterPlayerId, bt.id);
                              if (masterRevealSpoilers && onHostGetPlayer) {
                                const updated = onHostGetPlayer(masterPlayerId);
                                const updBonus = updated?.bonusTraits.find((b) => b.id === bt.id);
                                if (updBonus) {
                                  setMasterBonusEdits((prev) => ({ ...prev, [bt.id]: updBonus.value }));
                                }
                              }
                            }}
                          >
                            <RefreshCw size={12} /> Перероллить вслепую
                          </button>
                        </div>

                        {masterRevealSpoilers && (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                              className="input"
                              style={{ padding: '6px 10px', fontSize: 13 }}
                              value={masterBonusEdits[bt.id] ?? bt.value}
                              onChange={(e) =>
                                setMasterBonusEdits((prev) => ({ ...prev, [bt.id]: e.target.value }))
                              }
                            />
                            <button
                              className="btn btn-primary"
                              style={{ padding: '6px 10px', fontSize: 12 }}
                              onClick={() =>
                                onHostUpdateBonusTrait?.(
                                  masterPlayerId,
                                  bt.id,
                                  masterBonusEdits[bt.id] ?? bt.value
                                )
                              }
                            >
                              Сохр.
                            </button>
                            <button
                              className={`badge ${bt.revealed ? 'badge-ok' : ''}`}
                              style={{ cursor: 'pointer', flexShrink: 0 }}
                              onClick={() =>
                                onHostUpdateBonusTrait?.(
                                  masterPlayerId,
                                  bt.id,
                                  masterBonusEdits[bt.id] ?? bt.value,
                                  !bt.revealed
                                )
                              }
                            >
                              {bt.revealed ? 'Открыто' : 'Скрыто'}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
