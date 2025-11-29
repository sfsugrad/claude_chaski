# Chaski API Documentation

This directory contains comprehensive documentation for the Chaski matching algorithm API.

## Documentation Files

### 📖 Main Documentation

- **[QUICK_START.md](./QUICK_START.md)** - Get started in 5 minutes with simple curl examples
- **[MATCHING_API.md](./MATCHING_API.md)** - Complete API reference with detailed examples

### 🧪 Testing Tools

- **[matching_api.http](./matching_api.http)** - REST Client file for VS Code/JetBrains
- **[Chaski_Matching_API.postman_collection.json](./Chaski_Matching_API.postman_collection.json)** - Postman collection (import ready)

### 💻 Code Examples

- **[../examples/matching_api_example.py](../examples/matching_api_example.py)** - Python script with complete workflows

## Quick Links

### Getting Started

1. **New to the API?** Start with [QUICK_START.md](./QUICK_START.md)
2. **Want full details?** Read [MATCHING_API.md](./MATCHING_API.md)
3. **Prefer Postman?** Import [Chaski_Matching_API.postman_collection.json](./Chaski_Matching_API.postman_collection.json)
4. **Using VS Code?** Open [matching_api.http](./matching_api.http) with REST Client extension

### API Endpoints Overview

The matching algorithm provides these endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/matching/packages-along-route/{route_id}` | GET | Find packages along a courier's route |
| `/api/matching/accept-package/{package_id}` | POST | Courier accepts a package |
| `/api/matching/decline-package/{package_id}` | POST | Courier declines a package |
| `/api/matching/optimized-route/{route_id}` | GET | Get optimized delivery order |

## What is the Matching Algorithm?

The Chaski matching algorithm connects package senders with couriers traveling along similar routes. It uses geospatial calculations to:

1. Find packages within a courier's acceptable deviation distance
2. Calculate the detour required for pickup and delivery
3. Rank packages by efficiency (shortest detour first)
4. Optimize delivery order for multiple packages

### Example Workflow

```
Courier creates route: SF → San Jose (max 10km deviation)
    ↓
Algorithm finds packages along route
    ↓
Courier accepts best package (shortest detour, highest pay)
    ↓
System provides optimized delivery route
    ↓
Courier picks up → delivers → marks complete
```

## Testing the API

### Option 1: curl (Command Line)

```bash
# Login
TOKEN=$(curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"courier@example.com","password":"pass"}' \
  | jq -r '.access_token')

# Find packages
curl -X GET "http://localhost:8000/api/matching/packages-along-route/1" \
  -H "Authorization: Bearer $TOKEN"
```

### Option 2: Postman

1. Import `Chaski_Matching_API.postman_collection.json`
2. Run "Complete Workflow" folder
3. Collection automatically saves tokens and IDs

### Option 3: REST Client (VS Code)

1. Install "REST Client" extension
2. Open `matching_api.http`
3. Click "Send Request" on any endpoint

### Option 4: Python

```bash
cd examples
pip install requests python-dotenv
python matching_api_example.py
```

## Algorithm Details

### Geographic Calculations

- **Haversine Formula**: Calculate distances between GPS coordinates
- **Point-to-Line Distance**: Find perpendicular distance from package to route
- **Detour Calculation**: Compute extra kilometers required

### Matching Criteria

A package appears in matches if:
- ✅ Status is PENDING (not already matched)
- ✅ Package is active (not soft-deleted)
- ✅ Pickup point is within `max_deviation_km` from route
- ✅ Dropoff point is within `max_deviation_km` from route

### Sorting Logic

Packages are sorted by:
1. **Primary**: Detour distance (ascending) - shortest detours first
2. **Secondary**: Price (descending) - higher paying packages first

## Interactive API Docs

When the server is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Support

- **Questions?** Check [MATCHING_API.md](./MATCHING_API.md) for detailed explanations
- **Issues?** Report on GitHub
- **Examples?** See `examples/matching_api_example.py`

## File Organization

```
docs/
├── README.md (this file)
├── QUICK_START.md (5-minute tutorial)
├── MATCHING_API.md (complete reference)
├── matching_api.http (REST Client file)
└── Chaski_Matching_API.postman_collection.json (Postman collection)

examples/
└── matching_api_example.py (Python examples)
```

## Recent Updates

### v1.0.0 (2025-11-26)
- Initial matching algorithm implementation
- Complete API documentation
- Postman collection and REST Client examples
- Python example scripts
- Comprehensive test suite

---

**Ready to start?** → [QUICK_START.md](./QUICK_START.md)
