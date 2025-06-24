import React, { useState, useCallback, useMemo } from 'react';
import { BookOpen, Globe, Star, Users, TrendingUp, Languages, Award, Lightbulb, Volume2, Info, Loader2, Crown, Zap, Target } from 'lucide-react';
import { apiService } from '../services/api';

const NameAnalysis = ({ name, language, user, onClose, onShowToast, onShowPremiumUpgrade }) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Name prop'unun geçerli olup olmadığını kontrol et
  const isValidName = name && typeof name === 'string' && name.trim().length > 0;

  const analyzeName = useCallback(async () => {
    // Name prop'unun geçerli olup olmadığını kontrol et
    if (!isValidName) {
      setError('Geçerli bir isim sağlanmadı');
      onShowToast({ message: 'Geçerli bir isim sağlanmadı', type: 'error' });
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await apiService.analyzeName(name, language);
      
      if (data && (data.analysis || data)) {
        const analysisData = data.analysis || data;
        console.log('🔍 Analiz API Response:', analysisData); // Debug için
        setAnalysis(analysisData);
        onShowToast({ message: `"${name}" analizi tamamlandı! 📚`, type: 'success' });
        setRetryCount(0); // Reset retry count on success
      } else {
        throw new Error('Geçersiz analiz verisi');
      }

    } catch (error) {
      setError('İsim analizi sırasında hata oluştu');
      onShowToast({ message: 'Analiz başarısız', type: 'error' });
      setRetryCount(prev => prev + 1);
    } finally {
      setLoading(false);
    }
  }, [name, language, onShowToast, isValidName]);

  const getIcon = useCallback((type) => {
    const icons = {
      name: <Star className="w-6 h-6" />,
      meaning: <BookOpen className="w-6 h-6" />,
      origin: <Globe className="w-6 h-6" />,
      personality_traits: <Users className="w-6 h-6" />,
      popularity_stats: <TrendingUp className="w-6 h-6" />,
      digital_footprint: <Globe className="w-6 h-6" />,
      family_harmony: <Users className="w-6 h-6" />,
      celebrity_analysis: <Award className="w-6 h-6" />,
      trend_prediction: <Target className="w-6 h-6" />,
      uniqueness_analysis: <Zap className="w-6 h-6" />,
      numerology: <Star className="w-6 h-6" />,
      cultural_depth: <Languages className="w-6 h-6" />,
      // Legacy support
      popularity: <TrendingUp className="w-6 h-6" />,
      lucky_numbers: <Star className="w-6 h-6" />,
      lucky_colors: <Crown className="w-6 h-6" />,
      compatible_names: <Users className="w-6 h-6" />,
      famous_people: <Award className="w-6 h-6" />,
      cultural_significance: <Languages className="w-6 h-6" />,
      alternative_spellings: <Languages className="w-6 h-6" />
    };
    return icons[type] || <Info className="w-6 h-6" />;
  }, []);

  const getLabel = useCallback((type) => {
    const labels = {
      name: 'İsim',
      meaning: '📖 Anlam ve Köken',
      origin: '🌍 Tarihsel Köken', 
      personality_traits: '🧠 Kişilik Analizi',
      popularity_stats: '📊 Popülerlik Verileri',
      digital_footprint: '💻 Dijital Ayak İzi',
      family_harmony: '👨‍👩‍👧‍👦 Aile Uyumu',
      celebrity_analysis: '⭐ Ünlü Kişiler',
      trend_prediction: '🔮 Gelecek Trendleri',
      uniqueness_analysis: '💎 Benzersizlik Puanı',
      numerology: '🔢 Numeroloji',
      cultural_depth: '🏛️ Kültürel Analiz',
      // Legacy support
      popularity: 'Popülerlik',
      lucky_numbers: 'Şanslı Sayılar',
      lucky_colors: 'Şanslı Renkler',
      compatible_names: 'Uyumlu İsimler',
      famous_people: 'Tarihi Figürler',
      cultural_significance: 'Kültürel Önemi',
      alternative_spellings: 'Alternatif Yazımlar'
    };
    return labels[type] || type;
  }, []);

  const canRetry = useMemo(() => retryCount < 3, [retryCount]);

  // Object'leri render edilebilir formata çeviren fonksiyon
  const renderValue = useCallback((value) => {
    if (value === null || value === undefined) {
      return 'Bilgi bulunamadı';
    }

    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === 'object') {
      // Türkçe çeviriler için mapping
      const turkishLabels = {
        'turkey_2024': 'Türkiye Verileri',
        'trend_direction': 'Trend Yönü',
        'domain_available': 'Domain Durumu',
        'social_sentiment': 'Sosyal Medya',
        'famous_2024': 'Güncel Ünlüler',
        'historical_figures': 'Tarihi Kişiler',
        'popularity_score': 'Popülerlik',
        'uniqueness_score': 'Benzersizlik',
        'cultural_significance': 'Kültürel Önem',
        'numerology_number': 'Numeroloji Sayısı',
        'lucky_number': 'Şanslı Sayı',
        'personality_match': 'Kişilik Uyumu',
        'age_groups': 'Yaş Grupları',
        'regional_preference': 'Bölgesel Tercih',
        'global_ranking': 'Küresel Sıralama',
        'username_availability': 'Kullanıcı Adı',
        'google_search_volume': 'Arama Hacmi',
        'digital_reputation': 'Dijital İtibar',
        'sibling_compatibility': 'Kardeş Uyumu',
        'family_sound_harmony': 'Ses Uyumu',
        'generational_appeal': 'Nesil Uyumu',
        'nickname_potential': 'Lakap Potansiyeli',
        'positive_associations': 'Olumlu Çağrışımlar',
        'differentiation_factor': 'Ayırt Edici Özellik',
        'memorability_score': 'Hatırlanabilirlik',
        'pronunciation_ease': 'Telaffuz Kolaylığı',
        'life_path_influence': 'Yaşam Etkisi',
        'lucky_elements': 'Şanslı Unsurlar',
        'energy_type': 'Enerji Türü',
        'turkish_culture': 'Türk Kültürü',
        'islamic_significance': 'Dini Anlam',
        'modern_interpretation': 'Modern Yorumu',
        'cross_cultural_appeal': 'Kültürler Arası'
      };

      // Object'in key-value'larını basit liste formatında göster
      return Object.entries(value)
        .map(([key, val]) => {
          const keyLabel = turkishLabels[key] || key.replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
          
          if (typeof val === 'string' || typeof val === 'number') {
            return `• ${keyLabel}: ${val}`;
          } else if (typeof val === 'boolean') {
            return `• ${keyLabel}: ${val ? 'Evet' : 'Hayır'}`;
          } else if (Array.isArray(val)) {
            return `• ${keyLabel}: ${val.join(', ')}`;
          } else {
            return `• ${keyLabel}: ${JSON.stringify(val)}`;
          }
        })
        .join('\n');
    }

    return String(value);
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-full sm:max-w-6xl lg:max-w-7xl w-full max-h-[98vh] sm:max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start sm:items-center p-4 sm:p-6 lg:p-8 border-b border-gray-200 sticky top-0 bg-white z-10 rounded-t-xl sm:rounded-t-2xl">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-800 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <span className="break-words">📚 "{name}" Detaylı Analizi</span>
              <span className="text-xs sm:text-sm lg:text-base bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700 px-2 py-1 sm:px-3 sm:py-1 rounded-full font-medium inline-block w-fit">
                AI Destekli
              </span>
            </h2>
            <p className="text-sm sm:text-base lg:text-lg text-gray-600 mt-1 sm:mt-2">
              Kültürel köken, anlam keşfi ve gelecek trendi analizi
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 sm:p-3 rounded-xl hover:bg-gray-100 ml-2 flex-shrink-0"
            disabled={loading}
          >
            <svg className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 lg:p-8">
          {!isValidName && (
            <div className="text-center py-8 sm:py-12">
              <div className="text-red-500 text-5xl sm:text-6xl lg:text-8xl mb-4 sm:mb-6">⚠️</div>
              <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-700 mb-2 sm:mb-3">
                Geçersiz İsim
              </h3>
              <p className="text-sm sm:text-base lg:text-lg text-gray-600 mb-4 sm:mb-6">
                Analiz için geçerli bir isim sağlanmadı. Lütfen tekrar deneyin.
              </p>
              <button
                onClick={onClose}
                className="bg-gray-500 text-white px-6 sm:px-8 py-2 sm:py-3 rounded-lg sm:rounded-xl font-medium hover:bg-gray-600 transition-colors text-sm sm:text-base lg:text-lg"
              >
                Kapat
              </button>
            </div>
          )}

          {isValidName && !analysis && !loading && (
            <div className="text-center py-8 sm:py-12 lg:py-16">
              <div className="mb-8 sm:mb-12">
                {/* Hero Icon */}
                <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 bg-gradient-to-r from-purple-100 to-blue-100 rounded-full mb-6 sm:mb-8 shadow-lg">
                  <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-purple-600" />
                </div>
                
                {/* Main Title */}
                <div className="mb-4 sm:mb-6">
                  <div className="inline-flex items-center bg-gradient-to-r from-green-100 to-blue-100 px-4 py-2 sm:px-6 sm:py-3 rounded-full mb-4 sm:mb-6">
                    <span className="text-xl sm:text-2xl lg:text-3xl mr-2 sm:mr-3">🆓</span>
                    <span className="text-green-700 font-bold text-sm sm:text-lg lg:text-xl">ÜCRETSİZ ÖN İZLEME</span>
                  </div>
                </div>
                
                {/* Name Title */}
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 mb-4 sm:mb-6 break-words">
                  "{name}" İsim Analizi
                </h3>
                
                {/* Description */}
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 mb-8 sm:mb-12 mx-auto border border-purple-200">
                  <p className="text-gray-700 text-sm sm:text-lg lg:text-xl leading-relaxed mb-4 sm:mb-6">
                    🔍 <strong>Özel analizler:</strong> İsmin popülerlik verileri, dijital ayak izi, ünlü kişiler ve benzersizlik analizi
                  </p>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600">
                      <div className="flex items-center justify-center p-2 sm:p-3 bg-white rounded-lg border border-green-200">
                        <span className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full mr-2"></span>
                        <span className="text-center">Anlam ve Köken</span>
                      </div>
                      <div className="flex items-center justify-center p-2 sm:p-3 bg-white rounded-lg border border-blue-200">
                        <span className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-500 rounded-full mr-2"></span>
                        <span className="text-center">Kişilik Analizi</span>
                      </div>
                      <div className="flex items-center justify-center p-2 sm:p-3 bg-white rounded-lg border border-purple-200">
                        <span className="w-2 h-2 sm:w-3 sm:h-3 bg-purple-500 rounded-full mr-2"></span>
                        <span className="text-center">Popülerlik Verileri</span>
                      </div>
                      <div className="flex items-center justify-center p-2 sm:p-3 bg-white rounded-lg border border-orange-200">
                        <span className="w-2 h-2 sm:w-3 sm:h-3 bg-orange-500 rounded-full mr-2"></span>
                        <span className="text-center">Gelecek Trendleri</span>
                      </div>
                    </div>
                </div>
              </div>
              
              {/* CTA Button */}
              <button
                onClick={analyzeName}
                disabled={loading}
                className="bg-gradient-to-r from-purple-600 via-purple-700 to-blue-600 text-white px-8 py-3 sm:px-12 sm:py-4 lg:px-16 lg:py-5 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg lg:text-xl hover:from-purple-700 hover:via-purple-800 hover:to-blue-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl transform hover:scale-105 w-full sm:w-auto"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2 sm:space-x-4">
                    <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 animate-spin" />
                    <span>Analiz Yapılıyor...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2 sm:space-x-4">
                    <span className="text-xl sm:text-2xl lg:text-3xl">🔍</span>
                    <span>ÜCRETSİZ ANALİZİ BAŞLAT</span>
                  </div>
                )}
              </button>
              
              {/* Trust Elements */}
              <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-6 lg:space-x-8 text-xs sm:text-sm text-gray-500">
                <div className="flex items-center">
                  <span className="text-green-500 mr-1 sm:mr-2 text-sm sm:text-lg">✓</span>
                  <span className="text-sm sm:text-base">Anında sonuç</span>
                </div>
                <div className="flex items-center">
                  <span className="text-green-500 mr-1 sm:mr-2 text-sm sm:text-lg">✓</span>
                  <span className="text-sm sm:text-base">Tamamen ücretsiz</span>
                </div>
                <div className="flex items-center">
                  <span className="text-green-500 mr-1 sm:mr-2 text-sm sm:text-lg">✓</span>
                  <span className="text-sm sm:text-base">AI destekli analiz</span>
                </div>
              </div>
            </div>
          )}

          {isValidName && loading && (
            <div className="text-center py-12 sm:py-16">
              <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-b-4 border-purple-600 mx-auto mb-4 sm:mb-6"></div>
              <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-700 mb-2 sm:mb-3">
                Analiz Yapılıyor...
              </h3>
              <p className="text-sm sm:text-base lg:text-lg text-gray-500 mb-4 sm:mb-6">
                Yapay zeka "{name}" ismini detaylı olarak analiz ediyor
              </p>
              <div className="flex justify-center space-x-2">
                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-purple-600 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-purple-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-purple-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            </div>
          )}

          {isValidName && error && (
            <div className="text-center py-8 sm:py-12">
              <div className="text-red-500 text-5xl sm:text-6xl lg:text-8xl mb-4 sm:mb-6">❌</div>
              <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-700 mb-2 sm:mb-3">
                Analiz Başarısız
              </h3>
              <p className="text-sm sm:text-base lg:text-lg text-gray-600 mb-4 sm:mb-6">{error}</p>
              {canRetry ? (
                <button
                  onClick={analyzeName}
                  disabled={loading}
                  className="bg-purple-500 text-white px-6 sm:px-8 py-2 sm:py-3 rounded-lg sm:rounded-xl font-medium hover:bg-purple-600 transition-colors disabled:opacity-50 text-sm sm:text-base lg:text-lg w-full sm:w-auto"
                >
                  Tekrar Dene ({3 - retryCount} deneme kaldı)
                </button>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  <p className="text-red-600 text-sm sm:text-base lg:text-lg">Maksimum deneme sayısına ulaşıldı</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-4 sm:mt-6 bg-purple-500 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl hover:bg-purple-600 transition-colors text-sm sm:text-base lg:text-lg"
                  >
                    Sayfayı Yenile
                  </button>
                </div>
              )}
            </div>
          )}

          {isValidName && analysis && (
            <div className="space-y-6 sm:space-y-8 lg:space-y-10">
              {/* Analysis Header */}
              <div className="text-center bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl sm:rounded-3xl p-6 sm:p-8 lg:p-10 border border-purple-200">
                <div className="inline-flex items-center bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 sm:px-6 sm:py-3 lg:px-8 lg:py-4 rounded-full font-bold text-sm sm:text-lg lg:text-xl shadow-lg mb-4 sm:mb-6">
                  <span className="text-lg sm:text-2xl lg:text-3xl mr-2 sm:mr-4">✅</span>
                  ANALİZ TAMAMLANDI
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 mb-2 sm:mb-4 break-words">
                  "{name}" İsim Analizi
                </h2>
                <p className="text-sm sm:text-lg lg:text-xl text-gray-600">
                  Yapay zeka tarafından hazırlanan profesyonel analiz raporu
                </p>
                
                {/* Stats Row */}
                <div className="flex flex-col sm:flex-row items-center justify-center mt-6 sm:mt-8 space-y-4 sm:space-y-0 sm:space-x-6 lg:space-x-12">
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-green-600">3</div>
                    <div className="text-xs sm:text-sm lg:text-base text-gray-500">Ücretsiz Alan</div>
                  </div>
                  <div className="hidden sm:block w-px h-8 sm:h-12 bg-gray-300"></div>
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-blue-600">8</div>
                    <div className="text-xs sm:text-sm lg:text-base text-gray-500">Token Gerekli</div>
                  </div>
                  <div className="hidden sm:block w-px h-8 sm:h-12 bg-gray-300"></div>
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-purple-600">11</div>
                    <div className="text-xs sm:text-sm lg:text-base text-gray-500">Toplam Analiz</div>
                  </div>
                </div>
              </div>

              {/* Analysis Results Grid */}
              <div className="grid gap-4 sm:gap-6 lg:gap-8 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">{(() => {
                try {
                  if (!analysis || typeof analysis !== 'object') {
                    return (
                      <div className="col-span-full text-center py-8 sm:py-12">
                        <p className="text-red-600 text-lg sm:text-xl">Analiz verisi geçersiz format</p>
                      </div>
                    );
                  }
                  
                  // Define all fields including NEW COMPETITIVE ADVANTAGE features
                  const allFields = [
                    'meaning', 'origin', 'personality_traits', // İlk 3 ücretsiz
                    'popularity_stats', 'digital_footprint', 'family_harmony', 'celebrity_analysis',
                    'trend_prediction', 'uniqueness_analysis', 'numerology', 'cultural_depth'
                  ];
                  
                  // Token sistemi için özel veriler
                  const tokenRequiredData = {
                    'popularity_stats': 'Gerçek popülerlik istatistikleri ve trend analizi...',
                    'digital_footprint': 'Domain ve sosyal medya müsaitlik kontrolü...',
                    'family_harmony': 'Kardeş isimleri ve aile uyum analizi...',
                    'celebrity_analysis': 'Ünlü kişiler ve medya eşleştirmeleri...',
                    'trend_prediction': 'Gelecek yıl trend tahminleri...',
                    'uniqueness_analysis': 'Benzersizlik skoru ve ayırt edici özellikler...',
                    'numerology': 'Detaylı numerolojik analiz...',
                    'cultural_depth': 'Türk kültürü ve dini anlam analizi...'
                  };

                  return allFields.map((key, index) => {
                    const hasRealData = analysis[key] !== undefined;
                    // Token sistemi: İlk 3 alan ücretsiz, kalanlar token gerektirir
                    const requiresTokens = index >= 3;
                    
                    let displayValue;
                    if (hasRealData) {
                      displayValue = analysis[key];
                    } else if (requiresTokens) {
                      displayValue = tokenRequiredData[key] || 'Token gerekli';
                    } else {
                      displayValue = 'Bilgi bulunamadı';
                    }
                    
                    return (
                      <div 
                        key={key} 
                        className={`relative rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 transition-all duration-300 group ${
                          requiresTokens 
                            ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 cursor-pointer hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 hover:shadow-xl hover:scale-102' 
                            : 'bg-white border-2 border-gray-200 hover:border-purple-300 hover:shadow-lg'
                        }`}
                        onClick={requiresTokens ? () => onShowPremiumUpgrade?.() : undefined}
                      >
                        {/* Free Badge */}
                        {!requiresTokens && (
                          <div className="absolute -top-2 -right-2 sm:-top-4 sm:-right-4">
                            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-2 py-1 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-bold shadow-lg">
                              ÜCRETSİZ
                            </div>
                          </div>
                        )}

                        {/* Token Required Badge */}
                        {requiresTokens && (
                          <div className="absolute -top-2 -right-2 sm:-top-4 sm:-right-4">
                            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-2 py-1 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-bold shadow-lg">
                              TOKEN
                            </div>
                          </div>
                        )}

                        {/* Card Content */}
                        <div className={requiresTokens ? 'opacity-70 filter blur-[1px] select-none' : ''}>
                          <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 mb-4 sm:mb-6">
                            <div className={`p-2 sm:p-3 lg:p-4 rounded-xl sm:rounded-2xl ${requiresTokens ? 'bg-blue-100' : 'bg-purple-100'} flex-shrink-0`}>
                              <div className={requiresTokens ? 'text-blue-600' : 'text-purple-600'}>
                                {getIcon(key)}
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm sm:text-lg lg:text-xl font-bold text-gray-800 leading-tight">
                                {getLabel(key)}
                              </h4>
                              <div className={`text-xs sm:text-sm font-medium ${requiresTokens ? 'text-blue-600' : 'text-green-600'} mt-1`}>
                                {requiresTokens ? 'Token Gerekli' : 'Ücretsiz'}
                              </div>
                            </div>
                          </div>
                          
                          {Array.isArray(displayValue) ? (
                            <div className="space-y-2 sm:space-y-3">
                              {displayValue.length > 0 ? (
                                displayValue.map((item, index) => (
                                  <div key={index} className={`rounded-lg sm:rounded-xl p-3 sm:p-4 ${requiresTokens ? 'bg-blue-50' : 'bg-gray-50'} border`}>
                                    <span className="text-gray-700 font-medium text-xs sm:text-sm lg:text-base leading-relaxed">{renderValue(item)}</span>
                                  </div>
                                ))
                              ) : (
                                <p className="text-gray-500 italic text-xs sm:text-sm lg:text-base">Bilgi bulunamadı</p>
                              )}
                            </div>
                          ) : (
                            <div className={`rounded-lg sm:rounded-xl p-3 sm:p-4 lg:p-5 ${requiresTokens ? 'bg-blue-50' : 'bg-gray-50'} border`}>
                              <p className="text-gray-700 leading-relaxed font-medium text-xs sm:text-sm lg:text-base whitespace-pre-line">
                                {renderValue(displayValue)}
                              </p>
                            </div>
                          )}

                          {/* Quality Indicator */}
                          <div className="mt-4 sm:mt-6 flex items-center justify-between">
                            <div className="flex items-center space-x-1">
                              {[...Array(requiresTokens ? 5 : 3)].map((_, i) => (
                                <div key={i} className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${requiresTokens ? 'bg-blue-400' : 'bg-green-400'}`}></div>
                              ))}
                            </div>
                            <div className={`text-xs sm:text-sm font-medium ${requiresTokens ? 'text-blue-600' : 'text-green-600'}`}>
                              {requiresTokens ? 'Detaylı Analiz' : 'Temel Analiz'}
                            </div>
                          </div>
                        </div>

                        {/* Token Required Click Overlay */}
                        {requiresTokens && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-2xl sm:rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="bg-white rounded-lg sm:rounded-xl px-3 py-2 sm:px-6 sm:py-3 shadow-lg">
                              <span className="text-blue-600 font-bold text-xs sm:text-sm lg:text-base">Token ile Aç</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  });

                } catch (error) {
                  console.error('Analysis rendering error:', error);
                  return (
                    <div className="col-span-full text-center py-8 sm:py-12">
                      <p className="text-red-600 text-lg sm:text-xl">Analiz gösteriminde hata oluştu</p>
                    </div>
                  );
                }
              })()}
              </div>

              {/* Token Purchase CTA */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl sm:rounded-3xl p-6 sm:p-8 lg:p-10 border-2 border-blue-200 text-center">
                <div className="mb-4 sm:mb-6">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 text-blue-500 mx-auto mb-3 sm:mb-4 text-4xl sm:text-5xl">
                    🪙
                  </div>
                  <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 mb-2 sm:mb-3">
                    8 Detaylı Analiz Kilitli
                  </h3>
                  <p className="text-sm sm:text-base lg:text-lg text-gray-600">
                    Token satın alarak tüm özel analizlere erişin
                  </p>
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                  <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 border border-blue-200">
                    <div className="text-blue-500 text-xl sm:text-2xl mb-1 sm:mb-2">📊</div>
                    <div className="text-xs sm:text-sm font-medium text-gray-700">Popülerlik Verileri</div>
                  </div>
                  <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 border border-blue-200">
                    <div className="text-blue-500 text-xl sm:text-2xl mb-1 sm:mb-2">💻</div>
                    <div className="text-xs sm:text-sm font-medium text-gray-700">Dijital Ayak İzi</div>
                  </div>
                  <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 border border-blue-200">
                    <div className="text-blue-500 text-xl sm:text-2xl mb-1 sm:mb-2">⭐</div>
                    <div className="text-xs sm:text-sm font-medium text-gray-700">Ünlü Kişiler</div>
                  </div>
                  <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 border border-blue-200">
                    <div className="text-blue-500 text-xl sm:text-2xl mb-1 sm:mb-2">🔮</div>
                    <div className="text-xs sm:text-sm font-medium text-gray-700">Gelecek Trendleri</div>
                  </div>
                </div>

                <button
                  onClick={() => onShowPremiumUpgrade?.()}
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-3 sm:px-10 sm:py-4 lg:px-12 lg:py-4 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-lg lg:text-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105 w-full sm:w-auto"
                >
                  <div className="flex items-center justify-center space-x-2 sm:space-x-3">
                    <span className="text-lg sm:text-xl">🪙</span>
                    <span className="break-words">Token Satın Al</span>
                  </div>
                </button>
                
                <p className="text-xs sm:text-sm text-gray-500 mt-3 sm:mt-4">
                  Uygun fiyatlı paketler • Anında kullanım
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NameAnalysis; 