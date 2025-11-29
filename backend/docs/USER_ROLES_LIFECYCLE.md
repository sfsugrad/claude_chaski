# User Roles and Lifecycle Documentation

This document describes the user roles, lifecycle states, and state transitions in the Chaski platform.

## Table of Contents
1. [User Roles](#user-roles)
2. [User States](#user-states)
3. [State Transitions](#state-transitions)
4. [Role-Based Permissions](#role-based-permissions)
5. [Account Lockout](#account-lockout)

---

## User Roles

The platform has four user roles defined in `app/models/user.py`:

| Role | Value | Description |
|------|-------|-------------|
| **SENDER** | `sender` | Can create packages and request deliveries |
| **COURIER** | `courier` | Can create routes and accept delivery jobs |
| **BOTH** | `both` | Combined sender and courier capabilities |
| **ADMIN** | `admin` | Full platform management access |

### Role Selection

- **During Registration**: Users choose `sender`, `courier`, or `both`
- **Admin Role**: Cannot be self-selected; must be:
  - Created directly in database
  - Created by another admin via `POST /api/admin/users`
  - Assigned by admin via `PUT /api/admin/users/{id}/role`

### Role Restrictions

| Action | Allowed Roles |
|--------|---------------|
| Create packages | `sender`, `both`, `admin` |
| Create courier routes | `courier`, `both` |
| Submit bids | `courier`, `both` |
| Accept/match packages | `courier`, `both` |
| Request payouts | `courier`, `both` |
| View courier analytics | `courier`, `both`, `admin` |
| View sender analytics | `sender`, `both`, `admin` |
| Admin panel access | `admin` only |

---

## User States

### State Flags

Each user has multiple boolean state flags:

| State | Field | Default | Description |
|-------|-------|---------|-------------|
| **Active** | `is_active` | `true` | User can access the platform |
| **Verified** | `is_verified` | `false` | Email has been verified |
| **Phone Verified** | `phone_verified` | `false` | Phone number has been verified |
| **Locked** | `account_locked_until` | `null` | Temporary lockout (datetime or null) |

### State Combinations

```
                    ┌─────────────────────────────────────┐
                    │           User Account              │
                    └─────────────────────────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           │                         │                         │
    ┌──────▼──────┐          ┌───────▼───────┐         ┌──────▼──────┐
    │   Active    │          │   Inactive    │         │   Locked    │
    │ is_active=T │          │ is_active=F   │         │ locked_until│
    └──────┬──────┘          └───────────────┘         │   != null   │
           │                                           └─────────────┘
    ┌──────┴──────┐
    │             │
┌───▼───┐   ┌─────▼─────┐
│Unverified│ │  Verified  │
│is_verified│ │is_verified │
│  =false  │ │   =true    │
└──────────┘ └────────────┘
```

### Effective Access States

| is_active | is_verified | account_locked | Can Login | Can Use Platform |
|-----------|-------------|----------------|-----------|------------------|
| `true` | `true` | `null` | ✅ Yes | ✅ Full access |
| `true` | `false` | `null` | ✅ Yes | ⚠️ Limited (email verification required for some actions) |
| `true` | `true` | `<future_date>` | ❌ No (locked) | ❌ No |
| `false` | any | any | ❌ No | ❌ No |

---

## State Transitions

### 1. Verification State (`is_verified`)

```
                          User registers
                                │
                                ▼
                    ┌───────────────────────┐
                    │   is_verified=false   │
                    │  (unverified email)   │
                    └───────────┬───────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Email verify  │     │  Google OAuth   │     │  Admin manual   │
│ GET /verify-  │     │  (auto-verify)  │     │  verification   │
│ email/{token} │     │                 │     │                 │
└───────┬───────┘     └────────┬────────┘     └────────┬────────┘
        │                      │                       │
        └──────────────────────┼───────────────────────┘
                               │
                               ▼
                    ┌───────────────────────┐
                    │   is_verified=true    │
                    │   (verified email)    │
                    └───────────────────────┘
```

**Who Can Change:**
| Actor | Method | Endpoint |
|-------|--------|----------|
| User (self) | Click email link | `GET /api/auth/verify-email/{token}` |
| System | Google OAuth login | `GET /api/auth/google/callback` |
| Admin | Manual toggle | `PUT /api/admin/users/{id}/toggle-verified` |

**Restrictions:**
- Token expires after 24 hours
- User can request new token via `POST /api/auth/resend-verification`

---

### 2. Active State (`is_active`)

```
                    ┌───────────────────────┐
                    │    is_active=true     │
                    │   (active account)    │
                    └───────────┬───────────┘
                                │
                    Admin deactivates user
                    PUT /admin/users/{id}/toggle-active
                                │
                                ▼
                    ┌───────────────────────┐
                    │    is_active=false    │
                    │  (deactivated account)│
                    └───────────┬───────────┘
                                │
                    Admin reactivates user
                    PUT /admin/users/{id}/toggle-active
                                │
                                ▼
                    ┌───────────────────────┐
                    │    is_active=true     │
                    │   (active account)    │
                    └───────────────────────┘
```

**Who Can Change:**
| Actor | Method | Endpoint |
|-------|--------|----------|
| Admin only | Toggle active status | `PUT /api/admin/users/{id}/toggle-active` |

**Restrictions:**
- Admin cannot deactivate themselves
- Cannot deactivate users with active packages (in-transit, pending pickup, etc.)
- Deactivated users cannot:
  - Login
  - Use any API endpoints
  - Receive password reset emails

**Pre-deactivation Check:**
```python
def can_deactivate_user(db, user_id):
    # Checks for packages in non-terminal states:
    # - As sender: NEW, OPEN_FOR_BIDS, BID_SELECTED, PENDING_PICKUP, IN_TRANSIT
    # - As courier: PENDING_PICKUP, IN_TRANSIT
    # Returns (can_deactivate, error_message, details)
```

---

### 3. Account Lockout (`account_locked_until`)

```
                    ┌───────────────────────┐
                    │  account_locked_until │
                    │       = null          │
                    │   (unlocked account)  │
                    └───────────┬───────────┘
                                │
              5 failed login attempts in 15 min
                      (automatic lockout)
                                │
                                ▼
                    ┌───────────────────────┐
                    │  account_locked_until │
                    │   = now + 15 minutes  │
                    │   (locked account)    │
                    └───────────┬───────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Wait 15 min  │     │  Admin unlock   │     │  Time expires   │
│  (automatic)  │     │ (manual unlock) │     │  (automatic)    │
└───────┬───────┘     └────────┬────────┘     └────────┬────────┘
        │                      │                       │
        └──────────────────────┼───────────────────────┘
                               │
                               ▼
                    ┌───────────────────────┐
                    │  account_locked_until │
                    │       = null          │
                    │   (unlocked account)  │
                    └───────────────────────┘
```

**Who Can Change:**
| Actor | Method | Trigger |
|-------|--------|---------|
| System | Automatic lock | 5 failed login attempts in 15 minutes |
| System | Automatic unlock | Lockout period expires (15 min) |
| Admin | Manual unlock | Via `unlock_account()` function |

**Configuration:**
```python
MAX_LOGIN_ATTEMPTS = 5        # Failed attempts before lockout
LOCKOUT_DURATION_MINUTES = 15 # Lockout duration
ATTEMPT_WINDOW_MINUTES = 15   # Window to count failures
```

---

### 4. Role Changes

```
                         Role Transition Diagram
                         (Strict Hierarchy)

                         ┌──────────────┐
                         │    ADMIN     │
                         │  (highest)   │
                         └──────┬───────┘
                                │
                                ▼ only to/from BOTH
                                │
                         ┌──────┴───────┐
                         │     BOTH     │
                         │  (middle)    │
                         └──────┬───────┘
                                │
                 ┌──────────────┴──────────────┐
                 │                             │
                 ▼                             ▼
          ┌──────────┐                  ┌──────────┐
          │  SENDER  │                  │ COURIER  │
          │ (lowest) │                  │ (lowest) │
          └──────────┘                  └──────────┘

        ════════════════════════════════════════════════════
        ✅ ALLOWED: sender→both, courier→both, both↔admin
        ❌ FORBIDDEN: All other transitions
        ════════════════════════════════════════════════════
```

**Who Can Change:**
| Actor | Method | Endpoint |
|-------|--------|----------|
| Admin only | Change any user's role | `PUT /api/admin/users/{id}` |

**Allowed Transitions (Whitelist):**
| From | To | Allowed | Description |
|------|-----|---------|-------------|
| sender | both | ✅ Yes | Upgrade to dual role |
| courier | both | ✅ Yes | Upgrade to dual role |
| both | admin | ✅ Yes | Promote to admin |
| admin | both | ✅ Yes | Demote from admin |

**Forbidden Transitions:**
| From | To | Why |
|------|-----|-----|
| sender | courier | Must go through `both` |
| sender | admin | Must go through `both` first |
| courier | sender | Must go through `both` |
| courier | admin | Must go through `both` first |
| both | sender | Cannot demote (one-way upgrade) |
| both | courier | Cannot demote (one-way upgrade) |
| admin | sender | Cannot skip levels |
| admin | courier | Cannot skip levels |

**Multi-Step Transitions:**
| Goal | Steps Required |
|------|----------------|
| sender → admin | sender → both → admin (2 steps) |
| courier → admin | courier → both → admin (2 steps) |
| admin → sender | ❌ Not possible (admin can only go to both) |
| admin → courier | ❌ Not possible (admin can only go to both) |

**Restrictions:**
- Admins cannot change their own role
- Only 4 specific transitions are allowed (see whitelist above)
- Role changes are audit logged

**Error Response Example:**
```json
{
  "detail": {
    "message": "Role transition from sender to admin is not allowed.",
    "current_role": "sender",
    "requested_role": "admin",
    "allowed_transitions": {
      "sender": ["both"],
      "courier": ["both"],
      "both": ["admin"],
      "admin": ["both"]
    },
    "suggestion": "sender → both → admin"
  }
}
```

**Rationale:**
This strict hierarchy ensures:
1. **No accidental downgrades**: Users with `both` or `admin` roles cannot be accidentally reduced to `sender` or `courier`
2. **Clear upgrade path**: sender/courier → both → admin provides a clear progression
3. **Admin protection**: Admins can only be demoted to `both`, never directly to a basic role
4. **Audit trail**: Multi-step transitions create clear audit logs of role changes

---

## Role-Based Permissions

### API Endpoint Access Matrix

| Endpoint Category | SENDER | COURIER | BOTH | ADMIN |
|-------------------|--------|---------|------|-------|
| **Packages** |
| Create package | ✅ | ❌ | ✅ | ✅ |
| View own packages | ✅ | ✅ | ✅ | ✅ |
| View all packages | ❌ | ❌ | ❌ | ✅ |
| **Routes** |
| Create route | ❌ | ✅ | ✅ | ❌ |
| View matching packages | ❌ | ✅ | ✅ | ❌ |
| **Bids** |
| Submit bid | ❌ | ✅ | ✅ | ❌ |
| Accept bid (as sender) | ✅ | ❌ | ✅ | ✅ |
| **Payments** |
| Pay for package | ✅ | ❌ | ✅ | ❌ |
| Request payout | ❌ | ✅ | ✅ | ❌ |
| **Tracking** |
| Update location | ❌ | ✅ | ✅ | ❌ |
| View tracking | ✅ | ✅ | ✅ | ✅ |
| **Admin** |
| User management | ❌ | ❌ | ❌ | ✅ |
| View audit logs | ❌ | ❌ | ❌ | ✅ |
| Platform stats | ❌ | ❌ | ❌ | ✅ |

---

## Account Lockout

### Lockout Flow

```
User attempts login
        │
        ▼
┌───────────────────┐
│ Check if locked   │──────Yes──────┐
└─────────┬─────────┘               │
          │ No                      │
          ▼                         ▼
┌───────────────────┐     ┌─────────────────┐
│ Verify credentials│     │ Return 403      │
└─────────┬─────────┘     │ "Account locked │
          │               │ for X minutes"  │
    ┌─────┴─────┐         └─────────────────┘
    │           │
 Success     Failure
    │           │
    ▼           ▼
┌─────────┐  ┌────────────────┐
│ Login   │  │ Record failed  │
│ success │  │ attempt        │
└─────────┘  └────────┬───────┘
                      │
                      ▼
              ┌───────────────────┐
              │ >= 5 attempts in  │──Yes──┐
              │ last 15 minutes?  │       │
              └─────────┬─────────┘       │
                        │ No              │
                        ▼                 ▼
              ┌───────────────┐   ┌───────────────┐
              │ Return 401    │   │ Lock account  │
              │ "Invalid      │   │ for 15 min    │
              │ credentials"  │   └───────────────┘
              └───────────────┘
```

### Failure Reasons Tracked

| Reason | Description |
|--------|-------------|
| `user_not_found` | No user with that email |
| `invalid_password` | Wrong password |
| `account_locked` | Account currently locked |
| `account_inactive` | Account deactivated by admin |

---

## Complete User Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER LIFECYCLE                            │
└─────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │  REGISTER    │
    │ POST /auth/  │
    │   register   │
    └──────┬───────┘
           │
           ▼
┌─────────────────────┐
│   UNVERIFIED USER   │
│ is_active=true      │
│ is_verified=false   │
│ role=sender/courier │
│       /both         │
└──────────┬──────────┘
           │
           │ Email verification OR Google OAuth
           ▼
┌─────────────────────┐
│   VERIFIED USER     │
│ is_active=true      │◄───────────────────────────┐
│ is_verified=true    │                            │
│ role=sender/courier │    Reactivated by admin    │
│       /both         │                            │
└──────────┬──────────┘                            │
           │                                       │
           │ 5+ failed logins                      │
           ▼                                       │
┌─────────────────────┐                            │
│   LOCKED USER       │                            │
│ account_locked_until│                            │
│   = future time     │                            │
└──────────┬──────────┘                            │
           │                                       │
           │ Wait 15 min OR admin unlock           │
           ▼                                       │
┌─────────────────────┐                            │
│   VERIFIED USER     │                            │
│ (back to normal)    │                            │
└──────────┬──────────┘                            │
           │                                       │
           │ Admin deactivates                     │
           ▼                                       │
┌─────────────────────┐                            │
│  DEACTIVATED USER   │────────────────────────────┘
│ is_active=false     │
│ Cannot login        │
│ No API access       │
└─────────────────────┘

    ┌──────────────────────────────────────────────────────────┐
    │                    ADMIN ACTIONS                          │
    │                                                          │
    │  • Create users (any role)    PUT /admin/users           │
    │  • Change roles               PUT /admin/users/{id}/role │
    │  • Activate/deactivate        PUT /admin/users/{id}/     │
    │                                   toggle-active          │
    │  • Verify/unverify            PUT /admin/users/{id}/     │
    │                                   toggle-verified        │
    │  • Delete user                DELETE /admin/users/{id}   │
    │  • Unlock account             (via code - unlock_account)│
    └──────────────────────────────────────────────────────────┘
```

---

## Audit Logging

All state changes are logged to the `audit_logs` table:

| Action | Description |
|--------|-------------|
| `LOGIN_SUCCESS` | Successful login |
| `LOGIN_FAILED` | Failed login attempt |
| `REGISTER` | New user registration |
| `EMAIL_VERIFICATION` | Email verified |
| `ACCOUNT_LOCKED` | Account locked due to failed attempts |
| `USER_ROLE_CHANGE` | Role changed by admin |
| `USER_ACTIVATE` | Account activated by admin |
| `USER_DEACTIVATE` | Account deactivated by admin |
| `USER_VERIFY` | Email manually verified by admin |
| `USER_UNVERIFY` | Email unverified by admin |
| `PASSWORD_CHANGED` | Password changed |
| `PASSWORD_RESET_REQUEST` | Password reset requested |
| `PASSWORD_RESET_COMPLETE` | Password reset completed |

---

## Related Files

| File | Description |
|------|-------------|
| `app/models/user.py` | User model with role enum and state fields |
| `app/routes/auth.py` | Authentication endpoints |
| `app/routes/admin.py` | Admin management endpoints |
| `app/services/auth_security.py` | Login tracking and lockout logic |
| `app/utils/dependencies.py` | `get_current_user`, `get_current_admin_user` |
