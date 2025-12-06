#!/bin/sh
set -e

echo "=== Running database migrations ==="

# Run Prisma migrations using the copied prisma CLI from node_modules
# The schema is at /app/packages/database/prisma/schema.prisma
node /app/node_modules/prisma/build/index.js migrate deploy --schema=/app/packages/database/prisma/schema.prisma || {
  echo "=== Migration failed, but continuing to start server ==="
  echo "=== You may need to run migrations manually ==="
}

echo "=== Migrations complete, starting server ==="

# Start the Next.js server
exec node /app/apps/web/server.js
