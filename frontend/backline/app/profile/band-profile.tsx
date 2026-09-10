import { Image } from 'expo-image';
import { View, Text, useWindowDimensions, Modal, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth, type Band } from '@/context/AuthContext'
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

export function BandProfile() {
    const router = useRouter();
    const tabHref = useTabHref();
    const { user, activeProfile, setActiveProfile } = useAuth();
    const band = activeProfile as Band;

    const { width } = useWindowDimensions();
    const sideWidth = (width - AVATAR_SIZE) / 2;

    const [webViewUrl, setWebViewUrl] = useState<string | null>(null);
    const [switcherVisible, setSwitcherVisible] = useState(false);
    const [showView, setShowView] = useState<'poster' | 'list'>('poster');
    const [shows, setShows] = useState<Show[]>([]);
    const [pastShows, setPastShows] = useState<Show[]>([]);
    const [rsvpShows, setRsvpShows] = useState<Show[]>([]);
    const [showingPast, setShowingPast] = useState(false);
    const [createShowVisible, setCreateShowVisible] = useState(false);
    const [editingShow, setEditingShow] = useState<Show | undefined>(undefined);
    const [calendarVisible, setCalendarVisible] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('shows');
    const [listings, setListings] = useState<Listing[]>([]);
    const [listingView, setListingView] = useState<'poster' | 'list'>('poster');
    const [createListingVisible, setCreateListingVisible] = useState(false);
    const [editingListing, setEditingListing] = useState<Listing | undefined>(undefined);
    const [posts, setPosts] = useState<Post[]>([]);
    const [composerVisible, setComposerVisible] = useState(false);
    const borderColor = useThemeColor({}, 'text');

    const loadListings = useCallback(() => {
        if (!band?.id) return;
        getListingsByProfile('band', band.id, true).then(setListings).catch(() => {});
    }, [band?.id]);

    const loadPosts = useCallback(() => {
        if (!band?.id) return;
        getProfilePosts('BAND', band.id, { type: 'BAND', id: band.id }).then(setPosts).catch(() => {});
    }, [band?.id]);

    useFocusEffect(useCallback(() => {
        if (!band?.id) return;
        getShowsByProfile('band', band.id).then(setShows).catch(() => {});
        getShowsByProfile('band', band.id, true).then(setPastShows).catch(() => {});
        getRsvpShows('band', band.id).then(setRsvpShows).catch(() => {});
        loadListings();
        loadPosts();
    }, [band?.id]));

    // All hooks are above this line. Guard after them so the hook count stays
    // stable across renders (e.g. when activeProfile briefly becomes null on logout).
    if (!activeProfile || activeProfile.accountType !== 'BAND') return null;

    const handleRsvp = async (show: Show) => {
        const hasRsvp = show.rsvpBands?.some(b => b.id === band.id);
        try {
            if (hasRsvp) await unrsvpShow(show.id, 'band', band.id);
            else await rsvpShow(show.id, 'band', band.id);
            getRsvpShows('band', band.id).then(setRsvpShows).catch(() => {});
            getShowsByProfile('band', band.id).then(setShows).catch(() => {});
        } catch (e) { console.error(e); }
    };

    const handleLeaveShow = async (show: Show) => {
        try {
            await leaveShow(show.id, band.id);
            const [fresh, freshPast] = await Promise.all([
                getShowsByProfile('band', band.id),
                getShowsByProfile('band', band.id, true),
            ]);
            setShows(fresh);
            setPastShows(freshPast);
        } catch (e) { console.error(e); }
    };

    const bands = user?.bandMemberships?.map(m => m.band).filter(Boolean) || [];
    const venues = user?.venueReps?.map(v => v.venue).filter(Boolean) || [];

    const profilePicture = band?.profileImageUrl
        ? { uri: `${BASE_URL}${band.profileImageUrl}` }
        : require('@/assets/images/default/profileImage.png');

    const headerImage = band?.headerImageUrl
        ? { uri: `${BASE_URL}${band.headerImageUrl}` }
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

                    {/* meta row */}
                    <View style={profileStyles.metaRow}>
                        <TouchableOpacity
                            onPress={() => band?.city && band?.state && router.push({ pathname: tabHref('scene'), params: { city: band.city, state: band.state } } as any)}
                            disabled={!band?.city || !band?.state}
                        >
                            <ThemedText style={[profileStyles.metaText, { width: sideWidth }]}>
                                {band?.city && band?.state ? `${band.city}, ${band.state}` : ''}
                            </ThemedText>
                        </TouchableOpacity>
                        <View style={{ width: AVATAR_SIZE }} />
                        <ThemedText style={[profileStyles.metaText, { width: sideWidth }]}>
                            {band?.genres?.map(g => g.name).join(' · ') ?? ''}
                        </ThemedText>
                    </View>

                    {/* name */}
                    <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        style={[profileStyles.name, { maxWidth: width - 64 }]}
                    >
                        {band?.name}
                    </Text>

                    {/* bio */}
                    {band?.bio ? (
                        <View style={profileStyles.bioRow}>
                            {renderBioWithLinks(band.bio, setWebViewUrl)}
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
                                        activeProfileId={band.id}
                                        activeProfileType="band"
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
                ownerType="BAND"
                ownerId={band.id}
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

                    {/* User Account */}
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

                    {/* Band Accounts */}
                    {bands.map(b => (
                        <TouchableOpacity
                            key={b.id}
                            style={[profileStyles.switcherRow, activeProfile?.id === b.id && profileStyles.switcherRowActive]}
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

                    {/* Venue Accounts */}
                    {venues.map(v => (
                        <TouchableOpacity
                            key={v.id}
                            style={profileStyles.switcherRow}
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

                    {/* Create New */}
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
                activeProfileId={band.id}
                activeProfileType="band"
                onRsvpToggle={handleRsvp}
            />

            <CreateShowModal
                visible={createShowVisible}
                onClose={() => setCreateShowVisible(false)}
                creatorBandId={band.id}
                defaultCity={band.city ?? ''}
                defaultState={band.state ?? ''}
                defaultCountry={band.country ?? ''}
                editingShow={editingShow}
                onCreated={async () => {
                    const [fresh, freshPast] = await Promise.all([
                        getShowsByProfile('band', band.id),
                        getShowsByProfile('band', band.id, true),
                    ]);
                    setShows(fresh);
                    setPastShows(freshPast);
                    setCreateShowVisible(false);
                }}
            />

            <CreateListingModal
                visible={createListingVisible}
                onClose={() => setCreateListingVisible(false)}
                creatorBandId={band.id}
                defaultCity={band.city ?? ''}
                defaultState={band.state ?? ''}
                defaultCountry={band.country ?? ''}
                editingListing={editingListing}
                onSaved={() => {
                    loadListings();
                    setCreateListingVisible(false);
                }}
            />

        </>
    );
}
