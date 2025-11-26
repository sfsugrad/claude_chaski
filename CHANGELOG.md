# Changelog

All notable changes to the Chaski project will be documented in this file.

## [Unreleased]

### Added - User Profile Editing & Detail Page (2025-11-26)

#### Backend
- **User Profile Update Endpoint** (`app/routes/admin.py`)
  - `PUT /api/admin/users/{user_id}/profile` - Update user profile information
  - `UpdateUserProfile` request model with optional fields:
    - `full_name` (str | None) - User's full name
    - `phone_number` (str | None) - User's phone number
    - `max_deviation_km` (int | None) - Max route deviation (1-500 km)
  - **Validation**: max_deviation_km must be between 1 and 500 km
  - **Error Handling**:
    - 404 NOT_FOUND for non-existent users
    - 403 FORBIDDEN for non-admin users
    - 400 BAD_REQUEST for out-of-range max_deviation_km
  - **Features**:
    - Partial updates supported (only send changed fields)
    - Automatic `updated_at` timestamp update
    - Admin-only access with `get_current_admin_user` dependency
    - Returns complete updated user object

- **Comprehensive Test Suite** (`tests/test_admin.py`)
  - **New Test Class**: `TestAdminUserProfileUpdate` with 13 tests
  - **Field Update Tests**:
    - `test_update_user_full_name` - Update user's full name
    - `test_update_user_phone_number` - Update user's phone number
    - `test_update_user_max_deviation_km` - Update max deviation
    - `test_update_multiple_profile_fields` - Update all fields at once
  - **Boundary Testing**:
    - `test_update_max_deviation_km_min_boundary` - Test minimum (1 km)
    - `test_update_max_deviation_km_max_boundary` - Test maximum (500 km)
  - **Validation Tests**:
    - `test_update_max_deviation_km_below_minimum` - Reject < 1 km (400)
    - `test_update_max_deviation_km_above_maximum` - Reject > 500 km (400)
  - **Error Handling Tests**:
    - `test_update_user_profile_not_found` - 404 for missing user
    - `test_update_user_profile_as_non_admin` - 403 for non-admin
    - `test_update_user_profile_without_authentication` - 403 without auth
  - **Data Integrity Tests**:
    - `test_update_user_profile_updates_timestamp` - Verify timestamp update
    - `test_update_user_profile_with_empty_phone` - Allow clearing phone
  - **Test Results**: All 13 tests passing (100% success rate)

#### Frontend - Admin Dashboard
- **Clickable User Names** (`app/admin/page.tsx`)
  - User names in User Management table are now clickable links
  - Navigate to user detail page: `/admin/users/{user_id}`
  - Purple color with underline on hover
  - Uses Next.js Link component for client-side routing

#### Frontend - User Detail Page
- **New Page**: `app/admin/users/[id]/page.tsx` (666 lines)
- **Comprehensive User Information Display**:
  - **Account Information Section**:
    - User ID (read-only, monospace font)
    - Email address (read-only, cannot be changed)
    - Full name (editable)
    - Phone number (editable, optional)
    - Role (editable with dropdown, self-protection)
  - **Account Status Section**:
    - Active status (editable with radio buttons, self-protection)
    - Verification status (read-only, coming soon)
    - Account created timestamp
    - Last updated timestamp
  - **Preferences Section**:
    - Max route deviation (editable, 1-500 km range)
    - Helper text: "Range: 1-500 km. Maximum distance from planned route for package matching."
    - Number input with "km" unit label
  - **Activity Statistics Section**:
    - Total packages count
    - Delivered packages count
    - Active packages count
  - **Related Packages Table**:
    - Shows all packages where user is sender or courier
    - Columns: Package ID, Description, Status, Price, Created
    - Clickable package IDs linking to package detail pages
    - Color-coded status badges
    - Empty state message if no packages

- **Edit User Functionality**:
  - **Edit Button**: Located in page header
  - **Editable Fields**:
    - Full Name → Text input (required)
    - Phone Number → Tel input (optional, placeholder: "+1234567890")
    - Max Route Deviation → Number input (1-500 km, with "km" label)
    - Role → Dropdown (Sender, Courier, Both, Admin)
    - Active Status → Radio buttons (Active/Inactive)
  - **Save/Cancel Buttons**:
    - Cancel (gray) - Discards changes, exits edit mode
    - Save Changes (green) - Saves to backend, reloads data
  - **Self-Protection Rules**:
    - Admin cannot change their own role (dropdown disabled, warning message)
    - Admin cannot deactivate their own account (radio disabled, warning message)
    - Visual indicators: gray background, disabled cursor, red warning text
  - **Validation & UX**:
    - HTML5 validation (required, min/max, type)
    - Purple focus rings on all inputs
    - Placeholder text for guidance
    - Success alert on save: "User updated successfully"
    - Error alerts with backend error messages
    - Automatic data refresh after successful save
    - Smart updates: only sends changed fields to API

- **Color-Coded Badges**:
  - **Role Badges**: Admin (red), Sender (blue), Courier (green), Both (teal)
  - **Active Status**: Active (green), Inactive (red)
  - **Verification**: Verified (green), Unverified (yellow)

- **Security & Authorization**:
  - Admin-only access (redirects non-admins)
  - Authentication check on page load
  - Token validation via `/auth/me`
  - Proper error handling for 403/404 responses

#### API Changes
- **New Endpoint**: `PUT /admin/users/{user_id}/profile`
- **Request Body** (all fields optional):
  ```json
  {
    "full_name": "New Name",
    "phone_number": "+1234567890",
    "max_deviation_km": 250
  }
  ```
- **Response**: Complete UserAdminResponse object with updated fields
- **Status Codes**: 200 OK, 400 Bad Request, 403 Forbidden, 404 Not Found

#### Summary
- **Backend**: 1 new endpoint, 13 new tests (100% passing)
- **Frontend**: 2 pages updated (admin dashboard, new user detail page)
- **Lines Added**: 980+ lines across 4 files
- **Editable Fields**: Full name, phone number, max deviation (1-500 km), role, active status
- **Self-Protection**: Cannot change own role or deactivate own account
- **Test Coverage**: Field updates, validation, boundaries, errors, data integrity

---

### Added - Package Editing (2025-11-26)

#### Backend
- **Package Update Endpoint** (`app/routes/packages.py`)
  - `PUT /api/packages/{package_id}` - Update package details
  - `PackageUpdate` request model with optional fields
  - **Permissions**: Only admin or package sender can edit
  - **Restriction**: Only pending packages can be edited
  - **Editable Fields**:
    - Description (1-500 characters)
    - Size (small, medium, large, extra_large)
    - Weight (0.1-1000 kg)
    - Price (>= 0)
    - Pickup contact name and phone
    - Dropoff contact name and phone
  - Automatic `updated_at` timestamp update
  - Comprehensive validation and error messages
  - 403 FORBIDDEN for unauthorized edit attempts
  - 400 BAD_REQUEST for non-pending packages

#### Frontend
- **Edit Mode** (`app/packages/[id]/page.tsx`)
  - **Edit Package Button**:
    - Visible only to admin or sender who created the package
    - Only shown for packages with "pending" status
    - Located in page header next to package status
  - **Editable Form Fields**:
    - Description → Textarea (3 rows, full width)
    - Size → Dropdown select (Small, Medium, Large, Extra Large)
    - Weight → Number input (step: 0.1 kg, min: 0.1)
    - Price → Number input (step: 0.01, min: 0, currency format)
    - Pickup contact name → Text input with placeholder
    - Pickup contact phone → Tel input with placeholder
    - Dropoff contact name → Text input with placeholder
    - Dropoff contact phone → Tel input with placeholder
  - **Save/Cancel Buttons**:
    - Cancel button (gray) - Discards changes, exits edit mode
    - Save Changes button (green) - Saves to backend, reloads page
    - Replace Edit button when in edit mode
  - **Real-time State Management**:
    - Local state tracks edited values
    - Page reloads with updated data after successful save
    - Error messages displayed via alerts
  - **UI/UX Enhancements**:
    - Purple focus rings on all inputs
    - Consistent styling with rest of application
    - Responsive grid layout maintained

#### Security & Business Rules
- Admin can edit any pending package
- Sender can only edit packages they created
- Courier cannot edit packages
- Only pending packages can be edited (enforced on frontend and backend)
- Non-pending packages show read-only view with no Edit button
- Address and coordinates are immutable (location cannot be changed after creation)
- Permission validation on both frontend and backend (defense in depth)
- Status updates remain separate via `/status` endpoint (courier-only)

#### Testing
- **Package Editing Tests** (`tests/test_packages.py::TestUpdatePackage`)
  - 14 comprehensive test cases covering all scenarios
  - **Success Cases**:
    - Sender can edit their own pending packages
    - Admin can edit any pending package
    - Partial updates (only some fields)
    - All fields can be updated
    - Timestamp updates verified
  - **Permission Tests**:
    - Courier cannot edit packages (403 FORBIDDEN)
    - Sender cannot edit other sender's packages (403 FORBIDDEN)
    - Unauthenticated requests blocked (403 FORBIDDEN)
  - **Business Rule Tests**:
    - Non-pending packages cannot be edited (400 BAD_REQUEST)
    - Package not found returns 404
  - **Validation Tests**:
    - Invalid size rejected (422 UNPROCESSABLE_ENTITY)
    - Invalid weight (negative, zero, too high) rejected
    - Negative price rejected
    - Description too long (>500 chars) rejected
  - **Immutability Tests**:
    - Addresses and coordinates remain unchanged when update attempted
- **PackageResponse Model Enhancement**:
  - Added `updated_at` field to track package modifications
  - All existing tests verified to work with new field

- **Package Toggle Active Tests** (`tests/test_admin.py::TestAdminPackageToggleActive`)
  - 10 comprehensive test cases for soft delete functionality
  - **Success Cases**:
    - Admin can deactivate pending packages
    - Admin can reactivate inactive packages
    - Timestamp updates on toggle
    - Data preservation when deactivated
  - **Business Rule Tests**:
    - Only pending packages can be deactivated (400 BAD_REQUEST)
    - Non-pending packages CAN be reactivated
    - Package not found returns 404
  - **Permission Tests**:
    - Non-admin cannot toggle packages (403 FORBIDDEN)
    - Unauthenticated requests blocked (403 FORBIDDEN)
  - **Data Integrity Tests**:
    - Deactivation preserves all package data
    - Multiple packages can be toggled independently

---

### Added - Comprehensive Test Suite (2025-11-26)

#### Backend Testing
- **Email Utility Tests** (`tests/test_email.py`)
  - `TestGenerateVerificationToken` - Token generation, uniqueness, URL-safety
  - `TestSendVerificationEmail` - Verification email sending with mocking
  - `TestSendWelcomeEmail` - Welcome email functionality tests
  - 11 test cases for email utilities (8 async tests currently skipped)

- **Authentication Dependencies Tests** (`tests/test_dependencies.py`)
  - `TestGetCurrentUser` - JWT authentication, token validation, expiration
  - `TestGetCurrentActiveUser` - Active user verification
  - `TestGetCurrentAdminUser` - Admin privilege validation
  - `TestDependenciesIntegration` - Dependency chain testing
  - 14 test cases for authentication dependencies

- **Model Validation Tests** (`tests/test_models.py`)
  - `TestUserModel` - User creation, constraints, required fields, all roles
  - `TestPackageModel` - Package creation, statuses, sizes, relationships
  - `TestCourierRouteModel` - Route creation, departure times, multiple routes
  - 23 test cases for model validations and database constraints

- **Test Infrastructure Improvements**
  - Added `test_verified_user` fixture - Returns verified User object
  - Added `test_admin` fixture - Returns admin User object
  - Updated `pytest.ini` - Added asyncio marker configuration
  - Total test count increased from 126 to 199 tests

#### Test Coverage Summary
- **Total Tests**: 199 (191 passed, 8 skipped)
- **Backend Coverage**: Auth routes, packages (editing + soft delete), admin (including package toggle), email utils, dependencies, models
- **Package Editing**: 14 comprehensive tests covering permissions, validation, and immutability
- **Package Soft Delete**: 10 comprehensive tests for toggle-active functionality
- **All Core Functionality**: Fully tested with comprehensive edge cases

---

### Added - Admin Self-Protection UI & API (2025-11-26)

#### Frontend Security
- **Admin User Management** (`app/admin/page.tsx`)
  - **Role Dropdown Protection**:
    - Disabled for logged-in admin's own account
    - Gray background (`bg-gray-100`) visual indicator
    - Cursor changed to `cursor-not-allowed`
    - Tooltip: "You cannot change your own role"
  - **Deactivate Button Protection**:
    - Replaced with grayed-out text for own account
    - Non-clickable with disabled styling
    - Tooltip: "You cannot deactivate your own account"
    - Other users retain full functionality

- **Admin Page Tests** (`app/admin/__tests__/page.test.tsx`)
  - `test_admin_cannot_change_own_role_even_to_admin` - Verify role dropdown disabled
  - `test_allows_changing_role_for_other_users` - Verify others remain editable
  - `test_disables_deactivate_button_for_currently_logged_in_admin` - Verify deactivate disabled
  - `test_allows_deactivating_other_users` - Verify others remain deactivatable

#### Backend Security Enhancements
- **Admin Route Improvements** (`app/routes/admin.py`)
  - **Role Change Protection**:
    - Check happens before role validation (more efficient)
    - Prevents ANY role change to own account (even selecting same role)
    - Changed from `400 BAD_REQUEST` to `403 FORBIDDEN` (semantically correct)
    - Error message: "You cannot change your own role"
  - **Deactivation Protection**:
    - Changed from `400 BAD_REQUEST` to `403 FORBIDDEN`
    - Error message: "You cannot deactivate your own account"

- **Admin Test Updates** (`tests/test_admin.py`)
  - Updated `test_admin_cannot_remove_own_admin_role` - Now checks for 403 status
  - **NEW**: `test_admin_cannot_change_own_role_even_to_admin` - Absolute role change prevention
  - Updated `test_admin_cannot_deactivate_self` - Now checks for 403 status
  - All 57 admin tests passing

#### Security Summary
- **Defense in Depth**: Protection at both UI and API levels
- **Frontend**: Visual feedback with disabled controls and tooltips
- **Backend**: Server-side validation prevents API bypass attempts
- **Consistent Error Handling**: Proper HTTP status codes (403 FORBIDDEN)
- **Self-Protection**: Prevents admins from accidentally locking themselves out

---

### Added - Test Data Fixtures (2025-11-26)

#### Backend Test Data
- **Test Data Directory** (`backend/test_data/`)
  - `users.json` - 10 test users with various roles and states
    - 1 Admin, 3 Senders, 3 Couriers, 2 Both roles, 1 Unverified user
    - Pre-configured passwords for easy testing
  - `packages.json` - 10 test packages with realistic data
    - Various statuses: pending, matched, picked_up, in_transit, delivered, cancelled
    - Different sizes: small, medium, large, extra_large
    - San Francisco addresses with real coordinates
  - `courier_routes.json` - 7 courier routes
    - Mix of active and inactive routes
    - Various SF neighborhoods
    - Different max deviation distances (7-15 km)

- **Data Loading Script** (`test_data/load_test_data.py`)
  - Python script to load JSON fixtures into database
  - Automatic password hashing
  - ID mapping for referential integrity
  - Optional data clearing
  - Usage: `python -m test_data.load_test_data`

- **Documentation** (`test_data/README.md`)
  - Complete guide for loading test data
  - Test credentials table
  - Data overview and relationships
  - Notes on usage and timestamps

#### Test Credentials
- Admin: admin@chaski.com / admin123
- Sender: john.sender@example.com / sender123
- Courier: mike.courier@example.com / courier123
- Both: alex.both@example.com / both123

---

### Added - User Soft Delete & Filtering (2025-01-26)

#### Backend
- **User Soft Delete** (`app/routes/admin.py`)
  - `PUT /api/admin/users/{user_id}/toggle-active` - Toggle user active/inactive status
  - `ToggleUserActive` request model for activation/deactivation
  - Self-protection: Admins cannot deactivate their own account
  - Inactive users cannot log in (authentication will fail)
  - All user data preserved in database for historical records
  - Users can be reactivated at any time

#### Frontend
- **User Filtering** (`app/admin/page.tsx`)
  - Filter by **Role**: All, Sender, Courier, Both, Admin
  - Filter by **Verification**: All, Verified Only, Unverified Only
  - Filter by **Active Status**: All, Active Only, Inactive Only
  - Real-time user count: "Showing X of Y users"
  - Clear filters button to reset all filters
  - Empty state with filter reset option

- **Enhanced User Management Table**
  - Added **Active Status** column with color-coded badges (green/red)
  - Renamed **Status** column to **Verification** for clarity
  - **Deactivate** button (red) for active users
  - **Activate** button (green) for inactive users
  - Visual indicator: Inactive users shown with grayed-out rows
  - Role selector disabled for inactive users
  - Replaced hard delete with soft delete functionality

#### Security Enhancements
- Admins cannot deactivate their own account
- Inactive users blocked from authentication
- Data preservation through soft delete
- Self-protection rules prevent privilege removal

#### Testing
- **Comprehensive Test Suite** (`tests/test_admin.py`)
  - `TestAdminUserToggleActive` class with 12 test cases
  - **Basic Functionality Tests**:
    - Toggle user to inactive (deactivate)
    - Toggle user to active (reactivate)
  - **Self-Protection Tests**:
    - Admin cannot deactivate their own account
    - Admin can activate themselves (edge case)
  - **Authentication Blocking Tests**:
    - Inactive users cannot log in
    - Reactivated users can log in again
  - **Error Handling Tests**:
    - 404 for non-existent users
    - 403 for non-admin users attempting toggle
    - 401 for unauthenticated requests
  - **Data Integrity Tests**:
    - Deactivating user preserves all data and packages
    - Timestamp updates on status change
    - Multiple users can be toggled independently
  - All 12 tests passing with 100% coverage of toggle-active endpoint

### Changed
- **User Management**: Replaced "Delete" action with "Deactivate/Activate"
- **DELETE /api/admin/users/{id}**: Marked as deprecated (kept for backwards compatibility)
- **User filtering**: Added `getFilteredUsers()` function with multi-criteria filtering

---

### Added - Admin Dashboard (2025-01-26)

#### Backend
- **Admin Routes** (`app/routes/admin.py`)
  - `GET /api/admin/users` - List all users with pagination
  - `POST /api/admin/users` - Create new user with any role (including admin)
  - `GET /api/admin/users/{id}` - Get specific user details
  - `PUT /api/admin/users/{id}` - Update user role
  - `DELETE /api/admin/users/{id}` - Delete user (DEPRECATED - use toggle-active instead)
  - `GET /api/admin/packages` - List all packages with pagination
  - `GET /api/admin/packages/{id}` - Get specific package details
  - `PUT /api/admin/packages/{id}/toggle-active` - Soft delete/activate packages
  - `DELETE /api/admin/packages/{id}` - Hard delete package
  - `GET /api/admin/stats` - Get platform statistics

- **Soft Delete Functionality**
  - Added `is_active` column to Package model (default: true)
  - Migration script: `migrations/add_package_is_active.py`
  - Business rule: Only pending packages can be deactivated
  - Inactive packages are preserved in database for historical records

- **Admin Dependencies**
  - `get_current_admin_user` dependency in `app/utils/dependencies.py`
  - Validates JWT token and checks for ADMIN role
  - Returns 403 if user is not an admin

- **Enhanced User Creation**
  - Admin can create users with any role
  - Created users are auto-verified (`is_verified=True`)
  - Password validation (min 8 characters)
  - Email uniqueness validation
  - Role validation (SENDER, COURIER, BOTH, ADMIN)

- **Admin Response Models**
  - `UserAdminResponse` - Complete user information
  - `PackageAdminResponse` - Complete package information with is_active
  - `PlatformStats` - Platform metrics
  - `UpdateUserRole` - Role update request
  - `CreateUserRequest` - User creation request
  - `TogglePackageActive` - Package activation toggle

#### Frontend
- **Admin Dashboard Page** (`app/admin/page.tsx`)
  - Three-tab interface: Overview, Users, Packages
  - Real-time platform statistics display
  - Role-based access control (redirects non-admins)

- **User Management**
  - View all users with role, verification status, join date
  - Create new users with modal form
    - Required fields: email, password, full name, role
    - Optional fields: phone number, max deviation
    - Form validation (email format, password min length)
  - Update user roles via dropdown
  - Delete users with confirmation
  - Self-protection: Cannot delete self or remove own admin role

- **Package Management**
  - View all packages with sender information
  - Status filtering: all, pending, matched, picked_up, in_transit, delivered, cancelled
  - Active state filtering: all, active, inactive
  - Visual indicators for inactive packages (grayed out)
  - Clickable package IDs linking to detail page
  - Deactivate button (pending packages only) with conditional rendering
  - Activate button for inactive packages
  - Package count with applied filters
  - Clear filters functionality

- **Package Detail Page** (`app/packages/[id]/page.tsx`)
  - Comprehensive package information display
  - Four main sections:
    - Package Details (description, size, weight, price, created date)
    - People Involved (sender and courier info with email)
    - Pickup Location (address, coordinates, contact info)
    - Dropoff Location (address, coordinates, contact info)
  - Status badge with color coding
  - Size label formatting
  - Back button navigation (to dashboard or admin)
  - Admin access to view all packages
  - Regular users can only view their own packages

- **Create User Modal**
  - Overlay modal with form
  - Fields: email, password, full name, role, phone, max deviation
  - HTML5 form validation
  - Submit and cancel buttons
  - Success/error alerts
  - Form reset after successful creation
  - Closes on submission or cancel

#### Security Enhancements
- Admin-only endpoint protection with `get_current_admin_user` dependency
- Self-protection rules:
  - Admins cannot delete their own account
  - Admins cannot remove their own admin role
- Business rule enforcement:
  - Only pending packages can be deactivated
  - Backend validation with detailed error messages
- User privilege protection:
  - Users cannot escalate their own privileges
  - Only admins can create admin users
- Soft delete for data preservation
  - Maintains historical records
  - Inactive packages hidden from regular views

#### Database Changes
- Added `is_active BOOLEAN DEFAULT TRUE` to packages table
- Migration script handles existing data (sets all to true)
- Column existence check to prevent duplicate additions

### Changed

#### Backend
- Package model includes `is_active` field
- Admin routes use comprehensive response models
- Updated `PackageAdminResponse` to include `is_active` field
- Enhanced error messages for package deactivation

#### Frontend
- Admin page includes `is_active` in Package interface
- Package table shows sender name and email instead of route
- Package table includes active status column
- Enhanced filtering capabilities
- Improved visual feedback for inactive packages

### Fixed
- Database migration handles idempotency (safe to re-run)
- Proper error handling for admin operations
- Correct role validation for user creation

---

## [0.1.0] - 2025-01-20

### Added - Initial Release

#### Authentication & Security
- User registration with email verification
- Email verification with secure token-based validation
- Google Single Sign-On (OAuth 2.0)
- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control (SENDER, COURIER, BOTH, ADMIN)

#### Package Management
- Create package delivery requests
- Google Places address autocomplete
- Auto-generate coordinates from addresses
- Specify package details (size, weight, description, price)
- Track package status (pending → matched → picked_up → in_transit → delivered)
- View all packages from dashboard

#### Backend Infrastructure
- FastAPI web framework
- PostgreSQL with PostGIS
- SQLAlchemy ORM
- FastAPI-Mail for email sending
- Authlib for OAuth 2.0
- Comprehensive input validation with Pydantic

#### Frontend Infrastructure
- Next.js 14 with App Router
- TypeScript for type safety
- Tailwind CSS styling
- Axios HTTP client
- Modern React Hooks

#### Documentation
- Comprehensive README with setup instructions
- API endpoint documentation
- Environment variable configuration guide
- Troubleshooting section

---

**Note**: This changelog follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.
