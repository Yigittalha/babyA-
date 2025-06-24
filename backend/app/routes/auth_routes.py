"""
Authentication Routes
Handles user authentication, registration, and token management
"""

from fastapi import APIRouter, Request, Depends, HTTPException
from slowapi import Limiter
from typing import Optional

from ..auth_middleware import verify_token_optional
from ..database import db_manager
from ..models import UserRegistration, UserProfileUpdate, PasswordChange
from ..security import create_access_token, create_refresh_token, SecurityUtils
from ..utils import logger

# Create router
router = APIRouter(prefix="/auth", tags=["authentication"])

# Create limiter
limiter = Limiter(key_func=lambda: "global")


@router.post("/register")
@limiter.limit("30/minute")
async def register(request: Request, user_data: UserRegistration):
    """Register new user"""
    try:
        existing_user = await db_manager.get_user_by_email(user_data.email)
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")

        user_id = await db_manager.create_user(user_data)
        access_token = create_access_token(data={"sub": user_id})

        return {
            "success": True,
            "message": "Kullanıcı başarıyla kaydedildi",
            "access_token": access_token,
            "token_type": "bearer",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration failed: {e}")
        raise HTTPException(status_code=500, detail="Registration failed")


@router.post("/login")
@limiter.limit("30/minute")
async def login(request: Request, login_data: dict):
    """User login"""
    try:
        email = login_data.get("email")
        password = login_data.get("password")

        if not email or not password:
            raise HTTPException(status_code=400, detail="Email and password required")

        user = await db_manager.authenticate_user(email, password)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # Create tokens
        access_token = create_access_token(data={"sub": user["id"]})
        refresh_token = create_refresh_token(data={"sub": user["id"]})

        # Check if user is developer (admin or specific email)
        is_developer = bool(user.get("is_admin", False)) or user["email"] in [
            "developer@babysh.dev",
            "yigittalha630@gmail.com",
        ]

        # Check if user is premium
        subscription_type = user.get("subscription_type", "free")
        is_premium = subscription_type in ["standard", "premium"]

        # Return user data
        user_response = {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "subscription_type": subscription_type,
            "is_premium": is_premium,
            "is_admin": bool(user.get("is_admin", False)),
            "is_developer": is_developer,
        }

        return {
            "success": True,
            "user": user_response,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login failed: {e}")
        raise HTTPException(status_code=500, detail="Login failed")


@router.post("/admin/login")
async def admin_login(request: Request, login_data: dict):
    """Admin login endpoint with credentials validation"""
    try:
        email = login_data.get("email", "") or login_data.get("username", "")
        password = login_data.get("password", "")

        # Validate admin credentials
        valid_admin_credentials = [
            ("admin@babynamer.com", "admin123"),
            ("admin@babyai.com", "admin123"),
            ("yigittalha630@gmail.com", "admin123"),
        ]

        is_valid_admin = any(
            email == admin_email and password == admin_password
            for admin_email, admin_password in valid_admin_credentials
        )

        if not is_valid_admin:
            raise HTTPException(status_code=401, detail="Invalid admin credentials")

        # Get user from database to ensure correct ID
        try:
            user = await db_manager.get_user_by_email(email)
            if user and user.get("is_admin"):
                user_id = user["id"]
                user_name = user["name"]
            else:
                # Create admin user if not exists
                if email == "yigittalha630@gmail.com":
                    user_id = 2
                    user_name = "Yiğit Talha"
                else:
                    user_id = 1
                    user_name = "Admin User"
        except Exception as e:
            logger.warning(f"Could not get admin user from database: {e}")
            # Fallback IDs
            user_id = 2 if email == "yigittalha630@gmail.com" else 1
            user_name = (
                "Yiğit Talha" if email == "yigittalha630@gmail.com" else "Admin User"
            )

        # Create proper JWT tokens for admin
        access_token = create_access_token(
            data={
                "sub": user_id,
                "email": email,
                "subscription_type": "admin",
                "is_admin": True,
            }
        )
        refresh_token = create_refresh_token(data={"sub": user_id})

        return {
            "success": True,
            "message": "Admin girişi başarılı",
            "user": {
                "id": user_id,
                "email": email,
                "name": user_name,
                "role": "admin",
                "is_admin": True,
                "subscription_type": "admin",
                "permissions": ["manage_users", "view_analytics", "manage_content"],
            },
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin login failed: {e}")
        raise HTTPException(status_code=500, detail="Admin login failed")


@router.post("/refresh")
@limiter.limit("100/minute")
async def refresh_token(request: Request, refresh_data: dict):
    """Refresh access token"""
    try:
        refresh_token = refresh_data.get("refresh_token")
        if not refresh_token:
            raise HTTPException(status_code=400, detail="Refresh token required")

        # Validate and create new token
        # Implementation would go here

        return {
            "success": True,
            "access_token": "new_access_token",
            "token_type": "bearer",
        }
    except Exception as e:
        logger.error(f"Token refresh failed: {e}")
        raise HTTPException(status_code=500, detail="Token refresh failed")


@router.get("/me")
async def get_current_user(user_id: Optional[int] = Depends(verify_token_optional)):
    """Get current user profile"""
    try:
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")

        user = await db_manager.get_user_by_id_with_subscription(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Check if user is developer
        is_developer = bool(user.get("is_admin", False)) or user["email"] in [
            "developer@babysh.dev",
            "yigittalha630@gmail.com",
        ]

        # Check if user is premium
        subscription_type = user.get("subscription_type", "free")
        is_premium = subscription_type in ["standard", "premium"]

        return {
            "success": True,
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "subscription_type": subscription_type,
            "is_premium": is_premium,
            "is_admin": bool(user.get("is_admin", False)),
            "is_developer": is_developer,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get current user failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get user")


@router.get("/favorites")
async def get_favorites(
    request: Request,
    page: int = 1,
    limit: int = 20,
    user_id: Optional[int] = Depends(verify_token_optional),
):
    """Get user favorites"""
    try:
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")

        favorites = await db_manager.get_favorites(user_id, page, limit)
        total_count = await db_manager.get_favorite_count(user_id)

        return {
            "success": True,
            "favorites": favorites,
            "total": total_count,
            "page": page,
            "limit": limit,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get favorites failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get favorites")


@router.post("/favorites")
async def add_favorite(
    request: Request,
    favorite_data: dict,
    user_id: Optional[int] = Depends(verify_token_optional),
):
    """Add name to favorites"""
    try:
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")

        # Add to database
        favorite_id = await db_manager.add_favorite(user_id, favorite_data)

        return {
            "success": True,
            "message": f"'{
                favorite_data.get('name')}' has been added to favorites",
            "favorite_id": favorite_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add favorite failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to add favorite")


@router.delete("/favorites/{favorite_id}")
async def remove_favorite(
    request: Request,
    favorite_id: int,
    user_id: Optional[int] = Depends(verify_token_optional),
):
    """Remove favorite"""
    try:
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")

        favorite = await db_manager.get_favorite_by_id(favorite_id)
        if not favorite:
            raise HTTPException(status_code=404, detail="Favorite not found")

        if favorite["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        await db_manager.delete_favorite(favorite_id)

        return {"success": True, "message": "Favorite removed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Remove favorite failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to remove favorite")


@router.put("/profile")
async def update_profile(
    request: Request,
    profile_data: UserProfileUpdate,
    user_id: Optional[int] = Depends(verify_token_optional),
):
    """Update user profile"""
    try:
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")

        # Check if email is already used by another user
        existing_user = await db_manager.get_user_by_email(profile_data.email)
        if existing_user and existing_user["id"] != user_id:
            raise HTTPException(
                status_code=400, detail="Email already in use by another account"
            )

        # Update profile in database
        success = await db_manager.update_user_profile(
            user_id, profile_data.name, profile_data.email
        )

        if not success:
            raise HTTPException(status_code=500, detail="Failed to update profile")

        # Get updated user data
        updated_user = await db_manager.get_user_by_id_with_subscription(user_id)

        # Check premium status
        subscription_type = updated_user.get("subscription_type", "free")
        is_premium = subscription_type in ["standard", "premium"]

        return {
            "success": True,
            "message": "Profile updated successfully",
            "user": {
                "id": updated_user["id"],
                "email": updated_user["email"],
                "name": updated_user["name"],
                "subscription_type": subscription_type,
                "is_premium": is_premium,
                "is_admin": bool(updated_user.get("is_admin", False)),
                "is_developer": (
                    bool(updated_user.get("is_admin", False))
                    or updated_user["email"]
                    in ["developer@babysh.dev", "yigittalha630@gmail.com"]
                ),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update profile failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to update profile")


@router.put("/change-password")
async def change_password(
    request: Request,
    password_data: PasswordChange,
    user_id: Optional[int] = Depends(verify_token_optional),
):
    """Change user password"""
    try:
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")

        # Get current user data
        user = await db_manager.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Verify current password
        if not SecurityUtils.verify_password(
            password_data.current_password, user["password_hash"]
        ):
            raise HTTPException(status_code=400, detail="Current password is incorrect")

        # Hash new password
        new_password_hash = SecurityUtils.hash_password(password_data.new_password)

        # Update password in database
        success = await db_manager.update_user_password(user_id, new_password_hash)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to update password")

        return {"success": True, "message": "Password changed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Change password failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to change password")
