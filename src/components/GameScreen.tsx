import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Flame,
  LogOut,
  MessageSquare,
  RotateCcw,
  Send,
  Shield,
  Sparkles,
  User,
  Users,
  Vote,
} from 'lucide-react';
import {
  GamePhase,
  PlayerView,
  SpecialCard,
  TRAIT_LABELS,
  TRAIT_ORDER,
  TraitCategory,
} from '../game/types';

interface GameScreenProps {
  view: PlayerView;
  isHost: boolean;
  errorText: string | null;
  onRevealTrait: (category: TraitCategory) => void;
  onUseSpecial: (cardId: string, targetPlayerId?: string, category?: TraitCategory) => void;
  onCastVote: (targetPlayerId: string) => void;
  onSendChat: (text: string) => void;
  onHostNextPhase: () => void;
  onHostAutoReveal: () => void;
  onHostPlayAgain: () => void;
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
  onUseSpecial,
  onCastVote,
  onSendChat,
  onHostNextPhase,
  onHostAutoReveal,
  onHostPlayAgain,
  onLeave,
}) => {
  const [mobileTab, setMobileTab] = useState<'me' | 'players' | 'bunker' | 'chat'>('me');
  const [chatInput, setChatInput] = useState('');
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [activeSpecial, setActiveSpecial] = useState<SpecialCard | null>(null);
  const [targetPlayerId, setTargetPlayerId] = useState('');
  const [targetCategory, setTargetCategory] = useState<TraitCategory>('profession');
  const chatEndRef = useRef<HTMLDivElement>(null);

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
    const firstTarget = view.players.find((p) => p.alive && p.id !== me?.id)?.id ?? me?.id ?? '';
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

  const renderMySection = () => (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
          <User size={18} color="var(--amber)" />
          Мой персонаж {me && !me.alive && <span className="badge badge-danger">Изгнан</span>}
        </div>
        {isMyTurn && <span className="badge badge-amber">Ваш ход: вскройте карту!</span>}
      </div>

      {me && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TRAIT_ORDER.map((cat) => {
              const trait = me.traits[cat];
              const canReveal =
                view.phase === 'reveal' && isMyTurn && !trait.revealed && me.alive;

              return (
                <div
                  key={cat}
                  className="card-subtle"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    borderColor: trait.revealed ? 'rgba(16,185,129,0.35)' : undefined,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>
                      {TRAIT_LABELS[cat]}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-word' }}>
                      {trait.value}
                    </div>
                  </div>
                  {trait.revealed ? (
                    <span className="badge badge-ok" style={{ flexShrink: 0 }}>
                      <Eye size={13} /> Вскрыто
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
              );
            })}
          </div>

          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={16} color="var(--amber)" />
              Спецкарты действий
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
              {me.specialCards.map((sc) => (
                <div key={sc.id} className="card-subtle" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{sc.title}</span>
                    {sc.used && <span className="badge">Использовано</span>}
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
          <Users size={18} color="var(--amber)" />
          Игроки ({view.players.filter((p) => p.alive).length} в игре / {view.bunker?.capacity ?? '?'} мест)
        </div>
        {view.phase === 'voting' && (
          <span className="badge badge-amber">
            Проголосовало: {view.votedPlayerIds.length}/{view.players.filter((p) => p.alive).length}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {view.players.map((p) => {
          const isTurn = view.phase === 'reveal' && view.currentTurnPlayerId === p.id;
          const canVoteFor =
            view.phase === 'voting' &&
            me?.alive &&
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
                  const val = p.revealedTraits[cat];
                  if (!val) return null;
                  return (
                    <span key={cat} className="badge" style={{ color: 'var(--text)', whiteSpace: 'normal' }}>
                      <strong style={{ color: 'var(--amber)' }}>{TRAIT_LABELS[cat]}:</strong> {val}
                    </span>
                  );
                })}
                {p.revealedCount === 0 && (
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
                  borderColor: bc.revealed && bc.isThreat ? 'rgba(239,68,68,0.4)' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{bc.title}</span>
                  {bc.revealed ? (
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
        <button className="btn btn-primary" type="submit" style={{ padding: '0 14px' }}>
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
            <button className="btn btn-outline" onClick={onLeave} title="Выйти">
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
          <div className="card" style={{ borderColor: 'var(--amber)' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Итоги раунда {view.lastRoundResult.round}</div>
            <div style={{ fontSize: 14 }}>{view.lastRoundResult.reason}</div>
          </div>
        )}

        {view.phase === 'game_over' && (
          <div className="card" style={{ borderColor: 'var(--ok)', background: 'rgba(16,185,129,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 18, color: '#34d399', marginBottom: 6 }}>
              <CheckCircle2 size={22} /> Выжившие в бункере!
            </div>
            <div style={{ fontSize: 14 }}>
              Внутри остались:{' '}
              <strong>
                {view.players
                  .filter((p) => p.alive)
                  .map((p) => p.name)
                  .join(', ')}
              </strong>
              . Все характеристики всех игроков теперь открыты.
            </div>
          </div>
        )}

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
      {activeSpecial && (
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
                <select
                  className="input"
                  value={targetPlayerId}
                  onChange={(e) => setTargetPlayerId(e.target.value)}
                >
                  {view.players
                    .filter((p) => p.alive && (activeSpecial.type !== 'swap_trait' && activeSpecial.type !== 'force_reveal' ? true : p.id !== me?.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
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
              <button className="btn btn-primary" onClick={submitSpecialModal}>
                Применить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
