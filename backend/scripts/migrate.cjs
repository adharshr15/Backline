const { execSync } = require('child_process');

const migrationName = process.argv[2];

if (!migrationName) {
  console.error("provide migration name");
  process.exit(1);
}

try {
  console.log(`\n[*] Running prisma migrate dev --name ${migrationName}`);
  execSync(`npx prisma migrate dev --name ${migrationName}`, { stdio: 'inherit' });

  console.log(`\n[*] Running test:db script`);
  execSync('npm run test:db', { stdio: 'inherit' });

  console.log(`\n[*] Running prisma generate`);
  execSync('npx prisma generate', { stdio: 'inherit' });

  console.log("\n[$] Migration workflow completed successfully!");
} catch (err) {
  console.error("\n[X] Migration workflow failed:", err.message);
  process.exit(1);
}