# Quick Start: Dispute Resolution Testing

This is a quick reference guide for testing the dispute resolution enhancements.

## 🚀 Quick Setup

### 1. Configure Environment

Run the interactive configuration script:

```bash
cd backend
npm run configure:dispute
```

This will guide you through setting up:
- File upload (local or S3)
- Email notifications
- Push notifications
- Frontend URL

### 2. Get Test Credentials

You'll need:
- **JWT Token**: Login via API or frontend to get a token
- **Chama ID**: Get from your chama list or database

Set in `.env`:
```env
TEST_TOKEN=your-jwt-token-here
TEST_CHAMA_ID=your-chama-id-here
ADMIN_TOKEN=your-platform-admin-token-here
```

## 🧪 Run Tests

### Test File Uploads
```bash
npm run test:dispute-uploads
```

**What it does:**
- Creates a test dispute
- Uploads an evidence file
- Verifies file is stored
- Checks file URL in database

### Test Notifications
```bash
npm run test:dispute-notifications
```

**What it does:**
- Files a dispute (triggers "dispute filed" notification)
- Adds evidence (triggers "evidence added" notification)
- Adds comment (triggers "comment added" notification)
- Starts voting (triggers "voting started" notification)
- Resolves dispute (triggers "dispute resolved" notification)

**Check:**
- Email inboxes of chama members
- Push notifications on devices

### Test Admin Endpoints
```bash
npm run test:dispute-admin
```

**What it does:**
- Fetches escalated disputes
- Retrieves analytics data
- Reviews an escalated dispute (if any exist)

### Check Reminders
```bash
npm run check:dispute-reminders
```

**What it does:**
- Lists disputes with upcoming voting deadlines
- Lists disputes with upcoming discussion deadlines
- Lists overdue disputes

### Verify Cron Jobs
```bash
npm run verify:cron-jobs
```

**What it does:**
- Verifies DisputeReminderService is registered
- Manually triggers all cron jobs
- Confirms they execute successfully

## 📋 Manual Testing Checklist

### File Upload
- [ ] Upload works with local storage
- [ ] File appears in `backend/uploads/disputes/{id}/evidence/`
- [ ] File URL stored in database
- [ ] File accessible via URL

### Notifications
- [ ] Email sent when dispute filed
- [ ] Email sent when evidence added
- [ ] Push notification sent when comment added
- [ ] Email sent when voting starts
- [ ] Email sent when dispute resolved

### Reminders
- [ ] Voting deadline reminder sent (1 hour before)
- [ ] Discussion deadline reminder sent (1 hour before)
- [ ] Overdue dispute notification sent to admins

### Admin Panel
- [ ] Can view escalated disputes
- [ ] Can review escalated disputes
- [ ] Analytics endpoint returns data
- [ ] All metrics are accurate

## 🔍 Verify Configuration

### Email Setup
Check backend logs on startup:
```
[NotificationService] Email transporter initialized
```

### Push Notifications
Check backend logs:
```
[NotificationService] VAPID keys configured
```

### Cron Jobs
Check backend logs every hour:
```
[DisputeReminderService] Checked X disputes with upcoming voting deadlines
[DisputeReminderService] Checked X disputes with upcoming discussion deadlines
```

## 🐛 Troubleshooting

### Files Not Uploading
- Check `UPLOAD_DIR` exists and is writable
- Verify file size < 10MB
- Check file type is allowed

### Emails Not Sending
- Verify SMTP credentials
- Check spam folder
- Test SMTP connection separately

### Push Notifications Not Working
- Verify VAPID keys are correct
- Check devices have push subscriptions
- Verify service worker is registered

### Cron Jobs Not Running
- Verify `ScheduleModule` is imported in `AppModule`
- Check `DisputeReminderService` is in `DisputeModule` providers
- Restart backend server

## 📚 Full Documentation

See `DISPUTE_TESTING_GUIDE.md` for detailed testing instructions.

