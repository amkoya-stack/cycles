# Contribution Components - Quick Start

## Components Overview

All contribution-related components are in `frontend/components/chama/`:

1. **contribution-dashboard.tsx** - Main overview of cycle progress
2. **contribute-form.tsx** - Form to make a contribution
3. **contribution-history.tsx** - List of past contributions with filters
4. **auto-debit-form.tsx** - Setup automated monthly contributions
5. **penalty-management.tsx** - View and manage penalties/waivers

## Integration Page

The main page that integrates all components is:

- `frontend/app/cycle/contributions/page.tsx`

## Usage Example

```tsx
import ContributionPage from "@/app/cycle/contributions/page";

// In your chama detail page:
<ContributionPage
  chamaId="chama-uuid"
  cycleId="cycle-uuid"
  expectedAmount={1000}
  contributionType="fixed"
/>;
```

## Individual Component Usage

### Contribution Dashboard

```tsx
import { ContributionDashboard } from "@/components/chama/contribution-dashboard";

<ContributionDashboard
  cycleId="cycle-uuid"
  onContributeClick={() => setDialogOpen(true)}
/>;
```

### Contribute Form

```tsx
import { ContributeForm } from "@/components/chama/contribute-form";

<ContributeForm
  chamaId="chama-uuid"
  cycleId="cycle-uuid"
  expectedAmount={1000}
  contributionType="fixed"
  onSuccess={() => console.log("Success!")}
  onCancel={() => setDialogOpen(false)}
/>;
```

### Contribution History

```tsx
import { ContributionHistory } from "@/components/chama/contribution-history";

<ContributionHistory
  chamaId="chama-uuid"
  cycleId="cycle-uuid" // optional - filters by cycle
/>;
```

### Auto-Debit Form

```tsx
import { AutoDebitForm } from "@/components/chama/auto-debit-form";

<AutoDebitForm
  chamaId="chama-uuid"
  cycleId="cycle-uuid"
  expectedAmount={1000}
  existingAutoDebit={existingSettings} // optional for edit mode
  onSuccess={() => console.log("Saved!")}
  onCancel={() => setDialogOpen(false)}
/>;
```

### Penalty Management

```tsx
import { PenaltyManagement } from "@/components/chama/penalty-management";

<PenaltyManagement chamaId="chama-uuid" />;
```

## API Client

All API calls are handled through `frontend/lib/contribution-api.ts`:

```typescript
import { contributionApi } from "@/lib/contribution-api";

// Create contribution
await contributionApi.createContribution({
  chamaId,
  cycleId,
  amount: 1000,
  paymentMethod: "wallet",
});

// Get cycle summary
const summary = await contributionApi.getCycleSummary(cycleId);

// Setup auto-debit
await contributionApi.setupAutoDebit({
  chamaId,
  cycleId,
  amount: 1000,
  dayOfMonth: 5,
  paymentMethod: "wallet",
});
```

## Styling

All components follow the Cycle design system:

- **Primary**: #083232 (dark teal)
- **Primary Light**: #2e856e (medium teal)
- **Secondary**: #f64d52 (coral red)

Components are mobile-first and fully responsive.

## Dependencies

Required packages:

```bash
npm install date-fns
npx shadcn@latest add switch radio-group progress alert
```

## Development

To test components in isolation, you can create a test page:

```tsx
// frontend/app/test-contributions/page.tsx
"use client";

import { ContributionDashboard } from "@/components/chama/contribution-dashboard";

export default function TestPage() {
  return (
    <div className="container mx-auto p-6">
      <ContributionDashboard
        cycleId="test-cycle-id"
        onContributeClick={() => alert("Contribute clicked")}
      />
    </div>
  );
}
```

Then visit `http://localhost:3000/test-contributions` to see the component.

## Next Steps

1. Set up backend API routes to match the endpoints in `contribution-api.ts`
2. Update API client to use proper authentication tokens
3. Test all components with real data
4. Add loading skeletons for better UX
5. Add error boundaries for graceful error handling
