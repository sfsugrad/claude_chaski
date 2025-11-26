# Changelog

All notable changes to the Chaski project will be documented in this file.

## [Unreleased]

### Added - Admin Dashboard (2025-01-26)

#### Backend
- **Admin Routes** (`app/routes/admin.py`)
  - `GET /api/admin/users` - List all users with pagination
  - `POST /api/admin/users` - Create new user with any role (including admin)
  - `GET /api/admin/users/{id}` - Get specific user details
  - `PUT /api/admin/users/{id}` - Update user role
  - `DELETE /api/admin/users/{id}` - Delete user (cascades to packages)
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
