# Chaski Matching API - Quick Start Guide

## Getting Started in 5 Minutes

### 1. Start the Server

```bash
cd backend
python3 -m uvicorn main:app --reload
```

Server runs at: `http://localhost:8000`

### 2. Login and Get Token

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "courier@example.com", "password": "yourpassword"}'
```

Copy the `access_token` from the response.

### 3. Create a Route

```bash
TOKEN="your_access_token_here"

curl -X POST http://localhost:8000/api/couriers/routes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "start_address": "San Francisco, CA",
    "start_lat": 37.7749,
    "start_lng": -122.4194,
    "end_address": "San Jose, CA",
    "end_lat": 37.3382,
    "end_lng": -121.8863,
    "max_deviation_km": 10
  }'
```

Note the `id` from the response (your route ID).

### 4. Find Matching Packages

```bash
ROUTE_ID=1  # Use the ID from step 3

curl -X GET "http://localhost:8000/api/matching/packages-along-route/$ROUTE_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Accept a Package

```bash
PACKAGE_ID=15  # Use a package_id from step 4

curl -X POST "http://localhost:8000/api/matching/accept-package/$PACKAGE_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### 6. Update Package Status

```bash
# Mark as picked up
curl -X PUT "http://localhost:8000/api/packages/$PACKAGE_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "picked_up"}'

# Mark as delivered
curl -X PUT "http://localhost:8000/api/packages/$PACKAGE_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "delivered"}'
```

---

## API Endpoints Reference

### Matching Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/matching/packages-along-route/{route_id}` | Find packages along route |
| POST | `/api/matching/accept-package/{package_id}` | Accept a package |
| POST | `/api/matching/decline-package/{package_id}` | Decline a package |
| GET | `/api/matching/optimized-route/{route_id}` | Get optimized delivery route |

### Package Status Flow

```
PENDING → MATCHED → PICKED_UP → IN_TRANSIT → DELIVERED
                ↓
            CANCELLED
```

---

## Testing Tools

### Option 1: curl (Command Line)

See examples above or check `docs/MATCHING_API.md`

### Option 2: Postman

1. Import `docs/Chaski_Matching_API.postman_collection.json`
2. Set variables: `baseUrl`, `token`
3. Run requests in order

### Option 3: REST Client (VS Code)

1. Install "REST Client" extension
2. Open `docs/matching_api.http`
3. Click "Send Request" above each request

### Option 4: Python Script

```bash
# Install dependencies
pip install requests python-dotenv

# Create .env file
cat > .env << EOF
COURIER_EMAIL=your_email@example.com
COURIER_PASSWORD=your_password
BASE_URL=http://localhost:8000
EOF

# Run example
python examples/matching_api_example.py
```

---

## Common Tasks

### Find All Packages Within 20km

```bash
# Create route with larger deviation
curl -X POST http://localhost:8000/api/couriers/routes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "start_address": "City A",
    "start_lat": 37.7749,
    "start_lng": -122.4194,
    "end_address": "City B",
    "end_lat": 37.3382,
    "end_lng": -121.8863,
    "max_deviation_km": 20
  }'
```

### Get Optimized Delivery Order

```bash
# After accepting packages, get optimal route
curl -X GET "http://localhost:8000/api/matching/optimized-route/$ROUTE_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### View All My Active Routes

```bash
curl -X GET http://localhost:8000/api/couriers/routes \
  -H "Authorization: Bearer $TOKEN"
```

### View All My Packages

```bash
curl -X GET http://localhost:8000/api/packages \
  -H "Authorization: Bearer $TOKEN"
```

---

## Response Examples

### Matched Packages Response

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
    "weight_kg": 2.5,
    "pickup_contact_name": "John Doe",
    "pickup_contact_phone": "+1234567890"
  }
]
```

### Accept Package Response

```json
{
  "message": "Package accepted successfully",
  "package_id": 15,
  "status": "matched"
}
```

### Optimized Route Response

```json
{
  "route_id": 1,
  "start": {
    "address": "San Francisco, CA",
    "lat": 37.7749,
    "lng": -122.4194
  },
  "end": {
    "address": "San Jose, CA",
    "lat": 37.3382,
    "lng": -121.8863
  },
  "stops": [
    {
      "type": "pickup",
      "package_id": 15,
      "address": "Palo Alto, CA",
      "lat": 37.4419,
      "lng": -122.1430
    },
    {
      "type": "dropoff",
      "package_id": 15,
      "address": "Mountain View, CA",
      "lat": 37.3861,
      "lng": -122.0839
    }
  ],
  "total_stops": 2
}
```

---

## Error Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 400 | Bad Request | Package already matched, invalid status |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Not a courier, wrong permissions |
| 404 | Not Found | Route or package doesn't exist |
| 422 | Validation Error | Invalid request data |

---

## Algorithm Details

### How Matching Works

1. **Route Creation**: Courier defines start → end with max deviation (e.g., 10km)
2. **Package Filtering**: System finds all PENDING packages
3. **Distance Check**: Calculates if pickup/dropoff are within deviation from route line
4. **Detour Calculation**: Computes extra distance required
5. **Ranking**: Sorts by shortest detour first, then highest price

### Distance Formulas

- **Haversine**: Great-circle distance between GPS points
- **Point-to-Line**: Perpendicular distance from point to route
- **Detour**: `(start→pickup + pickup→dropoff + dropoff→end) - (start→end)`

---

## Tips & Best Practices

### For Couriers

1. Set realistic `max_deviation_km` (5-15km is typical)
2. Check packages before accepting (distance, size, price)
3. Use optimized route endpoint for efficient delivery order
4. Update status promptly (picked_up, in_transit, delivered)

### For Developers

1. Always handle errors (packages may be taken by other couriers)
2. Cache the auth token (valid for 30 minutes)
3. Use the Postman collection for testing
4. Check package price vs. detour distance for profitability

### For Testing

1. Create test routes with different deviation distances
2. Test edge cases (no packages, already matched, etc.)
3. Verify geographic calculations with known coordinates
4. Test complete workflow end-to-end

---

## Next Steps

- **Full Documentation**: `docs/MATCHING_API.md`
- **Python Examples**: `examples/matching_api_example.py`
- **REST Client**: `docs/matching_api.http`
- **Postman Collection**: `docs/Chaski_Matching_API.postman_collection.json`
- **Run Tests**: `pytest tests/test_matching.py -v`

---

## Support

- API Docs: http://localhost:8000/docs (when server is running)
- GitHub Issues: Report bugs and feature requests
- Email: support@chaski.com

---

**Happy Matching! 🚚📦**
