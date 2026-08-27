import api from './api';
import { Listing, formatListingPrice, getListingById } from './listing.service';

export type ParticipantType = 'USER' | 'BAND' | 'VENUE';

// ---- In-message attachments -------------------------------------------------
// A message may carry one inline preview of another entity. Listings are the
// first kind; shows (and future kinds) slot in behind the same interface.

export type AttachmentKind = 'LISTING' | 'SHOW';

// Slim listing shape the backend returns for previews (see listingPreviewSelect).
export type ListingPreview = Pick<
    Listing,
    'id' | 'title' | 'coverUrl' | 'kind' | 'price' | 'openToTrades' | 'status' | 'category' | 'city' | 'state'
>;

// Discriminated union normalized from the per-kind FKs on a Message.
export type MessageAttachment =
    | { kind: 'LISTING'; listing: ListingPreview };
    // | { kind: 'SHOW'; show: ShowPreview }  ← add in the shows follow-up

// Flat presentational contract every attachment UI consumes.
export interface AttachmentPreview {
    kind: AttachmentKind;
    id: string;
    coverUrl?: string | null;   // relative path; card prefixes BASE_URL
    fallback: 'icon' | 'image'; // listing → icon placeholder; show → default image
    title: string;
    subtitle: string;
    route: string;              // tab route to open on tap, e.g. 'listing' | 'show'
}

// The single place each kind is taught how to look.
export function toAttachmentPreview(a: MessageAttachment): AttachmentPreview {
    switch (a.kind) {
        case 'LISTING': {
            const l = a.listing;
            return {
                kind: 'LISTING',
                id: l.id,
                coverUrl: l.coverUrl,
                fallback: 'icon',
                title: l.title,
                subtitle: [formatListingPrice(l), l.category, l.city].filter(Boolean).join(' · '),
                route: 'listing',
            };
        }
    }
}

// A lightweight reference passed from a source screen through to send.
export interface AttachmentRef {
    kind: AttachmentKind;
    id: string;
}

// Reads whichever attachment FK is populated on a message.
export function getMessageAttachment(msg: Message): MessageAttachment | null {
    if (msg.listing) return { kind: 'LISTING', listing: msg.listing };
    return null;
}

// Collapses a resolved attachment back to a bare {kind, id} ref for sending.
export function attachmentToRef(a: MessageAttachment): AttachmentRef {
    switch (a.kind) {
        case 'LISTING':
            return { kind: 'LISTING', id: a.listing.id };
    }
}

// Fetches the full entity for a bare {kind, id} ref (used to stage a preview).
export async function resolveAttachment(kind: AttachmentKind, id: string): Promise<MessageAttachment> {
    switch (kind) {
        case 'LISTING':
            return { kind: 'LISTING', listing: await getListingById(id) };
        default:
            throw new Error(`Unsupported attachment kind: ${kind}`);
    }
}

// Maps a {kind, id} ref to the matching FK field on the send/create payload.
function attachmentBody(attachment?: AttachmentRef): Record<string, string> {
    if (!attachment) return {};
    if (attachment.kind === 'LISTING') return { listingId: attachment.id };
    return {};
}

export interface ParticipantProfile {
    id: string;
    name: string;
    profileImageUrl?: string | null;
    accountType: string;
}

export interface ConversationParticipant {
    id: string;
    conversationId: string;
    participantType: ParticipantType;
    userId?: string | null;
    bandId?: string | null;
    venueId?: string | null;
    user?: ParticipantProfile | null;
    band?: ParticipantProfile | null;
    venue?: ParticipantProfile | null;
    lastReadAt?: string | null;
}

export interface MessageSender {
    id: string;
    name: string;
    profileImageUrl?: string | null;
}

export interface Message {
    id: string;
    content: string;
    isSystemMessage?: boolean;
    conversationId: string;
    createdAt: string;
    senderUserId?: string | null;
    senderBandId?: string | null;
    senderVenueId?: string | null;
    senderUser?: MessageSender | null;
    senderBand?: MessageSender | null;
    senderVenue?: MessageSender | null;
    // Optional inline attachment (one FK per kind).
    listingId?: string | null;
    listing?: ListingPreview | null;
}

export interface Conversation {
    id: string;
    name?: string | null;
    createdAt: string;
    updatedAt: string;
    participants: ConversationParticipant[];
    messages: Message[];
    invites?: ConversationInvite[];
}

export interface ConversationInvite {
    id: string;
    status: string;
    message?: string | null;
    createdAt: string;
    conversationId?: string | null;
    conversation?: {
        id: string;
        name?: string | null;
        participants?: { user?: { id: string; name: string } | null; band?: { id: string; name: string } | null; venue?: { id: string; name: string } | null }[];
        invites?: { recipientUser?: { id: string; name: string } | null; recipientBand?: { id: string; name: string } | null; recipientVenue?: { id: string; name: string } | null }[];
    } | null;
    senderUserId?: string | null;
    senderBandId?: string | null;
    senderVenueId?: string | null;
    senderUser?: ParticipantProfile | null;
    senderBand?: ParticipantProfile | null;
    senderVenue?: ParticipantProfile | null;
    recipientUserId?: string | null;
    recipientBandId?: string | null;
    recipientVenueId?: string | null;
    recipientUser?: ParticipantProfile | null;
    recipientBand?: ParticipantProfile | null;
    recipientVenue?: ParticipantProfile | null;
}

/** Returns the recipient profile for an invite (outgoing side). */
export function getInviteRecipient(invite: ConversationInvite): ParticipantProfile | null {
    return invite.recipientUser ?? invite.recipientBand ?? invite.recipientVenue ?? null;
}

/** Returns the profile data for a participant (whichever type is set). */
export function getParticipantProfile(p: ConversationParticipant): ParticipantProfile | null {
    return p.user ?? p.band ?? p.venue ?? null;
}

/** Returns the sender profile for an invite. */
export function getInviteSender(invite: ConversationInvite): ParticipantProfile | null {
    return invite.senderUser ?? invite.senderBand ?? invite.senderVenue ?? null;
}

/** Returns the sender profile for a message. */
export function getMessageSender(msg: Message): MessageSender | null {
    return msg.senderUser ?? msg.senderBand ?? msg.senderVenue ?? null;
}

export const getMyConversations = async (
    senderType: ParticipantType,
    senderId: string
): Promise<Conversation[]> => {
    const res = await api.get('/conversations', { params: { senderType, senderId } });
    return res.data;
};

export const getMyInvites = async (
    senderType: ParticipantType,
    senderId: string
): Promise<ConversationInvite[]> => {
    const res = await api.get('/conversations/invites', { params: { senderType, senderId } });
    return res.data;
};

export const getMessages = async (
    conversationId: string,
    senderType: ParticipantType,
    senderId: string
): Promise<Message[]> => {
    const res = await api.get(`/conversations/${conversationId}/messages`, {
        params: { senderType, senderId },
    });
    return res.data;
};

export const sendMessage = async (
    conversationId: string,
    senderType: ParticipantType,
    senderId: string,
    content: string,
    attachment?: AttachmentRef
): Promise<Message> => {
    const res = await api.post(`/conversations/${conversationId}/messages`, {
        senderType, senderId, content, ...attachmentBody(attachment),
    });
    return res.data;
};

export const createConversation = async (
    senderType: ParticipantType,
    senderId: string,
    recipientType: ParticipantType,
    recipientId: string,
    content?: string
): Promise<Conversation> => {
    const body: any = { senderType, senderId, content };
    if (recipientType === 'USER')  body.userIds  = [recipientId];
    if (recipientType === 'BAND')  body.bandIds  = [recipientId];
    if (recipientType === 'VENUE') body.venueIds = [recipientId];
    const res = await api.post('/conversations', body);
    return res.data;
};

export const markRead = async (
    conversationId: string,
    senderType: ParticipantType,
    senderId: string
): Promise<void> => {
    await api.post(`/conversations/${conversationId}/read`, { senderType, senderId });
};

export const leaveConversation = async (
    conversationId: string,
    senderType: ParticipantType,
    senderId: string
): Promise<void> => {
    await api.delete(`/conversations/${conversationId}`, {
        data: { senderType, senderId },
    });
};

export interface Recipient {
    type: ParticipantType;
    id: string;
}

export const createGroupConversation = async (
    senderType: ParticipantType,
    senderId: string,
    recipients: Recipient[],
    content?: string,
    name?: string,
    attachment?: AttachmentRef,
): Promise<Conversation> => {
    const userIds  = recipients.filter(r => r.type === 'USER').map(r => r.id);
    const bandIds  = recipients.filter(r => r.type === 'BAND').map(r => r.id);
    const venueIds = recipients.filter(r => r.type === 'VENUE').map(r => r.id);
    const res = await api.post('/conversations', { senderType, senderId, userIds, bandIds, venueIds, content, name, ...attachmentBody(attachment) });
    return res.data;
};

export const respondToInvite = async (
    inviteId: string,
    participantType: ParticipantType,
    participantId: string,
    action: 'ACCEPT' | 'DECLINE'
): Promise<void> => {
    await api.post(`/conversations/conversation-invites/${inviteId}/respond`, {
        participantType, participantId, action,
    });
};
