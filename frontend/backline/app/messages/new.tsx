import { useState } from 'react';
import {
    View, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/context/AuthContext';
import { Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { createConversation, ParticipantType } from '@/services/conversation.service';

const FONT = Fonts?.rounded ?? undefined;

export default function NewMessageScreen() {
    const { recipientType, recipientId, recipientName } = useLocalSearchParams<{
        recipientType: string;
        recipientId: string;
        recipientName: string;
    }>();
    const router = useRouter();
    const { activeProfile } = useAuth();
    const bgColor = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');
    const borderColor = useThemeColor({}, 'icon');
    const insets = useSafeAreaInsets();

    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);

    const HEADER_H = 52 + insets.top;

    const senderType = (
        activeProfile?.accountType === 'BAND'  ? 'BAND' :
        activeProfile?.accountType === 'VENUE' ? 'VENUE' : 'USER'
    ) as ParticipantType;
    const senderId = activeProfile?.id ?? '';

    const handleSend = async () => {
        if (!text.trim() || sending || !recipientId || !recipientType) return;
        setSending(true);
        try {
            const conv = await createConversation(
                senderType,
                senderId,
                recipientType as ParticipantType,
                recipientId,
                text.trim()
            );
            router.replace(`/messages/${conv.id}`);
        } catch (e) {
            console.error(e);
        } finally {
            setSending(false);
        }
    };

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
                <View style={styles.headerCenter}>
                    <ThemedText style={[styles.headerTitle, FONT && { fontFamily: FONT }]}>
                        New Message
                    </ThemedText>
                    <ThemedText style={[styles.headerSub, FONT && { fontFamily: FONT }]}>
                        to {recipientName}
                    </ThemedText>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {/* Empty message area */}
            <View style={styles.body} />

            {/* Input bar — sits at bottom, rises with keyboard */}
            <View style={[styles.inputRow, {
                borderTopColor: borderColor + '33',
                backgroundColor: bgColor,
                paddingBottom: insets.bottom || 12,
            }]}>
                <TextInput
                    style={[styles.input, { color: textColor, borderColor: borderColor + '55' }]}
                    placeholder={`Message ${recipientName}...`}
                    placeholderTextColor={borderColor}
                    value={text}
                    onChangeText={setText}
                    multiline
                    autoFocus
                    maxLength={1000}
                    fontFamily={FONT}
                />
                <TouchableOpacity
                    style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
                    onPress={handleSend}
                    disabled={!text.trim() || sending}
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
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '700' },
    headerSub: { fontSize: 12, opacity: 0.5, marginTop: 1 },
    body: { flex: 1 },
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
