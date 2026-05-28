import { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/AuthContext';
import { BASE_URL } from '@/services/api';
import { getFollowing } from '@/services/follow.service';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Fonts } from '@/constants/theme';

type FollowedAccount = {
    id: string;
    name: string;
    profileImageUrl: string | null;
    accountType: 'USER' | 'BAND' | 'VENUE';
};

const TYPE_LABEL: Record<string, string> = {
    USER: 'User',
    BAND: 'Band',
    VENUE: 'Venue',
};

export default function HomeScreen() {
    const { activeProfile } = useAuth();
    const bgColor = useThemeColor({}, 'background');
    const borderColor = useThemeColor({}, 'icon');

    const [following, setFollowing] = useState<FollowedAccount[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!activeProfile) return;
        const type =
            activeProfile.accountType === 'BAND' ? 'band' :
            activeProfile.accountType === 'VENUE' ? 'venue' : 'user';

        getFollowing(type, activeProfile.id)
            .then(setFollowing)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [activeProfile?.id]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            <ThemedText style={styles.title}>Following</ThemedText>
            <ThemedText style={styles.sub}>
                as {activeProfile?.name} ({TYPE_LABEL[activeProfile?.accountType ?? 'USER']})
            </ThemedText>

            {loading && <ActivityIndicator style={{ marginTop: 32 }} />}

            {!loading && following.length === 0 && (
                <ThemedText style={styles.empty}>Not following anyone yet.</ThemedText>
            )}

            <FlatList
                data={following}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
                renderItem={({ item }) => (
                    <View style={[styles.row, { borderBottomColor: borderColor + '33' }]}>
                        <Image
                            source={
                                item.profileImageUrl
                                    ? { uri: `${BASE_URL}${item.profileImageUrl}` }
                                    : require('@/assets/images/default/profileImage.png')
                            }
                            style={styles.avatar}
                        />
                        <View style={styles.rowText}>
                            <ThemedText style={styles.name}>{item.name}</ThemedText>
                            <ThemedText style={styles.type}>{TYPE_LABEL[item.accountType]}</ThemedText>
                        </View>
                    </View>
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 16 },
    title: {
        fontSize: 28,
        fontFamily: Fonts?.rounded ?? 'normal',
        fontWeight: '700',
        marginTop: 8,
    },
    sub: {
        fontSize: 13,
        opacity: 0.5,
        marginBottom: 16,
        marginTop: 2,
    },
    empty: {
        textAlign: 'center',
        marginTop: 40,
        opacity: 0.4,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 12,
    },
    rowText: { flex: 1 },
    name: { fontSize: 15, fontWeight: '600' },
    type: { fontSize: 12, opacity: 0.5, marginTop: 2 },
});
