import { Image } from 'expo-image';
import { View, Text, StyleSheet, useWindowDimensions, Modal, TouchableOpacity, SafeAreaView } from 'react-native';
import { WebView } from 'react-native-webview';
import { useState } from 'react';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ShowCarousel, type Show } from '@/components/show-carousel';
import { TabSwitcher } from '@/components/ui/tab-switcher';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

export const AVATAR_SIZE = 80;
const BORDER_WIDTH = 3;

const mockBandProfile = {
  name: "Heel",
  genre: "Shoegaze",
  city: "College Station",
  state: "TX",
  headerImage: require("@/assets/images/example/heel-header-example.jpg"),
  profilePicture: require("@/assets/images/example/heel-pfp-example.png"),
  link: 'https://linktr.ee/heelband',
};

const mockShows: Show[] = [
  {
    id: 'asdfsa',
    poster: require('@/assets/images/example/poster2.png'),
    venue: 'Notsua',
    city: 'Houston',
    state: 'TX',
    date: 'Apr 2, 2025',
    doors: '7:00 PM',
  },
  {
    id: 'fdasdfda',
    poster: require('@/assets/images/example/poster1.png'),
    venue: 'CAMP House',
    city: 'College Station',
    state: 'TX',
    date: 'Apr 19, 2025',
    doors: '8:00 PM',
  },
];

type Tab = 'shows' | 'tours';

export default function Profile() {
  const { width } = useWindowDimensions();
  const sideWidth = (width - AVATAR_SIZE) / 2;
  const [webViewUrl, setWebViewUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('shows');

  const borderColor = useThemeColor({}, 'text');

  return (
    <>
      <ParallaxScrollView
        headerHeight={160}
        headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
        headerImage={
          <Image
            source={mockBandProfile.headerImage}
            style={{ width: '100%', height: 250 }}
          />
        }
      >
        {/* pfp straddles the top of the ThemedView */}
        <View style={styles.pfpContainer}>
          <View style={styles.pfpWrapper}>
            <Image
              source={mockBandProfile.profilePicture}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </View>
        </View>

        {/* location + genre */}
        <View style={styles.metaRow}>
          <ThemedText style={[styles.metaText, { width: sideWidth }]}>
            {mockBandProfile.city}, {mockBandProfile.state}
          </ThemedText>
          <View style={{ width: AVATAR_SIZE }} />
          <ThemedText style={[styles.metaText, { width: sideWidth }]}>
            {mockBandProfile.genre}
          </ThemedText>
        </View>

        {/* band name */}
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[styles.bandName, { maxWidth: width - 64 }]}
        >
          {mockBandProfile.name}
        </Text>

        {/* link */}
        <TouchableOpacity onPress={() => setWebViewUrl(mockBandProfile.link)} style={styles.linkContainer}>
          <ThemedText style={styles.linkText} numberOfLines={1}>
            {mockBandProfile.link.replace(/^https?:\/\//, '')}
          </ThemedText>
        </TouchableOpacity>

        {/* tab content */}
        <TabSwitcher
          tabs={[
            {
              key: 'shows',
              content: (
                <View style={{ marginHorizontal: -32 }}>
                  <ShowCarousel
                    shows={mockShows}
                    onSeePastShows={() => console.log('see past shows')}
                  />
                </View>
              ),
            },
            {
              key: 'tours',
              content: (
                <View style={{ alignItems: 'center' }}>
                  <ThemedText style={{ opacity: 0.4, fontSize: 13 }}>No tours yet.</ThemedText>
                </View>
              ),
            },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          marginHorizontal={32}
        />

      </ParallaxScrollView>

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
  bandName: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: 'white',
    marginTop: -2,
  },
  linkContainer: {
    alignItems: 'center',
    marginTop: -16,
  },
  linkText: {
    fontSize: 12,
    color: '#4A90D9',
    textDecorationLine: 'underline',
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
});