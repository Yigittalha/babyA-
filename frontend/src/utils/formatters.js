/**
 * Ortak formatters ve utility fonksiyonları
 */

// Güvenli sayı dönüştürme fonksiyonu
export const safeNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '' || value === 'NaN') return fallback;
  const num = Number(value);
  return (isNaN(num) || !isFinite(num) || num < 0) ? fallback : num;
};

// Para birimi formatı
export const formatCurrency = (value) => {
  const num = safeNumber(value, 0);
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// TL formatı
export const formatTurkishCurrency = (value) => {
  const num = safeNumber(value, 0);
  return `₺${num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Sayı formatı (K, M ile)
export const formatNumber = (value) => {
  const num = safeNumber(value, 0);
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
};

// Yüzde formatı
export const formatPercentage = (value, decimals = 1) => {
  const num = safeNumber(value, 0);
  return `${num.toFixed(decimals)}%`;
};

// Tarih formatı
export const formatDate = (dateString) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR');
  } catch {
    return 'Geçersiz tarih';
  }
};

// Zaman formatı (ne kadar önce)
export const formatTimeAgo = (dateString) => {
  try {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Bugün';
    if (diffDays === 1) return 'Dün';
    if (diffDays < 7) return `${diffDays} gün önce`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} hafta önce`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} ay önce`;
    return `${Math.floor(diffDays / 365)} yıl önce`;
  } catch {
    return 'Bilinmiyor';
  }
};

// Plan adı formatı
export const formatPlanName = (planType) => {
  const planNames = {
    'free': 'Ücretsiz',
    'standard': 'Standard',
    'premium': 'Premium',
    'family': 'Aile',
    'pro': 'Pro'
  };
  return planNames[planType?.toLowerCase()] || planType || 'Bilinmiyor';
};

// Kullanıcı durumu formatı
export const formatUserStatus = (status) => {
  const statusNames = {
    'active': 'Aktif',
    'inactive': 'Pasif',
    'suspended': 'Askıya Alınmış',
    'pending': 'Beklemede'
  };
  return statusNames[status?.toLowerCase()] || status || 'Bilinmiyor';
}; 