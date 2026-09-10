import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';

export const ACCENT = '#4A90D9';
export const CARD = '#282828';

export function StatCard({ label, value, onPress }: { label: string; value: number; onPress?: () => void }) {
    const inner = (
        <>
            <Text style={styles.cardValue}>{value}</Text>
            <Text style={styles.cardLabel}>{label}</Text>
            {onPress ? <Ionicons name="chevron-forward" size={14} color="grey" style={styles.cardChevron} /> : null}
        </>
    );
    if (onPress) {
        return <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>{inner}</TouchableOpacity>;
    }
    return <View style={styles.card}>{inner}</View>;
}

export function StatRow({ label, value }: { label: string; value: number | string }) {
    return (
        <View style={styles.row}>
            <ThemedText style={styles.rowLabel}>{label}</ThemedText>
            <ThemedText style={styles.rowValue}>{value}</ThemedText>
        </View>
    );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexGrow: 1,
        flexBasis: '47%',
        backgroundColor: CARD,
        borderRadius: 16,
        paddingVertical: 20,
        paddingHorizontal: 16,
    },
    cardValue: { color: 'white', fontSize: 30, fontWeight: '700' },
    cardLabel: { color: 'grey', fontSize: 13, marginTop: 4 },
    cardChevron: { position: 'absolute', top: 14, right: 14 },
    section: { gap: 4 },
    sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 6, opacity: 0.9 },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#333',
    },
    rowLabel: { fontSize: 14, opacity: 0.8 },
    rowValue: { fontSize: 16, fontWeight: '600' },
});
