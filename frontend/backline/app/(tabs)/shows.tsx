import { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { type Show } from '@/components/show-carousel';

type ViewMode = 'map' | 'list';
type DateRange = 'today' | 'this_week' | 'this_month' | 'all';

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  today: 'Today',
  this_week: 'This Week',
  this_month: 'This Month',
  all: 'All Upcoming',
};

// mock shows with coordinates
const mockNearbyShows: (Show & { lat: number; lng: number })[] = [
  {
    id: '1',
    poster: require('@/assets/images/example/heel/poster1.png'),
    venue: 'CAMP House',
    city: 'College Station',
    state: 'TX',
    date: 'Apr 2, 2025',
    doors: '7:00 PM',
    lat: 30.6280,
    lng: -96.3344,
  },
  {
    id: '2',
    poster: require('@/assets/images/example/heel/poster2.png'),
    venue: 'Notsua',
    city: 'Houston',
    state: 'TX',
    date: 'Apr 5, 2025',
    doors: '8:00 PM',
    lat: 29.7604,
    lng: -95.3698,
  },
];

function DateRangePicker({
  selected,
  onSelect,
}: {
  selected: DateRange;
  onSelect: (r: DateRange) => void;
}) {
  const activeColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'text');

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.dateRangeRow}
    >
      {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map(range => (
        <TouchableOpacity
          key={range}
          onPress={() => onSelect(range)}
          style={[
            styles.dateRangeChip,
            { borderColor },
            selected === range && { backgroundColor: activeColor },
          ]}
        >
          <ThemedText
            style={[
              styles.dateRangeLabel,
              selected === range && { color: selected === range ? '#000' : activeColor },
            ]}
          >
            {DATE_RANGE_LABELS[range]}
          </ThemedText>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function ShowListItem({ show }: { show: (typeof mockNearbyShows)[0] }) {
  const borderColor = useThemeColor({}, 'text');
  return (
    <View style={[styles.listItem, { borderColor }]}>
      <View style={styles.listItemDate}>
        <ThemedText style={styles.listItemDateText}>{show.date}</ThemedText>
        <ThemedText style={styles.listItemDoorsText}>Doors {show.doors}</ThemedText>
      </View>
      <View style={styles.listItemInfo}>
        <ThemedText style={styles.listItemVenue}>{show.venue}</ThemedText>
        <ThemedText style={styles.listItemCity}>{show.city}, {show.state}</ThemedText>
      </View>
    </View>
  );
}

export default function ShowsScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [dateRange, setDateRange] = useState<DateRange>('this_week');
  const { width, height } = useWindowDimensions();
  const borderColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');

  return (
    <ThemedView style={styles.container}>

      {/* top bar */}
      <View style={styles.topBar}>
        <ThemedText style={styles.title}>Shows Near You</ThemedText>
        <View style={[styles.viewToggle, { borderColor }]}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'map' && { backgroundColor: borderColor }]}
            onPress={() => setViewMode('map')}
          >
            <IconSymbol
              name="map"
              size={16}
              color={viewMode === 'map' ? backgroundColor : borderColor}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'list' && { backgroundColor: borderColor }]}
            onPress={() => setViewMode('list')}
          >
            <IconSymbol
              name="list.bullet"
              size={16}
              color={viewMode === 'list' ? backgroundColor : borderColor}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* date range picker */}
      <DateRangePicker selected={dateRange} onSelect={setDateRange} />

      {/* content */}
      {viewMode === 'map' ? (
        <MapView
          style={{ width, height: height - 180 }}
          initialRegion={{
            latitude: 30.6280,
            longitude: -96.3344,
            latitudeDelta: 2,
            longitudeDelta: 2,
          }}
          showsUserLocation
        >
          {mockNearbyShows.map(show => (
            <Marker
              key={show.id}
              coordinate={{ latitude: show.lat, longitude: show.lng }}
              title={show.venue}
              description={`${show.date} · Doors ${show.doors}`}
            />
          ))}
        </MapView>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {mockNearbyShows.map(show => (
            <ShowListItem key={show.id} show={show} />
          ))}
        </ScrollView>
      )}

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  viewToggle: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    overflow: 'hidden',
  },
  toggleButton: {
    padding: 8,
  },
  dateRangeRow: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  dateRangeChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dateRangeLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  listItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listItemDate: {
    width: 90,
    gap: 2,
  },
  listItemDateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listItemDoorsText: {
    fontSize: 11,
    opacity: 0.5,
  },
  listItemInfo: {
    flex: 1,
    gap: 2,
  },
  listItemVenue: {
    fontSize: 14,
    fontWeight: '600',
  },
  listItemCity: {
    fontSize: 12,
    opacity: 0.5,
  },
});