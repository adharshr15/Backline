import { useAuth, type Venue } from '@/context/AuthContext';
import { updateVenue } from '@/services/venue.service';
import { useState, useRef } from 'react';
import { Alert, Text, Image, TextInput, TouchableOpacity, ScrollView, View, Modal } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { BASE_URL } from '@/services/api';
import { AVATAR_SIZE } from '../(tabs)/profile';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { styles } from './edit-user-profile';

const HEADER_HEIGHT = 140;

export function EditVenueProfileModal({ onClose }: { onClose: () => void }) {
    const { activeProfile, setActiveProfile, refreshUser } = useAuth();
    const scrollViewRef = useRef<ScrollView>(null);
    const nameInputRef = useRef<TextInput>(null);
    const addressInputRef = useRef<TextInput>(null);
    const capacityInputRef = useRef<TextInput>(null);
    const contactEmailInputRef = useRef<TextInput>(null);
    const bioInputRef = useRef<TextInput>(null);
    const locationInputRef = useRef<TextInput>(null);

    if (!activeProfile || activeProfile.accountType !== 'VENUE') return null;
    const venue = activeProfile as Venue;

    const [name, setName] = useState(venue.name || '');
    const [bio, setBio] = useState(venue.bio || '');
    const [address, setAddress] = useState(venue.address || '');
    const [capacity, setCapacity] = useState(venue.capacity || '');
    const [contactEmail, setContactEmail] = useState(venue.contactEmail || '');
    const [city, setCity] = useState(venue.city || '');
    const [state, setState] = useState(venue.state || '');
    const [country, setCountry] = useState(venue.country || '');
    const venueLocation = [city, state, country].filter(Boolean).join(', ');
    const [locationQuery, setLocationQuery] = useState(venueLocation);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [profileImage, setProfileImage] = useState<string | null>(venue.profileImageUrl || null);
    const [headerImage, setHeaderImage] = useState<string | null>(venue.headerImageUrl || null);

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
            name === venue.name &&
            bio === (venue.bio || '') &&
            address === (venue.address || '') &&
            capacity === (venue.capacity || '') &&
            contactEmail === (venue.contactEmail || '') &&
            city === (venue.city || '') &&
            state === (venue.state || '') &&
            country === (venue.country || '') &&
            profileImage === (venue.profileImageUrl || null) &&
            headerImage === (venue.headerImageUrl || null)
        ) {
            router.back();
            return;
        }

        try {
            const updatedVenue = await updateVenue(venue.id, { name, bio, address, capacity, contactEmail, city, state, country, profileImage, headerImage });
            setActiveProfile({ ...updatedVenue, accountType: 'VENUE' });
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
                    <ThemedText style={styles.title}>Edit Venue</ThemedText>
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
                                <ThemedText style={styles.label}>Venue Name</ThemedText>
                                <TextInput ref={nameInputRef} value={name} onChangeText={setName} style={styles.input} placeholder="Venue name" onFocus={() => scrollToInput(nameInputRef)} />
                            </View>

                            <View style={styles.inputGroup}>
                                <ThemedText style={styles.label}>Address</ThemedText>
                                <TextInput ref={addressInputRef} value={address} onChangeText={setAddress} style={styles.input} placeholder="e.g. 123 Main St" onFocus={() => scrollToInput(addressInputRef)} />
                            </View>

                            <View style={styles.inputGroup}>
                                <ThemedText style={styles.label}>Bio</ThemedText>
                                <TextInput ref={bioInputRef} value={bio} onChangeText={setBio} style={[styles.input, styles.textArea]} placeholder="Tell people about your venue" multiline maxLength={150} onFocus={() => scrollToInput(bioInputRef)} />
                            </View>

                            <View style={styles.inputGroup}>
                                <ThemedText style={styles.label}>Capacity</ThemedText>
                                <TextInput ref={capacityInputRef} value={capacity} onChangeText={setCapacity} style={styles.input} placeholder="e.g. 500" keyboardType="numeric" onFocus={() => scrollToInput(capacityInputRef)} />
                            </View>

                            <View style={styles.inputGroup}>
                                <ThemedText style={styles.label}>Contact Email</ThemedText>
                                <TextInput ref={contactEmailInputRef} value={contactEmail} onChangeText={setContactEmail} style={styles.input} placeholder="booking@yourvenue.com" keyboardType="email-address" autoCapitalize="none" onFocus={() => scrollToInput(contactEmailInputRef)} />
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
                                            const display = `${props.name || ''}, ${props.state || ''}, ${props.country || ''}`;
                                            return (
                                                <TouchableOpacity key={index} style={styles.dropdownItem} onPress={() => {
                                                    setCity(props.name || ''); setState(props.state || ''); setCountry(props.country || '');
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
