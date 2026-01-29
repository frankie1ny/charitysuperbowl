
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppState, Square, Tab, Participant, PaymentTransaction, Pool, GlobalSettings, PoolSettings } from './types';
import Grid from './components/Grid';
import AdminPanel from './components/AdminPanel';
import Stats from './components/Stats';
import EntryModal from './components/EntryModal';
import ShareModal from './components/ShareModal';
import AIAssistant from './components/AIAssistant';

const STORAGE_KEY = 'superbowl_squares_multi_v4';

const createNewSquares = (): Square[] => Array.from({ length: 100 }, (_, i) => ({
  id: i,
  row: Math.floor(i / 10),
  col: i % 10,
  participantId: null,
  alias: '',
  paidAmount: 0,
  assigned: false,
}));

const DEFAULT_POOL_SETTINGS: PoolSettings = {
  teamA: 'NFC Champions',
  teamB: 'AFC Champions',
  costPerBox: 10,
  rowNumbers: [],
  colNumbers: [],
  isLocked: false,
};

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  adminPassword: 'admin',
  charityName: 'Local Food Bank',
  zelleAccount: '',
  paypalAccount: '',
  venmoAccount: '',
};

const createPool = (name: string, settings: PoolSettings = DEFAULT_POOL_SETTINGS): Pool => ({
  id: crypto.randomUUID(),
  name,
  squares: createNewSquares(),
  participants: [],
  settings: { ...settings, isLocked: false, rowNumbers: [], colNumbers: [] },
  createdAt: Date.now(),
});

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const params = new URLSearchParams(window.location.search);
    const importData = params.get('data');
    if (importData) {
      try {
        const decoded = JSON.parse(atob(importData));
        window.history.replaceState({}, document.title, window.location.pathname);
        return decoded;
      } catch (e) {
        console.error("Failed to parse import data from URL", e);
      }
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse storage", e);
      }
    }

    const initialPool = createPool('Super Bowl LIX');
    return { 
      pools: [initialPool], 
      activePoolId: initialPool.id,
      globalSettings: DEFAULT_GLOBAL_SETTINGS 
    };
  });

  const [activeTab, setActiveTab] = useState<Tab>('grid');
  const [selectedSquareId, setSelectedSquareId] = useState<number | null>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const activePool = useMemo(() => 
    state.pools.find(p => p.id === state.activePoolId) || state.pools[0],
    [state.pools, state.activePoolId]
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const updateActivePool = useCallback((updates: Partial<Pool>) => {
    setState(prev => ({
      ...prev,
      pools: prev.pools.map(p => p.id === prev.activePoolId ? { ...p, ...updates } : p)
    }));
  }, []);

  const updatePoolSettings = useCallback((newSettings: Partial<PoolSettings>) => {
    setState(prev => {
      const pool = prev.pools.find(p => p.id === prev.activePoolId);
      if (!pool) return prev;
      return {
        ...prev,
        pools: prev.pools.map(p => p.id === prev.activePoolId ? { ...p, settings: { ...p.settings, ...newSettings } } : p)
      };
    });
  }, []);

  const updateGlobalSettings = useCallback((newSettings: Partial<GlobalSettings>) => {
    setState(prev => ({
      ...prev,
      globalSettings: { ...prev.globalSettings, ...newSettings }
    }));
  }, []);

  const handleEntrySubmit = (data: Omit<Participant, 'id'>) => {
    if (selectedSquareId === null) return;
    
    setState(prev => {
      const pool = prev.pools.find(p => p.id === prev.activePoolId);
      if (!pool) return prev;

      let participant = pool.participants.find(p => p.email.toLowerCase() === data.email.toLowerCase());
      const newParticipants = [...pool.participants];
      
      if (!participant) {
        participant = { ...data, id: crypto.randomUUID(), paymentHistory: [] };
        newParticipants.push(participant);
      } else {
        const index = newParticipants.findIndex(p => p.id === participant!.id);
        newParticipants[index] = { ...participant, ...data };
      }

      const newSquares = pool.squares.map(sq => 
        sq.id === selectedSquareId 
          ? { ...sq, participantId: participant!.id, alias: data.alias, assigned: true } 
          : sq
      );

      return {
        ...prev,
        pools: prev.pools.map(p => p.id === pool.id ? { ...p, participants: newParticipants, squares: newSquares } : p)
      };
    });
  };

  const applyPaymentToParticipant = useCallback((participantId: string, amountToAdd: number, method: string = 'Cash', notes: string = '') => {
    setState(prev => {
      const pool = prev.pools.find(p => p.id === prev.activePoolId);
      if (!pool) return prev;

      let remaining = amountToAdd;
      const updatedSquares = pool.squares.map(sq => {
        if (sq.participantId !== participantId || remaining <= 0) return sq;
        const unpaidAmount = pool.settings.costPerBox - sq.paidAmount;
        if (unpaidAmount <= 0) return sq;
        const paymentForThisBox = Math.min(remaining, unpaidAmount);
        remaining -= paymentForThisBox;
        return { ...sq, paidAmount: sq.paidAmount + paymentForThisBox, paymentMethod: method };
      });

      const transaction: PaymentTransaction = {
        id: crypto.randomUUID(),
        amount: amountToAdd,
        method,
        timestamp: Date.now(),
        notes: notes || undefined
      };

      const updatedParticipants = pool.participants.map(p => {
        if (p.id === participantId) {
          return { ...p, paymentHistory: [...(p.paymentHistory || []), transaction] };
        }
        return p;
      });

      return {
        ...prev,
        pools: prev.pools.map(p => p.id === pool.id ? { ...p, squares: updatedSquares, participants: updatedParticipants } : p)
      };
    });
  }, []);

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gray-50/50 selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-indigo-900 text-white p-6 shadow-2xl sticky top-0 z-50 border-b border-indigo-800 backdrop-blur-md bg-indigo-900/90">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-white p-2.5 rounded-2xl shadow-inner rotate-3 group cursor-pointer hover:rotate-0 transition-transform">
              <i className="fas fa-football-ball text-indigo-900 text-2xl group-hover:scale-110 transition-transform"></i>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black tracking-tight uppercase leading-none">Charity Bowl</h1>
                <select 
                  value={state.activePoolId}
                  onChange={(e) => setState(prev => ({ ...prev, activePoolId: e.target.value }))}
                  className="bg-indigo-800 text-indigo-100 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border border-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                >
                  {state.pools.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <p className="text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em] leading-none mt-1.5">{state.globalSettings.charityName}</p>
            </div>
          </div>
          
          <nav className="flex items-center gap-3">
            <div className="flex bg-black/20 rounded-2xl p-1.5 backdrop-blur-md border border-white/10">
              {(['grid', 'roster', 'admin'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    if (tab === 'grid') setIsAdminAuthenticated(false);
                  }}
                  className={`px-6 py-2.5 rounded-xl capitalize font-black text-xs tracking-widest transition-all duration-300 flex items-center gap-2 ${
                    activeTab === tab 
                      ? 'bg-white text-indigo-900 shadow-xl scale-105' 
                      : 'text-indigo-100 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {tab === 'roster' ? 'Finance' : tab}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setIsShareModalOpen(true)}
              className="bg-green-500 hover:bg-green-400 text-white w-11 h-11 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-95 shadow-green-900/20"
              title="Share Board"
            >
              <i className="fas fa-share-nodes text-sm"></i>
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full p-4 md:p-8">
        <div className="bg-white rounded-[3.5rem] shadow-2xl p-6 md:p-12 border border-gray-100 min-h-[600px] relative overflow-hidden">
          {activeTab === 'grid' && (
            <Grid 
              squares={activePool.squares} 
              settings={{ ...state.globalSettings, ...activePool.settings }} 
              onSquareClick={(id) => {
                if (activePool.settings.isLocked) return;
                setSelectedSquareId(id);
              }}
            />
          )}

          {(activeTab === 'admin' || activeTab === 'roster') && (
            !isAdminAuthenticated ? (
              <div className="flex flex-col items-center justify-center py-24 animate-in fade-in zoom-in-95">
                <div className="bg-indigo-50 p-8 rounded-full mb-8 relative">
                   <i className="fas fa-shield-alt text-indigo-600 text-5xl"></i>
                   <div className="absolute -top-2 -right-2 bg-indigo-900 text-white w-8 h-8 rounded-full flex items-center justify-center border-4 border-white">
                     <i className="fas fa-key text-[10px]"></i>
                   </div>
                </div>
                <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tight mb-3">Admin Access</h2>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (passwordInput === (state.globalSettings.adminPassword || 'admin')) {
                    setIsAdminAuthenticated(true);
                    setPasswordError(false);
                    setPasswordInput('');
                  } else {
                    setPasswordError(true);
                    setPasswordInput('');
                  }
                }} className="w-full max-sm space-y-4">
                  <input
                    type="password"
                    autoFocus
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter admin password..."
                    className={`w-full px-8 py-5 bg-gray-50 border-2 rounded-3xl outline-none transition-all font-black text-center text-indigo-900 tracking-[0.3em] ${passwordError ? 'border-red-500 bg-red-50' : 'border-gray-100 focus:border-indigo-500'}`}
                  />
                  <button type="submit" className="w-full bg-indigo-900 text-white py-5 rounded-3xl font-black uppercase tracking-[0.2em] text-xs hover:bg-black transition-all shadow-2xl active:scale-95">
                    Unlock Section
                  </button>
                </form>
              </div>
            ) : (
              activeTab === 'admin' ? (
                <AdminPanel 
                  activePoolId={state.activePoolId}
                  poolSettings={activePool.settings} 
                  globalSettings={state.globalSettings}
                  onUpdatePoolSettings={updatePoolSettings}
                  onUpdateActivePool={updateActivePool}
                  onUpdateGlobalSettings={updateGlobalSettings}
                  onResetGrid={() => updateActivePool({ squares: createNewSquares(), participants: [] })}
                  onDeletePool={(id) => {
                     const newPools = state.pools.filter(p => p.id !== id);
                     const newActiveId = id === state.activePoolId ? newPools[0].id : state.activePoolId;
                     setState(prev => ({ ...prev, pools: newPools, activePoolId: newActiveId }));
                  }}
                  onGenerateNumbers={() => {
                    const shuffle = () => Array.from({ length: 10 }, (_, i) => i).sort(() => Math.random() - 0.5);
                    updatePoolSettings({ rowNumbers: shuffle(), colNumbers: shuffle() });
                  }}
                  squares={activePool.squares}
                  pools={state.pools}
                  onSwitchPool={(id) => setState(prev => ({ ...prev, activePoolId: id }))}
                  onCreatePool={(name, inherit) => {
                    const nextPool = createPool(name, inherit ? activePool.settings : DEFAULT_POOL_SETTINGS);
                    setState(prev => ({ ...prev, pools: [...prev.pools, nextPool], activePoolId: nextPool.id }));
                  }}
                  fullState={state}
                  onImportState={(newState) => {
                    setState(newState);
                    setIsAdminAuthenticated(false);
                  }}
                />
              ) : (
                <Stats 
                  squares={activePool.squares} 
                  participants={activePool.participants}
                  settings={{ ...state.globalSettings, ...activePool.settings }}
                  onUpdateSquare={(id, updates) => updateActivePool({ squares: activePool.squares.map(sq => sq.id === id ? { ...sq, ...updates } : sq) })}
                  onUpdateParticipant={(id, updates) => setState(prev => ({
                    ...prev,
                    pools: prev.pools.map(p => p.id === prev.activePoolId ? { 
                      ...p, 
                      participants: p.participants.map(part => part.id === id ? { ...part, ...updates } : part) 
                    } : p)
                  }))}
                  onApplyPayment={applyPaymentToParticipant}
                />
              )
            )
          )}
        </div>
      </main>

      <AIAssistant 
        globalSettings={state.globalSettings}
        activePool={activePool}
      />

      <EntryModal
        isOpen={selectedSquareId !== null}
        onClose={() => setSelectedSquareId(null)}
        onSubmit={handleEntrySubmit}
        onUnassign={(id) => {
          updateActivePool({ squares: activePool.squares.map(sq => sq.id === id ? { ...sq, participantId: null, alias: '', assigned: false, paidAmount: 0 } : sq) });
          setSelectedSquareId(null);
        }}
        onConfirmPayment={(participantId, amount, method) => {
          applyPaymentToParticipant(participantId, amount, method);
        }}
        selectedSquare={activePool.squares.find(s => s.id === selectedSquareId) || null}
        existingParticipants={activePool.participants}
        settings={{ ...state.globalSettings, ...activePool.settings }}
      />

      <ShareModal 
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        appState={state}
      />
    </div>
  );
};

export default App;