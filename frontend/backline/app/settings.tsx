import { useAuth } from '@/context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, TouchableOpacity, StyleSheet, TextInput, ScrollView, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import EditProfileModal from './settings/edit-profile'
import { ThemedView } from '@/components/themed-view';
import { leaveBand, leaveVenue } from '@/services/membership.service';

export default function SettingsScreen() {
  const { clearAuth, activeProfile, user, setActiveProfile, refreshUser } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [editProfileVisible, setEditProfileVisible] = useState(false);

  const handleLeaveBand = async () => {
    if (!activeProfile || !user) return;
    Alert.alert('Leave Band', `Are you sure you want to leave ${(activeProfile as any).name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive', onPress: async () => {
          try {
            await leaveBand(activeProfile.id, user.id);
            const freshUser = await refreshUser();
            setActiveProfile(freshUser);
            router.replace('/(tabs)/profile');
          } catch (e) { Alert.alert('Failed to leave band'); }
        }
      },
    ]);
  };

  const handleLeaveVenue = async () => {
    if (!activeProfile || !user) return;
    Alert.alert('Leave Venue', `Are you sure you want to leave ${(activeProfile as any).name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive', onPress: async () => {
          try {
            await leaveVenue(activeProfile.id, user.id);
            const freshUser = await refreshUser();
            setActiveProfile(freshUser);
            router.replace('/(tabs)/profile');
          } catch (e) { Alert.alert('Failed to leave venue'); }
        }
      },
    ]);
  };

  // All settings items in one column
  const settingsItems = [
    { label: 'Edit Profile', action: () => setEditProfileVisible(true) },
    { label: 'Account Settings', action: () => { } },
    { label: 'Privacy', action: () => { } },
    { label: 'Notifications', action: () => { } },
    { label: 'Privacy Policy', action: () => { } },
    { label: 'Terms of Use', action: () => { } },
    ...(activeProfile?.accountType === 'BAND' ? [{ label: 'Leave Band', action: handleLeaveBand, isDestructive: true }] : []),
    ...(activeProfile?.accountType === 'VENUE' ? [{ label: 'Leave Venue', action: handleLeaveVenue, isDestructive: true }] : []),
    { label: 'Log Out', action: async () => { await clearAuth(); router.replace('/(auth)/login'); }, isDestructive: true },
  ];

  // Filter items based on search
  const filteredItems = settingsItems.filter(item =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ThemedView style={styles.container}>
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20 },
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