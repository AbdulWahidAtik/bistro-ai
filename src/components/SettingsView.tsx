import React, { useEffect, useState } from 'react';
import {
  createBackendUser,
  deleteBackendUser,
  loadBackendSettings,
  loadBackendUsers,
  resetBackendWorkspace,
  updateBackendSettings,
  updateBackendUser,
} from '../api';
import { useLocalStorageState } from '../hooks/useLocalStorageState';
import { AccessUser, UserRole, WorkspaceSettings } from '../types';

interface SettingsViewProps {
  currentRole?: UserRole;
}

const roleLabels: Record<UserRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
};

export default function SettingsView({ currentRole = 'admin' }: SettingsViewProps) {
  const localStorageKeys = [
    'bistro-ai:menu-items',
    'bistro-ai:scripts',
    'bistro-ai:activity-logs',
    'bistro-ai:brand-name',
    'bistro-ai:active-voice',
    'bistro-ai:phone-routing',
    'bistro-ai:auto-upsell-percent',
    'bistro-ai:auto-confirm-sms',
    'bistro-ai:service-hours',
  ];

  const [brandName, setBrandName] = useLocalStorageState<string>('bistro-ai:brand-name', 'Bistro Prime');
  const [activeVoice, setActiveVoice] = useLocalStorageState<string>('bistro-ai:active-voice', 'jamie');
  const [phoneRouting, setPhoneRouting] = useLocalStorageState<string>('bistro-ai:phone-routing', '+1 (555) 382-7476');
  const [autoUpsellPercent, setAutoUpsellPercent] = useLocalStorageState<number>('bistro-ai:auto-upsell-percent', 15);
  const [autoConfirmSms, setAutoConfirmSms] = useLocalStorageState<boolean>('bistro-ai:auto-confirm-sms', true);
  const [serviceHours, setServiceHours] = useLocalStorageState('bistro-ai:service-hours', {
    weekdays: '8:00 AM - 11:00 PM',
    saturday: '9:00 AM - 12:00 AM',
    sunday: '9:00 AM - 10:00 PM'
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);
  
  // Custom tab control for settings categories
  const [activeSettingsTab, setActiveSettingsTab] = useState<'identity' | 'rules' | 'hours' | 'access'>('identity');
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [usersMessage, setUsersMessage] = useState<string>('');
  const [isUsersLoading, setIsUsersLoading] = useState<boolean>(false);
  const [newUser, setNewUser] = useState({
    username: '',
    displayName: '',
    password: '',
    role: 'staff' as UserRole,
    isActive: true,
  });
  const [editingUsers, setEditingUsers] = useState<Record<string, {
    username: string;
    displayName: string;
    password: string;
  }>>({});
  const canManageUsers = currentRole === 'admin';
  
  // Custom state for simulating voice preview playbacks
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  const voices = [
    { id: 'jamie', name: 'Jamie', style: 'Friendly Professional', quote: '"I\'d be happy to note any special occasion..."', lang: 'English (US balanced)' },
    { id: 'taylor', name: 'Taylor', style: 'Energetic Casual', quote: '"Excellent! Let me hook you up with that signature burger..."', lang: 'English (US premium)' },
    { id: 'morgan', name: 'Morgan', style: 'Direct & Efficient', quote: '"Rescheduled for free. SMS sent."', lang: 'English (UK standard)' }
  ];

  useEffect(() => {
    let isMounted = true;

    loadBackendSettings()
      .then((settings) => {
        if (!isMounted) return;
        setBrandName(settings.brandName);
        setActiveVoice(settings.activeVoice);
        setPhoneRouting(settings.phoneRouting);
        setAutoUpsellPercent(settings.autoUpsellPercent);
        setAutoConfirmSms(settings.autoConfirmSms);
        setServiceHours(settings.serviceHours);
      })
      .catch(() => {
        // Keep local settings when the API is offline.
      });

    return () => {
      isMounted = false;
    };
  }, [
    setActiveVoice,
    setAutoConfirmSms,
    setAutoUpsellPercent,
    setBrandName,
    setPhoneRouting,
    setServiceHours,
  ]);

  useEffect(() => {
    if (!canManageUsers) return;

    let isMounted = true;
    setIsUsersLoading(true);
    loadBackendUsers()
      .then((nextUsers) => {
        if (isMounted) setUsers(nextUsers);
      })
      .catch(() => {
        if (isMounted) setUsersMessage('User access list is unavailable while the backend is offline.');
      })
      .finally(() => {
        if (isMounted) setIsUsersLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [canManageUsers]);

  const getCurrentSettings = (): WorkspaceSettings => ({
    brandName,
    activeVoice,
    phoneRouting,
    autoUpsellPercent,
    autoConfirmSms,
    serviceHours,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage('');

    updateBackendSettings(getCurrentSettings())
      .then(() => {
        setSaveMessage('System blueprint synchronized successfully.');
      })
      .catch(() => {
        setSaveMessage('Saved locally. Backend sync is offline.');
      })
      .finally(() => {
        setIsSaving(false);
        setTimeout(() => setSaveMessage(''), 3000);
      });
  };

  const toggleVoicePlayback = (voiceId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (playingVoiceId === voiceId) {
      setPlayingVoiceId(null);
    } else {
      setPlayingVoiceId(voiceId);
      // Auto turn off after 3 seconds
      setTimeout(() => {
        setPlayingVoiceId(current => current === voiceId ? null : current);
      }, 3000);
    }
  };

  const handleResetWorkspace = async () => {
    try {
      await resetBackendWorkspace();
    } catch {
      // Reset local state even if the API is offline.
    }

    try {
      localStorageKeys.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // Reload still gives the app a chance to fall back to seeded data.
    }
    window.location.reload();
  };

  const handleCreateUser = async (event: React.FormEvent | React.MouseEvent) => {
    event.preventDefault();
    setUsersMessage('');

    try {
      const created = await createBackendUser(newUser);
      setUsers((current) => [created, ...current]);
      setNewUser({ username: '', displayName: '', password: '', role: 'staff', isActive: true });
      setUsersMessage('Access account created.');
    } catch {
      setUsersMessage('Could not create account. Check username/password and try again.');
    }
  };

  const handleUpdateUser = async (user: AccessUser, updates: Partial<AccessUser> & { password?: string }) => {
    setUsersMessage('');
    try {
      const updated = await updateBackendUser(user.id, {
        username: updates.username ?? user.username,
        displayName: updates.displayName ?? user.displayName,
        role: updates.role ?? user.role,
        isActive: updates.isActive ?? user.isActive,
        password: updates.password,
      });
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEditingUsers((current) => {
        const { [user.id]: _updatedUser, ...rest } = current;
        return rest;
      });
      setUsersMessage('Access account updated.');
    } catch {
      setUsersMessage('Could not update account. At least one active admin must remain.');
    }
  };

  const startEditingUser = (user: AccessUser) => {
    setEditingUsers((current) => ({
      ...current,
      [user.id]: {
        username: user.username,
        displayName: user.displayName,
        password: '',
      },
    }));
  };

  const cancelEditingUser = (userId: string) => {
    setEditingUsers((current) => {
      const { [userId]: _cancelledUser, ...rest } = current;
      return rest;
    });
  };

  const handleDeleteUser = async (user: AccessUser) => {
    setUsersMessage('');
    try {
      await deleteBackendUser(user.id);
      setUsers((current) => current.filter((item) => item.id !== user.id));
      setUsersMessage('Access account removed.');
    } catch {
      setUsersMessage('Could not remove account. At least one active admin must remain.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn pb-12">
      {/* Header */}
      <div>
        <h2 className="font-geist text-headline-xl font-extrabold bg-gradient-to-r from-white to-on-surface-variant bg-clip-text text-transparent tracking-tight leading-tight">
          System Settings
        </h2>
        <p className="font-sans text-body-md text-on-surface-variant/70 mt-1">
          Configure vocal brand identity parameters, telemetry rules, and service hour trunks.
        </p>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex border-b border-white/[0.06] gap-2 pb-px">
        <button
          onClick={() => setActiveSettingsTab('identity')}
          type="button"
          className={`pb-3 px-4 text-xs font-geist font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeSettingsTab === 'identity'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant/80 hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">psychology</span>
          Vocal Identity
        </button>
        <button
          onClick={() => setActiveSettingsTab('rules')}
          type="button"
          className={`pb-3 px-4 text-xs font-geist font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeSettingsTab === 'rules'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant/80 hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">sliders</span>
          Conversational Triggers
        </button>
        <button
          onClick={() => setActiveSettingsTab('hours')}
          type="button"
          className={`pb-3 px-4 text-xs font-geist font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeSettingsTab === 'hours'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant/80 hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">calendar_clock</span>
          Service Hours
        </button>
        {canManageUsers && (
          <button
            onClick={() => setActiveSettingsTab('access')}
            type="button"
            className={`pb-3 px-4 text-xs font-geist font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeSettingsTab === 'access'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant/80 hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">shield_person</span>
            Access
          </button>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* TAB 1: VOCAL IDENTITY */}
        {activeSettingsTab === 'identity' && (
          <div className="space-y-6">
            <div className="glass-panel rounded-2xl border border-white/[0.04] p-6 space-y-6 shadow-md">
              <h3 className="font-geist text-headline-sm font-bold text-on-surface flex items-center gap-2 pb-3 border-b border-white/[0.06]">
                Identity & Brand Core
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Brand identifier name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">
                    Restaurant Brand Identifier
                  </label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="text-[11px] text-on-surface-variant/60">
                    Announced automatically by the AI agent at call initiation.
                  </p>
                </div>

                {/* Simulated Phone routing line */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">
                    Incoming Call Trunk Routing
                  </label>
                  <input
                    type="text"
                    value={phoneRouting}
                    onChange={(e) => setPhoneRouting(e.target.value)}
                    className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                  <p className="text-[11px] text-on-surface-variant/60">
                    Simulated Twilio trunk destination phone routing.
                  </p>
                </div>
              </div>

              {/* Voice Choice Cards */}
              <div className="space-y-3 pt-3">
                <label className="block text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">
                  Active Voice Profile Choice
                </label>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {voices.map((v) => {
                    const isSelected = v.id === activeVoice;
                    const isPreviewing = playingVoiceId === v.id;
                    return (
                      <button
                        key={v.id}
                        onClick={() => setActiveVoice(v.id)}
                        type="button"
                        className={`text-left p-4 rounded-xl border flex flex-col justify-between transition-all duration-300 relative cursor-pointer ${
                          isSelected
                            ? 'border-primary/40 bg-primary/5 shadow-md shadow-primary/5 scale-[1.01]'
                            : 'border-white/[0.04] bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.02]'
                        }`}
                      >
                        <div className="w-full space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-geist font-bold text-sm text-on-surface">{v.name}</span>
                            {isSelected && (
                              <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                            )}
                          </div>
                          <p className="text-[10px] text-primary font-bold uppercase font-geist tracking-wide">{v.style}</p>
                          <p className="text-[11px] text-on-surface-variant/70 font-mono h-11 overflow-hidden leading-relaxed">
                            {v.quote}
                          </p>
                        </div>

                        <div className="flex items-center justify-between border-t border-white/[0.04] pt-3 mt-4 w-full">
                          <span className="text-[9px] text-on-surface-variant/60 font-sans">
                            {v.lang}
                          </span>
                          
                          {/* Play Sample Button */}
                          <button
                            type="button"
                            onClick={(event) => toggleVoicePlayback(v.id, event)}
                            className={`p-1.5 rounded-lg border text-xs flex items-center justify-center transition-all cursor-pointer ${
                              isPreviewing
                                ? 'bg-primary/20 border-primary text-primary'
                                : 'bg-white/5 border-white/[0.06] text-on-surface hover:bg-white/10'
                            }`}
                            title="Play sample voice profile"
                          >
                            {isPreviewing ? (
                              <div className="flex gap-[2px] items-end h-3 px-0.5">
                                <div className="w-[1.5px] bg-primary h-3 animate-[pulseWave_0.5s_infinite]"></div>
                                <div className="w-[1.5px] bg-primary h-2 animate-[pulseWave_0.7s_infinite_0.1s]"></div>
                                <div className="w-[1.5px] bg-primary h-4 animate-[pulseWave_0.6s_infinite_0.2s]"></div>
                              </div>
                            ) : (
                              <span className="material-symbols-outlined text-[14px]">volume_up</span>
                            )}
                          </button>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CONVERSATIONAL TRIGGERS */}
        {activeSettingsTab === 'rules' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="glass-panel rounded-2xl border border-white/[0.04] p-6 space-y-6 shadow-md">
              <h3 className="font-geist text-headline-sm font-bold text-on-surface flex items-center gap-2 pb-3 border-b border-white/[0.06]">
                Rules & Conversational Thresholds
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Auto Upsell slider range */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">
                    <span>Vocal Upsell Probability</span>
                    <span className="text-secondary">{autoUpsellPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={autoUpsellPercent}
                    onChange={(e) => setAutoUpsellPercent(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <p className="text-[11px] text-on-surface-variant/60 leading-relaxed">
                    Determines call cadence aggression for suggesting side orders or weekend drink specials.
                  </p>
                </div>

                {/* SMS Auto confirming */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-white/[0.01] p-4 rounded-xl border border-white/[0.04]">
                    <div>
                      <p className="text-xs font-geist font-bold text-on-surface">Auto-Confirm Reservation SMS</p>
                      <p className="text-[10px] text-on-surface-variant/60 mt-0.5">Dispatches instant text receipt confirmations.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoConfirmSms}
                        onChange={(event) => setAutoConfirmSms(event.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4.5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-white/20 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SERVICE HOURS */}
        {activeSettingsTab === 'hours' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="glass-panel rounded-2xl border border-white/[0.04] p-6 space-y-6 shadow-md">
              <h3 className="font-geist text-headline-sm font-bold text-on-surface flex items-center gap-2 pb-3 border-b border-white/[0.06]">
                Voice Service Hours
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant/80 uppercase tracking-wide">Monday - Friday</label>
                  <input
                    type="text"
                    value={serviceHours.weekdays}
                    onChange={(event) => setServiceHours({ ...serviceHours, weekdays: event.target.value })}
                    className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant/80 uppercase tracking-wide">Saturday</label>
                  <input
                    type="text"
                    value={serviceHours.saturday}
                    onChange={(event) => setServiceHours({ ...serviceHours, saturday: event.target.value })}
                    className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant/80 uppercase tracking-wide">Sunday</label>
                  <input
                    type="text"
                    value={serviceHours.sunday}
                    onChange={(event) => setServiceHours({ ...serviceHours, sunday: event.target.value })}
                    className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSettingsTab === 'access' && canManageUsers && (
          <div className="space-y-6 animate-fadeIn">
            <div className="glass-panel rounded-2xl border border-white/[0.04] p-6 space-y-6 shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
                <h3 className="font-geist text-headline-sm font-bold text-on-surface flex items-center gap-2">
                  Role-Based Access
                </h3>
                <span className="text-[10px] font-geist font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
                  Admin only
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(event) => setNewUser({ ...newUser, username: event.target.value })}
                  placeholder="username"
                  className="bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="text"
                  value={newUser.displayName}
                  onChange={(event) => setNewUser({ ...newUser, displayName: event.target.value })}
                  placeholder="display name"
                  className="bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(event) => setNewUser({ ...newUser, password: event.target.value })}
                  placeholder="password"
                  className="bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <select
                  value={newUser.role}
                  onChange={(event) => setNewUser({ ...newUser, role: event.target.value as UserRole })}
                  className="bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {Object.entries(roleLabels).map(([role, label]) => (
                    <option key={role} value={role}>{label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleCreateUser}
                  className="px-5 py-3 bg-primary text-on-primary rounded-xl font-geist font-bold text-sm hover:brightness-105 active:scale-95 transition-all cursor-pointer"
                >
                  Add User
                </button>
              </div>

              {usersMessage && (
                <p className="text-xs font-geist font-semibold text-primary">{usersMessage}</p>
              )}

              <div className="space-y-3">
                {isUsersLoading ? (
                  <div className="text-sm text-on-surface-variant/70">Loading access accounts...</div>
                ) : users.map((user) => {
                  const editState = editingUsers[user.id];
                  return (
                    <div key={user.id} className="space-y-3 bg-white/[0.015] border border-white/[0.04] rounded-xl p-4">
                      <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr_1fr_auto] gap-3 items-center">
                        <div>
                          <p className="font-geist font-bold text-sm text-on-surface">{user.displayName || user.username}</p>
                          <p className="text-[11px] text-on-surface-variant/70 font-mono">@{user.username}</p>
                        </div>
                        <select
                          value={user.role}
                          onChange={(event) => handleUpdateUser(user, { role: event.target.value as UserRole })}
                          className="bg-[#0b0e10] border border-white/[0.06] rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {Object.entries(roleLabels).map(([role, label]) => (
                            <option key={role} value={role}>{label}</option>
                          ))}
                        </select>
                        <label className="flex items-center gap-2 text-xs font-geist font-bold text-on-surface-variant cursor-pointer">
                          <input
                            type="checkbox"
                            checked={user.isActive}
                            onChange={(event) => handleUpdateUser(user, { isActive: event.target.checked })}
                            className="accent-primary"
                          />
                          Active
                        </label>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => editState ? cancelEditingUser(user.id) : startEditingUser(user)}
                            className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors rounded-lg cursor-pointer"
                            title={editState ? 'Cancel edit' : 'Edit account'}
                          >
                            <span className="material-symbols-outlined text-[18px]">{editState ? 'close' : 'edit'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user)}
                            className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors rounded-lg cursor-pointer"
                            title="Remove account"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </div>

                      {editState && (
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3 border-t border-white/[0.04] pt-3">
                          <input
                            type="text"
                            value={editState.username}
                            onChange={(event) => setEditingUsers((current) => ({
                              ...current,
                              [user.id]: { ...editState, username: event.target.value },
                            }))}
                            className="bg-[#0b0e10] border border-white/[0.06] rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <input
                            type="text"
                            value={editState.displayName}
                            onChange={(event) => setEditingUsers((current) => ({
                              ...current,
                              [user.id]: { ...editState, displayName: event.target.value },
                            }))}
                            className="bg-[#0b0e10] border border-white/[0.06] rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <input
                            type="password"
                            value={editState.password}
                            onChange={(event) => setEditingUsers((current) => ({
                              ...current,
                              [user.id]: { ...editState, password: event.target.value },
                            }))}
                            placeholder="new password optional"
                            className="bg-[#0b0e10] border border-white/[0.06] rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateUser(user, {
                              username: editState.username,
                              displayName: editState.displayName,
                              password: editState.password || undefined,
                            })}
                            className="px-4 py-2.5 bg-white/5 border border-white/[0.08] rounded-xl font-geist font-bold text-xs text-on-surface hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Submit action */}
        <div className="pt-2 flex justify-between items-center flex-wrap gap-4">
          <div className="min-h-5">
            {saveMessage && (
              <p className="text-xs font-geist font-semibold text-primary animate-pulse">
                {saveMessage}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsResetConfirmOpen(true)}
              className="px-5 py-3 border border-white/10 rounded-xl font-geist font-bold text-sm text-on-surface hover:bg-white/5 transition-colors active:scale-95 cursor-pointer"
            >
              Reset Workspace
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-8 py-3 bg-gradient-to-r from-primary to-emerald-500 text-on-primary rounded-xl font-geist font-bold text-sm hover:brightness-105 active:scale-95 transition-all disabled:opacity-50 border border-emerald-400/20 shadow-lg shadow-primary/10 cursor-pointer"
            >
              {isSaving ? 'Synchronizing...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </form>

      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#12161a] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="w-11 h-11 rounded-full bg-error/10 text-error flex items-center justify-center mb-4">
              <span className="material-symbols-outlined">restart_alt</span>
            </div>
            <h3 className="font-geist text-headline-md font-bold text-on-surface">Reset workspace?</h3>
            <p className="text-sm text-on-surface-variant/80 mt-2 leading-relaxed">
              This restores the demo menu, scripts, and settings stored in this browser.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="flex-1 px-4 py-3 border border-white/10 rounded-xl font-geist font-bold text-sm text-on-surface hover:bg-white/5 transition-colors active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetWorkspace}
                className="flex-1 px-4 py-3 bg-error text-on-error rounded-xl font-geist font-bold text-sm hover:brightness-105 active:scale-95 transition-all cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice preview waves keyframe animation */}
      <style>{`
        @keyframes pulseWave {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1.0); }
        }
      `}</style>
    </div>
  );
}
