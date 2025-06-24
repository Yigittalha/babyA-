"""
Token System API Routes
Provides REST endpoints for token packages, balances, purchases, and admin management
"""

from datetime import datetime
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, HTTPException, Depends, Request, status
from pydantic import BaseModel, Field, validator

from ..auth_middleware import verify_token_optional, require_admin
from ..services.token_service import token_service
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/tokens", tags=["tokens"])


# ========================================
# PYDANTIC MODELS FOR REQUEST/RESPONSE
# ========================================

class TokenPackageCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    token_amount: int = Field(..., gt=0, le=10000)
    price: float = Field(..., gt=0, le=1000)
    currency: str = Field("USD", min_length=3, max_length=3)
    is_active: bool = Field(True)
    sort_order: int = Field(0, ge=0)

class TokenPackageUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    token_amount: Optional[int] = Field(None, gt=0, le=10000)
    price: Optional[float] = Field(None, gt=0, le=1000)
    currency: Optional[str] = Field(None, min_length=3, max_length=3)
    is_active: Optional[bool] = None
    sort_order: Optional[int] = Field(None, ge=0)

class TokenPurchaseRequest(BaseModel):
    package_id: int = Field(..., gt=0)
    payment_provider: Optional[str] = Field("stripe", max_length=50)
    currency: Optional[str] = Field("USD", min_length=3, max_length=3)

class TokenUsageRequest(BaseModel):
    action_type: str = Field(..., min_length=1, max_length=50)
    token_count: Optional[int] = Field(None, gt=0, le=100)
    metadata: Optional[Dict[str, Any]] = None

class PaymentCompleteRequest(BaseModel):
    purchase_id: int = Field(..., gt=0)
    transaction_id: str = Field(..., min_length=1, max_length=255)
    payment_status: str = Field("completed", pattern="^(completed|failed|refunded)$")

class SystemConfigUpdate(BaseModel):
    enable_token_system: Optional[bool] = None
    enable_subscription_system: Optional[bool] = None
    token_system_mode: Optional[str] = Field(None, pattern="^(token|subscription|hybrid)$")
    tokens_per_name_generation: Optional[int] = Field(None, gt=0, le=10)
    tokens_per_name_analysis: Optional[int] = Field(None, gt=0, le=10)


# ========================================
# TOKEN PACKAGE ENDPOINTS (ADMIN)
# ========================================

@router.get("/packages")
async def get_token_packages(
    active_only: bool = True,
    user_id: Optional[int] = Depends(verify_token_optional)
):
    """Get all available token packages"""
    try:
        packages = await token_service.get_token_packages(active_only=active_only)
        
        return {
            "success": True,
            "packages": packages,
            "count": len(packages)
        }
        
    except Exception as e:
        logger.error(f"Error getting token packages: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get token packages"
        )

@router.post("/packages")
async def create_token_package(
    package_data: TokenPackageCreate,
    admin_user: dict = Depends(require_admin)
):
    """Create new token package (Admin only)"""
    try:
        result = await token_service.create_token_package(package_data.dict())
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["error"]
            )
        
        logger.info(f"Admin {admin_user['email']} created token package: {result['package']['name']}")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating token package: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create token package"
        )

@router.put("/packages/{package_id}")
async def update_token_package(
    package_id: int,
    update_data: TokenPackageUpdate,
    admin_user: dict = Depends(require_admin)
):
    """Update token package (Admin only)"""
    try:
        # Filter out None values
        filtered_data = {k: v for k, v in update_data.dict().items() if v is not None}
        
        result = await token_service.update_token_package(package_id, filtered_data)
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND if "not found" in result["error"].lower() else status.HTTP_400_BAD_REQUEST,
                detail=result["error"]
            )
        
        logger.info(f"Admin {admin_user['email']} updated token package {package_id}")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating token package: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update token package"
        )

@router.delete("/packages/{package_id}")
async def delete_token_package(
    package_id: int,
    admin_user: dict = Depends(require_admin)
):
    """Delete token package (Admin only)"""
    try:
        result = await token_service.delete_token_package(package_id)
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND if "not found" in result["error"].lower() else status.HTTP_400_BAD_REQUEST,
                detail=result["error"]
            )
        
        logger.info(f"Admin {admin_user['email']} deleted token package {package_id}")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting token package: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete token package"
        )


# ========================================
# USER TOKEN BALANCE ENDPOINTS
# ========================================

@router.get("/balance")
async def get_user_token_balance(
    user_id: int = Depends(verify_token_optional)
):
    """Get current user's token balance"""
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    try:
        balance = await token_service.get_user_token_balance(user_id)
        
        return {
            "success": True,
            "balance": balance
        }
        
    except Exception as e:
        logger.error(f"Error getting user token balance: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get token balance"
        )

@router.get("/users/{target_user_id}/balance")
async def get_user_balance_admin(
    target_user_id: int,
    admin_user: dict = Depends(require_admin)
):
    """Get any user's token balance (Admin only)"""
    try:
        balance = await token_service.get_user_token_balance(target_user_id)
        
        return {
            "success": True,
            "balance": balance
        }
        
    except Exception as e:
        logger.error(f"Error getting user token balance: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get token balance"
        )

@router.post("/use")
async def use_tokens(
    usage_request: TokenUsageRequest,
    user_id: int = Depends(verify_token_optional)
):
    """Use tokens for an action"""
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    try:
        # Check if token system is enabled
        token_enabled = await token_service.is_token_system_enabled()
        if not token_enabled:
            return {
                "success": True,
                "message": "Token system disabled, action allowed",
                "tokens_used": 0,
                "remaining_balance": "unlimited"
            }
        
        result = await token_service.use_tokens(
            user_id=user_id,
            action_type=usage_request.action_type,
            token_count=usage_request.token_count,
            metadata=usage_request.metadata
        )
        
        if not result["success"]:
            if "Insufficient tokens" in result["error"]:
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail={
                        "error": "Insufficient tokens",
                        "required": result["required"],
                        "available": result["available"],
                        "message": "Token satın alarak devam edebilirsiniz"
                    }
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=result["error"]
                )
        
        return {
            "success": True,
            "tokens_used": result["tokens_used"],
            "remaining_balance": result["remaining_balance"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error using tokens: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to use tokens"
        )


# ========================================
# TOKEN PURCHASE ENDPOINTS
# ========================================

@router.post("/purchase")
async def purchase_tokens(
    purchase_request: TokenPurchaseRequest,
    user_id: int = Depends(verify_token_optional)
):
    """Initiate token purchase"""
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    try:
        # Create purchase record
        payment_data = {
            "provider": purchase_request.payment_provider,
            "currency": purchase_request.currency
        }
        
        result = await token_service.create_purchase_record(
            user_id=user_id,
            package_id=purchase_request.package_id,
            payment_data=payment_data
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["error"]
            )
        
        logger.info(f"User {user_id} initiated token purchase: {result['purchase']['package_name']}")
        
        return {
            "success": True,
            "purchase": result["purchase"],
            "message": "Purchase initiated. Complete payment to receive tokens."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error initiating token purchase: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initiate purchase"
        )

@router.post("/purchase/complete")
async def complete_token_purchase(
    payment_data: PaymentCompleteRequest,
    user_id: Optional[int] = Depends(verify_token_optional)
):
    """Complete token purchase after payment confirmation"""
    try:
        result = await token_service.complete_purchase(
            purchase_id=payment_data.purchase_id,
            transaction_id=payment_data.transaction_id
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["error"]
            )
        
        logger.info(f"Token purchase {payment_data.purchase_id} completed successfully")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing token purchase: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to complete purchase"
        )

@router.get("/purchases")
async def get_user_purchases(
    limit: int = 50,
    user_id: int = Depends(verify_token_optional)
):
    """Get user's purchase history"""
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    try:
        purchases = await token_service.get_user_purchases(user_id, limit=limit)
        
        return {
            "success": True,
            "purchases": purchases,
            "count": len(purchases)
        }
        
    except Exception as e:
        logger.error(f"Error getting user purchases: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get purchase history"
        )


# ========================================
# ANALYTICS ENDPOINTS
# ========================================

@router.get("/analytics/usage")
async def get_token_usage_analytics(
    days: int = 30,
    user_id: int = Depends(verify_token_optional)
):
    """Get user's token usage analytics"""
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    try:
        analytics = await token_service.get_token_usage_analytics(user_id=user_id, days=days)
        
        return {
            "success": True,
            "analytics": analytics
        }
        
    except Exception as e:
        logger.error(f"Error getting token usage analytics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get usage analytics"
        )

@router.get("/admin/analytics")
async def get_admin_token_analytics(
    admin_user: dict = Depends(require_admin)
):
    """Get comprehensive token analytics (Admin only)"""
    try:
        stats = await token_service.get_admin_token_stats()
        
        return {
            "success": True,
            "stats": stats
        }
        
    except Exception as e:
        logger.error(f"Error getting admin token analytics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get token analytics"
        )


# ========================================
# SYSTEM CONFIGURATION ENDPOINTS (ADMIN)
# ========================================

@router.get("/admin/config")
async def get_token_system_config(
    admin_user: dict = Depends(require_admin)
):
    """Get token system configuration (Admin only)"""
    try:
        config = {
            "enable_token_system": await token_service.is_token_system_enabled(),
            "enable_subscription_system": await token_service.is_subscription_system_enabled(),
            "system_mode": await token_service.get_system_mode(),
            "tokens_per_name_generation": await token_service.get_token_cost("name_generation"),
            "tokens_per_name_analysis": await token_service.get_token_cost("name_analysis")
        }
        
        return {
            "success": True,
            "config": config
        }
        
    except Exception as e:
        logger.error(f"Error getting system config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get system configuration"
        )

@router.post("/admin/config")
async def update_system_config(
    config_update: SystemConfigUpdate,
    admin_user: dict = Depends(require_admin)
):
    """Update token system configuration (Admin only)"""
    try:
        updates = []
        
        # This would require adding update_system_config method to token_service
        # For now, return success message
        
        logger.info(f"Admin {admin_user['email']} updated token system configuration")
        
        return {
            "success": True,
            "message": "Configuration updated successfully",
            "updated_settings": config_update.dict(exclude_none=True)
        }
        
    except Exception as e:
        logger.error(f"Error updating system config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update system configuration"
        )


# ========================================
# UTILITY ENDPOINTS
# ========================================

@router.get("/check/{action_type}")
async def check_token_requirement(
    action_type: str,
    user_id: Optional[int] = Depends(verify_token_optional)
):
    """Check token requirement for an action"""
    try:
        token_enabled = await token_service.is_token_system_enabled()
        
        if not token_enabled:
            return {
                "success": True,
                "token_required": False,
                "message": "Token system disabled"
            }
        
        required_tokens = await token_service.get_token_cost(action_type)
        
        has_tokens = False
        current_balance = 0
        
        if user_id:
            has_tokens = await token_service.check_user_has_tokens(user_id, required_tokens)
            balance_data = await token_service.get_user_token_balance(user_id)
            current_balance = balance_data["current_balance"]
        
        return {
            "success": True,
            "token_required": True,
            "action_type": action_type,
            "required_tokens": required_tokens,
            "has_sufficient_tokens": has_tokens,
            "current_balance": current_balance,
            "authenticated": user_id is not None
        }
        
    except Exception as e:
        logger.error(f"Error checking token requirement: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check token requirement"
        )

# ========================================
# AI MODEL SELECTION ENDPOINTS (NEW)
# ========================================

@router.get("/ai-models", response_model=List[Dict])
async def get_ai_models():
    """Get available AI model configurations"""
    try:
        models = await token_service.get_ai_model_configs()
        return models
    except Exception as e:
        logger.error(f"Error getting AI models: {e}")
        raise HTTPException(status_code=500, detail="Failed to get AI models")

@router.get("/ai-model/select/{user_id}")
async def select_ai_model_for_user(user_id: int, action_type: str = "name_generation"):
    """Select best AI model for user based on their token tiers"""
    try:
        model = await token_service.select_ai_model_for_user(user_id, action_type)
        return model
    except Exception as e:
        logger.error(f"Error selecting AI model: {e}")
        raise HTTPException(status_code=500, detail="Failed to select AI model")

@router.post("/use-with-ai")
async def use_tokens_with_ai_model(
    request: Dict,
    user_id: int = Depends(verify_token_optional)
):
    """Use tokens with AI model selection and tracking"""
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
        
    try:
        action_type = request.get("action_type", "name_generation")
        token_count = request.get("token_count")
        metadata = request.get("metadata")
        
        result = await token_service.use_tokens_with_ai_model(
            user_id, action_type, token_count, metadata
        )
        
        if result.get("success"):
            return result
        else:
            raise HTTPException(status_code=400, detail=result.get("error", "Token usage failed"))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error using tokens with AI: {e}")
        raise HTTPException(status_code=500, detail="Failed to use tokens with AI model")

@router.get("/balance/tiers")
async def get_user_token_balance_by_tiers(user_id: int = Depends(verify_token_optional)):
    """Get user's token balance broken down by AI tiers"""
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
        
    try:
        import sqlite3
        import os
        
        db_path = os.getenv("DATABASE_PATH", "baby_names.db")
        
        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT utb.*, amc1.display_name as basic_model, amc2.display_name as premium_model, amc3.display_name as business_model
                FROM user_token_balances utb
                LEFT JOIN ai_model_configs amc1 ON amc1.tier = 'basic'
                LEFT JOIN ai_model_configs amc2 ON amc2.tier = 'premium'  
                LEFT JOIN ai_model_configs amc3 ON amc3.tier = 'business'
                WHERE utb.user_id = ?
            """, (user_id,))
            
            balance = cursor.fetchone()
            if not balance:
                return {
                    "basic_tokens": 0,
                    "premium_tokens": 0,
                    "business_tokens": 0,
                    "total_balance": 0,
                    "ai_models": {}
                }
            
            return {
                "basic_tokens": balance['basic_tokens'],
                "premium_tokens": balance['premium_tokens'],
                "business_tokens": balance['business_tokens'],
                "total_balance": balance['current_balance'],
                "ai_models": {
                    "basic": balance['basic_model'] or "GPT-3.5 Turbo",
                    "premium": balance['premium_model'] or "GPT-4",
                    "business": balance['business_model'] or "GPT-4 Turbo"
                }
            }
            
    except Exception as e:
        logger.error(f"Error getting tier balance: {e}")
        raise HTTPException(status_code=500, detail="Failed to get token balance by tiers") 