# Distance Units: Kilometers vs Miles

## Overview

Chaski uses a dual-unit system for distance measurements:
- **Backend storage**: Kilometers (km)
- **Frontend display**: Miles (mi)

This approach allows for consistent data storage while providing a user-friendly experience for US users.

## Conversion Utilities

All distance conversions are handled by `lib/distance.ts`:

```typescript
import { kmToMiles, milesToKm, formatMiles, formatKm } from '@/lib/distance';

// Constants
const KM_TO_MILES = 0.621371;
const MILES_TO_KM = 1.60934;

// Convert kilometers to miles
kmToMiles(5)  // Returns: 3.106855

// Convert miles to kilometers
milesToKm(3)  // Returns: 4.82802

// Format with unit
formatMiles(5)  // Returns: "3.1 mi"
formatKm(5)     // Returns: "5.0 km"
```

## Usage Patterns

### Displaying Values

When displaying distance values from the backend:

```typescript
import { kmToMiles } from '@/lib/distance';

// In component
<p>{kmToMiles(user.max_deviation_km).toFixed(1)} mi</p>
```

### Input Fields

When accepting user input in miles and saving to backend:

```typescript
import { kmToMiles, milesToKm } from '@/lib/distance';

// Display current value in miles
<input
  type="number"
  value={kmToMiles(formData.max_deviation_km).toFixed(1)}
  onChange={(e) => setFormData({
    ...formData,
    max_deviation_km: milesToKm(parseFloat(e.target.value) || 3)
  })}
/>
<span>mi</span>
```

### Preset Values

For preset buttons/options, store values in km but display in miles:

```typescript
const deviationPresets = [
  { value: 1.6, label: '1 mi', description: 'Very close to route' },
  { value: 4.8, label: '3 mi', description: 'Slight detour' },
  { value: 8, label: '5 mi', description: 'Moderate detour' },
  { value: 16, label: '10 mi', description: 'Moderate detour' },
  { value: 32, label: '20 mi', description: 'Significant detour' },
];
```

## Affected Components

The following components display or accept distance values:

### Admin Pages
- `app/[locale]/admin/page.tsx` - Routes table, new user form, new route form
- `app/[locale]/admin/users/[id]/page.tsx` - User preferences, routes table, route map

### Courier Pages
- `app/[locale]/courier/page.tsx` - Active route, route list
- `app/[locale]/courier/routes/create/page.tsx` - Route creation form with presets

### User Pages
- `app/[locale]/dashboard/page.tsx` - User profile max deviation
- `app/[locale]/register/page.tsx` - Registration form for couriers

### Map Components
- `components/map/RouteMap.tsx` - Route visualization with deviation radius

## Database Schema

The backend stores deviation in kilometers:

```sql
-- users table
max_deviation_km FLOAT DEFAULT 5.0

-- courier_routes table
max_deviation_km FLOAT NOT NULL
```

## API Contracts

All API requests and responses use kilometers:

```typescript
// Request
POST /api/couriers/routes
{
  "max_deviation_km": 8.0  // ~5 miles
}

// Response
{
  "id": 1,
  "max_deviation_km": 8.0,
  ...
}
```

## Future Considerations

### Localization
If supporting international users, consider:
1. Add locale-based unit selection (US = miles, others = km)
2. Store user preference in profile
3. Update `lib/distance.ts` to check locale before conversion

### Implementation Example
```typescript
// Future: locale-aware formatting
export function formatDistance(km: number, locale: string): string {
  if (locale === 'en-US') {
    return `${kmToMiles(km).toFixed(1)} mi`;
  }
  return `${km.toFixed(1)} km`;
}
```

## Testing

When writing tests involving distances:

```typescript
// Test that display shows miles
expect(screen.getByText('3.1 mi')).toBeInTheDocument();

// Test that input converts correctly
fireEvent.change(input, { target: { value: '5' } });
expect(mockSetFormData).toHaveBeenCalledWith(
  expect.objectContaining({
    max_deviation_km: expect.closeTo(8.0, 1)  // 5 miles ≈ 8 km
  })
);
```
