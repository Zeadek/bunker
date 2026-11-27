import React, { useState } from 'react';
import { Radio, Settings, ShieldAlert, Users, Wifi } from 'lucide-react';
import { SignalingConfig } from '../p2p/peerManager';

interface HomeScreenProps {
  initialRoomCode: string;
  initialName: string;
  signaling: SignalingConfig;
  statusText: string | null;
  errorText: string | null;
  onCreateRoom: (name: string) => void;
  onJoinRoom: (name: string, roomCode: string) => void;
  onSaveSignaling: (cfg: SignalingConfig) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  initialRoomCode,
  initialName,
  signaling,
  statusText,
  errorText,
  onCreateRoom,
  onJoinRoom,
  onSaveSignaling,
}) => {
  const [name, setName] = useState(initialName);
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [showSettings, setShowSettings] = useState(false);
  const [cfg, setCfg] = useState<SignalingConfig>(signaling);

  const busy = Boolean(statusText);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div className="hazard-bar" />
      <div
        className="container"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          maxWidth: 520,
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'var(--amber-dim)',
                border: '1px solid rgba(245,158,11,0.45)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--amber)',
              }}
            >
              <ShieldAlert size={24} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, letterSpacing: 1 }}>БУНКЕР // P2P</h1>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                WebRTC • Windows / Android / iOS
              </div>
            </div>
          </div>

          <button
            className="btn btn-outline"
            onClick={() => setShowSettings(true)}
            title="Настройки P2P сигналинга"
            style={{ padding: 10 }}
          >
            <Settings size={18} />
          </button>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>
              Ваше имя в бункере
            </label>
            <input
              className="input"
              placeholder="Например: Сталкер"
              maxLength={24}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '13px 16px', fontSize: 15 }}
            disabled={busy || !name.trim()}
            onClick={() => onCreateRoom(name.trim())}
          >
            <Radio size={18} />
            Создать комнату (Хост)
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: 'var(--muted)',
              fontSize: 12,
            }}
          >
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span>или подключиться по коду</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input mono"
              placeholder="КОД (5 симв.)"
              maxLength={8}
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              style={{ textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700 }}
            />
            <button
              className="btn btn-outline"
              disabled={busy || !name.trim() || roomCode.trim().length < 4}
              onClick={() => onJoinRoom(name.trim(), roomCode.trim().toUpperCase())}
              style={{ whiteSpace: 'nowrap' }}
            >
              <Users size={18} />
              Войти
            </button>
          </div>

          {statusText && (
            <div className="badge badge-amber" style={{ justifyContent: 'center', padding: 10 }}>
              <Wifi size={15} />
              {statusText}
            </div>
          )}

          {errorText && (
            <div className="badge badge-danger" style={{ justifyContent: 'center', padding: 10 }}>
              {errorText}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
          Соединение работает напрямую между игроками через WebRTC DataChannel.
          {signaling.useCustom
            ? ` Сигналинг: ${signaling.host}:${signaling.port}`
            : ' Сигналинг: PeerJS Cloud'}
        </div>
      </div>

      {showSettings && (
        <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
          <div
            className="card"
            style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0 }}>Настройки P2P и сети</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={cfg.useCustom}
                onChange={(e) => setCfg({ ...cfg, useCustom: e.target.checked })}
              />
              Свой сигналинг-сервер (вместо PeerJS Cloud)
            </label>

            {cfg.useCustom && (
              <>
                <input
                  className="input"
                  placeholder="Host (например 192.168.1.50)"
                  value={cfg.host}
                  onChange={(e) => setCfg({ ...cfg, host: e.target.value })}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input"
                    type="number"
                    placeholder="Порт"
                    value={cfg.port}
                    onChange={(e) => setCfg({ ...cfg, port: Number(e.target.value) || 9000 })}
                  />
                  <input
                    className="input"
                    placeholder="Путь (/bunker)"
                    value={cfg.path}
                    onChange={(e) => setCfg({ ...cfg, path: e.target.value })}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={cfg.secure}
                    onChange={(e) => setCfg({ ...cfg, secure: e.target.checked })}
                  />
                  WSS / HTTPS (secure)
                </label>
              </>
            )}

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>TURN-сервер (для сложного NAT / 4G)</div>
              <input
                className="input"
                placeholder="turn:relay.example.com:3478 (необязательно)"
                value={cfg.turnUrl || ''}
                onChange={(e) => setCfg({ ...cfg, turnUrl: e.target.value })}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  placeholder="TURN Логин"
                  value={cfg.turnUsername || ''}
                  onChange={(e) => setCfg({ ...cfg, turnUsername: e.target.value })}
                />
                <input
                  className="input"
                  type="password"
                  placeholder="TURN Пароль"
                  value={cfg.turnCredential || ''}
                  onChange={(e) => setCfg({ ...cfg, turnCredential: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <button className="btn btn-outline" onClick={() => setShowSettings(false)}>
                Отмена
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  onSaveSignaling(cfg);
                  setShowSettings(false);
                }}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
