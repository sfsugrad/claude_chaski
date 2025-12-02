# Chaski Frontend

Next.js frontend for the Chaski courier matching platform.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your settings
   ```

3. Run development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000

## Requirements

- Node.js 16 or higher (recommended: 18+)
- npm or yarn

**Important:** If you're running Node.js 14, please upgrade to version 16 or higher.

## Project Structure

```
frontend/
├── app/                 # Next.js App Router
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Homepage
│   └── globals.css     # Global styles
├── components/          # React components
├── lib/                # Utilities and API client
│   └── api.ts          # API client
└── public/             # Static assets
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Environment Variables

Required variables in `.env.local`:
- `NEXT_PUBLIC_API_URL` - Backend API URL (default: http://localhost:8000)
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - Google Maps API key for maps

## Features to Implement

### Authentication Pages
- [ ] Login page
- [ ] Registration page
- [ ] Password reset

### Sender Dashboard
- [ ] Create package form
- [ ] List packages
- [ ] Package details view
- [ ] Track package status

### Courier Dashboard
- [ ] Create route form
- [ ] View available packages
- [ ] Accept/decline packages
- [ ] Active deliveries

### Shared Features
- [ ] User profile
- [ ] Settings
- [ ] Notifications
- [ ] Map integration

## Styling

The project uses Tailwind CSS for styling. Configuration is in `tailwind.config.ts`.

## API Integration

API client is in `lib/api.ts`. It includes:
- Automatic JWT token handling
- All API endpoints organized by feature
- Error handling

Example usage:
```typescript
import { packagesAPI } from '@/lib/api'

const packages = await packagesAPI.getAll()
```

## Next Steps

1. Create authentication pages (login/register)
2. Build sender dashboard
3. Build courier dashboard
4. Integrate Google Maps
5. Add real-time updates (WebSocket or polling)
