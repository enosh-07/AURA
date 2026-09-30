import { Server, Socket } from 'socket.io';
import { roomService } from '../services/room.service.js';

export const setupRoomSocket = (io: Server) => {
  const roomNamespace = io.of('/ws');

  roomNamespace.on('connection', (socket: Socket) => {
    let currentRoomId: string | null = null;
    let participantId: string | null = null;

    socket.on('join_room', async (data: { roomId: string; userId: string; userName: string }) => {
      currentRoomId = data.roomId;
      participantId = data.userId;
      socket.join(data.roomId);

      roomService.addParticipant(data.roomId, {
        id: data.userId,
        name: data.userName,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
        role: data.userId === 'usr_demo_1' ? 'host' : 'listener',
        ping: Math.floor(Math.random() * 15) + 8,
      });

      const roomData = await roomService.getRoom(data.roomId);
      roomNamespace.to(data.roomId).emit('room_state', roomData);
    });

    socket.on('host_play', async (data: { roomId: string; trackId: string; currentTime: number }) => {
      await roomService.updatePlayback(data.roomId, data.trackId, data.currentTime, true);
      socket.to(data.roomId).emit('playback_sync', {
        isPlaying: true,
        currentTime: data.currentTime,
        trackId: data.trackId,
      });
    });

    socket.on('host_pause', async (data: { roomId: string; currentTime: number }) => {
      await roomService.updatePlayback(data.roomId, null, data.currentTime, false);
      socket.to(data.roomId).emit('playback_sync', {
        isPlaying: false,
        currentTime: data.currentTime,
      });
    });

    socket.on('host_seek', async (data: { roomId: string; currentTime: number }) => {
      await roomService.updatePlayback(data.roomId, null, data.currentTime, true);
      socket.to(data.roomId).emit('playback_sync', {
        currentTime: data.currentTime,
      });
    });

    socket.on('chat_message', async (data: { roomId: string; userId: string; userName: string; text: string }) => {
      const msg = await roomService.addMessage(data.roomId, data.userId, data.userName, data.text);
      roomNamespace.to(data.roomId).emit('chat_broadcast', msg);
    });

    socket.on('disconnect', () => {
      if (currentRoomId && participantId) {
        roomService.removeParticipant(currentRoomId, participantId);
        socket.to(currentRoomId).emit('user_left', { participantId });
      }
    });
  });
};
