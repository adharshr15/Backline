import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { craftLabel } from '@/services/user.service';
import type { ExploreCraft } from '@/services/explore.service';

/** Read-only display of what someone does in a scene. */
export default function CraftChips({ crafts }: { crafts?: ExploreCraft[] | null }) {
    const borderColor = useThemeColor({}, 'text');
    if (!crafts?.length) return null;

    return (
        <View style={styles.row}>
            {crafts.map(c => (
                <View key={c.craft} style={[styles.chip, { borderColor }]}>
                    <ThemedText style={styles.label}>
                        {craftLabel(c.craft)}{c.forHire ? ' · For hire' : ''}
                    </ThemedText>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', paddingHorizontal: 16, marginTop: 8 },
    chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
    label: { fontSize: 11, fontWeight: '500', opacity: 0.8 },
});
