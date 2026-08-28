import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import QuizPage from './pages/QuizPage';
import Leaderboard from './pages/Leaderboard';
import MyResults from './pages/MyResults';
import ProfilePage from './pages/ProfilePage';

/* ── Guards ─────────────────────────────────────────── */
const PrivateRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <AppLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <AccessDenied />;
  return children;
};

const AppLoader = () => (
  <div style={{
    minHeight: '100dvh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 16,
    background: 'linear-gradient(145deg,#f0f4ff 0%,#e8eeff 40%,#f5f0ff 100%)',
  }}>
    <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: '-0.03em', color: '#6366f1' }}>SVHEC</div>
    <div style={{ display: 'flex', gap: 6 }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: '50%', background: '#6366f1',
          animation: `dot 1.2s ease-in-out ${i * 0.18}s infinite`,
        }} />
      ))}
    </div>
    <style>{`@keyframes dot{0%,100%{opacity:.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1)}}`}</style>
  </div>
);

const AccessDenied = () => {
  const nav = useNavigate();
  return (
    <div style={{ minHeight: '80dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card" style={{ maxWidth: 360, width: '100%', padding: '44px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 18 }}>🚫</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Access Denied</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24, fontSize: 14 }}>You don't have permission to view this page.</p>
        <button className="btn btn-primary btn-full" onClick={() => nav('/')}>Back to Dashboard</button>
      </div>
    </div>
  );
};

const BlockedScreen = () => {
  const { logout } = useAuth();
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--color-bg)' }}>
      <div className="card" style={{ maxWidth: 380, width: '100%', padding: '48px 32px', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,59,48,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <svg width="36" height="36" fill="none" stroke="#ff3b30" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-danger)', marginBottom: 12 }}>Account Blocked</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 28, fontSize: 14, lineHeight: 1.6 }}>
          Your account has been blocked by the administrator. Contact admin for assistance.
        </p>
        <button className="btn btn-danger btn-full" onClick={logout} style={{ fontSize: 15 }}>Sign Out</button>
      </div>
    </div>
  );
};

const PendingApprovalScreen = () => {
  const { logout, user, setUser } = useAuth();
  const [checking, setChecking] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!user?.token) return;
    setChecking(true);
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/auth/me?t=${Date.now()}`, {
        headers: { 
          Authorization: `Bearer ${user.token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      if (res.data && res.data.isApproved) {
        const updatedUser = { ...res.data, token: user.token };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
    } catch (e) {
      console.error('Error checking approval status:', e);
    } finally {
      setChecking(false);
    }
  }, [user, setUser]);

  useEffect(() => {
    const timer = setInterval(checkStatus, 5000);
    return () => clearInterval(timer);
  }, [checkStatus]);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--color-bg)' }}>
      <div className="card anim-up" style={{ maxWidth: 400, width: '100%', padding: '48px 32px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.06)' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(108,99,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <span style={{ fontSize: 32 }}>⏳</span>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand-accent)', marginBottom: 12 }}>Pending Approval</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 20, fontSize: 14.5, lineHeight: 1.6 }}>
          Your student registration request is currently pending administrative validation. You will gain access as soon as your account is approved.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--color-text-tertiary)', fontSize: 12, marginBottom: 28 }}>
          <span className="spinner-small" style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'var(--brand-accent)', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }}></span>
          <span>Checking approval status automatically...</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button 
            className="btn btn-primary btn-full" 
            onClick={checkStatus} 
            disabled={checking}
            style={{ fontSize: 15, padding: 14 }}
          >
            {checking ? 'Checking Status...' : 'Check Status Now'}
          </button>
          <button className="btn btn-ghost btn-full" onClick={logout} style={{ fontSize: 15, padding: 14 }}>Sign Out</button>
        </div>
      </div>
    </div>
  );
};

import { Menu, X } from 'lucide-react';

/* ── Header ─────────────────────────────────────────── */
const Header = () => {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  
  if (!user) return null;
  const isAdmin = user.role === 'admin';

  // Add subtle shadow on scroll
  React.useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu when navigating
  const navigate = (path) => {
    setMenuOpen(false);
    nav(path);
  };

  return (
    <>
      <header className={`app-header ${scrolled ? 'scrolled' : ''}`}>
        <div className="header-inner">
          
          {/* Left: XO Logo */}
          <button 
            onClick={() => navigate('/')} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
          >
            <div className="xo-splatter-container" style={{ height: '42px', display: 'flex', alignItems: 'center' }}>
              <img 
                src="/Xo.png" 
                alt="XO Logo" 
                style={{ height: '100%', width: 'auto', objectFit: 'contain', mixBlendMode: 'multiply' }} 
              />
            </div>
          </button>

          {/* Right: Desktop Navigation Container */}
          <div className="desktop-nav">
            {isAdmin ? (
              /* Admin Signature and Logout */
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div className="dev-signature">
                  <span className="dev-bracket">&lt;</span>
                  Dharsan Xo/
                  <span className="dev-bracket">&gt;</span>
                </div>
                
                <div style={{ width: 1, height: 20, background: 'rgba(0,0,0,0.08)' }} />
                
                <button 
                  onClick={logout} 
                  style={{ 
                    background: 'rgba(220,38,38,0.05)', border: 'none', fontSize: 13, 
                    fontWeight: 600, color: '#dc2626', cursor: 'pointer',
                    padding: '6px 12px', borderRadius: 8, transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => e.target.style.background = 'rgba(220,38,38,0.1)'}
                  onMouseOut={(e) => e.target.style.background = 'rgba(220,38,38,0.05)'}
                >
                  Sign out
                </button>
              </div>
            ) : (
              /* User Navigation (Desktop Layout) */
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#4b5563', padding: '6px 12px', borderRadius: 8, transition: 'all 0.2s' }} onClick={() => navigate('/')}>Dashboard</button>
                  <button className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#4b5563', padding: '6px 12px', borderRadius: 8, transition: 'all 0.2s' }} onClick={() => navigate('/my-results')}>Results</button>
                  <button className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#4b5563', padding: '6px 12px', borderRadius: 8, transition: 'all 0.2s' }} onClick={() => navigate('/leaderboard')}>Leaderboard</button>
                </div>
                
                <div style={{ width: 1, height: 20, background: 'rgba(0,0,0,0.08)' }} />
                
                {/* User Info chip clickable to go to Profile */}
                <div 
                  onClick={() => navigate('/profile')}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 8px', borderRadius: 10, transition: 'background 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.03)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                >
                  {user && user.profileImage ? (
                    <img 
                      src={user.profileImage} 
                      alt="Profile Avatar" 
                      style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(0,0,0,0.08)' }} 
                    />
                  ) : (
                    <div style={{ 
                      width: 30, height: 30, borderRadius: '50%', 
                      background: '#6c63ff', display: 'flex', alignItems: 'center', 
                      justifyContent: 'center', color: 'white', fontWeight: 650, fontSize: 12 
                    }}>
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{user?.name?.split(' ')[0]}</span>
                </div>

                <button 
                  onClick={logout} 
                  style={{ 
                    background: 'rgba(220,38,38,0.05)', border: 'none', fontSize: 13, 
                    fontWeight: 600, color: '#dc2626', cursor: 'pointer',
                    padding: '6px 12px', borderRadius: 8, transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => e.target.style.background = 'rgba(220,38,38,0.1)'}
                  onMouseOut={(e) => e.target.style.background = 'rgba(220,38,38,0.05)'}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <button className="mobile-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

        </div>
      </header>

      {/* Mobile Navigation Dropdown Overlay */}
      <div className={`mobile-nav-overlay ${menuOpen ? 'open' : ''}`}>
        
        {isAdmin ? (
          <div className="dev-signature" style={{ alignSelf: 'flex-start', marginBottom: 16 }}>
            <span className="dev-bracket">&lt;</span>
            Dharsan Xo/
            <span className="dev-bracket">&gt;</span>
          </div>
        ) : (
          /* User Profile Header Card inside sidebar toggler */
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 16 }}>
            {user && (
              <div 
                onClick={() => navigate('/profile')}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 12, 
                  padding: '16px', background: '#f8fafc', borderRadius: 16, 
                  border: '1px solid rgba(0,0,0,0.05)', width: '100%',
                  cursor: 'pointer', transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                onMouseOut={(e) => e.currentTarget.style.background = '#f8fafc'}
              >
                {user.profileImage ? (
                  <img 
                    src={user.profileImage} 
                    alt="Profile Avatar" 
                    style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }} 
                  />
                ) : (
                  <div style={{ 
                    width: 44, height: 44, borderRadius: '50%', background: '#6c63ff', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    color: 'white', fontWeight: 700, fontSize: 16, boxShadow: '0 2px 8px rgba(108,99,255,0.15)'
                  }}>
                    {user.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</span>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{user.registerNumber}</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start', width: '100%' }}>
              <button className="nav-link" style={{ paddingLeft: 8, width: '100%', textAlign: 'left', fontSize: 16, background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => navigate('/')}>Dashboard</button>
              <button className="nav-link" style={{ paddingLeft: 8, width: '100%', textAlign: 'left', fontSize: 16, background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => navigate('/my-results')}>My Results</button>
              <button className="nav-link" style={{ paddingLeft: 8, width: '100%', textAlign: 'left', fontSize: 16, background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => navigate('/leaderboard')}>Leaderboard</button>
            </div>
          </div>
        )}

        <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '8px 0' }} />

        <button 
          onClick={logout} 
          style={{ 
            marginTop: 'auto', padding: '14px', borderRadius: 12,
            background: 'rgba(0,0,0,0.04)', color: '#333', border: 'none',
            fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%'
          }}
        >
          Sign Out
        </button>

      </div>
    </>
  );
};

/* ── Routes ─────────────────────────────────────────── */
const AppRoutes = () => {
  const { user, isBlocked } = useAuth();
  if (user && isBlocked && user.role !== 'admin') return <BlockedScreen />;
  if (user && user.role === 'user' && !user.isApproved) return <PendingApprovalScreen />;
  return (
    <Routes>
      <Route path="/login"    element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
      <Route path="/" element={
        <PrivateRoute roles={['user','admin']}>
          {user?.role === 'admin' ? <Navigate to="/admin" replace /> : <UserDashboard />}
        </PrivateRoute>
      } />
      <Route path="/quiz/:quizCode" element={<PrivateRoute roles={['user', 'admin']}><QuizPage /></PrivateRoute>} />
      <Route path="/profile" element={<PrivateRoute roles={['user']}><ProfilePage /></PrivateRoute>} />
      <Route path="/leaderboard" element={<PrivateRoute roles={['user','admin']}><Leaderboard /></PrivateRoute>} />
      <Route path="/my-results"  element={<PrivateRoute roles={['user']}><MyResults /></PrivateRoute>} />
      <Route path="/admin" element={<PrivateRoute roles={['admin']}><AdminDashboard /></PrivateRoute>} />
    </Routes>
  );
};

/* ── App Shell (inside AuthProvider context) ───────────── */
const AppShell = () => {
  const { user } = useAuth();
  if (!user) {
    // Auth pages: true full-screen, no header wrapper
    return (
      <div style={{ minHeight: '100dvh', background: 'linear-gradient(145deg,#f0f4ff 0%,#e8eeff 40%,#f5f0ff 100%)' }}>
        <AppRoutes />
      </div>
    );
  }
  return (
    <div style={{ minHeight: '100dvh', background: 'linear-gradient(160deg,#f0f4ff 0%,#eef0ff 50%,#f5f0ff 100%)' }}>
      <Header />
      <main className="page-wrap page-in">
        <AppRoutes />
      </main>
    </div>
  );
};

/* ── App ────────────────────────────────────────────── */
const App = () => (
  <Router>
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  </Router>
);

export default App;
