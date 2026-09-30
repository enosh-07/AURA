import { prisma } from './prisma.js';

export interface RoomParticipant {
  id: string;
  name: string;
  avatar: string;
  role: 'host' | 'listener';
  ping: number;
}

export class RoomService {
  private activeParticipants: Map<string, RoomParticipant[]> = new Map();

  async listRooms() {
    const rooms = await prisma.room.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      rooms.map(async (r) => {
        let currentTrack = null;
        if (r.currentTrackId) {
          currentTrack = await prisma.track.findUnique({
            where: { id: r.currentTrackId },
            select: { id: true, title: true, artist: true, artworkUrl: true },
          });
        }
        let hostUser = null;
        if (r.hostId) {
          hostUser = await prisma.user.findUnique({
            where: { id: r.hostId },
            select: { id: true, name: true, avatarUrl: true },
          });
        }
        const participants = this.activeParticipants.get(r.id) || [];
        return {
          id: r.id,
          name: r.name,
          hostId: r.hostId,
          hostName: hostUser?.name || 'AURA Host',
          isPrivate: r.isPrivate,
          isPlaying: r.isPlaying,
          participantCount: Math.max(1, participants.length),
          currentTrack,
        };
      })
    );
  }

  async getRoom(roomId: string) {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' },
          take: 50,
        },
      },
    });

    if (!room) throw new Error('Room not found.');

    const participants = this.activeParticipants.get(roomId) || [
      {
        id: room.hostId,
        name: 'Host Node',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
        role: 'host',
        ping: 12,
      },
    ];

    let currentTrack = null;
    if (room.currentTrackId) {
      currentTrack = await prisma.track.findUnique({ where: { id: room.currentTrackId } });
    }

    return {
      roomId: room.id,
      name: room.name,
      hostId: room.hostId,
      currentTrack: currentTrack
        ? { ...currentTrack, audioUrl: `/api/v1/tracks/${currentTrack.id}/stream` }
        : null,
      currentTime: room.currentTime,
      isPlaying: room.isPlaying,
      participants,
      messages: room.messages,
    };
  }

  async createRoom(hostId: string, name: string, isPrivate = false) {
    const room = await prisma.room.create({
      data: {
        name,
        hostId,
        isPrivate,
        currentTrackId: 'track-1',
        currentTime: 0,
        isPlaying: false,
      },
    });
    return room;
  }

  async addMessage(roomId: string, userId: string, userName: string, text: string) {
    return prisma.roomMessage.create({
      data: {
        roomId,
        userId,
        userName,
        text,
      },
    });
  }

  updatePlayback(roomId: string, trackId: string | null, currentTime: number, isPlaying: boolean) {
    return prisma.room.update({
      where: { id: roomId },
      data: {
        currentTrackId: trackId,
        currentTime,
        isPlaying,
      },
    });
  }

  addParticipant(roomId: string, participant: RoomParticipant) {
    const list = this.activeParticipants.get(roomId) || [];
    if (!list.some((p) => p.id === participant.id)) {
      list.push(participant);
      this.activeParticipants.set(roomId, list);
    }
  }

  removeParticipant(roomId: string, participantId: string) {
    const list = this.activeParticipants.get(roomId) || [];
    this.activeParticipants.set(
      roomId,
      list.filter((p) => p.id !== participantId)
    );
  }
}

export const roomService = new RoomService();
