import re


def validate_password(password: str) -> bool:
    """
    Validates the password based on the following criteria:
    - At least 8 characters long
    - Contains at least one uppercase letter
    - Contains at least one lowercase letter
    - Contains at least one digit
    - Contains at least one special character

    Args:
        password (str): The password to validate.

    Returns:
        bool: True if the password is valid, False otherwise.
    """
    if not password:
        return False
    
    if len(password) < 8:
        return False
    if not re.search(r"[A-Z]", password):
        return False
    if not re.search(r"[a-z]", password):
        return False
    if not re.search(r"\d", password):
        return False
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False
    return True

def validate_email(email: str) -> bool:
    """
    Validates the email format using a regular expression.

    Args:
        email (str): The email address to validate.

    Returns:
        bool: True if the email format is valid, False otherwise.
    """
    if not email:
        return False
    
    email_regex = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    return re.match(email_regex, email) is not None 

def validate_name(name: str) -> bool:
    """
    Validates the name format using a regular expression.

    Args:
        name (str): The name to validate.

    Returns:
        bool: True if the name format is valid, False otherwise.
    """
    if not name:
        return False
    name_regex = r"^[a-zA-Z\s'-]+$"
    return re.match(name_regex, name) is not None

def validate_phone_number(phone_number: str) -> bool:
    """
    Validates the phone number format using a regular expression.

    Args:
        phone_number (str): The phone number to validate.

    Returns:
        bool: True if the phone number format is valid, False otherwise.
    """
    if not phone_number:
        return False
    phone_regex = r"^\+?[1-9]\d{1,14}$"
    return re.match(phone_regex, phone_number) is not None  