#!/bin/sh

# Wait for PostgreSQL to be ready before running migrations
echo "Waiting for PostgreSQL..."
until pg_isready -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" -U "$POSTGRES_USER" > /dev/null 2>&1; do
  sleep 2
done
echo "PostgreSQL is ready."

pnpm build
pnpm predeploy
exec "$@"
