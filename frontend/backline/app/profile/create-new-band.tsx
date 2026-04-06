import { View, Text, Alert, TextInput, Image, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { createBand } from '@/services/band.service'; // your API service
import { setAuthToken } from '@/services/api';


export default function CreateBandScreen() {
    const router = useRouter();

    const [bandName, setBandName] = useState('');
    const [genre, setGenre] = useState('');

    const [bandImage, setBandImage] = useState<string | null>(null);
    const [locationQuery, setLocationQuery] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [country, setCountry] = useState('');
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const [loading, setLoading] = useState(false);

    const fetchLocations = async (query: string) => {
        if (!query) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        try {
            const res = await fetch(`https://photon.komoot.io/api/?q=${query}&limit=5`);
            const data = await res.json();
            setSuggestions(data.features || []);
            setShowSuggestions(true);
        } catch (error: any) {
            console.log("Photon Error: ", error);
            setSuggestions([]);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            setBandImage(result.assets[0].uri);
        }
    };


    const handleSubmit = async () => {
        if (!bandName || !genre || !city || !state || !country) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        try {
            setLoading(true);

            const formData = new FormData();
            formData.append('name', bandName);
            formData.append('genre', genre);
            formData.append('city', city);
            formData.append('state', state);
            formData.append('country', country);

            if (bandImage) {
                const fileExtension = bandImage.split('.').pop();
                formData.append('profileImage', {
                    uri: bandImage,
                    name: `band.${fileExtension || 'jpg'}`,
                    type: `image/jpeg`,
                } as any);
            }

            // Call your API to create the band
            const newBand = await createBand(formData);
            Alert.alert('Success', `Band "${newBand.name}" created successfully!`);
            router.replace('/(tabs)/profile'); // navigate back to profile
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.error || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps='handled'>
                <View style={styles.container}>
                    <View>
                        <Text style={styles.title}>Create a Band</Text>
                        <Text style={styles.subtitle}>Enter basic information</Text>

                        <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                            {bandImage
                                ? <Image source={{ uri: bandImage }} style={styles.profilePreview} />
                                : <Text style={styles.imagePickerText}>+ Band Photo</Text>
                            }
                        </TouchableOpacity>

                        <TextInput
                            style={styles.input}
                            placeholder="Band Name"
                            value={bandName}
                            onChangeText={setBandName}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Genre"
                            value={genre}
                            onChangeText={setGenre}
                        />

                        <TextInput
                            style={styles.input}
                            placeholder="Location"
                            value={locationQuery}
                            onChangeText={(text) => {
                                setLocationQuery(text);
                                fetchLocations(text);
                            }}
                        />

                        {showSuggestions && suggestions?.length > 0 && (
                            <View style={styles.dropdown}>
                                {suggestions.map((item, index) => {
                                    const props = item.properties;
                                    const display = `${props.name || ''}, ${props.state || ''}, ${props.country || ''}`;
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

                        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Band</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.button}>
                            <Text style={styles.backLink}>← Back</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
        paddingTop: 16,
    },
    title: {
        fontSize: 32,
        color: 'white',
        fontWeight: 'bold',
        marginBottom: 32,
        textAlign: 'center'
    },
    subtitle: {
        fontSize: 12,
        color: 'grey',
        marginBottom: 32,
        textAlign: 'center'
    },
    input: {
        color: 'white',
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16
    },
    button: {
        backgroundColor: '#5c5c5c',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 12
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold'
    },
    progressRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 32
    },
    progressDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ccc'
    },
    progressDotActive: {
        backgroundColor: '#4fc435'
    },
    backLink: {
        textAlign: 'center',
        color: 'white',
        marginTop: 8
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
    profilePreview: {
        width: 100,
        height: 100,
        borderRadius: 50
    },
    imagePickerText: {
        color: '#666'
    },
    dropdown: {
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
});