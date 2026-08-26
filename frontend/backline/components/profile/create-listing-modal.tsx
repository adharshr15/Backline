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
    Switch,
    Image as RNImage,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import { useState, useEffect, useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { createListing, updateListing, deleteListing, addListingMedia, reorderListingPhotos, getListingById, Listing, ListingKind, GEAR_CATEGORIES } from '@/services/listing.service';
import { BASE_URL } from '@/services/api';
import { COUNTRY_LIST, STATES_BY_COUNTRY } from '@/utils/location';

type PhotoItem = {
    key: string;
    uri: string;                                        // display URI (local or `${BASE_URL}${url}`)
    source: 'new' | 'existing';
    file?: { uri: string; name: string; type: string }; // for newly picked photos
    url?: string;                                        // for existing server photos (/uploads/..)
};

interface Props {
    visible: boolean;
    onClose: () => void;
    onSaved: () => void;
    creatorUserId?: string;
    creatorBandId?: string;
    creatorVenueId?: string;
    defaultCity?: string;
    defaultState?: string;
    defaultCountry?: string;
    editingListing?: Listing;
}

export default function CreateListingModal({
    visible, onClose, onSaved,
    creatorUserId, creatorBandId, creatorVenueId,
    defaultCity = '', defaultState = '', defaultCountry = '',
    editingListing,
}: Props) {
    const isEditing = !!editingListing;
    const borderColor = useThemeColor({}, 'text');
    const bg = useThemeColor({}, 'background');

    const scrollRef = useRef<ScrollView>(null);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [categoryOpen, setCategoryOpen] = useState(false);
    const [categoryOther, setCategoryOther] = useState(false);
    const [kind, setKind] = useState<ListingKind>('RENT');
    const [price, setPrice] = useState('');
    const [openToTrades, setOpenToTrades] = useState(false);
    const [city, setCity] = useState(defaultCity);
    const [state, setState] = useState(defaultState);
    const [country, setCountry] = useState(defaultCountry);
    const [photos, setPhotos] = useState<PhotoItem[]>([]);
    const [loading, setLoading] = useState(false);

    type Sel = { start: number; end: number } | undefined;
    const [stateSel, setStateSel] = useState<Sel>(undefined);
    const [countrySel, setCountrySel] = useState<Sel>(undefined);

    const handleCountryChange = (text: string) => {
        const upper = text.toUpperCase().replace(/[^A-Z]/g, '');
        if (!upper) { setCountry(''); setState(''); setCountrySel(undefined); return; }
        const codes = COUNTRY_LIST.map(c => c.code);
        const exact = codes.find(c => c === upper);
        if (exact) { if (exact !== country) setState(''); setCountry(exact); setCountrySel({ start: exact.length, end: exact.length }); return; }
        const prefix = codes.find(c => c.startsWith(upper));
        if (prefix) { if (prefix !== country) setState(''); setCountry(prefix); setCountrySel({ start: upper.length, end: prefix.length }); return; }
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

    useEffect(() => {
        if (!visible) return;
        if (editingListing) {
            setTitle(editingListing.title);
            setDescription(editingListing.description);
            setCategory(editingListing.category ?? '');
            setCategoryOther(!!editingListing.category && !GEAR_CATEGORIES.includes(editingListing.category as any));
            setCategoryOpen(false);
            setKind(editingListing.kind);
            setPrice(editingListing.price != null ? String(editingListing.price) : '');
            setOpenToTrades(editingListing.openToTrades);
            setCity(editingListing.city ?? defaultCity);
            setState(editingListing.state ?? defaultState);
            setCountry(editingListing.country ?? defaultCountry);
            setPhotos(buildExistingPhotos(editingListing.coverUrl, editingListing.media));
            // Gallery media may be missing on the summary object — fetch the full listing
            getListingById(editingListing.id)
                .then(full => setPhotos(buildExistingPhotos(full.coverUrl, full.media)))
                .catch(() => {});
        } else {
            reset();
        }
    }, [visible, editingListing]);

    const buildExistingPhotos = (coverUrl?: string | null, media?: Listing['media']): PhotoItem[] => {
        const items: PhotoItem[] = [];
        if (coverUrl) items.push({ key: `cover:${coverUrl}`, uri: `${BASE_URL}${coverUrl}`, source: 'existing', url: coverUrl });
        (media ?? []).forEach(m => items.push({ key: m.id, uri: `${BASE_URL}${m.url}`, source: 'existing', url: m.url }));
        return items;
    };

    const reset = () => {
        setTitle(''); setDescription(''); setCategory(''); setCategoryOther(false); setCategoryOpen(false); setKind('RENT');
        setPrice(''); setOpenToTrades(false);
        setCity(defaultCity); setState(defaultState); setCountry(defaultCountry);
        setPhotos([]);
    };

    const assetToPhoto = (asset: ImagePicker.ImagePickerAsset): PhotoItem => {
        const filename = asset.uri.split('/').pop() ?? 'photo.jpg';
        const ext = filename.split('.').pop() ?? 'jpg';
        return {
            key: `new:${asset.assetId ?? asset.uri}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
            uri: asset.uri,
            source: 'new',
            file: { uri: asset.uri, name: filename, type: `image/${ext}` },
        };
    };

    const pickPhotos = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            selectionLimit: 10,
            quality: 0.85,
        });
        if (result.canceled || !result.assets.length) return;
        setPhotos(prev => [...prev, ...result.assets.map(assetToPhoto)]);
    };

    const setAsCover = (key: string) => {
        setPhotos(prev => {
            const idx = prev.findIndex(p => p.key === key);
            if (idx <= 0) return prev;
            const next = [...prev];
            const [item] = next.splice(idx, 1);
            next.unshift(item);
            return next;
        });
    };

    const removePhoto = (key: string) => {
        setPhotos(prev => prev.filter(p => p.key !== key));
    };

    const handleSubmit = async () => {
        if (!title.trim() || !description.trim() || !city.trim()) {
            Alert.alert('Missing fields', 'Title, description, and city are required.');
            return;
        }
        if (price.trim() && isNaN(Number(price))) {
            Alert.alert('Invalid price', 'Price must be a number, or leave it blank for "DM for info".');
            return;
        }
        try {
            setLoading(true);
            const base = {
                title: title.trim(),
                description: description.trim(),
                category: category.trim() || undefined,
                kind,
                price: price.trim() || '',   // '' => cleared => "DM for info"
                openToTrades,
                city: city.trim(),
                state: state || undefined,
                country: country || undefined,
                // cover + gallery are set below via the reconcile step
            };

            let listingId: string;
            if (isEditing) {
                await updateListing(editingListing!.id, base);
                listingId = editingListing!.id;
            } else {
                const created = await createListing({ ...base, creatorUserId, creatorBandId, creatorVenueId });
                listingId = created.id;
            }

            // Upload any newly picked photos, then reconcile the full order (index 0 = cover)
            const orderedUrls: string[] = [];
            for (const photo of photos) {
                if (photo.source === 'existing') {
                    orderedUrls.push(photo.url!);
                } else {
                    const media = await addListingMedia(listingId, photo.file!);
                    orderedUrls.push(media.url);
                }
            }
            await reorderListingPhotos(listingId, orderedUrls);

            reset();
            onSaved();
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.error || err.message || `Failed to ${isEditing ? 'update' : 'create'} listing`);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = () => {
        Alert.alert('Delete Listing', 'This will permanently delete the listing. Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await deleteListing(editingListing!.id);
                        reset();
                        onSaved();
                        onClose();
                    } catch (err: any) {
                        Alert.alert('Error', err.response?.data?.error || 'Failed to delete listing');
                    }
                },
            },
        ]);
    };

    const inputStyle = [styles.input, { borderColor, color: borderColor }];

    const renderPhoto = ({ item, drag, isActive, getIndex }: RenderItemParams<PhotoItem>) => {
        const index = getIndex() ?? 0;
        return (
            <ScaleDecorator>
                <TouchableOpacity
                    style={[styles.photoTile, isActive && styles.photoTileActive]}
                    onLongPress={drag}
                    disabled={isActive}
                    activeOpacity={0.85}
                >
                    <RNImage source={{ uri: item.uri }} style={styles.photoImg} />
                    {index === 0 ? (
                        <View style={styles.coverTag}>
                            <ThemedText style={styles.coverTagText}>COVER</ThemedText>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.starBtn} onPress={() => setAsCover(item.key)} hitSlop={6}>
                            <Ionicons name="star" size={12} color="#fff" />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(item.key)} hitSlop={6}>
                        <Ionicons name="close" size={13} color="#fff" />
                    </TouchableOpacity>
                </TouchableOpacity>
            </ScaleDecorator>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => { reset(); onClose(); }}>
                        <ThemedText style={styles.cancel}>Cancel</ThemedText>
                    </TouchableOpacity>
                    <ThemedText style={styles.title}>{isEditing ? 'Edit Listing' : 'New Listing'}</ThemedText>
                    <TouchableOpacity onPress={handleSubmit} disabled={loading}>
                        {loading
                            ? <ActivityIndicator color="#4fc435" />
                            : <ThemedText style={styles.save}>{isEditing ? 'Save' : 'Post'}</ThemedText>}
                    </TouchableOpacity>
                </View>

                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
                >
                    <ScrollView ref={scrollRef} contentContainerStyle={[styles.body, { paddingBottom: 240 }]} keyboardShouldPersistTaps="handled">
                        {/* Photos */}
                        <View style={styles.morePhotosHeader}>
                            <ThemedText style={styles.label}>Photos</ThemedText>
                            <TouchableOpacity style={[styles.addPhotosBtn, { borderColor }]} onPress={pickPhotos} activeOpacity={0.7}>
                                <Ionicons name="add" size={14} color={borderColor} />
                                <ThemedText style={styles.addPhotosText}>Add</ThemedText>
                            </TouchableOpacity>
                        </View>
                        {photos.length === 0 ? (
                            <TouchableOpacity style={[styles.coverPicker, { borderColor }]} onPress={pickPhotos}>
                                <ThemedText style={styles.coverHint}>Tap to add photos — first is the cover</ThemedText>
                            </TouchableOpacity>
                        ) : (
                            <>
                                <DraggableFlatList
                                    horizontal
                                    data={photos}
                                    keyExtractor={item => item.key}
                                    onDragEnd={({ data }) => setPhotos(data)}
                                    renderItem={renderPhoto}
                                    showsHorizontalScrollIndicator={false}
                                    activationDistance={14}
                                    containerStyle={{ marginTop: 8 }}
                                    contentContainerStyle={styles.thumbStrip}
                                />
                                <ThemedText style={styles.morePhotosHint}>
                                    Drag to reorder · ★ makes a photo the cover · first photo is the cover
                                </ThemedText>
                            </>
                        )}

                        <ThemedText style={styles.label}>Title</ThemedText>
                        <TextInput
                            style={inputStyle}
                            placeholder="e.g. Fender Twin Reverb"
                            placeholderTextColor="#666"
                            value={title}
                            onChangeText={setTitle}
                        />

                        <ThemedText style={styles.label}>Category</ThemedText>
                        <TouchableOpacity
                            style={[styles.picker, { borderColor }]}
                            onPress={() => setCategoryOpen(o => !o)}
                            activeOpacity={0.7}
                        >
                            <ThemedText style={[styles.pickerText, !category && !categoryOther && styles.pickerPlaceholder]}>
                                {categoryOther ? 'Other' : (category || 'Select a category')}
                            </ThemedText>
                            <Ionicons name={categoryOpen ? 'chevron-up' : 'chevron-down'} size={18} color={borderColor} style={{ opacity: 0.5 }} />
                        </TouchableOpacity>
                        {categoryOpen && (
                            <View style={[styles.dropdown, { borderColor }]}>
                                {GEAR_CATEGORIES.map(cat => (
                                    <TouchableOpacity
                                        key={cat}
                                        style={[styles.dropdownItem, { borderBottomColor: borderColor + '22' }]}
                                        onPress={() => { setCategory(cat); setCategoryOther(false); setCategoryOpen(false); }}
                                    >
                                        <ThemedText style={styles.dropdownText}>{cat}</ThemedText>
                                        {!categoryOther && category === cat && <Ionicons name="checkmark" size={16} color="#4A90D9" />}
                                    </TouchableOpacity>
                                ))}
                                <TouchableOpacity
                                    style={[styles.dropdownItem, { borderBottomColor: borderColor + '22' }]}
                                    onPress={() => { setCategoryOther(true); setCategory(''); setCategoryOpen(false); }}
                                >
                                    <ThemedText style={styles.dropdownText}>Other…</ThemedText>
                                    {categoryOther && <Ionicons name="checkmark" size={16} color="#4A90D9" />}
                                </TouchableOpacity>
                            </View>
                        )}
                        {categoryOther && (
                            <TextInput
                                style={[inputStyle, { marginTop: 8 }]}
                                placeholder="Enter a category"
                                placeholderTextColor="#666"
                                value={category}
                                onChangeText={setCategory}
                            />
                        )}

                        {/* Kind toggle */}
                        <ThemedText style={styles.label}>Type</ThemedText>
                        <View style={[styles.segment, { borderColor }]}>
                            {(['RENT', 'SALE'] as ListingKind[]).map(k => (
                                <TouchableOpacity
                                    key={k}
                                    style={[styles.segmentBtn, kind === k && styles.segmentBtnActive]}
                                    onPress={() => setKind(k)}
                                >
                                    <ThemedText style={[styles.segmentText, kind === k && styles.segmentTextActive]}>
                                        {k === 'RENT' ? 'Borrow / Rent' : 'For Sale'}
                                    </ThemedText>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <ThemedText style={styles.label}>{kind === 'RENT' ? 'Price per day' : 'Price'}</ThemedText>
                        <TextInput
                            style={inputStyle}
                            placeholder="Leave blank for “DM for info”"
                            placeholderTextColor="#666"
                            value={price}
                            onChangeText={setPrice}
                            keyboardType="decimal-pad"
                        />

                        <View style={styles.switchRow}>
                            <ThemedText style={styles.switchLabel}>Open to trades</ThemedText>
                            <Switch value={openToTrades} onValueChange={setOpenToTrades} trackColor={{ true: '#4A90D9' }} />
                        </View>

                        <ThemedText style={styles.label}>Location</ThemedText>
                        <View style={styles.row}>
                            <View style={styles.flex1}>
                                <TextInput
                                    style={[inputStyle, { marginBottom: 0 }]}
                                    placeholder="City"
                                    placeholderTextColor="#666"
                                    value={city}
                                    onChangeText={setCity}
                                />
                            </View>
                            <View style={styles.stateField}>
                                <TextInput
                                    style={[inputStyle, { marginBottom: 0 }]}
                                    placeholder="ST"
                                    placeholderTextColor="#666"
                                    value={state}
                                    selection={stateSel}
                                    onChangeText={handleStateChange}
                                    onFocus={() => setStateSel(state ? { start: 0, end: state.length } : undefined)}
                                    autoCapitalize="characters"
                                    autoCorrect={false}
                                />
                            </View>
                            <View style={styles.countryField}>
                                <TextInput
                                    style={[inputStyle, { marginBottom: 0 }]}
                                    placeholder="CC"
                                    placeholderTextColor="#666"
                                    value={country}
                                    selection={countrySel}
                                    onChangeText={handleCountryChange}
                                    onFocus={() => setCountrySel(country ? { start: 0, end: country.length } : undefined)}
                                    autoCapitalize="characters"
                                    autoCorrect={false}
                                />
                            </View>
                        </View>

                        <ThemedText style={styles.label}>Description</ThemedText>
                        <TextInput
                            style={[inputStyle, styles.descInput]}
                            placeholder="Condition, pickup details, trade interests..."
                            placeholderTextColor="#666"
                            value={description}
                            onChangeText={setDescription}
                            multiline
                        />

                        {isEditing && (
                            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                                <ThemedText style={styles.deleteBtnText}>Delete Listing</ThemedText>
                            </TouchableOpacity>
                        )}
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
            </GestureHandlerRootView>
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
    descInput: { minHeight: 90, textAlignVertical: 'top' },
    picker: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        paddingHorizontal: 11,
        paddingVertical: 12,
    },
    pickerText: { fontSize: 15 },
    pickerPlaceholder: { opacity: 0.4 },
    dropdown: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        marginTop: 6,
        overflow: 'hidden',
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    dropdownText: { fontSize: 15 },
    row: { flexDirection: 'row', gap: 8 },
    flex1: { flex: 1 },
    stateField: { width: 80 },
    countryField: { width: 54 },
    coverPicker: {
        height: 180,
        borderWidth: StyleSheet.hairlineWidth,
        borderStyle: 'dashed',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
        overflow: 'hidden',
    },
    coverHint: { opacity: 0.4, fontSize: 14 },
    morePhotosHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    addPhotosBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
        marginTop: 10,
    },
    addPhotosText: { fontSize: 12, fontWeight: '600' },
    morePhotosHint: { fontSize: 12, opacity: 0.4, marginTop: 8 },
    thumbStrip: { gap: 10, paddingRight: 4, paddingTop: 8, paddingBottom: 4 },
    photoTile: { width: 92, height: 92, marginRight: 2 },
    photoTileActive: { opacity: 0.9 },
    photoImg: { width: 92, height: 92, borderRadius: 8, backgroundColor: '#1e1e1e' },
    coverTag: {
        position: 'absolute',
        bottom: 5,
        left: 5,
        backgroundColor: 'rgba(74,144,217,0.95)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    coverTagText: { color: '#fff', fontSize: 8, fontWeight: '700', letterSpacing: 0.6 },
    starBtn: {
        position: 'absolute',
        bottom: 5,
        left: 5,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    photoRemove: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(0,0,0,0.8)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    segment: {
        flexDirection: 'row',
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        overflow: 'hidden',
    },
    segmentBtn: {
        flex: 1,
        paddingVertical: 11,
        alignItems: 'center',
    },
    segmentBtnActive: { backgroundColor: '#4A90D9' },
    segmentText: { fontSize: 14, fontWeight: '600', opacity: 0.6 },
    segmentTextActive: { color: '#fff', opacity: 1 },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 18,
    },
    switchLabel: { fontSize: 15, fontWeight: '600' },
    deleteBtn: { marginTop: 32, alignItems: 'center', paddingVertical: 12 },
    deleteBtnText: { fontSize: 15, fontWeight: '600', color: '#ff3b30' },
});
