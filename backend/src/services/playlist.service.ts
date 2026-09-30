import { prisma } from './prisma.js';

export class PlaylistService {
  async getPlaylists(userId?: string) {
    const playlists = await prisma.playlist.findMany({
      where: userId
        ? {
            OR: [
              { isPublic: true },
              { ownerId: userId },
              { collaborators: { some: { userId, acceptedAt: { not: null } } } },
            ],
          }
        : { isPublic: true },
      include: {
        owner: { select: { id: true, name: true } },
        tracks: {
          include: { track: true },
          orderBy: { position: 'asc' },
        },
        collaborators: { select: { userId: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return playlists.map((p) => {
      const trackList = p.tracks.map((pt) => ({
        ...pt.track,
        audioUrl: `/api/v1/tracks/${pt.track.id}/stream`,
      }));
      const totalDuration = trackList.reduce((acc, t) => acc + t.duration, 0);

      return {
        id: p.id,
        title: p.title,
        description: p.description,
        coverUrl: p.coverUrl || trackList[0]?.artworkUrl || '',
        isPublic: p.isPublic,
        isAIGenerated: p.isAIGenerated,
        trackCount: trackList.length,
        totalDuration,
        createdAt: p.createdAt.toISOString(),
        owner: p.owner,
        trackIds: trackList.map((t) => t.id),
        tracks: trackList,
        collaboratorCount: p.collaborators.length,
      };
    });
  }

  async getPlaylistById(id: string, userId?: string) {
    const playlist = await prisma.playlist.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true } },
        tracks: {
          include: { track: true },
          orderBy: { position: 'asc' },
        },
        collaborators: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
    });

    if (!playlist) throw new Error('Playlist not found.');

    const isCollaborator = userId && playlist.collaborators.some(
      (c) => c.userId === userId && c.acceptedAt != null
    );

    if (!playlist.isPublic && playlist.ownerId !== userId && !isCollaborator) {
      throw new Error('Access denied to private playlist.');
    }

    const trackList = playlist.tracks.map((pt) => ({
      ...pt.track,
      audioUrl: `/api/v1/tracks/${pt.track.id}/stream`,
    }));

    return {
      id: playlist.id,
      title: playlist.title,
      description: playlist.description,
      coverUrl: playlist.coverUrl || trackList[0]?.artworkUrl || '',
      isPublic: playlist.isPublic,
      isAIGenerated: playlist.isAIGenerated,
      trackCount: trackList.length,
      totalDuration: trackList.reduce((acc, t) => acc + t.duration, 0),
      createdAt: playlist.createdAt.toISOString(),
      owner: playlist.owner,
      trackIds: trackList.map((t) => t.id),
      tracks: trackList,
      collaborators: playlist.collaborators.map((c) => ({
        user: c.user,
        role: c.role,
        joinedAt: c.acceptedAt,
      })),
    };
  }

  async createPlaylist(
    userId: string,
    data: { title: string; description?: string; coverUrl?: string; isPublic?: boolean; trackIds?: string[] }
  ) {
    const playlist = await prisma.playlist.create({
      data: {
        title: data.title,
        description: data.description,
        coverUrl: data.coverUrl,
        isPublic: data.isPublic ?? false,
        ownerId: userId,
        tracks: data.trackIds
          ? {
              create: data.trackIds.map((tId, idx) => ({
                trackId: tId,
                position: idx,
                addedById: userId,
              })),
            }
          : undefined,
        collaborators: {
          create: { userId, role: 'OWNER', acceptedAt: new Date() },
        },
      },
      include: {
        owner: { select: { id: true, name: true } },
        tracks: { include: { track: true }, orderBy: { position: 'asc' } },
      },
    });

    const trackList = playlist.tracks.map((pt) => ({
      ...pt.track,
      audioUrl: `/api/v1/tracks/${pt.track.id}/stream`,
    }));

    return {
      id: playlist.id,
      title: playlist.title,
      description: playlist.description,
      coverUrl: playlist.coverUrl || trackList[0]?.artworkUrl || '',
      isPublic: playlist.isPublic,
      trackCount: trackList.length,
      trackIds: data.trackIds || trackList.map((t) => t.id),
      tracks: trackList,
      createdAt: playlist.createdAt.toISOString(),
      owner: playlist.owner,
    };
  }

  async updatePlaylist(
    userId: string,
    id: string,
    data: { title?: string; description?: string; coverUrl?: string; isPublic?: boolean }
  ) {
    await this.requireOwnerOrEditor(id, userId);
    return prisma.playlist.update({ where: { id }, data });
  }

  async deletePlaylist(userId: string, id: string) {
    const playlist = await prisma.playlist.findUnique({ where: { id } });
    if (!playlist) throw new Error('Playlist not found.');
    if (playlist.ownerId !== userId) throw new Error('Only the owner can delete this playlist.');
    await prisma.playlist.delete({ where: { id } });
    return { success: true };
  }

  async addTrackToPlaylist(userId: string, playlistId: string, trackId: string) {
    await this.requireOwnerOrEditor(playlistId, userId);

    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
      include: { tracks: true },
    });
    if (!playlist) throw new Error('Playlist not found.');

    const maxPos = playlist.tracks.reduce((max, t) => Math.max(max, t.position), -1);

    const pt = await prisma.playlistTrack.upsert({
      where: { playlistId_trackId: { playlistId, trackId } },
      update: {},
      create: { playlistId, trackId, position: maxPos + 1, addedById: userId },
    });

    await prisma.playlistActivity.create({
      data: { playlistId, userId, action: 'track_added', payload: JSON.stringify({ trackId }) },
    });

    return pt;
  }

  async removeTrackFromPlaylist(userId: string, playlistId: string, trackId: string) {
    await this.requireOwnerOrEditor(playlistId, userId);
    await prisma.playlistTrack.deleteMany({ where: { playlistId, trackId } });
    await prisma.playlistActivity.create({
      data: { playlistId, userId, action: 'track_removed', payload: JSON.stringify({ trackId }) },
    });
    return { success: true };
  }

  // ============================================================
  // COLLABORATORS
  // ============================================================

  async getCollaborators(playlistId: string, userId: string) {
    const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
    if (!playlist) throw new Error('Playlist not found.');
    if (!playlist.isPublic && playlist.ownerId !== userId) throw new Error('Access denied.');

    return prisma.playlistCollaborator.findMany({
      where: { playlistId },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
  }

  async addCollaborator(requesterId: string, playlistId: string, targetUserId: string, role: 'EDITOR' | 'VIEWER' = 'VIEWER') {
    const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
    if (!playlist) throw new Error('Playlist not found.');
    if (playlist.ownerId !== requesterId) throw new Error('Only the owner can add collaborators.');

    return prisma.playlistCollaborator.upsert({
      where: { playlistId_userId: { playlistId, userId: targetUserId } },
      update: { role, acceptedAt: new Date() },
      create: { playlistId, userId: targetUserId, role, acceptedAt: new Date() },
    });
  }

  async removeCollaborator(requesterId: string, playlistId: string, targetUserId: string) {
    const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
    if (!playlist) throw new Error('Playlist not found.');
    if (playlist.ownerId !== requesterId && requesterId !== targetUserId) {
      throw new Error('Only the owner or the user themselves can remove this collaborator.');
    }
    await prisma.playlistCollaborator.deleteMany({ where: { playlistId, userId: targetUserId } });
    return { success: true };
  }

  async getActivity(playlistId: string, userId: string) {
    await this.checkAccess(playlistId, userId);
    return prisma.playlistActivity.findMany({
      where: { playlistId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ============================================================
  // AUTHORIZATION HELPERS
  // ============================================================

  private async requireOwnerOrEditor(playlistId: string, userId: string) {
    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
      include: { collaborators: { where: { userId } } },
    });
    if (!playlist) throw new Error('Playlist not found.');

    const isOwner = playlist.ownerId === userId;
    const isEditor = playlist.collaborators.some(
      (c) => c.userId === userId && c.role === 'EDITOR' && c.acceptedAt != null
    );

    if (!isOwner && !isEditor) {
      throw new Error('You do not have permission to edit this playlist.');
    }
  }

  private async checkAccess(playlistId: string, userId: string) {
    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
      include: { collaborators: { where: { userId } } },
    });
    if (!playlist) throw new Error('Playlist not found.');

    const hasAccess =
      playlist.isPublic ||
      playlist.ownerId === userId ||
      playlist.collaborators.some((c) => c.acceptedAt != null);

    if (!hasAccess) throw new Error('Access denied.');
  }
}

export const playlistService = new PlaylistService();
