import { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  Crown,
  Flame,
  LogOut,
  RefreshCw,
  Skull,
  Sparkles,
  Swords,
  Trophy,
  Zap,
} from 'lucide-react';
import { calculateComboScore } from '../game/combo/comboEngine';
import { ComboCard, ComboGameState } from '../game/combo/comboTypes';
import { TRAIT_LABELS, TraitCategory } from '../game/types';

interface ComboGameScreenProps {
  state: ComboGameState;
  myPlayerId: string;
  isHost: boolean;
  errorText: string | null;
  onPlaceCard: (cardId: string, slotIndex: number) => void;
  onSwapWithDeck: (cardId: string) => void;
  onBlindTrade: (myCardId: string, targetPlayerId: string) => void;
  onPlayTactic: (
    cardId: string,
    options?: { targetPlayerId?: string; slotIndex?: number; newCategory?: TraitCategory }
  ) => void;
  onMarkReady: () => void;
  onCastVote: (likeTargetId?: string, hateTargetId?: string) => void;
  onHostFinalizeDraft: () => void;
  onHostNextRound: () => void;
  onHostPlayAgain: () => void;
  onLeave: () => void;
}

const PHASE_LABELS: Record<ComboGameState['phase'], string> = {
  lobby: 'Лобби',
  draft_build: 'Сборка билда',
  combo_vote: 'Слепое голосование',
  combo_result: 'Итоги раунда',
  combo_over: 'Финал турнира',
};

export function ComboGameScreen({
  state,
  myPlayerId,
  isHost,
  errorText,
  onPlaceCard,
  onSwapWithDeck,
  onBlindTrade,
  onPlayTactic,
  onMarkReady,
  onCastVote,
  onHostFinalizeDraft,
  onHostNextRound,
  onHostPlayAgain,
  onLeave,
}: ComboGameScreenProps) {
  const me = state.players.find((p) => p.id === myPlayerId) ?? state.players[0];
  const rivals = state.players.filter((p) => p.id !== me.id);

  const [selectedHandCardId, setSelectedHandCardId] = useState<string | null>(null);
  const [tradeTargetId, setTradeTargetId] = useState<string>(rivals[0]?.id ?? '');
  const [tacticModalCard, setTacticModalCard] = useState<ComboCard | null>(null);
  const [tacticTargetId, setTacticTargetId] = useState<string>(rivals[0]?.id ?? '');
  const [tacticSlotIndex, setTacticSlotIndex] = useState<number>(0);

  const [likePick, setLikePick] = useState<string | undefined>(undefined);
  const [hatePick, setHatePick] = useState<string | undefined>(undefined);

  const selectedHandCard = me.hand.find((c) => c.id === selectedHandCardId) ?? null;

  const myBreakdown = useMemo(() => calculateComboScore(state, me), [state, me]);
  const emptySlotsCount = me.slots.filter((s) => s.card === null).length;
  const myModifiers = state.modifiers.filter((m) => m.targetPlayerId === me.id);

  const sortedByVp = useMemo(
    () => [...state.players].sort((a, b) => b.vp - a.vp),
    [state.players]
  );

  const swapsLeft = Math.max(0, state.settings.maxSwapsPerRound - me.swapsUsedThisRound);
  const tradesLeft = Math.max(0, state.settings.maxTradesPerRound - me.tradesUsedThisRound);
  const tacticsLeft = Math.max(0, state.settings.maxTacticsPerRound - me.tacticsUsedThisRound);

  const mySubmittedVote = state.votes[me.id];
  const latestResult = state.roundHistory[state.roundHistory.length - 1] ?? null;

  const handleSlotClick = (slotIndex: number) => {
    if (state.phase !== 'draft_build') return;
    if (!selectedHandCard || selectedHandCard.kind === 'tactic') return;
    onPlaceCard(selectedHandCard.id, slotIndex);
    setSelectedHandCardId(null);
  };

  const handleOpenTactic = (card: ComboCard) => {
    const eff = card.effect;
    if (!eff) return;
    if (eff.kind === 'draw_cards') {
      onPlayTactic(card.id);
      return;
    }
    setTacticTargetId(rivals[0]?.id ?? '');
    setTacticSlotIndex(Math.max(0, me.slots.findIndex((s) => s.card !== null)));
    setTacticModalCard(card);
  };

  return (
    <div style={{ minHeight: '100vh', padding: '16px 16px 40px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Top Bar */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
          borderColor: 'rgba(245, 158, 11, 0.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="badge badge-amber" style={{ fontSize: 13 }}>
            <Zap size={13} /> Combo Draft
          </span>
          <span style={{ fontWeight: 800, fontSize: 16 }}>
            Раунд {state.round} / {state.settings.totalRounds}
          </span>
          <span className="badge badge-ok">{PHASE_LABELS[state.phase]}</span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Комната: {state.roomCode}</span>
        </div>

        {/* VP Leaderboard */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {sortedByVp.map((p, idx) => (
            <span
              key={p.id}
              className={`badge ${p.id === me.id ? 'badge-amber' : 'badge-muted'}`}
              style={{ fontSize: 12 }}
            >
              {idx === 0 && p.vp > 0 && <Crown size={12} />}
              {p.name}: <strong>{p.vp} VP</strong>
            </span>
          ))}
          <button className="btn btn-outline" onClick={onLeave} style={{ padding: '6px 10px' }}>
            <LogOut size={14} /> Выйти
          </button>
        </div>
      </div>

      {errorText && (
        <div
          className="card"
          style={{
            marginBottom: 14,
            borderColor: 'var(--danger)',
            background: 'rgba(239,68,68,0.12)',
            color: '#fecaca',
            padding: '10px 14px',
          }}
        >
          {errorText}
        </div>
      )}

      {/* PHASE: DRAFT BUILD */}
      {state.phase === 'draft_build' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Scoreboard + Modifiers Banner */}
          <div
            className="card"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              background: 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(16,185,129,0.06))',
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Текущий расчёт билда</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--amber)' }}>
                {myBreakdown.finalScore} оч.
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span>База: {myBreakdown.baseTotal}</span>
                <span>Слоты: +{myBreakdown.slotMatchBonus}</span>
                <span>Комбо: +{myBreakdown.comboBonus}</span>
                <span>Эффекты: {myBreakdown.modifierDelta >= 0 ? `+${myBreakdown.modifierDelta}` : myBreakdown.modifierDelta}</span>
                {myBreakdown.penaltyDelta < 0 && (
                  <span style={{ color: '#fca5a5' }}>Штраф: {myBreakdown.penaltyDelta}</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {myModifiers.map((m) => (
                <span
                  key={m.id}
                  className={`badge ${m.value < 0 ? 'badge-danger' : 'badge-ok'}`}
                  title={m.duration === 'persistent' ? 'Долгосрочный эффект' : 'Только на этот раунд'}
                >
                  {m.duration === 'persistent' ? '♾️' : '⏳'} {m.label}
                </span>
              ))}
              {me.ready ? (
                <span className="badge badge-ok" style={{ fontSize: 13, padding: '6px 12px' }}>
                  <CheckCircle2 size={14} /> Вы готовы, ждём остальных…
                </span>
              ) : (
                <button className="btn btn-primary" onClick={onMarkReady}>
                  <CheckCircle2 size={16} /> Готов / Завершить сборку
                </button>
              )}
              {isHost && (
                <button className="btn btn-outline" onClick={onHostFinalizeDraft}>
                  Закрыть сборку для всех
                </button>
              )}
            </div>
          </div>

          {emptySlotsCount > 0 && !me.ready && (
            <div style={{ fontSize: 12, color: 'var(--amber)' }}>
              ⚠ Незаполненных слотов: {emptySlotsCount}. Если завершить сборку с пустыми слотами, они автоматически заполнятся штрафными картами (−6 оч. за слот).
            </div>
          )}

          {/* My 5 Build Slots */}
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span>Мои слоты персонажа</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {selectedHandCard && selectedHandCard.kind !== 'tactic'
                  ? `Нажмите на слот, чтобы вставить «${selectedHandCard.title}»`
                  : 'Выберите карту в руке и нажмите на нужный слот'}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))',
                gap: 10,
              }}
            >
              {me.slots.map((slot) => {
                const card = slot.card;
                const isCategoryMatch = Boolean(
                  card && !slot.autoFilled && !card.isPenalty && card.category === slot.category
                );
                const hasSynergy = Boolean(card?.effect);
                return (
                  <div
                    key={slot.index}
                    onClick={() => handleSlotClick(slot.index)}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      border: selectedHandCard && selectedHandCard.kind !== 'tactic'
                        ? '2px dashed var(--amber)'
                        : hasSynergy
                          ? '1px solid rgba(16, 185, 129, 0.55)'
                          : '1px solid rgba(255,255,255,0.12)',
                      background: card
                        ? card.isCurse || card.isPenalty
                          ? 'rgba(239,68,68,0.10)'
                          : isCategoryMatch
                            ? 'rgba(16,185,129,0.10)'
                            : 'rgba(255,255,255,0.03)'
                        : 'rgba(255,255,255,0.02)',
                      cursor: selectedHandCard && selectedHandCard.kind !== 'tactic' ? 'pointer' : 'default',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      minHeight: 130,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
                        #{slot.index + 1} · {TRAIT_LABELS[slot.category]}
                      </span>
                      {isCategoryMatch && (
                        <span className="badge badge-ok" style={{ fontSize: 10 }}>
                          +3 слот
                        </span>
                      )}
                    </div>

                    {card ? (
                      <>
                        <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{card.title}</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <span className={`badge ${card.baseScore >= 0 ? 'badge-amber' : 'badge-danger'}`}>
                            {card.baseScore >= 0 ? `+${card.baseScore}` : card.baseScore} оч.
                          </span>
                          {card.tags.map((t) => (
                            <span key={t} className="badge badge-muted" style={{ fontSize: 10 }}>
                              #{t}
                            </span>
                          ))}
                        </div>
                        {card.effect && (
                          <div style={{ fontSize: 11, color: '#6ee7b7', marginTop: 2 }}>
                            <Sparkles size={11} style={{ verticalAlign: 'middle' }} /> {card.effect.description}
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ color: 'var(--muted)', fontSize: 12, margin: 'auto 0' }}>
                        Пустой слот
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* My Hand + Actions */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontWeight: 700 }}>
                Моя рука ({me.hand.length}) · Колода: {me.deck.length} · Тактик осталось: {tacticsLeft}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  className="btn btn-outline"
                  disabled={!selectedHandCard || swapsLeft <= 0}
                  onClick={() => {
                    if (selectedHandCard) {
                      onSwapWithDeck(selectedHandCard.id);
                      setSelectedHandCardId(null);
                    }
                  }}
                >
                  <RefreshCw size={14} /> Сбросить и добрать (осталось {swapsLeft})
                </button>

                {rivals.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <select
                      className="input"
                      style={{ width: 'auto', padding: '6px 8px', fontSize: 12 }}
                      value={tradeTargetId}
                      onChange={(e) => setTradeTargetId(e.target.value)}
                    >
                      {rivals.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn btn-outline"
                      disabled={!selectedHandCard || tradesLeft <= 0 || !tradeTargetId}
                      onClick={() => {
                        if (selectedHandCard && tradeTargetId) {
                          onBlindTrade(selectedHandCard.id, tradeTargetId);
                          setSelectedHandCardId(null);
                        }
                      }}
                    >
                      <ArrowLeftRight size={14} /> Слепой обмен ({tradesLeft})
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                gap: 10,
              }}
            >
              {me.hand.map((card) => {
                const isSelected = selectedHandCardId === card.id;
                const isTactic = card.kind === 'tactic';
                return (
                  <div
                    key={card.id}
                    onClick={() => setSelectedHandCardId(isSelected ? null : card.id)}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      border: isSelected
                        ? '2px solid var(--amber)'
                        : isTactic
                          ? '1px solid rgba(168, 85, 247, 0.5)'
                          : '1px solid rgba(255,255,255,0.12)',
                      background: isTactic
                        ? 'rgba(168, 85, 247, 0.10)'
                        : card.isCurse
                          ? 'rgba(239, 68, 68, 0.10)'
                          : 'rgba(255,255,255,0.03)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge badge-muted" style={{ fontSize: 10 }}>
                        {isTactic ? '⚡ Тактика' : TRAIT_LABELS[card.category]}
                      </span>
                      {!isTactic && (
                        <span className={`badge ${card.baseScore >= 0 ? 'badge-amber' : 'badge-danger'}`}>
                          {card.baseScore >= 0 ? `+${card.baseScore}` : card.baseScore}
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{card.title}</div>
                    {!isTactic && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {card.tags.map((t) => (
                          <span key={t} className="badge badge-muted" style={{ fontSize: 10 }}>
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                    {card.effect && (
                      <div style={{ fontSize: 11, color: isTactic ? '#e9d5ff' : '#6ee7b7' }}>
                        {card.effect.description}
                      </div>
                    )}
                    {isTactic && (
                      <button
                        className="btn btn-primary"
                        disabled={tacticsLeft <= 0}
                        style={{ marginTop: 'auto', padding: '6px 10px', fontSize: 12 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenTactic(card);
                        }}
                      >
                        <Swords size={13} /> Применить тактику
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* PHASE: COMBO VOTE */}
      {state.phase === 'combo_vote' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            className="card"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>Слепое голосование за билды</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Выберите 1 «🔥 Топ-билд (+25%)» и/или 1 «💀 Кринж (-15%)» среди соперников. Голоса суммируются после того, как проголосуют все.
              </div>
            </div>
            {mySubmittedVote ? (
              <span className="badge badge-ok" style={{ padding: '6px 12px' }}>
                <CheckCircle2 size={14} /> Ваш голос учтён ({Object.keys(state.votes).length}/{state.players.length})
              </span>
            ) : (
              <button
                className="btn btn-primary"
                onClick={() => onCastVote(likePick, hatePick)}
              >
                Подтвердить голос ({Object.keys(state.votes).length}/{state.players.length})
              </button>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
              gap: 12,
            }}
          >
            {state.players.map((p) => {
              const bd = calculateComboScore(state, p);
              const isMe = p.id === me.id;
              const voted = state.votes[p.id] !== undefined;
              return (
                <div
                  key={p.id}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    borderColor: isMe ? 'rgba(245,158,11,0.45)' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700 }}>
                      {p.name} {isMe ? '(Вы)' : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className="badge badge-amber">{bd.rawScore} оч.</span>
                      {voted && <span className="badge badge-ok">Голос ✓</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {p.slots.map((s) => (
                      <div
                        key={s.index}
                        style={{
                          fontSize: 12,
                          padding: '5px 8px',
                          borderRadius: 6,
                          background: s.autoFilled
                            ? 'rgba(239,68,68,0.12)'
                            : 'rgba(255,255,255,0.03)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {TRAIT_LABELS[s.category]}: <strong>{s.card?.title ?? '—'}</strong>
                        </span>
                        <span style={{ color: 'var(--amber)', flexShrink: 0 }}>
                          {s.card ? `${s.card.baseScore >= 0 ? '+' : ''}${s.card.baseScore}` : '0'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {!isMe && !mySubmittedVote && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button
                        className={`btn ${likePick === p.id ? 'btn-primary' : 'btn-outline'}`}
                        style={{ flex: 1, fontSize: 12, padding: '6px 8px' }}
                        onClick={() => {
                          setLikePick(likePick === p.id ? undefined : p.id);
                          if (hatePick === p.id) setHatePick(undefined);
                        }}
                      >
                        <Flame size={13} /> Топ-билд (+25%)
                      </button>
                      <button
                        className={`btn ${hatePick === p.id ? 'btn-danger' : 'btn-outline'}`}
                        style={{ flex: 1, fontSize: 12, padding: '6px 8px' }}
                        onClick={() => {
                          setHatePick(hatePick === p.id ? undefined : p.id);
                          if (likePick === p.id) setLikePick(undefined);
                        }}
                      >
                        <Skull size={13} /> Кринж (-15%)
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PHASE: COMBO RESULT / COMBO OVER */}
      {(state.phase === 'combo_result' || state.phase === 'combo_over') && latestResult && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {state.phase === 'combo_over' && (
            <div
              style={{
                padding: 16,
                borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(245,158,11,0.20), rgba(16,185,129,0.12))',
                border: '1px solid var(--amber)',
                textAlign: 'center',
              }}
            >
              <Trophy size={32} color="var(--amber)" style={{ marginBottom: 6 }} />
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                Победитель турнира:{' '}
                {state.players
                  .filter((p) => state.winnerIds.includes(p.id))
                  .map((p) => p.name)
                  .join(', ')}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>
              Итоги раунда {latestResult.round}
            </div>
            {isHost && state.phase === 'combo_result' && (
              <button className="btn btn-primary" onClick={onHostNextRound}>
                Следующий раунд →
              </button>
            )}
            {isHost && state.phase === 'combo_over' && (
              <button className="btn btn-primary" onClick={onHostPlayAgain}>
                Сыграть ещё раз
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {latestResult.standings.map((row, idx) => (
              <div
                key={row.playerId}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: idx === 0 ? '1px solid var(--amber)' : '1px solid rgba(255,255,255,0.1)',
                  background: idx === 0 ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>
                    #{idx + 1} {row.playerName}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    База {row.breakdown.baseTotal} + Слоты {row.breakdown.slotMatchBonus} + Комбо{' '}
                    {row.breakdown.comboBonus} · Множитель голосов ×{row.breakdown.voteMultiplier} (🔥{' '}
                    {row.likes} / 💀 {row.hates})
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge badge-amber" style={{ fontSize: 14 }}>
                    {row.breakdown.finalScore} оч.
                  </span>
                  {row.vpEarned > 0 && (
                    <span className="badge badge-ok">+{row.vpEarned} VP</span>
                  )}
                  <span className="badge badge-muted">Всего: {row.totalVp} VP</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tactic Target Modal */}
      {tacticModalCard && tacticModalCard.effect && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            padding: 16,
          }}
          onClick={() => setTacticModalCard(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 420, width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 800, fontSize: 16 }}>{tacticModalCard.title}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              {tacticModalCard.effect.description}
            </div>

            {tacticModalCard.effect.kind === 'change_category' ? (
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)' }}>Выберите слот для переквалификации</label>
                <select
                  className="input"
                  value={tacticSlotIndex}
                  onChange={(e) => setTacticSlotIndex(Number(e.target.value))}
                >
                  {me.slots.map((s) => (
                    <option key={s.index} value={s.index} disabled={!s.card}>
                      #{s.index + 1} ({TRAIT_LABELS[s.category]}) — {s.card?.title ?? 'пусто'}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)' }}>Выберите цель</label>
                <select
                  className="input"
                  value={tacticTargetId}
                  onChange={(e) => setTacticTargetId(e.target.value)}
                >
                  {rivals.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} (рука: {r.hand.length}, VP: {r.vp})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setTacticModalCard(null)}>
                Отмена
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  onPlayTactic(tacticModalCard.id, {
                    targetPlayerId: tacticTargetId || undefined,
                    slotIndex: tacticSlotIndex,
                  });
                  setTacticModalCard(null);
                  setSelectedHandCardId(null);
                }}
              >
                Применить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
