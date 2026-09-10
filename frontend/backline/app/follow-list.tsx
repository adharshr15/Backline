import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BASE_URL } from '@/services/api';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTabHref } from '@/hooks/use-tab-href';
import { getFollowers, getFollowing } from '@/services/follow.service';
import { ProfileKind } from '@/services/metrics.service';

const ACCENT = '#4A90D9';

type ProfileRow = { id: string; name: string; profileImageUrl?: string | null; accountType: 'USER' | 'BAND' | 'VENUE' };

const viewPath = (accountType: string) =>
    accountType === 'BAND' ? 'view-band' : accountType === 'VENUE' ? 'view-venue' : 'view-user';

export default function FollowListScreen() {
    const router = useRouter();
    const tabHref = useTabHref();
    const { mode, type, id } = useLocalSearchParams<{ mode: 'followers' | 'following'; type: ProfileKind; id: string }>();

    const [rows, setRows] = useState<ProfileRow[]>([]);
    const [loading, setLoading] = useState(true);

    useFocusEffect(useCallback(() => {
        if (!type || !id) return;
        setLoading(true);
        const fetcher = mode === 'following' ? getFollowing : getFollowers;
        fetcher(type, id)
            .then((data) => setRows(data ?? []))
            .catch((e) => console.error('follow-list load error:', e))
            .finally(() => setLoading(false));
    }, [mode, type, id]));

    const openProfile = (row: ProfileRow) => {
        router.push({ pathname: tabHref(`${viewPath(row.accountType)}/${row.id}`), params: {} } as any);
    };

    return (
        <ThemedView style={{ flex: 1 }}>
            <SafeAreaView edges={['top']} style={{ flex: 1 }}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                        <Ionicons name="chevron-back" size={28} color={ACCENT} />
                    </TouchableOpacity>
                    <ThemedText style={styles.headerTitle}>{mode === 'following' ? 'Following' : 'Followers'}</ThemedText>
                    <View style={{ width: 28 }} />
                </View>

                {loading ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator />
                    </View>
                ) : rows.length === 0 ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <ThemedText style={{ opacity: 0.5 }}>
                            {mode === 'following' ? 'Not following anyone yet' : 'No followers yet'}
                        </ThemedText>
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={{ paddingHorizontal: 16 }}>
                        {rows.map((row) => (
                            <TouchableOpacity key={row.id} style={styles.row} onPress={() => openProfile(row)} activeOpacity={0.7}>
                                <Image
                                    source={row.profileImageUrl ? { uri: `${BASE_URL}${row.profileImageUrl}` } : require('@/assets/images/default/profileImage.png')}
                                    style={styles.avatar}
                                />
                                <View style={{ flex: 1 }}>
                                    <ThemedText style={styles.name}>{row.name}</ThemedText>
                                    <ThemedText style={styles.sub}>
                                        {row.accountType === 'BAND' ? 'Band' : row.accountType === 'VENUE' ? 'Venue' : 'User'}
                                    </ThemedText>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="grey" />
                            </TouchableOpacity>
                        ))}
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
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#333',
    },
    avatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#282828' },
    name: { fontSize: 15, fontWeight: '600' },
    sub: { fontSize: 12, opacity: 0.5, marginTop: 2 },
});
