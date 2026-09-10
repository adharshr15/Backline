import { useState, useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { BASE_URL } from '@/services/api';
import { Post } from '@/services/post.service';

const videoThumbCache = new Map<string, string>();

/** Grid tile preview for a video: generates and caches a frame instead of a blank box. */
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

    if (!thumbUri) return <View style={[style, styles.placeholder]} />;
    return <Image source={{ uri: thumbUri }} style={style} contentFit="cover" />;
}

/** A single square post thumbnail: photo or video frame, with play + show-link badges. */
export function MediaTile({ post, size, onPress }: { post: Post; size: number; onPress: () => void }) {
    const uri = `${BASE_URL}${post.url}`;
    return (
        <Pressable onPress={onPress} style={{ width: size, height: size }}>
            {post.type === 'VIDEO'
                ? <VideoTileThumb uri={uri} style={styles.img} />
                : <Image source={{ uri }} style={styles.img} contentFit="cover" />}
            {post.type === 'VIDEO' && (
                <View style={styles.centerOverlay}>
                    <Ionicons name="play-circle" size={30} color="#fff" />
                </View>
            )}
            {post.showId && (
                <View style={styles.showBadge}>
                    <Ionicons name="musical-notes" size={12} color="#fff" />
                </View>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    img: { width: '100%', height: '100%', backgroundColor: '#1e1e1e' },
    placeholder: { backgroundColor: '#1e1e1e' },
    centerOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
    showBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
