import { Image } from 'expo-image';
import { View, Text, StyleSheet, useWindowDimensions, Modal, TouchableOpacity } from 'react-native';
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
import ProfileShowsSection from '@/components/profile/shows-poster-section';
import CreateShowModal from '@/components/profile/create-show-modal';
import ShowDetailModal from '@/components/show-detail-modal';
import { renderBioWithLinks, profileStyles } from '../(tabs)/profile';

export const AVATAR_SIZE = 80;

export function VenueProfile() {
    const router = useRouter();
    const { user, activeProfile, setActiveProfile } = useAuth();

    if (!activeProfile || activeProfile.accountType !== 'VENUE') return null;
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
    const [detailShow, setDetailShow] = useState<Show | null>(null);
    const [rsvpShows, setRsvpShows] = useState<Show[]>([]);
    const [calendarVisible, setCalendarVisible] = useState(false);
    const borderColor = useThemeColor({}, 'text');

    const bands = user?.bandMemberships?.map(m => m.band).filter(Boolean) || [];
    const venues = user?.venueReps?.map(v => v.venue).filter(Boolean) || [];

    useFocusEffect(useCallback(() => {
        getShowsByProfile('venue', venue.id).then(setShows).catch(() => {});
        getShowsByProfile('venue', venue.id, true).then(setPastShows).catch(() => {});
        getRsvpShows('venue', venue.id).then(setRsvpShows).catch(() => {});
    }, [venue.id]));

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
                            onPress={() => venue?.city && venue?.state && router.push({ pathname: '/profile/scene', params: { city: venue.city, state: venue.state } } as any)}
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
                        <TouchableOpacity style={profileStyles.actionButton} onPress={() => router.push('/settings')}>
                            <Ionicons name="settings-outline" size={22} color="white" />
                        </TouchableOpacity>
                    </View>

                    <View
                        style={{
                            height: StyleSheet.hairlineWidth,
                            backgroundColor: '#616161',
                            marginHorizontal: -32,
                            marginTop: 4,
                            marginBottom: 12,
                        }}
                    />

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
                        onShowPress={setDetailShow}
                        activeProfileId={venue.id}
                        activeProfileType="venue"
                        onRsvp={handleRsvp}
                    />
                </>
            </ParallaxScrollView>

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

            <ShowDetailModal
                show={detailShow}
                visible={detailShow !== null}
                onClose={() => setDetailShow(null)}
                onRsvp={handleRsvp}
                activeProfileId={venue.id}
                activeProfileType="venue"
            />
        </>
    );
}
