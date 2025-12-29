# API Version Update Guide

## ✅ Updated Files

The following files have been updated to use `/api/v1/` prefix:

### Auth Routes
- ✅ `app/auth/register/page.tsx` - Register endpoint
- ✅ `app/auth/login/page.tsx` - Login endpoint
- ✅ `app/auth/verify/page.tsx` - Email/Phone verification
- ✅ `app/auth/forgot-password/page.tsx` - Password reset
- ✅ `app/profile/page.tsx` - Profile endpoints (me, profile, upload-photo, remove-photo)
- ✅ `app/wallet/page.tsx` - Auth me endpoint
- ✅ `components/home/home-navbar.tsx` - Profile endpoint

## ⚠️ Remaining Files to Update

The following files still need to be updated to use `/api/v1/`:

### Wallet Routes
- `app/wallet/page.tsx` - Wallet endpoints (deposit, withdraw, transfer, balance, transactions)
- `hooks/use-notifications.ts` - Wallet notifications
- `components/wallet/*.tsx` - Wallet components

### Chama Routes
- `app/[slug]/page.tsx` - Chama endpoints
- `hooks/use-chamas.ts` - Chama hooks
- `components/chama/*.tsx` - Chama components
- `components/home/home-navbar.tsx` - Chama endpoints

### Users Routes
- `app/profile/[userId]/page.tsx` - User profile endpoints

## Quick Fix Script

To update all remaining routes, you can use find and replace:

**Find:** `http://localhost:3001/api/`
**Replace:** `http://localhost:3001/api/v1/`

**OR** use the new API config helper:

```typescript
import { apiUrl } from '@/lib/api-config';

// Instead of:
fetch("http://localhost:3001/api/wallet/balance")

// Use:
fetch(apiUrl("wallet/balance"))
```

## Testing

After updating, test:
1. ✅ User registration
2. ✅ User login
3. ✅ Profile access
4. ⏳ Wallet operations
5. ⏳ Chama operations

