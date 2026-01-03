# Push Notifications Setup Guide

## Overview

The Cycle platform now supports Web Push Notifications using the Web Push API. This allows users to receive notifications even when the browser is closed.

## Prerequisites

1. **VAPID Keys**: You need to generate VAPID (Voluntary Application Server Identification) keys for push notifications.

## Generating VAPID Keys

You can generate VAPID keys using Node.js:

```bash
cd backend
npx web-push generate-vapid-keys
```

This will output:
```
Public Key: <your-public-key>
Private Key: <your-private-key>
```

## Environment Variables

Add these to your `.env` file:

```env
# VAPID Keys for Web Push Notifications
VAPID_PUBLIC_KEY=<your-public-key>
VAPID_PRIVATE_KEY=<your-private-key>
VAPID_SUBJECT=mailto:admin@cycle.app  # Your contact email or mailto: link
```

## Database Migration

The push notification tokens table has been created. Run migrations if you haven't:

```bash
cd backend
npm run migrate:up
```

## Frontend Setup

1. **Service Worker**: Located at `frontend/public/service-worker.js`
2. **Push Manager**: Located at `frontend/lib/push-notifications.ts`
3. **Auto-initialization**: Push notifications are automatically initialized when users log in (via `AuthInitializer`)

## Icon Files

Make sure you have these icon files in `frontend/public/`:
- `icon-192x192.png` - Main app icon (192x192px)
- `badge-72x72.png` - Badge icon for notifications (72x72px)

If these don't exist, create placeholder icons or update the paths in:
- `backend/src/wallet/notification.service.ts` (default icon paths)
- `frontend/public/service-worker.js` (icon paths)

## Testing

1. **Check VAPID Key**: 
   ```bash
   curl http://localhost:3001/api/v1/wallet/push/vapid-key \
     -H "Authorization: Bearer <your-token>"
   ```

2. **Register Token**: The frontend automatically registers tokens when:
   - User logs in
   - User grants notification permission
   - Service worker is registered

3. **Send Test Notification**: Use the loan reminder system or create a test endpoint.

## How It Works

1. **User logs in** → `AuthInitializer` initializes push notifications
2. **Service Worker registers** → `/service-worker.js` is registered
3. **VAPID key fetched** → Backend provides public key
4. **User grants permission** → Browser prompts for notification permission
5. **Subscription created** → Push subscription is created and sent to backend
6. **Token stored** → Backend stores subscription in `push_notification_tokens` table
7. **Notifications sent** → Backend uses `web-push` to send notifications to all user's devices

## API Endpoints

- `GET /api/v1/wallet/push/vapid-key` - Get VAPID public key
- `POST /api/v1/wallet/push/register` - Register push token
- `POST /api/v1/wallet/push/unregister` - Unregister push token
- `GET /api/v1/wallet/push/tokens` - Get user's push tokens

## Integration with Loan Reminders

Loan payment reminders automatically use push notifications when:
- User has granted notification permission
- User has registered push tokens
- Reminder channel is set to `push`

The reminder system will send push notifications for:
- Before due date reminders
- Due date reminders
- Overdue reminders

## Troubleshooting

1. **Notifications not working?**
   - Check browser console for errors
   - Verify VAPID keys are set correctly
   - Ensure service worker is registered (check Application tab in DevTools)
   - Verify notification permission is granted

2. **Service worker not registering?**
   - Ensure `service-worker.js` is in `frontend/public/`
   - Check browser console for registration errors
   - Verify HTTPS (required for production, localhost works for development)

3. **Tokens not being stored?**
   - Check backend logs for errors
   - Verify database migration ran successfully
   - Check user authentication token is valid

## Production Considerations

1. **HTTPS Required**: Push notifications require HTTPS in production (localhost works for development)
2. **Icon Files**: Ensure icon files exist and are accessible
3. **VAPID Keys**: Keep private key secure, never commit to version control
4. **Error Handling**: Invalid tokens are automatically marked as inactive

