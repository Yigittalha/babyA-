"""
Token Service - Manages token packages, balances, purchases, and usage
Modular design that integrates with existing subscription system
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func

from ..database_models import (
    TokenPackage, UserTokenBalance, TokenPurchase, TokenUsageLog, 
    SystemConfig, User
)
from ..database import SessionLocal
from contextlib import contextmanager
import logging

logger = logging.getLogger(__name__)


@contextmanager
def get_db_connection():
    """Database connection context manager"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class TokenService:
    """Service class for token system operations"""
    
    def __init__(self):
        self.token_costs = {
            "name_generation": 1,
            "name_analysis": 2,
            "premium_feature": 3,
            "bulk_generation": 5
        }
    
    # ========================================
    # SYSTEM CONFIGURATION METHODS
    # ========================================
    
    async def get_system_config(self, key: str) -> Optional[str]:
        """Get system configuration value"""
        try:
            with get_db_connection() as db:
                config = db.query(SystemConfig).filter(SystemConfig.key == key).first()
                return config.value if config else None
        except Exception as e:
            logger.error(f"Error getting system config {key}: {e}")
            return None
    
    async def is_token_system_enabled(self) -> bool:
        """Check if token system is enabled"""
        try:
            enabled = await self.get_system_config("ENABLE_TOKEN_SYSTEM")
            return enabled and enabled.lower() == "true"
        except Exception:
            return False
    
    async def is_subscription_system_enabled(self) -> bool:
        """Check if subscription system is enabled"""
        try:
            enabled = await self.get_system_config("ENABLE_SUBSCRIPTION_SYSTEM")
            return enabled and enabled.lower() == "true"
        except Exception:
            return True  # Default to subscription system
    
    async def get_system_mode(self) -> str:
        """Get current system mode: token, subscription, or hybrid"""
        try:
            mode = await self.get_system_config("TOKEN_SYSTEM_MODE")
            return mode or "subscription"
        except Exception:
            return "subscription"
    
    async def get_token_cost(self, action_type: str, **kwargs) -> int:
        """Get token cost for an action with dynamic parameters"""
        try:
            # Base costs per action type
            base_costs = {
                "name_generation": 1,  # 1 token per name
                "name_analysis": 2,    # 2 tokens per analysis
                "favorites": 0,        # Free
                "search": 0           # Free
            }
            
            base_cost = base_costs.get(action_type, 1)
            
            # Dynamic calculation based on action parameters
            if action_type == "name_generation":
                # Cost = number of names requested × 1 token per name
                name_count = kwargs.get("name_count", 20)  # Default 20 names
                return max(1, name_count)  # Minimum 1 token
                
            elif action_type == "name_analysis":
                # Cost = number of analyses × 2 tokens each
                analysis_count = kwargs.get("analysis_count", 1)
                return max(1, analysis_count * base_cost)
                
            else:
                return base_cost
                
        except Exception as e:
            logger.error(f"Error getting token cost: {e}")
            return 1  # Default fallback
    
    # ========================================
    # TOKEN PACKAGE MANAGEMENT (ADMIN)
    # ========================================
    
    async def create_token_package(self, package_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new token package"""
        try:
            with get_db_connection() as db:
                package = TokenPackage(
                    name=package_data["name"],
                    description=package_data.get("description", ""),
                    token_amount=package_data["token_amount"],
                    price=package_data["price"],
                    currency=package_data.get("currency", "USD"),
                    is_active=package_data.get("is_active", True),
                    sort_order=package_data.get("sort_order", 0)
                )
                
                db.add(package)
                db.commit()
                db.refresh(package)
                
                return {
                    "success": True,
                    "package": {
                        "id": package.id,
                        "name": package.name,
                        "description": package.description,
                        "token_amount": package.token_amount,
                        "price": package.price,
                        "currency": package.currency,
                        "is_active": package.is_active,
                        "sort_order": package.sort_order,
                        "created_at": package.created_at.isoformat()
                    }
                }
        except Exception as e:
            logger.error(f"Error creating token package: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_token_packages(self, active_only: bool = True) -> List[Dict[str, Any]]:
        """Get all token packages"""
        try:
            # Use direct SQLite connection to avoid relationship issues
            import sqlite3
            import os
            
            db_path = os.getenv("DATABASE_PATH", "baby_names.db")
            
            query = "SELECT * FROM token_packages"
            if active_only:
                query += " WHERE is_active = 1"
            query += " ORDER BY sort_order, price"
            
            with sqlite3.connect(db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute(query)
                
                rows = cursor.fetchall()
                
                packages = []
                for row in rows:
                    packages.append({
                        "id": row["id"],
                        "name": row["name"],
                        "description": row["description"] or "",
                        "token_amount": row["token_amount"],
                        "price": row["price"],
                        "currency": row["currency"],
                        "is_active": bool(row["is_active"]),
                        "sort_order": row["sort_order"],
                        "created_at": row["created_at"],
                        "price_per_token": round(row["price"] / row["token_amount"], 4)
                    })
                
                return packages
                
        except Exception as e:
            logger.error(f"Error getting token packages: {e}")
            return []
    
    async def update_token_package(self, package_id: int, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update token package"""
        try:
            with get_db_connection() as db:
                package = db.query(TokenPackage).filter(TokenPackage.id == package_id).first()
                
                if not package:
                    return {"success": False, "error": "Package not found"}
                
                for key, value in update_data.items():
                    if hasattr(package, key) and key not in ["id", "created_at"]:
                        setattr(package, key, value)
                
                package.updated_at = datetime.utcnow()
                db.commit()
                db.refresh(package)
                
                return {
                    "success": True,
                    "package": {
                        "id": package.id,
                        "name": package.name,
                        "description": package.description,
                        "token_amount": package.token_amount,
                        "price": package.price,
                        "currency": package.currency,
                        "is_active": package.is_active,
                        "sort_order": package.sort_order,
                        "updated_at": package.updated_at.isoformat()
                    }
                }
        except Exception as e:
            logger.error(f"Error updating token package: {e}")
            return {"success": False, "error": str(e)}
    
    async def delete_token_package(self, package_id: int) -> Dict[str, Any]:
        """Delete token package (soft delete by setting inactive)"""
        try:
            with get_db_connection() as db:
                package = db.query(TokenPackage).filter(TokenPackage.id == package_id).first()
                
                if not package:
                    return {"success": False, "error": "Package not found"}
                
                # Check if package has purchases
                has_purchases = db.query(TokenPurchase).filter(
                    TokenPurchase.package_id == package_id
                ).first()
                
                if has_purchases:
                    # Soft delete - set inactive
                    package.is_active = False
                    package.updated_at = datetime.utcnow()
                    db.commit()
                    return {"success": True, "message": "Package deactivated"}
                else:
                    # Hard delete if no purchases
                    db.delete(package)
                    db.commit()
                    return {"success": True, "message": "Package deleted"}
                    
        except Exception as e:
            logger.error(f"Error deleting token package: {e}")
            return {"success": False, "error": str(e)}
    
    # ========================================
    # USER TOKEN BALANCE MANAGEMENT
    # ========================================
    
    async def get_user_token_balance(self, user_id: int) -> Dict[str, Any]:
        """Get user's token balance"""
        try:
            with get_db_connection() as db:
                balance = db.query(UserTokenBalance).filter(
                    UserTokenBalance.user_id == user_id
                ).first()
                
                if not balance:
                    # Create initial balance for user
                    balance = UserTokenBalance(
                        user_id=user_id,
                        current_balance=0,
                        total_purchased=0,
                        total_used=0
                    )
                    db.add(balance)
                    db.commit()
                    db.refresh(balance)
                
                return {
                    "user_id": balance.user_id,
                    "current_balance": balance.current_balance,
                    "total_purchased": balance.total_purchased,
                    "total_used": balance.total_used,
                    "last_updated": balance.last_updated.isoformat()
                }
        except Exception as e:
            logger.error(f"Error getting user token balance: {e}")
            return {
                "user_id": user_id,
                "current_balance": 0,
                "total_purchased": 0,
                "total_used": 0,
                "error": str(e)
            }
    
    async def check_user_has_tokens(self, user_id: int, required_tokens: int) -> bool:
        """Check if user has sufficient tokens"""
        try:
            balance_data = await self.get_user_token_balance(user_id)
            return balance_data["current_balance"] >= required_tokens
        except Exception:
            return False
    
    async def use_tokens(self, user_id: int, action_type: str, token_count: Optional[int] = None, metadata: Optional[Dict] = None) -> Dict[str, Any]:
        """Use tokens for an action with dynamic cost calculation"""
        try:
            if token_count is None:
                # Extract parameters from metadata for dynamic cost calculation
                kwargs = {}
                if metadata:
                    if action_type == "name_generation" and "name_count" in metadata:
                        kwargs["name_count"] = metadata["name_count"]
                    elif action_type == "name_analysis" and "analysis_count" in metadata:
                        kwargs["analysis_count"] = metadata["analysis_count"]
                
                # Calculate dynamic token cost based on parameters
                token_count = await self.get_token_cost(action_type, **kwargs)
            
            with get_db_connection() as db:
                balance = db.query(UserTokenBalance).filter(
                    UserTokenBalance.user_id == user_id
                ).first()
                
                if not balance or balance.current_balance < token_count:
                    return {
                        "success": False,
                        "error": "Insufficient tokens",
                        "required": token_count,
                        "available": balance.current_balance if balance else 0
                    }
                
                # Update balance
                balance.current_balance -= token_count
                balance.total_used += token_count
                balance.last_updated = datetime.utcnow()
                
                # Log usage with enhanced metadata
                enhanced_metadata = metadata.copy() if metadata else {}
                enhanced_metadata.update({
                    "calculated_token_cost": token_count,
                    "cost_calculation_basis": f"{action_type}_dynamic"
                })
                
                usage_log = TokenUsageLog(
                    user_id=user_id,
                    action_type=action_type,
                    tokens_used=token_count,
                    remaining_balance=balance.current_balance,
                    extra_data=json.dumps(enhanced_metadata)
                )
                
                db.add(usage_log)
                db.commit()
                
                return {
                    "success": True,
                    "tokens_used": token_count,
                    "remaining_balance": balance.current_balance,
                    "calculation_details": {
                        "action_type": action_type,
                        "dynamic_cost": True,
                        "cost_basis": enhanced_metadata.get("name_count", "default")
                    }
                }
                
        except Exception as e:
            logger.error(f"Error using tokens: {e}")
            return {"success": False, "error": str(e)}
    
    async def add_tokens(self, user_id: int, token_count: int, source: str = "purchase") -> Dict[str, Any]:
        """Add tokens to user balance"""
        try:
            with get_db_connection() as db:
                balance = db.query(UserTokenBalance).filter(
                    UserTokenBalance.user_id == user_id
                ).first()
                
                if not balance:
                    balance = UserTokenBalance(
                        user_id=user_id,
                        current_balance=token_count,
                        total_purchased=token_count if source == "purchase" else 0,
                        total_used=0
                    )
                    db.add(balance)
                else:
                    balance.current_balance += token_count
                    if source == "purchase":
                        balance.total_purchased += token_count
                    balance.last_updated = datetime.utcnow()
                
                db.commit()
                
                return {
                    "success": True,
                    "tokens_added": token_count,
                    "new_balance": balance.current_balance
                }
                
        except Exception as e:
            logger.error(f"Error adding tokens: {e}")
            return {"success": False, "error": str(e)}
    
    # ========================================
    # TOKEN PURCHASE MANAGEMENT
    # ========================================
    
    async def create_purchase_record(self, user_id: int, package_id: int, payment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create token purchase record"""
        try:
            with get_db_connection() as db:
                package = db.query(TokenPackage).filter(
                    TokenPackage.id == package_id,
                    TokenPackage.is_active == True
                ).first()
                
                if not package:
                    return {"success": False, "error": "Package not found or inactive"}
                
                purchase = TokenPurchase(
                    user_id=user_id,
                    package_id=package_id,
                    token_amount=package.token_amount,
                    price_paid=payment_data.get("amount", package.price),
                    currency=payment_data.get("currency", package.currency),
                    payment_status="pending",
                    payment_provider=payment_data.get("provider"),
                    payment_transaction_id=payment_data.get("transaction_id")
                )
                
                db.add(purchase)
                db.commit()
                db.refresh(purchase)
                
                return {
                    "success": True,
                    "purchase": {
                        "id": purchase.id,
                        "package_name": package.name,
                        "token_amount": purchase.token_amount,
                        "price_paid": purchase.price_paid,
                        "currency": purchase.currency,
                        "payment_status": purchase.payment_status,
                        "purchase_date": purchase.purchase_date.isoformat()
                    }
                }
                
        except Exception as e:
            logger.error(f"Error creating purchase record: {e}")
            return {"success": False, "error": str(e)}
    
    async def complete_purchase(self, purchase_id: int, transaction_id: str) -> Dict[str, Any]:
        """Complete token purchase and add tokens to user balance"""
        try:
            with get_db_connection() as db:
                purchase = db.query(TokenPurchase).filter(
                    TokenPurchase.id == purchase_id
                ).first()
                
                if not purchase:
                    return {"success": False, "error": "Purchase not found"}
                
                if purchase.payment_status == "completed":
                    return {"success": False, "error": "Purchase already completed"}
                
                # Update purchase status
                purchase.payment_status = "completed"
                purchase.payment_transaction_id = transaction_id
                
                # Add tokens to user balance
                result = await self.add_tokens(
                    purchase.user_id, 
                    purchase.token_amount, 
                    source="purchase"
                )
                
                if not result["success"]:
                    return result
                
                db.commit()
                
                return {
                    "success": True,
                    "message": "Purchase completed successfully",
                    "tokens_added": purchase.token_amount,
                    "new_balance": result["new_balance"]
                }
                
        except Exception as e:
            logger.error(f"Error completing purchase: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_user_purchases(self, user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        """Get user's purchase history"""
        try:
            with get_db_connection() as db:
                purchases = db.query(TokenPurchase, TokenPackage).join(
                    TokenPackage, TokenPurchase.package_id == TokenPackage.id
                ).filter(
                    TokenPurchase.user_id == user_id
                ).order_by(
                    desc(TokenPurchase.purchase_date)
                ).limit(limit).all()
                
                return [
                    {
                        "id": purchase.id,
                        "package_name": package.name,
                        "token_amount": purchase.token_amount,
                        "price_paid": purchase.price_paid,
                        "currency": purchase.currency,
                        "payment_status": purchase.payment_status,
                        "payment_provider": purchase.payment_provider,
                        "purchase_date": purchase.purchase_date.isoformat()
                    }
                    for purchase, package in purchases
                ]
                
        except Exception as e:
            logger.error(f"Error getting user purchases: {e}")
            return []
    
    # ========================================
    # ANALYTICS AND REPORTING
    # ========================================
    
    async def get_token_usage_analytics(self, user_id: Optional[int] = None, days: int = 30) -> Dict[str, Any]:
        """Get token usage analytics"""
        try:
            with get_db_connection() as db:
                start_date = datetime.utcnow() - timedelta(days=days)
                
                query = db.query(TokenUsageLog).filter(
                    TokenUsageLog.created_at >= start_date
                )
                
                if user_id:
                    query = query.filter(TokenUsageLog.user_id == user_id)
                
                usage_logs = query.all()
                
                # Aggregate by action type
                usage_by_action = {}
                total_tokens_used = 0
                
                for log in usage_logs:
                    action = log.action_type
                    if action not in usage_by_action:
                        usage_by_action[action] = {"count": 0, "tokens": 0}
                    
                    usage_by_action[action]["count"] += 1
                    usage_by_action[action]["tokens"] += log.tokens_used
                    total_tokens_used += log.tokens_used
                
                return {
                    "period_days": days,
                    "total_tokens_used": total_tokens_used,
                    "total_actions": len(usage_logs),
                    "usage_by_action": usage_by_action,
                    "average_tokens_per_day": round(total_tokens_used / days, 2)
                }
                
        except Exception as e:
            logger.error(f"Error getting token analytics: {e}")
            return {"error": str(e)}
    
    async def get_admin_token_stats(self) -> Dict[str, Any]:
        """Get comprehensive token statistics for admin"""
        try:
            with get_db_connection() as db:
                # Total tokens in circulation
                total_balances = db.query(func.sum(UserTokenBalance.current_balance)).scalar() or 0
                total_purchased = db.query(func.sum(UserTokenBalance.total_purchased)).scalar() or 0
                total_used = db.query(func.sum(UserTokenBalance.total_used)).scalar() or 0
                
                # Active users with tokens
                users_with_tokens = db.query(func.count(UserTokenBalance.user_id)).filter(
                    UserTokenBalance.current_balance > 0
                ).scalar() or 0
                
                # Recent purchases (last 30 days)
                thirty_days_ago = datetime.utcnow() - timedelta(days=30)
                recent_purchases = db.query(func.count(TokenPurchase.id)).filter(
                    TokenPurchase.purchase_date >= thirty_days_ago,
                    TokenPurchase.payment_status == "completed"
                ).scalar() or 0
                
                # Revenue (last 30 days)
                recent_revenue = db.query(func.sum(TokenPurchase.price_paid)).filter(
                    TokenPurchase.purchase_date >= thirty_days_ago,
                    TokenPurchase.payment_status == "completed"
                ).scalar() or 0
                
                return {
                    "total_tokens_in_circulation": total_balances,
                    "total_tokens_purchased": total_purchased,
                    "total_tokens_used": total_used,
                    "users_with_tokens": users_with_tokens,
                    "recent_purchases_30d": recent_purchases,
                    "recent_revenue_30d": float(recent_revenue),
                    "token_utilization_rate": round((total_used / total_purchased * 100), 2) if total_purchased > 0 else 0
                }
                
        except Exception as e:
            logger.error(f"Error getting admin token stats: {e}")
            return {"error": str(e)}

    # ========================================
    # AI MODEL SELECTION & TIER MANAGEMENT (NEW)
    # ========================================
    
    async def get_ai_model_configs(self) -> List[Dict[str, Any]]:
        """Get available AI model configurations"""
        try:
            import sqlite3
            import os
            
            db_path = os.getenv("DATABASE_PATH", "baby_names.db")
            
            with sqlite3.connect(db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT * FROM ai_model_configs 
                    WHERE is_active = 1 
                    ORDER BY quality_score DESC
                """)
                
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
                
        except Exception as e:
            logger.error(f"Error getting AI model configs: {e}")
            return []
    
    async def select_ai_model_for_user(self, user_id: int, action_type: str = "name_generation") -> Dict[str, Any]:
        """Select best AI model based on user's token tiers"""
        try:
            import sqlite3
            import os
            
            db_path = os.getenv("DATABASE_PATH", "baby_names.db")
            
            with sqlite3.connect(db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                # Get user's token balance by tier
                cursor.execute("""
                    SELECT basic_tokens, premium_tokens, business_tokens
                    FROM user_token_balances 
                    WHERE user_id = ?
                """, (user_id,))
                
                balance = cursor.fetchone()
                if not balance:
                    # Default to basic if no balance found
                    return await self._get_model_config('basic')
                
                # Select highest tier with available tokens
                if balance['business_tokens'] > 0:
                    return await self._get_model_config('business')
                elif balance['premium_tokens'] > 0:
                    return await self._get_model_config('premium')
                elif balance['basic_tokens'] > 0:
                    return await self._get_model_config('basic')
                else:
                    # No tokens available
                    return {
                        "error": "No tokens available",
                        "tier": None,
                        "model_name": None
                    }
                    
        except Exception as e:
            logger.error(f"Error selecting AI model: {e}")
            return await self._get_model_config('basic')  # Fallback to basic
    
    async def _get_model_config(self, tier: str) -> Dict[str, Any]:
        """Get AI model configuration for specific tier"""
        try:
            import sqlite3
            import os
            
            db_path = os.getenv("DATABASE_PATH", "baby_names.db")
            
            with sqlite3.connect(db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT * FROM ai_model_configs 
                    WHERE tier = ? AND is_active = 1
                """, (tier,))
                
                row = cursor.fetchone()
                if row:
                    return dict(row)
                else:
                    # Fallback to basic if tier not found
                    return {
                        "tier": "basic",
                        "model_name": "gpt-3.5-turbo",
                        "display_name": "GPT-3.5 Turbo",
                        "cost_per_token": 0.0005,
                        "quality_score": 6,
                        "speed_score": 9,
                        "description": "Basic AI model"
                    }
                    
        except Exception as e:
            logger.error(f"Error getting model config: {e}")
            return {"tier": "basic", "model_name": "gpt-3.5-turbo"}
    
    async def use_tokens_with_ai_model(self, user_id: int, action_type: str, token_count: Optional[int] = None, metadata: Optional[Dict] = None) -> Dict[str, Any]:
        """Use tokens with AI model selection and tracking"""
        try:
            # Select AI model based on user's token tiers
            ai_model = await self.select_ai_model_for_user(user_id, action_type)
            
            if "error" in ai_model:
                return ai_model
            
            if token_count is None:
                token_count = await self.get_token_cost(action_type)
            
            import sqlite3
            import os
            import json
            from datetime import datetime
            
            db_path = os.getenv("DATABASE_PATH", "baby_names.db")
            
            with sqlite3.connect(db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                # Get user's current balance
                cursor.execute("""
                    SELECT * FROM user_token_balances 
                    WHERE user_id = ?
                """, (user_id,))
                
                balance = cursor.fetchone()
                if not balance:
                    return {"success": False, "error": "No token balance found"}
                
                # Determine which tier to use and deduct from
                tier_to_use = ai_model['tier']
                tier_column = f"{tier_to_use}_tokens"
                
                if balance[tier_column] < token_count:
                    return {
                        "success": False,
                        "error": f"Insufficient {tier_to_use} tokens",
                        "required": token_count,
                        "available": balance[tier_column],
                        "tier": tier_to_use
                    }
                
                # Calculate AI cost
                ai_cost = ai_model.get('cost_per_token', 0.001) * token_count
                
                # Update balances
                new_tier_balance = balance[tier_column] - token_count
                new_total_balance = balance['current_balance'] - token_count
                new_total_used = balance['total_used'] + token_count
                
                cursor.execute(f"""
                    UPDATE user_token_balances 
                    SET current_balance = ?, 
                        total_used = ?, 
                        {tier_column} = ?,
                        last_updated = ?
                    WHERE user_id = ?
                """, (new_total_balance, new_total_used, new_tier_balance, datetime.utcnow(), user_id))
                
                # Log usage with AI model info
                cursor.execute("""
                    INSERT INTO token_usage_logs 
                    (user_id, action_type, tokens_used, remaining_balance, 
                     ai_model_tier, ai_model_used, ai_cost_incurred, extra_data)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    user_id, action_type, token_count, new_total_balance,
                    ai_model['tier'], ai_model['model_name'], ai_cost,
                    json.dumps(metadata) if metadata else None
                ))
                
                conn.commit()
                
                return {
                    "success": True,
                    "tokens_used": token_count,
                    "remaining_balance": new_total_balance,
                    "ai_model": {
                        "tier": ai_model['tier'],
                        "model_name": ai_model['model_name'],
                        "display_name": ai_model.get('display_name', ai_model['model_name']),
                        "quality_score": ai_model.get('quality_score', 6),
                        "cost_incurred": ai_cost
                    },
                    "tier_balances": {
                        "basic": balance['basic_tokens'] if tier_to_use != 'basic' else new_tier_balance,
                        "premium": balance['premium_tokens'] if tier_to_use != 'premium' else new_tier_balance,
                        "business": balance['business_tokens'] if tier_to_use != 'business' else new_tier_balance
                    }
                }
                
        except Exception as e:
            logger.error(f"Error using tokens with AI model: {e}")
            return {"success": False, "error": str(e)}


# Global token service instance
token_service = TokenService() 