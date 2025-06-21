import React, { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, Wifi, WifiOff, Crown, Clock, Heart } from 'lucide-react';

const ErrorDisplay = ({ error, onRetry, onGenerateNew, onPremiumUpgrade }) => {
  const [timeUntilReset, setTimeUntilReset] = useState('');

  // Günlük limit hatası kontrolü
  const isDailyLimitError = error.message?.includes('Günlük İsim Limitiniz Doldu') || 
                           error.message?.includes('Daily limit reached') ||
                           error.message?.includes('5/5 name generations');

  // Countdown timer - yarın saat 00:00'a kadar
  useEffect(() => {
    if (!isDailyLimitError) return;

    const updateCountdown = () => {
      const now = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const timeDiff = tomorrow.getTime() - now.getTime();
      
      if (timeDiff <= 0) {
        setTimeUntilReset('Haklar yenilendi! Sayfayı yenileyin 🎉');
        return;
      }
      
      const hours = Math.floor(timeDiff / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
      
      setTimeUntilReset(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [isDailyLimitError]);

  if (!error) return null;

  const getErrorIcon = () => {
    if (isDailyLimitError) {
      return <Clock className="w-12 h-12 text-yellow-500" />;
    }
    if (error.message?.includes('bağlanılamıyor') || error.message?.includes('internet')) {
      return <WifiOff className="w-8 h-8 text-red-500" />;
    }
    return <AlertTriangle className="w-8 h-8 text-red-500" />;
  };

  const getErrorTitle = () => {
    if (error.message?.includes('bağlanılamıyor') || error.message?.includes('internet')) {
      return 'Bağlantı Hatası';
    }
    if (error.message?.includes('çok fazla istek')) {
      return 'Rate Limit Aşıldı';
    }
    if (error.message?.includes('sunucu hatası')) {
      return 'Sunucu Hatası';
    }
    return 'Bir Hata Oluştu';
  };

  const getErrorDescription = () => {
    if (error.message?.includes('bağlanılamıyor') || error.message?.includes('internet')) {
      return 'İnternet bağlantınızı kontrol edin ve tekrar deneyin.';
    }
    if (error.message?.includes('çok fazla istek')) {
      return 'Çok fazla istek gönderdiniz. Lütfen birkaç dakika bekleyip tekrar deneyin.';
    }
    if (error.message?.includes('sunucu hatası')) {
      return 'Sunucumuzda geçici bir sorun var. Lütfen daha sonra tekrar deneyin.';
    }
    return error.message || 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.';
  };

  // Günlük limit hatası için özel UI
  if (isDailyLimitError) {
    return (
      <div className="max-w-2xl mx-auto" data-error-display>
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-2xl p-8 shadow-lg">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <Clock className="w-16 h-16 text-yellow-500" />
                <div className="absolute -top-2 -right-2 bg-yellow-400 rounded-full p-1">
                  <span className="text-xs font-bold text-yellow-800">5/5</span>
                </div>
              </div>
            </div>
            
            <h3 className="text-2xl font-bold text-yellow-800 mb-4">
              🚀 Günlük Limitiniz Doldu!
            </h3>
            
            <div className="bg-white/70 rounded-xl p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">5/5</div>
                  <div className="text-gray-600">Bugün Üretilen</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">∞</div>
                  <div className="text-gray-600">Premium İle</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600 font-mono">
                    {timeUntilReset || '00:00:00'}
                  </div>
                  <div className="text-gray-600">Haklar Yenilenir</div>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2 flex items-center">
                  <Heart className="w-4 h-4 mr-2" />
                  Şu an yapabilecekleriniz:
                </h4>
                <ul className="text-sm text-blue-700 space-y-1 text-left">
                  <li>• Favorilerinizi kontrol edin</li>
                  <li>• Mevcut isimleri detaylı analiz edin</li>
                  <li>• Yarın 5 yeni isim üretebilirsiniz</li>
                </ul>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-semibold text-purple-800 mb-2 flex items-center">
                  <Crown className="w-4 h-4 mr-2" />
                  Premium ile sınırsız:
                </h4>
                <ul className="text-sm text-purple-700 space-y-1 text-left">
                  <li>• Sınırsız isim üretimi</li>
                  <li>• Özel AI önerileri</li>
                  <li>• Detaylı analiz raporları</li>
                  <li>• Öncelikli destek</li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {onPremiumUpgrade && (
                <button
                  onClick={onPremiumUpgrade}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <Crown className="w-5 h-5" />
                                      <span>Premium'a Geç ($7.99/ay)</span>
                </button>
              )}
              
              <button
                onClick={() => window.location.reload()}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center space-x-2"
              >
                <Clock className="w-5 h-5" />
                <div className="text-center">
                  <div>Yarın 5 Yeni Hak</div>
                  <div className="text-xs opacity-70 font-mono">
                    {timeUntilReset || '00:00:00'}
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-6 p-4 bg-white/50 rounded-xl border border-gray-200">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">
                  ⏰ <strong>Haklar yenileniyor:</strong>
                </p>
                <div className="text-2xl font-mono font-bold text-green-600 bg-green-50 rounded-lg py-2 px-4 inline-block">
                  {timeUntilReset || '00:00:00'}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Yarın saat 00:00'da 5 yeni isim hakkınız olacak
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Normal hatalar için mevcut UI
  return (
    <div className="max-w-2xl mx-auto" data-error-display>
      <div className="card border-red-200 bg-red-50">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            {getErrorIcon()}
          </div>
          
          <h3 className="text-xl font-bold text-red-800 mb-2">
            {getErrorTitle()}
          </h3>
          
          <p className="text-red-700 mb-6 whitespace-pre-line">
            {getErrorDescription()}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {onRetry && (
              <button
                onClick={onRetry}
                className="btn-primary bg-red-600 hover:bg-red-700 flex items-center justify-center space-x-2"
              >
                <RefreshCw className="w-5 h-5" />
                <span>Tekrar Dene</span>
              </button>
            )}
            
            {onGenerateNew && (
              <button
                onClick={onGenerateNew}
                className="btn-secondary flex items-center justify-center space-x-2"
              >
                <Wifi className="w-5 h-5" />
                <span>Yeni İstek</span>
              </button>
            )}
          </div>

          {/* Teknik Detaylar (Development'ta göster) */}
          {import.meta.env.DEV && error.response && (
            <div className="mt-6 p-4 bg-red-100 rounded-lg text-left">
              <h4 className="text-sm font-semibold text-red-800 mb-2">
                Teknik Detaylar:
              </h4>
              <div className="text-xs text-red-700 space-y-1">
                <p><strong>Status:</strong> {error.response.status}</p>
                <p><strong>Status Text:</strong> {error.response.statusText}</p>
                <p><strong>URL:</strong> {error.config?.url}</p>
                {error.response.data && (
                  <p><strong>Response:</strong> {JSON.stringify(error.response.data, null, 2)}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorDisplay; 