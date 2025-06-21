import React, { useState, useEffect } from 'react';
import { Crown, Check, Star, Zap, Shield, Users, Clock, CreditCard, X, TrendingUp, Globe, MessageCircle, ArrowLeft, Lock, CheckCircle, User, Calendar, Mail } from 'lucide-react';
import { getSubscriptionPlans, getSubscriptionStatus, upgradeSubscription } from '../services/api';

const PremiumUpgrade = ({ onClose, onUpgrade }) => {
  const [plans, setPlans] = useState([]);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState('plans'); // 'plans', 'payment', 'processing', 'success'
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [cardForm, setCardForm] = useState({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardHolder: '',
    email: '',
    acceptTerms: false
  });
  const [processing, setProcessing] = useState(false);

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
      
      // NEW: Use real plans from backend API
      try {
        setPlans(plansResponse.plans || []);
      } catch (planError) {
        console.warn('Using fallback plans:', planError);
        
        // Fallback to new realistic plans if API fails
        const newRealisticPlans = [
          {
            id: 'free',
            type: 'free',
            name: 'Free Family',
            price: 0.00,
            duration_days: 30,
            popular: false,
            features: [
              '5 isim önerisi/gün',
              'Temel anlam ve köken',
              '3 favori limiti',
              'Temel trend görünümü',
              'Topluluk desteği'
            ],
            limitations: [
              'Günlük üretim limiti',
              'Sınırlı favoriler',
              'Gelişmiş analiz yok',
              'PDF eksport yok',
              'Kültürel içgörü yok'
            ]
          },
          {
            id: 'standard',
            type: 'standard',
            name: 'Standard Family',
            price: 4.99,
            originalPrice: 7.99,
            duration_days: 30,
            popular: false,
            yearlyPrice: 49.99,
            yearlyDiscount: '17% İNDİRİM',
            features: [
              '50 isim üretimi/gün',
              'Detaylı anlam ve köken',
              '20 favori limiti',
              'Gelişmiş trend görünümü',
              'Kültürel içgörüler',
              'İsim analiz raporları',
              'E-posta desteği'
            ],
            limitations: [
              'Günlük üretim limiti',
              'Sınırlı favoriler',
              'PDF eksport yok',
              'Öncelikli destek yok'
            ]
          },
          {
            id: 'premium',
            type: 'premium',
            name: 'Premium Family',
            price: 8.99,
            originalPrice: 12.99,
            duration_days: 30,
            popular: true,
            yearlyPrice: 89.99,
            yearlyDiscount: '17% İNDİRİM',
            features: [
              'SİNİRSİZ isim üretimi',
              'AI destekli kültürel içgörüler',
              'Detaylı isim analizi',
              'Sınırsız favoriler',
              'PDF rapor eksportu',
              'Gelişmiş trend analizi',
              'İsim uyumluluk kontrolü',
              'Kişiselleştirilmiş öneriler',
              'Öncelikli destek',
              'Aile isimlendirme danışmanlığı'
            ],
            limitations: []
          }
        ];
        
        setPlans(newRealisticPlans);
      }
      
      setCurrentStatus(statusResponse);
    } catch (error) {
      console.error('Premium data fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = (plan) => {
    setSelectedPlan(plan);
    setCurrentStep('payment');
  };

  const handlePaymentSubmit = async () => {
    if (!cardForm.acceptTerms) {
      alert('Kullanım koşullarını kabul etmelisiniz.');
      return;
    }

    if (!cardForm.cardNumber || !cardForm.expiryDate || !cardForm.cvv || !cardForm.cardHolder || !cardForm.email) {
      alert('Lütfen tüm alanları doldurun.');
      return;
    }

    setProcessing(true);
    setCurrentStep('processing');

    // Simulate payment processing
    setTimeout(async () => {
      try {
        // Gerçek ödeme işlemi burada olacak
        const response = await upgradeSubscription(selectedPlan.type);
      
      if (response.success) {
          setCurrentStep('success');
          // 3 saniye sonra kapat ve callback çağır
          setTimeout(() => {
        onUpgrade && onUpgrade(response);
        onClose && onClose();
          }, 3000);
      }
    } catch (error) {
        console.error('Payment error:', error);
        alert('Ödeme işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.');
        setCurrentStep('payment');
    } finally {
        setProcessing(false);
      }
    }, 3000);
  };

  const formatCardNumber = (value) => {
    // Sadece rakamları al
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    // 4'lük gruplar halinde formatla
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiryDate = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
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
        
        {/* Step 1: Plan Selection */}
        {currentStep === 'plans' && (
          <>
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Crown className="w-8 h-8 text-purple-500 mr-3" />
                  <h2 className="text-2xl font-bold text-gray-800">Premium'a Geçin</h2>
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
                    <p className="text-sm text-gray-600">
                        Premium özelliklerle isim arama deneyiminizi geliştirin
                    </p>
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
                             <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.id}
                     className={`relative p-8 rounded-2xl border-2 transition-all duration-500 cursor-pointer transform hover:scale-105 hover:shadow-2xl ${
                       plan.type === 'premium_yearly'
                         ? 'border-purple-300 bg-gradient-to-br from-purple-100 via-pink-50 to-indigo-100 shadow-lg scale-[1.02] ring-2 ring-purple-200'
                         : 'border-gray-300 bg-gradient-to-br from-white to-gray-50 hover:border-purple-300 hover:shadow-xl hover:bg-gradient-to-br hover:from-purple-50 hover:to-pink-50'
                     }`}
                     onClick={() => handlePlanSelect(plan)}
                   >
                                         {plan.discount && (
                       <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                         <span className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg animate-pulse">
                           ✨ {plan.discount}
                    </span>
                  </div>
                )}
                
                                         <div className="text-center mb-8">
                       <div className="mb-4">
                         <Crown className="w-12 h-12 mx-auto text-purple-500 mb-3" />
                         <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                           {plan.name}
                         </h3>
                       </div>
                       <div className="flex items-center justify-center mb-3">
                         <span className="text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                           ${plan.price}
                         </span>
                         <span className="text-gray-500 ml-2 text-lg">
                           /{plan.duration_days === 365 ? 'year' : 'month'}
                         </span>
                       </div>
                       {plan.originalPrice && (
                         <div className="flex items-center justify-center space-x-3 mb-2">
                           <span className="text-gray-400 line-through text-base">${plan.originalPrice}</span>
                           <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                             💰 ${(plan.originalPrice - plan.price).toFixed(2)} savings
                    </span>
                  </div>
                )}
                </div>

                                         <div className="space-y-4 mb-8">
                  {plan.features.map((feature, index) => (
                         <div key={index} className="flex items-start group">
                           <div className="w-6 h-6 bg-gradient-to-r from-green-400 to-green-500 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform">
                             <Check className="w-3 h-3 text-white" />
                           </div>
                           <span className="text-gray-700 font-medium group-hover:text-gray-800 transition-colors">{feature}</span>
                    </div>
                  ))}
                </div>

                     <button
                       className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
                         plan.type === 'premium_yearly'
                           ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
                           : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white'
                       }`}
                     >
                       ✨ Bu Planı Seç
                     </button>
                  </div>
                ))}
              </div>

                             {/* Security Info */}
               <div className="mt-12 bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl p-6">
                 <div className="text-center mb-4">
                   <h4 className="text-lg font-semibold text-gray-800 mb-2">🔒 Güvenlik ve Garanti</h4>
                 </div>
                 <div className="grid md:grid-cols-3 gap-4">
                   <div className="flex flex-col items-center p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
                     <Lock className="w-8 h-8 text-blue-500 mb-2" />
                     <span className="text-sm font-medium text-gray-800">256-bit SSL Şifreleme</span>
                     <span className="text-xs text-gray-500 mt-1">Bilgileriniz güvende</span>
                   </div>
                   <div className="flex flex-col items-center p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
                     <Shield className="w-8 h-8 text-green-500 mb-2" />
                     <span className="text-sm font-medium text-gray-800">Güvenli Ödeme</span>
                     <span className="text-xs text-gray-500 mt-1">PCI DSS Uyumlu</span>
                   </div>
                   <div className="flex flex-col items-center p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
                     <CheckCircle className="w-8 h-8 text-purple-500 mb-2" />
                     <span className="text-sm font-medium text-gray-800">7 Gün İade Garantisi</span>
                     <span className="text-xs text-gray-500 mt-1">Koşulsuz iade</span>
                   </div>
                 </div>
               </div>
            </div>
          </>
        )}

        {/* Step 2: Payment Form */}
        {currentStep === 'payment' && (
          <>
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <button
                    onClick={() => setCurrentStep('plans')}
                    className="mr-4 text-gray-400 hover:text-gray-600"
                  >
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <CreditCard className="w-8 h-8 text-purple-500 mr-3" />
                  <h2 className="text-2xl font-bold text-gray-800">Ödeme Bilgileri</h2>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

                         <div className="p-6">
               {/* Development Warning */}
               <div className="mb-8 p-6 bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-400 rounded-2xl shadow-lg">
                 <div className="flex items-start">
                   <div className="flex-shrink-0">
                     <div className="w-12 h-12 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full flex items-center justify-center animate-pulse">
                       <svg className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
                         <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                       </svg>
                     </div>
                   </div>
                   <div className="ml-4 flex-1">
                     <h3 className="text-lg font-bold text-yellow-800 mb-3 flex items-center">
                       ⚠️ GELİŞTİRME/TEST SÜRÜMÜ
                       <span className="ml-2 bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full text-xs">DEMO</span>
                     </h3>
                     <div className="bg-white p-4 rounded-xl border border-yellow-200">
                       <div className="space-y-2 text-yellow-800">
                         <p className="flex items-center font-semibold">
                           <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                           Bu sayfa şu anda test amaçlıdır ve gerçek ödeme işlemi yapmamaktadır.
                         </p>
                         <p className="flex items-center">
                           <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                           Lütfen gerçek kart bilgilerinizi girmeyiniz. Bu sadece tasarım gösterimi içindir.
                         </p>
                         <p className="flex items-center font-semibold text-green-700">
                           <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                           Ödeme sistemi yakında aktif hale gelecektir.
                         </p>
                       </div>
                     </div>
                   </div>
                 </div>
               </div>

               <div className="grid md:grid-cols-3 gap-8">
                 {/* Payment Form */}
                 <div className="md:col-span-2">
                   <div className="space-y-6">
                                         {/* Payment Method */}
                     <div>
                       <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                         💳 Ödeme Yöntemi Seçin
                       </h3>
                       <div className="grid grid-cols-2 gap-6">
                         <button
                           onClick={() => setPaymentMethod('card')}
                           className={`p-6 border-2 rounded-2xl transition-all duration-300 transform hover:scale-105 ${
                             paymentMethod === 'card'
                               ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 shadow-lg ring-2 ring-purple-200'
                               : 'border-gray-200 hover:border-purple-300 hover:shadow-md bg-white'
                           }`}
                         >
                           <CreditCard className="w-8 h-8 mx-auto mb-3 text-purple-500" />
                           <div className="text-center">
                             <span className="block text-sm font-bold text-gray-800">Kredi/Banka Kartı</span>
                             <span className="text-xs text-gray-500 mt-1">Anında aktifleşir</span>
                           </div>
                         </button>
                         <button
                           onClick={() => setPaymentMethod('bank')}
                           className={`p-6 border-2 rounded-2xl transition-all duration-300 transform hover:scale-105 ${
                             paymentMethod === 'bank'
                               ? 'border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg ring-2 ring-green-200'
                               : 'border-gray-200 hover:border-green-300 hover:shadow-md bg-white'
                           }`}
                         >
                           <div className="w-8 h-8 mx-auto mb-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg text-white flex items-center justify-center">
                             <span className="text-sm font-bold">$</span>
                           </div>
                           <div className="text-center">
                             <span className="block text-sm font-bold text-gray-800">Banka Transferi</span>
                             <span className="text-xs text-gray-500 mt-1">24 saat içinde</span>
                           </div>
                         </button>
                       </div>
                     </div>

                                         {/* Card Form */}
                     {paymentMethod === 'card' && (
                       <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-6 rounded-2xl space-y-6">
                         <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                           💳 Kart Bilgileri
                         </h4>
                         <div className="group">
                           <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center">
                             <User className="w-4 h-4 mr-2 text-purple-500" />
                             Kart Üzerindeki İsim
                           </label>
                           <input
                             type="text"
                             value={cardForm.cardHolder}
                             onChange={(e) => setCardForm({...cardForm, cardHolder: e.target.value})}
                             placeholder="TEST KULLANICI (Gerçek bilgi girmeyiniz)"
                             className="w-full px-4 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-300 bg-white shadow-sm group-hover:shadow-md"
                           />
                         </div>

                                                 <div className="group">
                           <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center">
                             <CreditCard className="w-4 h-4 mr-2 text-purple-500" />
                             Kart Numarası
                           </label>
                           <div className="relative">
                             <input
                               type="text"
                               value={cardForm.cardNumber}
                               onChange={(e) => setCardForm({...cardForm, cardNumber: formatCardNumber(e.target.value)})}
                               placeholder="4444 5555 6666 7777 (TEST - Gerçek kart girmeyiniz)"
                               maxLength="19"
                               className="w-full px-4 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-300 bg-white shadow-sm group-hover:shadow-md pr-12"
                             />
                             <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                               <CreditCard className="w-5 h-5 text-gray-400" />
                             </div>
                           </div>
                         </div>

                         <div className="grid grid-cols-2 gap-6">
                           <div className="group">
                             <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center">
                               <Calendar className="w-4 h-4 mr-2 text-purple-500" />
                               Son Kullanma Tarihi
                             </label>
                             <input
                               type="text"
                               value={cardForm.expiryDate}
                               onChange={(e) => setCardForm({...cardForm, expiryDate: formatExpiryDate(e.target.value)})}
                               placeholder="12/28"
                               maxLength="5"
                               className="w-full px-4 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-300 bg-white shadow-sm group-hover:shadow-md"
                             />
                           </div>
                           <div className="group">
                             <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center">
                               <Shield className="w-4 h-4 mr-2 text-purple-500" />
                               CVV
                             </label>
                             <input
                               type="text"
                               value={cardForm.cvv}
                               onChange={(e) => setCardForm({...cardForm, cvv: e.target.value.replace(/\D/g, '').substring(0, 3)})}
                               placeholder="999 (TEST)"
                               maxLength="3"
                               className="w-full px-4 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-300 bg-white shadow-sm group-hover:shadow-md"
                             />
                           </div>
                         </div>

                         <div className="group">
                           <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center">
                             <Mail className="w-4 h-4 mr-2 text-purple-500" />
                             E-posta Adresi
                           </label>
                           <input
                             type="email"
                             value={cardForm.email}
                             onChange={(e) => setCardForm({...cardForm, email: e.target.value})}
                             placeholder="test@example.com (Gerçek e-posta girmeyiniz)"
                             className="w-full px-4 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-300 bg-white shadow-sm group-hover:shadow-md"
                           />
                         </div>

                        <div className="flex items-start">
                          <input
                            type="checkbox"
                            id="terms"
                            checked={cardForm.acceptTerms}
                            onChange={(e) => setCardForm({...cardForm, acceptTerms: e.target.checked})}
                            className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                          />
                          <label htmlFor="terms" className="ml-3 text-sm text-gray-600">
                            <a href="#" className="text-purple-600 hover:underline">Kullanım Koşulları</a>'nı ve 
                            <a href="#" className="text-purple-600 hover:underline"> Gizlilik Politikası</a>'nı okudum ve kabul ediyorum.
                          </label>
                        </div>
                      </div>
                    )}

                                         {paymentMethod === 'bank' && (
                       <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-8 rounded-2xl border-2 border-green-200">
                         <h4 className="font-bold text-green-800 mb-6 text-xl flex items-center">
                           🏦 Banka Transfer Bilgileri
                         </h4>
                         <div className="space-y-4">
                           <div className="bg-white p-4 rounded-xl border border-green-100 flex items-center">
                             <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mr-4">
                               <span className="text-white font-bold text-sm">🏦</span>
                             </div>
                             <div>
                               <p className="text-sm text-gray-500">Banka</p>
                               <p className="font-bold text-gray-800">Yapı Kredi Bankası</p>
                             </div>
                           </div>
                           
                           <div className="bg-white p-4 rounded-xl border border-green-100 flex items-center">
                             <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mr-4">
                               <span className="text-white font-bold text-sm">#</span>
                             </div>
                             <div>
                               <p className="text-sm text-gray-500">Hesap No</p>
                               <p className="font-bold text-gray-800">1234567890</p>
                             </div>
                           </div>
                           
                           <div className="bg-white p-4 rounded-xl border border-green-100">
                             <div className="flex items-center mb-2">
                               <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center mr-4">
                                 <span className="text-white font-bold text-sm">💳</span>
                               </div>
                               <div>
                                 <p className="text-sm text-gray-500">IBAN</p>
                                 <p className="font-bold text-gray-800">TR12 3456 7890 1234 5678 9012 34</p>
                               </div>
                             </div>
                           </div>
                           
                           <div className="bg-white p-4 rounded-xl border border-green-100 flex items-center">
                             <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center mr-4">
                               <span className="text-white font-bold text-sm">📝</span>
                             </div>
                             <div>
                               <p className="text-sm text-gray-500">Açıklama</p>
                               <p className="font-bold text-gray-800">Premium Abonelik - {selectedPlan?.name}</p>
                             </div>
                           </div>
                         </div>
                         
                         <div className="mt-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-xl">
                           <div className="flex items-start">
                             <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center mr-3 mt-1">
                               <span className="text-white font-bold text-xs">!</span>
                             </div>
                             <div>
                               <p className="font-bold text-yellow-800 mb-1">📧 Önemli Bilgi</p>
                               <p className="text-sm text-yellow-700">
                                 Transfer sonrası dekont'u <strong>info@bebek-isim.com</strong> adresine gönderin.
                                 <br />
                                 24 saat içinde aboneliğiniz aktifleştirilecektir.
                               </p>
                             </div>
                           </div>
                         </div>
                       </div>
                )}
              </div>
          </div>

                                 {/* Order Summary */}
                 <div className="md:col-span-1">
                   <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 sticky top-6 shadow-lg border border-purple-100">
                     <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                       🧾 Sipariş Özeti
                     </h3>
                    
                                         {selectedPlan && (
                       <div className="space-y-6">
                         <div className="bg-white rounded-xl p-4 border border-purple-100">
                           <div className="flex justify-between items-center mb-2">
                             <span className="text-gray-700 font-medium">{selectedPlan.name}</span>
                             <span className="font-bold text-lg">${selectedPlan.price}</span>
                           </div>
                           <div className="text-xs text-gray-500">
                             {selectedPlan.duration_days === 365 ? 'Yearly subscription' : 'Monthly subscription'}
                           </div>
                         </div>
                         
                         {selectedPlan.originalPrice && (
                           <div className="flex justify-between text-green-600 bg-green-50 p-3 rounded-xl">
                             <span className="font-medium">💚 Discount</span>
                             <span className="font-bold">-${(selectedPlan.originalPrice - selectedPlan.price).toFixed(2)}</span>
                           </div>
                         )}
                         
                         <div className="flex justify-between text-gray-600 bg-blue-50 p-3 rounded-xl">
                           <span className="font-medium">🧾 Tax (18%)</span>
                           <span className="font-bold">${(selectedPlan.price * 0.18).toFixed(2)}</span>
                         </div>
                         
                         <hr className="border-purple-200" />
                         
                         <div className="flex justify-between text-xl font-bold bg-gradient-to-r from-purple-100 to-pink-100 p-4 rounded-xl">
                           <span>💰 Total</span>
                           <span className="text-purple-600">${(selectedPlan.price * 1.18).toFixed(2)}</span>
                         </div>

                         <button
                           onClick={handlePaymentSubmit}
                           disabled={processing || (paymentMethod === 'card' && !cardForm.acceptTerms)}
                           className="w-full mt-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                         >
                           {paymentMethod === 'card' ? '💳 Ödemeyi Tamamla' : '📋 Siparişi Onayla'}
                         </button>

                         <div className="text-center text-sm bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                           <div className="flex items-center justify-center space-x-2 text-yellow-700">
                             <Lock className="w-4 h-4" />
                             <span className="font-medium">⚠️ TEST MODU - Gerçek ödeme yapılmaz</span>
                           </div>
                         </div>
                       </div>
                     )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

                 {/* Step 3: Processing */}
         {currentStep === 'processing' && (
           <div className="p-16 text-center bg-gradient-to-br from-purple-50 to-pink-50">
             <div className="relative mb-8">
               <div className="animate-spin rounded-full h-20 w-20 border-4 border-purple-200 border-t-purple-500 mx-auto"></div>
               <div className="absolute inset-0 flex items-center justify-center">
                 <CreditCard className="w-8 h-8 text-purple-500 animate-pulse" />
               </div>
             </div>
             <h3 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
               💳 Ödemeniz İşleniyor
             </h3>
             <p className="text-lg text-gray-600 mb-6">Lütfen bekleyin, ödemeniz güvenli bir şekilde işleniyor...</p>
             
             <div className="bg-white rounded-2xl p-6 max-w-md mx-auto shadow-lg">
               <div className="flex items-center justify-center space-x-2 text-green-600 mb-4">
                 <Lock className="w-5 h-5" />
                 <span className="font-semibold">256-bit SSL Şifreleme</span>
               </div>
               <div className="text-sm text-gray-500">
                 Bu işlem birkaç saniye sürebilir.
                 <br />
                 Sayfayı kapatmayınız.
               </div>
             </div>
           </div>
         )}

                 {/* Step 4: Success */}
         {currentStep === 'success' && (
           <div className="p-16 text-center bg-gradient-to-br from-green-50 to-emerald-50">
             <div className="relative mb-8">
               <div className="w-24 h-24 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                 <CheckCircle className="w-12 h-12 text-white" />
               </div>
               <div className="absolute -top-2 -right-2">
                 <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center animate-pulse">
                   <span className="text-sm">✨</span>
                 </div>
               </div>
             </div>
             
             <h3 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-4">
               🎉 Ödeme Başarılı!
             </h3>
             <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
               Premium aboneliğiniz başarıyla aktifleştirildi. Artık tüm premium özelliklerden yararlanabilirsiniz.
             </p>
             
             <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto mb-8">
               <div className="bg-white rounded-2xl p-6 shadow-lg border border-green-100">
                 <Crown className="w-8 h-8 text-purple-500 mx-auto mb-3" />
                 <h4 className="font-bold text-gray-800 mb-2">Premium Aktif</h4>
                 <p className="text-sm text-gray-600">Tüm özellikler açıldı</p>
               </div>
               <div className="bg-white rounded-2xl p-6 shadow-lg border border-green-100">
                 <Zap className="w-8 h-8 text-yellow-500 mx-auto mb-3" />
                 <h4 className="font-bold text-gray-800 mb-2">Sınırsız Erişim</h4>
                 <p className="text-sm text-gray-600">İsim üretimi limitsiz</p>
               </div>
               <div className="bg-white rounded-2xl p-6 shadow-lg border border-green-100">
                 <Mail className="w-8 h-8 text-blue-500 mx-auto mb-3" />
                 <h4 className="font-bold text-gray-800 mb-2">Öncelikli Destek</h4>
                 <p className="text-sm text-gray-600">7/24 e-posta desteği</p>
               </div>
             </div>
             
             <div className="bg-white border-2 border-green-200 rounded-2xl p-6 max-w-md mx-auto">
               <div className="flex items-center justify-center space-x-2 text-green-600 mb-3">
                 <Mail className="w-5 h-5" />
                 <span className="font-bold">📧 E-posta Onayı</span>
               </div>
               <p className="text-sm text-gray-600">
                 Onay e-postası kısa süre içinde size gönderilecektir.
                 <br />
                 <span className="font-semibold text-green-600">Hoş geldiniz Premium kullanıcı!</span>
               </p>
          </div>
        </div>
         )}
      </div>
    </div>
  );
};

export default PremiumUpgrade; 