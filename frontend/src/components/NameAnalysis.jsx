import React, { useState, useCallback, useMemo } from 'react';
import { BookOpen, Globe, Star, Users, TrendingUp, Languages, Award, Lightbulb, Volume2, Info, Loader2 } from 'lucide-react';
import { apiService } from '../services/api';

const NameAnalysis = ({ name, language, onClose, onShowToast }) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Name prop'unun geçerli olup olmadığını kontrol et
  const isValidName = name && typeof name === 'string' && name.trim().length > 0;

  const analyzeName = useCallback(async () => {
    // Name prop'unun geçerli olup olmadığını kontrol et
    if (!isValidName) {
      console.error('❌ Invalid name provided:', name);
      setError('Geçerli bir isim sağlanmadı');
      onShowToast({ message: 'Geçerli bir isim sağlanmadı', type: 'error' });
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Starting name analysis...');
      console.log('📝 Name:', name);
      console.log('🌍 Language:', language);
      console.log('📊 Name length:', name?.length);
      console.log('📊 Name trimmed:', name?.trim()?.length);

      const data = await apiService.analyzeName(name, language);
      console.log('✅ Analysis data received:', data);
      
      if (data && (data.analysis || data)) {
        setAnalysis(data.analysis || data);
        onShowToast({ message: `"${name}" analizi tamamlandı! 📚`, type: 'success' });
        setRetryCount(0); // Reset retry count on success
      } else {
        throw new Error('Geçersiz analiz verisi');
      }

    } catch (error) {
      console.error('❌ Analysis error:', error);
      console.error('❌ Error response:', error.response);
      console.error('❌ Error status:', error.response?.status);
      console.error('❌ Error data:', error.response?.data);
      setError('İsim analizi sırasında hata oluştu');
      onShowToast({ message: 'Analiz başarısız', type: 'error' });
      setRetryCount(prev => prev + 1);
    } finally {
      setLoading(false);
    }
  }, [name, language, onShowToast, isValidName]);

  const getIcon = useCallback((type) => {
    const icons = {
      origin: <Globe className="w-5 h-5" />,
      meaning: <BookOpen className="w-5 h-5" />,
      cultural_context: <Users className="w-5 h-5" />,
      characteristics: <Star className="w-5 h-5" />,
      popularity: <TrendingUp className="w-5 h-5" />,
      variations: <Languages className="w-5 h-5" />,
      famous_people: <Award className="w-5 h-5" />,
      modern_perception: <Lightbulb className="w-5 h-5" />,
      pronunciation: <Volume2 className="w-5 h-5" />,
      recommendations: <Info className="w-5 h-5" />
    };
    return icons[type] || <Info className="w-5 h-5" />;
  }, []);

  const getLabel = useCallback((type) => {
    const labels = {
      origin: 'Köken ve Etimoloji',
      meaning: 'Anlam ve Yorumlama',
      cultural_context: 'Kültürel Bağlam',
      characteristics: 'Karakteristik Özellikler',
      popularity: 'Popülerlik ve Kullanım',
      variations: 'Varyasyonlar',
      famous_people: 'Tarihi Figürler',
      modern_perception: 'Modern Kullanım',
      pronunciation: 'Telaffuz',
      recommendations: 'Öneriler'
    };
    return labels[type] || type;
  }, []);

  const canRetry = useMemo(() => retryCount < 3, [retryCount]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto mobile-card">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mobile-text-xl">
              📚 "{name}" Detaylı Analizi
            </h2>
            <p className="text-gray-600 mobile-text-lg">
              Yapay zeka ile kapsamlı isim analizi
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors touch-button p-2 rounded-lg hover:bg-gray-100"
            disabled={loading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!isValidName && (
            <div className="text-center py-8">
              <div className="text-red-500 text-6xl mb-4">⚠️</div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                Geçersiz İsim
              </h3>
              <p className="text-gray-600 mb-4">
                Analiz için geçerli bir isim sağlanmadı. Lütfen tekrar deneyin.
              </p>
              <button
                onClick={onClose}
                className="bg-gray-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-600 transition-colors"
              >
                Kapat
              </button>
            </div>
          )}

          {isValidName && !analysis && !loading && (
            <div className="text-center py-8">
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full mb-4">
                  <BookOpen className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  Detaylı Analiz Başlat
                </h3>
                <p className="text-gray-600 mb-6">
                  "{name}" isminin kökeni, anlamı, kültürel bağlamı ve daha fazlasını öğrenin
                </p>
              </div>
              <button
                onClick={analyzeName}
                disabled={loading}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-200 touch-button disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Analiz Yapılıyor...</span>
                  </div>
                ) : (
                  'Analizi Başlat'
                )}
              </button>
            </div>
          )}

          {isValidName && loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                Analiz Yapılıyor...
              </h3>
              <p className="text-gray-500 mb-4">
                Yapay zeka "{name}" ismini detaylı olarak analiz ediyor
              </p>
              <div className="flex justify-center space-x-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            </div>
          )}

          {isValidName && error && (
            <div className="text-center py-8">
              <div className="text-red-500 text-6xl mb-4">❌</div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                Analiz Başarısız
              </h3>
              <p className="text-gray-600 mb-4">{error}</p>
              {canRetry ? (
                <button
                  onClick={analyzeName}
                  disabled={loading}
                  className="bg-blue-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors touch-button disabled:opacity-50"
                >
                  Tekrar Dene ({3 - retryCount} deneme kaldı)
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-red-600">Maksimum deneme sayısına ulaşıldı</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="bg-gray-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-600 transition-colors"
                  >
                    Sayfayı Yenile
                  </button>
                </div>
              )}
            </div>
          )}

          {isValidName && analysis && (
            <div className="space-y-6">
              {/* Analiz Sonuçları */}
              {(() => {
                try {
                  if (!analysis || typeof analysis !== 'object') {
                    console.error('Invalid analysis data:', analysis);
                    return (
                      <div className="text-center py-8">
                        <p className="text-red-600">Analiz verisi geçersiz format</p>
                      </div>
                    );
                  }
                  
                  return Object.entries(analysis).map(([key, value]) => (
                    <div key={key} className="bg-gray-50 rounded-lg p-4 mobile-card hover:shadow-md transition-shadow">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="text-blue-600">
                          {getIcon(key)}
                        </div>
                        <h4 className="text-lg font-semibold text-gray-800 mobile-text-lg">
                          {getLabel(key)}
                        </h4>
                      </div>
                      
                      {Array.isArray(value) ? (
                        <div className="space-y-2">
                          {value.length > 0 ? (
                            value.map((item, index) => (
                              <div key={index} className="bg-white rounded-lg p-3 border border-gray-200 hover:border-blue-300 transition-colors">
                                <span className="text-gray-700">{item}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-gray-500 italic">Bilgi bulunamadı</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-700 leading-relaxed mobile-text-lg">
                          {value}
                        </p>
                      )}
                    </div>
                  ));
                } catch (error) {
                  console.error('Error rendering analysis:', error);
                  return (
                    <div className="text-center py-8">
                      <p className="text-red-600">Analiz görüntülenirken hata oluştu</p>
                      <button
                        onClick={() => window.location.reload()}
                        className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-lg"
                      >
                        Sayfayı Yenile
                      </button>
                    </div>
                  );
                }
              })()}

              {/* Alt Bilgi */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 mobile-card">
                <h4 className="font-semibold text-gray-800 mb-2 mobile-text-lg">
                  💡 Analiz Hakkında
                </h4>
                <p className="text-gray-600 text-sm mobile-text-lg">
                  Bu analiz yapay zeka teknolojisi kullanılarak oluşturulmuştur. 
                  Bilgiler genel kaynaklardan derlenmiştir ve kültürel farklılıklar olabilir.
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