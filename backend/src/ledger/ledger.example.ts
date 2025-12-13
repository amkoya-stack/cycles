// EXAMPLE USAGE / TESTING
// backend/src/ledger/ledger.example.ts
// ==========================================

/**
 * Example usage of the ledger system
 */

// 1. Create user wallet
// POST /api/ledger/wallets
// Body: {
//   "ownerId": "user-uuid-123",
//   "ownerType": "user",
//   "ownerName": "John Doe"
// }

// 2. Deposit money
// POST /api/ledger/transactions/deposit
// Body: {
//   "userId": "user-uuid-123",
//   "amount": 1000,
//   "externalReference": "MPESA-ABC123",
//   "description": "Deposit via M-Pesa"
// }
// Result:
// DR: Cash (Platform) +1000
// CR: User Wallet (John) +1000

// 3. Contribute to chama (with 4.5% fee paid by user)
// POST /api/ledger/transactions/contribution
// Body: {
//   "userId": "user-uuid-123",
//   "chamaId": "chama-uuid-456",
//   "amount": 100,
//   "description": "Monthly contribution"
// }
// Result:
// DR: User Wallet (John) -104.50 (100 + 4.50 fee)
// CR: Chama Wallet +100.00 (full amount)
// CR: Revenue (Platform) +4.50 (fee)

// 4. Transfer between users
// POST /api/ledger/transactions/transfer
// Body: {
//   "senderUserId": "user-uuid-123",
//   "receiverUserId": "user-uuid-789",
//   "amount": 50,
//   "description": "Lunch money"
// }
// Result:
// DR: User Wallet (John) -50
// CR: User Wallet (Jane) +50

// 5. Withdraw money
// POST /api/ledger/transactions/withdrawal
// Body: {
//   "userId": "user-uuid-123",
//   "amount": 200,
//   "destinationAccount": "254712345678",
//   "description": "Withdrawal to M-Pesa"
// }
// Result:
// DR: User Wallet (John) -200
// CR: Cash (Platform) -200

// 6. Check balance
// GET /api/ledger/accounts/user/user-uuid-123

// 7. Get account statement
// GET /api/ledger/accounts/{accountId}/statement?startDate=2024-01-01&endDate=2024-12-31

// 8. Check ledger balance (audit)
// GET /api/ledger/balance-check
// Should return:
// {
//   "total_debit_accounts": 10000.00,
//   "total_credit_accounts": 10000.00,
//   "difference": 0.00,
//   "is_balanced": true
// }
