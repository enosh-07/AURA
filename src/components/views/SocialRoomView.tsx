import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAudioStore } from '../../stores/useAudioStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { apiClient } from '../../services/apiClient';
import {
  Users,
  Radio,
  Copy,
  Check,
  Crown,
  Volume2,
  MessageSquare,
  Wifi,
  WifiOff,
  Plus,
  Compass,
  Play,
  Share2,
  Sparkles,
  ChevronRight,
  Disc,
} from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  avatar: string;
  role: 'host' | 'listener';
  ping: number;
}

interface ChatMessage {
  sender: string;
  text: string;
  time: string;
}

interface RoomSummary {
  id: string;
  name: string;
  hostName: string;
  participantCount: number;
  currentTrack?: {
    id: string;
    title: string;
    artist: string;
    artworkUrl: string;
  } | null;
}

export const SocialRoomView: React.FC = () => {
  const currentTrack = useAudioStore((state) => state.currentTrack);
  const playTrack = useAudioStore((state) => state.playTrack);
  const currentTime = useAudioStore((state) => state.currentTime);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const allTracks = useLibraryStore((state) => state.allTracks);
  const user = useAuthStore((state) => state.user);

  const [activeRoomId, setActiveRoomId] = useState('node-404');
  const [roomName, setRoomName] = useState('CYBERPULSE Sonic Node #404');
  const [hostId, setHostId] = useState('usr_demo_1');
  const [copied, setCopied] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<RoomSummary[]>([]);
  const [showRoomBrowser, setShowRoomBrowser] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [chatInput, setChatInput] = useState('');

  const [messages, setMessages] = useState<ChatMessage[]>([
    { sender: 'AURA System', text: 'Quantum synchronized audio session online.', time: '14:02' },
    { sender: 'Alex Mercer (Host)', text: 'Welcome everyone! Testing the new 10-band spatial mix.', time: '14:04' },
    { sender: 'Echo', text: 'The low-end sub bass sounds incredible!', time: '14:05' },
  ]);

  const [participants, setParticipants] = useState<Participant[]>([
    {
      id: 'usr_demo_1',
      name: 'Alex Mercer (Host)',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
      role: 'host',
      ping: 8,
    },
  ]);

  const socketRef = useRef<Socket | null>(null);

  // Fetch active rooms on mount
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const rooms = await apiClient.getRooms();
        if (rooms && rooms.length > 0) {
          setAvailableRooms(rooms);
        }
      } catch {
        // Fallback
      }
    };
    fetchRooms();
  }, []);

  // Connect & switch room
  useEffect(() => {
    const socket = io('http://localhost:4000/ws', {
      transports: ['websocket', 'polling'],
      timeout: 3000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join_room', {
        roomId: activeRoomId,
        userId: user?.id || `usr_guest_${Math.random().toString(36).slice(2, 6)}`,
        userName: user?.name || 'AURA Node Member',
      });
    });

    socket.on('room_state', (data: any) => {
      if (data) {
        if (data.name) setRoomName(data.name);
        if (data.hostId) setHostId(data.hostId);
        if (Array.isArray(data.participants) && data.participants.length > 0) {
          setParticipants(data.participants);
        }
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          const mapped = data.messages.map((m: any) => ({
            sender: m.userName || m.userId,
            text: m.text,
            time: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }));
          setMessages(mapped);
        }
      }
    });

    socket.on('chat_broadcast', (msg: any) => {
      if (msg) {
        setMessages((prev) => [
          ...prev,
          {
            sender: msg.userName || 'Node Member',
            text: msg.text,
            time: new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
        ]);
      }
    });

    socket.on('playback_sync', (sync: any) => {
      if (sync && sync.trackId) {
        const match = allTracks.find((t) => t.id === sync.trackId);
        if (match) {
          playTrack(match);
        }
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [activeRoomId, user, allTracks]);

  const handleCopyInvite = () => {
    const url = `${window.location.origin}?room=${activeRoomId}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const text = chatInput.trim();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (socketRef.current && isConnected) {
      socketRef.current.emit('chat_message', {
        roomId: activeRoomId,
        userId: user?.id || 'guest',
        userName: user?.name || 'You',
        text,
      });
    } else {
      setMessages((prev) => [
        ...prev,
        {
          sender: user?.name || 'You',
          text,
          time: timeStr,
        },
      ]);
    }
    setChatInput('');
  };

  const handleBroadcastCurrentTrack = () => {
    if (!currentTrack || !socketRef.current || !isConnected) return;
    socketRef.current.emit('host_play', {
      roomId: activeRoomId,
      trackId: currentTrack.id,
      currentTime: Math.round(currentTime),
    });
    setMessages((prev) => [
      ...prev,
      {
        sender: 'AURA Sync System',
        text: `Broadcasting "${currentTrack.title}" by ${currentTrack.artist} to all listeners in room.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleCreateNewRoom = async () => {
    if (!newRoomName.trim()) return;
    try {
      const created = await apiClient.createRoom(newRoomName.trim(), false);
      if (created) {
        setRoomName(created.name);
        setActiveRoomId(created.id);
        setShowCreateRoom(false);
        setNewRoomName('');
        // Refresh available
        const updated = await apiClient.getRooms();
        setAvailableRooms(updated);
      }
    } catch {
      // Fallback
    }
  };

  const isHost = user?.id === hostId || hostId === 'usr_demo_1';

  return (
    <div className="flex flex-col gap-8 pb-32 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-aura-cyan font-bold flex items-center gap-1.5 mb-1">
            <Radio className="w-3.5 h-3.5 animate-pulse" /> Collaborative Audio Hub
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-center gap-3">
            {roomName}
            {isConnected ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-aura-emerald/20 text-aura-emerald border border-aura-emerald/30">
                <Wifi className="w-3 h-3" /> Live Sync
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-aura-crimson/20 text-aura-crimson border border-aura-crimson/30">
                <WifiOff className="w-3 h-3" /> Offline Node
              </span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-aura-muted mt-1">
            Synchronized zero-latency listening session across connected nodes.
          </p>
        </div>

        {/* Room Switcher & Create Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRoomBrowser(!showRoomBrowser)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white border border-white/10 transition-colors"
          >
            <Compass className="w-4 h-4 text-aura-cyan" />
            Switch Node ({availableRooms.length || 1})
          </button>
          <button
            onClick={() => setShowCreateRoom(!showCreateRoom)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-aura-cyan border border-aura-cyan/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Node
          </button>
          <button
            onClick={handleCopyInvite}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-aura-cyan to-aura-violet text-aura-void font-bold text-xs shadow-glow-cyan/20 hover:scale-105 active:scale-95 transition-all"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied Link' : 'Invite Node'}
          </button>
        </div>
      </div>

      {/* Create Room Drawer */}
      {showCreateRoom && (
        <div className="p-5 rounded-3xl bg-aura-card border border-aura-cyan/30 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Radio className="w-4 h-4 text-aura-cyan" /> Launch New Social Audio Node
          </h3>
          <div className="flex gap-2 max-w-lg">
            <input
              type="text"
              placeholder="e.g. Neo-Tokyo Ambient Chill Node"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              className="flex-1 bg-aura-surface border border-white/10 text-xs text-white rounded-xl px-3 py-2 outline-none focus:border-aura-cyan"
              autoFocus
            />
            <button
              onClick={handleCreateNewRoom}
              className="px-4 py-2 rounded-xl bg-aura-cyan text-aura-void font-bold text-xs shadow-glow-cyan"
            >
              Launch Node
            </button>
          </div>
        </div>
      )}

      {/* Available Rooms Directory */}
      {showRoomBrowser && (
        <div className="p-5 rounded-3xl bg-aura-card border border-aura-border flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <h3 className="text-xs font-bold text-aura-muted uppercase tracking-wider">Active Public Audio Nodes</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableRooms.map((room) => (
              <div
                key={room.id}
                onClick={() => {
                  setActiveRoomId(room.id);
                  setRoomName(room.name);
                  setShowRoomBrowser(false);
                }}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  room.id === activeRoomId
                    ? 'bg-aura-cyan/15 border-aura-cyan shadow-glow-cyan/20'
                    : 'bg-aura-surface hover:bg-white/10 border-white/5'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white truncate">{room.name}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-aura-cyan">
                    {room.participantCount || 1} online
                  </span>
                </div>
                <p className="text-[11px] text-aura-muted">Host: {room.hostName || 'AURA Node'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Broadcast Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Stage Visualizer & Synchronized Track */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="p-6 rounded-3xl bg-gradient-to-br from-aura-card to-aura-base border border-aura-border flex flex-col gap-6 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-aura-cyan tracking-wider flex items-center gap-2">
                <Crown className="w-4 h-4 text-aura-amber" /> Synchronized Playback
              </span>
              {currentTrack && (
                <button
                  onClick={handleBroadcastCurrentTrack}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-aura-cyan/20 hover:bg-aura-cyan text-aura-cyan hover:text-aura-void text-xs font-bold border border-aura-cyan/30 transition-all"
                >
                  <Share2 className="w-3.5 h-3.5" /> Broadcast Track to Node
                </button>
              )}
            </div>

            {currentTrack ? (
              <div className="flex items-center gap-5">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-aura-surface border border-white/10 flex-shrink-0 shadow-xl">
                  <img src={currentTrack.artwork} alt={currentTrack.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-mono text-aura-emerald uppercase font-bold tracking-widest">
                    Transmitting Live
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-white truncate tracking-tight">
                    {currentTrack.title}
                  </h2>
                  <p className="text-sm text-aura-muted truncate">{currentTrack.artist}</p>
                  <div className="flex items-center gap-3 text-xs text-aura-muted font-mono mt-2">
                    <span>{currentTrack.genre || 'Harmonic Audio'}</span>
                    <span>•</span>
                    <span>{currentTrack.bpm ? `${currentTrack.bpm} BPM` : '124 BPM'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-aura-muted">
                No active track streaming. Select a track to broadcast it to all listeners in this room!
              </div>
            )}
          </div>

          {/* Node Participants */}
          <div className="p-6 rounded-3xl bg-aura-card/40 border border-aura-border flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-aura-cyan" /> Connected Listeners ({participants.length})
              </h3>
              <span className="text-[10px] font-mono text-aura-muted">AURA Mesh Network</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <img src={p.avatar} alt={p.name} className="w-9 h-9 rounded-xl object-cover" />
                    <div>
                      <p className="text-xs font-bold text-white flex items-center gap-1.5">
                        {p.name}
                        {p.role === 'host' && <Crown className="w-3 h-3 text-aura-amber" />}
                      </p>
                      <span className="text-[10px] text-aura-muted capitalize">{p.role}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-aura-emerald">{p.ping}ms</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Live Chat */}
        <div className="flex flex-col h-[550px] rounded-3xl bg-aura-card border border-aura-border overflow-hidden">
          <div className="p-4 border-b border-white/10 bg-aura-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-aura-cyan" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Node Frequency Chat</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.map((m, idx) => (
              <div key={idx} className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-aura-cyan font-semibold">{m.sender}</span>
                  <span className="text-aura-muted">{m.time}</span>
                </div>
                <p className="text-xs text-slate-200 bg-white/5 rounded-xl p-2.5 border border-white/5">{m.text}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendChat} className="p-3 bg-aura-base border-t border-white/10 flex items-center gap-2">
            <input
              type="text"
              placeholder="Send message to room..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 bg-aura-card border border-white/10 text-xs text-white rounded-xl px-3 py-2 outline-none focus:border-aura-cyan"
            />
            <button type="submit" className="px-3 py-2 rounded-xl bg-aura-cyan text-aura-void font-bold text-xs">
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
