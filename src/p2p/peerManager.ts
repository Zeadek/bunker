import Peer, { DataConnection } from 'peerjs';
import { ClientAction, HostPacket } from '../game/types';

export interface SignalingConfig {
  useCustom: boolean;
  host: string;
  port: number;
  path: string;
  secure: boolean;
  turnUrl?: string;
  turnUsername?: string;
  turnCredential?: string;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function getOrCreatePlayerId(): string {
  const key = 'bunker_p2p_player_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `pl-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

export function loadSignalingConfig(): SignalingConfig {
  try {
    const raw = localStorage.getItem('bunker_p2p_signaling');
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {
    useCustom: false,
    host: 'localhost',
    port: 9000,
    path: '/bunker',
    secure: false,
    turnUrl: '',
    turnUsername: '',
    turnCredential: '',
  };
}

export function saveSignalingConfig(cfg: SignalingConfig): void {
  localStorage.setItem('bunker_p2p_signaling', JSON.stringify(cfg));
}

function buildIceServers(cfg?: SignalingConfig): RTCIceServer[] {
  const servers = [...DEFAULT_ICE_SERVERS];
  if (cfg?.turnUrl?.trim()) {
    servers.push({
      urls: cfg.turnUrl.trim(),
      username: cfg.turnUsername?.trim() || undefined,
      credential: cfg.turnCredential?.trim() || undefined,
    });
  }
  return servers;
}

function createPeerInstance(peerId?: string, cfg?: SignalingConfig): Peer {
  const options: Record<string, unknown> = {
    config: { iceServers: buildIceServers(cfg) },
    debug: 1,
  };
  if (cfg?.useCustom && cfg.host) {
    options.host = cfg.host;
    options.port = cfg.port;
    options.path = cfg.path || '/';
    options.secure = cfg.secure;
  }
  return peerId ? new Peer(peerId, options) : new Peer(options);
}

export class HostPeerSession {
  private peer: Peer;
  private connections = new Map<string, DataConnection>(); // playerId -> conn
  private connToPlayer = new Map<string, string>(); // conn.peer -> playerId

  constructor(
    public readonly roomCode: string,
    signaling: SignalingConfig,
    private handlers: {
      onReady: () => void;
      onClientAction: (playerId: string, action: ClientAction) => void;
      onClientDisconnect: (playerId: string) => void;
      onError: (msg: string) => void;
    }
  ) {
    this.peer = createPeerInstance(`bunker-p2p-${roomCode}`, signaling);

    this.peer.on('open', () => {
      this.handlers.onReady();
    });

    this.peer.on('connection', (conn) => {
      conn.on('data', (raw) => {
        const action = raw as ClientAction;
        if (!action || typeof action !== 'object') return;

        if (action.type === 'HELLO') {
          this.connections.set(action.playerId, conn);
          this.connToPlayer.set(conn.peer, action.playerId);
          this.handlers.onClientAction(action.playerId, action);
          return;
        }

        const playerId = this.connToPlayer.get(conn.peer);
        if (playerId) {
          this.handlers.onClientAction(playerId, action);
        }
      });

      conn.on('close', () => {
        const playerId = this.connToPlayer.get(conn.peer);
        if (playerId) {
          this.connections.delete(playerId);
          this.connToPlayer.delete(conn.peer);
          this.handlers.onClientDisconnect(playerId);
        }
      });

      conn.on('error', () => {
        const playerId = this.connToPlayer.get(conn.peer);
        if (playerId) {
          this.connections.delete(playerId);
          this.connToPlayer.delete(conn.peer);
          this.handlers.onClientDisconnect(playerId);
        }
      });
    });

    this.peer.on('error', (err) => {
      this.handlers.onError(`Ошибка P2P хоста: ${err.message || err.type}`);
    });
  }

  sendToPlayer(playerId: string, packet: HostPacket): void {
    const conn = this.connections.get(playerId);
    if (conn && conn.open) {
      conn.send(packet);
    }
  }

  getConnectedPlayerIds(): string[] {
    return [...this.connections.keys()];
  }

  destroy(): void {
    for (const conn of this.connections.values()) {
      conn.close();
    }
    this.connections.clear();
    this.connToPlayer.clear();
    this.peer.destroy();
  }
}

export class ClientPeerSession {
  private peer: Peer;
  private conn: DataConnection | null = null;
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;
  private opened = false;

  constructor(
    roomCode: string,
    playerId: string,
    playerName: string,
    signaling: SignalingConfig,
    private handlers: {
      onConnected: () => void;
      onPacket: (packet: HostPacket) => void;
      onDisconnected: () => void;
      onError: (msg: string) => void;
    }
  ) {
    this.peer = createPeerInstance(undefined, signaling);

    this.connectTimeout = setTimeout(() => {
      if (!this.opened) {
        this.handlers.onError(
          'Таймаут P2P-подключения (15с). Если игроки в разных сетях со строгим NAT, укажите TURN-сервер в настройках.'
        );
        this.destroy();
      }
    }, 15000);

    this.peer.on('open', () => {
      const targetId = `bunker-p2p-${roomCode.trim().toUpperCase()}`;
      const conn = this.peer.connect(targetId, { reliable: true });
      this.conn = conn;

      conn.on('open', () => {
        this.opened = true;
        if (this.connectTimeout) {
          clearTimeout(this.connectTimeout);
          this.connectTimeout = null;
        }
        conn.send({ type: 'HELLO', playerId, name: playerName } satisfies ClientAction);
        this.handlers.onConnected();
      });

      conn.on('data', (raw) => {
        const packet = raw as HostPacket;
        if (packet && typeof packet === 'object') {
          this.handlers.onPacket(packet);
        }
      });

      conn.on('close', () => {
        this.handlers.onDisconnected();
      });

      conn.on('error', (err) => {
        this.handlers.onError(`Ошибка соединения с хостом: ${err.message || err.type}`);
      });
    });

    this.peer.on('error', (err) => {
      if (this.connectTimeout) {
        clearTimeout(this.connectTimeout);
        this.connectTimeout = null;
      }
      if (err.type === 'peer-unavailable') {
        this.handlers.onError('Комната не найдена. Проверьте код или доступность хоста.');
      } else {
        this.handlers.onError(`Ошибка P2P клиента: ${err.message || err.type}`);
      }
    });
  }

  sendAction(action: ClientAction): void {
    if (this.conn && this.conn.open) {
      this.conn.send(action);
    }
  }

  destroy(): void {
    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }
    this.conn?.close();
    this.peer.destroy();
  }
}
