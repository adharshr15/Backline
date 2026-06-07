import { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Show, getShowsByLocation } from '@/services/show.service';
import { getSceneCities, SceneCity } from '@/services/scene.service';

type DateRange = 'today' | 'week' | 'month' | 'all';
type ViewMode = 'map' | 'list';

const DATE_LABELS: Record<DateRange, string> = {
    today: 'Today',
    week: 'This Week',
    month: 'This Month',
    all: 'All Upcoming',
};

function formatShowDate(isoString: string) {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDoors(doorsString: string) {
    if (!doorsString) return '';
    if (doorsString.includes('T')) {
        return new Date(doorsString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    return doorsString;
}

type Props = {
    city: string;
    state: string;
    onShowPress: (show: Show) => void;
};

export default function NearbyShowsSection({ city, state, onShowPress }: Props) {
    const router = useRouter();
    const [dateRange, setDateRange] = useState<DateRange>('week');
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [shows, setShows] = useState<Show[]>([]);
    const [sceneCities, setSceneCities] = useState<SceneCity[]>([]);
    const [loading, setLoading] = useState(true);
    const borderColor = useThemeColor({}, 'text');
    const bgColor = useThemeColor({}, 'background');
    const { width } = useWindowDimensions();

    useEffect(() => {
        setLoading(true);
        getShowsByLocation(city, state, dateRange)
            .then(setShows)
            .catch(() => setShows([]))
            .finally(() => setLoading(false));
    }, [city, state, dateRange]);

    useEffect(() => {
        getSceneCities().then(setSceneCities).catch(() => {});
    }, []);

    const showsWithCoords = shows.filter(s => s.venue?.latitude && s.venue?.longitude);
    const centerLat = showsWithCoords[0]?.venue?.latitude ?? 37.09;
    const centerLng = showsWithCoords[0]?.venue?.longitude ?? -95.71;

    return (
        <View style={styles.container}>
            {/* Header row */}
            <View style={styles.headerRow}>
                <ThemedText style={styles.sectionTitle}>Shows Near You</ThemedText>
                <View style={[styles.viewToggle, { borderColor }]}>
                    <TouchableOpacity
                        style={[styles.toggleBtn, viewMode === 'map' && { backgroundColor: borderColor }]}
                        onPress={() => setViewMode('map')}
                    >
                        <IconSymbol name="map" size={14} color={viewMode === 'map' ? bgColor : borderColor} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleBtn, viewMode === 'list' && { backgroundColor: borderColor }]}
                        onPress={() => setViewMode('list')}
                    >
                        <IconSymbol name="list.bullet" size={14} color={viewMode === 'list' ? bgColor : borderColor} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Date filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {(Object.keys(DATE_LABELS) as DateRange[]).map(range => (
                    <TouchableOpacity
                        key={range}
                        style={[styles.chip, { borderColor }, dateRange === range && { backgroundColor: borderColor }]}
                        onPress={() => setDateRange(range)}
                    >
                        <ThemedText style={[styles.chipText, dateRange === range && { color: bgColor }]}>
                            {DATE_LABELS[range]}
                        </ThemedText>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {loading ? (
                <ActivityIndicator style={{ marginVertical: 24 }} />
            ) : viewMode === 'map' ? (
                <MapView
                    style={{ width: width - 32, height: 220, borderRadius: 8 }}
                    initialRegion={{
                        latitude: centerLat,
                        longitude: centerLng,
                        latitudeDelta: 1.5,
                        longitudeDelta: 1.5,
                    }}
                    showsUserLocation
                >
                    {showsWithCoords.map(show => (
                        <Marker
                            key={show.id}
                            coordinate={{ latitude: show.venue!.latitude!, longitude: show.venue!.longitude! }}
                            title={show.venue?.name ?? show.venueName ?? ''}
                            description={formatShowDate(show.date)}
                            onCalloutPress={() => onShowPress(show)}
                        />
                    ))}
                    {sceneCities.map(sc => (
                        <Marker
                            key={`scene-${sc.city}-${sc.state}`}
                            coordinate={{ latitude: sc.lat, longitude: sc.lng }}
                            pinColor="blue"
                            title={`${sc.city}, ${sc.state}`}
                            description={`${sc.venueCount} venue${sc.venueCount !== 1 ? 's' : ''} — tap to explore scene`}
                            onCalloutPress={() => router.push({ pathname: '/explore/scene', params: { city: sc.city, state: sc.state } } as any)}
                        />
                    ))}
                </MapView>
            ) : shows.length === 0 ? (
                <ThemedText style={styles.empty}>No shows found nearby</ThemedText>
            ) : (
                shows.map(show => (
                    <TouchableOpacity key={show.id} style={[styles.listRow, { borderColor }]} onPress={() => onShowPress(show)} activeOpacity={0.7}>
                        <View style={styles.listDate}>
                            <ThemedText style={styles.listDateText}>{formatShowDate(show.date)}</ThemedText>
                            {show.doors ? <ThemedText style={styles.listDoors}>Doors {formatDoors(show.doors)}</ThemedText> : null}
                        </View>
                        <View style={styles.listInfo}>
                            <ThemedText style={styles.listVenue} numberOfLines={1}>
                                {show.venue?.name ?? show.venueName ?? 'TBA'}
                            </ThemedText>
                            <ThemedText style={styles.listCity}>{show.city}, {show.state}</ThemedText>
                        </View>
                    </TouchableOpacity>
                ))
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { paddingHorizontal: 16, marginBottom: 24 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    sectionTitle: { fontSize: 17, fontWeight: '700' },
    viewToggle: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, overflow: 'hidden' },
    toggleBtn: { padding: 6 },
    chipsRow: { gap: 8, marginBottom: 12 },
    chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
    chipText: { fontSize: 12, fontWeight: '500' },
    listRow: { flexDirection: 'row', gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
    listDate: { width: 80, gap: 2 },
    listDateText: { fontSize: 12, fontWeight: '600' },
    listDoors: { fontSize: 11, opacity: 0.5 },
    listInfo: { flex: 1, gap: 2 },
    listVenue: { fontSize: 14, fontWeight: '600' },
    listCity: { fontSize: 12, opacity: 0.5 },
    empty: { opacity: 0.4, fontSize: 13, textAlign: 'center', paddingVertical: 20 },
});
