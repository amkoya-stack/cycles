# Phase 2 Testing Guide

## Quick Verification

### 1. Verify Server Starts

Start your backend server:

```bash
cd backend
npm run start:dev
```

**Expected**: Server should start without errors. If you see:
```
TOKENIZATION_SECRET_KEY must be at least 32 characters long
```
→ Check your `.env` file - the key might be missing or too short.

---

## 2. Test Tokenization (New User Registration)

### Step 1: Register a New User

```bash
POST http://localhost:3001/api/v1/auth/register
Content-Type: application/json

{
  "email": "test-tokenization@example.com",
  "phone": "254712345678",
  "password": "Test123456",
  "firstName": "Test",
  "lastName": "User"
}
```

**Expected Response:**
```json
{
  "userId": "uuid-here"
}
```

### Step 2: Check Database

Query the `users` table:

```sql
SELECT id, email, phone, full_name FROM users 
WHERE email LIKE '%test-tokenization%' OR phone LIKE '%254712345678%';
```

**Expected**: 
- `email` and `phone` should be **encrypted tokens** (long base64 strings)
- They should **NOT** contain the original values
- Example: `email` might look like `ywYuio08ZCqkQ2N72G5eCGZCc7/JXZN5cUOLR7c0O6w=...`

### Step 3: Get User Profile (Verify Detokenization)

First, login to get a token:

```bash
POST http://localhost:3001/api/v1/auth/login
Content-Type: application/json

{
  "email": "test-tokenization@example.com",
  "password": "Test123456"
}
```

Then get profile:

```bash
GET http://localhost:3001/api/v1/auth/me
Authorization: Bearer <access-token-from-login>
```

**Expected Response:**
```json
{
  "id": "uuid",
  "email": "test-tokenization@example.com",  // ✅ Detokenized!
  "phone": "254712345678",                    // ✅ Detokenized!
  "full_name": "Test User",
  ...
}
```

**✅ Success**: If you see the original email/phone values, tokenization is working!

---

## 3. Test API Versioning

### Test Old Route (Should Fail)

```bash
GET http://localhost:3001/api/auth/me
Authorization: Bearer <token>
```

**Expected**: `404 Not Found` (old routes no longer work)

### Test New Versioned Route (Should Work)

```bash
GET http://localhost:3001/api/v1/auth/me
Authorization: Bearer <token>
```

**Expected**: `200 OK` with user profile

---

## 4. Test Login with Tokenized Data

The login should work even though email/phone are tokenized in the database:

```bash
POST http://localhost:3001/api/v1/auth/login
Content-Type: application/json

{
  "email": "test-tokenization@example.com",
  "password": "Test123456"
}
```

**Expected**: Should return access token (login tokenizes the input to match DB)

---

## 5. Test ID Number Tokenization

Update profile with ID number:

```bash
POST http://localhost:3001/api/v1/auth/kyc/basic
Authorization: Bearer <token>
Content-Type: application/json

{
  "idNumber": "12345678",
  "fullName": "Test User",
  "dob": "1990-01-01"
}
```

Check database:

```sql
SELECT id_number FROM users WHERE id = '<user-id>';
```

**Expected**: `id_number` should be an encrypted token, not `12345678`

Get profile again - should see detokenized value:

```bash
GET http://localhost:3001/api/v1/users/<user-id>
Authorization: Bearer <token>
```

**Expected**: Response should show `"id_number": "12345678"` (detokenized)

---

## Troubleshooting

### Issue: "TOKENIZATION_SECRET_KEY must be at least 32 characters long"

**Solution:**
1. Check `.env` file exists in `backend/` directory
2. Verify the key is on one line: `TOKENIZATION_SECRET_KEY=your-key-here`
3. Make sure there are no quotes around the key
4. Restart the server after adding the key

### Issue: Login fails with "Invalid credentials"

**Possible Causes:**
1. User was created before tokenization was enabled (old plain text data)
2. Tokenization key changed (can't decrypt old tokens)

**Solution:**
- Register a NEW user to test (new users will be tokenized)
- Or re-register the same user (will update with tokenized data)

### Issue: API returns 404 on `/api/v1/...` routes

**Solution:**
- Make sure you restarted the server after Phase 2 changes
- Check that `main.ts` has versioning enabled
- Verify controller has `version: '1'` in `@Controller` decorator

### Issue: Data appears plain text in database

**Possible Causes:**
1. User was created before tokenization was implemented
2. Tokenization service not being called

**Solution:**
- Create a NEW user to verify tokenization works
- Check server logs for tokenization errors
- Verify `TokenizationService` is injected in `AuthService` and `UsersService`

---

## Success Criteria

✅ **Tokenization Working:**
- New user registrations store encrypted email/phone in database
- API responses return detokenized (original) values
- Login works with plain text input (service tokenizes to match DB)

✅ **API Versioning Working:**
- Old routes (`/api/auth/*`) return 404
- New routes (`/api/v1/auth/*`) work correctly
- All controllers use version `1`

---

## Next Steps

Once verified:
1. Update frontend to use `/v1/` prefix in all API calls
2. Consider creating migration script to tokenize existing user data
3. Plan for key rotation strategy (if needed)

