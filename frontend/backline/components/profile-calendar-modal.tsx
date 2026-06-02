import { useState, useMemo } from 'react';
import { Modal, View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Show } from '@/services/show.service';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '@/constants/theme';

const SHOW_DOT = { key: 'show', color: '#4A90D9' };
const RSVP_DOT = { key: 'rsvp', color: '#4CAF50' };
const RSVP_DIM = { key: 'rsvp', color: 'rgba(76,175,80,0.35)' };
const FONT = Fonts?.rounded ?? undefined;

function toDateKey(iso: string) { return iso.split('T')[0]; }

function formatDoors(iso: string) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

interface Props {
    visible: boolean;
    onClose: () => void;
    profileShows: Show[];
    rsvpShows: Show[];
    isOwnProfile: boolean;
    activeProfileId: string;
    activeProfileType: 'user' | 'band' | 'venue';
    onRsvpToggle: (show: Show) => void;
}

export default function ProfileCalendarModal({
    visible, onClose,
    profileShows, rsvpShows,
    isOwnProfile,
    activeProfileId, activeProfileType,
    onRsvpToggle,
}: Props) {
    const bg = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');
    const [selectedDay, setSelectedDay] = useState<string | null>(null);

    const markedDates = useMemo(() => {
        const map: Record<string, { dots: { key: string; color: string }[] }> = {};

        const addDot = (dateKey: string, dot: { key: string; color: string }) => {
            if (!map[dateKey]) map[dateKey] = { dots: [] };
            if (!map[dateKey].dots.find(d => d.key === dot.key)) {
                map[dateKey].dots.push(dot);
            }
        };

        profileShows.forEach(s => addDot(toDateKey(s.date), SHOW_DOT));
        rsvpShows.forEach(s => addDot(toDateKey(s.date), isOwnProfile ? RSVP_DOT : RSVP_DIM));

        if (selectedDay) {
            if (!map[selectedDay]) map[selectedDay] = { dots: [] };
            (map[selectedDay] as any).selected = true;
            (map[selectedDay] as any).selectedColor = 'rgba(74,144,217,0.18)';
            (map[selectedDay] as any).selectedTextColor = textColor;
        }

        return map;
    }, [profileShows, rsvpShows, isOwnProfile, selectedDay, textColor]);

    const dayShows = useMemo(() => {
        if (!selectedDay) return [];
        const all = [
            ...profileShows.filter(s => toDateKey(s.date) === selectedDay),
            ...rsvpShows.filter(s => toDateKey(s.date) === selectedDay),
        ];
        return all.filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i);
    }, [selectedDay, profileShows, rsvpShows]);

    const hasRsvp = (show: Show) => {
        if (activeProfileType === 'band')  return show.rsvpBands?.some(b => b.id === activeProfileId);
        if (activeProfileType === 'venue') return show.rsvpVenues?.some(v => v.id === activeProfileId);
        return show.rsvpUsers?.some(u => u.id === activeProfileId);
    };

    const isProfileShow = (show: Show) => profileShows.some(s => s.id === show.id);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
                <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
                    <View style={[styles.card, { backgroundColor: bg, borderColor: iconColor + '44' }]}>
                        {/* Close button */}
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <Ionicons name="close" size={20} color={textColor} />
                        </TouchableOpacity>

                        {/* Legend */}
                        <View style={styles.legend}>
                            <View style={styles.legendItem}>
                                <View style={[styles.dot, { backgroundColor: SHOW_DOT.color }]} />
                                <ThemedText style={[styles.legendText, FONT && { fontFamily: FONT }]}>
                                    {isOwnProfile ? 'Your shows' : 'Their shows'}
                                </ThemedText>
                            </View>
                            <View style={styles.legendItem}>
                                <View style={[styles.dot, { backgroundColor: isOwnProfile ? RSVP_DOT.color : RSVP_DIM.color }]} />
                                <ThemedText style={[styles.legendText, FONT && { fontFamily: FONT }]}>
                                    {isOwnProfile ? "RSVP'd" : 'Your RSVPs'}
                                </ThemedText>
                            </View>
                        </View>

                        {/* Calendar */}
                        <Calendar
                            markingType="multi-dot"
                            markedDates={markedDates}
                            onDayPress={day =>
                                setSelectedDay(day.dateString === selectedDay ? null : day.dateString)
                            }
                            theme={{
                                backgroundColor: 'transparent',
                                calendarBackground: 'transparent',
                                textSectionTitleColor: iconColor,
                                selectedDayBackgroundColor: 'rgba(74,144,217,0.18)',
                                selectedDayTextColor: textColor,
                                todayTextColor: '#4A90D9',
                                dayTextColor: textColor,
                                textDisabledColor: textColor + '33',
                                arrowColor: textColor,
                                monthTextColor: textColor,
                                textDayFontFamily: FONT,
                                textMonthFontFamily: FONT,
                                textDayHeaderFontFamily: FONT,
                                textDayFontSize: 14,
                                textMonthFontSize: 15,
                                textDayHeaderFontSize: 11,
                                textMonthFontWeight: '700',
                            } as any}
                            style={{ width: 320 }}
                        />

                        {/* Day detail */}
                        {selectedDay && (
                            <View style={[styles.dayDetail, { borderTopColor: iconColor + '33' }]}>
                                {dayShows.length === 0 ? (
                                    <ThemedText style={[styles.noShows, FONT && { fontFamily: FONT }]}>
                                        No shows this day
                                    </ThemedText>
                                ) : (
                                    <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
                                        {dayShows.map(show => (
                                            <View key={show.id} style={[styles.showCard, { borderColor: iconColor + '44' }]}>
                                                <View style={styles.showInfo}>
                                                    <ThemedText style={[styles.showVenue, FONT && { fontFamily: FONT }]} numberOfLines={1}>
                                                        {show.venue?.name ?? 'TBA'}
                                                    </ThemedText>
                                                    <ThemedText style={[styles.showMeta, FONT && { fontFamily: FONT }]}>
                                                        {show.city}, {show.state}
                                                        {show.doors ? `  ·  Doors ${formatDoors(show.doors)}` : ''}
                                                    </ThemedText>
                                                    {show.bands.length > 0 && (
                                                        <ThemedText style={[styles.showBands, FONT && { fontFamily: FONT }]} numberOfLines={1}>
                                                            {show.bands.map(b => b.band.name).join(' · ')}
                                                        </ThemedText>
                                                    )}
                                                </View>
                                                {!isOwnProfile && isProfileShow(show) && (
                                                    <TouchableOpacity
                                                        style={[styles.rsvpBtn, hasRsvp(show) && styles.rsvpBtnActive]}
                                                        onPress={() => onRsvpToggle(show)}
                                                    >
                                                        <ThemedText style={[
                                                            styles.rsvpBtnText,
                                                            hasRsvp(show) && styles.rsvpBtnTextActive,
                                                            FONT && { fontFamily: FONT },
                                                        ]}>
                                                            {hasRsvp(show) ? 'Going ✓' : 'RSVP'}
                                                        </ThemedText>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        ))}
                                    </ScrollView>
                                )}
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        width: 352,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        paddingTop: 16,
        paddingBottom: 12,
        paddingHorizontal: 16,
        overflow: 'hidden',
    },
    closeBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
        padding: 4,
    },
    legend: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 6,
        paddingRight: 32,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },
    legendText: {
        fontSize: 11,
        opacity: 0.6,
    },
    dayDetail: {
        marginTop: 8,
        paddingTop: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    showCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        padding: 10,
        marginBottom: 8,
        gap: 8,
    },
    showInfo: { flex: 1 },
    showVenue: { fontSize: 13, fontWeight: '700' },
    showMeta: { fontSize: 11, opacity: 0.55, marginTop: 1 },
    showBands: { fontSize: 11, opacity: 0.45, marginTop: 1 },
    rsvpBtn: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(128,128,128,0.4)',
        backgroundColor: 'rgba(128,128,128,0.1)',
    },
    rsvpBtnActive: {
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76,175,80,0.12)',
    },
    rsvpBtnText: { fontSize: 11, fontWeight: '600', opacity: 0.7 },
    rsvpBtnTextActive: { color: '#4CAF50', opacity: 1 },
    noShows: { fontSize: 13, opacity: 0.4, textAlign: 'center', paddingVertical: 12 },
});
