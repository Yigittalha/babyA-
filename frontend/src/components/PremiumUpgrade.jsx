import React, { useState, useEffect } from 'react';
import { Crown, Check, Star, Zap, Shield, Users, Clock, CreditCard, X, TrendingUp, Globe, MessageCircle } from 'lucide-react';
import { getSubscriptionPlans, getSubscriptionStatus, upgradeSubscription } from '../services/api';

const PremiumUpgrade = ({ onClose, onUpgrade }) => {
  const [plans, setPlans] = useState([]);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [plansResponse, statusResponse] = await Promise.all([
        getSubscriptionPlans(),
        getSubscriptionStatus()
      ]);
      
      setPlans(plansResponse.plans);
      setCurrentStatus(statusResponse);
    } catch (error) {
      console.error('Premium data fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planType) => {
    try {
      setUpgrading(true);
      const response = await upgradeSubscription(planType);
      
      if (response.success) {
        onUpgrade && onUpgrade(response);
        onClose && onClose();
      }
    } catch (error) {
      console.error('Upgrade error:', error);
    } finally {
      setUpgrading(false);
    }
  };

  const getFeatureIcon = (feature) => {
    if (feature.includes('Sınırsız')) return <Zap className="w-4 h-4" />;
    if (feature.includes('Detaylı')) return <Star className="w-4 h-4" />;
    if (feature.includes('Kültürel')) return <Users className="w-4 h-4" />;
    if (feature.includes('Popülerlik')) return <TrendingUp className="w-4 h-4" />;
    if (feature.includes('Benzer')) return <Shield className="w-4 h-4" />;
    if (feature.includes('Trendler')) return <Globe className="w-4 h-4" />;
    if (feature.includes('Destek')) return <MessageCircle className="w-4 h-4" />;
    return <Check className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Crown className="w-8 h-8 text-purple-500 mr-3" />
              <h2 className="text-2xl font-bold text-gray-800">Premium Özellikler</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {currentStatus && (
            <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800">
                    Mevcut Durum: {currentStatus.is_premium ? 'Premium Üye' : 'Ücretsiz Üye'}
                  </h3>
                  {currentStatus.expires_at && (
                    <p className="text-sm text-gray-600">
                      Bitiş: {new Date(currentStatus.expires_at).toLocaleDateString('tr-TR')}
                    </p>
                  )}
                </div>
                {currentStatus.is_premium && (
                  <div className="flex items-center text-purple-600">
                    <Crown className="w-5 h-5 mr-2" />
                    <span className="font-medium">Premium Aktif</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Plans */}
        <div className="p-6">
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative p-6 rounded-xl border-2 transition-all ${
                  plan.type === 'premium'
                    ? 'border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50'
                    : plan.type === 'pro'
                    ? 'border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                {plan.type === 'premium' && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-purple-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                      En Popüler
                    </span>
                  </div>
                )}
                
                {plan.type === 'pro' && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-yellow-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                      En İyi Değer
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{plan.name}</h3>
                  <div className="flex items-center justify-center mb-4">
                    <span className="text-3xl font-bold text-gray-800">
                      {plan.price === 0 ? 'Ücretsiz' : `₺${plan.price}`}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-gray-600 ml-2">
                        /{plan.duration_days === 365 ? 'yıl' : 'ay'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-start">
                      <Check className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>

                {plan.type !== 'free' && (
                  <button
                    onClick={() => handleUpgrade(plan.type)}
                    disabled={upgrading || currentStatus?.is_premium}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
                      plan.type === 'premium'
                        ? 'bg-purple-500 hover:bg-purple-600 text-white'
                        : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {upgrading ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Yükleniyor...
                      </div>
                    ) : currentStatus?.is_premium ? (
                      'Zaten Premium'
                    ) : (
                      `${plan.type === 'premium' ? 'Premium' : 'Pro'} Ol`
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Features Comparison */}
          <div className="mt-8 bg-gray-50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Özellik Karşılaştırması</h3>
            <div className="grid md:grid-cols-4 gap-4 text-sm">
              <div className="font-medium text-gray-700">Özellik</div>
              <div className="text-center font-medium text-gray-700">Ücretsiz</div>
              <div className="text-center font-medium text-purple-700">Premium</div>
              <div className="text-center font-medium text-yellow-700">Pro</div>
              
              <div className="text-gray-600">Günlük İsim Önerisi</div>
              <div className="text-center">5</div>
              <div className="text-center text-green-600">Sınırsız</div>
              <div className="text-center text-green-600">Sınırsız</div>
              
              <div className="text-gray-600">Detaylı Analiz</div>
              <div className="text-center">❌</div>
              <div className="text-center text-green-600">✅</div>
              <div className="text-center text-green-600">✅</div>
              
              <div className="text-gray-600">Kültürel Bağlam</div>
              <div className="text-center">❌</div>
              <div className="text-center text-green-600">✅</div>
              <div className="text-center text-green-600">✅</div>
              
              <div className="text-gray-600">Popülerlik Tahmini</div>
              <div className="text-center">❌</div>
              <div className="text-center text-green-600">✅</div>
              <div className="text-center text-green-600">✅</div>
              
              <div className="text-gray-600">Benzer İsimler</div>
              <div className="text-center">❌</div>
              <div className="text-center text-green-600">✅</div>
              <div className="text-center text-green-600">✅</div>
              
              <div className="text-gray-600">Özel Danışmanlık</div>
              <div className="text-center">❌</div>
              <div className="text-center">❌</div>
              <div className="text-center text-green-600">✅</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PremiumUpgrade; 