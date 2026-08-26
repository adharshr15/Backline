import { View, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { BASE_URL } from '@/services/api';
import { Listing, formatListingPrice } from '@/services/listing.service';

const ACCENT = '#4A90D9';

function TermsBadge({ listing }: { listing: Listing }) {
    return (
        <View style={styles.badgeRow}>
            <ThemedText style={styles.price}>{formatListingPrice(listing)}</ThemedText>
            {listing.openToTrades && (
                <View style={styles.tradeChip}>
                    <ThemedText style={styles.tradeChipText}>TRADE</ThemedText>
                </View>
            )}
        </View>
    );
}

function CoverImage({ url, style }: { url?: string | null; style: any }) {
    if (url) {
        return <Image source={{ uri: `${BASE_URL}${url}` }} style={style} contentFit="cover" transition={150} />;
    }
    return (
        <View style={[style, styles.coverPlaceholder]}>
            <Ionicons name="musical-notes-outline" size={28} color="#888" />
        </View>
    );
}

// Grid tile (cover on top) — used in profile grid & marketplace browse
export function ListingCard({ listing, onPress, width }: { listing: Listing; onPress: (l: Listing) => void; width: number }) {
    const borderColor = useThemeColor({}, 'text');
    const isClosed = listing.status !== 'ACTIVE';

    return (
        <TouchableOpacity style={[styles.tile, { width, borderColor }]} activeOpacity={0.7} onPress={() => onPress(listing)}>
            <CoverImage url={listing.coverUrl} style={{ width: '100%', height: width, backgroundColor: '#2a2a2a' }} />
            {isClosed && (
                <View style={styles.closedOverlay}>
                    <ThemedText style={styles.closedText}>{listing.status}</ThemedText>
                </View>
            )}
            <View style={styles.tileBody}>
                <ThemedText style={styles.title} numberOfLines={1}>{listing.title}</ThemedText>
                <TermsBadge listing={listing} />
                <ThemedText style={styles.meta} numberOfLines={1}>
                    {[listing.category, listing.city].filter(Boolean).join(' · ')}
                </ThemedText>
            </View>
        </TouchableOpacity>
    );
}

// List row (cover on left) — used in profile list view
export function ListingRow({ listing, onPress }: { listing: Listing; onPress: (l: Listing) => void }) {
    const borderColor = useThemeColor({}, 'text');
    const isClosed = listing.status !== 'ACTIVE';

    return (
        <TouchableOpacity style={[styles.row, { borderColor }]} activeOpacity={0.6} onPress={() => onPress(listing)}>
            <CoverImage url={listing.coverUrl} style={styles.rowCover} />
            <View style={styles.rowInfo}>
                <ThemedText style={styles.title} numberOfLines={1}>{listing.title}</ThemedText>
                <TermsBadge listing={listing} />
                <ThemedText style={styles.meta} numberOfLines={1}>
                    {[listing.category, listing.city, listing.state].filter(Boolean).join(' · ')}
                </ThemedText>
                {isClosed && <ThemedText style={styles.rowClosed}>{listing.status}</ThemedText>}
            </View>
            <View style={styles.kindTag}>
                <ThemedText style={styles.kindTagText}>{listing.kind === 'RENT' ? 'BORROW' : 'SALE'}</ThemedText>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    tile: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 4,
        overflow: 'hidden',
    },
    tileBody: {
        padding: 8,
        gap: 3,
    },
    coverPlaceholder: {
        backgroundColor: '#2a2a2a',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closedOverlay: {
        position: 'absolute',
        top: 6,
        left: 6,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 3,
    },
    closedText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.8,
    },
    title: {
        fontSize: 14,
        fontWeight: '700',
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    price: {
        fontSize: 13,
        fontWeight: '700',
        color: ACCENT,
    },
    tradeChip: {
        backgroundColor: '#282828',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 3,
    },
    tradeChipText: {
        color: '#fff',
        fontSize: 8,
        fontWeight: '700',
        letterSpacing: 0.6,
    },
    meta: {
        fontSize: 11,
        opacity: 0.5,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 2,
        overflow: 'hidden',
    },
    rowCover: {
        width: 72,
        height: 72,
        backgroundColor: '#2a2a2a',
    },
    rowInfo: {
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 3,
    },
    rowClosed: {
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.6,
        opacity: 0.5,
    },
    kindTag: {
        paddingHorizontal: 10,
        alignSelf: 'stretch',
        justifyContent: 'center',
    },
    kindTagText: {
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.8,
        opacity: 0.5,
    },
});

// Standard 2-column tile width for a padded (32px) container
export function useGridTileWidth(columns = 2, horizontalPadding = 32, gap = 12) {
    const { width } = useWindowDimensions();
    return (width - horizontalPadding * 2 - gap * (columns - 1)) / columns;
}
