import { useState, useCallback } from 'react';
import {
  View, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTabHref } from '@/hooks/use-tab-href';
import { useAuth } from '@/context/AuthContext';
import { BASE_URL } from '@/services/api';
import {
  Post, PostComment, OwnerType,
  getPost, deletePost, addComment, deleteComment, likePost, unlikePost,
  getPostOwner, getCommentAuthor,
} from '@/services/post.service';

const AVATAR = require('@/assets/images/default/profileImage.png');

function ownerTypeOf(accountType?: string): OwnerType {
  return accountType === 'BAND' ? 'BAND' : accountType === 'VENUE' ? 'VENUE' : 'USER';
}
function profileRouteSeg(accountType?: string) {
  return accountType === 'BAND' ? 'view-band' : accountType === 'VENUE' ? 'view-venue' : 'view-user';
}
function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const tabHref = useTabHref();
  const { user, activeProfile } = useAuth();
  const bg = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'icon');

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const viewer = activeProfile
    ? { type: ownerTypeOf(activeProfile.accountType), id: activeProfile.id }
    : undefined;

  const load = useCallback(() => {
    if (!id) return;
    getPost(id, viewer)
      .then(p => {
        setPost(p);
        setLiked(!!p.likedByViewer);
        setLikeCount(p._count?.likes ?? 0);
        setComments(p.comments ?? []);
      })
      .catch(() => setPost(null))
      .finally(() => setLoading(false));
  }, [id, activeProfile?.id]);

  useFocusEffect(load);

  const uri = post ? `${BASE_URL}${post.url}` : null;
  const player = useVideoPlayer(post?.type === 'VIDEO' ? uri : null, p => { p.loop = false; });

  const owner = post ? getPostOwner(post) : null;

  const toggleLike = async () => {
    if (!post || !viewer) return;
    const next = !liked;
    setLiked(next);
    setLikeCount(c => c + (next ? 1 : -1));
    try {
      const res = next
        ? await likePost(post.id, viewer.type, viewer.id)
        : await unlikePost(post.id, viewer.type, viewer.id);
      setLiked(res.liked);
      setLikeCount(res.likeCount);
    } catch {
      setLiked(!next);
      setLikeCount(c => c + (next ? -1 : 1));
    }
  };

  const submitComment = async () => {
    if (!post || !viewer || !commentText.trim() || submitting) return;
    try {
      setSubmitting(true);
      const c = await addComment(post.id, viewer.type, viewer.id, commentText.trim());
      setComments(prev => [...prev, c]);
      setCommentText('');
    } catch {
      Alert.alert('Comment failed', 'Could not post your comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const removeComment = (commentId: string) => {
    deleteComment(commentId)
      .then(() => setComments(prev => prev.filter(c => c.id !== commentId)))
      .catch(() => Alert.alert('Not allowed', 'Could not delete this comment.'));
  };

  const confirmDeletePost = () => {
    if (!post) return;
    Alert.alert('Delete post', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => deletePost(post.id)
          .then(() => router.back())
          .catch(() => Alert.alert('Not allowed', 'Could not delete this post.')),
      },
    ]);
  };

  const openOwner = () => {
    if (!owner) return;
    router.push(tabHref(`${profileRouteSeg(owner.accountType)}/${owner.id}`));
  };

  const canDeletePost = !!user && !!post &&
    (post.uploaderUserId === user.id || (!!activeProfile && owner?.id === activeProfile.id));
  const canDeleteComment = (c: PostComment) =>
    !!user && (c.commenterUserId === user.id || (!!activeProfile && owner?.id === activeProfile.id));

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
        <ActivityIndicator style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }
  if (!post) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: borderColor + '33' }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={textColor} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Post</ThemedText>
          <View style={styles.iconBtn} />
        </View>
        <ThemedText style={styles.notFound}>Post not found</ThemedText>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: borderColor + '33' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Post</ThemedText>
        {canDeletePost
          ? <TouchableOpacity onPress={confirmDeletePost} style={styles.iconBtn} hitSlop={8}>
              <Ionicons name="trash-outline" size={20} color={textColor} />
            </TouchableOpacity>
          : <View style={styles.iconBtn} />}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Owner header */}
          <TouchableOpacity style={styles.ownerRow} onPress={openOwner} activeOpacity={0.7}>
            <Image
              source={owner?.profileImageUrl ? { uri: `${BASE_URL}${owner.profileImageUrl}` } : AVATAR}
              style={styles.ownerAvatar}
            />
            <ThemedText style={styles.ownerName}>{owner?.name ?? 'Unknown'}</ThemedText>
          </TouchableOpacity>

          {/* Media */}
          <View style={styles.mediaWrap}>
            {post.type === 'VIDEO'
              ? <VideoView player={player} style={styles.media} nativeControls contentFit="contain" allowsFullscreen />
              : <Image source={{ uri: uri! }} style={styles.media} contentFit="contain" />}
          </View>

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={toggleLike} disabled={!viewer} style={styles.actionBtn} hitSlop={8}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={26} color={liked ? '#E0245E' : textColor} />
              {likeCount > 0 && <ThemedText style={styles.actionCount}>{likeCount}</ThemedText>}
            </TouchableOpacity>
            <View style={styles.actionBtn}>
              <Ionicons name="chatbubble-outline" size={23} color={textColor} />
              {comments.length > 0 && <ThemedText style={styles.actionCount}>{comments.length}</ThemedText>}
            </View>
          </View>

          {/* Caption */}
          {post.caption ? (
            <View style={styles.captionRow}>
              <ThemedText style={styles.captionText}>
                <ThemedText style={styles.captionName}>{owner?.name ?? ''} </ThemedText>
                {post.caption}
              </ThemedText>
            </View>
          ) : null}

          {/* Linked show */}
          {post.show ? (
            <TouchableOpacity
              style={[styles.showCard, { borderColor: borderColor + '33' }]}
              onPress={() => router.push({ pathname: tabHref('show'), params: { id: post.show!.id } })}
              activeOpacity={0.7}
            >
              <Image
                source={post.show.posterUrl ? { uri: `${BASE_URL}${post.show.posterUrl}` } : require('@/assets/images/default/headerImage.png')}
                style={styles.showThumb}
                contentFit="cover"
              />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.showCardLabel}>FROM A SHOW</ThemedText>
                <ThemedText style={styles.showCardTitle} numberOfLines={1}>
                  {post.show.venueName ?? `${post.show.city}, ${post.show.state}`}
                </ThemedText>
                <ThemedText style={styles.showCardSub}>{shortDate(post.show.date)}</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={borderColor} />
            </TouchableOpacity>
          ) : null}

          {/* Comments */}
          <View style={styles.commentsSection}>
            {comments.map(c => {
              const author = getCommentAuthor(c);
              return (
                <View key={c.id} style={styles.commentRow}>
                  <Image
                    source={author?.profileImageUrl ? { uri: `${BASE_URL}${author.profileImageUrl}` } : AVATAR}
                    style={styles.commentAvatar}
                  />
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.commentText}>
                      <ThemedText style={styles.commentName}>{author?.name ?? 'Unknown'} </ThemedText>
                      {c.text}
                    </ThemedText>
                  </View>
                  {canDeleteComment(c) && (
                    <TouchableOpacity onPress={() => removeComment(c.id)} hitSlop={8}>
                      <Ionicons name="close" size={16} color={borderColor} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
            {comments.length === 0 && (
              <ThemedText style={styles.noComments}>No comments yet</ThemedText>
            )}
          </View>
        </ScrollView>

        {/* Add comment */}
        {viewer && (
          <View style={[styles.inputBar, { borderTopColor: borderColor + '33', backgroundColor: bg }]}>
            <TextInput
              style={[styles.input, { color: textColor, borderColor: borderColor + '55' }]}
              placeholder="Add a comment..."
              placeholderTextColor={borderColor}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!commentText.trim() || submitting) && { opacity: 0.4 }]}
              onPress={submitComment}
              disabled={!commentText.trim() || submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="arrow-up" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { width: 40, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5, opacity: 0.6, textTransform: 'uppercase' },
  notFound: { textAlign: 'center', marginTop: 40, opacity: 0.5 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  ownerAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1e1e1e' },
  ownerName: { fontSize: 15, fontWeight: '600' },
  mediaWrap: { width: '100%', aspectRatio: 1, backgroundColor: '#000' },
  media: { width: '100%', height: '100%' },
  actionsRow: { flexDirection: 'row', gap: 18, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionCount: { fontSize: 14, fontWeight: '600' },
  captionRow: { paddingHorizontal: 14, paddingVertical: 6 },
  captionText: { fontSize: 15, lineHeight: 21 },
  captionName: { fontWeight: '700' },
  showCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 14,
    marginTop: 10,
    padding: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
  },
  showThumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: '#1e1e1e' },
  showCardLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1, opacity: 0.4 },
  showCardTitle: { fontSize: 15, fontWeight: '600', marginTop: 1 },
  showCardSub: { fontSize: 12, opacity: 0.5, marginTop: 1 },
  commentsSection: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 20, gap: 12 },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  commentAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1e1e1e' },
  commentText: { fontSize: 14, lineHeight: 19 },
  commentName: { fontWeight: '700' },
  noComments: { opacity: 0.4, fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#4A90D9',
    alignItems: 'center', justifyContent: 'center',
  },
});
