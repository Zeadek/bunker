import React, { useState } from 'react';
import { Check, Copy, Eye, Layers, LogOut, Play, Users, X } from 'lucide-react';
import { ALL_PACKS } from '../game/data';
import { GamePack, GameSettings, PackId, PlayerView, TRAIT_LABELS, TRAIT_ORDER } from '../game/types';

interface LobbyScreenProps {
  view: PlayerView;
  isHost: boolean;
  onUpdateSettings: (settings: GameSettings) => void;
  onStartGame: () => void;
  onLeave: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  view,
  isHost,
  onUpdateSettings,
  onStartGame,
  onLeave,
}) => {
  const [copied, setCopied] = useState(false);
  const [inspectPack, setInspectPack] = useState<GamePack | null>(null);
  const [inspectTab, setInspectTab] = useState<string>('profession');

  const copyInvite = async () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${view.roomCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: copy just the code
      await navigator.clipboard.writeText(view.roomCode).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const packList = Object.values(ALL_PACKS);

  const togglePack = (packId: PackId) => {
    const current = view.settings.packs;
    const exists = current.includes(packId);
    if (exists && current.length <= 1) return; // keep at least 1 pack
    const nextPacks = exists ? current.filter((id) => id !== packId) : [...current, packId];
    onUpdateSettings({ ...view.settings, packs: nextPacks });
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
              <Users size={18} color="var(--amber)" />
              Игроки ({view.players.length} / {view.settings.maxPlayers})
            </div>
            <span className="badge badge-ok">P2P Активно</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {view.players.map((p) => (
              <div
                key={p.id}
                className="card-subtle"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span style={{ fontWeight: 600 }}>{p.name}</span>
                {p.isHost && <span className="badge badge-amber">Хост</span>}
              </div>
            ))}
          </div>
        </div>

        {isHost && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={18} color="var(--amber)" />
              Наборы карточек (Паки)
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Выберите один набор или оба сразу — тогда карты, катастрофы и бункеры затасуются вместе.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {packList.map((pack) => {
                const selected = view.settings.packs.includes(pack.id);
                return (
                  <button
                    key={pack.id}
                    type="button"
                    className="card-subtle"
                    onClick={() => togglePack(pack.id)}
                    style={{
                      textAlign: 'left',
                      cursor: 'pointer',
                      borderColor: selected ? 'var(--amber)' : 'var(--border)',
                      background: selected ? 'var(--amber-dim)' : 'var(--surface-2)',
                      color: 'var(--text)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: 14 }}>{pack.name}</strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          role="button"
                          tabIndex={0}
                          className="badge"
                          title="Посмотреть состав пака"
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectTab('profession');
                            setInspectPack(pack);
                          }}
                        >
                          <Eye size={12} /> Состав
                        </span>
                        <span className={`badge ${selected ? 'badge-amber' : ''}`}>
                          {selected ? 'Выбран' : 'Выкл'}
                        </span>
                      </div>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{pack.description}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ fontWeight: 700, marginTop: 4 }}>Настройки партии</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
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

            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '13px 16px', fontSize: 15, marginTop: 4 }}
              disabled={view.players.length < 2}
              onClick={onStartGame}
            >
              <Play size={18} />
              Начать игру ({view.players.length} игр.)
            </button>
            {view.players.length < 2 && (
              <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
                Ожидайте подключения минимум 2 игроков (рекомендуется 4–12).
              </div>
            )}
          </div>
        )}

        {!isHost && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <span>Выбранные наборы:</span>
              {view.settings.packs.map((id) => {
                const pack = ALL_PACKS[id];
                if (!pack) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    className="badge badge-amber"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setInspectTab('profession');
                      setInspectPack(pack);
                    }}
                  >
                    <Eye size={12} /> {pack.name}
                  </button>
                );
              })}
            </div>
            <div>Ожидаем, пока хост запустит игру…</div>
          </div>
        )}
      </div>

      {inspectPack && (
        <div className="modal-backdrop" onClick={() => setInspectPack(null)}>
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 680,
              maxHeight: '85dvh',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>Состав пака: {inspectPack.name}</h3>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{inspectPack.description}</div>
              </div>
              <button className="btn btn-outline" style={{ padding: 6 }} onClick={() => setInspectPack(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button
                className={`badge ${inspectTab === 'catastrophes' ? 'badge-amber' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setInspectTab('catastrophes')}
              >
                Катастрофы ({inspectPack.catastrophes.length})
              </button>
              <button
                className={`badge ${inspectTab === 'bunker' ? 'badge-amber' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setInspectTab('bunker')}
              >
                Бункеры и угрозы ({inspectPack.bunkerFeatures.length})
              </button>
              {TRAIT_ORDER.map((cat) => (
                <button
                  key={cat}
                  className={`badge ${inspectTab === cat ? 'badge-amber' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setInspectTab(cat)}
                >
                  {TRAIT_LABELS[cat]} ({inspectPack.traits[cat].length})
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
                inspectPack.catastrophes.map((c) => (
                  <div key={c.id} className="card-subtle">
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{c.title} ({c.duration}, выж. {c.survivalRate})</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.description}</div>
                  </div>
                ))}

              {inspectTab === 'bunker' &&
                inspectPack.bunkerFeatures.map((b, i) => (
                  <div key={i} className="card-subtle">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 13 }}>{b.title}</strong>
                      <span className={`badge ${b.isThreat ? 'badge-danger' : 'badge-ok'}`}>
                        {b.isThreat ? 'Угроза' : 'Ресурс'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{b.description}</div>
                  </div>
                ))}

              {TRAIT_ORDER.includes(inspectTab as typeof TRAIT_ORDER[number]) &&
                inspectPack.traits[inspectTab as typeof TRAIT_ORDER[number]].map((item, i) => (
                  <div key={i} className="card-subtle" style={{ fontSize: 13, padding: '8px 12px' }}>
                    {i + 1}. {item}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
