import React, { useState, useMemo } from 'react';
import { Heart, Star, BookOpen, RefreshCw, Search, ChevronLeft, ChevronRight, Crown, Lock, Check, Sparkles } from 'lucide-react';
import NameAnalysis from './NameAnalysis';

const NameResults = ({ results, onGenerateNew, loading, onAddToFavorites, user, onShowToast, isPremiumRequired, premiumMessage, onShowPremiumUpgrade, blurredNames = [] }) => {
  const [selectedNames, setSelectedNames] = useState(new Set());
  const [showNotes, setShowNotes] = useState({});
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisName, setAnalysisName] = useState('');
  const [analysisLanguage, setAnalysisLanguage] = useState('turkish');
  const [currentPage, setCurrentPage] = useState(1);
  const [namesPerPage] = useState(9); // Her sayfada 9 isim göster
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('default'); // 'default', 'name', 'popularity'

  // Filtreleme ve sıralama
  const filteredAndSortedResults = useMemo(() => {
    let filtered = results;
    
    // Arama filtresi
    if (searchTerm) {
      filtered = filtered.filter(name => 
        name.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        name.meaning.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Sıralama
    switch (sortBy) {
      case 'name':
        return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
      case 'popularity':
        return [...filtered].sort((a, b) => {
          const popularityOrder = { 'popular': 3, 'modern': 2, 'traditional': 1, 'unique': 0 };
          return (popularityOrder[b.popularity] || 0) - (popularityOrder[a.popularity] || 0);
        });
      default:
        return filtered;
    }
  }, [results, searchTerm, sortBy]);

  // Sayfalama hesaplamaları - Normal isimler ve bulanık isimleri birleştir
  const allNames = [...filteredAndSortedResults, ...blurredNames];
  const totalPages = Math.ceil(allNames.length / namesPerPage);
  const startIndex = (currentPage - 1) * namesPerPage;
  const endIndex = startIndex + namesPerPage;
  const currentNames = allNames.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    // Sayfa değiştiğinde yukarı scroll et
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const handleAddToFavorites = (name) => {
    if (!user) {
      onShowToast({ message: 'Favori eklemek için giriş yapmanız gerekiyor!', type: 'error' });
      return;
    }

    const notes = showNotes[name.name] || '';
    onAddToFavorites({
      name: name.name,
      meaning: name.meaning,
      gender: name.gender || 'unisex',
      language: name.language || 'turkish',
      theme: name.theme || 'modern',
      notes: notes
    });
    
    // Not alanını temizle
    setShowNotes(prev => ({ ...prev, [name.name]: '' }));
  };

  const handleCopyName = async (name) => {
    try {
      await navigator.clipboard.writeText(name);
      onShowToast({ message: `"${name}" kopyalandı! 📋`, type: 'success' });
    } catch (error) {
      console.error('Kopyalama hatası:', error);
      onShowToast({ message: 'Kopyalama başarısız', type: 'error' });
    }
  };

  const handleAnalyzeName = (name, language) => {
    console.log('🔍 NameResults: handleAnalyzeName called');
    console.log('📝 Name parameter:', name);
    console.log('🌍 Language parameter:', language);
    console.log('📊 Name type:', typeof name);
    console.log('📊 Name length:', name?.length);
    
    // Name parametresinin geçerli olup olmadığını kontrol et
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      console.error('❌ NameResults: Invalid name provided:', name);
      onShowToast({ message: 'Geçerli bir isim sağlanmadı', type: 'error' });
      return;
    }
    
    setAnalysisName(name);
    setAnalysisLanguage(language);
    setShowAnalysis(true);
    
    console.log('✅ NameResults: State updated');
    console.log('📝 analysisName state:', name);
    console.log('🌍 analysisLanguage state:', language);
  };

  const closeAnalysis = () => {
    setShowAnalysis(false);
    setAnalysisName('');
    setAnalysisLanguage('');
  };

  const toggleNotes = (name) => {
    setShowNotes(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const getGenderLabel = (gender) => {
    const labels = {
      'male': '👦 Erkek',
      'female': '👧 Kız',
      'unisex': '👶 Unisex'
    };
    return labels[gender] || '👶 Unisex';
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
    return labels[theme] || '✨ Modern';
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

  if (!results || results.length === 0) {
    return null;
  }

  const getPopularityColor = (popularity) => {
    switch (popularity?.toLowerCase()) {
      case 'modern':
        return 'text-blue-600 bg-blue-100';
      case 'traditional':
        return 'text-green-600 bg-green-100';
      case 'unique':
        return 'text-purple-600 bg-purple-100';
      case 'popular':
        return 'text-orange-600 bg-orange-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getOriginIcon = (origin) => {
    switch (origin?.toLowerCase()) {
      case 'ai generated':
        return <Star className="w-4 h-4" />;
      case 'fallback':
        return <BookOpen className="w-4 h-4" />;
      default:
        return <Heart className="w-4 h-4" />;
    }
  };

  // Bulanık isim kontrolü
  const isNameBlurred = (name) => {
    return name.name === "●●●●●" || name.meaning === "🔒 Premium üyelik gerekli";
  };

  // Bulanık isim kartına tıklama
  const handleBlurredCardClick = () => {
    onShowPremiumUpgrade();
  };

  return (
    <div className="max-w-4xl mx-auto mobile-padding">
      {/* Başlık */}
      <div className="text-center mb-8">
        <h2 className="mobile-text-3xl font-bold text-gray-800 mb-3">
          İsim Önerileriniz
        </h2>
        <p className="text-gray-600 mobile-text-lg">
          {allNames.length} isim bulundu • Sayfa {currentPage} / {totalPages}
        </p>
        <p className="text-gray-500 text-sm mt-2">
          Beğendiğiniz isimleri favorilere ekleyebilirsiniz • Her sayfada {namesPerPage} isim gösteriliyor
        </p>
      </div>

      {/* Arama ve Filtreleme */}
      <div className="mb-8 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Arama Kutusu */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="İsim veya anlam ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-300 focus:border-purple-500 transition-all duration-300 bg-white shadow-sm hover:shadow-md"
              />
            </div>
          </div>
          
          {/* Sıralama */}
          <div className="md:w-48">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-300 focus:border-purple-500 transition-all duration-300 bg-white shadow-sm hover:shadow-md"
            >
              <option value="default">Varsayılan Sıralama</option>
              <option value="name">İsme Göre (A-Z)</option>
              <option value="popularity">Popülerliğe Göre</option>
            </select>
          </div>
        </div>
        
        {/* Filtreleme Sonuçları */}
        {searchTerm && (
          <div className="text-center">
            <p className="text-sm text-gray-600">
              "{searchTerm}" için {allNames.length} sonuç bulundu
            </p>
          </div>
        )}
      </div>

      {/* İstatistikler */}
      <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-800">{filteredAndSortedResults.length}</div>
            <div className="text-sm text-gray-600">Görünen İsim</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-800">{blurredNames.length}</div>
            <div className="text-sm text-gray-600">Premium İsim</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-800">
              {filteredAndSortedResults.filter(n => n.popularity === 'modern').length}
            </div>
            <div className="text-sm text-gray-600">Modern</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-800">
              {filteredAndSortedResults.filter(n => n.popularity === 'unique').length}
            </div>
            <div className="text-sm text-gray-600">Benzersiz</div>
          </div>
        </div>
      </div>

      {/* İsim Kartları */}
      <div className="mobile-grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
        {currentNames.map((name, index) => {
          const isBlurred = isNameBlurred(name);
          
          return (
                                      <div
              key={`${name.name}-${index}`}
              className={`modern-card group relative ${isBlurred ? 'cursor-pointer premium-card' : 'normal-card'}`}
              onClick={isBlurred ? handleBlurredCardClick : undefined}
            >
              {/* Premium Badge */}
              {isBlurred && (
                <div className="absolute top-3 right-3 z-20">
                  <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1 shadow-lg animate-pulse">
                    <Crown className="w-3 h-3" />
                    <span>Premium</span>
                  </div>
                </div>
              )}

              {/* Elegant Premium Overlay */}
              {isBlurred && (
                <div className="absolute inset-0 bg-gradient-to-br from-purple-50/95 via-pink-50/95 to-blue-50/95 backdrop-blur-sm rounded-xl flex items-center justify-center" onClick={handleBlurredCardClick}>
                  <div className="text-center p-6 max-w-xs">
                    <div className="relative mb-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center mx-auto shadow-2xl">
                        <Lock className="w-8 h-8 text-white" />
                      </div>
                      <div className="absolute -top-1 -right-1 animate-bounce">
                        <Crown className="w-6 h-6 text-yellow-500" />
                      </div>
                    </div>
                    <h4 className="text-lg font-bold text-gray-800 mb-2">
                      Premium İçerik
                    </h4>
                    <p className="text-gray-600 text-sm font-medium mb-4 leading-relaxed">
                      Bu özel isim Premium üyeler için ayrılmıştır. Sınırsız erişim için üyelik alın!
                    </p>
                    <button
                      className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-bold rounded-xl hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center space-x-2 mx-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        onShowPremiumUpgrade();
                      }}
                    >
                      <Crown className="w-4 h-4" />
                      <span>Premium Ol</span>
                      <Sparkles className="w-4 h-4" />
                    </button>
                    <p className="text-xs text-gray-500 mt-2">
                      Sadece $7.99/ay • İstediğin zaman iptal et
                    </p>
                  </div>
                </div>
              )}

              {/* İçerik */}
              <div className={isBlurred ? 'opacity-30' : ''}>
                {/* İsim */}
                <div className="text-center mb-4">
                  <h3 className="mobile-text-2xl font-bold text-gray-800 mb-3">
                    {name.name}
                  </h3>
                  
                  {/* Popülerlik Badge */}
                  {name.popularity && (
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getPopularityColor(name.popularity)}`}>
                      {name.popularity}
                    </span>
                  )}
                </div>

                {/* Anlam */}
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <BookOpen className="w-4 h-4 mr-2 text-purple-500" />
                    Anlamı
                  </h4>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {name.meaning}
                  </p>
                </div>

                {/* İsim Bilgileri */}
                <div className="mb-4 space-y-2">
                  {/* Cinsiyet */}
                  {name.gender && (
                    <div className="flex items-center text-xs text-gray-500">
                      <span className="font-medium mr-2">Cinsiyet:</span>
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        {getGenderLabel(name.gender)}
                      </span>
                    </div>
                  )}
                  
                  {/* Dil */}
                  {name.language && (
                    <div className="flex items-center text-xs text-gray-500">
                      <span className="font-medium mr-2">Dil:</span>
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full">
                        {getLanguageLabel(name.language)}
                      </span>
                    </div>
                  )}
                  
                  {/* Tema */}
                  {name.theme && (
                    <div className="flex items-center text-xs text-gray-500">
                      <span className="font-medium mr-2">Tema:</span>
                      <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                        {getThemeLabel(name.theme)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Köken */}
                {name.origin && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                      {getOriginIcon(name.origin)}
                      <span className="ml-2">Köken</span>
                    </h4>
                    <p className="text-gray-600 text-sm">
                      {name.origin}
                    </p>
                  </div>
                )}

                {/* Aksiyon Butonları */}
                <div className="pt-4 border-t border-gray-100 space-y-2">
                  {/* İlk Satır - Favorilere Ekle ve Kopyala */}
                  <div className="flex space-x-2">
                    <button
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToFavorites(name);
                      }}
                      title={user ? "Favorilere ekle" : "Favori eklemek için giriş yapın"}
                    >
                      <Heart className="w-4 h-4" />
                      <span className="hidden sm:inline">{user ? "Favorilere Ekle" : "Giriş Gerekli"}</span>
                      <span className="sm:hidden">Favori</span>
                    </button>
                  
                    <button
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyName(name.name);
                      }}
                    >
                      <span>📋 Kopyala</span>
                    </button>
                  </div>
                  
                  {/* İkinci Satır - Analiz (Tam Genişlik) */}
                  <button
                    className="w-full bg-gray-800 hover:bg-gray-700 text-white py-3 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAnalyzeName(name.name, name.language || 'turkish');
                    }}
                    title="İsmin detaylı analizini görüntüle"
                  >
                    <Search className="w-4 h-4" />
                    <span>🔍 Detaylı Analiz</span>
                  </button>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-200">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Popülerlik: {name.popularity || 'Orta'}</span>
                    <span>#{startIndex + index + 1}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Alt Bilgi */}
      <div className="mt-12 text-center">
        <div className="bg-gray-50 rounded-lg p-6 mobile-card">
          <h3 className="mobile-text-xl font-semibold text-gray-800 mb-2">
            İpuçları
          </h3>
          <div className="mobile-grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div>
              <p className="font-medium mb-1">İsim Seçerken</p>
              <p>Telaffuzu kolay, anlamı güzel isimleri tercih edin</p>
            </div>
            <div>
              <p className="font-medium mb-1">Favori Sistemi</p>
              <p>Beğendiğiniz isimleri kaydedin, sonra karşılaştırın</p>
            </div>
            <div>
              <p className="font-medium mb-1">Yeni İsimler</p>
              <p>Farklı temalar deneyerek daha fazla seçenek bulun</p>
            </div>
          </div>
        </div>
      </div>

      {/* Name Analysis Modal */}
      {showAnalysis && analysisName && (
        <NameAnalysis
          name={analysisName}
          language={analysisLanguage}
          onClose={closeAnalysis}
          onShowToast={onShowToast}
        />
      )}

      {/* Sayfalama */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center space-x-2">
          {/* Önceki Sayfa */}
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={`p-2 rounded-lg transition-colors duration-200 ${
              currentPage === 1
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white hover:bg-gray-50 text-gray-600 border border-gray-200'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Sayfa Numaraları */}
          <div className="flex space-x-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  currentPage === page
                    ? 'bg-blue-600 text-white'
                    : 'bg-white hover:bg-gray-50 text-gray-600 border border-gray-200'
                }`}
              >
                {page}
              </button>
            ))}
          </div>

          {/* Sonraki Sayfa */}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`p-2 rounded-lg transition-colors duration-200 ${
              currentPage === totalPages
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white hover:bg-gray-50 text-gray-600 border border-gray-200'
            }`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Sayfa Bilgisi */}
      {totalPages > 1 && (
        <div className="mt-4 text-center text-sm text-gray-500">
          Sayfa {currentPage} / {totalPages} • Toplam {results.length} isim
        </div>
      )}

      {/* Premium Mesajı */}
      {isPremiumRequired && premiumMessage && (
        <div className="mt-8 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-6 text-center">
          <div className="flex items-center justify-center mb-4">
            <Crown className="w-8 h-8 text-purple-500 mr-3" />
            <h3 className="text-xl font-bold text-gray-800">Premium Özellikler</h3>
          </div>
          <p className="text-gray-700 mb-4">{premiumMessage}</p>
          <div className="grid md:grid-cols-3 gap-4 mb-6 text-sm">
            <div className="flex items-center">
              <Check className="w-5 h-5 text-green-500 mr-2" />
              <span>Sınırsız isim önerisi</span>
            </div>
            <div className="flex items-center">
              <Check className="w-5 h-5 text-green-500 mr-2" />
              <span>Detaylı isim analizi</span>
            </div>
            <div className="flex items-center">
              <Check className="w-5 h-5 text-green-500 mr-2" />
              <span>Kültürel bağlam analizi</span>
            </div>
            <div className="flex items-center">
              <Check className="w-5 h-5 text-green-500 mr-2" />
              <span>Popülerlik tahmini</span>
            </div>
            <div className="flex items-center">
              <Check className="w-5 h-5 text-green-500 mr-2" />
              <span>Benzer isimler</span>
            </div>
            <div className="flex items-center">
              <Check className="w-5 h-5 text-green-500 mr-2" />
              <span>Gelişmiş trendler</span>
            </div>
          </div>
          <button
            onClick={onShowPremiumUpgrade}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center mx-auto space-x-2"
          >
            <Crown className="w-5 h-5" />
            <span>Premium Ol</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default NameResults; 