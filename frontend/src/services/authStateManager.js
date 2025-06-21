/**
 * Auth State Manager - Firebase Auth benzeri güvenli oturum yönetimi
 * JWT token tabanlı ama Firebase Auth'un güvenilirliğini sağlayan sistem
 */

import { api } from './api.js';

class AuthStateManager {
  constructor() {
    this.currentUser = null;
    this.isInitialized = false;
    this.authListeners = new Set();
    this.isRefreshing = false;
    
    // Storage keys
    this.tokenKey = 'baby_ai_token';
    this.userKey = 'baby_ai_user';
    this.lastUserIdKey = 'baby_ai_last_user_id';
    
    // Initialize auth state
    this.initializeAuth();
    
    // Monitor storage changes (multi-tab sync)
    window.addEventListener('storage', this.handleStorageChange.bind(this));
    
    // Monitor page visibility for session validation
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
  }

  /**
   * Initialize authentication state
   * Firebase Auth benzeri başlatma
   */
  async initializeAuth() {
    try {
      console.log('🔐 AuthStateManager: Initializing authentication...');
      
      // Check for existing session
      const token = localStorage.getItem(this.tokenKey);
      const userData = localStorage.getItem(this.userKey);
      
      if (!token || !userData) {
        console.log('📝 AuthStateManager: No existing session found');
        this.setAuthState(null);
        return;
      }

      // Parse stored user data
      let parsedUser;
      try {
        parsedUser = JSON.parse(userData);
      } catch (e) {
        console.error('❌ AuthStateManager: Invalid user data format');
        this.clearAuthState();
        return;
      }

      // For existing sessions, trust the stored data initially
      console.log('✅ AuthStateManager: Found existing session, restoring...');
      
      // Ensure tokens are properly set
      localStorage.setItem('token', token); // Legacy compatibility
      localStorage.setItem(this.tokenKey, token);
      
      // Set auth state without aggressive validation
      this.currentUser = parsedUser;
      this.isInitialized = true;
      localStorage.setItem(this.lastUserIdKey, parsedUser.id.toString());
      
      // Notify listeners
      this.notifyAuthListeners(parsedUser, null);
      
      // Validate in background (non-blocking)
      this.validateSessionInBackground(token, parsedUser);
      
    } catch (error) {
      console.error('❌ AuthStateManager: Initialization failed:', error);
      this.clearAuthState();
    }
  }

  /**
   * Background session validation (non-blocking)
   */
  async validateSessionInBackground(token, userData) {
    try {
      // Disable background validation in development to prevent issues
      const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isDevelopment) {
        console.log('🚫 AuthStateManager: Background validation disabled in development');
        return;
      }
      
      // Wait longer to avoid immediate validation conflicts
      setTimeout(async () => {
        try {
          console.log('🔍 AuthStateManager: Running background session validation...');
          const isValid = await this.validateSession(token, userData);
          if (!isValid) {
            console.warn('🚨 AuthStateManager: Background session validation failed, but keeping session for user experience');
            // Don't clear session immediately, let user continue
          } else {
            console.log('✅ AuthStateManager: Background session validation passed');
          }
        } catch (error) {
          console.warn('⚠️ AuthStateManager: Background validation error (non-critical):', error);
        }
      }, 10000); // 10 second delay instead of 2 seconds
    } catch (error) {
      console.warn('❌ AuthStateManager: Background validation setup failed:', error);
    }
  }

  /**
   * Validate session with backend
   * Token ve kullanıcı tutarlılığını kontrol eder
   */
  async validateSession(token, userData) {
    try {
      // Basic token format check
      if (!this.isValidTokenFormat(token)) {
        console.warn('Invalid token format');
        return false;
      }

      // Check token expiry
      if (this.isTokenExpired(token)) {
        console.warn('Token expired');
        return false;
      }

      // Set token in ALL locations for validation
      const backupTokens = {
        token: localStorage.getItem('token'),
        baby_ai_token: localStorage.getItem(this.tokenKey),
        user_data: localStorage.getItem('user_data'),
        baby_ai_user: localStorage.getItem(this.userKey)
      };
      
      // Set token in all locations for maximum compatibility
      localStorage.setItem('token', token);
      localStorage.setItem(this.tokenKey, token);
      localStorage.setItem('user_data', JSON.stringify(userData));
      localStorage.setItem(this.userKey, JSON.stringify(userData));
      
      try {
        // Validate with backend - direct call to avoid conflicts
        const apiClient = (await import('./api.js')).apiClient;
        const response = await apiClient.get('/profile');
        
        // Check if backend user matches stored user
        // Backend response format: { success: true, id: 1, email: "...", ... } (flat structure)
        if (response.success) {
          // Backend returns flat user data, not nested in 'user' property
          const backendUser = response;
          
          // Critical: Check user ID consistency
          if (backendUser.id !== userData.id) {
            console.error('User ID mismatch:', {
              stored: userData.id,
              backend: backendUser.id
            });
            return false;
          }

          // Check email consistency
          if (backendUser.email !== userData.email) {
            console.warn('Email mismatch, updating local data');
            userData.email = backendUser.email;
            localStorage.setItem(this.userKey, JSON.stringify(userData));
            localStorage.setItem('user_data', JSON.stringify(userData)); // Legacy compatibility
          }

          return true;
        }

        return false;
        
      } catch (validationError) {
        // Restore all backup tokens on error
        Object.keys(backupTokens).forEach(key => {
          if (backupTokens[key]) {
            localStorage.setItem(key === 'baby_ai_token' ? this.tokenKey : 
                               key === 'baby_ai_user' ? this.userKey : key, backupTokens[key]);
          } else {
            localStorage.removeItem(key === 'baby_ai_token' ? this.tokenKey : 
                                  key === 'baby_ai_user' ? this.userKey : key);
          }
        });
        
        // Don't clear session on network errors
        if (validationError.message?.includes('401') || validationError.status === 401) {
          console.error('Authentication failed:', validationError);
          return false;
        }
        
        console.warn('Session validation network error:', validationError);
        return true; // Assume valid if network error (like 500, timeout, etc.)
      }
      
    } catch (error) {
      console.error('Session validation failed:', error);
      return false;
    }
  }

  /**
   * Set authentication state
   * Firebase Auth'un user state değişimini taklit eder
   */
  setAuthState(user) {
    const previousUser = this.currentUser;
    this.currentUser = user;
    this.isInitialized = true;

    // Store last user ID for integrity checks
    if (user) {
      localStorage.setItem(this.lastUserIdKey, user.id.toString());
    }

    // Notify all listeners (Firebase Auth benzeri)
    this.notifyAuthListeners(user, previousUser);
  }

  /**
   * Firebase Auth benzeri onAuthStateChanged
   */
  onAuthStateChanged(callback) {
    // Add listener
    this.authListeners.add(callback);

    // If already initialized, call immediately
    if (this.isInitialized) {
      callback(this.currentUser);
    }

    // Return unsubscribe function
    return () => {
      this.authListeners.delete(callback);
    };
  }

  /**
   * Sign in user
   */
  async signInWithEmailAndPassword(email, password) {
    try {
      console.log('🔐 AuthStateManager: Signing in user...');
      
      // Gentle clear - don't notify listeners yet
      this.currentUser = null;
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem('token');
      localStorage.removeItem(this.userKey);
      localStorage.removeItem('user_data');
      
      // Direct API call bypassing api object to avoid token conflicts
      const apiClient = (await import('./api.js')).apiClient;
      console.log('🔄 Attempting login with:', { email, password: '***' });
      const response = await apiClient.post('/auth/login', { email, password });
      console.log('📨 Login response received:', response.success ? '✅ Success' : '❌ Failed');
      
      if (response.success && response.user && response.access_token) {
        // Store authentication data in ALL required locations for compatibility
        localStorage.setItem(this.tokenKey, response.access_token);
        localStorage.setItem('token', response.access_token); // Legacy compatibility
        localStorage.setItem(this.userKey, JSON.stringify(response.user));
        localStorage.setItem('user_data', JSON.stringify(response.user)); // Legacy compatibility
        
        if (response.refresh_token) {
          localStorage.setItem('refresh_token', response.refresh_token);
        }

        // Set auth state WITHOUT immediate validation
        this.currentUser = response.user;
        this.isInitialized = true;
        
        // Store last user ID for integrity checks
        localStorage.setItem(this.lastUserIdKey, response.user.id.toString());
        
        // Notify listeners AFTER everything is set up
        this.notifyAuthListeners(response.user, null);
        
        console.log('✅ AuthStateManager: Sign in successful, session established');
        return { success: true, user: response.user };
      }

      throw new Error(response.message || 'Sign in failed');
      
    } catch (error) {
      console.error('❌ AuthStateManager: Sign in failed:', error);
      
      // Enhanced error handling with user-friendly messages
      let userMessage = 'Giriş yapılamadı. Lütfen tekrar deneyin.';
      
      if (error.status === 401 || error.message?.includes('401')) {
        userMessage = 'Email veya şifre hatalı. Lütfen kontrol edip tekrar deneyin.';
      } else if (error.status === 400) {
        userMessage = 'Geçersiz giriş bilgileri. Email ve şifre gereklidir.';
      } else if (error.status >= 500) {
        userMessage = 'Sunucu hatası. Lütfen birkaç dakika sonra tekrar deneyin.';
      } else if (error.message?.includes('fetch') || error.message?.includes('network')) {
        userMessage = 'Bağlantı hatası. İnternet bağlantınızı kontrol edip tekrar deneyin.';
      }
      
      // Throw enhanced error with user-friendly message
      const enhancedError = new Error(userMessage);
      enhancedError.originalError = error;
      enhancedError.status = error.status;
      throw enhancedError;
    }
  }

  /**
   * Sign out user
   */
  async signOut() {
    try {
      console.log('🔐 AuthStateManager: Signing out user...');
      
      // Clear authentication state
      this.clearAuthState();
      
      console.log('✅ AuthStateManager: Sign out successful');
      return { success: true };
      
    } catch (error) {
      console.error('❌ AuthStateManager: Sign out failed:', error);
      throw error;
    }
  }

  /**
   * Clear authentication state
   */
  clearAuthState() {
    console.log('🧹 AuthStateManager: Clearing authentication state...');
    
    // Add stack trace to debug what's calling clearAuthState
    console.trace('🔍 AuthStateManager: clearAuthState called from:');
    
    // Clear memory
    const previousUser = this.currentUser;
    this.currentUser = null;
    
    // Clear storage
    const keysToRemove = [
      this.tokenKey,
      'token', // Legacy key
      this.userKey,
      'user_data', // Legacy key
      'refresh_token',
      'user_daily_usage',
      'cached_favorites',
      'last_generation_time',
      'baby_ai_plan',
      'baby_ai_session'
    ];
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    // Clear session storage
    sessionStorage.clear();
    
    // Set initialized flag
    this.isInitialized = true;
    
    // Notify listeners
    console.log('📢 AuthStateManager: Notifying listeners of auth state change (user -> null)');
    this.notifyAuthListeners(null, previousUser);
  }

  /**
   * Notify auth state listeners
   */
  notifyAuthListeners(currentUser, previousUser) {
    this.authListeners.forEach(callback => {
      try {
        callback(currentUser, previousUser);
      } catch (error) {
        console.error('Auth listener error:', error);
      }
    });
  }

  /**
   * Handle storage changes (multi-tab sync)
   */
  handleStorageChange(event) {
    // Disable storage sync in development to prevent conflicts
    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isDevelopment) {
      console.log('🚫 AuthStateManager: Storage sync disabled in development');
      return;
    }
    
    // Only handle our keys
    if (event.key === this.tokenKey || event.key === this.userKey) {
      console.log('🔍 AuthStateManager: Storage change detected:', event.key, event.newValue ? 'updated' : 'removed');
      
      if (event.newValue === null) {
        // Session cleared in another tab
        console.log('🚨 AuthStateManager: Session cleared in another tab, updating auth state');
        this.setAuthState(null);
      } else if (event.key === this.userKey && event.newValue) {
        // User data changed in another tab
        try {
          const newUser = JSON.parse(event.newValue);
          
          // Check if different user
          if (this.currentUser?.id !== newUser.id) {
            console.warn('🚨 AuthStateManager: Different user detected in another tab, clearing auth state');
            this.clearAuthState();
            window.location.reload();
          } else {
            // Same user, update state
            console.log('✅ AuthStateManager: Same user detected, updating auth state');
            this.setAuthState(newUser);
          }
        } catch (error) {
          console.error('❌ AuthStateManager: Failed to parse user data from storage:', error);
          this.clearAuthState();
        }
      }
    }
  }

  /**
   * Handle page visibility change
   */
  async handleVisibilityChange() {
    if (document.visibilityState === 'visible' && this.currentUser) {
      // Disable visibility validation in development
      const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isDevelopment) {
        console.log('🚫 AuthStateManager: Visibility validation disabled in development');
        return;
      }
      
      // Validate session when page becomes visible
      const token = localStorage.getItem(this.tokenKey);
      if (token) {
        try {
          console.log('🔍 AuthStateManager: Validating session on visibility change...');
          const isValid = await this.validateSession(token, this.currentUser);
          if (!isValid) {
            console.warn('🚨 AuthStateManager: Session invalid on visibility change, clearing auth state');
            this.clearAuthState();
          } else {
            console.log('✅ AuthStateManager: Session valid on visibility change');
          }
        } catch (error) {
          console.warn('⚠️ AuthStateManager: Visibility validation error:', error);
        }
      }
    }
  }

  /**
   * Check if token format is valid
   */
  isValidTokenFormat(token) {
    if (!token || typeof token !== 'string') return false;
    
    // JWT should have 3 parts separated by dots
    const parts = token.split('.');
    return parts.length === 3;
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000;
      return Date.now() > exp;
    } catch (error) {
      return true;
    }
  }

  /**
   * Get current user (Firebase Auth benzeri)
   */
  get currentUser() {
    return this._currentUser;
  }

  set currentUser(user) {
    this._currentUser = user;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.currentUser && !!localStorage.getItem(this.tokenKey);
  }

  /**
   * Get user token
   */
  getToken() {
    return localStorage.getItem(this.tokenKey);
  }

  /**
   * Update user data
   */
  updateUser(updatedUser) {
    if (this.currentUser && updatedUser.id === this.currentUser.id) {
      const newUser = { ...this.currentUser, ...updatedUser };
      localStorage.setItem(this.userKey, JSON.stringify(newUser));
      this.setAuthState(newUser);
    }
  }
}

// Create singleton instance
const authStateManager = new AuthStateManager();

export default authStateManager;

// Export Firebase Auth benzeri functions
export const onAuthStateChanged = (callback) => authStateManager.onAuthStateChanged(callback);
export const signInWithEmailAndPassword = (email, password) => authStateManager.signInWithEmailAndPassword(email, password);
export const signOut = () => authStateManager.signOut();
export const getCurrentUser = () => authStateManager.currentUser;
export const getAuthToken = () => authStateManager.getToken(); 