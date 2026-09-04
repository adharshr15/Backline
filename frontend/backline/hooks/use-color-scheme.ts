import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * React Native 0.86 widened ColorSchemeName to include 'unspecified' alongside
 * null/undefined, which broke every `Colors[useColorScheme() ?? 'light']` lookup.
 * Normalising here keeps the return type to the two values the theme actually has,
 * so callers can index Colors directly.
 */
export function useColorScheme(): 'light' | 'dark' {
  return useRNColorScheme() === 'dark' ? 'dark' : 'light';
}
