# Chaski Manual QA Test Cases

This document contains comprehensive manual QA test cases for the Chaski logistics platform.

## Table of Contents
1. [Test Environment Setup](#test-environment-setup)
2. [Test Users](#test-users)
3. [Authentication Tests](#1-authentication-tests)
4. [Sender Workflow Tests](#2-sender-workflow-tests)
5. [Courier Workflow Tests](#3-courier-workflow-tests)
6. [Messaging Tests](#4-messaging-tests)
7. [Notification Tests](#5-notification-tests)
8. [Rating & Review Tests](#6-rating--review-tests)
9. [Admin Tests](#7-admin-tests)
10. [Responsive Design Tests](#8-responsive-design-tests)
11. [Error Handling Tests](#9-error-handling-tests)
12. [WebSocket Tests](#10-websocket-tests)

---

## Test Environment Setup

### Prerequisites
- Backend running on `http://localhost:8000`
- Frontend running on `http://localhost:3000`
- PostgreSQL database with test data loaded
- Gmail SMTP configured (or use manual email verification)

### Browser Requirements
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Mobile: Chrome/Safari on iOS/Android

---

## Test Users

| Email | Password | Role | Purpose |
|-------|----------|------|---------|
| john.sender@example.com | password123 | sender | Sender workflow testing |
| mike.courier@example.com | password123 | courier | Courier workflow testing |
| sarah.both@example.com | password123 | both | Dual-role testing |
| admin@chaski.com | admin123 | admin | Admin testing |

---

## 1. Authentication Tests

### TC-AUTH-001: User Registration (Sender)
**Priority:** High
**Precondition:** User not logged in

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/register` | Registration form displays |
| 2 | Enter email: `newsender@test.com` | Email field accepts input |
| 3 | Enter password: `Test1234` | Password field masked |
| 4 | Enter full name: `New Sender` | Name field accepts input |
| 5 | Enter phone: `555-1234` (optional) | Phone field accepts input |
| 6 | Select role: `sender` | Role selected, default address field appears |
| 7 | Enter default address using autocomplete | Address selected with coordinates |
| 8 | Click "Register" | Redirect to `/register-success` |
| 9 | Check email inbox | Verification email received |

### TC-AUTH-002: User Registration (Courier)
**Priority:** High
**Precondition:** User not logged in

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/register` | Registration form displays |
| 2 | Enter email: `newcourier@test.com` | Email field accepts input |
| 3 | Enter password: `Test1234` | Password field masked |
| 4 | Enter full name: `New Courier` | Name field accepts input |
| 5 | Select role: `courier` | Role selected, max deviation field appears |
| 6 | Enter max deviation: `10` km | Deviation field accepts 1-50 range |
| 7 | Click "Register" | Redirect to `/register-success` |

### TC-AUTH-003: User Registration (Both Roles)
**Priority:** High
**Precondition:** User not logged in

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/register` | Registration form displays |
| 2 | Select role: `both` | Both address AND deviation fields appear |
| 3 | Fill all required fields | Form accepts all inputs |
| 4 | Enter default address | Address autocomplete works |
| 5 | Enter max deviation: `5` | Deviation field accepts input |
| 6 | Click "Register" | Redirect to `/register-success` |

### TC-AUTH-004: Registration Validation - Invalid Email
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/register` | Form displays |
| 2 | Enter invalid email: `notanemail` | Error: "Invalid email format" |
| 3 | Enter email: `test@` | Error: "Invalid email format" |

### TC-AUTH-005: Registration Validation - Weak Password
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/register` | Form displays |
| 2 | Enter password: `123` | Error: "Password must be at least 8 characters" |
| 3 | Enter password: `short` | Error: "Password must be at least 8 characters" |

### TC-AUTH-006: Registration - Duplicate Email
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/register` | Form displays |
| 2 | Enter existing email: `john.sender@example.com` | - |
| 3 | Fill other fields and submit | Error: "Email already registered" |

### TC-AUTH-007: Email Verification
**Priority:** High
**Precondition:** User registered but not verified

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click verification link in email | Navigate to `/verify-email?token=...` |
| 2 | Wait for verification | Success message displays |
| 3 | Wait 3 seconds | Auto-redirect to `/login?verified=true` |
| 4 | Check login page | "Email verified" success message |

### TC-AUTH-008: Email Verification - Invalid Token
**Priority:** Medium

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/verify-email?token=invalidtoken` | Error: "Invalid or expired verification token" |

### TC-AUTH-009: Resend Verification Email
**Priority:** Medium
**Precondition:** User registered but not verified

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/resend-verification` | Form displays |
| 2 | Enter registered email | Email accepted |
| 3 | Click "Resend" | Success message |
| 4 | Check email | New verification email received |

### TC-AUTH-010: Login with Valid Credentials
**Priority:** High
**Precondition:** User exists and is verified

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/login` | Login form displays |
| 2 | Enter email: `john.sender@example.com` | Email accepted |
| 3 | Enter password: `password123` | Password masked |
| 4 | Click "Login" | Redirect to `/dashboard` |
| 5 | Check navbar | User name and avatar display |

### TC-AUTH-011: Login with Invalid Credentials
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/login` | Login form displays |
| 2 | Enter wrong password | - |
| 3 | Click "Login" | Error: "Incorrect email or password" |

### TC-AUTH-012: Login - Unverified User
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login with unverified email | Error: "Please verify your email" |
| 2 | Check for resend link | Link to resend verification available |

### TC-AUTH-013: Login - Remember Me
**Priority:** Medium

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login with "Remember me" checked | Login successful |
| 2 | Close browser completely | - |
| 3 | Reopen and navigate to app | Still logged in |
| 4 | Wait 7+ days (or check cookie expiry) | Session should persist |

### TC-AUTH-014: Login - Admin Redirect
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as admin user | Redirect to `/admin` (not `/dashboard`) |

### TC-AUTH-015: Google OAuth Login
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/login` | Google sign-in button visible |
| 2 | Click "Sign in with Google" | Redirect to Google OAuth |
| 3 | Select Google account | - |
| 4 | Authorize app | Redirect back to app |
| 5 | Check dashboard | User logged in with Google account |

### TC-AUTH-016: Forgot Password
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/forgot-password` | Form displays |
| 2 | Enter registered email | Email accepted |
| 3 | Click "Send Reset Link" | Success message (generic) |
| 4 | Check email | Password reset email received |

### TC-AUTH-017: Forgot Password - Non-existent Email
**Priority:** Medium

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter non-existent email | - |
| 2 | Click "Send Reset Link" | Same success message (no leak) |

### TC-AUTH-018: Reset Password
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click reset link from email | Navigate to `/reset-password?token=...` |
| 2 | Enter new password: `NewPass123` | Password accepted |
| 3 | Confirm password: `NewPass123` | Passwords match |
| 4 | Click "Reset Password" | Success, redirect to `/login?reset=true` |
| 5 | Login with new password | Login successful |

### TC-AUTH-019: Reset Password - Mismatched Passwords
**Priority:** Medium

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter password: `NewPass123` | - |
| 2 | Enter confirm: `DifferentPass` | Error: "Passwords do not match" |

### TC-AUTH-020: Reset Password - Expired Token
**Priority:** Medium

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Use token older than 1 hour | Error: "Token expired" |

### TC-AUTH-021: Logout
**Priority:** High
**Precondition:** User logged in

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click user dropdown in navbar | Dropdown opens |
| 2 | Click "Logout" | Redirect to `/login` |
| 3 | Try to access `/dashboard` | Redirect to `/login` |

---

## 2. Sender Workflow Tests

### TC-SEND-001: View Sender Dashboard
**Priority:** High
**Precondition:** Logged in as sender

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/sender` | Sender dashboard loads |
| 2 | Check stats cards | Shows pending, matched, delivered, cancelled counts |
| 3 | Check package list | All user's packages displayed |

### TC-SEND-002: Create Package - Basic
**Priority:** High
**Precondition:** Logged in as sender

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/packages/create` | Package form displays |
| 2 | Enter description: `Test Package` | Text accepted (max 500 chars) |
| 3 | Select size: `medium` | Size selected |
| 4 | Enter weight: `5` kg | Weight accepted |
| 5 | Enter price: `25.00` | Price accepted |
| 6 | Select pickup address (autocomplete) | Address with coordinates |
| 7 | Select dropoff address (autocomplete) | Address with coordinates |
| 8 | Click "Create Package" | Success, redirect to sender dashboard |
| 9 | Check package list | New package appears with "pending" status |

### TC-SEND-003: Create Package - With Contact Info
**Priority:** Medium

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Fill basic package info | - |
| 2 | Enter pickup contact name: `John` | Accepted |
| 3 | Enter pickup contact phone: `555-1111` | Accepted |
| 4 | Enter dropoff contact name: `Jane` | Accepted |
| 5 | Enter dropoff contact phone: `555-2222` | Accepted |
| 6 | Submit package | Contact info saved |
| 7 | View package details | Contact info displays |

### TC-SEND-004: Create Package - Auto-fill Default Address
**Priority:** Medium
**Precondition:** User has default address set

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/packages/create` | Form displays |
| 2 | Check pickup address field | Pre-filled with user's default address |

### TC-SEND-005: Create Package - Validation
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Leave description empty | Error: "Description required" |
| 2 | Enter weight: `0` | Error: "Weight must be at least 0.1 kg" |
| 3 | Enter weight: `1001` | Error: "Weight cannot exceed 1000 kg" |
| 4 | Leave pickup address empty | Error: "Pickup address required" |
| 5 | Type address without selecting from autocomplete | Error: "Please select address from suggestions" |

### TC-SEND-006: View Package Details
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click package from list | Navigate to `/packages/[id]` |
| 2 | Check package info | Description, size, weight, price display |
| 3 | Check addresses | Pickup and dropoff with coordinates |
| 4 | Check status badge | Correct status color |

### TC-SEND-007: Edit Package (Pending Only)
**Priority:** High
**Precondition:** Package in "pending" status

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View package details | "Edit" button visible |
| 2 | Click "Edit" | Form becomes editable |
| 3 | Change description | Field editable |
| 4 | Change size | Dropdown works |
| 5 | Click "Save" | Changes saved |

### TC-SEND-008: Edit Package - Not Available for Matched
**Priority:** High
**Precondition:** Package in "matched" status

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View matched package details | "Edit" button NOT visible |

### TC-SEND-009: Cancel Package (Pending)
**Priority:** High
**Precondition:** Package in "pending" status

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View package on sender dashboard | "Cancel" button visible |
| 2 | Click "Cancel" | Confirmation dialog appears |
| 3 | Confirm cancellation | Package status changes to "cancelled" |
| 4 | Check package list | Package shows cancelled status |

### TC-SEND-010: Cancel Package (Matched)
**Priority:** High
**Precondition:** Package in "matched" status

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View matched package | "Cancel" button visible |
| 2 | Cancel package | Package cancelled |
| 3 | Check courier notification | Courier receives cancellation notification |

### TC-SEND-011: Cancel Not Available for In-Transit
**Priority:** High
**Precondition:** Package in "in_transit" status

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View in-transit package | "Cancel" button NOT visible |

### TC-SEND-012: Filter Packages by Status
**Priority:** Medium

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Pending" filter | Only pending packages show |
| 2 | Click "Matched" filter | Only matched packages show |
| 3 | Click "Delivered" filter | Only delivered packages show |
| 4 | Click "All" filter | All packages show |

### TC-SEND-013: View Courier Info on Matched Package
**Priority:** High
**Precondition:** Package matched with courier

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View matched package details | Courier info section visible |
| 2 | Check courier name | Correct courier displayed |
| 3 | Check courier contact | Phone number if available |

### TC-SEND-014: Package Status Progress Bar
**Priority:** Medium

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View pending package | Progress bar at step 1 |
| 2 | View matched package | Progress bar at step 2 |
| 3 | View picked_up package | Progress bar at step 3 |
| 4 | View in_transit package | Progress bar at step 4 |
| 5 | View delivered package | Progress bar at step 5 (complete) |

---

## 3. Courier Workflow Tests

### TC-COUR-001: View Courier Dashboard
**Priority:** High
**Precondition:** Logged in as courier

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/courier` | Courier dashboard loads |
| 2 | Check for active route section | Shows active route or "no active route" |
| 3 | Check assigned packages | Shows packages assigned to courier |
| 4 | Check route history | Shows all routes |

### TC-COUR-002: Create Route
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Create New Route" | Navigate to `/courier/routes/create` |
| 2 | Select start address | Autocomplete works |
| 3 | Select end address | Autocomplete works |
| 4 | Enter max deviation: `10` km | Accepted (1-50 range) |
| 5 | Set departure time (optional) | Datetime picker works |
| 6 | Click "Create Route" | Route created, redirect to `/courier` |
| 7 | Check route history | New route appears as "Active" |

### TC-COUR-003: Create Route - Validation
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Leave start address empty | Error: "Start address required" |
| 2 | Leave end address empty | Error: "End address required" |
| 3 | Enter deviation: `0` | Error: "Must be at least 1 km" |
| 4 | Enter deviation: `51` | Error: "Cannot exceed 50 km" |

### TC-COUR-004: Activate Route
**Priority:** High
**Precondition:** Has inactive route

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find inactive route in history | "Activate" button visible |
| 2 | Click "Activate" | Confirmation dialog |
| 3 | Confirm activation | Route becomes active |
| 4 | Check previous active route | Previous route deactivated |

### TC-COUR-005: Deactivate Route
**Priority:** High
**Precondition:** Has active route

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find active route section | "Deactivate" button visible |
| 2 | Click "Deactivate" | Confirmation dialog |
| 3 | Confirm | Route becomes inactive |
| 4 | Check dashboard | No active route message |

### TC-COUR-006: View Route Matches
**Priority:** High
**Precondition:** Has active route with matching packages

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "View Matches" on active route | Navigate to `/courier/routes/[id]/matches` |
| 2 | Check package list | Matching packages displayed |
| 3 | Check sorting | Sorted by shortest detour |
| 4 | Check package cards | Show description, size, weight, detour km |

### TC-COUR-007: Accept Package from Matches
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View route matches | Package cards with "Accept" button |
| 2 | Click "Accept Package" | Confirmation dialog |
| 3 | Confirm acceptance | Package status → "matched" |
| 4 | Check courier dashboard | Package in "Assigned Packages" section |
| 5 | Check sender notification | Sender receives match notification |

### TC-COUR-008: View Assigned Packages
**Priority:** High
**Precondition:** Courier has accepted packages

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/courier` | Assigned packages section visible |
| 2 | Check package cards | Shows description, status, pickup/dropoff |
| 3 | Click "View Details" | Navigate to package detail page |
| 4 | Click "Message Sender" | Navigate to messages with package context |

### TC-COUR-009: Update Package Status - Picked Up
**Priority:** High
**Precondition:** Package in "matched" status, courier is assigned

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View package details | Status update button visible |
| 2 | Click "Mark as Picked Up" | Status → "picked_up" |
| 3 | Check sender notification | Sender notified of pickup |

### TC-COUR-010: Update Package Status - In Transit
**Priority:** High
**Precondition:** Package in "picked_up" status

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View package details | "Mark In Transit" button |
| 2 | Click button | Status → "in_transit" |

### TC-COUR-011: Update Package Status - Delivered
**Priority:** High
**Precondition:** Package in "in_transit" status

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View package details | "Mark Delivered" button |
| 2 | Click button | Status → "delivered" |
| 3 | Check notifications | Both parties notified |
| 4 | Check rating prompt | Rating modal appears |

### TC-COUR-012: No Matches Message
**Priority:** Medium
**Precondition:** Active route with no matching packages

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View route matches | "No matching packages" message |

### TC-COUR-013: First-Time Courier Welcome
**Priority:** Low
**Precondition:** Courier with no routes

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/courier` | Welcome message displays |
| 2 | Check message content | Explains how to get started |

---

## 4. Messaging Tests

### TC-MSG-001: Send Message from Package Page
**Priority:** High
**Precondition:** Package matched, logged in as sender or courier

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View package details | "Messages" section visible |
| 2 | Expand messages section | Chat window opens |
| 3 | Type message: `Hello!` | Text appears in input |
| 4 | Click send (or press Enter) | Message appears in chat |
| 5 | Check timestamp | Shows "just now" |

### TC-MSG-002: Receive Message in Real-Time
**Priority:** High
**Precondition:** Two users viewing same package

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | User A sends message | Message appears for User A |
| 2 | Check User B's chat (no refresh) | Message appears automatically |
| 3 | Check notification badge | User B sees unread count |

### TC-MSG-003: View Messages Page
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click Messages icon in navbar | Navigate to `/messages` |
| 2 | Check conversation list | All conversations displayed |
| 3 | Check conversation preview | Shows other user, package, last message |

### TC-MSG-004: Select Conversation
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click conversation in list | Chat window shows that conversation |
| 2 | Check messages | Message history loads |
| 3 | Send new message | Message appears in chat |

### TC-MSG-005: Unread Message Count
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Receive message while on different page | Navbar messages icon shows badge |
| 2 | Navigate to `/messages` | Unread conversation highlighted |
| 3 | Open conversation | Unread count decreases |

### TC-MSG-006: Direct Link to Conversation
**Priority:** Medium

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/messages?package=123` | Specific conversation opens |

### TC-MSG-007: Empty Messages State
**Priority:** Low
**Precondition:** User has no conversations

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/messages` | "No conversations" message |

### TC-MSG-008: Message from Courier Dashboard
**Priority:** Medium

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View assigned package on `/courier` | "Message Sender" button visible |
| 2 | Click "Message Sender" | Navigate to messages with package context |

---

## 5. Notification Tests

### TC-NOTIF-001: View Notification Dropdown
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click bell icon in navbar | Dropdown opens |
| 2 | Check notification list | Recent notifications shown |
| 3 | Check unread count badge | Matches unread notifications |

### TC-NOTIF-002: View All Notifications Page
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "View All" in dropdown | Navigate to `/notifications` |
| 2 | Check notifications list | All notifications displayed |
| 3 | Check filter tabs | "All" and "Unread" tabs work |

### TC-NOTIF-003: Mark Notification as Read
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View unread notification | Highlighted/bold styling |
| 2 | Click "Mark as Read" | Notification styling changes |
| 3 | Check unread count | Count decreases |

### TC-NOTIF-004: Mark All as Read
**Priority:** Medium

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Mark All as Read" | All notifications marked read |
| 2 | Check unread count | Shows 0 |

### TC-NOTIF-005: Delete Notification
**Priority:** Medium

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click delete icon on notification | Notification removed |
| 2 | Refresh page | Notification still gone |

### TC-NOTIF-006: Notification Link - Package
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "View" on package notification | Navigate to package detail |

### TC-NOTIF-007: Notification Link - Rating
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "View" on rating notification | Navigate to `/profile/reviews` |

### TC-NOTIF-008: Real-Time Notification
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger notification (e.g., accept package) | - |
| 2 | Check recipient's navbar (no refresh) | Bell icon shows new count |
| 3 | Open dropdown | New notification visible |

### TC-NOTIF-009: Notification Types Display
**Priority:** Medium

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check package_matched notification | Blue color, package icon |
| 2 | Check package_delivered notification | Green color, check icon |
| 3 | Check package_cancelled notification | Red color, cancel icon |

---

## 6. Rating & Review Tests

### TC-RATE-001: Rating Modal After Delivery
**Priority:** High
**Precondition:** Package just delivered, user has pending rating

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to dashboard | Rating modal appears automatically |
| 2 | Check modal content | Package info displayed |
| 3 | Select 4 stars | Stars highlight |
| 4 | Enter comment: `Great service!` | Text accepted |
| 5 | Click "Submit Rating" | Modal closes or shows next pending |

### TC-RATE-002: Skip Rating
**Priority:** Medium

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Rating modal appears | "Skip" button visible |
| 2 | Click "Skip" | Modal closes |
| 3 | Check later | Can still rate from package page |

### TC-RATE-003: Multiple Pending Ratings
**Priority:** Medium
**Precondition:** User has 3+ pending ratings

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Rating modal appears | First rating shown |
| 2 | Submit rating | Second rating appears |
| 3 | Submit second | Third rating appears |
| 4 | Submit third | Modal closes |

### TC-RATE-004: View My Reviews Page
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/profile/reviews` | Reviews page loads |
| 2 | Check rating summary | Average rating displayed |
| 3 | Check star breakdown | Bar chart shows distribution |
| 4 | Check individual reviews | Each review with stars, comment, date |

### TC-RATE-005: Rating Display in Navbar
**Priority:** Medium

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check user dropdown | Star rating shown next to avatar |
| 2 | Click "My Reviews" | Navigate to reviews page |

### TC-RATE-006: View Ratings on Package Page
**Priority:** High
**Precondition:** Delivered package with ratings

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View delivered package | "Ratings" section visible |
| 2 | Check rating content | Both sender and courier ratings shown |

### TC-RATE-007: Rating From Package Page
**Priority:** Medium
**Precondition:** Delivered package, user hasn't rated

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View delivered package | "Rate this delivery" option |
| 2 | Click to rate | Rating modal opens |
| 3 | Submit rating | Rating appears on page |

### TC-RATE-008: Empty Reviews State
**Priority:** Low
**Precondition:** User has no reviews

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/profile/reviews` | "No reviews yet" message |

---

## 7. Admin Tests

### TC-ADMIN-001: Admin Dashboard Access
**Priority:** High
**Precondition:** Logged in as admin

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as admin | Redirect to `/admin` |
| 2 | Check overview tab | Platform stats displayed |
| 3 | Check stats accuracy | User counts, package counts, revenue |

### TC-ADMIN-002: Admin Access Control
**Priority:** High
**Precondition:** Logged in as non-admin

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/admin` | Redirect to dashboard or 403 error |

### TC-ADMIN-003: View Users Tab
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Users" tab | User table displays |
| 2 | Check columns | Name, email, role, verified, active, joined |

### TC-ADMIN-004: Filter Users by Role
**Priority:** Medium

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select "Sender" filter | Only senders shown |
| 2 | Select "Courier" filter | Only couriers shown |
| 3 | Select "Both" filter | Only both-role users shown |
| 4 | Select "All" filter | All users shown |

### TC-ADMIN-005: Filter Users by Verification
**Priority:** Medium

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select "Verified" filter | Only verified users |
| 2 | Select "Unverified" filter | Only unverified users |

### TC-ADMIN-006: Change User Role
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find user in table | Role dropdown visible |
| 2 | Change role to "courier" | Confirmation dialog |
| 3 | Confirm change | Role updated |
| 4 | Refresh page | Change persisted |

### TC-ADMIN-007: Toggle User Verification
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find unverified user | "Verify" button visible |
| 2 | Click "Verify" | User becomes verified |
| 3 | Find verified user | "Unverify" button visible |
| 4 | Click "Unverify" | User becomes unverified |

### TC-ADMIN-008: Activate/Deactivate User
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find active user | "Deactivate" button visible |
| 2 | Click "Deactivate" | User becomes inactive |
| 3 | Find inactive user | "Activate" button visible |
| 4 | Click "Activate" | User becomes active |

### TC-ADMIN-009: Create New User
**Priority:** Medium

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Create User" | Modal opens |
| 2 | Fill user details | Form accepts input |
| 3 | Select role | Role dropdown works |
| 4 | Submit | User created |
| 5 | Check user table | New user appears |

### TC-ADMIN-010: View Packages Tab
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Packages" tab | Package table displays |
| 2 | Check columns | ID, sender, description, status, active, price, created |

### TC-ADMIN-011: Filter Packages by Status
**Priority:** Medium

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select "Pending" filter | Only pending packages |
| 2 | Select "Delivered" filter | Only delivered packages |
| 3 | Select "Cancelled" filter | Only cancelled packages |

### TC-ADMIN-012: Deactivate Package
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find active pending package | "Deactivate" button visible |
| 2 | Click "Deactivate" | Package becomes inactive |
| 3 | Check package status | No longer available for matching |

### TC-ADMIN-013: Create Package for User
**Priority:** Medium

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Create Package" | Navigate to create form |
| 2 | Check user selector | Dropdown with users (excludes courier/admin) |
| 3 | Select user | User selected |
| 4 | Fill package details | Form works normally |
| 5 | Submit | Package created for selected user |

### TC-ADMIN-014: Run Matching Job
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Run Matching Job" | Job starts |
| 2 | Wait for completion | Results display |
| 3 | Check results | Routes processed, matches found, notifications |

### TC-ADMIN-015: View User Detail
**Priority:** Medium

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click user row or name | Navigate to `/admin/users/[id]` |
| 2 | Check user details | Full user info displayed |

---

## 8. Responsive Design Tests

### TC-RESP-001: Mobile Navigation
**Priority:** High
**Device:** Mobile (< 768px)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View navbar on mobile | Hamburger menu icon |
| 2 | Click hamburger | Mobile menu opens |
| 3 | Check menu items | All navigation links present |
| 4 | Click outside menu | Menu closes |

### TC-RESP-002: Mobile Package Cards
**Priority:** Medium
**Device:** Mobile

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View sender dashboard | Cards stack vertically |
| 2 | Check card content | All info readable |
| 3 | Check buttons | Full width, tappable |

### TC-RESP-003: Mobile Messages Layout
**Priority:** High
**Device:** Mobile

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open `/messages` | Conversation list shows |
| 2 | Select conversation | Chat window full screen |
| 3 | Check back button | Returns to conversation list |

### TC-RESP-004: Tablet Layout
**Priority:** Medium
**Device:** Tablet (768px - 1024px)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check dashboard | Proper grid layout |
| 2 | Check forms | Appropriate width |
| 3 | Check tables | Scrollable if needed |

### TC-RESP-005: Desktop Full Width
**Priority:** Medium
**Device:** Desktop (> 1024px)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check content container | Centered with max-width |
| 2 | Check navigation | Full horizontal nav |
| 3 | Check messages page | Split view (list + chat) |

### TC-RESP-006: Form Responsiveness
**Priority:** Medium

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View registration form on mobile | Single column layout |
| 2 | View on desktop | Appropriate spacing |
| 3 | Check address autocomplete dropdown | Stays within viewport |

---

## 9. Error Handling Tests

### TC-ERR-001: 404 - Package Not Found
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/packages/99999` | 404 error page or message |

### TC-ERR-002: 403 - Unauthorized Package Access
**Priority:** High
**Precondition:** Logged in as User A

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to User B's package | 403 error or redirect |

### TC-ERR-003: Network Error Handling
**Priority:** Medium

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Disable network | - |
| 2 | Try to submit form | Error message displays |
| 3 | Re-enable network | App recovers |

### TC-ERR-004: Session Expired
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login to app | Session active |
| 2 | Manually delete auth cookie | - |
| 3 | Try to access protected page | Redirect to login |

### TC-ERR-005: API Error Messages
**Priority:** Medium

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger validation error | User-friendly error message |
| 2 | Check message clarity | No technical jargon |

### TC-ERR-006: Form Validation Errors
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Submit form with errors | Errors shown inline |
| 2 | Check field highlighting | Invalid fields highlighted |
| 3 | Fix error | Error clears |

---

## 10. WebSocket Tests

### TC-WS-001: WebSocket Connection
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login to app | WebSocket connects |
| 2 | Check notification dropdown | Connection indicator green |

### TC-WS-002: WebSocket Reconnection
**Priority:** Medium

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Establish WebSocket connection | Connected |
| 2 | Simulate disconnect (dev tools) | Connection lost indicator |
| 3 | Wait for reconnect | Auto-reconnects |

### TC-WS-003: Real-Time Message Delivery
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open chat in two browsers | Both connected |
| 2 | Send message from Browser A | Message appears in both |
| 3 | Check Browser B | No page refresh needed |

### TC-WS-004: Real-Time Notification
**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger notification event | - |
| 2 | Check recipient browser | Notification badge updates instantly |

### TC-WS-005: Fallback Polling
**Priority:** Medium
**Precondition:** WebSocket disabled/blocked

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Block WebSocket connection | Connection fails |
| 2 | Check notification updates | Still updates (via polling) |
| 3 | Check message count | Updates every 30 seconds |

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Backend running (`uvicorn main:app --reload`)
- [ ] Frontend running (`npm run dev`)
- [ ] Database with test data loaded
- [ ] Test users exist and passwords known
- [ ] Email service configured (or use manual verification)

### Test Execution Order (Recommended)
1. Authentication Tests (TC-AUTH-*)
2. Sender Workflow Tests (TC-SEND-*)
3. Courier Workflow Tests (TC-COUR-*)
4. Messaging Tests (TC-MSG-*)
5. Notification Tests (TC-NOTIF-*)
6. Rating Tests (TC-RATE-*)
7. Admin Tests (TC-ADMIN-*)
8. Responsive Tests (TC-RESP-*)
9. Error Handling Tests (TC-ERR-*)
10. WebSocket Tests (TC-WS-*)

### Bug Report Template
```
Bug ID: BUG-XXX
Test Case: TC-XXX-XXX
Summary: [Brief description]
Environment: [Browser, OS, Screen size]
Steps to Reproduce:
1. ...
2. ...
Expected Result: ...
Actual Result: ...
Severity: [Critical/High/Medium/Low]
Screenshots: [Attach if applicable]
```

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-27 | Claude | Initial QA test cases document |
