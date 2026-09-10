import api from './api';

export type OwnerType = 'USER' | 'BAND' | 'VENUE';
export type MediaType = 'PHOTO' | 'VIDEO';

export interface ProfilePreview {
    id: string;
    name: string;
    profileImageUrl?: string | null;
    accountType: string;
}

// Slim show attached to a post (the "linked show" card).
export interface PostShowPreview {
    id: string;
    posterUrl?: string | null;
    date: string;
    city: string;
    state: string;
    venueName?: string | null;
}

export interface PostComment {
    id: string;
    text: string;
    createdAt: string;
    commenterUserId: string;
    authorUser?: ProfilePreview | null;
    authorBand?: ProfilePreview | null;
    authorVenue?: ProfilePreview | null;
}

export interface Post {
    id: string;
    url: string;
    type: MediaType;
    caption?: string | null;
    uploaderUserId: string;
    ownerUserId?: string | null;
    ownerBandId?: string | null;
    ownerVenueId?: string | null;
    ownerUser?: ProfilePreview | null;
    ownerBand?: ProfilePreview | null;
    ownerVenue?: ProfilePreview | null;
    showId?: string | null;
    show?: PostShowPreview | null;
    createdAt: string;
    _count?: { comments: number; likes: number };
    likedByViewer?: boolean;
    // Only present on getPost():
    comments?: PostComment[];
}

/** The owning profile of a post (whichever type is set). */
export function getPostOwner(post: Post): ProfilePreview | null {
    return post.ownerUser ?? post.ownerBand ?? post.ownerVenue ?? null;
}

/** The authoring profile of a comment (whichever type is set). */
export function getCommentAuthor(c: PostComment): ProfilePreview | null {
    return c.authorUser ?? c.authorBand ?? c.authorVenue ?? null;
}

interface Viewer { type: OwnerType; id: string }
const viewerParams = (v?: Viewer) => (v ? { viewerType: v.type, viewerId: v.id } : {});

export const getProfilePosts = async (
    ownerType: OwnerType, ownerId: string, viewer?: Viewer,
): Promise<Post[]> => {
    const res = await api.get('/posts', { params: { ownerType, ownerId, ...viewerParams(viewer) } });
    return res.data;
};

export const getShowPosts = async (showId: string, viewer?: Viewer): Promise<Post[]> => {
    const res = await api.get(`/shows/${showId}/posts`, { params: viewerParams(viewer) });
    return res.data;
};

export const getPost = async (id: string, viewer?: Viewer): Promise<Post> => {
    const res = await api.get(`/posts/${id}`, { params: viewerParams(viewer) });
    return res.data;
};

export const createPost = async (args: {
    file: { uri: string; name: string; type: string };
    type: MediaType;
    ownerType: OwnerType;
    ownerId: string;
    caption?: string;
    showId?: string;
}): Promise<Post> => {
    const formData = new FormData();
    formData.append('media', args.file as any);
    formData.append('type', args.type);
    formData.append('ownerType', args.ownerType);
    formData.append('ownerId', args.ownerId);
    if (args.caption) formData.append('caption', args.caption);
    if (args.showId) formData.append('showId', args.showId);

    const res = await api.post('/posts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
};

export const deletePost = async (id: string): Promise<void> => {
    await api.delete(`/posts/${id}`);
};

export const addComment = async (
    postId: string, authorType: OwnerType, authorId: string, text: string,
): Promise<PostComment> => {
    const res = await api.post(`/posts/${postId}/comments`, { authorType, authorId, text });
    return res.data;
};

export const deleteComment = async (commentId: string): Promise<void> => {
    await api.delete(`/posts/comments/${commentId}`);
};

export const likePost = async (
    postId: string, likerType: OwnerType, likerId: string,
): Promise<{ liked: boolean; likeCount: number }> => {
    const res = await api.post(`/posts/${postId}/like`, { likerType, likerId });
    return res.data;
};

export const unlikePost = async (
    postId: string, likerType: OwnerType, likerId: string,
): Promise<{ liked: boolean; likeCount: number }> => {
    const res = await api.delete(`/posts/${postId}/like`, { data: { likerType, likerId } });
    return res.data;
};
