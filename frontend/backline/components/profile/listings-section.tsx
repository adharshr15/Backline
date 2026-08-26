import { View, TouchableOpacity, StyleSheet } from 'react-native';
import ViewSwitcher from '../ui/view-switcher';
import { ThemedText } from '../themed-text';
import { Listing } from '@/services/listing.service';
import { ListingCard, ListingRow, useGridTileWidth } from '../listing-card';

type ViewMode = 'poster' | 'list';

interface ProfileListingsSectionProps {
    listings: Listing[];
    view: ViewMode;
    setView: (view: ViewMode) => void;
    isOwner: boolean;
    onCreateListing: () => void;
    onListingPress: (listing: Listing) => void;
}

export default function ProfileListingsSection({
    listings,
    view,
    setView,
    isOwner,
    onCreateListing,
    onListingPress,
}: ProfileListingsSectionProps) {
    const tileWidth = useGridTileWidth(2, 32, 12);

    return (
        <View style={styles.container}>
            <View style={[styles.switcherRow, !isOwner && { justifyContent: 'flex-end' }]}>
                {isOwner && (
                    <TouchableOpacity style={styles.newBtn} onPress={onCreateListing}>
                        <ThemedText style={styles.newText}>+ New Listing</ThemedText>
                    </TouchableOpacity>
                )}
                <ViewSwitcher view={view} setView={setView} />
            </View>

            {listings.length === 0 ? (
                <View style={styles.empty}>
                    <ThemedText style={styles.emptyText}>No listings yet.</ThemedText>
                </View>
            ) : view === 'poster' ? (
                <View style={styles.grid}>
                    {listings.map(listing => (
                        <ListingCard key={listing.id} listing={listing} width={tileWidth} onPress={onListingPress} />
                    ))}
                </View>
            ) : (
                <View style={styles.list}>
                    {listings.map(listing => (
                        <ListingRow key={listing.id} listing={listing} onPress={onListingPress} />
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginHorizontal: -32,
    },
    switcherRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 32,
        marginBottom: 8,
        gap: 10,
    },
    newBtn: {
        height: 32,
        paddingHorizontal: 12,
        backgroundColor: '#2a2a2a',
        borderRadius: 20,
        justifyContent: 'center',
        marginBottom: 4,
        marginTop: -8,
    },
    newText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 32,
        gap: 12,
    },
    list: {
        paddingHorizontal: 32,
        gap: 10,
    },
    empty: {
        alignItems: 'center',
        paddingVertical: 16,
    },
    emptyText: {
        opacity: 0.4,
        fontSize: 13,
    },
});
