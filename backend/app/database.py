"""
Veritabanı yönetimi
"""

import os
import sqlite3
import asyncio
from typing import Optional, List, Dict, Any
from datetime import datetime
import hashlib
import secrets
from .models import UserRegistration, FavoriteNameCreate
from .utils import logger


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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        """Kullanıcının abonelik bilgilerini güncelle"""
        try:
            cursor = self.connection.cursor()
            
            cursor.execute("""
                UPDATE users 
                SET subscription_type = ?, subscription_expires = ?
                WHERE id = ?
            """, (subscription_type, expires_at, user_id))
            
            self.connection.commit()
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