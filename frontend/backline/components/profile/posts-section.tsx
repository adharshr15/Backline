import { View, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { ThemedText } from '../themed-text';
import { MediaTile } from '../media/media-tile';
import { Post } from '@/services/post.service';

interface ProfilePostsSectionProps {
    posts: Post[];
    isOwner: boolean;
    onAddPost: () => void;
    onPostPress: (post: Post) => void;
}

const GAP = 2;
const COLS = 3;

export default function ProfilePostsSection({ posts, isOwner, onAddPost, onPostPress }: ProfilePostsSectionProps) {
    const { width } = useWindowDimensions();
    const tile = (width - GAP * (COLS - 1)) / COLS;

    return (
        <View style={styles.container}>
            {isOwner && (
                <View style={styles.headerRow}>
                    <TouchableOpacity style={styles.newBtn} onPress={onAddPost}>
                        <ThemedText style={styles.newBtnText}>+ New Post</ThemedText>
                    </TouchableOpacity>
                </View>
            )}

            {posts.length === 0 ? (
                <TouchableOpacity
                    style={styles.empty}
                    activeOpacity={isOwner ? 0.7 : 1}
                    onPress={isOwner ? onAddPost : undefined}
                >
                    <ThemedText style={styles.emptyText}>
                        {isOwner ? 'Share your first post' : 'No posts yet'}
                    </ThemedText>
                </TouchableOpacity>
            ) : (
                <View style={styles.grid}>
                    {posts.map(post => (
                        <View key={post.id} style={{ marginBottom: GAP, marginRight: GAP }}>
                            <MediaTile post={post} size={tile} onPress={() => onPostPress(post)} />
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginHorizontal: -32,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 32,
        marginBottom: 8,
    },
    newBtn: {
        height: 32,
        paddingHorizontal: 12,
        backgroundColor: '#2a2a2a',
        borderRadius: 20,
        justifyContent: 'center',
        marginTop: -8,
    },
    newBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },
    // Negative right margin absorbs the trailing per-tile marginRight so the
    // 3-up grid stays flush to both edges.
    grid: { flexDirection: 'row', flexWrap: 'wrap', marginRight: -GAP },
    empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
    emptyText: { opacity: 0.4, fontSize: 14 },
});
