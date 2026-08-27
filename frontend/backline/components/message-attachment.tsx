import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { BASE_URL } from '@/services/api';
import {
    MessageAttachment, AttachmentPreview, toAttachmentPreview,
} from '@/services/conversation.service';

const DEFAULT_IMAGE = require('@/assets/images/default/headerImage.png');

function Cover({ preview, size }: { preview: AttachmentPreview; size: number }) {
    const style = { width: size, height: size, backgroundColor: '#2a2a2a' };
    if (preview.coverUrl) {
        return <Image source={{ uri: `${BASE_URL}${preview.coverUrl}` }} style={style} contentFit="cover" transition={150} />;
    }
    if (preview.fallback === 'image') {
        return <Image source={DEFAULT_IMAGE} style={style} contentFit="cover" transition={150} />;
    }
    return (
        <View style={[style, styles.iconFallback]}>
            <Ionicons name="musical-notes-outline" size={24} color="#888" />
        </View>
    );
}

// Compact cover+title+subtitle row for any attachment kind. Used both inside a
// message bubble and inside the staged banner. Driven purely by AttachmentPreview.
export function AttachmentCard({
    attachment, onPress, width, dark,
}: {
    attachment: MessageAttachment;
    onPress?: (preview: AttachmentPreview) => void;
    width?: number;
    dark?: boolean; // when rendered on the sender's blue bubble
}) {
    const borderColor = useThemeColor({}, 'text');
    const preview = toAttachmentPreview(attachment);
    const textColor = dark ? '#fff' : undefined;
    const subColor = dark ? 'rgba(255,255,255,0.75)' : undefined;

    return (
        <TouchableOpacity
            style={[styles.card, { width, borderColor: dark ? 'rgba(255,255,255,0.35)' : borderColor }]}
            activeOpacity={0.7}
            disabled={!onPress}
            onPress={() => onPress?.(preview)}
        >
            <Cover preview={preview} size={56} />
            <View style={styles.info}>
                <ThemedText style={[styles.title, textColor && { color: textColor }]} numberOfLines={1}>
                    {preview.title}
                </ThemedText>
                {!!preview.subtitle && (
                    <ThemedText style={[styles.subtitle, subColor ? { color: subColor, opacity: 1 } : null]} numberOfLines={1}>
                        {preview.subtitle}
                    </ThemedText>
                )}
            </View>
        </TouchableOpacity>
    );
}

// Staged attachment shown above the input bar, with a clear button.
export function StagedAttachmentBanner({
    attachment, onClear,
}: {
    attachment: MessageAttachment;
    onClear: () => void;
}) {
    const borderColor = useThemeColor({}, 'icon');
    return (
        <View style={[styles.banner, { borderTopColor: borderColor + '33' }]}>
            <View style={{ flex: 1 }}>
                <AttachmentCard attachment={attachment} width={undefined} />
            </View>
            <TouchableOpacity onPress={onClear} style={styles.clearBtn} hitSlop={8}>
                <Ionicons name="close-circle" size={22} color={borderColor} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        overflow: 'hidden',
    },
    iconFallback: { alignItems: 'center', justifyContent: 'center' },
    info: { flex: 1, paddingHorizontal: 10, paddingVertical: 6, gap: 2 },
    title: { fontSize: 13, fontWeight: '700' },
    subtitle: { fontSize: 11, opacity: 0.6 },
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 10,
        paddingTop: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    clearBtn: { padding: 2 },
});
