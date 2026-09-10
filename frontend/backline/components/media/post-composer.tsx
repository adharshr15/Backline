import { useState, useEffect } from 'react';
import {
    Modal, View, TextInput, TouchableOpacity, ActivityIndicator,
    StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { VideoTileThumb } from '@/components/media/media-tile';
import { createPost, Post, OwnerType } from '@/services/post.service';

type Props = {
    visible: boolean;
    ownerType: OwnerType;
    ownerId: string;
    showId?: string;
    onClose: () => void;
    onCreated: (post: Post) => void;
};

/**
 * Full compose flow for a new post: opens the media picker when shown, then
 * lets the user add a caption and publish. Used by both the profile Posts tab
 * and a show's media gallery (pass showId to link the post to that show).
 */
export default function PostComposerModal({ visible, ownerType, ownerId, showId, onClose, onCreated }: Props) {
    const bg = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');
    const borderColor = useThemeColor({}, 'icon');

    const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [caption, setCaption] = useState('');
    const [uploading, setUploading] = useState(false);

    // Launch the picker as soon as the composer opens; cancel closes it.
    useEffect(() => {
        if (!visible) { setAsset(null); setCaption(''); return; }
        let active = true;
        ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.85 })
            .then(result => {
                if (!active) return;
                if (result.canceled || !result.assets?.[0]) { onClose(); return; }
                setAsset(result.assets[0]);
            })
            .catch(() => { if (active) onClose(); });
        return () => { active = false; };
    }, [visible]);

    const handlePost = async () => {
        if (!asset || uploading) return;
        const isVideo = asset.type === 'video';
        const filename = asset.fileName ?? asset.uri.split('/').pop() ?? (isVideo ? 'video.mp4' : 'photo.jpg');
        const ext = filename.split('.').pop()?.toLowerCase() ?? (isVideo ? 'mp4' : 'jpg');
        const mime = asset.mimeType ?? (isVideo ? `video/${ext}` : `image/${ext}`);
        try {
            setUploading(true);
            const post = await createPost({
                file: { uri: asset.uri, name: filename, type: mime },
                type: isVideo ? 'VIDEO' : 'PHOTO',
                ownerType,
                ownerId,
                caption: caption.trim() || undefined,
                showId,
            });
            onCreated(post);
            onClose();
        } catch {
            Alert.alert('Upload failed', 'Could not publish this post. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const isVideo = asset?.type === 'video';

    return (
        <Modal visible={visible && !!asset} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
                <View style={[styles.header, { borderBottomColor: borderColor + '33' }]}>
                    <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.iconBtn}>
                        <Ionicons name="close" size={24} color={textColor} />
                    </TouchableOpacity>
                    <ThemedText style={styles.headerTitle}>New Post</ThemedText>
                    <TouchableOpacity onPress={handlePost} hitSlop={8} disabled={uploading} style={styles.postBtn}>
                        {uploading
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <ThemedText style={styles.postBtnText}>Post</ThemedText>}
                    </TouchableOpacity>
                </View>

                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={styles.previewWrap}>
                        {asset && (isVideo
                            ? <VideoTileThumb uri={asset.uri} style={styles.preview} />
                            : <Image source={{ uri: asset.uri }} style={styles.preview} contentFit="cover" />)}
                        {isVideo && (
                            <View style={styles.playOverlay}>
                                <Ionicons name="play-circle" size={40} color="#fff" />
                            </View>
                        )}
                    </View>

                    <TextInput
                        style={[styles.caption, { color: textColor, borderColor: borderColor + '33' }]}
                        placeholder="Write a caption..."
                        placeholderTextColor={borderColor}
                        value={caption}
                        onChangeText={setCaption}
                        multiline
                        maxLength={2200}
                    />
                    {showId && (
                        <View style={styles.linkedRow}>
                            <Ionicons name="musical-notes" size={14} color={borderColor} />
                            <ThemedText style={[styles.linkedText, { color: borderColor }]}>
                                This post will be linked to the show
                            </ThemedText>
                        </View>
                    )}
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    iconBtn: { width: 44, height: 32, justifyContent: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '700' },
    postBtn: {
        minWidth: 44,
        height: 32,
        paddingHorizontal: 14,
        borderRadius: 16,
        backgroundColor: '#4A90D9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    postBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    previewWrap: { width: '100%', aspectRatio: 1, backgroundColor: '#1e1e1e' },
    preview: { width: '100%', height: '100%' },
    playOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
    caption: {
        margin: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 10,
        padding: 12,
        fontSize: 15,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    linkedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16 },
    linkedText: { fontSize: 12 },
});
