import { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTabHref } from '@/hooks/use-tab-href';
import { useAuth } from '@/context/AuthContext';
import { TabSwitcher } from '@/components/ui/tab-switcher';
import NearbyShowsSection from '@/components/explore/NearbyShowsSection';
import GenreFilterChips from '@/components/explore/GenreFilterChips';
import { ItemRow, useItemPress, imageSource, ACCENT } from '@/components/explore/SectionRail';
import { BASE_URL } from '@/services/api';
import { craftLabel } from '@/services/user.service';
import type { ExploreItem } from '@/services/explore.service';
import {
    getScene, getSceneByLocation, getSceneBands, getSceneVenues, getScenePeople,
    getSceneFollowState, followSceneBySlug, unfollowSceneBySlug,
    SceneDetail, FollowerType,
} from '@/services/scene.service';

type SceneTab = 'shows' | 'bands' | 'venues' | 'people';

const PAGE_SIZE = 30;

const placeLabel = (city?: string | null, state?: string | null) =>
    city && state ? `${city}, ${state}` : city || state || '';

/** One lazily-loaded, paginated tab. Nothing is fetched until it is opened. */
function useSceneList<T>(
    fetcher: (page: number) => Promise<{ items: T[]; hasMore: boolean }>,
    active: boolean,
    deps: unknown[],
) {
    const [items, setItems] = useState<T[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    // Starts true so the first render of a tab shows a spinner rather than
    // flashing "nothing here" in the frame before the effect fires.
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    // Survives a tab switch: reopening a tab should not refetch page 1.
    const loadedKey = useRef<string | null>(null);
    const key = JSON.stringify(deps);

    const load = useCallback(async (nextPage: number) => {
        if (nextPage === 1) setLoading(true); else setLoadingMore(true);
        try {
            const res = await fetcher(nextPage);
            setItems(prev => (nextPage === 1 ? res.items : [...prev, ...res.items]));
            setHasMore(res.hasMore);
            setPage(nextPage);
        } catch {
            if (nextPage === 1) {
                setItems([]);
                setHasMore(false);
                // Clear the guard so reopening the tab retries rather than
                // showing an empty list forever.
                loadedKey.current = null;
            }
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [fetcher]);

    useEffect(() => {
        if (!active) return;
        if (loadedKey.current === key) return;
        loadedKey.current = key;
        load(1);
    }, [active, key, load]);

    return { items, page, hasMore, loading, loadingMore, loadMore: () => load(page + 1) };
}

function LoadMore({ loading, onPress }: { loading: boolean; onPress: () => void }) {
    return (
        <TouchableOpacity style={styles.loadMore} onPress={onPress} disabled={loading}>
            {loading ? <ActivityIndicator size="small" /> : <ThemedText style={styles.loadMoreText}>Load more</ThemedText>}
        </TouchableOpacity>
    );
}

/**
 * A city scene: its bands, venues, people and shows.
 *
 * Reached by `slug` from anything that has one, and by legacy `city`+`state`
 * from the profile location rows and listing pages that predate slugs. Both
 * forms resolve to the same payload.
 */
export default function ScenePage() {
    const { slug, city, state } = useLocalSearchParams<{ slug?: string; city?: string; state?: string }>();
    const router = useRouter();
    const tabHref = useTabHref();
    const handleItemPress = useItemPress();
    const { activeProfile } = useAuth();
    const borderColor = useThemeColor({}, 'text');
    const bgColor = useThemeColor({}, 'background');

    const [scene, setScene] = useState<SceneDetail | null>(null);
    const [sceneLoading, setSceneLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<SceneTab>('shows');
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
    const [genre, setGenre] = useState<string | null>(null);

    const profileType = (
        activeProfile?.accountType === 'BAND' ? 'band' :
        activeProfile?.accountType === 'VENUE' ? 'venue' : 'user'
    ) as FollowerType;

    useEffect(() => {
        setSceneLoading(true);
        const request = slug
            ? getScene(slug)
            : city && state
                ? getSceneByLocation(city, state)
                : Promise.reject(new Error('no scene'));

        request
            .then(setScene)
            .catch(() => setScene(null))
            .finally(() => setSceneLoading(false));
    }, [slug, city, state]);

    // One request, rather than pulling the whole follow list and scanning it.
    useEffect(() => {
        if (!scene || !activeProfile) return;
        getSceneFollowState(scene.slug, activeProfile.id, profileType)
            .then(setIsFollowing)
            .catch(() => {});
    }, [scene?.slug, activeProfile?.id, profileType]);

    const handleFollowToggle = async () => {
        if (!activeProfile || !scene) return;
        setFollowLoading(true);
        try {
            if (isFollowing) {
                await unfollowSceneBySlug(scene.slug, activeProfile.id, profileType);
                setIsFollowing(false);
            } else {
                await followSceneBySlug(scene.slug, activeProfile.id, profileType);
                setIsFollowing(true);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setFollowLoading(false);
        }
    };

    const sceneSlug = scene?.slug ?? '';

    const bandsFetcher = useCallback(
        (page: number) => getSceneBands(sceneSlug, { genre: genre ?? undefined, page, limit: PAGE_SIZE }),
        [sceneSlug, genre],
    );
    const venuesFetcher = useCallback(
        (page: number) => getSceneVenues(sceneSlug, { page, limit: PAGE_SIZE }),
        [sceneSlug],
    );
    const peopleFetcher = useCallback(
        (page: number) => getScenePeople(sceneSlug, { page, limit: PAGE_SIZE }),
        [sceneSlug],
    );

    const bands = useSceneList(bandsFetcher, !!sceneSlug && activeTab === 'bands', [sceneSlug, genre]);
    const venues = useSceneList(venuesFetcher, !!sceneSlug && activeTab === 'venues', [sceneSlug]);
    const people = useSceneList(peopleFetcher, !!sceneSlug && activeTab === 'people', [sceneSlug]);

    if (sceneLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
                <ActivityIndicator style={{ marginTop: 64 }} />
            </SafeAreaView>
        );
    }

    if (!scene) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
                        <Ionicons name="chevron-back" size={24} color={borderColor} />
                    </TouchableOpacity>
                </View>
                <ThemedText style={styles.empty}>
                    {city ? `No scene for ${city} yet.` : 'Scene not found.'}
                </ThemedText>
            </SafeAreaView>
        );
    }

    const counts = scene.counts;
    const stats: { label: string; value: number }[] = [
        { label: 'Bands', value: counts?.bands ?? 0 },
        { label: 'Venues', value: counts?.venues ?? 0 },
        { label: 'People', value: counts?.people ?? 0 },
        { label: 'Shows', value: counts?.upcomingShows ?? 0 },
        { label: 'Followers', value: counts?.followers ?? 0 },
    ];

    const toItem = (raw: any, type: ExploreItem['type'], subtitle: string): ExploreItem => ({
        ...raw,
        type,
        accountType: raw.accountType ?? null,
        subtitle,
        profileImageUrl: raw.profileImageUrl ?? null,
    });

    const toggleGenre = (slug: string) => setGenre(prev => (prev === slug ? null : slug));

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Banner + back */}
                <View>
                    {scene.headerImageUrl ? (
                        <Image source={{ uri: `${BASE_URL}${scene.headerImageUrl}` }} style={styles.banner} />
                    ) : (
                        <View style={[styles.banner, styles.bannerFallback]} />
                    )}
                    <TouchableOpacity onPress={() => router.back()} style={styles.floatingBack} hitSlop={8}>
                        <Ionicons name="chevron-back" size={22} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Identity */}
                <View style={styles.identityRow}>
                    <Image source={imageSource(scene.imageUrl)} style={styles.avatar} />
                    <View style={styles.identityText}>
                        <ThemedText style={styles.sceneName}>{scene.name}</ThemedText>
                        <ThemedText style={styles.scenePlace}>{placeLabel(scene.city, scene.state)}</ThemedText>
                    </View>
                    <TouchableOpacity
                        style={[styles.followBtn, { borderColor }, isFollowing && { backgroundColor: borderColor }]}
                        onPress={handleFollowToggle}
                        disabled={followLoading || !activeProfile}
                    >
                        {followLoading ? (
                            <ActivityIndicator size="small" color={isFollowing ? bgColor : borderColor} />
                        ) : (
                            <ThemedText style={[styles.followBtnText, isFollowing && { color: bgColor }]}>
                                {isFollowing ? 'Following' : 'Follow'}
                            </ThemedText>
                        )}
                    </TouchableOpacity>
                </View>

                {!!scene.bio && <ThemedText style={styles.bio}>{scene.bio}</ThemedText>}

                {/* Counts */}
                <View style={styles.statsRow}>
                    {stats.map(s => (
                        <View key={s.label} style={styles.stat}>
                            <ThemedText style={styles.statValue}>{s.value}</ThemedText>
                            <ThemedText style={styles.statLabel}>{s.label}</ThemedText>
                        </View>
                    ))}
                </View>

                {/* Sub-scene facets: "Houston Shoegaze" is a filter of this list,
                    not a row anywhere. topGenres is already in the detail payload,
                    so the chips cost no extra request. */}
                <GenreFilterChips
                    genres={scene.topGenres}
                    sceneSlug={scene.slug}
                    selected={genre ? [genre] : []}
                    onToggle={toggleGenre}
                />

                <TabSwitcher
                    tabs={[
                        {
                            key: 'shows',
                            content: (
                                <NearbyShowsSection
                                    sceneSlug={scene.slug}
                                    genre={genre ?? undefined}
                                    title={`Shows in ${scene.name}`}
                                    onShowPress={show => router.push({ pathname: tabHref('show'), params: { id: show.id } })}
                                />
                            ),
                        },
                        {
                            key: 'bands',
                            content: bands.loading ? (
                                <ActivityIndicator style={{ marginTop: 24 }} />
                            ) : bands.items.length === 0 ? (
                                <ThemedText style={styles.empty}>No bands here yet.</ThemedText>
                            ) : (
                                <View>
                                    {bands.items.map(b => {
                                        const item = toItem(
                                            b,
                                            'BAND',
                                            [b.genres?.[0]?.name, placeLabel(b.city, b.state)]
                                                .filter(Boolean).join(' · '),
                                        );
                                        return <ItemRow key={b.id} item={item} onPress={() => handleItemPress(item)} />;
                                    })}
                                    {bands.hasMore && <LoadMore loading={bands.loadingMore} onPress={bands.loadMore} />}
                                </View>
                            ),
                        },
                        {
                            key: 'venues',
                            content: venues.loading ? (
                                <ActivityIndicator style={{ marginTop: 24 }} />
                            ) : venues.items.length === 0 ? (
                                <ThemedText style={styles.empty}>No venues here yet.</ThemedText>
                            ) : (
                                <View>
                                    {venues.items.map(v => {
                                        const item = toItem(
                                            v,
                                            'VENUE',
                                            [placeLabel(v.city, v.state), v.capacity ? `Cap. ${v.capacity}` : null]
                                                .filter(Boolean).join(' · '),
                                        );
                                        return <ItemRow key={v.id} item={item} onPress={() => handleItemPress(item)} />;
                                    })}
                                    {venues.hasMore && <LoadMore loading={venues.loadingMore} onPress={venues.loadMore} />}
                                </View>
                            ),
                        },
                        {
                            key: 'people',
                            content: people.loading ? (
                                <ActivityIndicator style={{ marginTop: 24 }} />
                            ) : people.items.length === 0 ? (
                                <ThemedText style={styles.empty}>No one has listed a craft here yet.</ThemedText>
                            ) : (
                                <View>
                                    {people.items.map(p => {
                                        const primary = p.crafts?.[0];
                                        const item = toItem(
                                            p,
                                            'USER',
                                            primary
                                                ? craftLabel(primary.craft) +
                                                  (p.crafts.some(c => c.forHire) ? ' · For hire' : '')
                                                : `@${p.username}`,
                                        );
                                        return <ItemRow key={p.id} item={item} onPress={() => handleItemPress(item)} />;
                                    })}
                                    {people.hasMore && <LoadMore loading={people.loadingMore} onPress={people.loadMore} />}
                                </View>
                            ),
                        },
                    ]}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    marginHorizontal={16}
                />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
    backBtn: { padding: 4 },
    banner: { width: '100%', height: 130 },
    bannerFallback: { backgroundColor: 'rgba(74,144,217,0.18)' },
    floatingBack: {
        position: 'absolute',
        top: 10,
        left: 10,
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    identityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        marginTop: 12,
    },
    avatar: { width: 56, height: 56, borderRadius: 28 },
    identityText: { flex: 1 },
    sceneName: { fontSize: 20, fontWeight: '700' },
    scenePlace: { fontSize: 13, opacity: 0.55, marginTop: 1 },
    followBtn: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        minWidth: 84,
        alignItems: 'center',
    },
    followBtnText: { fontSize: 13, fontWeight: '600' },
    bio: { fontSize: 14, opacity: 0.75, paddingHorizontal: 16, marginTop: 12, lineHeight: 19 },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginTop: 16,
        marginBottom: 16,
    },
    stat: { alignItems: 'center', flex: 1 },
    statValue: { fontSize: 16, fontWeight: '700' },
    statLabel: {
        fontSize: 10,
        fontWeight: '700',
        opacity: 0.4,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginTop: 2,
    },
    empty: { textAlign: 'center', marginTop: 32, opacity: 0.5, paddingHorizontal: 16 },
    loadMore: { alignItems: 'center', paddingVertical: 18 },
    loadMoreText: { fontSize: 14, fontWeight: '600', color: ACCENT },
});
