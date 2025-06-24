import React, { useState, useEffect, useCallback } from 'react';
import { 
  Coins, Plus, Edit, Trash2, Settings, BarChart3, 
  TrendingUp, Users, Package, DollarSign, AlertCircle,
  CheckCircle, Save, X, Eye, EyeOff
} from 'lucide-react';
import { adminAPI } from '../services/api';

const AdminTokenManagement = () => {
  const [activeTab, setActiveTab] = useState('packages');
  const [packages, setPackages] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [systemConfig, setSystemConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Package management states
  const [editingPackage, setEditingPackage] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [packageForm, setPackageForm] = useState({
    name: '',
    description: '',
    token_amount: '',
    price: '',
    currency: 'USD',
    is_active: true,
    sort_order: 0
  });

  // Fetch data
  const fetchPackages = useCallback(async () => {
    try {
      const response = await adminAPI.getTokenPackagesAdmin(false); // Include inactive
      if (response.success) {
        setPackages(response.packages);
      }
    } catch (err) {
      setError('Token paketleri yüklenemedi');
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await adminAPI.getTokenAnalytics();
      if (response.success) {
        setAnalytics(response.stats);
      }
    } catch (err) {
      // Analytics might not be available, ignore error
    }
  }, []);

  const fetchSystemConfig = useCallback(async () => {
    try {
      const response = await adminAPI.getTokenSystemConfig();
      if (response.success) {
        setSystemConfig(response.config);
      }
    } catch (err) {
      // Config might not be available, ignore error
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchPackages(),
        fetchAnalytics(),
        fetchSystemConfig()
      ]);
      setLoading(false);
    };

    loadData();
  }, [fetchPackages, fetchAnalytics, fetchSystemConfig]);

  // Package form handlers
  const handleCreatePackage = async (e) => {
    e.preventDefault();
    try {
      const response = await adminAPI.createTokenPackage({
        ...packageForm,
        token_amount: parseInt(packageForm.token_amount),
        price: parseFloat(packageForm.price),
        sort_order: parseInt(packageForm.sort_order)
      });

      if (response.success) {
        setShowCreateForm(false);
        setPackageForm({
          name: '',
          description: '',
          token_amount: '',
          price: '',
          currency: 'USD',
          is_active: true,
          sort_order: 0
        });
        fetchPackages();
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError('Paket oluşturulamadı');
    }
  };

  const handleUpdatePackage = async (packageId, updateData) => {
    try {
      const response = await adminAPI.updateTokenPackage(packageId, updateData);
      if (response.success) {
        setEditingPackage(null);
        fetchPackages();
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError('Paket güncellenemedi');
    }
  };

  const handleDeletePackage = async (packageId) => {
    if (!confirm('Bu paketi silmek istediğinizden emin misiniz?')) return;
    
    try {
      const response = await adminAPI.deleteTokenPackage(packageId);
      if (response.success) {
        fetchPackages();
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError('Paket silinemedi');
    }
  };

  const formatPrice = (price, currency = 'USD') => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currency
    }).format(price);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          <span className="ml-3 text-gray-600">Token yönetimi yükleniyor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-blue-500 rounded-lg">
            <Coins className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Token Sistemi Yönetimi</h1>
            <p className="text-gray-600">Token paketlerini yönetin ve sistem istatistiklerini görüntüleyin</p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="text-red-600">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* System Status */}
        {systemConfig && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${systemConfig.enable_token_system ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                <span className="font-medium">Token Sistemi</span>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {systemConfig.enable_token_system ? 'Aktif' : 'Pasif'}
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${systemConfig.enable_subscription_system ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                <span className="font-medium">Abonelik Sistemi</span>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {systemConfig.enable_subscription_system ? 'Aktif' : 'Pasif'}
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center space-x-2">
                <Settings className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Sistem Modu</span>
              </div>
              <div className="text-sm text-gray-600 mt-1 capitalize">
                {systemConfig.system_mode}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('packages')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'packages'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Package className="inline h-4 w-4 mr-2" />
              Paket Yönetimi
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'analytics'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <BarChart3 className="inline h-4 w-4 mr-2" />
              İstatistikler
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'settings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Settings className="inline h-4 w-4 mr-2" />
              Ayarlar
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'packages' && (
        <div>
          {/* Package Management Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Token Paketleri</h2>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Yeni Paket</span>
            </button>
          </div>

          {/* Create Package Form */}
          {showCreateForm && (
            <div className="mb-6 bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h3 className="text-lg font-medium text-gray-800 mb-4">Yeni Token Paketi Oluştur</h3>
              <form onSubmit={handleCreatePackage} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Paket Adı</label>
                  <input
                    type="text"
                    value={packageForm.name}
                    onChange={(e) => setPackageForm({...packageForm, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Token Miktarı</label>
                  <input
                    type="number"
                    value={packageForm.token_amount}
                    onChange={(e) => setPackageForm({...packageForm, token_amount: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fiyat</label>
                  <input
                    type="number"
                    step="0.01"
                    value={packageForm.price}
                    onChange={(e) => setPackageForm({...packageForm, price: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Para Birimi</label>
                  <select
                    value={packageForm.currency}
                    onChange={(e) => setPackageForm({...packageForm, currency: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="USD">USD</option>
                    <option value="TRY">TRY</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                  <textarea
                    value={packageForm.description}
                    onChange={(e) => setPackageForm({...packageForm, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="2"
                  />
                </div>
                
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={packageForm.is_active}
                      onChange={(e) => setPackageForm({...packageForm, is_active: e.target.checked})}
                      className="rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Aktif</span>
                  </label>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sıralama</label>
                  <input
                    type="number"
                    value={packageForm.sort_order}
                    onChange={(e) => setPackageForm({...packageForm, sort_order: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                </div>
                
                <div className="md:col-span-2 flex space-x-3">
                  <button
                    type="submit"
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center space-x-2"
                  >
                    <Save className="h-4 w-4" />
                    <span>Kaydet</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    İptal
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Packages List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {packages.map((pkg) => (
              <div key={pkg.id} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-800">{pkg.name}</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <div className={`w-2 h-2 rounded-full ${pkg.is_active ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      <span className="text-sm text-gray-600">
                        {pkg.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => setEditingPackage(pkg)}
                      className="p-1 text-gray-400 hover:text-blue-500"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePackage(pkg.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Token Miktarı:</span>
                    <span className="font-medium">{pkg.token_amount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Fiyat:</span>
                    <span className="font-medium">{formatPrice(pkg.price, pkg.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Token Başına:</span>
                    <span className="text-sm text-gray-500">{formatPrice(pkg.price_per_token, pkg.currency)}</span>
                  </div>
                  {pkg.description && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-sm text-gray-600">{pkg.description}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Token Sistemi İstatistikleri</h2>
          
          {analytics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <Coins className="h-8 w-8 text-blue-500" />
                  <div>
                    <div className="text-2xl font-bold text-gray-800">
                      {analytics.total_tokens_in_circulation.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Dolaşımdaki Token</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <Users className="h-8 w-8 text-green-500" />
                  <div>
                    <div className="text-2xl font-bold text-gray-800">
                      {analytics.users_with_tokens}
                    </div>
                    <div className="text-sm text-gray-600">Token Sahibi Kullanıcı</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <DollarSign className="h-8 w-8 text-purple-500" />
                  <div>
                    <div className="text-2xl font-bold text-gray-800">
                      ${analytics.recent_revenue_30d.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600">Son 30 Gün Gelir</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <TrendingUp className="h-8 w-8 text-orange-500" />
                  <div>
                    <div className="text-2xl font-bold text-gray-800">
                      %{analytics.token_utilization_rate}
                    </div>
                    <div className="text-sm text-gray-600">Token Kullanım Oranı</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-500">İstatistik verileri mevcut değil</div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Sistem Ayarları</h2>
          
          {systemConfig ? (
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      İsim Üretimi Token Maliyeti
                    </label>
                    <input
                      type="number"
                      value={systemConfig.tokens_per_name_generation}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                      readOnly
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      İsim Analizi Token Maliyeti
                    </label>
                    <input
                      type="number"
                      value={systemConfig.tokens_per_name_analysis}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                      readOnly
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    <strong>Not:</strong> Sistem ayarları şu anda salt okunur modda. 
                    Değişiklik yapmak için backend konfigürasyonunu güncelleyin.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-500">Sistem ayarları yüklenemedi</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminTokenManagement; 