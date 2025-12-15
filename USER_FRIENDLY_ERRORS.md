# User-Friendly Error Handling - Frontend Authentication

## Problem

Users were seeing raw HTTP errors like "Cannot POST /api/auth/send-otp" and technical error messages that exposed internal system details. This creates a poor user experience and looks unprofessional.

## Solution Implemented

### 1. Fixed Resend OTP Endpoint

**Before:**

- Frontend called: `/api/auth/send-otp`
- Backend expected: `/api/auth/otp/send`
- Payload was wrong: `{ type }` instead of `{ channel, destination, purpose }`

**After:**

- Correct endpoint: `/api/auth/otp/send`
- Correct payload structure:
  ```json
  {
    "channel": "email" | "sms",
    "destination": "user@example.com" | "+254712345678",
    "purpose": "email_verification" | "phone_verification"
  }
  ```

### 2. Added Destination Tracking

- Register page now passes `destination` parameter to verify page via URL query
- Verify page stores destination from query params
- Resend OTP uses stored destination instead of missing data

**Usage:**

```typescript
router.push(
  `/auth/verify?type=${verificationType}&destination=${encodeURIComponent(
    destination
  )}`
);
```

### 3. User-Friendly Error Messages

All authentication pages now have proper error handling that translates technical errors into user-friendly messages:

#### Login Page

| HTTP Status   | User Message                                                    |
| ------------- | --------------------------------------------------------------- |
| 401           | "Invalid email/phone or password. Please try again."            |
| 400           | "Please enter both email/phone and password."                   |
| 429           | "Too many login attempts. Please wait and try again."           |
| 500+          | "Server error. Please try again later."                         |
| Network Error | "Unable to log in. Please check your connection and try again." |

#### Register Page

| HTTP Status          | User Message                                                    |
| -------------------- | --------------------------------------------------------------- |
| 400 (already exists) | "An account with this email or phone already exists."           |
| 400 (missing fields) | "Please provide either an email or phone number."               |
| 400 (other)          | "Invalid information. Please check your details and try again." |
| 500+                 | "Server error. Please try again later."                         |
| Network Error        | "Registration failed. Please try again."                        |

#### Verify Page

| HTTP Status   | User Message                                                    |
| ------------- | --------------------------------------------------------------- |
| 400           | "Invalid or expired code. Please try again."                    |
| 429           | "Too many attempts. Please wait before trying again."           |
| 500+          | "Server error. Please try again later."                         |
| Network Error | "Unable to verify. Please check your connection and try again." |

#### Resend OTP

| HTTP Status         | User Message                                                       |
| ------------------- | ------------------------------------------------------------------ |
| 429                 | "Too many requests. Please wait a moment and try again."           |
| 404                 | "Service unavailable. Please try again later."                     |
| 500+                | "Server error. Please try again later."                            |
| Missing destination | "Cannot resend code. Please try registering again."                |
| Network Error       | "Unable to send code. Please check your connection and try again." |

### 4. Error Handling Pattern

All API calls now follow this pattern:

```typescript
try {
  const response = await fetch(endpoint, options);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));

    // Map HTTP status to user-friendly message
    if (response.status === 401) {
      throw new Error("User-friendly message here");
    } else if (response.status === 400) {
      throw new Error("Another user-friendly message");
    } else if (response.status >= 500) {
      throw new Error("Server error. Please try again later.");
    } else {
      // Fallback to server message if available
      throw new Error(data.message || "Generic user-friendly message");
    }
  }

  const data = await response.json();
  // Handle success
} catch (err: any) {
  // Always show user-friendly error
  setError(err.message || "Fallback message for network errors");
}
```

### 5. Defensive JSON Parsing

Changed from:

```typescript
const data = await response.json();
if (!response.ok) {
  throw new Error(data.message);
}
```

To:

```typescript
if (!response.ok) {
  const data = await response.json().catch(() => ({}));
  // Handle error with data.message as fallback
}
```

This prevents crashes when the server returns non-JSON error responses (like 404 HTML pages).

## Benefits

✅ **Professional UX**: Users never see technical errors or raw HTTP messages
✅ **Clear Guidance**: Error messages tell users exactly what went wrong and what to do
✅ **Graceful Degradation**: Network errors are handled without crashes
✅ **Consistent Experience**: Same error handling pattern across all auth pages
✅ **Debugging Friendly**: Developers can still see technical details in console logs
✅ **Security**: Internal system details are not exposed to users

## Testing

### Test Resend OTP

1. Register with an email
2. Go to verify page
3. Click "Resend code"
4. Should show: "Verification code sent! Check your email."

### Test Invalid Credentials

1. Go to login page
2. Enter wrong password
3. Should show: "Invalid email/phone or password. Please try again."
4. Should NOT show: "UnauthorizedException" or raw error details

### Test Network Errors

1. Stop backend server
2. Try to login
3. Should show: "Unable to log in. Please check your connection and try again."
4. Should NOT crash or show "Failed to fetch"

## Next Steps

Consider adding:

- Toast notifications for success/error messages
- Loading states with skeleton loaders
- Retry logic for failed requests
- Client-side validation before API calls
- Rate limiting feedback (show countdown timer)
