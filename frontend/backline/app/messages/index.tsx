import { useState, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { isConvUnread } from '@/utils/lastRead';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/context/AuthContext';
import { BASE_URL } from '@/services/api';
import { Fonts } from '@/constants/theme';
import {
    getMyConversations, getMyInvites, respondToInvite, leaveConversation,
    Conversation, ConversationInvite,
    getParticipantProfile, getInviteSender, getInviteRecipient,
    ParticipantType,
} from '@/services/conversation.service';

const FONT = Fonts?.rounded ?? undefined;

function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
}

// Stacked avatar: single circle for 1:1, two overlapping for groups
function ConvAvatar({ sources, bgColor }: { sources: (string | null | undefined)[], bgColor: string }) {
    const first = sources[0];
    const second = sources[1];
    const img1 = first ? { uri: `${BASE_URL}${first}` } : require('@/assets/images/default/profileImage.png');
    if (!second) {
        return <Image source={img1} style={styles.avatar} />;
    }
    const img2 = { uri: `${BASE_URL}${second}` };
    return (
        <View style={styles.avatarStack}>
            {/* back avatar — bottom-right */}
            <Image source={img2} style={[styles.avatarSmall, styles.avatarBack, { borderColor: bgColor }]} />
            {/* front avatar — top-left */}
            <Image source={img1} style={[styles.avatarSmall, styles.avatarFront, { borderColor: bgColor }]} />
        </View>
    );
}

export default function MessagesScreen() {
    const router = useRouter();
    const { activeProfile } = useAuth();
    const bgColor = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');
    const borderColor = useThemeColor({}, 'icon');

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [invites, setInvites] = useState<ConversationInvite[]>([]);
    const [loading, setLoading] = useState(true);

    const senderType = (
        activeProfile?.accountType === 'BAND'  ? 'BAND' :
        activeProfile?.accountType === 'VENUE' ? 'VENUE' : 'USER'
    ) as ParticipantType;
    const senderId = activeProfile?.id ?? '';

    const load = useCallback(() => {
        if (!activeProfile) return;
        setLoading(true);
        Promise.all([
            getMyConversations(senderType, senderId).catch(() => [] as Conversation[]),
            getMyInvites(senderType, senderId).catch(() => [] as ConversationInvite[]),
        ]).then(([convs, invs]) => {
            setConversations(convs);
            setInvites(invs);
        }).finally(() => setLoading(false));
    }, [activeProfile?.id]);

    useFocusEffect(load);

    const handleRespond = async (invite: ConversationInvite, action: 'ACCEPT' | 'DECLINE') => {
        await respondToInvite(invite.id, senderType, senderId, action).catch(console.error);
        load();
        if (action === 'ACCEPT' && invite.conversationId) {
            router.push(`/messages/${invite.conversationId}`);
        }
    };

    const handleDelete = async (convId: string) => {
        await leaveConversation(convId, senderType, senderId).catch(console.error);
        setConversations(prev => prev.filter(c => c.id !== convId));
    };

    const getOtherParticipants = (conv: Conversation) =>
        conv.participants
            .filter(p => getParticipantProfile(p)?.id !== senderId)
            .map(p => getParticipantProfile(p))
            .filter(Boolean);

    const getConvName = (conv: Conversation) => {
        if (conv.name) return conv.name;
        const others = getOtherParticipants(conv);
        if (others.length > 0) return others.map(p => p!.name).join(', ');
        // No other participants yet — outgoing pending invite
        const pendingInvite = conv.invites?.[0];
        if (pendingInvite) {
            const recipient = getInviteRecipient(pendingInvite);
            if (recipient) return recipient.name;
        }
        return 'Conversation';
    };

    // Returns up to 2 profileImageUrl strings for stacked avatar rendering
    const getConvAvatarSources = (conv: Conversation): (string | null | undefined)[] => {
        const others = getOtherParticipants(conv);
        if (others.length > 0) return others.slice(0, 2).map(p => p!.profileImageUrl);
        const pendingInvite = conv.invites?.[0];
        if (pendingInvite) {
            const recipient = getInviteRecipient(pendingInvite);
            return [recipient?.profileImageUrl];
        }
        return [null];
    };

    const isUnread = (conv: Conversation) => isConvUnread(conv, senderType, senderId);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={styles.headerRow}>
                <ThemedText style={[styles.title, FONT && { fontFamily: FONT }]}>Messages</ThemedText>
                <TouchableOpacity onPress={() => router.push('/messages/compose')} style={styles.composeBtn}>
                    <Ionicons name="create-outline" size={26} color={textColor} />
                </TouchableOpacity>
            </View>

            {loading && <ActivityIndicator style={{ marginTop: 32 }} />}

            {!loading && invites.length === 0 && conversations.length === 0 && (
                <ThemedText style={[styles.empty, FONT && { fontFamily: FONT }]}>
                    No messages yet.
                </ThemedText>
            )}

            {!loading && (
                <FlatList
                    data={[]}
                    renderItem={null}
                    keyExtractor={() => ''}
                    ListHeaderComponent={
                        <>
                            {/* Pending invites */}
                            {invites.length > 0 && (
                                <>
                                    <ThemedText style={[styles.sectionLabel, FONT && { fontFamily: FONT }]}>
                                        REQUESTS
                                    </ThemedText>
                                    {invites.map(invite => {
                                        const sender = getInviteSender(invite);
                                        const conv = invite.conversation;
                                        const convName = conv?.name;

                                        // Collect all participant names (accepted + pending invitees), excluding me
                                        const participantNames: string[] = [];
                                        conv?.participants?.forEach(p => {
                                            const n = p.user?.name ?? p.band?.name ?? p.venue?.name;
                                            if (n) participantNames.push(n);
                                        });
                                        conv?.invites?.forEach(inv => {
                                            const n = inv.recipientUser?.name ?? inv.recipientBand?.name ?? inv.recipientVenue?.name;
                                            if (n && !participantNames.includes(n)) participantNames.push(n);
                                        });
                                        const withLine = participantNames.length > 0 ? `with ${participantNames.join(', ')}` : null;
                                        const isGroup = participantNames.length > 1 || !!convName;
                                        const displayName = convName ?? sender?.name ?? 'Unknown';

                                        return (
                                            <View key={invite.id} style={[styles.inviteCard, { borderColor: borderColor + '44' }]}>
                                                <Image
                                                    source={sender?.profileImageUrl
                                                        ? { uri: `${BASE_URL}${sender.profileImageUrl}` }
                                                        : require('@/assets/images/default/profileImage.png')}
                                                    style={styles.avatar}
                                                />
                                                <View style={styles.inviteBody}>
                                                    <ThemedText style={[styles.name, FONT && { fontFamily: FONT }]}>
                                                        {displayName}
                                                    </ThemedText>
                                                    {isGroup && withLine && (
                                                        <ThemedText style={[styles.preview, FONT && { fontFamily: FONT }]}>
                                                            {withLine}
                                                        </ThemedText>
                                                    )}
                                                    {invite.message ? (
                                                        <ThemedText style={[styles.preview, FONT && { fontFamily: FONT }]} numberOfLines={1}>
                                                            {invite.message}
                                                        </ThemedText>
                                                    ) : null}
                                                    <View style={styles.inviteActions}>
                                                        <TouchableOpacity
                                                            style={styles.acceptBtn}
                                                            onPress={() => handleRespond(invite, 'ACCEPT')}
                                                        >
                                                            <ThemedText style={[styles.acceptText, FONT && { fontFamily: FONT }]}>Accept</ThemedText>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={[styles.declineBtn, { borderColor: borderColor + '66' }]}
                                                            onPress={() => handleRespond(invite, 'DECLINE')}
                                                        >
                                                            <ThemedText style={[styles.declineText, FONT && { fontFamily: FONT }]}>Decline</ThemedText>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </>
                            )}

                            {/* Conversations */}
                            {conversations.length > 0 && invites.length > 0 && (
                                <ThemedText style={[styles.sectionLabel, FONT && { fontFamily: FONT }]}>
                                    MESSAGES
                                </ThemedText>
                            )}
                            {conversations.map(conv => {
                                const lastMsg = conv.messages[0];
                                const unread = isUnread(conv);
                                return (
                                    <Swipeable
                                        key={conv.id}
                                        renderRightActions={() => (
                                            <TouchableOpacity
                                                style={styles.deleteAction}
                                                onPress={() => handleDelete(conv.id)}
                                            >
                                                <ThemedText style={styles.deleteText}>Delete</ThemedText>
                                            </TouchableOpacity>
                                        )}
                                    >
                                        <TouchableOpacity
                                            style={[styles.convRow, { borderBottomColor: borderColor + '22', backgroundColor: bgColor }]}
                                            onPress={() => router.push(`/messages/${conv.id}`)}
                                        >
                                            <ConvAvatar sources={getConvAvatarSources(conv)} bgColor={bgColor} />
                                            <View style={styles.convBody}>
                                                <ThemedText style={[styles.name, unread && styles.nameUnread, FONT && { fontFamily: FONT }]}>
                                                    {getConvName(conv)}
                                                </ThemedText>
                                                {lastMsg ? (
                                                    <ThemedText style={[styles.preview, unread && styles.previewUnread, FONT && { fontFamily: FONT }]} numberOfLines={1}>
                                                        {lastMsg.content}
                                                    </ThemedText>
                                                ) : (
                                                    <ThemedText style={[styles.preview, FONT && { fontFamily: FONT }]} numberOfLines={1}>
                                                        Pending...
                                                    </ThemedText>
                                                )}
                                            </View>
                                            <View style={styles.convMeta}>
                                                {lastMsg && (
                                                    <ThemedText style={[styles.time, FONT && { fontFamily: FONT }]}>
                                                        {timeAgo(lastMsg.createdAt)}
                                                    </ThemedText>
                                                )}
                                                {unread && <View style={styles.unreadDot} />}
                                            </View>
                                        </TouchableOpacity>
                                    </Swipeable>
                                );
                            })}
                        </>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 16 },
    title: { fontSize: 28, fontWeight: '700' },
    composeBtn: { padding: 4 },
    empty: { textAlign: 'center', marginTop: 40, opacity: 0.4 },
    sectionLabel: {
        fontSize: 11, fontWeight: '700', opacity: 0.4,
        textTransform: 'uppercase', letterSpacing: 0.8,
        marginTop: 8, marginBottom: 6,
    },
    inviteCard: {
        flexDirection: 'row',
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
        gap: 10,
    },
    inviteBody: { flex: 1 },
    inviteActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
    acceptBtn: {
        backgroundColor: '#4A90D9',
        borderRadius: 6,
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    acceptText: { color: '#fff', fontWeight: '600', fontSize: 13 },
    declineBtn: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 6,
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    declineText: { fontSize: 13, opacity: 0.6 },
    convRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 12,
    },
    convBody: { flex: 1 },
    convMeta: { alignItems: 'flex-end', gap: 4 },
    avatar: { width: 44, height: 44, borderRadius: 22 },
    avatarStack: { width: 44, height: 44, position: 'relative' },
    avatarSmall: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, position: 'absolute' },
    avatarFront: { top: 0, left: 0 },
    avatarBack: { bottom: 0, right: 0 },
    name: { fontSize: 15, fontWeight: '500' },
    nameUnread: { fontWeight: '700' },
    preview: { fontSize: 13, opacity: 0.5, marginTop: 2 },
    previewUnread: { opacity: 0.9 },
    time: { fontSize: 11, opacity: 0.4 },
    unreadDot: {
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: '#4A90D9',
    },
    deleteAction: {
        backgroundColor: '#FF3B30',
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
    },
    deleteText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
