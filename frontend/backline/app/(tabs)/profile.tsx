import { Image } from 'expo-image';
import { View, Text, StyleSheet, useWindowDimensions, Modal, TouchableOpacity, SafeAreaViewBase } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useState, useEffect } from 'react';
import { useAuth, type ActiveProfile, type User, type Band, type Venue } from '@/context/AuthContext'
import { BASE_URL } from '@/services/api';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import ViewSwitcher from '@/components/ui/view-switcher';
import { ShowCarousel } from '@/components/show-carousel';
import { Show } from '@/services/show.service';
import { TabSwitcher } from '@/components/ui/tab-switcher';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getMyProfiles } from '@/services/profile.service';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '@/services/api';
import ProfileShowsSection from '@/components/profile/shows-poster-section';

export const AVATAR_SIZE = 80;
const BORDER_WIDTH = 3;

const mockShows: Show[] = [
  {
    id: 'asdfsa',
    posterUrl: '@/assets/images/example/poster2.png',
    venue: 'Notsua',
    city: 'Houston',
    state: 'TX',
    country: '',
    status: '',
    date: 'Apr 2, 2025',
    doors: '7:00 PM',
    bands: []
  }
];

const renderBioWithLinks = (text: string, setWebViewUrl: any) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.split(urlRegex).map((part, index) => {
    const isLink = part.match(urlRegex);

    if (isLink) {
      return (
        <ThemedText
          key={index}
          style={styles.linkText}
          onPress={() => setWebViewUrl(part)}
        >
          {part.replace(/^https?:\/\//, '')}
        </ThemedText>
      );
    }

    return (
      <ThemedText key={index} style={styles.bioText}>
        {part}
      </ThemedText>
    );
  });
};

type Tab = 'shows' | 'listings';

export default function ProfileScreen() {
  const { activeProfile } = useAuth();

  if (activeProfile?.accountType === 'BAND') return;
  if (activeProfile?.accountType === 'VENUE') return;
  return <UserProfile />;
}

export function UserProfile() {
  const router = useRouter();

  const { activeProfile, setActiveProfile, loading } = useAuth();
  if (!activeProfile || activeProfile.accountType !== 'USER') return null;
  const user = activeProfile;


  const { width } = useWindowDimensions();
  const sideWidth = (width - AVATAR_SIZE) / 2;

  const [webViewUrl, setWebViewUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('shows');
  const [switcherVisible, setSwitcherVisible] = useState(false);
  const [showView, setShowView] = useState<'poster' | 'list'>('poster');
  const borderColor = useThemeColor({}, 'text');

  const bands = user?.bandMemberships?.map(m => m.band).filter(Boolean) || [];
  const venues = user?.venueReps?.map(v => v.venue).filter(Boolean) || [];

  const hasListings = false // user.listings

  // Fetch all bands/venues user belongs to
  useEffect(() => {
    if (loading) return;

    const fetchProfiles = async () => {
      try {
        const response = await api.get('users/me/profiles');
        return response.data;
      } catch (error) {
        console.log('Error fetching bands and venues', error);
      }
    };

    fetchProfiles();
  }, [loading]);

  const profilePicture = user?.profileImageUrl
    ? { uri: `${BASE_URL}${user.profileImageUrl}` }
    : require("@/assets/images/default/profileImage.png")

  const headerImage = user?.headerImageUrl
    ? { uri: `${BASE_URL}${user.headerImageUrl}` }
    : require("@/assets/images/default/headerImage.png")


  const isValidUrl = (text: string) => {
    try {
      new URL(text);
      return true;
    } catch {
      return false;
    }
  }

  return (
    <>
      <ParallaxScrollView
        headerHeight={160}
        headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
        headerImage={
          <Image
            source={headerImage}
            style={{ width: '100%', height: 250 }}
          />
        }
      >

        <>
          {/* pfp straddles the top of the ThemedView */}
          <View style={styles.pfpContainer}>
            <TouchableOpacity onPress={() => setSwitcherVisible(true)}>
              <View style={[styles.pfpWrapper, { borderColor }]}>
                <Image
                  source={profilePicture}
                  style={{ width: '100%', height: '100%' }}
                />
              </View>
            </TouchableOpacity>
          </View>

          {/* meta row*/}
          <View style={styles.metaRow}>
            <ThemedText style={[styles.metaText, { width: sideWidth }]}>
              {user?.city && user?.state ? `${user?.city}, ${user?.state}` : ''}
            </ThemedText>
            <View style={{ width: AVATAR_SIZE }} />
            <ThemedText style={[styles.metaText, { width: sideWidth }]}>
              {user?.country ? `${user?.country}` : ''}
            </ThemedText>
          </View>

          {/* name */}
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.name, { maxWidth: width - 64 }]}
          >
            {activeProfile?.name}
          </Text>

          {/* bio */}
          {activeProfile?.bio ? (
            <View style={styles.bioRow}>
              {renderBioWithLinks(activeProfile.bio, setWebViewUrl)}
            </View>
          ) : null}

          {/* action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionButton} onPress={() => console.log('Calendar')}>
              <Ionicons name="calendar-outline" size={22} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => console.log('Share Profile')}>
              <Ionicons name="share-outline" size={22} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/settings')}>
              <Ionicons name="settings-outline" size={22} color="white" />
            </TouchableOpacity>
          </View>

          {/* tab content */}
          {hasListings ? (
            <TabSwitcher
              tabs={[
                {
                  key: 'shows',
                  content: (
                    <ProfileShowsSection
                      showView={showView}
                      setShowView={setShowView}
                      shows={mockShows}
                      isOwner={true}
                      onSeePastShows={() => console.log('see past shows')}
                      onCreateShow={() => console.log('create show')}
                    />
                  ),
                },
                {
                  key: 'listings',
                  content: (
                    <View style={{ alignItems: 'center' }}>
                      <ThemedText style={{ opacity: 0.4, fontSize: 13 }}>
                        No Listings yet.
                      </ThemedText>
                    </View>
                  ),
                },
              ]}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              marginHorizontal={32}
            />
          ) : (
            <>
              {/* divider ABOVE shows */}
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: '#616161',
                  marginHorizontal: -32,
                  marginTop: 4,
                  marginBottom: 12,
                }}
              />

              {/* shows always visible when no tabs */}
              <ProfileShowsSection
                showView={showView}
                setShowView={setShowView}
                shows={mockShows}
                isOwner={true}
                onSeePastShows={() => console.log('see past shows')}
                onCreateShow={() => console.log('create show')}
              />
            </>
          )}
        </>

      </ParallaxScrollView>

      {/* Account Switcher */}
      <Modal
        visible={switcherVisible}
        animationType='slide'
        presentationStyle='pageSheet'
        onRequestClose={() => setSwitcherVisible(false)}
      >
        <SafeAreaView style={styles.switcherContainer}>
          <View style={styles.switcherHeader}>
            <ThemedText style={styles.switcherTitle}>Switch Account</ThemedText>
            <TouchableOpacity onPress={() => setSwitcherVisible(false)}>
              <ThemedText style={styles.closeText}>Done</ThemedText>
            </TouchableOpacity>
          </View>


          {/* User Account */}
          <TouchableOpacity
            style={[styles.switcherRow, activeProfile?.id === activeProfile?.id && styles.switcherRowActive]}
            onPress={() => { setActiveProfile(activeProfile!); setSwitcherVisible(false); }}
          >
            <Image
              source={activeProfile?.profileImageUrl ? { uri: `${BASE_URL}${activeProfile.profileImageUrl}` } : null}
              style={styles.switcherAvatar}
            />
            <View>
              <ThemedText style={styles.switcherName}>{activeProfile?.name}</ThemedText>
              <ThemedText style={styles.switcherSub}>@{activeProfile?.username}</ThemedText>
            </View>
          </TouchableOpacity>

          {/* Band Accounts */}
          {bands.map(band => (
            <TouchableOpacity
              key={band.id}
              style={[styles.switcherRow, activeProfile?.id === band.id && styles.switcherRowActive]}
              onPress={() => { setActiveProfile(band); setSwitcherVisible(false); }}
            >
              <Image
                source={band.profileImageUrl ? { uri: band.profileImageUrl } : require('@/assets/images/default/profileImage.png')}
                style={styles.switcherAvatar}
              />
              <View>
                <ThemedText style={styles.switcherName}>{band.name}</ThemedText>
                <ThemedText style={styles.switcherSub}>Band</ThemedText>
              </View>
            </TouchableOpacity>
          ))}

          {/* Venue Accounts */}
          {venues.map(venue => (
            <TouchableOpacity
              key={venue.id}
              style={[styles.switcherRow, activeProfile?.id === venue.id && styles.switcherRowActive]}
              onPress={() => { setActiveProfile(venue); setSwitcherVisible(false); }}
            >
              <Image
                source={venue.profileImageUrl ? { uri: venue.profileImageUrl } : require('@/assets/images/default/profileImage.png')}
                style={styles.switcherAvatar}
              />
              <View>
                <ThemedText style={styles.switcherName}>{venue.name}</ThemedText>
                <ThemedText style={styles.switcherSub}>Venue</ThemedText>
              </View>
            </TouchableOpacity>
          ))}

          {/* Create New */}
          <TouchableOpacity style={styles.createRow}>
            <ThemedText style={styles.createText}>+ Create a Band</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.createRow}>
            <ThemedText style={styles.createText}>+ Create a Venue</ThemedText>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>


      {/* Web View Modal*/}
      <Modal
        visible={webViewUrl !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setWebViewUrl(null)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalUrl} numberOfLines={1}>
              {webViewUrl?.replace(/^https?:\/\//, '')}
            </ThemedText>
            <TouchableOpacity onPress={() => setWebViewUrl(null)}>
              <ThemedText style={styles.closeText}>Done</ThemedText>
            </TouchableOpacity>
          </View>
          {webViewUrl && (
            <WebView source={{ uri: webViewUrl }} style={styles.webView} />
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pfpContainer: {
    position: 'absolute',
    top: -(AVATAR_SIZE / 2),
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  pfpWrapper: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: 18,
    borderWidth: BORDER_WIDTH,
    borderColor: '#ffffff',
    overflow: 'hidden',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: 'white',
    marginTop: -2,
  },
  bioRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: -10,
    marginBottom: -8
  },
  bioContainer: {
    alignItems: 'center',
    marginTop: -16,
  },
  linkText: {
    fontSize: 12,
    color: '#4A90D9',
    textDecorationLine: 'underline',
  },
  bioText: {
    fontSize: 12,
    color: 'grey',
    alignContent: 'center'
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: -32,
  },
  metaText: {
    fontSize: 11,
    opacity: 0.6,
    textAlign: 'center',
  },
  emptyText: {
    opacity: 0.4,
    fontSize: 13,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  modalUrl: {
    flex: 1,
    fontSize: 13,
    opacity: 0.6,
    marginRight: 12,
  },
  closeText: {
    fontSize: 16,
    color: '#4A90D9',
    fontWeight: '600',
  },
  webView: {
    flex: 1,
  },
  switcherContainer: { flex: 1, backgroundColor: 'black' },
  switcherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  switcherTitle: { fontSize: 16, fontWeight: '600' },
  switcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  switcherRowActive: { opacity: 0.5 },
  switcherAvatar: { width: 44, height: 44, borderRadius: 12 },
  switcherName: { fontSize: 15, fontWeight: '600' },
  switcherSub: { fontSize: 12, opacity: 0.5 },
  createRow: { padding: 16 },
  createText: { fontSize: 15, color: '#4A90D9' },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: 45,
    backgroundColor: '#282828',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 20,
  },
});