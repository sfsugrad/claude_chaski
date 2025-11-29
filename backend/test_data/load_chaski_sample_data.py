"""
Script to load comprehensive sample data for Chaski test users.
Run this from the backend directory: python -m test_data.load_chaski_sample_data
"""
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone
from random import choice, randint, uniform
import random

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.user import User, UserRole
from app.models.package import Package, PackageStatus, PackageSize, CourierRoute
from app.models.notification import Notification, NotificationType
from app.models.rating import Rating
from app.models.message import Message
from app.models.bid import CourierBid, BidStatus
from app.models.package_note import PackageNote, NoteAuthorType


# Sample locations with realistic coordinates
LOCATIONS = {
    "Austin, TX": [
        {"address": "1407 Barton Springs Rd, Austin, TX 78704", "lat": 30.2632, "lng": -97.7537},
        {"address": "6804 Decker Ln, Austin, TX 78724", "lat": 30.3127, "lng": -97.6406},
        {"address": "1502 E Cesar Chavez St, Austin, TX 78702", "lat": 30.2563, "lng": -97.7295},
        {"address": "2901 S Capital of Texas Hwy, Austin, TX 78746", "lat": 30.2598, "lng": -97.8015},
    ],
    "San Francisco, CA": [
        {"address": "2210 Mission Street, San Francisco, CA 94110", "lat": 37.7615, "lng": -122.4195},
        {"address": "1490 Haight St, San Francisco, CA 94117", "lat": 37.7698, "lng": -122.4469},
        {"address": "101 California St, San Francisco, CA 94111", "lat": 37.7930, "lng": -122.3981},
    ],
    "Las Vegas, NV": [
        {"address": "605 N 13th St, Las Vegas, NV 89101", "lat": 36.1716, "lng": -115.1391},
        {"address": "3570 S Las Vegas Blvd, Las Vegas, NV 89109", "lat": 36.1126, "lng": -115.1728},
    ],
    "Seattle, WA": [
        {"address": "85 Stewart Street, Seattle, WA 98101", "lat": 47.6090, "lng": -122.3403},
        {"address": "1000 4th Ave, Seattle, WA 98104", "lat": 47.6062, "lng": -122.3321},
    ],
    "Chicago, IL": [
        {"address": "1901 S Michigan Ave, Chicago, IL 60616", "lat": 41.8555, "lng": -87.6235},
        {"address": "233 S Wacker Dr, Chicago, IL 60606", "lat": 41.8788, "lng": -87.6359},
    ],
    "Los Angeles, CA": [
        {"address": "4425 Vineland Ave, North Hollywood, CA 91602", "lat": 34.1663, "lng": -118.3687},
        {"address": "6801 Hollywood Blvd, Los Angeles, CA 90028", "lat": 34.1017, "lng": -118.3399},
    ],
    "Denver, CO": [
        {"address": "1120 York St, Denver, CO 80206", "lat": 39.7347, "lng": -104.9540},
        {"address": "1701 Bryant St, Denver, CO 80204", "lat": 39.7508, "lng": -105.0133},
    ],
    "New York, NY": [
        {"address": "407 Grand St, New York, NY 10002", "lat": 40.7149, "lng": -73.9904},
        {"address": "350 5th Ave, New York, NY 10118", "lat": 40.7484, "lng": -73.9857},
    ],
    "Atlanta, GA": [
        {"address": "610 Peachtree St NE, Atlanta, GA 30308", "lat": 33.7711, "lng": -84.3858},
        {"address": "225 Baker St NW, Atlanta, GA 30313", "lat": 33.7634, "lng": -84.3924},
    ],
    "Phoenix, AZ": [
        {"address": "5001 N Central Ave, Phoenix, AZ 85012", "lat": 33.5063, "lng": -112.0741},
        {"address": "401 E Jefferson St, Phoenix, AZ 85004", "lat": 33.4468, "lng": -112.0695},
    ],
}

PACKAGE_DESCRIPTIONS = [
    "Electronics - Laptop and accessories",
    "Clothing bundle - Winter collection",
    "Books - Textbooks for college",
    "Kitchen appliances - Blender and mixer",
    "Sports equipment - Tennis rackets",
    "Art supplies - Canvas and paints",
    "Musical instrument - Guitar",
    "Camera equipment - DSLR and lenses",
    "Home decor - Framed artwork",
    "Jewelry box - Vintage collection",
    "Board games - Family game night set",
    "Pet supplies - Dog food and toys",
    "Garden tools - Pruning set",
    "Office supplies - Printer and paper",
    "Fragile - Antique vase",
    "Documents - Legal paperwork",
    "Medical supplies - First aid kit",
    "Baby items - Stroller parts",
    "Vintage vinyl records collection",
    "Handmade pottery - Gift set",
]

CHAT_MESSAGES = [
    ("sender", "Hi, when can you pick up the package?"),
    ("courier", "I can be there in about 30 minutes. Does that work?"),
    ("sender", "Perfect! I'll have it ready at the front door."),
    ("courier", "Great, I'm on my way now!"),
    ("sender", "Thanks for the quick response!"),
    ("courier", "No problem! I just picked up the package."),
    ("sender", "Awesome, please handle with care - it's fragile."),
    ("courier", "Of course, I've secured it safely. ETA to destination is 45 mins."),
    ("sender", "Thank you so much!"),
    ("courier", "Package delivered! Left it at the front door as requested."),
]

# Sample package notes
SENDER_NOTES = [
    "Please ring the doorbell twice when picking up.",
    "The package is behind the side gate - code is 1234.",
    "Fragile items inside - please handle with care!",
    "Package is in a blue box near the mailbox.",
    "Call me when you arrive, the doorbell is broken.",
    "Leave at neighbor's if I'm not home (unit 5B).",
    "Package is heavy - about 15kg, bring a dolly if needed.",
    "The recipient will only be available after 3pm.",
]

COURIER_NOTES = [
    "Picked up at 2:30 PM, roads are clear today.",
    "Running 15 minutes behind due to traffic.",
    "Package secured in padded bag for extra protection.",
    "Recipient requested delivery to back door.",
    "Taking a short break, will resume in 20 mins.",
    "Weather is bad, driving carefully.",
    "Arrived at destination, waiting for recipient.",
    "Left with building security as instructed.",
]

SYSTEM_NOTES = [
    "Bid deadline extended by 12 hours.",
    "Package matched with courier route.",
    "Delivery window updated by sender.",
    "Route optimization applied.",
]


def get_random_location_pair():
    """Get random pickup and dropoff locations from different cities."""
    cities = list(LOCATIONS.keys())
    pickup_city = choice(cities)
    dropoff_city = choice([c for c in cities if c != pickup_city])

    pickup = choice(LOCATIONS[pickup_city])
    dropoff = choice(LOCATIONS[dropoff_city])

    return pickup, dropoff


def create_routes(db, couriers):
    """Create routes for all couriers."""
    routes = []

    for courier in couriers:
        cities = list(LOCATIONS.keys())
        random.shuffle(cities)

        start_city = cities[0]
        end_city = cities[1]

        start_loc = choice(LOCATIONS[start_city])
        end_loc = choice(LOCATIONS[end_city])

        # Create route with trip_date in the future
        trip_date = datetime.now(timezone.utc) + timedelta(days=randint(1, 14))

        route = CourierRoute(
            courier_id=courier.id,
            start_address=start_loc["address"],
            start_lat=start_loc["lat"],
            start_lng=start_loc["lng"],
            end_address=end_loc["address"],
            end_lat=end_loc["lat"],
            end_lng=end_loc["lng"],
            max_deviation_km=randint(5, 25),
            trip_date=trip_date,
            departure_time=trip_date.replace(hour=randint(6, 18)),
            is_active=True
        )
        db.add(route)
        routes.append(route)

    db.flush()
    print(f"  Created {len(routes)} routes")
    return routes


def create_packages(db, senders, couriers):
    """Create packages in various states."""
    packages = []

    statuses = [
        (PackageStatus.OPEN_FOR_BIDS, 5),
        (PackageStatus.BID_SELECTED, 3),
        (PackageStatus.IN_TRANSIT, 4),
        (PackageStatus.DELIVERED, 6),
        (PackageStatus.CANCELED, 2),
    ]

    for status, count in statuses:
        for i in range(count):
            sender = choice(senders)
            pickup, dropoff = get_random_location_pair()

            package = Package(
                sender_id=sender.id,
                description=choice(PACKAGE_DESCRIPTIONS),
                size=choice(list(PackageSize)),
                weight_kg=round(uniform(0.5, 25.0), 1),
                pickup_address=pickup["address"],
                pickup_lat=pickup["lat"],
                pickup_lng=pickup["lng"],
                dropoff_address=dropoff["address"],
                dropoff_lat=dropoff["lat"],
                dropoff_lng=dropoff["lng"],
                status=status,
                is_active=True,
                requires_proof=choice([True, False]),
                created_at=datetime.now(timezone.utc) - timedelta(days=randint(1, 30)),
            )

            # Set courier for appropriate statuses
            if status in [PackageStatus.BID_SELECTED, PackageStatus.IN_TRANSIT, PackageStatus.DELIVERED]:
                package.courier_id = choice(couriers).id

            # Set timestamps based on status
            if status == PackageStatus.IN_TRANSIT:
                package.in_transit_at = datetime.now(timezone.utc) - timedelta(hours=randint(1, 12))
            elif status == PackageStatus.DELIVERED:
                package.in_transit_at = datetime.now(timezone.utc) - timedelta(days=randint(1, 7))
                package.delivery_time = package.in_transit_at + timedelta(hours=randint(2, 24))

            db.add(package)
            packages.append(package)

    db.flush()
    print(f"  Created {len(packages)} packages")
    return packages


def create_bids(db, packages, couriers, routes):
    """Create bids on packages."""
    bids = []

    # Get packages that can have bids
    biddable_packages = [p for p in packages if p.status in [
        PackageStatus.OPEN_FOR_BIDS,
        PackageStatus.BID_SELECTED,
        PackageStatus.IN_TRANSIT,
        PackageStatus.DELIVERED
    ]]

    for package in biddable_packages:
        # Each package gets 1-4 bids
        num_bids = randint(1, min(4, len(couriers)))
        bidding_couriers = random.sample(couriers, num_bids)

        for idx, courier in enumerate(bidding_couriers):
            # Find a route for this courier
            courier_routes = [r for r in routes if r.courier_id == courier.id]
            route = courier_routes[0] if courier_routes else None

            # Determine bid status
            if package.status == PackageStatus.OPEN_FOR_BIDS:
                bid_status = BidStatus.PENDING
            elif package.courier_id == courier.id:
                bid_status = BidStatus.SELECTED
            else:
                bid_status = BidStatus.REJECTED

            bid = CourierBid(
                package_id=package.id,
                courier_id=courier.id,
                route_id=route.id if route else None,
                proposed_price=round(uniform(15.0, 150.0), 2),
                estimated_delivery_hours=randint(2, 48),
                message=f"I can deliver this package safely. I have experience with similar items.",
                status=bid_status,
                created_at=datetime.now(timezone.utc) - timedelta(days=randint(0, 5)),
            )

            if bid_status == BidStatus.SELECTED:
                bid.selected_at = datetime.now(timezone.utc) - timedelta(days=randint(0, 3))
                package.selected_bid_id = bid.id

            db.add(bid)
            bids.append(bid)

    db.flush()
    print(f"  Created {len(bids)} bids")
    return bids


def create_notifications(db, packages, users):
    """Create notifications for users."""
    notifications = []

    notification_types = [
        (NotificationType.PACKAGE_MATCHED, "Your package has been matched with a courier!"),
        (NotificationType.PACKAGE_ACCEPTED, "A courier has accepted your package delivery."),
        (NotificationType.PACKAGE_IN_TRANSIT, "Your package is now in transit!"),
        (NotificationType.PACKAGE_DELIVERED, "Your package has been delivered successfully!"),
        (NotificationType.NEW_BID_RECEIVED, "You received a new bid on your package."),
        (NotificationType.BID_SELECTED, "Your bid was selected!"),
        (NotificationType.ROUTE_MATCH_FOUND, "Found packages matching your route."),
    ]

    for user in users:
        # Each user gets 3-8 notifications
        num_notifications = randint(3, 8)

        for _ in range(num_notifications):
            notif_type, message = choice(notification_types)

            # Find a relevant package for the notification
            if user.role in [UserRole.SENDER, UserRole.BOTH]:
                relevant_packages = [p for p in packages if p.sender_id == user.id]
            else:
                relevant_packages = [p for p in packages if p.courier_id == user.id]

            package_id = choice(relevant_packages).id if relevant_packages else None

            notification = Notification(
                user_id=user.id,
                type=notif_type,
                message=message,
                package_id=package_id,
                read=choice([True, False]),
                created_at=datetime.now(timezone.utc) - timedelta(days=randint(0, 14)),
            )
            db.add(notification)
            notifications.append(notification)

    db.flush()
    print(f"  Created {len(notifications)} notifications")
    return notifications


def create_ratings(db, packages, users):
    """Create ratings for delivered packages."""
    ratings = []

    delivered_packages = [p for p in packages if p.status == PackageStatus.DELIVERED and p.courier_id]

    for package in delivered_packages:
        sender = next((u for u in users if u.id == package.sender_id), None)
        courier = next((u for u in users if u.id == package.courier_id), None)

        if sender and courier:
            # Sender rates courier
            rating1 = Rating(
                rater_id=sender.id,
                rated_user_id=courier.id,
                package_id=package.id,
                score=randint(3, 5),
                comment=choice([
                    "Great service, very professional!",
                    "Package arrived on time and in perfect condition.",
                    "Excellent communication throughout the delivery.",
                    "Would definitely use this courier again!",
                    "Fast and reliable delivery.",
                    None
                ]),
                created_at=package.delivery_time + timedelta(hours=randint(1, 48)) if package.delivery_time else datetime.now(timezone.utc),
            )
            db.add(rating1)
            ratings.append(rating1)

            # Courier rates sender (50% chance)
            if choice([True, False]):
                rating2 = Rating(
                    rater_id=courier.id,
                    rated_user_id=sender.id,
                    package_id=package.id,
                    score=randint(4, 5),
                    comment=choice([
                        "Package was ready on time.",
                        "Easy pickup, clear instructions.",
                        "Great communication!",
                        None
                    ]),
                    created_at=package.delivery_time + timedelta(hours=randint(1, 48)) if package.delivery_time else datetime.now(timezone.utc),
                )
                db.add(rating2)
                ratings.append(rating2)

    db.flush()
    print(f"  Created {len(ratings)} ratings")
    return ratings


def create_messages(db, packages, users):
    """Create chat messages for packages with assigned couriers."""
    messages = []

    packages_with_couriers = [p for p in packages if p.courier_id and p.status in [
        PackageStatus.BID_SELECTED, PackageStatus.IN_TRANSIT, PackageStatus.DELIVERED
    ]]

    for package in packages_with_couriers:
        sender = next((u for u in users if u.id == package.sender_id), None)
        courier = next((u for u in users if u.id == package.courier_id), None)

        if sender and courier:
            # Add 4-10 messages per conversation
            num_messages = randint(4, 10)
            base_time = datetime.now(timezone.utc) - timedelta(days=randint(1, 7))

            for i in range(min(num_messages, len(CHAT_MESSAGES))):
                role, content = CHAT_MESSAGES[i]
                msg_sender = sender if role == "sender" else courier

                message = Message(
                    package_id=package.id,
                    sender_id=msg_sender.id,
                    content=content,
                    is_read=True if i < num_messages - 2 else choice([True, False]),
                    created_at=base_time + timedelta(minutes=i * randint(5, 30)),
                )
                db.add(message)
                messages.append(message)

    db.flush()
    print(f"  Created {len(messages)} messages")
    return messages


def create_notes(db, packages, users):
    """Create package notes for various packages."""
    notes = []

    # Add notes to about 60% of packages
    packages_for_notes = [p for p in packages if choice([True, True, True, False, False])]

    for package in packages_for_notes:
        sender = next((u for u in users if u.id == package.sender_id), None)
        courier = next((u for u in users if u.id == package.courier_id), None) if package.courier_id else None

        base_time = package.created_at or datetime.now(timezone.utc) - timedelta(days=randint(1, 7))

        # Always add a sender note
        sender_note = PackageNote(
            package_id=package.id,
            author_id=sender.id if sender else None,
            author_type=NoteAuthorType.SENDER,
            content=choice(SENDER_NOTES),
            created_at=base_time + timedelta(minutes=randint(5, 60)),
        )
        db.add(sender_note)
        notes.append(sender_note)

        # Add courier notes for packages with assigned couriers (in transit or delivered)
        if courier and package.status in [PackageStatus.IN_TRANSIT, PackageStatus.DELIVERED]:
            # Add 1-3 courier notes
            num_courier_notes = randint(1, 3)
            for i in range(num_courier_notes):
                courier_note = PackageNote(
                    package_id=package.id,
                    author_id=courier.id,
                    author_type=NoteAuthorType.COURIER,
                    content=choice(COURIER_NOTES),
                    created_at=base_time + timedelta(hours=randint(1, 24) + i),
                )
                db.add(courier_note)
                notes.append(courier_note)

        # Add system notes occasionally (20% chance)
        if choice([True, False, False, False, False]):
            system_note = PackageNote(
                package_id=package.id,
                author_id=None,
                author_type=NoteAuthorType.SYSTEM,
                content=choice(SYSTEM_NOTES),
                created_at=base_time + timedelta(hours=randint(1, 12)),
            )
            db.add(system_note)
            notes.append(system_note)

    db.flush()
    print(f"  Created {len(notes)} package notes")
    return notes


def main():
    """Main function to load sample data."""
    db = SessionLocal()

    try:
        print("\nLoading Chaski sample data...")
        print("=" * 50)

        # Get existing users by email pattern
        senders = db.query(User).filter(User.email.like("chaski+sender%")).all()
        couriers = db.query(User).filter(User.email.like("chaski+courier%")).all()
        hybrids = db.query(User).filter(User.email.like("chaski+hybrid%")).all()

        print(f"Found {len(senders)} senders, {len(couriers)} couriers, {len(hybrids)} hybrid users")

        if not senders or not couriers:
            print("Error: No test users found. Please create users first.")
            return

        # Combine couriers and hybrids for courier activities
        all_couriers = couriers + hybrids
        all_senders = senders + hybrids
        all_users = senders + couriers + hybrids

        print("\nCreating sample data...")
        print("-" * 50)

        # Create routes for couriers and hybrids
        routes = create_routes(db, all_couriers)

        # Create packages from senders and hybrids
        packages = create_packages(db, all_senders, all_couriers)

        # Create bids
        bids = create_bids(db, packages, all_couriers, routes)

        # Create notifications
        notifications = create_notifications(db, packages, all_users)

        # Create ratings
        ratings = create_ratings(db, packages, all_users)

        # Create messages
        messages = create_messages(db, packages, all_users)

        # Create package notes
        notes = create_notes(db, packages, all_users)

        db.commit()

        print("-" * 50)
        print("Sample data loaded successfully!")
        print(f"\nSummary:")
        print(f"  Routes: {len(routes)}")
        print(f"  Packages: {len(packages)}")
        print(f"  Bids: {len(bids)}")
        print(f"  Notifications: {len(notifications)}")
        print(f"  Ratings: {len(ratings)}")
        print(f"  Messages: {len(messages)}")
        print(f"  Package Notes: {len(notes)}")

    except Exception as e:
        print(f"Error loading sample data: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
