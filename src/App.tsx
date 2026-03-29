
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppState, Square, Tab, Participant, PaymentTransaction, Pool, GlobalSettings, PoolSettings, ScoreEntry } from './types';
import Grid from './components/Grid';
import AdminPanel from './components/AdminPanel';
import EntryModal from './components/EntryModal';
import HelpModal from './components/HelpModal';
import AIAssistant from './components/AIAssistant';
import Winners from './components/Winners';
import PlayerProfile from './components/PlayerProfile';
import { db, auth, googleProvider } from './firebase';
import { ref, onValue, set, update } from "firebase/database";
import { signInWithEmailAndPassword, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";

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
  teamA: 'NFC',
  teamB: 'AFC',
  costPerBox: 10,
  rowNumbers: Array(10).fill(null),
  colNumbers: Array(10).fill(null),
  isLocked: false,
  payouts: {
    mode: 'standard',
    standardPayoutType: 'percent',
    charityPayoutType: 'percent',
    charityPercent: 50,
    charityFixedAmount: 500,
    standardSplits: { q1: 20, half: 30, q3: 20, final: 30 },
    scoreChangeMultiplier: 3,
    scoreChangeAppliesTo: 'perBox',
    scoreChangeInitialRefund: true
  }
};

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  adminPassword: 'admin',
  charityName: 'Kofc Charity Pools',
  zelleAccount: '',
  paypalAccount: '',
  venmoAccount: '',
  otherPaymentInfo: '',
};

const createPool = (name: string, settings: PoolSettings = DEFAULT_POOL_SETTINGS): Pool => ({
  id: crypto.randomUUID(),
  name,
  squares: createNewSquares(),
  participants: [],
  scores: [],
  settings: { ...settings, isLocked: false, rowNumbers: Array(10).fill(null), colNumbers: Array(10).fill(null) },
  createdAt: Date.now(),
});

const App: React.FC = () => {
  const [state, setState] = useState<AppState | null>(null);
  const [isFirebaseLoaded, setIsFirebaseLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('grid');
  const [selectedSquareId, setSelectedSquareId] = useState<number | null>(null);
  const [pendingSelection, setPendingSelection] = useState<number[]>([]);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  // Listen for auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);
  // Filter pools by user (show only pools where pool.ownerId === user.uid)
  const userPools = useMemo(() => {
    if (!user || !state?.pools) return [];
    return state.pools.filter((p: any) => p.ownerId === user.uid);
  }, [user, state?.pools]);

  useEffect(() => {
    const stateRef = ref(db, 'state');
    return onValue(stateRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        if (data.pools) {
          const poolsData = Array.isArray(data.pools) ? data.pools : Object.values(data.pools);
          data.pools = poolsData.map((p: Pool) => {
            let squaresArr: Square[] = [];
            if (Array.isArray(p.squares)) {
              squaresArr = p.squares;
            } else if (p.squares && typeof p.squares === 'object') {
              squaresArr = Array.from({ length: 100 }, (_, i) => (p.squares as any)[i] || createNewSquares()[i]);
            } else {
              squaresArr = createNewSquares();
            }

            const normalizeAxis = (axis: any) => {
              if (Array.isArray(axis)) {
                return axis.length === 10 ? axis : [...axis, ...Array(10 - axis.length).fill(null)];
              }
              if (axis && typeof axis === 'object') {
                return Array.from({ length: 10 }, (_, i) => axis[i] ?? null);
              }
              return Array(10).fill(null);
            };

            return {
              ...p,
              squares: squaresArr,
              participants: p.participants || [],
              scores: p.scores || [],
              settings: {
                ...DEFAULT_POOL_SETTINGS,
                ...p.settings,
                rowNumbers: normalizeAxis(p.settings?.rowNumbers),
                colNumbers: normalizeAxis(p.settings?.colNumbers),
                payouts: {
                  ...DEFAULT_POOL_SETTINGS.payouts,
                  ...p.settings?.payouts
                }
              }
            };
          });

          // Build a top-level participants registry (migration-friendly):
          if (!data.participants) {
            const byKey = new Map<string, Participant>();
            (data.pools || []).forEach((pool: Pool) => {
              (pool.participants || []).forEach((p: Participant) => {
                const key = p.id || (p.email || p.name || '').toLowerCase();
                if (!byKey.has(key)) byKey.set(key, p);
              });
            });
            data.participants = Array.from(byKey.values());
          }
        }
        setState(data);
      } else {
        const initialPool = createPool('Kofc Charity Pools');
        const initialState: AppState = {
          pools: [initialPool],
          participants: [],
          activePoolId: initialPool.id,
          globalSettings: DEFAULT_GLOBAL_SETTINGS
        };
        set(ref(db, 'state'), initialState);
        setState(initialState);
      }
      setIsFirebaseLoaded(true);
    });
  }, []);

  const activePool = useMemo(() => {
    if (!state || !state.pools) return null;
    return state.pools.find(p => p.id === state.activePoolId) || state.pools[0];
  }, [state?.activePoolId, state?.pools]);

  // Global participants registry (may be migrated from per-pool participants)
  const globalParticipants = useMemo(() => (state?.participants || []), [state?.participants]);

  // Participants relevant to the active pool (derived from global registry and pool participants/squares)
  const participantsForActivePool = useMemo(() => {
    if (!activePool || !globalParticipants) return activePool?.participants || [];
    const idsInPool = new Set<string>((activePool.participants || []).map(p => p.id).concat((activePool.squares || []).filter(s => s.participantId).map(s => s.participantId!)));
    // include any global participant with boxes in this pool or explicitly listed in pool.participants
    return globalParticipants.filter(p => idsInPool.has(p.id) || (activePool.participants || []).some(pp => pp.id === p.id));
  }, [activePool, globalParticipants]);

  // Participants with an origin pool name (used by EntryModal quick-select)
  const globalParticipantsWithOrigin = useMemo(() => {
    if (!state) return [];
    const poolByParticipant = new Map<string, string>();
    (state.pools || []).forEach(pool => {
      (pool.participants || []).forEach(p => {
        if (!poolByParticipant.has(p.id)) poolByParticipant.set(p.id, pool.name || pool.id);
      });
    });
    return (globalParticipants || []).map(p => ({ ...p, originPoolName: poolByParticipant.get(p.id) }));
  }, [state, globalParticipants]);

  // Create a global participant and optionally ensure the active pool references it
  const handleCreateGlobalParticipant = useCallback((p: Participant) => {
    if (!state || !activePool) return;
    const poolIndex = state.pools.findIndex(x => x.id === state.activePoolId);
    const existing = (state.participants || []).find(pp => pp.id === p.id || (pp.email && pp.email.toLowerCase() === p.email?.toLowerCase()));
    const updates: any = {};
    const newGlobal = existing ? { ...existing, ...p } : p;
    const newGlobalList = [...(state.participants || []).filter(pp => pp.id !== newGlobal.id), newGlobal];
    updates[`state/participants`] = newGlobalList;

    // ensure pool.participants contains a reference (backwards-compat)
    const poolParticipants = [...(state.pools[poolIndex].participants || [])];
    if (!poolParticipants.find(pp => pp.id === newGlobal.id)) poolParticipants.push(newGlobal);
    updates[`state/pools/${poolIndex}/participants`] = poolParticipants;
    update(ref(db), updates).catch(err => console.error(err));
  }, [state, activePool]);

  const updateActivePool = useCallback((updates: Partial<Pool>) => {
    if (!state) return;
    const poolIndex = state.pools.findIndex(p => p.id === state.activePoolId);
    if (poolIndex === -1) return;
    update(ref(db, `state/pools/${poolIndex}`), updates);
  }, [state]);

  const updatePoolSettings = useCallback((newSettings: Partial<PoolSettings>) => {
    if (!state) return;
    const poolIndex = state.pools.findIndex(p => p.id === state.activePoolId);
    if (poolIndex === -1) return;
    update(ref(db, `state/pools/${poolIndex}/settings`), newSettings);
  }, [state]);

  const updateGlobalSettings = useCallback((newSettings: Partial<GlobalSettings>) => {
    if (!state) return;
    update(ref(db, `state/globalSettings`), newSettings);
  }, [state]);

  const atomicUpdateFinancials = useCallback((participantId: string, updatedParticipants: Participant[]) => {
    if (!state || !activePool) return;
    const poolIndex = state.pools.findIndex(p => p.id === state.activePoolId);
    if (poolIndex === -1) return;

    const participant = updatedParticipants.find(p => p.id === participantId);
    if (!participant) return;

    const totalPaid = (participant.paymentHistory || []).reduce((sum, t) => sum + t.amount, 0);
    const costPerBox = activePool.settings.costPerBox || 10;

    let remainingToDistribute = totalPaid;
    const updatedSquaresMap: Record<string, any> = {};

    (activePool.squares || []).forEach((sq, idx) => {
      if (sq.participantId === participantId) {
        const paymentForThisBox = Math.min(remainingToDistribute, costPerBox);
        remainingToDistribute = Math.max(0, remainingToDistribute - paymentForThisBox);
        updatedSquaresMap[`state/pools/${poolIndex}/squares/${idx}`] = {
          ...sq,
          paidAmount: paymentForThisBox,
          alias: participant.alias
        };
      }
    });

    const updates: any = {
      ...updatedSquaresMap,
      [`state/pools/${poolIndex}/participants`]: updatedParticipants
    };

    update(ref(db), updates).catch(err => console.error("Firebase atomic financial update failed:", err));
  }, [state, activePool]);

  const handleEntrySubmit = useCallback((data: Omit<Participant, 'id'>, squareIds: number[]) => {
    if (!state || !activePool) return;
    const poolIndex = state.pools.findIndex(p => p.id === state.activePoolId);
    if (poolIndex === -1) return;

    // Prefer matching against global registry (alias/email/name), then fallback to pool-local participants
    const normalize = (s: string) => (s || '').toLowerCase();
    let participant = (state.participants || []).find(p => normalize(p.alias) === normalize(data.alias) && data.alias)
      || (state.participants || []).find(p => p.email && data.email && p.email.toLowerCase() === data.email.toLowerCase())
      || (state.participants || []).find(p => normalize(p.name) === normalize(data.name));

    const newPoolParticipants = [...(activePool.participants || [])];
    const updates: any = {};

    if (!participant) {
      // create global participant and add to pool
      participant = { ...data, id: crypto.randomUUID(), paymentHistory: [] } as Participant;
      updates[`state/participants`] = [...(state.participants || []).filter(pp => pp.id !== participant!.id), participant];
      newPoolParticipants.push(participant);
      updates[`state/pools/${poolIndex}/participants`] = newPoolParticipants;
    } else {
      // ensure pool references this participant (back-compat)
      if (!newPoolParticipants.find(p => p.id === participant!.id)) {
        newPoolParticipants.push(participant!);
        updates[`state/pools/${poolIndex}/participants`] = newPoolParticipants;
      }
    }

    squareIds.forEach(sid => {
      updates[`state/pools/${poolIndex}/squares/${sid}`] = {
        ...(activePool.squares[sid] || {}),
        participantId: participant!.id,
        alias: (data.alias || participant!.alias || '').toUpperCase(),
        assigned: true
      };
    });

    update(ref(db), updates).then(() => {
      if (participant) atomicUpdateFinancials(participant.id, newPoolParticipants);
    }).catch(err => console.error(err));

    setPendingSelection([]);
    setSelectedSquareId(null);
    setIsEntryModalOpen(false);
  }, [state, activePool, atomicUpdateFinancials]);

  const handleSquareClick = useCallback((id: number) => {
    if (!activePool) return;
    const sq = (activePool.squares || [])[id];
    if (sq?.assigned) {
      setSelectedSquareId(id);
      setIsEntryModalOpen(true);
    } else if (!activePool.settings?.isLocked) {
      setPendingSelection(prev =>
        prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
      );
    }
  }, [activePool]);

  const handleUnassignSquare = useCallback((id: number) => {
    if (!state || !activePool) return;
    const sq = activePool.squares[id];
    if (!sq || !sq.participantId) return;

    if (!window.confirm(`ARE YOU SURE?\n\nThis will remove the claim on Box #${id + 1}.`)) {
      return;
    }

    const poolIndex = state.pools.findIndex(p => p.id === state.activePoolId);
    if (poolIndex === -1) return;

    const participantId = sq.participantId;
    const participant = activePool.participants.find(p => p.id === participantId);
    const costPerBox = activePool.settings.costPerBox || 10;

    const updates: any = {};

    updates[`state/pools/${poolIndex}/squares/${id}`] = {
      ...sq,
      participantId: null,
      alias: '',
      assigned: false,
      paidAmount: 0
    };

    if (participant) {
      const totalPaid = (participant.paymentHistory || []).reduce((sum, t) => sum + t.amount, 0);
      let remainingToDistribute = totalPaid;

      activePool.squares.forEach((otherSq, idx) => {
        if (idx === id) return;

        if (otherSq.participantId === participantId) {
          const paymentForThisBox = Math.min(remainingToDistribute, costPerBox);
          remainingToDistribute = Math.max(0, remainingToDistribute - paymentForThisBox);
          updates[`state/pools/${poolIndex}/squares/${idx}`] = {
            ...otherSq,
            paidAmount: paymentForThisBox
          };
        }
      });
    }

    update(ref(db), updates).then(() => {
      console.log(`Unassigned square ${id + 1} and redistributed payments.`);
    }).catch(err => {
      console.error("Failed to unassign square:", err);
      alert("Error removing name. Please try again.");
    });

    setIsEntryModalOpen(false);
    setSelectedSquareId(null);
  }, [state, activePool]);

  const handleClearUserBoxes = useCallback((participantId: string) => {
    if (!state || !activePool) return;
    const poolIndex = state.pools.findIndex(p => p.id === state.activePoolId);
    const updates: any = {};
    activePool.squares.forEach((sq, idx) => {
      if (sq.participantId === participantId) {
        updates[`state/pools/${poolIndex}/squares/${idx}`] = {
          ...sq,
          participantId: null,
          alias: '',
          assigned: false,
          paidAmount: 0
        };
      }
    });
    update(ref(db), updates);
  }, [state, activePool]);

  const handleApplyPayment = useCallback((participantId: string, amount: number, method: string, note?: string) => {
    if (!state || !activePool) return;
    const newParticipants = activePool.participants.map(p => {
      if (p.id === participantId) {
        return {
          ...p,
          paymentHistory: [...(p.paymentHistory || []), { id: crypto.randomUUID(), amount, method, timestamp: Date.now(), note }]
        };
      }
      return p;
    });
    atomicUpdateFinancials(participantId, newParticipants);
  }, [state, activePool, atomicUpdateFinancials]);

  const handleEditPayment = useCallback((participantId: string, transactionId: string, amount: number, method: string, note?: string) => {
    if (!state || !activePool) return;
    const newParticipants = activePool.participants.map(p => {
      if (p.id === participantId) {
        return {
          ...p,
          paymentHistory: (p.paymentHistory || []).map(t => t.id === transactionId ? { ...t, amount, method, note } : t)
        };
      }
      return p;
    });
    atomicUpdateFinancials(participantId, newParticipants);
  }, [state, activePool, atomicUpdateFinancials]);

  const handleDeletePayment = useCallback((participantId: string, transactionId: string) => {
    if (!state || !activePool) return;
    const newParticipants = activePool.participants.map(p => {
      if (p.id === participantId) {
        return {
          ...p,
          paymentHistory: (p.paymentHistory || []).filter(t => t.id !== transactionId)
        };
      }
      return p;
    });
    atomicUpdateFinancials(participantId, newParticipants);
  }, [state, activePool, atomicUpdateFinancials]);

  const handleUpdateParticipant = useCallback((id: string, updates: Partial<Participant>) => {
    if (!state || !activePool) return;
    const poolIndex = state.pools.findIndex(p => p.id === state.activePoolId);
    const participantIndex = activePool.participants.findIndex(p => p.id === id);
    if (participantIndex === -1) return;
    update(ref(db, `state/pools/${poolIndex}/participants/${participantIndex}`), updates);
  }, [state, activePool]);

  const handleGenerateNumbers = useCallback(() => {
    const shuffle = () => Array.from({ length: 10 }, (_, i) => i).sort(() => Math.random() - 0.5);
    updatePoolSettings({ rowNumbers: shuffle(), colNumbers: shuffle() });
  }, [updatePoolSettings]);

  const handleAddScore = useCallback((score: ScoreEntry) => {
    if (!activePool) return;
    const newScores = [...(activePool.scores || []), score];
    updateActivePool({ scores: newScores });
  }, [activePool, updateActivePool]);

  const handleUpdateScore = useCallback((score: ScoreEntry) => {
    if (!activePool) return;
    const newScores = (activePool.scores || []).map(s => s.id === score.id ? score : s);
    updateActivePool({ scores: newScores });
  }, [activePool, updateActivePool]);

  const handleDeleteScore = useCallback((id: string) => {
    if (!activePool) return;
    const newScores = (activePool.scores || []).filter(s => s.id !== id);
    updateActivePool({ scores: newScores });
  }, [activePool, updateActivePool]);

  const handleResetGrid = useCallback(() => {
    if (window.confirm("ARE YOU SURE? This will clear all boxes for the active grid.")) {
      updateActivePool({
        squares: createNewSquares(),
        participants: [],
        scores: [],
        settings: { ...activePool!.settings, isLocked: false, rowNumbers: Array(10).fill(null), colNumbers: Array(10).fill(null) }
      });
    }
  }, [activePool, updateActivePool]);

  const handleCreatePool = useCallback((name: string, customSettings?: Partial<PoolSettings>) => {
    if (!state) return;
    const newPool = createPool(name, { ...DEFAULT_POOL_SETTINGS, ...customSettings });
    const newPools = [...state.pools, newPool];
    set(ref(db, 'state'), { ...state, pools: newPools, activePoolId: newPool.id });
  }, [state]);

  const handleSwitchPool = useCallback((id: string) => {
    if (!state) return;
    update(ref(db, 'state'), { activePoolId: id });
  }, [state]);

  const handleDeletePool = useCallback((id: string) => {
    if (!state || state.pools.length <= 1) return;
    if (window.confirm("Permanently delete this contest?")) {
      const newPools = state.pools.filter(p => p.id !== id);
      set(ref(db, 'state'), { ...state, pools: newPools, activePoolId: newPools[0].id });
    }
  }, [state]);

  const handleImportState = useCallback((newState: AppState) => {
    set(ref(db, 'state'), newState);
  }, []);

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === state?.globalSettings.adminPassword) {
      setIsAdminAuthenticated(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  if (!isFirebaseLoaded || !state) {
    return (
      <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-6"></div>
        <h2 className="text-white font-black uppercase tracking-widest text-sm">Initializing Charity Grid...</h2>
      </div>
    );
  }

  // If not logged in, show login UI
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-950 text-white">
        <div className="bg-white/10 p-8 rounded-2xl shadow-xl w-full max-w-xs flex flex-col gap-4">
          <h2 className="text-2xl font-black text-center mb-2">Sign In</h2>
          <input
            type="email"
            placeholder="Email"
            value={authEmail}
            onChange={e => setAuthEmail(e.target.value)}
            className="w-full p-3 rounded mb-2 text-black"
          />
          <input
            type="password"
            placeholder="Password"
            value={authPassword}
            onChange={e => setAuthPassword(e.target.value)}
            className="w-full p-3 rounded mb-2 text-black"
          />
          <button
            className="w-full py-2 bg-indigo-800 text-white rounded font-bold mb-2"
            onClick={async () => {
              setAuthError(null);
              try {
                await signInWithEmailAndPassword(auth, authEmail, authPassword);
              } catch (err: any) {
                setAuthError(err.message);
              }
            }}
          >Sign in with Email</button>
          <button
            className="w-full py-2 bg-red-600 text-white rounded font-bold mb-2"
            onClick={async () => {
              setAuthError(null);
              try {
                await signInWithPopup(auth, googleProvider);
              } catch (err: any) {
                setAuthError(err.message);
              }
            }}
          >Sign in with Google</button>
          {authError && <div className="text-red-400 text-xs text-center">{authError}</div>}
        </div>
      </div>
    );
  }

  // Use only pools owned by the user
  const poolsToShow = userPools.length > 0 ? userPools : [];
  // Use the existing activePool logic, but filter pools by user
  // (activePool is already declared above)

  if (!activePool) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-indigo-950 text-white">
        <div className="bg-white/10 p-8 rounded-2xl shadow-xl max-w-md text-center">
          <h2 className="text-xl font-black mb-2">No pools found for your account.</h2>
          <p className="mb-4">Create a new pool or contact your admin.</p>
          <button className="bg-indigo-800 px-6 py-2 rounded text-white font-bold" onClick={() => handleCreatePool('My Pool')}>Create Pool</button>
          <button className="bg-gray-700 px-6 py-2 rounded text-white font-bold ml-2" onClick={() => signOut(auth)}>Sign Out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans selection:bg-indigo-100">
      <header className="bg-indigo-900 text-white p-6 md:p-8 shadow-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-5 w-full md:w-auto">
            <div className="w-24 h-24 md:w-16 md:h-16 bg-white rounded-2xl flex-shrink-0 flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow cursor-pointer" onClick={() => setActiveTab('grid')}>
              <img
                src={`${import.meta.env.BASE_URL}logo.png`}
                alt={state.globalSettings.charityName}
                className="w-20 h-20 md:w-14 md:h-14 object-contain"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = `${import.meta.env.BASE_URL}kofc-logo.svg`; }}
              />
            </div>
            <div className="flex-grow min-w-0">
              <div className="flex items-center gap-3">
                <select
                  value={state.activePoolId}
                  onChange={(e) => handleSwitchPool(e.target.value)}
                  className="bg-indigo-800 text-white border-none rounded-xl px-4 py-1.5 font-black uppercase text-sm md:text-xl tracking-tighter outline-none focus:ring-2 focus:ring-indigo-400 max-w-full cursor-pointer hover:bg-indigo-700 transition-colors"
                  title="Select Pool"
                  aria-label="Select Pool"
                >
                  {state.pools.map(p => (
                    <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <p className="text-[10px] md:text-xs text-indigo-300 font-bold uppercase tracking-widest mt-1 truncate">Benefiting {state.globalSettings.charityName}</p>
            </div>
          </div>
          <nav className="flex flex-wrap justify-center gap-1 bg-white/10 p-1.5 rounded-2xl backdrop-blur-md">
            {[
              { id: 'grid', icon: 'fa-th', label: 'Board' },
              { id: 'winners', icon: 'fa-trophy', label: 'Winners' },
              { id: 'player', icon: 'fa-user-check', label: 'My Boxes' },
              { id: 'admin', icon: 'fa-lock', label: 'Admin' }
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as Tab)} className={`px-4 md:px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-white text-indigo-900 shadow-lg' : 'hover:bg-white/10 text-white/70'}`}>
                <i className={`fas ${tab.icon} text-[10px]`}></i> <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
            {/* Share button removed */}
            <button onClick={() => setIsHelpModalOpen(true)} className="w-10 h-10 rounded-xl text-white/50 hover:text-white flex items-center justify-center" title="Help" aria-label="Help">
              <i className="fas fa-question-circle"></i>
            </button>
            <button onClick={() => signOut(auth)} className="w-10 h-10 rounded-xl text-white/50 hover:text-white flex items-center justify-center ml-2" title="Sign Out">
              <i className="fas fa-sign-out-alt"></i>
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full p-4 md:p-8">
        {activeTab === 'grid' && (
          <Grid
            squares={activePool.squares}
            pendingSelection={pendingSelection}
            settings={{ ...state.globalSettings, ...activePool.settings }}
            onSquareClick={handleSquareClick}
            participants={participantsForActivePool}
            onCheckout={() => setIsEntryModalOpen(true)}
            onSetPendingSelection={setPendingSelection}
            activePool={activePool}
          />
        )}

        {activeTab === 'winners' && (
          <Winners
            activePool={activePool}
            settings={{ ...state.globalSettings, ...activePool.settings }}
            onAddScore={handleAddScore}
            onUpdateScore={handleUpdateScore}
            onDeleteScore={handleDeleteScore}
            isAdmin={false}
          />
        )}

        {activeTab === 'player' && (
          <PlayerProfile state={state} />
        )}

        {activeTab === 'admin' && (
          !isAdminAuthenticated ? (
            <div className="max-w-md mx-auto mt-20 p-10 bg-white rounded-[3rem] shadow-2xl text-center border border-indigo-50">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6"><i className="fas fa-lock"></i></div>
              <h2 className="text-xl font-black text-indigo-900 uppercase mb-2">Admin Authentication</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-8">Password required for management access</p>
              <form onSubmit={handleAdminAuth} className="space-y-4">
                <input
                  autoFocus
                  type="password"
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  className={`w-full px-6 py-4 bg-gray-50 rounded-2xl text-center font-black outline-none border-2 transition-all ${passwordError ? 'border-red-500 bg-red-50' : 'focus:border-indigo-500 border-transparent'}`}
                  placeholder="••••••••"
                />
                {passwordError && <p className="text-red-500 text-[10px] font-bold uppercase">Incorrect password</p>}
                <button type="submit" className="w-full py-4 bg-indigo-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-black transition-all">Unlock Panel</button>
              </form>
            </div>
          ) : (
            <AdminPanel
              activePoolId={state.activePoolId}
              poolSettings={activePool.settings}
              globalSettings={state.globalSettings}
              onUpdatePoolSettings={updatePoolSettings}
              onUpdateActivePool={updateActivePool}
              onUpdateGlobalSettings={updateGlobalSettings}
              onResetGrid={handleResetGrid}
              onDeletePool={handleDeletePool}
              onGenerateNumbers={handleGenerateNumbers}
              squares={activePool.squares}
              participants={participantsForActivePool}
              allParticipants={globalParticipants}
              onCreateGlobalParticipant={handleCreateGlobalParticipant}
              onUpdateSquare={(id, up) => update(ref(db, `state/pools/${state.pools.findIndex(p => p.id === state.activePoolId)}/squares/${id}`), up)}
              onUpdateParticipant={handleUpdateParticipant}
              onUnassignSquare={handleUnassignSquare}
              onClearUserBoxes={handleClearUserBoxes}
              onApplyPayment={handleApplyPayment}
              onEditPayment={handleEditPayment}
              onDeletePayment={handleDeletePayment}
              onAddScore={handleAddScore}
              onUpdateScore={handleUpdateScore}
              onDeleteScore={handleDeleteScore}
              scores={activePool.scores}
              pools={state.pools}
              onSwitchPool={handleSwitchPool}
              onCreatePool={handleCreatePool}
              fullState={state}
              onImportState={handleImportState}
            />
          )
        )}
      </main>

      <footer className="bg-white border-t border-gray-100 p-8 text-center text-gray-400 print:hidden">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2">{state.globalSettings.charityName}</p>
        <p className="text-[9px] font-medium uppercase tracking-widest">Powered by Charity Squares Engine • {new Date().getFullYear()}</p>
      </footer>

      {/* Pass a deduplicated list of participants from ALL pools so the EntryModal can quick-select across contests */}
      <EntryModal
        isOpen={isEntryModalOpen}
        onClose={() => { setIsEntryModalOpen(false); setSelectedSquareId(null); }}
        onSubmit={handleEntrySubmit}
        onUnassign={handleUnassignSquare}
        onSetPendingSelection={setPendingSelection}
        selectedSquareIds={selectedSquareId !== null ? [selectedSquareId] : pendingSelection}
        activePool={activePool}
        existingParticipants={globalParticipantsWithOrigin}
        settings={{ ...state.globalSettings, ...activePool.settings }}
        isAdmin={isAdminAuthenticated}
      />

      {/* ShareModal removed from App — share UI retained in components/ if needed */}
      <HelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />
      <AIAssistant globalSettings={state.globalSettings} activePool={activePool} />
    </div>
  );
};

export default App;
