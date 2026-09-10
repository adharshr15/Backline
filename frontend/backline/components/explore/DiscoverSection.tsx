import { View, ScrollView, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ProfileCard, useItemPress, styles as railStyles } from '@/components/explore/SectionRail';
import type { ExploreItem } from '@/services/explore.service';

export type DiscoverItem = {
    id: string;
    name: string;
    subtitle: string;
    profileImageUrl?: string | null;
    accountType: 'BAND' | 'VENUE' | 'USER';
};

type Props = {
    title: string;
    items: DiscoverItem[];
};

/**
 * A titled avatar carousel over a plain item array, for callers that have their
 * own data rather than an /explore section. Shares SectionRail's card so the two
 * never drift apart visually.
 */
export default function DiscoverSection({ title, items }: Props) {
    const handlePress = useItemPress();

    return (
        <View style={railStyles.container}>
            <ThemedText style={styles.title}>{title}</ThemedText>
            {items.length === 0 ? (
                <ThemedText style={railStyles.empty}>None found near you</ThemedText>
            ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={railStyles.row}>
                    {items.map(item => {
                        const exploreItem = {
                            ...item,
                            type: item.accountType,
                            profileImageUrl: item.profileImageUrl ?? null,
                        } as ExploreItem;
                        return (
                            <ProfileCard
                                key={item.id}
                                item={exploreItem}
                                onPress={() => handlePress(exploreItem)}
                            />
                        );
                    })}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    title: { fontSize: 17, fontWeight: '700', marginBottom: 12, paddingHorizontal: 16 },
});
