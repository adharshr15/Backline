import { useEffect, useState } from 'react';
import { ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getGenres, Genre } from '@/services/genre.service';

/** The minimum a chip needs. Scene topGenres and /genres rows both satisfy it. */
export type GenreChip = { slug: string; name: string; bandCount?: number };

type Props = {
    /** Genre slugs, not display names. */
    selected: string[];
    onToggle: (slug: string) => void;
    /**
     * Chips to render. A scene detail payload already carries its topGenres,
     * ranked and counted, so passing them avoids a second request.
     */
    genres?: GenreChip[];
    /**
     * Fetched only when `genres` is not supplied. Narrows the taxonomy to genres
     * bands in that scene actually carry.
     */
    sceneSlug?: string | null;
};

/**
 * Root genres from the seeded taxonomy. Chips are an enhancement, so an empty or
 * failed response renders nothing rather than an error state.
 */
export default function GenreFilterChips({ selected, onToggle, genres: provided, sceneSlug }: Props) {
    const borderColor = useThemeColor({}, 'text');
    const bgColor = useThemeColor({}, 'background');
    const [fetched, setFetched] = useState<Genre[]>([]);

    useEffect(() => {
        if (provided) return;
        let cancelled = false;
        getGenres({ sceneSlug })
            .then(g => { if (!cancelled) setFetched(g); })
            .catch(() => { if (!cancelled) setFetched([]); });
        return () => { cancelled = true; };
    }, [provided, sceneSlug]);

    const genres: GenreChip[] = provided ?? fetched;
    if (genres.length === 0) return null;

    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {genres.map(genre => {
                const active = selected.includes(genre.slug);
                return (
                    <TouchableOpacity
                        key={genre.slug}
                        style={[styles.chip, { borderColor }, active && { backgroundColor: borderColor }]}
                        onPress={() => onToggle(genre.slug)}
                    >
                        <ThemedText style={[styles.label, active && { color: bgColor }]}>
                            {genre.name}
                            {genre.bandCount ? ` ${genre.bandCount}` : ''}
                        </ThemedText>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    row: { paddingHorizontal: 16, gap: 8, marginBottom: 16 },
    chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
    label: { fontSize: 12, fontWeight: '500' },
});
