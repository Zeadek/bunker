import React, { useEffect, useState } from 'react';
import { Check, Copy, Eye, Layers, LogOut, Play, Users, X } from 'lucide-react';
import { getAbilityShortBadge } from '../game/abilities';
import { ALL_PACKS, SPECIAL_CARD_TEMPLATES } from '../game/data';
import {
  AdultIntensity,
  GamePack,
  GameSettings,
  PackId,
  PlayerView,
  TRAIT_LABELS,
  TRAIT_ORDER,
} from '../game/types';

interface LobbyScreenProps {
  view: PlayerView;
  isHost: boolean;
  onUpdateSettings: (settings: GameSettings) => void;
  onAddBot?: () => void;
  onRemoveBot?: (botId: string) => void;
  onStartGame: () => void;
  onLeave: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  view,
  isHost,
  onUpdateSettings,
  onAddBot,
  onRemoveBot,
  onStartGame,
  onLeave,
}) => {
  const [copied, setCopied] = useState(false);
  const [showPackModal, setShowPackModal] = useState(false);
  const [inspectPack, setInspectPack] = useState<GamePack | null>(null);
  const [inspectTab, setInspectTab] = useState<string>('profession');
  const [inspectFilter, setInspectFilter] = useState<'all' | 'adult'>('all');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldPool, setNewFieldPool] = useState('');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (inspectPack) setInspectPack(null);
      else if (showPackModal) setShowPackModal(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inspectPack, showPackModal]);

  const copyInvite = async () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${view.roomCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      await navigator.clipboard.writeText(view.roomCode).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const packList = Object.values(ALL_PACKS);

  const togglePack = (packId: PackId) => {
    const current = view.settings.packs;
    const exists = current.includes(packId);
    if (exists && current.length <= 1) return;
    const nextPacks = exists ? current.filter((id) => id !== packId) : [...current, packId];
    onUpdateSettings({ ...view.settings, packs: nextPacks });
  };

  const toggleTrait = (cat: typeof TRAIT_ORDER[number]) => {
    const current = view.settings.enabledTraits ?? TRAIT_ORDER;
    const exists = current.includes(cat);
    if (exists && current.length <= 1) return;
    const nextTraits = exists ? current.filter((c) => c !== cat) : [...current, cat];
    onUpdateSettings({ ...view.settings, enabledTraits: nextTraits });
  };

  const addCustomField = () => {
    const label = newFieldLabel.trim();
    const pool = newFieldPool
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!label || pool.length === 0) return;
    const nextFields = [
      ...(view.settings.customFields ?? []),
      { id: `cf-${Date.now().toString(36)}`, label, pool },
    ];
    onUpdateSettings({ ...view.settings, customFields: nextFields });
    setNewFieldLabel('');
    setNewFieldPool('');
  };

  const removeCustomField = (id: string) => {
    onUpdateSettings({
      ...view.settings,
      customFields: (view.settings.customFields ?? []).filter((f) => f.id !== id),
    });
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div className="hazard-bar" />
      <div className="container" style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>ЛОББИ БУНКЕРА</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="mono" style={{ fontSize: 28, fontWeight: 800, color: 'var(--amber)', letterSpacing: 3 }}>
                {view.roomCode}
              </span>
              <button className="btn btn-outline" onClick={copyInvite} style={{ padding: '6px 10px' }}>
                {copied ? <Check size={16} color="#34d399" /> : <Copy size={16} />}
                {copied ? 'Скопировано' : 'Ссылка'}
              </button>
            </div>
          </div>

          <button className="btn btn-outline" onClick={onLeave}>
            <LogOut size={16} />
            Выйти
          </button>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
              <Users size={18} color="var(--amber)" />
              Игроки ({view.players.length} / {view.settings.maxPlayers})
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isHost && onAddBot && (
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: '5px 10px', fontSize: 12 }}
                  disabled={view.players.length >= view.settings.maxPlayers}
                  onClick={onAddBot}
                >
                  + Бот
                </button>
              )}
              <span className="badge badge-ok">P2P Активно</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {view.players.map((p) => (
              <div
                key={p.id}
                className="card-subtle"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}
              >
                <span style={{ fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  {p.isHost && <span className="badge badge-amber">Хост</span>}
                  {p.isBot && (
                    <span className="badge">
                      🤖 БОТ{p.isEasterEgg ? ' ★' : ''}
                    </span>
                  )}
                  {isHost && p.isBot && onRemoveBot && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ padding: '2px 6px', fontSize: 11 }}
                      aria-label={`Удалить ${p.name}`}
                      onClick={() => onRemoveBot(p.id)}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Compact Pack Summary Card */}
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={18} color="var(--amber)" />
              Наборы карточек
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {view.settings.packs.map((id) => {
                const pack = ALL_PACKS[id];
                if (!pack) return null;
                return (
                  <span key={id} className="badge badge-amber">
                    {pack.name}
                  </span>
                );
              })}
              {view.settings.enableAdultContent && (
                <span className="badge badge-danger">18+ Включено</span>
              )}
            </div>
          </div>

          <button className="btn btn-outline" onClick={() => setShowPackModal(true)}>
            <Layers size={16} />
            {isHost ? 'Выбрать / Состав' : 'Посмотреть состав'}
          </button>
        </div>

        {isHost && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontWeight: 700 }}>Настройки партии</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Мест в бункере (0 = авто {Math.max(1, Math.floor(view.players.length / 2))})
                </label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={Math.max(1, view.players.length - 1)}
                  value={view.settings.bunkerSeats}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...view.settings,
                      bunkerSeats: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)' }}>Спецкарт на игрока (0–5)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={5}
                  value={view.settings.specialCardsPerPlayer ?? 2}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...view.settings,
                      specialCardsPerPlayer: Math.max(0, Math.min(5, Number(e.target.value) || 0)),
                    })
                  }
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)' }}>Таймер хода (сек, 0 = без)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={300}
                  value={view.settings.turnSeconds}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...view.settings,
                      turnSeconds: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)' }}>Обсуждение (сек)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={600}
                  value={view.settings.discussionSeconds}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...view.settings,
                      discussionSeconds: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                />
              </div>
            </div>

            {/* 18+ toggle & intensity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label
                className="card-subtle"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  cursor: 'pointer',
                  borderColor: view.settings.enableAdultContent ? 'rgba(239,68,68,0.5)' : undefined,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>🔞 18+ карточки в паке</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Добавляет чёрный юмор, жёсткие сюжеты, компромат и 18+ спецкарты во все категории.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(view.settings.enableAdultContent)}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...view.settings,
                      enableAdultContent: e.target.checked,
                      adultIntensity: view.settings.adultIntensity ?? 'mixed',
                    })
                  }
                  style={{ width: 20, height: 20, accentColor: '#ef4444', flexShrink: 0 }}
                />
              </label>

              {view.settings.enableAdultContent && (
                <div className="card-subtle" style={{ display: 'flex', flexDirection: 'column', gap: 6, borderColor: 'rgba(239,68,68,0.35)' }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Доля 18+ карточек в раздаче:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(
                      [
                        { id: 'mixed', label: 'Смешанно (обычно)' },
                        { id: 'high', label: 'Чаще 18+ (×4)' },
                        { id: 'only', label: 'Приоритет 18+ (максимум)' },
                      ] as Array<{ id: AdultIntensity; label: string }>
                    ).map((opt) => {
                      const active = (view.settings.adultIntensity ?? 'mixed') === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          className={`btn ${active ? 'btn-danger' : 'btn-outline'}`}
                          style={{ padding: '5px 10px', fontSize: 12 }}
                          onClick={() =>
                            onUpdateSettings({ ...view.settings, adultIntensity: opt.id })
                          }
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Enabled trait categories */}
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                Активные поля персонажей (нажмите, чтобы отключить лишние):
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {TRAIT_ORDER.map((cat) => {
                  const active = (view.settings.enabledTraits ?? TRAIT_ORDER).includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      className={`badge ${active ? 'badge-amber' : ''}`}
                      style={{ cursor: 'pointer', opacity: active ? 1 : 0.45 }}
                      onClick={() => toggleTrait(cat)}
                    >
                      {TRAIT_LABELS[cat]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom fields */}
            <div className="card-subtle" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Кастомные поля (доп. характеристики)</div>
              {(view.settings.customFields ?? []).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {view.settings.customFields.map((cf) => (
                    <div
                      key={cf.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 12,
                        padding: '4px 8px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 6,
                      }}
                    >
                      <span>
                        <strong>{cf.label}</strong> ({cf.pool.length} вар.)
                      </span>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: '2px 8px', fontSize: 11 }}
                        onClick={() => removeCustomField(cf.id)}
                      >
                        Убрать
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 8, alignItems: 'center' }}>
                <input
                  className="input"
                  placeholder="Название (напр. Тату)"
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Варианты через запятую"
                  value={newFieldPool}
                  onChange={(e) => setNewFieldPool(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: '8px 12px', fontSize: 12 }}
                  onClick={addCustomField}
                >
                  Добавить
                </button>
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '13px 16px', fontSize: 15, marginTop: 4 }}
              disabled={view.players.length < 1}
              onClick={onStartGame}
            >
              <Play size={18} />
              {view.players.length === 1
                ? 'Начать игру (Соло-тест)'
                : `Начать игру (${view.players.length} игр.)`}
            </button>
          </div>
        )}

        {!isHost && (
          <div className="card" style={{ textAlign: 'center', color: 'var(--muted)' }}>
            Ожидаем, пока хост запустит игру…
          </div>
        )}
      </div>

      {/* Pack Selection Modal */}
      {showPackModal && (
        <div className="modal-backdrop" onClick={() => setShowPackModal(false)}>
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 560,
              maxHeight: '85dvh',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>Наборы карточек (Паки)</h3>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {isHost
                    ? 'Можно выбрать один пак или несколько — они затасуются вместе.'
                    : 'Активные наборы текущей партии.'}
                </div>
              </div>
              <button
                className="btn btn-outline"
                style={{ padding: 6 }}
                aria-label="Закрыть окно выбора паков"
                onClick={() => setShowPackModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {packList.map((pack) => {
                const selected = view.settings.packs.includes(pack.id);
                return (
                  <div
                    key={pack.id}
                    className="card-subtle"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      borderColor: selected ? 'var(--amber)' : 'var(--border)',
                      background: selected ? 'var(--amber-dim)' : 'var(--surface-2)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: 15 }}>{pack.name}</strong>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ padding: '5px 10px', fontSize: 12 }}
                          onClick={() => {
                            setInspectTab('profession');
                            setInspectPack(pack);
                          }}
                        >
                          <Eye size={13} /> Состав
                        </button>
                        {isHost && (
                          <button
                            type="button"
                            className={`btn ${selected ? 'btn-primary' : 'btn-outline'}`}
                            style={{ padding: '5px 12px', fontSize: 12 }}
                            onClick={() => togglePack(pack.id)}
                          >
                            {selected ? 'Включён' : 'Выбрать'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{pack.description}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Pack Inspector Modal */}
      {inspectPack && (() => {
        const onlyAdult = inspectFilter === 'adult';
        const catItems = [
          ...inspectPack.catastrophes.map((c) => ({ item: c, isAdult: Boolean(c.isAdult) })),
          ...inspectPack.adult.catastrophes.map((c) => ({ item: c, isAdult: true })),
        ].filter((e) => !onlyAdult || e.isAdult);

        const bunkerItems = [
          ...inspectPack.bunkerFeatures.map((b) => ({ item: b, isAdult: Boolean(b.isAdult) })),
          ...inspectPack.adult.bunkerFeatures.map((b) => ({ item: b, isAdult: true })),
        ].filter((e) => !onlyAdult || e.isAdult);

        const specialItems = SPECIAL_CARD_TEMPLATES.filter((sc) => !onlyAdult || sc.isAdult);

        const getTraitItems = (cat: typeof TRAIT_ORDER[number]) =>
          [
            ...inspectPack.traits[cat].map((val) => ({ val, isAdult: false })),
            ...inspectPack.adult.traits[cat].map((val) => ({ val, isAdult: true })),
          ].filter((e) => !onlyAdult || e.isAdult);

        return (
          <div className="modal-backdrop" onClick={() => setInspectPack(null)}>
            <div
              className="card"
              style={{
                width: '100%',
                maxWidth: 700,
                maxHeight: '85dvh',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div>
                  <h3 style={{ margin: 0 }}>Состав: {inspectPack.name}</h3>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{inspectPack.description}</div>
                </div>
                <button
                  className="btn btn-outline"
                  style={{ padding: 6 }}
                  aria-label="Закрыть инспектор пака"
                  onClick={() => setInspectPack(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`btn ${inspectFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={() => setInspectFilter('all')}
                >
                  Все карты
                </button>
                <button
                  type="button"
                  className={`btn ${inspectFilter === 'adult' ? 'btn-danger' : 'btn-outline'}`}
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={() => setInspectFilter('adult')}
                >
                  🔞 Только 18+
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button
                  className={`badge ${inspectTab === 'catastrophes' ? 'badge-amber' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setInspectTab('catastrophes')}
                >
                  Катастрофы ({catItems.length})
                </button>
                <button
                  className={`badge ${inspectTab === 'bunker' ? 'badge-amber' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setInspectTab('bunker')}
                >
                  Бункеры ({bunkerItems.length})
                </button>
                <button
                  className={`badge ${inspectTab === 'specials' ? 'badge-amber' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setInspectTab('specials')}
                >
                  Спецкарты ({specialItems.length})
                </button>
                {TRAIT_ORDER.map((cat) => (
                  <button
                    key={cat}
                    className={`badge ${inspectTab === cat ? 'badge-amber' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setInspectTab(cat)}
                  >
                    {TRAIT_LABELS[cat]} ({getTraitItems(cat).length})
                  </button>
                ))}
              </div>

              <div
                style={{
                  overflowY: 'auto',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: 8,
                  background: '#0d131c',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                }}
              >
                {inspectTab === 'catastrophes' &&
                  catItems.map(({ item: c, isAdult }) => (
                    <div key={c.id} className="card-subtle">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{c.title} ({c.duration}, выж. {c.survivalRate})</span>
                        {isAdult && <span className="badge badge-danger">18+</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.description}</div>
                    </div>
                  ))}

                {inspectTab === 'bunker' &&
                  bunkerItems.map(({ item: b, isAdult }, i) => (
                    <div key={i} className="card-subtle">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                        <strong style={{ fontSize: 13 }}>{b.title}</strong>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {isAdult && <span className="badge badge-danger">18+</span>}
                          <span className={`badge ${b.isThreat ? 'badge-danger' : 'badge-ok'}`}>
                            {b.isThreat ? 'Угроза' : 'Ресурс'}
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{b.description}</div>
                    </div>
                  ))}

                {inspectTab === 'specials' &&
                  specialItems.map((sc) => (
                    <div key={sc.type} className="card-subtle">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <strong style={{ fontSize: 13 }}>{sc.title}</strong>
                        {sc.isAdult && <span className="badge badge-danger">18+</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{sc.description}</div>
                    </div>
                  ))}

                {TRAIT_ORDER.includes(inspectTab as typeof TRAIT_ORDER[number]) &&
                  getTraitItems(inspectTab as typeof TRAIT_ORDER[number]).map(({ val, isAdult }, i) => {
                    const cat = inspectTab as typeof TRAIT_ORDER[number];
                    const abilityBadge = getAbilityShortBadge(cat, val);
                    return (
                      <div
                        key={i}
                        className="card-subtle"
                        style={{
                          fontSize: 13,
                          padding: '8px 12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <span>{i + 1}. {val}</span>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          {isAdult && <span className="badge badge-danger">18+</span>}
                          {abilityBadge && (
                            <span className="badge badge-amber">
                              {abilityBadge}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
