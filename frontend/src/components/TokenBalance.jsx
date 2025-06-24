import React, { useState, useEffect, useCallback } from 'react';
import { Coins, TrendingUp, ShoppingCart, Clock, AlertCircle, Zap } from 'lucide-react';
import { apiService } from '../services/api';

const TokenBalance = ({ user, balance: propBalance, onPurchaseClick, compact = false }) => {
  const [internalBalance, setInternalBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [systemConfig, setSystemConfig] = useState(null);

  // Use prop balance if provided, otherwise fetch
  const balance = propBalance || internalBalance;

  // Debug logging
  console.log('🪙 TokenBalance Debug:', {
    user: !!user,
    propBalance,
    internalBalance,
    balance,
    loading,
    error,
    compact
  });

  // Fetch token balance (only if no prop balance provided)
  const fetchBalance = useCallback(async () => {
    if (!user || propBalance) return;
    
    try {
      setLoading(true);
      const response = await apiService.getTokenBalance();
      
      if (response.success) {
        setInternalBalance(response.balance);
      } else {
        setError('Token bakiyesi alınamadı');
      }
    } catch (err) {
      setError('Bağlantı hatası');
    } finally {
      setLoading(false);
    }
  }, [user, propBalance]);

  // Check if token system is enabled
  const checkTokenSystem = useCallback(async () => {
    try {
      const response = await apiService.checkTokenRequirement('name_generation');
      setSystemConfig(response);
    } catch (err) {
      // Token system might be disabled, ignore error
    }
  }, []);

  useEffect(() => {
    if (propBalance) {
      setLoading(false);
      setError(null);
    } else {
      fetchBalance();
    }
    checkTokenSystem();
  }, [fetchBalance, checkTokenSystem, propBalance]);

  // Refresh balance every 30 seconds (only if not using prop balance)
  useEffect(() => {
    if (propBalance) return;
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [fetchBalance, propBalance]);

  // Don't show if token system is disabled - DEBUG: geçici olarak devre dışı
  // if (systemConfig && !systemConfig.token_required) {
  //   return null;
  // }

  if (!user) {
    console.log('🪙 TokenBalance: No user, not rendering');
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center space-x-2 bg-yellow-100 rounded-lg px-4 py-2 border-2 border-yellow-400">
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-yellow-600 border-t-transparent"></div>
        <span className="text-sm font-medium text-yellow-800">🔄 Token yükleniyor...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center space-x-2 bg-red-100 rounded-lg px-4 py-2 border-2 border-red-400">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <span className="text-sm font-medium text-red-800">❌ {error}</span>
      </div>
    );
  }

  if (!balance) {
    console.log('🪙 TokenBalance: No balance data, showing fallback');
    return (
      <div className="flex items-center space-x-2 bg-gray-100 rounded-lg px-4 py-2 border-2 border-gray-400">
        <Coins className="h-4 w-4 text-gray-600" />
        <span className="text-sm font-medium text-gray-700">💰 Token Yükle</span>
        <button
          onClick={onPurchaseClick}
          className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-full transition-colors font-medium"
        >
          Başla
        </button>
      </div>
    );
  }

  const isLowBalance = balance.current_balance < 5;
  const isEmptyBalance = balance.current_balance === 0;

  if (compact) {
    return (
      <div className="flex items-center space-x-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg px-4 py-2 border-2 border-blue-300 shadow-lg hover:shadow-xl transition-all">
        <Coins className={`h-5 w-5 ${isLowBalance ? 'text-orange-500' : 'text-blue-600'}`} />
        <span className={`font-bold text-sm ${isLowBalance ? 'text-orange-600' : 'text-blue-700'}`}>
          🪙 {balance ? balance.current_balance : '?'} Token
        </span>
        <button
          onClick={onPurchaseClick}
          className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-full transition-colors font-medium"
        >
          Satın Al
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-xl p-6 border border-blue-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500 rounded-lg">
            <Coins className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Token Bakiyesi</h3>
            <p className="text-sm text-gray-600">Mevcut token durumunuz</p>
          </div>
        </div>
        
        {isLowBalance && (
          <div className="flex items-center space-x-1 text-orange-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-xs font-medium">Düşük Bakiye</span>
          </div>
        )}
      </div>

      {/* Balance Display */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center space-x-2 mb-2">
            <Zap className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium text-gray-600">Mevcut</span>
          </div>
          <div className={`text-2xl font-bold ${isLowBalance ? 'text-orange-600' : 'text-blue-600'}`}>
            {balance.current_balance}
          </div>
          <div className="text-xs text-gray-500">Token</div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-gray-600">Toplam Kullanılan</span>
          </div>
          <div className="text-2xl font-bold text-green-600">
            {balance.total_used}
          </div>
          <div className="text-xs text-gray-500">Token</div>
        </div>
      </div>

      {/* Usage Stats */}
      <div className="bg-white rounded-lg p-4 border border-gray-200 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">Token Kullanım Geçmişi</span>
          <Clock className="h-4 w-4 text-gray-400" />
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Toplam Satın Alınan:</span>
          <span className="font-medium text-blue-600">{balance.total_purchased} Token</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-gray-600">Son Güncelleme:</span>
          <span className="text-gray-500">
            {new Date(balance.last_updated).toLocaleDateString('tr-TR')}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-3">
        <button
          onClick={onPurchaseClick}
          className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2"
        >
          <ShoppingCart className="h-4 w-4" />
          <span>Token Satın Al</span>
        </button>
        
        <button
          onClick={fetchBalance}
          className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Yenile
        </button>
      </div>

      {/* Low Balance Warning */}
      {isLowBalance && (
        <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-orange-800">
                {isEmptyBalance ? 'Token bakiyeniz bitti!' : 'Token bakiyeniz azalıyor!'}
              </div>
              <div className="text-xs text-orange-600 mt-1">
                {isEmptyBalance 
                  ? 'İsim üretmeye devam etmek için token satın alın.'
                  : 'Kesintisiz kullanım için token satın almayı düşünün.'
                }
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenBalance; 