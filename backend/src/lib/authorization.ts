import { prisma } from "./prisma";
import { ParticipantType } from "../../generated/prisma/enums";

/**
 * Backline profiles are polymorphic: a request acts as a USER, a BAND or a VENUE.
 * The JWT only proves *which user* is calling, so every endpoint that accepts a
 * caller-supplied `senderId`/`ownerId`/`followerId` must prove that user may act
 * as that profile. This check was previously copy-pasted (and in several places
 * simply forgotten), so it lives here once.
 */
export const canActAs = async (
  userId: string,
  type: ParticipantType | string | undefined,
  profileId: string | undefined,
): Promise<boolean> => {
  if (!userId || !profileId) return false;

  if (type === ParticipantType.USER) return profileId === userId;

  if (type === ParticipantType.BAND) {
    return !!(await prisma.bandMember.findFirst({ where: { bandId: profileId, userId } }));
  }

  if (type === ParticipantType.VENUE) {
    return !!(await prisma.venueRepresentative.findFirst({ where: { venueId: profileId, userId } }));
  }

  return false;
};

export const isValidParticipantType = (t: unknown): t is ParticipantType =>
  t === ParticipantType.USER || t === ParticipantType.BAND || t === ParticipantType.VENUE;

/** Lowercase variant used by the follow/scene/metrics endpoints ('user' | 'band' | 'venue'). */
export const canActAsLower = async (
  userId: string,
  type: string | undefined,
  profileId: string | undefined,
): Promise<boolean> =>
  canActAs(userId, type?.toUpperCase() as ParticipantType, profileId);
