import { View, StyleSheet, TouchableOpacity } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { type ComponentProps } from 'react';

type IconSymbolName = ComponentProps<typeof IconSymbol>['name'];

type Props = {
  icon: IconSymbolName;
  label: string;
  onPress: () => void;
};

export function ActionButton({ icon, label, onPress }: Props) {
  const borderColor = useThemeColor({}, 'text');

  return (
    <TouchableOpacity style={styles.actionButton} onPress={onPress}>
      <View style={[styles.actionCircle, { borderColor }]}>
        <IconSymbol name={icon} size={18} color={borderColor} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    gap: 4,
  },
  actionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 10,
    opacity: 0.6,
  },
});