import { Tabs } from 'expo-router';
import React, { useRef, useEffect } from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { activeProfile } = useAuth();

  // Track the active profile ID in a ref so listeners (which close over stale state) see the latest value
  const activeProfileIdRef = useRef(activeProfile?.id);
  // Track which profile was active the last time the explore tab was focused
  const exploreLastProfileIdRef = useRef(activeProfile?.id);

  useEffect(() => {
    activeProfileIdRef.current = activeProfile?.id;
  }, [activeProfile?.id]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
        listeners={({ navigation }) => ({
          focus: () => {
            const currentId = activeProfileIdRef.current;
            if (exploreLastProfileIdRef.current !== currentId) {
              exploreLastProfileIdRef.current = currentId;
              // Reset the explore tab's stack to just the index, popping all view screens
              const state = (navigation as any).getState();
              const routes = state.routes.map((route: any) =>
                route.name === 'explore'
                  ? { ...route, state: { index: 0, routes: [{ name: 'index' }] } }
                  : route
              );
              (navigation as any).reset({ ...state, routes });
            }
          },
        })}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          title: 'Market',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="cart.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
