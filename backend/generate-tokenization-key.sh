#!/bin/bash
# Generate TOKENIZATION_SECRET_KEY
# This script generates a secure random key for tokenization

echo ""
echo "=== Generating TOKENIZATION_SECRET_KEY ==="
echo ""

# Method 1: Using Node.js (Recommended)
echo "Method 1: Using Node.js"
NODE_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
echo "TOKENIZATION_SECRET_KEY=$NODE_KEY"
echo ""

# Method 2: Using OpenSSL
echo "Method 2: Using OpenSSL"
OPENSSL_KEY=$(openssl rand -base64 32)
echo "TOKENIZATION_SECRET_KEY=$OPENSSL_KEY"
echo ""

# Method 3: Using /dev/urandom (Linux/Mac)
echo "Method 3: Using /dev/urandom"
URANDOM_KEY=$(head -c 32 /dev/urandom | base64)
echo "TOKENIZATION_SECRET_KEY=$URANDOM_KEY"
echo ""

echo "=== Instructions ==="
echo "1. Copy one of the keys above"
echo "2. Add it to your .env file:"
echo "   TOKENIZATION_SECRET_KEY=<paste-key-here>"
echo "3. Make sure the key is at least 32 characters long"
echo "4. Keep this key SECRET - never commit it to git!"
echo ""

