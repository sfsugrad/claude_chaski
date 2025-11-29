# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Geo-Restriction for Registrations**: IP-based country restrictions for NEW user registrations
  - Uses ip-api.com free tier with Redis caching (24-hour TTL)
  - Default: US-only registrations, configurable via `REGISTRATION_COUNTRY_ALLOWLIST` env var
  - Admin override via `ALLOW_INTERNATIONAL_REGISTRATION` env var
  - Fail-secure approach: blocks registration if geolocation lookup fails
  - Existing users grandfathered in (only affects new registrations)
  - Audit logging for blocked registration attempts
  - Frontend modal with friendly error message and waitlist option
  - Comprehensive test coverage (11 unit tests + 5 integration tests)
- **Notification System**: Frontend notification dropdown component with bell icon badge
  - Real-time unread count polling (30-second intervals)
  - Type-specific icons and colors for different notification types
  - Relative time formatting ("2 minutes ago", "1 hour ago")
  - Mark as read and mark all as read functionality
- **Shared Navigation**: Reusable Navbar component across all authenticated pages
  - Role-based navigation links
  - Mobile responsive design
  - Integrated notification dropdown
- **Courier Route Tests**: Comprehensive test coverage for courier routes (54 tests)
  - Route creation and validation tests
  - Coordinate validation (-90 to 90 latitude, -180 to 180 longitude)
  - Max deviation enforcement (1-50km range)
  - Authorization and role-based access tests
  - Active route enforcement tests

### Fixed
- **Next.js 14 Suspense Boundaries**: Fixed useSearchParams() errors in login, verify-email, and auth callback pages
- **Type Errors**: Fixed nullable price field and missing AddressAutocomplete props
- **Test Infrastructure**: Resolved rate limiting issues by creating users directly in database

### Changed
- Updated dashboard, sender, and courier pages to use shared Navbar component
- Improved test fixtures to avoid API rate limiting during test execution

## [0.1.0] - 2024-01-01

### Added
- Initial release of Chaski package delivery platform
- User authentication with JWT tokens and Google OAuth
- Role-based access control (Admin, Sender, Courier)
- Package management (create, edit, delete, track)
- Courier route management with geospatial matching
- Admin dashboard for user and package management
- Email verification system
- Rate limiting for API endpoints
- Comprehensive backend test suite
