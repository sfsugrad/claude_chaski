# Matching Algorithm API Documentation

This document provides comprehensive documentation for the Chaski matching algorithm API endpoints.

## Table of Contents
- [Overview](#overview)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [Get Packages Along Route](#1-get-packages-along-route)
  - [Accept Package](#2-accept-package)
  - [Decline Package](#3-decline-package)
- [Example Workflows](#example-workflows)
- [Error Responses](#error-responses)

---

## Overview

The matching algorithm connects package senders with couriers traveling along similar routes. It uses geospatial calculations to find packages that are within a courier's acceptable deviation distance from their route.

**Base URL**: `http://localhost:8000/api/matching`

---

## Authentication

All endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

To get a token, login via `/api/auth/login`:

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "courier@example.com",
    "password": "yourpassword"
  }'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

---

## Endpoints

### 1. Get Packages Along Route

Find all pending packages that are along a courier's route within the deviation distance.

**Endpoint**: `GET /api/matching/packages-along-route/{route_id}`

**Permission**: Requires COURIER, BOTH, or ADMIN role

**Path Parameters**:
- `route_id` (integer, required): The ID of the courier route

**Query Parameters**: None

**Response**: Array of matched packages sorted by detour distance (ascending), then price (descending)

#### Request Example

```bash
curl -X GET http://localhost:8000/api/matching/packages-along-route/1 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### Success Response (200 OK)

```json
[
  {
    "package_id": 15,
    "description": "Small electronics package",
    "pickup_address": "Palo Alto, CA",
    "dropoff_address": "Mountain View, CA",
    "distance_from_route_km": 2.45,
    "estimated_detour_km": 8.32,
    "price": 25.00,
    "size": "small",
    "weight_kg": 2.5
  },
  {
    "package_id": 23,
    "description": "Documents for delivery",
    "pickup_address": "Redwood City, CA",
    "dropoff_address": "Sunnyvale, CA",
    "distance_from_route_km": 3.12,
    "estimated_detour_km": 12.45,
    "price": 30.00,
    "size": "small",
    "weight_kg": 0.5
  }
]
```

**Response Fields**:
- `package_id`: Unique package identifier
- `description`: Package description
- `pickup_address`: Where to pick up the package
- `dropoff_address`: Where to deliver the package
- `distance_from_route_km`: Average distance of pickup/dropoff from route line
- `estimated_detour_km`: Extra kilometers required to pick up and deliver
- `price`: Payment offered by sender (nullable)
- `size`: Package size (`small`, `medium`, `large`, `extra_large`)
- `weight_kg`: Package weight in kilograms

#### Error Responses

**403 Forbidden** - User is not a courier
```json
{
  "detail": "Only couriers can view packages along routes"
}
```

**404 Not Found** - Route doesn't exist or is inactive
```json
{
  "detail": "Route not found or inactive"
}
```

**403 Forbidden** - Trying to view another courier's route
```json
{
  "detail": "You can only view packages for your own routes"
}
```

---

### 2. Accept Package

Courier accepts a package for delivery.

**Endpoint**: `POST /api/matching/accept-package/{package_id}`

**Permission**: Requires COURIER or BOTH role

**Path Parameters**:
- `package_id` (integer, required): The ID of the package to accept

**Request Body**: None

#### Request Example

```bash
curl -X POST http://localhost:8000/api/matching/accept-package/15 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### Success Response (200 OK)

```json
{
  "message": "Package accepted successfully",
  "package_id": 15,
  "status": "matched"
}
```

**Response Fields**:
- `message`: Success message
- `package_id`: ID of the accepted package
- `status`: New package status (will be "matched")

#### Error Responses

**403 Forbidden** - User is not a courier
```json
{
  "detail": "Only couriers can accept packages"
}
```

**404 Not Found** - Package doesn't exist
```json
{
  "detail": "Package not found"
}
```

**400 Bad Request** - Package not available
```json
{
  "detail": "Package is not available. Current status: matched"
}
```

**400 Bad Request** - Package is inactive
```json
{
  "detail": "Package is not active"
}
```

---

### 3. Decline Package

Courier declines a previously matched package, returning it to pending status.

**Endpoint**: `POST /api/matching/decline-package/{package_id}`

**Permission**: Requires COURIER or BOTH role

**Path Parameters**:
- `package_id` (integer, required): The ID of the package to decline

**Request Body**: None

#### Request Example

```bash
curl -X POST http://localhost:8000/api/matching/decline-package/15 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### Success Response (200 OK)

```json
{
  "message": "Package declined successfully",
  "package_id": 15,
  "status": "pending"
}
```

**Response Fields**:
- `message`: Success message
- `package_id`: ID of the declined package
- `status`: New package status (will be "pending")

#### Error Responses

**403 Forbidden** - User is not a courier
```json
{
  "detail": "Only couriers can decline packages"
}
```

**404 Not Found** - Package doesn't exist
```json
{
  "detail": "Package not found"
}
```

**403 Forbidden** - Package not assigned to this courier
```json
{
  "detail": "You can only decline packages assigned to you"
}
```

**400 Bad Request** - Package not in matched status
```json
{
  "detail": "Package cannot be declined. Current status: picked_up"
}
```

---

## Example Workflows

### Workflow 1: Courier Finds and Accepts Package

1. **Create a courier route**:
```bash
curl -X POST http://localhost:8000/api/couriers/routes \
  -H "Authorization: Bearer <courier_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "start_address": "San Francisco, CA",
    "start_lat": 37.7749,
    "start_lng": -122.4194,
    "end_address": "San Jose, CA",
    "end_lat": 37.3382,
    "end_lng": -121.8863,
    "max_deviation_km": 10,
    "departure_time": "2025-12-01T10:00:00Z"
  }'
```

Response:
```json
{
  "id": 1,
  "courier_id": 5,
  "start_address": "San Francisco, CA",
  "end_address": "San Jose, CA",
  "max_deviation_km": 10,
  "is_active": true
}
```

2. **Find packages along the route**:
```bash
curl -X GET http://localhost:8000/api/matching/packages-along-route/1 \
  -H "Authorization: Bearer <courier_token>"
```

3. **Accept a package**:
```bash
curl -X POST http://localhost:8000/api/matching/accept-package/15 \
  -H "Authorization: Bearer <courier_token>"
```

4. **Update package status as you progress**:
```bash
# Mark as picked up
curl -X PUT http://localhost:8000/api/packages/15/status \
  -H "Authorization: Bearer <courier_token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "picked_up"}'

# Mark as in transit
curl -X PUT http://localhost:8000/api/packages/15/status \
  -H "Authorization: Bearer <courier_token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "in_transit"}'

# Mark as delivered
curl -X PUT http://localhost:8000/api/packages/15/status \
  -H "Authorization: Bearer <courier_token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "delivered"}'
```

### Workflow 2: Courier Changes Mind

1. **Accept a package**:
```bash
curl -X POST http://localhost:8000/api/matching/accept-package/15 \
  -H "Authorization: Bearer <courier_token>"
```

2. **Decline the package (before pickup)**:
```bash
curl -X POST http://localhost:8000/api/matching/decline-package/15 \
  -H "Authorization: Bearer <courier_token>"
```

Note: You can only decline packages in "matched" status. Once picked up, you must complete the delivery.

---

## Error Responses

All error responses follow this format:

```json
{
  "detail": "Error message describing what went wrong"
}
```

### Common HTTP Status Codes

- **200 OK**: Request succeeded
- **400 Bad Request**: Invalid request (package unavailable, wrong status, etc.)
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: User doesn't have permission for this action
- **404 Not Found**: Resource (package/route) doesn't exist
- **422 Unprocessable Entity**: Validation error in request data

---

## Algorithm Details

### How Matching Works

1. **Distance Filtering**: The algorithm checks if both the pickup and dropoff points are within `max_deviation_km` from the courier's route line.

2. **Detour Calculation**: For each qualifying package, it calculates:
   ```
   detour = (start→pickup) + (pickup→dropoff) + (dropoff→end) - (start→end)
   ```

3. **Sorting**: Packages are sorted by:
   - Primary: Detour distance (ascending) - shorter detours first
   - Secondary: Price (descending) - higher paying packages first

### Geographic Calculations

- **Haversine Formula**: Used for great-circle distance between points
- **Cross-Track Distance**: Used to find perpendicular distance from point to route
- **Point-to-Line Distance**: Accounts for route endpoints (doesn't extend infinitely)

### Package Eligibility

A package must meet these criteria to appear in matching results:
- Status: `PENDING` (not already matched or delivered)
- Active: `is_active = true` (not soft-deleted)
- Geographic: Both pickup and dropoff within `max_deviation_km` from route

---

## Testing

### Using curl

```bash
# Set your token
TOKEN="your_jwt_token_here"

# Get packages for route 1
curl -X GET http://localhost:8000/api/matching/packages-along-route/1 \
  -H "Authorization: Bearer $TOKEN"

# Accept package 15
curl -X POST http://localhost:8000/api/matching/accept-package/15 \
  -H "Authorization: Bearer $TOKEN"

# Decline package 15
curl -X POST http://localhost:8000/api/matching/decline-package/15 \
  -H "Authorization: Bearer $TOKEN"
```

### Using Python requests

```python
import requests

BASE_URL = "http://localhost:8000"
token = "your_jwt_token_here"
headers = {"Authorization": f"Bearer {token}"}

# Get packages along route
response = requests.get(
    f"{BASE_URL}/api/matching/packages-along-route/1",
    headers=headers
)
packages = response.json()
print(f"Found {len(packages)} packages")

# Accept first package
if packages:
    package_id = packages[0]["package_id"]
    response = requests.post(
        f"{BASE_URL}/api/matching/accept-package/{package_id}",
        headers=headers
    )
    print(response.json())
```

### Using JavaScript/Axios

```javascript
const axios = require('axios');

const BASE_URL = 'http://localhost:8000';
const token = 'your_jwt_token_here';
const headers = { Authorization: `Bearer ${token}` };

// Get packages along route
async function getPackages(routeId) {
  try {
    const response = await axios.get(
      `${BASE_URL}/api/matching/packages-along-route/${routeId}`,
      { headers }
    );
    console.log(`Found ${response.data.length} packages`);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response.data);
  }
}

// Accept package
async function acceptPackage(packageId) {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/matching/accept-package/${packageId}`,
      {},
      { headers }
    );
    console.log('Success:', response.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
}

// Usage
getPackages(1).then(packages => {
  if (packages.length > 0) {
    acceptPackage(packages[0].package_id);
  }
});
```

---

## Rate Limiting

The API implements rate limiting to prevent abuse. Default limits:
- 100 requests per minute per IP address

If you exceed the limit, you'll receive a `429 Too Many Requests` response.

---

## Support

For issues or questions:
- GitHub: https://github.com/your-repo/chaski
- Email: support@chaski.com

---

## Changelog

### Version 1.0.0 (2025-11-26)
- Initial release of matching algorithm API
- Three endpoints: get packages, accept, decline
- Geospatial matching with configurable deviation distance
- Smart sorting by detour and price
