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
import { useThemeColor } from '@/hooks/use-theme-color';
import { Show } from '@/services/show.service';
import { BASE_URL } from '@/services/api';



type ShowCardProps = {
  show: Show;
  cardWidth: number;
  isOwner: boolean;
  onEdit: (show: Show) => void;
  activeProfileId?: string;
  activeProfileType?: 'user' | 'band' | 'venue';
  onRepost?: (show: Show) => void;
  onRsvp?: (show: Show) => void;
};

function ShowCard({ show, cardWidth, isOwner, onEdit, activeProfileId, activeProfileType, onRepost, onRsvp }: ShowCardProps) {
  const flipAnim = useRef(new Animated.Value(0)).current;
  const [flipped, setFlipped] = useState(false);
  const borderColor = useThemeColor({}, 'text');

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

  const hasRsvp = activeProfileId
    ? activeProfileType === 'band'
      ? show.rsvpBands?.some(b => b.id === activeProfileId)
      : activeProfileType === 'venue'
      ? show.rsvpVenues?.some(v => v.id === activeProfileId)
      : show.rsvpUsers?.some(u => u.id === activeProfileId)
    : false;

  const hasReposted = activeProfileId
    ? activeProfileType === 'band'
      ? show.repostedByBands?.some(b => b.id === activeProfileId)
      : activeProfileType === 'venue'
      ? show.repostedByVenues?.some(v => v.id === activeProfileId)
      : show.repostedByUsers?.some(u => u.id === activeProfileId)
    : false;

  const isRepostBadge = activeProfileId
    ? activeProfileType === 'band'
      ? show.repostedByBands?.some(b => b.id === activeProfileId) &&
        show.createdByBandId !== activeProfileId &&
        !show.bands?.some(b => b.bandId === activeProfileId)
      : activeProfileType === 'venue'
      ? show.repostedByVenues?.some(v => v.id === activeProfileId) &&
        show.createdByVenueId !== activeProfileId
      : show.repostedByUsers?.some(u => u.id === activeProfileId) &&
        show.createdByUserId !== activeProfileId
    : false;

  return (
    <View>
      {isRepostBadge && (
        <ThemedText style={styles.repostBadge}>↩ REPOST</ThemedText>
      )}
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
            source={show.posterUrl ? { uri: `${BASE_URL}${show.posterUrl}` } : require('@/assets/images/default/headerImage.png')}
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
          <ThemedText style={styles.backVenue}>{show.venue?.name ?? 'TBA'}</ThemedText>
          <ThemedText style={styles.backCity}>{show.city}, {show.state}</ThemedText>
          <View style={styles.divider} />
          <ThemedText style={styles.backLabel}>Date</ThemedText>
          <ThemedText style={styles.backValue}>{new Date(show.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</ThemedText>
          <ThemedText style={styles.backLabel}>Doors</ThemedText>
          <ThemedText style={styles.backValue}>{show.doors?.includes('T') ? new Date(show.doors).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : show.doors}</ThemedText>
          {show.ticketsUrl && (
            <TouchableOpacity style={styles.ticketButton}>
              <ThemedText style={styles.ticketText}>Get Tickets</ThemedText>
            </TouchableOpacity>
          )}
          <View style={styles.backFooter}>
            <ThemedText style={styles.tapHint}>tap to flip back</ThemedText>
            <View style={styles.backActions}>
              {onRsvp && (
                <TouchableOpacity
                  style={[styles.repostButton, hasRsvp && styles.repostButtonActive]}
                  onPress={(e) => { e.stopPropagation(); onRsvp(show); }}
                >
                  <ThemedText style={[styles.repostButtonText, hasRsvp && styles.repostButtonTextActive]}>
                    {hasRsvp ? '🎟 Going' : '🎟 RSVP'}
                  </ThemedText>
                </TouchableOpacity>
              )}
              {onRepost && (
                <TouchableOpacity
                  style={[styles.repostButton, hasReposted && styles.repostButtonActive]}
                  onPress={(e) => { e.stopPropagation(); onRepost(show); }}
                >
                  <ThemedText style={[styles.repostButtonText, hasReposted && styles.repostButtonTextActive]}>
                    {hasReposted ? '↩ Reposted' : '↩ Repost'}
                  </ThemedText>
                </TouchableOpacity>
              )}
              {isOwner && (
                activeProfileType === 'band'  ? show.createdByBandId === activeProfileId :
                activeProfileType === 'venue' ? (show.createdByVenueId === activeProfileId || show.venue?.id === activeProfileId) :
                                                show.createdByUserId === activeProfileId
              ) && (
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={(e) => { e.stopPropagation(); onEdit(show); }}
                >
                  <ThemedText style={styles.editButtonText}>Edit</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

type Props = {
  shows: Show[];
  pastShows: Show[];
  showingPast: boolean;
  onSeePastShows: () => void;
  onCreateShow: () => void;
  onEditShow: (show: Show) => void;
  isOwner: boolean;
  activeProfileId?: string;
  activeProfileType?: 'user' | 'band' | 'venue';
  onRepost?: (show: Show) => void;
  onRsvp?: (show: Show) => void;
};

export function ShowCarousel({ shows, pastShows, showingPast, onSeePastShows, onCreateShow, onEditShow, isOwner, activeProfileId, activeProfileType, onRepost, onRsvp }: Props) {
  const { width } = useWindowDimensions();
  const CARD_WIDTH = width * 0.85;
  const borderColor = useThemeColor({}, 'text');
  const scrollViewRef = useRef<ScrollView>(null);

  return (
    <ScrollView
      ref={scrollViewRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      onContentSizeChange={() => {}}
    >
      {showingPast && pastShows.map(show => (
        <ShowCard
          key={`past-${show.id}`}
          show={show}
          cardWidth={CARD_WIDTH}
          isOwner={isOwner}
          onEdit={onEditShow}
          activeProfileId={activeProfileId}
          activeProfileType={activeProfileType}
          onRepost={onRepost}
          onRsvp={onRsvp}
        />
      ))}

      {shows.map(show => (
        <ShowCard
          key={show.id}
          show={show}
          cardWidth={CARD_WIDTH}
          isOwner={isOwner}
          onEdit={onEditShow}
          activeProfileId={activeProfileId}
          activeProfileType={activeProfileType}
          onRepost={onRepost}
          onRsvp={onRsvp}
        />
      ))}

      {!showingPast && pastShows.length > 0 && (
        <TouchableOpacity
          onPress={onSeePastShows}
          style={[styles.pastShowsButton, { borderColor, width: CARD_WIDTH * 0.7, height: CARD_WIDTH * 0.7 * 1.4 }]}
        >
          <ThemedText style={styles.pastShowsText}>See Past{'\n'}Shows</ThemedText>
          <ThemedText style={styles.pastShowsArrow}>→</ThemedText>
        </TouchableOpacity>
      )}
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
  backFooter: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tapHint: {
    fontSize: 10,
    opacity: 0.3,
  },
  backActions: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  repostButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  repostButtonActive: {
    backgroundColor: 'rgba(76,175,80,0.15)',
    borderColor: '#4CAF50',
  },
  repostButtonText: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.7,
  },
  repostButtonTextActive: {
    color: '#4CAF50',
    opacity: 1,
  },
  editButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  editButtonText: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.7,
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
  repostBadge: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    opacity: 0.5,
    marginBottom: 2,
    marginLeft: 2,
  },
});
