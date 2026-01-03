# 🚀 Start Here: Dispute Resolution Testing

This guide will walk you through testing all dispute resolution enhancements step by step.

## Prerequisites

✅ Backend server running (`npm run start:dev`)  
✅ Database connected and migrations run  
✅ Redis running (for notifications)  

## Step-by-Step Testing

### Step 1: Get Your Test Token (2 minutes)

```bash
cd backend
npm run get:test-token
```

**What to do:**
1. Enter your email and password when prompted
2. Copy the JWT token shown
3. Add to `.env` file: `TEST_TOKEN=your-token-here`
4. Note your chama ID and add: `TEST_CHAMA_ID=your-chama-id-here`

**Expected output:**
```
✅ Login successful!
📋 Your JWT Token: eyJhbGc...
👤 User Info:
   Name: Your Name
   Email: your@email.com
🏛️  Your Chamas:
   1. Chama Name (ID: chama-id-here)
```

---

### Step 2: Configure Environment (5 minutes)

```bash
npm run configure:dispute
```

**What to do:**
1. Answer prompts for file upload (choose local storage for testing)
2. Optionally configure email (for notification testing)
3. Optionally configure push notifications
4. Set frontend URL

**Or manually edit `.env`:**
```env
# File Upload (Local - Recommended for testing)
USE_S3_UPLOAD=false
UPLOAD_DIR=./uploads
UPLOAD_BASE_URL=http://localhost:4000/uploads

# Email (Optional - for notification testing)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@cycle.app

# Push (Optional)
VAPID_PUBLIC_KEY=your-key
VAPID_PRIVATE_KEY=your-key
VAPID_SUBJECT=mailto:admin@cycle.app

# Testing
TEST_TOKEN=your-token-from-step-1
TEST_CHAMA_ID=your-chama-id-from-step-1
API_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000
```

**Restart backend** after configuring:
```bash
# Stop current server (Ctrl+C)
npm run start:dev
```

---

### Step 3: Test File Uploads (3 minutes)

```bash
npm run test:dispute-uploads
```

**What it does:**
- Creates a test dispute
- Uploads an evidence file
- Verifies file is stored
- Checks database

**Expected output:**
```
✅ Dispute created: {id}
✅ File uploaded successfully!
   Evidence ID: {id}
   File URL: http://localhost:4000/uploads/disputes/{id}/evidence/{file}
✅ Found 1 evidence file(s)
✅ Local storage directory exists
```

**Verify manually:**
1. Check `backend/uploads/disputes/{disputeId}/evidence/` folder
2. Verify file exists
3. Check database: `SELECT * FROM dispute_evidence WHERE dispute_id = '{id}'`

---

### Step 4: Test Notifications (5 minutes)

**Prerequisites:** Email configured in Step 2

```bash
npm run test:dispute-notifications
```

**What it does:**
- Files a dispute → Sends email to all members
- Adds evidence → Sends email to participants
- Adds comment → Sends push notification
- Starts voting → Sends email to all members
- Resolves dispute → Sends email to participants

**Check:**
- ✅ Email inboxes of chama members
- ✅ Push notifications (if devices subscribed)
- ✅ Backend logs for notification attempts

**Expected output:**
```
✅ Dispute created: {id}
   → Check email inboxes of chama members
✅ Evidence added: {id}
   → Check email inboxes of dispute participants
✅ Comment added: {id}
   → Check push notifications on devices
✅ Voting started
   → Check email inboxes of all chama members
✅ Dispute resolved
   → Check email inboxes of dispute participants
```

**If emails not received:**
- Check spam folder
- Verify SMTP credentials
- Check backend logs for errors

---

### Step 5: Verify Cron Jobs (2 minutes)

```bash
npm run verify:cron-jobs
```

**What it does:**
- Verifies DisputeReminderService is registered
- Manually triggers all cron jobs
- Confirms they execute

**Expected output:**
```
✅ DisputeReminderService is registered and available
📋 Registered Cron Jobs:
   1. checkVotingDeadlines() - Runs every hour
   2. checkDiscussionDeadlines() - Runs every hour
   3. checkOverdueDisputes() - Runs daily at 9 AM
✅ Voting deadline check completed
✅ Discussion deadline check completed
✅ Overdue dispute check completed
```

**Verify in production:**
- Check backend logs every hour for:
  - `[DisputeReminderService] Checked X disputes with upcoming voting deadlines`
  - `[DisputeReminderService] Checked X disputes with upcoming discussion deadlines`

---

### Step 6: Check Reminders Status (2 minutes)

```bash
npm run check:dispute-reminders
```

**What it does:**
- Lists disputes with upcoming deadlines
- Lists overdue disputes
- Shows reminder status

**Expected output:**
```
🗳️  Checking voting deadlines...
   Found X dispute(s) with upcoming voting deadlines
💬 Checking discussion deadlines...
   Found X dispute(s) with upcoming discussion deadlines
⏰ Checking overdue disputes...
   Found X overdue voting dispute(s)
   Found X overdue discussion dispute(s)
```

**To test reminders:**
1. Create a dispute with voting deadline in 1 hour
2. Wait for next cron execution (or manually trigger)
3. Check email/push for reminders

---

### Step 7: Test Admin Endpoints (3 minutes)

**Prerequisites:** Platform admin token

```bash
# First, get admin token (if you're a platform admin)
npm run get:test-token
# Add to .env as ADMIN_TOKEN=...

# Then test admin endpoints
npm run test:dispute-admin
```

**What it does:**
- Fetches escalated disputes
- Gets analytics data
- Reviews escalated disputes

**Expected output:**
```
✅ Found X escalated dispute(s)
✅ Analytics retrieved:
   Total Disputes: X
   Resolution Rate: X.XX%
   Escalation Rate: X.XX%
   Avg Resolution Time: X.XX days
   By Type: ...
   By Status: ...
   Trends: ...
```

**If 401/403 errors:**
- Verify token is valid
- Check user has platform admin role in database
- Use `ADMIN_TOKEN` in `.env`

---

### Step 8: Review Analytics (2 minutes)

**Manual test:**
```bash
curl -X GET "http://localhost:4000/api/v1/admin/disputes/analytics?startDate=2025-01-01&endDate=2025-12-31" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Or use the admin test script:**
```bash
npm run test:dispute-admin
```

**Check analytics include:**
- ✅ Total disputes count
- ✅ By type, status, priority
- ✅ Resolution rate
- ✅ Average resolution time
- ✅ Escalation rate
- ✅ Trends (last 30 days)

---

## 🎯 Complete Testing Checklist

### File Uploads
- [ ] Test script runs successfully
- [ ] Files saved to local storage
- [ ] File URLs in database
- [ ] Files accessible via URL
- [ ] Multiple file types work (images, PDFs)

### Notifications
- [ ] Email sent when dispute filed
- [ ] Email sent when evidence added
- [ ] Push notification sent when comment added
- [ ] Email sent when voting starts
- [ ] Email sent when dispute resolved
- [ ] All notification content is accurate

### Reminders
- [ ] Cron jobs registered
- [ ] Voting deadline reminders sent
- [ ] Discussion deadline reminders sent
- [ ] Overdue dispute notifications sent
- [ ] Reminders only to non-actors

### Admin Panel
- [ ] Escalated disputes retrieved
- [ ] Analytics data returned
- [ ] Dispute review works
- [ ] Platform decisions recorded

### Analytics
- [ ] All metrics calculated
- [ ] Date range filtering works
- [ ] Trends data accurate
- [ ] Percentages correct

---

## 🐛 Troubleshooting

### "TEST_TOKEN not set"
→ Run `npm run get:test-token` and add to `.env`

### "File upload failed"
→ Check `UPLOAD_DIR` exists and is writable  
→ Verify file size < 10MB  
→ Check file type is allowed

### "Email not sending"
→ Verify SMTP credentials  
→ Check spam folder  
→ Test SMTP connection separately

### "Cron jobs not running"
→ Verify `ScheduleModule` imported in `AppModule`  
→ Check `DisputeReminderService` in providers  
→ Restart backend server

### "401 Unauthorized" on admin
→ Verify token is valid  
→ Check user has platform admin role  
→ Use `ADMIN_TOKEN` instead of `TEST_TOKEN`

---

## 📊 Test Results Template

After completing all tests, document your results:

```
Date: __________
Tester: __________

File Uploads: ✅ / ❌
- Local storage: ✅ / ❌
- Database records: ✅ / ❌
- File accessibility: ✅ / ❌

Notifications: ✅ / ❌
- Dispute filed: ✅ / ❌
- Evidence added: ✅ / ❌
- Comment added: ✅ / ❌
- Voting started: ✅ / ❌
- Dispute resolved: ✅ / ❌

Reminders: ✅ / ❌
- Cron jobs registered: ✅ / ❌
- Voting reminders: ✅ / ❌
- Discussion reminders: ✅ / ❌
- Overdue notifications: ✅ / ❌

Admin Panel: ✅ / ❌
- Escalated disputes: ✅ / ❌
- Analytics: ✅ / ❌
- Dispute review: ✅ / ❌

Analytics: ✅ / ❌
- All metrics: ✅ / ❌
- Date filtering: ✅ / ❌
- Trends: ✅ / ❌

Issues Found:
1. __________
2. __________

Notes:
__________
```

---

## ✅ Success Criteria

All tests pass when:
- ✅ File uploads work (local or S3)
- ✅ All notification types send successfully
- ✅ Cron jobs execute on schedule
- ✅ Reminders sent to correct users
- ✅ Admin endpoints accessible
- ✅ Analytics data accurate

---

## 📚 Additional Resources

- **Full Testing Guide:** `DISPUTE_TESTING_GUIDE.md`
- **Quick Start:** `QUICK_START_DISPUTE_TESTING.md`
- **Enhancements Summary:** `DISPUTE_ENHANCEMENTS_SUMMARY.md`
- **Testing Summary:** `DISPUTE_TESTING_SUMMARY.md`

---

## 🎉 Next Steps

After successful testing:
1. Review and fix any issues
2. Update documentation
3. Deploy to staging
4. Perform integration testing
5. Deploy to production

