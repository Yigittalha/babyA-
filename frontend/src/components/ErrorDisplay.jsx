import React from 'react';
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react';

const ErrorDisplay = ({ error, onRetry, onGenerateNew }) => {
  if (!error) return null;

  const getErrorIcon = () => {
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

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card border-red-200 bg-red-50">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            {getErrorIcon()}
          </div>
          
          <h3 className="text-xl font-bold text-red-800 mb-2">
            {getErrorTitle()}
          </h3>
          
          <p className="text-red-700 mb-6">
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