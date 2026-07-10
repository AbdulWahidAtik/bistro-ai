import React from 'react';

interface SidebarProps {
  currentTab: 'dashboard' | 'menu' | 'operations' | 'scripts' | 'settings';
  onChangeTab: (tab: string) => void;
  onLaunchMonitor: () => void;
  isLiveActive: boolean;
  currentRole?: 'admin' | 'manager' | 'staff';
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({
  currentTab,
  onChangeTab,
  onLaunchMonitor,
  isLiveActive,
  currentRole = 'admin',
  isOpenMobile = false,
  onCloseMobile
}: SidebarProps) {
  const handleTabClick = (tab: string) => {
    onChangeTab(tab);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };
  const canManageContent = currentRole === 'admin' || currentRole === 'manager';
  const canManageSettings = currentRole === 'admin';

  return (
    <aside className={`fixed left-0 top-0 h-full w-[280px] glass-panel border-r border-white/[0.04] flex flex-col p-5 z-50 transition-transform duration-300 ${
      isOpenMobile ? 'translate-x-0' : '-translate-x-full'
    } lg:translate-x-0`}>
      {/* Brand Header */}
      <div className="flex items-center justify-between mb-8 px-2 mt-2">
        <div className="flex items-center gap-3.5 group cursor-pointer">
          {/* SVG Branding matching image with steering wheel/plate visual */}
          <div className="w-10 h-10 bg-gradient-to-tr from-primary to-emerald-400 rounded-xl flex items-center justify-center text-on-primary font-bold shadow-lg shadow-primary/10 group-hover:scale-105 transition-transform duration-300 overflow-hidden shrink-0">
            <svg className="w-6 h-6 block" width="24" height="24" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
              <path d="M256 48C141.1 48 48 141.1 48 256s93.1 208 208 208 208-93.1 208-208S370.9 48 256 48zm0 82.5c51.9 0 94 42.1 94 94 0 10.2-1.6 20-4.6 29.2H166.6c-3-9.2-4.6-19-4.6-29.2 0-51.9 42.1-94 94-94zm-95.2 163.5h190.4c-9.1 32-39.7 55.3-75.7 58.7v42.1c0 10.7-8.7 19.4-19.5 19.4s-19.5-8.7-19.5-19.4V349c-36-3.4-66.6-26.7-75.7-58.7z" />
            </svg>
          </div>
          <div>
            <h1 className="font-geist text-[20px] font-extrabold bg-gradient-to-r from-primary to-emerald-300 bg-clip-text text-transparent leading-none">Bistro AI</h1>
            <p className="text-[10px] text-on-surface-variant/80 uppercase tracking-widest mt-1 font-semibold">Management</p>
          </div>
        </div>

        {/* Close Button on Mobile Drawer */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            type="button"
            className="lg:hidden p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-on-surface-variant hover:text-on-surface transition-colors"
            title="Close menu drawer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2">
        <button
          onClick={() => handleTabClick('dashboard')}
          type="button"
          className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-300 text-left active:scale-[0.98] border-l-2 ${
            currentTab === 'dashboard'
              ? 'bg-gradient-to-r from-primary/12 to-transparent text-primary border-primary font-semibold shadow-[inset_1px_0_0_rgba(74,225,118,0.1)]'
              : 'text-on-surface-variant border-transparent hover:bg-white/[0.02] hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: currentTab === 'dashboard' ? "'FILL' 1" : "'FILL' 0" }}>dashboard</span>
          <span className="font-geist text-sm">Dashboard</span>
        </button>

        {canManageContent && (
          <button
            onClick={() => handleTabClick('menu')}
            type="button"
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-300 text-left active:scale-[0.98] border-l-2 ${
              currentTab === 'menu'
                ? 'bg-gradient-to-r from-primary/12 to-transparent text-primary border-primary font-semibold shadow-[inset_1px_0_0_rgba(74,225,118,0.1)]'
                : 'text-on-surface-variant border-transparent hover:bg-white/[0.02] hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: currentTab === 'menu' ? "'FILL' 1" : "'FILL' 0" }}>restaurant_menu</span>
            <span className="font-geist text-sm">Menu</span>
          </button>
        )}

        <button
          onClick={() => handleTabClick('operations')}
          type="button"
          className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-300 text-left active:scale-[0.98] border-l-2 ${
            currentTab === 'operations'
              ? 'bg-gradient-to-r from-primary/12 to-transparent text-primary border-primary font-semibold shadow-[inset_1px_0_0_rgba(74,225,118,0.1)]'
              : 'text-on-surface-variant border-transparent hover:bg-white/[0.02] hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: currentTab === 'operations' ? "'FILL' 1" : "'FILL' 0" }}>room_service</span>
          <span className="font-geist text-sm">Operations</span>
        </button>

        {canManageContent && (
          <button
            onClick={() => handleTabClick('scripts')}
            type="button"
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-300 text-left active:scale-[0.98] border-l-2 ${
              currentTab === 'scripts'
                ? 'bg-gradient-to-r from-primary/12 to-transparent text-primary border-primary font-semibold shadow-[inset_1px_0_0_rgba(74,225,118,0.1)]'
                : 'text-on-surface-variant border-transparent hover:bg-white/[0.02] hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: currentTab === 'scripts' ? "'FILL' 1" : "'FILL' 0" }}>record_voice_over</span>
            <span className="font-geist text-sm">AI Scripts</span>
          </button>
        )}

        {canManageSettings && (
          <button
            onClick={() => handleTabClick('settings')}
            type="button"
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-300 text-left active:scale-[0.98] border-l-2 ${
              currentTab === 'settings'
                ? 'bg-gradient-to-r from-primary/12 to-transparent text-primary border-primary font-semibold shadow-[inset_1px_0_0_rgba(74,225,118,0.1)]'
                : 'text-on-surface-variant border-transparent hover:bg-white/[0.02] hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: currentTab === 'settings' ? "'FILL' 1" : "'FILL' 0" }}>settings</span>
            <span className="font-geist text-sm">Settings</span>
          </button>
        )}
      </nav>

      {/* Footer / Live monitor trigger banner */}
      <div className="mt-auto pt-4 border-t border-white/[0.06]">
        <button
          onClick={() => {
            onLaunchMonitor();
            if (onCloseMobile) onCloseMobile();
          }}
          type="button"
          className={`w-full py-3.5 px-4 font-geist font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all duration-300 active:scale-95 shadow-lg border ${
            isLiveActive
              ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-red-500/20 border-red-400/25 pulse-glow scale-[1.02]'
              : 'bg-gradient-to-r from-primary to-emerald-500 text-on-primary border-emerald-400/20 shadow-primary/10 hover:brightness-105'
          }`}
        >
          <span className="material-symbols-outlined text-[18px] animate-pulse">
            {isLiveActive ? 'sensors' : 'monitor_heart'}
          </span>
          {isLiveActive ? 'Disconnect Monitor' : 'Launch Live Monitor'}
        </button>
      </div>
    </aside>
  );
}
