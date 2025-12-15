# Testing Ethereal Email for OTP Verification

## What is Ethereal Email?

Ethereal is a fake SMTP service for testing email functionality in development. It captures emails and provides a web interface to view them without sending real emails.

## Setup

No configuration needed! The EmailService will automatically:

1. Detect missing SMTP credentials in development
2. Create an Ethereal test account
3. Log the Ethereal inbox URL and preview URLs for each email

## Testing the OTP Flow

### 1. Register a New User

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "testuser@example.com",
    "phone": "+254712345678",
    "password": "SecurePass123!"
  }'
```

Expected response:

```json
{
  "userId": "uuid-here"
}
```

### 2. Check Backend Logs

Look for these log entries:

```
✅ Ethereal Mail initialized: [username]@ethereal.email
📧 View emails at: https://ethereal.email/messages
📧 Email preview: https://ethereal.email/message/[message-id]
```

### 3. View the Email

Click the preview URL from the logs. You should see:

- A professionally formatted email
- 6-digit OTP code in large letters
- "Email Verification" as the purpose
- 10-minute expiration notice
- Security warning

### 4. Verify the OTP

Copy the 6-digit code from the email and verify:

```bash
curl -X POST http://localhost:3001/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "otp": "123456"
  }'
```

Expected response:

```json
{
  "status": "verified",
  "accessToken": "jwt-token-here",
  "refreshToken": "refresh-token-here"
}
```

## Other OTP Scenarios

### Password Reset

```bash
# Request password reset
curl -X POST http://localhost:3001/api/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "email",
    "destination": "testuser@example.com",
    "purpose": "password_reset"
  }'

# Check email for OTP, then reset password
curl -X POST http://localhost:3001/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "testuser@example.com",
    "otp": "123456",
    "newPassword": "NewSecurePass123!"
  }'
```

### Two-Factor Authentication

```bash
# Enable 2FA (requires auth token)
curl -X POST http://localhost:3001/api/auth/2fa/enable \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Check email for 2FA OTP
# Login will now require OTP verification
```

## Frontend Testing

Start the frontend:

```bash
cd frontend
npm run dev
```

### Test Registration Flow

1. Go to http://localhost:3000/auth/register
2. Fill in the form with a valid email
3. Submit the form
4. Check backend logs for the Ethereal preview URL
5. Open the preview URL to see the OTP
6. Go to the verify page and enter the OTP
7. Should redirect to home with tokens stored

### Test Login with OTP

1. Go to http://localhost:3000/auth/login
2. Enter email and password
3. Check backend logs for OTP email
4. Enter OTP on verify page

## Switching to Real Email Provider

When ready for production, add these environment variables:

```env
# .env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key

# Or use Gmail (less secure, for testing only)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

The EmailService will automatically use the real SMTP instead of Ethereal.

## Troubleshooting

### "Email transporter not available"

Check logs to see if Ethereal account creation failed. This usually means:

- Network issue connecting to Ethereal
- Ethereal service is down (rare)

### "Email preview: undefined"

This happens when using a real SMTP provider (not Ethereal). Preview URLs only work with Ethereal test accounts.

### OTP not showing in email

Check:

1. Backend logs for "Email sent to [email]"
2. Email HTML rendering (some email clients block styles)
3. OTP expiration (10 minutes from generation)

## Notes

- Ethereal emails are automatically deleted after a few days
- Each server restart creates a new Ethereal account
- Preview URLs are public but use random IDs (safe for development)
- OTP codes are hashed in database, plain text only in email
- Development mode returns OTP in API response (see ALLOW_DEV_OTP_RETURN env var)
