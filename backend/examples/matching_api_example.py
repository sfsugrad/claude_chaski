"""
Example script demonstrating how to use the Chaski Matching API.

Requirements:
    pip install requests python-dotenv

Usage:
    1. Create a .env file with your credentials:
       COURIER_EMAIL=your_courier_email@example.com
       COURIER_PASSWORD=your_password
       BASE_URL=http://localhost:8000

    2. Run the script:
       python matching_api_example.py
"""

import requests
import os
from typing import Dict, List, Optional
from dotenv import load_dotenv
import json

# Load environment variables
load_dotenv()

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
COURIER_EMAIL = os.getenv("COURIER_EMAIL")
COURIER_PASSWORD = os.getenv("COURIER_PASSWORD")


class ChaskiAPIClient:
    """Client for interacting with the Chaski Matching API"""

    def __init__(self, base_url: str):
        self.base_url = base_url
        self.token: Optional[str] = None
        self.headers: Dict[str, str] = {}

    def login(self, email: str, password: str) -> Dict:
        """Login and get authentication token"""
        response = requests.post(
            f"{self.base_url}/api/auth/login",
            json={"email": email, "password": password}
        )
        response.raise_for_status()
        data = response.json()

        self.token = data["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}

        print(f"✓ Logged in as {email}")
        return data

    def create_route(
        self,
        start_address: str,
        start_lat: float,
        start_lng: float,
        end_address: str,
        end_lat: float,
        end_lng: float,
        max_deviation_km: int = 10,
        departure_time: Optional[str] = None
    ) -> Dict:
        """Create a courier route"""
        route_data = {
            "start_address": start_address,
            "start_lat": start_lat,
            "start_lng": start_lng,
            "end_address": end_address,
            "end_lat": end_lat,
            "end_lng": end_lng,
            "max_deviation_km": max_deviation_km
        }

        if departure_time:
            route_data["departure_time"] = departure_time

        response = requests.post(
            f"{self.base_url}/api/couriers/routes",
            json=route_data,
            headers=self.headers
        )
        response.raise_for_status()
        data = response.json()

        print(f"✓ Created route #{data['id']}: {start_address} → {end_address}")
        return data

    def get_packages_along_route(self, route_id: int) -> List[Dict]:
        """Find packages along a courier's route"""
        response = requests.get(
            f"{self.base_url}/api/matching/packages-along-route/{route_id}",
            headers=self.headers
        )
        response.raise_for_status()
        packages = response.json()

        print(f"\n✓ Found {len(packages)} packages along route #{route_id}")
        return packages

    def accept_package(self, package_id: int) -> Dict:
        """Accept a package for delivery"""
        response = requests.post(
            f"{self.base_url}/api/matching/accept-package/{package_id}",
            headers=self.headers
        )
        response.raise_for_status()
        data = response.json()

        print(f"✓ Accepted package #{package_id}")
        return data

    def decline_package(self, package_id: int) -> Dict:
        """Decline a matched package"""
        response = requests.post(
            f"{self.base_url}/api/matching/decline-package/{package_id}",
            headers=self.headers
        )
        response.raise_for_status()
        data = response.json()

        print(f"✓ Declined package #{package_id}")
        return data

    def update_package_status(self, package_id: int, status: str) -> Dict:
        """Update package status"""
        response = requests.put(
            f"{self.base_url}/api/packages/{package_id}/status",
            json={"status": status},
            headers=self.headers
        )
        response.raise_for_status()
        data = response.json()

        print(f"✓ Updated package #{package_id} status to: {status}")
        return data

    def get_optimized_route(self, route_id: int) -> Dict:
        """Get optimized route with all packages ordered"""
        response = requests.get(
            f"{self.base_url}/api/matching/optimized-route/{route_id}",
            headers=self.headers
        )
        response.raise_for_status()
        data = response.json()

        print(f"\n✓ Optimized route has {data['total_stops']} stops")
        return data

    def print_package_details(self, package: Dict):
        """Pretty print package details"""
        print(f"\n📦 Package #{package['package_id']}")
        print(f"   Description: {package['description']}")
        print(f"   Size: {package['size']} ({package['weight_kg']} kg)")
        print(f"   Pickup: {package['pickup_address']}")
        print(f"   Dropoff: {package['dropoff_address']}")
        print(f"   Distance from route: {package['distance_from_route_km']} km")
        print(f"   Estimated detour: {package['estimated_detour_km']} km")
        if package['price']:
            print(f"   Payment: ${package['price']:.2f}")


def example_workflow():
    """Example workflow: Find and accept packages"""
    print("=" * 60)
    print("Chaski Matching API - Example Workflow")
    print("=" * 60)

    # Initialize client
    client = ChaskiAPIClient(BASE_URL)

    # 1. Login
    print("\n[1] Logging in...")
    client.login(COURIER_EMAIL, COURIER_PASSWORD)

    # 2. Create a route
    print("\n[2] Creating courier route...")
    route = client.create_route(
        start_address="San Francisco, CA",
        start_lat=37.7749,
        start_lng=-122.4194,
        end_address="San Jose, CA",
        end_lat=37.3382,
        end_lng=-121.8863,
        max_deviation_km=15,
        departure_time="2025-12-01T10:00:00Z"
    )
    route_id = route["id"]

    # 3. Find packages along route
    print("\n[3] Finding packages along route...")
    packages = client.get_packages_along_route(route_id)

    if not packages:
        print("   No packages found along this route.")
        return

    # Display package details
    for package in packages:
        client.print_package_details(package)

    # 4. Accept the first package (shortest detour)
    if packages:
        best_package = packages[0]
        print(f"\n[4] Accepting best package (shortest detour)...")
        client.accept_package(best_package["package_id"])

        # 5. Get optimized route
        print("\n[5] Getting optimized route with all accepted packages...")
        optimized = client.get_optimized_route(route_id)

        if optimized["stops"]:
            print("\n📍 Optimized delivery route:")
            for i, stop in enumerate(optimized["stops"], 1):
                print(f"   {i}. {stop['type'].title()}: {stop['address']}")
                print(f"      Package #{stop['package_id']}")

        # 6. Simulate delivery lifecycle
        print(f"\n[6] Simulating delivery lifecycle...")
        package_id = best_package["package_id"]

        client.update_package_status(package_id, "picked_up")
        print("   Courier picked up the package")

        client.update_package_status(package_id, "in_transit")
        print("   Package is in transit")

        client.update_package_status(package_id, "delivered")
        print("   Package delivered successfully!")

    print("\n" + "=" * 60)
    print("Workflow completed successfully!")
    print("=" * 60)


def example_search_only():
    """Example: Just search for packages without accepting"""
    print("=" * 60)
    print("Chaski Matching API - Search Packages")
    print("=" * 60)

    client = ChaskiAPIClient(BASE_URL)

    # Login
    print("\nLogging in...")
    client.login(COURIER_EMAIL, COURIER_PASSWORD)

    # Create route
    print("\nCreating route...")
    route = client.create_route(
        start_address="Los Angeles, CA",
        start_lat=34.0522,
        start_lng=-118.2437,
        end_address="San Diego, CA",
        end_lat=32.7157,
        end_lng=-117.1611,
        max_deviation_km=20
    )

    # Find packages
    print(f"\nSearching for packages along route #{route['id']}...")
    packages = client.get_packages_along_route(route["id"])

    if packages:
        print(f"\nFound {len(packages)} packages:")
        for package in packages:
            client.print_package_details(package)
    else:
        print("\nNo packages found along this route.")


def example_error_handling():
    """Example: Demonstrate error handling"""
    print("=" * 60)
    print("Chaski Matching API - Error Handling Examples")
    print("=" * 60)

    client = ChaskiAPIClient(BASE_URL)
    client.login(COURIER_EMAIL, COURIER_PASSWORD)

    # Try to accept non-existent package
    print("\n[1] Trying to accept non-existent package...")
    try:
        client.accept_package(99999)
    except requests.exceptions.HTTPError as e:
        print(f"   ✗ Error (expected): {e.response.status_code} - {e.response.json()['detail']}")

    # Try to decline package not assigned to you
    print("\n[2] Trying to decline unassigned package...")
    try:
        client.decline_package(99999)
    except requests.exceptions.HTTPError as e:
        print(f"   ✗ Error (expected): {e.response.status_code} - {e.response.json()['detail']}")

    # Try to access route without authentication
    print("\n[3] Trying to access API without authentication...")
    try:
        response = requests.get(f"{BASE_URL}/api/matching/packages-along-route/1")
        response.raise_for_status()
    except requests.exceptions.HTTPError as e:
        print(f"   ✗ Error (expected): {e.response.status_code} - Unauthorized")

    print("\n✓ Error handling works as expected!")


if __name__ == "__main__":
    if not COURIER_EMAIL or not COURIER_PASSWORD:
        print("Error: Please set COURIER_EMAIL and COURIER_PASSWORD in .env file")
        exit(1)

    # Run the main workflow
    try:
        example_workflow()

        # Uncomment to run other examples:
        # example_search_only()
        # example_error_handling()

    except requests.exceptions.RequestException as e:
        print(f"\n❌ API Error: {e}")
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_detail = e.response.json()
                print(f"   Detail: {error_detail}")
            except:
                print(f"   Response: {e.response.text}")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
