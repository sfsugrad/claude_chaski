# Chaski UI Guide

This comprehensive guide covers both end-user instructions and developer guidelines for the Chaski logistics platform.

---

## Part 1: End-User Guide

### Getting Started

#### Account Creation
1. Navigate to the home page and click **Get Started** or **Register**
2. Choose your role:
   - **Sender** - Ship packages with travelers
   - **Courier** - Deliver packages on your routes
   - **Both** - Use both features
3. Complete registration with email, password, and phone number
4. Verify your email via the confirmation link sent to your inbox
5. Optionally verify your phone number for enhanced trust

#### Logging In
- Use email/password or Google Sign-In
- Enable "Remember me" to stay logged in
- After 5 failed attempts, your account locks for 15 minutes

---

### For Senders

#### Creating a Package

1. **Navigate** to Dashboard → Create Package
2. **Step 1 - Details**: Enter package description, select size (small/medium/large/extra large), and weight
3. **Step 2 - Pickup**: Enter pickup address using the autocomplete, add contact info
4. **Step 3 - Dropoff**: Enter destination address and recipient contact
5. **Step 4 - Review**: Confirm all details and submit

#### Managing Packages

**Dashboard Overview:**
- View all your packages with status filters
- Filter by: All, Active, Delivered, Canceled

**Package Statuses:**
| Status | Meaning |
|--------|---------|
| New | Just created, not yet open for bids |
| Open for Bids | Couriers can submit delivery offers |
| Bid Selected | You've chosen a courier |
| Pending Pickup | Waiting for courier to collect |
| In Transit | Package is being delivered |
| Delivered | Successfully completed |
| Canceled | You canceled the shipment |
| Failed | Delivery attempt unsuccessful |

**Actions:**
- **View Details** - See full package info, courier details, and tracking
- **View Bids** - Compare courier offers (when open for bids)
- **Accept Bid** - Choose a courier's offer
- **Cancel Package** - Cancel before pickup (restrictions apply)
- **Rate Courier** - Leave feedback after delivery

#### Reviewing Bids

When couriers submit bids:
1. Click **View Bids** on your package card
2. Compare offers based on:
   - Proposed price
   - Estimated delivery time
   - Courier rating and reviews
   - Courier message
3. Click **Accept** on your preferred bid
4. The courier is notified and pickup is scheduled

#### Tracking Delivery

Once a courier picks up your package:
- View real-time location on the map
- See estimated time of arrival
- Receive notifications at each status change
- Contact courier via in-app messaging

---

### For Couriers

#### Creating a Route

1. **Navigate** to Dashboard → Create Route
2. **Enter details**:
   - Starting location (where you'll depart)
   - Destination (where you're heading)
   - Trip date and departure time
   - Maximum deviation distance (how far off-route you'll go)
3. **Submit** - Your route becomes active for matching

#### Finding Packages

1. Go to your active route
2. Click **View Matches** to see packages along your path
3. Packages are sorted by relevance to your route
4. Review package details:
   - Pickup and dropoff locations
   - Package size and weight
   - Sender rating
   - Offered price range

#### Placing Bids

1. Click **Place Bid** on a matching package
2. Enter:
   - Your proposed delivery price
   - Estimated delivery time (hours)
   - Preferred pickup time
   - Optional message to sender
3. Submit your bid
4. Wait for sender response (you'll be notified)

#### Delivering Packages

**Pickup:**
1. Navigate to pickup location at scheduled time
2. Verify package matches description
3. Mark as "Picked Up" in the app

**In Transit:**
- Enable location sharing for sender tracking
- Update status if delays occur
- Contact sender via messages if needed

**Delivery:**
1. Navigate to dropoff location
2. Capture delivery proof:
   - Take photo of delivered package
   - Obtain recipient signature (if required)
3. Mark as "Delivered"
4. Receive payment after confirmation

---

### Messaging

- Access **Messages** from the navigation bar
- Conversations are organized by package
- Real-time updates - no page refresh needed
- View message history for past deliveries

---

### Notifications

- Click the bell icon in the navigation bar
- View unread notification count
- Notification types:
  - New bid on your package
  - Bid accepted/declined
  - Package status changes
  - New messages
  - Rating received
- Mark as read individually or all at once

---

### Reviews and Ratings

**Leaving a Review:**
- After delivery, you'll be prompted to rate
- Rate 1-5 stars
- Add optional written feedback
- Reviews help build community trust

**Viewing Reviews:**
- Go to Profile → Reviews
- See ratings you've received
- View ratings you've given

---

### Language Settings

- Click the language icon in the top-right corner
- Choose from:
  - English (en)
  - French (fr)
  - Spanish (es)
- The interface updates immediately

---

## Part 2: Developer UI Guide

### Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14 | React framework with App Router |
| React | 18 | UI library |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 3.3 | Utility-first styling |
| next-intl | 4.5 | Internationalization |
| Recharts | - | Data visualization |
| React Google Maps | - | Map integration |

---

### Project Structure

```
frontend/
├── app/
│   └── [locale]/           # i18n routing (en, fr, es)
│       ├── page.tsx        # Landing page
│       ├── login/          # Authentication pages
│       ├── register/
│       ├── dashboard/
│       ├── sender/         # Sender-specific pages
│       ├── courier/        # Courier-specific pages
│       ├── packages/
│       ├── messages/
│       ├── notifications/
│       ├── admin/          # Admin pages
│       └── layout.tsx      # Root layout
├── components/
│   ├── ui/                 # Base UI components
│   ├── analytics/          # Analytics components
│   ├── charts/             # Chart components
│   ├── logistics/          # Package/route components
│   ├── map/                # Map components
│   ├── tracking/           # Tracking components
│   ├── proof/              # Delivery proof components
│   ├── payment/            # Payment components
│   └── *.tsx               # Shared components
├── contexts/
│   └── WebSocketContext.tsx
├── hooks/
│   └── useWebSocket.ts
├── lib/
│   ├── api.ts              # API client (REQUIRED for all API calls)
│   └── logger.ts           # Frontend logging
├── messages/               # i18n translation files
│   ├── en.json
│   ├── fr.json
│   └── es.json
└── globals.css             # Global styles & design tokens
```

---

### Component Library

#### Base UI Components (`components/ui/`)

**Button**
```tsx
import { Button } from '@/components/ui/Button';

<Button
  variant="primary"    // primary | secondary | outline | ghost | danger | success
  size="md"            // sm | md | lg
  isLoading={false}
  leftIcon={<Icon />}
  fullWidth={false}
>
  Click Me
</Button>
```

**Input**
```tsx
import { Input } from '@/components/ui/Input';

<Input
  label="Email"
  type="email"
  name="email"
  error="Invalid email"
  helperText="We'll never share your email"
  leftIcon={<EmailIcon />}
/>
```

**Card**
```tsx
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/Card';

<Card hoverable padding="md">
  <CardHeader>Title</CardHeader>
  <CardBody>Content here</CardBody>
  <CardFooter>Actions</CardFooter>
</Card>
```

**Badge**
```tsx
import { Badge } from '@/components/ui/Badge';

<Badge variant="success" size="md">Active</Badge>
// Variants: primary | secondary | success | warning | error | info
```

**Alert**
```tsx
import { Alert } from '@/components/ui/Alert';

<Alert variant="error" dismissible onDismiss={() => {}}>
  Something went wrong
</Alert>
```

**Modal**
```tsx
import { Modal } from '@/components/ui/Modal';

<Modal isOpen={isOpen} onClose={onClose} size="md">
  <Modal.Header>Title</Modal.Header>
  <Modal.Body>Content</Modal.Body>
  <Modal.Footer>
    <Button onClick={onClose}>Cancel</Button>
    <Button variant="primary">Confirm</Button>
  </Modal.Footer>
</Modal>
```

**Skeleton Loading**
```tsx
import { Skeleton, SkeletonCard, SkeletonText } from '@/components/ui/Skeleton';
import { SenderDashboardSkeleton } from '@/components/ui/PageSkeletons';

// Basic skeleton
<Skeleton variant="text" width="100%" height={20} />

// Pre-built page skeletons
<SenderDashboardSkeleton />
<CourierDashboardSkeleton />
<AdminDashboardSkeleton />
```

**Empty States**
```tsx
import { EmptyPackages, EmptyRoutes, EmptyMessages } from '@/components/ui/EmptyState';

<EmptyPackages />
<EmptyRoutes action={{ label: "Create Route", onClick: handleCreate }} />
```

**Progress**
```tsx
import { ProgressBar, ProgressRing, ProgressSteps } from '@/components/ui/Progress';

<ProgressBar value={75} max={100} showLabel />
<ProgressRing percentage={60} size={80} />
<ProgressSteps steps={['Details', 'Pickup', 'Dropoff', 'Review']} currentStep={2} />
```

**Toast Notifications**
```tsx
import { useToast } from '@/components/ui/Toast';

const { showToast } = useToast();

showToast({ type: 'success', message: 'Package created!' });
showToast({ type: 'error', message: 'Something went wrong' });
```

**Animations**
```tsx
import { FadeIn, SlideIn, ScaleIn, CountUp } from '@/components/ui/Animations';

<FadeIn delay={200}>
  <Card>Content</Card>
</FadeIn>

<SlideIn direction="up" duration={300}>
  <div>Slides up into view</div>
</SlideIn>

<CountUp end={1234} duration={1000} />
```

---

### Domain Components

**Status Timeline**
```tsx
import { StatusTimeline } from '@/components/logistics/StatusTimeline';

<StatusTimeline
  currentStatus="in_transit"
  orientation="horizontal"  // or "vertical"
  timestamps={{
    new: '2024-01-01T10:00:00Z',
    open_for_bids: '2024-01-01T11:00:00Z',
    // ...
  }}
/>
```

**Bid Components**
```tsx
import { BidCard } from '@/components/BidCard';
import { BidModal } from '@/components/BidModal';
import { BidsList } from '@/components/BidsList';

<BidsList packageId={packageId} onBidAccept={handleAccept} />
<BidModal isOpen={isOpen} packageId={packageId} onClose={onClose} />
```

**Star Rating**
```tsx
import { StarRating } from '@/components/StarRating';

<StarRating
  value={4}
  onChange={(value) => setRating(value)}
  readOnly={false}
  size="md"
/>
```

**Address Autocomplete**
```tsx
import { AddressAutocomplete } from '@/components/AddressAutocomplete';

<AddressAutocomplete
  value={address}
  onChange={(address, coords) => {
    setAddress(address);
    setCoordinates(coords);
  }}
  placeholder="Enter pickup address"
/>
```

**Delivery Proof**
```tsx
import { PhotoCapture } from '@/components/proof/PhotoCapture';
import { SignaturePad } from '@/components/proof/SignaturePad';

<PhotoCapture onCapture={(photoData) => handlePhoto(photoData)} />
<SignaturePad onSign={(signatureData) => handleSignature(signatureData)} />
```

---

### Design Tokens

#### Colors

```css
/* Primary - Blue */
--color-primary-50: #EFF6FF;
--color-primary-500: #3B82F6;  /* Default */
--color-primary-900: #1E3A8A;

/* Secondary - Emerald */
--color-secondary-50: #ECFDF5;
--color-secondary-500: #10B981;  /* Default */
--color-secondary-900: #064E3B;

/* Semantic */
--color-success: #22C55E;
--color-warning: #F59E0B;
--color-error: #EF4444;
--color-info: #3B82F6;

/* Neutral/Surface */
--color-surface-50: #FAFAFA;   /* Lightest */
--color-surface-900: #171717;  /* Darkest */
```

#### Typography

```css
/* Font Families */
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-mono: 'JetBrains Mono', Menlo, Monaco, monospace;

/* Font Sizes */
font-size: 0.75rem;   /* xs - 12px */
font-size: 0.875rem;  /* sm - 14px */
font-size: 1rem;      /* base - 16px */
font-size: 1.125rem;  /* lg - 18px */
font-size: 1.25rem;   /* xl - 20px */
```

#### Spacing

```css
/* Standard Tailwind scale (4px units) */
spacing: 1 (4px), 2 (8px), 3 (12px), 4 (16px), 6 (24px), 8 (32px)

/* Container */
.page-container: max-width: 1280px, centered, responsive padding
```

#### Shadows

```css
shadow-card: 0 1px 3px rgba(0,0,0,0.1);
shadow-card-hover: 0 10px 15px rgba(0,0,0,0.1);
shadow-modal: 0 25px 50px rgba(0,0,0,0.25);
shadow-glow: 0 0 20px rgba(59,130,246,0.3);
```

#### Border Radius

```css
rounded-sm: 0.125rem (2px)
rounded-md: 0.375rem (6px)
rounded-lg: 0.5rem (8px)
rounded-xl: 0.75rem (12px)
rounded-full: 9999px
```

---

### Animation Classes

```css
/* Entrance Animations */
.animate-fade-in      /* Opacity fade */
.animate-fade-in-up   /* Fade + slide up */
.animate-slide-in-left
.animate-slide-in-right
.animate-scale-in     /* Scale from 0.95 */
.animate-bounce-in

/* Interactive */
.animate-pulse-soft   /* Gentle opacity pulse */
.animate-shimmer      /* Loading shimmer */
.animate-ripple       /* Click ripple */
.animate-shake        /* Error shake */

/* Continuous */
.animate-spin-slow    /* 3s rotation */
```

---

### Form Patterns

**Standard Form Structure**
```tsx
<form onSubmit={handleSubmit}>
  <div className="form-group">
    <label className="label">Field Label</label>
    <Input
      name="fieldName"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      error={errors.fieldName}
    />
    {errors.fieldName && (
      <p className="error-text">{errors.fieldName}</p>
    )}
  </div>

  <Button type="submit" variant="primary" isLoading={isSubmitting}>
    Submit
  </Button>
</form>
```

**Form Validation**
```tsx
// Client-side validation
const validateForm = () => {
  const errors: Record<string, string> = {};

  if (!email) errors.email = 'Email is required';
  if (!email.includes('@')) errors.email = 'Invalid email format';
  if (password.length < 8) errors.password = 'Password must be 8+ characters';

  return errors;
};

// Display API errors
try {
  await api.submit(data);
} catch (error) {
  if (error.response?.data?.detail) {
    setError(error.response.data.detail);
  }
}
```

---

### API Integration

**All API calls must go through `lib/api.ts`:**

```tsx
import { authAPI, packagesAPI, couriersAPI } from '@/lib/api';

// Authentication
await authAPI.login({ email, password });
await authAPI.register(userData);
await authAPI.logout();

// Packages
const packages = await packagesAPI.list();
const package = await packagesAPI.get(packageId);
await packagesAPI.create(packageData);
await packagesAPI.cancel(packageId);

// Couriers
const routes = await couriersAPI.getRoutes();
await couriersAPI.createRoute(routeData);
```

**Never use axios directly in components** - always import from `lib/api.ts`.

---

### Internationalization (i18n)

**Using Translations**
```tsx
// Client Components
'use client';
import { useTranslations } from 'next-intl';

export function MyComponent() {
  const t = useTranslations('namespace');
  return <h1>{t('title')}</h1>;
}

// Server Components
import { getTranslations } from 'next-intl/server';

export default async function Page() {
  const t = await getTranslations('namespace');
  return <h1>{t('title')}</h1>;
}
```

**Translation Files Structure** (`messages/en.json`)
```json
{
  "common": {
    "loading": "Loading...",
    "error": "An error occurred",
    "save": "Save",
    "cancel": "Cancel"
  },
  "auth": {
    "login": "Log In",
    "logout": "Log Out",
    "email": "Email",
    "password": "Password"
  },
  "packages": {
    "title": "My Packages",
    "create": "Create Package",
    "status": {
      "new": "New",
      "open_for_bids": "Open for Bids"
    }
  }
}
```

---

### WebSocket Integration

**Using the WebSocket Context**
```tsx
import { useWebSocketContext } from '@/contexts/WebSocketContext';

export function MyComponent() {
  const {
    isConnected,
    notifications,
    unreadCount,
    markAsRead
  } = useWebSocketContext();

  // Real-time updates are automatic
  return (
    <div>
      <ConnectionStatus connected={isConnected} />
      <span>Unread: {unreadCount}</span>
    </div>
  );
}
```

**WebSocket Events**
- `notification_created` - New notification received
- `unread_count_updated` - Unread count changed
- `message_received` - New chat message

---

### Responsive Design Guidelines

**Breakpoints**
```css
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large */
```

**Mobile-First Approach**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* 1 column on mobile, 2 on tablet, 3 on desktop */}
</div>

<div className="px-4 md:px-6 lg:px-8">
  {/* Responsive padding */}
</div>

<Button className="w-full md:w-auto">
  {/* Full width on mobile, auto on larger screens */}
</Button>
```

---

### Error Handling

**Error Boundary**
```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

<ErrorBoundary>
  <RiskyComponent />
</ErrorBoundary>
```

**API Error Display**
```tsx
import { Alert } from '@/components/ui/Alert';

{error && (
  <Alert variant="error" dismissible onDismiss={() => setError(null)}>
    {error}
  </Alert>
)}
```

**Frontend Logging**
```tsx
import { logError, logWarning } from '@/lib/logger';

try {
  await doSomething();
} catch (error) {
  logError('Operation failed', error, { context: 'MyComponent' });
}
```

---

### Testing

**Running Tests**
```bash
npm test                    # Run all tests
npm test -- path/to/test    # Single file
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage
```

**E2E Tests (Playwright)**
```bash
npm run test:e2e            # Headless
npm run test:e2e:ui         # Interactive UI
npm run test:e2e:headed     # Headed browser
npm run test:e2e:debug      # Debug mode
```

**Test Structure**
```
components/
├── MyComponent.tsx
└── __tests__/
    └── MyComponent.test.tsx
```

---

### Code Style Rules

1. **Components**: Use TypeScript, define prop types with interfaces
2. **Styling**: Prefer Tailwind utilities, use semantic classes from `globals.css` when needed
3. **API Calls**: Always use `lib/api.ts` modules, never direct axios
4. **State**: Use React hooks, context for global state
5. **Forms**: Use controlled components with validation
6. **Loading**: Always show skeletons or loading states
7. **Errors**: Handle all API errors, show user-friendly messages
8. **Accessibility**: Use semantic HTML, ARIA labels, proper focus management

---

### Quick Reference

| Task | Component/Module |
|------|------------------|
| Button | `components/ui/Button` |
| Form inputs | `components/ui/Input`, `Select` |
| Cards | `components/ui/Card` |
| Modals | `components/ui/Modal` |
| Loading states | `components/ui/Skeleton`, `PageSkeletons` |
| Status display | `components/ui/Badge`, `StatusTimeline` |
| Notifications | `components/ui/Toast`, `Alert` |
| API calls | `lib/api.ts` |
| Translations | `next-intl`, `messages/*.json` |
| Real-time | `contexts/WebSocketContext` |
| Error handling | `components/ErrorBoundary`, `logError` |
