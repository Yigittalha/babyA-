import React, { useState, useEffect } from 'react';
import { TrendingUp, Calendar, Star, Users, Globe, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { getGlobalTrends } from '../services/api';

const TrendAnalysis = () => {
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('all');

  useEffect(() => {
    fetchTrends();
  }, []);

  const fetchTrends = async () => {
    try {
      setLoading(true);
      const response = await getGlobalTrends();
      if (response.success) {
        setTrends(response);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError('Trend verileri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const getLanguageLabel = (language) => {
    const labels = {
      'turkish': '🇹🇷 Türkçe',
      'english': '🇬🇧 İngilizce',
      'arabic': '🇸🇦 Arapça',
      'persian': '🇮🇷 Farsça',
      'french': '🇫🇷 Fransızca',
      'german': '🇩🇪 Almanca',
      'spanish': '🇪🇸 İspanyolca'
    };
    return labels[language] || language;
  };

  const getTrendIcon = (change) => {
    if (change.includes('Yükselen') || change.includes('Rising')) {
      return <ArrowUp className="w-4 h-4 text-green-500" />;
    } else if (change.includes('Düşen') || change.includes('Declining')) {
      return <ArrowDown className="w-4 h-4 text-red-500" />;
    } else {
      return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTrendColor = (score) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-blue-600';
    if (score >= 0.4) return 'text-yellow-600';
    return 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Global trend analizi yükleniyor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="text-red-500 text-6xl mb-4">⚠️</div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Hata</h3>
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  const filteredTrends = selectedLanguage === 'all' 
    ? (trends?.trends_by_language || [])
    : (trends?.trends_by_language || []).filter(t => t.language === selectedLanguage);

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Globe className="w-8 h-8 text-purple-500 mr-3" />
          <h2 className="text-2xl font-bold text-gray-800">Global İsim Trendleri</h2>
        </div>
        <div className="flex items-center space-x-2">
          <select 
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">🌍 Tüm Diller</option>
            {(trends?.trends_by_language || []).map(lang => (
              <option key={lang.language} value={lang.language}>
                {getLanguageLabel(lang.language)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Global En Popüler İsimler */}
      {trends?.global_top_names && trends.global_top_names.length > 0 && (
        <div className="mb-8 bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-100">
          <div className="flex items-center mb-4">
            <Star className="w-6 h-6 text-purple-500 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">🌍 Global En Popüler İsimler</h3>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(trends?.global_top_names || []).slice(0, 9).map((trend, index) => (
              <div key={trend.name} className="bg-white p-4 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-800">{trend.name}</span>
                  <span className="text-sm text-purple-600 font-medium">#{index + 1}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{getLanguageLabel(trend.language)}</span>
                  <div className="flex items-center">
                    {getTrendIcon(trend.popularity_change)}
                    <span className="ml-1 text-xs">{trend.popularity_change}</span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  <div className="font-medium">{trend.meaning}</div>
                  <div className="mt-1">{trend.origin}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dil Bazlı Trendler */}
      <div className="space-y-6">
        {filteredTrends.map(languageTrend => (
          <div key={languageTrend.language} className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100">
            <div className="flex items-center mb-4">
              <div className="text-2xl mr-3">{getLanguageLabel(languageTrend.language).split(' ')[0]}</div>
              <h3 className="text-lg font-semibold text-gray-800">{languageTrend.language_name} Trendleri</h3>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {languageTrend.trends.slice(0, 6).map((trend, index) => (
                <div key={trend.name} className="bg-white p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-800">{trend.name}</span>
                    <div className="flex items-center space-x-1">
                      <span className={`text-sm font-medium ${getTrendColor(trend.trend_score)}`}>
                        {(trend.trend_score * 100).toFixed(0)}%
                      </span>
                      {getTrendIcon(trend.popularity_change)}
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-600 mb-2">
                    <div className="font-medium">{trend.meaning}</div>
                    <div className="mt-1">{trend.origin}</div>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    <div className="font-medium">Kültürel Bağlam:</div>
                    <div>{trend.cultural_context}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 text-center text-sm text-gray-500">
        <Calendar className="w-4 h-4 inline mr-1" />
        Son güncelleme: {new Date().toLocaleDateString('tr-TR')} | 
        <span className="ml-2">Toplam {trends?.total_languages || 0} dil analiz edildi</span>
      </div>
    </div>
  );
};

export default TrendAnalysis; 