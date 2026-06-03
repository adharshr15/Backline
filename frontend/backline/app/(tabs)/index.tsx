import { useState, useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { View, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isConvUnread } from '@/utils/lastRead';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Fonts } from '@/constants/theme';
import { getFeedShows, repostShow, unrepostShow, Show } from '@/services/show.service';
import { getMyConversations, getMyInvites, ParticipantType } from '@/services/conversation.service';

const TYPE_LABEL: Record<string, string> = {
    USER: 'User',
    BAND: 'Band',
    VENUE: 'Venue',
};

function formatDate(isoString: string) {
    const d = new Date(isoString);
    const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const day = d.getDate();
    const weekday = d.toLocaleString('en-US', { weekday: 'short' }).toUpperCase();
    return { month, day, weekday };
}

function formatDoors(doorsString: string) {
    if (!doorsString) return '';
    if (doorsString.includes('T')) {
        const d = new Date(doorsString);
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    return doorsString;
}

type FeedShowCardProps = {
    show: Show;
    activeProfileId: string;
    activeProfileType: 'user' | 'band' | 'venue';
    activeProfileBandId?: string;
    activeProfileVenueId?: string;
    onRepostToggle: (show: Show) => void;
};

function FeedShowCard({ show, activeProfileId, activeProfileType, onRepostToggle }: FeedShowCardProps) {
    const borderColor = useThemeColor({}, 'text');
    const { month, day, weekday } = formatDate(show.date);
    const bandNames = show.bands.map(b => b.band.name).join(' · ');

    const hasReposted =
        activeProfileType === 'band'
            ? show.repostedByBands.some(b => b.id === activeProfileId)
            : activeProfileType === 'venue'
            ? show.repostedByVenues.some(v => v.id === activeProfileId)
            : show.repostedByUsers.some(u => u.id === activeProfileId);

    return (
        <View style={[styles.card, { borderColor }]}>
            <View style={styles.dateCol}>
                <ThemedText style={styles.month}>{month}</ThemedText>
                <ThemedText style={styles.day}>{day}</ThemedText>
                <ThemedText style={styles.weekday}>{weekday}</ThemedText>
            </View>

            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            <View style={styles.infoCol}>
                <ThemedText style={styles.venueName} numberOfLines={1}>
                    {show.venue?.name ?? 'TBA'}
                </ThemedText>
                <ThemedText style={styles.location} numberOfLines={1}>
                    {show.city}, {show.state}
                </ThemedText>
                {show.doors ? (
                    <ThemedText style={styles.meta}>Doors {formatDoors(show.doors)}</ThemedText>
                ) : null}
                {bandNames ? (
                    <ThemedText style={styles.bands} numberOfLines={1}>{bandNames}</ThemedText>
                ) : null}
            </View>

            <View style={styles.repostCol}>
                <ThemedText
                    style={[styles.repostBtn, hasReposted && styles.repostBtnActive]}
                    onPress={() => onRepostToggle(show)}
                >
                    {hasReposted ? '↩ Done' : '↩'}
                </ThemedText>
            </View>
        </View>
    );
}

export default function HomeScreen() {
    const router = useRouter();
    const { activeProfile } = useAuth();
    const bgColor = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');

    const [shows, setShows] = useState<Show[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasUnread, setHasUnread] = useState(false);

    const profileType =
        activeProfile?.accountType === 'BAND' ? 'band' :
        activeProfile?.accountType === 'VENUE' ? 'venue' : 'user';

    const loadFeed = useCallback(() => {
        if (!activeProfile) return;
        setLoading(true);
        getFeedShows(profileType, activeProfile.id)
            .then(setShows)
            .catch(console.error)
            .finally(() => setLoading(false));

        const senderType = (
            activeProfile.accountType === 'BAND'  ? 'BAND' :
            activeProfile.accountType === 'VENUE' ? 'VENUE' : 'USER'
        ) as ParticipantType;

        // check for unread: any pending invites OR any conversation with unread messages
        Promise.all([
            getMyInvites(senderType, activeProfile.id).catch(() => []),
            getMyConversations(senderType, activeProfile.id).catch(() => []),
        ]).then(([invites, convs]) => {
            if (invites.length > 0) { setHasUnread(true); return; }
            setHasUnread(convs.some(conv => isConvUnread(conv, senderType, activeProfile.id)));
        });
    }, [activeProfile?.id]);

    useFocusEffect(loadFeed);

    const handleRepostToggle = async (show: Show) => {
        if (!activeProfile) return;
        const type = profileType;
        const bandId = type === 'band' ? activeProfile.id : undefined;
        const venueId = type === 'venue' ? activeProfile.id : undefined;

        const hasReposted =
            type === 'band'
                ? show.repostedByBands.some(b => b.id === activeProfile.id)
                : type === 'venue'
                ? show.repostedByVenues.some(v => v.id === activeProfile.id)
                : show.repostedByUsers.some(u => u.id === activeProfile.id);

        try {
            if (hasReposted) {
                await unrepostShow(show.id, type, bandId, venueId);
            } else {
                await repostShow(show.id, type, bandId, venueId);
            }
            loadFeed();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={styles.headerRow}>
                <View>
                    <ThemedText style={styles.title}>Following</ThemedText>
                    <ThemedText style={styles.sub}>
                        as {activeProfile?.name} ({TYPE_LABEL[activeProfile?.accountType ?? 'USER']})
                    </ThemedText>
                </View>
                <TouchableOpacity onPress={() => router.push('/messages')} style={styles.dmBtn}>
                    <Ionicons name="chatbubble-ellipses-outline" size={26} color={textColor} />
                    {hasUnread && <View style={styles.unreadDot} />}
                </TouchableOpacity>
            </View>

            {loading && <ActivityIndicator style={{ marginTop: 32 }} />}

            {!loading && shows.length === 0 && (
                <ThemedText style={styles.empty}>No shows from followed accounts yet.</ThemedText>
            )}

            <FlatList
                data={shows}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
                renderItem={({ item }) => (
                    <FeedShowCard
                        show={item}
                        activeProfileId={activeProfile?.id ?? ''}
                        activeProfileType={profileType}
                        onRepostToggle={handleRepostToggle}
                    />
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 16 },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 0,
    },
    dmBtn: { paddingTop: 10, paddingLeft: 8 },
    unreadDot: {
        position: 'absolute',
        top: 8,
        right: -2,
        width: 9,
        height: 9,
        borderRadius: 5,
        backgroundColor: '#FF3B30',
    },
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
    card: {
        flexDirection: 'row',
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 10,
    },
    dateCol: {
        width: 56,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 2,
    },
    month: {
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.5,
        opacity: 0.5,
    },
    day: {
        fontSize: 22,
        fontWeight: '700',
        lineHeight: 26,
    },
    weekday: {
        fontSize: 9,
        opacity: 0.5,
        letterSpacing: 0.5,
    },
    divider: {
        width: StyleSheet.hairlineWidth,
        opacity: 0.3,
    },
    infoCol: {
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 2,
        justifyContent: 'center',
    },
    venueName: {
        fontSize: 14,
        fontWeight: '700',
    },
    location: {
        fontSize: 12,
        opacity: 0.55,
    },
    meta: {
        fontSize: 12,
        opacity: 0.7,
        marginTop: 2,
    },
    bands: {
        fontSize: 11,
        opacity: 0.5,
        marginTop: 1,
    },
    repostCol: {
        justifyContent: 'center',
        paddingHorizontal: 10,
    },
    repostBtn: {
        fontSize: 18,
        opacity: 0.4,
    },
    repostBtnActive: {
        opacity: 1,
        color: '#4CAF50',
    },
});
