// One-off: copy every existing ShowMedia row into the new Post model, then
// clear ShowMedia so the now-empty table can be dropped in a later migration.
// Run with:  npx tsx scripts/migrate-showmedia-to-posts.ts
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const media = await prisma.showMedia.findMany({ where: { deletedAt: null } });
  console.log(`Found ${media.length} ShowMedia row(s) to migrate.`);

  let migrated = 0;
  for (const m of media) {
    const owner =
      m.contributorType === 'BAND'  ? { ownerBandId:  m.contributorId } :
      m.contributorType === 'VENUE' ? { ownerVenueId: m.contributorId } :
                                      { ownerUserId:  m.contributorId };

    await prisma.post.create({
      data: {
        url: m.url,
        type: m.type,
        caption: null,
        uploaderUserId: m.uploaderUserId,
        showId: m.showId,
        createdAt: m.createdAt,
        ...owner,
      },
    });
    migrated++;
  }

  // Empty the table so the subsequent drop migration is non-destructive.
  const del = await prisma.showMedia.deleteMany({});
  console.log(`Migrated ${migrated} post(s). Cleared ${del.count} ShowMedia row(s).`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
