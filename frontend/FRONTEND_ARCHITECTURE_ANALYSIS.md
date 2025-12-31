# Frontend Architecture Analysis

## Overview
The frontend is built with **Next.js 14+ (App Router)**, **React**, **TypeScript**, and **Tailwind CSS** with **shadcn/ui** components.

---

## 🏗️ Architecture Patterns

### 1. **Routing Structure (App Router)**
```
app/
├── layout.tsx              # Root layout with global providers
├── page.tsx                # Home page (public chama listing)
├── [slug]/                 # Dynamic route for chama detail pages
│   ├── page.tsx           # Chama detail page with tabs
│   └── documents/         # Nested route for documents
├── auth/                   # Authentication routes
│   ├── login/
│   ├── register/
│   ├── verify/
│   └── forgot-password/
├── wallet/                 # User wallet page
├── profile/                # User profile pages
├── cycle/                  # Cycle/meeting management
└── invite/                 # Invite token handling
```

**Key Pattern**: File-based routing with dynamic segments (`[slug]`)

---

### 2. **Component Organization**

#### **By Feature Domain**
```
components/
├── chama/                  # Chama-specific components
│   ├── loan-dashboard.tsx
│   ├── member-directory.tsx
│   ├── rotation-dashboard.tsx
│   ├── governance-section.tsx
│   └── ...
├── wallet/                 # Wallet operations
│   ├── BalanceCard.tsx
│   ├── TransactionHistory.tsx
│   ├── DepositModal.tsx
│   └── ...
├── home/                   # Home page components
│   ├── home-navbar.tsx
│   ├── chama-grid.tsx
│   └── pagination.tsx
├── ui/                     # shadcn/ui base components
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   └── ...
└── ...
```

**Pattern**: Feature-based organization with shared UI components

---

### 3. **State Management**

#### **Client-Side State**
- **React Hooks** (`useState`, `useEffect`, `useCallback`)
- **Custom Hooks** for reusable logic:
  - `useAuth()` - Authentication state
  - `useChamas()` - Chama data fetching
  - `useNotifications()` - Notification management
  - `useToast()` - Toast notifications

#### **Server State**
- **Direct API calls** using `fetch()` with `localStorage` tokens
- **No global state management library** (Redux/Zustand)
- **Component-level state** for most data

#### **Persistence**
- **localStorage** for:
  - `accessToken` / `refreshToken`
  - `redirectAfterLogin`
  - User preferences

---

### 4. **Authentication Flow**

```typescript
// hooks/use-auth.ts
export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  useEffect(() => {
    // Check localStorage after mount (client-side only)
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken || isTokenExpired(accessToken)) {
      setIsAuthenticated(false);
    } else {
      setIsAuthenticated(true);
    }
  }, []);
  
  return { isAuthenticated, validateToken, logout };
}
```

**Key Points**:
- ✅ **SSR-safe**: Starts with `false` to prevent hydration mismatch
- ✅ **Client-side only**: Checks `localStorage` in `useEffect`
- ✅ **Token validation**: Checks expiration before setting authenticated
- ✅ **Auto-logout**: Clears tokens on expiration

**Protected Routes**:
```typescript
// hooks/use-auth.ts
export function useAuthGuard() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  
  useEffect(() => {
    if (!isAuthenticated) {
      localStorage.setItem("redirectAfterLogin", currentPath);
      router.push("/auth/login");
    }
  }, [isAuthenticated]);
}
```

---

### 5. **Data Fetching Patterns**

#### **Pattern 1: Direct Fetch in Components**
```typescript
// app/wallet/page.tsx
useEffect(() => {
  const fetchBalance = async () => {
    const response = await fetch(apiUrl("wallet/balance"), {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await response.json();
    setBalance(data.balance);
  };
  fetchBalance();
}, []);
```

#### **Pattern 2: Custom Hooks**
```typescript
// hooks/use-chamas.ts
export function useChamas() {
  const [chamas, setChamas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const fetchChamas = useCallback(async () => {
    setLoading(true);
    const response = await fetch(apiUrl("chama/public"));
    const data = await response.json();
    setChamas(data);
    setLoading(false);
  }, []);
  
  return { chamas, loading, fetchChamas };
}
```

#### **Pattern 3: API Client Utility**
```typescript
// lib/api-client.ts
export async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const accessToken = localStorage.getItem("accessToken");
  const headers = {
    "Content-Type": "application/json",
    ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
  };
  
  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    // Handle errors (401, 403, 500, etc.)
    throw new ApiError(errorMessage, response.status);
  }
  
  return response.json();
}
```

---

### 6. **Rendering Patterns**

#### **Client Components (Default)**
Most components are **"use client"** because they:
- Use React hooks (`useState`, `useEffect`)
- Handle user interactions
- Access `localStorage` / browser APIs
- Use WebSocket connections

```typescript
"use client";

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  // ...
}
```

#### **Server Components (Rare)**
Only used in:
- `app/layout.tsx` (root layout)
- Static content pages

#### **Hybrid Rendering**
- **Initial HTML**: Server-rendered (Next.js default)
- **Hydration**: Client-side React takes over
- **Subsequent Updates**: Client-side only

---

### 7. **UI Component System**

#### **shadcn/ui Base Components**
Located in `components/ui/`:
- `button.tsx`
- `card.tsx`
- `dialog.tsx`
- `input.tsx`
- `tabs.tsx`
- `toast.tsx`
- etc.

**Pattern**: Copy-paste components (not npm package), fully customizable

#### **Feature Components**
Built on top of base components:
- `BalanceCard.tsx` - Uses `Card`, `Button`
- `TransactionHistory.tsx` - Uses `Card`, custom table
- `DepositModal.tsx` - Uses `Dialog`, `Input`, `Button`

---

### 8. **Real-Time Features**

#### **WebSocket Integration**
```typescript
// app/wallet/page.tsx
const socketRef = useRef<Socket | null>(null);

useEffect(() => {
  const socket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001");
  
  socket.on("balance_update", (data) => {
    setBalance(data.balance);
  });
  
  socketRef.current = socket;
  
  return () => socket.disconnect();
}, []);
```

**Use Cases**:
- Balance updates
- Transaction notifications
- Chat messages
- Meeting indicators

---

### 9. **Form Handling**

#### **Pattern: Controlled Components**
```typescript
const [depositAmount, setDepositAmount] = useState("");

<input
  value={depositAmount}
  onChange={(e) => setDepositAmount(e.target.value)}
/>
```

#### **No Form Library**
- No React Hook Form / Formik
- Manual validation
- Direct state management

---

### 10. **Error Handling**

#### **API Error Handling**
```typescript
// lib/api-client.ts
try {
  const response = await fetch(url, options);
  if (!response.ok) {
    if (response.status === 401) {
      // Auto-logout on 401
      localStorage.removeItem("accessToken");
      window.location.href = "/auth/login";
    }
    throw new ApiError(errorMessage, response.status);
  }
  return response.json();
} catch (error) {
  // Handle network errors, etc.
}
```

#### **User-Facing Errors**
- **Toast notifications** for user actions
- **Console errors** for debugging
- **Fallback UI** for failed data fetches

---

### 11. **Styling Approach**

#### **Tailwind CSS**
- Utility-first CSS
- Responsive design with breakpoints
- Dark mode support (if configured)

#### **Component-Level Styles**
```typescript
<div className="min-h-screen bg-gray-50 flex flex-col">
  <Card className="p-6">
    <h3 className="text-xl font-bold">Title</h3>
  </Card>
</div>
```

#### **No CSS Modules / Styled Components**
- Pure Tailwind utilities
- Global styles in `app/globals.css`

---

### 12. **Navigation Patterns**

#### **Next.js Router**
```typescript
import { useRouter } from "next/navigation";

const router = useRouter();
router.push("/wallet");
router.push(`/${slug}`);
```

#### **Link Component**
```typescript
import Link from "next/link";

<Link href="/profile">Profile</Link>
```

#### **Programmatic Navigation**
- `router.push()` for client-side navigation
- `window.location.href` for full page reload (after login)

---

### 13. **Modal/Dialog Patterns**

#### **State-Controlled Modals**
```typescript
const [showDeposit, setShowDeposit] = useState(false);

<Button onClick={() => setShowDeposit(true)}>Deposit</Button>

{showDeposit && (
  <DepositModal
    open={showDeposit}
    onClose={() => setShowDeposit(false)}
  />
)}
```

#### **shadcn/ui Dialog**
```typescript
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";

<Dialog open={showDeposit} onOpenChange={setShowDeposit}>
  <DialogContent>
    <DialogHeader>Deposit</DialogHeader>
    {/* Form content */}
  </DialogContent>
</Dialog>
```

---

### 14. **Data Flow**

```
User Action
    ↓
Component Event Handler
    ↓
API Call (fetch/axios)
    ↓
Backend API (NestJS)
    ↓
Response
    ↓
Update Local State (useState)
    ↓
Re-render Component
```

**No Global State**: Each component manages its own data

---

### 15. **Performance Optimizations**

#### **Lazy Loading**
- Dynamic imports for heavy components (if used)
- Code splitting by route (Next.js default)

#### **Polling**
```typescript
// Poll balance every 10 seconds
useEffect(() => {
  const interval = setInterval(() => {
    fetchBalance();
  }, 10000);
  return () => clearInterval(interval);
}, []);
```

#### **WebSocket for Real-Time**
- Reduces polling overhead
- Instant updates for balance/transactions

---

### 16. **Type Safety**

#### **TypeScript Interfaces**
```typescript
interface Transaction {
  id: string;
  reference: string;
  description: string;
  transaction_type: string;
  amount: number;
  direction: string;
  status: string;
  created_at: string;
}
```

#### **Type Assertions**
- Minimal use of `any`
- Most components are typed
- API responses typed where possible

---

## 🔍 Key Observations

### ✅ **Strengths**
1. **Simple Architecture**: No over-engineering
2. **Feature-Based Organization**: Easy to find components
3. **SSR-Safe Auth**: Prevents hydration mismatches
4. **Real-Time Support**: WebSocket integration
5. **Type Safety**: TypeScript throughout

### ⚠️ **Areas for Improvement**
1. **No Global State**: Could benefit from Zustand/Context for shared state
2. **Manual Form Validation**: Could use React Hook Form
3. **No API Caching**: Could use React Query/SWR
4. **Direct API Calls**: Could centralize more in hooks
5. **Error Boundaries**: No React error boundaries

---

## 📋 Chama Page Architecture (Critical Pattern)

### **Tab-Based Navigation System**
The chama detail page (`app/[slug]/page.tsx`) uses a **tab-based architecture**:

```typescript
type TabType =
  | "about" | "community" | "members" | "classroom"
  | "rotation" | "financials" | "loans" | "activity"
  | "documents" | "settings" | "reputation";

const [activeTab, setActiveTab] = useState<TabType>(() => {
  // Initialize from URL query parameter if available
  if (typeof window !== "undefined") {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get("tab") as TabType;
    if (tabParam) return tabParam;
  }
  return "about";
});
```

**Key Features**:
1. **URL-Synced Tabs**: Tab state is synced with URL query params (`?tab=loans`)
2. **Conditional Visibility**: Non-members see only "About", members see all except "Settings" (admin only)
3. **Component Per Tab**: Each tab renders a dedicated component via `renderTabContent()` switch
4. **Sticky Tab Bar**: Tab navigation is sticky at the top (`sticky top-16`)
5. **Tab Icons**: Each tab has an associated icon from lucide-react

### **Tab Rendering Pattern**
```typescript
const renderTabContent = () => {
  switch (activeTab) {
    case "loans":
      return <LoanDashboard />;
    case "financials":
      return <FinancialsContent />;
    case "members":
      return <MemberDirectory chamaId={chama.id} />;
    case "rotation":
      return <RotationPayoutPage chamaId={chama.id} />;
    // ... other tabs
  }
};
```

### **Existing Loans Tab**
- **Location**: `components/chama/loan-dashboard.tsx`
- **Current State**: Basic placeholder with mock data
- **Integration**: Already integrated into chama page at line 721
- **Pattern**: Should follow same structure as `RotationPayoutPage`, `MemberDirectory`, etc.

### **Tab Configuration**
```typescript
const tabs = [
  { id: "about" as TabType, label: "About", icon: Info },
  { id: "community" as TabType, label: "Community", icon: MessageSquare },
  { id: "members" as TabType, label: "Members", icon: Users },
  { id: "rotation" as TabType, label: "Rotation", icon: Repeat },
  { id: "financials" as TabType, label: "Financials", icon: TrendingUp },
  { id: "loans" as TabType, label: "Loans", icon: HandCoins },
  // ... more tabs
];
```

---

## 📋 Recommendations for Phase 12D (Lending Dashboard)

### **Enhance Existing Component**
**DO NOT create new routes** - Enhance the existing `LoanDashboard` component:

```
components/chama/
├── loan-dashboard.tsx              # Main component (ENHANCE THIS)
│   ├── Internal Loans Section     # Phase 12A
│   ├── External Loans Section     # Phase 12B
│   └── Inter-Chama Loans Section  # Phase 12C
```

### **Sub-Tab Pattern (Recommended)**
Within the loans tab, use sub-tabs similar to how other complex tabs work:

```typescript
// Inside loan-dashboard.tsx
const [lendingType, setLendingType] = useState<"internal" | "external" | "inter-chama">("internal");

<Tabs value={lendingType} onValueChange={setLendingType}>
  <TabsList>
    <TabsTrigger value="internal">Internal Loans</TabsTrigger>
    <TabsTrigger value="external">External Loans</TabsTrigger>
    <TabsTrigger value="inter-chama">Inter-Chama Loans</TabsTrigger>
  </TabsList>
  <TabsContent value="internal"><InternalLoansSection /></TabsContent>
  <TabsContent value="external"><ExternalLoansSection /></TabsContent>
  <TabsContent value="inter-chama"><InterChamaLoansSection /></TabsContent>
</Tabs>
```

### **Component Structure**
```
components/chama/
├── loan-dashboard.tsx                    # Main wrapper (enhance existing)
├── lending/
│   ├── internal-loans-section.tsx       # Phase 12A - Chama → Member
│   ├── external-loans-section.tsx       # Phase 12B - Chama → Non-Members
│   ├── inter-chama-loans-section.tsx    # Phase 12C - Chama → Chama
│   ├── loan-application-form.tsx        # Shared form component
│   ├── loan-details-card.tsx            # Loan card component
│   ├── repayment-schedule.tsx            # Repayment timeline
│   └── loan-summary-stats.tsx           # Statistics cards
```

### **Component Structure**
```
components/
├── lending/
│   ├── lending-dashboard.tsx        # Main dashboard
│   ├── internal-loans-section.tsx    # Phase 12A
│   ├── external-loans-section.tsx   # Phase 12B
│   ├── inter-chama-loans-section.tsx # Phase 12C
│   ├── loan-application-form.tsx
│   ├── loan-details-card.tsx
│   ├── repayment-schedule.tsx
│   └── loan-summary-stats.tsx
```

### **Page Routes**
```
app/
├── lending/
│   ├── page.tsx                    # Main lending dashboard
│   ├── internal/
│   │   └── page.tsx                # Internal loans
│   ├── external/
│   │   └── page.tsx                # External loans
│   └── inter-chama/
│       └── page.tsx                # Inter-chama loans
```

### **Data Fetching**
- Create `hooks/use-lending.ts` for lending data
- Use `apiUrl("lending/...")` for API calls
- Implement WebSocket for real-time loan updates

### **State Management**
- Component-level state for forms
- Custom hooks for data fetching
- Consider Zustand if state becomes complex

---

## 🎯 Implementation Strategy

1. **Reuse Existing Patterns**: Follow current component structure
2. **Leverage shadcn/ui**: Use existing UI components
3. **Consistent Styling**: Match wallet/chama page styles
4. **Real-Time Updates**: WebSocket for loan status changes
5. **Type Safety**: Full TypeScript interfaces for loan data

---

This analysis provides a comprehensive view of how the frontend is structured and how to integrate the lending dashboard (Phase 12D) seamlessly.

