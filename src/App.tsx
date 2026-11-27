import { useCallback, useEffect, useRef, useState } from 'react';
import { HomeScreen } from './components/HomeScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { GameScreen } from './components/GameScreen';
import {
  addChatMessage,
  addOrReconnectPlayer,
  castVote,
  createInitialState,
  disconnectPlayer,
  getPlayerView,
  proceedAfterRoundResult,
  resolveVotes,
  revealTrait,
  startDiscussionPhase,
  startGame,
  startRevealPhase,
  startVotingPhase,
  useSpecialCard,
} from './game/engine';
import {
  ClientAction,
  GameSettings,
  GameState,
  PlayerView,
  TRAIT_ORDER,
  TraitCategory,
} from './game/types';
import {
  ClientPeerSession,
  HostPeerSession,
  SignalingConfig,
  generateRoomCode,
  getOrCreatePlayerId,
  loadSignalingConfig,
  saveSignalingConfig,
} from './p2p/peerManager';

export function App() {
  const [playerId] = useState(() => getOrCreatePlayerId());
  const [savedName, setSavedName] = useState(() => localStorage.getItem('bunker_p2p_name') || '');
  const [signaling, setSignaling] = useState<SignalingConfig>(() => loadSignalingConfig());

  const [isHost, setIsHost] = useState(false);
  const [view, setView] = useState<PlayerView | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const hostStateRef = useRef<GameState | null>(null);
  const hostPeerRef = useRef<HostPeerSession | null>(null);
  const clientPeerRef = useRef<ClientPeerSession | null>(null);

  const initialRoomCode =
    new URLSearchParams(window.location.search).get('room')?.toUpperCase() || '';

  const syncAllViews = useCallback(
    (nextState: GameState) => {
      hostStateRef.current = nextState;
      setView(getPlayerView(nextState, playerId));
      const hostPeer = hostPeerRef.current;
      if (hostPeer) {
        for (const p of nextState.players) {
          if (p.id !== playerId && p.connected) {
            hostPeer.sendToPlayer(p.id, {
              type: 'STATE_SYNC',
              view: getPlayerView(nextState, p.id),
            });
          }
        }
      }
    },
    [playerId]
  );

  const handleHostAction = useCallback(
    (senderId: string, action: ClientAction) => {
      const current = hostStateRef.current;
      if (!current) return;

      switch (action.type) {
        case 'HELLO': {
          const res = addOrReconnectPlayer(current, action.playerId, action.name);
          if (res.error) {
            hostPeerRef.current?.sendToPlayer(action.playerId, {
              type: 'ERROR',
              message: res.error,
            });
            return;
          }
          syncAllViews(res.state);
          break;
        }
        case 'REVEAL_TRAIT': {
          const res = revealTrait(current, senderId, action.category);
          if (res.error) {
            if (senderId === playerId) setErrorText(res.error);
            else hostPeerRef.current?.sendToPlayer(senderId, { type: 'ERROR', message: res.error });
            return;
          }
          syncAllViews(res.state);
          break;
        }
        case 'USE_SPECIAL': {
          const res = useSpecialCard(
            current,
            senderId,
            action.cardId,
            action.targetPlayerId,
            action.category
          );
          if (res.error) {
            if (senderId === playerId) setErrorText(res.error);
            else hostPeerRef.current?.sendToPlayer(senderId, { type: 'ERROR', message: res.error });
            return;
          }
          syncAllViews(res.state);
          break;
        }
        case 'CAST_VOTE': {
          const res = castVote(current, senderId, action.targetPlayerId);
          if (res.error) {
            if (senderId === playerId) setErrorText(res.error);
            else hostPeerRef.current?.sendToPlayer(senderId, { type: 'ERROR', message: res.error });
            return;
          }
          syncAllViews(res.state);
          break;
        }
        case 'CHAT': {
          syncAllViews(addChatMessage(current, senderId, action.text));
          break;
        }
      }
    },
    [playerId, syncAllViews]
  );

  const handleLeave = useCallback(() => {
    hostPeerRef.current?.destroy();
    hostPeerRef.current = null;
    clientPeerRef.current?.destroy();
    clientPeerRef.current = null;
    hostStateRef.current = null;
    setIsHost(false);
    setView(null);
    setStatusText(null);
    setErrorText(null);
  }, []);

  useEffect(() => {
    return () => {
      hostPeerRef.current?.destroy();
      clientPeerRef.current?.destroy();
    };
  }, []);

  const createRoom = (name: string) => {
    localStorage.setItem('bunker_p2p_name', name);
    setSavedName(name);
    setErrorText(null);
    setStatusText('Запуск P2P-комнаты…');

    const code = generateRoomCode();
    const initial = createInitialState(code, playerId, name);
    hostStateRef.current = initial;
    setIsHost(true);

    hostPeerRef.current = new HostPeerSession(code, signaling, {
      onReady: () => {
        setStatusText(null);
        setView(getPlayerView(hostStateRef.current!, playerId));
      },
      onClientAction: (senderId, action) => handleHostAction(senderId, action),
      onClientDisconnect: (disconnectedId) => {
        if (hostStateRef.current) {
          syncAllViews(disconnectPlayer(hostStateRef.current, disconnectedId));
        }
      },
      onError: (msg) => {
        setStatusText(null);
        setErrorText(msg);
      },
    });
  };

  const joinRoom = (name: string, roomCode: string) => {
    localStorage.setItem('bunker_p2p_name', name);
    setSavedName(name);
    setErrorText(null);
    setStatusText(`Подключение к комнате ${roomCode}…`);
    setIsHost(false);

    clientPeerRef.current = new ClientPeerSession(roomCode, playerId, name, signaling, {
      onConnected: () => {
        setStatusText('Соединение установлено, ждём данные…');
      },
      onPacket: (packet) => {
        setStatusText(null);
        if (packet.type === 'ERROR') {
          setErrorText(packet.message);
        } else if (packet.type === 'STATE_SYNC') {
          setErrorText(null);
          setView(packet.view);
        }
      },
      onDisconnected: () => {
        setErrorText('Соединение с хостом потеряно.');
      },
      onError: (msg) => {
        setStatusText(null);
        setErrorText(msg);
      },
    });
  };

  const dispatchAction = (action: ClientAction) => {
    setErrorText(null);
    if (isHost) {
      handleHostAction(playerId, action);
    } else {
      clientPeerRef.current?.sendAction(action);
    }
  };

  const hostNextPhase = () => {
    const cur = hostStateRef.current;
    if (!cur) return;
    if (cur.phase === 'briefing') syncAllViews(startRevealPhase(cur));
    else if (cur.phase === 'discussion') syncAllViews(startVotingPhase(cur));
    else if (cur.phase === 'voting') syncAllViews(resolveVotes(cur));
    else if (cur.phase === 'round_result') syncAllViews(proceedAfterRoundResult(cur, true));
  };

  const hostAutoReveal = () => {
    const cur = hostStateRef.current;
    if (!cur || cur.phase !== 'reveal') return;
    const turnId = cur.turnOrder[cur.currentTurnIndex];
    const pl = cur.players.find((p) => p.id === turnId);
    if (!pl) return;
    const unrevealed = TRAIT_ORDER.find((cat) => !pl.traits[cat].revealed);
    if (unrevealed) {
      const res = revealTrait(cur, pl.id, unrevealed);
      syncAllViews(res.state);
    } else {
      syncAllViews(startDiscussionPhase(cur));
    }
  };

  const hostPlayAgain = () => {
    const cur = hostStateRef.current;
    if (!cur) return;
    const res = startGame(cur);
    if (!res.error) syncAllViews(res.state);
  };

  if (!view) {
    return (
      <HomeScreen
        initialRoomCode={initialRoomCode}
        initialName={savedName}
        signaling={signaling}
        statusText={statusText}
        errorText={errorText}
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
        onSaveSignaling={(cfg) => {
          saveSignalingConfig(cfg);
          setSignaling(cfg);
        }}
      />
    );
  }

  if (view.phase === 'lobby') {
    return (
      <LobbyScreen
        view={view}
        isHost={isHost}
        onUpdateSettings={(settings: GameSettings) => {
          if (hostStateRef.current) {
            syncAllViews({ ...hostStateRef.current, settings });
          }
        }}
        onStartGame={() => {
          if (!hostStateRef.current) return;
          const res = startGame(hostStateRef.current);
          if (res.error) setErrorText(res.error);
          else syncAllViews(res.state);
        }}
        onLeave={handleLeave}
      />
    );
  }

  return (
    <GameScreen
      view={view}
      isHost={isHost}
      errorText={errorText}
      onRevealTrait={(category: TraitCategory) =>
        dispatchAction({ type: 'REVEAL_TRAIT', category })
      }
      onUseSpecial={(cardId, targetPlayerId, category) =>
        dispatchAction({ type: 'USE_SPECIAL', cardId, targetPlayerId, category })
      }
      onCastVote={(targetPlayerId) =>
        dispatchAction({ type: 'CAST_VOTE', targetPlayerId })
      }
      onSendChat={(text) => dispatchAction({ type: 'CHAT', text })}
      onHostNextPhase={hostNextPhase}
      onHostAutoReveal={hostAutoReveal}
      onHostPlayAgain={hostPlayAgain}
      onLeave={handleLeave}
    />
  );
}

export default App;
