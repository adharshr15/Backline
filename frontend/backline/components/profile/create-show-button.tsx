import { TouchableOpacity, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

type Props = {
  onPress: () => void;
  height: number;
};

export const CREATE_BUTTON_WIDTH = 80;

export function CreateShowButton({ onPress, height }: Props) {
  const borderColor = useThemeColor({}, 'text');

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.button, { borderColor, height, width: CREATE_BUTTON_WIDTH }]}
    >
      <ThemedText style={styles.plus}>+</ThemedText>
      <ThemedText style={styles.label}>New{'\n'}Show</ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
    paddingHorizontal: 12,
  },
  plus: {
    fontSize: 24,
    fontWeight: '300',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});