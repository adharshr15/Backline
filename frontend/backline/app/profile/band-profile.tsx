import { Image } from 'expo-image';
import { View, Text, StyleSheet, useWindowDimensions, Modal, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth, type Band } from '@/context/AuthContext'
import { BASE_URL } from '@/services/api';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { Show, getShowsByProfile, getRsvpShows, rsvpShow, unrsvpShow } from '@/services/show.service';
import ProfileCalendarModal from '@/components/profile-calendar-modal';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ProfileShowsSection from '@/components/profile/shows-poster-section';
import CreateShowModal from '@/components/profile/create-show-modal';
import { renderBioWithLinks, profileStyles } from '../(tabs)/profile';

export const AVATAR_SIZE = 80;

export function BandProfile() {
    const router = useRouter();
    const { user, activeProfile, setActiveProfile } = useAuth();

    if (!activeProfile || activeProfile.accountType !== 'BAND') return null;
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
    const borderColor = useThemeColor({}, 'text');

    useFocusEffect(useCallback(() => {
        getShowsByProfile('band', band.id).then(setShows).catch(() => {});
        getShowsByProfile('band', band.id, true).then(setPastShows).catch(() => {});
        getRsvpShows('band', band.id).then(setRsvpShows).catch(() => {});
    }, [band.id]));

    const handleRsvp = async (show: Show) => {
        const hasRsvp = show.rsvpBands?.some(b => b.id === band.id);
        try {
            if (hasRsvp) await unrsvpShow(show.id, 'band', band.id);
            else await rsvpShow(show.id, 'band', band.id);
            getRsvpShows('band', band.id).then(setRsvpShows).catch(() => {});
            getShowsByProfile('band', band.id).then(setShows).catch(() => {});
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
                    <View style={profileStyles.pfpContainer}>
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
                        <ThemedText style={[profileStyles.metaText, { width: sideWidth }]}>
                            {band?.city && band?.state ? `${band.city}, ${band.state}` : ''}
                        </ThemedText>
                        <View style={{ width: AVATAR_SIZE }} />
                        <ThemedText style={[profileStyles.metaText, { width: sideWidth }]}>
                            {band?.genre ? `${band.genre}` : ''}
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
                        <TouchableOpacity style={profileStyles.actionButton} onPress={() => router.push('/settings')}>
                            <Ionicons name="settings-outline" size={22} color="white" />
                        </TouchableOpacity>
                    </View>

                    {/* divider */}
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
                        activeProfileId={band.id}
                        activeProfileType="band"
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
        </>
    );
}
