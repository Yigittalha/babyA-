import React, { useState } from 'react';

const FavoritesPanel = ({ favorites, loading, onRemove, onRefresh }) => {
  const [filter, setFilter] = useState('all');

  // favorites undefined ise boş array kullan
  const safeFavorites = favorites || [];

  const filteredFavorites = safeFavorites.filter(favorite => {
    if (filter === 'all') return true;
    return favorite.gender === filter;
  });

  const getGenderLabel = (gender) => {
    const labels = {
      'male': 'Erkek',
      'female': 'Kız',
      'unisex': 'Unisex'
    };
    return labels[gender] || gender;
  };

  const getThemeLabel = (theme) => {
    const labels = {
      'nature': 'Doğa',
      'religious': 'Dini',
      'historical': 'Tarihi',
      'modern': 'Modern',
      'traditional': 'Geleneksel',
      'unique': 'Benzersiz',
      'royal': 'Asil',
      'warrior': 'Savaşçı',
      'wisdom': 'Bilgelik',
      'love': 'Aşk'
    };
    return labels[theme] || theme;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Favoriler yükleniyor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-gray-900">
          ❤️ Favori İsimleriniz
        </h3>
        <button
          onClick={onRefresh}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          🔄 Yenile
        </button>
      </div>

      {safeFavorites.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 text-6xl mb-4">💔</div>
          <p className="text-gray-600 mb-2">Henüz favori isminiz yok</p>
          <p className="text-sm text-gray-500">
            İsim üretirken beğendiğiniz isimleri favorilere ekleyebilirsiniz
          </p>
        </div>
      ) : (
        <>
          {/* Filtre */}
          <div className="mb-4">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tümü ({safeFavorites.length})</option>
              <option value="male">Erkek ({safeFavorites.filter(f => f.gender === 'male').length})</option>
              <option value="female">Kız ({safeFavorites.filter(f => f.gender === 'female').length})</option>
              <option value="unisex">Unisex ({safeFavorites.filter(f => f.gender === 'unisex').length})</option>
            </select>
          </div>

          {/* Favori Listesi */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredFavorites.map((favorite) => (
              <div
                key={favorite.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-lg font-semibold text-gray-900">
                    {favorite.name}
                  </h4>
                  <button
                    onClick={() => onRemove(favorite.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                    title="Favoriden çıkar"
                  >
                    🗑️
                  </button>
                </div>
                
                <p className="text-gray-600 text-sm mb-2">
                  {favorite.meaning}
                </p>
                
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {getGenderLabel(favorite.gender)}
                  </span>
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                    {getThemeLabel(favorite.theme)}
                  </span>
                  <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                    {favorite.language}
                  </span>
                </div>
                
                {favorite.notes && (
                  <div className="mt-2 p-2 bg-yellow-50 rounded text-xs text-gray-600">
                    <strong>Not:</strong> {favorite.notes}
                  </div>
                )}
                
                <div className="text-xs text-gray-400 mt-2">
                  {new Date(favorite.created_at).toLocaleDateString('tr-TR')}
                </div>
              </div>
            ))}
          </div>

          {filteredFavorites.length === 0 && filter !== 'all' && (
            <div className="text-center py-4 text-gray-500">
              Bu kategoride favori isim bulunamadı
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FavoritesPanel; 