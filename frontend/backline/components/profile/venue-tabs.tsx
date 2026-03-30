import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TabSwitcher } from '@/components/ui/tab-switcher';
import { ShowCarousel, type Show } from '@/components/show-carousel';
import { ThemedText } from '@/components/themed-text';

type VenueTab = 'shows' | 'availability';

type Props = {
  shows: Show[];
  bookedDates: string[]; // ISO date strings e.g. '2025-04-12'
  onSeePastShows: () => void;
};

export function VenueTabs({ shows, bookedDates, onSeePastShows }: Props) {
  const [activeTab, setActiveTab] = useState<VenueTab>('shows');

  return (
    <TabSwitcher
      tabs={[
        {
          key: 'shows',
          content: (
            <View style={styles.carouselWrapper}>
              <ShowCarousel shows={shows} onSeePastShows={onSeePastShows} />
            </View>
          ),
        },
        {
          key: 'availability',
          content: (
            <View style={styles.calendarWrapper}>
              <AvailabilityCalendar bookedDates={bookedDates} />
            </View>
          ),
        },
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      marginHorizontal={32}
    />
  );
}

function AvailabilityCalendar({ bookedDates }: { bookedDates: string[] }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const monthName = today.toLocaleString('default', { month: 'long' });

  const bookedSet = new Set(bookedDates);

  const days: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const isoDate = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return (
    <View style={styles.calendar}>
      <ThemedText style={styles.monthLabel}>{monthName} {year}</ThemedText>
      <View style={styles.weekRow}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <ThemedText key={d} style={styles.weekDay}>{d}</ThemedText>
        ))}
      </View>
      <View style={styles.daysGrid}>
        {days.map((day, i) => {
          const booked = day !== null && bookedSet.has(isoDate(day));
          const isToday = day === today.getDate();
          return (
            <View
              key={i}
              style={[
                styles.dayCell,
                booked && styles.dayCellBooked,
                isToday && styles.dayCellToday,
              ]}
            >
              {day !== null && (
                <ThemedText style={[
                  styles.dayText,
                  booked && styles.dayTextBooked,
                ]}>
                  {day}
                </ThemedText>
              )}
            </View>
          );
        })}
      </View>
      <View style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: '#e74c3c' }]} />
        <ThemedText style={styles.legendText}>Booked</ThemedText>
        <View style={[styles.legendDot, { backgroundColor: '#2ecc71', marginLeft: 12 }]} />
        <ThemedText style={styles.legendText}>Available</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carouselWrapper: {
    marginHorizontal: -32,
  },
  calendarWrapper: {
    paddingBottom: 16,
  },
  calendar: {
    gap: 8,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    opacity: 0.5,
    fontWeight: '600',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 100,
  },
  dayCellBooked: {
    backgroundColor: '#e74c3c22',
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: '#4A90D9',
  },
  dayText: {
    fontSize: 13,
  },
  dayTextBooked: {
    color: '#e74c3c',
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    opacity: 0.6,
  },
});