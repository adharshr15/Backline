import { useAuth } from '@/context/AuthContext';
import { updateMe } from '@/services/user.service';
import { useState } from 'react';
import { Alert, Button, Text, Image, TextInput, TouchableOpacity, ScrollView, View, Modal, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { router } from 'expo-router';
import ParallaxScrollView from '@/components/parallax-scroll-view-original';
import * as ImagePicker from 'expo-image-picker';
import { BASE_URL } from '@/services/api';
import { AVATAR_SIZE } from '../(tabs)/profile';

const HEADER_HEIGHT = 140

export default function EditProfileModal({ onClose }: { onClose: () => void }) {
    const { activeProfile, setActiveProfile } = useAuth();
    const [name, setName] = useState(activeProfile?.name || '');
    const [bio, setBio] = useState(activeProfile?.bio || '');
    const [city, setCity] = useState(activeProfile?.city || '');
    const [state, setState] = useState(activeProfile?.state || '');
    const [country, setCountry] = useState(activeProfile?.country || '');
    const [profileImage, setProfileImage] = useState<string | null>(activeProfile?.profileImageUrl || null);
    const [headerImage, setHeaderImage] = useState<string | null>(activeProfile?.headerImageUrl || null);

    const handleSave = async () => {
        try {
            const updatedUser = await updateMe({
                name,
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

        if (imageType == 'profile') console.log(profileImage)
        if (imageType == 'header') console.log(headerImage)
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

                {/* Content */}
                <ScrollView>

                    {/* Header Image */}
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
                                value={name}
                                onChangeText={setName}
                                style={styles.input}
                                placeholder="Your name"
                            />
                        </View>

                        {/* Bio */}
                        <View style={styles.inputGroup}>
                            <ThemedText style={styles.label}>Bio</ThemedText>
                            <TextInput
                                value={bio}
                                onChangeText={setBio}
                                style={[styles.input, styles.textArea]}
                                placeholder="Tell people about yourself"
                                multiline
                                maxLength={150}
                            />
                        </View>

                        {/* Location */}
                        <View style={styles.inputGroup}>
                            <ThemedText style={styles.label}>Location</ThemedText>
                            <View style={styles.row}>
                                <TextInput
                                    value={city}
                                    onChangeText={setCity}
                                    style={[styles.input, styles.flex]}
                                    placeholder="City"
                                />
                                <TextInput
                                    value={state}
                                    onChangeText={setState}
                                    style={[styles.input, styles.flex]}
                                    placeholder="State"
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <TextInput
                                value={country}
                                onChangeText={setCountry}
                                style={styles.input}
                                placeholder="Country"
                            />
                        </View>

                    </View>

                </ScrollView>
            </ThemedView>
        </Modal>
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