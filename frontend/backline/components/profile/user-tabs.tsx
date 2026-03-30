import { View, StyleSheet } from 'react-native';
import { TabSwitcher } from '@/components/ui/tab-switcher';
import { ShowCarousel, type Show } from '@/components/show-carousel';
import { ThemedText } from '@/components/themed-text';

type Props = {
  repostedShows: Show[];
  onSeePastShows: () => void;
};

export function UserTabs({ repostedShows, onSeePastShows }: Props) {
  return (
    <View style={styles.carouselWrapper}>
        {repostedShows.length === 0 ? (
        <View style={styles.empty}>
            <ThemedText style={styles.emptyText}>No reposted shows yet.</ThemedText>
        </View>
        ) : (
        <ShowCarousel
            shows={repostedShows}
            onSeePastShows={onSeePastShows}
        />
        )}
    </View>
          
  );
}

const styles = StyleSheet.create({
  carouselWrapper: {
    marginHorizontal: -32,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    opacity: 0.4,
    fontSize: 13,
  },
});