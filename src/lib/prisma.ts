import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@/generated/prisma/client';

// No global caching: the better-sqlite3 adapter holds no connection pool, and a
// cached instance keeps the schema from before `prisma generate`, which breaks
// queries against newly added columns in dev hot reload.
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db' });

export const prisma: PrismaClient = new PrismaClient({ adapter });
