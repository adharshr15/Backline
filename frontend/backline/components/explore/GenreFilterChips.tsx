import { ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

const GENRES = [
    'Rock', 'Metal', 'Pop', 'Hip-Hop', 'Jazz', 'Country',
    'Electronic', 'Folk', 'R&B', 'Punk', 'Indie', 'Blues', 'Classical',
];

type Props = {
    selected: string[];
    onToggle: (genre: string) => void;
};

export default function GenreFilterChips({ selected, onToggle }: Props) {
    const borderColor = useThemeColor({}, 'text');
    const bgColor = useThemeColor({}, 'background');

    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {GENRES.map(genre => {
                const active = selected.includes(genre);
                return (
                    <TouchableOpacity
                        key={genre}
                        style={[styles.chip, { borderColor }, active && { backgroundColor: borderColor }]}
                        onPress={() => onToggle(genre)}
                    >
                        <ThemedText style={[styles.label, active && { color: bgColor }]}>
                            {genre}
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
