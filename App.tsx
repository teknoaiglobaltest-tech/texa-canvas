
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Marketplace from './components/Marketplace';
import AdminDashboard from './components/AdminDashboard';
import UserProfile from './components/UserProfile';
import Login from './components/Login';
import Hero from './components/Hero';
import SplashCursor from './components/SplashCursor';
import ToolIframePage from './components/ToolIframePage';
import { onAuthChange, logOut, TexaUser } from './services/firebase';
import { PopupProvider, usePopup } from './services/popupContext';
import toketHtml from './tambahan/toket.txt?raw';

// Inner component that has access to useLocation
const AppContent: React.FC<{
  user: TexaUser | null;
  onLogin: (userData: TexaUser) => void;
  onLogout: () => void;
}> = ({ user, onLogin, onLogout }) => {
  const location = useLocation();
  const { isAnyPopupOpen } = usePopup();

  // Check if current route should hide header/footer
  const isAdminPage = location.pathname === '/admin';
  const isLoginPage = location.pathname === '/login';
  const isToketPage = location.pathname === '/toket';
  const isToolIframePage = location.pathname.startsWith('/tool/');
  const hideHeaderFooter = isAdminPage || isLoginPage || isToketPage || isToolIframePage;

  // Hide header/footer when any popup is open
  const shouldHideNavigation = hideHeaderFooter || isAnyPopupOpen;

  return (
    <div className="min-h-screen flex flex-col relative">
      <SplashCursor />

      {/* Conditionally render Navbar - hidden on admin/login pages and when popup is open */}
      <div
        className={`transition-all duration-300 ease-in-out ${shouldHideNavigation
            ? 'opacity-0 pointer-events-none h-0 overflow-hidden'
            : 'opacity-100'
          }`}
      >
        {!hideHeaderFooter && <Navbar user={user} onLogout={onLogout} />}
      </div>

      <main className={`flex-grow container mx-auto px-4 relative z-10 ${hideHeaderFooter ? 'py-4' : 'py-8'}`}>
        <Routes>
          <Route path="/" element={
            <>
              {!user && <Hero />}
              <Marketplace user={user} />
            </>
          } />

          <Route path="/login" element={
            user ? <Navigate to="/" /> : <Login onLogin={onLogin} />
          } />

          <Route path="/profile" element={
            user ? <UserProfile user={user} /> : <Navigate to="/login" />
          } />

          <Route path="/admin" element={
            user?.role === 'ADMIN' ? (
              <AdminDashboard />
            ) : (
              user ? (
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                  <div className="text-6xl mb-4">🚫</div>
                  <h1 className="text-2xl font-bold text-white mb-2">Akses Ditolak</h1>
                  <p className="text-slate-400 mb-6">
                    Anda login sebagai <strong>{user.email}</strong>, namun akun ini tidak memiliki akses Admin.
                  </p>
                  <a href="/" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all">
                    Kembali ke Marketplace
                  </a>
                </div>
              ) : (
                <Navigate to="/" />
              )
            )
          } />

          <Route path="/toket" element={
            <div className="w-full">
              <iframe title="Toket" srcDoc={toketHtml} className="w-full h-[92vh] rounded-2xl border border-white/10 bg-white" />
            </div>
          } />

          <Route path="/tool/:toolId" element={<ToolIframePage user={user} />} />
        </Routes>
      </main>

      {/* Conditionally render Footer - hidden on admin/login pages and when popup is open */}
      <div
        className={`transition-all duration-300 ease-in-out ${shouldHideNavigation
            ? 'opacity-0 pointer-events-none h-0 overflow-hidden'
            : 'opacity-100'
          }`}
      >
        {!hideHeaderFooter && (
          <footer className="border-t border-white/10 py-6 md:py-10 glass mt-8 md:mt-12 relative z-10">
            <div className="container mx-auto px-4 text-center text-gray-400">
              <p className="text-lg md:text-xl font-bold text-white mb-2">TEXA-TOOLS</p>
              <p className="text-xs md:text-sm">Premium AI Tools Marketplace & Session Manager.</p>
              <div className="mt-3 md:mt-4 text-[10px] md:text-xs">
                &copy; {new Date().getFullYear()} Texa Group. All rights reserved.
              </div>
              {user && (
                <div className="mt-2 text-[9px] md:text-[10px] text-slate-600">
                  Logged in as: {user.email} ({user.role})
                </div>
              )}
            </div>
          </footer>
        )}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<TexaUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange(async (texaUser) => {
      setUser(texaUser);
      setLoading(false);

      if (texaUser) {
        // Sync with extension
        const { auth } = await import('./services/firebase');
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;

        // Save to localStorage for extension to read directly
        if (idToken) {
          window.localStorage.setItem('texa_id_token', idToken);
          window.localStorage.setItem('texa_user_email', texaUser.email || '');
          window.localStorage.setItem('texa_user_role', texaUser.role || '');
          window.localStorage.setItem('texa_user_name', texaUser.name || '');
          window.localStorage.setItem('texa_subscription_end', texaUser.subscriptionEnd || '');
        }

        // Send complete user profile to extension via postMessage
        window.postMessage({
          source: 'TEXA_DASHBOARD',
          type: 'TEXA_LOGIN_SYNC',
          origin: window.location.origin,
          idToken: idToken,
          user: {
            id: texaUser.id,
            email: texaUser.email,
            name: texaUser.name,
            role: texaUser.role,
            subscriptionEnd: texaUser.subscriptionEnd,
            isActive: texaUser.isActive,
            photoURL: texaUser.photoURL,
            createdAt: texaUser.createdAt,
            lastLogin: texaUser.lastLogin
          }
        }, window.location.origin);
      }
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  const handleLogin = (userData: TexaUser) => {
    setUser(userData);
  };

  const handleLogout = async () => {
    try {
      await logOut();
      setUser(null);

      // Clear localStorage
      window.localStorage.removeItem('texa_id_token');
      window.localStorage.removeItem('texa_user_email');
      window.localStorage.removeItem('texa_user_role');
      window.localStorage.removeItem('texa_user_name');
      window.localStorage.removeItem('texa_subscription_end');

      // Notify extension about logout
      window.postMessage({
        source: 'TEXA_DASHBOARD',
        type: 'TEXA_LOGOUT'
      }, window.location.origin);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617]">
        <div className="text-center">
          <div className="w-16 h-16 premium-gradient rounded-2xl mx-auto mb-4 flex items-center justify-center animate-pulse">
            <span className="text-white text-2xl font-black">T</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="text-slate-500 text-sm mt-4">Memuat TEXA-TOOLS...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <PopupProvider>
        <AppContent user={user} onLogin={handleLogin} onLogout={handleLogout} />
      </PopupProvider>
    </Router>
  );
};

export default App;
