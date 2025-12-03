# Chaski Mobile App

React Native mobile application for the Chaski logistics platform, built with Expo.

## Features

- **Sender Features**: Create packages, view bids, track deliveries, message couriers
- **Courier Features**: Manage routes, find matching packages, submit bids, deliver packages
- **Shared**: Authentication, notifications, messaging, ratings, profile management

## Tech Stack

- **Framework**: Expo SDK 52 with Expo Router
- **Language**: TypeScript
- **State Management**: Zustand + TanStack Query
- **Navigation**: Expo Router (file-based routing)
- **Styling**: React Native StyleSheet
- **i18n**: react-i18next with expo-localization
- **Storage**: expo-secure-store (tokens), AsyncStorage (preferences)

## Prerequisites

- Node.js 18+
- pnpm 8+
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (macOS) or Android Emulator
- Expo Go app (for quick testing on physical devices)

## Getting Started

### Install Dependencies

From the monorepo root:
```bash
pnpm install
```

### Start Development Server

```bash
# From monorepo root
pnpm dev --filter=@chaski/mobile

# Or from apps/mobile/
pnpm start
```

### Run on Simulators

```bash
pnpm ios      # iOS Simulator
pnpm android  # Android Emulator
```

### Run on Physical Device

1. Install Expo Go from App Store / Play Store
2. Scan the QR code shown in the terminal

## Project Structure

```
apps/mobile/
├── src/
│   ├── app/                    # Expo Router pages
│   │   ├── (auth)/             # Auth screens (login, register)
│   │   ├── (tabs)/             # Main tab screens
│   │   ├── _layout.tsx         # Root layout with providers
│   │   └── index.tsx           # Entry redirect
│   ├── components/             # Reusable components
│   ├── contexts/               # React contexts (Auth, etc.)
│   ├── hooks/                  # Custom hooks
│   ├── services/               # API client setup
│   └── utils/                  # Utilities (i18n, etc.)
├── assets/                     # Images, fonts
├── app.json                    # Expo configuration
├── babel.config.js             # Babel configuration
├── metro.config.js             # Metro bundler config (monorepo)
└── tsconfig.json               # TypeScript configuration
```

## Shared Packages

This app uses shared packages from the monorepo:

```typescript
// Types
import type { UserResponse, PackageResponse } from '@chaski/shared-types'

// Utilities
import { kmToMiles, formatMiles, getStatusLabel } from '@chaski/shared-utils'

// API Client
import { createApiClient } from '@chaski/api-client'
import { createFetchAdapter } from '@chaski/api-client/adapters/fetch'

// Translations
import { translations } from '@chaski/shared-i18n'
```

## Authentication

The mobile app uses Bearer token authentication:

1. Login returns a JWT token
2. Token is stored securely in `expo-secure-store`
3. Token is attached to all API requests via Authorization header
4. Token is passed to WebSocket connection via query parameter

```typescript
// Token storage
import * as SecureStore from 'expo-secure-store'
await SecureStore.setItemAsync('auth_token', token)

// API requests
headers: {
  'Authorization': `Bearer ${token}`
}

// WebSocket
ws://api.chaski.com/ws?token=${token}
```

## Navigation

Uses Expo Router with file-based routing:

- `(auth)/*` - Authentication screens (unauthenticated only)
- `(tabs)/*` - Main app tabs (authenticated only)
- Dynamic routes: `/package/[id]`, `/route/[id]`, `/messages/[trackingId]`

## Building for Production

### Install EAS CLI

```bash
npm install -g eas-cli
eas login
```

### Configure EAS

```bash
eas build:configure
```

### Build

```bash
# Development build (includes dev tools)
pnpm build:dev

# Preview build (internal testing)
pnpm build:preview

# Production build (app store)
pnpm build:prod
```

### Submit to App Stores

```bash
eas submit --platform ios
eas submit --platform android
```

## Environment Configuration

Configure API URL in `app.json`:

```json
{
  "expo": {
    "extra": {
      "apiUrl": "https://api.chaski.com"
    }
  }
}
```

Access in code:

```typescript
import Constants from 'expo-constants'
const API_URL = Constants.expoConfig?.extra?.apiUrl
```

## Permissions

The app requires:

- **Location** (foreground): For route matching and delivery tracking
- **Camera**: For delivery proof photos
- **Notifications**: For push notifications (future)

Permissions are declared in `app.json` and requested at runtime.

## Testing

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint
```

## Troubleshooting

### Metro bundler issues with monorepo

If you see resolution errors, ensure `metro.config.js` is correctly configured:

```javascript
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
```

### Clear caches

```bash
# Clear Expo cache
npx expo start --clear

# Clear Metro cache
rm -rf node_modules/.cache
```

### iOS Simulator issues

```bash
# Reset simulator
xcrun simctl erase all
```
