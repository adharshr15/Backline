import { useCallback } from 'react';
import { useSegments } from 'expo-router';

/**
 * Detail screens (show, listing, profile views, scene, messages) are duplicated
 * inside every bottom-tab stack so the tab bar (dock) always stays visible and
 * navigation never leaks into another tab. This hook returns a builder that
 * prefixes a screen path with the currently-active tab segment.
 *
 * e.g. inside the Marketplace tab: tabHref('listing') -> '/marketplace/listing'
 *      inside the Home tab:        tabHref('show')    -> '/home/show'
 */
export function useTabHref() {
  const segments = useSegments() as string[];
  const i = segments.indexOf('(tabs)');
  const tab = i >= 0 && segments[i + 1] ? segments[i + 1] : 'home';
  return useCallback((screen: string) => `/${tab}/${screen}` as any, [tab]);
}
