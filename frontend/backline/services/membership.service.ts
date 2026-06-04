import api from './api';

export interface BandInvite {
    id: string;
    bandId: string;
    userId: string;
    status: string;
    createdAt: string;
    band: { id: string; name: string; profileImageUrl?: string | null };
}

export interface VenueInvite {
    id: string;
    venueId: string;
    userId: string;
    status: string;
    createdAt: string;
    venue: { id: string; name: string; profileImageUrl?: string | null };
}

export const getMembershipInvites = async (
    userId: string
): Promise<{ bandInvites: BandInvite[]; venueInvites: VenueInvite[] }> => {
    const res = await api.get('/membership-invites', { params: { userId } });
    return res.data;
};

export const respondToBandInvite = async (
    inviteId: string,
    userId: string,
    action: 'ACCEPT' | 'DECLINE'
): Promise<{ success: boolean; conversationId?: string }> => {
    const res = await api.post(`/membership-invites/band/${inviteId}/respond`, { userId, action });
    return res.data;
};

export const respondToVenueInvite = async (
    inviteId: string,
    userId: string,
    action: 'ACCEPT' | 'DECLINE'
): Promise<{ success: boolean; conversationId?: string }> => {
    const res = await api.post(`/membership-invites/venue/${inviteId}/respond`, { userId, action });
    return res.data;
};

export const inviteUserToBand = async (
    bandId: string,
    inviteMemberId: string,
    requestingUserId: string
): Promise<void> => {
    const form = new FormData();
    form.append('inviteMemberId', inviteMemberId);
    form.append('userId', requestingUserId);
    await api.put(`/bands/${bandId}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

export const inviteUserToVenue = async (
    venueId: string,
    inviteRepresentativeId: string,
    requestingUserId: string
): Promise<void> => {
    const form = new FormData();
    form.append('inviteRepresentativeId', inviteRepresentativeId);
    form.append('userId', requestingUserId);
    await api.put(`/venues/${venueId}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

export const leaveBand = async (bandId: string, userId: string): Promise<void> => {
    await api.delete(`/bands/${bandId}/members/me`, { data: { userId } });
};

export const leaveVenue = async (venueId: string, userId: string): Promise<void> => {
    await api.delete(`/venues/${venueId}/representatives/me`, { data: { userId } });
};
