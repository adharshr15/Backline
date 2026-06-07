import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { BASE_URL } from '@/services/api';

export type DiscoverItem = {
    id: string;
    name: string;
    subtitle: string;
    profileImageUrl?: string | null;
    accountType: 'BAND' | 'VENUE';
};

type Props = {
    title: string;
    items: DiscoverItem[];
};

export default function DiscoverSection({ title, items }: Props) {
    const router = useRouter();

    const handlePress = (item: DiscoverItem) => {
        if (item.accountType === 'BAND') {
            router.push(`/explore/view-band/${item.id}` as any);
        } else {
            router.push(`/explore/view-venue/${item.id}` as any);
        }
    };

    return (
        <View style={styles.container}>
            <ThemedText style={styles.title}>{title}</ThemedText>
            {items.length === 0 ? (
                <ThemedText style={styles.empty}>None found near you</ThemedText>
            ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                    {items.map(item => (
                        <TouchableOpacity key={item.id} style={styles.card} onPress={() => handlePress(item)} activeOpacity={0.75}>
                            <Image
                                source={
                                    item.profileImageUrl
                                        ? { uri: `${BASE_URL}${item.profileImageUrl}` }
                                        : require('@/assets/images/default/profileImage.png')
                                }
                                style={styles.avatar}
                            />
                            <ThemedText style={styles.name} numberOfLines={1}>{item.name}</ThemedText>
                            <ThemedText style={styles.subtitle} numberOfLines={1}>{item.subtitle}</ThemedText>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { marginBottom: 24 },
    title: { fontSize: 17, fontWeight: '700', marginBottom: 12, paddingHorizontal: 16 },
    row: { paddingHorizontal: 16, gap: 12 },
    card: { width: 88, alignItems: 'center', gap: 5 },
    avatar: { width: 64, height: 64, borderRadius: 32 },
    name: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
    subtitle: { fontSize: 11, opacity: 0.55, textAlign: 'center' },
    empty: { opacity: 0.4, fontSize: 13, paddingHorizontal: 16, paddingVertical: 8 },
});
