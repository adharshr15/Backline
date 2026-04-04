import { useAuth } from '@/context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, TouchableOpacity, StyleSheet, TextInput, ScrollView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import EditProfileModal from './settings/edit-profile'

export default function SettingsScreen() {
  const { clearAuth } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [editProfileVisible, setEditProfileVisible] = useState(false);

  // All settings items in one column
  const settingsItems = [
    { label: 'Edit Profile', action: () => setEditProfileVisible(true) },
    { label: 'Account Settings', action: () => {} },
    { label: 'Privacy', action: () => {} },
    { label: 'Notifications', action: () => {} },
    { label: 'Privacy Policy', action: () => {} },
    { label: 'Terms of Use', action: () => {} },
    { label: 'Log Out', action: async () => { await clearAuth(); router.replace('/(auth)/login'); }, isDestructive: true }, // red text
  ];

  // Filter items based on search
  const filteredItems = settingsItems.filter(item =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
    <ScrollView style={styles.content}>
      {/* Search bar */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search settings..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {/* Settings rows */}
      {filteredItems.map((item, index) => (
        <TouchableOpacity
          key={index}
          style={styles.row}
          onPress={item.action}
        >
          <ThemedText
            style={[styles.text, item.isDestructive && styles.destructiveText]}
          >
            {item.label}
          </ThemedText>
        </TouchableOpacity>
      ))}
    </ScrollView>

    {/* Edit Profile Modal */}
    {editProfileVisible && (
      <EditProfileModal onClose={() => setEditProfileVisible(false)} />
    )}
  </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, marginTop: -24 },
  content: { flex: 1 },
  searchInput: {
    borderWidth: 1,
    color: 'white',
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    marginHorizontal: 16
  },
  row: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  text: { fontSize: 16 },
  destructiveText: { color: '#ff3b30', fontWeight: '600' },
});