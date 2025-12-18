# Chama Reputation System - Implementation Summary

## Overview

Successfully implemented a comprehensive **Chama Reputation System** that evaluates chama trustworthiness based on:

- Member retention rate
- Loan default rate
- Contribution consistency
- Activity level

This system is **separate from user reputation** and helps users identify well-managed, trustworthy chamas to join.

---

## What Was Built

### 1. Core Service: `ChamaReputationService`

**File**: `backend/src/chama/chama-reputation.service.ts`

**Key Features**:

- Calculates comprehensive reputation score (0-1000)
- Four weighted components:
  - **Retention Score** (30%): 0-300 points
  - **Loan Performance Score** (30%): 0-300 points
  - **Contribution Score** (25%): 0-250 points
  - **Activity Score** (15%): 0-150 points
- Age-based tier system (prevents gaming)
- Advanced search by reputation criteria

**Methods**:

```typescript
calculateChamaReputation(chamaId: string): Promise<ChamaReputation>
getTopRatedChamas(limit = 10): Promise<ChamaReputation[]>
searchByReputation(criteria): Promise<ChamaReputation[]>
```

### 2. API Endpoints

**File**: `backend/src/chama/chama.controller.ts`

**Added Routes**:

1. **Get Chama Reputation**

   ```http
   GET /api/chama/:id/reputation
   ```

   Returns full reputation breakdown with scores

2. **Get Leaderboard**

   ```http
   GET /api/chama/reputation/leaderboard?limit=10
   ```

   Returns top-rated chamas

3. **Search by Reputation**

   ```http
   GET /api/chama/reputation/search?minScore=500&minTier=silver&maxDefaultRate=5
   ```

   Advanced filtering by score, tier, defaults, retention

4. **Public Listings Enhanced**
   ```http
   GET /api/chama/public
   ```
   Now includes `reputation_tier` and `reputation_score` for each chama

### 3. Reputation Response Schema

```typescript
interface ChamaReputation {
  chamaId: string;
  chamaName: string;
  reputationScore: number; // 0-1000
  tier: "unrated" | "bronze" | "silver" | "gold" | "platinum" | "diamond";

  // Component scores
  retentionScore: number;
  loanPerformanceScore: number;
  contributionScore: number;
  activityScore: number;

  // Key metrics
  memberRetentionRate: number;
  loanDefaultRate: number;
  contributionConsistencyRate: number;
  averageTenureMonths: number;
  roiPercentage: number;
  healthScore: number;

  // Trust indicators
  totalMembers: number;
  ageMonths: number;
  totalContributionsValue: number;
  calculatedAt: Date;
}
```

---

## Reputation Tiers

| Tier         | Score Required   | Age Required | Characteristics              |
| ------------ | ---------------- | ------------ | ---------------------------- |
| **Unrated**  | <250 or <1 month | Any          | New/low-performing chamas    |
| **Bronze**   | 250-399          | 1+ months    | Basic operations established |
| **Silver**   | 400-549          | 3+ months    | Consistent performance       |
| **Gold**     | 550-699          | 6+ months    | Strong track record          |
| **Platinum** | 700-849          | 12+ months   | Excellent management         |
| **Diamond**  | 850-1000         | 18+ months   | Top-tier, proven longevity   |

**Age Caps**: Even with high scores, chamas are capped by age to prevent gaming.

---

## Scoring Breakdown

### Retention Score (0-300 points, 30% weight)

```
Base Score = (retention_rate / 100) * 200        // Up to 200
Tenure Bonus = min(50, avg_tenure_months * 5)    // Up to 50
Age Bonus = min(50, chama_age_months * 2)        // Up to 50
High Turnover Penalty = -50 if >10% left/month   // Penalty
```

**Example**: 90% retention, 8 months avg tenure, 12 months old

- Base: 180 points
- Tenure: 40 points
- Age: 24 points
- **Total**: 244/300

### Loan Performance Score (0-300 points, 30% weight)

```
Base Score = (1 - default_rate/100) * 250                // Up to 250
Track Record Bonus = min(50, completed_loans * 5)        // Up to 50
Default Penalty = -50 per default                        // Severe penalty
```

**Special**: No loans yet = 150 points (neutral)

**Example**: 2% default rate, 8 completed loans, 1 default

- Base: 245 points
- Track Record: 40 points
- Penalty: -50 points
- **Total**: 235/300

### Contribution Score (0-250 points, 25% weight)

```
Base Score = (consistency_rate / 100) * 200              // Up to 200
Activity Bonus = +30 (100+ contrib), +20 (50+), +10 (20+) // Up to 30
Late Penalty = -30 if >20% contributions late             // Penalty
```

**Example**: 85% on-time, 60 contributions, 15% late

- Base: 170 points
- Activity: 20 points
- No penalty (15% < 20%)
- **Total**: 190/250

### Activity Score (0-150 points, 15% weight)

```
Member Activity = (active/total) * 80                     // Up to 80
Loan Activity = min(40, active_loans * 5)                 // Up to 40
Frequency = +20 (>4/mo), +10 (>2/mo)                      // Up to 20
```

**Example**: 20/25 active, 3 active loans, 3 contrib/month

- Member Activity: 64 points
- Loan Activity: 15 points
- Frequency: 10 points
- **Total**: 89/150

---

## Integration

### Module Setup

**File**: `backend/src/chama/chama.module.ts`

```typescript
providers: [
  ChamaService,
  ChamaMetricsService,
  ChamaReputationService, // NEW
  ...
],
exports: [
  ChamaService,
  ChamaMetricsService,
  ChamaReputationService, // NEW
]
```

### Service Injection

**ChamaService** now injects `ChamaReputationService` to add reputation to public listings:

```typescript
constructor(
  private readonly db: DatabaseService,
  private readonly ledger: LedgerService,
  @Inject(forwardRef(() => ChamaReputationService))
  private readonly reputationService: ChamaReputationService,
) {}
```

---

## Use Cases

### 1. User Browsing Chamas

**Scenario**: User wants to join a trustworthy chama with low defaults

**API Call**:

```http
GET /api/chama/reputation/search?minScore=600&maxDefaultRate=3&minRetentionRate=85
```

**Result**: Only well-established, low-risk chamas returned

### 2. Leaderboard Display

**Scenario**: Platform wants to showcase top chamas

**API Call**:

```http
GET /api/chama/reputation/leaderboard?limit=10
```

**Frontend Display**:

```tsx
<div className="grid gap-4">
  {topChamas.map((chama, index) => (
    <Card key={chama.chamaId}>
      <Badge>#{index + 1}</Badge>
      <h3>{chama.chamaName}</h3>
      <Badge variant={getTierVariant(chama.tier)}>
        {chama.tier.toUpperCase()}
      </Badge>
      <div className="text-2xl font-bold">{chama.reputationScore}/1000</div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Retention" value={`${chama.memberRetentionRate}%`} />
        <Stat label="Defaults" value={`${chama.loanDefaultRate}%`} />
      </div>
    </Card>
  ))}
</div>
```

### 3. Chama Detail Page

**Scenario**: User views chama details, wants to see trustworthiness

**API Call**:

```http
GET /api/chama/:chamaId/reputation
```

**Frontend Display**:

```tsx
<Card>
  <CardHeader>
    <div className="flex items-center gap-4">
      <Badge variant={getTierVariant(reputation.tier)}>
        {reputation.tier.toUpperCase()}
      </Badge>
      <div>
        <h2 className="text-3xl font-bold">
          {reputation.reputationScore}/1000
        </h2>
        <p className="text-gray-600">Reputation Score</p>
      </div>
    </div>
  </CardHeader>

  <CardContent>
    <h3>Score Breakdown</h3>
    <div className="space-y-2">
      <ScoreBar label="Retention" score={reputation.retentionScore} max={300} />
      <ScoreBar
        label="Loan Performance"
        score={reputation.loanPerformanceScore}
        max={300}
      />
      <ScoreBar
        label="Contribution"
        score={reputation.contributionScore}
        max={250}
      />
      <ScoreBar label="Activity" score={reputation.activityScore} max={150} />
    </div>

    <h3 className="mt-4">Key Metrics</h3>
    <div className="grid grid-cols-2 gap-4">
      <Stat
        label="Member Retention"
        value={`${reputation.memberRetentionRate}%`}
      />
      <Stat label="Loan Defaults" value={`${reputation.loanDefaultRate}%`} />
      <Stat
        label="On-Time Contributions"
        value={`${reputation.contributionConsistencyRate}%`}
      />
      <Stat
        label="Average Tenure"
        value={`${reputation.averageTenureMonths} months`}
      />
    </div>
  </CardContent>
</Card>
```

---

## Fraud Prevention

### 1. Age-Based Tier Caps

**Problem**: New chamas could manipulate scores quickly to reach high tiers

**Solution**: Tier capped by age regardless of score

- 1 month old → Max Bronze
- 3 months old → Max Silver
- 6 months old → Max Gold
- 12 months old → Max Platinum
- 18 months old → Can reach Diamond

**Example**: 1-month-old chama with 900 score = still Bronze

### 2. Severe Penalties

**Loan Defaults**: -50 points per default

- Single default can drop tier from Platinum to Gold

**High Turnover**: -50 points if >10% members leave in a month

- Indicates instability/mismanagement

**Late Contributions**: -30 points if >20% late

- Prevents chamas from being too lenient

### 3. Neutral Scores for New Chamas

**No Loans Yet**: 150/300 points (neutral, not penalized)

- Doesn't punish savings-focused chamas

**No Contributions**: 0/250 points

- Fair starting point, must prove themselves

---

## Technical Details

### Data Source

All metrics come from **`chama_metrics`** table (Migration 015):

- `retention_rate`
- `loan_default_rate`
- `contribution_consistency_rate`
- `active_members`, `total_members`
- `completed_loans`, `defaulted_loans`
- `on_time_contributions`, `total_contributions`
- `average_tenure_months`
- `health_score`

**Calculated By**: PostgreSQL function `calculate_chama_metrics()`  
**Triggered**: Daily at 2 AM (scheduled job) + on-demand

### Performance

**Calculation**: On-demand when API is called

- No background job needed
- Uses latest metrics from `chama_metrics` table
- Lightweight (single DB query + calculations)

**Caching** (Future): Can add Redis caching with 5-minute TTL to reduce load

### Database Queries

**Get Latest Metrics**:

```sql
SELECT * FROM chama_metrics
WHERE chama_id = $1
ORDER BY period_end DESC
LIMIT 1
```

**Top-Rated Chamas**:

```sql
SELECT DISTINCT ON (chama_id) chama_id
FROM chama_metrics
WHERE health_score >= 50
ORDER BY chama_id, period_end DESC, health_score DESC
LIMIT $1
```

---

## Testing

### Manual API Testing

1. **Get Reputation for Specific Chama**

   ```bash
   curl http://localhost:3001/api/chama/{chamaId}/reputation
   ```

2. **Get Leaderboard**

   ```bash
   curl http://localhost:3001/api/chama/reputation/leaderboard?limit=5
   ```

3. **Search by Criteria**

   ```bash
   curl "http://localhost:3001/api/chama/reputation/search?minScore=500&maxDefaultRate=5"
   ```

4. **Public Listings (with reputation)**
   ```bash
   curl http://localhost:3001/api/chama/public
   ```

### Expected Results

**New Chama** (<1 month):

- Tier: `unrated`
- Score: 0-250
- Reason: Not enough data

**Established Chama** (6+ months, good metrics):

- Tier: `gold` or higher
- Score: 550-1000
- Breakdown: All component scores present

---

## Files Created/Modified

### Created

1. ✅ `backend/src/chama/chama-reputation.service.ts` (355 lines)

   - Core reputation calculation logic
   - Score breakdown by component
   - Tier determination with age caps
   - Search and filtering

2. ✅ `CHAMA_REPUTATION_SYSTEM.md` (600+ lines)

   - Comprehensive documentation
   - API reference
   - Use cases and examples
   - Frontend integration guide

3. ✅ `CHAMA_REPUTATION_IMPLEMENTATION.md` (This file)
   - Implementation summary
   - Technical details
   - Testing guide

### Modified

1. ✅ `backend/src/chama/chama.controller.ts`

   - Added 3 new reputation endpoints
   - Injected ChamaReputationService

2. ✅ `backend/src/chama/chama.module.ts`

   - Added ChamaReputationService to providers/exports

3. ✅ `backend/src/chama/chama.service.ts`
   - Enhanced `listPublicChamas()` to include reputation
   - Injected ChamaReputationService with forwardRef

---

## Comparison: User vs Chama Reputation

| Aspect        | User Reputation                           | Chama Reputation                           |
| ------------- | ----------------------------------------- | ------------------------------------------ |
| **Scores**    | Contributions, loan repayment             | Retention, defaults, consistency, activity |
| **Scale**     | 0-1000 (tier thresholds: 850/650/450/250) | 0-1000 (tier thresholds: 850/700/550/400)  |
| **Age Gates** | 3-18 months for tiers                     | 1-18 months for tiers (stricter)           |
| **Purpose**   | Individual loan eligibility               | Group trustworthiness                      |
| **Penalties** | -300 for defaults, -30 for late           | -50 per default, -50 for turnover          |
| **Affects**   | What user can borrow                      | Which chamas users join                    |

**Key Insight**: Both systems work together to create bidirectional trust.

---

## Next Steps

### Phase 1 (Complete) ✅

- [x] Core reputation calculation
- [x] API endpoints
- [x] Public listings integration
- [x] Documentation

### Phase 2 (Pending)

- [ ] Frontend components:
  - Reputation badge component
  - Score breakdown display
  - Leaderboard page
  - Filter UI for search
- [ ] Caching layer (Redis, 5-min TTL)
- [ ] Admin dashboard for reputation monitoring

### Phase 3 (Future)

- [ ] Badges: "Zero Defaults", "5-Year Anniversary"
- [ ] Historical trends (score changes over time)
- [ ] Peer comparisons: "Top 10% in category"
- [ ] Tier benefits: Featured placement, lower fees

---

## Summary

**What It Does**:

- Calculates comprehensive reputation score (0-1000) for chamas
- Maps score to tiers (Unrated → Diamond)
- Provides API endpoints for display and filtering
- Enhances public chama listings with reputation data

**Key Features**:

- ✅ Four weighted components (retention, loans, contributions, activity)
- ✅ Age-based tier caps (prevents gaming)
- ✅ Severe penalties for defaults/turnover
- ✅ Neutral scores for new chamas
- ✅ Advanced search by criteria
- ✅ Leaderboard support

**Integration**:

- ✅ Works with existing `chama_metrics` table
- ✅ No new migrations needed
- ✅ TypeScript compiles successfully
- ✅ Ready for testing

**Next**: Frontend components to display reputation badges and scores throughout the UI.
