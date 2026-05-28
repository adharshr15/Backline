import { useState, useCallback } from 'react';
import {
    View, TextInput, FlatList, TouchableOpacity,
    StyleSheet, ActivityIndicator, useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { BASE_URL } from '@/services/api';
import api from '@/services/api';
import { Fonts } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

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

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = useCallback(async (text: string) => {
        setQuery(text);
        if (!text.trim()) { setResults([]); return; }
        setLoading(true);
        try {
            const res = await api.get('/search', { params: { q: text.trim() } });
            setResults(res.data);
        } catch (e) {
            console.error('search error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    const renderItem = ({ item }: { item: SearchResult }) => (
        <TouchableOpacity
            style={[styles.row, { borderBottomColor: isDark ? '#2a2a2a' : '#eee' }]}
            onPress={() => router.push(`${VIEW_PATH[item.accountType]}/${item.id}` as any)}
            activeOpacity={0.7}
        >
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
                <ThemedText style={styles.subtitle}>{item.subtitle}</ThemedText>
            </View>
            <View style={[styles.badge, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
                <ThemedText style={styles.badgeText}>{TYPE_LABEL[item.accountType]}</ThemedText>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            <ThemedText style={styles.title}>Explore</ThemedText>

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
                    <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
                        <Ionicons name="close-circle" size={18} color={isDark ? '#888' : '#666'} />
                    </TouchableOpacity>
                )}
            </View>

            {loading && <ActivityIndicator style={{ marginTop: 24 }} />}

            {!loading && query.length > 0 && results.length === 0 && (
                <ThemedText style={styles.empty}>No results for "{query}"</ThemedText>
            )}

            <FlatList
                data={results}
                keyExtractor={item => `${item.accountType}-${item.id}`}
                renderItem={renderItem}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 24 }}
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
        marginBottom: 16,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 12,
    },
    searchIcon: { marginRight: 8 },
    input: { flex: 1, fontSize: 16 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
    rowText: { flex: 1 },
    name: { fontSize: 15, fontWeight: '600' },
    subtitle: { fontSize: 13, opacity: 0.6, marginTop: 1 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 8 },
    badgeText: { fontSize: 11, opacity: 0.7 },
    empty: { textAlign: 'center', marginTop: 40, opacity: 0.5 },
});
