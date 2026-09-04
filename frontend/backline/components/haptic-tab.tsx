import { PlatformPressable } from 'expo-router/build/react-navigation/elements';
import type { BottomTabBarButtonProps } from 'expo-router/build/react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';

// SDK 56+ : expo-router vendors react-navigation, and mixing in the standalone
// @react-navigation/* packages fails the bundler's compatibility check. These deep
// paths are expo-router's own copies — the same components it passes to tabBarButton.

export function HapticTab(props: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}
