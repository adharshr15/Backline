import { useState, useEffect, useCallback } from 'react';
import {
    View, TextInput, TouchableOpacity, ScrollView,
    StyleSheet, ActivityIndicator, useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTabHref } from '@/hooks/use-tab-href';
import { useAuth } from '@/context/AuthContext';
import { getListings, Listing, ListingKind } from '@/services/listing.service';
import { getFollowedScenes, getSceneCities, SceneFollow, SceneCity } from '@/services/scene.service';
import { ListingCard, useGridTileWidth } from '@/components/listing-card';
import CreateListingModal from '@/components/profile/create-listing-modal';
import LocationPickerModal from '@/components/marketplace/location-picker-modal';
import { getSavedLocation, saveLocation, getHistory, addToHistory, clearHistory, SavedLocation } from '@/utils/marketplace-location';

type KindFilter = 'ALL' | ListingKind;

export default function MarketplaceScreen() {
    const router = useRouter();
    const tabHref = useTabHref();
    const scheme = useColorScheme();
    const isDark = scheme === 'dark';
    const textColor = useThemeColor({}, 'text');
    const bgColor = useThemeColor({}, 'background');
    const borderColor = textColor;
    const { activeProfile } = useAuth();
    const tileWidth = useGridTileWidth(2, 16, 12);

    const [query, setQuery] = useState('');
    const [location, setLocation] = useState<{ city: string | null; state: string | null }>({ city: null, state: null });
    const [locationLoading, setLocationLoading] = useState(true);
    const [kindFilter, setKindFilter] = useState<KindFilter>('ALL');
    const [tradesOnly, setTradesOnly] = useState(false);
    const [listings, setListings] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(false);
    const [createVisible, setCreateVisible] = useState(false);
    const [pickerVisible, setPickerVisible] = useState(false);
    const [history, setHistory] = useState<SavedLocation[]>([]);
    const [followedScenes, setFollowedScenes] = useState<SceneFollow[]>([]);
    const [sceneCities, setSceneCities] = useState<SceneCity[]>([]);

    const profileType = (
        activeProfile?.accountType === 'BAND' ? 'band' :
        activeProfile?.accountType === 'VENUE' ? 'venue' : 'user'
    ) as 'user' | 'band' | 'venue';

    // Creator params for the current active profile
    const creatorParams =
        activeProfile?.accountType === 'BAND' ? { creatorBandId: activeProfile.id } :
        activeProfile?.accountType === 'VENUE' ? { creatorVenueId: activeProfile.id } :
        activeProfile ? { creatorUserId: activeProfile.id } : {};

    // Resolve location via GPS, falling back to the active profile's city.
    const resolveViaGps = useCallback(async (): Promise<{ city: string | null; state: string | null }> => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                const [addr] = await Location.reverseGeocodeAsync(loc.coords);
                if (addr.city && addr.region) return { city: addr.city, state: addr.region };
            }
        } catch {}
        return { city: activeProfile?.city ?? null, state: activeProfile?.state ?? null };
    }, [activeProfile?.city, activeProfile?.state]);

    // Startup: a saved manual choice wins; otherwise default to the profile's city/state.
    useEffect(() => {
        (async () => {
            setLocationLoading(true);
            const saved = await getSavedLocation();
            if (saved) {
                setLocation({ city: saved.city, state: saved.state });
            } else {
                setLocation({ city: activeProfile?.city ?? null, state: activeProfile?.state ?? null });
            }
            setLocationLoading(false);
        })();
    }, [activeProfile?.city, activeProfile?.state]);

    // Load recent-city history once.
    useEffect(() => { getHistory().then(setHistory); }, []);

    // Persist + apply a manual location choice, recording it in history.
    const applyLocation = useCallback((loc: { city: string; state: string | null }) => {
        setLocation(loc);
        saveLocation(loc);
        addToHistory(loc).then(setHistory);
        setPickerVisible(false);
    }, []);

    const handleClearHistory = useCallback(() => { clearHistory(); setHistory([]); }, []);

    // "Use current location" from the picker: re-resolve via GPS and persist.
    const handleUseCurrentLocation = useCallback(async () => {
        setLocationLoading(true);
        const resolved = await resolveViaGps();
        if (resolved.city) applyLocation({ city: resolved.city, state: resolved.state });
        setLocationLoading(false);
    }, [resolveViaGps, applyLocation]);

    // Free-text city: best-effort normalize to city/state via geocoding, else use raw text.
    const handleFreeText = useCallback(async (loc: { city: string; state: string | null }) => {
        // A suggestion pick already carries a state; only geocode raw free text.
        if (loc.state) { applyLocation(loc); return; }
        try {
            const [coords] = await Location.geocodeAsync(loc.city);
            if (coords) {
                const [addr] = await Location.reverseGeocodeAsync(coords);
                if (addr?.city) { applyLocation({ city: addr.city, state: addr.region ?? null }); return; }
            }
        } catch {}
        applyLocation(loc);
    }, [applyLocation]);

    useEffect(() => {
        if (!activeProfile) return;
        getFollowedScenes(activeProfile.id, profileType).then(setFollowedScenes).catch(() => {});
        getSceneCities().then(setSceneCities).catch(() => {});
    }, [activeProfile?.id]);

    const loadListings = useCallback(() => {
        if (!location.city) return;
        setLoading(true);
        getListings({
            city: location.city,
            state: location.state ?? undefined,
            kind: kindFilter === 'ALL' ? undefined : kindFilter,
            openToTrades: tradesOnly || undefined,
            search: query.trim() || undefined,
        })
            .then(setListings)
            .catch(() => setListings([]))
            .finally(() => setLoading(false));
    }, [location.city, location.state, kindFilter, tradesOnly, query]);

    // Reload on focus and whenever filters/location change
    useFocusEffect(useCallback(() => { loadListings(); }, [loadListings]));
    useEffect(() => { loadListings(); }, [kindFilter, tradesOnly, location.city, location.state]);

    const locationLabel = location.city && location.state ? `${location.city}, ${location.state}` : location.city ?? null;

    const kindChips: { key: KindFilter; label: string }[] = [
        { key: 'ALL', label: 'All' },
        { key: 'RENT', label: 'Borrow' },
        { key: 'SALE', label: 'For Sale' },
    ];

    // Suggested cities for the picker: followed scenes first, then venue cities.
    const citySuggestions = [
        ...followedScenes.map(s => ({ city: s.city, state: s.state, venueCount: undefined as number | undefined })),
        ...sceneCities
            .filter(c => !followedScenes.some(f => f.city.toLowerCase() === c.city.toLowerCase() && f.state.toLowerCase() === c.state.toLowerCase()))
            .map(c => ({ city: c.city, state: c.state, venueCount: c.venueCount })),
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            <ThemedText style={styles.title}>Marketplace</ThemedText>

            {/* Search bar */}
            <View style={[styles.searchBar, { backgroundColor: isDark ? '#1e1e1e' : '#f0f0f0' }]}>
                <Ionicons name="search" size={18} color={isDark ? '#888' : '#666'} style={styles.searchIcon} />
                <TextInput
                    style={[styles.input, { color: textColor }]}
                    placeholder="Search gear..."
                    placeholderTextColor={isDark ? '#666' : '#999'}
                    value={query}
                    onChangeText={setQuery}
                    onSubmitEditing={loadListings}
                    returnKeyType="search"
                    autoCorrect={false}
                />
                {query.length > 0 && (
                    <TouchableOpacity onPress={() => { setQuery(''); setTimeout(loadListings, 0); }}>
                        <Ionicons name="close-circle" size={18} color={isDark ? '#888' : '#666'} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Location button */}
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

            {/* Filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {kindChips.map(c => (
                    <TouchableOpacity
                        key={c.key}
                        style={[styles.filterChip, { borderColor }, kindFilter === c.key && styles.filterChipActive]}
                        onPress={() => setKindFilter(c.key)}
                    >
                        <ThemedText style={[styles.filterChipText, kindFilter === c.key && styles.filterChipTextActive]}>{c.label}</ThemedText>
                    </TouchableOpacity>
                ))}
                <TouchableOpacity
                    style={[styles.filterChip, { borderColor }, tradesOnly && styles.filterChipActive]}
                    onPress={() => setTradesOnly(v => !v)}
                >
                    <ThemedText style={[styles.filterChipText, tradesOnly && styles.filterChipTextActive]}>Trades</ThemedText>
                </TouchableOpacity>
            </ScrollView>

            {/* Body */}
            {locationLoading ? (
                <ActivityIndicator style={{ marginTop: 48 }} />
            ) : !location.city ? (
                <ThemedText style={styles.empty}>Set a city on your profile to browse local gear.</ThemedText>
            ) : loading ? (
                <ActivityIndicator style={{ marginTop: 48 }} />
            ) : listings.length === 0 ? (
                <ThemedText style={styles.empty}>No gear listed in {location.city} yet.</ThemedText>
            ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.gridScroll}>
                    <View style={styles.grid}>
                        {listings.map(listing => (
                            <ListingCard
                                key={listing.id}
                                listing={listing}
                                width={tileWidth}
                                onPress={(l) => router.push({ pathname: tabHref('listing'), params: { id: l.id } })}
                            />
                        ))}
                    </View>
                </ScrollView>
            )}

            {/* Floating create button */}
            {activeProfile && (
                <TouchableOpacity style={styles.fab} onPress={() => setCreateVisible(true)} activeOpacity={0.85}>
                    <Ionicons name="add" size={28} color="#fff" />
                </TouchableOpacity>
            )}

            <CreateListingModal
                visible={createVisible}
                onClose={() => setCreateVisible(false)}
                {...creatorParams}
                defaultCity={activeProfile?.city ?? location.city ?? ''}
                defaultState={activeProfile?.state ?? location.state ?? ''}
                defaultCountry={(activeProfile as any)?.country ?? ''}
                onSaved={() => { setCreateVisible(false); loadListings(); }}
            />

            <LocationPickerModal
                visible={pickerVisible}
                current={location}
                suggestions={citySuggestions}
                history={history}
                onSelect={handleFreeText}
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
    locationBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginHorizontal: 16,
        marginBottom: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: StyleSheet.hairlineWidth,
        maxWidth: '90%',
    },
    locationIcon: { marginRight: 6 },
    locationText: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
    locationChevron: { marginLeft: 6 },
    filterRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 14, alignItems: 'center' },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        height: 32,
        justifyContent: 'center',
    },
    filterChipActive: { backgroundColor: '#2a2a2a', borderColor: '#2a2a2a' },
    filterChipText: { fontSize: 13, fontWeight: '600' },
    filterChipTextActive: { color: '#fff' },
    empty: { textAlign: 'center', marginTop: 48, opacity: 0.5, paddingHorizontal: 16 },
    gridScroll: { paddingBottom: 100 },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        gap: 12,
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 28,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#4A90D9',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
    },
});
