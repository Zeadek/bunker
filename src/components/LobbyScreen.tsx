import React, { useState } from 'react';
import { Check, Copy, LogOut, Play, Users } from 'lucide-react';
import { GameSettings, PlayerView } from '../game/types';

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
            <div style={{ fontWeight: 700 }}>Настройки партии</div>
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
          <div className="card" style={{ textAlign: 'center', color: 'var(--muted)' }}>
            Ожидаем, пока хост запустит игру…
          </div>
        )}
      </div>
    </div>
  );
};
