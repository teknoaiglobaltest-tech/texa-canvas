
import React, { useState, useEffect } from 'react';
import { AITool } from '../types';
import { TexaUser } from '../services/firebase';
import ToolCard from './ToolCard';
import { subscribeToCatalog, CatalogItem } from '../services/catalogService';

// Fallback mock tools (used when Firestore is empty)
const MOCK_TOOLS: AITool[] = [
  {
    id: '1',
    name: 'ChatGPT Plus (Shared)',
    description: 'Akses penuh ke GPT-4o, DALL·E 3, dan fitur analisis data tercanggih.',
    category: 'Menulis & Riset',
    imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=400',
    targetUrl: 'https://chat.openai.com',
    status: 'active',
    priceMonthly: 45000
  },
  {
    id: '2',
    name: 'Midjourney Pro',
    description: 'Generate gambar AI kualitas tinggi tanpa batas dengan mode cepat.',
    category: 'Desain & Art',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=400',
    targetUrl: 'https://midjourney.com',
    status: 'active',
    priceMonthly: 75000
  },
  {
    id: '3',
    name: 'Canva Pro Teams',
    description: 'Buka jutaan aset premium dan hapus background otomatis.',
    category: 'Desain Grafis',
    imageUrl: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&q=80&w=400',
    targetUrl: 'https://canva.com',
    status: 'active',
    priceMonthly: 15000
  },
  {
    id: '4',
    name: 'Jasper AI Business',
    description: 'Bikin konten sosmed dan iklan 10x lebih cepat dengan AI.',
    category: 'Marketing',
    imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=400',
    targetUrl: 'https://jasper.ai',
    status: 'active',
    priceMonthly: 99000
  },
  {
    id: '5',
    name: 'Claude 3.5 Sonnet',
    description: 'AI cerdas untuk coding dan penulisan kreatif dengan konteks luas.',
    category: 'Coding & Teks',
    imageUrl: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=400',
    targetUrl: 'https://claude.ai',
    status: 'active',
    priceMonthly: 55000
  },
  {
    id: '6',
    name: 'Grammarly Premium',
    description: 'Cek tata bahasa Inggris otomatis dan kirim email tanpa typo.',
    category: 'Produktivitas',
    imageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&q=80&w=400',
    targetUrl: 'https://grammarly.com',
    status: 'active',
    priceMonthly: 25000
  }
];

interface MarketplaceProps {
  user: TexaUser | null;
}

const Marketplace: React.FC<MarketplaceProps> = ({ user }) => {
  const [filter, setFilter] = useState('Semua');
  const [tools, setTools] = useState<AITool[]>(MOCK_TOOLS);
  const [loading, setLoading] = useState(true);

  // Subscribe to catalog from Firestore
  useEffect(() => {
    const unsubscribe = subscribeToCatalog((items: CatalogItem[]) => {
      // Only show active items
      const activeItems = items.filter(item => item.status === 'active');

      if (activeItems.length > 0) {
        setTools(activeItems);
      } else {
        // Fallback to mock if no items in Firestore
        setTools(MOCK_TOOLS);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const categories = ['Semua', ...new Set(tools.map(t => t.category))];

  const filteredTools = filter === 'Semua'
    ? tools
    : tools.filter(t => t.category === filter);

  return (
    <section id="marketplace" className="py-4 md:py-8 scroll-mt-24">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 md:mb-10 gap-4 md:gap-8 px-2">
        <div className="max-w-xl">
          <h2 className="text-xl md:text-3xl font-black mb-1 md:mb-2 tracking-tight">Katalog AI Premium</h2>
          <p className="text-xs md:text-base text-slate-400 font-medium">Aktifkan tool favoritmu dalam hitungan detik.</p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 w-full lg:w-auto no-scrollbar mask-fade-right">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-4 md:px-5 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold transition-all whitespace-nowrap border smooth-animate ${filter === cat
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg'
                : 'glass border-white/5 text-slate-400 hover:text-white hover:border-white/10'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 px-2">
        {filteredTools.map(tool => {
          // Check if user has active subscription
          const hasActiveSubscription = user?.subscriptionEnd
            ? new Date(user.subscriptionEnd) > new Date()
            : false;

          return (
            <ToolCard
              key={tool.id}
              tool={tool}
              hasAccess={hasActiveSubscription}
            />
          );
        })}
      </div>
    </section>
  );
};

export default Marketplace;
