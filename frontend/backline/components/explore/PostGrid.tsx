import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { MediaTile } from '@/components/media/media-tile';
import type { ExploreItem } from '@/services/explore.service';

const GAP = 2;
const COLS = 3;

/**
 * One 3x3 block of Explore posts: edge to edge, no header, so it reads as a
 * break between rails rather than another rail. Tile math matches the profile
 * posts grid (components/profile/posts-section.tsx).
 */
export default function PostGrid({ items, onPress }: {
    items: ExploreItem[];
    onPress: (item: ExploreItem) => void;
}) {
    const { width } = useWindowDimensions();
    const tile = (width - GAP * (COLS - 1)) / COLS;

    return (
        <View style={styles.grid}>
            {items.map(item => (
                <View key={item.id} style={{ marginBottom: GAP, marginRight: GAP }}>
                    <MediaTile
                        post={{
                            id: item.id,
                            url: item.url ?? '',
                            type: item.mediaType ?? 'PHOTO',
                            showId: item.showId ?? null,
                        }}
                        size={tile}
                        onPress={() => onPress(item)}
                    />
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    // Negative right margin absorbs the trailing per-tile marginRight so the
    // grid stays flush to both edges; the bottom margin matches a rail's.
    grid: { flexDirection: 'row', flexWrap: 'wrap', marginRight: -GAP, marginBottom: 24 - GAP },
});
