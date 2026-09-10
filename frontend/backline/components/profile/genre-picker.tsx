import { useEffect, useMemo, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getGenres, Genre } from '@/services/genre.service';

/** Backend limit: MAX_BAND_GENRES in src/lib/genres.ts. */
export const MAX_BAND_GENRES = 3;

export type PickedGenre = { slug: string; name: string };

type Props = {
    value: PickedGenre[];
    onChange: (next: PickedGenre[]) => void;
};

/**
 * A band's genres from the seeded taxonomy.
 *
 * Roots show as chips; opening one reveals everything beneath it. The list comes
 * from the flat form of GET /genres and is grouped here, because the nested form
 * only goes one level deep and would drop grandchildren (Hardcore -> Powerviolence).
 *
 * Order is `position` on the backend, so the first pick is the primary genre.
 */
export default function GenrePicker({ value, onChange }: Props) {
    const borderColor = useThemeColor({}, 'text');
    const bgColor = useThemeColor({}, 'background');
    const [genres, setGenres] = useState<Genre[]>([]);
    const [open, setOpen] = useState<string | null>(null);

    useEffect(() => {
        getGenres({ flat: true }).then(setGenres).catch(() => setGenres([]));
    }, []);

    // Every genre grouped under its root ancestor, in the API's sort order.
    const { roots, descendants } = useMemo(() => {
        const bySlug = new Map(genres.map(g => [g.slug, g]));
        const rootOf = (g: Genre): string => {
            let cur = g;
            const seen = new Set<string>();
            while (cur.parentSlug && bySlug.has(cur.parentSlug) && !seen.has(cur.slug)) {
                seen.add(cur.slug);
                cur = bySlug.get(cur.parentSlug)!;
            }
            return cur.slug;
        };

        const byRoot = new Map<string, Genre[]>();
        const rootList: Genre[] = [];
        for (const g of genres) {
            const root = rootOf(g);
            if (root === g.slug) {
                rootList.push(g);
            } else {
                byRoot.set(root, [...(byRoot.get(root) ?? []), g]);
            }
        }
        return { roots: rootList, descendants: byRoot };
    }, [genres]);

    const isPicked = (slug: string) => value.some(g => g.slug === slug);
    const atLimit = value.length >= MAX_BAND_GENRES;

    const toggle = (g: Genre | PickedGenre) => {
        if (isPicked(g.slug)) {
            onChange(value.filter(v => v.slug !== g.slug));
        } else if (!atLimit) {
            onChange([...value, { slug: g.slug, name: g.name }]);
        }
    };

    const renderChip = (g: Genre | PickedGenre, opts: { onPress: () => void; active: boolean; label?: string }) => {
        const disabled = !opts.active && atLimit;
        return (
            <TouchableOpacity
                key={g.slug}
                style={[
                    styles.chip,
                    { borderColor },
                    opts.active && { backgroundColor: borderColor },
                    disabled && styles.chipDisabled,
                ]}
                onPress={opts.onPress}
                disabled={disabled}
            >
                <ThemedText style={[styles.chipText, opts.active && { color: bgColor }]}>
                    {opts.label ?? g.name}
                </ThemedText>
            </TouchableOpacity>
        );
    };

    const openRoot = open ? roots.find(r => r.slug === open) : undefined;

    return (
        <View style={styles.container}>
            <View style={styles.labelRow}>
                <ThemedText style={styles.label}>Genres</ThemedText>
                <ThemedText style={styles.counter}>{value.length}/{MAX_BAND_GENRES}</ThemedText>
            </View>

            {value.length > 0 && (
                <View style={styles.chipWrap}>
                    {value.map((g, i) =>
                        renderChip(g, {
                            active: true,
                            onPress: () => toggle(g),
                            label: `${g.name}${i === 0 ? ' · primary' : ''}  ✕`,
                        })
                    )}
                </View>
            )}

            <View style={styles.chipWrap}>
                {roots.map(root => {
                    const expanded = open === root.slug;
                    return (
                        <TouchableOpacity
                            key={root.slug}
                            style={[styles.chip, { borderColor }, expanded && styles.chipOpen]}
                            onPress={() => setOpen(expanded ? null : root.slug)}
                        >
                            <ThemedText style={styles.chipText}>
                                {root.name} {expanded ? '▾' : '▸'}
                            </ThemedText>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {openRoot && (
                <View style={[styles.subPanel, { borderColor: borderColor + '22' }]}>
                    <View style={styles.chipWrap}>
                        {renderChip(openRoot, { active: isPicked(openRoot.slug), onPress: () => toggle(openRoot) })}
                        {(descendants.get(openRoot.slug) ?? []).map(g =>
                            renderChip(g, { active: isPicked(g.slug), onPress: () => toggle(g) })
                        )}
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: 10 },
    labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    label: { fontSize: 13, color: '#aaa' },
    counter: { fontSize: 12, opacity: 0.4 },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
    chipOpen: { borderWidth: 1 },
    chipDisabled: { opacity: 0.3 },
    chipText: { fontSize: 12, fontWeight: '500' },
    subPanel: { paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
