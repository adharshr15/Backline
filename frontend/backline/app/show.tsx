import { useState, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/context/AuthContext';
import { Show, getShowById, rsvpShow, unrsvpShow, repostShow, unrepostShow } from '@/services/show.service';
import { ShowMedia, getShowMedia } from '@/services/media.service';
import ShowMediaGallery, { pickAndUploadShowMedia, VideoTileThumb } from '@/components/show-media-gallery';
import { BASE_URL } from '@/services/api';

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

export default function ShowDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, activeProfile } = useAuth();
  const { height } = useWindowDimensions();
  const borderColor = useThemeColor({}, 'text');
  const bg = useThemeColor({}, 'background');
  const subtleBg = useThemeColor({ light: '#f4f4f4', dark: '#1e1e1e' }, 'background');

  const [show, setShow] = useState<Show | null>(null);
  const [loading, setLoading] = useState(true);
  const [media, setMedia] = useState<ShowMedia[]>([]);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState<number | undefined>(undefined);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const activeProfileType = (
    activeProfile?.accountType === 'BAND' ? 'band' :
    activeProfile?.accountType === 'VENUE' ? 'venue' : 'user'
  ) as 'user' | 'band' | 'venue';

  const loadMedia = useCallback(() => {
    if (!id) return;
    getShowMedia(id).then(setMedia).catch(() => setMedia([]));
  }, [id]);

  const load = useCallback(() => {
    if (!id) return;
    getShowById(id)
      .then(setShow)
      .catch(() => setShow(null))
      .finally(() => setLoading(false));
    loadMedia();
  }, [id, loadMedia]);

  useFocusEffect(load);

  const handleAddMedia = async () => {
    try {
      setUploadingMedia(true);
      const added = await pickAndUploadShowMedia(id, activeProfile);
      if (added) loadMedia();
    } catch {
      // silently ignore; gallery handles its own errors
    } finally {
      setUploadingMedia(false);
    }
  };

  const openGallery = (index?: number) => {
    setGalleryIndex(index);
    setGalleryVisible(true);
  };

  const handleRsvp = async () => {
    if (!show || !activeProfile) return;
    const bandId = activeProfileType === 'band' ? activeProfile.id : undefined;
    const venueId = activeProfileType === 'venue' ? activeProfile.id : undefined;
    const hasRsvp =
      activeProfileType === 'band'
        ? show.rsvpBands?.some(b => b.id === activeProfile.id)
        : activeProfileType === 'venue'
        ? show.rsvpVenues?.some(v => v.id === activeProfile.id)
        : show.rsvpUsers?.some(u => u.id === activeProfile.id);
    try {
      if (hasRsvp) await unrsvpShow(show.id, activeProfileType, bandId, venueId);
      else await rsvpShow(show.id, activeProfileType, bandId, venueId);
      const fresh = await getShowById(show.id);
      setShow(fresh);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRepost = async () => {
    if (!show || !activeProfile) return;
    const bandId = activeProfileType === 'band' ? activeProfile.id : undefined;
    const venueId = activeProfileType === 'venue' ? activeProfile.id : undefined;
    const hasReposted =
      activeProfileType === 'band'
        ? show.repostedByBands?.some(b => b.id === activeProfile.id)
        : activeProfileType === 'venue'
        ? show.repostedByVenues?.some(v => v.id === activeProfile.id)
        : show.repostedByUsers?.some(u => u.id === activeProfile.id);
    try {
      if (hasReposted) await unrepostShow(show.id, activeProfileType, bandId, venueId);
      else await repostShow(show.id, activeProfileType, bandId, venueId);
      const fresh = await getShowById(show.id);
      setShow(fresh);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
        <ActivityIndicator style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  if (!show) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={borderColor} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Show Details</ThemedText>
          <View style={styles.headerSpacer} />
        </View>
        <ThemedText style={styles.notFound}>Show not found</ThemedText>
      </SafeAreaView>
    );
  }

  const posterUri = show.posterUrl ? `${BASE_URL}${show.posterUrl}` : null;
  const venueName = show.venue?.name ?? show.venueName ?? 'TBA';
  const venueAddress = show.venue?.address;
  const lineup = [
    show.bands.map(b => b.band.name).join(' · '),
    show.bandLineup,
  ].filter(Boolean).join(' · ');

  const hasRsvp = activeProfile
    ? activeProfileType === 'band'
      ? show.rsvpBands?.some(b => b.id === activeProfile.id)
      : activeProfileType === 'venue'
      ? show.rsvpVenues?.some(v => v.id === activeProfile.id)
      : show.rsvpUsers?.some(u => u.id === activeProfile.id)
    : false;

  const hasReposted = activeProfile
    ? activeProfileType === 'band'
      ? show.repostedByBands?.some(b => b.id === activeProfile.id)
      : activeProfileType === 'venue'
      ? show.repostedByVenues?.some(v => v.id === activeProfile.id)
      : show.repostedByUsers?.some(u => u.id === activeProfile.id)
    : false;

  const isCreator = activeProfile
    ? activeProfileType === 'band'  ? show.createdByBandId === activeProfile.id
    : activeProfileType === 'venue' ? show.createdByVenueId === activeProfile.id
    : show.createdByUserId === activeProfile.id
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
  const showFooter = !!activeProfile;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={borderColor} />
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

        {/* Media */}
        <View style={[styles.divider, { backgroundColor: borderColor }]} />
        <View style={styles.section}>
          <View style={styles.mediaHeaderRow}>
            <ThemedText style={styles.label}>MEDIA</ThemedText>
            <TouchableOpacity
              style={[styles.addMediaBtn, { borderColor }]}
              onPress={handleAddMedia}
              disabled={uploadingMedia}
              activeOpacity={0.7}
            >
              {uploadingMedia ? (
                <ActivityIndicator size="small" color={borderColor} />
              ) : (
                <>
                  <Ionicons name="add" size={14} color={borderColor} />
                  <ThemedText style={styles.addMediaText}>Add</ThemedText>
                </>
              )}
            </TouchableOpacity>
          </View>

          {media.length === 0 ? (
            <TouchableOpacity
              style={[styles.mediaEmpty, { borderColor }]}
              onPress={handleAddMedia}
              activeOpacity={0.7}
            >
              <Ionicons name="images-outline" size={22} color={borderColor} style={{ opacity: 0.5 }} />
              <ThemedText style={styles.mediaEmptyText}>Add photos or videos from this show</ThemedText>
            </TouchableOpacity>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mediaStrip}
            >
              {media.slice(0, 6).map((m, i) => (
                <TouchableOpacity key={m.id} onPress={() => openGallery(i)} activeOpacity={0.8}>
                  <View style={styles.mediaThumbWrap}>
                    {m.type === 'VIDEO' ? (
                      <VideoTileThumb uri={`${BASE_URL}${m.url}`} style={styles.mediaThumb} />
                    ) : (
                      <Image
                        source={{ uri: `${BASE_URL}${m.url}` }}
                        style={styles.mediaThumb}
                        contentFit="cover"
                      />
                    )}
                    {m.type === 'VIDEO' && (
                      <View style={styles.mediaThumbPlay}>
                        <Ionicons name="play-circle" size={22} color="#fff" />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
              {media.length > 6 && (
                <TouchableOpacity
                  style={[styles.mediaSeeAll, { borderColor }]}
                  onPress={() => openGallery()}
                  activeOpacity={0.7}
                >
                  <ThemedText style={styles.mediaSeeAllText}>See all{'\n'}({media.length})</ThemedText>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* Fixed action footer */}
      {showFooter && (
        <View style={[styles.footer, { borderTopColor: borderColor, backgroundColor: bg }]}>
          <TouchableOpacity
            style={[styles.footerBtn, { borderColor }, hasRsvp && styles.footerBtnActive]}
            onPress={handleRsvp}
            activeOpacity={0.7}
          >
            <ThemedText style={[styles.footerBtnText, hasRsvp && styles.footerBtnTextActive]}>
              {hasRsvp ? '🎟 Going' : '🎟 RSVP'}
            </ThemedText>
          </TouchableOpacity>
          {!isCreator && (
            <TouchableOpacity
              style={[styles.footerBtn, { borderColor }, hasReposted && styles.footerBtnActive]}
              onPress={handleRepost}
              activeOpacity={0.7}
            >
              <ThemedText style={[styles.footerBtnText, hasReposted && styles.footerBtnTextActive]}>
                {hasReposted ? '↩ Reposted' : '↩ Repost'}
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>
      )}

      <ShowMediaGallery
        showId={id}
        show={show}
        visible={galleryVisible}
        onClose={() => setGalleryVisible(false)}
        media={media}
        onChanged={loadMedia}
        user={user}
        activeProfile={activeProfile}
        initialIndex={galleryIndex}
      />
    </SafeAreaView>
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
  notFound: {
    textAlign: 'center',
    marginTop: 40,
    opacity: 0.5,
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
  mediaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  addMediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 56,
    justifyContent: 'center',
  },
  addMediaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  mediaEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 18,
  },
  mediaEmptyText: {
    fontSize: 13,
    opacity: 0.55,
  },
  mediaStrip: {
    gap: 8,
    paddingRight: 4,
  },
  mediaThumbWrap: {
    width: 76,
    height: 76,
    borderRadius: 8,
    overflow: 'hidden',
  },
  mediaThumb: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1e1e1e',
  },
  mediaThumbPlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaSeeAll: {
    width: 76,
    height: 76,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaSeeAllText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
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
  footerBtnText: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.7,
  },
  footerBtnTextActive: {
    color: '#4CAF50',
    opacity: 1,
  },
});
