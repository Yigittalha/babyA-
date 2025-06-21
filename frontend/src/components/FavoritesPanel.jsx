import React, { useState } from 'react';
import { Heart, Star, Baby, Crown, Sparkles, Search, Filter, Calendar, Trash2, Eye, RefreshCw } from 'lucide-react';

const FavoritesPanel = ({ favorites, loading, onRemove, onRefresh }) => {
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, name
  const [viewMode, setViewMode] = useState('grid'); // grid, list

  // favorites undefined ise boş array kullan
  const safeFavorites = favorites || [];

  // Filtreleme ve arama
  const filteredAndSortedFavorites = safeFavorites
    .filter(favorite => {
      const matchesFilter = filter === 'all' || favorite.gender === filter;
      const matchesSearch = !searchTerm || 
        favorite.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        favorite.meaning.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesFilter && matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'name':
          return a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' });
        case 'newest':
        default:
          return new Date(b.created_at) - new Date(a.created_at);
      }
    });

  const getGenderLabel = (gender) => {
    const labels = {
      'male': '👶 Erkek',
      'female': '👧 Kız',
      'unisex': '👶👧 Unisex'
    };
    return labels[gender] || gender;
  };

  const getThemeLabel = (theme) => {
    const labels = {
      'nature': '🌿 Doğa',
      'religious': '🙏 Dini',
      'historical': '🏛️ Tarihi',
      'modern': '✨ Modern',
      'traditional': '🏺 Geleneksel',
      'unique': '💎 Benzersiz',
      'royal': '👑 Asil',
      'warrior': '⚔️ Savaşçı',
      'wisdom': '🧠 Bilgelik',
      'love': '💕 Aşk'
    };
    return labels[theme] || theme;
  };

  const getLanguageLabel = (language) => {
    const labels = {
      'turkish': '🇹🇷 Türkçe',
      'english': '🇬🇧 İngilizce',
      'arabic': '🇸🇦 Arapça',
      'persian': '🇮🇷 Farsça',
      'kurdish': '🇮🇶 Kürtçe',
      'azerbaijani': '🇦🇿 Azerbaycan',
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

  if (loading) {
    return (
      <div className="relative overflow-hidden bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 rounded-3xl shadow-2xl border border-white/50">
        {/* Background Decorations */}
        <div className="absolute inset-0 opacity-10">
          <div className="grid grid-cols-8 gap-6 h-full">
            {[...Array(32)].map((_, i) => (
              <div key={i} className="flex items-center justify-center animate-pulse">
                <Baby className="w-4 h-4 text-pink-400" />
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-pink-300 border-t-pink-600 mx-auto mb-4"></div>
            <p className="text-gray-700 font-medium">Favori isimleriniz yükleniyor...</p>
            <div className="flex items-center justify-center space-x-1 mt-2">
              <Heart className="w-4 h-4 text-pink-500 animate-bounce" />
              <Heart className="w-4 h-4 text-purple-500 animate-bounce" style={{ animationDelay: '0.1s' }} />
              <Heart className="w-4 h-4 text-blue-500 animate-bounce" style={{ animationDelay: '0.2s' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 rounded-3xl shadow-2xl border border-white/50">
      {/* Floating Baby Decorations */}
      <div className="absolute top-6 left-6 opacity-20 animate-bounce">
        <Baby className="w-6 h-6 text-pink-400" />
      </div>
      <div className="absolute top-12 right-8 opacity-20 animate-pulse">
        <Heart className="w-5 h-5 text-purple-400" />
      </div>
      <div className="absolute bottom-8 left-1/4 opacity-20 animate-bounce" style={{ animationDelay: '1s' }}>
        <Star className="w-4 h-4 text-yellow-400" />
      </div>
      <div className="absolute bottom-12 right-1/3 opacity-20 animate-pulse" style={{ animationDelay: '2s' }}>
        <Sparkles className="w-5 h-5 text-blue-400" />
      </div>

      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="grid grid-cols-12 gap-4 h-full">
          {[...Array(48)].map((_, i) => (
            <div key={i} className="flex items-center justify-center">
              <Baby className="w-3 h-3 text-pink-400" />
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div className="mb-4 md:mb-0">
            <h3 className="text-3xl font-bold text-gray-800 mb-2 flex items-center">
              <div className="mr-4 p-3 bg-gradient-to-r from-pink-400 to-purple-500 rounded-2xl shadow-lg">
                <Heart className="w-8 h-8 text-white" />
              </div>
              Favori İsimleriniz
            </h3>
            <p className="text-gray-600 flex items-center space-x-2">
              <span>{safeFavorites.length} özel seçiminiz</span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <Baby className="w-4 h-4 text-pink-500" />
                <span>Her biri bir hazine</span>
              </span>
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={onRefresh}
              className="flex items-center space-x-2 px-4 py-2 bg-white/70 hover:bg-white/90 backdrop-blur-sm border border-white/50 rounded-xl text-gray-700 hover:text-gray-900 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="font-medium">Yenile</span>
            </button>
            
            <div className="flex bg-white/70 backdrop-blur-sm rounded-xl border border-white/50 overflow-hidden shadow-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 transition-all duration-300 ${
                  viewMode === 'grid' 
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <div className="grid grid-cols-2 gap-1 w-4 h-4">
                  <div className="bg-current rounded-sm"></div>
                  <div className="bg-current rounded-sm"></div>
                  <div className="bg-current rounded-sm"></div>
                  <div className="bg-current rounded-sm"></div>
                </div>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 transition-all duration-300 ${
                  viewMode === 'list' 
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <div className="space-y-1 w-4 h-4">
                  <div className="h-1 bg-current rounded"></div>
                  <div className="h-1 bg-current rounded"></div>
                  <div className="h-1 bg-current rounded"></div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {safeFavorites.length === 0 ? (
          <div className="text-center py-16">
            <div className="relative mb-8">
              <div className="text-8xl opacity-50 mb-4">👶</div>
              <div className="absolute -top-2 -right-2 animate-bounce">
                <Heart className="w-6 h-6 text-pink-400" />
              </div>
            </div>
            <h4 className="text-2xl font-bold text-gray-800 mb-3">Henüz favori isminiz yok</h4>
            <p className="text-gray-600 mb-6 max-w-md mx-auto leading-relaxed">
              İsim üretirken beğendiğiniz isimleri kalp butonuna tıklayarak favorilere ekleyebilirsiniz. 
              Her favori isim, bebeğiniz için özel bir seçenek!
            </p>
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-lg max-w-sm mx-auto">
              <h5 className="font-bold text-gray-800 mb-3 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-purple-500 mr-2" />
                İpucu
              </h5>
              <p className="text-sm text-gray-600">
                İsim aramaya başladığınızda, her ismin altındaki ❤️ butonuna tıklayarak favorilere ekleyebilirsiniz.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Arama ve Filtreler */}
            <div className="mb-8 space-y-4">
              {/* Arama */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="İsim veya anlam ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white/70 backdrop-blur-sm border-2 border-white/50 rounded-2xl focus:ring-4 focus:ring-purple-300/50 focus:border-purple-400 transition-all duration-300 placeholder-gray-500 shadow-lg"
                />
              </div>

              {/* Filtreler */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full px-4 py-3 bg-white/70 backdrop-blur-sm border-2 border-white/50 rounded-xl focus:ring-4 focus:ring-purple-300/50 focus:border-purple-400 transition-all duration-300 shadow-lg"
                  >
                    <option value="all">🎯 Tümü ({safeFavorites.length})</option>
                    <option value="male">👶 Erkek ({safeFavorites.filter(f => f.gender === 'male').length})</option>
                    <option value="female">👧 Kız ({safeFavorites.filter(f => f.gender === 'female').length})</option>
                    <option value="unisex">👶👧 Unisex ({safeFavorites.filter(f => f.gender === 'unisex').length})</option>
                  </select>
                </div>
                
                <div className="md:w-48">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-4 py-3 bg-white/70 backdrop-blur-sm border-2 border-white/50 rounded-xl focus:ring-4 focus:ring-purple-300/50 focus:border-purple-400 transition-all duration-300 shadow-lg"
                  >
                    <option value="newest">📅 En Yeni</option>
                    <option value="oldest">⏰ En Eski</option>
                    <option value="name">🔤 İsme Göre</option>
                  </select>
                </div>
              </div>

              {/* Arama Sonuçları */}
              {(searchTerm || filter !== 'all') && (
                <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 border border-white/50 shadow-lg">
                  <p className="text-sm text-gray-700 flex items-center space-x-2">
                    <Filter className="w-4 h-4 text-purple-500" />
                    <span>
                      <strong>{filteredAndSortedFavorites.length}</strong> sonuç bulundu
                      {searchTerm && <span className="font-medium"> "{searchTerm}" için</span>}
                      {filter !== 'all' && <span className="font-medium"> {getGenderLabel(filter)} kategorisinde</span>}
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Favori Listesi */}
            {filteredAndSortedFavorites.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl opacity-50 mb-4">🔍</div>
                <h4 className="text-xl font-bold text-gray-800 mb-2">Arama sonucu bulunamadı</h4>
                <p className="text-gray-600 mb-4">Arama terimlerinizi değiştirmeyi deneyin</p>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilter('all');
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                >
                  Filtreleri Temizle
                </button>
              </div>
            ) : (
              <div className={`${
                viewMode === 'grid' 
                  ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' 
                  : 'space-y-4'
              } max-h-96 overflow-y-auto pr-2`}>
                {filteredAndSortedFavorites.map((favorite, index) => (
                  <div
                    key={favorite.id}
                    className={`group relative bg-white/80 backdrop-blur-sm hover:bg-white/95 border-2 border-white/60 hover:border-purple-200 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 ${
                      viewMode === 'grid' ? 'p-6' : 'p-4 flex items-center space-x-4'
                    }`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    {/* Premium Badge (eğer premium isimse) */}
                    {favorite.theme === 'unique' && (
                      <div className="absolute top-3 right-3">
                        <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-yellow-900 px-2 py-1 rounded-lg text-xs font-bold flex items-center space-x-1">
                          <Crown className="w-3 h-3" />
                          <span>Özel</span>
                        </div>
                      </div>
                    )}

                    {viewMode === 'grid' ? (
                      <>
                        {/* Grid View */}
                        <div className="text-center mb-4">
                          <h4 className="text-xl font-bold text-gray-800 group-hover:text-purple-600 transition-colors mb-2">
                            {favorite.name}
                          </h4>
                          <div className="text-2xl mb-2">
                            {favorite.gender === 'male' ? '👶' : favorite.gender === 'female' ? '👧' : '👶👧'}
                          </div>
                        </div>
                        
                        <p className="text-gray-600 text-sm leading-relaxed mb-4 line-clamp-3">
                          {favorite.meaning}
                        </p>
                        
                        <div className="space-y-3 mb-4">
                          <div className="flex flex-wrap gap-2 justify-center">
                            <span className="bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 px-3 py-1 rounded-full text-xs font-bold">
                              {getGenderLabel(favorite.gender)}
                            </span>
                            <span className="bg-gradient-to-r from-green-100 to-green-200 text-green-800 px-3 py-1 rounded-full text-xs font-bold">
                              {getThemeLabel(favorite.theme)}
                            </span>
                            <span className="bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 px-3 py-1 rounded-full text-xs font-bold">
                              {getLanguageLabel(favorite.language)}
                            </span>
                          </div>
                        </div>

                        {favorite.notes && (
                          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-3 mb-4">
                            <p className="text-xs text-yellow-800">
                              <strong className="flex items-center space-x-1 mb-1">
                                <Star className="w-3 h-3" />
                                <span>Notunuz:</span>
                              </strong>
                              {favorite.notes}
                            </p>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                          <div className="flex items-center text-xs text-gray-500 space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(favorite.created_at).toLocaleDateString('tr-TR')}</span>
                          </div>
                          <button
                            onClick={() => onRemove(favorite.id)}
                            className="group/btn text-red-400 hover:text-red-600 transition-all duration-300 p-2 hover:bg-red-50 rounded-lg"
                            title="Favorilerden kaldır"
                          >
                            <Trash2 className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* List View */}
                        <div className="flex-shrink-0 text-3xl">
                          {favorite.gender === 'male' ? '👶' : favorite.gender === 'female' ? '👧' : '👶👧'}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-lg font-bold text-gray-800 group-hover:text-purple-600 transition-colors">
                                {favorite.name}
                              </h4>
                              <p className="text-gray-600 text-sm truncate mb-2">
                                {favorite.meaning}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                                  {getGenderLabel(favorite.gender)}
                                </span>
                                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                                  {getThemeLabel(favorite.theme)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                              <span className="text-xs text-gray-400">
                                {new Date(favorite.created_at).toLocaleDateString('tr-TR')}
                              </span>
                              <button
                                onClick={() => onRemove(favorite.id)}
                                className="text-red-400 hover:text-red-600 transition-colors p-1 hover:bg-red-50 rounded"
                                title="Favorilerden kaldır"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Alt İpucu */}
        {safeFavorites.length > 0 && (
          <div className="mt-8 bg-white/50 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-lg">
            <h4 className="font-bold text-gray-800 mb-3 flex items-center">
              <Sparkles className="w-5 h-5 text-purple-500 mr-2" />
              İpuçları
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
              <div className="flex items-start space-x-2">
                <Heart className="w-4 h-4 text-pink-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">Favorileri Karşılaştırın</p>
                  <p>Farklı isimleri yan yana değerlendirin</p>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <Star className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">Not Ekleyin</p>
                  <p>İsimler hakkında düşüncelerinizi yazın</p>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <Baby className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">Paylaşın</p>
                  <p>Sevdiklerinizle favori isimlerinizi paylaşın</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoritesPanel; 