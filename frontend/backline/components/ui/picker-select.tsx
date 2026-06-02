import { useState } from 'react';
import { Modal, View, FlatList, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

export interface PickerOption {
    code: string;
    name: string;
}

interface Props {
    value: string;
    options: PickerOption[];
    onSelect: (code: string) => void;
    placeholder?: string;
    disabled?: boolean;
    style?: object;
}

export function PickerSelect({ value, options, onSelect, placeholder = 'Select...', disabled = false, style }: Props) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const borderColor = useThemeColor({}, 'text');
    const bgColor = useThemeColor({}, 'background');

    const selected = options.find(o => o.code === value);
    const filtered = search
        ? options.filter(o => o.name.toLowerCase().includes(search.toLowerCase()) || o.code.toLowerCase().includes(search.toLowerCase()))
        : options;

    const handleOpen = () => {
        if (disabled) return;
        setSearch('');
        setOpen(true);
    };

    return (
        <>
            <TouchableOpacity
                style={[styles.trigger, { borderColor }, disabled && styles.disabled, style]}
                onPress={handleOpen}
                activeOpacity={disabled ? 1 : 0.7}
            >
                <ThemedText style={[styles.triggerText, !selected && styles.placeholder]} numberOfLines={1}>
                    {selected ? selected.name : placeholder}
                </ThemedText>
                {!disabled && <ThemedText style={[styles.chevron, { color: borderColor }]}>›</ThemedText>}
            </TouchableOpacity>

            <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
                <SafeAreaView style={[styles.sheet, { backgroundColor: bgColor }]}>
                    <View style={[styles.header, { borderBottomColor: borderColor + '33' }]}>
                        <ThemedText style={styles.headerTitle}>{placeholder}</ThemedText>
                        <TouchableOpacity onPress={() => setOpen(false)}>
                            <ThemedText style={styles.done}>Done</ThemedText>
                        </TouchableOpacity>
                    </View>

                    {options.length > 8 && (
                        <View style={[styles.searchWrap, { borderBottomColor: borderColor + '22' }]}>
                            <TextInput
                                style={[styles.search, { color: borderColor, borderColor: borderColor + '44' }]}
                                placeholder="Search..."
                                placeholderTextColor="#888"
                                value={search}
                                onChangeText={setSearch}
                                autoCorrect={false}
                            />
                        </View>
                    )}

                    <FlatList
                        data={filtered}
                        keyExtractor={item => item.code}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[styles.item, { borderBottomColor: borderColor + '18' }, item.code === value && styles.itemSelected]}
                                onPress={() => { onSelect(item.code); setOpen(false); }}
                            >
                                <ThemedText style={[styles.itemText, item.code === value && styles.itemTextSelected]}>
                                    {item.name}
                                </ThemedText>
                                <ThemedText style={styles.itemCode}>{item.code}</ThemedText>
                            </TouchableOpacity>
                        )}
                    />
                </SafeAreaView>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    trigger: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        paddingHorizontal: 11,
        paddingVertical: 11,
        gap: 4,
    },
    disabled: { opacity: 0.4 },
    triggerText: { flex: 1, fontSize: 15 },
    placeholder: { opacity: 0.4 },
    chevron: { fontSize: 20, lineHeight: 22, opacity: 0.5 },
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
    searchWrap: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    search: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 15,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    itemSelected: { backgroundColor: 'rgba(0,122,255,0.08)' },
    itemText: { flex: 1, fontSize: 15 },
    itemTextSelected: { color: '#007AFF', fontWeight: '600' },
    itemCode: { fontSize: 13, opacity: 0.4 },
});
