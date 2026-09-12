import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTabHref } from '@/hooks/use-tab-href';
import { BASE_URL } from '@/services/api';
import PostGrid from '@/components/explore/PostGrid';
import type { ExploreItem, ExploreSection, ItemType, SeeMore } from '@/services/explore.service';

export const ACCENT = '#4A90D9';

/**
 * Routing for a feed item. `type` is authoritative; `accountType` is the
 * fallback for anything the backend hands back without one.
 */
export function useItemPress() {
    const router = useRouter();
    const tabHref = useTabHref();

    return (item: ExploreItem) => {
        const type = (item.type ?? item.accountType) as ItemType;
        switch (type) {
            case 'BAND':
                return router.push(tabHref(`view-band/${item.id}`));
            case 'VENUE':
                return router.push(tabHref(`view-venue/${item.id}`));
            case 'USER':
                return router.push(tabHref(`view-user/${item.id}`));
            case 'SHOW':
                return router.push({ pathname: tabHref('show'), params: { id: item.id } });
            case 'POST':
                return router.push({ pathname: tabHref('post'), params: { id: item.id } });
            case 'SCENE':
                return router.push({
                    pathname: tabHref('scene'),
                    // A scene item carries its slug; city/state are the fallback
                    // for the legacy param form ScenePage still accepts.
                    params: item.slug
                        ? { slug: item.slug }
                        : { city: item.city ?? '', state: item.state ?? '' },
                });
        }
    };
}

export const imageSource = (url?: string | null) =>
    url ? { uri: `${BASE_URL}${url}` } : require('@/assets/images/default/profileImage.png');

const showDateParts = (iso?: string) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return {
        month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
        day: String(d.getDate()),
    };
};

/** Avatar card: bands, venues, people, scenes. */
export function ProfileCard({ item, onPress }: { item: ExploreItem; onPress: () => void }) {
    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
            <Image source={imageSource(item.profileImageUrl)} style={styles.avatar} />
            <ThemedText style={styles.cardName} numberOfLines={1}>{item.name}</ThemedText>
            <ThemedText style={styles.cardSubtitle} numberOfLines={1}>{item.subtitle}</ThemedText>
        </TouchableOpacity>
    );
}

/** Date-forward card for shows, matching the date/venue layout used elsewhere. */
export function ShowCard({ item, onPress }: { item: ExploreItem; onPress: () => void }) {
    const borderColor = useThemeColor({}, 'text');
    const date = showDateParts(item.date);

    return (
        <TouchableOpacity style={[styles.showCard, { borderColor }]} onPress={onPress} activeOpacity={0.75}>
            {date && (
                <View style={styles.showDate}>
                    <ThemedText style={styles.showMonth}>{date.month}</ThemedText>
                    <ThemedText style={styles.showDay}>{date.day}</ThemedText>
                </View>
            )}
            <ThemedText style={styles.showName} numberOfLines={2}>{item.name}</ThemedText>
            <ThemedText style={styles.cardSubtitle} numberOfLines={1}>
                {item.city && item.state ? `${item.city}, ${item.state}` : item.subtitle}
            </ThemedText>
        </TouchableOpacity>
    );
}

/** A vertical row, shared by the section-list screen and the scene tabs. */
export function ItemRow({ item, onPress }: { item: ExploreItem; onPress: () => void }) {
    const textColor = useThemeColor({}, 'text');
    const date = item.type === 'SHOW' ? showDateParts(item.date) : null;

    return (
        <TouchableOpacity
            style={[styles.itemRow, { borderBottomColor: textColor + '18' }]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            {date ? (
                <View style={styles.rowDate}>
                    <ThemedText style={styles.showMonth}>{date.month}</ThemedText>
                    <ThemedText style={styles.showDay}>{date.day}</ThemedText>
                </View>
            ) : (
                <Image source={imageSource(item.profileImageUrl)} style={styles.rowAvatar} />
            )}
            <View style={styles.rowBody}>
                <ThemedText style={styles.rowName} numberOfLines={1}>{item.name}</ThemedText>
                {!!item.subtitle && (
                    <ThemedText style={styles.rowSubtitle} numberOfLines={1}>{item.subtitle}</ThemedText>
                )}
            </View>
        </TouchableOpacity>
    );
}

type Props = {
    section: ExploreSection;
    onSeeMore?: (section: { title: string; kind: string; seeMore: SeeMore }) => void;
};

/**
 * Renders one section of the Explore feed off its `kind`. The screen never
 * branches on which section it is -- that is the whole point of the feed being
 * a list of descriptors.
 */
export default function SectionRail({ section, onSeeMore }: Props) {
    const handlePress = useItemPress();
    const showSeeMore = !!onSeeMore && !!section.seeMore?.path;

    if (section.kind === 'POSTS') {
        return <PostGrid items={section.items} onPress={handlePress} />;
    }

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <ThemedText style={styles.title}>{section.title}</ThemedText>
                {showSeeMore && (
                    <TouchableOpacity onPress={() => onSeeMore!(section)} hitSlop={8}>
                        <ThemedText style={styles.seeMore}>See all</ThemedText>
                    </TouchableOpacity>
                )}
            </View>

            {section.items.length === 0 ? (
                <ThemedText style={styles.empty}>Nothing here yet</ThemedText>
            ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                    {section.items.map(item =>
                        section.kind === 'SHOW' ? (
                            <ShowCard key={item.id} item={item} onPress={() => handlePress(item)} />
                        ) : (
                            <ProfileCard key={item.id} item={item} onPress={() => handlePress(item)} />
                        )
                    )}
                </ScrollView>
            )}
        </View>
    );
}

export const styles = StyleSheet.create({
    container: { marginBottom: 24 },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingHorizontal: 16,
    },
    title: { fontSize: 17, fontWeight: '700', flexShrink: 1 },
    seeMore: { fontSize: 13, fontWeight: '600', color: ACCENT, marginLeft: 12 },
    row: { paddingHorizontal: 16, gap: 12 },
    card: { width: 88, alignItems: 'center', gap: 5 },
    avatar: { width: 64, height: 64, borderRadius: 32 },
    cardName: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
    cardSubtitle: { fontSize: 11, opacity: 0.55, textAlign: 'center' },
    showCard: {
        width: 132,
        gap: 4,
        padding: 10,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
    },
    showDate: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    showMonth: { fontSize: 11, fontWeight: '700', opacity: 0.55, letterSpacing: 0.6 },
    showDay: { fontSize: 15, fontWeight: '700' },
    showName: { fontSize: 13, fontWeight: '600' },
    empty: { opacity: 0.4, fontSize: 13, paddingHorizontal: 16, paddingVertical: 8 },
    // Vertical row, used by the section list and the scene tabs.
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    rowDate: { width: 44, alignItems: 'center' },
    rowAvatar: { width: 44, height: 44, borderRadius: 22 },
    rowBody: { flex: 1 },
    rowName: { fontSize: 15, fontWeight: '600' },
    rowSubtitle: { fontSize: 13, opacity: 0.55, marginTop: 1 },
});
