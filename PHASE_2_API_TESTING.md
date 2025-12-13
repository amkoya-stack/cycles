# Phase 2 API Testing Guide

## Prerequisites

1. **Backend Running**: `cd backend && npm run start:dev`
2. **Docker Services**: PostgreSQL, Redis running (`docker compose up -d`)
3. **Migrations Applied**: `npm run migrate:up`
4. **System Accounts Seeded**: `npm run seed:system-accounts`

---

## Testing Workflow

### 1. User Registration

```bash
POST http://localhost:3001/api/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "phone": "254712345678",
  "password": "SecurePass123!",
  "firstName": "Test",
  "lastName": "User"
}

Response:
{
  "message": "Registration successful. Please verify your email and phone.",
  "userId": "uuid",
  "otpCode": "123456"  # Dev mode only
}
```

**Expected**: Wallet is auto-created for user (check logs for "Creating wallet for user...")

---

### 2. Verify OTP & Get Tokens

```bash
POST http://localhost:3001/api/auth/verify-otp
Content-Type: application/json

{
  "email": "test@example.com",
  "otp": "123456",
  "type": "email"
}

Response:
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

**Save the accessToken** - you'll need it for all subsequent requests.

---

### 3. Check Wallet Balance

```bash
GET http://localhost:3001/api/wallet/balance
Authorization: Bearer <accessToken>

Response:
{
  "balance": 0
}
```

---

### 4. Initiate Deposit (M-Pesa STK Push)

```bash
POST http://localhost:3001/api/wallet/deposit
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "phoneNumber": "254712345678",
  "amount": 1000
}

Response:
{
  "checkoutRequestId": "ws_CO_13122025123456789",
  "customerMessage": "The service request is processed successfully.",
  "externalReference": "uuid"
}
```

**What happens**:

1. STK Push sent to user's phone
2. User enters M-Pesa PIN
3. Safaricom calls `/api/mpesa/callback` with result
4. If successful, `WalletService.completeDeposit()` is called
5. Ledger transaction created
6. Email + SMS receipt sent

**Check Logs**: Watch for "M-Pesa callback received" and "Deposit completed"

---

### 5. Check Balance After Deposit

```bash
GET http://localhost:3001/api/wallet/balance
Authorization: Bearer <accessToken>

Response:
{
  "balance": 1000  # Updated after callback
}
```

---

### 6. Get Transaction History

```bash
GET http://localhost:3001/api/wallet/transactions?limit=10&type=deposit&status=completed
Authorization: Bearer <accessToken>

Response:
{
  "transactions": [
    {
      "id": "uuid",
      "reference": "TXN-abc123",
      "description": "Deposit from M-Pesa: QLR3X8Y9ZA",
      "transaction_type": "DEPOSIT",
      "amount": 1000,
      "direction": "credit",
      "balance_after": 1000,
      "status": "completed",
      "created_at": "2025-12-13T10:00:00Z"
    }
  ],
  "count": 1
}
```

**Filter Options**:

- `startDate`: YYYY-MM-DD
- `endDate`: YYYY-MM-DD
- `type`: deposit, withdrawal, transfer
- `status`: pending, completed, failed
- `limit`: number (default 50)
- `offset`: number (default 0)

---

### 7. Get Transaction Details

```bash
GET http://localhost:3001/api/wallet/transactions/:transactionId
Authorization: Bearer <accessToken>

Response:
{
  "id": "uuid",
  "reference": "TXN-abc123",
  "external_reference": "QLR3X8Y9ZA",
  "description": "Deposit from M-Pesa: QLR3X8Y9ZA",
  "status": "completed",
  "transaction_type": "DEPOSIT",
  "entries": [
    {
      "account_name": "Platform Cash",
      "direction": "debit",
      "amount": 1000,
      "balance_before": 0,
      "balance_after": 1000
    },
    {
      "account_name": "Test User Wallet",
      "direction": "credit",
      "amount": 1000,
      "balance_before": 0,
      "balance_after": 1000
    }
  ]
}
```

---

### 8. Wallet-to-Wallet Transfer

First, create a second user (repeat steps 1-2 with different email/phone).

```bash
POST http://localhost:3001/api/wallet/transfer
Authorization: Bearer <accessToken>  # Sender's token
Content-Type: application/json

{
  "recipientPhone": "254798765432",  # Second user's phone
  "amount": 100,
  "description": "Payment for lunch"
}

Response:
{
  "transaction": {
    "id": "uuid",
    "reference": "TXN-xyz789",
    "amount": 100
  }
}
```

**Expected**:

- Sender balance decreases by 100
- Recipient balance increases by 100
- Both receive email + SMS receipts

---

### 9. Initiate Withdrawal (M-Pesa B2C)

```bash
POST http://localhost:3001/api/wallet/withdraw
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "phoneNumber": "254712345678",
  "amount": 500
}

Response:
{
  "conversationId": "AG_20251213_...",
  "originatorConversationId": "uuid",
  "responseDescription": "Accept the service request successfully.",
  "externalReference": "uuid"
}
```

**What happens**:

1. B2C payment request sent to M-Pesa
2. M-Pesa processes (typically 2-5 minutes)
3. Safaricom calls `/api/mpesa/b2c/result` with result
4. If successful, `WalletService.completeWithdrawal()` is called
5. Ledger transaction created
6. Email + SMS receipt sent

---

### 10. Generate PDF Statement

```bash
GET http://localhost:3001/api/wallet/statement?startDate=2025-01-01&endDate=2025-12-31&format=pdf
Authorization: Bearer <accessToken>

Response:
{
  "format": "pdf",
  "data": "JVBERi0xLjMKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwgL0xlbmd0aCA1IDAg...",
  "filename": "statement-<userId>-1734091234567.pdf"
}
```

**To Download**:

```javascript
// Frontend code
const response = await fetch("/api/wallet/statement?...");
const { data, filename } = await response.json();

const blob = new Blob([Buffer.from(data, "base64")], {
  type: "application/pdf",
});
const url = URL.createObjectURL(blob);
const link = document.createElement("a");
link.href = url;
link.download = filename;
link.click();
```

**CSV Format**:

```bash
GET http://localhost:3001/api/wallet/statement?startDate=2025-01-01&endDate=2025-12-31&format=csv

Response:
{
  "format": "csv",
  "data": "Date,Reference,Description,Type,Amount,Balance\n2025-12-13T10:00:00Z,...",
  "filename": "statement-<userId>-1734091234567.csv"
}
```

---

### 11. Trigger M-Pesa Reconciliation

```bash
POST http://localhost:3001/api/reconciliation/mpesa
Authorization: Bearer <accessToken>

Response:
{
  "runId": "uuid",
  "status": "completed",
  "mismatchCount": 0,
  "mismatches": [],
  "startedAt": "2025-12-13T10:00:00Z",
  "completedAt": "2025-12-13T10:00:15Z"
}
```

**If Mismatches Found**:

```json
{
  "status": "warning",
  "mismatchCount": 2,
  "mismatches": [
    {
      "type": "missing_ledger",
      "mpesaReceipt": "QLR3X8Y9ZA",
      "amount": 1000,
      "phoneNumber": "254712345678",
      "transactionDate": "2025-12-13T09:00:00Z"
    },
    {
      "type": "amount_mismatch",
      "mpesaReceipt": "XYZ987654",
      "mpesaAmount": 1000,
      "ledgerAmount": 995,
      "difference": 5
    }
  ]
}
```

---

## Testing Email & SMS Receipts

### Email Configuration

Add to `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="Cycle Platform" <noreply@cycle.co.ke>
```

**Gmail Setup**:

1. Enable 2FA on your Google account
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use the 16-character app password as `SMTP_PASS`

### SMS Configuration

Add to `.env`:

```env
AT_API_KEY=your-africastalking-api-key
AT_USERNAME=sandbox  # or your production username
AT_SENDER_ID=Cycle
```

**Get API Key**:

1. Sign up at https://africastalking.com/
2. Create app and get API key
3. Use sandbox for testing (free)

### Testing Receipts

1. **Complete a deposit** → Check email and phone for receipt
2. **Complete a withdrawal** → Check email and phone for receipt
3. **Complete a transfer** → Sender receives email/SMS with recipient name

**Expected Email**:

- Subject: "Deposit Receipt - Cycle Platform"
- Professional HTML template
- Transaction details, M-Pesa receipt, timestamp

**Expected SMS**:

```
Deposit of KES 1000.00 received. M-Pesa Ref: QLR3X8Y9ZA. New balance available in your Cycle wallet. Ref: TXN-abc123
```

---

## Simulating M-Pesa Callbacks (Dev/Testing)

Since you can't trigger real M-Pesa callbacks locally, simulate them:

### 1. Deposit Callback

```bash
POST http://localhost:3001/api/mpesa/callback
Content-Type: application/json

{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "29115-34620561-1",
      "CheckoutRequestID": "ws_CO_13122025123456789",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          { "Name": "Amount", "Value": 1000 },
          { "Name": "MpesaReceiptNumber", "Value": "QLR3X8Y9ZA" },
          { "Name": "TransactionDate", "Value": 20251213100000 },
          { "Name": "PhoneNumber", "Value": 254712345678 }
        ]
      }
    }
  }
}
```

### 2. Withdrawal (B2C) Result

```bash
POST http://localhost:3001/api/mpesa/b2c/result
Content-Type: application/json

{
  "Result": {
    "ResultType": 0,
    "ResultCode": 0,
    "ResultDesc": "The service request has been accepted successfully",
    "OriginatorConversationID": "uuid-from-initiate-withdrawal",
    "ConversationID": "AG_20251213_...",
    "TransactionID": "QLR3X8Y9ZB",
    "ResultParameters": {
      "ResultParameter": [
        { "Key": "TransactionAmount", "Value": 500 },
        { "Key": "TransactionReceipt", "Value": "QLR3X8Y9ZB" },
        { "Key": "ReceiverPartyPublicName", "Value": "254712345678 - John Doe" },
        { "Key": "TransactionCompletedDateTime", "Value": "13.12.2025 10:05:00" }
      ]
    }
  }
}
```

---

## Common Issues & Troubleshooting

### 1. "Insufficient balance" error

- Check wallet balance: `GET /api/wallet/balance`
- Ensure deposit callback was processed (check logs)

### 2. Deposit doesn't reflect

- Check `mpesa_callbacks` table: `SELECT * FROM mpesa_callbacks ORDER BY created_at DESC LIMIT 5;`
- Verify `result_code = '0'` (success)
- Check logs for "M-Pesa callback received"

### 3. Email not sending

- Verify SMTP credentials in `.env`
- Check backend logs for "Failed to send email receipt"
- Test SMTP connection: `telnet smtp.gmail.com 587`

### 4. SMS not sending

- Verify Africa's Talking credentials
- Check phone number format (254XXXXXXXXX, no +)
- Use sandbox for testing (free tier)

### 5. Statement generation fails

- Verify user has transactions in date range
- Check `SELECT * FROM transactions WHERE created_at >= '...' AND created_at <= '...'`
- Ensure RLS context is set correctly

---

## Production Checklist

Before deploying to production:

- [ ] Switch M-Pesa to production API (update `MPESA_BASE_URL`)
- [ ] Use production M-Pesa credentials (Shortcode, Passkey, Consumer Key/Secret)
- [ ] Configure public callback URLs (must be HTTPS)
- [ ] Set up production SMTP (e.g., SendGrid, AWS SES)
- [ ] Move from Africa's Talking sandbox to production
- [ ] Enable scheduled reconciliation jobs
- [ ] Set up monitoring alerts (Sentry, Datadog)
- [ ] Configure rate limiting for public endpoints
- [ ] Add IP whitelisting for M-Pesa callbacks

---

## Next Steps

Phase 2 is complete! You can now:

1. **Build the frontend** using these APIs
2. **Test with real M-Pesa** in sandbox mode
3. **Implement Chama features** (Phase 3)
4. **Add advanced features**: dashboards, analytics, reports

**Happy Testing! 🎉**
