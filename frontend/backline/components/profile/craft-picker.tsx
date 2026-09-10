import { View, TextInput, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { CRAFTS, MAX_CRAFTS, MAX_HEADLINE, craftLabel } from '@/services/user.service';

export interface CraftEntry {
    craft: string;
    forHire: boolean;
    headline: string;
}

type Props = {
    value: CraftEntry[];
    onChange: (next: CraftEntry[]) => void;
};

/**
 * What you do in a scene, beyond being in a band.
 *
 * Array order is `position` on the backend, so the first pick is the primary
 * craft -- toggling one off and back on moves it to the end deliberately.
 */
export default function CraftPicker({ value, onChange }: Props) {
    const borderColor = useThemeColor({}, 'text');
    const bgColor = useThemeColor({}, 'background');

    const toggle = (craft: string) => {
        const existing = value.find(c => c.craft === craft);
        if (existing) {
            onChange(value.filter(c => c.craft !== craft));
        } else if (value.length < MAX_CRAFTS) {
            onChange([...value, { craft, forHire: false, headline: '' }]);
        }
    };

    const update = (craft: string, patch: Partial<CraftEntry>) =>
        onChange(value.map(c => (c.craft === craft ? { ...c, ...patch } : c)));

    const atLimit = value.length >= MAX_CRAFTS;

    return (
        <View style={styles.container}>
            <View style={styles.labelRow}>
                <ThemedText style={styles.label}>What you do</ThemedText>
                <ThemedText style={styles.counter}>{value.length}/{MAX_CRAFTS}</ThemedText>
            </View>

            <View style={styles.chipWrap}>
                {CRAFTS.map(craft => {
                    const active = value.some(c => c.craft === craft);
                    const disabled = !active && atLimit;
                    return (
                        <TouchableOpacity
                            key={craft}
                            style={[
                                styles.chip,
                                { borderColor },
                                active && { backgroundColor: borderColor },
                                disabled && styles.chipDisabled,
                            ]}
                            onPress={() => toggle(craft)}
                            disabled={disabled}
                        >
                            <ThemedText style={[styles.chipText, active && { color: bgColor }]}>
                                {craftLabel(craft)}
                            </ThemedText>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {value.map((entry, i) => (
                <View key={entry.craft} style={[styles.detail, { borderColor: borderColor + '22' }]}>
                    <View style={styles.detailHeader}>
                        <ThemedText style={styles.detailTitle}>
                            {craftLabel(entry.craft)}
                            {i === 0 ? ' · primary' : ''}
                        </ThemedText>
                        <View style={styles.hireRow}>
                            <ThemedText style={styles.hireLabel}>For hire</ThemedText>
                            <Switch
                                value={entry.forHire}
                                onValueChange={v => update(entry.craft, { forHire: v })}
                            />
                        </View>
                    </View>
                    <TextInput
                        style={styles.input}
                        value={entry.headline}
                        onChangeText={t => update(entry.craft, { headline: t })}
                        placeholder="Short headline (optional)"
                        placeholderTextColor="#666"
                        maxLength={MAX_HEADLINE}
                    />
                </View>
            ))}
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
    chipDisabled: { opacity: 0.3 },
    chipText: { fontSize: 12, fontWeight: '500' },
    detail: {
        gap: 8,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    detailTitle: { fontSize: 13, fontWeight: '600' },
    hireRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    hireLabel: { fontSize: 12, opacity: 0.55 },
    input: {
        backgroundColor: '#111',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 15,
        color: '#fff',
    },
});
