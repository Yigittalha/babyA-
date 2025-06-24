import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShoppingCart, Check, Zap, TrendingUp, Star, 
  CreditCard, Shield, Clock, ArrowLeft, Gift 
} from 'lucide-react';
import { apiService } from '../services/api';

const TokenPurchase = ({ user, onClose, onPurchaseComplete }) => {
  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('select'); // select, payment, complete

  // Fetch token packages
  const fetchPackages = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.getTokenPackages();
      
      if (response.success) {
        setPackages(response.packages);
        
        // Auto-select the popular package (usually the middle one)
        if (response.packages.length > 0) {
          const popularIndex = Math.floor(response.packages.length / 2);
          setSelectedPackage(response.packages[popularIndex]);
        }
      } else {
        setError('Token paketleri yüklenemedi');
      }
    } catch (err) {
      setError('Bağlantı hatası oluştu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  // Handle package selection
  const handlePackageSelect = (pkg) => {
    setSelectedPackage(pkg);
  };

  // Handle purchase initiation
  const handlePurchase = async () => {
    if (!selectedPackage) return;

    try {
      setPurchasing(true);
      setError(null);

      const response = await apiService.purchaseTokens({
        package_id: selectedPackage.id,
        payment_provider: 'stripe',
        currency: selectedPackage.currency
      });

      if (response.success) {
        setStep('payment');
        // In a real app, you would integrate with Stripe/PayPal here
        // For demo, we'll simulate successful payment
        setTimeout(() => {
          simulatePaymentComplete(response.purchase.id);
        }, 2000);
      } else {
        setError(response.error || 'Satın alma başlatılamadı');
      }
    } catch (err) {
      setError('Satın alma sırasında hata oluştu');
    } finally {
      setPurchasing(false);
    }
  };

  // Simulate payment completion (in real app, this would be a webhook)
  const simulatePaymentComplete = async (purchaseId) => {
    try {
      const response = await apiService.completeTokenPurchase({
        purchase_id: purchaseId,
        transaction_id: `sim_${Date.now()}`,
        payment_status: 'completed'
      });

      if (response.success) {
        setStep('complete');
        if (onPurchaseComplete) {
          onPurchaseComplete(response);
        }
      } else {
        setError('Ödeme tamamlanamadı');
        setStep('select');
      }
    } catch (err) {
      setError('Ödeme doğrulamasında hata oluştu');
      setStep('select');
    }
  };

  const getBonusPercentage = (pkg) => {
    if (pkg.token_amount <= 100) return 0;
    if (pkg.token_amount <= 300) return 20;
    if (pkg.token_amount <= 650) return 30;
    if (pkg.token_amount <= 1400) return 40;
    return 50;
  };

  const formatPrice = (price, currency = 'USD') => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currency === 'USD' ? 'USD' : 'TRY'
    }).format(price);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 w-full max-w-md">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-600">Token paketleri yükleniyor...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <ShoppingCart className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Token Satın Al</h2>
                <p className="text-gray-600">İsim üretimi için token paketlerinden birini seçin</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-6 w-6 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'select' && (
            <>
              {/* Error Display */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600">{error}</p>
                </div>
              )}

              {/* Features Banner */}
              <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">🎯 Token'larınızla Yapabilecekleriniz</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <Zap className="h-5 w-5 text-blue-500" />
                    <span className="text-sm text-gray-700">1 Token = 1 İsim Üretimi</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <span className="text-sm text-gray-700">2 Token = Detaylı Analiz</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Star className="h-5 w-5 text-purple-500" />
                    <span className="text-sm text-gray-700">Sınırsız Favoriler</span>
                  </div>
                </div>
              </div>

              {/* Package Selection */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-6">Token Paketlerini Seçin</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {packages.map((pkg, index) => {
                    const bonus = getBonusPercentage(pkg);
                    const isPopular = index === Math.floor(packages.length / 2);
                    const isSelected = selectedPackage?.id === pkg.id;

                    return (
                      <div
                        key={pkg.id}
                        onClick={() => handlePackageSelect(pkg)}
                        className={`
                          relative p-6 rounded-xl border-2 cursor-pointer transition-all duration-200
                          ${isSelected 
                            ? 'border-blue-500 bg-blue-50 shadow-lg transform scale-105' 
                            : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                          }
                          ${isPopular ? 'ring-2 ring-purple-300' : ''}
                        `}
                      >
                        {/* Popular Badge */}
                        {isPopular && (
                          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                            <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                              EN POPÜLER
                            </div>
                          </div>
                        )}

                        {/* Bonus Badge */}
                        {bonus > 0 && (
                          <div className="absolute -top-2 -right-2">
                            <div className="bg-green-500 text-white rounded-full w-12 h-12 flex items-center justify-center text-xs font-bold">
                              +{bonus}%
                            </div>
                          </div>
                        )}

                        {/* Package Content */}
                        <div className="text-center">
                          <h4 className="text-xl font-bold text-gray-800 mb-2">{pkg.name}</h4>
                          <div className="text-3xl font-bold text-blue-600 mb-2">
                            {pkg.token_amount}
                          </div>
                          <div className="text-sm text-gray-600 mb-4">Token</div>
                          
                          <div className="text-2xl font-bold text-gray-800 mb-4">
                            {formatPrice(pkg.price, pkg.currency)}
                          </div>

                          <div className="text-sm text-gray-500 mb-4">
                            {formatPrice(pkg.price_per_token, pkg.currency)} / Token
                          </div>

                          {pkg.description && (
                            <p className="text-sm text-gray-600 mb-4">{pkg.description}</p>
                          )}

                          {/* Features */}
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-center space-x-2">
                              <Check className="h-4 w-4 text-green-500" />
                              <span>{pkg.token_amount} İsim Üretimi</span>
                            </div>
                            <div className="flex items-center justify-center space-x-2">
                              <Check className="h-4 w-4 text-green-500" />
                              <span>{Math.floor(pkg.token_amount / 2)} Detaylı Analiz</span>
                            </div>
                            {bonus > 0 && (
                              <div className="flex items-center justify-center space-x-2">
                                <Gift className="h-4 w-4 text-green-500" />
                                <span className="text-green-600 font-medium">%{bonus} Bonus Token</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Selection Indicator */}
                        {isSelected && (
                          <div className="absolute top-4 right-4">
                            <div className="bg-blue-500 text-white rounded-full p-1">
                              <Check className="h-4 w-4" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Security Banner */}
              <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Shield className="h-5 w-5 text-green-500" />
                  <div>
                    <div className="font-medium text-green-800">Güvenli Ödeme</div>
                    <div className="text-sm text-green-600">256-bit SSL şifreleme ile korumalı ödeme</div>
                  </div>
                </div>
              </div>

              {/* Purchase Button */}
              <div className="flex justify-between items-center">
                <div>
                  {selectedPackage && (
                    <div>
                      <div className="text-sm text-gray-600">Seçilen Paket:</div>
                      <div className="font-semibold text-gray-800">
                        {selectedPackage.name} - {formatPrice(selectedPackage.price, selectedPackage.currency)}
                      </div>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={handlePurchase}
                  disabled={!selectedPackage || purchasing}
                  className="bg-blue-500 text-white px-8 py-3 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {purchasing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>İşleniyor...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      <span>Satın Al</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {step === 'payment' && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-6"></div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Ödeme İşleniyor</h3>
              <p className="text-gray-600 mb-4">Lütfen bekleyin, ödemeniz güvenli şekilde işleniyor...</p>
              <div className="text-sm text-gray-500">Bu işlem birkaç saniye sürebilir</div>
            </div>
          )}

          {step === 'complete' && (
            <div className="text-center py-12">
              <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6">
                <Check className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Ödeme Başarılı!</h3>
              <p className="text-gray-600 mb-6">
                Token'larınız hesabınıza eklendi. Artık sınırsız isim üretebilirsiniz!
              </p>
              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <div className="text-lg font-semibold text-blue-800">
                  {selectedPackage?.token_amount} Token Eklendi
                </div>
                <div className="text-sm text-blue-600">
                  {selectedPackage?.name} paketi başarıyla satın alındı
                </div>
              </div>
              <button
                onClick={onClose}
                className="bg-blue-500 text-white px-8 py-3 rounded-lg hover:bg-blue-600 transition-colors"
              >
                Devam Et
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TokenPurchase; 