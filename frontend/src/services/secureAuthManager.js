/**
 * Secure Authentication Manager
 * Enhanced token management with localStorage and Authorization headers
 */

import { axiosClient, enhancedTokenManager } from './api.js';

class SecureAuthManager {
  constructor() {
    this.user = null;
    this.isAuthenticated = false;
    this.refreshTimer = null;
    this.sessionHealthTimer = null;
    this.eventListeners = new Map();
    this.csrfToken = null;
    this.isInitializing = false;
    this.isInitialized = false;
    
    // Initialize manager
    this.init();
  }

  async init() {
    if (this.isInitializing || this.isInitialized) {
      console.log('🛡️ SecureAuthManager already initializing/initialized');
      return;
    }

    this.isInitializing = true;
    
    try {
      // Check if user is already authenticated via localStorage tokens
      if (enhancedTokenManager.hasValidTokens()) {
        await this.getCurrentUser();
      }
      
      // Setup automatic token refresh and session monitoring only if user is authenticated
      if (this.isAuthenticated) {
        this.setupTokenRefresh();
        this.setupSessionHealthCheck();
      }
      
      this.isInitialized = true;
      console.log('🛡️ SecureAuthManager initialized successfully');
    } catch (error) {
      console.warn('SecureAuthManager initialization failed:', error);
    } finally {
      this.isInitializing = false;
    }
  }

  // Firebase Auth-like API
  async signInWithEmailAndPassword(email, password) {
    try {
      const response = await axiosClient.post('/auth/login', {
        email,
        password
      });

      if (response.success && response.access_token) {
        // Save tokens to enhanced token manager
        enhancedTokenManager.setTokens(response.access_token, response.refresh_token);
        
        // Save user data
        this.user = response.user;
        this.isAuthenticated = true;
        localStorage.setItem('auth_user_data', JSON.stringify(response.user));
        
        this.notifyAuthStateChange(this.user);
        
        // Setup refresh timer and session monitoring after successful login
        this.setupTokenRefresh();
        this.setupSessionHealthCheck();
        
        console.log('✅ User signed in successfully with localStorage tokens');
        return response;
      }
      
      throw new Error('Login failed - no tokens received');
    } catch (error) {
      console.error('❌ Sign in failed:', error);
      // Clear any partial tokens
      enhancedTokenManager.clearTokens();
      throw error;
    }
  }

  async createUserWithEmailAndPassword(email, password, userData = {}) {
    try {
      const response = await axiosClient.post('/auth/register', {
        email,
        password,
        ...userData
      });

      if (response.success && response.access_token) {
        // Save tokens to enhanced token manager
        enhancedTokenManager.setTokens(response.access_token, response.refresh_token);
        
        // Save user data
        this.user = response.user;
        this.isAuthenticated = true;
        localStorage.setItem('auth_user_data', JSON.stringify(response.user));
        
        this.notifyAuthStateChange(this.user);
        
        // Setup refresh timer and session monitoring after successful registration
        this.setupTokenRefresh();
        this.setupSessionHealthCheck();
        
        console.log('✅ User registered successfully with localStorage tokens');
        return response;
      }
      
      throw new Error('Registration failed - no tokens received');
    } catch (error) {
      console.error('❌ Registration failed:', error);
      // Clear any partial tokens
      enhancedTokenManager.clearTokens();
      throw error;
    }
  }

  async signOut() {
    try {
      // Call logout endpoint to invalidate server-side session
      await axiosClient.post('/auth/logout');
    } catch (error) {
      console.warn('Logout endpoint failed:', error);
    } finally {
      // Clear local state and tokens
      this.user = null;
      this.isAuthenticated = false;
      this.clearTimers();
      
      // Clear all tokens and user data
      enhancedTokenManager.clearTokens();
      localStorage.removeItem('auth_user_data');
      
      this.notifyAuthStateChange(null);
      
      console.log('✅ User signed out and tokens cleared');
    }
  }

  async getCurrentUser() {
    try {
      // First check if we have valid tokens
      if (!enhancedTokenManager.hasValidTokens()) {
        this.user = null;
        this.isAuthenticated = false;
        return null;
      }

      // Try to get user from localStorage first
      const cachedUser = localStorage.getItem('auth_user_data');
      if (cachedUser) {
        try {
          this.user = JSON.parse(cachedUser);
          this.isAuthenticated = true;
          console.log('✅ Current user loaded from cache:', this.user.email);
          return this.user;
        } catch (error) {
          console.warn('Failed to parse cached user data');
        }
      }

      // Fetch current user from server
      const response = await axiosClient.get('/auth/me');
      
      if (response.user) {
        this.user = response.user;
        this.isAuthenticated = true;
        localStorage.setItem('auth_user_data', JSON.stringify(response.user));
        console.log('✅ Current user retrieved from server:', response.user.email);
        return response.user;
      }
      
      this.user = null;
      this.isAuthenticated = false;
      return null;
    } catch (error) {
      // 401 is expected when user is not logged in - handle silently
      if (error.status === 401) {
        enhancedTokenManager.clearTokens();
        localStorage.removeItem('auth_user_data');
      } else {
        console.warn('getCurrentUser error:', error.message);
      }
      
      this.user = null;
      this.isAuthenticated = false;
      return null;
    }
  }

  // Auth state management
  onAuthStateChanged(callback) {
    const listenerId = Math.random().toString(36).substr(2, 9);
    this.eventListeners.set(listenerId, callback);
    
    // Call immediately with current state
    callback(this.user);
    
    // Return unsubscribe function
    return () => {
      this.eventListeners.delete(listenerId);
    };
  }

  notifyAuthStateChange(user) {
    this.eventListeners.forEach(callback => {
      try {
        callback(user);
      } catch (error) {
        console.error('Auth state callback error:', error);
      }
    });
  }

  // Automatic token refresh (every 25 minutes)
  setupTokenRefresh() {
    this.clearRefreshTimer();
    
    // Enhanced token manager handles automatic refresh
    // This is just for additional monitoring
    this.refreshTimer = setInterval(async () => {
      try {
        if (!enhancedTokenManager.hasValidTokens()) {
          console.log('🚨 No valid tokens found during health check');
          this.handleSessionExpired();
        }
      } catch (error) {
        console.error('Token health check failed:', error);
        this.handleSessionExpired();
      }
    }, 5 * 60 * 1000); // 5 minutes health check
  }

  async refreshTokens() {
    try {
      await enhancedTokenManager.refreshAccessToken();
      console.log('🔄 Tokens refreshed successfully via enhanced manager');
      return { success: true };
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  // Session health monitoring - simplified since enhanced token manager handles most of this
  setupSessionHealthCheck() {
    this.clearSessionHealthTimer();
    
    // Check user data validity every 10 minutes
    this.sessionHealthTimer = setInterval(async () => {
      try {
        if (this.isAuthenticated && enhancedTokenManager.hasValidTokens()) {
          // Verify user data is still valid
          await this.getCurrentUser();
        }
      } catch (error) {
        console.warn('Session health check failed:', error);
        if (error.status === 401) {
          this.handleSessionExpired();
        }
      }
    }, 10 * 60 * 1000); // 10 minutes
  }

  // Session expiry handling
  handleSessionExpired() {
    console.warn('🚨 Session expired');
    
    this.user = null;
    this.isAuthenticated = false;
    this.clearTimers();
    
    // Enhanced token manager handles token cleanup
    enhancedTokenManager.handleTokenExpired();
    localStorage.removeItem('auth_user_data');
    
    this.notifyAuthStateChange(null);
    
    // Optional: Redirect to login or show modal
    if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
      window.location.pathname = '/login';
    }
  }

  // Multi-device session management
  async getActiveSessions() {
    try {
      return await axiosClient.get('/auth/sessions');
    } catch (error) {
      console.error('Failed to get active sessions:', error);
      return { sessions: [] };
    }
  }

  async terminateSession(sessionId) {
    try {
      return await axiosClient.delete(`/auth/sessions/${sessionId}`);
    } catch (error) {
      console.error('Failed to terminate session:', error);
      throw error;
    }
  }

  async terminateAllOtherSessions() {
    try {
      return await axiosClient.post('/auth/logout-all');
    } catch (error) {
      console.error('Failed to terminate all sessions:', error);
      throw error;
    }
  }

  // Plan-based feature access
  hasFeatureAccess(feature) {
    if (!this.user) return false;
    
    const userPlan = this.user.subscription?.plan_id || 'free';
    
    const featureMap = {
      'unlimited_generation': ['premium', 'enterprise'],
      'advanced_analytics': ['premium', 'enterprise'],
      'priority_support': ['premium', 'enterprise'],
      'api_access': ['enterprise'],
      'custom_themes': ['premium', 'enterprise']
    };
    
    return featureMap[feature]?.includes(userPlan) || false;
  }

  getUserPlan() {
    return this.user?.subscription?.plan_id || 'free';
  }

  async checkDailyLimit(action = 'generate') {
    try {
      const response = await axiosClient.get('/auth/limits');
      return response.limits?.[action] || { used: 0, limit: 5, remaining: 5 };
    } catch (error) {
      console.error('Failed to check daily limit:', error);
      return { used: 0, limit: 5, remaining: 5 };
    }
  }

  // Utility methods
  clearTimers() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    if (this.sessionHealthTimer) {
      clearInterval(this.sessionHealthTimer);
      this.sessionHealthTimer = null;
    }
  }

  clearRefreshTimer() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  clearSessionHealthTimer() {
    if (this.sessionHealthTimer) {
      clearInterval(this.sessionHealthTimer);
      this.sessionHealthTimer = null;
    }
  }

  // Cross-tab synchronization
  setupCrossTabSync() {
    // Listen for storage events to sync across tabs
    window.addEventListener('storage', (e) => {
      if (e.key === 'auth_sync') {
        const data = JSON.parse(e.newValue || '{}');
        
        if (data.action === 'logout') {
          this.handleSessionExpired();
        } else if (data.action === 'login') {
          this.getCurrentUser();
        }
      }
    });
  }

  // Broadcast auth changes to other tabs
  broadcastAuthChange(action) {
    try {
      localStorage.setItem('auth_sync', JSON.stringify({
        action,
        timestamp: Date.now()
      }));
      
      // Clear the storage item after broadcasting
      setTimeout(() => {
        localStorage.removeItem('auth_sync');
      }, 1000);
    } catch (error) {
      console.warn('Failed to broadcast auth change:', error);
    }
  }

  // Cleanup on page unload
  cleanup() {
    this.clearTimers();
    this.eventListeners.clear();
  }
}

// Global instance
const secureAuthManager = new SecureAuthManager();

// Setup cross-tab synchronization
secureAuthManager.setupCrossTabSync();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  secureAuthManager.cleanup();
});

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.secureAuthManager = secureAuthManager;
}

export default secureAuthManager; 