import { useState, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Linking,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/context/AuthContext';
import { BASE_URL } from '@/services/api';
import {
  Listing,
  getListingById,
  getListingOwner,
  formatListingPrice,
  setListingStatus,
  addListingMedia,
} from '@/services/listing.service';
import CreateListingModal from '@/components/profile/create-listing-modal';
import { getMyConversations, getParticipantProfile, ParticipantType } from '@/services/conversation.service';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { activeProfile } = useAuth();
  const { height, width } = useWindowDimensions();
  const borderColor = useThemeColor({}, 'text');
  const bg = useThemeColor({}, 'background');
  const subtleBg = useThemeColor({ light: '#f4f4f4', dark: '#1e1e1e' }, 'background');

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [editVisible, setEditVisible] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);

  const load = useCallback(() => {
    if (!id) return;
    getListingById(id)
      .then(setListing)
      .catch(() => setListing(null))
      .finally(() => setLoading(false));
  }, [id]);

  useFocusEffect(load);

  const activeProfileType = (
    activeProfile?.accountType === 'BAND' ? 'band' :
    activeProfile?.accountType === 'VENUE' ? 'venue' : 'user'
  ) as 'user' | 'band' | 'venue';

  const isOwner = !!activeProfile && !!listing && (
    listing.createdByUserId === activeProfile.id ||
    listing.createdByBandId === activeProfile.id ||
    listing.createdByVenueId === activeProfile.id
  );

  const handleMessage = async () => {
    if (!activeProfile || !listing) return;
    const ownerInfo = getListingOwner(listing);
    if (!ownerInfo) return;
    const senderType = activeProfileType.toUpperCase() as ParticipantType;
    const recipientType = ownerInfo.type.toUpperCase() as ParticipantType;
    try {
      const convs = await getMyConversations(senderType, activeProfile.id);
      const existing = convs.find(c =>
        c.participants.some(p => getParticipantProfile(p)?.id === ownerInfo.owner.id)
      );
      if (existing) {
        router.push(`/messages/${existing.id}`);
      } else {
        router.push({
          pathname: '/messages/compose',
          params: { recipientType, recipientId: ownerInfo.owner.id, recipientName: ownerInfo.owner.name },
        });
      }
    } catch (e) { console.error(e); }
  };

  const handleAddPhoto = async () => {
    if (!id) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.85,
    });
    if (result.canceled || !result.assets.length) return;
    try {
      setUploadingMedia(true);
      for (const asset of result.assets) {
        const filename = asset.uri.split('/').pop() ?? 'photo.jpg';
        const ext = filename.split('.').pop() ?? 'jpg';
        await addListingMedia(id, { uri: asset.uri, name: filename, type: `image/${ext}` });
      }
      load();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to add photo');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!listing) return;
    const next = listing.status === 'ACTIVE' ? 'CLOSED' : 'ACTIVE';
    try {
      const updated = await setListingStatus(listing.id, next);
      setListing({ ...listing, status: updated.status });
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to update status');
    }
  };

  const openOwnerProfile = () => {
    if (!listing) return;
    const ownerInfo = getListingOwner(listing);
    if (!ownerInfo) return;
    const base =
      ownerInfo.type === 'band' ? '/explore/view-band' :
      ownerInfo.type === 'venue' ? '/explore/view-venue' : '/explore/view-user';
    router.push(`${base}/${ownerInfo.owner.id}` as any);
  };

  const openScene = () => {
    if (listing?.city && listing?.state) {
      router.push({ pathname: '/profile/scene', params: { city: listing.city, state: listing.state } } as any);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
        <ActivityIndicator style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  if (!listing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={borderColor} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Listing</ThemedText>
          <View style={styles.headerSpacer} />
        </View>
        <ThemedText style={styles.notFound}>Listing not found</ThemedText>
      </SafeAreaView>
    );
  }

  const ownerInfo = getListingOwner(listing);
  const coverUri = listing.coverUrl ? `${BASE_URL}${listing.coverUrl}` : null;
  const gallery = listing.media ?? [];
  const photos = [
    ...(coverUri ? [coverUri] : []),
    ...gallery.map(m => `${BASE_URL}${m.url}`),
  ];
  const COVER_HEIGHT = height * 0.4;
  const showFooter = !!activeProfile;

  const onCarouselScroll = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    setActivePhoto(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={borderColor} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Listing</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, showFooter && { paddingBottom: 80 }]}>
        {/* Photo carousel */}
        <View style={[styles.coverContainer, { height: COVER_HEIGHT, backgroundColor: subtleBg }]}>
          {photos.length === 0 ? (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="musical-notes-outline" size={40} color="#888" />
            </View>
          ) : (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onCarouselScroll}
            >
              {photos.map((uri, i) => (
                <Image key={i} source={{ uri }} style={{ width, height: COVER_HEIGHT }} contentFit="cover" />
              ))}
            </ScrollView>
          )}
          {listing.status !== 'ACTIVE' && (
            <View style={styles.statusOverlay}>
              <ThemedText style={styles.statusOverlayText}>{listing.status}</ThemedText>
            </View>
          )}
          {photos.length > 1 && (
            <View style={styles.dots}>
              {photos.map((_, i) => (
                <View key={i} style={[styles.dot, i === activePhoto && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>

        {/* Title + terms */}
        <View style={styles.section}>
          <ThemedText style={styles.title}>{listing.title}</ThemedText>
          <View style={styles.termsRow}>
            <ThemedText style={styles.price}>{formatListingPrice(listing)}</ThemedText>
            <View style={styles.kindChip}>
              <ThemedText style={styles.kindChipText}>{listing.kind === 'RENT' ? 'BORROW / RENT' : 'FOR SALE'}</ThemedText>
            </View>
            {listing.openToTrades && (
              <View style={[styles.kindChip, styles.tradeChip]}>
                <ThemedText style={styles.kindChipText}>OPEN TO TRADES</ThemedText>
              </View>
            )}
          </View>
        </View>

        {listing.category ? (
          <>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
            <View style={styles.section}>
              <ThemedText style={styles.label}>CATEGORY</ThemedText>
              <ThemedText style={styles.value}>{listing.category}</ThemedText>
            </View>
          </>
        ) : null}

        <View style={[styles.divider, { backgroundColor: borderColor }]} />
        {/* Location */}
        <View style={styles.section}>
          <ThemedText style={styles.label}>LOCATION</ThemedText>
          <TouchableOpacity onPress={openScene} disabled={!listing.state} activeOpacity={0.6}>
            <ThemedText style={styles.value}>
              {[listing.city, listing.state, listing.country].filter(Boolean).join(', ')}
            </ThemedText>
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: borderColor }]} />
        {/* Description */}
        <View style={styles.section}>
          <ThemedText style={styles.label}>DETAILS</ThemedText>
          <ThemedText style={styles.description}>{listing.description}</ThemedText>
        </View>

        {/* Owner */}
        {ownerInfo && (
          <>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
            <View style={styles.section}>
              <ThemedText style={styles.label}>LISTED BY</ThemedText>
              <TouchableOpacity style={styles.ownerRow} onPress={openOwnerProfile} activeOpacity={0.7}>
                <Image
                  source={ownerInfo.owner.profileImageUrl
                    ? { uri: `${BASE_URL}${ownerInfo.owner.profileImageUrl}` }
                    : require('@/assets/images/default/profileImage.png')}
                  style={styles.ownerAvatar}
                />
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.ownerName}>{ownerInfo.owner.name}</ThemedText>
                  <ThemedText style={styles.ownerType}>{ownerInfo.type.toUpperCase()}</ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={borderColor} style={{ opacity: 0.4 }} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Owner: add photos */}
        {isOwner && (
          <>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
            <View style={styles.section}>
              <View style={styles.mediaHeaderRow}>
                <ThemedText style={styles.label}>PHOTOS</ThemedText>
                <TouchableOpacity
                  style={[styles.addMediaBtn, { borderColor }]}
                  onPress={handleAddPhoto}
                  disabled={uploadingMedia}
                  activeOpacity={0.7}
                >
                  {uploadingMedia
                    ? <ActivityIndicator size="small" color={borderColor} />
                    : <><Ionicons name="add" size={14} color={borderColor} /><ThemedText style={styles.addMediaText}>Add</ThemedText></>}
                </TouchableOpacity>
              </View>
              <ThemedText style={styles.mediaEmptyText}>
                {photos.length === 0
                  ? 'Add photos so people can see the gear.'
                  : `${photos.length} photo${photos.length === 1 ? '' : 's'} — swipe the gallery above to preview. Edit to remove.`}
              </ThemedText>
            </View>
          </>
        )}
      </ScrollView>

      {/* Footer */}
      {showFooter && (
        <View style={[styles.footer, { borderTopColor: borderColor, backgroundColor: bg }]}>
          {isOwner ? (
            <>
              <TouchableOpacity style={[styles.footerBtn, { borderColor }]} onPress={() => setEditVisible(true)} activeOpacity={0.7}>
                <ThemedText style={styles.footerBtnText}>Edit</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.footerBtn, { borderColor }]} onPress={handleToggleStatus} activeOpacity={0.7}>
                <ThemedText style={styles.footerBtnText}>{listing.status === 'ACTIVE' ? 'Mark Closed' : 'Reactivate'}</ThemedText>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.messageBtn} onPress={handleMessage} activeOpacity={0.8}>
              <Ionicons name="chatbubble-outline" size={16} color="#fff" />
              <ThemedText style={styles.messageBtnText}>Message Lister</ThemedText>
            </TouchableOpacity>
          )}
        </View>
      )}

      {isOwner && (
        <CreateListingModal
          visible={editVisible}
          onClose={() => setEditVisible(false)}
          creatorUserId={listing.createdByUserId ?? undefined}
          creatorBandId={listing.createdByBandId ?? undefined}
          creatorVenueId={listing.createdByVenueId ?? undefined}
          editingListing={listing}
          onSaved={() => { setEditVisible(false); load(); }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5, opacity: 0.6, textTransform: 'uppercase' },
  headerSpacer: { width: 32 },
  notFound: { textAlign: 'center', marginTop: 40, opacity: 0.5 },
  scroll: { paddingBottom: 32 },
  coverContainer: { width: '100%', overflow: 'hidden' },
  cover: { width: '100%', height: '100%' },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statusOverlay: {
    position: 'absolute', top: 12, left: 12,
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4,
  },
  statusOverlayText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  dots: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  section: { paddingHorizontal: 20, paddingVertical: 16, gap: 4 },
  divider: { height: StyleSheet.hairlineWidth, opacity: 0.25, marginHorizontal: 20 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  termsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  price: { fontSize: 18, fontWeight: '700', color: '#4A90D9' },
  kindChip: { backgroundColor: '#2a2a2a', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  tradeChip: { backgroundColor: '#282828' },
  kindChipText: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', opacity: 0.4, marginBottom: 2 },
  value: { fontSize: 15, fontWeight: '500' },
  description: { fontSize: 14, opacity: 0.75, lineHeight: 21 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  ownerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2a2a2a' },
  ownerName: { fontSize: 15, fontWeight: '600' },
  ownerType: { fontSize: 11, opacity: 0.4, letterSpacing: 0.5, marginTop: 1 },
  mediaHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  addMediaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5, minWidth: 56, justifyContent: 'center',
  },
  addMediaText: { fontSize: 12, fontWeight: '600' },
  mediaEmptyText: { fontSize: 13, opacity: 0.5 },
  mediaStrip: { gap: 8, paddingRight: 4 },
  mediaThumb: { width: 100, height: 100, borderRadius: 8, backgroundColor: '#1e1e1e' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 20, paddingVertical: 12, paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', backgroundColor: 'transparent',
  },
  footerBtnText: { fontSize: 13, fontWeight: '600', opacity: 0.8 },
  messageBtn: {
    flex: 1, flexDirection: 'row', gap: 8,
    paddingVertical: 13, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#4A90D9',
  },
  messageBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
