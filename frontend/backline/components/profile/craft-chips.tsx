import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { craftLabel } from '@/services/user.service';
import type { CraftRecommendation } from '@/services/user.service';
import type { ExploreCraft } from '@/services/explore.service';

interface Props {
    crafts?: ExploreCraft[] | null;
    /** Keyed by craft. Omit to render plain chips. */
    recommendations?: Record<string, CraftRecommendation>;
    /** When set, chips are tappable and toggle the viewer's recommendation. */
    onToggleRecommend?: (craft: string) => void;
}

/** What someone does in a scene, with recommendation counts when provided. */
export default function CraftChips({ crafts, recommendations, onToggleRecommend }: Props) {
    const borderColor = useThemeColor({}, 'text');
    const tint = useThemeColor({}, 'tint');
    const background = useThemeColor({}, 'background');
    if (!crafts?.length) return null;

    return (
        <View style={styles.row}>
            {crafts.map(c => {
                const rec = recommendations?.[c.craft];
                const active = !!rec?.recommendedByViewer;
                const count = rec?.count ?? 0;
                // Tappable chips always show the thumb so the action is discoverable.
                const suffix = count > 0 ? ` · 👍 ${count}` : onToggleRecommend ? ' · 👍' : '';
                const chipStyle = [styles.chip, { borderColor }, active && { backgroundColor: tint, borderColor: tint }];
                const label = (
                    <ThemedText style={[styles.label, active && { color: background, opacity: 1 }]}>
                        {craftLabel(c.craft)}{c.forHire ? ' · For hire' : ''}{suffix}
                    </ThemedText>
                );

                return onToggleRecommend ? (
                    <TouchableOpacity
                        key={c.craft}
                        style={chipStyle}
                        onPress={() => onToggleRecommend(c.craft)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${active ? 'Remove recommendation' : 'Recommend'} as ${craftLabel(c.craft)}`}
                    >
                        {label}
                    </TouchableOpacity>
                ) : (
                    <View key={c.craft} style={chipStyle}>{label}</View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', paddingHorizontal: 16, marginTop: 8 },
    chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
    label: { fontSize: 11, fontWeight: '500', opacity: 0.8 },
});
