import { useAuth, type Band } from '@/context/AuthContext';
import { updateBand } from '@/services/band.service';
import GenrePicker, { PickedGenre } from '@/components/profile/genre-picker';
import { useState, useRef } from 'react';
import { Alert, Text, Image, TextInput, TouchableOpacity, ScrollView, View, Modal } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { BASE_URL } from '@/services/api';
import { toStateCode, toCountryCode } from '@/utils/location';
import { AVATAR_SIZE } from '../(tabs)/profile';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { styles } from './edit-user-profile';

const HEADER_HEIGHT = 140;

export function EditBandProfileModal({ onClose }: { onClose: () => void }) {
    const { activeProfile, setActiveProfile, refreshUser } = useAuth();
    const scrollViewRef = useRef<ScrollView>(null);
    const nameInputRef = useRef<TextInput>(null);
    const bioInputRef = useRef<TextInput>(null);
    const locationInputRef = useRef<TextInput>(null);

    if (!activeProfile || activeProfile.accountType !== 'BAND') return null;
    const band = activeProfile as Band;

    const [name, setName] = useState(band.name || '');
    const [genres, setGenres] = useState<PickedGenre[]>(band.genres ?? []);
    const slugKey = (list: { slug: string }[]) => list.map(g => g.slug).join(',');
    // Order matters (first is primary), so a reorder counts as a change.
    const genresChanged = slugKey(genres) !== slugKey(band.genres ?? []);
    const [bio, setBio] = useState(band.bio || '');
    const [city, setCity] = useState(band.city || '');
    const [state, setState] = useState(band.state || '');
    const [country, setCountry] = useState(band.country || '');
    const bandLocation = [city, state, country].filter(Boolean).join(', ');
    const [locationQuery, setLocationQuery] = useState(bandLocation);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [profileImage, setProfileImage] = useState<string | null>(band.profileImageUrl || null);
    const [headerImage, setHeaderImage] = useState<string | null>(band.headerImageUrl || null);

    const scrollToInput = (inputRef: React.RefObject<TextInput | null>) => {
        setTimeout(() => {
            inputRef.current?.measure((fx, fy, width, height, px, py) => {
                scrollViewRef.current?.scrollResponderScrollNativeHandleToKeyboard(
                    inputRef.current as any, 150, true
                );
            });
        }, 200);
    };

    const handleSave = async () => {
        if (
            name === band.name &&
            !genresChanged &&
            bio === (band.bio || '') &&
            city === (band.city || '') &&
            state === (band.state || '') &&
            country === (band.country || '') &&
            profileImage === (band.profileImageUrl || null) &&
            headerImage === (band.headerImageUrl || null)
        ) {
            router.back();
            return;
        }

        try {
            const updatedBand = await updateBand(band.id, {
                name, bio, city, state, country, profileImage, headerImage,
                // Only sent when changed: PUT replaces the whole set.
                ...(genresChanged ? { genres: genres.map(g => g.slug) } : {}),
            });
            setActiveProfile({ ...updatedBand, accountType: 'BAND' });
            await refreshUser();
            router.back();
        } catch (err: any) {
            Alert.alert('Error', err.message);
        }
    };

    const fetchLocations = async (query: string) => {
        if (!query) { setSuggestions([]); setShowSuggestions(false); return; }
        try {
            const res = await fetch(`https://photon.komoot.io/api/?q=${query}&limit=5`);
            const data = await res.json();
            setSuggestions(data.features || []);
            setShowSuggestions(true);
        } catch {
            setSuggestions([]);
        }
    };

    const pickImage = async (imageType: 'profile' | 'header') => {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, quality: 0.8 });
        if (!result.canceled) {
            if (imageType === 'profile') setProfileImage(result.assets[0].uri);
            if (imageType === 'header') setHeaderImage(result.assets[0].uri);
        }
    };

    const getImageUri = (img: string) => img.startsWith('file://') ? img : `${BASE_URL}${img}`;

    return (
        <Modal animationType="slide" transparent={false} presentationStyle="pageSheet">
            <ThemedView style={{ flex: 1 }}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose}>
                        <ThemedText style={styles.cancel}>Cancel</ThemedText>
                    </TouchableOpacity>
                    <ThemedText style={styles.title}>Edit Band</ThemedText>
                    <TouchableOpacity onPress={handleSave}>
                        <ThemedText style={styles.save}>Save</ThemedText>
                    </TouchableOpacity>
                </View>

                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={56} style={{ flex: 1 }}>
                    <ScrollView ref={scrollViewRef} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 200 }}>
                        <TouchableOpacity onPress={() => pickImage('header')}>
                            <Image
                                source={headerImage ? { uri: getImageUri(headerImage) } : require('@/assets/images/default/headerImage.png')}
                                style={{ width: '100%', height: HEADER_HEIGHT, overflow: 'hidden' }}
                            />
                            {!headerImage && <View style={styles.headerPlaceholder}><Text style={styles.imagePickerText}>+ Header Image</Text></View>}
                        </TouchableOpacity>

                        <View style={styles.pfpContainer}>
                            <TouchableOpacity onPress={() => pickImage('profile')}>
                                <View style={[styles.pfpWrapper, { borderColor: '#ccc' }]}>
                                    <Image
                                        source={profileImage ? { uri: getImageUri(profileImage) } : require('@/assets/images/default/profileImage.png')}
                                        style={{ width: '100%', height: '100%' }}
                                    />
                                    {!profileImage && <View style={styles.pfpPlaceholder}><Text style={styles.imagePickerText}>+ Profile Photo</Text></View>}
                                </View>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.section}>
                            <View style={styles.inputGroup}>
                                <ThemedText style={styles.label}>Band Name</ThemedText>
                                <TextInput ref={nameInputRef} value={name} onChangeText={setName} style={styles.input} placeholder="Band name" onFocus={() => scrollToInput(nameInputRef)} />
                            </View>

                            <View style={styles.inputGroup}>
                                <GenrePicker value={genres} onChange={setGenres} />
                            </View>

                            <View style={styles.inputGroup}>
                                <ThemedText style={styles.label}>Bio</ThemedText>
                                <TextInput ref={bioInputRef} value={bio} onChangeText={setBio} style={[styles.input, styles.textArea]} placeholder="Tell people about your band" multiline maxLength={150} onFocus={() => scrollToInput(bioInputRef)} />
                            </View>

                            <View style={styles.inputGroup}>
                                <ThemedText style={styles.label}>Location</ThemedText>
                                <TextInput
                                    ref={locationInputRef}
                                    style={styles.input}
                                    placeholder="Location"
                                    value={locationQuery}
                                    onChangeText={(text) => { setLocationQuery(text); fetchLocations(text); }}
                                    onFocus={() => scrollToInput(locationInputRef)}
                                />
                                {showSuggestions && suggestions?.length > 0 && (
                                    <View style={styles.dropdown}>
                                        {suggestions.map((item, index) => {
                                            const props = item.properties;
                                            const stateCode = toStateCode(props.state || '');
                                            const countryCode = toCountryCode(props.countrycode || '');
                                            const display = `${props.name || ''}, ${stateCode}, ${countryCode}`;
                                            return (
                                                <TouchableOpacity key={index} style={styles.dropdownItem} onPress={() => {
                                                    setCity(props.name || ''); setState(stateCode); setCountry(countryCode);
                                                    setLocationQuery(display); setShowSuggestions(false);
                                                }}>
                                                    <Text style={{ color: 'white' }}>{display}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </ThemedView>
        </Modal>
    );
}
