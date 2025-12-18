# Chama Reputation System

## Overview

The **Chama Reputation System** is a comprehensive scoring mechanism that evaluates chama trustworthiness based on member behavior, financial performance, and activity levels. Unlike user reputation (which scores individual members), chama reputation helps users identify well-managed, trustworthy groups to join.

## Purpose

- **For Members**: Identify trustworthy chamas with low default rates and high retention
- **For Chamas**: Establish credibility and attract quality members
- **For Platform**: Incentivize good governance and responsible financial management

## Reputation Score (0-1000 Scale)

The reputation score is calculated from four weighted components:

### 1. Retention Score (30% weight, 0-300 points)

**Measures**: How well the chama retains members over time

**Components**:

- **Base Score** (200 pts max): `(retention_rate / 100) * 200`

  - 100% retention = 200 points
  - 80% retention = 160 points
  - 50% retention = 100 points

- **Tenure Bonus** (50 pts max): `min(50, average_tenure_months * 5)`

  - Members staying longer = more stable chama
  - 10+ months average tenure = full 50 points

- **Age Bonus** (50 pts max): `min(50, chama_age_months * 2)`

  - Established chamas get credit for longevity
  - 25+ months old = full 50 points

- **High Turnover Penalty** (-50 pts): If >10% members leave in a month
  - Indicates instability or mismanagement

**Why It Matters**: High retention = satisfied members, good leadership, stable environment

---

### 2. Loan Performance Score (30% weight, 0-300 points)

**Measures**: How responsibly the chama manages loans

**Components**:

- **Base Score** (250 pts max): `(1 - default_rate / 100) * 250`

  - 0% default rate = 250 points
  - 2% default rate = 245 points
  - 10% default rate = 225 points

- **Track Record Bonus** (50 pts max): `min(50, completed_loans * 5)`

  - Proven loan repayment history
  - 10+ completed loans = full 50 points

- **SEVERE Default Penalty** (-50 pts per default): `defaulted_loans * -50`
  - Any defaults significantly impact score
  - Prevents reckless lending

**Special Cases**:

- **No Loans Yet**: Default to 150 points (neutral score)
  - Doesn't penalize savings-focused chamas
  - Score improves once lending track record established

**Why It Matters**: Low defaults = trustworthy lending environment, responsible members

---

### 3. Contribution Score (25% weight, 0-250 points)

**Measures**: How consistent members are with contributions

**Components**:

- **Base Score** (200 pts max): `(consistency_rate / 100) * 200`

  - 100% on-time = 200 points
  - 80% on-time = 160 points
  - 60% on-time = 120 points

- **Activity Bonuses** (30 pts max):

  - 100+ contributions: +30 points (very active)
  - 50-99 contributions: +20 points (active)
  - 20-49 contributions: +10 points (moderate)

- **Late Contribution Penalty** (-30 pts): If >20% contributions are late
  - Indicates poor discipline or unrealistic schedules

**Special Cases**:

- **No Contributions**: 0 points
  - Brand new chamas start at 0

**Why It Matters**: Consistent contributions = reliable cashflow, disciplined members

---

### 4. Activity Score (15% weight, 0-150 points)

**Measures**: How engaged and active the chama is

**Components**:

- **Member Activity** (80 pts max): `(active_members / total_members) * 80`

  - 100% active = 80 points
  - 50% active = 40 points

- **Loan Activity** (40 pts max): `min(40, active_loans * 5)`

  - Active lending = healthy financial activity
  - 8+ active loans = full 40 points

- **Contribution Frequency** (20 pts max):
  - > 4 contributions/month: +20 points (very active)
  - > 2 contributions/month: +10 points (active)
  - <2 contributions/month: 0 points

**Why It Matters**: Active chamas = engaged members, healthy operations

---

## Reputation Tiers

Tiers are determined by **BOTH score AND age** to prevent gaming:

| Tier         | Score Required   | Age Required | Max Loan (if applicable) |
| ------------ | ---------------- | ------------ | ------------------------ |
| **Unrated**  | <250 or <1 month | Any          | N/A                      |
| **Bronze**   | 250-399          | 1+ months    | KES 10,000               |
| **Silver**   | 400-549          | 3+ months    | KES 30,000               |
| **Gold**     | 550-699          | 6+ months    | KES 100,000              |
| **Platinum** | 700-849          | 12+ months   | KES 300,000              |
| **Diamond**  | 850-1000         | 18+ months   | KES 1,000,000            |

### Age-Based Tier Caps

Even with a high score, chamas are capped by age:

- **1 month old**: Max Bronze (score 850 = still Bronze)
- **3 months old**: Max Silver (score 750 = still Silver)
- **6 months old**: Max Gold (score 850 = still Gold)
- **12 months old**: Max Platinum (score 900 = still Platinum)
- **18+ months old**: Can reach Diamond

**Rationale**: Prevents new chamas from manipulating scores quickly. Reputation must be earned over time.

---

## API Endpoints

### Get Chama Reputation

```http
GET /api/chama/:chamaId/reputation
```

**Response**:

```json
{
  "chamaId": "uuid",
  "chamaName": "Savings Champions",
  "reputationScore": 785,
  "tier": "platinum",

  "retentionScore": 275,
  "loanPerformanceScore": 290,
  "contributionScore": 190,
  "activityScore": 130,

  "memberRetentionRate": 92.5,
  "loanDefaultRate": 1.2,
  "contributionConsistencyRate": 88.3,
  "averageTenureMonths": 8.5,
  "roiPercentage": 12.5,
  "healthScore": 87,

  "totalMembers": 25,
  "ageMonths": 14,
  "totalContributionsValue": 1250000,
  "calculatedAt": "2025-01-13T12:00:00Z"
}
```

### Get Top-Rated Chamas (Leaderboard)

```http
GET /api/chama/reputation/leaderboard?limit=10
```

**Response**: Array of chama reputations sorted by score

### Search Chamas by Reputation

```http
GET /api/chama/reputation/search?minScore=500&minTier=silver&maxDefaultRate=5&minRetentionRate=80
```

**Query Parameters**:

- `minScore`: Minimum reputation score (0-1000)
- `minTier`: Minimum tier (`bronze`, `silver`, `gold`, `platinum`, `diamond`)
- `maxDefaultRate`: Maximum acceptable default rate (%)
- `minRetentionRate`: Minimum retention rate (%)
- `limit`: Number of results (default 20)

### Public Chama Listings (with Reputation)

```http
GET /api/chama/public
```

**Response**: All chamas include `reputation_tier` and `reputation_score` fields

---

## Use Cases

### For Users Browsing Chamas

**Filter by Trust Level**:

```
Search → minTier: gold, maxDefaultRate: 2
Result: Only well-established, low-default chamas
```

**Find Active Groups**:

```
Search → minScore: 600, minRetentionRate: 85
Result: High-activity, stable chamas
```

### For Chama Admins

**Improve Reputation**:

1. **Reduce Defaults**: Screen loan applicants carefully, enforce repayment
2. **Boost Retention**: Keep members engaged, resolve conflicts early
3. **Maintain Consistency**: Ensure timely contributions, send reminders
4. **Stay Active**: Encourage member participation, regular meetings

**Track Progress**:

```http
GET /api/chama/:id/reputation
```

Monitor score breakdown to identify weak areas

### For Platform Analytics

**Leaderboard Display**:

```http
GET /api/chama/reputation/leaderboard?limit=10
```

Show top-performing chamas as examples

**Risk Assessment**:

- Chamas with score <400 = high risk (needs monitoring)
- Chamas with >5% default rate = lending risk
- Chamas with <70% retention = instability

---

## Comparison: User vs Chama Reputation

| Aspect               | User Reputation                       | Chama Reputation                           |
| -------------------- | ------------------------------------- | ------------------------------------------ |
| **Purpose**          | Assess individual trustworthiness     | Assess group management quality            |
| **Scoring**          | Contributions, loan repayment, tenure | Retention, defaults, consistency, activity |
| **Tiers**            | Bronze → Diamond (800+ for top)       | Bronze → Diamond (850+ for top)            |
| **Time Gates**       | 3-18 months for tiers                 | 1-18 months for tiers                      |
| **Impact**           | Loan eligibility, withdrawal limits   | Member attraction, loan volume             |
| **Fraud Prevention** | Strict penalties, time requirements   | Age caps, default penalties                |

**Key Difference**: User reputation affects what ONE person can do. Chama reputation affects which chamas people TRUST to join.

---

## Fraud Prevention

### Age-Based Caps

- New chamas cannot game the system to quickly reach high tiers
- Must operate for 18 months to reach Diamond

### Severe Penalties

- Any loan default = -50 points per default
- High turnover (>10% monthly) = -50 points
- Late contributions (>20%) = -30 points

### Weight Distribution

- Retention + Loan Performance = 60% of score
- These are hardest to fake/manipulate
- Contribution consistency = 25% (can be gamed with reminders, but still requires discipline)
- Activity = 15% (encourages engagement)

### Neutral Scores for New Chamas

- No loans yet = 150/300 points (neutral, not penalized)
- No contributions yet = 0/250 points (fair, must prove themselves)

---

## Frontend Integration

### Chama Card Display

```tsx
<Card>
  <CardHeader>
    <h3>{chama.name}</h3>
    <Badge variant={getTierVariant(chama.reputation_tier)}>
      {chama.reputation_tier.toUpperCase()}
    </Badge>
    <span className="text-sm text-gray-600">
      Score: {chama.reputation_score}/1000
    </span>
  </CardHeader>

  <CardContent>
    <div className="grid grid-cols-2 gap-2">
      <Stat label="Retention" value={`${chama.retention_rate}%`} />
      <Stat label="Defaults" value={`${chama.default_rate}%`} />
    </div>
  </CardContent>
</Card>
```

### Badge Colors

```tsx
function getTierVariant(tier: string) {
  switch (tier) {
    case "diamond":
      return "bg-[#083232] text-white"; // Dark teal
    case "platinum":
      return "bg-[#2e856e] text-white"; // Medium teal
    case "gold":
      return "bg-[#f64d52] text-white"; // Coral
    case "silver":
      return "bg-gray-400 text-white";
    case "bronze":
      return "bg-amber-700 text-white";
    default:
      return "bg-gray-200 text-gray-700"; // Unrated
  }
}
```

### Filter UI

```tsx
<Select>
  <option value="">All Tiers</option>
  <option value="bronze">Bronze+</option>
  <option value="silver">Silver+</option>
  <option value="gold">Gold+</option>
  <option value="platinum">Platinum+</option>
  <option value="diamond">Diamond Only</option>
</Select>

<Input
  type="number"
  placeholder="Min Score (0-1000)"
  max={1000}
/>
```

---

## Technical Implementation

### Calculation Trigger

- **On-Demand**: When API endpoint is called
- **Cached**: Results cached briefly (5 min) to reduce DB load
- **Background**: Metrics calculated daily at 2 AM

### Database Dependencies

- `chama_metrics` table: All metrics come from here
- `chamas` table: Chama name, age, ROI
- `calculate_chama_metrics()` function: PostgreSQL function calculates all metrics

### Service Architecture

```
ChamaReputationService
├── calculateChamaReputation() → Full reputation object
├── calculateRetentionScore() → 0-300 points
├── calculateLoanPerformanceScore() → 0-300 points
├── calculateContributionScore() → 0-250 points
├── calculateActivityScore() → 0-150 points
├── getTierFromScore() → Maps score+age to tier
├── getTopRatedChamas() → Leaderboard
└── searchByReputation() → Advanced filtering
```

---

## Maintenance & Monitoring

### Daily Tasks

- Metrics recalculation (runs automatically at 2 AM)
- Check for chamas with sudden score drops (indicates issues)

### Weekly Review

- Top 10 chamas (leaderboard)
- Bottom 10 chamas (at-risk)
- Average tier distribution

### Red Flags

- **Score drops >100 points**: Major issue (defaults, mass exodus)
- **Retention <50%**: Chama may be failing
- **Default rate >10%**: Reckless lending

### Score Recalculation

- Automatic on each API call (calculated fresh)
- No background job needed (metrics are calculated daily)
- Real-time reflects latest metrics

---

## Future Enhancements

### Phase 2 (Planned)

- **Badges**: "Zero Defaults", "5-Year Anniversary", "100% Retention"
- **Historical Trends**: Score changes over time (chart)
- **Tier Benefits**: Verified badge, featured placement, lower fees
- **Peer Comparisons**: "Top 10% in category"

### Phase 3 (Future)

- **AI Risk Scoring**: Predict chama failure likelihood
- **Member Reviews**: User-submitted reviews (verified members only)
- **Certification**: Manual review + badge for top chamas
- **Insurance Eligibility**: Platinum+ chamas eligible for deposit insurance

---

## Summary

The Chama Reputation System creates a **trust layer** for the platform:

✅ **Users** can confidently join well-managed chamas  
✅ **Chamas** are incentivized to maintain high standards  
✅ **Platform** reduces risk by identifying problem groups early

**Key Metrics**: Retention, Defaults, Consistency, Activity  
**Key Protection**: Age-based caps, severe penalties, time requirements  
**Key Output**: 0-1000 score mapped to Bronze → Diamond tiers

Combined with **User Reputation** (individual trustworthiness), the platform now has bidirectional trust scoring for a safer, more transparent ecosystem.
