import { useState, useEffect, useCallback } from 'react';
import {
    View, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/context/AuthContext';
import { TabSwitcher } from '@/components/ui/tab-switcher';
import DiscoverSection, { DiscoverItem } from '@/components/explore/DiscoverSection';
import NearbyShowsSection from '@/components/explore/NearbyShowsSection';
import GenreFilterChips from '@/components/explore/GenreFilterChips';
import { getBandsByFilter, BandSummary } from '@/services/band.service';
import { getVenuesByFilter, VenueSummary } from '@/services/venue.service';
import { followScene, unfollowScene, getFollowedScenes } from '@/services/scene.service';

type SceneTab = 'shows' | 'bands' | 'venues';

export default function ScenePage() {
    const { city, state } = useLocalSearchParams<{ city: string; state: string }>();
    const router = useRouter();
    const { activeProfile } = useAuth();
    const borderColor = useThemeColor({}, 'text');
    const bgColor = useThemeColor({}, 'background');

    const [activeTab, setActiveTab] = useState<SceneTab>('shows');
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);

    const [bands, setBands] = useState<BandSummary[]>([]);
    const [venues, setVenues] = useState<VenueSummary[]>([]);
    const [bandLoading, setBandLoading] = useState(false);
    const [venueLoading, setVenueLoading] = useState(false);
    const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

    const profileType = (
        activeProfile?.accountType === 'BAND' ? 'band' :
        activeProfile?.accountType === 'VENUE' ? 'venue' : 'user'
    ) as 'user' | 'band' | 'venue';

    useEffect(() => {
        if (!activeProfile || !city || !state) return;
        getFollowedScenes(activeProfile.id, profileType)
            .then(scenes => setIsFollowing(scenes.some(s =>
                s.city.toLowerCase() === city.toLowerCase() &&
                s.state.toLowerCase() === state.toLowerCase()
            )))
            .catch(() => {});
    }, [activeProfile?.id, city, state]);

    const loadBands = useCallback(() => {
        if (!city || !state) return;
        setBandLoading(true);
        getBandsByFilter({
            city,
            state,
            genre: selectedGenres[0],
            limit: 30,
            excludeId: activeProfile?.accountType === 'BAND' ? activeProfile.id : undefined,
        }).then(setBands).catch(() => setBands([])).finally(() => setBandLoading(false));
    }, [city, state, selectedGenres]);

    const loadVenues = useCallback(() => {
        if (!city || !state) return;
        setVenueLoading(true);
        getVenuesByFilter({ city, state, limit: 30 })
            .then(setVenues).catch(() => setVenues([])).finally(() => setVenueLoading(false));
    }, [city, state]);

    useEffect(() => { loadBands(); }, [loadBands]);
    useEffect(() => { loadVenues(); }, [loadVenues]);

    const handleFollowToggle = async () => {
        if (!activeProfile) return;
        setFollowLoading(true);
        try {
            if (isFollowing) {
                await unfollowScene(city, state, activeProfile.id, profileType);
                setIsFollowing(false);
            } else {
                await followScene(city, state, activeProfile.id, profileType);
                setIsFollowing(true);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setFollowLoading(false);
        }
    };

    const bandItems: DiscoverItem[] = bands.map(b => ({
        id: b.id,
        name: b.name,
        subtitle: b.genre ?? '',
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

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={borderColor} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <ThemedText style={styles.cityName}>{city}</ThemedText>
                    <ThemedText style={styles.stateName}>{state} Scene</ThemedText>
                </View>
                <TouchableOpacity
                    style={[styles.followBtn, { borderColor }, isFollowing && { backgroundColor: borderColor }]}
                    onPress={handleFollowToggle}
                    disabled={followLoading}
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

            {/* Tab switcher */}
            <TabSwitcher
                tabs={[
                    {
                        key: 'shows',
                        content: (
                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                                <NearbyShowsSection city={city} state={state} onShowPress={(show) => router.push({ pathname: '/show', params: { id: show.id } })} />
                            </ScrollView>
                        ),
                    },
                    {
                        key: 'bands',
                        content: (
                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                                <View style={{ paddingTop: 4 }}>
                                    <ThemedText style={styles.filterLabel}>FILTER BY GENRE</ThemedText>
                                    <GenreFilterChips selected={selectedGenres} onToggle={g =>
                                        setSelectedGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])
                                    } />
                                    {bandLoading
                                        ? <ActivityIndicator style={{ marginTop: 24 }} />
                                        : <DiscoverSection title={`Bands in ${city}`} items={bandItems} />
                                    }
                                </View>
                            </ScrollView>
                        ),
                    },
                    {
                        key: 'venues',
                        content: (
                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                                {venueLoading
                                    ? <ActivityIndicator style={{ marginTop: 24 }} />
                                    : <DiscoverSection title={`Venues in ${city}`} items={venueItems} />
                                }
                            </ScrollView>
                        ),
                    },
                ]}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                marginHorizontal={16}
            />

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
    headerCenter: { flex: 1 },
    cityName: { fontSize: 20, fontWeight: '700' },
    stateName: { fontSize: 13, opacity: 0.55 },
    followBtn: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        minWidth: 80,
        alignItems: 'center',
    },
    followBtnText: { fontSize: 13, fontWeight: '600' },
    filterLabel: {
        fontSize: 10,
        fontWeight: '700',
        opacity: 0.4,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        paddingHorizontal: 16,
        marginBottom: 8,
    },
});
