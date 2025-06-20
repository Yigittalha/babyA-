import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Baby, Sparkles, Heart, Star, User, LogOut, Settings, Search, Plus, TrendingUp, Home, Crown, HelpCircle } from 'lucide-react';
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
import { apiService, formatError } from './services/api';
import './index.css';

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

  // Uygulama başlangıcında seçenekleri yükle
  useEffect(() => {
    loadOptions();
  }, []);

  // Kullanıcı durumunu kontrol et
  useEffect(() => {
    // Önce cache'lenmiş user data'sını yükle (hızlı render için)
    const cachedUser = localStorage.getItem('user_data');
    if (cachedUser) {
      try {
        const parsedUser = JSON.parse(cachedUser);
        setUser(parsedUser);
      } catch (e) {
        console.error('Cached user data parse error:', e);
        localStorage.removeItem('user_data');
      }
    }

    // Token varsa fresh data al
    const token = localStorage.getItem('token');
    if (token) {
      checkAuthStatus();
    }
  }, []); // Empty dependency array - sadece mount'ta çalışsın

  const loadOptions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getOptions();
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

  const checkAuthStatus = useCallback(async () => {
    try {
      // Önce localStorage'dan cache'lenmiş user data'sını kontrol et
      const cachedUser = localStorage.getItem('user_data');
      if (cachedUser) {
        try {
          const parsedUser = JSON.parse(cachedUser);
          setUser(parsedUser);
        } catch (e) {
          console.error('Cached user data parse error:', e);
        }
      }

      // API'dan fresh data al
      const userData = await apiService.getProfile();
      setUser(userData);
      
      // User data'sını localStorage'a cache'le
      localStorage.setItem('user_data', JSON.stringify(userData));
      
      // Sadece user data aldıktan sonra favorileri yükle
      if (userData) {
        loadFavorites(userData.id);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('user_data');
      setUser(null);
    }
  }, []); // Empty dependencies

  const loadFavorites = useCallback(async (userId = null) => {
    // userId parametresi varsa kullan, yoksa current user'ı kontrol et
    if (!userId && !user) return;
    
    setFavoritesLoading(true);
    try {
      const response = await apiService.getFavorites();
      setFavorites(response.favorites);
    } catch (error) {
      console.error('Favoriler yüklenemedi:', error);
    } finally {
      setFavoritesLoading(false);
    }
  }, [user]); // Sadece user değiştiğinde dependency

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
      
      const response = await apiService.generateNames(backendRequest);
      
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
    } finally {
      setLoading(false);
    }
  };

  const handleAddToFavorites = async (nameData) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    try {
      await apiService.addFavorite(nameData);
      await loadFavorites(); // Favorileri yenile
      showToast({ message: `"${nameData.name}" favorilere eklendi! ❤️`, type: 'favorite' });
    } catch (error) {
      console.error('Favori eklenirken hata oluştu:', error);
      showToast({ message: 'Favori eklenirken hata oluştu', type: 'error' });
    }
  };

  const handleRemoveFavorite = async (favoriteId) => {
    try {
      await apiService.deleteFavorite(favoriteId);
      await loadFavorites(); // Favorileri yenile
      showToast({ message: 'Favori silindi', type: 'success' });
    } catch (error) {
      console.error('Favori silinirken hata oluştu:', error);
      showToast({ message: 'Favori silinirken hata oluştu', type: 'error' });
    }
  };

  const handleAuthSuccess = useCallback((userData) => {
    setUser(userData);
    setShowAuthModal(false);
    
    // User data'sını cache'le
    localStorage.setItem('user_data', JSON.stringify(userData));
    
    // userData'yı direkt kullan
    if (userData) {
      loadFavorites(userData.id);
    }
  }, [loadFavorites]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_data'); // Cache'i temizle
    setUser(null);
    setFavorites([]);
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
      const response = await apiService.analyzeName(name, language);
      
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
        <div className="flex items-center space-x-3">
          {currentPage === 'results' && (
            <button
              onClick={handleBackToGenerate}
              className="btn-modern-primary"
            >
              <Baby className="w-4 h-4 mr-2" />
              Yeni İsim Üret
            </button>
          )}
          <button
            onClick={() => setShowAuthModal(true)}
            className="btn-modern-secondary"
          >
            <User className="w-4 h-4 mr-2" />
            Giriş Yap
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-3">
        {currentPage === 'results' && (
          <button
            onClick={handleBackToGenerate}
            className="btn-modern-primary"
          >
            <Baby className="w-4 h-4 mr-2" />
            Yeni İsim Üret
          </button>
        )}
        <button
          onClick={() => setShowFavorites(true)}
          className="bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
        >
          <Heart className="w-4 h-4 mr-2" />
          Favoriler
        </button>
        {user && !user.is_premium && (
          <button
            onClick={handleShowPremiumUpgrade}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
          >
            <Crown className="w-4 h-4 mr-2" />
            Premium
          </button>
        )}
        <button
          onClick={() => setShowProfile(true)}
          className="btn-modern-secondary"
        >
          <Settings className="w-4 h-4 mr-2" />
          Profil
        </button>
        <button
          onClick={handleLogout}
          className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Çıkış
        </button>
      </div>
    );
  }, [user, handleLogout, currentPage, handleBackToGenerate, handleShowPremiumUpgrade]);

  const mainContent = useMemo(() => {
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Yükleniyor...</p>
          </div>
        </div>
      );
    }

    // İsim Üretme Sayfası
    if (currentPage === 'generate') {
      return (
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-gray-800 mb-4 mobile-text-3xl">
                👶 Bebek İsmi Üretici
              </h1>
              <p className="text-xl text-gray-600 mobile-text-lg">
                Yapay zeka destekli, kültürel ve dilsel çeşitlilikle bebek isimleri
              </p>
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
              <h1 className="text-4xl font-bold text-gray-800 mb-4 mobile-text-3xl">
                👶 Bebek İsmi Trend Analizi
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

    // Varsayılan olarak isim üretme sayfasına dön
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-800 mb-4 mobile-text-3xl">
              👶 Bebek İsmi Üretici
            </h1>
            <p className="text-xl text-gray-600 mobile-text-lg">
              Yapay zeka destekli, kültürel ve dilsel çeşitlilikle bebek isimleri
            </p>
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
    );
  }, [loading, showToast, handleError, handleAnalyzeName, options, results, user, currentPage, handleBackToGenerate, handleAddToFavorites, isPremiumRequired, premiumMessage, handleShowPremiumUpgrade, blurredNames]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Bebek İsmi Üretici</h2>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Header */}
      <header className="glass-effect sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center animate-float">
                  <span className="text-white font-bold text-lg">👶</span>
                </div>
                <h1 className="text-2xl font-bold text-gradient mobile-text-lg">
                  Bebek İsmi Üretici
                </h1>
              </div>
            </div>
            
            {/* Navigasyon Butonları */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage('generate')}
                className={`nav-button ${currentPage === 'generate' ? 'nav-button-active' : ''}`}
              >
                <Home className="w-4 h-4 mr-2" />
                Ana Sayfa
              </button>
              
              <button
                onClick={() => setCurrentPage('trends')}
                className={`nav-button ${currentPage === 'trends' ? 'nav-button-active' : ''}`}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Trendler
              </button>
              
              <button
                onClick={() => setShowHowItWorks(true)}
                className="nav-button"
              >
                <HelpCircle className="w-4 h-4 mr-2" />
                Nasıl Çalışır?
              </button>
            </div>
            
            {headerButtons}
          </div>
        </div>
      </header>

      {/* Main Content */}
      {mainContent}

      {/* Error Display */}
      {error && (
        <ErrorDisplay 
          error={error} 
          onClose={() => setError(null)} 
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
          onSuccess={(userData) => {
            setUser(userData);
            setShowAuthModal(false);
            loadFavorites();
            showToast({ message: 'Başarıyla giriş yapıldı!', type: 'success' });
          }}
          onShowToast={showToast}
        />
      )}

      {showProfile && user && (
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

      {showFavorites && (
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
      <AdminPanel />
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

export default React.memo(App); 