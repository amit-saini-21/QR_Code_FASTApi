from werkzeug.security import generate_password_hash, check_password_hash as werkzeug_check_password_hash

def hash_password(password: str) -> str:
    """
    Hashes a password using Werkzeug's generate_password_hash function.

    Args:
        password (str): The plain text password to be hashed.

    Returns:
        str: The hashed password.
    """
    return generate_password_hash(password)

def check_password_hash(hashed_password: str, password: str) -> bool:
    """
    Checks if a plain text password matches a hashed password.

    Args:
        hashed_password (str): The hashed password to compare against.
        password (str): The plain text password to check.

    Returns:
        bool: True if the passwords match, False otherwise.
    """
    return werkzeug_check_password_hash(hashed_password, password)