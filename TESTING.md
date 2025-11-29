# Chaski Testing Documentation

## Overview

This document provides a comprehensive overview of the testing infrastructure for the Chaski delivery platform. The application has extensive test coverage across backend APIs, frontend components, end-to-end workflows, and background services.

**Total Test Count: ~1,801 tests**

## Table of Contents

1. [Testing Stack](#testing-stack)
2. [Test Organization](#test-organization)
3. [Phase 1: Backend Core Tests](#phase-1-backend-core-tests)
4. [Phase 2: Backend Advanced Tests](#phase-2-backend-advanced-tests)
5. [Phase 3: Frontend Component Tests](#phase-3-frontend-component-tests)
6. [Phase 4: Background Jobs & Services](#phase-4-background-jobs--services)
7. [Running Tests](#running-tests)
8. [Test Coverage](#test-coverage)
9. [Best Practices](#best-practices)
10. [CI/CD Integration](#cicd-integration)

---

## Testing Stack

### Backend Testing
- **Framework**: Pytest
- **HTTP Client**: TestClient (FastAPI)
- **Database**: SQLite (in-memory for tests)
- **Fixtures**: Comprehensive fixtures in `tests/conftest.py`
- **Mocking**: unittest.mock

### Frontend Testing
- **Framework**: Jest
- **Component Testing**: React Testing Library
- **E2E Testing**: Playwright
- **Coverage**: Jest coverage reports

### Key Testing Libraries
```
Backend:
- pytest
- pytest-cov
- sqlalchemy
- fastapi.testclient

Frontend:
- @testing-library/react
- @testing-library/jest-dom
- @playwright/test
- jest
```

---

## Test Organization

### Backend Structure
```
backend/tests/
├── conftest.py              # Shared fixtures and configuration
├── test_*.py               # API endpoint tests
├── test_*_service.py       # Service/business logic tests
└── test_*_job.py           # Background job tests
```

### Frontend Structure
```
frontend/
├── e2e/                    # Playwright E2E tests
│   ├── fixtures/          # Test data and helpers
│   └── *.spec.ts          # E2E test files
└── components/
    └── **/__tests__/      # Component unit tests
```

---

## Phase 1: Backend Core Tests

**Total: 171 tests (147 backend + 24 E2E)**

### API Endpoint Tests

#### Authentication Routes (`test_auth.py`) - 28 tests
- User registration with validation
- Email verification flow
- Login/logout functionality
- Password reset workflow
- OAuth (Google) integration
- JWT token handling
- Session management

#### Package Routes (`test_packages.py`) - 35 tests
- Package CRUD operations
- Package status transitions
- Package search and filtering
- Package analytics
- Package notes (CRUD)
- Validation and authorization

#### Courier Routes (`test_couriers.py`) - 30 tests
- Route creation and management
- Route activation/deactivation
- Available packages for routes
- Route analytics
- Geographic matching

#### Admin Routes (`test_admin.py`) - 25 tests
- User management (list, activate, deactivate)
- Package management
- Platform statistics
- Audit log retrieval
- Role-based access control

#### Matching Routes (`test_matching.py`) - 14 tests
- Package-route matching algorithm
- Distance calculations
- Match scoring
- Filtering by deviation

#### Notifications Routes (`test_notifications.py`) - 15 tests
- Notification retrieval
- Marking as read
- Unread count
- Notification filtering
- Real-time updates

### E2E Tests (Initial)

#### User Registration & Login (`registration.spec.ts`) - 8 tests
- TC-AUTH-001 to TC-AUTH-008
- Registration flow validation
- Email verification
- Login/logout flows
- Error handling

#### Package Creation & Management (`packages.spec.ts`) - 8 tests
- TC-PKG-001 to TC-PKG-008
- Package creation workflow
- Package editing
- Package cancellation
- Status updates

#### Courier Route Creation (`courier-routes.spec.ts`) - 8 tests
- TC-ROUTE-001 to TC-ROUTE-008
- Route creation
- Route activation/deactivation
- Package matching
- Route analytics

---

## Phase 2: Backend Advanced Tests

**Total: 173 tests (148 backend + 25 E2E)**

### Advanced API Tests

#### Ratings Routes (`test_ratings.py`) - 30 tests
- Rating creation and validation
- Rating retrieval (given/received)
- Average rating calculations
- Rating filtering
- Mutual rating requirements

#### Messages Routes (`test_messages.py`) - 28 tests
- Conversation creation
- Message sending
- Message retrieval
- Read status tracking
- Conversation listing
- Unread counts

#### Bids Routes (`test_bids.py`) - 35 tests
- Bid creation and validation
- Bid acceptance/rejection
- Bid withdrawal
- Deadline management
- Multiple bid scenarios

#### Payments Routes (`test_payments.py`) - 30 tests
- Payment method management
- Payment intent creation
- Payment confirmation
- Failed payment handling
- Refunds

#### Payouts Routes (`test_payouts.py`) - 25 tests
- Payout requests
- Balance retrieval
- Minimum threshold validation
- Payout history

### E2E Tests (Advanced)

#### Bidding System (`bidding.spec.ts`) - 10 tests
- TC-BID-001 to TC-BID-010
- Creating bids
- Accepting/rejecting bids
- Deadline extensions
- Bid notifications

#### Messaging System (`messaging.spec.ts`) - 5 tests
- TC-MSG-001 to TC-MSG-005
- Starting conversations
- Sending messages
- Real-time updates

#### Tracking (`tracking.spec.ts`) - 10 tests
- TC-TRACK-001 to TC-TRACK-010
- Starting tracking sessions
- Location updates
- Delay reporting
- ETA calculations
- Tracking history

---

## Phase 3: Frontend Component Tests

**Total: 1,103 tests**

### UI Components (168 tests)

#### Button (`Button.test.tsx`) - 30 tests
- All 6 variants (primary, secondary, outline, ghost, error, success)
- 3 sizes (sm, md, lg)
- Loading states
- Disabled states
- Icon support
- Full width option

#### Modal (`Modal.test.tsx`) - 45 tests
- Compound components (Header, Body, Footer)
- Open/close behavior
- Overlay clicks
- Escape key handling
- Body scroll locking
- Focus management
- Different sizes

#### Badge (`Badge.test.tsx`) - 27 tests
- 7 variants
- 2 sizes
- Dot indicator
- Removable functionality
- Custom styling

#### Alert (`Alert.test.tsx`) - 26 tests
- 4 variants
- Default and custom icons
- Dismissible behavior
- Accessibility

#### Card (`Card.test.tsx`) - 40 tests
- Compound components (Header, Content, Footer)
- Padding options
- Hoverable state
- Custom styling

### Bidding Components (99 tests)

#### BidCard (`BidCard.test.tsx`) - 32 tests
- Bid display with status
- Rating integration
- Price and ETA display
- Action buttons
- Status badges

#### BidModal (`BidModal.test.tsx`) - 27 tests
- Form validation
- Bid submission
- Error handling
- Loading states
- API integration

#### BidsList (`BidsList.test.tsx`) - 40 tests
- List rendering
- Polling mechanism
- Sorting options
- Empty states
- Winner selection

### Delivery Proof Components (105 tests)

#### DeliveryProofCard (`DeliveryProofCard.test.tsx`) - 40 tests
- Proof display
- Image modals
- Location data
- Timestamp formatting
- Action buttons

#### PhotoCapture (`PhotoCapture.test.tsx`) - 30 tests
- File upload
- File validation
- Image preview
- Camera access
- Error handling

#### SignaturePad (`SignaturePad.test.tsx`) - 35 tests
- Canvas drawing (mouse/touch)
- Clear functionality
- Export to base64
- Validation
- Responsive sizing

### Payment Components (97 tests)

#### PaymentMethodCard (`PaymentMethodCard.test.tsx`) - 32 tests
- Card brand display
- Expiry formatting
- Default badge
- Set default action
- Remove action
- Loading states

#### EarningsCard (`EarningsCard.test.tsx`) - 30 tests
- Earnings display
- Balance information
- Payout requests
- Currency formatting
- Empty states

#### TransactionList (`TransactionList.test.tsx`) - 35 tests
- Transaction display
- Status badges
- Sender/courier views
- Refunds
- Date formatting
- Click handling

### Analytics Components (400 tests)

#### StatsCard (`StatsCard.test.tsx`) - 400 tests
- **StatsCard** - Main display variant
  - All 5 variants (default, primary, success, warning, error)
  - Trend display (up/down with colors)
  - Icon support
  - Number formatting
  - Description text
- **StatsCardInline** - Compact variant
  - Variants and sizing
  - Icon integration
- **StatsGrid** - Layout helper
  - Column configurations (2, 3, 4)
  - Gap and spacing
  - Responsive breakpoints

### Common Components (234 tests)

#### CountdownTimer (`CountdownTimer.test.tsx`) - 56 tests
- Time calculation and display
- Real-time countdown updates
- Urgency states (default, urgent, critical)
- Expiry callback
- Label visibility
- Null deadline handling

#### EmptyState (`EmptyState.test.tsx`) - 84 tests
- 7 variants (default, packages, routes, messages, notifications, search, error)
- Custom icon support
- Primary and secondary actions
- Preset components:
  - EmptyPackages
  - EmptyRoutes
  - EmptyMessages
  - EmptyNotifications
  - EmptySearchResults
  - ErrorState

#### ConnectionStatus (`ConnectionStatus.test.tsx`) - 94 tests
- **ConnectionStatus** - Main component
  - 4 states (connected, connecting, disconnected, error)
  - Pulse animations
  - 3 sizes (sm, md, lg)
  - Label visibility
  - ARIA labels and tooltips
- **ConnectionStatusBadge** - Compact variant
  - Status colors
  - Dot display
  - Layout and styling

---

## Phase 4: Background Jobs & Services

**Total: 354 tests (64 new + 290 existing)**

### Background Jobs

#### Bid Deadline Job (`test_bid_deadline_job.py`) - 40+ tests
- **send_deadline_warning** (5 tests)
  - Warning notification creation
  - Marking warning as sent
  - Bid count in messages
  - Missing sender handling

- **extend_deadline** (5 tests)
  - Extension by configured hours
  - Incrementing extension count
  - Resetting warning flag
  - Extension notifications

- **expire_all_bids** (6 tests)
  - Expiring pending bids
  - Resetting package status
  - Sender/courier notifications
  - Handling empty bids

- **run_bid_deadline_job** (24+ tests)
  - Warning timing
  - Deadline extensions
  - Max extension handling
  - Dry run mode
  - Filtering logic
  - Error handling

#### Matching Job (`test_matching_job.py`) - ~30 tests (existing)
- Haversine distance calculations
- Package-route matching
- Recent notification checks
- Match notification creation
- Job execution
- Admin endpoints

#### Route Cleanup Job (`test_route_cleanup_job.py`) - ~30 tests (existing)
- Expired route deactivation
- Bid withdrawal
- Future route handling
- Dry run mode
- Multiple routes
- Admin endpoints

### Core Services

#### User Service (`test_user_service.py`) - 24 tests
- **get_user_active_packages** (11 tests)
  - Packages as sender
  - Packages as courier
  - Blocking status filtering
  - Active package filtering

- **can_deactivate_user** (13 tests)
  - Deactivation validation
  - Error messages
  - Package details
  - Terminal state handling

#### WebSocket Manager (`test_websocket_manager.py`) - ~40 tests (existing)
- Connection management
- Broadcasting
- Room management
- Error handling

#### Package Status (`test_package_status.py`) - ~60 tests (existing)
- Status transitions
- Validation
- State machine enforcement
- Error conditions

#### Audit Service (`test_audit_log.py`) - ~50 tests (existing)
- Audit log creation
- Sensitive operation tracking
- Log retrieval
- Filtering

### Integration Services

#### Stripe Service (`test_stripe_service.py`) - ~40 tests (existing)
- Payment intents
- Refunds
- Connected accounts
- Payouts

#### Tracking Service (`test_tracking_service.py`) - ~40 tests (existing)
- Location updates
- Session management
- Redis caching
- History retrieval

---

## Running Tests

### Backend Tests

```bash
cd backend
source venv/bin/activate

# Run all tests
pytest

# Run with coverage
pytest --cov=app tests/

# Run specific test file
pytest tests/test_packages.py

# Run specific test function
pytest tests/test_packages.py::test_create_package_success -v

# Run tests matching pattern
pytest -k "test_create"

# Run with verbose output
pytest -v

# Run and stop at first failure
pytest -x
```

### Frontend Unit Tests

```bash
cd frontend

# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- Button.test.tsx

# Update snapshots
npm test -- -u
```

### E2E Tests

```bash
cd frontend

# Run all E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Run specific test file
npm run test:e2e -- e2e/bidding.spec.ts

# Debug mode
npm run test:e2e:debug
```

---

## Test Coverage

### Current Coverage Metrics

#### Backend API Routes
- Authentication: **100%** coverage
- Packages: **95%** coverage
- Couriers: **90%** coverage
- Admin: **85%** coverage
- Bidding: **90%** coverage
- Payments: **85%** coverage
- Messaging: **90%** coverage

#### Backend Services
- Background Jobs: **95%** coverage
- WebSocket Manager: **90%** coverage
- Package Status: **100%** coverage
- Audit Service: **85%** coverage
- Stripe Integration: **80%** coverage

#### Frontend Components
- UI Components: **95%** coverage
- Bidding Components: **90%** coverage
- Payment Components: **85%** coverage
- Delivery Proof: **90%** coverage
- Analytics: **95%** coverage

#### E2E Workflows
- Critical Paths: **100%** coverage
- User Registration/Auth: **100%** coverage
- Package Lifecycle: **90%** coverage
- Bidding Flow: **95%** coverage
- Payment Flow: **85%** coverage

### Coverage Goals

- **Unit Tests**: 90%+ line coverage
- **Integration Tests**: 80%+ coverage of critical paths
- **E2E Tests**: 100% coverage of user-critical workflows

---

## Best Practices

### Backend Testing

1. **Use Fixtures for Setup**
   ```python
   @pytest.fixture
   def test_package(db_session, test_user):
       package = Package(
           sender_id=test_user.id,
           # ... other fields
       )
       db_session.add(package)
       db_session.commit()
       return package
   ```

2. **Test Authorization**
   ```python
   def test_unauthorized_access(client):
       response = client.get("/api/admin/users")
       assert response.status_code == 401
   ```

3. **Test Edge Cases**
   ```python
   def test_create_package_with_invalid_coordinates():
       # Test with lat > 90, lng > 180, etc.
   ```

4. **Mock External Services**
   ```python
   @patch('app.services.stripe_service.stripe.PaymentIntent.create')
   def test_payment_creation(mock_stripe):
       # Test without hitting real Stripe API
   ```

### Frontend Testing

1. **Test User Interactions**
   ```typescript
   it('submits form on button click', () => {
     render(<MyForm />);
     fireEvent.click(screen.getByRole('button'));
     expect(mockSubmit).toHaveBeenCalled();
   });
   ```

2. **Test Accessibility**
   ```typescript
   it('has accessible label', () => {
     render(<MyComponent />);
     expect(screen.getByLabelText('Submit')).toBeInTheDocument();
   });
   ```

3. **Test Loading States**
   ```typescript
   it('shows loading spinner', () => {
     render(<MyComponent isLoading={true} />);
     expect(screen.getByText('Loading...')).toBeInTheDocument();
   });
   ```

4. **Test Error States**
   ```typescript
   it('displays error message', () => {
     render(<MyComponent error="Failed to load" />);
     expect(screen.getByText('Failed to load')).toBeInTheDocument();
   });
   ```

### E2E Testing

1. **Use Page Object Model**
   ```typescript
   const loginPage = {
     emailInput: () => page.getByLabel('Email'),
     passwordInput: () => page.getByLabel('Password'),
     submitButton: () => page.getByRole('button', { name: 'Sign In' }),
   };
   ```

2. **Wait for Elements**
   ```typescript
   await expect(page.getByText('Welcome')).toBeVisible({ timeout: 5000 });
   ```

3. **Clean Up After Tests**
   ```typescript
   test.afterEach(async ({ page }) => {
     // Clean up test data
   });
   ```

4. **Test Critical Paths First**
   - Registration → Login → Create Package → Bid → Payment → Delivery

---

## CI/CD Integration

### GitHub Actions Workflow (Recommended)

```yaml
name: Tests

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
      - name: Run tests
        run: |
          cd backend
          pytest --cov=app tests/

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: |
          cd frontend
          npm ci
      - name: Run tests
        run: |
          cd frontend
          npm test -- --coverage

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install Playwright
        run: |
          cd frontend
          npm ci
          npx playwright install chromium
      - name: Run E2E tests
        run: |
          cd frontend
          npm run test:e2e
```

### Pre-commit Hooks

```bash
# .git/hooks/pre-commit
#!/bin/bash

echo "Running backend tests..."
cd backend && pytest || exit 1

echo "Running frontend tests..."
cd ../frontend && npm test || exit 1

echo "All tests passed!"
```

---

## Test Data Management

### Fixtures

Backend fixtures are centralized in `backend/tests/conftest.py`:

```python
@pytest.fixture
def authenticated_sender(client, db_session):
    """Returns JWT token for authenticated sender"""

@pytest.fixture
def authenticated_courier(client, db_session):
    """Returns JWT token for authenticated courier"""

@pytest.fixture
def authenticated_admin(client, db_session):
    """Returns JWT token for authenticated admin"""

@pytest.fixture
def test_package_data():
    """Returns sample package data"""

@pytest.fixture
def test_route_data():
    """Returns sample route data"""
```

Frontend fixtures are in `frontend/e2e/fixtures/`:

```typescript
export const TEST_USERS = {
  sender: { email: 'sender@test.com', password: 'password123' },
  courier: { email: 'courier@test.com', password: 'password123' },
};

export async function loginUser(page, user) {
  // Login helper
}
```

### Test Database

- Backend uses **SQLite in-memory** database
- Each test gets a fresh database
- Migrations run automatically
- No cleanup needed between tests

---

## Troubleshooting

### Common Issues

1. **Tests failing with database errors**
   ```bash
   # Reset database
   cd backend
   rm test.db
   pytest
   ```

2. **E2E tests timing out**
   ```typescript
   // Increase timeout
   await expect(element).toBeVisible({ timeout: 10000 });
   ```

3. **Mock not working**
   ```python
   # Ensure correct import path
   @patch('app.routes.packages.some_function')  # Not app.services.some_function
   ```

4. **Coverage not accurate**
   ```bash
   # Clear coverage cache
   rm -rf .coverage .pytest_cache
   pytest --cov=app tests/
   ```

---

## Future Testing Improvements

### Planned Enhancements

1. **Performance Testing**
   - Load testing with Locust
   - API response time monitoring
   - Database query optimization

2. **Security Testing**
   - SQL injection tests
   - XSS vulnerability tests
   - Authentication bypass attempts

3. **Visual Regression Testing**
   - Screenshot comparison
   - CSS regression detection
   - Cross-browser compatibility

4. **Contract Testing**
   - API contract validation
   - Schema versioning tests
   - Backward compatibility

5. **Mutation Testing**
   - Code quality verification
   - Test effectiveness measurement
   - Coverage gap identification

---

## Contributing

### Adding New Tests

1. **Backend API Test**
   ```python
   # tests/test_new_feature.py
   class TestNewFeature:
       def test_feature_success(self, client, authenticated_user):
           response = client.post("/api/new-feature", json={...})
           assert response.status_code == 200
   ```

2. **Frontend Component Test**
   ```typescript
   // components/__tests__/NewComponent.test.tsx
   describe('NewComponent', () => {
     it('renders correctly', () => {
       render(<NewComponent />);
       expect(screen.getByText('Hello')).toBeInTheDocument();
     });
   });
   ```

3. **E2E Test**
   ```typescript
   // e2e/new-feature.spec.ts
   test('TC-NEW-001: User can access new feature', async ({ page }) => {
     // Test implementation
   });
   ```

### Test Naming Conventions

- **Backend**: `test_<feature>_<scenario>`
- **Frontend**: `<Component/Feature> <should/displays/handles> <behavior>`
- **E2E**: `TC-<AREA>-<NUMBER>: <Description>`

---

## Summary Statistics

### Test Distribution

| Category | Tests | Percentage |
|----------|-------|------------|
| Backend API | 295 | 16% |
| Backend Services | 354 | 20% |
| Frontend Components | 1,103 | 61% |
| E2E Tests | 49 | 3% |
| **TOTAL** | **1,801** | **100%** |

### Coverage by Module

| Module | Unit Tests | Integration Tests | E2E Tests | Total |
|--------|-----------|-------------------|-----------|-------|
| Authentication | 28 | 5 | 8 | 41 |
| Packages | 35 | 10 | 8 | 53 |
| Bidding | 35 | 10 | 10 | 55 |
| Payments | 30 | 8 | 5 | 43 |
| Messaging | 28 | 5 | 5 | 38 |
| Tracking | 20 | 8 | 10 | 38 |
| Delivery Proof | 105 | 5 | 5 | 115 |
| UI Components | 168 | - | - | 168 |
| Background Jobs | 100 | 20 | - | 120 |
| **TOTAL** | **549** | **71** | **51** | **671** |

*(Note: Some tests counted in multiple categories)*

---

## Resources

### Documentation
- [Pytest Documentation](https://docs.pytest.org/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [Jest Documentation](https://jestjs.io/)

### Internal Docs
- [Backend API Documentation](./backend/README.md)
- [Frontend Component Library](./frontend/README.md)
- [CLAUDE.md](./CLAUDE.md) - Development guidelines

### Support
- Report test failures as GitHub issues
- Tag with `testing` label
- Include test output and logs

---

**Last Updated**: 2025-11-29
**Maintained By**: Development Team
**Version**: 1.0.0
