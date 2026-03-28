import { useRef, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

export type Show = {
  id: string;
  poster: any;
  venue: string;
  city: string;
  state: string;
  date: string;
  doors: string;
  ticketUrl?: string;
};

type ShowCardProps = {
  show: Show;
  cardWidth: number;
};

function ShowCard({ show, cardWidth }: ShowCardProps) {
  const flipAnim = useRef(new Animated.Value(0)).current;
  const [flipped, setFlipped] = useState(false);
  const borderColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');

  const flip = () => {
    Animated.spring(flipAnim, {
      toValue: flipped ? 0 : 1,
      useNativeDriver: true,
      friction: 8,
    }).start();
    setFlipped(f => !f);
  };

  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const frontOpacity = flipAnim.interpolate({
    inputRange: [0.4, 0.5],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const backOpacity = flipAnim.interpolate({
    inputRange: [0.4, 0.5],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const backBackgroundColor = useThemeColor(
  { light: '#f0f0f0', dark: '#292929' },
  'background'
);

  const CARD_HEIGHT = cardWidth * 1.35;

  return (
    <TouchableOpacity onPress={flip} activeOpacity={1} style={{ width: cardWidth, height: CARD_HEIGHT }}>
      {/* Front */}
      <Animated.View
        style={[
          styles.card,
          {
            width: cardWidth,
            height: CARD_HEIGHT,
            transform: [{ perspective: 1000 }, { rotateY: frontRotate }],
            opacity: frontOpacity,
            position: 'absolute',
            borderColor,
          },
        ]}
      >
        <Image
          source={show.poster}
          style={{ width: '100%', height: '100%', borderRadius: 0 }}
          contentFit="cover"
        />
      </Animated.View>

      {/* Back */}
      <Animated.View
        style={[
          styles.card,
          styles.cardBack,
          {
            width: cardWidth,
            height: CARD_HEIGHT,
            transform: [{ perspective: 1000 }, { rotateY: backRotate }],
            opacity: backOpacity,
            position: 'absolute',
            backgroundColor: backBackgroundColor,
            borderColor,
          },
        ]}
      >
        <ThemedText style={styles.backVenue}>{show.venue}</ThemedText>
        <ThemedText style={styles.backCity}>{show.city}, {show.state}</ThemedText>
        <View style={styles.divider} />
        <ThemedText style={styles.backLabel}>Date</ThemedText>
        <ThemedText style={styles.backValue}>{show.date}</ThemedText>
        <ThemedText style={styles.backLabel}>Doors</ThemedText>
        <ThemedText style={styles.backValue}>{show.doors}</ThemedText>
        {show.ticketUrl && (
          <TouchableOpacity style={styles.ticketButton}>
            <ThemedText style={styles.ticketText}>Get Tickets</ThemedText>
          </TouchableOpacity>
        )}
        <ThemedText style={styles.tapHint}>tap to flip back</ThemedText>
      </Animated.View>
    </TouchableOpacity>
  );
}

type Props = {
  shows: Show[];
  onSeePastShows: () => void;
};

export function ShowCarousel({ shows, onSeePastShows }: Props) {
  const { width } = useWindowDimensions();
  const CARD_WIDTH = width * 0.85;
  const borderColor = useThemeColor({}, 'text');

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {shows.map(show => (
        <ShowCard key={show.id} show={show} cardWidth={CARD_WIDTH} />
      ))}

      <TouchableOpacity
        onPress={onSeePastShows}
        style={[styles.pastShowsButton, { borderColor, width: CARD_WIDTH * 0.7, height: CARD_WIDTH * 0.7 * 1.4 }]}
      >
        <ThemedText style={styles.pastShowsText}>See Past{'\n'}Shows</ThemedText>
        <ThemedText style={styles.pastShowsArrow}>→</ThemedText>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 18,
    gap: 12,
    alignItems: 'center',
  },
  card: {
    borderRadius: 0,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  cardBack: {
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    gap: 4,
  },
  backVenue: {
    fontSize: 16,
    fontWeight: '700',
  },
  backCity: {
    fontSize: 13,
    opacity: 0.6,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#888',
    marginVertical: 8,
  },
  backLabel: {
    fontSize: 10,
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 6,
  },
  backValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  ticketButton: {
    marginTop: 16,
    backgroundColor: '#4A90D9',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  ticketText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  tapHint: {
    fontSize: 10,
    opacity: 0.3,
    textAlign: 'center',
    marginTop: 'auto',
  },
  pastShowsButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    opacity: 0.5,
  },
  pastShowsText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  pastShowsArrow: {
    fontSize: 20,
  },
});