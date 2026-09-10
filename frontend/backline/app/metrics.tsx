import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTabHref } from '@/hooks/use-tab-href';
import { getProfileMetrics, ProfileMetrics, ProfileKind } from '@/services/metrics.service';
import { StatCard, StatRow, Section, ACCENT, CARD } from '@/components/metrics/stat-primitives';

export default function MetricsScreen() {
    const router = useRouter();
    const tabHref = useTabHref();
    const { activeProfile } = useAuth();

    const type = (activeProfile?.accountType?.toLowerCase() ?? 'user') as ProfileKind;
    const id = activeProfile?.id;

    const [metrics, setMetrics] = useState<ProfileMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    useFocusEffect(useCallback(() => {
        if (!id) return;
        setLoading(true);
        getProfileMetrics(type, id)
            .then(setMetrics)
            .catch((e) => console.error('metrics load error:', e))
            .finally(() => setLoading(false));
    }, [type, id]));

    const openFollowList = (mode: 'followers' | 'following') => {
        if (!id) return;
        router.push({ pathname: tabHref('follow-list'), params: { mode, type, id } } as any);
    };

    return (
        <ThemedView style={{ flex: 1 }}>
            <SafeAreaView edges={['top']} style={{ flex: 1 }}>
                {/* header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                        <Ionicons name="chevron-back" size={28} color={ACCENT} />
                    </TouchableOpacity>
                    <ThemedText style={styles.headerTitle}>Insights</ThemedText>
                    <View style={{ width: 28 }} />
                </View>

                {loading && !metrics ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator />
                    </View>
                ) : !metrics ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <ThemedText style={{ opacity: 0.5 }}>No metrics available</ThemedText>
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                        {/* headline grid */}
                        <View style={styles.grid}>
                            <StatCard label="Followers" value={metrics.followers} onPress={() => openFollowList('followers')} />
                            <StatCard label="Following" value={metrics.following} onPress={() => openFollowList('following')} />
                            <StatCard label="Shows hosted" value={metrics.showsHosted} />
                            <StatCard label="Total RSVPs" value={metrics.totalRsvps} />
                        </View>

                        {/* show impact */}
                        <Section title="Show impact">
                            <StatRow label="Reposts of your shows" value={metrics.totalReposts} />
                            <StatRow label="Shows you're attending" value={metrics.showsAttending} />
                            {metrics.topShow ? (
                                <TouchableOpacity
                                    style={styles.topShow}
                                    onPress={() => router.push({ pathname: tabHref('show'), params: { id: metrics.topShow!.id } } as any)}
                                >
                                    <Ionicons name="trophy-outline" size={20} color={ACCENT} />
                                    <View style={{ flex: 1 }}>
                                        <ThemedText style={styles.topShowLabel} numberOfLines={1}>
                                            Top show · {metrics.topShow.label}
                                        </ThemedText>
                                        <ThemedText style={styles.topShowSub}>
                                            {metrics.topShow.rsvpCount} RSVP{metrics.topShow.rsvpCount === 1 ? '' : 's'} · {new Date(metrics.topShow.date).toLocaleDateString()}
                                        </ThemedText>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color="grey" />
                                </TouchableOpacity>
                            ) : null}
                        </Section>

                        {/* content */}
                        <Section title="Content">
                            <StatRow label="Posts" value={metrics.posts} />
                            <StatRow label="Likes received" value={metrics.likesReceived} />
                            <StatRow label="Listings" value={metrics.listings} />
                        </Section>

                        {/* scene */}
                        <Section title="Scene">
                            <StatRow label="Scenes followed" value={metrics.scenesFollowed} />
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
    content: { padding: 16, gap: 24, paddingBottom: 48 },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    topShow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: CARD,
        borderRadius: 14,
        padding: 14,
        marginTop: 10,
    },
    topShowLabel: { color: 'white', fontSize: 14, fontWeight: '600' },
    topShowSub: { color: 'grey', fontSize: 12, marginTop: 2 },
});
