#!/bin/sh
# Run migrations only if they haven't been run yet
if [ ! -f /app/.migrations-done ]; then
  echo "Running migrations..."
  npm run migrate:prod
  touch /app/.migrations-done
  echo "Migrations completed"
else
  echo "Migrations already run, skipping..."
fi
