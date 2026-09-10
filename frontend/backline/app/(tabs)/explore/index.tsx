import { useState, useEffect, useCallback, useRef } from 'react';
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
import api, { BASE_URL } from '@/services/api';
import { Fonts } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTabHref } from '@/hooks/use-tab-href';
import { useAuth } from '@/context/AuthContext';
import SectionRail from '@/components/explore/SectionRail';
import LocationPickerModal from '@/components/marketplace/location-picker-modal';
import {
    getExplore, ExploreSection, ExploreLocation, SeeMore, ProfileType,
} from '@/services/explore.service';
import { getFollowedScenes, getSceneCities, SceneFollow, SceneCity } from '@/services/scene.service';
import {
    getSavedLocation, saveLocation, getHistory, addToHistory, clearHistory, SavedLocation,
} from '@/utils/location-preference';

const LOCATION_SCOPE = 'explore' as const;
const SEARCH_DEBOUNCE_MS = 250;

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

const VIEW_SCREEN: Record<string, string> = {
    USER: 'view-user',
    BAND: 'view-band',
    VENUE: 'view-venue',
};

export default function ExploreScreen() {
    const router = useRouter();
    const tabHref = useTabHref();
    const scheme = useColorScheme();
    const isDark = scheme === 'dark';
    const textColor = useThemeColor({}, 'text');
    const bgColor = useThemeColor({}, 'background');
    const borderColor = textColor;
    const { activeProfile } = useAuth();

    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const searchReqId = useRef(0);

    const [location, setLocation] = useState<{ city: string | null; state: string | null }>({ city: null, state: null });
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [locationLoading, setLocationLoading] = useState(true);
    const [pickerVisible, setPickerVisible] = useState(false);
    const [history, setHistory] = useState<SavedLocation[]>([]);

    const [sections, setSections] = useState<ExploreSection[]>([]);
    const [feedLocation, setFeedLocation] = useState<ExploreLocation | null>(null);
    const [feedLoading, setFeedLoading] = useState(true);

    const [followedScenes, setFollowedScenes] = useState<SceneFollow[]>([]);
    const [sceneCities, setSceneCities] = useState<SceneCity[]>([]);

    const profileType = (
        activeProfile?.accountType === 'BAND' ? 'band' :
        activeProfile?.accountType === 'VENUE' ? 'venue' : 'user'
    ) as ProfileType;

    // Cities offered by the picker: followed scenes first, then everywhere else.
    useEffect(() => {
        if (!activeProfile) return;
        getFollowedScenes(activeProfile.id, profileType).then(setFollowedScenes).catch(() => {});
        getSceneCities().then(setSceneCities).catch(() => {});
    }, [activeProfile?.id]);

    useEffect(() => { getHistory(LOCATION_SCOPE).then(setHistory); }, []);

    const resolveViaGps = useCallback(async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                const [addr] = await Location.reverseGeocodeAsync(loc.coords);
                return {
                    city: addr?.city ?? null,
                    state: addr?.region ?? null,
                    coords: { lat: loc.coords.latitude, lng: loc.coords.longitude },
                };
            }
        } catch {}
        return { city: null, state: null, coords: null };
    }, []);

    // Startup: a saved manual choice wins, then the profile's own city, then GPS.
    // Whatever resolves is handed to /explore; the backend does the rest.
    useEffect(() => {
        (async () => {
            setLocationLoading(true);
            const saved = await getSavedLocation(LOCATION_SCOPE);
            if (saved) {
                setLocation({ city: saved.city, state: saved.state });
            } else if (activeProfile?.city && activeProfile?.state) {
                setLocation({ city: activeProfile.city, state: activeProfile.state });
            } else {
                const gps = await resolveViaGps();
                setLocation({ city: gps.city, state: gps.state });
                setCoords(gps.coords);
            }
            setLocationLoading(false);
        })();
    }, [activeProfile?.id]);

    // The feed itself.
    useEffect(() => {
        if (!activeProfile || locationLoading) return;
        setFeedLoading(true);
        getExplore({
            profileId: activeProfile.id,
            profileType,
            city: location.city,
            state: location.state,
            lat: coords?.lat,
            lng: coords?.lng,
        })
            .then(res => { setSections(res.sections); setFeedLocation(res.location); })
            .catch(() => { setSections([]); setFeedLocation(null); })
            .finally(() => setFeedLoading(false));
    }, [activeProfile?.id, profileType, location.city, location.state, coords, locationLoading]);

    const applyLocation = useCallback((loc: { city: string; state: string | null }) => {
        setLocation(loc);
        setCoords(null);
        saveLocation(LOCATION_SCOPE, loc);
        addToHistory(LOCATION_SCOPE, loc).then(setHistory);
        setPickerVisible(false);
    }, []);

    const handleClearHistory = useCallback(() => { clearHistory(LOCATION_SCOPE); setHistory([]); }, []);

    const handleUseCurrentLocation = useCallback(async () => {
        setLocationLoading(true);
        const gps = await resolveViaGps();
        if (gps.city) {
            applyLocation({ city: gps.city, state: gps.state });
        } else if (gps.coords) {
            setLocation({ city: null, state: null });
            setCoords(gps.coords);
            setPickerVisible(false);
        }
        setLocationLoading(false);
    }, [resolveViaGps, applyLocation]);

    // A suggestion pick already carries a state; only raw free text needs geocoding.
    const handleSelectCity = useCallback(async (loc: { city: string; state: string | null }) => {
        if (loc.state) { applyLocation(loc); return; }
        try {
            const [geo] = await Location.geocodeAsync(loc.city);
            if (geo) {
                const [addr] = await Location.reverseGeocodeAsync(geo);
                if (addr?.city) { applyLocation({ city: addr.city, state: addr.region ?? null }); return; }
            }
        } catch {}
        applyLocation(loc);
    }, [applyLocation]);

    /**
     * Debounced search with a race guard: without the id check a slow response
     * for "me" can land after a fast one for "meta" and overwrite it.
     */
    const trimmedQuery = query.trim();
    useEffect(() => {
        if (!trimmedQuery) { setSearchResults([]); setSearchLoading(false); return; }
        setSearchLoading(true);
        const id = ++searchReqId.current;
        const t = setTimeout(async () => {
            try {
                const res = await api.get('/search', { params: { q: trimmedQuery } });
                // /search returns an envelope: { results, counts, page, limit, hasMore }.
                if (id === searchReqId.current) setSearchResults(res.data?.results ?? []);
            } catch {
                if (id === searchReqId.current) setSearchResults([]);
            } finally {
                if (id === searchReqId.current) setSearchLoading(false);
            }
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [trimmedQuery]);

    const handleSeeMore = useCallback((section: { title: string; kind: string; seeMore: SeeMore }) => {
        router.push({
            pathname: tabHref('section-list'),
            params: {
                title: section.title,
                kind: section.kind,
                path: section.seeMore.path,
                params: JSON.stringify(section.seeMore.params ?? {}),
            },
        });
    }, [router, tabHref]);

    const renderSearchItem = ({ item }: { item: SearchResult }) => (
        <TouchableOpacity
            style={[styles.searchRow, { borderBottomColor: isDark ? '#2a2a2a' : '#eee' }]}
            onPress={() => router.push(tabHref(`${VIEW_SCREEN[item.accountType]}/${item.id}`))}
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

    // Prefer the location the backend actually resolved to; it may have snapped
    // coordinates or a loose city to a real scene.
    const locationLabel =
        feedLocation ? `${feedLocation.city}, ${feedLocation.state}` :
        location.city && location.state ? `${location.city}, ${location.state}` :
        location.city ?? null;

    const citySuggestions = [
        ...followedScenes.map(s => ({ city: s.city, state: s.state, venueCount: undefined as number | undefined })),
        ...sceneCities
            .filter(c => !followedScenes.some(f =>
                f.city.toLowerCase() === c.city.toLowerCase() &&
                f.state.toLowerCase() === c.state.toLowerCase()))
            .map(c => ({ city: c.city, state: c.state, venueCount: c.venueCount })),
    ];

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
                    onChangeText={setQuery}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                />
                {searchLoading ? (
                    <ActivityIndicator size="small" />
                ) : query.length > 0 ? (
                    <TouchableOpacity onPress={() => setQuery('')}>
                        <Ionicons name="close-circle" size={18} color={isDark ? '#888' : '#666'} />
                    </TouchableOpacity>
                ) : null}
            </View>

            {query.length > 0 ? (
                /* Search mode */
                <>
                    {!searchLoading && searchResults.length === 0 && (
                        <ThemedText style={styles.empty}>No results for &quot;{query}&quot;</ThemedText>
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
                <>
                    <TouchableOpacity
                        style={[styles.locationBtn, { borderColor }]}
                        onPress={() => setPickerVisible(true)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="location-sharp" size={16} color="#4A90D9" style={styles.locationIcon} />
                        <ThemedText style={styles.locationText} numberOfLines={1}>
                            {locationLabel ?? 'Choose location'}
                        </ThemedText>
                        <Ionicons name="chevron-down" size={16} color={textColor} style={styles.locationChevron} />
                    </TouchableOpacity>

                    {locationLoading || feedLoading ? (
                        <ActivityIndicator style={{ marginTop: 48 }} />
                    ) : sections.length === 0 ? (
                        <ThemedText style={[styles.empty, { marginTop: 40 }]}>
                            {feedLocation
                                ? `Nothing happening in ${feedLocation.city} yet.`
                                : 'Set a city on your profile to see local discovery.'}
                        </ThemedText>
                    ) : (
                        <ScrollView
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 40 }}
                        >
                            {/* The backend decides which sections exist and in what
                                order. Nothing here branches on account type. */}
                            {sections.map(section => (
                                <SectionRail key={section.key} section={section} onSeeMore={handleSeeMore} />
                            ))}
                        </ScrollView>
                    )}
                </>
            )}

            <LocationPickerModal
                visible={pickerVisible}
                current={location}
                suggestions={citySuggestions}
                history={history}
                onSelect={handleSelectCity}
                onUseCurrentLocation={handleUseCurrentLocation}
                onClearHistory={handleClearHistory}
                onClose={() => setPickerVisible(false)}
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
    locationBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginHorizontal: 16,
        marginBottom: 16,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: StyleSheet.hairlineWidth,
        maxWidth: '90%',
    },
    locationIcon: { marginRight: 6 },
    locationText: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
    locationChevron: { marginLeft: 6 },
});
