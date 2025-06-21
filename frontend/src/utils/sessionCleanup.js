/**
 * Session Cleanup Utility
 * Maintains session integrity and prevents conflicts between authentication systems
 */

/**
 * Clean up orphaned or conflicting session data
 */
export function cleanupOrphanedSessions() {
  console.log('🧹 Starting session cleanup...');
  
  try {
    // List of all possible authentication-related keys
    const authKeys = [
      // Legacy keys
      'token',
      'refresh_token',
      'user_data',
      'access_token',
      
      // Baby AI specific keys
      'baby_ai_token',
      'baby_ai_user',
      'baby_ai_session',
      'baby_ai_plan',
      'baby_ai_last_user_id',
      
      // Session manager keys
      'session_data',
      'auth_state',
      'current_user',
      
      // Cached data that might be stale
      'cached_user_data',
      'cached_favorites',
      'subscription_cache',
      'user_subscription',
      'subscription_status',
      'plan_cache',
      'user_plan',
      'user_daily_usage',
      'last_generation_time',
      
      // Temporary keys
      'temp_user_data',
      'login_attempt',
      'registration_data'
    ];
    
    // Get current user info from secure storage
    const secureUser = JSON.parse(localStorage.getItem('baby_ai_user') || 'null');
    const lastUserId = localStorage.getItem('baby_ai_last_user_id');
    
    // Check for user ID conflicts
    if (secureUser && lastUserId) {
      if (secureUser.id.toString() !== lastUserId) {
        console.warn('🚨 User ID conflict detected, clearing all auth data');
        authKeys.forEach(key => localStorage.removeItem(key));
        sessionStorage.clear();
        return true; // Cleaned up
      }
    }
    
    // Check for token consistency issues
    const legacyToken = localStorage.getItem('token');
    const secureToken = localStorage.getItem('baby_ai_token');
    
    if (legacyToken && secureToken && legacyToken !== secureToken) {
      console.warn('🚨 Token mismatch detected, prioritizing secure token');
      localStorage.removeItem('token');
      localStorage.setItem('token', secureToken); // Set legacy for compatibility
    }
    
    // Clean up expired cached data
    cleanupExpiredCache();
    
    // Clean up duplicate user data
    cleanupDuplicateUserData();
    
    console.log('✅ Session cleanup completed');
    return false; // No major cleanup needed
    
  } catch (error) {
    console.error('❌ Session cleanup failed:', error);
    return false;
  }
}

/**
 * Clean up expired cache entries
 */
function cleanupExpiredCache() {
  const cacheKeys = [
    'cached_favorites',
    'subscription_cache',
    'user_daily_usage',
    'plan_cache'
  ];
  
  cacheKeys.forEach(key => {
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const data = JSON.parse(cached);
        if (data.expires && new Date(data.expires) < new Date()) {
          console.log(`🗑️ Removing expired cache: ${key}`);
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      // Invalid cache data, remove it
      localStorage.removeItem(key);
    }
  });
}

/**
 * Clean up duplicate user data across different keys
 */
function cleanupDuplicateUserData() {
  const userDataKeys = [
    'baby_ai_user',
    'user_data',
    'cached_user_data'
  ];
  
  const userDataEntries = userDataKeys.map(key => {
    try {
      const data = localStorage.getItem(key);
      return data ? { key, data: JSON.parse(data) } : null;
    } catch {
      return null;
    }
  }).filter(Boolean);
  
  if (userDataEntries.length > 1) {
    // Find the most recent/complete user data
    const primary = userDataEntries.find(entry => entry.key === 'baby_ai_user') || userDataEntries[0];
    
    // Remove duplicates, keep only the primary
    userDataKeys.forEach(key => {
      if (key !== primary.key) {
        localStorage.removeItem(key);
      }
    });
    
    // Ensure primary data is also stored in legacy key for compatibility
    if (primary.key !== 'user_data') {
      localStorage.setItem('user_data', JSON.stringify(primary.data));
    }
    
    console.log(`🔧 Consolidated user data to ${primary.key}`);
  }
}

/**
 * Force clear all authentication data
 */
export function forceAuthCleanup() {
  console.log('🚨 Force clearing all authentication data...');
  
  // Clear localStorage
  const keysToRemove = [
    'token', 'refresh_token', 'user_data', 'access_token',
    'baby_ai_token', 'baby_ai_user', 'baby_ai_session', 'baby_ai_plan',
    'baby_ai_last_user_id', 'session_data', 'auth_state', 'current_user',
    'cached_user_data', 'cached_favorites', 'subscription_cache',
    'user_subscription', 'subscription_status', 'plan_cache',
    'user_plan', 'user_daily_usage', 'last_generation_time',
    'temp_user_data', 'login_attempt', 'registration_data'
  ];
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  // Clear sessionStorage
  sessionStorage.clear();
  
  // Clear cookies (best effort - can only clear non-httpOnly cookies)
  document.cookie.split(";").forEach(cookie => {
    const eqPos = cookie.indexOf("=");
    const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
    if (name && !name.startsWith('_') && name !== 'csrf_token') {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
  });
  
  console.log('✅ Force cleanup completed');
}

/**
 * Validate current session integrity
 */
export function validateSessionIntegrity() {
  try {
    const user = JSON.parse(localStorage.getItem('baby_ai_user') || 'null');
    const lastUserId = localStorage.getItem('baby_ai_last_user_id');
    
    if (!user && !lastUserId) {
      return true; // No session, that's valid
    }
    
    if (user && lastUserId) {
      if (user.id.toString() === lastUserId) {
        return true; // Session is consistent
      }
    }
    
    console.warn('⚠️ Session integrity check failed');
    return false;
    
  } catch (error) {
    console.error('❌ Session integrity check error:', error);
    return false;
  }
}

/**
 * Migrate legacy session data to secure format
 */
export function migrateLegacySession() {
  console.log('🔄 Checking for legacy session migration...');
  
  try {
    const legacyUser = localStorage.getItem('user_data');
    const legacyToken = localStorage.getItem('token');
    const secureUser = localStorage.getItem('baby_ai_user');
    const secureToken = localStorage.getItem('baby_ai_token');
    
    // If we have legacy data but no secure data, migrate
    if (legacyUser && legacyToken && !secureUser && !secureToken) {
      console.log('📦 Migrating legacy session to secure format...');
      
      const userData = JSON.parse(legacyUser);
      
      // Copy to secure keys
      localStorage.setItem('baby_ai_user', legacyUser);
      localStorage.setItem('baby_ai_token', legacyToken);
      localStorage.setItem('baby_ai_last_user_id', userData.id.toString());
      
      console.log('✅ Legacy session migrated successfully');
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error('❌ Legacy session migration failed:', error);
    return false;
  }
}

/**
 * Setup automatic session maintenance
 */
export function setupSessionMaintenance() {
  console.log('🔧 Setting up automatic session maintenance...');
  
  // Run cleanup on app start
  cleanupOrphanedSessions();
  
  // Migrate legacy sessions
  migrateLegacySession();
  
  // Set up periodic cleanup (every 30 minutes)
  setInterval(() => {
    cleanupOrphanedSessions();
    
    // Validate session integrity
    if (!validateSessionIntegrity()) {
      console.warn('🚨 Session integrity compromised, forcing cleanup');
      forceAuthCleanup();
      
      // Reload page to start fresh
      window.location.reload();
    }
  }, 30 * 60 * 1000); // 30 minutes
  
  // Listen for storage events from other tabs
  window.addEventListener('storage', (event) => {
    if (event.key && event.key.includes('user')) {
      setTimeout(() => {
        if (!validateSessionIntegrity()) {
          console.warn('🚨 Session conflict detected from another tab');
          forceAuthCleanup();
          window.location.reload();
        }
      }, 1000); // Delay to allow other tabs to settle
    }
  });
  
  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    cleanupExpiredCache();
  });
  
  console.log('✅ Session maintenance setup completed');
}

/**
 * Get session health status
 */
export function getSessionHealthStatus() {
  const status = {
    isValid: false,
    issues: [],
    recommendations: []
  };
  
  try {
    // Check for user data
    const user = JSON.parse(localStorage.getItem('baby_ai_user') || 'null');
    if (!user) {
      status.issues.push('No user data found');
      status.recommendations.push('User needs to log in');
      return status;
    }
    
    // Check for token
    const token = localStorage.getItem('baby_ai_token') || localStorage.getItem('token');
    if (!token) {
      status.issues.push('No authentication token found');
      status.recommendations.push('User needs to log in again');
      return status;
    }
    
    // Check user ID consistency
    const lastUserId = localStorage.getItem('baby_ai_last_user_id');
    if (lastUserId && user.id.toString() !== lastUserId) {
      status.issues.push('User ID mismatch');
      status.recommendations.push('Clear session and re-authenticate');
      return status;
    }
    
    // Check for excessive cache
    const storageSize = JSON.stringify(localStorage).length;
    if (storageSize > 500000) { // 500KB
      status.issues.push('Excessive cached data');
      status.recommendations.push('Clean up expired cache');
    }
    
    // Check token expiry (if possible)
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        const exp = payload.exp * 1000;
        const now = Date.now();
        
        if (exp < now) {
          status.issues.push('Token expired');
          status.recommendations.push('Refresh token or re-authenticate');
        } else if (exp - now < 5 * 60 * 1000) { // 5 minutes
          status.issues.push('Token expires soon');
          status.recommendations.push('Token should be refreshed');
        }
      }
    } catch (tokenError) {
      status.issues.push('Invalid token format');
    }
    
    status.isValid = status.issues.length === 0;
    
  } catch (error) {
    status.issues.push('Session health check failed');
    status.recommendations.push('Force cleanup and restart');
  }
  
  return status;
}

// Export default cleanup function
export default cleanupOrphanedSessions; 