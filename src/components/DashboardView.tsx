import React, { useState } from 'react';
import { downloadOperationsReport as downloadBackendOperationsReport } from '../api';
import { ActivityLog, CallTrend, DashboardAnalytics, MenuItem, Script } from '../types';

interface DashboardViewProps {
  activityLogs: ActivityLog[];
  menuItems: MenuItem[];
  scripts: Script[];
  analytics: DashboardAnalytics | null;
  isAnalyticsRefreshing: boolean;
  onChangeTab: (tab: string) => void;
  onGenerateScriptQuick: () => void | Promise<void>;
  onRefreshAnalytics: () => void | Promise<void>;
  onNotify: (message: string) => void;
}

export default function DashboardView({
  activityLogs,
  menuItems,
  scripts,
  analytics,
  isAnalyticsRefreshing,
  onChangeTab,
  onGenerateScriptQuick,
  onRefreshAnalytics,
  onNotify
}: DashboardViewProps) {
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [chartDayCount, setChartDayCount] = useState<7 | 30>(7);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const localSuccessfulCalls = activityLogs.filter(log => log.status === 'SUCCESS').length;
  const totalCallsHandled = analytics?.totalCallsHandled ?? activityLogs.length;
  const successfulCalls = analytics?.successfulCalls ?? localSuccessfulCalls;
  const activeOffers = analytics?.activeOffers ?? menuItems.filter(item => item.isSpecial && item.status === 'active').length;
  const inactiveSpecials = analytics?.inactiveSpecials ?? menuItems.filter(item => item.isSpecial && item.status === 'inactive').length;
  const lastScript = scripts[0];
  const totalCallProgress = Math.min(100, Math.max(8, totalCallsHandled * 18));
  const successRate = analytics?.successRate ?? (totalCallsHandled > 0
    ? Math.round((successfulCalls / totalCallsHandled) * 100)
    : 0);

  const fallbackVolumeData: CallTrend[] = activityLogs.length > 0
    ? activityLogs.slice(0, chartDayCount === 7 ? 7 : 10).map((log, index) => ({
        day: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'][index % 7],
        val: Math.max(10, log.status === 'SUCCESS' ? 85 - index * 5 : 55 - index * 3),
        count: log.status === 'SUCCESS' ? 2 : 1,
      }))
    : [
        { day: 'MON', val: 8, count: 0 },
        { day: 'TUE', val: 8, count: 0 },
        { day: 'WED', val: 8, count: 0 },
        { day: 'THU', val: 8, count: 0 },
        { day: 'FRI', val: 8, count: 0 },
        { day: 'SAT', val: 8, count: 0 },
        { day: 'SUN', val: 8, count: 0 },
      ];
  const volumeData = chartDayCount === 30
    ? analytics?.volumeTrend30d ?? fallbackVolumeData
    : analytics?.volumeTrend7d ?? fallbackVolumeData;

  const simulateScriptGeneration = () => {
    setIsGenerating(true);
    setTimeout(() => {
      Promise.resolve(onGenerateScriptQuick())
        .finally(() => setIsGenerating(false));
    }, 1500);
  };

  const downloadFallbackOperationsReport = () => {
    const reportLines = [
      'Bistro AI Operations Report',
      `Generated: ${new Date().toLocaleString()}`,
      '',
      'Recent Activity',
      ...activityLogs.map(log => `${log.time} - ${log.title} - ${log.detail} - ${log.status} - ${log.duration}`)
    ];
    const blob = new Blob([reportLines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'bistro-ai-operations-report.txt';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const downloadOperationsReport = async () => {
    try {
      const { blob, filename } = await downloadBackendOperationsReport();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      downloadFallbackOperationsReport();
    }
    onNotify('Operations report downloaded.');
  };

  // Custom SVG Chart calculations
  const svgWidth = 600;
  const svgHeight = 180;
  
  const chartPoints = volumeData.map((d, index) => {
    const val = chartDayCount === 30 ? d.val * 0.8 : d.val;
    const x = (index / (volumeData.length - 1)) * svgWidth;
    // scale y value (y=0 is top, y=svgHeight is bottom)
    const y = svgHeight - (val / 100) * (svgHeight - 40) - 10;
    return { x, y, day: d.day, count: d.count };
  });

  const areaPath = chartPoints.length > 0
    ? `${chartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} L ${chartPoints[chartPoints.length - 1].x} ${svgHeight} L ${chartPoints[0].x} ${svgHeight} Z`
    : '';

  const linePath = chartPoints.length > 0
    ? chartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    : '';

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Overview Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div>
          <h2 className="font-geist text-headline-xl font-extrabold bg-gradient-to-r from-white to-on-surface-variant bg-clip-text text-transparent tracking-tight leading-tight">
            Operations Dashboard
          </h2>
          <p className="font-sans text-body-md text-on-surface-variant/70 mt-1">
            Real-time conversational performance, telemetry, and script operations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={simulateScriptGeneration}
            disabled={isGenerating}
            type="button"
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-emerald-500 text-on-primary font-geist font-bold text-sm rounded-xl hover:brightness-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/10 border border-emerald-400/20"
          >
            <span className="material-symbols-outlined text-[18px]">
              {isGenerating ? 'sync' : 'add'}
            </span>
            {isGenerating ? 'Synthesizing...' : 'Generate AI Script'}
          </button>
          
          <button
            onClick={() => onChangeTab('menu')}
            type="button"
            className="flex items-center gap-2 px-5 py-2.5 border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] text-on-surface font-geist font-bold text-sm rounded-xl active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[18px] text-secondary">
              campaign
            </span>
            Review Offers
          </button>

          <button
            onClick={onRefreshAnalytics}
            disabled={isAnalyticsRefreshing}
            type="button"
            className="p-2.5 border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] text-on-surface rounded-xl active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh Analytics"
          >
            <span className={`material-symbols-outlined text-[20px] ${isAnalyticsRefreshing ? 'animate-spin' : ''}`}>
              sync
            </span>
          </button>

          <button
            onClick={downloadOperationsReport}
            type="button"
            className="p-2.5 border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] text-on-surface rounded-xl active:scale-95 transition-all flex items-center justify-center"
            title="Download Operations Report"
          >
            <span className="material-symbols-outlined text-[20px]">download</span>
          </button>
        </div>
      </div>

      {/* Bento Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        {/* Total Calls */}
        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group shadow-md border border-white/[0.04]">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-primary/10 rounded-xl text-primary">
              <span className="material-symbols-outlined">call</span>
            </div>
            <span className="text-primary font-geist font-bold text-xs bg-primary/10 px-2.5 py-1 rounded-lg">
              {successRate}% success
            </span>
          </div>
          <p className="text-on-surface-variant/80 font-geist font-medium text-xs uppercase tracking-wider mb-1">
            Total Calls Handled
          </p>
          <h3 className="font-geist text-headline-xl font-bold text-on-surface">{totalCallsHandled}</h3>
          <div className="absolute bottom-0 left-0 w-full h-[4px] bg-white/[0.04]">
            <div
              className="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-r-full transition-all duration-500"
              style={{ width: `${totalCallProgress}%` }}
            ></div>
          </div>
        </div>

        {/* Active Offers */}
        <div className="glass-card p-6 rounded-2xl relative overflow-hidden shadow-md border border-white/[0.04]">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-secondary/10 rounded-xl text-secondary">
              <span className="material-symbols-outlined">local_offer</span>
            </div>
            <div className="flex items-center gap-1.5 bg-primary/10 text-primary text-[10px] uppercase font-bold py-0.5 px-2.5 rounded-full border border-primary/20">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-ping"></span>
              Live Tracking
            </div>
          </div>
          <p className="text-on-surface-variant/80 font-geist font-medium text-xs uppercase tracking-wider mb-1">
            Active Special Offers
          </p>
          <h3 className="font-geist text-headline-xl font-bold text-on-surface">{activeOffers}</h3>
          <p className="font-sans text-[11px] text-on-surface-variant/60 mt-2">
            {inactiveSpecials > 0
              ? `${inactiveSpecials} special offer${inactiveSpecials === 1 ? '' : 's'} currently inactive`
              : 'All special offers are live in the AI menu'}
          </p>
        </div>

        {/* Last AI Script */}
        <div className="glass-card p-6 rounded-2xl relative overflow-hidden shadow-md border border-white/[0.04]">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-white/5 rounded-xl text-on-surface">
              <span className="material-symbols-outlined">description</span>
            </div>
          </div>
          <p className="text-on-surface-variant/80 font-geist font-medium text-xs uppercase tracking-wider mb-1">
            Last AI Script Generated
          </p>
          <h3 className="font-geist text-[21px] font-bold text-on-surface mt-1.5 leading-snug">
            {lastScript?.lastUpdated || 'No scripts yet'}
          </h3>
          {lastScript && (
            <p className="font-sans text-[11px] text-on-surface-variant/60 mt-1 truncate" title={lastScript.title}>
              {lastScript.title}
            </p>
          )}
          <button
            onClick={() => onChangeTab('scripts')}
            type="button"
            className="mt-3 text-primary font-geist font-semibold text-xs flex items-center gap-1 hover:underline cursor-pointer group"
          >
            Review Changes
            <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">
              arrow_forward
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        {/* Left Col: Call Volume Trends Chart */}
        <div className="lg:col-span-2 glass-panel border border-white/[0.04] rounded-2xl p-6 flex flex-col justify-between shadow-md relative">
          <div className="flex justify-between items-center sm:items-start mb-6">
            <div>
              <h4 className="font-geist text-headline-md font-bold text-on-surface">
                Call Volume Trends
              </h4>
              <p className="font-sans text-body-sm text-on-surface-variant/60 mt-0.5">
                Peak caller hours and concurrent voice agent load
              </p>
            </div>
            
            <div className="flex items-center bg-white/5 rounded-lg p-1 border border-white/[0.06]">
              <button
                onClick={() => setChartDayCount(7)}
                type="button"
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  chartDayCount === 7
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant/80 hover:text-on-surface'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setChartDayCount(30)}
                type="button"
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  chartDayCount === 30
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant/80 hover:text-on-surface'
                }`}
              >
                30 Days
              </button>
            </div>
          </div>

          {/* Custom Interactive SVG Line Chart */}
          <div className="relative h-64 w-full flex flex-col justify-center items-center">
            {hoveredBarIndex !== null && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-[#12161a] border border-white/10 text-xs font-sans text-on-surface py-2 px-3.5 rounded-xl shadow-xl z-20 flex flex-col items-center gap-0.5 animate-fadeIn">
                <span className="font-bold text-primary">{chartPoints[hoveredBarIndex].count} calls</span>
                <span className="text-[10px] text-on-surface-variant/70 uppercase font-geist">{chartPoints[hoveredBarIndex].day} volume</span>
              </div>
            )}

            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4ae176" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#4ae176" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Gridlines */}
              <line x1="0" y1="10" x2={svgWidth} y2="10" stroke="rgba(255,255,255,0.03)" strokeDasharray="3,3" />
              <line x1="0" y1={svgHeight / 2} x2={svgWidth} y2={svgHeight / 2} stroke="rgba(255,255,255,0.03)" strokeDasharray="3,3" />
              <line x1="0" y1={svgHeight - 10} x2={svgWidth} y2={svgHeight - 10} stroke="rgba(255,255,255,0.05)" />

              {/* Area path */}
              <path d={areaPath} fill="url(#chart-gradient)" />

              {/* Line path */}
              <path d={linePath} fill="none" stroke="#4ae176" strokeWidth="2.5" strokeLinecap="round" />

              {/* Interactive circles and hover targets */}
              {chartPoints.map((p, idx) => (
                <g key={idx}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={hoveredBarIndex === idx ? 5.5 : 4}
                    fill={hoveredBarIndex === idx ? '#4ae176' : '#12161a'}
                    stroke="#4ae176"
                    strokeWidth={hoveredBarIndex === idx ? 2 : 1.5}
                    className="transition-all duration-150"
                  />
                  {/* Larger transparent hover capture area */}
                  <rect
                    x={p.x - 20}
                    y={0}
                    width={40}
                    height={svgHeight}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredBarIndex(idx)}
                    onMouseLeave={() => setHoveredBarIndex(null)}
                  />
                </g>
              ))}
            </svg>
          </div>

          {/* X Axis days */}
          <div className="flex justify-between mt-3 text-[10px] text-on-surface-variant/60 font-geist font-bold tracking-wider px-1">
            {volumeData.map((d, index) => (
              <span key={index} className={index === 4 ? 'text-primary' : ''}>
                {d.day}
              </span>
            ))}
          </div>
        </div>

        {/* Right Col: Recent Operational Activity */}
        <div className="glass-panel border border-white/[0.04] rounded-2xl p-6 flex flex-col justify-between shadow-md">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-geist text-headline-md font-bold text-on-surface">Recent Activity</h4>
            <span className="material-symbols-outlined text-on-surface-variant/80 cursor-help" title="Operations continuous log feed">
              info
            </span>
          </div>

          <div className="space-y-3.5 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
            {activityLogs.length > 0 ? activityLogs.map((log) => (
              <div
                key={log.id}
                className={`flex items-center gap-3.5 p-3 rounded-xl transition-all duration-200 hover:bg-white/[0.03] border-l-3 ${
                  log.status === 'SUCCESS' ? 'border-primary' : 'border-white/10'
                } bg-white/[0.01]`}
              >
                {/* Icon wrapper */}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center ${
                    log.status === 'SUCCESS'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-white/5 text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {log.type === 'reservation' && 'check_circle'}
                    {log.type === 'inquiry' && 'phone_callback'}
                    {log.type === 'change' && 'history'}
                    {log.type === 'takeout' && 'lunch_dining'}
                    {log.type === 'general' && 'help_outline'}
                  </span>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="font-geist font-semibold text-xs text-on-surface truncate">
                    {log.title}
                  </p>
                  <p className="font-sans text-[11px] text-on-surface-variant/60 truncate mt-0.5" title={log.detail}>
                    {log.detail}
                  </p>
                </div>

                {/* Performance stats right-aligned */}
                <div className="text-right flex-shrink-0">
                  <p className="font-geist font-semibold text-xs text-on-surface">
                    {log.duration}
                  </p>
                  <p className="text-[9px] text-on-surface-variant/60 uppercase font-bold mt-0.5">
                    {log.status === 'SUCCESS' ? 'SUCCESS' : 'HANDLED'}
                  </p>
                </div>
              </div>
            )) : (
              <div className="py-12 text-center text-on-surface-variant/60 font-sans text-xs">
                No recent activity matches the workspace search.
              </div>
            )}
          </div>

          <button
            onClick={() => onNotify('Full log archive will sync once the backend activity API is connected.')}
            type="button"
            className="w-full mt-4 pt-4 text-center border-t border-white/[0.06] text-xs font-geist font-bold text-on-surface-variant/60 hover:text-on-surface transition-colors"
          >
            View All Transactions & Logs (SQLite/Firestore Required)
          </button>
        </div>
      </div>
    </div>
  );
}
