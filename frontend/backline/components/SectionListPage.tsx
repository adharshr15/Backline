import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { ItemRow, useItemPress } from '@/components/explore/SectionRail';
import { fetchSection } from '@/services/explore.service';
import type { ExploreItem, ItemType, SectionKind } from '@/services/explore.service';
import { craftLabel } from '@/services/user.service';

const PAGE_SIZE = 30;

const rowKey = (item: ExploreItem) => `${item.type}-${item.id}`;

type DateRange = 'today' | 'week' | 'month' | 'all';

const DATE_LABELS: Record<DateRange, string> = {
    today: 'Today',
    week: 'This Week',
    month: 'This Month',
    all: 'All Upcoming',
};

const placeLabel = (city?: string | null, state?: string | null) =>
    city && state ? `${city}, ${state}` : city || state || '';

const showDateLabel = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

/**
 * Normalize whatever a seeMore target returns into the feed item shape.
 *
 * The six targets return rows with different fields -- a scene has a slug and
 * counts, a person has crafts, a show has a date and a venue -- but every one of
 * them is renderable as { type, name, subtitle }. Doing this here is what lets
 * the screen stay generic over sections the backend adds later.
 */
const toItem = (raw: any, kind: SectionKind): ExploreItem => {
    const type: ItemType =
        raw.type ??
        (kind === 'SCENE' ? 'SCENE'
            : kind === 'SHOW' ? 'SHOW'
            : (raw.accountType as ItemType) ?? 'BAND');

    const name =
        raw.name ?? raw.venue?.name ?? raw.venueName ?? raw.city ?? '';

    let subtitle: string = raw.subtitle ?? '';
    if (!subtitle) {
        if (type === 'SHOW') {
            subtitle = [showDateLabel(raw.date), placeLabel(raw.city, raw.state)].filter(Boolean).join(' · ');
        } else if (type === 'SCENE') {
            const c = raw.counts;
            subtitle = c ? `${c.bands} bands · ${c.venues} venues` : placeLabel(raw.city, raw.state);
        } else if (raw.crafts?.length) {
            subtitle = craftLabel(raw.crafts[0].craft) +
                (raw.crafts.some((c: any) => c.forHire) ? ' · For hire' : '');
        } else if (raw.genres?.length) {
            subtitle = [raw.genres[0].name, placeLabel(raw.city, raw.state)].filter(Boolean).join(' · ');
        } else {
            subtitle = placeLabel(raw.city, raw.state);
        }
    }

    return {
        ...raw,
        id: raw.id,
        type,
        accountType: raw.accountType ?? null,
        name,
        subtitle,
        profileImageUrl: raw.profileImageUrl ?? raw.posterUrl ?? raw.imageUrl ?? null,
    };
};

/**
 * The destination behind every section's "See all".
 *
 * Duplicated into each tab stack as a one-line re-export so the dock never
 * disappears -- see hooks/use-tab-href.ts.
 */
export default function SectionListPage() {
    const params = useLocalSearchParams<{
        title?: string; path?: string; params?: string; kind?: string;
    }>();
    const router = useRouter();
    const handlePress = useItemPress();
    const textColor = useThemeColor({}, 'text');
    const bgColor = useThemeColor({}, 'background');
    const { width } = useWindowDimensions();

    const kind = (params.kind as SectionKind) ?? 'PROFILE';
    const path = params.path ?? '';

    const baseParams = useMemo<Record<string, string>>(() => {
        try {
            return params.params ? JSON.parse(params.params) : {};
        } catch {
            return {};
        }
    }, [params.params]);

    const [items, setItems] = useState<ExploreItem[]>([]);
    const seenIds = useRef<Set<string>>(new Set());
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [dateRange, setDateRange] = useState<DateRange>('week');
    const [viewMode, setViewMode] = useState<'map' | 'list'>('list');

    // Only shows accept dateRange; sending it elsewhere would be ignored anyway,
    // but keeping it out makes the request log readable.
    const requestParams = useMemo(
        () => (kind === 'SHOW' ? { ...baseParams, dateRange } : baseParams),
        [baseParams, kind, dateRange],
    );

    const load = useCallback(async (nextPage: number) => {
        if (!path) { setLoading(false); return; }
        if (nextPage === 1) setLoading(true); else setLoadingMore(true);
        try {
            const res = await fetchSection(path, requestParams, nextPage, PAGE_SIZE);
            const mapped = res.items.map(r => toItem(r, kind));

            if (nextPage === 1) {
                seenIds.current = new Set(mapped.map(rowKey));
                setItems(mapped);
                setHasMore(res.hasMore);
            } else {
                // Not every seeMore target paginates -- /shows ignores page and
                // limit and returns the whole set -- so appending blindly would
                // duplicate rows. Dedupe by id, and stop paging the moment a
                // request brings nothing new.
                const fresh = mapped.filter(i => !seenIds.current.has(rowKey(i)));
                fresh.forEach(i => seenIds.current.add(rowKey(i)));
                if (fresh.length) setItems(prev => [...prev, ...fresh]);
                setHasMore(res.hasMore && fresh.length > 0);
            }
            setPage(nextPage);
        } catch {
            if (nextPage === 1) { setItems([]); setHasMore(false); }
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [path, requestParams, kind]);

    useEffect(() => { load(1); }, [load]);

    const withCoords = items.filter(i => (i as any).venue?.latitude && (i as any).venue?.longitude);
    const centerLat = (withCoords[0] as any)?.venue?.latitude ?? 37.09;
    const centerLng = (withCoords[0] as any)?.venue?.longitude ?? -95.71;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={textColor} />
                </TouchableOpacity>
                <ThemedText style={styles.headerTitle} numberOfLines={1}>
                    {params.title ?? 'Explore'}
                </ThemedText>
                {kind === 'SHOW' ? (
                    <View style={[styles.viewToggle, { borderColor: textColor }]}>
                        <TouchableOpacity
                            style={[styles.toggleBtn, viewMode === 'map' && { backgroundColor: textColor }]}
                            onPress={() => setViewMode('map')}
                        >
                            <IconSymbol name="map" size={14} color={viewMode === 'map' ? bgColor : textColor} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.toggleBtn, viewMode === 'list' && { backgroundColor: textColor }]}
                            onPress={() => setViewMode('list')}
                        >
                            <IconSymbol name="list.bullet" size={14} color={viewMode === 'list' ? bgColor : textColor} />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.headerSpacer} />
                )}
            </View>

            {kind === 'SHOW' && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                    {(Object.keys(DATE_LABELS) as DateRange[]).map(range => (
                        <TouchableOpacity
                            key={range}
                            style={[styles.chip, { borderColor: textColor }, dateRange === range && { backgroundColor: textColor }]}
                            onPress={() => setDateRange(range)}
                        >
                            <ThemedText style={[styles.chipText, dateRange === range && { color: bgColor }]}>
                                {DATE_LABELS[range]}
                            </ThemedText>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            {loading ? (
                <ActivityIndicator style={{ marginTop: 48 }} />
            ) : items.length === 0 ? (
                <ThemedText style={styles.empty}>Nothing here yet.</ThemedText>
            ) : kind === 'SHOW' && viewMode === 'map' ? (
                <MapView
                    style={{ width: width - 32, height: 400, borderRadius: 8, alignSelf: 'center' }}
                    initialRegion={{
                        latitude: centerLat,
                        longitude: centerLng,
                        latitudeDelta: 1.5,
                        longitudeDelta: 1.5,
                    }}
                    showsUserLocation
                >
                    {withCoords.map(item => (
                        <Marker
                            key={item.id}
                            coordinate={{
                                latitude: (item as any).venue.latitude,
                                longitude: (item as any).venue.longitude,
                            }}
                            title={item.name}
                            description={item.subtitle}
                            onCalloutPress={() => handlePress(item)}
                        />
                    ))}
                </MapView>
            ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                    {items.map(item => (
                        <ItemRow key={rowKey(item)} item={item} onPress={() => handlePress(item)} />
                    ))}
                    {hasMore && (
                        <TouchableOpacity
                            style={styles.loadMore}
                            onPress={() => load(page + 1)}
                            disabled={loadingMore}
                        >
                            {loadingMore
                                ? <ActivityIndicator size="small" />
                                : <ThemedText style={styles.loadMoreText}>Load more</ThemedText>}
                        </TouchableOpacity>
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
    },
    backBtn: { padding: 4 },
    headerTitle: { flex: 1, fontSize: 20, fontWeight: '700' },
    headerSpacer: { width: 28 },
    viewToggle: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, overflow: 'hidden' },
    toggleBtn: { padding: 6 },
    chipsRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
    chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
    chipText: { fontSize: 12, fontWeight: '500' },
    empty: { textAlign: 'center', marginTop: 48, opacity: 0.5, paddingHorizontal: 16 },
    loadMore: { alignItems: 'center', paddingVertical: 18 },
    loadMoreText: { fontSize: 14, fontWeight: '600', color: '#4A90D9' },
});
