// Seed (or re-seed) the canonical genre taxonomy from src/lib/genres.seed.ts.
// Idempotent -- re-run it after editing GENRE_SEED to pick up new aliases.
// Run with:  npx tsx scripts/seed-genres.ts
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { syncGenreSeed } from '../src/lib/genres';

async function main() {
  const { roots, children } = await syncGenreSeed();
  const total = await prisma.genre.count();

  console.log(`Seeded ${roots} root genre(s) and ${children} child genre(s).`);
  console.log(`Genre table now holds ${total} row(s).`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
