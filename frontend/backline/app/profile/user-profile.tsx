import { Image } from 'expo-image';
import { View, Text, StyleSheet, useWindowDimensions, Modal, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { toCountryName } from '@/utils/location';
import { useAuth, type User } from '@/context/AuthContext'
import { BASE_URL } from '@/services/api';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { Show, getShowsByProfile, getRsvpShows, rsvpShow, unrsvpShow } from '@/services/show.service';
import ProfileCalendarModal from '@/components/profile-calendar-modal';
import { TabSwitcher } from '@/components/ui/tab-switcher';
import CreateShowModal from '@/components/profile/create-show-modal';
import CreateListingModal from '@/components/profile/create-listing-modal';
import { Listing, getListingsByProfile } from '@/services/listing.service';
import ProfileListingsSection from '@/components/profile/listings-section';
import ProfilePostsSection from '@/components/profile/posts-section';
import PostComposerModal from '@/components/media/post-composer';
import { Post, getProfilePosts } from '@/services/post.service';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTabHref } from '@/hooks/use-tab-href';
import ProfileShowsSection from '@/components/profile/shows-poster-section';
import { renderBioWithLinks } from '../(tabs)/profile';
import { profileStyles } from '../(tabs)/profile';
export const AVATAR_SIZE = 80;

type Tab = 'shows' | 'posts' | 'listings';

export function UserProfile() {
    const router = useRouter();
    const tabHref = useTabHref();

    const { activeProfile, setActiveProfile } = useAuth();
    const user = activeProfile as User;


    const { width } = useWindowDimensions();
    const sideWidth = (width - AVATAR_SIZE) / 2;

    const [webViewUrl, setWebViewUrl] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('shows');
    const [switcherVisible, setSwitcherVisible] = useState(false);
    const [showView, setShowView] = useState<'poster' | 'list'>('poster');
    const [shows, setShows] = useState<Show[]>([]);
    const [pastShows, setPastShows] = useState<Show[]>([]);
    const [showingPast, setShowingPast] = useState(false);
    const [createShowVisible, setCreateShowVisible] = useState(false);
    const [editingShow, setEditingShow] = useState<Show | undefined>(undefined);
    const [listings, setListings] = useState<Listing[]>([]);
    const [listingView, setListingView] = useState<'poster' | 'list'>('poster');
    const [createListingVisible, setCreateListingVisible] = useState(false);
    const [editingListing, setEditingListing] = useState<Listing | undefined>(undefined);
    const [posts, setPosts] = useState<Post[]>([]);
    const [composerVisible, setComposerVisible] = useState(false);
    const borderColor = useThemeColor({}, 'text');

    const bands = user?.bandMemberships?.map(m => m.band).filter(Boolean) || [];
    const venues = user?.venueReps?.map(v => v.venue).filter(Boolean) || [];

    const [rsvpShows, setRsvpShows] = useState<Show[]>([]);
    const [calendarVisible, setCalendarVisible] = useState(false);
    const hasListings = true; // owner: always show tabs so listings can be created

    const loadListings = useCallback(() => {
        if (!user?.id) return;
        getListingsByProfile('user', user.id, true).then(setListings).catch(() => {});
    }, [user?.id]);

    const loadPosts = useCallback(() => {
        if (!user?.id) return;
        getProfilePosts('USER', user.id, { type: 'USER', id: user.id }).then(setPosts).catch(() => {});
    }, [user?.id]);

    useFocusEffect(useCallback(() => {
        if (!user?.id) return;
        getShowsByProfile('user', user.id).then(setShows).catch(() => {});
        getShowsByProfile('user', user.id, true).then(setPastShows).catch(() => {});
        getRsvpShows('user', user.id).then(setRsvpShows).catch(() => {});
        loadListings();
        loadPosts();
    }, [user?.id]));

    // All hooks are above this line. Guard after them so the hook count stays
    // stable across renders (e.g. when activeProfile briefly becomes null on logout).
    if (!activeProfile || activeProfile.accountType !== 'USER') return null;

    const handleRsvp = async (show: Show) => {
        const hasRsvp = show.rsvpUsers?.some(u => u.id === user.id);
        try {
            if (hasRsvp) await unrsvpShow(show.id, 'user');
            else await rsvpShow(show.id, 'user');
            getRsvpShows('user', user.id).then(setRsvpShows).catch(() => {});
            getShowsByProfile('user', user.id).then(setShows).catch(() => {});
        } catch (e) { console.error(e); }
    };

    const profilePicture = user?.profileImageUrl
        ? { uri: `${BASE_URL}${user.profileImageUrl}` }
        : require("@/assets/images/default/profileImage.png")

    const headerImage = user?.headerImageUrl
        ? { uri: `${BASE_URL}${user.headerImageUrl}` }
        : require("@/assets/images/default/headerImage.png")

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

                    {/* meta row*/}
                    <View style={profileStyles.metaRow}>
                        <TouchableOpacity
                            onPress={() => user?.city && user?.state && router.push({ pathname: tabHref('scene'), params: { city: user.city, state: user.state } } as any)}
                            disabled={!user?.city || !user?.state}
                        >
                            <ThemedText style={[profileStyles.metaText, { width: sideWidth }]}>
                                {user?.city && user?.state ? `${user?.city}, ${user?.state}` : ''}
                            </ThemedText>
                        </TouchableOpacity>
                        <View style={{ width: AVATAR_SIZE }} />
                        <ThemedText style={[profileStyles.metaText, { width: sideWidth }]}>
                            {toCountryName(user?.country ?? '')}
                        </ThemedText>
                    </View>

                    {/* name */}
                    <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        style={[profileStyles.name, { maxWidth: width - 64 }]}
                    >
                        {activeProfile?.name}
                    </Text>

                    {/* bio */}
                    {activeProfile?.bio ? (
                        <View style={profileStyles.bioRow}>
                            {renderBioWithLinks(activeProfile.bio, setWebViewUrl)}
                        </View>
                    ) : null}

                    {/* action buttons */}
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
                                            shows={shows}
                                            pastShows={pastShows}
                                            showingPast={showingPast}
                                            isOwner={true}
                                            onSeePastShows={() => setShowingPast(true)}
                                            onCreateShow={() => { setEditingShow(undefined); setCreateShowVisible(true); }}
                                            onEditShow={(show) => { setEditingShow(show); setCreateShowVisible(true); }}
                                            onShowPress={(show) => router.push({ pathname: tabHref('show'), params: { id: show.id } })}
                                            activeProfileId={user.id}
                                            activeProfileType="user"
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
                                shows={shows}
                                pastShows={pastShows}
                                showingPast={showingPast}
                                isOwner={true}
                                onSeePastShows={() => setShowingPast(true)}
                                onCreateShow={() => { setEditingShow(undefined); setCreateShowVisible(true); }}
                                onEditShow={(show) => { setEditingShow(show); setCreateShowVisible(true); }}
                                onShowPress={(show) => router.push({ pathname: tabHref('show'), params: { id: show.id } })}
                                activeProfileId={user.id}
                                activeProfileType="user"
                            />
                        </>
                    )}
                </>

            </ParallaxScrollView>

            {/* settings gear — top-right of header */}
            <TouchableOpacity style={profileStyles.headerGear} onPress={() => router.push('/settings')}>
                <Ionicons name="settings-outline" size={20} color="white" />
            </TouchableOpacity>

            {/* Account Switcher */}
            <Modal
                visible={switcherVisible}
                animationType='slide'
                presentationStyle='pageSheet'
                onRequestClose={() => setSwitcherVisible(false)}
            >
                <SafeAreaView style={profileStyles.switcherContainer}>
                    <View style={profileStyles.switcherHeader}>
                        <ThemedText style={profileStyles.switcherTitle}>Switch Account</ThemedText>
                        <TouchableOpacity onPress={() => setSwitcherVisible(false)}>
                            <ThemedText style={profileStyles.closeText}>Done</ThemedText>
                        </TouchableOpacity>
                    </View>


                    {/* User Account */}
                    <TouchableOpacity
                        style={[profileStyles.switcherRow, activeProfile?.id === activeProfile?.id && profileStyles.switcherRowActive]}
                        onPress={() => { setActiveProfile(activeProfile!); setSwitcherVisible(false); }}
                    >
                        <Image
                            source={activeProfile?.profileImageUrl ? { uri: `${BASE_URL}${activeProfile.profileImageUrl}` } : null}
                            style={profileStyles.switcherAvatar}
                        />
                        <View>
                            <ThemedText style={profileStyles.switcherName}>{activeProfile?.name}</ThemedText>
                            <ThemedText style={profileStyles.switcherSub}>@{activeProfile?.username}</ThemedText>
                        </View>
                    </TouchableOpacity>

                    {/* Band Accounts */}
                    {bands.map(band => (
                        <TouchableOpacity
                            key={band.id}
                            style={[profileStyles.switcherRow, activeProfile?.id === band.id && profileStyles.switcherRowActive]}
                            onPress={() => { setActiveProfile(band); setSwitcherVisible(false); }}
                        >
                            <Image
                                source={band.profileImageUrl ? { uri: `${BASE_URL}${band.profileImageUrl}` } : require('@/assets/images/default/profileImage.png')}
                                style={profileStyles.switcherAvatar}
                            />
                            <View>
                                <ThemedText style={profileStyles.switcherName}>{band.name}</ThemedText>
                                <ThemedText style={profileStyles.switcherSub}>Band</ThemedText>
                            </View>
                        </TouchableOpacity>
                    ))}

                    {/* Venue Accounts */}
                    {venues.map(venue => (
                        <TouchableOpacity
                            key={venue.id}
                            style={[profileStyles.switcherRow, activeProfile?.id === venue.id && profileStyles.switcherRowActive]}
                            onPress={() => { setActiveProfile(venue); setSwitcherVisible(false); }}
                        >
                            <Image
                                source={venue.profileImageUrl ? { uri: `${BASE_URL}${venue.profileImageUrl}` } : require('@/assets/images/default/profileImage.png')}
                                style={profileStyles.switcherAvatar}
                            />
                            <View>
                                <ThemedText style={profileStyles.switcherName}>{venue.name}</ThemedText>
                                <ThemedText style={profileStyles.switcherSub}>Venue</ThemedText>
                            </View>
                        </TouchableOpacity>
                    ))}

                    {/* Create New */}
                    <TouchableOpacity
                        onPress={() => {
                            setSwitcherVisible(false);
                            router.push('/profile/create-new-band');
                        }}
                        style={profileStyles.createRow}
                    >
                        <ThemedText style={profileStyles.createText}>+ Create a Band</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => {
                            setSwitcherVisible(false);
                            router.push('/profile/create-new-venue')
                        }}
                        style={profileStyles.createRow}
                    >
                        <ThemedText style={profileStyles.createText}>+ Create a Venue</ThemedText>
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
                activeProfileId={user.id}
                activeProfileType="user"
                onRsvpToggle={handleRsvp}
            />

            <CreateShowModal
                visible={createShowVisible}
                onClose={() => setCreateShowVisible(false)}
                creatorUserId={user.id}
                defaultCity={user.city ?? ''}
                defaultState={user.state ?? ''}
                defaultCountry={user.country ?? ''}
                editingShow={editingShow}
                onCreated={async () => {
                    const [fresh, freshPast] = await Promise.all([
                        getShowsByProfile('user', user.id),
                        getShowsByProfile('user', user.id, true),
                    ]);
                    setShows(fresh);
                    setPastShows(freshPast);
                    setCreateShowVisible(false);
                }}
            />

            <CreateListingModal
                visible={createListingVisible}
                onClose={() => setCreateListingVisible(false)}
                creatorUserId={user.id}
                defaultCity={user.city ?? ''}
                defaultState={user.state ?? ''}
                defaultCountry={user.country ?? ''}
                editingListing={editingListing}
                onSaved={() => {
                    loadListings();
                    setCreateListingVisible(false);
                }}
            />

            <PostComposerModal
                visible={composerVisible}
                ownerType="USER"
                ownerId={user.id}
                onClose={() => setComposerVisible(false)}
                onCreated={loadPosts}
            />

        </>
    );
}

