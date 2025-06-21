/**
 * Session Cleanup Utility
 * Cleans up all session data to prevent session mixing
 */

export const cleanupAllSessions = () => {
  console.log('🧹 Cleaning up all sessions...');
  
  // List of all keys that might store session/user data
  const keysToRemove = [
    // Auth tokens
    'token',
    'refresh_token',
    'access_token',
    
    // User data with various keys
    'user',
    'user_data',
    'baby_ai_user',
    'baby_ai_session',
    'baby_ai_plan',
    'baby_ai_last_user_id',
    
    // Usage tracking
    'user_daily_usage',
    'cached_favorites',
    'last_generation_time',
    
    // Admin related
    'admin_token',
    'admin_user',
    
    // Any other app-specific keys
    'subscription_status',
    'premium_features'
  ];
  
  // Remove each key
  keysToRemove.forEach(key => {
    if (localStorage.getItem(key) !== null) {
      console.log(`  Removing: ${key}`);
      localStorage.removeItem(key);
    }
  });
  
  // Also clear sessionStorage
  sessionStorage.clear();
  
  // Clear any cookies (if accessible)
  document.cookie.split(";").forEach((c) => {
    document.cookie = c
      .replace(/^ +/, "")
      .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
  });
  
  console.log('✅ Session cleanup complete');
};

// Auto-cleanup on certain conditions
export const checkAndCleanupIfNeeded = () => {
  const token = localStorage.getItem('token');
  const userData = localStorage.getItem('baby_ai_user') || localStorage.getItem('user_data');
  
  console.log('🔍 Session integrity check:');
  console.log('  Token present:', !!token);
  console.log('  User data present:', !!userData);
  
  if (token && userData) {
    try {
      // Decode token
      const tokenPayload = JSON.parse(atob(token.split('.')[1]));
      const tokenUserId = tokenPayload.sub;
      
      // Parse user data
      const user = JSON.parse(userData);
      
      console.log('  Token user ID:', tokenUserId);
      console.log('  User data ID:', user.id);
      
      // Check for mismatch - but be more lenient
      if (tokenUserId !== user.id.toString()) {
        console.error('⚠️ Session integrity violation detected!');
        console.error(`Token user ID: ${tokenUserId}, User data ID: ${user.id}`);
        
        // Only cleanup if this looks like a serious mismatch
        // Skip cleanup if it's just a minor format difference
        if (Math.abs(parseInt(tokenUserId) - parseInt(user.id)) > 0) {
          cleanupAllSessions();
          return true; // Cleaned
        } else {
          console.log('  Minor ID format difference, not cleaning up');
        }
      } else {
        console.log('  ✅ Token and user data IDs match');
      }
    } catch (e) {
      console.error('Session check failed:', e);
      // Don't cleanup on decode errors during refresh - might be temporary
      console.log('  ⚠️ Session check error, but not cleaning up (might be temporary)');
      return false;
    }
  } else {
    console.log('  📝 No complete session data to check');
  }
  
  return false; // No cleanup needed
};

// Export for use in browser console
if (typeof window !== 'undefined') {
  window.cleanupAllSessions = cleanupAllSessions;
  window.checkAndCleanupIfNeeded = checkAndCleanupIfNeeded;
} 