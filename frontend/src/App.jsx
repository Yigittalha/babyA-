import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Baby, Heart, User, LogOut, Settings, Crown } from 'lucide-react';
import NameForm from './components/NameForm';
import NameResults from './components/NameResults';
import NameAnalysis from './components/NameAnalysis';
import ErrorDisplay from './components/ErrorDisplay';
import AuthModal from './components/AuthModal';
import FavoritesPanel from './components/FavoritesPanel';
import UserProfile from './components/UserProfile';
import Toast from './components/Toast';
import TrendAnalysis from './components/TrendAnalysis';
import PremiumUpgrade from './components/PremiumUpgrade';
import AdminPanel from './components/AdminPanel';
import AdminLogin from './components/AdminLogin';
import { apiService, formatError, api, apiClient, axiosClient } from './services/api';
import './index.css';
import authStateManager, { onAuthStateChanged, signInWithEmailAndPassword, signOut, getCurrentUser } from './services/authStateManager';
// Enhanced secure authentication system
import secureAuthManager from './services/secureAuthManager.js';
import { setupSessionMaintenance } from './utils/sessionCleanup.js';

// Ana uygulama component'i
function MainApp() {
  const [options, setOptions] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [user, setUser] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [currentPage, setCurrentPage] = useState('generate'); // 'generate', 'results', 'trends'
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisName, setAnalysisName] = useState('');
  const [nameResults, setNameResults] = useState([]);
  const [toast, setToast] = useState(null);
  const [showPremiumUpgrade, setShowPremiumUpgrade] = useState(false);
  const [isPremiumRequired, setIsPremiumRequired] = useState(false);
  const [premiumMessage, setPremiumMessage] = useState('');
  const [blurredNames, setBlurredNames] = useState([]);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Mobile menü için click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMobileMenu && !event.target.closest('.mobile-menu-container')) {
        setShowMobileMenu(false);
      }
    };

    const handleResize = () => {
      if (window.innerWidth >= 768) { // md breakpoint
        setShowMobileMenu(false);
      }
    };

    if (showMobileMenu) {
      document.addEventListener('click', handleClickOutside);
      window.addEventListener('resize', handleResize);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
      window.removeEventListener('resize', handleResize);
    };
  }, [showMobileMenu]);

  // Uygulama başlangıcında seçenekleri yükle ve monitoring sistemlerini başlat
  useEffect(() => {
    console.log('🚀 App starting up with enhanced security...');
    
    loadOptions();
    
    // Setup enhanced session maintenance
    setupSessionMaintenance();
    
    // Make secure auth manager globally available for error handling
    window.secureAuthManager = secureAuthManager;
    
    // Initialize subscription monitoring
    api.initSubscriptionMonitoring();
    
    // Cleanup on unmount
    return () => {
      api.stopSubscriptionMonitoring();
    };
  }, []);

  // Toast fonksiyonunu useEffect'ten önce tanımla
  const showToast = useCallback(({ message, type = 'info', duration = 5000 }) => {
    const id = Date.now();
    const newToast = { id, message, type, duration };
    
    setToasts(prev => [...prev, newToast]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, duration);
  }, []);

  // loadFavorites fonksiyonunu useEffect'ten önce tanımla - httpOnly cookies ile
  const loadFavorites = useCallback(async (userId = null) => {
    // userId parametresi varsa kullan, yoksa current user'ı kontrol et
    if (!userId && (!user || !user.id)) {
      console.log('🔐 App: loadFavorites - No valid user, skipping');
      return;
    }
    
    setFavoritesLoading(true);
    try {
      // Secure API client kullan - httpOnly cookies desteği ile
      const response = await axiosClient.get('/auth/favorites');
      setFavorites(response.favorites || response || []);
      console.log('✅ Favoriler başarıyla yüklendi');
    } catch (error) {
      // Handle auth errors gracefully
      if (error.status === 401) {
        console.log('🔐 App: loadFavorites - Authentication required türkçe');
        setFavorites([]);
        return;
      }
      console.error('Favoriler yüklenemedi:', error);
    } finally {
      setFavoritesLoading(false);
    }
  }, [user]); // Sadece user değiştiğinde dependency

  // Enhanced authentication state monitoring with secure auth manager
  useEffect(() => {
    console.log('🔐 Setting up enhanced authentication monitoring...');
    
    // Make showToast globally available for API error handling
    window.showToast = showToast;
    
    // Primary: Secure Auth Manager (localStorage + Authorization headers)
    const secureUnsubscribe = secureAuthManager.onAuthStateChanged((currentUser, previousUser, eventType) => {
      console.log('🔄 Secure auth state changed:', {
        current: currentUser?.email || 'None',
        previous: previousUser?.email || 'None',
        event: eventType
      });
      
      if (currentUser) {
        // User is signed in with enhanced security
        console.log('✅ User authenticated securely:', currentUser.email);
        setUser(currentUser);
        
        // Load user's favorites after a short delay to ensure authentication is complete
        setTimeout(() => {
          loadFavorites(currentUser.id);
        }, 100);
        
      } else {
        // User is signed out
        console.log('📝 User signed out');
        setUser(null);
        setFavorites([]);
        
        // Clear UI state
        setShowProfile(false);
        setShowFavorites(false);
        setShowPremiumUpgrade(false);
        setCurrentPage('generate');
        
        // Handle session expiration events
        if (eventType === 'auth:session_expired') {
          showToast({ 
            message: 'Oturum süresi doldu. Lütfen tekrar giriş yapın.', 
            type: 'warning',
            duration: 8000
          });
        }
      }
    });
    
    // Fallback: Legacy Auth State Manager (for backward compatibility)
    const legacyUnsubscribe = onAuthStateChanged((currentUser, previousUser) => {
      // Only use legacy auth if secure auth is not active
      if (!secureAuthManager.currentUser && currentUser) {
        console.log('🔄 Fallback auth state changed:', currentUser.email);
        setUser(currentUser);
        
        setTimeout(() => {
          loadFavorites(currentUser.id);
        }, 100);
      }
    });

    // Listen for auth events from enhanced token manager
    const handleAuthLogout = (event) => {
      if (event.detail?.reason === 'token_expired') {
        showToast({
          message: 'Your session has expired. Please login again.',
          type: 'error',
          duration: 5000
        });
      }
    };

    window.addEventListener('auth:logout', handleAuthLogout);
    
    // Cleanup subscriptions on unmount
    return () => {
      console.log('🧹 Cleaning up auth state listeners');
      secureUnsubscribe();
      legacyUnsubscribe();
      window.removeEventListener('auth:logout', handleAuthLogout);
    };
  }, [loadFavorites, showToast]); // Dependencies for the effect

  const loadOptions = async () => {
    try {
      setLoading(true);
      setError(null);
      // Secure API client kullan
      const data = await axiosClient.get('/options');
      setOptions(data);
    } catch (err) {
      console.error('Options loading error:', err);
      setError({
        message: 'Seçenekler yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.',
        originalError: err
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateNames = async (formData) => {
    // Kullanıcı giriş yapmamışsa önce giriş yapmasını iste
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResults([]);
      setIsPremiumRequired(false);
      setPremiumMessage('');
      
      console.log('Generating names with data:', formData);
      
      // Form verisini backend'in beklediği formata dönüştür
      const backendRequest = {
        gender: formData.gender,
        language: formData.origin, // origin -> language
        theme: formData.theme,
        extra: `İsim sayısı: ${formData.count}` // count'u extra'ya ekle
      };
      
      // Secure API client kullan
      const response = await axiosClient.post('/generate', backendRequest);
      
      if (response.success && response.names) {
        setResults(response.names);
        setHasGenerated(true);
        setCurrentPage('results'); // Sonuçlar sayfasına geç
        
        // Premium kontrolü
        if (response.is_premium_required) {
          setIsPremiumRequired(true);
          setPremiumMessage(response.premium_message || 'Daha fazla isim önerisi için Premium üye olun!');
          setBlurredNames(response.blurred_names || []);
        } else {
          setIsPremiumRequired(false);
          setPremiumMessage('');
          setBlurredNames([]);
        }
        
        // Başarılı sonuç için scroll
        setTimeout(() => {
          window.scrollTo({
            top: 0,
            behavior: 'smooth'
          });
        }, 100);
      } else {
        throw new Error(response.message || 'İsim üretilemedi');
      }
    } catch (err) {
      console.error('Name generation error:', err);
      setError({
        message: formatError(err),
        originalError: err
      });
      
      // Error gösterildikten sonra scroll yap
      setTimeout(() => {
        const errorElement = document.querySelector('[data-error-display]');
        if (errorElement) {
          errorElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }
      }, 100);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToFavorites = async (nameData) => {
    if (!user || !user.id) {
      console.log('🔐 App: handleAddToFavorites - No valid user');
      setShowAuthModal(true);
      return;
    }

    try {
      // Secure API client kullan
      await axiosClient.post('/auth/favorites', nameData);
      await loadFavorites(); // Favorileri yenile
      showToast({ message: `"${nameData.name}" favorilere eklendi! ❤️`, type: 'favorite' });
    } catch (error) {
      // Handle auth errors gracefully
      if (error.status === 401) {
        console.log('🔐 App: handleAddToFavorites - Authentication required türkçe');
        setShowAuthModal(true);
        return;
      }
      console.error('Favori eklenirken hata oluştu:', error);
      showToast({ message: 'Favori eklenirken hata oluştu', type: 'error' });
    }
  };

  const handleRemoveFavorite = async (favoriteId) => {
    if (!user || !user.id) {
      console.log('🔐 App: handleRemoveFavorite - No valid user');
      return;
    }

    try {
      // Secure API client kullan
      await axiosClient.delete(`/auth/favorites/${favoriteId}`);
      await loadFavorites(); // Favorileri yenile
      showToast({ message: 'Favori silindi', type: 'success' });
    } catch (error) {
      // Handle auth errors gracefully
      if (error.status === 401) {
        console.log('🔐 App: handleRemoveFavorite - Authentication required türkçe');
        setShowFavorites(false);
        setShowAuthModal(true);
        return;
      }
      console.error('Favori silinirken hata oluştu:', error);
      showToast({ message: 'Favori silinirken hata oluştu', type: 'error' });
    }
  };

  const handleAuthSuccess = useCallback(async (email, password) => {
    try {
      console.log('🔐 handleAuthSuccess: Processing secure sign in for:', email);
      
      // Try secure authentication first
      try {
        const result = await secureAuthManager.signInWithEmailAndPassword(email, password);
        
        if (result && result.user) {
          console.log('✅ handleAuthSuccess: Secure sign in successful');
          setShowAuthModal(false);
          
          // Show success message
          showToast({ message: 'Güvenli giriş başarılı! 🔐', type: 'success' });
          
          // Auth state will be updated automatically via secure auth manager
          return;
        }
      } catch (secureError) {
        console.warn('🔄 Secure auth failed, trying fallback:', secureError.message);
        
        // Fallback to legacy authentication for backward compatibility
        const result = await signInWithEmailAndPassword(email, password);
        
        if (result.success) {
          console.log('✅ handleAuthSuccess: Fallback sign in successful');
          setShowAuthModal(false);
          
          // Show success message
          showToast({ message: 'Başarıyla giriş yapıldı!', type: 'success' });
          
          return;
        }
        
        throw secureError; // Re-throw the original secure auth error
      }
      
    } catch (error) {
      console.error('❌ handleAuthSuccess: All sign in methods failed:', error);
      throw error; // Re-throw to let AuthModal handle the error
    }
  }, [showToast]);

  const handleLogout = async () => {
    try {
      console.log('🔐 handleLogout: Processing secure sign out...');
      
      // Try secure logout first
      try {
        await secureAuthManager.signOut();
        console.log('✅ handleLogout: Secure sign out completed');
      } catch (secureError) {
        console.warn('🔄 Secure logout failed, trying fallback:', secureError.message);
        
        // Fallback to legacy logout
        await signOut();
        console.log('✅ handleLogout: Fallback sign out completed');
      }
      
      // Clear UI state
      setCurrentPage('generate');
      setShowProfile(false);
      setShowFavorites(false);
      
      // Show logout message
      showToast({ message: 'Güvenli çıkış yapıldı', type: 'success' });
      
      // Auth state will be cleared automatically via auth managers
      
    } catch (error) {
      console.error('❌ handleLogout: All sign out methods failed:', error);
      
      // Force clear local state as last resort
      setUser(null);
      setFavorites([]);
      setCurrentPage('generate');
      setShowProfile(false);
      setShowFavorites(false);
      
      showToast({ message: 'Çıkış yapıldı', type: 'info' });
    }
  };

  const handleShowPremiumUpgrade = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setShowPremiumUpgrade(true);
  };

  const handlePremiumUpgrade = (upgradeResponse) => {
    // Kullanıcı bilgilerini güncelle
    if (user) {
      setUser(prev => ({
        ...prev,
        is_premium: true,
        subscription_type: upgradeResponse.subscription_type
      }));
    }
    
    // Premium mesajını temizle
    setIsPremiumRequired(false);
    setPremiumMessage('');
    
    showToast({ 
      message: `${upgradeResponse.subscription_type === 'premium' ? 'Premium' : 'Pro'} aboneliğiniz başarıyla aktifleştirildi! 🎉`, 
      type: 'success' 
    });
  };

  const handleGoHome = () => {
    setShowProfile(false);
    setShowFavorites(false);
    setError(null);
    setResults([]);
    setHasGenerated(false);
    setCurrentPage('generate'); // Ana sayfaya dön
    
    // Sayfayı yukarı scroll et
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const handleBackToGenerate = () => {
    setCurrentPage('generate');
    setResults([]);
    setHasGenerated(false);
    
    // Sayfayı yukarı scroll et
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const handleError = useCallback((error) => {
    console.error('App error:', error);
    setError(error.message || 'Beklenmeyen bir hata oluştu');
    
    setTimeout(() => {
      setError(null);
    }, 5000);
  }, []);

  const handleAnalyzeName = useCallback(async (name, language = 'turkish') => {
    try {
      setLoading(true);
      // Secure API client kullan
      const response = await axiosClient.post('/analyze_name', { name, language });
      
      if (response.success) {
        setAnalysisName(name);
        setShowAnalysis(true);
        showToast({ message: `"${name}" analizi tamamlandı!`, type: 'success' });
      } else {
        throw new Error(response.message || 'İsim analizi yapılamadı');
      }
    } catch (err) {
      console.error('Name analysis error:', err);
      showToast({ message: formatError(err), type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const headerButtons = useMemo(() => {
    if (!user) {
      return (
        <div className="flex items-center space-x-2">
          {currentPage === 'results' && (
            <div className="relative group">
            <button
              onClick={handleBackToGenerate}
                className="p-2 rounded-lg bg-gray-50 hover:bg-purple-100 text-gray-600 hover:text-purple-600 transition-all duration-200"
                title="Yeni İsim Üret"
            >
                <Baby className="w-5 h-5" />
            </button>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Yeni İsim Üret
              </div>
            </div>
          )}
          <div className="relative group">
          <button
            onClick={() => setShowAuthModal(true)}
              className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 transition-all duration-200"
              title="Giriş Yap"
          >
              <User className="w-5 h-5" />
          </button>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Giriş Yap
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-2">
        {currentPage === 'results' && (
          <div className="relative group">
          <button
            onClick={handleBackToGenerate}
              className="p-2 rounded-lg bg-gray-50 hover:bg-purple-100 text-gray-600 hover:text-purple-600 transition-all duration-200"
              title="Yeni İsim Üret"
          >
              <Baby className="w-5 h-5" />
          </button>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
              Yeni İsim Üret
            </div>
          </div>
        )}
        
        <div className="relative group">
        <button
          onClick={() => setShowFavorites(true)}
            className="p-2 rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-600 hover:text-pink-700 transition-all duration-200"
            title="Favoriler"
        >
            <Heart className="w-5 h-5" />
        </button>
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
            Favoriler
          </div>
        </div>
        
        {user && !user.is_premium && (
          <div className="relative group">
          <button
            onClick={handleShowPremiumUpgrade}
              className="p-2 rounded-lg bg-yellow-50 hover:bg-yellow-100 text-yellow-600 hover:text-yellow-700 transition-all duration-200"
              title="Premium"
          >
              <Crown className="w-5 h-5" />
          </button>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
              Premium
            </div>
          </div>
        )}
        
        <div className="relative group">
        <button
          onClick={() => setShowProfile(true)}
            className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-700 transition-all duration-200"
            title="Profil"
        >
            <Settings className="w-5 h-5" />
        </button>
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
            Profil
          </div>
        </div>
        
        <div className="relative group">
        <button
          onClick={handleLogout}
            className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 transition-all duration-200"
            title="Çıkış"
        >
            <LogOut className="w-5 h-5" />
        </button>
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
            Çıkış
          </div>
        </div>
      </div>
    );
  }, [user, handleLogout, currentPage, handleBackToGenerate, handleShowPremiumUpgrade]);

  const mainContent = useMemo(() => {
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">Baby <span className="text-pink-500">AI</span></h2>
            <p className="text-gray-600">Yükleniyor...</p>
          </div>
        </div>
      );
    }

    // İsim Üretme Sayfası
    if (currentPage === 'generate') {
      return (
        <>
          {/* Hero Section */}
          <div className="hero-section">
            {/* Background Pattern */}
            <div className="hero-baby-pattern"></div>
            
            {/* Decorative Floating Elements */}
            <div className="decorative-shape-1"></div>
            <div className="decorative-shape-2"></div>
            <div className="decorative-circle"></div>
            
            <div className="container mx-auto px-4 relative z-10">
              <div className="max-w-5xl mx-auto text-center">
                <div className="relative mb-8">
                  <h1 className="hero-title text-gradient-hero">
                    ✨ Baby <span className="text-pink-500">AI</span> ile Mükemmel İsmi Keşfedin
              </h1>
                  <div className="absolute -top-6 -right-6 text-6xl opacity-20 animate-bounce-gentle">✨</div>
                  <div className="absolute -bottom-4 -left-8 text-4xl opacity-20 animate-float">🌟</div>
                </div>
                
                <p className="hero-subtitle">
                  Yapay zeka teknolojisi ile kişiselleştirilmiş, anlamlı ve kültürel olarak uygun bebek isimleri üretin. 
                  6 farklı dil ve 10 tema ile sınırsız kombinasyon.
                </p>
                
                {/* Enhanced Stats */}
                <div className="flex flex-wrap justify-center items-center gap-8 mb-12">
                  <div className="text-center bg-white/50 backdrop-blur-sm rounded-2xl p-4 min-w-[120px] border border-white/20">
                    <div className="stats-counter text-3xl font-bold text-purple-600 mb-1">68,930+</div>
                    <div className="text-sm text-gray-600">Üretilen İsim</div>
                  </div>
                  <div className="text-center bg-white/50 backdrop-blur-sm rounded-2xl p-4 min-w-[120px] border border-white/20">
                    <div className="flex items-center justify-center space-x-1 mb-2">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className="text-yellow-400 text-xl animate-pulse" style={{animationDelay: `${i * 0.1}s`}}>★</span>
                      ))}
                    </div>
                    <div className="text-sm text-gray-600">5/5 Değerlendirme</div>
                  </div>
                  <div className="text-center bg-white/50 backdrop-blur-sm rounded-2xl p-4 min-w-[120px] border border-white/20">
                    <div className="stats-counter text-3xl font-bold text-blue-600 mb-1">6</div>
                    <div className="text-sm text-gray-600">Farklı Dil</div>
                  </div>
                </div>

                <div className="relative">
                  {user ? (
                    <button 
                      onClick={() => document.getElementById('name-form').scrollIntoView({ behavior: 'smooth' })}
                      className="group relative bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 text-white px-12 py-6 rounded-2xl font-bold text-xl transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-2xl"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 rounded-2xl blur opacity-70 group-hover:opacity-100 transition-opacity"></div>
                      <div className="relative flex items-center space-x-3">
                        <span className="text-2xl">✨</span>
                        <span>İsim Üretmeye Başla</span>
                        <span className="text-2xl group-hover:animate-spin">🚀</span>
                      </div>
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                    </button>
                  ) : (
                    <button 
                      onClick={() => setShowAuthModal(true)}
                      className="group relative bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 hover:from-green-700 hover:via-emerald-700 hover:to-teal-700 text-white px-12 py-6 rounded-2xl font-bold text-xl transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-2xl"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 rounded-2xl blur opacity-70 group-hover:opacity-100 transition-opacity"></div>
                      <div className="relative flex items-center space-x-3">
                        <span className="text-2xl">🚀</span>
                        <span>Ücretsiz Başla</span>
                        <span className="text-2xl group-hover:animate-bounce">💎</span>
                      </div>
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                    </button>
                  )}
                  <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 text-3xl animate-bounce-gentle">👇</div>
                  
                  {/* Floating particles */}
                  <div className="absolute -top-4 -left-4 w-2 h-2 bg-yellow-400 rounded-full animate-ping"></div>
                  <div className="absolute -top-6 right-8 w-1 h-1 bg-pink-400 rounded-full animate-pulse"></div>
                  <div className="absolute -bottom-2 -right-6 w-3 h-3 bg-purple-400 rounded-full animate-bounce"></div>
                </div>
              </div>
            </div>
          </div>

          {/* How It Works Section */}
          <div className="py-20 bg-white section-with-pattern">
            <div className="floating-element-1"></div>
            <div className="floating-element-2"></div>
            
            <div className="container mx-auto px-4 section-content">
              <div className="max-w-6xl mx-auto">
                <div className="text-center mb-16 relative">
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-8 text-4xl opacity-20">🤖</div>
                  <h2 className="section-title text-gradient">
                    Nasıl Çalışır?
                  </h2>
                  <p className="section-subtitle">
                    3 basit adımda hayalinizdeki bebek ismini bulun
                  </p>
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-4 text-3xl opacity-20">⚡</div>
                </div>

                <div className="grid md:grid-cols-3 gap-8 relative">
                  {/* Connection Lines */}
                  <div className="hidden md:block absolute top-1/2 left-1/3 w-1/3 h-0.5 bg-gradient-to-r from-purple-300 to-blue-300 transform -translate-y-1/2 z-0"></div>
                  <div className="hidden md:block absolute top-1/2 right-1/3 w-1/3 h-0.5 bg-gradient-to-r from-blue-300 to-purple-300 transform -translate-y-1/2 z-0"></div>
                  
                  <div className="step-card text-center relative z-10">
                    <div className="absolute -top-4 -right-4 text-2xl opacity-30 animate-pulse">📝</div>
                    <div className="step-indicator mx-auto mb-6">1</div>
                    <h3 className="text-xl font-bold text-gray-800 mb-4">Tercihlerinizi Seçin</h3>
                    <p className="text-gray-600">
                      Bebeğinizin cinsiyeti, dil tercihi ve istediğiniz temayı belirleyin. 
                      10 farklı tema arasından seçim yapın.
                    </p>
                  </div>

                  <div className="step-card text-center relative z-10">
                    <div className="absolute -top-4 -right-4 text-2xl opacity-30 animate-pulse" style={{animationDelay: '0.5s'}}>🧠</div>
                    <div className="step-indicator mx-auto mb-6">2</div>
                    <h3 className="text-xl font-bold text-gray-800 mb-4">AI Analizi</h3>
                    <p className="text-gray-600">
                      Yapay zeka teknolojimiz tercihlerinizi analiz eder ve 
                      kültürel uygunluk kontrolü yapar.
                    </p>
                  </div>

                  <div className="step-card text-center relative z-10">
                    <div className="absolute -top-4 -right-4 text-2xl opacity-30 animate-pulse" style={{animationDelay: '1s'}}>📋</div>
                    <div className="step-indicator mx-auto mb-6">3</div>
                    <h3 className="text-xl font-bold text-gray-800 mb-4">Sonuçları Alın</h3>
                    <p className="text-gray-600">
                      Anlam, köken ve popülerlik bilgileriyle birlikte 
                      özel olarak seçilmiş isim önerilerini görün.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features Section */}
          <div className="py-20 bg-gradient-to-br from-purple-50 to-blue-50 relative overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute top-10 left-10 w-32 h-32 bg-gradient-to-r from-purple-200/30 to-blue-200/30 rounded-full blur-xl"></div>
            <div className="absolute bottom-20 right-20 w-40 h-40 bg-gradient-to-r from-pink-200/30 to-purple-200/30 rounded-full blur-xl"></div>
            <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-gradient-to-r from-blue-200/20 to-indigo-200/20 rounded-full blur-lg"></div>
            
            {/* Floating SVG Elements */}
            <div className="absolute top-20 right-1/4 opacity-10">
              <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                <path d="M30 0L37 23L60 30L37 37L30 60L23 37L0 30L23 23L30 0Z" fill="currentColor" className="text-purple-400"/>
              </svg>
            </div>
            
            <div className="absolute bottom-32 left-1/3 opacity-10 animate-float">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="20" fill="currentColor" className="text-blue-400"/>
                <circle cx="20" cy="20" r="10" fill="white"/>
              </svg>
            </div>

            <div className="container mx-auto px-4 relative z-10">
              <div className="max-w-6xl mx-auto">
                <div className="text-center mb-16 relative">
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-5xl opacity-20 animate-bounce-gentle">⭐</div>
                  <h2 className="section-title text-gradient">
                    Neden Bizleri Seçmelisiniz?
                  </h2>
                  <p className="section-subtitle">
                    Gelişmiş yapay zeka teknolojisi ile üstün hizmet
                  </p>
                  <div className="absolute -bottom-4 right-1/4 text-3xl opacity-20 animate-pulse">💎</div>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                  <div className="feature-card group">
                    <div className="absolute top-4 right-4 text-lg opacity-30 group-hover:opacity-50 transition-opacity">🚀</div>
                    <div className="feature-icon">🌍</div>
                    <h3 className="text-xl font-bold text-gray-800 mb-4">6 Farklı Dil</h3>
                    <p className="text-gray-600">
                      Türkçe, İngilizce, Arapça, Farsça, Kürtçe ve Azerbaycan dili ile 
                      çok kültürlü isim seçenekleri.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full">🇹🇷 TR</span>
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">🇬🇧 EN</span>
                      <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full">🇸🇦 AR</span>
                    </div>
                  </div>

                  <div className="feature-card group">
                    <div className="absolute top-4 right-4 text-lg opacity-30 group-hover:opacity-50 transition-opacity">✨</div>
                    <div className="feature-icon">🎭</div>
                    <h3 className="text-xl font-bold text-gray-800 mb-4">10 Tema</h3>
                    <p className="text-gray-600">
                      Doğa, dini, tarihi, modern ve daha birçok temada 
                      her zevke uygun isim kategorileri.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full">🌿 Doğa</span>
                      <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full">👑 Asil</span>
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">✨ Modern</span>
                    </div>
                  </div>

                  <div className="feature-card group">
                    <div className="absolute top-4 right-4 text-lg opacity-30 group-hover:opacity-50 transition-opacity">🔍</div>
                    <div className="feature-icon">📖</div>
                    <h3 className="text-xl font-bold text-gray-800 mb-4">Detaylı Bilgi</h3>
                    <p className="text-gray-600">
                      Her isim için anlam, köken, popülerlik ve 
                      kültürel arka plan bilgileri.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full">📚 Anlam</span>
                      <span className="text-xs bg-pink-100 text-pink-600 px-2 py-1 rounded-full">🏛️ Köken</span>
                      <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded-full">📊 Pop.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Section */}
          <div className="py-20 bg-gradient-to-b from-white to-purple-50 relative overflow-hidden" id="name-form">
            {/* Background Decorative Elements */}
            <div className="absolute top-1/4 left-5 w-20 h-20 bg-gradient-to-r from-purple-300/20 to-pink-300/20 rounded-full blur-lg animate-float"></div>
            <div className="absolute bottom-1/3 right-8 w-16 h-16 bg-gradient-to-r from-blue-300/20 to-indigo-300/20 rounded-full blur-lg animate-bounce-gentle"></div>
            
            {/* Baby Icons Pattern */}
            <div className="absolute top-10 right-1/4 text-6xl opacity-5 animate-float">👶</div>
            <div className="absolute bottom-20 left-1/3 text-4xl opacity-5 animate-pulse">✨</div>
            <div className="absolute top-1/3 left-10 text-3xl opacity-5 animate-bounce-gentle">🌟</div>

            <div className="container mx-auto px-4 relative z-10">
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12 relative">
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-5xl opacity-30 animate-pulse">✨</div>
                  <div className="absolute -top-6 left-1/4 text-3xl opacity-20 animate-bounce">🎯</div>
                  <div className="absolute -top-4 right-1/4 text-2xl opacity-25 animate-float">⭐</div>
                  
                  <h2 className="text-5xl md:text-6xl font-bold mb-6">
                    <span className="bg-gradient-to-r from-purple-600 via-pink-500 to-blue-600 bg-clip-text text-transparent">
                      🚀 İsim Üret
                    </span>
                    <br />
                    <span className="bg-gradient-to-r from-blue-600 via-purple-500 to-pink-600 bg-clip-text text-transparent text-4xl md:text-5xl">
                      Hayalindeki İsmi Bul
                    </span>
                  </h2>
                  
                  <div className="max-w-3xl mx-auto mb-8">
                    <p className="text-xl text-gray-600 mb-4">
                      🎯 Tercihlerinizi belirleyin, yapay zeka size özel isimler üretsin
                    </p>
                    <div className="flex flex-wrap justify-center gap-6 text-sm">
                      <div className="flex items-center space-x-2 bg-purple-50 px-4 py-2 rounded-full">
                        <span className="text-purple-500">🎭</span>
                        <span className="text-purple-700 font-medium">10 Tema</span>
                      </div>
                      <div className="flex items-center space-x-2 bg-blue-50 px-4 py-2 rounded-full">
                        <span className="text-blue-500">🌍</span>
                        <span className="text-blue-700 font-medium">6 Dil</span>
                      </div>
                      <div className="flex items-center space-x-2 bg-pink-50 px-4 py-2 rounded-full">
                        <span className="text-pink-500">⚡</span>
                        <span className="text-pink-700 font-medium">AI Destekli</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="absolute -bottom-6 right-1/3 text-3xl opacity-20 animate-bounce-gentle">🚀</div>
                  <div className="absolute -bottom-4 left-1/3 text-2xl opacity-25 animate-pulse">💎</div>
                </div>

                {/* Trust Indicators */}
                <div className="flex justify-center items-center space-x-6 mb-8 text-sm text-gray-500">
                  <div className="flex items-center space-x-2">
                    <span className="text-green-500">🔒</span>
                    <span>Güvenli</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-blue-500">⚡</span>
                    <span>Hızlı</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-purple-500">🎯</span>
                    <span>Kişiselleştirilmiş</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-orange-500">💎</span>
                    <span>Premium Kalite</span>
                  </div>
            </div>

            <NameForm 
              options={options}
              onGenerateNames={handleGenerateNames}
              loading={loading}
              user={user}
              onShowToast={showToast}
              onError={handleError}
              onAnalyzeName={handleAnalyzeName}
            />
          </div>
        </div>
          </div>
        </>
      );
    }

    // Sonuçlar Sayfası
    if (currentPage === 'results' && results.length > 0) {
      return (
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <NameResults
              results={results}
              onGenerateNew={handleBackToGenerate}
              loading={loading}
              onAddToFavorites={handleAddToFavorites}
              onAnalyzeName={handleAnalyzeName}
              user={user}
              onShowToast={showToast}
              isPremiumRequired={isPremiumRequired}
              premiumMessage={premiumMessage}
              onShowPremiumUpgrade={handleShowPremiumUpgrade}
              blurredNames={blurredNames}
            />
          </div>
        </div>
      );
    }

    // Trend Analizi Sayfası
    if (currentPage === 'trends') {
      return (
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-800 via-purple-700 to-blue-600 bg-clip-text text-transparent mb-4 mobile-text-3xl">
                📊 Baby<span className="text-pink-500">AI</span> Trend Analizi
              </h1>
              <p className="text-xl text-gray-600 mobile-text-lg">
                Yapay zeka destekli, kültürel ve dilsel çeşitlilikle bebek isimleri
              </p>
            </div>

            <TrendAnalysis
              onShowToast={showToast}
            />
          </div>
        </div>
      );
    }

    // Varsayılan olarak generate sayfasını göster
    return mainContent;
  }, [loading, showToast, handleError, handleAnalyzeName, options, results, user, currentPage, handleBackToGenerate, handleAddToFavorites, isPremiumRequired, premiumMessage, handleShowPremiumUpgrade, blurredNames]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Baby <span className="text-pink-500">AI</span></h2>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left Side - Tatlı Bebek Logosu */}
            <div 
              onClick={handleGoHome}
              className="flex items-center space-x-3 cursor-pointer group transition-all duration-300"
            >
              <div className="relative group">
                {/* Tatlı Bebek SVG Logosu */}
                <svg 
                  className="w-12 h-12 text-gray-700 hover:text-purple-600 transition-colors duration-300 cursor-pointer group-hover:scale-110" 
                  viewBox="0 0 60 60" 
                  fill="none"
                >
                  {/* Decorative stars around baby */}
                  <circle cx="15" cy="15" r="1" fill="currentColor" className="opacity-40 animate-pulse"/>
                  <circle cx="45" cy="15" r="1" fill="currentColor" className="opacity-40 animate-pulse" style={{animationDelay: '0.5s'}}/>
                  <circle cx="12" cy="35" r="0.8" fill="currentColor" className="opacity-30 animate-pulse" style={{animationDelay: '1s'}}/>
                  <circle cx="48" cy="35" r="0.8" fill="currentColor" className="opacity-30 animate-pulse" style={{animationDelay: '1.5s'}}/>
                  
                  {/* Baby face circle */}
                  <circle cx="30" cy="30" r="12" stroke="currentColor" strokeWidth="2" fill="none" className="group-hover:stroke-pink-500 transition-colors"/>
                  
                  {/* Hair/curl on top */}
                  <path d="M25 20 Q23 18 25 16 Q27 18 25 20" stroke="currentColor" strokeWidth="1.5" fill="none" className="group-hover:stroke-purple-500 transition-colors"/>
                  
                  {/* Eyes */}
                  <circle cx="26" cy="27" r="1.5" fill="currentColor" className="group-hover:fill-blue-500 transition-colors"/>
                  <circle cx="34" cy="27" r="1.5" fill="currentColor" className="group-hover:fill-blue-500 transition-colors"/>
                  
                  {/* Rosy cheeks */}
                  <ellipse cx="22" cy="31" rx="2" ry="1.5" fill="#ff6b9d" opacity="0.6" className="group-hover:opacity-80 transition-opacity"/>
                  <ellipse cx="38" cy="31" rx="2" ry="1.5" fill="#ff6b9d" opacity="0.6" className="group-hover:opacity-80 transition-opacity"/>
                  
                  {/* Smile */}
                  <path d="M26 33 Q30 36 34 33" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" className="group-hover:stroke-pink-500 transition-colors"/>
                  
                  {/* Small decorative elements */}
                  <circle cx="18" cy="22" r="0.5" fill="currentColor" className="opacity-30 animate-bounce"/>
                  <circle cx="42" cy="38" r="0.5" fill="currentColor" className="opacity-30 animate-bounce" style={{animationDelay: '0.5s'}}/>
                </svg>
                
                {/* Yıldız efekti */}
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full animate-pulse flex items-center justify-center">
                  <span className="text-xs">✨</span>
                </div>
              </div>
              
              {/* Brand Typography */}
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-800 via-purple-700 to-blue-600 bg-clip-text text-transparent leading-tight">
                  Baby <span className="text-pink-500">AI</span>
                </h1>
                <p className="text-xs text-gray-500 font-medium -mt-1">
                  Baby name creator
                </p>
              </div>
            </div>
            
            {/* Center - Ana Navigasyon Menüsü */}
            <nav className="hidden md:flex items-center space-x-8">
              <button
                onClick={() => setCurrentPage('generate')}
                className={`px-5 py-2 rounded-lg text-base font-semibold transition-all duration-200 ${
                  currentPage === 'generate' 
                    ? 'bg-purple-100 text-purple-700 shadow-sm' 
                    : 'text-gray-700 hover:text-purple-600 hover:bg-purple-50'
                }`}
              >
                Ana Sayfa
              </button>
              
              <button
                onClick={() => setCurrentPage('trends')}
                className={`px-5 py-2 rounded-lg text-base font-semibold transition-all duration-200 ${
                  currentPage === 'trends' 
                    ? 'bg-purple-100 text-purple-700 shadow-sm' 
                    : 'text-gray-700 hover:text-purple-600 hover:bg-purple-50'
                }`}
              >
                Trendler
              </button>

              <button
                onClick={() => setShowHowItWorks(true)}
                className="px-5 py-2 rounded-lg text-base font-semibold text-gray-700 hover:text-purple-600 hover:bg-purple-50 transition-all duration-200"
              >
                Nasıl Çalışır?
              </button>
            </nav>
            
            {/* Right Side - User Actions & Mobile Menu */}
            <div className="flex items-center space-x-3">
              {/* Desktop User Actions */}
              <div className="hidden md:flex items-center">
                {headerButtons}
              </div>
              
              {/* Mobile Menu */}
              <div className="md:hidden relative mobile-menu-container">
                <button
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className="p-2 rounded-lg text-gray-600 hover:text-purple-600 hover:bg-purple-50 transition-all duration-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                
                {/* Mobile Dropdown Menu */}
                {showMobileMenu && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50"
                       style={{ animation: 'fadeIn 0.2s ease-out' }}>
                    <button
                      onClick={() => {
                        setCurrentPage('generate');
                        setShowMobileMenu(false);
                      }}
                      className={`w-full px-4 py-3 text-left text-sm font-medium transition-all duration-200 ${
                        currentPage === 'generate' 
                          ? 'bg-purple-50 text-purple-700 border-r-2 border-purple-500' 
                          : 'text-gray-600 hover:bg-purple-50 hover:text-purple-600'
                      }`}
                    >
                      Ana Sayfa
                    </button>
                    
                    <button
                      onClick={() => {
                        setCurrentPage('trends');
                        setShowMobileMenu(false);
                      }}
                      className={`w-full px-4 py-3 text-left text-sm font-medium transition-all duration-200 ${
                        currentPage === 'trends' 
                          ? 'bg-purple-50 text-purple-700 border-r-2 border-purple-500' 
                          : 'text-gray-600 hover:bg-purple-50 hover:text-purple-600'
                      }`}
                    >
                      Trendler
                    </button>
                    
                    <button
                      onClick={() => {
                        setShowHowItWorks(true);
                        setShowMobileMenu(false);
                      }}
                      className="w-full px-4 py-3 text-left text-sm font-medium text-gray-600 hover:bg-purple-50 hover:text-purple-600 transition-all duration-200"
                    >
                      Nasıl Çalışır?
                    </button>
                    
                    <div className="border-t border-gray-100 my-2"></div>
                    
                    {/* Mobile Header Buttons */}
                    <div className="px-2">
                      {user ? (
                        <>
                          {currentPage === 'results' && (
                            <button
                              onClick={() => {
                                handleBackToGenerate();
                                setShowMobileMenu(false);
                              }}
                              className="w-full mb-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                            >
                              Yeni İsim Üret
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setShowFavorites(true);
                              setShowMobileMenu(false);
                            }}
                            className="w-full mb-2 bg-gradient-to-r from-pink-500 to-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                          >
                            Favoriler
                          </button>
                          {!user.is_premium && (
                            <button
                              onClick={() => {
                                handleShowPremiumUpgrade();
                                setShowMobileMenu(false);
                              }}
                              className="w-full mb-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                            >
                              Premium
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setShowProfile(true);
                              setShowMobileMenu(false);
                            }}
                            className="w-full mb-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                          >
                            Profil
                          </button>
                          <button
                            onClick={() => {
                              handleLogout();
                              setShowMobileMenu(false);
                            }}
                            className="w-full bg-gradient-to-r from-red-500 to-pink-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                          >
                            Çıkış
                          </button>
                        </>
                      ) : (
                        <>
                          {currentPage === 'results' && (
                            <button
                              onClick={() => {
                                handleBackToGenerate();
                                setShowMobileMenu(false);
                              }}
                              className="w-full mb-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                            >
                              Yeni İsim Üret
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setShowAuthModal(true);
                              setShowMobileMenu(false);
                            }}
                            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                          >
                            Giriş Yap
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Menu */}
          {showMobileMenu && (
            <div className="md:hidden mobile-menu-container bg-white border-t py-4">
              <div className="flex flex-col space-y-3">
                {!user ? (
                  <>
                    {currentPage === 'results' && (
                      <button
                        onClick={() => {
                          handleBackToGenerate();
                          setShowMobileMenu(false);
                        }}
                        className="flex items-center px-4 py-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-purple-100 hover:text-purple-600 transition-colors"
                      >
                        <Baby className="w-5 h-5 mr-3" />
                        Yeni İsim Üret
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowAuthModal(true);
                        setShowMobileMenu(false);
                      }}
                      className="flex items-center px-4 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                    >
                      <User className="w-5 h-5 mr-3" />
                      Giriş Yap
                    </button>
                  </>
                ) : (
                  <>
                    {currentPage === 'results' && (
                      <button
                        onClick={() => {
                          handleBackToGenerate();
                          setShowMobileMenu(false);
                        }}
                        className="flex items-center px-4 py-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-purple-100 hover:text-purple-600 transition-colors"
                      >
                        <Baby className="w-5 h-5 mr-3" />
                        Yeni İsim Üret
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowFavorites(true);
                        setShowMobileMenu(false);
                      }}
                      className="flex items-center px-4 py-2 rounded-lg bg-pink-50 text-pink-600 hover:bg-pink-100 transition-colors"
                    >
                      <Heart className="w-5 h-5 mr-3" />
                      Favoriler
                    </button>
                    {user && !user.is_premium && (
                      <button
                        onClick={() => {
                          handleShowPremiumUpgrade();
                          setShowMobileMenu(false);
                        }}
                        className="flex items-center px-4 py-2 rounded-lg bg-yellow-50 text-yellow-600 hover:bg-yellow-100 transition-colors"
                      >
                        <Crown className="w-5 h-5 mr-3" />
                        Premium
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowProfile(true);
                        setShowMobileMenu(false);
                      }}
                      className="flex items-center px-4 py-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <Settings className="w-5 h-5 mr-3" />
                      Profil
                    </button>
                    <button
                      onClick={() => {
                        handleLogout();
                        setShowMobileMenu(false);
                      }}
                      className="flex items-center px-4 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                    >
                      <LogOut className="w-5 h-5 mr-3" />
                      Çıkış
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {mainContent}
      </main>

      {/* Error Display */}
      {error && (
        <ErrorDisplay 
          error={error} 
          onClose={() => setError(null)}
          onPremiumUpgrade={handleShowPremiumUpgrade}
        />
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>

      {/* Modals */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
          onShowToast={showToast}
        />
      )}

      {showProfile && user && user.id && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Profil</h2>
                <button
                  onClick={() => setShowProfile(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              <UserProfile
                user={user}
                onClose={() => setShowProfile(false)}
                onUpdate={(updatedUser) => {
                  setUser(updatedUser);
                  showToast({ message: 'Profil güncellendi!', type: 'success' });
                }}
                onShowToast={showToast}
              />
            </div>
          </div>
        </div>
      )}

      {showFavorites && user && user.id && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Favoriler</h2>
                <button
                  onClick={() => setShowFavorites(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              <FavoritesPanel
                favorites={favorites}
                loading={favoritesLoading}
                onRemove={handleRemoveFavorite}
                onRefresh={loadFavorites}
                onClose={() => setShowFavorites(false)}
                onShowToast={showToast}
                onAnalyzeName={handleAnalyzeName}
              />
            </div>
          </div>
        </div>
      )}

      {/* Premium Upgrade Modal */}
      {showPremiumUpgrade && (
        <PremiumUpgrade
          onClose={() => setShowPremiumUpgrade(false)}
          onUpgrade={handlePremiumUpgrade}
        />
      )}

      {/* Nasıl Çalışır Modal */}
      {showHowItWorks && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  🤖 Nasıl Çalışır?
                </h2>
                <button
                  onClick={() => setShowHowItWorks(false)}
                  className="text-gray-400 hover:text-gray-600 text-3xl font-light transition-colors"
                >
                  ×
                </button>
              </div>
              
              {/* Nasıl Çalışır İçeriği */}
              <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-2xl p-8">
                <div className="text-center mb-8">
                  <p className="text-gray-600 text-lg">
                    Yapay zeka destekli bebek ismi üretme süreci
                  </p>
                </div>

                <div className="grid md:grid-cols-4 gap-6 mb-8">
                  {/* Adım 1 */}
                  <div className="text-center group">
                    <div className="relative mb-4">
                      <div className="w-16 h-16 mx-auto bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <span className="text-white text-2xl">📝</span>
                      </div>
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-xs font-bold text-gray-800">
                        1
                      </div>
                    </div>
                    <h4 className="font-bold text-gray-800 mb-2">Kriterler Seçin</h4>
                    <p className="text-sm text-gray-600">
                      Cinsiyet, dil, tema ve stil tercihlerinizi belirleyin
                    </p>
                  </div>

                  {/* Adım 2 */}
                  <div className="text-center group">
                    <div className="relative mb-4">
                      <div className="w-16 h-16 mx-auto bg-gradient-to-r from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <span className="text-white text-2xl">🧠</span>
                      </div>
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-xs font-bold text-gray-800">
                        2
                      </div>
                    </div>
                    <h4 className="font-bold text-gray-800 mb-2">AI Analizi</h4>
                    <p className="text-sm text-gray-600">
                      Yapay zeka kriterlerinizi analiz eder ve isim havuzunu oluşturur
                    </p>
                  </div>

                  {/* Adım 3 */}
                  <div className="text-center group">
                    <div className="relative mb-4">
                      <div className="w-16 h-16 mx-auto bg-gradient-to-r from-pink-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <span className="text-white text-2xl">✨</span>
                      </div>
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-xs font-bold text-gray-800">
                        3
                      </div>
                    </div>
                    <h4 className="font-bold text-gray-800 mb-2">İsim Üretimi</h4>
                    <p className="text-sm text-gray-600">
                      Kültürel ve dilsel uygunluk kontrolleri ile isimler üretilir
                    </p>
                  </div>

                  {/* Adım 4 */}
                  <div className="text-center group">
                    <div className="relative mb-4">
                      <div className="w-16 h-16 mx-auto bg-gradient-to-r from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <span className="text-white text-2xl">📋</span>
                      </div>
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-xs font-bold text-gray-800">
                        4
                      </div>
                    </div>
                    <h4 className="font-bold text-gray-800 mb-2">Sonuçlar</h4>
                    <p className="text-sm text-gray-600">
                      Anlam, köken ve popülerlik bilgileri ile birlikte sunulur
                    </p>
                  </div>
                </div>

                {/* Özellikler */}
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h4 className="text-xl font-bold text-gray-800 mb-6 text-center">🌟 Özelliklerimiz</h4>
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl">
                      <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-lg">🌍</span>
                      </div>
                      <div>
                        <p className="font-bold text-blue-800">6 Farklı Dil</p>
                        <p className="text-sm text-blue-600">Çok kültürlü isim seçenekleri</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl">
                      <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-lg">🎭</span>
                      </div>
                      <div>
                        <p className="font-bold text-purple-800">10 Tema</p>
                        <p className="text-sm text-purple-600">Her zevke uygun kategoriler</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-xl">
                      <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-lg">📖</span>
                      </div>
                      <div>
                        <p className="font-bold text-green-800">Detaylı Bilgi</p>
                        <p className="text-sm text-green-600">Anlam ve köken açıklamaları</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Alt Bilgi */}
                <div className="mt-8 text-center">
                  <div className="inline-flex items-center space-x-2 bg-white rounded-full px-6 py-3 shadow-sm">
                    <span className="text-gray-600">Powered by</span>
                    <span className="font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      AI Technology
                    </span>
                    <span className="text-xl">🚀</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Admin Dashboard Component
function AdminDashboard() {
  const navigate = useNavigate();
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  // Toast function for AdminDashboard
  const showToast = useCallback(({ message, type = 'info', duration = 5000 }) => {
    const id = Date.now();
    const newToast = { id, message, type, duration };
    
    setToasts(prev => [...prev, newToast]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  useEffect(() => {
    checkAdminAuth();
  }, []);

  const checkAdminAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/admin');
        return;
      }

      const profile = await apiService.getProfile();
      if (!profile.is_admin) {
        localStorage.removeItem('token');
        navigate('/admin');
        return;
      }

      setAdminUser(profile);
    } catch (error) {
      console.error('Admin auth check failed:', error);
      localStorage.removeItem('token');
      navigate('/admin');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/admin');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Admin Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center mr-3">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Hoş geldin, {adminUser?.name}</span>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm"
              >
                Çıkış
              </button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Admin Panel */}
      <AdminPanel onShowToast={showToast} />
      
      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </div>
  );
}

// Admin Login Page Component  
function AdminLoginPage() {
  const navigate = useNavigate();

  const handleAdminSuccess = (adminData) => {
    console.log('Admin login successful:', adminData);
    navigate('/admin/dashboard');
  };

  return <AdminLogin onSuccess={handleAdminSuccess} />;
}

// Ana App component'i (Router ile)
function App() {
  return (
    <Router>
      <Routes>
        {/* Ana uygulama rotaları */}
        <Route path="/" element={<MainApp />} />
        <Route path="/home" element={<MainApp />} />
        
        {/* Admin rotaları */}
        <Route path="/admin" element={<AdminLoginPage />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        
        {/* Bilinmeyen rotalar için ana sayfaya yönlendir */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App; 