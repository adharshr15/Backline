// services/user.service.ts
import api from './api';
import type { ExploreCraft } from './explore.service';

/** Mirrors the backend Craft enum. Order is the picker's display order. */
export const CRAFTS = [
  'PHOTOGRAPHER', 'VIDEOGRAPHER', 'PROMOTER', 'SOUND_ENGINEER', 'BOOKER',
  'TOUR_MANAGER', 'STAGE_MANAGER', 'LIGHTING_TECH', 'DESIGNER', 'MERCH',
  'JOURNALIST', 'DJ', 'LUTHIER', 'INSTRUCTOR',
] as const;

export type Craft = typeof CRAFTS[number];

/** Backend limits: MAX_CRAFTS / MAX_HEADLINE in user.controller.ts. */
export const MAX_CRAFTS = 6;
export const MAX_HEADLINE = 120;

export const craftLabel = (craft: string) =>
  craft
    .toLowerCase()
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

export interface DiscoveredUser {
  id: string;
  username: string;
  name: string;
  accountType: string;
  bio?: string | null;
  city?: string | null;
  state?: string | null;
  profileImageUrl?: string | null;
  crafts: ExploreCraft[];
  subtitle: string;
}

export const updateMe = async (data: {
  name: string;
  username: string;
  bio?: string;
  city?: string;
  state?: string;
  country?: string;
  profileImage?: string | null;
  headerImage?: string | null;
}) => {
  const formData = new FormData();

  if (data.name) formData.append('name', data.name);
  if (data.username) formData.append('username', data.username);
  if (data.bio) formData.append('bio', data.bio);
  if (data.city) formData.append('city', data.city);
  if (data.state) formData.append('state', data.state);
  if (data.country) formData.append('country', data.country);

  // ONLY append if it's a NEW file
  if (data.profileImage?.startsWith('file://')) {
    formData.append('profileImage', {
      uri: data.profileImage,
      name: 'profile.jpg',
      type: 'image/jpeg',
    } as any);
  }

  if (data.headerImage?.startsWith('file://')) {
    formData.append('headerImage', {
      uri: data.headerImage,
      name: 'header.jpg',
      type: 'image/jpeg',
    } as any);
  }


  const response = await api.put('/users/me', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

/**
 * A user's crafts. `/auth/me` does not carry them, so the owner's own edit and
 * profile screens read them from here.
 */
export const getUserCrafts = async (userId: string): Promise<ExploreCraft[]> => {
  const response = await api.get(`/users/id/${userId}`);
  return response.data?.crafts ?? [];
};

/**
 * PUT /users/me/crafts — replaces the whole set, so sending a shorter array is
 * the "undo". Array order becomes `position`; index 0 is the primary craft.
 */
export const updateMyCrafts = async (
  crafts: { craft: string; forHire?: boolean; headline?: string | null }[],
): Promise<ExploreCraft[]> => {
  const response = await api.put('/users/me/crafts', { crafts });
  return response.data?.crafts ?? [];
};

export type RecommenderType = 'USER' | 'BAND' | 'VENUE';

export interface CraftRecommendation {
  craft: string;
  count: number;
  recommendedByViewer: boolean;
}

export const recommendationsByCraft = (list: CraftRecommendation[]): Record<string, CraftRecommendation> =>
  Object.fromEntries(list.map(r => [r.craft, r]));

/** One entry per craft the user lists. Pass `viewer` to learn which ones it recommended. */
export const getCraftRecommendations = async (
  userId: string,
  viewer?: { type: RecommenderType; id: string },
): Promise<CraftRecommendation[]> => {
  const params = viewer ? { viewerType: viewer.type, viewerId: viewer.id } : {};
  const response = await api.get(`/users/${userId}/recommendations`, { params });
  return response.data ?? [];
};

export const recommendCraft = async (
  userId: string, craft: string, recommenderType: RecommenderType, recommenderId: string,
): Promise<{ recommended: boolean; count: number }> => {
  const response = await api.post(`/users/${userId}/crafts/${craft}/recommend`, { recommenderType, recommenderId });
  return response.data;
};

export const unrecommendCraft = async (
  userId: string, craft: string, recommenderType: RecommenderType, recommenderId: string,
): Promise<{ recommended: boolean; count: number }> => {
  const response = await api.delete(`/users/${userId}/crafts/${craft}/recommend`, { data: { recommenderType, recommenderId } });
  return response.data;
};

export const discoverUsers = async (opts: {
  craft?: string;
  forHire?: boolean;
  city?: string;
  state?: string;
  sceneSlug?: string;
  q?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{ people: DiscoveredUser[]; hasMore: boolean }> => {
  const response = await api.get('/users/discover', { params: opts });
  return { people: response.data?.people ?? [], hasMore: response.data?.hasMore ?? false };
};