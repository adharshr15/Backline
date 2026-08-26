import { useState, useEffect } from 'react';
import {
    Modal,
    View,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    Alert,
    useWindowDimensions,
    Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { BASE_URL } from '@/services/api';
import { ShowMedia, addShowMedia, deleteShowMedia } from '@/services/media.service';
import type { Show } from '@/services/show.service';
import type { ActiveProfile, User } from '@/context/AuthContext';

type ContributorType = 'USER' | 'BAND' | 'VENUE';

function activeType(profile: ActiveProfile | null): ContributorType {
    return profile?.accountType === 'BAND' ? 'BAND'
        : profile?.accountType === 'VENUE' ? 'VENUE'
        : 'USER';
}

/** Pick a photo/video from the library and upload it to the show. Returns true if something was uploaded. */
export async function pickAndUploadShowMedia(
    showId: string,
    activeProfile: ActiveProfile | null,
): Promise<boolean> {
    if (!activeProfile) return false;
    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return false;

    const asset = result.assets[0];
    const isVideo = asset.type === 'video';
    const filename = asset.fileName ?? asset.uri.split('/').pop() ?? (isVideo ? 'video.mp4' : 'photo.jpg');
    const ext = filename.split('.').pop()?.toLowerCase() ?? (isVideo ? 'mp4' : 'jpg');
    const mime = asset.mimeType ?? (isVideo ? `video/${ext}` : `image/${ext}`);

    await addShowMedia(
        showId,
        { uri: asset.uri, name: filename, type: mime },
        isVideo ? 'VIDEO' : 'PHOTO',
        activeType(activeProfile),
        activeProfile.id,
    );
    return true;
}

/** Whether the current user is plausibly allowed to delete a piece of media (server is authoritative). */
export function canDeleteMedia(
    media: ShowMedia,
    user: User | null,
    activeProfile: ActiveProfile | null,
    show: Show | null,
): boolean {
    if (user && media.uploaderUserId === user.id) return true;
    if (!show || !activeProfile) return false;
    // Owner: created this show as the active profile
    if (activeProfile.id === show.createdByUserId) return true;
    if (activeProfile.id === show.createdByBandId) return true;
    if (activeProfile.id === show.createdByVenueId) return true;
    // Active profile is a band on the lineup
    if (activeProfile.accountType === 'BAND' && show.bands?.some(b => b.bandId === activeProfile.id)) return true;
    return false;
}

const videoThumbCache = new Map<string, string>();

/** Grid tile preview for a video: generates and caches a frame from the video instead of showing a blank box. */
export function VideoTileThumb({ uri, style }: { uri: string; style: any }) {
    const [thumbUri, setThumbUri] = useState<string | null>(videoThumbCache.get(uri) ?? null);

    useEffect(() => {
        if (videoThumbCache.has(uri)) {
            setThumbUri(videoThumbCache.get(uri)!);
            return;
        }
        let cancelled = false;
        VideoThumbnails.getThumbnailAsync(uri, { time: 0 })
            .then(({ uri: generated }) => {
                videoThumbCache.set(uri, generated);
                if (!cancelled) setThumbUri(generated);
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [uri]);

    if (!thumbUri) {
        return <View style={[style, styles.tilePlaceholder]} />;
    }
    return <Image source={{ uri: thumbUri }} style={style} contentFit="cover" />;
}

type Props = {
    showId: string;
    show: Show | null;
    visible: boolean;
    onClose: () => void;
    media: ShowMedia[];
    onChanged: () => void;
    user: User | null;
    activeProfile: ActiveProfile | null;
    initialIndex?: number;
};

export default function ShowMediaGallery({
    showId, show, visible, onClose, media, onChanged, user, activeProfile, initialIndex,
}: Props) {
    const bg = useThemeColor({}, 'background');
    const borderColor = useThemeColor({}, 'text');
    const { width } = useWindowDimensions();
    const [uploading, setUploading] = useState(false);
    const [viewerIndex, setViewerIndex] = useState<number | null>(null);

    // When the gallery opens, jump to the tapped item (or grid if none specified)
    useEffect(() => {
        if (visible) setViewerIndex(initialIndex != null ? initialIndex : null);
    }, [visible, initialIndex]);

    const GAP = 2;
    const COLS = 3;
    const tile = (width - GAP * (COLS - 1)) / COLS;

    const handleAdd = async () => {
        try {
            setUploading(true);
            const added = await pickAndUploadShowMedia(showId, activeProfile);
            if (added) onChanged();
        } catch (e) {
            Alert.alert('Upload failed', 'Could not add media. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (m: ShowMedia) => {
        try {
            await deleteShowMedia(m.id);
            setViewerIndex(null);
            onChanged();
        } catch (e: any) {
            const msg = e?.response?.status === 403 ? 'You are not allowed to delete this.' : 'Could not delete media.';
            Alert.alert('Not allowed', msg);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
                <View style={[styles.header, { borderBottomColor: borderColor }]}>
                    <TouchableOpacity onPress={onClose} style={styles.iconBtn} hitSlop={8}>
                        <Ionicons name="close" size={22} color={borderColor} />
                    </TouchableOpacity>
                    <ThemedText style={styles.headerTitle}>Media</ThemedText>
                    <TouchableOpacity onPress={handleAdd} style={styles.iconBtn} hitSlop={8} disabled={uploading}>
                        {uploading
                            ? <ActivityIndicator size="small" color={borderColor} />
                            : <Ionicons name="add" size={26} color={borderColor} />}
                    </TouchableOpacity>
                </View>

                {media.length === 0 ? (
                    <TouchableOpacity style={styles.empty} onPress={handleAdd} activeOpacity={0.7}>
                        <Ionicons name="images-outline" size={40} color={borderColor} style={{ opacity: 0.4 }} />
                        <ThemedText style={styles.emptyText}>Add the first photo or video</ThemedText>
                    </TouchableOpacity>
                ) : (
                    <FlatList
                        data={media}
                        keyExtractor={m => m.id}
                        numColumns={COLS}
                        contentContainerStyle={{ paddingBottom: 24 }}
                        columnWrapperStyle={{ gap: GAP }}
                        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
                        renderItem={({ item, index }) => (
                            <Pressable onPress={() => setViewerIndex(index)} style={{ width: tile, height: tile }}>
                                {item.type === 'VIDEO' ? (
                                    <VideoTileThumb uri={`${BASE_URL}${item.url}`} style={styles.tileImg} />
                                ) : (
                                    <Image
                                        source={{ uri: `${BASE_URL}${item.url}` }}
                                        style={styles.tileImg}
                                        contentFit="cover"
                                    />
                                )}
                                {item.type === 'VIDEO' && (
                                    <View style={styles.playOverlay}>
                                        <Ionicons name="play-circle" size={30} color="#fff" />
                                    </View>
                                )}
                            </Pressable>
                        )}
                    />
                )}

                {viewerIndex != null && media[viewerIndex] && (
                    <MediaViewer
                        media={media[viewerIndex]}
                        onClose={() => setViewerIndex(null)}
                        canDelete={canDeleteMedia(media[viewerIndex], user, activeProfile, show)}
                        onDelete={() => handleDelete(media[viewerIndex]!)}
                    />
                )}
            </SafeAreaView>
        </Modal>
    );
}

function MediaViewer({
    media, onClose, canDelete, onDelete,
}: {
    media: ShowMedia;
    onClose: () => void;
    canDelete: boolean;
    onDelete: () => void;
}) {
    const uri = `${BASE_URL}${media.url}`;
    const player = useVideoPlayer(media.type === 'VIDEO' ? uri : null, p => {
        p.loop = false;
        p.play();
    });

    const confirmDelete = () => {
        Alert.alert('Delete media', 'Remove this from the show?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: onDelete },
        ]);
    };

    return (
        <View style={styles.viewer}>
            <SafeAreaView style={styles.viewerSafe}>
                <View style={styles.viewerHeader}>
                    <TouchableOpacity onPress={onClose} style={styles.iconBtn} hitSlop={8}>
                        <Ionicons name="close" size={26} color="#fff" />
                    </TouchableOpacity>
                    {canDelete && (
                        <TouchableOpacity onPress={confirmDelete} style={styles.iconBtn} hitSlop={8}>
                            <Ionicons name="trash-outline" size={24} color="#fff" />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.viewerContent}>
                    {media.type === 'VIDEO' ? (
                        <VideoView player={player} style={styles.viewerMedia} allowsFullscreen nativeControls contentFit="contain" />
                    ) : (
                        <Image source={{ uri }} style={styles.viewerMedia} contentFit="contain" />
                    )}
                </View>
            </SafeAreaView>
        </View>
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
    iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5, opacity: 0.6, textTransform: 'uppercase' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    emptyText: { opacity: 0.5, fontSize: 14 },
    tileImg: { width: '100%', height: '100%', backgroundColor: '#1e1e1e' },
    tilePlaceholder: { backgroundColor: '#1e1e1e' },
    playOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    viewer: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.98)' },
    viewerSafe: { flex: 1 },
    viewerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    viewerContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    viewerMedia: { width: '100%', height: '100%' },
});
