import React, { useState, useEffect } from 'react';
import { User, Heart, Star, Calendar, Mail, Shield, Activity } from 'lucide-react';
import { apiService } from '../services/api';

const UserProfile = ({ user, onClose, onUpdate, onShowToast }) => {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    if (user) {
      loadFavorites();
    }
  }, [user]);

  const loadFavorites = async () => {
    try {
      setLoading(true);
      const response = await apiService.getFavorites();
      setFavorites(response.favorites || []);
    } catch (err) {
      setError('Favoriler yüklenirken hata oluştu');
      console.error('Favorites loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteFavorite = async (favoriteId) => {
    try {
      await apiService.deleteFavorite(favoriteId);
      setFavorites(favorites.filter(fav => fav.id !== favoriteId));
      onShowToast({ message: 'Favori isim kaldırıldı', type: 'success' });
    } catch (err) {
      console.error('Delete favorite error:', err);
      onShowToast({ message: 'Favori kaldırılırken hata oluştu', type: 'error' });
    }
  };

  const getGenderLabel = (gender) => {
    const labels = {
      male: '👶 Erkek',
      female: '👧 Kız',
      unisex: '👶👧 Unisex'
    };
    return labels[gender] || gender;
  };

  const getLanguageLabel = (language) => {
    const labels = {
      'turkish': '🇹🇷 Türkçe',
      'english': '🇬🇧 İngilizce',
      'arabic': '🇸🇦 Arapça',
      'persian': '🇮🇷 Farsça',
      'kurdish': '🇮🇶 Kürtçe',
      'azerbaijani': '🇦🇿 Azerbaycan dili',
      'french': '🇫🇷 Fransızca',
      'german': '🇩🇪 Almanca',
      'spanish': '🇪🇸 İspanyolca',
      'portuguese': '🇵🇹 Portekizce',
      'russian': '🇷🇺 Rusça',
      'chinese': '🇨🇳 Çince',
      'japanese': '🇯🇵 Japonca'
    };
    return labels[language] || language;
  };

  const getThemeLabel = (theme) => {
    const labels = {
      nature: '🌿 Doğa',
      religious: '🙏 Dini/İlahi',
      historical: '🏛️ Tarihi',
      modern: '✨ Modern',
      traditional: '🏺 Geleneksel',
      unique: '💎 Benzersiz',
      royal: '👑 Asil/Kraliyet',
      warrior: '⚔️ Savaşçı',
      wisdom: '🧠 Bilgelik',
      love: '💕 Aşk/Sevgi'
    };
    return labels[theme] || theme;
  };

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center space-x-2 px-6 py-3 font-medium transition-colors ${
            activeTab === 'profile'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Profil Bilgileri</span>
        </button>
        <button
          onClick={() => setActiveTab('favorites')}
          className={`flex items-center space-x-2 px-6 py-3 font-medium transition-colors ${
            activeTab === 'favorites'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Heart className="w-4 h-4" />
          <span>Favoriler ({favorites.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex items-center space-x-2 px-6 py-3 font-medium transition-colors ${
            activeTab === 'stats'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>İstatistikler</span>
        </button>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Profile Header */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-8 text-white">
            <div className="flex items-center space-x-6">
              <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <User className="w-10 h-10" />
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold mb-2">{user.name}</h2>
                <div className="flex items-center space-x-4 text-blue-100">
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4" />
                    <span>{user.email}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4" />
                    <span>Üye: {new Date(user.created_at).toLocaleDateString('tr-TR')}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span className="text-sm">
                  {user.is_premium || user.subscription_type === 'premium' ? 'Premium Üye' : 'Ücretsiz Üye'}
                </span>
              </div>
            </div>
          </div>

          {/* Profile Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Heart className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Toplam Favori</p>
                  <p className="text-2xl font-bold text-gray-900">{favorites.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Star className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Aktif Gün</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Math.floor((new Date() - new Date(user.created_at)) / (1000 * 60 * 60 * 24))}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Activity className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Son Aktivite</p>
                  <p className="text-2xl font-bold text-gray-900">Bugün</p>
                </div>
              </div>
            </div>
          </div>

          {/* Account Information */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Hesap Bilgileri</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Üyelik Türü:</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    user.is_premium || user.subscription_type === 'premium' 
                      ? 'bg-purple-100 text-purple-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {user.is_premium || user.subscription_type === 'premium' ? 'Premium' : 'Ücretsiz'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Üyelik Tarihi:</span>
                  <span className="text-gray-900 font-medium">
                    {new Date(user.created_at).toLocaleDateString('tr-TR')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Toplam Favori:</span>
                  <span className="text-gray-900 font-medium">{favorites.length} isim</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">E-posta:</span>
                  <span className="text-gray-900 font-medium truncate max-w-48">{user.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Son Aktivite:</span>
                  <span className="text-gray-900 font-medium">Bugün</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Durum:</span>
                  <span className="text-green-600 font-medium">Aktif</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Favorites Tab */}
      {activeTab === 'favorites' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Heart className="w-6 h-6 text-pink-500" />
                <h3 className="text-xl font-bold text-gray-900">Favori İsimlerim</h3>
                <span className="bg-pink-100 text-pink-800 px-3 py-1 rounded-full text-sm font-medium">
                  {favorites.length} isim
                </span>
              </div>
              <button
                onClick={loadFavorites}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Yenile
              </button>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Favoriler yükleniyor...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-600 mb-4">{error}</p>
                <button
                  onClick={loadFavorites}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Tekrar Dene
                </button>
              </div>
            ) : favorites.length === 0 ? (
              <div className="text-center py-12">
                <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Henüz favori isminiz yok</h4>
                <p className="text-gray-600 mb-4">İsim üretirken beğendiğiniz isimleri favorilere ekleyebilirsiniz</p>
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  İsim Üret
                </button>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {favorites.map((favorite) => (
                  <div
                    key={favorite.id}
                    className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200 hover:border-blue-200"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="text-xl font-bold text-gray-900">{favorite.name}</h4>
                      <button
                        onClick={() => deleteFavorite(favorite.id)}
                        className="text-red-500 hover:text-red-700 transition-colors p-1 hover:bg-red-50 rounded"
                        title="Favorilerden kaldır"
                      >
                        <Heart className="w-5 h-5 fill-current" />
                      </button>
                    </div>
                    
                    <p className="text-gray-600 mb-4 line-clamp-3">{favorite.meaning}</p>
                    
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-500 font-medium">Cinsiyet:</span>
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                          {getGenderLabel(favorite.gender)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-500 font-medium">Dil:</span>
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                          {getLanguageLabel(favorite.language)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-500 font-medium">Tema:</span>
                        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs">
                          {getThemeLabel(favorite.theme)}
                        </span>
                      </div>
                    </div>

                    {favorite.notes && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <span className="text-gray-500 text-sm font-medium">Not:</span>
                        <p className="text-gray-700 text-sm mt-1">{favorite.notes}</p>
                      </div>
                    )}

                    <div className="mt-4 text-xs text-gray-400 border-t border-gray-100 pt-3">
                      {new Date(favorite.created_at).toLocaleDateString('tr-TR')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Kullanım İstatistikleri</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{favorites.length}</div>
                <div className="text-sm text-gray-600">Favori İsim</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {Math.floor((new Date() - new Date(user.created_at)) / (1000 * 60 * 60 * 24))}
                </div>
                <div className="text-sm text-gray-600">Aktif Gün</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {new Set(favorites.map(fav => fav.language)).size}
                </div>
                <div className="text-sm text-gray-600">Farklı Dil</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {new Set(favorites.map(fav => fav.theme)).size}
                </div>
                <div className="text-sm text-gray-600">Farklı Tema</div>
              </div>
            </div>
          </div>

          {/* Detailed Stats */}
          {favorites.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Favori İsim Dağılımı</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Gender Distribution */}
                <div>
                  <h4 className="text-md font-medium text-gray-800 mb-3">Cinsiyet Dağılımı</h4>
                  <div className="space-y-2">
                    {Object.entries(
                      favorites.reduce((acc, fav) => {
                        acc[fav.gender] = (acc[fav.gender] || 0) + 1;
                        return acc;
                      }, {})
                    ).map(([gender, count]) => (
                      <div key={gender} className="flex items-center justify-between">
                        <span className="text-gray-600">{getGenderLabel(gender)}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full" 
                              style={{ width: `${(count / favorites.length) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-500 w-8">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Language Distribution */}
                <div>
                  <h4 className="text-md font-medium text-gray-800 mb-3">Dil Dağılımı</h4>
                  <div className="space-y-2">
                    {Object.entries(
                      favorites.reduce((acc, fav) => {
                        acc[fav.language] = (acc[fav.language] || 0) + 1;
                        return acc;
                      }, {})
                    ).slice(0, 5).map(([language, count]) => (
                      <div key={language} className="flex items-center justify-between">
                        <span className="text-gray-600">{getLanguageLabel(language)}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full" 
                              style={{ width: `${(count / favorites.length) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-500 w-8">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserProfile; 