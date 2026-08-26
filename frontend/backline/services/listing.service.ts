import api from './api'

export type ListingKind = 'RENT' | 'SALE';
export type ListingStatus = 'ACTIVE' | 'CLAIMED' | 'CLOSED';

// Shared gear categories for the listing picker + marketplace filters
export const GEAR_CATEGORIES = [
    'Guitar',
    'Bass',
    'Amp',
    'Drums',
    'Keys / Synth',
    'PA / Speakers',
    'Microphones',
    'Pedals / FX',
    'DJ Gear',
    'Recording',
    'Cables / Accessories',
    'Lighting',
    'Cases / Stands',
] as const;

export interface ListingOwnerSummary {
    id: string;
    name: string;
    username?: string;
    profileImageUrl?: string | null;
}

export interface ListingMedia {
    id: string;
    listingId: string;
    url: string;
    type: 'PHOTO' | 'VIDEO';
    position: number;
    createdAt: string;
}

export interface Listing {
    id: string;
    title: string;
    description: string;
    category?: string | null;
    kind: ListingKind;
    price?: number | null;
    openToTrades: boolean;
    status: ListingStatus;
    coverUrl?: string | null;
    city: string;
    state?: string | null;
    country?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    createdByUserId?: string | null;
    createdByBandId?: string | null;
    createdByVenueId?: string | null;
    createdByUser?: ListingOwnerSummary | null;
    createdByBand?: ListingOwnerSummary | null;
    createdByVenue?: ListingOwnerSummary | null;
    media?: ListingMedia[];
    createdAt: string;
}

export interface CreateListingData {
    title: string;
    description: string;
    category?: string;
    kind: ListingKind;
    price?: string;          // empty string / undefined => "DM for info"
    openToTrades?: boolean;
    city: string;
    state?: string;
    country?: string;
    latitude?: string;
    longitude?: string;
    creatorUserId?: string;
    creatorBandId?: string;
    creatorVenueId?: string;
    coverImage?: { uri: string; name: string; type: string };
}

export type UpdateListingData = Partial<Omit<CreateListingData, 'creatorUserId' | 'creatorBandId' | 'creatorVenueId'>> & { status?: ListingStatus };

// Short price/terms label for cards & detail (e.g. "$40/day", "$300", "DM for info")
export const formatListingPrice = (listing: Pick<Listing, 'price' | 'kind'>): string => {
    if (listing.price == null) return 'DM for info';
    const amount = `$${listing.price % 1 === 0 ? listing.price : listing.price.toFixed(2)}`;
    return listing.kind === 'RENT' ? `${amount}/day` : amount;
};

// Resolve the owner summary regardless of profile type
export const getListingOwner = (listing: Listing): { type: 'user' | 'band' | 'venue'; owner: ListingOwnerSummary } | null => {
    if (listing.createdByBand) return { type: 'band', owner: listing.createdByBand };
    if (listing.createdByVenue) return { type: 'venue', owner: listing.createdByVenue };
    if (listing.createdByUser) return { type: 'user', owner: listing.createdByUser };
    return null;
};

export interface ListingFilters {
    city?: string;
    state?: string;
    kind?: ListingKind;
    category?: string;
    openToTrades?: boolean;
    maxPrice?: number;
    search?: string;
}

export const getListings = async (filters: ListingFilters = {}): Promise<Listing[]> => {
    const params: Record<string, string> = {};
    if (filters.city) params.city = filters.city;
    if (filters.state) params.state = filters.state;
    if (filters.kind) params.kind = filters.kind;
    if (filters.category) params.category = filters.category;
    if (filters.openToTrades) params.openToTrades = 'true';
    if (filters.maxPrice != null) params.maxPrice = String(filters.maxPrice);
    if (filters.search) params.search = filters.search;

    const response = await api.get('/listings', { params });
    return response.data;
};

export const getListingsByLocation = async (city: string, state?: string): Promise<Listing[]> => {
    return getListings({ city, state });
};

export const getListingsByProfile = async (
    profileType: 'user' | 'band' | 'venue',
    profileId: string,
    includeClosed = false
): Promise<Listing[]> => {
    const params: Record<string, string> = {};
    if (profileType === 'band') params.bandId = profileId;
    else if (profileType === 'venue') params.venueId = profileId;
    else params.userId = profileId;
    if (includeClosed) params.includeClosed = 'true';

    const response = await api.get('/listings/profile', { params });
    return response.data;
};

export const getListingById = async (id: string): Promise<Listing> => {
    const response = await api.get(`/listings/${id}`);
    return response.data;
};

const buildFormData = (data: CreateListingData | UpdateListingData): FormData => {
    const formData = new FormData();
    const { coverImage, openToTrades, ...rest } = data as CreateListingData;

    Object.entries(rest).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            formData.append(key, value as string);
        }
    });

    if (openToTrades !== undefined) {
        formData.append('openToTrades', String(openToTrades));
    }

    if (coverImage) {
        formData.append('coverImage', coverImage as any);
    }

    return formData;
};

export const createListing = async (data: CreateListingData): Promise<Listing> => {
    const response = await api.post('/listings', buildFormData(data), {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const updateListing = async (id: string, data: UpdateListingData): Promise<Listing> => {
    const response = await api.put(`/listings/${id}`, buildFormData(data), {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const setListingStatus = async (id: string, status: ListingStatus): Promise<Listing> => {
    const response = await api.patch(`/listings/${id}/status`, { status });
    return response.data;
};

export const deleteListing = async (id: string): Promise<void> => {
    await api.delete(`/listings/${id}`);
};

export const addListingMedia = async (
    listingId: string,
    media: { uri: string; name: string; type: string },
    type: 'PHOTO' | 'VIDEO' = 'PHOTO'
): Promise<ListingMedia> => {
    const formData = new FormData();
    formData.append('media', media as any);
    formData.append('type', type);
    const response = await api.post(`/listings/${listingId}/media`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const deleteListingMedia = async (mediaId: string): Promise<void> => {
    await api.delete(`/listings/media/${mediaId}`);
};

// Reconcile the full ordered photo set. `order` is a list of `/uploads/...` URLs,
// index 0 = cover, the rest = gallery in order. Every URL must already belong to the
// listing (upload new files via addListingMedia first, then include their URLs here).
export const reorderListingPhotos = async (listingId: string, order: string[]): Promise<Listing> => {
    const response = await api.put(`/listings/${listingId}/photos`, { order });
    return response.data;
};
