import { useCallback, useEffect, useRef, useState } from 'react';
import { ComboGameScreen } from './components/ComboGameScreen';
import { HomeScreen } from './components/HomeScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { GameScreen } from './components/GameScreen';
import {
  addComboPlayer,
  castComboVote,
  createComboInitialState,
  finalizeDraftBuild,
  markComboPlayerReady,
  placeComboCard,
  playTacticCard,
  proceedToNextComboRound,
  runComboBotTurn,
  startComboGame,
  swapHandCardWithDeck,
  tradeCardsBetweenPlayers,
} from './game/combo/comboEngine';
import { ComboGameState } from './game/combo/comboTypes';
import {
  addBotPlayer,
  addChatMessage,
  addOrReconnectPlayer,
  castVote,
  createInitialState,
  disconnectPlayer,
  getPlayerView,
  hostRerollBonusTrait,
  hostRerollPlayerTrait,
  hostUpdateBonusTrait,
  hostUpdatePlayerTrait,
  proceedAfterRoundResult,
  removeBotPlayer,
  resolveVotes,
  revealBonusTrait,
  revealTrait,
  runBotTurn,
  startDiscussionPhase,
  startGame,
  startRevealPhase,
  startVotingPhase,
  useSpecialCard,
  useTraitAbility,
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
  const [comboState, setComboState] = useState<ComboGameState | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const hostStateRef = useRef<GameState | null>(null);
  const comboStateRef = useRef<ComboGameState | null>(null);
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

  const syncAllComboViews = useCallback((nextCombo: ComboGameState) => {
    comboStateRef.current = nextCombo;
    setComboState(nextCombo);
    const hostPeer = hostPeerRef.current;
    const lobbyPlayers = hostStateRef.current?.players ?? [];
    if (hostPeer) {
      for (const p of lobbyPlayers) {
        if (p.id !== playerId && p.connected) {
          hostPeer.sendToPlayer(p.id, {
            type: 'COMBO_STATE_SYNC',
            comboState: nextCombo,
          });
        }
      }
    }
  }, [playerId]);

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
        case 'REVEAL_BONUS_TRAIT': {
          const res = revealBonusTrait(current, senderId, action.bonusId);
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
        case 'USE_TRAIT_ABILITY': {
          const res = useTraitAbility(
            current,
            senderId,
            action.category,
            action.targetPlayerId,
            action.targetCategory
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
        case 'COMBO_PLACE_CARD': {
          const curCombo = comboStateRef.current;
          if (!curCombo) return;
          const res = placeComboCard(curCombo, senderId, action.cardId, action.slotIndex);
          if (res.error) {
            if (senderId === playerId) setErrorText(res.error);
            else hostPeerRef.current?.sendToPlayer(senderId, { type: 'ERROR', message: res.error });
            return;
          }
          syncAllComboViews(res.state);
          break;
        }
        case 'COMBO_SWAP_DECK': {
          const curCombo = comboStateRef.current;
          if (!curCombo) return;
          const res = swapHandCardWithDeck(curCombo, senderId, action.cardId);
          if (res.error) {
            if (senderId === playerId) setErrorText(res.error);
            else hostPeerRef.current?.sendToPlayer(senderId, { type: 'ERROR', message: res.error });
            return;
          }
          syncAllComboViews(res.state);
          break;
        }
        case 'COMBO_BLIND_TRADE': {
          const curCombo = comboStateRef.current;
          if (!curCombo) return;
          const res = tradeCardsBetweenPlayers(
            curCombo,
            senderId,
            action.myCardId,
            action.targetPlayerId
          );
          if (res.error) {
            if (senderId === playerId) setErrorText(res.error);
            else hostPeerRef.current?.sendToPlayer(senderId, { type: 'ERROR', message: res.error });
            return;
          }
          syncAllComboViews(res.state);
          break;
        }
        case 'COMBO_PLAY_TACTIC': {
          const curCombo = comboStateRef.current;
          if (!curCombo) return;
          const res = playTacticCard(curCombo, senderId, action.cardId, {
            targetPlayerId: action.targetPlayerId,
            slotIndex: action.slotIndex,
            newCategory: action.newCategory,
          });
          if (res.error) {
            if (senderId === playerId) setErrorText(res.error);
            else hostPeerRef.current?.sendToPlayer(senderId, { type: 'ERROR', message: res.error });
            return;
          }
          syncAllComboViews(res.state);
          break;
        }
        case 'COMBO_READY': {
          const curCombo = comboStateRef.current;
          if (!curCombo) return;
          const res = markComboPlayerReady(curCombo, senderId);
          if (res.error) {
            if (senderId === playerId) setErrorText(res.error);
            else hostPeerRef.current?.sendToPlayer(senderId, { type: 'ERROR', message: res.error });
            return;
          }
          syncAllComboViews(res.state);
          break;
        }
        case 'COMBO_VOTE': {
          const curCombo = comboStateRef.current;
          if (!curCombo) return;
          const res = castComboVote(curCombo, senderId, action.likeTargetId, action.hateTargetId);
          if (res.error) {
            if (senderId === playerId) setErrorText(res.error);
            else hostPeerRef.current?.sendToPlayer(senderId, { type: 'ERROR', message: res.error });
            return;
          }
          syncAllComboViews(res.state);
          break;
        }
      }
    },
    [playerId, syncAllComboViews, syncAllViews]
  );

  const handleLeave = useCallback(() => {
    hostPeerRef.current?.destroy();
    hostPeerRef.current = null;
    clientPeerRef.current?.destroy();
    clientPeerRef.current = null;
    hostStateRef.current = null;
    comboStateRef.current = null;
    setIsHost(false);
    setView(null);
    setComboState(null);
    setStatusText(null);
    setErrorText(null);
  }, []);

  useEffect(() => {
    return () => {
      hostPeerRef.current?.destroy();
      clientPeerRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    if (!isHost || !hostStateRef.current) return;
    if (view?.phase !== 'reveal' && view?.phase !== 'voting') return;
    const cur = hostStateRef.current;
    const hasPendingBot =
      cur.phase === 'reveal'
        ? Boolean(cur.players.find((p) => p.id === cur.turnOrder[cur.currentTurnIndex] && p.isBot && p.alive))
        : Boolean(cur.players.find((p) => p.isBot && p.alive && p.voteWeight > 0 && cur.votes[p.id] === undefined));
    if (!hasPendingBot) return;

    const timer = setTimeout(() => {
      if (!hostStateRef.current) return;
      const res = runBotTurn(hostStateRef.current);
      if (res.acted) {
        syncAllViews(res.state);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [isHost, view?.phase, view?.currentTurnPlayerId, view?.votedPlayerIds.length, syncAllViews]);

  useEffect(() => {
    if (!isHost || !comboStateRef.current || !comboState) return;
    if (comboState.phase !== 'draft_build' && comboState.phase !== 'combo_vote') return;
    const hasPendingBot =
      comboState.phase === 'draft_build'
        ? comboState.players.some((p) => p.isBot && !p.ready)
        : comboState.players.some((p) => p.isBot && comboState.votes[p.id] === undefined);
    if (!hasPendingBot) return;

    const timer = setTimeout(() => {
      if (!comboStateRef.current) return;
      const res = runComboBotTurn(comboStateRef.current);
      if (res.acted) {
        syncAllComboViews(res.state);
      }
    }, 650);
    return () => clearTimeout(timer);
  }, [isHost, comboState, syncAllComboViews]);

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
        } else if (packet.type === 'COMBO_STATE_SYNC') {
          setErrorText(null);
          setComboState(packet.comboState);
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
    const unrevealed = TRAIT_ORDER.find((cat) => !pl.traits[cat].revealed && !pl.traits[cat].removed);
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
        onAddBot={() => {
          if (!hostStateRef.current) return;
          const res = addBotPlayer(hostStateRef.current);
          if (res.error) setErrorText(res.error);
          else syncAllViews(res.state);
        }}
        onRemoveBot={(botId) => {
          if (!hostStateRef.current) return;
          syncAllViews(removeBotPlayer(hostStateRef.current, botId));
        }}
        onStartGame={() => {
          const cur = hostStateRef.current;
          if (!cur) return;
          if ((cur.settings.gameMode ?? 'classic') === 'combo') {
            let nextCombo = createComboInitialState(
              cur.roomCode,
              cur.players[0]?.id ?? playerId,
              cur.players[0]?.name ?? 'Хост',
              {
                packs: cur.settings.packs,
                enableAdultContent: cur.settings.enableAdultContent,
                adultIntensity: cur.settings.adultIntensity ?? 'mixed',
                totalRounds: cur.settings.comboRounds ?? 5,
              }
            );
            for (const p of cur.players.slice(1)) {
              nextCombo = addComboPlayer(nextCombo, p.id, p.name, Boolean(p.isBot)).state;
            }
            const started = startComboGame(nextCombo);
            if (started.error) setErrorText(started.error);
            else syncAllComboViews(started.state);
            return;
          }
          const res = startGame(cur);
          if (res.error) setErrorText(res.error);
          else syncAllViews(res.state);
        }}
        onLeave={handleLeave}
      />
    );
  }

  if (comboState && comboState.phase !== 'lobby') {
    return (
      <ComboGameScreen
        state={comboState}
        myPlayerId={playerId}
        isHost={isHost}
        errorText={errorText}
        onPlaceCard={(cardId, slotIndex) =>
          dispatchAction({ type: 'COMBO_PLACE_CARD', cardId, slotIndex })
        }
        onSwapWithDeck={(cardId) =>
          dispatchAction({ type: 'COMBO_SWAP_DECK', cardId })
        }
        onBlindTrade={(myCardId, targetPlayerId) =>
          dispatchAction({ type: 'COMBO_BLIND_TRADE', myCardId, targetPlayerId })
        }
        onPlayTactic={(cardId, options) =>
          dispatchAction({
            type: 'COMBO_PLAY_TACTIC',
            cardId,
            targetPlayerId: options?.targetPlayerId,
            slotIndex: options?.slotIndex,
            newCategory: options?.newCategory,
          })
        }
        onMarkReady={() => dispatchAction({ type: 'COMBO_READY' })}
        onCastVote={(likeTargetId, hateTargetId) =>
          dispatchAction({ type: 'COMBO_VOTE', likeTargetId, hateTargetId })
        }
        onHostFinalizeDraft={() => {
          if (comboStateRef.current) {
            syncAllComboViews(finalizeDraftBuild(comboStateRef.current));
          }
        }}
        onHostNextRound={() => {
          if (comboStateRef.current) {
            const res = proceedToNextComboRound(comboStateRef.current);
            if (res.error) setErrorText(res.error);
            else syncAllComboViews(res.state);
          }
        }}
        onHostPlayAgain={() => {
          if (comboStateRef.current) {
            const res = startComboGame(comboStateRef.current);
            if (res.error) setErrorText(res.error);
            else syncAllComboViews(res.state);
          }
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
      onRevealBonusTrait={(bonusId: string) =>
        dispatchAction({ type: 'REVEAL_BONUS_TRAIT', bonusId })
      }
      onUseSpecial={(cardId, targetPlayerId, category) =>
        dispatchAction({ type: 'USE_SPECIAL', cardId, targetPlayerId, category })
      }
      onUseTraitAbility={(category, targetPlayerId, targetCategory) =>
        dispatchAction({ type: 'USE_TRAIT_ABILITY', category, targetPlayerId, targetCategory })
      }
      onCastVote={(targetPlayerId) =>
        dispatchAction({ type: 'CAST_VOTE', targetPlayerId })
      }
      onSendChat={(text) => dispatchAction({ type: 'CHAT', text })}
      onHostNextPhase={hostNextPhase}
      onHostAutoReveal={hostAutoReveal}
      onHostPlayAgain={hostPlayAgain}
      onHostGetPlayer={(targetId) =>
        hostStateRef.current?.players.find((p) => p.id === targetId) ?? null
      }
      onHostRerollTrait={(targetId, category) => {
        if (hostStateRef.current) {
          syncAllViews(hostRerollPlayerTrait(hostStateRef.current, targetId, category));
        }
      }}
      onHostUpdateTrait={(targetId, category, value, revealed) => {
        if (hostStateRef.current) {
          syncAllViews(
            hostUpdatePlayerTrait(hostStateRef.current, targetId, category, value, revealed)
          );
        }
      }}
      onHostRerollBonusTrait={(targetId, bonusId) => {
        if (hostStateRef.current) {
          syncAllViews(hostRerollBonusTrait(hostStateRef.current, targetId, bonusId));
        }
      }}
      onHostUpdateBonusTrait={(targetId, bonusId, value, revealed) => {
        if (hostStateRef.current) {
          syncAllViews(
            hostUpdateBonusTrait(hostStateRef.current, targetId, bonusId, value, revealed)
          );
        }
      }}
      onLeave={handleLeave}
    />
  );
}

export default App;
