import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  getBookedAppointments, 
  adminCancelAppointment,
  TIME_SLOTS 
} from '../utils/calendarStorage';
import { Lock, Calendar, Trash2, PlusCircle, Bot, Cpu, LogOut, FolderKanban, Briefcase, Handshake, Inbox } from 'lucide-react';
import sardLogo from '../assets/logo.png';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import ContentManager from '../components/admin/ContentManager';
import ApplicationsManager from '../components/admin/ApplicationsManager';

// DEV-194: dashboard sections. Appointments is the original admin view; content sections use /api/admin/content.
const ADMIN_TABS = [
  { id: 'appointments', icon: Calendar },
  { id: 'projects', icon: FolderKanban },
  { id: 'openings', icon: Briefcase },
  { id: 'applications', icon: Inbox },
  { id: 'collaborations', icon: Handshake },
];
const CONTENT_TABS = new Set(['projects', 'openings', 'collaborations']);

const SERVICE_OPTIONS = [
  'أتمتة الأعمال وتوفير التكاليف',
  'استشارات الذكاء الاصطناعي',
  'تطوير الحلول المخصصة',
  'تكامل الأنظمة السحابية',
];

export default function AdminPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [csrfToken, setCsrfToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [activeTab, setActiveTab] = useState('appointments');
  const csrfRef = useRef(null);
  useEffect(() => { csrfRef.current = csrfToken; }, [csrfToken]);

  // AI Agent state
  const [agentPrompt, setAgentPrompt] = useState('');
  const [agentLog, setAgentLog] = useState('');
  const [agentLoading, setAgentLoading] = useState(false);

  // Manual creation form
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newSlot, setNewSlot] = useState(TIME_SLOTS[0]);
  const [newName, setNewName] = useState('');
  const [newService, setNewService] = useState(SERVICE_OPTIONS[0]);

  // Check existing session on mount
  useEffect(() => {
    let isMounted = true;
    async function checkExistingSession() {
      try {
        const res = await fetch('/api/admin/session', {
          credentials: 'same-origin',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && isMounted) {
            setIsAuthenticated(true);
            setCsrfToken(data.csrfToken);
            const bookingsData = await getBookedAppointments(data.csrfToken);
            if (isMounted) setBookings(bookingsData);
          }
        }
      } catch {
        // Not authenticated
      } finally {
        if (isMounted) setIsCheckingSession(false);
      }
    }
    checkExistingSession();
    return () => { isMounted = false; };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!password) return;

    setLoginLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/admin/session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: password }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsAuthenticated(true);
        setCsrfToken(data.csrfToken);
        setPassword('');
        setErrorMsg('');

        const bookingsData = await getBookedAppointments(data.csrfToken);
        setBookings(bookingsData);
        return;
      }

      if (res.status === 401) {
        setErrorMsg(t('admin.wrongPassword') || 'Invalid admin passcode');
      } else if (res.status === 429) {
        setErrorMsg('Too many failed attempts. Please wait 15 minutes.');
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrorMsg(errData.error || 'Login failed');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Login connection failed');
    } finally {
      setPassword('');
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/session', {
        method: 'DELETE',
        credentials: 'same-origin',
      });
    } catch {
      // Continue cleanup
    }
    setIsAuthenticated(false);
    setCsrfToken(null);
    setBookings([]);
  };

  const refreshCsrf = async () => {
    try {
      const res = await fetch('/api/admin/session', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.csrfToken) {
          setCsrfToken(data.csrfToken);
          return data.csrfToken;
        }
      }
    } catch {
      // ignore
    }
    return null;
  };

  // DEV-194: JSON / multipart request to an admin endpoint. Sends the CSRF header on writes,
  // retries once with a fresh token on 403, and returns to the login screen on 401.
  // Errors carry { status, code, fields } from the API (never raw database text).
  const adminRequest = useCallback(async (path, { method = 'GET', body, form } = {}) => {
    const run = async (token) => {
      const headers = {};
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (method !== 'GET') headers['x-csrf-token'] = token || '';
      const res = await fetch(path, {
        method,
        credentials: 'same-origin',
        headers,
        body: form || (body !== undefined ? JSON.stringify(body) : undefined),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.error || `HTTP ${res.status}`);
        err.status = res.status;
        err.code = data.error;
        err.fields = data.fields;
        throw err;
      }
      return data;
    };
    try {
      return await run(csrfRef.current);
    } catch (err) {
      if (err.status === 403 && method !== 'GET') {
        const res = await fetch('/api/admin/session', { credentials: 'same-origin' }).catch(() => null);
        const data = res && res.ok ? await res.json().catch(() => ({})) : {};
        if (data.authenticated && data.csrfToken) {
          csrfRef.current = data.csrfToken;
          setCsrfToken(data.csrfToken);
          return run(data.csrfToken);
        }
      }
      if (err.status === 401) setIsAuthenticated(false);
      throw err;
    }
  }, []);

  const executeWithCsrfRetry = async (action) => {
    try {
      return await action(csrfToken);
    } catch (err) {
      if (err.message?.includes('403') || err.message?.includes('CSRF') || err.message?.includes('Invalid CSRF')) {
        const freshCsrf = await refreshCsrf();
        if (freshCsrf) {
          return await action(freshCsrf);
        }
      }
      throw err;
    }
  };

  const handleDelete = async (id) => {
    try {
      await executeWithCsrfRetry(async (token) => {
        await adminCancelAppointment(id, token);
      });
      const data = await getBookedAppointments(csrfToken);
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Delete failed:', err);
      alert(err.message || 'Failed to delete booking');
    }
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    if (!newName) return;

    try {
      await executeWithCsrfRetry(async (token) => {
        const res = await fetch('/api/admin/appointments', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': token || '',
          },
          body: JSON.stringify({
            date: newDate,
            timeSlot: newSlot,
            name: newName,
            email: 'admin@sard.dev',
            service: newService,
            notes: 'Created via Admin Dashboard',
            created_via: 'admin_dashboard',
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `HTTP ${res.status}`);
        }
      });

      const data = await getBookedAppointments(csrfToken);
      setBookings(Array.isArray(data) ? data : []);
      setNewName('');
    } catch (err) {
      console.error('Add failed:', err);
      alert(err.message || 'Failed to add appointment');
    }
  };

  const handleAgentRun = () => {
    if (!agentPrompt.trim()) return;
    setAgentLoading(true);

    setTimeout(async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        await executeWithCsrfRetry(async (token) => {
          const res = await fetch('/api/admin/appointments', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
              'Content-Type': 'application/json',
              'x-csrf-token': token || '',
            },
            body: JSON.stringify({
              date: today,
              timeSlot: '03:00 PM',
              name: 'AI Agent Scheduled Meeting',
              email: 'agent@sard.dev',
              service: 'Auto-Scheduled Consultation',
              notes: `AI Prompt: ${agentPrompt}`,
              created_via: 'admin_agent',
            }),
          });

          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error || `HTTP ${res.status}`);
          }
        });

        const data = await getBookedAppointments(csrfToken);
        setBookings(Array.isArray(data) ? data : []);
        setAgentLog(isRTL ? `✅ تم تنفيذ طلبك "${agentPrompt}" وإنشاء الموعد في الكالندر.` : `✅ Executed "${agentPrompt}" and created meeting.`);
        setAgentPrompt('');
      } catch (err) {
        setAgentLog(`❌ Error: ${err.message}`);
      } finally {
        setAgentLoading(false);
      }
    }, 1000);
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-background text-foreground flex justify-center items-center p-4">
        <div className="text-sm text-muted-foreground animate-pulse">Loading admin session...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground flex justify-center items-center p-4 transition-colors">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md p-8 rounded-2xl bg-card border border-border text-center space-y-6 shadow-xl"
        >
          <img src={sardLogo} alt="Sard AI" className="w-16 h-16 object-contain mx-auto" />
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">{t('admin.title')}</h1>
            <p className="text-xs text-muted-foreground">{t('admin.enterPassword')}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('admin.passwordPlaceholder')}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-center text-foreground outline-none focus:border-brand-orange text-lg tracking-widest placeholder-muted-foreground"
              />
              <Lock className="w-4 h-4 text-muted-foreground absolute left-4 top-4" />
            </div>

            {errorMsg && (
              <p className="text-xs text-red-600 font-semibold">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 rounded-xl bg-brand-orange text-black font-bold hover:bg-brand-orange-400 transition-all cursor-pointer shadow-sm disabled:opacity-50"
            >
              {loginLoading ? '...' : t('admin.login')}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  const safeBookings = Array.isArray(bookings) ? bookings : [];

  return (
    <div className="min-h-screen bg-background text-foreground py-8 px-4 sm:px-8 transition-colors">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Bar */}
        <div className="flex flex-wrap justify-between items-center gap-3 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <img src={sardLogo} alt="Sard AI" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="font-bold text-lg text-foreground">{t('admin.dashboardTitle')}</h1>
              <p className="text-xs text-brand-orange font-semibold">Sard AI Admin Panel</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <LanguageSwitcher />
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-xs sm:text-sm text-foreground font-medium transition-colors shadow-sm cursor-pointer flex items-center gap-2"
              title="Logout"
            >
              <LogOut className="w-4 h-4 text-brand-orange" />
              <span>{isRTL ? 'تسجيل الخروج' : 'Logout'}</span>
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-xs sm:text-sm text-foreground font-medium transition-colors shadow-sm cursor-pointer"
            >
              {t('admin.exit')}
            </button>
          </div>
        </div>

        {/* DEV-194: section tabs */}
        <nav role="tablist" aria-label={t('admin.dashboardTitle')} className="flex flex-wrap gap-2">
          {ADMIN_TABS.map(({ id, icon }) => { const TabIcon = icon; return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              data-testid={`admin-tab-${id}`}
              onClick={() => setActiveTab(id)}
              className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors cursor-pointer ${
                activeTab === id ? 'bg-brand-navy text-white border-brand-navy' : 'bg-card text-foreground border-border hover:border-brand-navy/40'
              }`}
            >
              <TabIcon className="w-4 h-4" aria-hidden="true" />
              {t(`admin.tabs.${id}`)}
            </button>
          ); })}
        </nav>

        {CONTENT_TABS.has(activeTab) && <ContentManager key={activeTab} type={activeTab} request={adminRequest} />}
        {activeTab === 'applications' && <ApplicationsManager request={adminRequest} />}

        {activeTab === 'appointments' && (<>
        {/* AI Agent Box */}
        <div className="p-6 rounded-2xl bg-secondary/35 border border-brand-orange/30 space-y-4 shadow-sm">
          <div className="flex items-center gap-3 text-brand-orange">
            <Bot className="w-6 h-6" />
            <h2 className="text-xl font-bold text-foreground">{t('admin.agentTitle')}</h2>
          </div>
          <p className="text-xs text-muted-foreground">{t('admin.agentDesc')}</p>

          <div className="flex gap-2">
            <input
              type="text"
              value={agentPrompt}
              onChange={(e) => setAgentPrompt(e.target.value)}
              placeholder={t('admin.agentPlaceholder')}
              className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-brand-orange placeholder-muted-foreground"
            />
            <button
              onClick={handleAgentRun}
              disabled={agentLoading}
              className="px-5 py-2.5 rounded-xl bg-brand-orange text-black font-bold text-sm hover:bg-brand-orange-400 flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-colors shadow-sm"
            >
              {agentLoading ? <Cpu className="animate-spin w-4 h-4" /> : t('admin.executeAI')}
            </button>
          </div>

          {agentLog && (
            <p className="text-xs text-brand-orange bg-card p-3 rounded-lg border border-brand-orange/20 font-semibold shadow-sm">
              {agentLog}
            </p>
          )}
        </div>

        {/* Grid */}
        <div className="grid lg:grid-cols-12 gap-8">

          <div className="lg:col-span-8 bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Calendar className="w-5 h-5 text-brand-orange" />
                <span>{t('admin.currentBookings')} ({safeBookings.length})</span>
              </h3>
            </div>

            {safeBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t('admin.noBookings')}</p>
            ) : (
              <div className="space-y-3">
                {safeBookings.map((b) => (
                  <div
                    key={b.id}
                    className="p-4 rounded-xl bg-secondary/40 border border-border flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{b.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-brand-orange/15 text-brand-orange font-semibold">
                          {b.timeSlot}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{b.date} | {b.service}</p>
                    </div>

                    <button
                      onClick={() => handleDelete(b.id)}
                      className="p-2 text-red-600 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-4 bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
            <h3 className="text-lg font-bold text-foreground border-b border-border pb-3 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-brand-orange" />
              <span>{t('admin.manualAdd')}</span>
            </h3>

            <form onSubmit={handleManualAdd} className="space-y-3 text-xs">
              <div>
                <label className="text-foreground font-semibold mb-1 block">{t('admin.clientName')}</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:border-brand-orange"
                />
              </div>

              <div>
                <label className="text-foreground font-semibold mb-1 block">{t('admin.date')}</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:border-brand-orange"
                />
              </div>

              <div>
                <label className="text-foreground font-semibold mb-1 block">{t('admin.time')}</label>
                <select
                  value={newSlot}
                  onChange={(e) => setNewSlot(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:border-brand-orange"
                >
                  {TIME_SLOTS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-foreground font-semibold mb-1 block">{t('admin.service') || 'الخدمة'}</label>
                <select
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:border-brand-orange"
                >
                  {SERVICE_OPTIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-brand-orange text-black font-bold hover:bg-brand-orange-400 mt-2 transition-colors cursor-pointer shadow-sm"
              >
                {t('admin.addToList')}
              </button>
            </form>
          </div>

        </div>
        </>)}

      </div>
    </div>
  );
}
