import {
  Modal,
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Show } from '@/services/show.service';
import { BASE_URL } from '@/services/api';

interface Props {
  show: Show | null;
  visible: boolean;
  onClose: () => void;
  onRsvp?: (show: Show) => void;
  onRepost?: (show: Show) => void;
  activeProfileId?: string;
  activeProfileType?: 'user' | 'band' | 'venue';
}

function formatShowDate(isoString: string) {
  return new Date(isoString).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDoors(doorsString: string) {
  if (!doorsString) return '';
  if (doorsString.includes('T')) {
    return new Date(doorsString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
  return doorsString;
}

export default function ShowDetailModal({
  show,
  visible,
  onClose,
  onRsvp,
  onRepost,
  activeProfileId,
  activeProfileType,
}: Props) {
  const { height } = useWindowDimensions();
  const borderColor = useThemeColor({}, 'text');
  const bg = useThemeColor({}, 'background');
  const subtleBg = useThemeColor({ light: '#f4f4f4', dark: '#1e1e1e' }, 'background');
  const mutedColor = useThemeColor({ light: '#888', dark: '#666' }, 'text');

  if (!show) return null;

  const posterUri = show.posterUrl ? `${BASE_URL}${show.posterUrl}` : null;
  const venueName = show.venue?.name ?? show.venueName ?? 'TBA';
  const venueAddress = show.venue?.address;
  const lineup = [
    show.bands.map(b => b.band.name).join(' · '),
    show.bandLineup,
  ].filter(Boolean).join(' · ');

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

  const openMaps = () => {
    const query = venueAddress
      ? `${venueName}, ${venueAddress}, ${show.city}, ${show.state}`
      : `${venueName}, ${show.city}, ${show.state}`;
    const encoded = encodeURIComponent(query);
    const url = Platform.select({
      ios: `maps://?q=${encoded}`,
      android: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
      default: `https://maps.google.com/?q=${encoded}`,
    });
    if (url) Linking.openURL(url);
  };

  const POSTER_HEIGHT = height * 0.42;
  const showFooter = onRsvp || onRepost;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={20} color={borderColor} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Show Details</ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, showFooter && { paddingBottom: 80 }]}
        >
          {/* Poster */}
          <View style={[styles.posterContainer, { height: POSTER_HEIGHT, backgroundColor: subtleBg }]}>
            <Image
              source={
                posterUri
                  ? { uri: posterUri }
                  : require('@/assets/images/default/headerImage.png')
              }
              style={styles.poster}
              contentFit={posterUri ? 'contain' : 'cover'}
            />
          </View>

          {/* Venue + City */}
          <View style={styles.section}>
            <ThemedText style={styles.venueName}>{venueName}</ThemedText>
            <ThemedText style={styles.location}>
              {show.city}, {show.state}
              {show.country ? `, ${show.country}` : ''}
            </ThemedText>
          </View>

          <View style={[styles.divider, { backgroundColor: borderColor }]} />

          {/* Date + Doors */}
          <View style={styles.section}>
            <View style={styles.infoRow}>
              <View style={styles.infoBlock}>
                <ThemedText style={styles.label}>DATE</ThemedText>
                <ThemedText style={styles.value}>{formatShowDate(show.date)}</ThemedText>
              </View>
              <View style={[styles.infoBlock, styles.infoBlockRight]}>
                <ThemedText style={[styles.label, styles.labelRight]}>DOORS</ThemedText>
                <ThemedText style={[styles.value, styles.valueRight]}>
                  {formatDoors(show.doors) || 'TBA'}
                </ThemedText>
              </View>
            </View>
          </View>

          {lineup ? (
            <>
              <View style={[styles.divider, { backgroundColor: borderColor }]} />
              <View style={styles.section}>
                <ThemedText style={styles.label}>LINEUP</ThemedText>
                <ThemedText style={styles.lineupText}>{lineup}</ThemedText>
              </View>
            </>
          ) : null}

          <View style={[styles.divider, { backgroundColor: borderColor }]} />

          {/* Where / Maps */}
          <View style={styles.section}>
            <ThemedText style={styles.label}>WHERE</ThemedText>
            <ThemedText style={styles.value}>{venueName}</ThemedText>
            {venueAddress ? (
              <ThemedText style={styles.addressText}>{venueAddress}</ThemedText>
            ) : null}
            <ThemedText style={styles.addressText}>
              {show.city}, {show.state}
            </ThemedText>
            <TouchableOpacity
              style={[styles.mapsBtn, { borderColor }]}
              onPress={openMaps}
              activeOpacity={0.7}
            >
              <Ionicons name="navigate-outline" size={13} color={borderColor} />
              <ThemedText style={styles.mapsBtnText}>Get Directions</ThemedText>
            </TouchableOpacity>
          </View>

          {show.ticketsUrl ? (
            <>
              <View style={[styles.divider, { backgroundColor: borderColor }]} />
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.ticketsBtn}
                  onPress={() => Linking.openURL(show.ticketsUrl!)}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.ticketsBtnText}>Get Tickets</ThemedText>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {show.notes ? (
            <>
              <View style={[styles.divider, { backgroundColor: borderColor }]} />
              <View style={styles.section}>
                <ThemedText style={styles.label}>NOTES</ThemedText>
                <ThemedText style={styles.notesText}>{show.notes}</ThemedText>
              </View>
            </>
          ) : null}
        </ScrollView>

        {/* Fixed action footer */}
        {showFooter && (
          <View style={[styles.footer, { borderTopColor: borderColor, backgroundColor: bg }]}>
            {onRsvp && (
              <TouchableOpacity
                style={[styles.footerBtn, { borderColor }, hasRsvp && styles.footerBtnActive]}
                onPress={() => onRsvp(show)}
                activeOpacity={0.7}
              >
                <ThemedText style={[styles.footerBtnText, hasRsvp && styles.footerBtnTextActive]}>
                  {hasRsvp ? '🎟 Going' : '🎟 RSVP'}
                </ThemedText>
              </TouchableOpacity>
            )}
            {onRepost && (
              <TouchableOpacity
                style={[styles.footerBtn, { borderColor }, hasReposted && styles.footerBtnRepostActive]}
                onPress={() => onRepost(show)}
                activeOpacity={0.7}
              >
                <ThemedText style={[styles.footerBtnText, hasReposted && styles.footerBtnTextRepostActive]}>
                  {hasReposted ? '↩ Reposted' : '↩ Repost'}
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    opacity: 0.6,
    textTransform: 'uppercase',
  },
  headerSpacer: {
    width: 32,
  },
  scroll: {
    paddingBottom: 32,
  },
  posterContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    opacity: 0.25,
    marginHorizontal: 20,
  },
  venueName: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  location: {
    fontSize: 14,
    opacity: 0.5,
    marginTop: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    opacity: 0.4,
    marginBottom: 2,
  },
  labelRight: {
    textAlign: 'right',
  },
  value: {
    fontSize: 15,
    fontWeight: '500',
  },
  valueRight: {
    textAlign: 'right',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoBlock: {
    flex: 1,
    gap: 2,
  },
  infoBlockRight: {
    alignItems: 'flex-end',
  },
  lineupText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  addressText: {
    fontSize: 13,
    opacity: 0.55,
  },
  mapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  mapsBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  ticketsBtn: {
    backgroundColor: '#4A90D9',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ticketsBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  notesText: {
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  footerBtnActive: {
    backgroundColor: 'rgba(76,175,80,0.12)',
    borderColor: '#4CAF50',
  },
  footerBtnRepostActive: {
    backgroundColor: 'rgba(76,175,80,0.12)',
    borderColor: '#4CAF50',
  },
  footerBtnText: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.7,
  },
  footerBtnTextActive: {
    color: '#4CAF50',
    opacity: 1,
  },
  footerBtnTextRepostActive: {
    color: '#4CAF50',
    opacity: 1,
  },
});
