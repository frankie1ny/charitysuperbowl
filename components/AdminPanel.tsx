
import React, { useState, useEffect } from 'react';
import { PoolSettings, GlobalSettings, Square, Pool, AppState } from '../types';

interface AdminPanelProps {
  activePoolId: string;
  poolSettings: PoolSettings;
  globalSettings: GlobalSettings;
  onUpdatePoolSettings: (updates: Partial<PoolSettings>) => void;
  onUpdateActivePool: (updates: Partial<Pool>) => void;
  onUpdateGlobalSettings: (updates: Partial<GlobalSettings>) => void;
  onResetGrid: () => void;
  onDeletePool: (id: string) => void;
  onGenerateNumbers: () => void;
  squares: Square[];
  pools: Pool[];
  onSwitchPool: (id: string) => void;
  onCreatePool: (name: string, inherit: boolean) => void;
  fullState: AppState;
  onImportState: (state: AppState) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  activePoolId,
  poolSettings, 
  globalSettings,
  onUpdatePoolSettings, 
  onUpdateActivePool,
  onUpdateGlobalSettings,
  onResetGrid, 
  onDeletePool,
  onGenerateNumbers,
  squares,
  pools,
  onSwitchPool,
  onCreatePool,
  fullState,
  onImportState
}) => {
  const [newPoolName, setNewPoolName] = useState('');
  const [inheritSettings, setInheritSettings] = useState(true);
  const [renamedValue, setRenamedValue] = useState('');
  
  const activePool = pools.find(p => p.id === activePoolId);

  useEffect(() => {
    if (activePool) setRenamedValue(activePool.name);
  }, [activePoolId, activePool]);

  const handleAxisNumberChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'row' | 'col', index: number) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    const num = value === '' ? NaN : parseInt(value, 10);
    const key = type === 'row' ? 'rowNumbers' : 'colNumbers';
    const current = [...(poolSettings[key] || Array(10).fill(null))];
    current[index] = isNaN(num) ? null as any : num;
    onUpdatePoolSettings({ [key]: current });
    if (value !== '' && index < 9) {
      const inputs = e.target.parentElement?.querySelectorAll('input');
      (inputs?.[index + 1] as HTMLInputElement)?.focus();
    }
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullState));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "superbowl_charity_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        if (window.confirm("Overwrite current data with this backup?")) {
          onImportState(json);
        }
      } catch (err) {
        alert("Invalid backup file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-12 max-w-4xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
      
      {/* DEPLOYMENT GUIDE SECTION */}
      <section className="bg-white border-4 border-indigo-600 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <i className="fab fa-github text-9xl"></i>
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 relative z-10">
           <div className="flex items-center gap-4">
              <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg">
                <i className="fas fa-rocket"></i>
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">GitHub Deployment Guide</h2>
                <p className="text-sm text-gray-500">Host your board for free with GitHub Pages</p>
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
          <div className="bg-gray-50 p-8 rounded-[2.5rem] border border-gray-100 space-y-4">
            <h4 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest mb-2">Setup Steps</h4>
            <ol className="text-xs text-gray-600 space-y-3 list-decimal ml-4 font-medium">
              <li>Create a new repository on <span className="font-bold text-indigo-900">GitHub.com</span>.</li>
              <li>Push your project code to the <span className="font-bold">main</span> branch.</li>
              <li>Go to <span className="italic">Settings &gt; Pages</span>.</li>
              <li>Select <span className="font-bold">Deploy from a branch</span> and choose <span className="font-bold">main</span>.</li>
              <li>Your site will be live at <span className="text-indigo-600 underline">your-user.github.io/repo-name</span>!</li>
            </ol>
          </div>
          <div className="bg-indigo-50 p-8 rounded-[2.5rem] border border-indigo-100 flex flex-col justify-center">
             <h4 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest mb-4">Local Backups</h4>
             <p className="text-[10px] text-indigo-400 font-bold leading-relaxed mb-6">
               Since cloud sync is disabled, use these buttons to manually save your data.
             </p>
             <div className="flex flex-col gap-3">
               <button onClick={handleExport} className="w-full bg-indigo-900 text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2">
                 <i className="fas fa-file-export"></i> Export Backup
               </button>
               <label className="w-full bg-white border-2 border-indigo-900 text-indigo-900 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 cursor-pointer text-center">
                 <i className="fas fa-file-import"></i> Import Backup
                 <input type="file" accept=".json" onChange={handleImport} className="hidden" />
               </label>
             </div>
          </div>
        </div>
      </section>

      {/* CONTEST SETTINGS */}
      <section className="bg-white border-2 border-indigo-50 p-10 rounded-[3rem] shadow-sm">
        <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight mb-10 flex items-center gap-4">
          <i className="fas fa-cog text-indigo-600"></i>
          Active Contest Configuration
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          <div>
            <label className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-2 block">Cost Per Box ($)</label>
            <input 
              type="number" 
              value={poolSettings.costPerBox} 
              onChange={(e) => onUpdatePoolSettings({ costPerBox: Number(e.target.value) })} 
              className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-indigo-500 font-black text-indigo-900 text-xl" 
            />
          </div>
          <div>
            <label className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-2 block">Team A</label>
            <input type="text" value={poolSettings.teamA} onChange={(e) => onUpdatePoolSettings({ teamA: e.target.value })} className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-indigo-500 font-bold" />
          </div>
          <div>
            <label className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-2 block">Team B</label>
            <input type="text" value={poolSettings.teamB} onChange={(e) => onUpdatePoolSettings({ teamB: e.target.value })} className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-indigo-500 font-bold" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 pt-8 border-t border-gray-100">
           <div>
            <label className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-2 block">Charity Name</label>
            <input type="text" value={globalSettings.charityName} onChange={(e) => onUpdateGlobalSettings({ charityName: e.target.value })} className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-indigo-500 font-bold" />
          </div>
          <div>
            <label className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-2 block">Venmo Handle</label>
            <input type="text" value={globalSettings.venmoAccount} onChange={(e) => onUpdateGlobalSettings({ venmoAccount: e.target.value })} className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-indigo-500 font-bold" placeholder="@username" />
          </div>
        </div>

        <div className="space-y-8 pt-8 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-indigo-900 uppercase tracking-widest">Score Axes</h3>
            <button onClick={onGenerateNumbers} className="bg-indigo-900 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase">Randomize numbers</button>
          </div>
          <AxisRow title={poolSettings.teamA} type="row" values={poolSettings.rowNumbers} onChange={handleAxisNumberChange} />
          <AxisRow title={poolSettings.teamB} type="col" values={poolSettings.colNumbers} onChange={handleAxisNumberChange} />
        </div>
      </section>

      {/* BOARDS LIST */}
      <section className="bg-indigo-950 p-10 rounded-[4rem] text-white">
        <h3 className="text-2xl font-black uppercase tracking-tight mb-8">Board Library</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {pools.map(p => (
            <div 
              key={p.id}
              onClick={() => onSwitchPool(p.id)}
              className={`p-6 rounded-3xl border-2 transition-all cursor-pointer ${p.id === activePoolId ? 'border-indigo-500 bg-indigo-900' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
            >
              <div className="flex justify-between items-center mb-4">
                <span className="font-black text-lg">{p.name}</span>
                <span className="text-[10px] font-black bg-white/10 px-2 py-1 rounded-lg uppercase tracking-widest">${p.settings.costPerBox}/box</span>
              </div>
              <p className="text-[10px] text-indigo-300 font-bold uppercase">{p.settings.teamA} vs {p.settings.teamB}</p>
            </div>
          ))}
          <form onSubmit={(e) => {
            e.preventDefault();
            if (newPoolName.trim()) { onCreatePool(newPoolName, inheritSettings); setNewPoolName(''); }
          }} className="p-6 rounded-3xl border-2 border-dashed border-white/20 flex flex-col gap-4">
            <input required value={newPoolName} onChange={e => setNewPoolName(e.target.value)} placeholder="New Board Name..." className="bg-transparent border-b-2 border-white/20 outline-none p-2 font-bold text-sm" />
            <button className="bg-white text-indigo-900 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest">Add New Board</button>
          </form>
        </div>
      </section>
    </div>
  );
};

const AxisRow = ({ title, type, values, onChange }: any) => (
  <div className="space-y-3">
    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{title} Labels</label>
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {Array.from({ length: 10 }).map((_, i) => (
        <input
          key={i}
          type="text"
          maxLength={1}
          value={values[i] ?? ''}
          onChange={(e) => onChange(e, type, i)}
          className="w-11 h-11 flex-shrink-0 text-center bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-indigo-500 font-black text-indigo-900"
        />
      ))}
    </div>
  </div>
);

export default AdminPanel;