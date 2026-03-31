import { useAuth } from '@/context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
    const { clearAuth } = useAuth();
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.section}>
                <TouchableOpacity style={styles.row}>
                    <ThemedText style={styles.text}>Edit Profile</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity style={styles.row}>
                    <ThemedText style={styles.text}>Account Settings</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity style={styles.row}>
                    <ThemedText style={styles.text}>Privacy</ThemedText>
                </TouchableOpacity>
            </View>

            {/* Logout */}
            <View style={styles.logoutContainer}>
                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={async () => {
                        await clearAuth();
                        router.replace('/(auth)/login');
                    }}
                >
                    <ThemedText style={styles.logoutText}>Log Out</ThemedText>  
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'space-between',
    },
    section: {
        padding: 16,
    },
    row: {
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#333',
    },
    text: {
        fontSize: 16,
    },
    logoutContainer: {
        padding: 16,
    },
    logoutButton: {
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#ff3b30',
        alignItems: 'center',
    },
    logoutText: {
        color: 'white',
        fontWeight: '600',
    },
});