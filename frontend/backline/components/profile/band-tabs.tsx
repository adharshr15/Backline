import { useState } from 'react';
import { View, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { TabSwitcher } from '@/components/ui/tab-switcher';
import { ShowCarousel, type Show } from '@/components/show-carousel';
import { CreateShowButton, CREATE_BUTTON_WIDTH } from '@/components/profile/create-show-button';
import { ThemedText } from '@/components/themed-text';

type BandTab = 'shows' | 'tours';

type Props = {
  shows: Show[];
  tours: Tour[];
  isOwner: boolean;
  onSeePastShows: () => void;
  onCreateShow: () => void;
  onSeePastTours: () => void;
  onCreateTour: () => void;
};

export type Tour = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  shows: Show[];
};

export function BandTabs({
  shows,
  tours,
  isOwner,
  onSeePastShows,
  onCreateShow,
  onSeePastTours,
  onCreateTour,
}: Props) {
  const [activeTab, setActiveTab] = useState<BandTab>('shows');
  const { width } = useWindowDimensions();
  const CARD_WIDTH = width * 0.55;
  const CARD_HEIGHT = CARD_WIDTH * 1.4;

  return (
    <TabSwitcher
      tabs={[
        {
          key: 'shows',
          content: (
            <View style={styles.carouselWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                contentOffset={{ x: isOwner ? CREATE_BUTTON_WIDTH : 0 , y: 0 }}
              >
                {isOwner && (
                  <CreateShowButton
                    onPress={onCreateShow}
                    height={CARD_HEIGHT}
                  />
                )}
                <ShowCarousel
                  shows={shows}
                  onSeePastShows={onSeePastShows}
                />
              </ScrollView>
            </View>
          ),
        },
        {
          key: 'tours',
          content: (
            <View style={styles.carouselWrapper}>
              {tours.length === 0 ? (
                <View style={styles.empty}>
                  <ThemedText style={styles.emptyText}>No tours yet.</ThemedText>
                </View>
              ) : (
                tours.map(tour => (
                  <View key={tour.id} style={styles.tourCard}>
                    <ThemedText style={styles.tourName}>{tour.name}</ThemedText>
                    <ThemedText style={styles.tourDates}>
                      {tour.startDate} — {tour.endDate}
                    </ThemedText>
                    <ThemedText style={styles.tourShowCount}>
                      {tour.shows.length} show{tour.shows.length !== 1 ? 's' : ''}
                    </ThemedText>
                  </View>
                ))
              )}
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

const styles = StyleSheet.create({
  carouselWrapper: {
    marginHorizontal: -32,
  },
  scrollContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    opacity: 0.4,
    fontSize: 13,
  },
  tourCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#888',
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 4,
  },
  tourName: {
    fontSize: 16,
    fontWeight: '700',
  },
  tourDates: {
    fontSize: 13,
    opacity: 0.6,
  },
  tourShowCount: {
    fontSize: 12,
    opacity: 0.4,
  },
});