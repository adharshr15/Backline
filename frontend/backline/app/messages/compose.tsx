import { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, TextInput, TouchableOpacity, StyleSheet,
    FlatList, ScrollView, Image, ActivityIndicator,
    KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTabHref } from '@/hooks/use-tab-href';
import { useAuth } from '@/context/AuthContext';
import { BASE_URL } from '@/services/api';
import api from '@/services/api';
import { Fonts } from '@/constants/theme';
import {
    getMyConversations, getMessages, sendMessage, createGroupConversation,
    findDirectConversation, getMessageSender, resolveAttachment, attachmentToRef,
    Conversation, Message, Recipient, ParticipantType,
    MessageAttachment, AttachmentKind,
} from '@/services/conversation.service';
import { StagedAttachmentBanner } from '@/components/message-attachment';

const FONT = Fonts?.rounded ?? undefined;

interface SearchResult {
    id: string;
    name: string;
    subtitle: string;
    profileImageUrl?: string | null;
    accountType: string;
}

interface SelectedRecipient {
    id: string;
    name: string;
    type: ParticipantType;
    profileImageUrl?: string | null;
}

export default function ComposeScreen() {
    const { recipientType, recipientId, recipientName, attachmentType, attachmentId } = useLocalSearchParams<{
        recipientType?: string;
        recipientId?: string;
        recipientName?: string;
        attachmentType?: string;
        attachmentId?: string;
    }>();
    const router = useRouter();
    const tabHref = useTabHref();
    const { activeProfile } = useAuth();
    const bgColor = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');
    const borderColor = useThemeColor({}, 'icon');
    const insets = useSafeAreaInsets();
    const listRef = useRef<FlatList>(null);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const HEADER_H = 52 + insets.top;

    const senderType = (
        activeProfile?.accountType === 'BAND'  ? 'BAND' :
        activeProfile?.accountType === 'VENUE' ? 'VENUE' : 'USER'
    ) as ParticipantType;
    const senderId = activeProfile?.id ?? '';

    const [selected, setSelected] = useState<SelectedRecipient[]>(() => {
        if (recipientId && recipientName && recipientType) {
            return [{ id: recipientId, name: recipientName, type: recipientType as ParticipantType }];
        }
        return [];
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [messageText, setMessageText] = useState('');
    const [sending, setSending] = useState(false);
    const [pendingAttachment, setPendingAttachment] = useState<MessageAttachment | null>(null);

    // Resolve a staged attachment passed in via params (e.g. from "Message Lister")
    useEffect(() => {
        if (!attachmentType || !attachmentId) return;
        resolveAttachment(attachmentType as AttachmentKind, attachmentId)
            .then(setPendingAttachment)
            .catch(() => {});
    }, [attachmentType, attachmentId]);

    // Existing 1:1 conversation detection
    const [existingConv, setExistingConv] = useState<Conversation | null>(null);
    const [previewMessages, setPreviewMessages] = useState<Message[]>([]);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [allConvs, setAllConvs] = useState<Conversation[]>([]);

    useEffect(() => {
        getMyConversations(senderType, senderId).then(setAllConvs).catch(() => {});
    }, [senderId]);

    // Detect existing 1:1 when selection changes
    useEffect(() => {
        if (selected.length !== 1) {
            setExistingConv(null);
            setPreviewMessages([]);
            return;
        }
        const recipId = selected[0].id;
        const match = findDirectConversation(allConvs, senderId, recipId);
        if (match) {
            setExistingConv(match);
            setPreviewLoading(true);
            getMessages(match.id, senderType, senderId)
                .then(setPreviewMessages)
                .catch(() => {})
                .finally(() => setPreviewLoading(false));
        } else {
            setExistingConv(null);
            setPreviewMessages([]);
        }
    }, [selected, allConvs]);

    const runSearch = useCallback(async (q: string) => {
        if (!q.trim()) { setSearchResults([]); return; }
        setSearching(true);
        try {
            // /search returns an envelope: { results, counts, page, limit, hasMore }.
            const res = await api.get('/search', { params: { q, type: 'user,band,venue' } });
            const selectedIds = new Set(selected.map(s => s.id));
            selectedIds.add(senderId);
            setSearchResults((res.data.results as SearchResult[]).filter(r => !selectedIds.has(r.id)));
        } catch { setSearchResults([]); }
        finally { setSearching(false); }
    }, [selected, senderId]);

    const handleSearchChange = (text: string) => {
        setSearchQuery(text);
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => runSearch(text), 300);
    };

    const addRecipient = (r: SearchResult) => {
        setSelected(prev => [...prev, { id: r.id, name: r.name, type: r.accountType as ParticipantType, profileImageUrl: r.profileImageUrl }]);
        setSearchQuery('');
        setSearchResults([]);
    };

    const removeRecipient = (id: string) => {
        setSelected(prev => prev.filter(s => s.id !== id));
    };

    const isMine = (msg: Message) =>
        (senderType === 'USER'  && msg.senderUserId  === senderId) ||
        (senderType === 'BAND'  && msg.senderBandId  === senderId) ||
        (senderType === 'VENUE' && msg.senderVenueId === senderId);

    const handleSend = async () => {
        if (!messageText.trim() || sending || selected.length === 0) return;
        setSending(true);
        const attachmentRef = pendingAttachment ? attachmentToRef(pendingAttachment) : undefined;
        try {
            if (existingConv) {
                await sendMessage(existingConv.id, senderType, senderId, messageText.trim(), attachmentRef);
                router.replace(tabHref(`messages/${existingConv.id}`));
            } else {
                const recipients: Recipient[] = selected.map(s => ({ type: s.type, id: s.id }));
                const conv = await createGroupConversation(senderType, senderId, recipients, messageText.trim(), groupName.trim() || undefined, attachmentRef);
                router.replace(tabHref(`messages/${conv.id}`));
            }
        } catch (e) { console.error(e); }
        finally { setSending(false); }
    };

    const isGroup = selected.length >= 2;

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
                <ThemedText style={[styles.headerTitle, FONT && { fontFamily: FONT }]}>
                    New Message
                </ThemedText>
                <View style={{ width: 40 }} />
            </View>

            {/* To: chip row + search input */}
            <View style={[styles.toRow, { borderBottomColor: borderColor + '33' }]}>
                <ThemedText style={[styles.toLabel, FONT && { fontFamily: FONT }]}>To:</ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipContent}>
                    {selected.map(s => (
                        <TouchableOpacity key={s.id} style={[styles.chip, { backgroundColor: '#4A90D9' }]} onPress={() => removeRecipient(s.id)}>
                            <ThemedText style={[styles.chipText, FONT && { fontFamily: FONT }]}>{s.name}</ThemedText>
                            <Ionicons name="close" size={13} color="#fff" style={{ marginLeft: 3 }} />
                        </TouchableOpacity>
                    ))}
                    <TextInput
                        style={[styles.chipInput, { color: textColor }]}
                        placeholder={selected.length === 0 ? 'Search accounts...' : ''}
                        placeholderTextColor={borderColor}
                        value={searchQuery}
                        onChangeText={handleSearchChange}
                        autoCapitalize="none"
                        fontFamily={FONT}
                    />
                </ScrollView>
            </View>

            {/* Group name — only when 2+ recipients */}
            {isGroup && (
                <View style={[styles.groupNameRow, { borderBottomColor: borderColor + '22' }]}>
                    <TextInput
                        style={[styles.groupNameInput, { color: textColor }]}
                        placeholder="Group name (optional)"
                        placeholderTextColor={borderColor}
                        value={groupName}
                        onChangeText={setGroupName}
                        fontFamily={FONT}
                    />
                </View>
            )}

            {/* Search results dropdown — overlays body */}
            {(searchResults.length > 0 || searching) && (
                <View style={[styles.dropdown, { backgroundColor: bgColor, borderColor: borderColor + '33' }]}>
                    {searching && <ActivityIndicator style={{ padding: 8 }} />}
                    {searchResults.map(r => (
                        <TouchableOpacity key={r.id} style={[styles.dropdownItem, { borderBottomColor: borderColor + '22' }]} onPress={() => addRecipient(r)}>
                            <Image
                                source={r.profileImageUrl
                                    ? { uri: `${BASE_URL}${r.profileImageUrl}` }
                                    : require('@/assets/images/default/profileImage.png')}
                                style={styles.dropdownAvatar}
                            />
                            <View style={{ flex: 1 }}>
                                <ThemedText style={[styles.dropdownName, FONT && { fontFamily: FONT }]}>{r.name}</ThemedText>
                                <ThemedText style={[styles.dropdownSub, FONT && { fontFamily: FONT }]}>{r.subtitle}</ThemedText>
                            </View>
                            <ThemedText style={[styles.dropdownType, FONT && { fontFamily: FONT }]}>{r.accountType}</ThemedText>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Message body */}
            <View style={styles.body}>
                {selected.length === 0 && (
                    <ThemedText style={[styles.emptyHint, FONT && { fontFamily: FONT }]}>
                        Search for someone to message
                    </ThemedText>
                )}
                {selected.length > 0 && !isGroup && existingConv && (
                    previewLoading
                        ? <ActivityIndicator style={{ marginTop: 24 }} />
                        : <FlatList
                            ref={listRef}
                            data={previewMessages}
                            keyExtractor={m => m.id}
                            contentContainerStyle={styles.messageList}
                            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                            renderItem={({ item: msg, index }) => {
                                const mine = isMine(msg);
                                const sender = getMessageSender(msg);
                                const prevMsg = previewMessages[index - 1];
                                const showAvatar = !mine && (prevMsg ? isMine(prevMsg) : true);
                                return (
                                    <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                                        {!mine && (
                                            <Image
                                                source={sender?.profileImageUrl
                                                    ? { uri: `${BASE_URL}${sender.profileImageUrl}` }
                                                    : require('@/assets/images/default/profileImage.png')}
                                                style={[styles.bubbleAvatar, !showAvatar && { opacity: 0 }]}
                                            />
                                        )}
                                        <View style={[styles.bubble, mine
                                            ? [styles.bubbleMine, { backgroundColor: '#4A90D9' }]
                                            : [styles.bubbleTheirs, { backgroundColor: borderColor + '22' }]]}>
                                            <ThemedText style={[styles.bubbleText, mine && { color: '#fff' }, FONT && { fontFamily: FONT }]}>
                                                {msg.content}
                                            </ThemedText>
                                        </View>
                                    </View>
                                );
                            }}
                        />
                )}
                {selected.length > 0 && (isGroup || !existingConv) && (
                    <ThemedText style={[styles.emptyHint, FONT && { fontFamily: FONT }]}>
                        {isGroup ? 'Start a group conversation' : `Start a conversation with ${selected[0]?.name}`}
                    </ThemedText>
                )}
            </View>

            {/* Staged attachment preview */}
            {pendingAttachment && (
                <StagedAttachmentBanner attachment={pendingAttachment} onClear={() => setPendingAttachment(null)} />
            )}

            {/* Input bar */}
            <View style={[styles.inputRow, {
                borderTopColor: borderColor + '33',
                backgroundColor: bgColor,
                paddingBottom: insets.bottom || 12,
            }]}>
                <TextInput
                    style={[styles.input, { color: textColor, borderColor: borderColor + '55' }]}
                    placeholder="Message..."
                    placeholderTextColor={borderColor}
                    value={messageText}
                    onChangeText={setMessageText}
                    multiline
                    maxLength={1000}
                    fontFamily={FONT}
                    editable={selected.length > 0}
                />
                <TouchableOpacity
                    style={[styles.sendBtn, (!messageText.trim() || sending || selected.length === 0) && styles.sendBtnDisabled]}
                    onPress={handleSend}
                    disabled={!messageText.trim() || sending || selected.length === 0}
                >
                    {sending
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Ionicons name="arrow-up" size={20} color="#fff" />
                    }
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
    toRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        minHeight: 48,
    },
    toLabel: { fontSize: 15, fontWeight: '600', marginRight: 8, opacity: 0.6 },
    chipScroll: { flex: 1 },
    chipContent: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'nowrap' },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    chipText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    chipInput: { fontSize: 15, minWidth: 120, paddingVertical: 4 },
    groupNameRow: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    groupNameInput: { fontSize: 15 },
    dropdown: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderWidth: 0,
        maxHeight: 220,
        zIndex: 10,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        gap: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    dropdownAvatar: { width: 36, height: 36, borderRadius: 18 },
    dropdownName: { fontSize: 14, fontWeight: '600' },
    dropdownSub: { fontSize: 12, opacity: 0.5 },
    dropdownType: { fontSize: 11, opacity: 0.4, textTransform: 'uppercase' },
    body: { flex: 1, justifyContent: 'center' },
    emptyHint: { textAlign: 'center', opacity: 0.35, fontSize: 14 },
    messageList: { padding: 12, paddingBottom: 4, gap: 4 },
    bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 2 },
    bubbleRowMine: { justifyContent: 'flex-end' },
    bubbleRowTheirs: { justifyContent: 'flex-start' },
    bubbleAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 6 },
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
});
