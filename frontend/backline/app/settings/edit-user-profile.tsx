import { useAuth } from '@/context/AuthContext';
import { updateMe } from '@/services/user.service';
import { checkUsernameUnique } from '@/services/auth.service';
import { useState, useRef } from 'react';
import { Alert, Text, Image, TextInput, TouchableOpacity, ScrollView, View, Modal, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { BASE_URL } from '@/services/api';
import { AVATAR_SIZE } from '../(tabs)/profile';
import { KeyboardAvoidingView, Platform } from 'react-native';

const HEADER_HEIGHT = 140;

export function EditUserProfileModal({ onClose }: { onClose: () => void }) {
    const { activeProfile, setActiveProfile, refreshUser } = useAuth();
    const scrollViewRef = useRef<ScrollView>(null);
    const nameInputRef = useRef<TextInput>(null);
    const usernameInputRef = useRef<TextInput>(null);
    const bioInputRef = useRef<TextInput>(null);
    const locationInputRef = useRef<TextInput>(null);

    if (!activeProfile || activeProfile.accountType !== 'USER') return null;
    const user = activeProfile;

    const [name, setName] = useState(user.name || '');
    const [username, setUsername] = useState(user.username || '');
    const [bio, setBio] = useState(user.bio || '');
    const [city, setCity] = useState(user.city || '');
    const [state, setState] = useState(user.state || '');
    const [country, setCountry] = useState(user.country || '');
    const userLocation = `${city}, ${state}, ${country}`;
    const [locationQuery, setLocationQuery] = useState(userLocation);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [profileImage, setProfileImage] = useState<string | null>(user.profileImageUrl || null);
    const [headerImage, setHeaderImage] = useState<string | null>(user.headerImageUrl || null);

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
            name === user.name &&
            username === user.username &&
            bio === (user.bio || '') &&
            city === (user.city || '') &&
            state === (user.state || '') &&
            country === (user.country || '') &&
            profileImage === (user.profileImageUrl || null) &&
            headerImage === (user.headerImageUrl || null)
        ) {
            router.back();
            return;
        }

        if (username !== user.username && !(await checkUsernameUnique(username))) {
            return Alert.alert('Error', 'That username has already been taken');
        }

        try {
            const updatedUser = await updateMe({ name, username, bio, city, state, country, profileImage, headerImage });
            setActiveProfile(updatedUser);
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
                    <ThemedText style={styles.title}>Edit Profile</ThemedText>
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
                                <ThemedText style={styles.label}>Name</ThemedText>
                                <TextInput ref={nameInputRef} value={name} onChangeText={setName} style={styles.input} placeholder="Your name" onFocus={() => scrollToInput(nameInputRef)} />
                            </View>

                            <View style={styles.inputGroup}>
                                <ThemedText style={styles.label}>Username</ThemedText>
                                <TextInput ref={usernameInputRef} value={username} onChangeText={setUsername} style={styles.input} placeholder="Your username" onFocus={() => scrollToInput(usernameInputRef)} />
                            </View>

                            <View style={styles.inputGroup}>
                                <ThemedText style={styles.label}>Bio</ThemedText>
                                <TextInput ref={bioInputRef} value={bio} onChangeText={setBio} style={[styles.input, styles.textArea]} placeholder="Tell people about yourself" multiline maxLength={150} onFocus={() => scrollToInput(bioInputRef)} />
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

export const styles = StyleSheet.create({
    header: {
        height: 56,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#333',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    cancel: { fontSize: 16, color: '#aaa' },
    save: { fontSize: 16, color: '#007AFF', fontWeight: '600' },
    title: { fontSize: 17, fontWeight: '600' },
    pfpContainer: {
        position: 'absolute',
        top: HEADER_HEIGHT - (AVATAR_SIZE / 2),
        alignSelf: 'center',
    },
    pfpWrapper: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: 18,
        borderWidth: 3,
        overflow: 'hidden',
        backgroundColor: '#eee',
    },
    headerPlaceholder: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        justifyContent: 'center', alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.1)',
    },
    pfpPlaceholder: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        justifyContent: 'center', alignItems: 'center',
    },
    section: { marginTop: 32, paddingHorizontal: 16, gap: 16 },
    inputGroup: { gap: 6 },
    label: { fontSize: 13, color: '#aaa' },
    input: {
        backgroundColor: '#111', borderRadius: 10,
        paddingHorizontal: 12, paddingVertical: 12,
        fontSize: 15, color: '#fff',
    },
    textArea: { height: 80, textAlignVertical: 'top' },
    imagePickerText: { color: '#666' },
    dropdown: { flex: 1, backgroundColor: '#222', borderRadius: 8, marginTop: -10, marginBottom: 16 },
    dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#444' },
});
