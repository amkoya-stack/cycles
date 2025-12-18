# Database Backups

This directory stores database backups created by `npm run db:backup`.

## Backup Policy

- Backups are created automatically before destructive operations
- Last 10 backups are kept, older ones are automatically deleted
- Backup format: SQL dump (plain text)

## Restoring from Backup

To restore a backup:

```bash
# List available backups
ls backend/backups

# Restore a specific backup
docker exec -i cycle-postgres psql -U postgres -d cycle < backend/backups/cycle_TIMESTAMP.sql
```

## Manual Backup

```bash
npm run db:backup
```

**Note:** Backups folder is git-ignored for security.
