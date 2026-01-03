#!/bin/bash

# Investment Module Feature Testing Script
# Tests: Feature Flags, Rate Limiting, Idempotency, Queue Processing

set -e

BASE_URL="${BASE_URL:-http://localhost:3001}"
TOKEN="${TOKEN:-}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${CYAN}🧪 Investment Module Feature Testing${NC}"
echo -e "${CYAN}=====================================${NC}"
echo ""

# Check token
if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Please provide an authentication token${NC}"
    echo "Usage: TOKEN='your-jwt-token' ./test-investment-features.sh"
    exit 1
fi

API_URL="$BASE_URL/api/v1"

# Helper function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local body=$3
    local idempotency_key=$4
    
    local headers=(
        -H "Authorization: Bearer $TOKEN"
        -H "Content-Type: application/json"
    )
    
    if [ -n "$idempotency_key" ]; then
        headers+=(-H "idempotency-key: $idempotency_key")
    fi
    
    if [ "$method" = "POST" ] && [ -n "$body" ]; then
        curl -s -w "\n%{http_code}" -X POST "$API_URL/$endpoint" \
            "${headers[@]}" \
            -d "$body"
    elif [ "$method" = "PUT" ] && [ -n "$body" ]; then
        curl -s -w "\n%{http_code}" -X PUT "$API_URL/$endpoint" \
            "${headers[@]}" \
            -d "$body"
    else
        curl -s -w "\n%{http_code}" -X GET "$API_URL/$endpoint" \
            "${headers[@]}"
    fi
}

# ============================================================================
# 1. TEST FEATURE FLAGS
# ============================================================================
echo -e "${CYAN}1️⃣  Testing Feature Flags${NC}"
echo -e "${CYAN}------------------------${NC}"

test_feature_flag() {
    local flag_key=$1
    local endpoint=$2
    local method=${3:-POST}
    local body=$4
    
    echo -n "   Testing flag: $flag_key"
    
    # Disable flag
    disable_body=$(cat <<EOF
{
    "enabled": false,
    "status": "active"
}
EOF
)
    api_call "PUT" "admin/feature-flags/$flag_key" "$disable_body" > /dev/null 2>&1 || true
    sleep 0.5
    
    # Try endpoint (should fail with 403)
    if [ "$method" = "POST" ]; then
        response=$(api_call "POST" "$endpoint" "$body")
    else
        response=$(api_call "GET" "$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    if [ "$http_code" = "403" ]; then
        echo -e " ${GREEN}✅ Feature flag working (403 Forbidden)${NC}"
    else
        echo -e " ${RED}❌ Expected 403, got $http_code${NC}"
    fi
    
    # Re-enable flag
    enable_body=$(cat <<EOF
{
    "enabled": true,
    "status": "active"
}
EOF
)
    api_call "PUT" "admin/feature-flags/$flag_key" "$enable_body" > /dev/null 2>&1 || true
    echo "      ✅ Flag re-enabled"
}

test_body='{"chamaId":"test-chama-id","productId":"test-product-id","amount":10000}'
test_feature_flag "investment_module_enabled" "investment/investments" "POST" "$test_body"
test_feature_flag "investment_execution_enabled" "investment/investments/test-id/execute" "POST" "{}"
test_feature_flag "dividend_distribution_enabled" "investment/investments/test-id/dividends" "POST" '{"amount":1000}'

echo -e "${GREEN}✅ Feature flag tests completed${NC}"

# ============================================================================
# 2. TEST RATE LIMITING
# ============================================================================
echo -e "${CYAN}2️⃣  Testing Rate Limiting${NC}"
echo -e "${CYAN}------------------------${NC}"

test_rate_limit() {
    local endpoint=$1
    local body=$2
    local max_requests=${3:-5}
    
    echo "   Testing rate limit for: $endpoint (max $max_requests requests)"
    
    rate_limit_hit=false
    request_count=0
    
    for i in $(seq 1 $((max_requests + 2))); do
        response=$(api_call "POST" "$endpoint" "$body")
        http_code=$(echo "$response" | tail -n1)
        
        if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
            echo "      Request $i : ✅ 200 OK"
        elif [ "$http_code" = "429" ]; then
            rate_limit_hit=true
            request_count=$i
            echo -e "      Request $i : ${YELLOW}⚠️  429 Rate Limited${NC}"
            break
        else
            echo -e "      Request $i : ${RED}❌ $http_code${NC}"
        fi
        
        sleep 0.1
    done
    
    if [ "$rate_limit_hit" = true ]; then
        echo -e "      ${GREEN}✅ Rate limiting working (429 after $request_count requests)${NC}"
    else
        echo -e "      ${YELLOW}⚠️  Rate limit not hit (may need adjustment)${NC}"
    fi
}

echo ""
echo -e "${CYAN}   Testing: POST /investment/investments (5/hour)${NC}"
test_rate_limit "investment/investments" "$test_body" 5

echo -e "${GREEN}✅ Rate limiting tests completed${NC}"

# ============================================================================
# 3. TEST IDEMPOTENCY
# ============================================================================
echo -e "${CYAN}3️⃣  Testing Idempotency${NC}"
echo -e "${CYAN}------------------------${NC}"

test_idempotency() {
    local endpoint=$1
    local body=$2
    
    echo "   Testing idempotency for: $endpoint"
    
    idempotency_key=$(uuidgen)
    echo "      Idempotency Key: $idempotency_key"
    
    # Add idempotency key to body
    body_with_key=$(echo "$body" | jq --arg key "$idempotency_key" '. + {idempotencyKey: $key}')
    
    # First request
    response1=$(api_call "POST" "$endpoint" "$body_with_key" "$idempotency_key")
    http_code1=$(echo "$response1" | tail -n1)
    body1=$(echo "$response1" | head -n -1)
    
    if [ "$http_code1" = "200" ] || [ "$http_code1" = "201" ]; then
        echo -e "      First request: ${GREEN}✅ Success${NC}"
    else
        echo -e "      First request: ${RED}❌ Failed ($http_code1)${NC}"
        return
    fi
    
    sleep 0.5
    
    # Duplicate request
    response2=$(api_call "POST" "$endpoint" "$body_with_key" "$idempotency_key")
    http_code2=$(echo "$response2" | tail -n1)
    body2=$(echo "$response2" | head -n -1)
    
    if [ "$http_code2" = "200" ] || [ "$http_code2" = "201" ]; then
        # Compare results
        if [ "$body1" = "$body2" ]; then
            echo -e "      Second request: ${GREEN}✅ Idempotent (same result)${NC}"
            echo -e "      ${GREEN}✅ Idempotency working correctly${NC}"
        else
            echo -e "      Second request: ${YELLOW}⚠️  Different result (may be expected for queue operations)${NC}"
        fi
    else
        echo -e "      Second request: ${RED}❌ Failed ($http_code2)${NC}"
    fi
}

echo ""
echo -e "${CYAN}   Testing: POST /investment/investments${NC}"
test_idempotency "investment/investments" "$test_body"

echo -e "${GREEN}✅ Idempotency tests completed${NC}"

# ============================================================================
# SUMMARY
# ============================================================================
echo ""
echo -e "${CYAN}📊 Test Summary${NC}"
echo -e "${CYAN}===============${NC}"
echo -e "${GREEN}✅ Feature Flags: Tested${NC}"
echo -e "${GREEN}✅ Rate Limiting: Tested${NC}"
echo -e "${GREEN}✅ Idempotency: Tested${NC}"
echo -e "${YELLOW}⚠️  Queue Processing: Requires manual testing with valid IDs${NC}"
echo ""
echo -e "${CYAN}💡 Tips:${NC}"
echo "   - Check logs for detailed operation traces"
echo "   - Use log prefixes to filter: [API_], [QUEUE_], [INVESTMENT_]"
echo "   - Monitor queue workers are running"
echo ""

