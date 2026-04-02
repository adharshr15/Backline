import { View, Text, Alert, TextInput, Image, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Touchable } from 'react-native';
import { useRouter } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { useState } from 'react'
import * as WebBrowser from 'expo-web-browser'
import * as ImagePicker from 'expo-image-picker';
import { registerUser, checkEmailUnique, checkUsernameUnique } from '@/services/auth.service'
import ParallaxScrollView from '@/components/parallax-scroll-view-original';
import { setAuthToken } from '@/services/api';

type Step = 1 | 2;

export default function RegisterScreen() {
  const router = useRouter();
  const { saveAuth } = useAuth();

  // Step 1
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Step 2
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>(1);

  const handleStep1 = async () => {
    // Validation
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields')
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      Alert.alert('Error', 'Please enter a valid email');
      return;
    }
    if (/[^a-zA-Z0-9._-]/.test(username)) {
      Alert.alert('Error', 'Username can only contain letters, numbers, periods, underscores, and hyphens');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    try {
      setLoading(true);

      // Make sure email hasn't been used before
      const isUnique = await checkEmailUnique(email);

      if (!isUnique) {
        Alert.alert('Error', 'An account with this email already exists');
        return;
      }

      setStep(2);
    }
    catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || error.message || JSON.stringify(error));
    }
    finally {
      setLoading(false);
    }
  }

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!name || !username) {
      Alert.alert('Error', 'Please fill in all fields')
      return;
    }
    if (username.includes(' ')) {
      Alert.alert('Error', 'Username cannot contain spaces')
      return;
    }

    try {
      setLoading(true);


      // Make sure username hasn't been taken yet
      const isUnique = await checkUsernameUnique(username);

      if (!isUnique) {
        Alert.alert('Error', 'An account with this username already exists')
        return;
      }

      const formData = new FormData();
      formData.append('name', name);
      formData.append('username', username);
      formData.append('email', email);
      formData.append('password', password);
      formData.append('city', city);
      formData.append('state', state);
      formData.append('country', country);

      if (profileImage) {
        const fileExtension = profileImage.split('.').pop();
        formData.append('profileImage', {
          uri: profileImage,
          name: `profile.${fileExtension || 'jpg'}`,
          type: `image/${fileExtension || 'jpeg'}`,
        } as any);
      }


      // Register user and get auth info back
      const { user, token } = await registerUser(formData);

      // Save authentication information
      await saveAuth(user, token);

      // Attach token to future requests
      setAuthToken(token);

      // Navigate to (tabs) screen
      router.replace('/(tabs)')
    }
    catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Something went wrong');
    }
    finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps='handled'>
        <View style={styles.container}>
          <View style={styles.progressRow}>
            {[1, 2].map((s) => (
              <View key={s} style={[styles.progressDot, step >= s && styles.progressDotActive]}></View>
            ))}
          </View>

          {/* Step 1 */}
          {step === 1 && (
            <View>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Enter your email and password</Text>

              <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize='none'
                keyboardType='email-address'>
              </TextInput>

              <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                autoCapitalize='none'
                secureTextEntry>
              </TextInput>

              <TouchableOpacity style={styles.button} onPress={handleStep1} disabled={loading}>
                {loading ?
                  <ActivityIndicator color='#fff'></ActivityIndicator>
                  : <Text style={styles.buttonText}>Next</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <View>
              <Text style={styles.title}>Your Profile</Text>
              <Text style={styles.subtitle}>What should we call you?</Text>

              <TouchableOpacity style={styles.imagePicker} onPress={() => pickImage()}>
                {profileImage
                  ? <Image source={{ uri: profileImage }} style={styles.profilePreview} />
                  : <Text style={styles.imagePickerText}>+ Profile Photo</Text>
                }
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                placeholder="Full Name"
                value={name}
                onChangeText={setName}
              />
              <TextInput
                style={styles.input}
                placeholder="Username"
                value={username}
                onChangeText={(t) => setUsername(t.toLowerCase())} // force lowercase
                autoCapitalize="none"
              />
              <View style={styles.row}>
                <TextInput
                  style={styles.inputThree}
                  placeholder="City"
                  value={city}
                  onChangeText={setCity} // force lowercase
                  autoCapitalize="none"
                />

                <TextInput
                  style={styles.inputThree}
                  placeholder="State"
                  value={state}
                  onChangeText={setState} // force lowercase
                  autoCapitalize="none"
                />

                <TextInput
                  style={styles.inputThree}
                  placeholder="Country"
                  value={country}
                  onChangeText={setCountry} // force lowercase
                  autoCapitalize="none"
                />
              </View>

              {/* Submit */}
              <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account</Text>}
              </TouchableOpacity>

              {/* Back */}
              <TouchableOpacity style={styles.button} onPress={() => setStep(1)}>
                <Text style={styles.backLink}>← Back</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Login link for step 1 */}
          {step === 1 && (
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.link}>Already have an account? Log in</Text>
            </TouchableOpacity>
          )}
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
  row: {
    flexDirection: 'row',
    gap: 8
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
  inputThree: {
    flex: 1,
    color: 'white',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
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