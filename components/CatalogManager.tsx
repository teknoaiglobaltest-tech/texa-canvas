// Catalog Manager Component - Admin UI untuk mengelola Katalog AI Premium
import React, { useState, useEffect } from 'react';
import {
    subscribeToCatalog,
    addCatalogItem,
    updateCatalogItem,
    deleteCatalogItem,
    toggleCatalogStatus,
    seedCatalogData,
    formatPrice,
    DEFAULT_CATEGORIES,
    CatalogItem
} from '../services/catalogService';

interface CatalogManagerProps {
    showToast: (message: string, type: 'success' | 'error') => void;
}

const CatalogManager: React.FC<CatalogManagerProps> = ({ showToast }) => {
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState<'add' | 'edit' | 'delete'>('add');
    const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
    const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        category: DEFAULT_CATEGORIES[0],
        imageUrl: '',
        targetUrl: '',
        status: 'active' as 'active' | 'inactive',
        priceMonthly: 0,
        // New fields for extension integration
        embedVideoUrl: '',
        cookiesData: '',
        apiUrl: ''
    });

    // Toggle for showing advanced extension fields
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Subscribe to catalog data
    useEffect(() => {
        const unsubscribe = subscribeToCatalog((fetchedItems) => {
            setItems(fetchedItems);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Filter items
    const filteredItems = items.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filter === 'all' || item.status === filter;
        return matchesSearch && matchesFilter;
    });

    // Reset form
    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            category: DEFAULT_CATEGORIES[0],
            imageUrl: '',
            targetUrl: '',
            status: 'active',
            priceMonthly: 0,
            embedVideoUrl: '',
            cookiesData: '',
            apiUrl: ''
        });
        setSelectedItem(null);
        setShowAdvanced(false);
    };

    // Open modal
    const openModal = (type: 'add' | 'edit' | 'delete', item?: CatalogItem) => {
        setModalType(type);
        if (item) {
            setSelectedItem(item);
            if (type === 'edit') {
                setFormData({
                    name: item.name,
                    description: item.description,
                    category: item.category,
                    imageUrl: item.imageUrl,
                    targetUrl: item.targetUrl,
                    status: item.status,
                    priceMonthly: item.priceMonthly,
                    embedVideoUrl: item.embedVideoUrl || '',
                    cookiesData: item.cookiesData || '',
                    apiUrl: item.apiUrl || ''
                });
                // Show advanced if any extension fields have data
                if (item.embedVideoUrl || item.cookiesData || item.apiUrl) {
                    setShowAdvanced(true);
                }
            }
        } else {
            resetForm();
        }
        setShowModal(true);
    };

    // Handle form submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);

        try {
            if (modalType === 'add') {
                const id = await addCatalogItem(formData);
                if (id) {
                    showToast('Tool berhasil ditambahkan! 🎉', 'success');
                    setShowModal(false);
                    resetForm();
                } else {
                    showToast('Gagal menambahkan tool', 'error');
                }
            } else if (modalType === 'edit' && selectedItem) {
                const success = await updateCatalogItem(selectedItem.id, formData);
                if (success) {
                    showToast('Tool berhasil diupdate! ✅', 'success');
                    setShowModal(false);
                    resetForm();
                } else {
                    showToast('Gagal mengupdate tool', 'error');
                }
            }
        } catch (error) {
            showToast('Terjadi kesalahan', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // Handle delete
    const handleDelete = async () => {
        if (!selectedItem) return;
        setActionLoading(true);

        try {
            const success = await deleteCatalogItem(selectedItem.id);
            if (success) {
                showToast('Tool berhasil dihapus! 🗑️', 'success');
                setShowModal(false);
                resetForm();
            } else {
                showToast('Gagal menghapus tool', 'error');
            }
        } catch (error) {
            showToast('Terjadi kesalahan', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // Handle toggle status
    const handleToggleStatus = async (item: CatalogItem) => {
        const success = await toggleCatalogStatus(item.id, item.status);
        if (success) {
            showToast(`"${item.name}" ${item.status === 'active' ? 'dinonaktifkan' : 'diaktifkan'}`, 'success');
        } else {
            showToast('Gagal mengubah status', 'error');
        }
    };

    // Seed data if empty
    const handleSeedData = async () => {
        setActionLoading(true);
        const success = await seedCatalogData();
        if (success) {
            showToast('Data katalog berhasil diisi! 🎉', 'success');
        } else {
            showToast('Katalog sudah memiliki data', 'error');
        }
        setActionLoading(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-400">Memuat katalog...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                        <span className="text-2xl">🛒</span> Kelola Katalog AI Premium
                    </h2>
                    <p className="text-slate-400 mt-1">Tambah, edit, atau hapus tools yang tampil di Marketplace</p>
                </div>
                <div className="flex gap-2">
                    {items.length === 0 && (
                        <button
                            onClick={handleSeedData}
                            disabled={actionLoading}
                            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition-all disabled:opacity-50"
                        >
                            📦 Muat Data Awal
                        </button>
                    )}
                    <button
                        onClick={() => openModal('add')}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                    >
                        <span className="text-lg">+</span> Tambah Tool Baru
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass rounded-2xl p-5 border border-white/10">
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Total Tools</p>
                    <p className="text-3xl font-black text-white">{items.length}</p>
                </div>
                <div className="glass rounded-2xl p-5 border border-emerald-500/20 bg-emerald-500/5">
                    <p className="text-[10px] text-emerald-400 uppercase font-black tracking-widest mb-1">Aktif</p>
                    <p className="text-3xl font-black text-emerald-400">{items.filter(i => i.status === 'active').length}</p>
                </div>
                <div className="glass rounded-2xl p-5 border border-red-500/20 bg-red-500/5">
                    <p className="text-[10px] text-red-400 uppercase font-black tracking-widest mb-1">Nonaktif</p>
                    <p className="text-3xl font-black text-red-400">{items.filter(i => i.status === 'inactive').length}</p>
                </div>
                <div className="glass rounded-2xl p-5 border border-amber-500/20 bg-amber-500/5">
                    <p className="text-[10px] text-amber-400 uppercase font-black tracking-widest mb-1">Kategori</p>
                    <p className="text-3xl font-black text-amber-400">{new Set(items.map(i => i.category)).size}</p>
                </div>
            </div>

            {/* Search and Filter */}
            <div className="glass rounded-2xl p-6 border border-white/10">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-grow relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                        <input
                            type="text"
                            placeholder="Cari tool berdasarkan nama..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-black/30 border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500 text-white placeholder:text-slate-500"
                        />
                    </div>
                    <div className="flex gap-2">
                        {(['all', 'active', 'inactive'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${filter === f
                                    ? 'bg-indigo-600 text-white'
                                    : 'glass border border-white/10 text-slate-400 hover:text-white'
                                    }`}
                            >
                                {f === 'all' ? 'Semua' : f === 'active' ? 'Aktif' : 'Nonaktif'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tools Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.length === 0 ? (
                    <div className="col-span-full text-center py-16">
                        <div className="text-6xl mb-4">📭</div>
                        <p className="text-slate-400 text-lg">
                            {searchTerm ? 'Tidak ada hasil pencarian' : 'Belum ada tool di katalog'}
                        </p>
                    </div>
                ) : (
                    filteredItems.map((item) => (
                        <div
                            key={item.id}
                            className={`glass rounded-2xl border overflow-hidden group transition-all hover:scale-[1.02] ${item.status === 'active' ? 'border-white/10' : 'border-red-500/30 opacity-60'
                                }`}
                        >
                            {/* Image */}
                            <div className="relative h-32 overflow-hidden">
                                <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x200?text=No+Image';
                                    }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                                <div className="absolute top-3 left-3">
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${item.status === 'active'
                                        ? 'bg-emerald-500/30 text-emerald-300'
                                        : 'bg-red-500/30 text-red-300'
                                        }`}>
                                        {item.status === 'active' ? '✓ Aktif' : '✗ Nonaktif'}
                                    </span>
                                </div>
                                <div className="absolute top-3 right-3">
                                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-black/50 text-white">
                                        {item.category}
                                    </span>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-4">
                                <h3 className="font-bold text-white text-lg mb-1">{item.name}</h3>
                                <p className="text-slate-400 text-xs line-clamp-2 mb-3">{item.description}</p>

                                {/* Extension Data Indicators */}
                                {(item.cookiesData || item.apiUrl || item.embedVideoUrl) && (
                                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                                        {item.cookiesData && (
                                            <span className="px-2 py-1 rounded-lg text-[9px] font-bold bg-amber-500/20 text-amber-400 flex items-center gap-1">
                                                🍪 Cookies
                                            </span>
                                        )}
                                        {item.apiUrl && (
                                            <span className="px-2 py-1 rounded-lg text-[9px] font-bold bg-cyan-500/20 text-cyan-400 flex items-center gap-1">
                                                🔗 API
                                            </span>
                                        )}
                                        {item.embedVideoUrl && (
                                            <span className="px-2 py-1 rounded-lg text-[9px] font-bold bg-purple-500/20 text-purple-400 flex items-center gap-1">
                                                🎬 Video
                                            </span>
                                        )}
                                    </div>
                                )}

                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-emerald-400 font-black text-lg">
                                        {formatPrice(item.priceMonthly)}
                                    </span>
                                    <span className="text-[10px] text-slate-500">/bulan</span>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleToggleStatus(item)}
                                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${item.status === 'active'
                                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                            : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                            }`}
                                    >
                                        {item.status === 'active' ? '🔒 Nonaktifkan' : '🔓 Aktifkan'}
                                    </button>
                                    <button
                                        onClick={() => openModal('edit', item)}
                                        className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-all"
                                        title="Edit"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={() => openModal('delete', item)}
                                        className="p-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                                        title="Hapus"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="glass rounded-3xl p-8 max-w-lg w-full border border-white/20 shadow-2xl max-h-[90vh] overflow-y-auto">
                        {/* Add/Edit Form */}
                        {(modalType === 'add' || modalType === 'edit') && (
                            <form onSubmit={handleSubmit}>
                                <h3 className="text-2xl font-black mb-6 flex items-center gap-2">
                                    {modalType === 'add' ? '➕ Tambah Tool Baru' : '✏️ Edit Tool'}
                                </h3>

                                <div className="space-y-4">
                                    {/* Name */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Nama Tool *</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Contoh: ChatGPT Plus"
                                            className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Deskripsi *</label>
                                        <textarea
                                            required
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="Deskripsi singkat tentang tool ini..."
                                            rows={3}
                                            className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500 resize-none"
                                        />
                                    </div>

                                    {/* Category */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Kategori *</label>
                                        <select
                                            required
                                            value={formData.category}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                                        >
                                            {DEFAULT_CATEGORIES.map(cat => (
                                                <option key={cat} value={cat} className="bg-slate-800">{cat}</option>
                                            ))}
                                            <option value="Lainnya" className="bg-slate-800">Lainnya</option>
                                        </select>
                                    </div>

                                    {/* Image URL */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">URL Gambar *</label>
                                        <input
                                            type="url"
                                            required
                                            value={formData.imageUrl}
                                            onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                                            placeholder="https://example.com/image.jpg"
                                            className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                                        />
                                        {formData.imageUrl && (
                                            <div className="mt-2 rounded-xl overflow-hidden h-24">
                                                <img
                                                    src={formData.imageUrl}
                                                    alt="Preview"
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Target URL */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">URL Target *</label>
                                        <input
                                            type="url"
                                            required
                                            value={formData.targetUrl}
                                            onChange={(e) => setFormData({ ...formData, targetUrl: e.target.value })}
                                            placeholder="https://tool-website.com"
                                            className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>

                                    {/* Price */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Harga/Bulan (IDR) *</label>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            value={formData.priceMonthly}
                                            onChange={(e) => setFormData({ ...formData, priceMonthly: parseInt(e.target.value) || 0 })}
                                            placeholder="50000"
                                            className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">Preview: {formatPrice(formData.priceMonthly)}</p>
                                    </div>

                                    {/* Status */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Status</label>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, status: 'active' })}
                                                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${formData.status === 'active'
                                                    ? 'bg-emerald-600 text-white'
                                                    : 'glass border border-white/10 text-slate-400'
                                                    }`}
                                            >
                                                ✓ Aktif
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, status: 'inactive' })}
                                                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${formData.status === 'inactive'
                                                    ? 'bg-red-600 text-white'
                                                    : 'glass border border-white/10 text-slate-400'
                                                    }`}
                                            >
                                                ✗ Nonaktif
                                            </button>
                                        </div>
                                    </div>

                                    {/* Advanced Extension Fields Toggle */}
                                    <div className="border-t border-white/10 pt-4 mt-4">
                                        <button
                                            type="button"
                                            onClick={() => setShowAdvanced(!showAdvanced)}
                                            className="w-full flex items-center justify-between px-4 py-3 rounded-xl glass border border-purple-500/30 hover:border-purple-500/50 transition-all group"
                                        >
                                            <span className="flex items-center gap-2 text-sm font-bold text-purple-400">
                                                🔌 Integrasi Extension TEXA-TOOLS
                                            </span>
                                            <span className={`text-purple-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>
                                                ▼
                                            </span>
                                        </button>
                                        <p className="text-[10px] text-slate-500 mt-2 px-1">
                                            Field tambahan untuk cookie injection dan API integration dengan extension
                                        </p>
                                    </div>

                                    {/* Advanced Fields (Collapsible) */}
                                    {showAdvanced && (
                                        <div className="space-y-4 p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20">

                                            {/* Embedded Video URL */}
                                            <div>
                                                <label className="block text-xs font-bold text-purple-400 mb-2 uppercase flex items-center gap-2">
                                                    🎬 URL Video Embed
                                                </label>
                                                <input
                                                    type="url"
                                                    value={formData.embedVideoUrl}
                                                    onChange={(e) => setFormData({ ...formData, embedVideoUrl: e.target.value })}
                                                    placeholder="https://youtube.com/shorts/xxxxx atau https://youtu.be/xxxxx"
                                                    className="w-full px-4 py-3 bg-black/30 border border-purple-500/20 rounded-xl text-white focus:outline-none focus:border-purple-500 placeholder:text-slate-600"
                                                />
                                                <p className="text-[10px] text-slate-500 mt-1">
                                                    Masukkan URL YouTube (shorts, watch, youtu.be) - akan otomatis dikonversi ke embed
                                                </p>
                                                {formData.embedVideoUrl && (() => {
                                                    // Parse YouTube URL to embed format
                                                    const url = formData.embedVideoUrl;
                                                    let videoId: string | null = null;

                                                    // Pattern 1: youtube.com/shorts/VIDEO_ID
                                                    const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/);
                                                    if (shortsMatch) videoId = shortsMatch[1];

                                                    // Pattern 2: youtube.com/watch?v=VIDEO_ID
                                                    const watchMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
                                                    if (watchMatch) videoId = watchMatch[1];

                                                    // Pattern 3: youtu.be/VIDEO_ID
                                                    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
                                                    if (shortMatch) videoId = shortMatch[1];

                                                    // Pattern 4: youtube.com/embed/VIDEO_ID
                                                    const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
                                                    if (embedMatch) videoId = embedMatch[1];

                                                    if (videoId) {
                                                        videoId = videoId.split('?')[0].split('&')[0];
                                                        const embedUrl = `https://www.youtube.com/embed/${videoId}`;
                                                        return (
                                                            <div className="mt-2 rounded-xl overflow-hidden h-32 bg-black/50">
                                                                <iframe
                                                                    src={embedUrl}
                                                                    className="w-full h-full"
                                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                                    allowFullScreen
                                                                    title="Video Preview"
                                                                />
                                                            </div>
                                                        );
                                                    }
                                                    return (
                                                        <div className="mt-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                                                            <p className="text-xs text-red-400">⚠️ URL tidak valid. Gunakan format YouTube yang benar.</p>
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            {/* Cookies Data */}
                                            <div>
                                                <label className="block text-xs font-bold text-amber-400 mb-2 uppercase flex items-center gap-2">
                                                    🍪 Data Cookies (JSON)
                                                </label>
                                                <textarea
                                                    value={formData.cookiesData}
                                                    onChange={(e) => setFormData({ ...formData, cookiesData: e.target.value })}
                                                    placeholder='[{"name": "session", "value": "xxx", "domain": ".example.com"}]'
                                                    rows={4}
                                                    className="w-full px-4 py-3 bg-black/30 border border-amber-500/20 rounded-xl text-amber-200 focus:outline-none focus:border-amber-500 font-mono text-xs placeholder:text-slate-600 resize-none"
                                                />
                                                <p className="text-[10px] text-slate-500 mt-1">
                                                    Format JSON array cookies untuk di-inject oleh extension. <span className="text-amber-400">⚠️ Sensitif!</span>
                                                </p>
                                                {formData.cookiesData && (
                                                    <div className="mt-2 flex items-center gap-2">
                                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${(() => { try { JSON.parse(formData.cookiesData); return true; } catch { return false; } })()
                                                            ? 'bg-emerald-500/20 text-emerald-400'
                                                            : 'bg-red-500/20 text-red-400'
                                                            }`}>
                                                            {(() => { try { JSON.parse(formData.cookiesData); return '✓ JSON Valid'; } catch { return '✗ JSON Invalid'; } })()}
                                                        </span>
                                                        {(() => { try { return JSON.parse(formData.cookiesData).length; } catch { return 0; } })() > 0 && (
                                                            <span className="text-[10px] text-slate-500">
                                                                {(() => { try { return JSON.parse(formData.cookiesData).length; } catch { return 0; } })()} cookies
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* API URL */}
                                            <div>
                                                <label className="block text-xs font-bold text-cyan-400 mb-2 uppercase flex items-center gap-2">
                                                    🔗 API URL
                                                </label>
                                                <input
                                                    type="url"
                                                    value={formData.apiUrl}
                                                    onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
                                                    placeholder="https://api.example.com/v1/cookies"
                                                    className="w-full px-4 py-3 bg-black/30 border border-cyan-500/20 rounded-xl text-white focus:outline-none focus:border-cyan-500 placeholder:text-slate-600"
                                                />
                                                <p className="text-[10px] text-slate-500 mt-1">
                                                    Endpoint API untuk fetch data/cookies secara dinamis oleh extension
                                                </p>
                                            </div>

                                            {/* Extension Status Indicator */}
                                            <div className="flex items-center gap-3 p-3 rounded-xl bg-black/30 border border-white/5">
                                                <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center">
                                                    <span className="text-lg">🔌</span>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-white">TEXA-TOOLS Extension</p>
                                                    <p className="text-[10px] text-slate-500">
                                                        Data ini akan di-inject otomatis saat member mengakses tool
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3 mt-8">
                                    <button
                                        type="button"
                                        onClick={() => { setShowModal(false); resetForm(); }}
                                        className="flex-1 py-3 rounded-xl glass border border-white/10 text-slate-400 font-bold hover:text-white transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={actionLoading}
                                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold hover:from-indigo-500 hover:to-purple-500 transition-colors disabled:opacity-50"
                                    >
                                        {actionLoading ? 'Menyimpan...' : modalType === 'add' ? 'Tambahkan' : 'Simpan Perubahan'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Delete Confirmation */}
                        {modalType === 'delete' && selectedItem && (
                            <>
                                <h3 className="text-2xl font-black mb-2 text-red-400">⚠️ Hapus Tool</h3>
                                <p className="text-slate-400 text-sm mb-4">
                                    Apakah Anda yakin ingin menghapus <strong className="text-white">{selectedItem.name}</strong>?
                                    Tindakan ini tidak dapat dibatalkan.
                                </p>

                                <div className="glass rounded-xl p-4 mb-6 border border-white/10">
                                    <div className="flex items-center gap-3">
                                        <img
                                            src={selectedItem.imageUrl}
                                            alt={selectedItem.name}
                                            className="w-16 h-16 rounded-lg object-cover"
                                        />
                                        <div>
                                            <p className="font-bold text-white">{selectedItem.name}</p>
                                            <p className="text-xs text-slate-400">{selectedItem.category}</p>
                                            <p className="text-xs text-emerald-400 font-bold">{formatPrice(selectedItem.priceMonthly)}/bulan</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => { setShowModal(false); resetForm(); }}
                                        className="flex-1 py-3 rounded-xl glass border border-white/10 text-slate-400 font-bold hover:text-white transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        disabled={actionLoading}
                                        className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 transition-colors disabled:opacity-50"
                                    >
                                        {actionLoading ? 'Menghapus...' : '🗑️ Hapus Permanen'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CatalogManager;
