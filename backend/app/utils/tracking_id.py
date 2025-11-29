"""
Tracking ID generator for packages.
"""
import secrets
import string


def generate_tracking_id() -> str:
    """
    Generate a unique tracking ID in format xxxx-xxxx-xxxx-xxxx.

    Uses alphanumeric characters (lowercase letters + digits).
    Total entropy: 36^16 = ~7.96 x 10^24 possible combinations.

    Returns:
        A tracking ID string like 'a1b2-c3d4-e5f6-g7h8'
    """
    chars = string.ascii_lowercase + string.digits
    segments = []
    for _ in range(4):
        segment = ''.join(secrets.choice(chars) for _ in range(4))
        segments.append(segment)
    return '-'.join(segments)


def is_valid_tracking_id(tracking_id: str) -> bool:
    """
    Validate that a string is a valid tracking ID format.

    Args:
        tracking_id: The string to validate

    Returns:
        True if the string matches xxxx-xxxx-xxxx-xxxx format
    """
    if not tracking_id or len(tracking_id) != 19:
        return False

    parts = tracking_id.split('-')
    if len(parts) != 4:
        return False

    valid_chars = set(string.ascii_lowercase + string.digits)
    for part in parts:
        if len(part) != 4:
            return False
        if not all(c in valid_chars for c in part):
            return False

    return True
