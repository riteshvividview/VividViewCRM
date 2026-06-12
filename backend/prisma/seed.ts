import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('No seed required.');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });