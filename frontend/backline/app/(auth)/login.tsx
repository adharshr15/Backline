import { View, Text, Alert, TextInput, Image, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Touchable } from 'react-native';
import { useRouter } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { useState } from 'react'
import { loginUser } from '@/services/auth.service'

export default function LoginScreen() {
    const router = useRouter();
    const { saveAuth } = useAuth();

    // Step 1
    const [emailOrUsername, setEmailOrUsername] = useState('');
    const [password, setPassword] = useState('');

    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!emailOrUsername || !password) {
            Alert.alert('Error', 'Must login with both username/email and password')
            return;
        }

        try {
            setLoading(true);

            // Set input to username or email
            const credentials = emailOrUsername.includes('@') ? { email: emailOrUsername, password } : { username: emailOrUsername, password }

            // Send login request and get auth info back
            const { user, token } = await loginUser(credentials)

            // Save auth info
            await saveAuth(user, token)

            console.log(user)

            // Navigate to (tabs) screen
            router.replace('/(tabs)')

        }
        catch (error: any) {
            Alert.alert('Login Failed', error.response?.data?.error || error.message || 'Something went wrong')
        }
        finally {
            setLoading(false);
        }
    }

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps='handled'>
                <View style={styles.container}>
                    <Text style={styles.title}>Login</Text>
                    <Text style={styles.subtitle}>Enter your username/email and password</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Username/Email"
                        value={emailOrUsername}
                        onChangeText={setEmailOrUsername}
                        autoCapitalize='none'
                    >
                    </TextInput>

                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        value={password}
                        onChangeText={setPassword}
                        autoCapitalize='none'
                        secureTextEntry
                    ></TextInput>

                    <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
                        {loading ? <ActivityIndicator color='#fff'/> : <Text style={styles.buttonText}>Login</Text>}
                    </TouchableOpacity>

                    {/* Register link */}
                    <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                        <Text style={styles.link}>Don't have an account? Sign Up</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 24
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
    link: {
        textAlign: 'center',
        color: '#666',
        marginTop: 8
    },
    backLink: {
        textAlign: 'center',
        color: '#666',
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
    headerPicker: {
        height: 120,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16
    },
    headerPreview: {
        width: '100%',
        height: 120,
        borderRadius: 8
    },
    imagePickerText: {
        color: '#666'
    },
})