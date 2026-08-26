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
import { useAuth } from '@/context/AuthContext';
import { getListings, Listing, ListingKind } from '@/services/listing.service';
import { getFollowedScenes, getSceneCities, SceneFollow, SceneCity } from '@/services/scene.service';
import { ListingCard, useGridTileWidth } from '@/components/listing-card';
import CreateListingModal from '@/components/profile/create-listing-modal';

type KindFilter = 'ALL' | ListingKind;

export default function MarketplaceScreen() {
    const router = useRouter();
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

    // Resolve location: GPS → profile fallback
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
            setLocation({ city: activeProfile?.city ?? null, state: activeProfile?.state ?? null });
            setLocationLoading(false);
        })();
    }, []);

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

    const otherScenes = [
        ...followedScenes.map(s => ({ city: s.city, state: s.state })),
        ...sceneCities
            .filter(c => !followedScenes.some(f => f.city.toLowerCase() === c.city.toLowerCase() && f.state.toLowerCase() === c.state.toLowerCase()))
            .map(c => ({ city: c.city, state: c.state })),
    ].slice(0, 12);

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

            {/* City selector */}
            {otherScenes.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cityRow}>
                    {locationLabel && (
                        <View style={[styles.cityChip, styles.cityChipActive]}>
                            <ThemedText style={styles.cityChipTextActive}>{location.city}</ThemedText>
                        </View>
                    )}
                    {otherScenes
                        .filter(s => s.city.toLowerCase() !== (location.city ?? '').toLowerCase())
                        .map(s => (
                            <TouchableOpacity
                                key={`${s.city}-${s.state}`}
                                style={[styles.cityChip, { borderColor }]}
                                onPress={() => setLocation({ city: s.city, state: s.state })}
                            >
                                <ThemedText style={styles.cityChipText}>{s.city}</ThemedText>
                            </TouchableOpacity>
                        ))}
                </ScrollView>
            )}

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
                                onPress={(l) => router.push({ pathname: '/listing', params: { id: l.id } })}
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
    cityRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
    cityChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        height: 32,
        justifyContent: 'center',
    },
    cityChipActive: { backgroundColor: '#4A90D9', borderWidth: 0 },
    cityChipText: { fontSize: 13, fontWeight: '600' },
    cityChipTextActive: { fontSize: 13, fontWeight: '700', color: '#fff' },
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
