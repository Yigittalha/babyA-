/**
 * Session Management System
 * Handles user sessions, plan synchronization, and security
 */

// Plan type constants - must match backend
export const PLAN_TYPES = {
  FREE: 'free',
  STANDARD: 'standard',
  PREMIUM: 'premium'
};

// Plan display names
export const PLAN_DISPLAY_NAMES = {
  [PLAN_TYPES.FREE]: { en: 'Free Family', tr: 'Ücretsiz Aile' },
  [PLAN_TYPES.STANDARD]: { en: 'Standard Family', tr: 'Standart Aile' },
  [PLAN_TYPES.PREMIUM]: { en: 'Premium Family', tr: 'Premium Aile' }
};

// Plan features configuration
export const PLAN_FEATURES = {
  [PLAN_TYPES.FREE]: {
    maxDailyGenerations: 5,
    maxFavorites: 3,
    hasAdvancedFeatures: false,
    hasAnalytics: false,
    hasPrioritySupport: false,
    hasCulturalInsights: false,
    hasPdfExport: false
  },
  [PLAN_TYPES.STANDARD]: {
    maxDailyGenerations: 50,
    maxFavorites: 20,
    hasAdvancedFeatures: true,
    hasAnalytics: false,
    hasPrioritySupport: false,
    hasCulturalInsights: true,
    hasPdfExport: false
  },
  [PLAN_TYPES.PREMIUM]: {
    maxDailyGenerations: null, // Unlimited
    maxFavorites: null, // Unlimited
    hasAdvancedFeatures: true,
    hasAnalytics: true,
    hasPrioritySupport: true,
    hasCulturalInsights: true,
    hasPdfExport: true
  }
};

class SessionManager {
  constructor() {
    this.currentUser = null;
    this.sessionKey = 'baby_ai_session';
    this.userKey = 'baby_ai_user';
    this.planKey = 'baby_ai_plan';
    this.lastUserIdKey = 'baby_ai_last_user_id';
    this.listeners = new Set();
    
    // Initialize session without aggressive integrity checks
    this.initializeSession();
    
    // Monitor storage changes (for multi-tab sync)
    window.addEventListener('storage', this.handleStorageChange.bind(this));
  }

  // Initialize session from storage
  initializeSession() {
    try {
      console.log('🔍 SessionManager: Initializing session...');
      
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem(this.userKey) || localStorage.getItem('user_data');
      
      console.log('  Token present:', !!token);
      console.log('  User data present:', !!userData);
      
      if (token && userData) {
        const parsedUserData = JSON.parse(userData);
        console.log('  Parsed user data:', parsedUserData.email, 'ID:', parsedUserData.id);
        
        // Skip token expiry check during initialization - let AuthStateManager handle it
        console.log('  Skipping token validation during initialization for better UX');
        
        // Set user without strict validation
        this.currentUser = parsedUserData;
        localStorage.setItem(this.lastUserIdKey, parsedUserData.id.toString());
        this.validateAndSyncPlan();
        
        console.log('✅ SessionManager: Session initialized successfully');
        return true;
      }
      
      console.log('📝 SessionManager: No session data to initialize');
      return false;
    } catch (error) {
      console.error('❌ SessionManager: Session initialization failed:', error);
      return false; // Don't clear session on initialization errors
    }
  }

  // Set user session
  setSession(userData, token, refreshToken) {
    try {
      // Store previous user ID for comparison
      const previousUserId = this.currentUser?.id;
      
      // Clear any existing session if user changed
      if (previousUserId && previousUserId !== userData.id) {
        this.clearSession();
      }
      
      // Validate plan type
      const validatedPlan = this.validatePlanType(userData.subscription_type);
      userData.subscription_type = validatedPlan;
      
      // Store session data
      this.currentUser = userData;
      localStorage.setItem('token', token);
      localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem(this.userKey, JSON.stringify(userData));
      localStorage.setItem(this.lastUserIdKey, userData.id.toString());
      localStorage.setItem(this.planKey, validatedPlan);
      
      // Notify listeners
      this.notifyListeners('session_created', userData);
      
      return true;
    } catch (error) {
      console.error('Failed to set session:', error);
      return false;
    }
  }

  // Update user plan with enhanced cache clearing
  updateUserPlan(newPlan) {
    if (!this.currentUser) return false;
    
    const validatedPlan = this.validatePlanType(newPlan);
    const oldPlan = this.currentUser.subscription_type;
    
    // Update user object
    this.currentUser.subscription_type = validatedPlan;
    
    // Clear all possible cache locations
    const cacheKeys = [
      'user_data',
      'baby_ai_user', 
      'cached_user_data',
      'subscription_cache',
      'user_subscription',
      'subscription_status',
      'plan_cache',
      'user_plan',
      `user_${this.currentUser.id}_plan`,
      `subscription_${this.currentUser.id}`
    ];
    
    cacheKeys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    // Set fresh data in primary locations
    localStorage.setItem(this.userKey, JSON.stringify(this.currentUser));
    localStorage.setItem(this.planKey, validatedPlan);
    localStorage.setItem('user_data', JSON.stringify(this.currentUser));
    localStorage.setItem('baby_ai_user', JSON.stringify(this.currentUser));
    
    // Clear sessionStorage as well
    sessionStorage.removeItem('user_data');
    sessionStorage.removeItem('subscription_cache');
    
    // Notify listeners with detailed info
    this.notifyListeners('plan_updated', { 
      plan: validatedPlan, 
      oldPlan: oldPlan,
      user: this.currentUser,
      timestamp: new Date().toISOString()
    });
    
    console.log(`✅ SessionManager: Plan updated from ${oldPlan} to ${validatedPlan}`);
    
    return true;
  }

  // Validate plan type
  validatePlanType(plan) {
    const normalizedPlan = (plan || '').toLowerCase();
    
    // Check if it's a valid plan type
    if (Object.values(PLAN_TYPES).includes(normalizedPlan)) {
      return normalizedPlan;
    }
    
    // Default to free for invalid plans
    console.warn(`Invalid plan type: ${plan}, defaulting to free`);
    return PLAN_TYPES.FREE;
  }

  // Get current user plan features
  getUserPlanFeatures() {
    const plan = this.currentUser?.subscription_type || PLAN_TYPES.FREE;
    return PLAN_FEATURES[this.validatePlanType(plan)];
  }

  // Check if user has specific feature
  hasFeature(featureName) {
    const features = this.getUserPlanFeatures();
    return features[featureName] === true;
  }

  // Check if user has reached limit
  hasReachedLimit(limitType, currentCount) {
    const features = this.getUserPlanFeatures();
    const limit = features[limitType];
    
    // null means unlimited
    if (limit === null) return false;
    
    return currentCount >= limit;
  }

  // Clear session (logout)
  clearSession() {
    // Store clearing user ID for audit
    const clearingUserId = this.currentUser?.id;
    
    // Clear all session data
    this.currentUser = null;
    
    // Clear storage
    const keysToRemove = [
      'token',
      'refresh_token',
      this.userKey,
      'user_data', // Also clear user_data key
      this.planKey,
      'user_daily_usage',
      'cached_favorites',
      'last_generation_time'
    ];
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Clear session storage too
    sessionStorage.clear();
    
    // Notify listeners
    this.notifyListeners('session_cleared', { userId: clearingUserId });
  }

  // Check session integrity
  checkSessionIntegrity() {
    try {
      const storedUserId = localStorage.getItem(this.lastUserIdKey);
      const currentUserData = localStorage.getItem(this.userKey);
      
      if (currentUserData) {
        const userData = JSON.parse(currentUserData);
        
        // Check if user ID matches
        if (storedUserId && userData.id.toString() !== storedUserId) {
          console.warn('User ID mismatch detected, clearing session');
          this.clearSession();
          return false;
        }
        
        // Validate token expiry
        const token = localStorage.getItem('token');
        if (token && this.isTokenExpired(token)) {
          console.warn('Token expired, clearing session');
          this.clearSession();
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Session integrity check failed:', error);
      this.clearSession();
      return false;
    }
  }

  // Check if token is expired
  isTokenExpired(token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000; // Convert to milliseconds
      return Date.now() > exp;
    } catch (error) {
      return true; // Assume expired if can't parse
    }
  }

  // Handle storage changes (multi-tab sync)
  handleStorageChange(event) {
    // Check if session-related keys changed
    if (event.key === this.userKey || event.key === 'token') {
      if (event.newValue === null) {
        // Session cleared in another tab
        this.currentUser = null;
        this.notifyListeners('session_cleared_remote', {});
      } else if (event.key === this.userKey) {
        // User data updated in another tab
        try {
          const newUserData = JSON.parse(event.newValue);
          if (this.currentUser?.id !== newUserData.id) {
            // Different user logged in another tab
            this.clearSession();
            window.location.href = '/login';
          } else {
            // Same user, update data
            this.currentUser = newUserData;
            this.notifyListeners('session_updated_remote', newUserData);
          }
        } catch (error) {
          console.error('Failed to parse user data from storage:', error);
        }
      }
    }
  }

  // Add listener for session events
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Notify all listeners
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Session listener error:', error);
      }
    });
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Check if user is logged in
  isLoggedIn() {
    return !!this.currentUser && !!localStorage.getItem('token');
  }

  // Check if user is admin
  isAdmin() {
    return this.currentUser?.is_admin === true || this.currentUser?.role === 'admin';
  }

  // Check if user is premium (standard or premium plan)
  isPremium() {
    const plan = this.currentUser?.subscription_type;
    return plan === PLAN_TYPES.STANDARD || plan === PLAN_TYPES.PREMIUM;
  }

  // Get plan display name
  getPlanDisplayName(language = 'tr') {
    const plan = this.currentUser?.subscription_type || PLAN_TYPES.FREE;
    const validatedPlan = this.validatePlanType(plan);
    return PLAN_DISPLAY_NAMES[validatedPlan]?.[language] || plan;
  }

  // Validate and sync plan from backend
  async validateAndSyncPlan() {
    try {
      // This would call the backend to verify the current plan
      // For now, we just validate locally
      if (this.currentUser) {
        const validatedPlan = this.validatePlanType(this.currentUser.subscription_type);
        if (validatedPlan !== this.currentUser.subscription_type) {
          this.updateUserPlan(validatedPlan);
        }
      }
    } catch (error) {
      console.error('Plan validation failed:', error);
    }
  }
}

// Create singleton instance
const sessionManager = new SessionManager();

// Export instance and utilities
export default sessionManager;

// Helper functions
export const isFeatureAvailable = (featureName) => sessionManager.hasFeature(featureName);
export const hasReachedLimit = (limitType, count) => sessionManager.hasReachedLimit(limitType, count);
export const isPremiumUser = () => sessionManager.isPremium();
export const isAdminUser = () => sessionManager.isAdmin();
export const getCurrentPlan = () => sessionManager.currentUser?.subscription_type || PLAN_TYPES.FREE;
export const getPlanFeatures = () => sessionManager.getUserPlanFeatures(); 