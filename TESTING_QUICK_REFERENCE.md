# Testing Quick Reference Guide

A quick reference for common testing tasks in the Chaski project.

## Quick Commands

### Backend

```bash
# Run all tests
pytest

# Run with coverage report
pytest --cov=app --cov-report=html tests/

# Run specific file
pytest tests/test_packages.py

# Run specific test
pytest tests/test_packages.py::TestPackageRoutes::test_create_package_success

# Run tests matching pattern
pytest -k "create_package"

# Stop at first failure
pytest -x

# Verbose output
pytest -v

# Show print statements
pytest -s
```

### Frontend

```bash
# Run all unit tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific file
npm test -- Button.test.tsx

# Update snapshots
npm test -- -u

# Run E2E tests
npm run test:e2e

# Run E2E with UI
npm run test:e2e:ui

# Run E2E in headed mode
npm run test:e2e:headed
```

## Common Test Patterns

### Backend: Testing an API Endpoint

```python
def test_endpoint_success(client, authenticated_user):
    """Test successful API call."""
    response = client.post(
        "/api/endpoint",
        json={"field": "value"},
        headers={"Authorization": f"Bearer {authenticated_user}"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["field"] == "value"

def test_endpoint_unauthorized(client):
    """Test unauthorized access."""
    response = client.post("/api/endpoint", json={})
    assert response.status_code == 401

def test_endpoint_validation_error(client, authenticated_user):
    """Test validation error."""
    response = client.post(
        "/api/endpoint",
        json={"invalid": "data"},
        headers={"Authorization": f"Bearer {authenticated_user}"}
    )
    assert response.status_code == 422
```

### Backend: Testing a Service Function

```python
def test_service_function_success(db_session):
    """Test service function with valid input."""
    # Arrange
    user = User(email="test@example.com", ...)
    db_session.add(user)
    db_session.commit()

    # Act
    result = my_service_function(db_session, user.id)

    # Assert
    assert result is not None
    assert result.status == "success"

def test_service_function_error(db_session):
    """Test service function with invalid input."""
    with pytest.raises(ValueError):
        my_service_function(db_session, invalid_id=999)
```

### Frontend: Testing a Component

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const onClick = jest.fn();
    render(<MyComponent onClick={onClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('displays loading state', () => {
    render(<MyComponent isLoading={true} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('displays error message', () => {
    render(<MyComponent error="Failed to load" />);
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });
});
```

### Frontend: Testing with User Interactions

```typescript
it('submits form with valid data', async () => {
  const onSubmit = jest.fn();
  render(<MyForm onSubmit={onSubmit} />);

  // Fill in form
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'test@example.com' }
  });

  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'password123' }
  });

  // Submit
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

  // Verify
  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    });
  });
});
```

### E2E: Testing a User Flow

```typescript
test('User can complete full workflow', async ({ page }) => {
  // Navigate
  await page.goto('/');

  // Login
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait for redirect
  await expect(page).toHaveURL('/dashboard');

  // Verify logged in
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

## Testing Checklist

### Before Writing a Test

- [ ] Understand what you're testing (unit of work)
- [ ] Identify inputs and expected outputs
- [ ] Consider edge cases and error conditions
- [ ] Check if similar tests exist

### Writing the Test

- [ ] Use descriptive test names
- [ ] Follow Arrange-Act-Assert pattern
- [ ] Test one thing per test
- [ ] Make assertions specific
- [ ] Clean up after test (if needed)

### After Writing the Test

- [ ] Run the test (should pass)
- [ ] Break the code (test should fail)
- [ ] Fix the code (test should pass again)
- [ ] Check code coverage

## Fixtures Reference

### Backend Fixtures (conftest.py)

```python
# Database
db_session          # Fresh database session

# Authentication
authenticated_sender    # JWT token for sender
authenticated_courier   # JWT token for courier
authenticated_admin     # JWT token for admin
authenticated_both_role # JWT token for user with both roles

# Users
test_verified_user  # Verified user object
test_admin          # Admin user object

# Test Data
test_package_data   # Sample package data dict
test_user_data      # Sample user data dict
test_courier_data   # Sample courier route data dict
```

### Frontend Fixtures (e2e/fixtures/)

```typescript
// Test users
TEST_USERS.sender
TEST_USERS.courier
TEST_USERS.both

// Helper functions
loginUser(page, user)
createTestPackage(page, packageData)
createTestRoute(page, routeData)
```

## Mocking Guide

### Backend: Mock External Service

```python
from unittest.mock import patch, MagicMock

@patch('app.services.stripe_service.stripe.PaymentIntent.create')
def test_with_mocked_stripe(mock_stripe):
    mock_stripe.return_value = MagicMock(id='pi_123', status='succeeded')

    # Your test here
    result = create_payment_intent(amount=1000)

    assert result.id == 'pi_123'
    mock_stripe.assert_called_once()
```

### Frontend: Mock API Call

```typescript
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('/api/packages', (req, res, ctx) => {
    return res(ctx.json({ packages: [] }))
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Frontend: Mock Component

```typescript
jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
}));
```

## Debugging Tests

### Backend

```python
# Add breakpoint
import pdb; pdb.set_trace()

# Print debug info
pytest -s  # Shows print statements

# More verbose
pytest -vv

# Show locals on failure
pytest --showlocals
```

### Frontend

```typescript
// Debug component state
screen.debug();

// Debug specific element
screen.debug(screen.getByRole('button'));

// Pause test
await page.pause();  // E2E only
```

## Common Assertions

### Backend (Pytest)

```python
# Basic assertions
assert value == expected
assert value is True
assert value is not None
assert value in [1, 2, 3]

# HTTP responses
assert response.status_code == 200
assert response.status_code in [200, 201]

# JSON data
data = response.json()
assert "field" in data
assert data["count"] > 0

# Exceptions
with pytest.raises(ValueError):
    function_that_should_raise()

# Database
assert db_session.query(Model).count() == 1
```

### Frontend (Jest)

```typescript
// Component rendering
expect(element).toBeInTheDocument();
expect(element).toBeVisible();
expect(element).not.toBeInTheDocument();

// Text content
expect(element).toHaveTextContent('Hello');
expect(element).toHaveAttribute('href', '/path');

// Class names
expect(element).toHaveClass('active');

// Function calls
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledTimes(2);
expect(mockFn).toHaveBeenCalledWith(arg1, arg2);

// Async assertions
await waitFor(() => {
  expect(element).toBeInTheDocument();
});
```

## Test Coverage Tips

### View Coverage Report

```bash
# Backend
pytest --cov=app --cov-report=html tests/
open htmlcov/index.html

# Frontend
npm run test:coverage
open coverage/lcov-report/index.html
```

### Improve Coverage

1. **Identify uncovered lines**
   - Check coverage report for red highlights

2. **Add missing tests**
   - Focus on critical paths first
   - Test error conditions
   - Test edge cases

3. **Remove dead code**
   - If code can't be tested, maybe it's not needed

## Troubleshooting

### Test Fails Locally but Passes in CI

- Check environment variables
- Verify database state
- Check timezone differences
- Look for race conditions

### Test Passes Locally but Fails in CI

- Check dependencies
- Verify database migrations
- Check file paths
- Look for timing issues

### Flaky Tests

- Add explicit waits
- Mock time-dependent code
- Isolate database state
- Fix race conditions

### Slow Tests

- Mock external services
- Use smaller test datasets
- Parallelize tests
- Profile test execution

## Resources

- **Full Documentation**: [TESTING.md](./TESTING.md)
- **Project Guidelines**: [CLAUDE.md](./CLAUDE.md)
- **Pytest Docs**: https://docs.pytest.org/
- **React Testing Library**: https://testing-library.com/react
- **Playwright**: https://playwright.dev/

---

**Quick Tip**: When in doubt, look at existing similar tests!
