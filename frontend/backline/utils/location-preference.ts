import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * A remembered city choice, per screen. Marketplace and Explore each keep their
 * own so browsing gear in Austin does not move your Explore feed there.
 */
export type LocationScope = 'marketplace' | 'explore';

const HISTORY_MAX = 8;

const key = (scope: LocationScope) => `${scope}.location`;
const historyKey = (scope: LocationScope) => `${scope}.location.history`;

export interface SavedLocation {
    city: string;
    state: string | null;
}

const sameLoc = (a: SavedLocation, b: SavedLocation) =>
    a.city.toLowerCase() === b.city.toLowerCase() &&
    (a.state ?? '').toLowerCase() === (b.state ?? '').toLowerCase();

export const getSavedLocation = async (scope: LocationScope): Promise<SavedLocation | null> => {
    try {
        const raw = await AsyncStorage.getItem(key(scope));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.city === 'string' && parsed.city.length > 0) {
            return { city: parsed.city, state: parsed.state ?? null };
        }
    } catch {}
    return null;
};

export const saveLocation = async (scope: LocationScope, loc: SavedLocation): Promise<void> => {
    try {
        await AsyncStorage.setItem(key(scope), JSON.stringify({ city: loc.city, state: loc.state ?? null }));
    } catch {}
};

export const getHistory = async (scope: LocationScope): Promise<SavedLocation[]> => {
    try {
        const raw = await AsyncStorage.getItem(historyKey(scope));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed
                .filter(p => p && typeof p.city === 'string' && p.city.length > 0)
                .map(p => ({ city: p.city, state: p.state ?? null }));
        }
    } catch {}
    return [];
};

// Prepend a location (deduped, most-recent-first, capped) and return the new list.
export const addToHistory = async (scope: LocationScope, loc: SavedLocation): Promise<SavedLocation[]> => {
    const entry: SavedLocation = { city: loc.city, state: loc.state ?? null };
    const existing = await getHistory(scope);
    const next = [entry, ...existing.filter(l => !sameLoc(l, entry))].slice(0, HISTORY_MAX);
    try {
        await AsyncStorage.setItem(historyKey(scope), JSON.stringify(next));
    } catch {}
    return next;
};

export const clearHistory = async (scope: LocationScope): Promise<void> => {
    try {
        await AsyncStorage.removeItem(historyKey(scope));
    } catch {}
};
