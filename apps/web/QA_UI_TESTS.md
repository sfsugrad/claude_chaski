# Chaski Frontend QA UI Manual Test Plan

This document provides comprehensive manual UI test cases for QA engineers to verify the Chaski logistics platform frontend.

---

## Table of Contents

1. [Test Environment Setup](#1-test-environment-setup)
2. [Authentication Tests](#2-authentication-tests)
3. [Registration Tests](#3-registration-tests)
4. [Dashboard Tests](#4-dashboard-tests)
5. [Sender Features Tests](#5-sender-features-tests)
6. [Courier Features Tests](#6-courier-features-tests)
7. [Package Lifecycle Tests](#7-package-lifecycle-tests)
8. [Bidding System Tests](#8-bidding-system-tests)
9. [Messaging Tests](#9-messaging-tests)
10. [Notifications Tests](#10-notifications-tests)
11. [Ratings & Reviews Tests](#11-ratings--reviews-tests)
12. [Admin Panel Tests](#12-admin-panel-tests)
13. [ID Verification Tests](#13-id-verification-tests)
14. [Delivery Proof Tests](#14-delivery-proof-tests)
15. [Internationalization (i18n) Tests](#15-internationalization-i18n-tests)
16. [Responsive Design Tests](#16-responsive-design-tests)
17. [Error Handling Tests](#17-error-handling-tests)
18. [Security Tests](#18-security-tests)
19. [Performance & UX Tests](#19-performance--ux-tests)
20. [Accessibility Tests](#20-accessibility-tests)

---

## 1. Test Environment Setup

### Prerequisites
- Backend running on `http://localhost:8000`
- Frontend running on `http://localhost:3000`
- PostgreSQL database with test data loaded
- Redis running for WebSocket/session support
- Test accounts for each role (see below)

### Test Accounts to Create
| Role | Email | Password | Verification Status |
|------|-------|----------|---------------------|
| Sender | `sender@test.com` | `TestPass123!` | Email + Phone verified |
| Courier | `courier@test.com` | `TestPass123!` | Email + Phone + ID verified |
| Both | `both@test.com` | `TestPass123!` | Email + Phone + ID verified |
| Admin | `admin@test.com` | `TestPass123!` | Full access |
| Unverified Sender | `unverified-sender@test.com` | `TestPass123!` | Email only |
| Unverified Courier | `unverified-courier@test.com` | `TestPass123!` | Email + Phone (no ID) |

### Browser Matrix
Test on the following browsers:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

---

## 2. Authentication Tests

### 2.1 Login Page Display
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| AUTH-001 | Login page loads correctly | Navigate to `/login` | Page displays email input, password input, "Remember me" checkbox, Login button, Google Sign-In button, "Forgot password?" link, Register link |
| AUTH-002 | Form fields are empty by default | Navigate to `/login` | Email and password fields are empty, "Remember me" is unchecked |
| AUTH-003 | Password field masks input | Type in password field | Characters are masked (dots/asterisks) |
| AUTH-004 | Show/hide password toggle | Click eye icon in password field | Password toggles between masked and visible |

### 2.2 Login Validation
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| AUTH-005 | Empty form submission | Click Login with empty fields | Error message: "Email is required" |
| AUTH-006 | Invalid email format | Enter "notanemail", click Login | Error message: "Invalid email format" |
| AUTH-007 | Empty password | Enter valid email, leave password empty, click Login | Error message: "Password is required" |
| AUTH-008 | Invalid credentials | Enter wrong email/password, click Login | Error message: "Invalid email or password" |
| AUTH-009 | Account lockout after 5 failures | Enter wrong password 5 times | Error message: "Account locked. Try again in 15 minutes" |

### 2.3 Successful Login
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| AUTH-010 | Sender login redirect | Login as sender | Redirects to `/en/dashboard` (or user's preferred language) |
| AUTH-011 | Courier login redirect | Login as courier | Redirects to `/en/dashboard` |
| AUTH-012 | Admin login redirect | Login as admin | Redirects to `/en/admin` |
| AUTH-013 | Remember me functionality | Check "Remember me", login, close browser, reopen | User remains logged in |
| AUTH-014 | Login without remember me | Uncheck "Remember me", login, close browser, reopen | User is logged out |
| AUTH-015 | Preferred language redirect | Login as user with `preferred_language: fr` | Redirects to `/fr/dashboard` |

### 2.4 Google OAuth Login
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| AUTH-016 | Google Sign-In button present | Navigate to `/login` | "Continue with Google" button is visible |
| AUTH-017 | Google OAuth flow | Click Google Sign-In button | Redirects to Google OAuth consent screen |
| AUTH-018 | Google OAuth success | Complete Google OAuth | User logged in, redirected to dashboard |
| AUTH-019 | Google OAuth - new user | OAuth with unregistered Google account | New account created, redirected to dashboard |

### 2.5 Logout
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| AUTH-020 | Logout from navbar | Click user menu > Logout | User logged out, redirected to `/login` |
| AUTH-021 | Protected route after logout | After logout, navigate to `/dashboard` | Redirected to `/login` |
| AUTH-022 | Session invalidation | Logout, try to use old session token | Access denied, must re-login |

---

## 3. Registration Tests

### 3.1 Registration Page Display
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| REG-001 | Registration page loads | Navigate to `/register` | Form displays: Full Name, Email, Password, Confirm Password, Role dropdown, Phone Number, Preferred Language, Terms checkbox |
| REG-002 | Role-specific fields - Sender | Select "Sender" role | Default Address field appears |
| REG-003 | Role-specific fields - Courier | Select "Courier" role | Max Deviation (km) field appears |
| REG-004 | Role-specific fields - Both | Select "Both" role | Both Default Address and Max Deviation fields appear |
| REG-005 | Password requirements display | Focus on password field | Password requirements checklist appears |

### 3.2 Registration Validation
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| REG-006 | Empty form submission | Click Register with empty fields | Error messages for all required fields |
| REG-007 | Invalid email format | Enter "bademail" | Error: "Invalid email format" |
| REG-008 | Duplicate email | Enter existing user's email | Error: "Email already registered" |
| REG-009 | Password too short | Enter password < 12 chars | Error: "Password must be at least 12 characters" |
| REG-010 | Password missing uppercase | Enter "testpassword123!" | Requirement indicator shows missing uppercase |
| REG-011 | Password missing lowercase | Enter "TESTPASSWORD123!" | Requirement indicator shows missing lowercase |
| REG-012 | Password missing digit | Enter "TestPassword!!!" | Requirement indicator shows missing digit |
| REG-013 | Password missing special char | Enter "TestPassword123" | Requirement indicator shows missing special character |
| REG-014 | Passwords don't match | Enter different confirm password | Error: "Passwords do not match" |
| REG-015 | Invalid phone format | Enter "1234567890" (no +1) | Error: "Invalid phone number. Must be format +1XXXXXXXXXX" |
| REG-016 | Valid phone format | Enter "+12125551234" | Phone field shows valid (green check) |
| REG-017 | Non-US phone number | Enter "+442071234567" (UK) | Error: "Must be a valid US phone number" |

### 3.3 Password Strength Indicator
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| REG-018 | Real-time password validation | Type password character by character | Requirements checklist updates in real-time |
| REG-019 | All requirements met | Enter "SecurePass123!" | All 5 requirements show green checkmarks |
| REG-020 | Visual strength indicator | Enter various passwords | Strength bar fills and changes color (red→yellow→green) |

### 3.4 Successful Registration
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| REG-021 | Successful registration | Complete valid registration | Redirects to `/register-success`, success message displayed |
| REG-022 | Verification email sent | Complete registration | Email received with verification link |
| REG-023 | Login before verification | Try to login before email verification | Error: "Please verify your email first" |

### 3.5 Geo-Restriction
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| REG-024 | Registration from allowed country | Register from US IP | Registration succeeds |
| REG-025 | Registration from blocked country | Register from non-US IP (use VPN) | GeoBlockedModal appears with country name and support contact |
| REG-026 | Geo-blocked modal display | Trigger geo-block | Modal shows detected country, explains restriction, provides support email |

---

## 4. Dashboard Tests

### 4.1 Dashboard Display
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| DASH-001 | Dashboard loads for sender | Login as sender | Dashboard shows: Welcome message, verification status, quick actions, pending ratings |
| DASH-002 | Dashboard loads for courier | Login as courier | Dashboard shows: Welcome message, verification status, active routes, quick actions |
| DASH-003 | Dashboard loads for both | Login as both-role user | Dashboard shows combined sender and courier sections |
| DASH-004 | User info display | View dashboard header | Shows user's full name, email, role badge |

### 4.2 Verification Status
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| DASH-005 | Email verification status | Login as verified user | Email shows green checkmark |
| DASH-006 | Phone verification prompt | Login as user without phone verified | "Verify Phone" button/banner displayed |
| DASH-007 | ID verification prompt (courier) | Login as courier without ID verified | "Verify ID" banner prominently displayed |
| DASH-008 | Fully verified status | Login as fully verified user | All verification badges show green |

### 4.3 Unverified User Restrictions
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| DASH-009 | Unverified sender restrictions | Login as unverified sender | Cannot access Messages, Notifications hidden, limited navbar |
| DASH-010 | Unverified courier restrictions | Login as courier without ID | Cannot access courier features, VerificationBanner shown |
| DASH-011 | Redirect to dashboard | Unverified user tries `/sender` or `/courier` | Redirected to `/dashboard` |
| DASH-012 | Verification banner click | Click "Verify Now" on banner | Redirects to appropriate verification page |

### 4.4 Quick Actions
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| DASH-013 | Create Package button (sender) | Click "Create Package" | Redirects to `/packages/create` |
| DASH-014 | Create Route button (courier) | Click "Create Route" | Redirects to `/courier/routes/create` |
| DASH-015 | View Packages link | Click "View My Packages" | Redirects to `/sender` |
| DASH-016 | View Routes link | Click "View My Routes" | Redirects to `/courier` |

### 4.5 Pending Ratings
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| DASH-017 | Pending ratings display | User has unrated deliveries | "Pending Ratings" section shows deliveries to rate |
| DASH-018 | Rate delivery action | Click "Rate" on pending rating | RatingModal opens |
| DASH-019 | No pending ratings | User has no pending ratings | Section hidden or shows "No pending ratings" |

---

## 5. Sender Features Tests

### 5.1 Sender Dashboard (`/sender`)
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| SEND-001 | Sender page loads | Navigate to `/sender` | Shows package list, filters, "Create Package" button |
| SEND-002 | Package list display | View package list | Shows package cards with: description, status badge, pickup/dropoff, price, actions |
| SEND-003 | Empty state | Sender with no packages | Shows "No packages yet" message with Create button |
| SEND-004 | Status filter - All | Select "All" filter | Shows all packages regardless of status |
| SEND-005 | Status filter - Active | Select "Active" filter | Shows only non-delivered, non-canceled packages |
| SEND-006 | Status filter - Delivered | Select "Delivered" filter | Shows only delivered packages |
| SEND-007 | Status filter - Canceled | Select "Canceled" filter | Shows only canceled packages |

### 5.2 Package Creation Wizard
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| SEND-008 | Wizard page loads | Navigate to `/packages/create` | Step 1 (Details) displayed with progress indicator |
| SEND-009 | Progress indicator | View wizard header | Shows 4 steps: Details, Pickup, Dropoff, Review |
| SEND-010 | Step 1 - Details form | View Step 1 | Shows: Description (textarea), Size (dropdown), Weight (number input) |
| SEND-011 | Size options | Click Size dropdown | Options: Small, Medium, Large, Extra Large |
| SEND-012 | Step 1 validation | Click Next with empty fields | Error messages for required fields |
| SEND-013 | Step 1 completion | Fill valid details, click Next | Advances to Step 2 (Pickup) |
| SEND-014 | Step 2 - Pickup form | View Step 2 | Shows: Address autocomplete, Contact Name (optional), Contact Phone (optional) |
| SEND-015 | Address autocomplete | Type address in pickup field | Google Places suggestions appear |
| SEND-016 | Address selection | Select address from suggestions | Full address populated, coordinates auto-filled |
| SEND-017 | Step 2 validation | Click Next without address | Error: "Pickup address is required" |
| SEND-018 | Step 2 completion | Fill pickup info, click Next | Advances to Step 3 (Dropoff) |
| SEND-019 | Step 3 - Dropoff form | View Step 3 | Shows: Address autocomplete, Contact Name, Contact Phone |
| SEND-020 | Step 3 completion | Fill dropoff info, click Next | Advances to Step 4 (Review) |
| SEND-021 | Step 4 - Review | View Step 4 | Shows all entered information in summary format |
| SEND-022 | Edit from review | Click "Edit" on any section | Returns to that step for editing |
| SEND-023 | Back button | Click Back on any step | Returns to previous step with data preserved |
| SEND-024 | Optional price field | View pricing section | Can leave price empty or enter amount |
| SEND-025 | Requires proof checkbox | View options | "Require delivery proof" checkbox available |
| SEND-026 | Package submission | Click "Create Package" on review | Package created, redirects to `/sender` with success toast |
| SEND-027 | Submission error handling | Network error during submit | Error toast displayed, form data preserved |

### 5.3 Package Detail Page (`/packages/[id]`)
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| SEND-028 | Package detail loads | Click on package card | Detail page shows: status, description, size, weight, addresses, map |
| SEND-029 | Status timeline | View status section | StatusTimeline component shows all status transitions |
| SEND-030 | Route map display | View map section | Leaflet map shows pickup (green) and dropoff (red) markers |
| SEND-031 | Bids section | Package is OPEN_FOR_BIDS | "Bids" section shows list of courier bids |
| SEND-032 | No bids state | Package with no bids | Shows "No bids yet" message |
| SEND-033 | Cancel package | Click "Cancel Package" | Confirmation modal appears |
| SEND-034 | Cancel confirmation | Confirm cancellation | Package status changes to CANCELED |
| SEND-035 | Cancel restrictions | Package is IN_TRANSIT | Cancel button disabled or hidden |

### 5.4 Sender Analytics (`/sender/analytics`)
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| SEND-036 | Analytics page loads | Navigate to `/sender/analytics` | Shows stats cards and charts |
| SEND-037 | Stats cards display | View stats section | Shows: Total Packages, Delivered, Pending, Total Spent |
| SEND-038 | Delivery chart | View charts | Package completion trend chart displayed |
| SEND-039 | Date range filter | Change date range | Charts and stats update accordingly |

---

## 6. Courier Features Tests

### 6.1 Courier Dashboard (`/courier`)
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| COUR-001 | Courier page loads | Navigate to `/courier` | Shows: Active routes, assigned packages, "Create Route" button |
| COUR-002 | Active routes display | View routes section | Shows route cards with: start, end, departure time, status |
| COUR-003 | Empty routes state | Courier with no routes | Shows "No routes yet" message with Create button |
| COUR-004 | Assigned packages | View packages section | Shows packages assigned to courier |
| COUR-005 | Route status badges | View route cards | Shows status: Active, Expired, Completed |

### 6.2 Route Creation (`/courier/routes/create`)
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| COUR-006 | Route creation page loads | Navigate to `/courier/routes/create` | Form shows: Start address, End address, Max deviation, Trip date, Departure time |
| COUR-007 | Start address autocomplete | Type in start address field | Google Places suggestions appear |
| COUR-008 | End address autocomplete | Type in end address field | Google Places suggestions appear |
| COUR-009 | Deviation presets | View deviation options | Preset buttons: 5km, 10km, 15km, 25km, 50km |
| COUR-010 | Custom deviation | Enter custom value | Validates range 1-50 km |
| COUR-011 | Invalid deviation | Enter 0 or 100 | Error: "Deviation must be between 1-50 km" |
| COUR-012 | Trip date validation | Select past date | Error: "Trip date must be today or later" |
| COUR-013 | Route creation success | Fill valid data, submit | Route created, redirects to `/courier` with success toast |
| COUR-014 | Route map preview | After entering addresses | Map shows route preview with markers |

### 6.3 Package Matching (`/courier/routes/[id]/matches`)
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| COUR-015 | Matches page loads | Click "View Matches" on route | Shows list of matching packages |
| COUR-016 | Match sorting | View match list | Packages sorted by relevance to route |
| COUR-017 | Package card info | View match card | Shows: description, size, weight, pickup/dropoff, sender rating |
| COUR-018 | No matches state | Route with no matching packages | Shows "No matching packages" message |
| COUR-019 | Place bid button | Click "Place Bid" | BidModal opens |
| COUR-020 | Bid restrictions - unverified | Courier without ID verification | "Place Bid" button disabled, shows verification prompt |

### 6.4 Courier Analytics (`/courier/analytics`)
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| COUR-021 | Analytics page loads | Navigate to `/courier/analytics` | Shows stats cards and charts |
| COUR-022 | Stats display | View stats section | Shows: Total Deliveries, Completed, Rating, Earnings |
| COUR-023 | Delivery trends chart | View charts | Delivery completion trend displayed |
| COUR-024 | Earnings chart | View earnings section | Earnings over time chart displayed |

---

## 7. Package Lifecycle Tests

### 7.1 Status Transitions
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| PKG-001 | NEW to OPEN_FOR_BIDS | Create new package | Status auto-transitions to OPEN_FOR_BIDS |
| PKG-002 | OPEN_FOR_BIDS display | View package with bids | Shows bid list, countdown timer for deadline |
| PKG-003 | BID_SELECTED status | Sender selects bid | Status changes to BID_SELECTED, selected courier shown |
| PKG-004 | IN_TRANSIT status | Courier confirms pickup | Status changes to IN_TRANSIT |
| PKG-005 | DELIVERED status | Courier marks delivered | Status changes to DELIVERED |
| PKG-006 | CANCELED status | Sender cancels package | Status changes to CANCELED |
| PKG-007 | FAILED status | Admin marks failed | Status changes to FAILED |

### 7.2 Status Timeline Display
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| PKG-008 | Timeline current step | View package detail | Current status highlighted in timeline |
| PKG-009 | Timeline completed steps | View delivered package | All steps up to DELIVERED shown as completed |
| PKG-010 | Timeline timestamps | View timeline | Each completed step shows timestamp |
| PKG-011 | Timeline orientation | View on mobile vs desktop | Vertical on mobile, horizontal on desktop |

### 7.3 Package Actions by Status
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| PKG-012 | Actions - OPEN_FOR_BIDS | View package | Actions: View Bids, Cancel |
| PKG-013 | Actions - BID_SELECTED | View package | Actions: Contact Courier, Cancel |
| PKG-014 | Actions - IN_TRANSIT | View package | Actions: Track, Contact Courier (no Cancel) |
| PKG-015 | Actions - DELIVERED | View package | Actions: Rate Courier, View Proof |
| PKG-016 | Actions - CANCELED | View package | No actions available |

---

## 8. Bidding System Tests

### 8.1 Placing Bids (Courier)
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| BID-001 | Bid modal opens | Click "Place Bid" on package | Modal shows: Price input, Pickup time, Message field |
| BID-002 | Bid price validation | Enter 0 or negative price | Error: "Price must be greater than 0" |
| BID-003 | Bid submission | Enter valid bid, click Submit | Bid placed, success toast, modal closes |
| BID-004 | Duplicate bid prevention | Try to bid on already-bid package | Error: "You already have a bid on this package" |
| BID-005 | Bid withdrawal | Click "Withdraw Bid" | Confirmation modal appears |
| BID-006 | Withdraw confirmation | Confirm withdrawal | Bid removed, can place new bid |

### 8.2 Viewing Bids (Sender)
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| BID-007 | Bid list display | View package with bids | Shows list of bids with: courier name, price, rating, timestamp |
| BID-008 | Bid card info | View individual bid | Shows: courier rating, price, proposed pickup time, message |
| BID-009 | Accept bid button | Click "Accept" on bid | Confirmation modal appears |
| BID-010 | Accept confirmation | Confirm acceptance | Package status → BID_SELECTED, other bids rejected |
| BID-011 | Bid deadline display | View package with bids | Countdown timer shows time remaining |
| BID-012 | Deadline warning | 6 hours before deadline | Warning notification sent (check notifications) |

### 8.3 Bid Deadline Behavior
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| BID-013 | Deadline extension | Deadline passes without selection | Auto-extends 12 hours (max 2 times) |
| BID-014 | Extension count display | After 1 extension | Shows "Extended 1/2 times" |
| BID-015 | Final deadline | After 2 extensions, deadline passes | All bids expire, package returns to OPEN_FOR_BIDS |
| BID-016 | Expired bids cleanup | Bids expire | Expired bids removed from list |

---

## 9. Messaging Tests

### 9.1 Messages Page (`/messages`)
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| MSG-001 | Messages page loads | Navigate to `/messages` | Shows conversation list on left, chat area on right |
| MSG-002 | Conversation list | View left panel | Shows conversations with: user avatar, name, last message preview, timestamp |
| MSG-003 | Empty state | User with no conversations | Shows "No messages yet" |
| MSG-004 | Unread indicator | Conversation has unread messages | Unread count badge displayed |
| MSG-005 | Select conversation | Click conversation | Chat window loads with message history |

### 9.2 Chat Window
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| MSG-006 | Message history | Select conversation | Previous messages displayed in chronological order |
| MSG-007 | Message bubbles | View messages | Sent messages on right (blue), received on left (gray) |
| MSG-008 | Message timestamps | View messages | Each message shows relative timestamp |
| MSG-009 | Message input | View chat window | Text input field and Send button at bottom |
| MSG-010 | Send message | Type message, click Send | Message appears in chat, input clears |
| MSG-011 | Send with Enter | Type message, press Enter | Message sent |
| MSG-012 | Empty message prevention | Click Send with empty input | Nothing happens, no empty message sent |
| MSG-013 | Long message handling | Send very long message | Message wrapped properly, scrollable if needed |

### 9.3 Real-time Messaging
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| MSG-014 | Real-time receive | Other user sends message | Message appears immediately without refresh |
| MSG-015 | WebSocket indicator | View chat window | Connection status indicator (green = connected) |
| MSG-016 | Reconnection | Disconnect network, reconnect | WebSocket reconnects, missed messages loaded |
| MSG-017 | Typing indicator | Other user is typing | "User is typing..." indicator shown |

---

## 10. Notifications Tests

### 10.1 Notification Dropdown
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| NOTIF-001 | Bell icon in navbar | View navbar | Bell icon visible with unread count badge |
| NOTIF-002 | Unread count | Have unread notifications | Badge shows correct count (max 99+) |
| NOTIF-003 | Dropdown opens | Click bell icon | Dropdown shows recent notifications |
| NOTIF-004 | Notification items | View dropdown | Each notification shows: icon, title, message, timestamp |
| NOTIF-005 | Mark as read | Click notification | Notification marked as read, count decreases |
| NOTIF-006 | Mark all as read | Click "Mark all as read" | All notifications marked read, badge disappears |
| NOTIF-007 | View all link | Click "View All" | Navigates to `/notifications` page |

### 10.2 Notifications Page (`/notifications`)
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| NOTIF-008 | Page loads | Navigate to `/notifications` | Full notification list displayed |
| NOTIF-009 | Notification types | View various notifications | Different icons for: bids, messages, status changes, ratings |
| NOTIF-010 | Empty state | No notifications | Shows "No notifications" message |
| NOTIF-011 | Notification click | Click notification | Navigates to related page (package, message, etc.) |
| NOTIF-012 | Delete notification | Click delete on notification | Notification removed from list |

### 10.3 Real-time Notifications
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| NOTIF-013 | New notification | Another user places bid | Notification appears in real-time |
| NOTIF-014 | Badge update | New notification arrives | Badge count increments immediately |
| NOTIF-015 | Toast notification | Receive important notification | Toast popup appears briefly |

---

## 11. Ratings & Reviews Tests

### 11.1 Rating Modal
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| RATE-001 | Rating modal opens | Click "Rate" on delivered package | Modal shows: Star rating (1-5), Comment textarea, Submit button |
| RATE-002 | Star selection | Click on stars | Stars fill up to selected rating |
| RATE-003 | Star hover preview | Hover over stars | Preview shows potential rating |
| RATE-004 | No rating validation | Click Submit without selecting stars | Error: "Please select a rating" |
| RATE-005 | Rating submission | Select 4 stars, add comment, Submit | Rating saved, success toast, modal closes |
| RATE-006 | Optional comment | Submit without comment | Rating saved successfully |

### 11.2 Reviews Page (`/profile/reviews`)
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| RATE-007 | Reviews page loads | Navigate to `/profile/reviews` | Shows two sections: Reviews Received, Reviews Given |
| RATE-008 | Review cards | View review | Shows: Reviewer name, star rating, comment, date |
| RATE-009 | Average rating display | View reviews header | Shows overall average rating (e.g., 4.5/5) |
| RATE-010 | Filter by rating | Click rating filter | Shows only reviews with selected star count |
| RATE-011 | Empty reviews | User has no reviews | Shows "No reviews yet" message |

### 11.3 Pending Ratings
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| RATE-012 | Pending ratings on dashboard | Have unrated deliveries | "Pending Ratings" section shows on dashboard |
| RATE-013 | Rate from dashboard | Click "Rate" in pending section | RatingModal opens for that delivery |
| RATE-014 | Rating clears pending | Submit rating | Delivery removed from pending list |

---

## 12. Admin Panel Tests

### 12.1 Admin Dashboard (`/admin`)
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| ADM-001 | Admin page loads | Login as admin, navigate to `/admin` | Dashboard with 4 tabs: Overview, Users, Packages, Routes |
| ADM-002 | Non-admin redirect | Login as non-admin, try `/admin` | Redirected to `/dashboard` or 403 error |
| ADM-003 | Overview tab | Click Overview tab | Shows: Stats cards, charts, platform metrics |
| ADM-004 | Stats cards | View Overview | Shows: Total Users, Active Packages, Revenue, Completed Deliveries |
| ADM-005 | Charts display | View Overview | User growth chart, package status distribution pie chart |

### 12.2 User Management (Users Tab)
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| ADM-006 | Users tab loads | Click Users tab | User list with: Name, Email, Role, Verified status, ID status, Actions |
| ADM-007 | User search | Type in search box | Filters users by name or email |
| ADM-008 | Role filter | Select role from dropdown | Shows only users with selected role |
| ADM-009 | User pagination | Navigate pages | Pagination works correctly |
| ADM-010 | Create user button | Click "+ Create User" | Create user modal opens |
| ADM-011 | Create user form | View create modal | Fields: Email, Password, Full Name, Role, Phone (optional) |
| ADM-012 | Create user success | Fill form, submit | User created, appears in list, success toast |
| ADM-013 | View user detail | Click user row | Navigates to `/admin/users/[id]` |

### 12.3 User Detail Page (`/admin/users/[id]`)
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| ADM-014 | User detail loads | Navigate to user detail | Shows: User info, verification status, role, activity |
| ADM-015 | Edit mode toggle | Click "Edit" button | Fields become editable |
| ADM-016 | Role change | Change role dropdown | Available transitions based on current role |
| ADM-017 | Invalid role transition | Try sender → admin directly | Error: "Invalid role transition" |
| ADM-018 | Valid role transition | Change sender → both | Role updated, success toast |
| ADM-019 | Toggle email verified | Click email verified toggle | Status toggles, audit logged |
| ADM-020 | Toggle phone verified | Click phone verified toggle | Status toggles, audit logged |
| ADM-021 | Toggle ID verified | Click ID verified toggle | Status toggles, audit logged |
| ADM-022 | Toggle active status | Click active toggle | User activated/deactivated |
| ADM-023 | Deactivate with packages | Deactivate user with active packages | Error: "User has active packages" |
| ADM-024 | Self-modification prevention | Admin tries to change own role | Disabled or error message |
| ADM-025 | Delete user | Click "Delete User" | Confirmation modal appears |
| ADM-026 | Delete confirmation | Confirm deletion | User deleted, redirects to user list |
| ADM-027 | Self-delete prevention | Admin tries to delete self | Error: "Cannot delete your own account" |

### 12.4 Package Management (Packages Tab)
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| ADM-028 | Packages tab loads | Click Packages tab | Package list with filters |
| ADM-029 | Status filter | Select status filter | Shows packages with selected status |
| ADM-030 | Active filter | Toggle active/inactive | Shows active or deactivated packages |
| ADM-031 | Package search | Search by ID or description | Filters packages |
| ADM-032 | Package detail | Click package row | Shows full package details |
| ADM-033 | Toggle package active | Click toggle on pending package | Package activated/deactivated |
| ADM-034 | Toggle restriction | Try toggle on IN_TRANSIT package | Error: "Cannot deactivate in-transit packages" |
| ADM-035 | Retry failed package | Click "Retry" on FAILED package | Package returns to OPEN_FOR_BIDS |

### 12.5 Route Management (Routes Tab)
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| ADM-036 | Routes tab loads | Click Routes tab | Route list displayed |
| ADM-037 | Route filtering | Filter by status | Shows routes with selected status |
| ADM-038 | Route detail | Click route row | Shows route details with map |
| ADM-039 | Run matching job | Click "Run Matching" | Matching job executed, results displayed |

---

## 13. ID Verification Tests

### 13.1 Verification Flow
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| IDV-001 | Verification page loads | Navigate to `/id-verification` | Page shows verification requirements and "Start Verification" button |
| IDV-002 | Non-courier access | Sender tries to access | Redirected or "Not required" message |
| IDV-003 | Start verification | Click "Start Verification" | Redirects to Stripe Identity flow |
| IDV-004 | Stripe Identity integration | Complete Stripe flow | Returns to `/id-verification/complete` |
| IDV-005 | Verification success | Stripe verifies successfully | Status shows "Verified", user can place bids |
| IDV-006 | Verification failed | Stripe rejects verification | Status shows "Failed", can retry or contact admin |
| IDV-007 | Requires review | Stripe flags for review | Status shows "Pending Review" |

### 13.2 Verification Status Display
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| IDV-008 | Status on dashboard | View courier dashboard | ID verification status prominently displayed |
| IDV-009 | Verification banner | Unverified courier | VerificationBanner shows with CTA |
| IDV-010 | Banner dismissed | Verified courier | No verification banner shown |
| IDV-011 | Status in navbar | View user menu | ID verification status badge |

### 13.3 Admin ID Verification (`/admin/id-verifications`)
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| IDV-012 | Admin page loads | Navigate to ID verifications | List of pending and all verifications |
| IDV-013 | Pending reviews | View pending tab | Shows verifications awaiting admin review |
| IDV-014 | Approve verification | Click "Approve" | User's id_verified set to true |
| IDV-015 | Reject verification | Click "Reject" | Verification marked as rejected |
| IDV-016 | View verification details | Click verification row | Shows Stripe verification details |

---

## 14. Delivery Proof Tests

### 14.1 Proof Capture Page (`/courier/capture-proof/[packageId]`)
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| PROOF-001 | Proof page loads | Navigate to proof capture | Shows: Photo capture, Signature pad, Recipient details |
| PROOF-002 | Camera access | Click "Take Photo" | Camera permission requested, camera opens |
| PROOF-003 | Photo capture | Take photo | Photo preview displayed |
| PROOF-004 | Retake photo | Click "Retake" | Camera reopens, previous photo cleared |
| PROOF-005 | Signature pad | View signature section | Empty signature pad displayed |
| PROOF-006 | Draw signature | Draw on signature pad | Signature strokes appear |
| PROOF-007 | Clear signature | Click "Clear" | Signature pad cleared |
| PROOF-008 | Recipient name input | Enter recipient name | Name field accepts input |
| PROOF-009 | Notes field | Enter delivery notes | Notes field accepts input |
| PROOF-010 | Submit without photo | Try submit without photo | Error: "Photo is required" |
| PROOF-011 | Submit success | Complete all fields, submit | Proof submitted, package marked DELIVERED |
| PROOF-012 | Proof upload progress | Submit proof | Upload progress indicator shown |

### 14.2 Viewing Proof (Sender)
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| PROOF-013 | View proof button | View delivered package | "View Proof" button available |
| PROOF-014 | Proof modal | Click "View Proof" | Modal shows: Photo, Signature, Recipient name, Notes, Timestamp |
| PROOF-015 | Photo zoom | Click photo | Photo opens in larger view |

---

## 15. Internationalization (i18n) Tests

### 15.1 Language Switching
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| I18N-001 | Language switcher visible | View navbar | Language switcher icon/dropdown visible |
| I18N-002 | Available languages | Click language switcher | Shows: English, French, Spanish |
| I18N-003 | Switch to French | Select French | URL changes to `/fr/...`, UI in French |
| I18N-004 | Switch to Spanish | Select Spanish | URL changes to `/es/...`, UI in Spanish |
| I18N-005 | Switch to English | Select English | URL changes to `/en/...`, UI in English |
| I18N-006 | Language persistence | Switch language, navigate | Language persists across pages |
| I18N-007 | Language on refresh | Refresh page | Selected language maintained |

### 15.2 Translation Coverage
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| I18N-008 | Navbar translations | Switch language, view navbar | All navbar items translated |
| I18N-009 | Form labels | View registration form in French | All labels in French |
| I18N-010 | Error messages | Trigger validation error in Spanish | Error messages in Spanish |
| I18N-011 | Status badges | View package statuses in French | Status names translated |
| I18N-012 | Button text | View buttons across app | All button text translated |
| I18N-013 | Date formatting | View dates in different locales | Dates formatted per locale (DD/MM/YYYY vs MM/DD/YYYY) |
| I18N-014 | Number formatting | View numbers/currency | Formatted per locale conventions |

### 15.3 RTL Support (if applicable)
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| I18N-015 | RTL language (future) | Switch to Arabic (if added) | Layout flips to RTL |

---

## 16. Responsive Design Tests

### 16.1 Mobile (320px - 767px)
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| RESP-001 | Navbar mobile | View on mobile | Hamburger menu, condensed navbar |
| RESP-002 | Mobile menu | Click hamburger | Slide-out menu with all nav items |
| RESP-003 | Login form mobile | View login page | Form fits screen, no horizontal scroll |
| RESP-004 | Dashboard mobile | View dashboard | Cards stack vertically |
| RESP-005 | Package cards mobile | View package list | Cards full-width, stacked |
| RESP-006 | Package wizard mobile | Create package | Wizard fits screen, steps visible |
| RESP-007 | Chat window mobile | View messages | Full-screen chat, back button to list |
| RESP-008 | Tables mobile | View admin tables | Horizontal scroll or card view |
| RESP-009 | Modal mobile | Open any modal | Modal fits screen, scrollable content |
| RESP-010 | Touch targets | Tap buttons/links | All touch targets >= 44px |

### 16.2 Tablet (768px - 1023px)
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| RESP-011 | Navbar tablet | View on tablet | May show condensed nav or full |
| RESP-012 | Dashboard tablet | View dashboard | 2-column grid for cards |
| RESP-013 | Package list tablet | View packages | 2 cards per row |
| RESP-014 | Messages tablet | View messages | Side-by-side conversation list and chat |
| RESP-015 | Admin tables tablet | View admin panel | Tables fit with horizontal scroll if needed |

### 16.3 Desktop (1024px+)
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| RESP-016 | Full navbar | View on desktop | Full navigation visible |
| RESP-017 | Dashboard desktop | View dashboard | Multi-column layout |
| RESP-018 | Package list desktop | View packages | 3-4 cards per row |
| RESP-019 | Messages desktop | View messages | Sidebar + chat window layout |
| RESP-020 | Admin panel desktop | View admin | Full-featured tables and charts |
| RESP-021 | Max-width container | View on very wide screen | Content constrained to max-width |

---

## 17. Error Handling Tests

### 17.1 API Error Handling
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| ERR-001 | Network error | Disable network, perform action | Error toast: "Network error. Please check your connection" |
| ERR-002 | 401 Unauthorized | Token expires during session | Redirected to login with message |
| ERR-003 | 403 Forbidden | Try to access admin as non-admin | Error page or redirect with message |
| ERR-004 | 404 Not Found | Navigate to `/packages/invalid-id` | 404 page displayed |
| ERR-005 | 500 Server Error | Backend returns 500 | Error toast: "Server error. Please try again" |
| ERR-006 | Validation errors | Submit invalid form | Field-level error messages displayed |
| ERR-007 | Rate limiting | Exceed rate limit | Error: "Too many requests. Please wait" |

### 17.2 Error Boundary
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| ERR-008 | Component crash | Trigger component error | ErrorBoundary catches, shows fallback UI |
| ERR-009 | Retry action | Click "Try Again" in error boundary | Component attempts to re-render |
| ERR-010 | Error logging | Component crashes | Error logged to backend (check `/api/logs/frontend`) |

### 17.3 Form Error Display
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| ERR-011 | Inline errors | Submit invalid form | Errors shown below respective fields |
| ERR-012 | Error clearing | Fix error, blur field | Error message clears |
| ERR-013 | Multiple errors | Multiple invalid fields | All errors shown simultaneously |
| ERR-014 | Error scroll | Submit form with error at top | Page scrolls to first error |

---

## 18. Security Tests

### 18.1 Authentication Security
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| SEC-001 | Protected route access | Access `/dashboard` without login | Redirected to `/login` |
| SEC-002 | Token in cookies | Login, inspect cookies | JWT in httpOnly cookie (not accessible via JS) |
| SEC-003 | CSRF token | Make POST request | X-CSRF-Token header required |
| SEC-004 | XSS prevention | Enter `<script>alert('xss')</script>` in form | Script not executed, sanitized |
| SEC-005 | SQL injection | Enter `'; DROP TABLE users; --` in search | No SQL error, input sanitized |

### 18.2 Authorization
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| SEC-006 | Role-based access | Sender tries `/courier/routes/create` | Access denied or restricted view |
| SEC-007 | Resource ownership | Try to view other user's package | Access denied |
| SEC-008 | Admin-only routes | Non-admin tries `/admin` | Access denied, redirect |
| SEC-009 | API authorization | Call admin API as non-admin | 403 Forbidden response |

### 18.3 Input Validation
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| SEC-010 | Email validation | Enter invalid email formats | Proper validation errors |
| SEC-011 | Phone validation | Enter invalid phone formats | Proper validation errors |
| SEC-012 | File upload | Try to upload .exe file | File rejected |
| SEC-013 | Large file upload | Upload > 10MB image | File rejected with size error |

---

## 19. Performance & UX Tests

### 19.1 Loading States
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| PERF-001 | Page skeleton | Navigate to dashboard | Skeleton loader shown while loading |
| PERF-002 | Button loading | Submit form | Button shows loading spinner |
| PERF-003 | List loading | Load package list | Skeleton cards shown |
| PERF-004 | Image loading | View page with images | Placeholder/blur while loading |
| PERF-005 | Infinite scroll | Scroll to bottom of long list | Loading indicator, more items load |

### 19.2 Feedback & Toasts
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| PERF-006 | Success toast | Complete action successfully | Green success toast appears |
| PERF-007 | Error toast | Action fails | Red error toast appears |
| PERF-008 | Toast auto-dismiss | Wait after toast appears | Toast auto-dismisses after ~5 seconds |
| PERF-009 | Toast manual dismiss | Click X on toast | Toast dismisses immediately |
| PERF-010 | Multiple toasts | Trigger multiple toasts | Toasts stack properly |

### 19.3 Form UX
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| PERF-011 | Auto-focus | Open login page | Email field auto-focused |
| PERF-012 | Tab order | Tab through form | Logical tab order |
| PERF-013 | Enter submit | Press Enter in form | Form submits |
| PERF-014 | Disabled during submit | Submit form | Inputs disabled during API call |
| PERF-015 | Form data persistence | Partial fill, navigate back | Data preserved (where appropriate) |

### 19.4 Navigation
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| PERF-016 | Back button | Navigate, click back | Returns to previous page with state |
| PERF-017 | Breadcrumbs | View nested page | Breadcrumbs show navigation path |
| PERF-018 | Deep linking | Share URL, open in new browser | Page loads correctly |
| PERF-019 | Page title | Navigate pages | Browser tab title updates |

---

## 20. Accessibility Tests

### 20.1 Keyboard Navigation
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| A11Y-001 | Tab navigation | Tab through page | All interactive elements reachable |
| A11Y-002 | Focus visible | Tab to element | Clear focus indicator visible |
| A11Y-003 | Skip link | Press Tab on page load | "Skip to content" link appears |
| A11Y-004 | Modal focus trap | Open modal, Tab | Focus stays within modal |
| A11Y-005 | Escape to close | Press Escape in modal | Modal closes |
| A11Y-006 | Arrow keys | Navigate dropdown with arrows | Options navigable |

### 20.2 Screen Reader
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| A11Y-007 | Alt text | Images have alt attributes | Descriptive alt text present |
| A11Y-008 | Form labels | Use screen reader on forms | All inputs have associated labels |
| A11Y-009 | ARIA labels | Interactive elements | Proper aria-label attributes |
| A11Y-010 | Heading hierarchy | Check heading structure | Logical h1-h6 hierarchy |
| A11Y-011 | Live regions | Receive notification | Screen reader announces |
| A11Y-012 | Error announcements | Form validation error | Error announced to screen reader |

### 20.3 Visual
| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| A11Y-013 | Color contrast | Check text contrast | Meets WCAG AA (4.5:1 for text) |
| A11Y-014 | Color not sole indicator | View status badges | Status indicated by icon/text, not just color |
| A11Y-015 | Text resize | Zoom to 200% | Content remains usable |
| A11Y-016 | Motion preference | Set reduced motion | Animations respect preference |

---

## Appendix A: Test Data Requirements

### Sample Packages
| Package | Status | Has Bids | Has Proof |
|---------|--------|----------|-----------|
| PKG-001 | OPEN_FOR_BIDS | Yes (3) | No |
| PKG-002 | BID_SELECTED | Yes (1 selected) | No |
| PKG-003 | IN_TRANSIT | Yes | No |
| PKG-004 | DELIVERED | Yes | Yes |
| PKG-005 | CANCELED | No | No |
| PKG-006 | FAILED | Yes | No |

### Sample Routes
| Route | Status | Matching Packages |
|-------|--------|-------------------|
| RTE-001 | Active | 5 |
| RTE-002 | Active | 0 |
| RTE-003 | Expired | N/A |

---

## Appendix B: Bug Report Template

```markdown
## Bug Report

**Test ID:** [e.g., AUTH-005]
**Title:** [Brief description]
**Severity:** Critical / High / Medium / Low
**Environment:**
- Browser:
- OS:
- Screen size:

**Steps to Reproduce:**
1.
2.
3.

**Expected Result:**


**Actual Result:**


**Screenshots/Video:**
[Attach]

**Console Errors:**
[If any]

**Additional Notes:**

```

---

## Appendix C: Test Execution Checklist

### Pre-Test Checklist
- [ ] Backend running and healthy
- [ ] Frontend running and healthy
- [ ] Database seeded with test data
- [ ] Redis running
- [ ] Test accounts created
- [ ] Browser dev tools ready

### Post-Test Checklist
- [ ] All critical tests passed
- [ ] All high-priority tests passed
- [ ] Bugs documented with screenshots
- [ ] Test results logged
- [ ] Environment cleaned up (if needed)

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-01 | QA Team | Initial comprehensive test plan |
