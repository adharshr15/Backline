import {
    Modal,
    View,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Alert,
    ActivityIndicator,
    Platform,
    Image as RNImage,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { createShow, updateShow, Show } from '@/services/show.service';
import { BASE_URL } from '@/services/api';

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

export default function CreateShowModal({ visible, onClose, onCreated, creatorUserId, creatorBandId, creatorVenueId, defaultCity = '', defaultState = '', defaultCountry = '', editingShow }: Props) {
    const isEditing = !!editingShow;
    const borderColor = useThemeColor({}, 'text');
    const bg = useThemeColor({}, 'background');
    const subtleColor = useThemeColor({ light: '#f0f0f0', dark: '#1e1e1e' }, 'background');

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
                setPosterImage(null); // existing poster shown separately
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
            const payload = {
                date: date.toISOString(),
                doors: doors.toISOString(),
                city, state, country,
                ticketsUrl: ticketsUrl || undefined,
                notes: notes || undefined,
                posterImage: posterImage ?? undefined,
            };
            const show = isEditing
                ? await updateShow(editingShow!.id, payload)
                : await createShow({ ...payload, creatorUserId, creatorBandId, creatorVenueId });
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

                <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
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
                            <TextInput style={[inputStyle, { marginBottom: 0 }]} placeholder="City" placeholderTextColor="#666" value={city} onChangeText={setCity} />
                        </View>
                        <View style={styles.stateField}>
                            <TextInput style={[inputStyle, { marginBottom: 0 }]} placeholder="State" placeholderTextColor="#666" value={state} onChangeText={setState} autoCapitalize="characters" />
                        </View>
                        <View style={styles.countryField}>
                            <TextInput style={[inputStyle, { marginBottom: 0 }]} placeholder="CC" placeholderTextColor="#666" value={country} onChangeText={setCountry} autoCapitalize="characters" maxLength={2} />
                        </View>
                    </View>

                    <ThemedText style={styles.label}>Ticket URL</ThemedText>
                    <TextInput
                        style={inputStyle}
                        placeholder="https://..."
                        placeholderTextColor="#666"
                        value={ticketsUrl}
                        onChangeText={setTicketsUrl}
                        autoCapitalize="none"
                        keyboardType="url"
                    />

                    <ThemedText style={styles.label}>Notes</ThemedText>
                    <TextInput
                        style={[inputStyle, styles.notesInput]}
                        placeholder="Any extra info..."
                        placeholderTextColor="#666"
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                    />
                </ScrollView>
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
});
