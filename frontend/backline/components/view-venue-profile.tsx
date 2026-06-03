import { Image } from 'expo-image';
import { View, Text, StyleSheet, useWindowDimensions, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { BASE_URL } from '@/services/api';
import api from '@/services/api';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { renderBioWithLinks, profileStyles } from '@/app/(tabs)/profile/index';
import * as followService from '@/services/follow.service';
import { Show, getShowsByProfile, repostShow, unrepostShow, getRsvpShows, rsvpShow, unrsvpShow } from '@/services/show.service';
import { getMyConversations, createConversation, getParticipantProfile, ParticipantType } from '@/services/conversation.service';
import ProfileShowsSection from '@/components/profile/shows-poster-section';
import ProfileCalendarModal from '@/components/profile-calendar-modal';

const AVATAR_SIZE = 80;

interface Props {
    id: string;
}

export default function ViewVenueProfile({ id }: Props) {
    const router = useRouter();
    const { activeProfile } = useAuth();
    const { width } = useWindowDimensions();
    const sideWidth = (width - AVATAR_SIZE) / 2;
    const borderColor = useThemeColor({}, 'text');

    const [venue, setVenue] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
    const [webViewUrl, setWebViewUrl] = useState<string | null>(null);
    const [shows, setShows] = useState<Show[]>([]);
    const [pastShows, setPastShows] = useState<Show[]>([]);
    const [showingPast, setShowingPast] = useState(false);
    const [showView, setShowView] = useState<'poster' | 'list'>('poster');
    const [viewerRsvpShows, setViewerRsvpShows] = useState<Show[]>([]);
    const [calendarVisible, setCalendarVisible] = useState(false);

    const followerType = activeProfile?.accountType as 'USER' | 'BAND' | 'VENUE';
    const followerBandId = followerType === 'BAND' ? activeProfile?.id : undefined;
    const followerVenueId = followerType === 'VENUE' ? activeProfile?.id : undefined;

    const activeProfileType =
        followerType === 'BAND' ? 'band' :
        followerType === 'VENUE' ? 'venue' : 'user';

    useEffect(() => {
        const load = async () => {
            try {
                const venueRes = await api.get(`/venues/${id}`);
                setVenue(venueRes.data);
                const following = await followService.checkFollowing(followerType, 'VENUE', id, followerBandId, followerVenueId);
                setIsFollowing(following);
            } catch (e) {
                console.error('ViewVenueProfile load error:', e);
            } finally {
                setLoading(false);
            }
        };
        if (id) load();
    }, [id]);

    useEffect(() => {
        if (!id) return;
        getShowsByProfile('venue', id).then(setShows).catch(() => {});
        getShowsByProfile('venue', id, true).then(setPastShows).catch(() => {});
        if (activeProfile) getRsvpShows(activeProfileType, activeProfile.id).then(setViewerRsvpShows).catch(() => {});
    }, [id]);

    const handleFollowToggle = async () => {
        if (!id || followLoading) return;
        setFollowLoading(true);
        try {
            if (isFollowing) {
                await followService.unfollow(followerType, 'VENUE', id, followerBandId, followerVenueId);
                setIsFollowing(false);
            } else {
                await followService.follow(followerType, 'VENUE', id, followerBandId, followerVenueId);
                setIsFollowing(true);
            }
        } catch (e) {
            console.error('Follow toggle error:', e);
        } finally {
            setFollowLoading(false);
        }
    };

    const handleMessage = async () => {
        if (!activeProfile || !id) return;
        const senderType = activeProfileType.toUpperCase() as ParticipantType;
        try {
            const convs = await getMyConversations(senderType, activeProfile.id);
            const existing = convs.find(c =>
                c.participants.some(p => getParticipantProfile(p)?.id === id)
            );
            if (existing) {
                router.push(`/messages/${existing.id}`);
            } else {
                router.push({
                    pathname: '/messages/new',
                    params: { recipientType: 'VENUE', recipientId: id, recipientName: venue?.name ?? '' },
                });
            }
        } catch (e) { console.error(e); }
    };

    const handleRsvp = async (show: Show) => {
        if (!activeProfile) return;
        const hasRsvp =
            activeProfileType === 'band'  ? show.rsvpBands?.some(b => b.id === activeProfile.id) :
            activeProfileType === 'venue' ? show.rsvpVenues?.some(v => v.id === activeProfile.id) :
                                            show.rsvpUsers?.some(u => u.id === activeProfile.id);
        try {
            if (hasRsvp) await unrsvpShow(show.id, activeProfileType, followerBandId, followerVenueId);
            else await rsvpShow(show.id, activeProfileType, followerBandId, followerVenueId);
            const [fresh, freshPast] = await Promise.all([
                getShowsByProfile('venue', id),
                getShowsByProfile('venue', id, true),
            ]);
            setShows(fresh);
            setPastShows(freshPast);
            getRsvpShows(activeProfileType, activeProfile.id).then(setViewerRsvpShows).catch(() => {});
        } catch (e) { console.error('RSVP error:', e); }
    };

    const handleRepost = async (show: Show) => {
        if (!activeProfile) return;
        const hasReposted =
            activeProfileType === 'band'
                ? show.repostedByBands?.some(b => b.id === activeProfile.id)
                : activeProfileType === 'venue'
                ? show.repostedByVenues?.some(v => v.id === activeProfile.id)
                : show.repostedByUsers?.some(u => u.id === activeProfile.id);
        try {
            if (hasReposted) {
                await unrepostShow(show.id, activeProfileType, followerBandId, followerVenueId);
            } else {
                await repostShow(show.id, activeProfileType, followerBandId, followerVenueId);
            }
            const [fresh, freshPast] = await Promise.all([
                getShowsByProfile('venue', id),
                getShowsByProfile('venue', id, true),
            ]);
            setShows(fresh);
            setPastShows(freshPast);
        } catch (e) {
            console.error('Repost error:', e);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator />
            </SafeAreaView>
        );
    }

    if (!venue) return null;

    const profilePicture = venue.profileImageUrl
        ? { uri: `${BASE_URL}${venue.profileImageUrl}` }
        : require('@/assets/images/default/profileImage.png');

    const headerImage = venue.headerImageUrl
        ? { uri: `${BASE_URL}${venue.headerImageUrl}` }
        : require('@/assets/images/default/headerImage.png');

    return (
        <View style={{ flex: 1 }}>
            <ParallaxScrollView
                headerHeight={160}
                headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
                headerImage={<Image source={headerImage} style={{ width: '100%', height: 250 }} />}
            >
                <>
                    <View style={profileStyles.pfpContainer}>
                        <View style={[profileStyles.pfpWrapper, { borderColor }]}>
                            <Image source={profilePicture} style={{ width: '100%', height: '100%' }} />
                        </View>
                    </View>

                    <View style={profileStyles.metaRow}>
                        <ThemedText style={[profileStyles.metaText, { width: sideWidth }]}>
                            {venue.city && venue.state ? `${venue.city}, ${venue.state}` : ''}
                        </ThemedText>
                        <View style={{ width: AVATAR_SIZE }} />
                        <ThemedText style={[profileStyles.metaText, { width: sideWidth }]}>
                            {venue.address ?? ''}
                        </ThemedText>
                    </View>

                    <Text numberOfLines={1} adjustsFontSizeToFit style={[profileStyles.name, { maxWidth: width - 64 }]}>
                        {venue.name}
                    </Text>

                    {venue.bio ? (
                        <View style={profileStyles.bioRow}>
                            {renderBioWithLinks(venue.bio, setWebViewUrl)}
                        </View>
                    ) : null}

                    <View style={profileStyles.actionRow}>
                        <TouchableOpacity
                            style={[profileStyles.actionButton, isFollowing && styles.followingButton]}
                            onPress={handleFollowToggle}
                            disabled={followLoading}
                        >
                            <Ionicons name={isFollowing ? 'checkmark' : 'person-add-outline'} size={22} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity style={profileStyles.actionButton} onPress={() => console.log('Share')}>
                            <Ionicons name="share-outline" size={22} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity style={profileStyles.actionButton} onPress={handleMessage}>
                            <Ionicons name="chatbubble-outline" size={22} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity style={profileStyles.actionButton} onPress={() => setCalendarVisible(true)}>
                            <Ionicons name="calendar-outline" size={22} color="white" />
                        </TouchableOpacity>
                    </View>

                    <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: '#616161', marginHorizontal: -32, marginTop: 4, marginBottom: 12 }} />

                    <ProfileShowsSection
                        showView={showView}
                        setShowView={setShowView}
                        shows={shows}
                        pastShows={pastShows}
                        showingPast={showingPast}
                        isOwner={false}
                        onSeePastShows={() => setShowingPast(true)}
                        onCreateShow={() => {}}
                        onEditShow={() => {}}
                        activeProfileId={activeProfile?.id}
                        activeProfileType={activeProfileType}
                        onRepost={handleRepost}
                        onRsvp={handleRsvp}
                    />
                </>
            </ParallaxScrollView>

            <ProfileCalendarModal
                visible={calendarVisible}
                onClose={() => setCalendarVisible(false)}
                profileShows={[...shows, ...pastShows]}
                rsvpShows={viewerRsvpShows}
                isOwnProfile={false}
                activeProfileId={activeProfile?.id ?? ''}
                activeProfileType={activeProfileType}
                onRsvpToggle={handleRsvp}
            />

            <Modal visible={webViewUrl !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setWebViewUrl(null)}>
                <SafeAreaView style={profileStyles.modalContainer}>
                    <View style={profileStyles.modalHeader}>
                        <ThemedText style={profileStyles.modalUrl} numberOfLines={1}>
                            {webViewUrl?.replace(/^https?:\/\//, '')}
                        </ThemedText>
                        <TouchableOpacity onPress={() => setWebViewUrl(null)}>
                            <ThemedText style={profileStyles.closeText}>Done</ThemedText>
                        </TouchableOpacity>
                    </View>
                    {webViewUrl && <WebView source={{ uri: webViewUrl }} style={profileStyles.webView} />}
                </SafeAreaView>
            </Modal>

            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={28} color="white" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    followingButton: { backgroundColor: '#444' },
    backButton: {
        position: 'absolute',
        top: 52,
        left: 16,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
