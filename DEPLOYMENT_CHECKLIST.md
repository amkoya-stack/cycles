# Deployment Checklist

Use this checklist to ensure a smooth deployment process.

## Pre-Deployment

### Code Preparation

- [ ] All code committed to Git
- [ ] `.env` files are in `.gitignore`
- [ ] No hardcoded secrets in code
- [ ] All dependencies in `package.json`
- [ ] Build succeeds locally (`npm run build` in both frontend and backend)

### Database Setup

- [ ] Neon PostgreSQL account created
- [ ] Database created in Neon
- [ ] Connection string copied
- [ ] Database migrations ready (`backend/src/migrations/`)

### Accounts Setup

- [ ] GitHub account ready
- [ ] Render account created
- [ ] Netlify account created
- [ ] Domain name purchased (optional)

---

## Backend Deployment (Render)

### Initial Setup

- [ ] Code pushed to GitHub
- [ ] Render connected to GitHub repository
- [ ] Blueprint deployed from `render.yaml`
- [ ] Backend service created
- [ ] Redis service created

### Environment Variables

- [ ] `DATABASE_URL` set (from Neon)
- [ ] `JWT_SECRET` generated
- [ ] `JWT_REFRESH_SECRET` generated
- [ ] `REDIS_HOST` set (from Render Redis)
- [ ] `REDIS_PORT` set (6379)
- [ ] `REDIS_PASSWORD` set (from Render Redis)
- [ ] `EMAIL_HOST` set
- [ ] `EMAIL_PORT` set (587)
- [ ] `EMAIL_USER` set
- [ ] `EMAIL_PASSWORD` set
- [ ] `EMAIL_FROM` set
- [ ] `MPESA_CONSUMER_KEY` set (if using M-Pesa)
- [ ] `MPESA_CONSUMER_SECRET` set (if using M-Pesa)
- [ ] `MPESA_PASSKEY` set (if using M-Pesa)
- [ ] `MPESA_SHORTCODE` set (if using M-Pesa)
- [ ] `MPESA_CALLBACK_URL` set (if using M-Pesa)
- [ ] `LIVEKIT_API_KEY` set (if using LiveKit)
- [ ] `LIVEKIT_API_SECRET` set (if using LiveKit)
- [ ] `LIVEKIT_WS_URL` set (if using LiveKit)
- [ ] `VAPID_PUBLIC_KEY` set (if using push notifications)
- [ ] `VAPID_PRIVATE_KEY` set (if using push notifications)
- [ ] `VAPID_SUBJECT` set (if using push notifications)

### Database Migrations

- [ ] Connected to Render shell
- [ ] Ran `cd backend && npm run migrate:up`
- [ ] Ran `npm run seed:system-accounts`
- [ ] Verified tables created in Neon dashboard

### Verification

- [ ] Backend deployed successfully
- [ ] Health endpoint responds: `https://your-backend.onrender.com/health`
- [ ] No errors in Render logs
- [ ] Database connection successful

---

## Frontend Deployment (Netlify)

### Initial Setup

- [ ] Netlify connected to GitHub repository
- [ ] Site created from repository
- [ ] `netlify.toml` detected
- [ ] Initial build completed

### Environment Variables

- [ ] `NEXT_PUBLIC_API_URL` set (your Render backend URL + `/api/v1`)
- [ ] `NEXT_PUBLIC_WS_URL` set (your Render backend URL)
- [ ] `NEXT_PUBLIC_LIVEKIT_URL` set (if using LiveKit)

### Build Configuration

- [ ] Build command: `npm run build`
- [ ] Publish directory: `frontend/.next`
- [ ] Base directory: `frontend`
- [ ] Node version: 18 or higher

### Deployment

- [ ] Cleared cache and redeployed
- [ ] Build succeeded
- [ ] No build errors in logs
- [ ] Site is live

### Verification

- [ ] Frontend loads: `https://your-site.netlify.app`
- [ ] Can navigate between pages
- [ ] API calls work (check browser console)
- [ ] No CORS errors
- [ ] Authentication works

---

## Post-Deployment Configuration

### Backend Updates

- [ ] Updated CORS origins in `backend/src/main.ts` to include Netlify URL
- [ ] Redeployed backend after CORS update
- [ ] Updated M-Pesa callback URL in Safaricom portal (if applicable)

### Testing

- [ ] User registration works
- [ ] User login works
- [ ] JWT tokens are issued correctly
- [ ] Protected routes require authentication
- [ ] Database operations work
- [ ] File uploads work (if applicable)
- [ ] Email sending works
- [ ] WebSocket connections work (if applicable)
- [ ] M-Pesa payments work (if applicable)

### Monitoring

- [ ] Set up UptimeRobot to keep Render service active
- [ ] Configured Neon database backups
- [ ] Bookmarked Render logs URL
- [ ] Bookmarked Netlify deploy logs URL
- [ ] Set up error monitoring (optional: Sentry)

---

## Optional Enhancements

### Custom Domain

- [ ] Domain purchased
- [ ] DNS configured for Netlify
- [ ] DNS configured for Render
- [ ] SSL certificates issued
- [ ] Redirects configured (www to non-www or vice versa)

### Performance

- [ ] Enabled Netlify CDN
- [ ] Configured caching headers
- [ ] Optimized images
- [ ] Enabled compression

### Security

- [ ] Rate limiting enabled
- [ ] Input validation in place
- [ ] SQL injection protection verified
- [ ] XSS protection enabled
- [ ] Security headers configured
- [ ] Regular dependency updates scheduled

---

## Troubleshooting Completed

If you encountered issues, mark what you fixed:

- [ ] Fixed database connection issues
- [ ] Resolved CORS errors
- [ ] Fixed environment variable issues
- [ ] Resolved build failures
- [ ] Fixed API endpoint issues
- [ ] Resolved authentication problems
- [ ] Fixed WebSocket connection issues

---

## Final Verification

- [ ] All features tested in production
- [ ] No console errors in browser
- [ ] No errors in backend logs
- [ ] Database queries performing well
- [ ] Email notifications working
- [ ] Mobile responsiveness verified
- [ ] Different browsers tested
- [ ] Performance acceptable

---

## Documentation

- [ ] Updated README with production URLs
- [ ] Documented environment variables
- [ ] Created runbook for common issues
- [ ] Shared credentials securely with team
- [ ] Documented deployment process

---

## Launch! 🚀

- [ ] Announced to team
- [ ] Shared production URL
- [ ] Monitoring in place
- [ ] Support plan ready

---

**Deployment Date:** ******\_\_\_******

**Deployed By:** ******\_\_\_******

**Production URLs:**

- Frontend: ******\_\_\_******
- Backend: ******\_\_\_******

**Notes:**

---

---

---
