import { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, FlatList, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from 'react-native';
import { markRead } from '@/services/conversation.service';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/context/AuthContext';
import { BASE_URL } from '@/services/api';
import { Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import {
    getMessages, sendMessage, getMyConversations,
    Message, getMessageSender, getParticipantProfile,
    ParticipantType,
} from '@/services/conversation.service';

const FONT = Fonts?.rounded ?? undefined;

export default function ConversationScreen() {
    const { id: conversationId } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { activeProfile } = useAuth();
    const bgColor = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');
    const borderColor = useThemeColor({}, 'icon');
    const insets = useSafeAreaInsets();
    const listRef = useRef<FlatList>(null);

    const [messages, setMessages] = useState<Message[]>([]);
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [title, setTitle] = useState('');
    const [isGroup, setIsGroup] = useState(false);

    const HEADER_H = 52 + insets.top;

    const senderType = (
        activeProfile?.accountType === 'BAND'  ? 'BAND' :
        activeProfile?.accountType === 'VENUE' ? 'VENUE' : 'USER'
    ) as ParticipantType;
    const senderId = activeProfile?.id ?? '';

    const loadMessages = useCallback(async () => {
        if (!conversationId) return;
        try {
            const msgs = await getMessages(conversationId, senderType, senderId);
            setMessages(msgs);
        } catch (e) { console.error(e); }
    }, [conversationId, senderId]);

    useEffect(() => {
        if (!conversationId) return;
        setLoading(true);
        getMyConversations(senderType, senderId).then(convs => {
            const conv = convs.find(c => c.id === conversationId);
            if (conv) {
                if (conv.name) {
                    setTitle(conv.name);
                } else {
                    const others = conv.participants
                        .map(p => getParticipantProfile(p))
                        .filter(p => p && p.id !== senderId);
                    setTitle(others.map(p => p!.name).join(', ') || 'Conversation');
                }
                // group = more than just me + one other
                setIsGroup(conv.participants.length > 2);
            }
        }).catch(() => {});
        loadMessages().finally(() => setLoading(false));
        markRead(conversationId, senderType, senderId).catch(() => {});
    }, [conversationId]);

    useEffect(() => {
        const interval = setInterval(loadMessages, 5000);
        return () => clearInterval(interval);
    }, [loadMessages]);

    const handleSend = async () => {
        if (!text.trim() || sending || !conversationId) return;
        setSending(true);
        try {
            const msg = await sendMessage(conversationId, senderType, senderId, text.trim());
            setMessages(prev => [...prev, msg]);
            setText('');
            markRead(conversationId, senderType, senderId).catch(() => {});
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        } catch (e) { console.error(e); }
        finally { setSending(false); }
    };

    const isMine = (msg: Message) =>
        (senderType === 'USER'  && msg.senderUserId  === senderId) ||
        (senderType === 'BAND'  && msg.senderBandId  === senderId) ||
        (senderType === 'VENUE' && msg.senderVenueId === senderId);

    return (
        <KeyboardAvoidingView
            style={[styles.root, { backgroundColor: bgColor }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={HEADER_H}
        >
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: borderColor + '33' }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={26} color={textColor} />
                </TouchableOpacity>
                <ThemedText style={[styles.headerTitle, FONT && { fontFamily: FONT }]} numberOfLines={1}>
                    {title}
                </ThemedText>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <ActivityIndicator style={{ flex: 1 }} />
            ) : (
                <FlatList
                    ref={listRef}
                    data={messages}
                    keyExtractor={m => m.id}
                    contentContainerStyle={styles.messageList}
                    onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                    renderItem={({ item: msg, index }) => {
                        // System messages render as centered grey text
                        if (msg.isSystemMessage) {
                            return (
                                <View style={styles.systemMsgWrap}>
                                    <ThemedText style={[styles.systemMsg, FONT && { fontFamily: FONT }]}>
                                        {msg.content}
                                    </ThemedText>
                                </View>
                            );
                        }

                        const mine = isMine(msg);
                        const sender = getMessageSender(msg);
                        const prevMsg = messages[index - 1];
                        const prevMine = prevMsg ? isMine(prevMsg) : null;
                        const showAvatar = !mine && prevMine !== false;

                        return (
                            <View style={mine ? styles.bubbleRowMine : styles.bubbleRowTheirs}>
                                {/* Sender name for group chats */}
                                {!mine && isGroup && showAvatar && sender?.name && (
                                    <ThemedText style={[styles.senderName, FONT && { fontFamily: FONT }]}>
                                        {sender.name}
                                    </ThemedText>
                                )}
                                <View style={[styles.bubbleRow, mine ? styles.bubbleRowInner : styles.bubbleRowTheirs]}>
                                    {!mine && (
                                        <Image
                                            source={sender?.profileImageUrl
                                                ? { uri: `${BASE_URL}${sender.profileImageUrl}` }
                                                : require('@/assets/images/default/profileImage.png')}
                                            style={[styles.bubbleAvatar, !showAvatar && styles.avatarHidden]}
                                        />
                                    )}
                                    <View style={[
                                        styles.bubble,
                                        mine
                                            ? [styles.bubbleMine, { backgroundColor: '#4A90D9' }]
                                            : [styles.bubbleTheirs, { backgroundColor: borderColor + '22' }],
                                    ]}>
                                        <ThemedText style={[
                                            styles.bubbleText,
                                            mine && { color: '#fff' },
                                            FONT && { fontFamily: FONT },
                                        ]}>
                                            {msg.content}
                                        </ThemedText>
                                    </View>
                                </View>
                            </View>
                        );
                    }}
                />
            )}

            {/* Input bar — always at bottom, above keyboard when open */}
            <View style={[styles.inputRow, {
                borderTopColor: borderColor + '33',
                backgroundColor: bgColor,
                paddingBottom: insets.bottom || 12,
            }]}>
                <TextInput
                    style={[styles.input, { color: textColor, borderColor: borderColor + '55' }]}
                    placeholder="Message..."
                    placeholderTextColor={borderColor}
                    value={text}
                    onChangeText={setText}
                    multiline
                    maxLength={1000}
                    fontFamily={FONT}
                />
                <TouchableOpacity
                    style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
                    onPress={handleSend}
                    disabled={!text.trim() || sending}
                >
                    <Ionicons name="arrow-up" size={20} color="#fff" />
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingBottom: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    backBtn: { width: 40, alignItems: 'flex-start', paddingLeft: 4 },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700' },
    messageList: { padding: 12, paddingBottom: 4, gap: 4 },
    bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 2 },
    bubbleRowInner: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end' },
    bubbleRowMine: { alignItems: 'flex-end', marginBottom: 2 },
    bubbleRowTheirs: { alignItems: 'flex-start', marginBottom: 2 },
    senderName: { fontSize: 11, opacity: 0.5, marginLeft: 36, marginBottom: 2 },
    bubbleAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 6 },
    avatarHidden: { opacity: 0 },
    bubble: { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
    bubbleMine: { borderBottomRightRadius: 4 },
    bubbleTheirs: { borderBottomLeftRadius: 4 },
    bubbleText: { fontSize: 15, lineHeight: 20 },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 10,
        paddingTop: 8,
        gap: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 8,
        fontSize: 15,
        maxHeight: 100,
    },
    sendBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#4A90D9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.4 },
    systemMsgWrap: { alignItems: 'center', marginVertical: 10 },
    systemMsg: { fontSize: 13, color: '#888', fontStyle: 'italic' },
});
