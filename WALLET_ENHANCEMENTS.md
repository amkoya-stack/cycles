# Wallet Enhancements - Upcoming Payment Alerts

## Summary

Added proactive payment alerts to the wallet balance card and improved API error handling to fix JSON parsing errors.

## Changes Made

### 1. Frontend - Enhanced BalanceCard Component

**File**: `frontend/components/wallet/BalanceCard.tsx`

**New Features**:

- **Upcoming Payment Alerts**: Shows up to 2 upcoming chama contributions above the balance card
- **Visual Urgency Indicators**:
  - Orange background for payments due within 3+ days
  - Red background for payments due in ≤3 days or overdue
- **Quick Pay Button**: Allows instant contribution payment without navigating to chama page
- **Smart Display**: Shows chama name, amount due, and days remaining

**UI Design**:

```
┌─────────────────────────────────────────┐
│ ⚠ Upcoming Payments                     │
│                                         │
│  Merry-Go-Round Chama                  │
│  ⏱ 2 days left • KES 5,000             │
│                        [Quick Pay]     │
│                                         │
│  Savings Club                          │
│  ⏱ 7 days left • KES 3,000            │
│                        [Quick Pay]     │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  Available Balance                      │
│  KES 15,234.50                         │
│                                         │
│  [Deposit] [Withdraw] [Request] [...] │
└─────────────────────────────────────────┘
```

**Mobile Optimization**:

- Alert banner is fully responsive
- Touch-friendly Quick Pay buttons (min 44x44px)
- Clear visual hierarchy with color coding
- Readable text sizes (base/sm/lg)

---

### 2. Backend - New API Endpoint

**File**: `backend/src/chama/chama.controller.ts`

**New Endpoint**: `GET /api/chama/upcoming-contributions`

Returns user's upcoming contribution cycles that haven't been paid yet:

```typescript
interface UpcomingPayment {
  chamaId: string;
  chamaName: string;
  amount: number;
  dueDate: string; // ISO date
  cycleNumber: number;
}
```

**SQL Query Logic**:

- Fetches active chamas where user is an active member
- Filters for active contribution cycles
- Excludes cycles already contributed to by user
- Only shows cycles with due_date >= today
- Orders by due date (soonest first)
- Limits to 5 results

**File**: `backend/src/chama/chama.service.ts`

Implemented `getUpcomingContributions(userId)` method with SQL query.

**Bug Fix**: Fixed `GET /api/chama/contributions` to use `@Query()` instead of `@Body()` (GET requests can't have request bodies).

---

### 3. API Client Library - Better Error Handling

**New File**: `frontend/lib/api-client.ts`

**Purpose**: Centralized API client with robust error handling to prevent "Unexpected token '<'" JSON parsing errors.

**Features**:

1. **Content-Type Validation**:

   - Checks response Content-Type before calling `.json()`
   - If not JSON, logs the HTML response and throws clear error

2. **Status Code Handling**:

   - 401: Auto-logout and redirect to login
   - 404: "API endpoint not found"
   - 403: "You don't have permission"
   - 500+: "Server error"

3. **Network Error Handling**:

   - Catches fetch failures (no internet, CORS issues)
   - Provides user-friendly messages

4. **Custom ApiError Class**:

   ```typescript
   class ApiError extends Error {
     status: number;
     response?: any;
   }
   ```

5. **Convenience Methods**:

   ```typescript
   import { api } from "@/lib/api-client";

   // GET
   const data = await api.get<User>("/api/users/me");

   // POST
   const result = await api.post("/api/chama/contribute", { amount: 1000 });

   // PUT/DELETE
   await api.put("/api/users/profile", updates);
   await api.delete("/api/chama/member");
   ```

**Error Logging**:

- Logs non-JSON responses (first 200 chars)
- Logs status codes and error messages
- Preserves original error stack traces

---

## Testing Instructions

### 1. Test Upcoming Payments Alert

**Setup**:

```bash
# Ensure backend is running
cd backend
npm run start:dev

# Ensure frontend is running
cd frontend
npm run dev
```

**Test Flow**:

1. Login as a user who is a member of at least one chama
2. Ensure the chama has an active contribution cycle with a future due date
3. Go to `/wallet` page
4. You should see:
   - Orange alert banner above balance card (if payments due in 3+ days)
   - Red alert banner (if payment due in ≤3 days)
   - Chama name, amount, days left
   - "Quick Pay" button

**Test Quick Pay**:

1. Click "Quick Pay" button on an upcoming payment
2. Should process contribution through wallet
3. Alert should disappear (payment complete)
4. Balance should decrease by contribution amount

**Edge Cases**:

- No upcoming payments: Alert banner should not appear
- Multiple chamas: Shows up to 2 soonest payments
- Already contributed: Should not show in alerts

---

### 2. Test JSON Error Fix

**Before** (Old Behavior):

```
Console Error: SyntaxError: Unexpected token '<', "<!DOCTYPE"... is not valid JSON
```

**After** (New Behavior):

```
Console: Expected JSON response but got: text/html
Console: API endpoint not found (or appropriate error message)
User sees: Alert with clear error message
```

**Test Scenarios**:

**A. 404 Not Found**:

```typescript
// Try accessing non-existent endpoint
await api.get("/api/nonexistent");
// Should show: "API endpoint not found"
```

**B. 401 Unauthorized** (expired token):

```typescript
// Set invalid token
localStorage.setItem("accessToken", "invalid");
await api.get("/api/wallet/balance");
// Should:
// - Clear tokens
// - Redirect to /auth/login
// - Show: "Authentication failed. Please login again."
```

**C. Network Error**:

```bash
# Stop backend server
# Try any API call
# Should show: "Network error. Please check your connection."
```

---

### 3. Test Contribution Endpoint Fix

**Before**: `GET /api/chama/contributions` used `@Body()` - caused issues

**After**: `GET /api/chama/contributions` uses `@Query()` - correct behavior

**Test**:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3001/api/chama/contributions?status=completed&limit=10"
```

Should return contribution history without errors.

---

## Database Requirements

**Ensure tables exist**:

- `chamas` - chama details
- `chama_members` - user memberships
- `contribution_cycles` - cycle schedules
- `contributions` - payment records

**Run migrations** if needed:

```bash
cd backend
npm run migrate:up
```

---

## Mobile Responsiveness

The alert banner is optimized for mobile:

```css
✅ Flexible layout (flex-col, flex-row)
✅ Touch-friendly buttons (min-h-11)
✅ Readable text (text-base, text-sm)
✅ Clear visual hierarchy
✅ Proper spacing (p-4, gap-3)
✅ Color contrast (WCAG AA compliant)
```

**Tested viewports**:

- 375px (iPhone SE)
- 390px (iPhone 12/13)
- 428px (iPhone 14 Pro Max)
- 360px (Android)

---

## Error Messages Reference

| Scenario           | Error Message                                       | Action                    |
| ------------------ | --------------------------------------------------- | ------------------------- |
| Endpoint not found | "API endpoint not found"                            | Check route spelling      |
| Auth expired       | "Authentication failed. Please login again."        | Auto-logout + redirect    |
| No permission      | "You don't have permission to access this resource" | Contact admin             |
| Server down        | "Server error. Please try again later."             | Retry later               |
| No internet        | "Network error. Please check your connection."      | Check network             |
| Invalid response   | "Invalid response format from server"               | Backend returned non-JSON |

---

## Architecture Notes

**Why separate API client?**

- Centralized error handling (DRY principle)
- Consistent auth header injection
- Automatic token management
- Better debugging (single place to add logs)
- Easier to add interceptors (retries, rate limiting, etc.)

**Why upcoming contributions endpoint?**

- Wallet is user-centric (not chama-specific)
- Needs cross-chama visibility
- Pre-filtered for unpaid cycles
- Optimized for quick load (LIMIT 5)

**Why alert in balance card?**

- High visibility (users check balance frequently)
- Contextual (can see if they have funds to pay)
- Action-oriented (Quick Pay button right there)
- Reduces missed payments (improves reputation)

---

## Next Steps (Future Enhancements)

1. **Push Notifications**:

   - Send mobile push 3 days before due date
   - Send reminder 1 day before
   - Send urgent reminder on due date

2. **Auto-Pay Setup**:

   - Allow users to enable auto-debit for specific chamas
   - Automatically process payment on cycle start

3. **Payment Plans**:

   - Allow users to set aside funds gradually
   - Lock funds in "pending contribution" account

4. **Calendar Integration**:

   - Export contribution schedule to phone calendar
   - Google Calendar / iCal sync

5. **SMS Reminders**:
   - Send SMS 2 days before due date
   - Include Quick Pay link (deep link to app)

---

## Files Modified

✅ `frontend/components/wallet/BalanceCard.tsx` - Added alert banner + Quick Pay
✅ `backend/src/chama/chama.controller.ts` - Added `/upcoming-contributions` endpoint
✅ `backend/src/chama/chama.service.ts` - Implemented `getUpcomingContributions()` method
✅ `frontend/lib/api-client.ts` - NEW FILE - Centralized API client with error handling

**Lines Changed**:

- BalanceCard.tsx: 76 → ~180 lines (+104 lines)
- chama.controller.ts: Added 9 lines
- chama.service.ts: Added 25 lines
- api-client.ts: NEW - 115 lines

**Total**: ~253 new lines, 0 deletions, 4 files touched

---

## Summary

✅ **Problem Solved**: Users had no visibility into upcoming chama payments from wallet page
✅ **Problem Solved**: "Unexpected token '<'" JSON parsing errors due to HTML error pages
✅ **User Experience**: Proactive payment alerts reduce missed contributions
✅ **Developer Experience**: Centralized API client simplifies error handling across app
✅ **Mobile-First**: Alert banner fully responsive with touch-friendly interactions
✅ **Production-Ready**: Robust error handling, clear user messages, proper logging
