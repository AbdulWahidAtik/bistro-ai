import React, { useState, useEffect } from 'react';
import { Script, ScriptCategory } from '../types';

interface ScriptsViewProps {
  scripts: Script[];
  onAddScript: (script: Script) => void;
  onUpdateScript: (script: Script) => void;
  onDeleteScript: (id: string) => void;
  globalSearchTerm?: string;
}

export default function ScriptsView({
  scripts,
  onAddScript,
  onUpdateScript,
  onDeleteScript,
  globalSearchTerm = ''
}: ScriptsViewProps) {
  const [selectedScriptId, setSelectedScriptId] = useState<string>(scripts[0]?.id || '');
  const [includeOffers, setIncludeOffers] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeDialogIndex, setActiveDialogIndex] = useState<number>(-1);
  const [copyState, setCopyState] = useState<boolean>(false);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [scriptPendingDelete, setScriptPendingDelete] = useState<Script | null>(null);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formCategory, setFormCategory] = useState<ScriptCategory>('STANDARD');
  const [formText, setFormText] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  // Interactive sandbox mock testing input
  const [sandboxQuery, setSandboxQuery] = useState<string>('');
  const [sandboxResponse, setSandboxResponse] = useState<string>('');

  const normalizedSearchTerm = globalSearchTerm.trim().toLowerCase();
  const visibleScripts = normalizedSearchTerm
    ? scripts.filter(script =>
        [
          script.title,
          script.description,
          script.category,
          script.text,
          script.lastUpdated,
        ].some(value => value.toLowerCase().includes(normalizedSearchTerm))
      )
    : scripts;
  const selectedScript =
    visibleScripts.find(s => s.id === selectedScriptId) ||
    visibleScripts[0] ||
    scripts.find(s => s.id === selectedScriptId) ||
    scripts[0];
  const scriptCategories: ScriptCategory[] = ['STANDARD', 'DYNAMIC', 'CAMPAIGN', 'INTERNAL'];

  useEffect(() => {
    if (!selectedScriptId && scripts[0]) {
      setSelectedScriptId(scripts[0].id);
    }
    if (selectedScriptId && scripts.length > 0 && !scripts.some(script => script.id === selectedScriptId)) {
      setSelectedScriptId(scripts[0].id);
    }
  }, [scripts, selectedScriptId]);

  // Dialog sequential player loop
  useEffect(() => {
    if (!isPlaying) {
      setActiveDialogIndex(-1);
      return;
    }

    const dialogueBlocks = selectedScript ? selectedScript.text.split('\n\n') : [];
    setActiveDialogIndex(0);

    let currentIndex = 0;
    const interval = setInterval(() => {
      currentIndex += 1;
      if (currentIndex >= dialogueBlocks.length) {
        setIsPlaying(false);
        setActiveDialogIndex(-1);
      } else {
        setActiveDialogIndex(currentIndex);
      }
    }, 2900); // dialogue transition speed

    return () => clearInterval(interval);
  }, [isPlaying, selectedScript]);

  const getRenderedSpeechText = () => {
    if (!selectedScript) return [];

    let text = selectedScript.text;
    const lines = text.split('\n\n');

    return lines.map((line, idx) => {
      // If playing, hide future dialogue bubbles
      if (isPlaying && idx > activeDialogIndex) {
        return (
          <div key={idx} className="opacity-15 pointer-events-none transition-all duration-500 py-2 border-b border-white/[0.02]">
            <p className="text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant mb-1">
              [Upcoming Dialogue Block]
            </p>
            <div className="h-6 bg-white/5 rounded-lg w-3/4"></div>
          </div>
        );
      }

      // Check current speaker bubble
      const isAI = line.startsWith('[AI]');
      const cleanText = line.replace(/^\[(AI|Wait|If|Finalizing)\]:?/, '').trim();
      const isActiveSpeaker = isPlaying && idx === activeDialogIndex;

      // Special offer injection logic
      const shouldInjectOffer = selectedScriptId === 'script-1' && includeOffers && idx === 2;

      if (isAI) {
        return (
          <div
            key={idx}
            className={`p-4.5 rounded-2xl transition-all duration-300 ${
              isActiveSpeaker
                ? 'bg-primary/10 border border-primary/30 shadow-[0_0_15px_rgba(74,225,118,0.08)] scale-[1.01]'
                : 'bg-white/[0.02] border border-white/[0.04]'
            } flex gap-4`}
          >
            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-geist font-bold text-xs ${isActiveSpeaker ? 'bg-primary text-on-primary animate-pulse' : 'bg-white/5 text-on-surface-variant'}`}>
              AI
            </div>
            <div className="space-y-2.5 flex-1 min-w-0">
              <p className="font-sans text-body-md text-on-surface leading-relaxed">
                {cleanText.includes('Bistro Prime') ? (
                  <span>
                    {cleanText.split('Bistro Prime')[0]}
                    <span className="bg-white/5 text-secondary px-1.5 py-0.5 rounded font-bold font-geist">Bistro Prime</span>
                    {cleanText.split('Bistro Prime')[1]}
                  </span>
                ) : cleanText.includes('Bistro') ? (
                  <span>
                    {cleanText.split('Bistro')[0]}
                    <span className="bg-white/5 text-secondary px-1.5 py-0.5 rounded font-bold font-geist">Bistro AI</span>
                    {cleanText.split('Bistro')[1]}
                  </span>
                ) : (
                  cleanText
                )}
              </p>

              {shouldInjectOffer && (
                <div className="bg-primary/10 border border-primary/20 text-primary py-2 px-3.5 rounded-xl font-geist font-bold text-xs flex items-center gap-2 animate-pulse mt-2">
                  <span className="material-symbols-outlined text-sm">campaign</span>
                  <span>[INJECTED PROMO]: &quot;Just to let you know, we are running our special Weekend brunch and bottomless mimosa promo tonight!&quot;</span>
                </div>
              )}
            </div>
          </div>
        );
      } else {
        // Customer / Conditional trigger prompt
        return (
          <div
            key={idx}
            className={`p-3.5 rounded-2xl border transition-all duration-300 ${
              isActiveSpeaker
                ? 'bg-secondary/15 border-secondary/35 text-secondary'
                : 'bg-white/[0.01] border-dashed border-white/[0.05] text-on-surface-variant/80'
            } flex gap-3`}
          >
            <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center bg-white/5 font-geist font-bold text-[10px] text-on-surface-variant">
              USR
            </div>
            <p className="font-sans text-xs font-semibold italic flex-1 self-center leading-relaxed">
              {line}
            </p>
          </div>
        );
      }
    });
  };

  const copyToClipboard = () => {
    if (!selectedScript) return;
    navigator.clipboard.writeText(selectedScript.text);
    setCopyState(true);
    setTimeout(() => setCopyState(false), 2000);
  };

  const resetForm = () => {
    setEditingScript(null);
    setFormTitle('');
    setFormDescription('');
    setFormCategory('STANDARD');
    setFormText('');
    setFormError('');
  };

  const openCreateEditor = () => {
    resetForm();
    setFormText(`[AI]: "Thank you for calling Bistro Prime. How can I help today?"

[Wait for User Response]

[AI]: "Absolutely. I can help with reservations, menu questions, operating hours, or takeout details."

[Finalizing]

[AI]: "You're all set. We look forward to seeing you at Bistro Prime."`);
    setIsEditorOpen(true);
  };

  const openEditEditor = () => {
    if (!selectedScript) return;
    setEditingScript(selectedScript);
    setFormTitle(selectedScript.title);
    setFormDescription(selectedScript.description);
    setFormCategory(selectedScript.category);
    setFormText(selectedScript.text);
    setFormError('');
    setIsEditorOpen(true);
  };

  const handleSaveScript = (event: React.FormEvent) => {
    event.preventDefault();

    if (!formTitle.trim() || !formDescription.trim() || !formText.trim()) {
      setFormError('Title, description, and script text are required.');
      return;
    }

    const savedScript: Script = {
      id: editingScript?.id || `script-${Date.now()}`,
      title: formTitle.trim(),
      description: formDescription.trim(),
      category: formCategory,
      text: formText.trim(),
      avatarText: editingScript?.avatarText || 'AI',
      lastUpdated: 'Updated just now',
      stats: editingScript?.stats || {
        successRate: 'Pending',
        avgDuration: 'Pending',
        intentAccuracy: 'Pending'
      }
    };

    if (editingScript) {
      onUpdateScript(savedScript);
    } else {
      onAddScript(savedScript);
      setSelectedScriptId(savedScript.id);
    }

    resetForm();
    setIsEditorOpen(false);
  };

  const downloadTranscript = () => {
    if (!selectedScript) return;
    const transcript = `${selectedScript.title}\n${selectedScript.description}\n\n${selectedScript.text}`;
    const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${selectedScript.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-transcript.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Mock Sandbox query handler
  const handleSandboxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sandboxQuery.trim()) return;
    
    // Simple mock logic parser
    const q = sandboxQuery.toLowerCase();
    if (q.includes('book') || q.includes('table') || q.includes('reservation')) {
      setSandboxResponse('Jamie: "I\'d be happy to help with that reservation! For what date and time would you like to join us?"');
    } else if (q.includes('burger') || q.includes('menu') || q.includes('food')) {
      setSandboxResponse('Jamie: "Our Signature Wagyu Burger is seared with truffle mayo. We can also accommodate gluten-free requests easily!"');
    } else {
      setSandboxResponse('Jamie: "Absolutely! I can help note special requests or confirm operating details. What else can I assist with?"');
    }
  };

  // Equalizer visual bars
  const eqBars = Array.from({ length: 15 });

  return (
    <div className="h-full flex flex-col lg:flex-row gap-gutter overflow-hidden animate-fadeIn">
      {/* SCRIPT LIST SIDEBAR */}
      <div className="w-full lg:w-[320px] flex flex-col gap-4 max-h-[80vh] lg:max-h-none overflow-y-auto pr-2 custom-scrollbar flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="font-geist text-headline-lg font-bold text-on-surface">Script Library</h2>
          <button
            onClick={openCreateEditor}
            type="button"
            className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-xl border border-white/[0.06] flex items-center justify-center text-primary transition-all active:scale-95 cursor-pointer"
            title="Create Custom Script Template"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
          </button>
        </div>

        <div className="space-y-3">
          {visibleScripts.map((script) => {
            const isActive = script.id === selectedScriptId;
            return (
              <button
                key={script.id}
                onClick={() => { setSelectedScriptId(script.id); setIsPlaying(false); }}
                type="button"
                className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 relative group active:scale-[0.99] cursor-pointer ${
                  isActive
                    ? 'border-primary/40 bg-primary/5 shadow-md shadow-primary/5'
                    : 'border-white/[0.04] bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.02]'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-primary rounded-r-full"></div>
                )}

                <div className="flex justify-between items-start gap-2">
                  <h3 className="font-geist font-bold text-sm text-on-surface truncate group-hover:text-primary transition-colors">
                    {script.title}
                  </h3>
                  <span className={`px-2 py-0.5 rounded font-geist font-bold text-[9px] uppercase tracking-wide border ${
                    script.category === 'STANDARD' ? 'bg-primary/10 text-primary border-primary/20' :
                    script.category === 'DYNAMIC' ? 'bg-secondary/10 text-secondary border-secondary/20' :
                    script.category === 'CAMPAIGN' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                    'bg-white/5 text-on-surface-variant border-white/10'
                  }`}>
                    {script.category}
                  </span>
                </div>
                
                <p className="font-sans text-xs text-on-surface-variant/70 mt-1 line-clamp-2 leading-relaxed">
                  {script.description}
                </p>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.04]">
                  <div className="flex items-center gap-1.5 text-on-surface-variant/60">
                    <span className="material-symbols-outlined text-xs">schedule</span>
                    <span className="text-[10px] font-medium">{script.lastUpdated}</span>
                  </div>

                  <div className="w-5 h-5 rounded-full bg-white/5 border border-white/[0.06] flex items-center justify-center text-[9px] font-bold text-on-surface">
                    {script.avatarText}
                  </div>
                </div>
              </button>
            );
          })}

          {visibleScripts.length === 0 && (
            <div className="p-5 rounded-2xl border border-white/[0.04] bg-white/[0.01] text-center">
              <p className="font-geist font-bold text-sm text-on-surface">No matching scripts</p>
              <p className="font-sans text-xs text-on-surface-variant/60 mt-1">
                Try another workspace search term.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* SCRIPT WORKBENCH PREVIEW & METRICS */}
      <div className="flex-1 flex flex-col gap-6 overflow-hidden min-w-0">
        {/* Workbench Header details */}
        <div className="glass-panel p-5 rounded-2xl border border-white/[0.04] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">chat_bubble_outline</span>
            </div>
            <div>
              <h3 className="font-geist text-headline-md font-bold text-on-surface">
                {selectedScript?.title}
              </h3>
              <p className="font-sans text-xs text-on-surface-variant/60 flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs text-primary">person_pin</span>
                  Friendly Professional Tone
                </span>
                <span className="opacity-20">|</span>
                <span>Voice identity: Jamie (balanced)</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openEditEditor}
              disabled={!selectedScript}
              className="h-9 w-9 bg-white/5 hover:bg-white/10 text-on-surface rounded-xl border border-white/[0.06] flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Edit selected script"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
            </button>
            <button
              type="button"
              onClick={() => selectedScript && setScriptPendingDelete(selectedScript)}
              disabled={!selectedScript}
              className="h-9 w-9 bg-white/5 hover:bg-error/10 text-on-surface hover:text-error rounded-xl border border-white/[0.06] flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Delete selected script"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
            <label className="flex items-center gap-3 bg-[#0b0e10] border border-white/[0.06] px-4 py-2 rounded-xl cursor-pointer hover:border-primary/50 transition-colors w-fit">
              <span className="text-[11px] font-geist font-bold text-on-surface-variant/80">
                Include Promos
              </span>
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={includeOffers}
                  onChange={(e) => setIncludeOffers(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-white/20 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary"></div>
              </div>
            </label>
          </div>
        </div>

        {/* Dynamic Transcripts Display */}
        <div className="flex-1 bg-white/[0.01] border border-white/[0.04] rounded-2xl p-6 flex flex-col justify-between overflow-hidden shadow-inner">
          <div className="flex-1 overflow-y-auto space-y-5 pr-2 custom-scrollbar">
            {selectedScript ? getRenderedSpeechText() : (
              <div className="h-full min-h-48 flex items-center justify-center text-center">
                <div>
                  <span className="material-symbols-outlined text-[36px] text-on-surface-variant/40">record_voice_over</span>
                  <p className="font-geist font-bold text-on-surface mt-2">Select a script from the library</p>
                </div>
              </div>
            )}
          </div>

          {/* Player controls */}
          <div className="mt-6 pt-5 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setIsPlaying(!isPlaying); }}
                type="button"
                className={`flex items-center gap-2 px-5 py-2.5 font-geist font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 border cursor-pointer ${
                  isPlaying
                    ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white border-red-400/20'
                    : 'bg-gradient-to-r from-primary to-emerald-500 text-on-primary border-emerald-400/20 hover:brightness-105 shadow-primary/10'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isPlaying ? 'stop_circle' : 'play_circle'}
                </span>
                {isPlaying ? 'Stop Playback' : 'Simulate Call Dialog'}
              </button>

              <button
                onClick={copyToClipboard}
                type="button"
                className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/[0.08] text-on-surface font-geist font-bold text-xs rounded-xl active:scale-95 transition-all border border-white/[0.06] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {copyState ? 'check' : 'content_copy'}
                </span>
                {copyState ? 'Copied!' : 'Copy Script'}
              </button>

              <button
                onClick={downloadTranscript}
                disabled={!selectedScript}
                type="button"
                className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/[0.08] text-on-surface font-geist font-bold text-xs rounded-xl active:scale-95 transition-all border border-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Download
              </button>
            </div>

            {/* Vocal simulation bounce visualizer */}
            {isPlaying && (
              <div className="flex items-center gap-2.5 text-primary">
                <span className="text-[10px] font-geist font-extrabold uppercase tracking-widest animate-pulse">
                  Jamie Speaking...
                </span>
                <div className="flex items-end gap-[3px] h-5">
                  {eqBars.map((_, i) => {
                    const rndDur = 0.4 + Math.random() * 0.7;
                    return (
                      <div
                        key={i}
                        style={{
                          animation: `bounce ${rndDur}s ease-in-out infinite alternate`
                        }}
                        className="w-[2.5px] bg-primary rounded-full h-full"
                      ></div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Operational sandbox & metric chips */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Mock Interactive Sandbox Testing Widget */}
          <div className="lg:col-span-2 glass-panel p-4 rounded-2xl border border-white/[0.04] flex flex-col justify-between gap-3 min-w-0">
            <div>
              <h4 className="font-geist text-xs font-extrabold text-on-surface uppercase tracking-wider">Dialogue Intent Sandbox</h4>
              <p className="font-sans text-[11px] text-on-surface-variant/60">Type a test question to verify script route matching.</p>
            </div>
            
            <form onSubmit={handleSandboxSubmit} className="flex gap-2">
              <input
                type="text"
                value={sandboxQuery}
                onChange={(e) => setSandboxQuery(e.target.value)}
                placeholder="e.g. Can I book a table for tomorrow?"
                className="flex-1 bg-[#0b0e10] border border-white/[0.06] rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-on-surface placeholder:text-on-surface-variant/30"
              />
              <button
                type="submit"
                className="px-3.5 bg-primary/10 border border-primary/20 text-primary font-geist font-bold text-xs rounded-xl hover:brightness-105 transition-colors cursor-pointer"
              >
                Test Match
              </button>
            </form>

            {sandboxResponse && (
              <div className="p-2.5 bg-white/[0.02] border border-white/[0.04] rounded-xl text-[11px] font-sans text-on-surface italic animate-fadeIn">
                {sandboxResponse}
              </div>
            )}
          </div>

          {/* Metric chips */}
          <div className="grid grid-cols-3 lg:grid-cols-1 gap-4">
            <div className="glass-card p-3 rounded-2xl border border-white/[0.04] flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[16px]">verified</span>
              </div>
              <div>
                <p className="text-[9px] text-on-surface-variant/60 font-medium uppercase tracking-wider">Success Rate</p>
                <h4 className="font-geist text-sm font-bold text-primary">{selectedScript?.stats.successRate}</h4>
              </div>
            </div>

            <div className="glass-card p-3 rounded-2xl border border-white/[0.04] flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[16px]">timelapse</span>
              </div>
              <div>
                <p className="text-[9px] text-on-surface-variant/60 font-medium uppercase tracking-wider">Avg. Duration</p>
                <h4 className="font-geist text-sm font-bold text-secondary">{selectedScript?.stats.avgDuration}</h4>
              </div>
            </div>

            <div className="glass-card p-3 rounded-2xl border border-white/[0.04] flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-on-surface">
                <span className="material-symbols-outlined text-[16px]">psychology</span>
              </div>
              <div>
                <p className="text-[9px] text-on-surface-variant/60 font-medium uppercase tracking-wider">Accuracy</p>
                <h4 className="font-geist text-sm font-bold text-on-surface">{selectedScript?.stats.intentAccuracy}</h4>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isEditorOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#12161a] border border-white/10 w-full max-w-2xl rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-geist text-headline-lg font-bold text-on-surface">
                {editingScript ? 'Edit Script' : 'Create Script'}
              </h3>
              <button
                onClick={() => { setIsEditorOpen(false); resetForm(); }}
                type="button"
                className="p-1.5 hover:bg-white/5 rounded-full text-on-surface-variant transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveScript} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">Script Title</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(event) => setFormTitle(event.target.value)}
                    placeholder="Reservation Intake"
                    className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-on-surface-variant/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">Category</label>
                  <select
                    value={formCategory}
                    onChange={(event) => setFormCategory(event.target.value as ScriptCategory)}
                    className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {scriptCategories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">Description</label>
                <input
                  type="text"
                  required
                  value={formDescription}
                  onChange={(event) => setFormDescription(event.target.value)}
                  placeholder="Handles incoming calls for table bookings and menu questions."
                  className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-on-surface-variant/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-geist font-bold uppercase tracking-wider text-on-surface-variant/80">Script Text</label>
                <textarea
                  rows={9}
                  required
                  value={formText}
                  onChange={(event) => setFormText(event.target.value)}
                  placeholder={'[AI]: "Thanks for calling..."'}
                  className="w-full bg-[#0b0e10] border border-white/[0.06] rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-on-surface-variant/30 font-mono leading-relaxed"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => { setIsEditorOpen(false); resetForm(); }}
                  className="flex-1 px-4 py-3 border border-white/10 rounded-xl font-geist font-bold text-sm text-on-surface hover:bg-white/5 transition-colors active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-primary to-emerald-500 text-on-primary rounded-xl font-geist font-bold text-sm hover:brightness-105 active:scale-95 transition-all shadow-lg shadow-primary/10 border border-emerald-400/20 cursor-pointer"
                >
                  {editingScript ? 'Save Script' : 'Create Script'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {scriptPendingDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#12161a] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="w-11 h-11 rounded-full bg-error/10 text-error flex items-center justify-center mb-4">
              <span className="material-symbols-outlined">delete</span>
            </div>
            <h3 className="font-geist text-headline-md font-bold text-on-surface">Delete script?</h3>
            <p className="text-sm text-on-surface-variant/80 mt-2 leading-relaxed">
              This will remove "{scriptPendingDelete.title}" from the script library.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setScriptPendingDelete(null)}
                className="flex-1 px-4 py-3 border border-white/10 rounded-xl font-geist font-bold text-sm text-on-surface hover:bg-white/5 transition-colors active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteScript(scriptPendingDelete.id);
                  setScriptPendingDelete(null);
                }}
                className="flex-1 px-4 py-3 bg-error text-on-error rounded-xl font-geist font-bold text-sm hover:brightness-105 active:scale-95 transition-all cursor-pointer"
              >
                Delete Script
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bounce keyframe */}
      <style>{`
        @keyframes bounce {
          0% { transform: scaleY(0.1); }
          100% { transform: scaleY(1.0); }
        }
      `}</style>
    </div>
  );
}
