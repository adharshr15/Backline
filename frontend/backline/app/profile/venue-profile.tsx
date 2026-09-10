import { Image } from 'expo-image';
import { View, Text, useWindowDimensions, Modal, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth, type Venue } from '@/context/AuthContext'
import { BASE_URL } from '@/services/api';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { Show, getShowsByProfile, getRsvpShows, rsvpShow, unrsvpShow, leaveShow } from '@/services/show.service';
import ProfileCalendarModal from '@/components/profile-calendar-modal';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTabHref } from '@/hooks/use-tab-href';
import ProfileShowsSection from '@/components/profile/shows-poster-section';
import CreateShowModal from '@/components/profile/create-show-modal';
import CreateListingModal from '@/components/profile/create-listing-modal';
import ProfileListingsSection from '@/components/profile/listings-section';
import ProfilePostsSection from '@/components/profile/posts-section';
import PostComposerModal from '@/components/media/post-composer';
import { TabSwitcher } from '@/components/ui/tab-switcher';
import { Listing, getListingsByProfile } from '@/services/listing.service';
import { Post, getProfilePosts } from '@/services/post.service';
import { renderBioWithLinks, profileStyles } from '../(tabs)/profile';

type Tab = 'shows' | 'posts' | 'listings';

export const AVATAR_SIZE = 80;

export function VenueProfile() {
    const router = useRouter();
    const tabHref = useTabHref();
    const { user, activeProfile, setActiveProfile } = useAuth();
    const venue = activeProfile as Venue;

    const { width } = useWindowDimensions();
    const sideWidth = (width - AVATAR_SIZE) / 2;

    const [webViewUrl, setWebViewUrl] = useState<string | null>(null);
    const [switcherVisible, setSwitcherVisible] = useState(false);
    const [showView, setShowView] = useState<'poster' | 'list'>('poster');
    const [shows, setShows] = useState<Show[]>([]);
    const [pastShows, setPastShows] = useState<Show[]>([]);
    const [showingPast, setShowingPast] = useState(false);
    const [createShowVisible, setCreateShowVisible] = useState(false);
    const [editingShow, setEditingShow] = useState<Show | undefined>(undefined);
    const [rsvpShows, setRsvpShows] = useState<Show[]>([]);
    const [calendarVisible, setCalendarVisible] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('shows');
    const [listings, setListings] = useState<Listing[]>([]);
    const [listingView, setListingView] = useState<'poster' | 'list'>('poster');
    const [createListingVisible, setCreateListingVisible] = useState(false);
    const [editingListing, setEditingListing] = useState<Listing | undefined>(undefined);
    const [posts, setPosts] = useState<Post[]>([]);
    const [composerVisible, setComposerVisible] = useState(false);
    const borderColor = useThemeColor({}, 'text');

    const bands = user?.bandMemberships?.map(m => m.band).filter(Boolean) || [];
    const venues = user?.venueReps?.map(v => v.venue).filter(Boolean) || [];

    const loadListings = useCallback(() => {
        if (!venue?.id) return;
        getListingsByProfile('venue', venue.id, true).then(setListings).catch(() => {});
    }, [venue?.id]);

    const loadPosts = useCallback(() => {
        if (!venue?.id) return;
        getProfilePosts('VENUE', venue.id, { type: 'VENUE', id: venue.id }).then(setPosts).catch(() => {});
    }, [venue?.id]);

    useFocusEffect(useCallback(() => {
        if (!venue?.id) return;
        getShowsByProfile('venue', venue.id).then(setShows).catch(() => {});
        getShowsByProfile('venue', venue.id, true).then(setPastShows).catch(() => {});
        getRsvpShows('venue', venue.id).then(setRsvpShows).catch(() => {});
        loadListings();
        loadPosts();
    }, [venue?.id]));

    // All hooks are above this line. Guard after them so the hook count stays
    // stable across renders (e.g. when activeProfile briefly becomes null on logout).
    if (!activeProfile || activeProfile.accountType !== 'VENUE') return null;

    const handleRsvp = async (show: Show) => {
        const hasRsvp = show.rsvpVenues?.some(v => v.id === venue.id);
        try {
            if (hasRsvp) await unrsvpShow(show.id, 'venue', undefined, venue.id);
            else await rsvpShow(show.id, 'venue', undefined, venue.id);
            getRsvpShows('venue', venue.id).then(setRsvpShows).catch(() => {});
            getShowsByProfile('venue', venue.id).then(setShows).catch(() => {});
        } catch (e) { console.error(e); }
    };

    const handleLeaveShow = async (show: Show) => {
        try {
            await leaveShow(show.id, undefined, venue.id);
            const [fresh, freshPast] = await Promise.all([
                getShowsByProfile('venue', venue.id),
                getShowsByProfile('venue', venue.id, true),
            ]);
            setShows(fresh);
            setPastShows(freshPast);
        } catch (e) { console.error(e); }
    };

    const profilePicture = venue?.profileImageUrl
        ? { uri: `${BASE_URL}${venue.profileImageUrl}` }
        : require('@/assets/images/default/profileImage.png');

    const headerImage = venue?.headerImageUrl
        ? { uri: `${BASE_URL}${venue.headerImageUrl}` }
        : require('@/assets/images/default/headerImage.png');

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
                    <View style={profileStyles.pfpContainer} pointerEvents="box-none">
                        <TouchableOpacity onPress={() => setSwitcherVisible(true)}>
                            <View style={[profileStyles.pfpWrapper, { borderColor }]}>
                                <Image
                                    source={profilePicture}
                                    style={{ width: '100%', height: '100%' }}
                                />
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={profileStyles.metaRow}>
                        <TouchableOpacity
                            onPress={() => venue?.city && venue?.state && router.push({ pathname: tabHref('scene'), params: { city: venue.city, state: venue.state } } as any)}
                            disabled={!venue?.city || !venue?.state}
                        >
                            <ThemedText style={[profileStyles.metaText, { width: sideWidth }]}>
                                {venue?.city && venue?.state ? `${venue.city}, ${venue.state}` : ''}
                            </ThemedText>
                        </TouchableOpacity>
                        <View style={{ width: AVATAR_SIZE }} />
                        <ThemedText style={[profileStyles.metaText, { width: sideWidth }]}>
                            {venue?.address ?? ''}
                        </ThemedText>
                    </View>

                    <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        style={[profileStyles.name, { maxWidth: width - 64 }]}
                    >
                        {venue?.name}
                    </Text>

                    {venue?.bio ? (
                        <View style={profileStyles.bioRow}>
                            {renderBioWithLinks(venue.bio, setWebViewUrl)}
                        </View>
                    ) : null}

                    <View style={profileStyles.actionRow}>
                        <TouchableOpacity style={profileStyles.actionButton} onPress={() => setCalendarVisible(true)}>
                            <Ionicons name="calendar-outline" size={22} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity style={profileStyles.actionButton} onPress={() => console.log('Share Profile')}>
                            <Ionicons name="share-outline" size={22} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity style={profileStyles.actionButton} onPress={() => router.push(tabHref('metrics'))}>
                            <Ionicons name="stats-chart-outline" size={22} color="white" />
                        </TouchableOpacity>
                    </View>

                    <TabSwitcher
                        tabs={[
                            {
                                key: 'shows',
                                content: (
                                    <ProfileShowsSection
                                        showView={showView}
                                        setShowView={setShowView}
                                        shows={shows}
                                        pastShows={pastShows}
                                        showingPast={showingPast}
                                        isOwner={true}
                                        onSeePastShows={() => setShowingPast(true)}
                                        onCreateShow={() => { setEditingShow(undefined); setCreateShowVisible(true); }}
                                        onEditShow={(show) => { setEditingShow(show); setCreateShowVisible(true); }}
                                        onLeaveShow={handleLeaveShow}
                                        onShowPress={(show) => router.push({ pathname: tabHref('show'), params: { id: show.id } })}
                                        activeProfileId={venue.id}
                                        activeProfileType="venue"
                                        onRsvp={handleRsvp}
                                    />
                                ),
                            },
                            {
                                key: 'posts',
                                content: (
                                    <ProfilePostsSection
                                        posts={posts}
                                        isOwner={true}
                                        onAddPost={() => setComposerVisible(true)}
                                        onPostPress={(post) => router.push({ pathname: tabHref('post'), params: { id: post.id } })}
                                    />
                                ),
                            },
                            {
                                key: 'listings',
                                content: (
                                    <ProfileListingsSection
                                        listings={listings}
                                        view={listingView}
                                        setView={setListingView}
                                        isOwner={true}
                                        onCreateListing={() => { setEditingListing(undefined); setCreateListingVisible(true); }}
                                        onListingPress={(listing) => router.push({ pathname: tabHref('listing'), params: { id: listing.id } })}
                                    />
                                ),
                            },
                        ]}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        marginHorizontal={32}
                    />
                </>
            </ParallaxScrollView>

            {/* settings gear — top-right of header */}
            <TouchableOpacity style={profileStyles.headerGear} onPress={() => router.push('/settings')}>
                <Ionicons name="settings-outline" size={20} color="white" />
            </TouchableOpacity>

            <PostComposerModal
                visible={composerVisible}
                ownerType="VENUE"
                ownerId={venue.id}
                onClose={() => setComposerVisible(false)}
                onCreated={loadPosts}
            />

            {/* Account Switcher */}
            <Modal
                visible={switcherVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setSwitcherVisible(false)}
            >
                <SafeAreaView style={profileStyles.switcherContainer}>
                    <View style={profileStyles.switcherHeader}>
                        <ThemedText style={profileStyles.switcherTitle}>Switch Account</ThemedText>
                        <TouchableOpacity onPress={() => setSwitcherVisible(false)}>
                            <ThemedText style={profileStyles.closeText}>Done</ThemedText>
                        </TouchableOpacity>
                    </View>

                    {user && (
                        <TouchableOpacity
                            style={profileStyles.switcherRow}
                            onPress={() => { setActiveProfile(user); setSwitcherVisible(false); }}
                        >
                            <Image
                                source={user.profileImageUrl ? { uri: `${BASE_URL}${user.profileImageUrl}` } : require('@/assets/images/default/profileImage.png')}
                                style={profileStyles.switcherAvatar}
                            />
                            <View>
                                <ThemedText style={profileStyles.switcherName}>{user.name}</ThemedText>
                                <ThemedText style={profileStyles.switcherSub}>@{user.username}</ThemedText>
                            </View>
                        </TouchableOpacity>
                    )}

                    {bands.map(b => (
                        <TouchableOpacity
                            key={b.id}
                            style={profileStyles.switcherRow}
                            onPress={() => { setActiveProfile(b); setSwitcherVisible(false); }}
                        >
                            <Image
                                source={b.profileImageUrl ? { uri: `${BASE_URL}${b.profileImageUrl}` } : require('@/assets/images/default/profileImage.png')}
                                style={profileStyles.switcherAvatar}
                            />
                            <View>
                                <ThemedText style={profileStyles.switcherName}>{b.name}</ThemedText>
                                <ThemedText style={profileStyles.switcherSub}>Band</ThemedText>
                            </View>
                        </TouchableOpacity>
                    ))}

                    {venues.map(v => (
                        <TouchableOpacity
                            key={v.id}
                            style={[profileStyles.switcherRow, activeProfile?.id === v.id && profileStyles.switcherRowActive]}
                            onPress={() => { setActiveProfile(v); setSwitcherVisible(false); }}
                        >
                            <Image
                                source={v.profileImageUrl ? { uri: `${BASE_URL}${v.profileImageUrl}` } : require('@/assets/images/default/profileImage.png')}
                                style={profileStyles.switcherAvatar}
                            />
                            <View>
                                <ThemedText style={profileStyles.switcherName}>{v.name}</ThemedText>
                                <ThemedText style={profileStyles.switcherSub}>Venue</ThemedText>
                            </View>
                        </TouchableOpacity>
                    ))}

                    <TouchableOpacity
                        onPress={() => { setSwitcherVisible(false); router.push('/profile/create-new-band'); }}
                        style={profileStyles.createRow}
                    >
                        <ThemedText style={profileStyles.createText}>+ Create a Band</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => { setSwitcherVisible(false); router.push('/profile/create-new-venue'); }}
                        style={profileStyles.createRow}
                    >
                        <ThemedText style={profileStyles.createText}>+ Create a Venue</ThemedText>
                    </TouchableOpacity>
                </SafeAreaView>
            </Modal>

            {/* Web View Modal */}
            <Modal
                visible={webViewUrl !== null}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setWebViewUrl(null)}
            >
                <SafeAreaView style={profileStyles.modalContainer}>
                    <View style={profileStyles.modalHeader}>
                        <ThemedText style={profileStyles.modalUrl} numberOfLines={1}>
                            {webViewUrl?.replace(/^https?:\/\//, '')}
                        </ThemedText>
                        <TouchableOpacity onPress={() => setWebViewUrl(null)}>
                            <ThemedText style={profileStyles.closeText}>Done</ThemedText>
                        </TouchableOpacity>
                    </View>
                    {webViewUrl && (
                        <WebView source={{ uri: webViewUrl }} style={profileStyles.webView} />
                    )}
                </SafeAreaView>
            </Modal>

            <ProfileCalendarModal
                visible={calendarVisible}
                onClose={() => setCalendarVisible(false)}
                profileShows={[...shows, ...pastShows]}
                rsvpShows={rsvpShows}
                isOwnProfile={true}
                activeProfileId={venue.id}
                activeProfileType="venue"
                onRsvpToggle={handleRsvp}
            />

            <CreateShowModal
                visible={createShowVisible}
                onClose={() => setCreateShowVisible(false)}
                creatorVenueId={venue.id}
                defaultCity={venue.city ?? ''}
                defaultState={venue.state ?? ''}
                defaultCountry={venue.country ?? ''}
                editingShow={editingShow}
                onCreated={async () => {
                    const [fresh, freshPast] = await Promise.all([
                        getShowsByProfile('venue', venue.id),
                        getShowsByProfile('venue', venue.id, true),
                    ]);
                    setShows(fresh);
                    setPastShows(freshPast);
                    setCreateShowVisible(false);
                }}
            />

            <CreateListingModal
                visible={createListingVisible}
                onClose={() => setCreateListingVisible(false)}
                creatorVenueId={venue.id}
                defaultCity={venue.city ?? ''}
                defaultState={venue.state ?? ''}
                defaultCountry={venue.country ?? ''}
                editingListing={editingListing}
                onSaved={() => {
                    loadListings();
                    setCreateListingVisible(false);
                }}
            />

        </>
    );
}
