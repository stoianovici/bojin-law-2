#!/bin/sh
set -e

echo "=== Docker Entrypoint Started ==="
echo "DATABASE_URL is set: ${DATABASE_URL:+yes}"
echo "Schema file exists: $(test -f /app/packages/database/prisma/schema.prisma && echo 'yes' || echo 'no')"
echo "Prisma CLI exists: $(test -f /app/node_modules/prisma/build/index.js && echo 'yes' || echo 'no')"

echo "=== Running database migrations ==="

# Run Prisma migrations using the copied prisma CLI from node_modules
# The schema is at /app/packages/database/prisma/schema.prisma
node /app/node_modules/prisma/build/index.js migrate deploy --schema=/app/packages/database/prisma/schema.prisma 2>&1 || {
  echo "=== Migration failed with exit code $? ==="
  echo "=== Continuing to start server (migrations may need manual run) ==="
}

echo "=== Starting server ==="

# Start the Next.js server
exec node /app/apps/web/server.js
