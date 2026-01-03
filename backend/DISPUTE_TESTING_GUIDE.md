# Dispute Resolution Module - Testing Guide

This guide helps you test all the enhancements for the Dispute Resolution module.

## Prerequisites

1. **Backend running**: Ensure the NestJS backend is running
2. **Database connected**: PostgreSQL database should be accessible
3. **Environment variables**: Configure `.env` file (see Configuration section)

## Configuration

### 1. File Upload Configuration

Add to your `.env` file:

```env
# File Upload (Local Storage - Default)
USE_S3_UPLOAD=false
UPLOAD_DIR=./uploads
UPLOAD_BASE_URL=http://localhost:4000/uploads

# OR File Upload (S3)
USE_S3_UPLOAD=true
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

### 2. Email Notification Configuration

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@cycle.app
```

### 3. Push Notification Configuration

```env
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:admin@cycle.app
```

### 4. Testing Credentials

```env
TEST_TOKEN=your-jwt-token-here
TEST_CHAMA_ID=your-chama-id-here
ADMIN_TOKEN=your-platform-admin-token-here
API_URL=http://localhost:4000
```

## Testing Steps

### 1. Test File Uploads

**Using the test script:**

```bash
cd backend
npm run test:dispute-uploads
```

**Or manually:**

1. Get a JWT token (login as a chama member)
2. File a dispute via API or frontend
3. Upload an evidence file using the dispute ID
4. Verify file appears in:
   - Database (`dispute_evidence` table)
   - Local storage: `backend/uploads/disputes/{disputeId}/evidence/`
   - Or S3 bucket (if configured)

**Expected Results:**
- ✅ File uploads successfully
- ✅ File URL stored in database
- ✅ File accessible via URL
- ✅ File metadata (size, type) recorded

### 2. Configure Email/Push Notifications

**Email Setup:**
1. For Gmail: Use App Password (not regular password)
   - Go to Google Account → Security → 2-Step Verification → App Passwords
   - Generate app password for "Mail"
2. Update `.env` with SMTP credentials
3. Restart backend server

**Push Notifications Setup:**
1. Generate VAPID keys:
   ```bash
   npm install -g web-push
   web-push generate-vapid-keys
   ```
2. Copy public and private keys to `.env`
3. Restart backend server

**Verify Configuration:**
- Check backend logs on startup for:
  - "Email transporter initialized" (email)
  - "VAPID keys configured" (push)

### 3. Test Notification Delivery

**Using the test script:**

```bash
cd backend
npm run test:dispute-notifications
```

**Or manually test each notification type:**

1. **Dispute Filed Notification:**
   - File a new dispute
   - Check email inboxes of all chama members
   - Check push notifications on devices

2. **Evidence Added Notification:**
   - Add evidence to an existing dispute
   - Check email inboxes of dispute participants

3. **Comment Added Notification:**
   - Add a comment to a dispute in discussion phase
   - Check push notifications on devices

4. **Voting Started Notification:**
   - Start voting phase on a dispute
   - Check email inboxes of all chama members
   - Verify voting deadline in notification

5. **Dispute Resolved Notification:**
   - Resolve a dispute
   - Check email inboxes of dispute participants

**Expected Results:**
- ✅ All notifications sent successfully
- ✅ Email notifications received
- ✅ Push notifications received (if devices subscribed)
- ✅ Notification content is accurate

### 4. Verify Cron Jobs (Reminders)

**Check reminder status:**

```bash
cd backend
npm run check:dispute-reminders
```

**Verify cron jobs are running:**

1. Check backend logs for cron job execution:
   ```
   [DisputeReminderService] Checked X disputes with upcoming voting deadlines
   [DisputeReminderService] Checked X disputes with upcoming discussion deadlines
   [DisputeReminderService] Found X overdue voting disputes
   ```

2. Create a test dispute with voting deadline in 1 hour
3. Wait for next cron execution (runs every hour)
4. Check email/push for reminder notifications

**Manual trigger (for testing):**
- Temporarily change cron expression to `EVERY_MINUTE` for testing
- Or call reminder methods directly in a test script

**Expected Results:**
- ✅ Cron jobs execute on schedule
- ✅ Reminders sent to users who haven't acted
- ✅ Overdue disputes detected and reported

### 5. Test Admin Endpoints

**Using the test script:**

```bash
cd backend
npm run test:dispute-admin
```

**Or manually:**

1. **Get Escalated Disputes:**
   ```bash
   curl -X GET "http://localhost:4000/api/v1/admin/disputes/escalated" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

2. **Get Analytics:**
   ```bash
   curl -X GET "http://localhost:4000/api/v1/admin/disputes/analytics" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

3. **Review Escalated Dispute:**
   ```bash
   curl -X PUT "http://localhost:4000/api/v1/admin/disputes/{disputeId}/review" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "decision": "Platform reviewed and resolved",
       "platformAction": {
         "action": "mediation",
         "notes": "Test review"
       }
     }'
   ```

**Expected Results:**
- ✅ Escalated disputes retrieved
- ✅ Analytics data returned with all metrics
- ✅ Dispute review recorded in database
- ✅ Platform decision stored

### 6. Review Analytics Data

**Access analytics endpoint:**

```bash
curl -X GET "http://localhost:4000/api/v1/admin/disputes/analytics?startDate=2025-01-01&endDate=2025-12-31" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Analytics includes:**
- Total disputes count
- Disputes by type, status, priority
- Resolution rate percentage
- Average resolution time (days)
- Escalation rate percentage
- Trends over last 30 days

**Expected Results:**
- ✅ All metrics calculated correctly
- ✅ Date range filtering works
- ✅ Trends data shows daily counts
- ✅ Percentages are accurate

## Test Scripts

Add these to `backend/package.json`:

```json
{
  "scripts": {
    "test:dispute-uploads": "ts-node scripts/test-dispute-uploads.ts",
    "test:dispute-notifications": "ts-node scripts/test-dispute-notifications.ts",
    "test:dispute-admin": "ts-node scripts/test-dispute-admin.ts",
    "check:dispute-reminders": "ts-node scripts/check-dispute-reminders.ts"
  }
}
```

## Troubleshooting

### File Upload Issues

**Problem:** Files not uploading
- Check `UPLOAD_DIR` exists and is writable
- Verify file size limits (default 10MB)
- Check file type is allowed
- For S3: Verify AWS credentials and bucket permissions

**Problem:** File URLs not accessible
- Check `UPLOAD_BASE_URL` is correct
- Verify file server/static file serving is configured
- For S3: Check bucket is public or use signed URLs

### Notification Issues

**Problem:** Emails not sending
- Verify SMTP credentials are correct
- Check spam/junk folder
- Test SMTP connection separately
- Check backend logs for errors

**Problem:** Push notifications not working
- Verify VAPID keys are correct
- Check devices have push subscriptions
- Verify service worker is registered
- Check browser console for errors

### Cron Job Issues

**Problem:** Reminders not sending
- Verify `@nestjs/schedule` is imported in `AppModule`
- Check cron jobs are registered (check logs)
- Verify database queries are working
- Check notification service is initialized

**Problem:** Reminders sent to wrong users
- Verify reminder logic (only non-voters get voting reminders)
- Check user membership status
- Verify push tokens are valid

### Admin Endpoint Issues

**Problem:** 401 Unauthorized
- Verify token is valid
- Check token hasn't expired
- Verify user has platform admin role

**Problem:** 403 Forbidden
- User may not have platform admin role
- Check role in database: `users.role = 'platform_admin'` or `users.is_admin = TRUE`

**Problem:** Analytics returning empty data
- Check date range (may be too restrictive)
- Verify disputes exist in database
- Check database queries are correct

## Manual Testing Checklist

- [ ] File upload works (local storage)
- [ ] File upload works (S3 - if configured)
- [ ] Email notifications sent for dispute filed
- [ ] Email notifications sent for evidence added
- [ ] Push notifications sent for comments
- [ ] Email notifications sent for voting started
- [ ] Email notifications sent for dispute resolved
- [ ] Voting deadline reminders sent
- [ ] Discussion deadline reminders sent
- [ ] Overdue disputes detected
- [ ] Admin can view escalated disputes
- [ ] Admin can review escalated disputes
- [ ] Analytics endpoint returns data
- [ ] Analytics metrics are accurate
- [ ] Date range filtering works

## Next Steps

After testing:
1. Review test results
2. Fix any issues found
3. Update documentation
4. Deploy to staging environment
5. Perform integration testing
6. Deploy to production

