import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Show } from '@/services/show.service';

function formatDate(isoString: string) {
    const d = new Date(isoString);
    const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const day = d.getDate();
    const weekday = d.toLocaleString('en-US', { weekday: 'short' }).toUpperCase();
    return { month, day, weekday };
}

function formatDoors(doorsString: string) {
    if (!doorsString) return '';
    // If it's an ISO string, extract time; otherwise use as-is
    if (doorsString.includes('T')) {
        const d = new Date(doorsString);
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    return doorsString;
}

type ShowListCardProps = { show: Show };

function ShowListCard({ show }: ShowListCardProps) {
    const borderColor = useThemeColor({}, 'text');
    const { month, day, weekday } = formatDate(show.date);
    const bandNames = show.bands.map(b => b.band.name).join(' · ');

    return (
        <View style={[styles.card, { borderColor }]}>
            {/* Date column */}
            <View style={styles.dateCol}>
                <ThemedText style={styles.month}>{month}</ThemedText>
                <ThemedText style={styles.day}>{day}</ThemedText>
                <ThemedText style={styles.weekday}>{weekday}</ThemedText>
            </View>

            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            {/* Info column */}
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
        </View>
    );
}

type Props = {
    shows: Show[];
    pastShows: Show[];
    showingPast: boolean;
    isOwner: boolean;
    onSeePastShows: () => void;
};

export function ShowListView({ shows, pastShows, showingPast, isOwner, onSeePastShows }: Props) {
    const borderColor = useThemeColor({}, 'text');

    return (
        <View style={styles.container}>
            {/* Past shows */}
            {showingPast && pastShows.length > 0 && (
                <>
                    <ThemedText style={styles.sectionLabel}>Past Shows</ThemedText>
                    {pastShows.map(show => <ShowListCard key={show.id} show={show} />)}
                    <View style={[styles.sectionSep, { backgroundColor: borderColor }]} />
                    <ThemedText style={styles.sectionLabel}>Upcoming</ThemedText>
                </>
            )}

            {/* Upcoming shows */}
            {shows.length === 0 ? (
                <ThemedText style={styles.empty}>No upcoming shows</ThemedText>
            ) : (
                shows.map(show => <ShowListCard key={show.id} show={show} />)
            )}

            {/* See past shows — bottom */}
            {!showingPast && pastShows.length > 0 && (
                <TouchableOpacity
                    style={[styles.actionBtn, { borderColor, alignSelf: 'center', marginTop: 12 }]}
                    onPress={onSeePastShows}
                >
                    <ThemedText style={styles.actionBtnText}>See Past Shows →</ThemedText>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 32,
        gap: 10,
    },
    actionBtn: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderStyle: 'solid',
    },
    actionBtnText: {
        fontSize: 12,
        fontWeight: '600',
    },
    card: {
        flexDirection: 'row',
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 2,
        overflow: 'hidden',
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
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        opacity: 0.4,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginTop: 4,
    },
    sectionSep: {
        height: StyleSheet.hairlineWidth,
        opacity: 0.3,
        marginVertical: 6,
    },
    empty: {
        opacity: 0.4,
        fontSize: 13,
        textAlign: 'center',
        paddingVertical: 16,
    },
});
