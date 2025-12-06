#!/bin/sh
set -e

echo "=== Running database migrations ==="
cd /app/packages/database

# Run Prisma migrations
npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "=== Migrations complete, starting server ==="
cd /app

# Start the Next.js server
exec node apps/web/server.js
