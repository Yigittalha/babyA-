import React, { useState, useEffect } from 'react';
import { Baby, Sparkles, Loader2, Heart, Star, BookOpen } from 'lucide-react';

const NameForm = ({ onGenerateNames, loading, options, user }) => {
  const [formData, setFormData] = useState({
    gender: 'unisex',
    style: 'modern',
    origin: 'turkish',
    theme: 'genel',
    count: 20
  });
  
  const [errors, setErrors] = useState({});
  const [isValid, setIsValid] = useState(false);

  const themes = [
    { value: 'genel', label: 'Genel', icon: '🌟' },
    { value: 'nature', label: 'Doğa', icon: '🌿' },
    { value: 'historical', label: 'Tarihi', icon: '🏛️' },
    { value: 'literary', label: 'Edebi', icon: '📚' },
    { value: 'spiritual', label: 'Manevi', icon: '✨' },
    { value: 'modern', label: 'Modern', icon: '🚀' },
    { value: 'traditional', label: 'Geleneksel', icon: '🏺' },
    { value: 'international', label: 'Uluslararası', icon: '🌍' }
  ];

  // Form validasyonu
  useEffect(() => {
    const newErrors = {};
    
    if (!formData.gender) {
      newErrors.gender = 'Cinsiyet seçimi zorunludur';
    }
    
    if (!formData.style) {
      newErrors.style = 'Stil seçimi zorunludur';
    }
    
    if (!formData.origin) {
      newErrors.origin = 'Köken seçimi zorunludur';
    }
    
    if (!formData.theme) {
      newErrors.theme = 'Tema seçimi zorunludur';
    }
    
    if (formData.count < 1 || formData.count > 100) {
      newErrors.count = 'İsim sayısı 1-100 arasında olmalıdır';
    }
    
    setErrors(newErrors);
    setIsValid(Object.keys(newErrors).length === 0 && formData.gender && formData.style && formData.origin && formData.theme && formData.count >= 1 && formData.count <= 100);
  }, [formData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isValid && !loading) {
      onGenerateNames(formData);
    }
  };

  const getGenderLabel = (value) => {
    const labels = {
      male: '👶 Erkek',
      female: '👧 Kız',
      unisex: '👶👧 Unisex'
    };
    return labels[value] || value;
  };

  const getLanguageLabel = (value) => {
    const labels = {
      turkish: '🇹🇷 Türkçe',
      english: '🇬🇧 İngilizce',
      arabic: '🇸🇦 Arapça',
      persian: '🇮🇷 Farsça',
      kurdish: '🇮🇶 Kürtçe',
      azerbaijani: '🇦🇿 Azerbaycan dili'
    };
    return labels[value] || value;
  };

  const getThemeLabel = (value) => {
    const labels = {
      nature: '🌿 Doğa',
      religious: '🙏 Dini/İlahi',
      historical: '🏛️ Tarihi',
      modern: '✨ Modern',
      traditional: '🏺 Geleneksel',
      unique: '💎 Benzersiz',
      royal: '👑 Asil/Kraliyet',
      warrior: '⚔️ Savaşçı',
      wisdom: '🧠 Bilgelik',
      love: '💕 Aşk/Sevgi'
    };
    return labels[value] || value;
  };

  return (
    <div className="modern-card max-w-2xl mx-auto mobile-padding">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl animate-float">
            <Baby className="w-10 h-10 text-purple-600" />
          </div>
        </div>
        <h2 className="mobile-text-2xl font-bold text-gradient mb-3">
          Bebek İsmi Üret
        </h2>
        <p className="text-gray-600 mobile-text-lg">
          Yapay zeka ile kişiselleştirilmiş bebek isimleri oluşturun
        </p>
        
        {/* Giriş yapmamış kullanıcılar için uyarı */}
        {!user && (
          <div className="mt-4 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl border border-yellow-200">
            <div className="flex items-center justify-center space-x-2 text-yellow-800">
              <span className="text-lg">🔐</span>
              <span className="text-sm font-medium">
                İsim üretmek için giriş yapmanız gerekiyor
              </span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mobile-space-y-6">
        {/* Cinsiyet Seçimi */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Cinsiyet *
          </label>
          <div className="mobile-grid grid-cols-3 gap-4">
            {options?.genders?.map(gender => (
              <button
                key={gender.value}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, gender: gender.value }))}
                className={`p-6 rounded-2xl border-2 transition-all duration-300 touch-button ${
                  formData.gender === gender.value
                    ? 'border-purple-500 bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 shadow-lg transform scale-105'
                    : 'border-gray-200 hover:border-purple-300 bg-white hover:shadow-md'
                } ${errors.gender ? 'border-red-500' : ''}`}
              >
                <div className="text-2xl mb-2">
                  {getGenderLabel(gender.value).split(' ')[0]}
                </div>
                <div className="text-sm font-semibold">
                  {getGenderLabel(gender.value).split(' ')[1]}
                </div>
              </button>
            ))}
          </div>
          {errors.gender && (
            <p className="mt-2 text-sm text-red-600 flex items-center">
              <span className="mr-1">⚠️</span>
              {errors.gender}
            </p>
          )}
        </div>

        {/* Dil Seçimi */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Dil *
          </label>
          <select
            name="origin"
            value={formData.origin}
            onChange={handleInputChange}
            className={`select-modern ${errors.origin ? 'border-red-500' : ''}`}
          >
            <option value="">Dil seçin</option>
            {options?.languages?.map(language => (
              <option key={language.value} value={language.value}>
                {getLanguageLabel(language.value)}
              </option>
            ))}
          </select>
          {errors.origin && (
            <p className="mt-2 text-sm text-red-600 flex items-center">
              <span className="mr-1">⚠️</span>
              {errors.origin}
            </p>
          )}
        </div>

        {/* Stil Seçimi */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Stil *
          </label>
          <select
            name="style"
            value={formData.style}
            onChange={handleInputChange}
            className={`select-modern ${errors.style ? 'border-red-500' : ''}`}
          >
            <option value="">Stil seçin</option>
            <option value="modern">✨ Modern</option>
            <option value="traditional">🏺 Geleneksel</option>
            <option value="unique">💎 Benzersiz</option>
            <option value="popular">⭐ Popüler</option>
          </select>
          {errors.style && (
            <p className="mt-2 text-sm text-red-600 flex items-center">
              <span className="mr-1">⚠️</span>
              {errors.style}
            </p>
          )}
        </div>

        {/* Tema Seçimi */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Tema *
            <span className="text-gray-400 ml-2 font-normal">(İsim tarzını belirler)</span>
          </label>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {themes.map(theme => (
              <button
                key={theme.value}
                type="button"
                onClick={() => handleInputChange({ target: { name: 'theme', value: theme.value } })}
                className={`p-4 rounded-xl border-2 transition-all duration-300 text-center hover:scale-105 ${
                  formData.theme === theme.value
                    ? 'border-purple-500 bg-purple-50 shadow-lg'
                    : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-25'
                }`}
              >
                <div className="text-2xl mb-2">{theme.icon}</div>
                <div className="text-sm font-medium text-gray-700">{theme.label}</div>
              </button>
            ))}
          </div>
          
          {errors.theme && (
            <p className="mt-2 text-sm text-red-600 flex items-center">
              <span className="mr-1">⚠️</span>
              {errors.theme}
            </p>
          )}
        </div>

        {/* İsim Sayısı */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            İsim Sayısı *
          </label>
          <input
            type="number"
            name="count"
            value={formData.count}
            onChange={handleInputChange}
            className={`input-modern ${errors.count ? 'border-red-500' : ''}`}
            min={1}
            max={100}
          />
          {errors.count && (
            <p className="mt-2 text-sm text-red-600 flex items-center">
              <span className="mr-1">⚠️</span>
              {errors.count}
            </p>
          )}
        </div>

        {/* Gönder Butonu */}
        <button
          type="submit"
          disabled={!isValid || loading}
          className={`w-full py-5 px-8 rounded-2xl font-bold text-white transition-all duration-300 touch-button ${
            isValid && !loading
              ? 'btn-modern-primary'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          {loading ? (
            <div className="flex items-center justify-center space-x-3">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>İsimler Üretiliyor...</span>
            </div>
          ) : !user ? (
            <div className="flex items-center justify-center space-x-3">
              <span className="text-lg">🔐</span>
              <span>Giriş Yap ve İsim Oluştur</span>
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-3">
              <Sparkles className="w-6 h-6" />
              <span>İsim Oluştur</span>
            </div>
          )}
        </button>
      </form>

      {/* Bilgi Notu */}
      <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-100">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">i</span>
            </div>
          </div>
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-2">Nasıl Çalışır?</p>
            <p>
              Yapay zeka teknolojisi kullanarak seçtiğiniz kriterlere uygun, 
              anlamlı ve kültürel olarak uygun bebek isimleri üretiyoruz. 
              Her isim için detaylı anlam ve köken bilgisi sunuyoruz.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NameForm; 