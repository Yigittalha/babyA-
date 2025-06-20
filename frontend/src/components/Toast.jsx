import React, { useEffect } from 'react';
import { Heart, X, CheckCircle, AlertCircle } from 'lucide-react';

const Toast = ({ message, type = 'success', onClose, duration = 3000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  // message bir object olabilir
  const messageText = typeof message === 'object' ? message.message : message;
  const messageType = typeof message === 'object' ? message.type : type;

  const getIcon = () => {
    switch (messageType) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'favorite':
        return <Heart className="w-5 h-5 text-pink-500 fill-current" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
  };

  const getBgColor = () => {
    switch (messageType) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'favorite':
        return 'bg-pink-50 border-pink-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-green-50 border-green-200';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in mobile-toast">
      <div className={`${getBgColor()} border rounded-lg shadow-lg p-4 max-w-sm w-full backdrop-blur-sm bg-opacity-95 mobile-card`}>
        <div className="flex items-center space-x-3">
          {getIcon()}
          <p className="text-sm font-medium text-gray-800 flex-1 mobile-text-lg">{messageText}</p>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors touch-button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toast; 