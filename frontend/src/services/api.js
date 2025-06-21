/**
 * Professional API service with enhanced error handling, token management, and caching
 */

import axios from 'axios';

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Create enhanced Axios instance for secure authentication
const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true, // Enable httpOnly cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Secure token refresh mechanism using httpOnly cookies
let refreshPromise = null;

// Request interceptor for secure authentication
axiosClient.interceptors.request.use(
  (config) => {
    // Add security headers
    config.headers['X-Requested-With'] = 'XMLHttpRequest';
    
      // Get token from AuthStateManager compatible keys (primary)
  const authToken = localStorage.getItem('baby_ai_token') || localStorage.getItem('token');
  
  // Fallback to enhanced token manager keys if primary not available
  const enhancedToken = enhancedTokenManager.getAccessToken();
  
  // Use the first available token for Authorization header
  const tokenToUse = authToken || enhancedToken;
  if (tokenToUse && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${tokenToUse}`;
  }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for secure error handling
axiosClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Check for force re-login header (plan change, session invalidation)
      const forceRelogin = error.response?.headers?.['x-force-relogin'];
      if (forceRelogin === 'true') {
        console.warn('🔐 Plan değişikliği algılandı - zorla tekrar giriş yapılıyor');
        enhancedTokenManager.handleTokenExpired();
        
        // Show plan upgrade notification
        show401Toast('Plan bilgileriniz güncellendi! Yeni özelliklerinizi kullanmak için lütfen tekrar giriş yapın.', 'info');
        
        return Promise.reject({
          status: 401,
          message: 'Plan güncellendi. Yeni özelliklerinize erişmek için lütfen tekrar giriş yapın.',
          sessionInvalidated: true,
          forceRelogin: true,
          planUpgrade: true
        });
      }
      
      // Skip refresh for auth endpoints
      if (originalRequest.url?.includes('/auth/')) {
        // For auth endpoints, notify enhanced token manager of expired tokens
        enhancedTokenManager.handleTokenExpired();
        return Promise.reject({
          status: error.response?.status,
          message: error.response?.data?.detail || error.message,
          data: error.response?.data
        });
      }
      
      // Try token refresh with enhanced token manager
      try {
        await enhancedTokenManager.refreshAccessToken();
        console.log('🔄 Token refreshed successfully');
        
        // Update Authorization header with new token (use compatible keys)
        const newToken = localStorage.getItem('baby_ai_token') || localStorage.getItem('token') || enhancedTokenManager.getAccessToken();
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        
        return axiosClient(originalRequest);
      } catch (refreshError) {
        console.warn('🔄 Token refresh failed:', refreshError);
        
        // Clear all token variants to avoid conflicts
        enhancedTokenManager.clearTokens();
        
        // Show user-friendly notification
        show401Toast('Your session has expired. Please login again.');
        
        return Promise.reject({
          status: 401,
          message: 'Session expired. Please login again.',
          sessionExpired: true
        });
      }
    }
    
    // Handle other errors
    return Promise.reject({
      status: error.response?.status || 500,
      message: error.response?.data?.detail || error.message || 'An error occurred',
      data: error.response?.data,
      code: error.code
    });
  }
);

// Utility function to get cookie value (for CSRF token reading)
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Enhanced Token Management for localStorage + Authorization Header
class EnhancedTokenManager {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    this.refreshPromise = null;
    this.isRefreshing = false;
    
    // Load tokens from localStorage on init
    this.loadTokensFromStorage();
    
    // Setup automatic refresh monitoring
    this.setupTokenMonitoring();
  }

  // Load tokens from localStorage (AuthStateManager compatible)
  loadTokensFromStorage() {
    try {
      // Use AuthStateManager compatible keys first
      this.accessToken = localStorage.getItem('baby_ai_token') || localStorage.getItem('token') || localStorage.getItem('auth_access_token');
      this.refreshToken = localStorage.getItem('refresh_token') || localStorage.getItem('auth_refresh_token');
      
      // Validate token format
      if (this.accessToken && !this.isValidJWT(this.accessToken)) {
        console.warn('Invalid access token format, clearing tokens');
        this.clearTokens();
      }
      
      console.log('🔐 Tokens loaded from storage:', {
        hasAccess: !!this.accessToken,
        hasRefresh: !!this.refreshToken
      });
    } catch (error) {
      console.error('Failed to load tokens from storage:', error);
      this.clearTokens();
    }
  }

  // Save tokens to localStorage (AuthStateManager compatible)
  setTokens(accessToken, refreshToken) {
    try {
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
      
      if (accessToken) {
        // Store in AuthStateManager compatible keys (primary)
        localStorage.setItem('baby_ai_token', accessToken);
        localStorage.setItem('token', accessToken); // Legacy compatibility
        // Also keep enhanced keys for backward compatibility
        localStorage.setItem('auth_access_token', accessToken);
      }
      if (refreshToken) {
        // Store in AuthStateManager compatible keys (primary)
        localStorage.setItem('refresh_token', refreshToken);
        // Also keep enhanced keys for backward compatibility
        localStorage.setItem('auth_refresh_token', refreshToken);
      }
      
      console.log('✅ Tokens saved to storage');
      
      // Broadcast token change to other tabs
      this.broadcastTokenChange('login');
      
    } catch (error) {
      console.error('Failed to save tokens to storage:', error);
    }
  }

  // Clear all tokens (all key variants)
  clearTokens() {
    try {
      this.accessToken = null;
      this.refreshToken = null;
      
      // Clear AuthStateManager keys
      localStorage.removeItem('baby_ai_token');
      localStorage.removeItem('token');
      localStorage.removeItem('baby_ai_user');  
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_data');
      
      // Clear Enhanced Token Manager keys
      localStorage.removeItem('auth_access_token');
      localStorage.removeItem('auth_refresh_token');
      localStorage.removeItem('auth_user_data');
      
      console.log('🧹 All tokens cleared');
      
      // Broadcast logout to other tabs
      this.broadcastTokenChange('logout');
      
    } catch (error) {
      console.error('Failed to clear tokens:', error);
    }
  }

  // Get current access token (AuthStateManager compatible)
  getAccessToken() {
    return this.accessToken || localStorage.getItem('baby_ai_token') || localStorage.getItem('token') || localStorage.getItem('auth_access_token');
  }

  // Get current refresh token (AuthStateManager compatible)
  getRefreshToken() {
    return this.refreshToken || localStorage.getItem('refresh_token') || localStorage.getItem('auth_refresh_token');
  }

  // Check if we have valid tokens
  hasValidTokens() {
    const token = this.getAccessToken();
    return token && this.isValidJWT(token) && !this.isTokenExpired(token);
  }

  // Validate JWT format
  isValidJWT(token) {
    try {
      return token && token.split('.').length === 3;
    } catch {
      return false;
    }
  }

  // Check if token is expired
  isTokenExpired(token) {
    try {
      if (!token) return true;
      
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      
      // Check if token expires within next 2 minutes
      return payload.exp < (currentTime + 120);
    } catch {
      return true;
    }
  }

  // Setup automatic token monitoring
  setupTokenMonitoring() {
    // Check tokens every 5 minutes
    setInterval(() => {
      const token = this.getAccessToken();
      if (token && this.isTokenExpired(token) && !this.isRefreshing) {
        console.log('🔄 Token expired, attempting refresh...');
        this.refreshAccessToken().catch(error => {
          console.error('Auto refresh failed:', error);
          this.handleTokenExpired();
        });
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  // Refresh access token
  async refreshAccessToken() {
    const refreshToken = this.getRefreshToken();
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;

    this.refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${refreshToken}`
      },
      credentials: 'include'
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Refresh failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.access_token) {
        this.setTokens(data.access_token, data.refresh_token || refreshToken);
        console.log('✅ Token refreshed successfully');
        return data.access_token;
      }
      
      throw new Error('Invalid refresh response');
    }).catch(error => {
      console.error('❌ Token refresh failed:', error);
      this.handleTokenExpired();
      throw error;
    }).finally(() => {
      this.refreshPromise = null;
      this.isRefreshing = false;
    });

    return this.refreshPromise;
  }

  // Handle token expiration
  handleTokenExpired() {
    console.warn('🚨 Tokens expired, logging out user');
    this.clearTokens();
    
    // Redirect to login if not already there
    if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
      window.location.pathname = '/login';
    }
    
    // Dispatch logout event
    window.dispatchEvent(new CustomEvent('auth:logout', {
      detail: { reason: 'token_expired' }
    }));
  }

  // Cross-tab synchronization
  broadcastTokenChange(action) {
    try {
      const event = new CustomEvent('auth:change', {
        detail: { action, timestamp: Date.now() }
      });
      window.dispatchEvent(event);
      
      // Also use localStorage for cross-tab communication
      localStorage.setItem('auth_sync', JSON.stringify({
        action,
        timestamp: Date.now()
      }));
      
      setTimeout(() => {
        localStorage.removeItem('auth_sync');
      }, 1000);
    } catch (error) {
      console.warn('Failed to broadcast token change:', error);
    }
  }
}

// Global enhanced token manager
const enhancedTokenManager = new EnhancedTokenManager();

// Token management with proactive refresh - Compatible with AuthStateManager
class TokenManager {
  constructor() {
    // Use AuthStateManager compatible keys
    this.accessToken = localStorage.getItem('baby_ai_token') || localStorage.getItem('token');
    this.refreshToken = localStorage.getItem('refresh_token');
    this.tokenRefreshPromise = null;
    this.refreshTimer = null;
    this.isRefreshing = false;
    
    // Start background token monitoring
    this.startTokenMonitoring();
  }

  setTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    
    // Store with both keys for compatibility
    localStorage.setItem('baby_ai_token', accessToken);
    localStorage.setItem('token', accessToken); // Legacy compatibility
    localStorage.setItem('refresh_token', refreshToken);
    
    // Schedule proactive refresh
    this.scheduleTokenRefresh();
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    
    // Clear both token keys
    localStorage.removeItem('baby_ai_token');
    localStorage.removeItem('token'); // Legacy compatibility
    localStorage.removeItem('refresh_token');
    
    // Clear scheduled refresh
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  getAccessToken() {
    // Try AuthStateManager key first, then legacy
    return localStorage.getItem('baby_ai_token') || localStorage.getItem('token');
  }

  hasValidTokens() {
    return this.accessToken && this.refreshToken;
  }

  // Decode JWT token to get expiration time
  getTokenExpiration(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      const payload = JSON.parse(jsonPayload);
      return payload.exp * 1000; // Convert to milliseconds
    } catch (error) {
      console.warn('Failed to decode token:', error);
      return null;
    }
  }

  // Check if token needs refresh (refresh 10 minutes before expiry)
  shouldRefreshToken() {
    if (!this.accessToken) return false;
    
    const expirationTime = this.getTokenExpiration(this.accessToken);
    if (!expirationTime) return false;
    
    const currentTime = Date.now();
    const timeToExpiry = expirationTime - currentTime;
    const refreshThreshold = 10 * 60 * 1000; // 10 minutes in milliseconds
    
    return timeToExpiry <= refreshThreshold;
  }

  // Schedule proactive token refresh
  scheduleTokenRefresh() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    
    if (!this.accessToken) return;
    
    const expirationTime = this.getTokenExpiration(this.accessToken);
    if (!expirationTime) return;
    
    const currentTime = Date.now();
    const timeToRefresh = expirationTime - currentTime - (10 * 60 * 1000); // Refresh 10 minutes before expiry
    
    if (timeToRefresh > 0) {
      this.refreshTimer = setTimeout(() => {
        console.log('🔄 Proactive token refresh triggered');
        this.refreshAccessToken().catch(error => {
          console.error('Proactive token refresh failed:', error);
        });
      }, timeToRefresh);
    }
  }

  // Start background token monitoring
  startTokenMonitoring() {
    // Check every 5 minutes
    setInterval(() => {
      if (this.shouldRefreshToken() && !this.isRefreshing) {
        console.log('🔄 Background token refresh triggered');
        this.refreshAccessToken().catch(error => {
          console.error('Background token refresh failed:', error);
        });
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    // Prevent multiple simultaneous refresh attempts
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    this.isRefreshing = true;

    this.tokenRefreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
      body: JSON.stringify({
        refresh_token: this.refreshToken
      })
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error('Token refresh failed');
      }
      
      const data = await response.json();
      this.setTokens(data.access_token, data.refresh_token || this.refreshToken);
      console.log('✅ Token refreshed successfully');
      return data.access_token;
    }).catch(error => {
      console.error('❌ Token refresh failed:', error);
      // If refresh fails, clear tokens and redirect to login
      this.clearTokens();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      throw error;
    }).finally(() => {
      this.tokenRefreshPromise = null;
      this.isRefreshing = false;
    });

    return this.tokenRefreshPromise;
  }
}

// Global token manager instance
const tokenManager = new TokenManager();

// Enhanced error handling
class APIError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Rate limiting handler
class RateLimitHandler {
  constructor() {
    this.retryQueue = new Map();
  }

  async handleRateLimit(response, originalRequest) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
    const requestKey = `${originalRequest.method}:${originalRequest.url}`;
    
    // Avoid duplicate retries for the same request
    if (this.retryQueue.has(requestKey)) {
      return this.retryQueue.get(requestKey);
    }

    const retryPromise = new Promise((resolve) => {
      setTimeout(() => {
        this.retryQueue.delete(requestKey);
        resolve(this.makeRequest(originalRequest));
      }, retryAfter * 1000);
    });

    this.retryQueue.set(requestKey, retryPromise);
    return retryPromise;
  }
}

const rateLimitHandler = new RateLimitHandler();

// Professional HTTP client
class APIClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  async makeRequest(url, options = {}) {
    const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;
    
    // Prepare headers
    const headers = {
      ...this.defaultHeaders,
      ...options.headers,
    };

    // Add auth header if available - check multiple token sources for compatibility
    let accessToken = tokenManager.getAccessToken();
    
    // Fallback to AuthStateManager token keys for compatibility
    if (!accessToken) {
      accessToken = localStorage.getItem('baby_ai_token') || localStorage.getItem('token');
    }
    
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    // Add request ID for tracking
    headers['X-Request-ID'] = this.generateRequestId();

    const requestOptions = {
      ...options,
      headers,
      credentials: 'include', // Send cookies with requests
    };

    try {
      let response = await fetch(fullUrl, requestOptions);

      // Handle token refresh on 401
      if (response.status === 401 && accessToken && !url.includes('/auth/')) {
        try {
          await tokenManager.refreshAccessToken();
          // Retry with new token - check multiple sources again
          let newToken = tokenManager.getAccessToken();
          if (!newToken) {
            newToken = localStorage.getItem('baby_ai_token') || localStorage.getItem('token');
          }
          
          if (newToken) {
            headers.Authorization = `Bearer ${newToken}`;
            response = await fetch(fullUrl, { ...requestOptions, headers });
          } else {
            throw new Error('No token available after refresh');
          }
        } catch (refreshError) {
          // Refresh failed, clear all tokens and redirect to login
          tokenManager.clearTokens();
          localStorage.removeItem('baby_ai_token');
          localStorage.removeItem('token');
          localStorage.removeItem('baby_ai_user');
          localStorage.removeItem('user_data');
          
          // Don't redirect immediately, let auth state manager handle it
          throw new APIError('Authentication failed', 401, 'AUTH_FAILED');
        }
      }

      // Handle rate limiting
      if (response.status === 429) {
        return rateLimitHandler.handleRateLimit(response, { url: fullUrl, ...requestOptions });
      }

      // Parse response
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // Handle errors
      if (!response.ok) {
        const error = data.error || {};
        throw new APIError(
          error.message || `HTTP ${response.status}`,
          response.status,
          error.code || 'UNKNOWN_ERROR',
          error.details
        );
      }

      return data;

    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      
      // Network or other errors
      console.error('API request failed:', error);
      throw new APIError(
        'Network error occurred',
        0,
        'NETWORK_ERROR',
        { originalError: error.message }
      );
    }
  }

  generateRequestId() {
    return 'req_' + Math.random().toString(36).substr(2, 9);
  }

  // HTTP methods
  async get(url, params = {}) {
    const urlWithParams = new URL(url.startsWith('http') ? url : `${this.baseURL}${url}`);
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        urlWithParams.searchParams.append(key, params[key]);
      }
    });

    return this.makeRequest(urlWithParams.toString(), {
      method: 'GET',
    });
  }

  async post(url, data = {}) {
    return this.makeRequest(url, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put(url, data = {}) {
    return this.makeRequest(url, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async patch(url, data = {}) {
    return this.makeRequest(url, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete(url) {
    return this.makeRequest(url, {
      method: 'DELETE',
    });
  }
}

// Global API client instance
const apiClientInstance = new APIClient();

// Professional API service
export const api = {
  // Subscription monitoring
  subscriptionStatus: null,
  subscriptionCheckInterval: null,

  // Initialize subscription monitoring
  initSubscriptionMonitoring() {
    // Check subscription status every hour
    this.subscriptionCheckInterval = setInterval(async () => {
      try {
        await this.checkSubscriptionStatus();
      } catch (error) {
        console.warn('Subscription status check failed:', error);
      }
    }, 60 * 60 * 1000); // 1 hour
    
    // Initial check
    this.checkSubscriptionStatus();
  },

  // Check and warn about subscription expiry
  async checkSubscriptionStatus() {
    try {
      const response = await apiClientInstance.get('/api/subscription/status');
      this.subscriptionStatus = response.subscription;
      
      if (response.subscription && response.subscription.plan_id !== 'free') {
        const expiryDate = new Date(response.subscription.current_period_end);
        const currentDate = new Date();
        const daysToExpiry = Math.ceil((expiryDate - currentDate) / (1000 * 60 * 60 * 24));
        
        // Warn if subscription expires in 7 days or less
        if (daysToExpiry <= 7 && daysToExpiry > 0) {
          this.showSubscriptionWarning(daysToExpiry);
        } else if (daysToExpiry <= 0) {
          this.handleExpiredSubscription();
        }
      }
      
      return this.subscriptionStatus;
    } catch (error) {
      console.error('Failed to check subscription status:', error);
      return null;
    }
  },

  // Show subscription expiry warning
  showSubscriptionWarning(daysLeft) {
    // Create warning notification
    const warningDiv = document.createElement('div');
    warningDiv.className = 'subscription-warning';
    warningDiv.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%);
        color: #2d3436;
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        z-index: 9999;
        max-width: 350px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
        border-left: 4px solid #e17055;
      ">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 24px; margin-right: 10px;">⚠️</span>
          <strong style="font-size: 16px;">Premium Subscription Warning</strong>
        </div>
        <p style="margin: 0; font-size: 14px; line-height: 1.4;">
          Your premium subscription expires in <strong>${daysLeft} day${daysLeft > 1 ? 's' : ''}</strong>. 
          Renew now to continue enjoying premium features.
        </p>
        <div style="margin-top: 12px;">
          <button onclick="window.location.href='/premium'" style="
            background: linear-gradient(135deg, #e17055 0%, #d63031 100%);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            margin-right: 8px;
          ">Renew Now</button>
          <button onclick="this.parentElement.parentElement.parentElement.remove()" style="
            background: transparent;
            color: #636e72;
            border: 1px solid #ddd;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
          ">Dismiss</button>
        </div>
      </div>
    `;
    
    // Remove existing warnings
    const existingWarnings = document.querySelectorAll('.subscription-warning');
    existingWarnings.forEach(warning => warning.remove());
    
    // Add new warning
    document.body.appendChild(warningDiv);
    
    // Auto-remove after 30 seconds
    setTimeout(() => {
      if (document.body.contains(warningDiv)) {
        warningDiv.remove();
      }
    }, 30000);
  },

  // Handle expired subscription
  handleExpiredSubscription() {
    console.log('🚨 Premium subscription has expired');
    
    // Show expiry notification
    const expiryDiv = document.createElement('div');
    expiryDiv.className = 'subscription-expired';
    expiryDiv.innerHTML = `
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #ff7675 0%, #d63031 100%);
        color: white;
        padding: 24px 30px;
        border-radius: 16px;
        box-shadow: 0 12px 35px rgba(0,0,0,0.25);
        z-index: 10000;
        max-width: 400px;
        text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
      ">
        <div style="font-size: 48px; margin-bottom: 16px;">💎</div>
        <h3 style="margin: 0 0 12px 0; font-size: 20px;">Premium Expired</h3>
        <p style="margin: 0 0 20px 0; font-size: 14px; opacity: 0.9; line-height: 1.4;">
          Your premium subscription has expired. Upgrade now to restore access to all premium features.
        </p>
        <div>
          <button onclick="window.location.href='/premium'" style="
            background: rgba(255,255,255,0.2);
            color: white;
            border: 2px solid white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            margin-right: 12px;
            backdrop-filter: blur(10px);
          ">Upgrade Now</button>
          <button onclick="this.parentElement.parentElement.parentElement.remove()" style="
            background: transparent;
            color: rgba(255,255,255,0.8);
            border: 1px solid rgba(255,255,255,0.3);
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
          ">Later</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(expiryDiv);
  },

  // Stop subscription monitoring
  stopSubscriptionMonitoring() {
    if (this.subscriptionCheckInterval) {
      clearInterval(this.subscriptionCheckInterval);
      this.subscriptionCheckInterval = null;
    }
  },

  // Health and system
  async healthCheck() {
    return apiClientInstance.get('/health');
  },

  async getSystemInfo() {
    return apiClientInstance.get('/health/detailed');
  },

  // Authentication endpoints
  async register(userData) {
    const response = await apiClientInstance.post('/auth/register', userData);
    return response;
  },

  async login(credentials) {
    const response = await apiClientInstance.post('/auth/login', credentials);
    
    if (response.access_token && response.refresh_token) {
      tokenManager.setTokens(response.access_token, response.refresh_token);
    }
    
    return response;
  },

  async logout() {
    try {
      // Optionally call logout endpoint to invalidate tokens server-side
      await apiClientInstance.post('/auth/logout');
    } catch (error) {
      console.warn('Logout endpoint failed:', error);
    } finally {
      tokenManager.clearTokens();
    }
  },

  async refreshToken() {
    return tokenManager.refreshAccessToken();
  },

  // Name generation with enhanced features
  async generateNames(requestData) {
    return apiClientInstance.post('/generate', requestData);
  },

  async getPopularNames(params = {}) {
    return apiClientInstance.get('/popular', params);
  },

  async getNameTrends(params = {}) {
    return apiClientInstance.get('/trends', params);
  },

  async analyzeNameCompatibility(name1, name2) {
    return apiClientInstance.post('/analyze/compatibility', { name1, name2 });
  },

  // User management
  async getUserProfile() {
    return apiClientInstance.get('/profile');
  },

  async updateUserProfile(profileData) {
    return apiClientInstance.put('/profile', profileData);
  },

  async deleteAccount() {
    return apiClientInstance.delete('/profile');
  },

  // Favorites management
  async getFavorites(params = {}) {
    return apiClientInstance.get('/favorites', params);
  },

  async addFavorite(favoriteData) {
    return apiClientInstance.post('/favorites', favoriteData);
  },

  async removeFavorite(favoriteId) {
    return apiClientInstance.delete(`/favorites/${favoriteId}`);
  },

  async updateFavorite(favoriteId, updateData) {
    return apiClientInstance.patch(`/favorites/${favoriteId}`, updateData);
  },

  // Subscription management
  async getSubscriptionPlans() {
    return apiClientInstance.get('/subscription/plans');
  },

  async getSubscriptionStatus() {
    return apiClientInstance.get('/subscription/status');
  },

  async upgradeToPremium(planId) {
    return apiClientInstance.post('/subscription/upgrade', { plan_id: planId });
  },

  async cancelSubscription() {
    return apiClientInstance.post('/subscription/cancel');
  },

  // Analytics (for premium users)
  async getUserAnalytics(params = {}) {
    return apiClientInstance.get('/analytics/user', params);
  },

  async getNameUsageStats() {
    return apiClientInstance.get('/analytics/names');
  },

  // Admin endpoints
  async getUsers(params = {}) {
    return apiClientInstance.get('/admin/users', params);
  },

  async getSystemAnalytics(params = {}) {
    return apiClientInstance.get('/admin/analytics', params);
  },

  async updateUserStatus(userId, status) {
    return apiClientInstance.put(`/admin/users/${userId}/status`, { status });
  },

  // NEW: Advanced Admin Analytics APIs
  async getRevenueAnalytics(days = 30) {
    return apiClientInstance.get('/admin/analytics/revenue', { days });
  },

  async getActivityAnalytics(days = 30) {
    return apiClientInstance.get('/admin/analytics/activity', { days });
  },

  async getConversionAnalytics(days = 30) {
    return apiClientInstance.get('/admin/analytics/conversion', { days });
  },

  async getPlanAnalytics() {
    return apiClientInstance.get('/admin/analytics/plans');
  },

  // NEW: User Search API
  async searchUsers(query, page = 1, limit = 20) {
    return apiClientInstance.get('/admin/users/search', { query, page, limit });
  },

  // NEW: Multi-Plan Subscription APIs
  async getUserActivePlans(userId) {
    return apiClientInstance.get(`/admin/users/${userId}/plans`);
  },

  async assignMultiplePlans(userId, planNames) {
    return apiClientInstance.put(`/admin/users/${userId}/plans`, { plan_names: planNames });
  },

  // Enhanced existing admin APIs
  async deleteUser(userId) {
    return apiClientInstance.delete(`/admin/users/${userId}`);
  },

  async updateUserSubscription(userId, subscriptionData) {
    return apiClientInstance.put(`/admin/users/${userId}/subscription`, subscriptionData);
  },

  async getAdminStats() {
    return apiClientInstance.get('/admin/stats');
  },

  async getAdminFavorites(page = 1, limit = 20) {
    return apiClientInstance.get('/admin/favorites', { page, limit });
  },

  async getAdminSystem() {
    return apiClientInstance.get('/admin/system');
  },

  // Settings and preferences
  async getUserSettings() {
    return apiClientInstance.get('/settings');
  },

  async updateUserSettings(settings) {
    return apiClientInstance.put('/settings', settings);
  },

  // Session management
  async getActiveSessions() {
    return apiClientInstance.get('/sessions');
  },

  async terminateSession(sessionId) {
    return apiClientInstance.delete(`/sessions/${sessionId}`);
  },

  async terminateAllSessions() {
    return apiClientInstance.delete('/sessions/all');
  },

  // File uploads (if needed)
  async uploadFile(file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);

    return apiClientInstance.makeRequest('/upload', {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type, let browser set it for FormData
      },
      onUploadProgress: onProgress,
    });
  },
};

// Enhanced error handling utilities
export const handleAPIError = (error) => {
  if (error instanceof APIError) {
    switch (error.code) {
      case 'RATE_LIMIT_EXCEEDED':
        return {
          title: 'Rate Limit Exceeded',
          message: 'You have made too many requests. Please try again later.',
          type: 'warning',
        };
      
      case 'PREMIUM_REQUIRED':
        return {
          title: 'Premium Feature',
          message: 'This feature requires a premium subscription.',
          type: 'info',
          action: 'upgrade',
        };
      
      case 'VALIDATION_ERROR':
        return {
          title: 'Validation Error',
          message: error.details?.map(d => d.msg).join(', ') || error.message,
          type: 'error',
        };
      
      case 'AUTH_FAILED':
        return {
          title: 'Authentication Failed',
          message: 'Please log in again.',
          type: 'error',
          action: 'login',
        };
      
        default:
        return {
          title: 'Error',
          message: error.message,
          type: 'error',
        };
    }
  }

  return {
    title: 'Unexpected Error',
    message: 'An unexpected error occurred. Please try again.',
    type: 'error',
  };
};

// Rate limit monitoring
export const getRateLimitInfo = () => {
  // This would be populated by response headers
  return {
    limit: parseInt(localStorage.getItem('rate_limit') || '100'),
    remaining: parseInt(localStorage.getItem('rate_remaining') || '100'),
    resetTime: new Date(localStorage.getItem('rate_reset') || Date.now()),
  };
};

// Connection status monitoring
export const connectionStatus = {
  isOnline: navigator.onLine,
  lastConnected: new Date(),
  
  startMonitoring() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.lastConnected = new Date();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  },
};

// Initialize connection monitoring
connectionStatus.startMonitoring();

// Export secure API client and token manager for external use
export { tokenManager, apiClientInstance as apiClient, axiosClient, enhancedTokenManager };

// Default export
export default api;

// API fonksiyonları
export const apiService = {
  // Token alma fonksiyonu
  getToken() {
    return localStorage.getItem('token');
  },

  // Genel GET isteği
  async get(url) {
    const response = await apiClientInstance.get(url);
    return response;
  },

  // Genel POST isteği
  async post(url, data = {}) {
    const response = await apiClientInstance.post(url, data);
    return response;
  },

  // Genel PUT isteği
  async put(url, data = {}) {
    const response = await apiClientInstance.put(url, data);
    return response;
  },

  // Genel DELETE isteği  
  async delete(url) {
    const response = await apiClientInstance.delete(url);
    return response;
  },

  // Mevcut seçenekleri al
  async getOptions() {
    const response = await apiClientInstance.get('/options');
    return response;
  },

  // Test endpoint'i (sadece development)
  async testEndpoint() {
    const response = await apiClientInstance.get('/test');
    return response;
  },

  // Kullanıcı girişi
  async login(credentials) {
    const response = await apiClientInstance.post('/auth/login', credentials);
    return response;
  },

  // Kullanıcı profili
  async getProfile() {
    const response = await apiClientInstance.get('/profile');
    return response;
  },

  // Favori isim ekle
  async addFavorite(favoriteData) {
    const response = await apiClientInstance.post('/favorites', favoriteData);
    return response;
  },

  // Favori isimleri getir
  async getFavorites(page = 1, limit = 20) {
    const response = await apiClientInstance.get('/favorites', { page, limit });
    return response;
  },

  // Favori ismi sil
  async deleteFavorite(favoriteId) {
    const response = await apiClientInstance.delete(`/favorites/${favoriteId}`);
    return response;
  },

  // Favori ismi güncelle
  async updateFavorite(favoriteId, favoriteData) {
    const response = await apiClientInstance.patch(`/favorites/${favoriteId}`, favoriteData);
    return response;
  },

  // İsim üretimi
  async generateNames(requestData) {
    console.log('🚀 API: generateNames called');
    console.log('📝 Request data:', requestData);
    
    const response = await apiClientInstance.post('/generate', requestData);
    console.log('✅ API: generateNames response:', response);
    return response;
  },

  // İsim analizi
  async analyzeName(name, language = 'turkish') {
    console.log('🚀 API: analyzeName called');
    console.log('📝 Request data:', { name, language });
    console.log('📊 Name type:', typeof name);
    console.log('📊 Name value:', JSON.stringify(name));
    
    const response = await apiClientInstance.post('/analyze_name', { name, language });
    console.log('✅ API: analyzeName response:', response);
    return response;
  },
};

// Hata sınıfları
export class NetworkError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NetworkError';
  }
}

// Kullanıcı dostu hata mesajları
export const formatError = (error) => {
  // Önce kullanıcı mesajını kontrol et
  if (error.userMessage) {
    return error.userMessage;
  }
  
  // Hata mesajını al (API response veya error message)
  let errorMessage = '';
  if (error.response?.data?.error) {
    errorMessage = error.response.data.error;
  } else if (error.response?.data?.message) {
    errorMessage = error.response.data.message;
  } else if (error.message) {
    errorMessage = error.message;
  }
  
  // Özel hata türleri için kullanıcı dostu mesajlar
  if (errorMessage.includes('Daily limit reached') || errorMessage.includes('5/5 name generations')) {
    return `🚀 Günlük İsim Limitiniz Doldu! 

📊 Bugün 5 isim ürettiniz (Ücretsiz Plan)
⏰ Yarın tekrar 5 isim üretebilirsiniz
✨ Sınırsız isim için Premium'a geçin!

💡 Ne yapabilirsiniz:
• Favorilerinizi kontrol edin
• Mevcut isimleri analiz edin  
• Premium'a geçin (Sadece ₺7.99/ay)`;
  }
  
  if (errorMessage.includes('Premium required') || errorMessage.includes('premium üyelik')) {
    return `👑 Bu Özellik Premium Üyeler İçin!

🎯 Premium avantajları:
• Sınırsız isim üretimi
• Özel isim önerileri
• Detaylı analiz raporları
• Öncelikli destek

💸 Sadece $7.99/ay - İlk 7 gün ücretsiz!`;
  }
  
  if (errorMessage.includes('Network') || errorMessage.includes('connection')) {
    return `🌐 İnternet Bağlantı Sorunu!

🔧 Lütfen şunları kontrol edin:
• İnternet bağlantınız aktif mi?
• Sayfayı yenilemeyi deneyin
• Birkaç saniye sonra tekrar deneyin

📞 Sorun devam ederse destek@babyai.com'a yazın`;
  }
  
  if (errorMessage.includes('401') || errorMessage.includes('Authentication')) {
    return `🔐 Oturum Süreniz Dolmuş!

🔄 Lütfen tekrar giriş yapın:
• Güvenliğiniz için oturumunuz sonlandı
• Kullanıcı adı ve şifrenizle giriş yapın
• Beni hatırla seçeneğini işaretleyin`;
  }
  
  if (errorMessage.includes('500') || errorMessage.includes('server error')) {
    return `⚙️ Sunucu Hatası!

🛠️ Sistemimizde geçici bir sorun var:
• Birkaç dakika sonra tekrar deneyin
• Sorun bizde, sizde değil
• Teknik ekibimiz durumdan haberdar

⏰ Genellikle 2-3 dakikada düzelir`;
  }
  
  if (errorMessage.includes('Too many requests')) {
    return `⚡ Çok Hızlı İstek Gönderiyorsunuz!

⏱️ Lütfen biraz bekleyin:
• 1-2 dakika sonra tekrar deneyin
• Bu koruma mekanizması sistemi güvende tutar
• Premium üyeler daha yüksek limite sahiptir`;
  }
  
  // Genel hata durumu
  if (errorMessage) {
    return `❌ Bir Sorun Oluştu!

🔍 Hata detayı: ${errorMessage}

💡 Çözüm önerileri:
• Sayfayı yenileyin
• Birkaç saniye bekleyip tekrar deneyin
• Tarayıcı önbelleğini temizleyin

📧 Destek: help@babyai.com`;
  }
  
  return `🤔 Beklenmeyen Bir Durum!

🔄 Deneyebilecekleriniz:
• Sayfayı yenileyin (F5)
• Tarayıcınızı yeniden başlatın
• Farklı tarayıcı deneyin

📞 Bu mesajı görüyorsanız: support@babyai.com`;
};

export const getTrends = async () => {
  try {
    const response = await apiClientInstance.get('/api/trends');
    return response;
  } catch (error) {
    console.error('Trends API error:', error);
    throw error;
  }
};

export const getGlobalTrends = async () => {
  try {
    const response = await apiClientInstance.get('/api/trends/global');
    return response;
  } catch (error) {
    console.error('Global trends API error:', error);
    throw error;
  }
};

export const getPremiumNames = async (requestData) => {
  try {
    const response = await apiClientInstance.post('/api/names/premium', requestData);
    return response;
  } catch (error) {
    console.error('Premium names API error:', error);
    throw error;
  }
};

export const getSubscriptionPlans = async () => {
  try {
    const response = await apiClientInstance.get('/api/subscription/plans');
    return response;
  } catch (error) {
    console.error('Subscription plans API error:', error);
    throw error;
  }
};

export const getSubscriptionStatus = async () => {
  try {
    const response = await apiClientInstance.get('/api/subscription/status');
    return response;
  } catch (error) {
    console.error('Subscription status API error:', error);
    throw error;
  }
};

export const upgradeSubscription = async (planType, paymentMethod = 'credit_card') => {
  try {
    const response = await apiClientInstance.post('/api/subscription/upgrade', {
      plan_type: planType,
      payment_method: paymentMethod
    });
    return response;
  } catch (error) {
    console.error('Subscription upgrade API error:', error);
    throw error;
  }
};

export const getSubscriptionHistory = async () => {
  try {
    const response = await apiClientInstance.get('/api/subscription/history');
    return response;
  } catch (error) {
    console.error('Subscription history API error:', error);
    throw error;
  }
};

export const getNamesByTheme = async (theme, gender, count) => {
  try {
    const response = await apiClientInstance.post('/names/theme', {
      theme,
      gender,
      count
    });
    return response;
  } catch (error) {
    console.error('Theme names error:', error);
    return { success: false, error: 'Tema bazlı isimler alınamadı' };
  }
}; 

// Enhanced toast notification for auth events (401 errors, plan upgrades)
const show401Toast = (message = 'Session expired. Please login again.', type = 'error') => {
  if (window.showToast) {
    window.showToast({
      message,
      type: type,
      duration: type === 'info' ? 8000 : 5000 // Longer duration for info messages
    });
  } else {
    // Fallback notification
    console.warn(`🚨 AUTH ${type.toUpperCase()}:`, message);
    alert(message);
  }
};

// Export notification function
export { show401Toast }; 