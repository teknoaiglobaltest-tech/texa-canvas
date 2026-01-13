import React, { useState, useEffect } from 'react';
import { TexaUser } from '../services/firebase';
import {
  subscribeToUsers,
  updateUser,
  deleteUser,
  toggleUserStatus,
  changeUserRole,
  createManualMember,
  createAuthMemberWithPassword,
  setMemberPassword,
  setUserSubscription,
  removeUserSubscription,
  subscribeToSubscriptionRecords,
  calculateTotalRevenue,
  getAdminStats,
  searchUsers,
  filterUsersByStatus,
  formatDate,
  getDaysRemaining,
  getSubscriptionStatus,
  AdminStats
} from '../services/adminService';
import CatalogManager from './CatalogManager';
import SubscriptionSettingsManager from './SubscriptionSettings';
import {
  subscribeToRevenueShareSettings,
  saveRevenueShareSettings,
  RevenueSharePerson,
  RevenueShareRole,
  formatIDR
} from '../services/subscriptionService';
import toketHtml from '../tambahan/toket.txt?raw';

// Tab type
type AdminTab = 'members' | 'catalog' | 'subscription' | 'revenueShare' | 'toket';

const AdminDashboard: React.FC = () => {
  // Current active tab
  const [activeTab, setActiveTab] = useState<AdminTab>('members');

  const [users, setUsers] = useState<TexaUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<TexaUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'admin' | 'member'>('all');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [revenueSharePeople, setRevenueSharePeople] = useState<RevenueSharePerson[]>([]);
  const [selectedUser, setSelectedUser] = useState<TexaUser | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'subscription' | 'edit' | 'delete' | 'add' | 'password'>('edit');
  const [subscriptionDays, setSubscriptionDays] = useState(30);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [manualEmail, setManualEmail] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualRole, setManualRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [manualDays, setManualDays] = useState(30);
  const [manualIsActive, setManualIsActive] = useState(true);
  const [manualPassword, setManualPassword] = useState('');
  const [manualPasswordConfirm, setManualPasswordConfirm] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

  // Subscribe to users on mount
  useEffect(() => {
    const unsubscribe = subscribeToUsers((fetchedUsers) => {
      setUsers(fetchedUsers);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToSubscriptionRecords((records) => {
      setTotalRevenue(calculateTotalRevenue(records));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToRevenueShareSettings((settings) => {
      setRevenueSharePeople(settings.people || []);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setStats(getAdminStats(users, totalRevenue));
  }, [users, totalRevenue]);

  // Filter users when search or filter changes
  useEffect(() => {
    let result = users;
    result = searchUsers(result, searchTerm);
    result = filterUsersByStatus(result, statusFilter);
    setFilteredUsers(result);
  }, [users, searchTerm, statusFilter]);

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Handle actions
  const handleToggleStatus = async (user: TexaUser) => {
    setActionLoading(true);
    const success = await toggleUserStatus(user.id, !user.isActive);
    if (success) {
      showToast(`User ${user.isActive ? 'dinonaktifkan' : 'diaktifkan'}`, 'success');
    } else {
      showToast('Gagal mengubah status user', 'error');
    }
    setActionLoading(false);
  };

  const handleChangeRole = async (user: TexaUser) => {
    setActionLoading(true);
    const newRole = user.role === 'ADMIN' ? 'MEMBER' : 'ADMIN';
    const success = await changeUserRole(user.id, newRole);
    if (success) {
      showToast(`Role diubah ke ${newRole}`, 'success');
    } else {
      showToast('Gagal mengubah role', 'error');
    }
    setActionLoading(false);
  };

  const openPasswordModal = (user: TexaUser) => {
    setSelectedUser(user);
    setModalType('password');
    setNewPassword('');
    setNewPasswordConfirm('');
    setShowModal(true);
  };

  const handleSetSubscription = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    const success = await setUserSubscription(selectedUser.id, subscriptionDays);
    if (success) {
      showToast(`Subscription aktif untuk ${subscriptionDays} hari`, 'success');
      setShowModal(false);
    } else {
      showToast('Gagal mengatur subscription', 'error');
    }
    setActionLoading(false);
  };

  const handleRemoveSubscription = async (user: TexaUser) => {
    setActionLoading(true);
    const success = await removeUserSubscription(user.id);
    if (success) {
      showToast('Subscription dihapus', 'success');
    } else {
      showToast('Gagal menghapus subscription', 'error');
    }
    setActionLoading(false);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    const success = await deleteUser(selectedUser.id);
    if (success) {
      showToast('User dihapus', 'success');
      setShowModal(false);
      setSelectedUser(null);
    } else {
      showToast('Gagal menghapus user', 'error');
    }
    setActionLoading(false);
  };

  const openModal = (user: TexaUser, type: 'subscription' | 'edit' | 'delete') => {
    setSelectedUser(user);
    setModalType(type);
    setShowModal(true);
  };

  const openAddModal = () => {
    setSelectedUser(null);
    setModalType('add');
    setManualEmail('');
    setManualName('');
    setManualRole('MEMBER');
    setManualDays(30);
    setManualIsActive(true);
    setManualPassword('');
    setManualPasswordConfirm('');
    setShowModal(true);
  };

  const revenueShareTotalPercent = revenueSharePeople.reduce((sum, p) => sum + (Number.isFinite(p.percent) ? p.percent : 0), 0);

  const addRevenueSharePerson = () => {
    setRevenueSharePeople((prev) => [
      ...prev,
      { id: `person-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: '', role: 'KARYAWAN', percent: 0 }
    ]);
  };

  const removeRevenueSharePerson = (id: string) => {
    setRevenueSharePeople((prev) => prev.filter((p) => p.id !== id));
  };

  const updateRevenueSharePerson = (id: string, updates: Partial<RevenueSharePerson>) => {
    setRevenueSharePeople((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const handleSaveRevenueShare = async () => {
    setActionLoading(true);
    try {
      const success = await saveRevenueShareSettings({ people: revenueSharePeople });
      if (success) showToast('Bagi hasil tersimpan', 'success');
      else showToast('Gagal menyimpan bagi hasil', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateManualMember = async () => {
    setActionLoading(true);
    try {
      const hasPassword = manualPassword.trim().length > 0;
      if (hasPassword && manualPassword !== manualPasswordConfirm) {
        showToast('Konfirmasi password tidak sama', 'error');
        return;
      }

      if (hasPassword) {
        await createAuthMemberWithPassword({
          email: manualEmail,
          password: manualPassword,
          name: manualName,
          role: manualRole,
          isActive: manualIsActive,
          subscriptionDays: manualDays
        });
        showToast('Member login dibuat/diupdate', 'success');
        setShowModal(false);
        return;
      }

      const result = await createManualMember({
        email: manualEmail,
        name: manualName,
        role: manualRole,
        isActive: manualIsActive,
        subscriptionDays: manualDays
      });

      if (result.success) {
        showToast(result.action === 'updated' ? 'Member diperbarui' : 'Member manual ditambahkan', 'success');
        setShowModal(false);
      } else {
        showToast('Gagal menambah member manual', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan member', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetMemberPassword = async () => {
    if (!selectedUser) return;
    if (newPassword !== newPasswordConfirm) {
      showToast('Konfirmasi password tidak sama', 'error');
      return;
    }
    setActionLoading(true);
    try {
      await setMemberPassword({ uid: selectedUser.id, password: newPassword });
      showToast('Password berhasil diubah', 'success');
      setShowModal(false);
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah password', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Render status badge
  const renderStatusBadge = (user: TexaUser) => {
    const status = getSubscriptionStatus(user.subscriptionEnd || null);
    const daysLeft = getDaysRemaining(user.subscriptionEnd || null);

    if (status === 'active') {
      return (
        <div className="flex flex-col">
          <span className="px-2 py-1 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-400 uppercase">
            Aktif
          </span>
          <span className="text-[9px] text-emerald-400/70 mt-0.5">{daysLeft} hari lagi</span>
        </div>
      );
    } else if (status === 'expired') {
      return (
        <span className="px-2 py-1 text-[10px] font-bold rounded-full bg-red-500/20 text-red-400 uppercase">
          Expired
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-[10px] font-bold rounded-full bg-gray-500/20 text-gray-400 uppercase">
        Free
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Memuat data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-6 py-3 rounded-xl shadow-2xl font-bold text-sm flex items-center gap-2 animate-pulse ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.message}
        </div>
      )}

      {/* Mini Navigation Bar */}
      <div className="glass rounded-2xl border border-white/10 px-6 py-3 mb-6 flex items-center justify-between">
        <a href="#/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 premium-gradient rounded-xl flex items-center justify-center">
            <span className="text-white font-black text-lg">T</span>
          </div>
          <div>
            <span className="font-black text-white text-lg">TEXA</span>
            <span className="font-black text-indigo-400 text-lg">TOOLS</span>
          </div>
        </a>
        <div className="flex items-center gap-3">
          <a
            href="#/"
            className="px-4 py-2 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2"
          >
            ← Kembali ke Marketplace
          </a>
          <a
            href="#/profile"
            className="px-4 py-2 rounded-xl text-sm font-bold glass border border-white/10 text-white hover:border-indigo-500/50 transition-all"
          >
            👤 Profil
          </a>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <span className="text-3xl">👑</span> Admin Dashboard
          </h1>
          <p className="text-slate-400 mt-1">Kelola seluruh member, subscription, dan katalog TEXA-TOOLS</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 p-1.5 glass rounded-2xl border border-white/10 flex-wrap">
          <button
            onClick={() => setActiveTab('members')}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'members'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
          >
            👥 Kelola Member
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'catalog'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
          >
            🛒 Katalog AI Premium
          </button>
          <button
            onClick={() => setActiveTab('subscription')}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'subscription'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
          >
            💳 Pengaturan Subscription
          </button>
          <button
            onClick={() => setActiveTab('revenueShare')}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'revenueShare'
              ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
          >
            💸 Bagi Hasil
          </button>
          <button
            onClick={() => setActiveTab('toket')}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'toket'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
          >
            🗝️ Toket
          </button>
        </div>
      </div>

      {/* Render Active Tab Content */}
      {activeTab === 'catalog' ? (
        <CatalogManager showToast={showToast} />
      ) : activeTab === 'subscription' ? (
        <SubscriptionSettingsManager showToast={showToast} />
      ) : activeTab === 'revenueShare' ? (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-6 border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-white flex items-center gap-2">💸 Pengaturan Bagi Hasil</h3>
              <p className="text-slate-400 text-sm mt-1">
                Total pendapatan dihitung otomatis dari transaksi berstatus paid/active.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={addRevenueSharePerson}
                className="px-4 py-2 rounded-xl text-xs font-black glass border border-white/10 text-white hover:border-amber-500/50 transition-all"
              >
                ➕ Tambah Penerima
              </button>
              <button
                onClick={handleSaveRevenueShare}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-black bg-amber-600 text-white hover:bg-amber-500 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass rounded-2xl p-5 border border-purple-500/20 bg-purple-500/5">
              <p className="text-[10px] text-purple-400 uppercase font-black tracking-widest mb-1">Total Pendapatan</p>
              <p className="text-2xl font-black text-purple-400">{formatIDR(stats?.totalRevenue || 0)}</p>
            </div>
            <div className={`glass rounded-2xl p-5 border ${Math.abs(revenueShareTotalPercent - 100) < 0.0001 ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
              <p className={`text-[10px] uppercase font-black tracking-widest mb-1 ${Math.abs(revenueShareTotalPercent - 100) < 0.0001 ? 'text-emerald-400' : 'text-red-400'}`}>
                Total Persen
              </p>
              <p className={`text-2xl font-black ${Math.abs(revenueShareTotalPercent - 100) < 0.0001 ? 'text-emerald-400' : 'text-red-400'}`}>
                {revenueShareTotalPercent}%
              </p>
            </div>
            <div className="glass rounded-2xl p-5 border border-white/10">
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Catatan</p>
              <p className="text-xs text-slate-400">
                Jika total persen tidak 100%, nominal hasil akan mengikuti persen.
              </p>
            </div>
          </div>

          <div className="glass rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-lg">Daftar Penerima</h3>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest">Realtime Settings</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="px-6 py-4 text-[10px] text-slate-500 uppercase font-black tracking-widest">Nama</th>
                    <th className="px-6 py-4 text-[10px] text-slate-500 uppercase font-black tracking-widest">Role</th>
                    <th className="px-6 py-4 text-[10px] text-slate-500 uppercase font-black tracking-widest">Persen</th>
                    <th className="px-6 py-4 text-[10px] text-slate-500 uppercase font-black tracking-widest">Nominal</th>
                    <th className="px-6 py-4 text-[10px] text-slate-500 uppercase font-black tracking-widest text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueSharePeople.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                        Belum ada penerima. Klik "Tambah Penerima".
                      </td>
                    </tr>
                  ) : (
                    revenueSharePeople.map((p) => {
                      const revenue = stats?.totalRevenue || 0;
                      const amount = (revenue * (Number.isFinite(p.percent) ? p.percent : 0)) / 100;
                      return (
                        <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4">
                            <input
                              value={p.name}
                              onChange={(e) => updateRevenueSharePerson(p.id, { name: e.target.value })}
                              className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-xl text-white text-sm"
                              placeholder="Nama penerima"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={p.role}
                              onChange={(e) => updateRevenueSharePerson(p.id, { role: e.target.value as RevenueShareRole })}
                              className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-xl text-white text-sm"
                            >
                              <option value="OWNER">OWNER</option>
                              <option value="ADMIN">ADMIN</option>
                              <option value="KARYAWAN">KARYAWAN</option>
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={p.percent}
                                onChange={(e) => updateRevenueSharePerson(p.id, { percent: Number(e.target.value) })}
                                className="w-28 px-3 py-2 bg-black/30 border border-white/10 rounded-xl text-white text-sm"
                              />
                              <span className="text-slate-400 text-sm">%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-300 font-bold">
                            {formatIDR(amount)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => removeRevenueSharePerson(p.id)}
                              className="px-3 py-2 rounded-xl text-xs font-black bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors"
                            >
                              🗑️ Hapus
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'toket' ? (
        <div className="space-y-4">
          <div className="glass rounded-2xl p-6 border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-white flex items-center gap-2">🗝️ Toket Vault</h3>
              <p className="text-slate-400 text-sm mt-1">Halaman HTML ini bisa dibuka publik via #/toket.</p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="#/toket"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl text-xs font-black bg-cyan-600 text-white hover:bg-cyan-500 transition-colors"
              >
                🌐 Buka URL Publik
              </a>
            </div>
          </div>
          <div className="glass rounded-2xl border border-white/10 overflow-hidden">
            <iframe title="Toket" srcDoc={toketHtml} className="w-full h-[80vh] bg-white" />
          </div>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-8">
              <div className="glass rounded-2xl p-5 border border-white/10">
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Total User</p>
                <p className="text-3xl font-black text-white">{stats.totalUsers}</p>
              </div>
              <div className="glass rounded-2xl p-5 border border-emerald-500/20 bg-emerald-500/5">
                <p className="text-[10px] text-emerald-400 uppercase font-black tracking-widest mb-1">Aktif</p>
                <p className="text-3xl font-black text-emerald-400">{stats.activeSubscriptions}</p>
              </div>
              <div className="glass rounded-2xl p-5 border border-red-500/20 bg-red-500/5">
                <p className="text-[10px] text-red-400 uppercase font-black tracking-widest mb-1">Expired</p>
                <p className="text-3xl font-black text-red-400">{stats.expiredSubscriptions}</p>
              </div>
              <div className="glass rounded-2xl p-5 border border-purple-500/20 bg-purple-500/5">
                <p className="text-[10px] text-purple-400 uppercase font-black tracking-widest mb-1">Pendapatan</p>
                <p className="text-xl font-black text-purple-400">{formatIDR(stats.totalRevenue)}</p>
              </div>
              <div className="glass rounded-2xl p-5 border border-amber-500/20 bg-amber-500/5">
                <p className="text-[10px] text-amber-400 uppercase font-black tracking-widest mb-1">Admin</p>
                <p className="text-3xl font-black text-amber-400">{stats.adminCount}</p>
              </div>
              <div className="glass rounded-2xl p-5 border border-indigo-500/20 bg-indigo-500/5">
                <p className="text-[10px] text-indigo-400 uppercase font-black tracking-widest mb-1">Member</p>
                <p className="text-3xl font-black text-indigo-400">{stats.totalUsers - stats.adminCount}</p>
              </div>
              <div className="glass rounded-2xl p-5 border border-purple-500/20 bg-purple-500/5">
                <p className="text-[10px] text-purple-400 uppercase font-black tracking-widest mb-1">Hari Ini</p>
                <p className="text-3xl font-black text-purple-400">+{stats.newUsersToday}</p>
              </div>
            </div>
          )}

          {/* Search and Filter */}
          <div className="glass rounded-2xl p-6 border border-white/10 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-grow relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                <input
                  type="text"
                  placeholder="Cari berdasarkan nama, email, atau ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-black/30 border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {['all', 'active', 'expired', 'admin', 'member'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter as any)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${statusFilter === filter
                      ? 'bg-indigo-600 text-white'
                      : 'glass border border-white/10 text-slate-400 hover:text-white'
                      }`}
                  >
                    {filter === 'all' ? 'Semua' : filter}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="glass rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-bold text-lg">Daftar Member ({filteredUsers.length})</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={openAddModal}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
                >
                  ➕ Tambah Member Manual
                </button>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Realtime Updates</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="px-6 py-4 text-[10px] text-slate-500 uppercase font-black tracking-widest">User</th>
                    <th className="px-6 py-4 text-[10px] text-slate-500 uppercase font-black tracking-widest">Role</th>
                    <th className="px-6 py-4 text-[10px] text-slate-500 uppercase font-black tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] text-slate-500 uppercase font-black tracking-widest">Subscription</th>
                    <th className="px-6 py-4 text-[10px] text-slate-500 uppercase font-black tracking-widest">Terdaftar</th>
                    <th className="px-6 py-4 text-[10px] text-slate-500 uppercase font-black tracking-widest">Login Terakhir</th>
                    <th className="px-6 py-4 text-[10px] text-slate-500 uppercase font-black tracking-widest text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        {searchTerm ? 'Tidak ada hasil pencarian' : 'Belum ada user terdaftar'}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {user.photoURL ? (
                              <img src={user.photoURL} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
                                {user.name[0].toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-white">{user.name}</p>
                              <p className="text-xs text-slate-500">{user.email}</p>
                              <p className="text-[9px] text-slate-600 font-mono">{user.id.slice(0, 12)}...</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${user.role === 'ADMIN'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-indigo-500/20 text-indigo-400'
                            }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${user.isActive
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/20 text-red-400'
                            }`}>
                            {user.isActive ? '● Online' : '○ Offline'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {renderStatusBadge(user)}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400">
                          {formatDate(user.lastLogin)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                            {/* Subscription Button */}
                            <button
                              onClick={() => openModal(user, 'subscription')}
                              className="p-2 rounded-lg hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                              title="Atur Subscription"
                            >
                              💎
                            </button>
                            {/* Toggle Status */}
                            <button
                              onClick={() => handleToggleStatus(user)}
                              disabled={actionLoading}
                              className={`p-2 rounded-lg transition-colors ${user.isActive ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-emerald-500/20 text-emerald-400'
                                }`}
                              title={user.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                            >
                              {user.isActive ? '🔒' : '🔓'}
                            </button>
                            {/* Change Role */}
                            <button
                              onClick={() => handleChangeRole(user)}
                              disabled={actionLoading}
                              className="p-2 rounded-lg hover:bg-amber-500/20 text-amber-400 transition-colors"
                              title="Ubah Role"
                            >
                              👑
                            </button>
                            {/* Edit Password */}
                            <button
                              onClick={() => openPasswordModal(user)}
                              disabled={actionLoading}
                              className="p-2 rounded-lg hover:bg-indigo-500/20 text-indigo-400 transition-colors"
                              title="Edit Password"
                            >
                              🔑
                            </button>
                            {/* Delete */}
                            <button
                              onClick={() => openModal(user, 'delete')}
                              className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                              title="Hapus User"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal */}
          {showModal && (modalType === 'add' || selectedUser) && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
              <div className="glass rounded-3xl p-8 max-w-md w-full border border-white/20 shadow-2xl">
                {modalType === 'add' && (
                  <>
                    <h3 className="text-2xl font-black mb-2">➕ Tambah Member Manual</h3>
                    <p className="text-slate-400 text-sm mb-6">Buat/upgrade member berdasarkan email</p>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Email *</label>
                        <input
                          type="email"
                          value={manualEmail}
                          onChange={(e) => setManualEmail(e.target.value)}
                          className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white"
                          placeholder="contoh@email.com"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Nama</label>
                        <input
                          type="text"
                          value={manualName}
                          onChange={(e) => setManualName(e.target.value)}
                          className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white"
                          placeholder="Nama lengkap (opsional)"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Password</label>
                          <input
                            type="password"
                            value={manualPassword}
                            onChange={(e) => setManualPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white"
                            placeholder="Minimal 6 karakter"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Konfirmasi</label>
                          <input
                            type="password"
                            value={manualPasswordConfirm}
                            onChange={(e) => setManualPasswordConfirm(e.target.value)}
                            className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white"
                            placeholder="Ulangi password"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Role</label>
                          <select
                            value={manualRole}
                            onChange={(e) => setManualRole(e.target.value as any)}
                          className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white"
                          >
                            <option value="MEMBER">MEMBER</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Status</label>
                          <select
                            value={manualIsActive ? 'active' : 'inactive'}
                            onChange={(e) => setManualIsActive(e.target.value === 'active')}
                            className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white"
                          >
                            <option value="active">Aktif</option>
                            <option value="inactive">Nonaktif</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Durasi (Hari)</label>
                        <div className="flex gap-2 flex-wrap mb-4">
                          {[7, 30, 90, 180, 365].map((days) => (
                            <button
                              key={days}
                              onClick={() => setManualDays(days)}
                              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${manualDays === days
                                ? 'bg-emerald-600 text-white'
                                : 'glass border border-white/10 text-slate-400 hover:text-white'
                                }`}
                            >
                              {days} Hari
                            </button>
                          ))}
                        </div>
                        <input
                          type="number"
                          value={manualDays}
                          onChange={(e) => setManualDays(parseInt(e.target.value) || 0)}
                          className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white"
                          placeholder="Custom hari..."
                        />
                      </div>

                      <div className="flex gap-3 mt-6">
                        <button
                          onClick={() => setShowModal(false)}
                          className="flex-1 py-3 rounded-xl glass border border-white/10 text-slate-400 font-bold hover:text-white transition-colors"
                        >
                          Batal
                        </button>
                        <button
                          onClick={handleCreateManualMember}
                          disabled={actionLoading}
                          className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 transition-colors disabled:opacity-50"
                        >
                          {actionLoading ? 'Menyimpan...' : 'Simpan'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
                {modalType === 'password' && selectedUser && (
                  <>
                    <h3 className="text-2xl font-black mb-2">🔑 Edit Password</h3>
                    <p className="text-slate-400 text-sm mb-6">User: {selectedUser.email}</p>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Password Baru</label>
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white"
                            placeholder="Minimal 6 karakter"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Konfirmasi</label>
                          <input
                            type="password"
                            value={newPasswordConfirm}
                            onChange={(e) => setNewPasswordConfirm(e.target.value)}
                            className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white"
                            placeholder="Ulangi password"
                          />
                        </div>
                      </div>

                      <div className="flex gap-3 mt-6">
                        <button
                          onClick={() => setShowModal(false)}
                          className="flex-1 py-3 rounded-xl glass border border-white/10 text-slate-400 font-bold hover:text-white transition-colors"
                        >
                          Batal
                        </button>
                        <button
                          onClick={handleSetMemberPassword}
                          disabled={actionLoading}
                          className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 transition-colors disabled:opacity-50"
                        >
                          {actionLoading ? 'Menyimpan...' : 'Simpan'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
                {modalType === 'subscription' && (
                  <>
                    <h3 className="text-2xl font-black mb-2">💎 Atur Subscription</h3>
                    <p className="text-slate-400 text-sm mb-6">User: {selectedUser.email}</p>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Durasi (Hari)</label>
                        <div className="flex gap-2 flex-wrap mb-4">
                          {[7, 30, 90, 180, 365].map((days) => (
                            <button
                              key={days}
                              onClick={() => setSubscriptionDays(days)}
                              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${subscriptionDays === days
                                ? 'bg-emerald-600 text-white'
                                : 'glass border border-white/10 text-slate-400 hover:text-white'
                                }`}
                            >
                              {days} Hari
                            </button>
                          ))}
                        </div>
                        <input
                          type="number"
                          value={subscriptionDays}
                          onChange={(e) => setSubscriptionDays(parseInt(e.target.value) || 0)}
                          className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white"
                          placeholder="Custom hari..."
                        />
                      </div>

                      <div className="flex gap-3 mt-6">
                        <button
                          onClick={() => setShowModal(false)}
                          className="flex-1 py-3 rounded-xl glass border border-white/10 text-slate-400 font-bold hover:text-white transition-colors"
                        >
                          Batal
                        </button>
                        <button
                          onClick={handleSetSubscription}
                          disabled={actionLoading}
                          className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-colors disabled:opacity-50"
                        >
                          {actionLoading ? 'Memproses...' : 'Aktifkan'}
                        </button>
                      </div>

                      {selectedUser.subscriptionEnd && (
                        <button
                          onClick={() => handleRemoveSubscription(selectedUser)}
                          disabled={actionLoading}
                          className="w-full py-3 rounded-xl border border-red-500/30 text-red-400 font-bold hover:bg-red-500/10 transition-colors"
                        >
                          Hapus Subscription
                        </button>
                      )}
                    </div>
                  </>
                )}

                {modalType === 'delete' && (
                  <>
                    <h3 className="text-2xl font-black mb-2 text-red-400">⚠️ Hapus User</h3>
                    <p className="text-slate-400 text-sm mb-6">
                      Apakah Anda yakin ingin menghapus user <strong>{selectedUser.email}</strong>?
                      Tindakan ini tidak dapat dibatalkan.
                    </p>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowModal(false)}
                        className="flex-1 py-3 rounded-xl glass border border-white/10 text-slate-400 font-bold hover:text-white transition-colors"
                      >
                        Batal
                      </button>
                      <button
                        onClick={handleDeleteUser}
                        disabled={actionLoading}
                        className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 transition-colors disabled:opacity-50"
                      >
                        {actionLoading ? 'Menghapus...' : 'Hapus'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
