import { useAuth } from '@/context/AuthContext';
import { updateMe } from '@/services/user.service';
import { checkUsernameUnique } from '@/services/auth.service';
import { useState, useRef } from 'react';
import { Alert, Button, Text, Image, TextInput, TouchableOpacity, ScrollView, View, Modal, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { router } from 'expo-router';
import ParallaxScrollView from '@/components/parallax-scroll-view-original';
import * as ImagePicker from 'expo-image-picker';
import { BASE_URL } from '@/services/api';
import { AVATAR_SIZE } from '../(tabs)/profile';
import { KeyboardAvoidingView } from 'react-native';
import { Platform } from 'react-native';

const HEADER_HEIGHT = 140

export default function EditProfileModal({ onClose }: { onClose: () => void }) {
    const { activeProfile } = useAuth();

    if (activeProfile?.accountType === 'BAND') return;
    if (activeProfile?.accountType === 'VENUE') return;
    return <EditUserProfileModal onClose={onClose} />;
}

export function EditUserProfileModal({ onClose }: { onClose: () => void }) {
    const { activeProfile, setActiveProfile } = useAuth();
    const scrollViewRef = useRef<ScrollView>(null);
    const nameInputRef = useRef<TextInput>(null);
    const usernameInputRef = useRef<TextInput>(null);
    const bioInputRef = useRef<TextInput>(null);
    const locationInputRef = useRef<TextInput>(null);
    
    if (!activeProfile || activeProfile.accountType !== 'USER') return null;

    const user = activeProfile;

    const [name, setName] = useState(user?.name || '');
    const [username, setUsername] = useState(user?.username || '')
    const [bio, setBio] = useState(user?.bio || '');
    const [city, setCity] = useState(user?.city || '');
    const [state, setState] = useState(user?.state || '');
    const [country, setCountry] = useState(user?.country || '');
    const userLocation = `${city}, ${state}, ${country}`;
    const [locationQuery, setLocationQuery] = useState(userLocation);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [profileImage, setProfileImage] = useState<string | null>(user?.profileImageUrl || null);
    const [headerImage, setHeaderImage] = useState<string | null>(user?.headerImageUrl || null);

    const scrollToInput = (inputRef: React.RefObject<TextInput | null>) => {
        setTimeout(() => {
            inputRef.current?.measure((fx, fy, width, height, px, py) => {
                scrollViewRef.current?.scrollResponderScrollNativeHandleToKeyboard(
                    inputRef.current as any,
                    150,
                    true
                );
            });
        }, 200);
    };

    const handleSave = async () => {
        // Check if all fields are the same
        if (name == user.name &&
            username == user.username &&
            bio == user.bio &&
            city == user.city &&
            state == user.state &&
            country == user.country &&
            profileImage == user.profileImageUrl &&
            headerImage == user.headerImageUrl
        ) return user;

        // Check if new username is available
        if (!(await checkUsernameUnique(username))) {
            return Alert.alert("Error", "That username has already been taken")
        }

        try {
            const updatedUser = await updateMe({
                name,
                username,
                bio,
                city,
                state,
                country,
                profileImage,
                headerImage,
            });
            setActiveProfile(updatedUser);
            router.back();
        } catch (err: any) {
            Alert.alert('Error', err.message);
        }
    };

    const fetchLocations = async (query: string) => {
        if (!query) {
            setSuggestions([])
            setShowSuggestions(false);
            return;
        }

        try {
            const res = await fetch(
                `https://photon.komoot.io/api/?q=${query}&limit=5`
            )

            const data = await res.json();

            setSuggestions(data.features || []);
            setShowSuggestions(true);
        }
        catch (error: any) {
            console.log("Photon Error: ", error);
            setSuggestions([]);
        }
    }

    const pickImage = async (imageType: 'profile' | 'header') => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            if (imageType == 'profile') setProfileImage(result.assets[0].uri);
            if (imageType == 'header') setHeaderImage(result.assets[0].uri)
        }

    };

    const getImageUri = (img: string) => {
        if (img.startsWith('file://')) return img; // local
        return `${BASE_URL}${img}`; // server
    };

    return (
        <Modal animationType="slide" transparent={false} presentationStyle="pageSheet">

            <ThemedView style={{ flex: 1 }}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose}>
                        <ThemedText style={styles.cancel}>Cancel</ThemedText>
                    </TouchableOpacity>

                    <ThemedText style={styles.title}>Edit Profile</ThemedText>

                    <TouchableOpacity onPress={handleSave}>
                        <ThemedText style={styles.save}>Save</ThemedText>
                    </TouchableOpacity>
                </View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={56}
                    style={{ flex: 1 }}
                >
                    {/* Content */}
                    <ScrollView
                        ref={scrollViewRef}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={{ paddingBottom: 200 }}
                        scrollEnabled={true}
                    >

                            {/* Header Image*/}
                            <TouchableOpacity onPress={() => pickImage('header')}>
                                <Image
                                    source={headerImage ? { uri: getImageUri(headerImage) } : require('@/assets/images/default/headerImage.png')}
                                    style={{ width: '100%', height: HEADER_HEIGHT, overflow: 'hidden' }}
                                />
                                {!headerImage && (
                                    <View style={styles.headerPlaceholder}>
                                        <Text style={styles.imagePickerText}>+ Header Image</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            {/* Profile Picture */}
                            <View style={styles.pfpContainer}>
                                <TouchableOpacity onPress={() => pickImage('profile')}>
                                    <View style={[styles.pfpWrapper, { borderColor: '#ccc' }]}>
                                        <Image
                                            source={profileImage ? { uri: getImageUri(profileImage) } : require('@/assets/images/default/profileImage.png')}
                                            style={{ width: '100%', height: '100%' }}
                                        />
                                        {!profileImage && (
                                            <View style={styles.pfpPlaceholder}>
                                                <Text style={styles.imagePickerText}>+ Profile Photo</Text>
                                            </View>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            </View>

                            {/* Input Fields */}
                            <View style={styles.section}>

                                {/* Name */}
                                <View style={styles.inputGroup}>
                                    <ThemedText style={styles.label}>Name</ThemedText>
                                    <TextInput
                                        ref={nameInputRef}
                                        value={name}
                                        onChangeText={setName}
                                        style={styles.input}
                                        placeholder="Your name"
                                        onFocus={() => scrollToInput(nameInputRef)}
                                    />
                                </View>

                                <View style={styles.inputGroup}>
                                    <ThemedText style={styles.label}>Username</ThemedText>
                                    <TextInput
                                        ref={usernameInputRef}
                                        value={username}
                                        onChangeText={setUsername}
                                        style={styles.input}
                                        placeholder="Your username"
                                        onFocus={() => scrollToInput(usernameInputRef)}
                                    />
                                </View>

                                <View style={styles.inputGroup}>
                                    <ThemedText style={styles.label}>Bio</ThemedText>
                                    <TextInput
                                        ref={bioInputRef}
                                        value={bio}
                                        onChangeText={setBio}
                                        style={[styles.input, styles.textArea]}
                                        placeholder="Tell people about yourself"
                                        multiline
                                        maxLength={150}
                                        onFocus={() => scrollToInput(bioInputRef)}
                                    />
                                </View>

                                <View style={styles.inputGroup}>
                                    <ThemedText style={styles.label}>Location</ThemedText>
                                    <TextInput
                                        ref={locationInputRef}
                                        style={styles.input}
                                        placeholder="Location"
                                        value={locationQuery}
                                        onChangeText={(text) => {
                                            setLocationQuery(text);
                                            fetchLocations(text);
                                        }}
                                        onFocus={() => scrollToInput(locationInputRef)}
                                    />

                                    {showSuggestions && suggestions?.length > 0 && (
                                        <View style={styles.dropdown}>
                                            {suggestions.map((item, index) => {
                                                const props = item.properties;

                                                const display =
                                                    `${props.name || ''}, ${props.state || ''}, ${props.country || ''}`;

                                                return (
                                                    <TouchableOpacity
                                                        key={index}
                                                        style={styles.dropdownItem}
                                                        onPress={() => {
                                                            setCity(props.name || '');
                                                            setState(props.state || '');
                                                            setCountry(props.country || '');

                                                            setLocationQuery(display);
                                                            setShowSuggestions(false);
                                                        }}
                                                    >
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

        </Modal >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000', // or theme
    },

    header: {
        height: 56,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#333',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },

    cancel: {
        fontSize: 16,
        color: '#aaa',
    },

    save: {
        fontSize: 16,
        color: '#007AFF',
        fontWeight: '600',
    },

    title: {
        fontSize: 17,
        fontWeight: '600',
    },

    content: {
        paddingBottom: 40,
    },
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
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.1)',
    },
    pfpPlaceholder: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerImageContainer: {
        height: 100,
        backgroundColor: '#222',
        justifyContent: 'center',
        alignItems: 'center',
    },

    imageOverlayText: {
        color: '#fff',
        fontWeight: '600',
    },

    profileImageWrapper: {
        alignItems: 'center',
        marginTop: -40,
        marginBottom: 16,
    },

    profileImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#444',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#000',
    },

    section: {
        marginTop: 32,
        paddingHorizontal: 16,
        gap: 16,
    },

    inputGroup: {
        gap: 6,
    },

    label: {
        fontSize: 13,
        color: '#aaa',
    },

    input: {
        backgroundColor: '#111',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 15,
        color: '#fff',
    },
    imagePicker: {
        height: 100,
        width: 100,
        borderRadius: 50,
        borderWidth: 1,
        borderColor: '#ccc',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: 16
    },
    imagePickerText: {
        color: '#666'
    },
    dropdown: {
        flex: 1,
        backgroundColor: '#222',
        borderRadius: 8,
        marginTop: -10,
        marginBottom: 16,
    },
    dropdownItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#444',
    },
    profilePreview: {
        width: 100,
        height: 100,
        borderRadius: 50
    },
    headerPreview: {
        width: '100%',
        height: 150,
    },
    textArea: {
        height: 80,
        textAlignVertical: 'top',
    },

    row: {
        flexDirection: 'row',
        gap: 10,
    },

    flex: {
        flex: 1,
    },
});