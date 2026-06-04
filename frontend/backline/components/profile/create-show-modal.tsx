import {
    Modal,
    View,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    StyleSheet,
    Alert,
    ActivityIndicator,
    Platform,
    Image as RNImage,
    FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { createShow, updateShow, Show, searchBands, searchVenues } from '@/services/show.service';
import { BASE_URL } from '@/services/api';
import { COUNTRY_LIST, STATES_BY_COUNTRY } from '@/utils/location';
import { Ionicons } from '@expo/vector-icons';

interface Props {
    visible: boolean;
    onClose: () => void;
    onCreated: () => void;
    creatorUserId?: string;
    creatorBandId?: string;
    creatorVenueId?: string;
    defaultCity?: string;
    defaultState?: string;
    defaultCountry?: string;
    editingShow?: Show;
}

type BandResult = { id: string; name: string; city?: string; profileImageUrl?: string };
type VenueResult = { id: string; name: string; city?: string; profileImageUrl?: string };
type LinkedBand = { id: string; name: string };

export default function CreateShowModal({ visible, onClose, onCreated, creatorUserId, creatorBandId, creatorVenueId, defaultCity = '', defaultState = '', defaultCountry = '', editingShow }: Props) {
    const isEditing = !!editingShow;
    const borderColor = useThemeColor({}, 'text');
    const bg = useThemeColor({}, 'background');
    const subtleColor = useThemeColor({ light: '#f0f0f0', dark: '#1e1e1e' }, 'background');

    const scrollRef = useRef<ScrollView>(null);
    const cityRef = useRef<TextInput>(null);
    const stateRef = useRef<TextInput>(null);
    const countryRef = useRef<TextInput>(null);
    const ticketRef = useRef<TextInput>(null);
    const notesRef = useRef<TextInput>(null);
    const bandSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const venueSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const scrollToInput = (ref: React.RefObject<TextInput | null>) => {
        setTimeout(() => {
            ref.current?.measureLayout(
                scrollRef.current as any,
                (_x, y) => { scrollRef.current?.scrollTo({ y: y - 80, animated: true }); },
                () => {}
            );
        }, 50);
    };

    const [date, setDate] = useState(new Date());
    const [doors, setDoors] = useState(() => { const d = new Date(); d.setHours(19, 0, 0, 0); return d; });
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showDoorsPicker, setShowDoorsPicker] = useState(false);

    const [city, setCity] = useState(defaultCity);
    const [state, setState] = useState(defaultState);
    const [country, setCountry] = useState(defaultCountry);
    const [ticketsUrl, setTicketsUrl] = useState('');
    const [notes, setNotes] = useState('');
    const [posterImage, setPosterImage] = useState<{ uri: string; name: string; type: string } | null>(null);
    const [loading, setLoading] = useState(false);

    // Band search state
    const [bandSearchText, setBandSearchText] = useState('');
    const [bandResults, setBandResults] = useState<BandResult[]>([]);
    // All currently shown band chips (existing confirmed + newly added)
    const [selectedBands, setSelectedBands] = useState<LinkedBand[]>([]);
    // IDs of bands that were already on the show when editing opened (to diff on submit)
    const [existingBandIds, setExistingBandIds] = useState<Set<string>>(new Set());
    const [unlinkedBands, setUnlinkedBands] = useState<string[]>([]);
    const [bandSearching, setBandSearching] = useState(false);

    // Venue search state
    const [venueSearchText, setVenueSearchText] = useState('');
    const [venueResults, setVenueResults] = useState<VenueResult[]>([]);
    const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
    const [selectedVenueName, setSelectedVenueName] = useState<string | null>(null);
    const [venueSearching, setVenueSearching] = useState(false);

    type Sel = { start: number; end: number } | undefined;
    const [stateSel, setStateSel] = useState<Sel>(undefined);
    const [countrySel, setCountrySel] = useState<Sel>(undefined);

    const handleCountryChange = (text: string) => {
        const upper = text.toUpperCase().replace(/[^A-Z]/g, '');
        if (!upper) { setCountry(''); setState(''); setCountrySel(undefined); return; }
        const codes = COUNTRY_LIST.map(c => c.code);
        const exact = codes.find(c => c === upper);
        if (exact) {
            if (exact !== country) setState('');
            setCountry(exact);
            setCountrySel({ start: exact.length, end: exact.length });
            return;
        }
        const prefix = codes.find(c => c.startsWith(upper));
        if (prefix) {
            if (prefix !== country) setState('');
            setCountry(prefix);
            setCountrySel({ start: upper.length, end: prefix.length });
            return;
        }
        setCountrySel({ start: country.length, end: country.length });
    };

    const handleStateChange = (text: string) => {
        const upper = text.toUpperCase().replace(/[^A-Z]/g, '');
        if (!upper) { setState(''); setStateSel(undefined); return; }
        const codes = (STATES_BY_COUNTRY[country] ?? []).map(s => s.code);
        if (!codes.length) { setState(upper.slice(0, 3)); setStateSel(undefined); return; }
        const exact = codes.find(c => c === upper);
        if (exact) { setState(exact); setStateSel({ start: exact.length, end: exact.length }); return; }
        const prefix = codes.find(c => c.startsWith(upper));
        if (prefix) { setState(prefix); setStateSel({ start: upper.length, end: prefix.length }); return; }
        setStateSel({ start: state.length, end: state.length });
    };

    const handleBandSearchChange = (text: string) => {
        setBandSearchText(text);
        if (bandSearchTimer.current) clearTimeout(bandSearchTimer.current);
        if (!text.trim()) { setBandResults([]); return; }
        bandSearchTimer.current = setTimeout(async () => {
            setBandSearching(true);
            try {
                const results = await searchBands(text.trim());
                const selectedIds = new Set(selectedBands.map(b => b.id));
                setBandResults(results.filter(r => !selectedIds.has(r.id)));
            } catch { setBandResults([]); }
            finally { setBandSearching(false); }
        }, 300);
    };

    const addLinkedBand = (band: BandResult) => {
        setSelectedBands(prev => [...prev, { id: band.id, name: band.name }]);
        setBandSearchText('');
        setBandResults([]);
    };

    const addUnlinkedBand = () => {
        const name = bandSearchText.trim();
        if (!name) return;
        setUnlinkedBands(prev => [...prev, name]);
        setBandSearchText('');
        setBandResults([]);
    };

    const handleVenueSearchChange = (text: string) => {
        setVenueSearchText(text);
        if (venueSearchTimer.current) clearTimeout(venueSearchTimer.current);
        if (!text.trim()) { setVenueResults([]); return; }
        venueSearchTimer.current = setTimeout(async () => {
            setVenueSearching(true);
            try {
                const results = await searchVenues(text.trim());
                setVenueResults(results);
            } catch { setVenueResults([]); }
            finally { setVenueSearching(false); }
        }, 300);
    };

    const selectVenue = (venue: VenueResult) => {
        setSelectedVenueId(venue.id);
        setSelectedVenueName(venue.name);
        setVenueSearchText('');
        setVenueResults([]);
    };

    const clearVenue = () => {
        setSelectedVenueId(null);
        setSelectedVenueName(null);
        setVenueSearchText('');
        setVenueResults([]);
    };

    useEffect(() => {
        if (visible) {
            if (editingShow) {
                setDate(new Date(editingShow.date));
                const d = editingShow.doors ? new Date(editingShow.doors) : (() => { const t = new Date(); t.setHours(19,0,0,0); return t; })();
                setDoors(d);
                setCity(editingShow.city ?? defaultCity);
                setState(editingShow.state ?? defaultState);
                setCountry(editingShow.country ?? defaultCountry);
                setTicketsUrl(editingShow.ticketsUrl ?? '');
                setNotes(editingShow.notes ?? '');
                setPosterImage(null);
                // Populate venue
                if (editingShow.venue) {
                    setSelectedVenueId(editingShow.venue.id);
                    setSelectedVenueName(editingShow.venue.name);
                } else if (editingShow.venueName) {
                    setSelectedVenueId(null);
                    setSelectedVenueName(null);
                    setVenueSearchText(editingShow.venueName);
                }
                // Populate bands — track existing so we can diff on submit
                const existing = editingShow.bands.map(b => ({ id: b.band.id, name: b.band.name }));
                setSelectedBands(existing);
                setExistingBandIds(new Set(existing.map(b => b.id)));
                setUnlinkedBands(editingShow.bandLineup ? editingShow.bandLineup.split(',').map(s => s.trim()).filter(Boolean) : []);
            } else {
                setCity(defaultCity);
                setState(defaultState);
                setCountry(defaultCountry);
            }
        }
    }, [visible, editingShow]);

    const reset = () => {
        setDate(new Date());
        const d = new Date(); d.setHours(19, 0, 0, 0);
        setDoors(d);
        setCity(defaultCity); setState(defaultState); setCountry(defaultCountry);
        setTicketsUrl(''); setNotes(''); setPosterImage(null);
        setBandSearchText(''); setBandResults([]); setSelectedBands([]); setExistingBandIds(new Set()); setUnlinkedBands([]);
        setVenueSearchText(''); setVenueResults([]); setSelectedVenueId(null); setSelectedVenueName(null);
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.85,
        });
        if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];
            const filename = asset.uri.split('/').pop() ?? 'poster.jpg';
            const ext = filename.split('.').pop() ?? 'jpg';
            setPosterImage({ uri: asset.uri, name: filename, type: `image/${ext}` });
        }
    };

    const handleSubmit = async () => {
        if (!city || !state || !country) {
            Alert.alert('Missing fields', 'City, State, and Country are required.');
            return;
        }
        try {
            setLoading(true);
            const venuePayload = selectedVenueId
                ? { venueId: selectedVenueId }
                : { venueName: venueSearchText.trim() };  // empty string = clear venue on update

            const base = {
                date: date.toISOString(),
                doors: doors.toISOString(),
                city, state, country,
                ticketsUrl: ticketsUrl || undefined,
                notes: notes || undefined,
                posterImage: posterImage ?? undefined,
                bandLineup: unlinkedBands.length ? unlinkedBands.join(', ') : '',
                ...venuePayload,
            };

            if (isEditing) {
                const allSelectedIds = new Set(selectedBands.map(b => b.id));
                const addBandIds = selectedBands.filter(b => !existingBandIds.has(b.id)).map(b => b.id);
                const removeBandIds = [...existingBandIds].filter(id => !allSelectedIds.has(id));
                await updateShow(editingShow!.id, { ...base, addBandIds, removeBandIds });
            } else {
                await createShow({ ...base, bandIds: selectedBands.map(b => b.id), creatorUserId, creatorBandId, creatorVenueId });
            }
            reset();
            onCreated();
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.error || err.message || `Failed to ${isEditing ? 'update' : 'create'} show`);
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = [styles.input, { borderColor, color: borderColor }];
    const pillStyle = [styles.pill, { borderColor, backgroundColor: subtleColor }];

    const formatDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => { reset(); onClose(); }}>
                        <ThemedText style={styles.cancel}>Cancel</ThemedText>
                    </TouchableOpacity>
                    <ThemedText style={styles.title}>{isEditing ? 'Edit Show' : 'New Show'}</ThemedText>
                    <TouchableOpacity onPress={handleSubmit} disabled={loading}>
                        {loading
                            ? <ActivityIndicator color="#4fc435" />
                            : <ThemedText style={styles.save}>{isEditing ? 'Save' : 'Create'}</ThemedText>}
                    </TouchableOpacity>
                </View>

                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
                >
                <ScrollView ref={scrollRef} contentContainerStyle={[styles.body, { paddingBottom: 340 }]} keyboardShouldPersistTaps="handled">
                    {/* Poster picker */}
                    <TouchableOpacity style={[styles.posterPicker, { borderColor }]} onPress={pickImage}>
                        {posterImage
                            ? <RNImage source={{ uri: posterImage.uri }} style={styles.posterPreview} />
                            : editingShow?.posterUrl
                                ? <RNImage source={{ uri: `${BASE_URL}${editingShow.posterUrl}` }} style={styles.posterPreview} />
                                : <ThemedText style={styles.posterHint}>Tap to add poster image</ThemedText>}
                    </TouchableOpacity>

                    {/* Date */}
                    <ThemedText style={styles.label}>Show Date</ThemedText>
                    <TouchableOpacity style={pillStyle} onPress={() => { setShowDoorsPicker(false); setShowDatePicker(v => !v); }}>
                        <ThemedText style={styles.pillText}>{formatDate(date)}</ThemedText>
                    </TouchableOpacity>
                    {showDatePicker && (
                        <DateTimePicker
                            value={date}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'inline' : 'default'}
                            minimumDate={new Date()}
                            onChange={(_: DateTimePickerEvent, selected?: Date) => {
                                if (Platform.OS === 'android') setShowDatePicker(false);
                                if (selected) setDate(selected);
                            }}
                            style={styles.picker}
                        />
                    )}

                    {/* Doors */}
                    <ThemedText style={styles.label}>Doors</ThemedText>
                    <TouchableOpacity style={pillStyle} onPress={() => { setShowDatePicker(false); setShowDoorsPicker(v => !v); }}>
                        <ThemedText style={styles.pillText}>{formatTime(doors)}</ThemedText>
                    </TouchableOpacity>
                    {showDoorsPicker && (
                        <DateTimePicker
                            value={doors}
                            mode="time"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(_: DateTimePickerEvent, selected?: Date) => {
                                if (Platform.OS === 'android') setShowDoorsPicker(false);
                                if (selected) setDoors(selected);
                            }}
                            style={styles.picker}
                        />
                    )}

                    <ThemedText style={styles.label}>Location</ThemedText>

                    <View style={styles.row}>
                        <View style={styles.flex1}>
                            <TextInput
                                ref={cityRef}
                                style={[inputStyle, { marginBottom: 0 }]}
                                placeholder="City"
                                placeholderTextColor="#666"
                                value={city}
                                onChangeText={setCity}
                                onFocus={() => scrollToInput(cityRef)}
                            />
                        </View>
                        <View style={styles.stateField}>
                            <TextInput
                                ref={stateRef}
                                style={[inputStyle, { marginBottom: 0 }]}
                                placeholder="ST"
                                placeholderTextColor="#666"
                                value={state}
                                selection={stateSel}
                                onChangeText={handleStateChange}
                                onFocus={() => { setStateSel(state ? { start: 0, end: state.length } : undefined); scrollToInput(stateRef); }}
                                autoCapitalize="characters"
                                autoCorrect={false}
                            />
                        </View>
                        <View style={styles.countryField}>
                            <TextInput
                                ref={countryRef}
                                style={[inputStyle, { marginBottom: 0 }]}
                                placeholder="CC"
                                placeholderTextColor="#666"
                                value={country}
                                selection={countrySel}
                                onChangeText={handleCountryChange}
                                onFocus={() => { setCountrySel(country ? { start: 0, end: country.length } : undefined); scrollToInput(countryRef); }}
                                autoCapitalize="characters"
                                autoCorrect={false}
                            />
                        </View>
                    </View>

                    {/* Venue */}
                    <ThemedText style={styles.label}>Venue</ThemedText>
                    {selectedVenueId ? (
                        <View style={styles.chipRow}>
                            <View style={[styles.chip, styles.linkedChip]}>
                                <ThemedText style={styles.chipText}>{selectedVenueName}</ThemedText>
                                <TouchableOpacity onPress={clearVenue} style={styles.chipX}>
                                    <Ionicons name="close" size={13} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View>
                            <TextInput
                                style={inputStyle}
                                placeholder="Search or type venue name..."
                                placeholderTextColor="#666"
                                value={venueSearchText}
                                onChangeText={handleVenueSearchChange}
                                autoCorrect={false}
                            />
                            {(venueResults.length > 0 || venueSearching) && (
                                <View style={[styles.dropdown, { backgroundColor: bg, borderColor: borderColor + '44' }]}>
                                    {venueSearching && <ActivityIndicator style={{ padding: 8 }} />}
                                    {venueResults.map(v => (
                                        <TouchableOpacity
                                            key={v.id}
                                            style={[styles.dropdownItem, { borderBottomColor: borderColor + '22' }]}
                                            onPress={() => selectVenue(v)}
                                        >
                                            <ThemedText style={styles.dropdownName}>{v.name}</ThemedText>
                                            {v.city && <ThemedText style={styles.dropdownSub}>{v.city}</ThemedText>}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>
                    )}

                    {/* Bands */}
                    <ThemedText style={styles.label}>Bands</ThemedText>
                    {(selectedBands.length > 0 || unlinkedBands.length > 0) && (
                        <View style={styles.chipRow}>
                            {selectedBands.map(b => (
                                <View key={b.id} style={[styles.chip, styles.linkedChip]}>
                                    <ThemedText style={styles.chipText}>{b.name}</ThemedText>
                                    <TouchableOpacity
                                        onPress={() => setSelectedBands(prev => prev.filter(x => x.id !== b.id))}
                                        style={styles.chipX}
                                    >
                                        <Ionicons name="close" size={13} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {unlinkedBands.map((name, i) => (
                                <View key={`u-${i}`} style={[styles.chip, styles.unlinkedChip]}>
                                    <ThemedText style={styles.chipText}>{name}</ThemedText>
                                    <TouchableOpacity
                                        onPress={() => setUnlinkedBands(prev => prev.filter((_, idx) => idx !== i))}
                                        style={styles.chipX}
                                    >
                                        <Ionicons name="close" size={13} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}
                    <View style={styles.row}>
                        <View style={styles.flex1}>
                            <TextInput
                                style={[inputStyle, { marginBottom: 0 }]}
                                placeholder="Search or type band name..."
                                placeholderTextColor="#666"
                                value={bandSearchText}
                                onChangeText={handleBandSearchChange}
                                autoCorrect={false}
                            />
                        </View>
                        <TouchableOpacity
                            style={[styles.addBtn, { borderColor }]}
                            onPress={addUnlinkedBand}
                        >
                            <ThemedText style={styles.addBtnText}>Add</ThemedText>
                        </TouchableOpacity>
                    </View>
                    {(bandResults.length > 0 || bandSearching) && (
                        <View style={[styles.dropdown, { backgroundColor: bg, borderColor: borderColor + '44' }]}>
                            {bandSearching && <ActivityIndicator style={{ padding: 8 }} />}
                            {bandResults.map(b => (
                                <TouchableOpacity
                                    key={b.id}
                                    style={[styles.dropdownItem, { borderBottomColor: borderColor + '22' }]}
                                    onPress={() => addLinkedBand(b)}
                                >
                                    <ThemedText style={styles.dropdownName}>{b.name}</ThemedText>
                                    {b.city && <ThemedText style={styles.dropdownSub}>{b.city}</ThemedText>}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    <ThemedText style={styles.label}>Ticket URL</ThemedText>
                    <TextInput
                        ref={ticketRef}
                        style={inputStyle}
                        placeholder="https://..."
                        placeholderTextColor="#666"
                        value={ticketsUrl}
                        onChangeText={setTicketsUrl}
                        onFocus={() => scrollToInput(ticketRef)}
                        autoCapitalize="none"
                        keyboardType="url"
                    />

                    <ThemedText style={styles.label}>Notes</ThemedText>
                    <TextInput
                        ref={notesRef}
                        style={[inputStyle, styles.notesInput]}
                        placeholder="Any extra info..."
                        placeholderTextColor="#666"
                        value={notes}
                        onChangeText={setNotes}
                        onFocus={() => scrollToInput(notesRef)}
                        multiline
                    />
                </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#444',
    },
    title: { fontSize: 16, fontWeight: '700' },
    cancel: { fontSize: 15, opacity: 0.6 },
    save: { fontSize: 15, color: '#4fc435', fontWeight: '700' },
    body: { padding: 20, gap: 4 },
    label: { fontSize: 11, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, marginTop: 14 },
    input: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        padding: 11,
        fontSize: 15,
        marginBottom: 0,
    },
    pill: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    pillText: { fontSize: 15 },
    picker: { width: '100%' },
    notesInput: { minHeight: 80, textAlignVertical: 'top' },
    row: { flexDirection: 'row', gap: 8 },
    flex1: { flex: 1 },
    stateField: { width: 80 },
    countryField: { width: 54 },
    posterPicker: {
        height: 180,
        borderWidth: StyleSheet.hairlineWidth,
        borderStyle: 'dashed',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
        overflow: 'hidden',
    },
    posterPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
    posterHint: { opacity: 0.4, fontSize: 14 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    linkedChip: { backgroundColor: '#4A90D9' },
    unlinkedChip: { backgroundColor: '#666' },
    chipText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    chipX: { marginLeft: 4 },
    dropdown: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        marginTop: 4,
        overflow: 'hidden',
        zIndex: 10,
    },
    dropdownItem: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    dropdownName: { fontSize: 14, fontWeight: '600' },
    dropdownSub: { fontSize: 12, opacity: 0.5 },
    addBtn: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 11,
        justifyContent: 'center',
    },
    addBtnText: { fontSize: 14, fontWeight: '600' },
});
