"""
Veritabanı yönetimi
"""

import os
import sqlite3
import asyncio
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import hashlib
import secrets
from .models import UserRegistration, FavoriteNameCreate
from .utils import logger
import json


class DatabaseManager:
    """SQLite veritabanı yöneticisi"""
    
    def __init__(self):
        self.db_path = os.getenv("DATABASE_PATH", "baby_names.db")
        self.connection = None
        self.start_time = None
    
    async def initialize(self):
        """Veritabanını başlat ve tabloları oluştur"""
        try:
            # SQLite bağlantısı
            self.connection = sqlite3.connect(self.db_path)
            self.connection.row_factory = sqlite3.Row
            
            # Tabloları oluştur
            await self._create_tables()
            logger.info("Database initialized successfully")
            
        except Exception as e:
            logger.error(f"Database initialization failed: {e}")
            raise
    
    async def _create_tables(self):
        """Veritabanı tablolarını oluştur"""
        cursor = self.connection.cursor()
        
        # Kullanıcılar tablosu
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                subscription_type TEXT DEFAULT 'free',
                subscription_expires TIMESTAMP,
                is_admin INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP,
                subscription_type TEXT DEFAULT 'free'
            )
        """)
        
        # Favori isimler tablosu
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS favorite_names (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                meaning TEXT NOT NULL,
                gender TEXT NOT NULL,
                language TEXT NOT NULL,
                theme TEXT NOT NULL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        """)
        
        # Abonelik geçmişi tablosu
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS subscription_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                subscription_type TEXT NOT NULL,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP,
                payment_amount REAL,
                payment_currency TEXT DEFAULT 'TRY',
                status TEXT DEFAULT 'active',
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        """)
        
        # İndeksler
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorite_names (user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_favorites_created_at ON favorite_names (created_at)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_subscription_user_id ON subscription_history (user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_subscription_expires ON subscription_history (expires_at)")
        
        # Create user usage tracking table for analytics
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_usage_tracking (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        """)
        
        # Create subscription plans table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS subscription_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                price REAL NOT NULL,
                currency TEXT DEFAULT 'USD',
                billing_period_days INTEGER NOT NULL,
                max_names_per_request INTEGER DEFAULT 10,
                max_requests_per_day INTEGER,
                max_favorites INTEGER,
                has_advanced_features BOOLEAN DEFAULT 0,
                has_analytics BOOLEAN DEFAULT 0,
                has_priority_support BOOLEAN DEFAULT 0,
                has_api_access BOOLEAN DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Insert default subscription plans if they don't exist
        cursor.execute("SELECT COUNT(*) FROM subscription_plans")
        plan_count = cursor.fetchone()[0]
        
        if plan_count == 0:
            default_plans = [
                ("Free Starter", "Basic name generation with limits", 0.00, "USD", 30, 5, 5, 3, 0, 0, 0, 0, 1),
                ("Premium", "Unlimited name generation with advanced features", 7.99, "USD", 30, 50, None, None, 1, 1, 1, 0, 1),
                ("Family Pro", "Premium features for families", 14.99, "USD", 30, 50, None, None, 1, 1, 1, 1, 1)
            ]
            
            cursor.executemany("""
                INSERT INTO subscription_plans 
                (name, description, price, currency, billing_period_days, max_names_per_request, 
                 max_requests_per_day, max_favorites, has_advanced_features, has_analytics, 
                 has_priority_support, has_api_access, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, default_plans)
        
        self.connection.commit()
    
    def _hash_password(self, password: str) -> str:
        """Şifreyi hash'le"""
        salt = secrets.token_hex(16)
        hash_obj = hashlib.sha256()
        hash_obj.update((password + salt).encode())
        return f"{salt}${hash_obj.hexdigest()}"
    
    def _verify_password(self, password: str, password_hash: str) -> bool:
        """Şifreyi doğrula"""
        try:
            salt, hash_value = password_hash.split('$')
            hash_obj = hashlib.sha256()
            hash_obj.update((password + salt).encode())
            return hash_obj.hexdigest() == hash_value
        except:
            return False
    
    async def create_user(self, user_data: UserRegistration) -> int:
        """Yeni kullanıcı oluştur"""
        cursor = self.connection.cursor()
        
        password_hash = self._hash_password(user_data.password)
        
        cursor.execute("""
            INSERT INTO users (email, password_hash, name)
            VALUES (?, ?, ?)
        """, (user_data.email, password_hash, user_data.name))
        
        self.connection.commit()
        return cursor.lastrowid
    
    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """E-posta ile kullanıcı getir"""
        cursor = self.connection.cursor()
        
        cursor.execute("""
            SELECT id, email, password_hash, name, created_at, subscription_type, subscription_expires, is_admin
            FROM users WHERE email = ?
        """, (email,))
        
        row = cursor.fetchone()
        if row:
            return dict(row)
        return None
    
    async def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        """ID ile kullanıcı getir"""
        cursor = self.connection.cursor()
        
        cursor.execute("""
            SELECT id, email, password_hash, name, created_at, subscription_type, subscription_expires, is_admin
            FROM users WHERE id = ?
        """, (user_id,))
        
        row = cursor.fetchone()
        if row:
            return dict(row)
        return None
    
    async def authenticate_user(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        """Kullanıcı kimlik doğrulama"""
        user = await self.get_user_by_email(email)
        if user and self._verify_password(password, user["password_hash"]):
            return user
        return None
    
    async def add_favorite(self, user_id: int, favorite_data: FavoriteNameCreate) -> int:
        """Favori isim ekle"""
        cursor = self.connection.cursor()
        
        cursor.execute("""
            INSERT INTO favorite_names (user_id, name, meaning, gender, language, theme, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            favorite_data.name,
            favorite_data.meaning,
            favorite_data.gender,
            favorite_data.language,
            favorite_data.theme,
            favorite_data.notes
        ))
        
        self.connection.commit()
        return cursor.lastrowid
    
    async def get_favorite_by_id(self, favorite_id: int) -> Optional[Dict[str, Any]]:
        """ID ile favori getir"""
        cursor = self.connection.cursor()
        
        cursor.execute("""
            SELECT id, user_id, name, meaning, gender, language, theme, notes, created_at
            FROM favorite_names WHERE id = ?
        """, (favorite_id,))
        
        row = cursor.fetchone()
        if row:
            return dict(row)
        return None
    
    async def get_favorites(self, user_id: int, page: int = 1, limit: int = 20) -> List[Dict[str, Any]]:
        """Kullanıcının favori isimlerini getir"""
        cursor = self.connection.cursor()
        
        offset = (page - 1) * limit
        
        cursor.execute("""
            SELECT id, user_id, name, meaning, gender, language, theme, notes, created_at
            FROM favorite_names 
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        """, (user_id, limit, offset))
        
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    
    async def get_favorite_count(self, user_id: int) -> int:
        """Kullanıcının favori sayısını getir"""
        cursor = self.connection.cursor()
        
        cursor.execute("""
            SELECT COUNT(*) as count
            FROM favorite_names WHERE user_id = ?
        """, (user_id,))
        
        row = cursor.fetchone()
        return row["count"] if row else 0
    
    async def delete_favorite(self, favorite_id: int):
        """Favori ismi sil"""
        cursor = self.connection.cursor()
        
        cursor.execute("""
            DELETE FROM favorite_names WHERE id = ?
        """, (favorite_id,))
        
        self.connection.commit()
    
    async def update_favorite(self, favorite_id: int, favorite_data: FavoriteNameCreate):
        """Favori ismi güncelle"""
        cursor = self.connection.cursor()
        
        cursor.execute("""
            UPDATE favorite_names 
            SET name = ?, meaning = ?, gender = ?, language = ?, theme = ?, notes = ?
            WHERE id = ?
        """, (
            favorite_data.name,
            favorite_data.meaning,
            favorite_data.gender,
            favorite_data.language,
            favorite_data.theme,
            favorite_data.notes,
            favorite_id
        ))
        
        self.connection.commit()
    
    async def close(self):
        """Veritabanı bağlantısını kapat"""
        if self.connection:
            self.connection.close()
            logger.info("Database connection closed")
    
    def is_connected(self) -> bool:
        """Veritabanı bağlantısının durumunu kontrol et"""
        try:
            if self.connection:
                # Bağlantıyı test et
                cursor = self.connection.cursor()
                cursor.execute("SELECT 1")
                cursor.fetchone()
                return True
            return False
        except Exception:
            return False

    async def test_connection(self) -> bool:
        """Async version of connection test"""
        try:
            if self.connection:
                cursor = self.connection.cursor()
                cursor.execute("SELECT 1")
                cursor.fetchone()
                return True
            return False
        except Exception as e:
            logger.error(f"Database connection test failed: {e}")
            return False

    # Premium özellikler için fonksiyonlar
    async def get_user_subscription(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Kullanıcının abonelik bilgilerini getir"""
        cursor = self.connection.cursor()
        
        cursor.execute("""
            SELECT subscription_type, subscription_expires
            FROM users WHERE id = ?
        """, (user_id,))
        
        row = cursor.fetchone()
        if row:
            return dict(row)
        return None

    async def update_user_subscription(self, user_id: int, subscription_type: str, expires_at: Optional[datetime] = None) -> bool:
        """Kullanıcının abonelik bilgilerini güncelle - ENHANCED: Plan validation added"""
        try:
            from .models import PlanType
            
            # Validate subscription type
            valid_plans = [plan.value for plan in PlanType]
            if subscription_type not in valid_plans:
                logger.error(f"Invalid subscription type: {subscription_type}. Valid plans: {valid_plans}")
                return False
            
            cursor = self.connection.cursor()
            
            # First check if user exists
            cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
            if not cursor.fetchone():
                logger.error(f"User {user_id} not found")
                return False
            
            # Update subscription
            cursor.execute("""
                UPDATE users 
                SET subscription_type = ?, subscription_expires = ?
                WHERE id = ?
            """, (subscription_type, expires_at, user_id))
            
            self.connection.commit()
            
            # Log the change for audit
            logger.info(f"User {user_id} subscription updated to {subscription_type}")
            
            return cursor.rowcount > 0
        except Exception as e:
            logger.error(f"Error updating user subscription: {e}")
            return False

    async def add_subscription_history(self, user_id: int, subscription_type: str, expires_at: Optional[datetime] = None, 
                                     payment_amount: Optional[float] = None, payment_currency: str = "TRY"):
        """Abonelik geçmişine kayıt ekle"""
        cursor = self.connection.cursor()
        
        cursor.execute("""
            INSERT INTO subscription_history (user_id, subscription_type, expires_at, payment_amount, payment_currency)
            VALUES (?, ?, ?, ?, ?)
        """, (user_id, subscription_type, expires_at, payment_amount, payment_currency))
        
        self.connection.commit()

    async def get_subscription_history(self, user_id: int) -> List[Dict[str, Any]]:
        """Kullanıcının abonelik geçmişini getir"""
        cursor = self.connection.cursor()
        
        cursor.execute("""
            SELECT id, subscription_type, started_at, expires_at, payment_amount, payment_currency, status
            FROM subscription_history 
            WHERE user_id = ?
            ORDER BY started_at DESC
        """, (user_id,))
        
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

    async def is_user_premium(self, user_id: int) -> bool:
        """Kullanıcının premium üye olup olmadığını kontrol et"""
        subscription = await self.get_user_subscription(user_id)
        if not subscription:
            return False
        
        # Ücretsiz kullanıcı
        if subscription["subscription_type"] == "free":
            return False
        
        # Süresi dolmuş premium üye
        if subscription["subscription_expires"]:
            expires_at = datetime.fromisoformat(subscription["subscription_expires"])
            if expires_at < datetime.now():
                return False
        
        return True

    async def is_user_admin(self, user_id: int) -> bool:
        """Kullanıcının admin olup olmadığını kontrol et"""
        try:
            cursor = self.connection.cursor()
            cursor.execute("SELECT is_admin FROM users WHERE id = ?", (user_id,))
            result = cursor.fetchone()
            return bool(result[0]) if result else False
        except Exception as e:
            logger.error(f"Error checking admin status: {e}")
            return False

    async def get_user_by_id_with_subscription(self, user_id: int) -> Optional[Dict[str, Any]]:
        """ID ile kullanıcı getir (abonelik bilgileri dahil)"""
        cursor = self.connection.cursor()
        
        cursor.execute("""
            SELECT id, email, password_hash, name, subscription_type, subscription_expires, created_at, is_admin
            FROM users WHERE id = ?
        """, (user_id,))
        
        row = cursor.fetchone()
        if row:
            user_data = dict(row)
            # Premium durumunu hesapla
            user_data["is_premium"] = await self.is_user_premium(user_id)
            return user_data
        return None

    async def get_user_count(self) -> int:
        """Toplam kullanıcı sayısını getir"""
        try:
            cursor = self.connection.cursor()
            cursor.execute("SELECT COUNT(*) FROM users")
            result = cursor.fetchone()
            return result[0] if result else 0
        except Exception as e:
            logger.error(f"Error getting user count: {e}")
            return 0

    async def get_favorite_count(self, user_id: int = None) -> int:
        """Toplam favori sayısını getir"""
        try:
            cursor = self.connection.cursor()
            if user_id:
                cursor.execute("SELECT COUNT(*) FROM favorite_names WHERE user_id = ?", (user_id,))
            else:
                cursor.execute("SELECT COUNT(*) FROM favorite_names")
            result = cursor.fetchone()
            return result[0] if result else 0
        except Exception as e:
            logger.error(f"Error getting favorite count: {e}")
            return 0

    async def get_recent_registrations(self, hours: int = 24) -> int:
        """Son X saatteki kayıt sayısını getir"""
        try:
            cursor = self.connection.cursor()
            cursor.execute(
                "SELECT COUNT(*) FROM users WHERE created_at >= datetime('now', '-{} hours')".format(hours)
            )
            result = cursor.fetchone()
            return result[0] if result else 0
        except Exception as e:
            logger.error(f"Error getting recent registrations: {e}")
            return 0

    async def get_all_users(self, page: int = 1, limit: int = 20) -> list:
        """Tüm kullanıcıları getir (sayfalama ile)"""
        try:
            offset = (page - 1) * limit
            cursor = self.connection.cursor()
            cursor.execute("""
                SELECT id, email, name, created_at, subscription_type, subscription_expires, is_admin
                FROM users 
                ORDER BY created_at DESC 
                LIMIT ? OFFSET ?
            """, (limit, offset))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Error getting all users: {e}")
            return []

    async def delete_user(self, user_id: int) -> bool:
        """Kullanıcıyı sil"""
        try:
            cursor = self.connection.cursor()
            # Önce kullanıcının favorilerini sil
            cursor.execute("DELETE FROM favorite_names WHERE user_id = ?", (user_id,))
            # Sonra kullanıcıyı sil
            cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
            self.connection.commit()
            return cursor.rowcount > 0
        except Exception as e:
            logger.error(f"Error deleting user: {e}")
            return False

    async def get_all_favorites(self, page: int = 1, limit: int = 20) -> list:
        """Tüm favorileri getir (sayfalama ile)"""
        try:
            offset = (page - 1) * limit
            cursor = self.connection.cursor()
            cursor.execute("""
                SELECT f.id, f.name, f.gender, f.language, f.theme, f.created_at,
                       u.email as user_email, u.name as user_name
                FROM favorite_names f
                JOIN users u ON f.user_id = u.id
                ORDER BY f.created_at DESC 
                LIMIT ? OFFSET ?
            """, (limit, offset))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Error getting all favorites: {e}")
            return []

    # Trend analizi için yeni metodlar
    async def get_recent_favorites_stats(self, days: int = 30) -> List[Dict[str, Any]]:
        """Son X günde en çok favorilenen isimleri getir"""
        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                SELECT 
                    name,
                    language,
                    gender,
                    theme,
                    COUNT(*) as favorite_count,
                    MAX(meaning) as meaning
                FROM favorite_names 
                WHERE created_at >= datetime('now', '-{} days')
                GROUP BY name, language, gender
                ORDER BY favorite_count DESC, name
                LIMIT 20
            """.format(days))
            
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Error getting recent favorites stats: {e}")
            return []

    async def get_trending_names_by_language(self, days: int = 30) -> Dict[str, List[Dict[str, Any]]]:
        """Dil bazlı trend analizi"""
        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                SELECT 
                    language,
                    name,
                    gender,
                    theme,
                    COUNT(*) as popularity,
                    MAX(meaning) as meaning,
                    MIN(created_at) as first_used,
                    MAX(created_at) as last_used
                FROM favorite_names 
                WHERE created_at >= datetime('now', '-{} days')
                GROUP BY language, name
                HAVING COUNT(*) >= 1
                ORDER BY language, COUNT(*) DESC
            """.format(days))
            
            rows = cursor.fetchall()
            
            # Dillere göre grupla
            trends_by_language = {}
            for row in rows:
                language = row["language"]
                if language not in trends_by_language:
                    trends_by_language[language] = []
                trends_by_language[language].append(dict(row))
            
            return trends_by_language
        except Exception as e:
            logger.error(f"Error getting trending names by language: {e}")
            return {}

    async def get_weekly_growth_stats(self) -> List[Dict[str, Any]]:
        """Haftalık büyüme istatistikleri"""
        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                SELECT 
                    name,
                    language,
                    COUNT(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 END) as this_week,
                    COUNT(CASE WHEN created_at >= datetime('now', '-14 days') 
                              AND created_at < datetime('now', '-7 days') THEN 1 END) as last_week
                FROM favorite_names 
                WHERE created_at >= datetime('now', '-14 days')
                GROUP BY name, language
                HAVING this_week > 0 OR last_week > 0
                ORDER BY this_week DESC
            """)
            
            rows = cursor.fetchall()
            results = []
            
            for row in rows:
                this_week = row["this_week"]
                last_week = row["last_week"]
                
                # Büyüme oranını hesapla
                if last_week > 0:
                    growth_rate = ((this_week - last_week) / last_week) * 100
                elif this_week > 0:
                    growth_rate = 100  # Yeni isim
                else:
                    growth_rate = 0
                
                results.append({
                    "name": row["name"],
                    "language": row["language"],
                    "this_week": this_week,
                    "last_week": last_week,
                    "growth_rate": round(growth_rate, 1)
                })
            
            return results
        except Exception as e:
            logger.error(f"Error getting weekly growth stats: {e}")
            return []

    async def get_theme_popularity(self) -> Dict[str, int]:
        """Theme popularitesini getir"""
        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                SELECT theme, COUNT(*) as count
                FROM favorite_names 
                GROUP BY theme 
                ORDER BY count DESC
            """)
            rows = cursor.fetchall()
            return {row['theme']: row['count'] for row in rows}
        except Exception as e:
            logger.error(f"Error getting theme popularity: {e}")
            return {}

    async def get_subscription_plans(self):
        """Get subscription plans from database"""
        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                SELECT id, name, price, currency, billing_period_days, 
                       max_names_per_request, max_requests_per_day, max_favorites,
                       has_advanced_features, has_analytics, has_priority_support,
                       is_active, created_at
                FROM subscription_plans 
                WHERE is_active = 1
                ORDER BY price ASC
            """)
            rows = cursor.fetchall()
            
            plans = []
            for row in rows:
                plan = {
                    "id": str(row[0]),
                    "name": row[1],
                    "price": row[2],
                    "currency": row[3],
                    "interval": "monthly" if row[4] == 30 else "yearly",
                    "features": self._get_plan_features(row),
                    "limitations": self._get_plan_limitations(row)
                }
                plans.append(plan)
            
            return plans
        except Exception as e:
            logger.error(f"Get subscription plans failed: {e}")
            return None

    def _get_plan_features(self, row):
        """Get features list for a plan based on database values"""
        features = []
        
        # Basic features based on limits
        if row[6] is None:  # max_requests_per_day is None (unlimited)
            features.append("UNLIMITED name generation")
        else:
            features.append(f"{row[6]} name generations/day")
            
        if row[7] is None:  # max_favorites is None (unlimited)
            features.append("Unlimited favorites")
        else:
            features.append(f"Up to {row[7]} favorites")
            
        # Advanced features based on flags
        if row[8]:  # has_advanced_features
            features.extend([
                "AI-powered cultural insights",
                "Detailed name analysis",
                "Name compatibility checker"
            ])
            
        if row[9]:  # has_analytics
            features.extend([
                "Advanced trend analysis",
                "PDF report export",
                "Personalized recommendations"
            ])
            
        if row[10]:  # has_priority_support
            features.append("Priority support")
        else:
            features.append("Community support")
            
        return features

    def _get_plan_limitations(self, row):
        """Get limitations list for a plan"""
        limitations = []
        
        if row[6] is not None:  # has daily limit
            limitations.append("Daily generation limit")
            
        if row[7] is not None:  # has favorites limit
            limitations.append("Limited favorites")
            
        if not row[8]:  # no advanced features
            limitations.extend([
                "No advanced analysis",
                "No cultural insights"
            ])
            
        if not row[9]:  # no analytics
            limitations.extend([
                "No PDF export",
                "No trend analysis"
            ])
            
        return limitations

    async def track_user_usage(self, user_id: int, action: str, details: dict = None):
        """Track user usage for analytics"""
        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                INSERT INTO user_usage_tracking 
                (user_id, action, details, created_at)
                VALUES (?, ?, ?, datetime('now'))
            """, (user_id, action, json.dumps(details) if details else None))
            self.connection.commit()
            return True
        except Exception as e:
            logger.error(f"Track user usage failed: {e}")
            return False

    async def get_user_daily_usage(self, user_id: int, action: str = "name_generation"):
        """Get user's daily usage count"""
        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                SELECT COUNT(*) FROM user_usage_tracking
                WHERE user_id = ? AND action = ? 
                AND date(created_at) = date('now')
            """, (user_id, action))
            result = cursor.fetchone()
            return result[0] if result else 0
        except Exception as e:
            logger.error(f"Get user daily usage failed: {e}")
            return 0

    async def get_user_plan_limits(self, user_id: int):
        """Get user's subscription plan limits - Updated for new plan system"""
        try:
            user = await self.get_user_by_id(user_id)
            if not user:
                return None
                
            subscription_type = user.get("subscription_type", "free")
            
            # NEW PLAN SYSTEM: Free Family, Standard Family, Premium Family
            if subscription_type == "free":
                return {
                    "plan_name": "Free Family",
                    "max_daily_generations": 5,
                    "max_favorites": 3,
                    "has_advanced_features": False,
                    "has_analytics": False,
                    "has_priority_support": False,
                    "has_cultural_insights": False,
                    "has_pdf_export": False
                }
            elif subscription_type == "standard":
                return {
                    "plan_name": "Standard Family",
                    "max_daily_generations": 50,
                    "max_favorites": 20,
                    "has_advanced_features": True,
                    "has_analytics": False,
                    "has_priority_support": False,
                    "has_cultural_insights": True,
                    "has_pdf_export": False
                }
            elif subscription_type == "premium":
                return {
                    "plan_name": "Premium Family", 
                    "max_daily_generations": None,  # Unlimited
                    "max_favorites": None,  # Unlimited
                    "has_advanced_features": True,
                    "has_analytics": True,
                    "has_priority_support": True,
                    "has_cultural_insights": True,
                    "has_pdf_export": True
                }
            # Legacy plan support (will be converted to free)
            elif subscription_type in ["family", "Free Starter", "Family Pro"]:
                logger.warning(f"Legacy plan detected for user {user_id}: {subscription_type}. Converting to free.")
                # Update user to free plan
                cursor = self.connection.cursor()
                cursor.execute("UPDATE users SET subscription_type = 'free' WHERE id = ?", (user_id,))
                self.connection.commit()
                
                return {
                    "plan_name": "Free Family",
                    "max_daily_generations": 5,
                    "max_favorites": 3,
                    "has_advanced_features": False,
                    "has_analytics": False,
                    "has_priority_support": False,
                    "has_cultural_insights": False,
                    "has_pdf_export": False
                }
            else:
                # Default to free plan for unknown types
                return {
                    "plan_name": "Free Family",
                    "max_daily_generations": 5,
                    "max_favorites": 3,
                    "has_advanced_features": False,
                    "has_analytics": False,
                    "has_priority_support": False,
                    "has_cultural_insights": False,
                    "has_pdf_export": False
                }
        except Exception as e:
            logger.error(f"Get user plan limits failed: {e}")
            return None

    # NEW: Advanced Analytics Methods
    async def get_revenue_analytics(self, days: int = 30) -> Dict[str, Any]:
        """Gelir analizlerini getir"""
        try:
            logger.debug(f"Starting revenue analytics for {days} days")
            cursor = self.connection.cursor()
            
            # Test database connection first
            cursor.execute("SELECT COUNT(*) FROM subscription_history")
            total_rows = cursor.fetchone()[0]
            logger.debug(f"Total subscription_history rows: {total_rows}")
            
            # Test payment_amount filtering
            cursor.execute("SELECT COUNT(*) FROM subscription_history WHERE payment_amount > 0")
            paid_rows = cursor.fetchone()[0]
            logger.debug(f"Rows with payment_amount > 0: {paid_rows}")
            
            # Son X günün gelir analizleri - Sayıları yuvarla
            query1 = """
                SELECT 
                    DATE(started_at) as date,
                    ROUND(SUM(payment_amount), 2) as daily_revenue,
                    COUNT(*) as transactions,
                    ROUND(AVG(payment_amount), 2) as avg_transaction
                FROM subscription_history 
                WHERE started_at >= datetime('now', '-{} days') 
                AND payment_amount > 0
                GROUP BY DATE(started_at)
                ORDER BY date DESC
            """.format(days)
            logger.debug(f"Executing query1: {query1}")
            
            cursor.execute(query1)
            raw_daily_data = cursor.fetchall()
            daily_data = []
            if raw_daily_data:  # Check if not None
                for row in raw_daily_data:
                    if row:  # Check if row is not None
                        row_dict = dict(row)
                        # Ensure proper rounding for daily data
                        if 'daily_revenue' in row_dict:
                            row_dict['daily_revenue'] = round(float(row_dict['daily_revenue']), 2)
                        if 'avg_transaction' in row_dict:
                            row_dict['avg_transaction'] = round(float(row_dict['avg_transaction']), 2)
                        daily_data.append(row_dict)
            logger.debug(f"Daily data result: {daily_data}")
            
            # Toplam gelir - FIX: cursor.fetchone() sadece bir kez çağır + Sayıları yuvarla
            query2 = """
                SELECT 
                    ROUND(SUM(payment_amount), 2) as total_revenue,
                    COUNT(*) as total_transactions,
                    ROUND(AVG(payment_amount), 2) as avg_transaction
                FROM subscription_history 
                WHERE started_at >= datetime('now', '-{} days')
                AND payment_amount > 0
            """.format(days)
            logger.debug(f"Executing query2: {query2}")
            
            cursor.execute(query2)
            totals_row = cursor.fetchone()
            logger.debug(f"Totals row result: {totals_row}")
            
            totals = dict(totals_row) if totals_row else {
                "total_revenue": 0.00,
                "total_transactions": 0,
                "avg_transaction": 0.00
            }
            
            # Aylık karşılaştırma - Sayıları yuvarla
            query3 = """
                SELECT 
                    strftime('%Y-%m', started_at) as month,
                    ROUND(SUM(payment_amount), 2) as monthly_revenue,
                    COUNT(*) as monthly_transactions
                FROM subscription_history 
                WHERE payment_amount > 0
                GROUP BY strftime('%Y-%m', started_at)
                ORDER BY month DESC
                LIMIT 6
            """
            logger.debug(f"Executing query3: {query3}")
            
            cursor.execute(query3)
            raw_monthly_data = cursor.fetchall()
            monthly_data = []
            if raw_monthly_data:  # Check if not None
                for row in raw_monthly_data:
                    if row:  # Check if row is not None
                        row_dict = dict(row)
                        # Ensure proper rounding for monthly data
                        if 'monthly_revenue' in row_dict:
                            row_dict['monthly_revenue'] = round(float(row_dict['monthly_revenue']), 2)
                        monthly_data.append(row_dict)
            logger.debug(f"Monthly data result: {monthly_data}")
            
            # Ensure totals have default values with proper rounding
            if not totals.get("total_revenue"):
                totals["total_revenue"] = 0.00
            if not totals.get("total_transactions"):
                totals["total_transactions"] = 0
            if not totals.get("avg_transaction"):
                totals["avg_transaction"] = 0.00
            
            # Additional rounding for Python calculation safety
            totals["total_revenue"] = round(float(totals["total_revenue"]), 2)
            totals["avg_transaction"] = round(float(totals["avg_transaction"]), 2)
            
            result = {
                "daily_data": daily_data or [],
                "totals": totals,
                "monthly_data": monthly_data or [],
                "currency": "USD"
            }
            logger.debug(f"Final analytics result: {result}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting revenue analytics: {e}")
            return {
                "daily_data": [], 
                "totals": {
                    "total_revenue": 0.00,
                    "total_transactions": 0,
                    "avg_transaction": 0.00
                }, 
                "monthly_data": [], 
                "currency": "USD"
            }

    async def get_user_activity_analytics(self, days: int = 30) -> Dict[str, Any]:
        """Kullanıcı aktivite analizlerini getir"""
        try:
            cursor = self.connection.cursor()
            
            # Günlük aktif kullanıcılar
            cursor.execute("""
                SELECT 
                    DATE(created_at) as date,
                    COUNT(DISTINCT user_id) as active_users,
                    COUNT(*) as total_actions
                FROM user_usage_tracking 
                WHERE created_at >= datetime('now', '-{} days')
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            """.format(days))
            raw_daily_activity = cursor.fetchall()
            daily_activity = [dict(row) for row in raw_daily_activity] if raw_daily_activity else []
            
            # En popüler aktiviteler
            cursor.execute("""
                SELECT 
                    action,
                    COUNT(*) as count,
                    COUNT(DISTINCT user_id) as unique_users
                FROM user_usage_tracking 
                WHERE created_at >= datetime('now', '-{} days')
                GROUP BY action
                ORDER BY count DESC
            """.format(days))
            raw_popular_actions = cursor.fetchall()
            popular_actions = [dict(row) for row in raw_popular_actions] if raw_popular_actions else []
            
            # Kullanıcı segment analizleri
            cursor.execute("""
                SELECT 
                    u.subscription_type,
                    COUNT(DISTINCT u.id) as user_count,
                    AVG(usage_count) as avg_usage
                FROM users u
                LEFT JOIN (
                    SELECT user_id, COUNT(*) as usage_count
                    FROM user_usage_tracking 
                    WHERE created_at >= datetime('now', '-{} days')
                    GROUP BY user_id
                ) usage ON u.id = usage.user_id
                GROUP BY u.subscription_type
            """.format(days))
            raw_user_segments = cursor.fetchall()
            user_segments = [dict(row) for row in raw_user_segments] if raw_user_segments else []
            
            return {
                "daily_activity": daily_activity,
                "popular_actions": popular_actions,
                "user_segments": user_segments
            }
            
        except Exception as e:
            logger.error(f"Error getting user activity analytics: {e}")
            return {"daily_activity": [], "popular_actions": [], "user_segments": []}

    async def get_conversion_analytics(self, days: int = 30) -> Dict[str, Any]:
        """Dönüşüm oranı analizlerini getir"""
        try:
            cursor = self.connection.cursor()
            
            # Genel dönüşüm oranları
            cursor.execute("""
                SELECT 
                    COUNT(*) as total_users,
                    SUM(CASE WHEN subscription_type != 'free' THEN 1 ELSE 0 END) as premium_users,
                    ROUND(
                        (SUM(CASE WHEN subscription_type != 'free' THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 2
                    ) as conversion_rate
                FROM users
                WHERE created_at >= datetime('now', '-{} days')
            """.format(days))
            overall_conversion = dict(cursor.fetchone())
            
            # Haftalık dönüşüm trendi
            cursor.execute("""
                SELECT 
                    strftime('%Y-W%W', created_at) as week,
                    COUNT(*) as signups,
                    SUM(CASE WHEN subscription_type != 'free' THEN 1 ELSE 0 END) as conversions,
                    ROUND(
                        (SUM(CASE WHEN subscription_type != 'free' THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 2
                    ) as weekly_conversion_rate
                FROM users
                WHERE created_at >= datetime('now', '-{} days')
                GROUP BY strftime('%Y-W%W', created_at)
                ORDER BY week DESC
            """.format(days))
            raw_weekly_conversion = cursor.fetchall()
            weekly_conversion = [dict(row) for row in raw_weekly_conversion] if raw_weekly_conversion else []
            
            # Plan bazlı dönüşüm
            cursor.execute("""
                SELECT 
                    subscription_type,
                    COUNT(*) as user_count,
                    ROUND((COUNT(*) * 100.0) / (SELECT COUNT(*) FROM users), 2) as percentage
                FROM users
                GROUP BY subscription_type
                ORDER BY user_count DESC
            """)
            raw_plan_distribution = cursor.fetchall()
            plan_distribution = [dict(row) for row in raw_plan_distribution] if raw_plan_distribution else []
            
            return {
                "overall_conversion": overall_conversion,
                "weekly_conversion": weekly_conversion,
                "plan_distribution": plan_distribution
            }
            
        except Exception as e:
            logger.error(f"Error getting conversion analytics: {e}")
            return {"overall_conversion": {}, "weekly_conversion": [], "plan_distribution": []}

    async def search_users(self, query: str, page: int = 1, limit: int = 20) -> Dict[str, Any]:
        """Kullanıcı arama fonksiyonu"""
        try:
            offset = (page - 1) * limit
            
            # Arama sorgusu - ID, isim, email'de arama yapar
            search_pattern = f"%{query}%"
            cursor = self.connection.cursor()
            
            # Arama sonuçları
            cursor.execute("""
                SELECT id, email, name, created_at, subscription_type, subscription_expires, is_admin
                FROM users 
                WHERE 
                    CAST(id AS TEXT) LIKE ? OR 
                    name LIKE ? OR 
                    email LIKE ?
                ORDER BY created_at DESC 
                LIMIT ? OFFSET ?
            """, (search_pattern, search_pattern, search_pattern, limit, offset))
            users = [dict(row) for row in cursor.fetchall()]
            
            # Toplam sonuç sayısı
            cursor.execute("""
                SELECT COUNT(*) as total
                FROM users 
                WHERE 
                    CAST(id AS TEXT) LIKE ? OR 
                    name LIKE ? OR 
                    email LIKE ?
            """, (search_pattern, search_pattern, search_pattern))
            total = cursor.fetchone()['total']
            
            return {
                "users": users,
                "total": total,
                "page": page,
                "limit": limit,
                "total_pages": (total + limit - 1) // limit
            }
            
        except Exception as e:
            logger.error(f"Error searching users: {e}")
            return {"users": [], "total": 0, "page": page, "limit": limit, "total_pages": 0}

    # NEW: Multi-Plan Subscription System
    async def get_user_active_plans(self, user_id: int) -> List[Dict[str, Any]]:
        """Kullanıcının aktif planlarını getir"""
        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                SELECT 
                    sh.id,
                    sp.name,
                    sp.description,
                    sp.price,
                    sp.currency,
                    sh.started_at,
                    sh.expires_at,
                    sh.status
                FROM subscription_history sh
                JOIN subscription_plans sp ON sh.subscription_type = sp.name
                WHERE sh.user_id = ? 
                AND sh.status = 'active'
                AND (sh.expires_at IS NULL OR sh.expires_at > datetime('now'))
                ORDER BY sh.started_at DESC
            """, (user_id,))
            
            return [dict(row) for row in cursor.fetchall()]
            
        except Exception as e:
            logger.error(f"Error getting user active plans: {e}")
            return []

    async def assign_multiple_plans(self, user_id: int, plan_names: List[str]) -> bool:
        """Kullanıcıya birden fazla plan ata - Enhanced with better error handling and verification"""
        try:
            cursor = self.connection.cursor()
            
            # Validate user exists first
            cursor.execute("SELECT id, email, name FROM users WHERE id = ?", (user_id,))
            user = cursor.fetchone()
            if not user:
                logger.error(f"User {user_id} not found for plan assignment")
                return False
            
            user_dict = dict(user)
            logger.info(f"Assigning plans to user: {user_dict['email']} (ID: {user_id})")
            
            # Plan isimleri mapping - Frontend plan names to backend subscription types
            plan_mapping = {
                "Free Family": "free",
                "Standard Family": "standard", 
                "Premium Family": "premium",
                "free": "free",
                "standard": "standard",
                "premium": "premium"
            }
            
            # Validate plan names
            if not plan_names or len(plan_names) == 0:
                logger.error(f"No plan names provided for user {user_id}")
                return False
            
            # Önce mevcut aktif planları deaktif et
            cursor.execute("""
                UPDATE subscription_history 
                SET status = 'deactivated', updated_at = datetime('now')
                WHERE user_id = ? AND status = 'active'
            """, (user_id,))
            deactivated_count = cursor.rowcount
            logger.info(f"Deactivated {deactivated_count} existing plans for user {user_id}")
            
            # Convert plan names to backend subscription types
            mapped_subscription_types = []
            for plan_name in plan_names:
                if plan_name in plan_mapping:
                    mapped_subscription_types.append(plan_mapping[plan_name])
                    logger.info(f"Mapped plan '{plan_name}' to '{plan_mapping[plan_name]}'")
                else:
                    logger.warning(f"Unknown plan name '{plan_name}', defaulting to 'free'")
                    mapped_subscription_types.append("free")
            
            # Use the highest priority plan as primary subscription
            plan_priority = {"premium": 3, "standard": 2, "free": 1}
            primary_plan = max(mapped_subscription_types, key=lambda x: plan_priority.get(x, 0))
            logger.info(f"Selected primary plan: {primary_plan}")
            
            # Plan fiyatları mapping - NEW PRICING SYSTEM
            plan_pricing = {
                "free": 0.00,
                "standard": 4.99,
                "premium": 8.99
            }
            
            # Update user's primary subscription type in users table FIRST
            expires_at = None
            if primary_plan in ["standard", "premium"]:
                expires_at = datetime.now() + timedelta(days=30)  # 1 month
            
            cursor.execute("""
                UPDATE users 
                SET subscription_type = ?, subscription_expires = ?, updated_at = datetime('now')
                WHERE id = ?
            """, (primary_plan, expires_at, user_id))
            
            # Verify the update was successful
            if cursor.rowcount != 1:
                logger.error(f"Failed to update user {user_id} subscription type")
                self.connection.rollback()
                return False
            
            # Add to subscription history for revenue tracking
            payment_amount = plan_pricing.get(primary_plan, 0.00)
            
            cursor.execute("""
                INSERT INTO subscription_history 
                (user_id, subscription_type, started_at, expires_at, payment_amount, payment_currency, status, created_at)
                VALUES (?, ?, datetime('now'), ?, ?, ?, 'active', datetime('now'))
            """, (user_id, primary_plan, expires_at, payment_amount, "USD"))
            
            # Verify the subscription history was inserted
            if cursor.rowcount != 1:
                logger.error(f"Failed to insert subscription history for user {user_id}")
                self.connection.rollback()
                return False
            
            # Commit all changes
            self.connection.commit()
            
            # Verify final state by reading back from database
            cursor.execute("SELECT subscription_type FROM users WHERE id = ?", (user_id,))
            final_plan = cursor.fetchone()
            if final_plan and dict(final_plan)['subscription_type'] == primary_plan:
                logger.info(f"✅ Plan assignment VERIFIED: {primary_plan} to user {user_id} (payment: ${payment_amount})")
                return True
            else:
                logger.error(f"❌ Plan assignment VERIFICATION FAILED for user {user_id}")
                return False
            
        except Exception as e:
            logger.error(f"Error assigning multiple plans to user {user_id}: {e}")
            try:
                self.connection.rollback()
                logger.info(f"Database rollback completed for user {user_id}")
            except Exception as rollback_error:
                logger.error(f"Rollback failed: {rollback_error}")
            return False

    async def get_plan_analytics(self) -> Dict[str, Any]:
        """Plan analitiklerini getir"""
        try:
            cursor = self.connection.cursor()
            
            # Plan dağılımı
            cursor.execute("""
                SELECT 
                    sp.name,
                    COUNT(sh.id) as active_subscriptions,
                    SUM(sp.price) as total_recurring_revenue,
                    AVG(julianday('now') - julianday(sh.started_at)) as avg_subscription_days
                FROM subscription_plans sp
                LEFT JOIN subscription_history sh ON sp.name = sh.subscription_type 
                    AND sh.status = 'active'
                    AND (sh.expires_at IS NULL OR sh.expires_at > datetime('now'))
                GROUP BY sp.name, sp.price
                ORDER BY active_subscriptions DESC
            """)
            raw_plan_stats = cursor.fetchall()
            plan_stats = [dict(row) for row in raw_plan_stats] if raw_plan_stats else []
            
            # En popüler plan kombinasyonları
            cursor.execute("""
                SELECT 
                    GROUP_CONCAT(subscription_type, ', ') as plan_combination,
                    COUNT(DISTINCT user_id) as user_count
                FROM subscription_history 
                WHERE status = 'active'
                GROUP BY user_id
                HAVING COUNT(*) > 1
                ORDER BY user_count DESC
                LIMIT 10
            """)
            raw_popular_combinations = cursor.fetchall()
            popular_combinations = [dict(row) for row in raw_popular_combinations] if raw_popular_combinations else []
            
            return {
                "plan_stats": plan_stats,
                "popular_combinations": popular_combinations
            }
            
        except Exception as e:
            logger.error(f"Error getting plan analytics: {e}")
            return {"plan_stats": [], "popular_combinations": []}


# Simple compatibility function for professional version
def get_db():
    """Simple compatibility function for SQLAlchemy-style dependency injection"""
    # For now, this is just a placeholder - professional version needs SQLAlchemy setup
    # This prevents import errors but professional version will need proper database setup
    return None 