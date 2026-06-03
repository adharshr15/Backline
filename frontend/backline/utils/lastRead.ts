// Thin helpers — unread state now lives on ConversationParticipant.lastReadAt (server).

import { Conversation, ConversationParticipant } from '@/services/conversation.service';

export function getMyParticipant(
    conv: Conversation,
    senderType: string,
    senderId: string
): ConversationParticipant | undefined {
    return conv.participants.find(p =>
        (senderType === 'USER'  && p.userId  === senderId) ||
        (senderType === 'BAND'  && p.bandId  === senderId) ||
        (senderType === 'VENUE' && p.venueId === senderId)
    );
}

export function isConvUnread(
    conv: Conversation,
    senderType: string,
    senderId: string
): boolean {
    const lastMsg = conv.messages[0];
    if (!lastMsg) return false;
    const isMine =
        (senderType === 'USER'  && lastMsg.senderUserId  === senderId) ||
        (senderType === 'BAND'  && lastMsg.senderBandId  === senderId) ||
        (senderType === 'VENUE' && lastMsg.senderVenueId === senderId);
    if (isMine) return false;
    const me = getMyParticipant(conv, senderType, senderId);
    if (!me?.lastReadAt) return true;
    return new Date(lastMsg.createdAt) > new Date(me.lastReadAt);
}
