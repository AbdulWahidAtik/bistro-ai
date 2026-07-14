import React, { useCallback, useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import AdminLoginView from './components/AdminLoginView';
import DashboardView from './components/DashboardView';
import MenuView from './components/MenuView';
import OperationsView from './components/OperationsView';
import ScriptsView from './components/ScriptsView';
import SettingsView from './components/SettingsView';
import { initialMenuItems, initialActivityLogs, initialScripts } from './data';
import { MenuItem, ActivityLog, Script, DashboardAnalytics, Reservation, Order, UserRole } from './types';
import { useLocalStorageState } from './hooks/useLocalStorageState';
import {
  clearAuthToken,
  createBackendActivityLog,
  createBackendMenuItem,
  createBackendOrder,
  createBackendReservation,
  createBackendScript,
  deleteBackendMenuItem,
  deleteBackendOrder,
  deleteBackendReservation,
  deleteBackendScript,
  generateBackendScript,
  getAuthSession,
  hasAuthToken,
  loadBackendHealth,
  loadBackendWorkspace,
  loadDashboardAnalytics,
  updateBackendOrder,
  updateBackendReservation,
  updateBackendMenuItem,
  updateBackendScript,
  AuthSession,
} from './api';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'menu' | 'operations' | 'scripts' | 'settings'>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [menuItems, setMenuItems] = useLocalStorageState<MenuItem[]>('bistro-ai:menu-items', initialMenuItems);
  const [scripts, setScripts] = useLocalStorageState<Script[]>('bistro-ai:scripts', initialScripts);
  const [activityLogs, setActivityLogs] = useLocalStorageState<ActivityLog[]>('bistro-ai:activity-logs', initialActivityLogs);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLiveActive, setIsLiveActive] = useState<boolean>(false);
  const [showLiveCallNotification, setShowLiveCallNotification] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [isAuthRequired, setIsAuthRequired] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => hasAuthToken());
  const [currentUser, setCurrentUser] = useState<{ username: string; displayName?: string; role: UserRole }>(() => {
    const session = getAuthSession();
    return {
      username: session?.username || 'Alex Rivera',
      displayName: session?.displayName,
      role: session?.role || 'admin',
    };
  });
  const [authNotice, setAuthNotice] = useState<string>('');
  const [dashboardAnalytics, setDashboardAnalytics] = useState<DashboardAnalytics | null>(null);
  const [isDashboardRefreshing, setIsDashboardRefreshing] = useState<boolean>(false);

  const refreshDashboardAnalytics = useCallback(async () => {
    setIsDashboardRefreshing(true);
    try {
      const analytics = await loadDashboardAnalytics();
      setDashboardAnalytics(analytics);
    } catch {
      setDashboardAnalytics(null);
    } finally {
      setIsDashboardRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const authCheckTimeoutMs = 8000;
    const authCheckTimeout = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('Auth check timed out')), authCheckTimeoutMs);
    });

    Promise.race([loadBackendHealth(), authCheckTimeout])
      .then((health) => {
        if (!isMounted) return;
        setIsAuthRequired(health.authEnabled);
        if (!health.authEnabled) {
          setIsAuthenticated(true);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setIsAuthRequired(true);
        setIsAuthenticated(false);
        setAuthNotice('');
      })
      .finally(() => {
        if (!isMounted) return;
        setIsAuthChecking(false);
      });

    loadBackendWorkspace()
      .then((workspace) => {
        if (!isMounted) return;
        setMenuItems(workspace.menuItems);
        setScripts(workspace.scripts);
        setActivityLogs(workspace.activityLogs);
        setReservations(workspace.reservations || []);
        setOrders(workspace.orders || []);
      })
      .catch(() => {
        // Keep the existing localStorage-backed workspace when the API is offline.
      });

    loadDashboardAnalytics()
      .then((analytics) => {
        if (!isMounted) return;
        setDashboardAnalytics(analytics);
      })
      .catch(() => {
        if (!isMounted) return;
        setDashboardAnalytics(null);
      });

    return () => {
      isMounted = false;
    };
  }, [refreshDashboardAnalytics, setActivityLogs, setMenuItems, setScripts]);

  // Search query in sidebar or header
  const [searchQuery, setSearchQuery] = useState<string>('');
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleActivityLogs = normalizedSearchQuery
    ? activityLogs.filter(log =>
        [log.title, log.detail, log.type, log.status].some(value =>
          value.toLowerCase().includes(normalizedSearchQuery)
        )
      )
    : activityLogs;

  const syncActivityLog = (log: ActivityLog) => {
    createBackendActivityLog(log)
      .then(() => refreshDashboardAnalytics())
      .catch(() => {
        setDashboardAnalytics(null);
      });
  };

  const addActivityLog = (log: Omit<ActivityLog, 'id' | 'time' | 'duration' | 'status'> & Partial<Pick<ActivityLog, 'duration' | 'status'>>) => {
    const nextLog: ActivityLog = {
      id: `log-${Date.now()}`,
      time: 'Just now',
      duration: log.duration || '0:10',
      status: log.status || 'HANDLED',
      ...log,
    };
    setActivityLogs(prev => [nextLog, ...prev].slice(0, 50));
    syncActivityLog(nextLog);
  };

  // Handle active states of menu
  const handleAddMenuItem = (newItem: MenuItem) => {
    setMenuItems(prev => [newItem, ...prev]);
    createBackendMenuItem(newItem)
      .then(() => refreshDashboardAnalytics())
      .catch(() => {
        setDashboardAnalytics(null);
        showToast('Menu item saved locally. Backend sync is offline.');
      });
    addActivityLog({
      type: 'general',
      title: 'Menu Item Added',
      detail: `${newItem.name} added to ${newItem.category}`,
      duration: '0:18',
      status: 'SUCCESS',
    });
    showToast(`Discovered & added dish "${newItem.name}" to AI menu.`);
  };

  const handleUpdateMenuItem = (updatedItem: MenuItem) => {
    setMenuItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
    updateBackendMenuItem(updatedItem)
      .then(() => refreshDashboardAnalytics())
      .catch(() => {
        setDashboardAnalytics(null);
        showToast('Menu update saved locally. Backend sync is offline.');
      });
    addActivityLog({
      type: 'change',
      title: 'Menu Item Updated',
      detail: `${updatedItem.name} is now ${updatedItem.status}`,
      duration: '0:12',
      status: 'HANDLED',
    });
    showToast(`Dish "${updatedItem.name}" updated successfully.`);
  };

  const handleDeleteMenuItem = (id: string) => {
    const itemToDelete = menuItems.find(item => item.id === id);
    setMenuItems(prev => prev.filter(item => item.id !== id));
    if (itemToDelete) {
      deleteBackendMenuItem(id)
        .then(() => refreshDashboardAnalytics())
        .catch(() => {
          setDashboardAnalytics(null);
          showToast('Menu item removed locally. Backend sync is offline.');
        });
      addActivityLog({
        type: 'change',
        title: 'Menu Item Removed',
        detail: `${itemToDelete.name} removed from AI menu`,
        duration: '0:08',
        status: 'HANDLED',
      });
      showToast(`Removed dish "${itemToDelete.name}" from live database.`);
    }
  };

  const handleUpdateReservation = (reservation: Reservation) => {
    setReservations(prev => prev.map(item => item.id === reservation.id ? reservation : item));
    updateBackendReservation(reservation)
      .then(() => refreshDashboardAnalytics())
      .catch(() => {
        setDashboardAnalytics(null);
        showToast('Reservation updated locally. Backend sync is offline.');
      });
    addActivityLog({
      type: 'reservation',
      title: 'Reservation Updated',
      detail: `${reservation.customerName} is now ${reservation.status}`,
      duration: '0:10',
      status: reservation.status === 'confirmed' || reservation.status === 'seated' ? 'SUCCESS' : 'HANDLED',
    });
    showToast(`Reservation for ${reservation.customerName} updated.`);
  };

  const handleAddReservation = (reservation: Reservation) => {
    setReservations(prev => [reservation, ...prev]);
    createBackendReservation(reservation)
      .then(() => refreshDashboardAnalytics())
      .catch(() => {
        setDashboardAnalytics(null);
        showToast('Reservation saved locally. Backend sync is offline.');
      });
    addActivityLog({
      type: 'reservation',
      title: 'Reservation Created',
      detail: `${reservation.customerName} booked a party of ${reservation.partySize}`,
      duration: '0:16',
      status: reservation.status === 'confirmed' ? 'SUCCESS' : 'HANDLED',
    });
    showToast(`Reservation for ${reservation.customerName} created.`);
  };

  const handleDeleteReservation = (id: string) => {
    const reservation = reservations.find(item => item.id === id);
    setReservations(prev => prev.filter(item => item.id !== id));
    deleteBackendReservation(id)
      .then(() => refreshDashboardAnalytics())
      .catch(() => {
        setDashboardAnalytics(null);
        showToast('Reservation removed locally. Backend sync is offline.');
      });
    if (reservation) {
      addActivityLog({
        type: 'reservation',
        title: 'Reservation Deleted',
        detail: `${reservation.customerName} reservation removed`,
        duration: '0:07',
        status: 'HANDLED',
      });
      showToast(`Reservation for ${reservation.customerName} deleted.`);
    }
  };

  const handleUpdateOrder = (order: Order) => {
    setOrders(prev => prev.map(item => item.id === order.id ? order : item));
    updateBackendOrder(order)
      .then(() => refreshDashboardAnalytics())
      .catch(() => {
        setDashboardAnalytics(null);
        showToast('Order updated locally. Backend sync is offline.');
      });
    addActivityLog({
      type: 'takeout',
      title: 'Order Updated',
      detail: `${order.id} is now ${order.status}`,
      duration: '0:09',
      status: order.status === 'completed' || order.status === 'ready' ? 'SUCCESS' : 'HANDLED',
    });
    showToast(`Order ${order.id} updated.`);
  };

  const handleAddOrder = (order: Order) => {
    setOrders(prev => [order, ...prev]);
    createBackendOrder(order)
      .then(() => refreshDashboardAnalytics())
      .catch(() => {
        setDashboardAnalytics(null);
        showToast('Order saved locally. Backend sync is offline.');
      });
    addActivityLog({
      type: order.type === 'takeout' ? 'takeout' : 'general',
      title: 'Order Created',
      detail: `${order.id} created for ${order.customerName}`,
      duration: '0:14',
      status: order.status === 'completed' || order.status === 'ready' ? 'SUCCESS' : 'HANDLED',
    });
    showToast(`Order ${order.id} created.`);
  };

  const handleDeleteOrder = (id: string) => {
    const order = orders.find(item => item.id === id);
    setOrders(prev => prev.filter(item => item.id !== id));
    deleteBackendOrder(id)
      .then(() => refreshDashboardAnalytics())
      .catch(() => {
        setDashboardAnalytics(null);
        showToast('Order removed locally. Backend sync is offline.');
      });
    if (order) {
      addActivityLog({
        type: order.type === 'takeout' ? 'takeout' : 'general',
        title: 'Order Deleted',
        detail: `${order.id} removed from operations queue`,
        duration: '0:07',
        status: 'HANDLED',
      });
      showToast(`Order ${order.id} deleted.`);
    }
  };

  const handleAddScript = (script: Script) => {
    setScripts(prev => [script, ...prev]);
    createBackendScript(script)
      .then(() => refreshDashboardAnalytics())
      .catch(() => {
        setDashboardAnalytics(null);
        showToast('Script saved locally. Backend sync is offline.');
      });
    addActivityLog({
      type: 'general',
      title: 'Script Created',
      detail: `${script.title} added to script library`,
      duration: '0:20',
      status: 'SUCCESS',
    });
    showToast(`Script "${script.title}" created successfully.`);
  };

  const handleUpdateScript = (updatedScript: Script) => {
    setScripts(prev => prev.map(script => script.id === updatedScript.id ? updatedScript : script));
    updateBackendScript(updatedScript)
      .then(() => refreshDashboardAnalytics())
      .catch(() => {
        setDashboardAnalytics(null);
        showToast('Script update saved locally. Backend sync is offline.');
      });
    addActivityLog({
      type: 'change',
      title: 'Script Updated',
      detail: `${updatedScript.title} updated in script library`,
      duration: '0:15',
      status: 'HANDLED',
    });
    showToast(`Script "${updatedScript.title}" updated successfully.`);
  };

  const handleDeleteScript = (id: string) => {
    const scriptToDelete = scripts.find(script => script.id === id);
    setScripts(prev => prev.filter(script => script.id !== id));
    if (scriptToDelete) {
      deleteBackendScript(id)
        .then(() => refreshDashboardAnalytics())
        .catch(() => {
          setDashboardAnalytics(null);
          showToast('Script removed locally. Backend sync is offline.');
        });
      addActivityLog({
        type: 'change',
        title: 'Script Deleted',
        detail: `${scriptToDelete.title} removed from script library`,
        duration: '0:09',
        status: 'HANDLED',
      });
      showToast(`Deleted script "${scriptToDelete.title}".`);
    }
  };

  // Simulated AI quick generation trigger from dashboard
  const createFallbackGeneratedScript = (): Script => ({
      id: `script-${Date.now()}`,
      title: 'AI Generated Reservation Follow-up',
      description: 'Generated follow-up script for recent reservation callers, including confirmation and optional offer mention.',
      category: 'DYNAMIC',
      text: `[AI]: "Thanks for calling Bistro Prime. I can help confirm your reservation details and answer quick menu questions."

[Wait for User Response]

[AI]: "I found your booking. Would you like me to add any dietary notes or special occasion details before we send the confirmation?"

[If Customer Is Interested]

[AI]: "We also have active specials available tonight. I can mention the chef's recommended pairing when your party arrives."

[Finalizing]

[AI]: "You're all set. A confirmation SMS is on the way, and we look forward to hosting you."`,
      avatarText: 'AI',
      lastUpdated: 'Updated just now',
      stats: {
        successRate: 'Pending',
        avgDuration: 'Pending',
        intentAccuracy: 'Pending'
      }
    });

  const saveGeneratedScript = (generatedScript: Script) => {
    setScripts(prev => [generatedScript, ...prev]);
    createBackendScript(generatedScript)
      .then(() => refreshDashboardAnalytics())
      .catch(() => {
        setDashboardAnalytics(null);
        showToast('Generated script saved locally. Backend sync is offline.');
      });
    addActivityLog({
      type: 'general',
      title: 'AI Script Generated',
      detail: `${generatedScript.title} synthesized from dashboard`,
      duration: '0:24',
      status: 'SUCCESS',
    });
    showToast("AI script synthesized and appended successfully.");
    setCurrentTab('scripts');
  };

  const handleGenerateScriptQuick = async () => {
    try {
      const result = await generateBackendScript({
        brandName: 'Bistro Prime',
        purpose: 'reservation follow-up',
        menuItems,
      });
      saveGeneratedScript({
        id: `script-${Date.now()}`,
        ...result.script,
      });
    } catch {
      saveGeneratedScript(createFallbackGeneratedScript());
    }
  };

  // Toast notifier helper
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage('');
    }, 4000);
  };

  useEffect(() => {
    const handleAuthExpired = () => {
      setAuthNotice('Your admin session expired. Please sign in again.');
      setIsAuthenticated(false);
    };

    window.addEventListener('bistro-ai:auth-expired', handleAuthExpired);
    return () => {
      window.removeEventListener('bistro-ai:auth-expired', handleAuthExpired);
    };
  }, []);

  useEffect(() => {
    const canManageContent = currentUser.role === 'admin' || currentUser.role === 'manager';
    if ((currentTab === 'menu' || currentTab === 'scripts') && !canManageContent) {
      setCurrentTab('dashboard');
    }
    if (currentTab === 'settings' && currentUser.role !== 'admin') {
      setCurrentTab('dashboard');
    }
  }, [currentTab, currentUser.role]);

  const handleAuthenticated = (session: AuthSession) => {
    setAuthNotice('');
    setCurrentUser({
      username: session.username,
      displayName: session.displayName,
      role: session.role,
    });
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    clearAuthToken();
    setAuthNotice('You have been signed out.');
    setCurrentTab('dashboard');
    setIsAuthenticated(false);
    setCurrentUser({ username: 'Alex Rivera', role: 'admin' });
  };

  const handleManualDashboardRefresh = async () => {
    await refreshDashboardAnalytics();
    showToast('Dashboard analytics refreshed.');
  };

  // Live monitor simulation toggle
  const handleLaunchMonitor = () => {
    if (isLiveActive) {
      setIsLiveActive(false);
      setShowLiveCallNotification(false);
      showToast("Live telemetric monitor disconnected.");
    } else {
      setIsLiveActive(true);
      showToast("Live voice monitor active! Simulating incoming reservation calls...");
      // Simulate an incoming call in 3 seconds
      setTimeout(() => {
        setShowLiveCallNotification(true);
      }, 2500);
    }
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex items-center justify-center p-4 font-sans">
        <div className="flex items-center gap-3 text-on-surface-variant">
          <span className="material-symbols-outlined text-primary animate-pulse">admin_panel_settings</span>
          <span className="font-geist text-xs font-bold uppercase tracking-wider">Checking session...</span>
        </div>
      </div>
    );
  }

  if (isAuthRequired && !isAuthenticated) {
    return <AdminLoginView notice={authNotice} onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="min-h-screen flex bg-surface font-sans text-on-surface antialiased overflow-x-hidden selection:bg-primary/30 selection:text-white">
      {/* PERSISTENT BRAND NAVIGATION BAR */}
      <Sidebar
        currentTab={currentTab}
        onChangeTab={(tab) => setCurrentTab(tab as any)}
        onLaunchMonitor={handleLaunchMonitor}
        isLiveActive={isLiveActive}
        currentRole={currentUser.role}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* MOBILE BACKDROP OVERLAY */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 z-40 lg:hidden animate-fadeIn"
        />
      )}

      {/* MAIN CONTAINER */}
      <div className="flex-1 lg:ml-[280px] min-h-screen w-full flex flex-col relative">
        
        {/* TOP BAR SHELL */}
        <header className="sticky top-0 h-16 bg-surface/85 backdrop-blur-md border-b border-outline-variant/35 flex justify-between items-center px-4 md:px-8 z-40">
          <div className="flex items-center gap-3.5 flex-1">
            {/* Hamburger button for mobile drawer */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              type="button"
              className="lg:hidden p-2 text-on-surface hover:bg-surface-container-low rounded-xl flex items-center justify-center transition-colors"
              title="Open menu drawer"
            >
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>

            <div className="relative w-full max-w-md flex items-center">
              <span className="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-[18px] select-none pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search metrics, dishes, reservations..."
                className="w-full bg-[#191c1e]/65 border border-outline-variant/35 rounded-full py-1.5 pl-10 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-on-surface placeholder:text-on-surface-variant/50 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  type="button"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="bg-primary-container/20 text-primary py-1 px-3.5 rounded-full text-[11px] font-geist font-bold animate-pulse hidden md:block">
                Filtering Workspace Active
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 md:gap-6">
            <div className="flex items-center gap-1 md:gap-2">
              {/* Alert indicator if Live call is active */}
              <button
                onClick={() => {
                  if (isLiveActive) {
                    setShowLiveCallNotification(prev => !prev);
                  } else {
                    showToast("Turn on Live Monitor to trigger active caller logs.");
                  }
                }}
                type="button"
                className="p-2 text-on-surface-variant hover:bg-surface-container-low transition-colors rounded-full relative"
              >
                <span className="material-symbols-outlined text-[20px]">notifications</span>
                {(isLiveActive || showLiveCallNotification) && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-[#ffb95f] rounded-full animate-bounce"></span>
                )}
              </button>
              
              <button
                onClick={() => showToast("Gemini assistance will be connected through the backend API layer.")}
                type="button"
                className="p-2 text-on-surface-variant hover:bg-surface-container-low transition-colors rounded-full"
              >
                <span className="material-symbols-outlined text-[20px]">help_outline</span>
              </button>
              {isAuthRequired && (
                <button
                  onClick={handleLogout}
                  type="button"
                  className="px-3 py-2 text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors rounded-full flex items-center gap-1.5"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <span className="material-symbols-outlined text-[20px]">logout</span>
                  <span className="hidden xl:inline font-geist font-bold text-[11px] uppercase tracking-wide">Sign out</span>
                </button>
              )}
            </div>

            <div className="h-8 w-[1px] bg-outline-variant/40"></div>

            {/* Profile context */}
            <div className="flex items-center gap-3">
              <div className="text-right hidden xl:block">
                <p className="font-geist font-bold text-xs text-on-surface leading-tight">
                  {currentUser.displayName || currentUser.username}
                </p>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold mt-0.5">
                  {currentUser.role}
                </p>
              </div>
              <div className="w-9 h-9 rounded-full bg-surface-container-high border-2 border-outline-variant/30 overflow-hidden shadow-inner flex-shrink-0">
                <img
                  className="w-full h-full object-cover"
                  alt="Professional Avatar"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBe6nLA_fAeaQ9iigCJDDxlJCfCYhhVECAmkyjvMhzwwVaMMifm8mrEvSLjBRktdk5W52FSBl5d0AhiMy-abVzOiAmr9juCuoFwoB_1chk_8X5EM-vPn3MfZk32LqmuJbIERrxqUEG9SZE3SRv0-pNWTrE2q3BdeN_s30ZFhSvTYujkSRtdAOxhZjxvMrCIMz1k5_tgM7SnPoPb1RSoVRkEA7HBYw74oBqwvZGdKyktncci4j65q8-o8NG4D8Ae4tHnoyBO5F5RBHW-"
                />
              </div>
            </div>
          </div>
        </header>

        {/* MOCK FLOATING INCOMING CALL STATUS FOR LIVE INTERACTIVITY */}
        {isLiveActive && (
          <div className="bg-[#0b0f10] border-b border-primary/20 p-4 transition-all duration-300 animate-slideDown z-30 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
              </span>
              <p className="font-geist font-bold text-xs text-on-surface uppercase tracking-wider">
                Vocal Channel Connected (Jamie Sim active)
              </p>
            </div>

            {showLiveCallNotification ? (
              <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-2 text-xs font-sans text-on-surface flex items-center justify-between gap-6 animate-scaleUp max-w-lg">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-[18px] animate-pulse">call</span>
                  <div>
                    <span className="font-bold text-primary mr-1">Inbound Line Active:</span>
                    <span>+1 (555) 302-1481 is arranging a party of 5 table booking...</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowLiveCallNotification(false)}
                  className="text-on-surface-variant hover:text-on-surface font-bold font-geist ml-2 uppercase text-[10px]"
                >
                  Dismiss Call
                </button>
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant/80 italic">
                Listening for incoming reservation calls... (Simulated connection interval randomized)
              </p>
            )}
          </div>
        )}

        {/* PRIMARY VIEW PANEL CANVAS */}
        <main className="flex-grow p-4 md:p-8 max-w-container-max w-full mx-auto overflow-y-auto">
          {currentTab === 'dashboard' && (
            <DashboardView
              activityLogs={visibleActivityLogs}
              menuItems={menuItems}
              scripts={scripts}
              analytics={dashboardAnalytics}
              isAnalyticsRefreshing={isDashboardRefreshing}
              onChangeTab={(tab) => setCurrentTab(tab as any)}
              onGenerateScriptQuick={handleGenerateScriptQuick}
              onRefreshAnalytics={handleManualDashboardRefresh}
              onNotify={showToast}
            />
          )}

          {currentTab === 'menu' && (
            <MenuView
              menuItems={menuItems}
              onAddMenuItem={handleAddMenuItem}
              onUpdateMenuItem={handleUpdateMenuItem}
              onDeleteMenuItem={handleDeleteMenuItem}
              globalSearchTerm={searchQuery}
            />
          )}

          {currentTab === 'operations' && (
            <OperationsView
              reservations={reservations}
              orders={orders}
              menuItems={menuItems}
              onAddReservation={handleAddReservation}
              onUpdateReservation={handleUpdateReservation}
              onDeleteReservation={handleDeleteReservation}
              onAddOrder={handleAddOrder}
              onUpdateOrder={handleUpdateOrder}
              onDeleteOrder={handleDeleteOrder}
              globalSearchTerm={searchQuery}
            />
          )}

          {currentTab === 'scripts' && (
            <ScriptsView
              scripts={scripts}
              onAddScript={handleAddScript}
              onUpdateScript={handleUpdateScript}
              onDeleteScript={handleDeleteScript}
              globalSearchTerm={searchQuery}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView currentRole={currentUser.role} />
          )}
        </main>
      </div>

      {/* TOAST SYSTEM FEEDBACK ALERTS */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[60] bg-inverse-surface text-inverse-on-surface font-geist font-semibold text-xs py-3 px-5 rounded-xl shadow-2xl flex items-center gap-3 animate-scaleUp border border-outline/10">
          <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Global CSS for elegant micro-animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleUp {
          from { transform: scale(0.96); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.35s ease-out forwards;
        }
        .animate-scaleUp {
          animation: scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-slideDown {
          animation: slideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .pulse-glow {
          box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5);
          animation: pulseRed 1.8s infinite;
        }
        @keyframes pulseRed {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>
    </div>
  );
}
