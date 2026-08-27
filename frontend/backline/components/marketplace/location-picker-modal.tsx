import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Modal, View, FlatList, TextInput, TouchableOpacity,
    StyleSheet, ActivityIndicator, useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { toStateCode } from '@/utils/location';

export interface CitySuggestion {
    city: string;
    state: string;
    venueCount?: number;
}

interface Props {
    visible: boolean;
    current: { city: string | null; state: string | null };
    suggestions: CitySuggestion[];
    history: { city: string; state: string | null }[];
    onSelect: (loc: { city: string; state: string | null }) => void;
    onUseCurrentLocation: () => void;
    onClearHistory: () => void;
    onClose: () => void;
}

// Row model for the list: a section header, a city (recent / suggestion / geocoded), or the raw free-text fallback.
type Row =
    | { type: 'header'; label: string; clearable?: boolean }
    | { type: 'city'; city: string; state: string | null; venueCount?: number; recent?: boolean }
    | { type: 'freeText'; query: string };

// Pull city matches from the Photon geocoder (same source as the profile location field).
const fetchCities = async (query: string): Promise<{ city: string; state: string | null }[]> => {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=8`);
    const data = await res.json();
    const seen = new Set<string>();
    const out: { city: string; state: string | null }[] = [];
    for (const f of data.features ?? []) {
        const p = f.properties ?? {};
        if (!p.name || p.street) continue; // skip street-level results
        const state = toStateCode(p.state || '') || null;
        const key = `${p.name.toLowerCase()}|${(state ?? '').toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ city: p.name, state });
    }
    return out;
};

export default function LocationPickerModal({
    visible, current, suggestions, history, onSelect, onUseCurrentLocation, onClearHistory, onClose,
}: Props) {
    const scheme = useColorScheme();
    const isDark = scheme === 'dark';
    const textColor = useThemeColor({}, 'text');
    const bgColor = useThemeColor({}, 'background');

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<{ city: string; state: string | null }[]>([]);
    const [searching, setSearching] = useState(false);
    const reqId = useRef(0);
    const trimmed = query.trim();

    // Debounced dynamic search as the user types.
    useEffect(() => {
        if (!trimmed) { setResults([]); setSearching(false); return; }
        setSearching(true);
        const id = ++reqId.current;
        const t = setTimeout(async () => {
            try {
                const cities = await fetchCities(trimmed);
                if (id === reqId.current) setResults(cities);
            } catch {
                if (id === reqId.current) setResults([]);
            } finally {
                if (id === reqId.current) setSearching(false);
            }
        }, 250);
        return () => clearTimeout(t);
    }, [trimmed]);

    const rows = useMemo<Row[]>(() => {
        if (!trimmed) {
            const out: Row[] = [];
            if (history.length > 0) {
                out.push({ type: 'header', label: 'Recent', clearable: true });
                history.forEach(h => out.push({ type: 'city', city: h.city, state: h.state, recent: true }));
            }
            // Suggested cities, excluding any already shown under Recent.
            const rest = suggestions.filter(s =>
                !history.some(h => h.city.toLowerCase() === s.city.toLowerCase() && (h.state ?? '').toLowerCase() === (s.state ?? '').toLowerCase()));
            if (rest.length > 0) {
                if (history.length > 0) out.push({ type: 'header', label: 'Suggested' });
                rest.forEach(s => out.push({ type: 'city', city: s.city, state: s.state, venueCount: s.venueCount }));
            }
            return out;
        }
        const cityRows: Row[] = results.map(r => ({ type: 'city', city: r.city, state: r.state }));
        // Fall back to the raw text if the geocoder returned nothing.
        if (!searching && results.length === 0) cityRows.push({ type: 'freeText', query: trimmed });
        return cityRows;
    }, [trimmed, results, searching, suggestions, history]);

    const handleClose = () => { setQuery(''); onClose(); };
    const pick = (loc: { city: string; state: string | null }) => { setQuery(''); onSelect(loc); };

    const isActive = (city: string) =>
        !!current.city && city.toLowerCase() === current.city.toLowerCase();

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
            <SafeAreaView style={[styles.sheet, { backgroundColor: bgColor }]}>
                <View style={[styles.header, { borderBottomColor: textColor + '22' }]}>
                    <ThemedText style={styles.headerTitle}>Location</ThemedText>
                    <TouchableOpacity onPress={handleClose}>
                        <ThemedText style={styles.done}>Done</ThemedText>
                    </TouchableOpacity>
                </View>

                {/* Search */}
                <View style={styles.searchWrap}>
                    <View style={[styles.searchBar, { backgroundColor: isDark ? '#1e1e1e' : '#f0f0f0' }]}>
                        <Ionicons name="search" size={18} color={isDark ? '#888' : '#666'} style={styles.searchIcon} />
                        <TextInput
                            style={[styles.input, { color: textColor }]}
                            placeholder="Search for a city..."
                            placeholderTextColor={isDark ? '#666' : '#999'}
                            value={query}
                            onChangeText={setQuery}
                            autoCorrect={false}
                            autoCapitalize="words"
                            returnKeyType="search"
                        />
                        {searching ? (
                            <ActivityIndicator size="small" />
                        ) : query.length > 0 ? (
                            <TouchableOpacity onPress={() => setQuery('')}>
                                <Ionicons name="close-circle" size={18} color={isDark ? '#888' : '#666'} />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>

                {/* Use current location */}
                <TouchableOpacity
                    style={[styles.currentRow, { borderBottomColor: textColor + '18' }]}
                    onPress={onUseCurrentLocation}
                    activeOpacity={0.7}
                >
                    <Ionicons name="locate" size={20} color="#4A90D9" style={styles.currentIcon} />
                    <ThemedText style={styles.currentText}>Use current location</ThemedText>
                </TouchableOpacity>

                <FlatList
                    data={rows}
                    keyExtractor={(item, i) =>
                        item.type === 'city' ? `${item.city}-${item.state}-${i}` :
                        item.type === 'header' ? `header-${item.label}` : `free-${i}`}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => {
                        if (item.type === 'header') {
                            return (
                                <View style={styles.sectionHeader}>
                                    <ThemedText style={styles.sectionLabel}>{item.label}</ThemedText>
                                    {item.clearable && (
                                        <TouchableOpacity onPress={onClearHistory} hitSlop={8}>
                                            <ThemedText style={styles.clear}>Clear</ThemedText>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            );
                        }
                        if (item.type === 'freeText') {
                            return (
                                <TouchableOpacity
                                    style={[styles.item, { borderBottomColor: textColor + '18' }]}
                                    onPress={() => pick({ city: item.query, state: null })}
                                >
                                    <Ionicons name="search" size={18} color={textColor} style={styles.itemIcon} />
                                    <ThemedText style={styles.itemText} numberOfLines={1}>
                                        Search &quot;{item.query}&quot;
                                    </ThemedText>
                                </TouchableOpacity>
                            );
                        }
                        const active = isActive(item.city);
                        const subtitle = [item.state, item.venueCount ? `${item.venueCount} venue${item.venueCount === 1 ? '' : 's'}` : null]
                            .filter(Boolean).join(' · ');
                        return (
                            <TouchableOpacity
                                style={[styles.item, { borderBottomColor: textColor + '18' }, active && styles.itemActive]}
                                onPress={() => pick({ city: item.city, state: item.state })}
                            >
                                <Ionicons
                                    name={item.recent ? 'time-outline' : 'location-outline'}
                                    size={18}
                                    color={active ? '#4A90D9' : textColor}
                                    style={styles.itemIcon}
                                />
                                <View style={styles.itemBody}>
                                    <ThemedText style={[styles.itemText, active && styles.itemTextActive]} numberOfLines={1}>
                                        {item.city}
                                    </ThemedText>
                                    {subtitle.length > 0 && (
                                        <ThemedText style={styles.itemSub} numberOfLines={1}>{subtitle}</ThemedText>
                                    )}
                                </View>
                                {active && <Ionicons name="checkmark" size={18} color="#4A90D9" />}
                            </TouchableOpacity>
                        );
                    }}
                    ListEmptyComponent={
                        !searching ? (
                            <ThemedText style={styles.empty}>
                                {trimmed ? 'No matching cities.' : 'Type a city name to search.'}
                            </ThemedText>
                        ) : null
                    }
                />
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    sheet: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerTitle: { fontSize: 16, fontWeight: '700' },
    done: { fontSize: 15, color: '#007AFF', fontWeight: '600' },
    searchWrap: { paddingHorizontal: 16, paddingVertical: 12 },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    searchIcon: { marginRight: 8 },
    input: { flex: 1, fontSize: 16 },
    currentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    currentIcon: { marginRight: 12 },
    currentText: { fontSize: 15, fontWeight: '600', color: '#4A90D9' },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 6,
    },
    sectionLabel: { fontSize: 12, fontWeight: '700', opacity: 0.5, textTransform: 'uppercase', letterSpacing: 0.6 },
    clear: { fontSize: 13, color: '#4A90D9', fontWeight: '600' },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    itemActive: { backgroundColor: 'rgba(74,144,217,0.08)' },
    itemIcon: { marginRight: 12 },
    itemBody: { flex: 1 },
    itemText: { fontSize: 15 },
    itemTextActive: { color: '#4A90D9', fontWeight: '600' },
    itemSub: { fontSize: 12, opacity: 0.5, marginTop: 2 },
    empty: { textAlign: 'center', marginTop: 32, opacity: 0.5 },
});
