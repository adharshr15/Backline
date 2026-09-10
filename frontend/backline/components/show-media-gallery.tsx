import {
    Modal, View, TouchableOpacity, FlatList, StyleSheet,
    ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { MediaTile } from '@/components/media/media-tile';
import { Post } from '@/services/post.service';

type Props = {
    visible: boolean;
    posts: Post[];
    onClose: () => void;
    onOpenPost: (postId: string) => void;
    onAdd?: () => void;
    canAdd?: boolean;
    adding?: boolean;
};

/** Full-grid modal of a show's linked posts. Tapping a tile opens that post. */
export default function ShowMediaGallery({ visible, posts, onClose, onOpenPost, onAdd, canAdd, adding }: Props) {
    const bg = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');
    const { width } = useWindowDimensions();

    const GAP = 2;
    const COLS = 3;
    const tile = (width - GAP * (COLS - 1)) / COLS;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
                <View style={[styles.header, { borderBottomColor: textColor + '22' }]}>
                    <TouchableOpacity onPress={onClose} style={styles.iconBtn} hitSlop={8}>
                        <Ionicons name="close" size={22} color={textColor} />
                    </TouchableOpacity>
                    <ThemedText style={styles.headerTitle}>Media</ThemedText>
                    {canAdd
                        ? <TouchableOpacity onPress={onAdd} style={styles.iconBtn} hitSlop={8} disabled={adding}>
                            {adding ? <ActivityIndicator size="small" color={textColor} /> : <Ionicons name="add" size={26} color={textColor} />}
                          </TouchableOpacity>
                        : <View style={styles.iconBtn} />}
                </View>

                {posts.length === 0 ? (
                    <View style={styles.empty}>
                        <Ionicons name="images-outline" size={40} color={textColor} style={{ opacity: 0.4 }} />
                        <ThemedText style={styles.emptyText}>No media yet</ThemedText>
                    </View>
                ) : (
                    <FlatList
                        data={posts}
                        keyExtractor={p => p.id}
                        numColumns={COLS}
                        columnWrapperStyle={{ gap: GAP }}
                        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
                        contentContainerStyle={{ paddingBottom: 24 }}
                        renderItem={({ item }) => (
                            <MediaTile post={item} size={tile} onPress={() => onOpenPost(item.id)} />
                        )}
                    />
                )}
            </SafeAreaView>
        </Modal>
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
    iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5, opacity: 0.6, textTransform: 'uppercase' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    emptyText: { opacity: 0.5, fontSize: 14 },
});
