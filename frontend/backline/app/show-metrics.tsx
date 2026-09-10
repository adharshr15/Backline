import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Show, getShowById } from '@/services/show.service';
import { Post, getShowPosts } from '@/services/post.service';
import { StatCard, StatRow, Section, ACCENT } from '@/components/metrics/stat-primitives';

function formatShowDate(isoString: string) {
    return new Date(isoString).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
}

export default function ShowMetricsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();

    const [show, setShow] = useState<Show | null>(null);
    const [media, setMedia] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    useFocusEffect(useCallback(() => {
        if (!id) return;
        setLoading(true);
        Promise.all([getShowById(id), getShowPosts(id).catch(() => [] as Post[])])
            .then(([s, m]) => { setShow(s); setMedia(m); })
            .catch((e) => console.error('show metrics load error:', e))
            .finally(() => setLoading(false));
    }, [id]));

    const rsvpUsers = show?.rsvpUsers?.length ?? 0;
    const rsvpBands = show?.rsvpBands?.length ?? 0;
    const rsvpVenues = show?.rsvpVenues?.length ?? 0;
    const totalRsvps = rsvpUsers + rsvpBands + rsvpVenues;

    const repUsers = show?.repostedByUsers?.length ?? 0;
    const repBands = show?.repostedByBands?.length ?? 0;
    const repVenues = show?.repostedByVenues?.length ?? 0;
    const totalReposts = repUsers + repBands + repVenues;

    const venueName = show?.venue?.name ?? show?.venueName ?? 'TBA';

    return (
        <ThemedView style={{ flex: 1 }}>
            <SafeAreaView edges={['top']} style={{ flex: 1 }}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                        <Ionicons name="chevron-back" size={28} color={ACCENT} />
                    </TouchableOpacity>
                    <ThemedText style={styles.headerTitle}>Show Insights</ThemedText>
                    <View style={{ width: 28 }} />
                </View>

                {loading && !show ? (
                    <View style={styles.center}><ActivityIndicator /></View>
                ) : !show ? (
                    <View style={styles.center}><ThemedText style={{ opacity: 0.5 }}>Show not found</ThemedText></View>
                ) : (
                    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                        {/* context */}
                        <View>
                            <ThemedText style={styles.showName}>{venueName}</ThemedText>
                            <ThemedText style={styles.showSub}>
                                {show.city}, {show.state} · {formatShowDate(show.date)}
                            </ThemedText>
                        </View>

                        {/* headline grid */}
                        <View style={styles.grid}>
                            <StatCard label="Total RSVPs" value={totalRsvps} />
                            <StatCard label="Total Reposts" value={totalReposts} />
                            <StatCard label="Media" value={media.length} />
                            <StatCard label="Lineup" value={show.bands?.length ?? 0} />
                        </View>

                        {/* rsvp breakdown */}
                        <Section title="RSVPs by type">
                            <StatRow label="Fans" value={rsvpUsers} />
                            <StatRow label="Bands" value={rsvpBands} />
                            <StatRow label="Venues" value={rsvpVenues} />
                        </Section>

                        {/* repost breakdown */}
                        <Section title="Reposts by type">
                            <StatRow label="Fans" value={repUsers} />
                            <StatRow label="Bands" value={repBands} />
                            <StatRow label="Venues" value={repVenues} />
                        </Section>
                    </ScrollView>
                )}
            </SafeAreaView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerTitle: { fontSize: 18, fontWeight: '600' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { padding: 16, gap: 24, paddingBottom: 48 },
    showName: { fontSize: 20, fontWeight: '700' },
    showSub: { fontSize: 13, opacity: 0.5, marginTop: 2 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
