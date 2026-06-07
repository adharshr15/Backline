import { useState, useEffect, useCallback } from 'react';
import {
    View, TextInput, FlatList, TouchableOpacity,
    ScrollView, StyleSheet, ActivityIndicator, useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { ThemedText } from '@/components/themed-text';
import { BASE_URL } from '@/services/api';
import api from '@/services/api';
import { Fonts } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/context/AuthContext';
import type { Band, Venue } from '@/context/AuthContext';
import { Show } from '@/services/show.service';
import { getBandsByFilter, BandSummary } from '@/services/band.service';
import { getVenuesByFilter, VenueSummary } from '@/services/venue.service';
import NearbyShowsSection from '@/components/explore/NearbyShowsSection';
import DiscoverSection, { DiscoverItem } from '@/components/explore/DiscoverSection';
import GenreFilterChips from '@/components/explore/GenreFilterChips';
import ShowDetailModal from '@/components/show-detail-modal';
import { getFollowedScenes, getSceneCities, SceneFollow, SceneCity } from '@/services/scene.service';

type SearchResult = {
    id: string;
    name: string;
    subtitle: string;
    profileImageUrl: string | null;
    accountType: 'USER' | 'BAND' | 'VENUE';
};

const TYPE_LABEL: Record<string, string> = {
    USER: 'User',
    BAND: 'Band',
    VENUE: 'Venue',
};

const VIEW_PATH: Record<string, string> = {
    USER: '/explore/view-user',
    BAND: '/explore/view-band',
    VENUE: '/explore/view-venue',
};

export default function ExploreScreen() {
    const router = useRouter();
    const scheme = useColorScheme();
    const isDark = scheme === 'dark';
    const textColor = useThemeColor({}, 'text');
    const bgColor = useThemeColor({}, 'background');
    const borderColor = textColor;
    const { activeProfile } = useAuth();

    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    const [location, setLocation] = useState<{ city: string | null; state: string | null }>({ city: null, state: null });
    const [locationLoading, setLocationLoading] = useState(true);

    const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
    const [bands, setBands] = useState<BandSummary[]>([]);
    const [venues, setVenues] = useState<VenueSummary[]>([]);
    const [detailShow, setDetailShow] = useState<Show | null>(null);
    const [followedScenes, setFollowedScenes] = useState<SceneFollow[]>([]);
    const [sceneCities, setSceneCities] = useState<SceneCity[]>([]);

    const profileType = (
        activeProfile?.accountType === 'BAND' ? 'band' :
        activeProfile?.accountType === 'VENUE' ? 'venue' : 'user'
    ) as 'user' | 'band' | 'venue';

    // Load followed scenes and discover-able cities
    useEffect(() => {
        if (!activeProfile) return;
        getFollowedScenes(activeProfile.id, profileType).then(setFollowedScenes).catch(() => {});
        getSceneCities().then(setSceneCities).catch(() => {});
    }, [activeProfile?.id]);

    // Resolve location on mount: try GPS, fall back to profile
    useEffect(() => {
        (async () => {
            setLocationLoading(true);
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    const [addr] = await Location.reverseGeocodeAsync(loc.coords);
                    if (addr.city && addr.region) {
                        setLocation({ city: addr.city, state: addr.region });
                        setLocationLoading(false);
                        return;
                    }
                }
            } catch {}
            setLocation({
                city: activeProfile?.city ?? null,
                state: activeProfile?.state ?? null,
            });
            setLocationLoading(false);
        })();
    }, []);

    // Pre-select genre for BAND profiles
    useEffect(() => {
        if (activeProfile?.accountType === 'BAND') {
            const genre = (activeProfile as Band).genre;
            if (genre) setSelectedGenres([genre]);
        }
    }, [activeProfile?.id]);

    // Load discovery data when location or genres change
    useEffect(() => {
        if (!location.city || !location.state) return;
        const city = location.city;
        const state = location.state;
        const genre = selectedGenres[0];

        getBandsByFilter({
            city,
            state,
            genre,
            limit: 12,
            excludeId: activeProfile?.accountType === 'BAND' ? activeProfile.id : undefined,
        }).then(setBands).catch(() => setBands([]));

        getVenuesByFilter({ city, state, limit: 12 })
            .then(setVenues).catch(() => setVenues([]));
    }, [location.city, location.state, selectedGenres]);

    const handleSearch = useCallback(async (text: string) => {
        setQuery(text);
        if (!text.trim()) { setSearchResults([]); return; }
        setSearchLoading(true);
        try {
            const res = await api.get('/search', { params: { q: text.trim() } });
            setSearchResults(res.data);
        } catch (e) {
            console.error('search error:', e);
        } finally {
            setSearchLoading(false);
        }
    }, []);

    const handleGenreToggle = (genre: string) => {
        setSelectedGenres(prev =>
            prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
        );
    };

    const renderSearchItem = ({ item }: { item: SearchResult }) => (
        <TouchableOpacity
            style={[styles.searchRow, { borderBottomColor: isDark ? '#2a2a2a' : '#eee' }]}
            onPress={() => router.push(`${VIEW_PATH[item.accountType]}/${item.id}` as any)}
            activeOpacity={0.7}
        >
            <Image
                source={
                    item.profileImageUrl
                        ? { uri: `${BASE_URL}${item.profileImageUrl}` }
                        : require('@/assets/images/default/profileImage.png')
                }
                style={styles.searchAvatar}
            />
            <View style={styles.searchRowText}>
                <ThemedText style={styles.searchName}>{item.name}</ThemedText>
                <ThemedText style={styles.searchSubtitle}>{item.subtitle}</ThemedText>
            </View>
            <View style={[styles.badge, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
                <ThemedText style={styles.badgeText}>{TYPE_LABEL[item.accountType]}</ThemedText>
            </View>
        </TouchableOpacity>
    );

    const locationLabel = location.city && location.state
        ? `${location.city}, ${location.state}`
        : null;

    const bandItems: DiscoverItem[] = bands.map(b => ({
        id: b.id,
        name: b.name,
        subtitle: [b.genre, b.city && b.state ? `${b.city}, ${b.state}` : null].filter(Boolean).join(' · '),
        profileImageUrl: b.profileImageUrl,
        accountType: 'BAND',
    }));

    const venueItems: DiscoverItem[] = venues.map(v => ({
        id: v.id,
        name: v.name,
        subtitle: v.city && v.state ? `${v.city}, ${v.state}` : '',
        profileImageUrl: v.profileImageUrl,
        accountType: 'VENUE',
    }));

    const accountType = activeProfile?.accountType;
    const hasLocation = !!(location.city && location.state);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            <ThemedText style={styles.title}>Explore</ThemedText>

            {/* Search bar */}
            <View style={[styles.searchBar, { backgroundColor: isDark ? '#1e1e1e' : '#f0f0f0' }]}>
                <Ionicons name="search" size={18} color={isDark ? '#888' : '#666'} style={styles.searchIcon} />
                <TextInput
                    style={[styles.input, { color: textColor }]}
                    placeholder="Search users, bands, venues..."
                    placeholderTextColor={isDark ? '#666' : '#999'}
                    value={query}
                    onChangeText={handleSearch}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                />
                {query.length > 0 && (
                    <TouchableOpacity onPress={() => { setQuery(''); setSearchResults([]); }}>
                        <Ionicons name="close-circle" size={18} color={isDark ? '#888' : '#666'} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Search mode */}
            {query.length > 0 ? (
                <>
                    {searchLoading && <ActivityIndicator style={{ marginTop: 24 }} />}
                    {!searchLoading && searchResults.length === 0 && (
                        <ThemedText style={styles.empty}>No results for "{query}"</ThemedText>
                    )}
                    <FlatList
                        data={searchResults}
                        keyExtractor={item => `${item.accountType}-${item.id}`}
                        renderItem={renderSearchItem}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={{ paddingBottom: 24 }}
                    />
                </>
            ) : (
                /* Discovery mode */
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 40 }}
                >
                    {locationLoading ? (
                        <ActivityIndicator style={{ marginTop: 48 }} />
                    ) : !hasLocation ? (
                        <ThemedText style={[styles.empty, { marginTop: 40 }]}>
                            Set a city on your profile to see local discovery.
                        </ThemedText>
                    ) : (
                        <>
                            {/* Followed Scenes — always shown at top */}
                            {followedScenes.length > 0 && (
                                <>
                                    <ThemedText style={styles.sectionLabel}>FOLLOWING SCENES</ThemedText>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scenesRow}>
                                        {followedScenes.map(s => (
                                            <TouchableOpacity
                                                key={s.id}
                                                style={[styles.sceneChip, { borderColor }]}
                                                onPress={() => router.push({ pathname: '/explore/scene', params: { city: s.city, state: s.state } } as any)}
                                            >
                                                <ThemedText style={styles.sceneChipCity}>{s.city}</ThemedText>
                                                <ThemedText style={styles.sceneChipState}>{s.state}</ThemedText>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </>
                            )}

                            {/* Discover Scenes */}
                            {sceneCities.length > 0 && (
                                <>
                                    <ThemedText style={styles.sectionLabel}>DISCOVER SCENES</ThemedText>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scenesRow}>
                                        {sceneCities
                                            .filter(c => !followedScenes.some(f =>
                                                f.city.toLowerCase() === c.city.toLowerCase() &&
                                                f.state.toLowerCase() === c.state.toLowerCase()
                                            ))
                                            .slice(0, 10)
                                            .map(c => (
                                                <TouchableOpacity
                                                    key={`${c.city}-${c.state}`}
                                                    style={[styles.sceneChip, { borderColor }]}
                                                    onPress={() => router.push({ pathname: '/explore/scene', params: { city: c.city, state: c.state } } as any)}
                                                >
                                                    <ThemedText style={styles.sceneChipCity}>{c.city}</ThemedText>
                                                    <ThemedText style={styles.sceneChipState}>{c.state}</ThemedText>
                                                </TouchableOpacity>
                                            ))
                                        }
                                    </ScrollView>
                                </>
                            )}

                            {/* Location context chip */}
                            {hasLocation && (
                                <View style={styles.locationRow}>
                                    <Ionicons name="location-outline" size={13} color={isDark ? '#888' : '#666'} />
                                    <ThemedText style={styles.locationLabel}>{locationLabel}</ThemedText>
                                </View>
                            )}

                            {hasLocation && (
                                <>
                                    {/* USER: Shows → Genre filter → Bands → Venues */}
                                    {accountType === 'USER' && (
                                        <>
                                            <NearbyShowsSection
                                                city={location.city!}
                                                state={location.state!}
                                                onShowPress={setDetailShow}
                                            />
                                            <ThemedText style={styles.filterLabel}>FILTER BY GENRE</ThemedText>
                                            <GenreFilterChips selected={selectedGenres} onToggle={handleGenreToggle} />
                                            <DiscoverSection title="Bands Near You" items={bandItems} />
                                            <DiscoverSection title="Venues Near You" items={venueItems} />
                                        </>
                                    )}

                                    {/* BAND: Genre filter → Venues → Bands Like You */}
                                    {accountType === 'BAND' && (
                                        <>
                                            <ThemedText style={styles.filterLabel}>FILTER BY GENRE</ThemedText>
                                            <GenreFilterChips selected={selectedGenres} onToggle={handleGenreToggle} />
                                            <DiscoverSection
                                                title={`Venues in ${location.city}`}
                                                items={venueItems}
                                            />
                                            <DiscoverSection title="Bands Like You" items={bandItems} />
                                        </>
                                    )}

                                    {/* VENUE: Genre filter → Bands Near You → Shows */}
                                    {accountType === 'VENUE' && (
                                        <>
                                            <ThemedText style={styles.filterLabel}>FILTER BY GENRE</ThemedText>
                                            <GenreFilterChips selected={selectedGenres} onToggle={handleGenreToggle} />
                                            <DiscoverSection title="Bands Near You" items={bandItems} />
                                            <NearbyShowsSection
                                                city={location.city!}
                                                state={location.state!}
                                                onShowPress={setDetailShow}
                                            />
                                        </>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </ScrollView>
            )}

            <ShowDetailModal
                show={detailShow}
                visible={detailShow !== null}
                onClose={() => setDetailShow(null)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    title: {
        fontSize: 28,
        fontFamily: Fonts?.rounded ?? 'normal',
        fontWeight: '700',
        marginTop: 8,
        marginBottom: 16,
        paddingHorizontal: 16,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 12,
        marginHorizontal: 16,
    },
    searchIcon: { marginRight: 8 },
    input: { flex: 1, fontSize: 16 },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    searchAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
    searchRowText: { flex: 1 },
    searchName: { fontSize: 15, fontWeight: '600' },
    searchSubtitle: { fontSize: 13, opacity: 0.6, marginTop: 1 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 8 },
    badgeText: { fontSize: 11, opacity: 0.7 },
    empty: { textAlign: 'center', marginTop: 40, opacity: 0.5, paddingHorizontal: 16 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, marginBottom: 16 },
    locationLabel: { fontSize: 12, opacity: 0.55 },
    filterLabel: {
        fontSize: 10,
        fontWeight: '700',
        opacity: 0.4,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    sectionLabel: {
        fontSize: 10,
        fontWeight: '700',
        opacity: 0.4,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        paddingHorizontal: 16,
        marginBottom: 10,
        marginTop: 4,
    },
    scenesRow: { paddingHorizontal: 16, gap: 10, marginBottom: 20 },
    sceneChip: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        minWidth: 80,
    },
    sceneChipCity: { fontSize: 13, fontWeight: '700' },
    sceneChipState: { fontSize: 11, opacity: 0.55 },
});
