
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PoolSettings, GlobalSettings, Square, Pool, AppState, Participant, ScoreEntry } from '../types';
import Stats from './Stats';
import Winners from './Winners';

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
  participants: Participant[];
  onUpdateSquare: (id: number, updates: Partial<Square>) => void;
  onUpdateParticipant: (id: string, updates: Partial<Participant>) => void;
  onCreateGlobalParticipant?: (p: Participant) => void;
  /** Full/global participant registry (optional) — used when showing "all names" */
  allParticipants?: Participant[];
  onUnassignSquare: (id: number) => void;
  onClearUserBoxes: (participantId: string) => void;
  onApplyPayment: (participantId: string, amount: number, method: string) => void;
  onEditPayment: (participantId: string, transactionId: string, amount: number, method: string) => void;
  onDeletePayment: (participantId: string, transactionId: string) => void;
  onAddScore: (score: ScoreEntry) => void;
  onUpdateScore: (score: ScoreEntry) => void;
  onDeleteScore: (id: string) => void;
  scores: ScoreEntry[];
  pools: Pool[];
  onSwitchPool: (id: string) => void;
  onCreatePool: (name: string, customSettings?: Partial<PoolSettings>) => void;
  fullState: AppState;
  onImportState: (state: AppState) => void;
}

type AdminSection = 'overview' | 'pools' | 'settings' | 'axis' | 'participants' | 'winners' | 'stats' | 'global' | 'danger';

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
  participants,
  /** optional full/global registry */
  allParticipants,
  onUpdateSquare,
  onUpdateParticipant,
  onUnassignSquare,
  onClearUserBoxes,
  onApplyPayment,
  onEditPayment,
  onDeletePayment,
  onAddScore,
  onUpdateScore,
  onDeleteScore,
  scores,
  pools,
  onSwitchPool,
  onCreatePool,
  fullState,
  onImportState
}) => {
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAddNameForm, setShowAddNameForm] = useState(false);
  // when true, show the full/global participant registry instead of just active-pool participants
  // Changed default to true so admins see the global registry by default.
  const [showAllParticipantsList, setShowAllParticipantsList] = useState(true);
  const [selectedParticipantBoxes, setSelectedParticipantBoxes] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addExistingParticipantToPool = (p: Participant) => {
    const updated = [...(activePool?.participants || [])];
    if (!updated.find(x => x.id === p.id)) updated.push(p);
    onUpdateActivePool({ participants: updated });
  };

  const [newPoolData, setNewPoolData] = useState({
    name: '',
    teamA: 'NFC',
    teamB: 'AFC',
    costPerBox: 10
  });

  const [newNameData, setNewNameData] = useState({
    name: '',
    email: '',
    phone: '',
    alias: ''
  });

  // local inputs for global logo fields — avoid persisting onChange until validated onBlur
  const [teamALogoInput, setTeamALogoInput] = useState<string>(globalSettings?.teamALogo || '');
  const [teamBLogoInput, setTeamBLogoInput] = useState<string>(globalSettings?.teamBLogo || '');
  React.useEffect(() => { setTeamALogoInput(globalSettings?.teamALogo || ''); setTeamBLogoInput(globalSettings?.teamBLogo || ''); }, [globalSettings?.teamALogo, globalSettings?.teamBLogo]);

  const activePool = (pools || []).find(p => p.id === activePoolId);

  // --- Logo helpers (upload, chooser, validation) ---
  const fileToDataUrl = (blob: Blob | File): Promise<string> => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(String(reader.result));
    reader.onerror = rej;
    reader.readAsDataURL(blob as Blob);
  });

  const validateImageUrl = (url: string, timeout = 6000): Promise<boolean> => new Promise((res) => {
    if (!url) return res(false);
    const img = new Image();
    let done = false;
    const onOK = () => { if (!done) { done = true; res(true); cleanup(); } };
    const onFail = () => { if (!done) { done = true; res(false); cleanup(); } };
    const cleanup = () => { img.onload = null; img.onerror = null; clearTimeout(t); };
    img.onload = onOK;
    img.onerror = onFail;
    const t = setTimeout(onFail, timeout);
    // Some URLs (data:) will immediately succeed or fail synchronously
    img.src = url;
  });

  const ensureDropboxChooser = (): Promise<void> => new Promise((res) => {
    if ((window as any).Dropbox) return res();
    const s = document.createElement('script');
    s.src = 'https://www.dropbox.com/static/api/2/dropins.js';
    s.id = 'dropboxjs';
    s.setAttribute('data-app-key', String(globalSettings?.dropboxAppKey || ''));
    s.onload = () => res();
    document.head.appendChild(s);
  });

  // Resize/encode image to target constraints (returns a Blob). Skips SVGs.
  const optimizeImage = async (file: File, {
    maxWidth = 800,
    maxHeight = 800,
    maxBytes = 150000,
    mime = 'image/webp',
    quality = 0.8
  }: { maxWidth?: number; maxHeight?: number; maxBytes?: number; mime?: string; quality?: number } = {}): Promise<Blob> => {
    try {
      if (!file.type || file.type === 'image/svg+xml') return file; // skip SVG (keep original)
      const dataUrl = await fileToDataUrl(file);
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = dataUrl;
      });

      let { width, height } = img;
      const aspect = width / height;
      if (width > maxWidth) { width = maxWidth; height = Math.round(maxWidth / aspect); }
      if (height > maxHeight) { height = maxHeight; width = Math.round(maxHeight * aspect); }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const tryBlob = (q: number, mimeType: string) => new Promise<Blob | null>((res) => {
        if (!canvas.toBlob) return res(null);
        canvas.toBlob((b) => res(b), mimeType, q);
      });

      // Try a few qualities, reduce until under maxBytes or quality floor
      let q = quality;
      let out: Blob | null = await tryBlob(q, mime);
      const mimeFallback = file.type || 'image/png';
      const minQuality = 0.5;
      while (out && out.size > maxBytes && q > minQuality) {
        q = Math.max(minQuality, q - 0.1);
        out = await tryBlob(q, mime) || out;
      }

      // If still too big, try original mime with lower quality (JPEG) if supported
      if (out && out.size > maxBytes && mime !== 'image/jpeg') {
        const jpeg = await tryBlob(Math.min(0.8, q), 'image/jpeg');
        if (jpeg && jpeg.size < out.size) out = jpeg;
      }

      // If optimization failed or produced null, return original file
      if (!out) return file;
      return out.size < file.size ? out : file;
    } catch (err) {
      console.warn('optimizeImage failed, using original file', err);
      return file;
    }
  };

  const handleLogoFile = async (file: File, scope: 'global' | 'pool', team: 'A' | 'B') => {
    try {
      const optimized = await optimizeImage(file);
      const dataUrl = await fileToDataUrl(optimized);
      if (optimized.size && optimized.size < file.size) console.log(`Logo optimized: ${file.size} → ${optimized.size} bytes`);
      if (optimized.size && optimized.size > 300000 && !confirm('Optimized image is still large (>300KB). Save anyway?')) return;
      if (scope === 'global') onUpdateGlobalSettings(team === 'A' ? { teamALogo: dataUrl } : { teamBLogo: dataUrl });
      else onUpdatePoolSettings(team === 'A' ? { teamALogo: dataUrl } : { teamBLogo: dataUrl });
    } catch (err) {
      console.error('Logo file -> dataURL failed', err);
      alert('Failed to process file.');
    }
  };

  const handleChooseFromDropbox = async (scope: 'global' | 'pool', team: 'A' | 'B') => {
    if (!globalSettings?.dropboxAppKey) { alert('Set a Dropbox App Key in Global settings first.'); return; }
    try {
      await ensureDropboxChooser();
      const chooserOptions = {
        success: (files: any[]) => {
          const url = files[0]?.link || files[0]?.thumbnailLink || files[0]?.url;
          if (!url) { alert('Dropbox returned no usable link.'); return; }
          if (scope === 'global') onUpdateGlobalSettings(team === 'A' ? { teamALogo: url } : { teamBLogo: url });
          else onUpdatePoolSettings(team === 'A' ? { teamALogo: url } : { teamBLogo: url });
        },
        linkType: 'direct',
        multiselect: false,
        extensions: ['.png', '.jpg', '.jpeg', '.svg', '.webp']
      } as any;
      (window as any).Dropbox.choose(chooserOptions);
    } catch (err) {
      console.error(err);
      alert('Dropbox chooser failed to load.');
    }
  };

  const uploadFileToGitHub = async (file: Blob | File, repo: string, token: string, pathPrefix = 'assets') => {
    // repo = owner/repo
    const [owner, repoName] = repo.split('/');
    if (!owner || !repoName) throw new Error('Invalid repo (owner/repo)');
    // get default branch
    const repoResp = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, { headers: { Authorization: `token ${token}` } });
    if (!repoResp.ok) throw new Error('Failed to read repo info: ' + await repoResp.text());
    const repoJson = await repoResp.json();
    const branch = repoJson.default_branch || 'main';

    const arrayBuffer = await (file as Blob).arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const targetPath = `${pathPrefix}/${Date.now()}_${(file as File).name || 'logo'}
`;

    const putResp = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${encodeURIComponent(targetPath)}`, {
      method: 'PUT',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Add logo ${(file as File).name || 'logo'}`, content: b64, branch })
    });
    if (!putResp.ok) throw new Error('GitHub upload failed: ' + await putResp.text());
    const putJson = await putResp.json();
    // construct raw URL
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/${targetPath}`;
    return rawUrl;
  };

  const handleUploadToGitHub = async (file: File, scope: 'global' | 'pool', team: 'A' | 'B') => {
    try {
      const token = globalSettings?.githubToken;
      const repo = globalSettings?.githubRepo;
      if (!token || !repo) { alert('Set GitHub token and repo in Global settings first.'); return; }
      const optimized = await optimizeImage(file);
      const url = await uploadFileToGitHub(optimized, repo, token);
      if (scope === 'global') onUpdateGlobalSettings(team === 'A' ? { teamALogo: url } : { teamBLogo: url });
      else onUpdatePoolSettings(team === 'A' ? { teamALogo: url } : { teamBLogo: url });
    } catch (err: any) {
      console.error(err);
      alert('GitHub upload failed: ' + (err?.message || err));
    }
  };

  // small helper to set/validate a URL (used when pasting or choosing)
  // returns true if the URL was saved, false if the user cancelled or validation failed
  const setAndValidateLogoUrl = async (scope: 'global' | 'pool', team: 'A' | 'B', url: string): Promise<boolean> => {
    const ok = await validateImageUrl(url);
    if (!ok) {
      if (!confirm('Image failed to load — save anyway?')) return false;
    }
    if (scope === 'global') onUpdateGlobalSettings(team === 'A' ? { teamALogo: url } : { teamBLogo: url });
    else onUpdatePoolSettings(team === 'A' ? { teamALogo: url } : { teamBLogo: url });
    return true;
  };

  const getAxisStatus = (nums: number[]) => {
    const present = new Set<number>();
    const duplicates = new Set<number>();
    const filtered = (nums || []).filter(n => n !== null && !isNaN(n));
    filtered.forEach(n => {
      if (present.has(n)) duplicates.add(n);
      present.add(n);
    });
    const missing = [];
    for (let i = 0; i <= 9; i++) if (!present.has(i)) missing.push(i);
    const isValid = missing.length === 0 && duplicates.size === 0 && filtered.length === 10;
    return { isValid, missing, duplicates: Array.from(duplicates), count: filtered.length };
  };

  const rowStatus = useMemo(() => getAxisStatus(poolSettings.rowNumbers), [poolSettings.rowNumbers]);
  const colStatus = useMemo(() => getAxisStatus(poolSettings.colNumbers), [poolSettings.colNumbers]);

  const financialSummary = useMemo(() => {
    const cost = poolSettings?.costPerBox || 0;
    const totalPot = cost * 100;
    const payouts = poolSettings.payouts;
    let charityAmount = payouts.charityPayoutType === 'fixed' ? (payouts.charityFixedAmount || 0) : (payouts.charityPercent / 100) * totalPot;
    let playerPot = totalPot - charityAmount;
    return { totalPot, charityAmount, playerPot };
  }, [poolSettings]);

  // Gather participant info across all pools (match by id OR email OR name)
  const gatherParticipantAcrossPools = (p: Participant) => {
    const matches: { poolId: string; poolName: string; boxIds: number[]; costPerBox: number; paid: number; owed: number }[] = [];
    let totalBoxes = 0;
    let totalPaid = 0;
    let totalOwed = 0;

    (pools || []).forEach(pool => {
      const found = (pool.participants || []).find(pp => {
        if (!pp) return false;
        if (pp.id === p.id && pool.id === activePoolId) return true; // same record in active pool
        if (pp.email && p.email && pp.email.toLowerCase() === p.email.toLowerCase()) return true;
        if (pp.name && p.name && pp.name.toLowerCase() === p.name.toLowerCase()) return true;
        return false;
      });
      if (!found) return;
      const boxIds = (pool.squares || []).filter(sq => sq.participantId === found.id).map(sq => sq.id);
      const paid = (found.paymentHistory || []).reduce((s, t) => s + (t.amount || 0), 0);
      const cost = pool.settings?.costPerBox || 10;
      const owed = Math.max(0, boxIds.length * cost - paid);
      matches.push({ poolId: pool.id, poolName: pool.name || pool.id, boxIds, costPerBox: cost, paid, owed });
      totalBoxes += boxIds.length;
      totalPaid += paid;
      totalOwed += owed;
    });

    return { matches, totalBoxes, totalPaid, totalOwed };
  };

  const handleCreatePool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPoolData.name.trim()) return;
    onCreatePool(newPoolData.name, { teamA: newPoolData.teamA, teamB: newPoolData.teamB, costPerBox: newPoolData.costPerBox });
    setShowCreateForm(false);
  };

  const handleAddName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNameData.name.trim()) return;

    // Check if name already exists (case-insensitive)
    const nameExists = (activePool?.participants || []).some(p =>
      p.name.toLowerCase() === newNameData.name.toLowerCase()
    );

    if (nameExists) {
      alert(`"${newNameData.name}" already exists in the participant list.`);
      return;
    }

    // Format US phone number
    const formatPhoneNumber = (phone: string): string => {
      if (!phone) return '';
      const digits = phone.replace(/\D/g, '');
      if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
      }
      return phone; // Return original if not 10 digits
    };

    const newParticipant: Participant = {
      id: crypto.randomUUID(),
      name: newNameData.name,
      email: newNameData.email,
      phone: formatPhoneNumber(newNameData.phone),
      alias: newNameData.alias, // alias can be empty at this point
      paymentHistory: []
    };

    const updatedParticipants = [...(activePool?.participants || []), newParticipant];
    // update pool-local list (backwards-compat)
    onUpdateActivePool({ participants: updatedParticipants });
    // also create/update global registry when available
    if (typeof onCreateGlobalParticipant === 'function') onCreateGlobalParticipant(newParticipant);

    setNewNameData({ name: '', email: '', phone: '', alias: '' });
    setShowAddNameForm(false);
  };

  const handleDeleteParticipant = (participantId: string) => {
    if (!window.confirm('Are you sure you want to delete this person from the participant list?')) return;
    const updatedParticipants = (activePool?.participants || []).filter(p => p.id !== participantId);
    onUpdateActivePool({ participants: updatedParticipants });
  };

  const handleAxisNumberChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'row' | 'col', index: number) => {
    const valStr = e.target.value.replace(/[^0-9]/g, '');
    const num = valStr === '' ? null : parseInt(valStr, 10);
    const key = type === 'row' ? 'rowNumbers' : 'colNumbers';
    const currentAxis = [...(poolSettings[key] || Array(10).fill(null))];
    currentAxis[index] = num;
    onUpdatePoolSettings({ [key]: currentAxis });
    if (valStr !== '' && index < 9) {
      const parent = e.target.closest('.axis-row');
      const inputs = parent?.querySelectorAll('input');
      (inputs?.[index + 1] as HTMLInputElement)?.focus();
    }
  };

  const clearAxis = (type: 'row' | 'col') => {
    const key = type === 'row' ? 'rowNumbers' : 'colNumbers';
    onUpdatePoolSettings({ [key]: Array(10).fill(null) });
  };

  const ValidationBadge = ({ status }: { status: ReturnType<typeof getAxisStatus> }) => {
    if (status.isValid) return <span className="text-[8px] font-black text-green-500 uppercase bg-green-50 px-2 py-0.5 rounded-full border border-green-100">Ready</span>;
    return (
      <div className="flex flex-wrap gap-2">
        {status.duplicates.length > 0 && <span className="text-[8px] font-black text-red-500 uppercase bg-red-50 px-2 py-0.5 rounded-full border border-red-100">Dupes: {status.duplicates.join(',')}</span>}
        {status.missing.length > 0 && <span className="text-[8px] font-black text-orange-500 uppercase bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">Missing: {status.missing.join(',')}</span>}
      </div>
    );
  };

  const menuItems: Array<{ id: AdminSection; label: string; icon: string }> = [
    { id: 'overview', label: 'Overview', icon: 'fa-th-large' },
    { id: 'pools', label: 'Contests', icon: 'fa-gamepad' },
    { id: 'settings', label: 'Grid Settings', icon: 'fa-sliders-h' },
    { id: 'axis', label: 'Axis Numbers', icon: 'fa-th' },
    { id: 'participants', label: 'Add Names', icon: 'fa-users' },
    { id: 'winners', label: 'Winners', icon: 'fa-trophy' },
    { id: 'stats', label: 'Stats', icon: 'fa-chart-bar' },
    { id: 'global', label: 'Organization', icon: 'fa-cog' },
    { id: 'danger', label: 'Danger Zone', icon: 'fa-exclamation-triangle' },
  ];

  return (
    <div className="admin-panel min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <header className="bg-indigo-900 text-white sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight">Admin Control Panel</h2>
              <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest">Master Grid Management</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { const dataStr = JSON.stringify(fullState, null, 2); const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr); const linkElement = document.createElement('a'); linkElement.setAttribute('href', dataUri); linkElement.setAttribute('download', 'grid-backup.json'); linkElement.click(); }} className="hidden md:inline-flex bg-white/10 text-white px-4 py-2 rounded-xl font-black uppercase text-[9px] hover:bg-white/20 transition-all"><i className="fas fa-download mr-2"></i>Backup</button>
              <button onClick={() => fileInputRef.current?.click()} className="hidden md:inline-flex bg-white/10 text-white px-4 py-2 rounded-xl font-black uppercase text-[9px] hover:bg-white/20 transition-all"><i className="fas fa-upload mr-2"></i>Restore</button>
              <button onClick={() => {
                try {
                  const state = fullState;
                  const makeCSV = (headers: string[], rows: any[][]) => {
                    const esc = (s: any) => `"${String(s ?? '').replace(/"/g, '""')}"`;
                    return [headers.join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
                  };

                  const normalizePools = (raw: any) => {
                    if (!raw) return [];
                    if (raw.pools && Array.isArray(raw.pools)) return raw.pools;
                    if (raw.pools && typeof raw.pools === 'object') return Object.values(raw.pools).map((p: any) => ({
                      ...p,
                      squares: Array.isArray(p.squares) ? p.squares : (p.squares ? Object.values(p.squares) : []),
                      participants: p.participants || [],
                      settings: p.settings || { costPerBox: 10, rowNumbers: Array(10).fill(null), colNumbers: Array(10).fill(null) }
                    }));
                    if (Array.isArray(raw)) return raw;
                    return [raw];
                  };

                  const pools = normalizePools(state);
                  const agingRows: any[][] = [];
                  const gridRows: any[][] = [];

                  pools.forEach((pool: any) => {
                    const poolName = pool.name || pool.id || 'Unnamed Pool';
                    const costPerBox = (pool.settings && pool.settings.costPerBox) || 10;
                    const squares = pool.squares || [];
                    const participants = pool.participants || [];

                    const squaresByParticipant: Record<string, any[]> = {};
                    (squares || []).forEach((sq: any, idx: number) => {
                      const pid = sq && sq.participantId ? sq.participantId : null;
                      if (!pid) return;
                      squaresByParticipant[pid] = squaresByParticipant[pid] || [];
                      squaresByParticipant[pid].push(typeof sq.id === 'number' ? sq.id : (sq.id || idx));
                    });

                    participants.forEach((p: any) => {
                      const pid = p.id;
                      const boxList = (squaresByParticipant[pid] || []).slice().sort((a, b) => a - b).map((n: any) => (typeof n === 'number' ? (n + 1) : n));
                      const boxCount = boxList.length;
                      const totalDue = boxCount * costPerBox;
                      const totalPaid = (p.paymentHistory || []).reduce((s: number, t: any) => s + (t.amount || 0), 0);
                      const outstanding = Math.max(0, totalDue - totalPaid);
                      agingRows.push([poolName, p.alias || '', p.name || '', p.email || '', p.phone || '', boxCount, boxList.join(';'), costPerBox, totalDue, totalPaid, outstanding]);
                    });

                    Object.keys(squaresByParticipant).forEach(pid => {
                      const found = (participants || []).find((p: any) => p.id === pid);
                      if (!found) {
                        const boxList = (squaresByParticipant[pid] || []).slice().sort((a: any, b: any) => a - b).map((n: any) => (typeof n === 'number' ? (n + 1) : n));
                        const boxCount = boxList.length;
                        const totalDue = boxCount * costPerBox;
                        agingRows.push([poolName, '', '', '', '', boxCount, boxList.join(';'), costPerBox, totalDue, 0, totalDue]);
                      }
                    });

                    gridRows.push([poolName, (pool.settings && pool.settings.rowNumbers) ? pool.settings.rowNumbers.join(';') : '', (pool.settings && pool.settings.colNumbers) ? pool.settings.colNumbers.join(';') : '']);
                  });

                  const agingCSV = makeCSV(['Pool', 'Alias', 'Name', 'Email', 'Phone', 'BoxesPlayed', 'BoxIDs', 'CostPerBox', 'TotalDue', 'TotalPaid', 'Outstanding'], agingRows);
                  const gridCSV = makeCSV(['Pool', 'RowNumbers', 'ColNumbers'], gridRows);

                  const download = (name: string, content: string, mime = 'text/csv') => {
                    const uri = 'data:' + mime + ';charset=utf-8,' + encodeURIComponent(content);
                    const a = document.createElement('a');
                    a.setAttribute('href', uri);
                    a.setAttribute('download', name);
                    a.click();
                  };

                  download('aging_report.csv', agingCSV);
                  download('grid_numbers.csv', gridCSV);
                } catch (err) {
                  console.error(err);
                  alert('Failed to generate aging report.');
                }
              }} className="hidden md:inline-flex bg-white/10 text-white px-4 py-2 rounded-xl font-black uppercase text-[9px] hover:bg-white/20 transition-all"><i className="fas fa-file-csv mr-2"></i>Aging Report</button>
              <input type="file" ref={fileInputRef} onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = (event) => { try { const json = JSON.parse(event.target?.result as string); if (window.confirm("Overwrite ALL data with this backup?")) onImportState(json); } catch (err) { alert("Invalid JSON file."); } e.target.value = ''; }; reader.readAsText(file); }} accept=".json" className="hidden" />
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-col md:flex-row max-w-7xl mx-auto gap-6 p-4 md:p-6">
        {/* Sidebar Menu */}
        <nav className="w-full md:w-48 flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full text-left px-6 py-4 font-black uppercase text-[11px] tracking-wide transition-all flex items-center gap-3 ${activeSection === item.id
                  ? 'bg-indigo-900 text-white'
                  : 'text-indigo-900 hover:bg-indigo-50'
                  }`}
              >
                <i className={`fas ${item.icon} w-4 text-center`}></i>
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl shadow-sm p-6 md:p-10">

            {/* Overview Section */}
            {activeSection === 'overview' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-black text-indigo-900 uppercase mb-6">Financial Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-indigo-50 p-6 rounded-3xl text-center flex flex-col justify-center">
                      <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Projected Total Pot</p>
                      <p className="text-4xl font-black text-indigo-900">${financialSummary.totalPot}</p>
                    </div>
                    <div className="bg-indigo-900 p-6 rounded-3xl text-center text-white flex flex-col justify-center shadow-xl">
                      <p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest mb-1">Charity Portion</p>
                      <p className="text-4xl font-black">${financialSummary.charityAmount.toFixed(0)}</p>
                    </div>
                    <div className="bg-green-50 p-6 rounded-3xl text-center flex flex-col justify-center border border-green-100">
                      <p className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-1">Player Pool</p>
                      <p className="text-4xl font-black text-green-700">${financialSummary.playerPot.toFixed(0)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Pools Section */}
            {activeSection === 'pools' && (
              <div className="space-y-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-black text-indigo-900 uppercase">Active Contests</h3>
                  <button onClick={() => setShowCreateForm(!showCreateForm)} className="bg-indigo-900 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] shadow-lg shadow-indigo-100"><i className={`fas ${showCreateForm ? 'fa-times' : 'fa-plus'} mr-2`}></i> {showCreateForm ? 'Cancel' : 'New Contest'}</button>
                </div>

                {showCreateForm ? (
                  <form onSubmit={handleCreatePool} className="bg-indigo-50 p-8 rounded-3xl border border-indigo-100 space-y-6 animate-in slide-in-from-top-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><label className="text-[9px] font-black text-indigo-400 uppercase block mb-1">Grid Name</label><input required value={newPoolData.name} onChange={e => setNewPoolData({ ...newPoolData, name: e.target.value })} className="w-full p-4 bg-white rounded-xl font-bold outline-none" placeholder="e.g. 2025 Big Game" /></div>
                      <div><label className="text-[9px] font-black text-indigo-400 uppercase block mb-1">Cost Per Box ($)</label><input type="number" required value={newPoolData.costPerBox} onChange={e => setNewPoolData({ ...newPoolData, costPerBox: Number(e.target.value) })} className="w-full p-4 bg-white rounded-xl font-bold outline-none" /></div>
                      <div><label className="text-[9px] font-black text-indigo-400 uppercase block mb-1">Vertical Team (Rows)</label><input required value={newPoolData.teamA} onChange={e => setNewPoolData({ ...newPoolData, teamA: e.target.value })} className="w-full p-4 bg-white rounded-xl font-bold outline-none" /></div>
                      <div><label className="text-[9px] font-black text-indigo-400 uppercase block mb-1">Horizontal Team (Cols)</label><input required value={newPoolData.teamB} onChange={e => setNewPoolData({ ...newPoolData, teamB: e.target.value })} className="w-full p-4 bg-white rounded-xl font-bold outline-none" /></div>
                    </div>
                    <button type="submit" className="w-full py-4 bg-indigo-900 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-black transition-all">Initialize Contest Grid</button>
                  </form>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pools.map(p => (
                      <div key={p.id} className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${p.id === activePoolId ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/20' : 'bg-gray-50 border-gray-100'}`}>
                        <div className="truncate pr-4">
                          <p className="font-black text-indigo-900 uppercase text-xs truncate">{p.name}</p>
                          <p className="text-[9px] font-bold text-gray-400 uppercase truncate">{p.settings.teamA} vs {p.settings.teamB} • ${p.settings.costPerBox}/Box</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          {p.id !== activePoolId && <button onClick={() => onSwitchPool(p.id)} className="px-4 py-2 bg-indigo-900 text-white rounded-lg text-[8px] font-black uppercase">Select</button>}
                          <button onClick={() => onDeletePool(p.id)} className="w-8 h-8 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"><i className="fas fa-trash-alt text-[10px]"></i></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Settings Section */}
            {activeSection === 'settings' && (
              <div className="space-y-8">
                <h3 className="text-xl font-black text-indigo-900 uppercase">Selected Contest Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="text-[9px] font-black text-indigo-400 uppercase block mb-1">Grid Display Name</label>
                    <input
                      value={activePool?.name || ''}
                      onChange={e => onUpdateActivePool({ name: e.target.value })}
                      className="w-full p-4 bg-indigo-50 border-none rounded-xl font-black text-indigo-900 uppercase text-sm md:text-lg outline-none focus:ring-4 focus:ring-indigo-500/10"
                    />
                  </div>
                  <div className="bg-green-50/50 p-6 rounded-3xl border border-green-100">
                    <label className="text-[9px] font-black text-green-600 uppercase block mb-2">Cost Per Box ($)</label>
                    <div className="relative">
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 text-xl font-black text-green-300">$</span>
                      <input
                        type="number"
                        value={poolSettings.costPerBox}
                        onChange={e => onUpdatePoolSettings({ costPerBox: Number(e.target.value) })}
                        className="w-full pl-6 pr-4 py-2 bg-transparent border-none font-black text-3xl text-green-700 outline-none"
                      />
                    </div>
                    <p className="text-[8px] font-bold text-green-600 uppercase mt-2">Adjusting this updates all prize/payout estimates.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-[9px] font-black text-indigo-400 uppercase block mb-1">Vertical Team (Rows)</label>
                      <input
                        value={poolSettings.teamA}
                        onChange={e => onUpdatePoolSettings({ teamA: e.target.value })}
                        className="w-full p-4 bg-gray-50 rounded-xl font-bold text-indigo-900 uppercase text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-indigo-400 uppercase block mb-1">Horizontal Team (Cols)</label>
                      <input
                        value={poolSettings.teamB}
                        onChange={e => onUpdatePoolSettings({ teamB: e.target.value })}
                        className="w-full p-4 bg-gray-50 rounded-xl font-bold text-indigo-900 uppercase text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-black text-indigo-400 uppercase block mb-1">Team A Logo (override URL — leave blank to use default)</label>
                      <div className="flex gap-3">
                        <div className="flex gap-3 items-center">
                          <input value={poolSettings.teamALogo || ''} onChange={e => onUpdatePoolSettings({ teamALogo: e.target.value })} onBlur={e => setAndValidateLogoUrl('pool', 'A', e.target.value)} className="flex-1 p-3 bg-white rounded-xl outline-none" placeholder="https://.../logo.png" />

                          <input id="pool-teamA-file" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f, 'pool', 'A'); e.currentTarget.value = ''; }} className="hidden" />
                          <button onClick={() => document.getElementById('pool-teamA-file')?.click()} className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-black">Upload</button>

                          {globalSettings?.dropboxAppKey && <button onClick={() => handleChooseFromDropbox('pool', 'A')} className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-black">Dropbox</button>}
                          {globalSettings?.githubToken && globalSettings?.githubRepo && (
                            <label className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-black cursor-pointer">
                              GH
                              <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadToGitHub(f, 'pool', 'A'); e.currentTarget.value = ''; }} className="hidden" />
                            </label>
                          )}

                          {poolSettings.teamALogo && <button onClick={() => onUpdatePoolSettings({ teamALogo: '' })} className="px-3 py-2 bg-red-50 text-red-500 rounded-xl font-black">Clear</button>}
                        </div>
                      </div>
                      {poolSettings.teamALogo ? <img src={poolSettings.teamALogo} className="mt-3 h-12 object-contain rounded" alt="team A" /> : <p className="text-[9px] text-gray-400 mt-2">Using default logo unless overridden</p>}
                    </div>

                    <div>
                      <label className="text-[9px] font-black text-indigo-400 uppercase block mb-1">Team B Logo (override URL — leave blank to use default)</label>
                      <div className="flex gap-3">
                        <div className="flex gap-3 items-center">
                          <input value={poolSettings.teamBLogo || ''} onChange={e => onUpdatePoolSettings({ teamBLogo: e.target.value })} onBlur={e => setAndValidateLogoUrl('pool', 'B', e.target.value)} className="flex-1 p-3 bg-white rounded-xl outline-none" placeholder="https://.../logo.png" />

                          <input id="pool-teamB-file" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f, 'pool', 'B'); e.currentTarget.value = ''; }} className="hidden" />
                          <button onClick={() => document.getElementById('pool-teamB-file')?.click()} className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-black">Upload</button>

                          {globalSettings?.dropboxAppKey && <button onClick={() => handleChooseFromDropbox('pool', 'B')} className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-black">Dropbox</button>}
                          {globalSettings?.githubToken && globalSettings?.githubRepo && (
                            <label className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-black cursor-pointer">
                              GH
                              <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadToGitHub(f, 'pool', 'B'); e.currentTarget.value = ''; }} className="hidden" />
                            </label>
                          )}

                          {poolSettings.teamBLogo && <button onClick={() => onUpdatePoolSettings({ teamBLogo: '' })} className="px-3 py-2 bg-red-50 text-red-500 rounded-xl font-black">Clear</button>}
                        </div>
                      </div>
                      {poolSettings.teamBLogo ? <img src={poolSettings.teamBLogo} className="mt-3 h-12 object-contain rounded" alt="team B" /> : <p className="text-[9px] text-gray-400 mt-2">Using default logo unless overridden</p>}
                    </div>
                    <div className="md:col-span-2 bg-white p-4 rounded-xl border mt-2">
                      <label className="text-[9px] font-black text-indigo-400 uppercase block mb-2">Payout Mode</label>
                      <div className="flex gap-2 items-center mb-3">
                        <select value={poolSettings.payouts?.mode || 'standard'} onChange={e => onUpdatePoolSettings({ payouts: { ...(poolSettings.payouts || {}), mode: e.target.value as any } })} className="p-3 rounded-lg bg-gray-50 border-none font-black">
                          <option value="standard">Standard (by Quarter)</option>
                          <option value="scoreChange">Score Change (per change)</option>
                        </select>
                      </div>

                      {poolSettings.payouts?.mode === 'scoreChange' ? (
                        <div className="space-y-3">
                          <label className="text-[9px] font-black text-indigo-400 uppercase block">Score Change Multiplier</label>
                          <input type="number" value={poolSettings.payouts?.scoreChangeMultiplier || 3} onChange={e => onUpdatePoolSettings({ payouts: { ...(poolSettings.payouts || {}), scoreChangeMultiplier: Number(e.target.value) } })} className="w-40 p-3 rounded-lg bg-gray-50" />
                          <div className="flex items-center gap-3">
                            <label className="text-[9px] font-black text-indigo-400 uppercase">Applies To</label>
                            <select value={poolSettings.payouts?.scoreChangeAppliesTo || 'perBox'} onChange={e => onUpdatePoolSettings({ payouts: { ...(poolSettings.payouts || {}), scoreChangeAppliesTo: e.target.value as any } })} className="p-2 rounded-lg bg-gray-50">
                              <option value="perBox">Per Box (legacy)</option>
                              <option value="totalPot">Full Pool (total pot)</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="text-[9px] font-black text-indigo-400 uppercase">0-0 Initial Refund</label>
                            <input type="checkbox" checked={!!poolSettings.payouts?.scoreChangeInitialRefund} onChange={e => onUpdatePoolSettings({ payouts: { ...(poolSettings.payouts || {}), scoreChangeInitialRefund: e.target.checked } })} />
                          </div>
                          <p className="text-[10px] text-gray-500">Payout multiplier applied each time the score changes. When set to Full Pool, each change pays `totalPot * multiplier`. The final/"Final" entry receives the player pot remaining after charity.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <label className="text-[9px] font-black text-indigo-400 uppercase block">Standard Splits</label>
                          <div className="grid grid-cols-2 gap-2">
                            <input type="number" value={poolSettings.payouts?.standardSplits?.q1 || 0} onChange={e => onUpdatePoolSettings({ payouts: { ...(poolSettings.payouts || {}), standardSplits: { ...(poolSettings.payouts?.standardSplits || {}), q1: Number(e.target.value) } } })} className="p-3 rounded-lg bg-gray-50" placeholder="Q1 %" />
                            <input type="number" value={poolSettings.payouts?.standardSplits?.half || 0} onChange={e => onUpdatePoolSettings({ payouts: { ...(poolSettings.payouts || {}), standardSplits: { ...(poolSettings.payouts?.standardSplits || {}), half: Number(e.target.value) } } })} className="p-3 rounded-lg bg-gray-50" placeholder="Half %" />
                            <input type="number" value={poolSettings.payouts?.standardSplits?.q3 || 0} onChange={e => onUpdatePoolSettings({ payouts: { ...(poolSettings.payouts || {}), standardSplits: { ...(poolSettings.payouts?.standardSplits || {}), q3: Number(e.target.value) } } })} className="p-3 rounded-lg bg-gray-50" placeholder="Q3 %" />
                            <input type="number" value={poolSettings.payouts?.standardSplits?.final || 0} onChange={e => onUpdatePoolSettings({ payouts: { ...(poolSettings.payouts || {}), standardSplits: { ...(poolSettings.payouts?.standardSplits || {}), final: Number(e.target.value) } } })} className="p-3 rounded-lg bg-gray-50" placeholder="Final %" />
                          </div>
                          <div className="flex gap-2 items-center">
                            <label className="text-[9px] font-black text-indigo-400 uppercase">Charity</label>
                            <select value={poolSettings.payouts?.charityPayoutType || 'percent'} onChange={e => onUpdatePoolSettings({ payouts: { ...(poolSettings.payouts || {}), charityPayoutType: e.target.value as any } })} className="p-2 rounded-lg bg-gray-50">
                              <option value="percent">Percent</option>
                              <option value="fixed">Fixed</option>
                            </select>
                            {poolSettings.payouts?.charityPayoutType === 'fixed' ? (
                              <input type="number" value={poolSettings.payouts?.charityFixedAmount || 0} onChange={e => onUpdatePoolSettings({ payouts: { ...(poolSettings.payouts || {}), charityFixedAmount: Number(e.target.value) } })} className="p-2 rounded-lg bg-gray-50 w-32" />
                            ) : (
                              <input type="number" value={poolSettings.payouts?.charityPercent || 0} onChange={e => onUpdatePoolSettings({ payouts: { ...(poolSettings.payouts || {}), charityPercent: Number(e.target.value) } })} className="p-2 rounded-lg bg-gray-50 w-32" />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Axis Numbers Section */}
            {activeSection === 'axis' && (
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-xl font-black text-indigo-900 uppercase tracking-tight">Grid Axis Numbers</h3>
                    <p className="text-[9px] font-black text-indigo-400 uppercase">Values 0-9 for grid coordinates</p>
                  </div>
                  <button onClick={onGenerateNumbers} className="w-full md:w-auto bg-indigo-900 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] shadow-lg shadow-indigo-100 hover:bg-black transition-all"><i className="fas fa-random mr-2"></i> Randomize Numbers</button>
                </div>
                <div className="space-y-10">
                  <div className="axis-row">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-4"><label className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">{poolSettings.teamA} (Vertical)</label><ValidationBadge status={rowStatus} /></div>
                      <button onClick={() => clearAxis('row')} className="text-[8px] font-black text-red-400 uppercase"><i className="fas fa-eraser mr-1"></i> Clear</button>
                    </div>
                    <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <input key={`row-${i}`} type="text" maxLength={1} onFocus={(e) => e.target.select()} value={poolSettings.rowNumbers[i] ?? ''} onChange={(e) => handleAxisNumberChange(e, 'row', i)} className="w-full h-12 text-center bg-gray-50 border-2 border-gray-100 rounded-xl font-black text-indigo-900 outline-none focus:border-indigo-500" placeholder="?" />
                      ))}
                    </div>
                  </div>
                  <div className="axis-row">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-4"><label className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">{poolSettings.teamB} (Horizontal)</label><ValidationBadge status={colStatus} /></div>
                      <button onClick={() => clearAxis('col')} className="text-[8px] font-black text-red-400 uppercase"><i className="fas fa-eraser mr-1"></i> Clear</button>
                    </div>
                    <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <input key={`col-${i}`} type="text" maxLength={1} onFocus={(e) => e.target.select()} value={poolSettings.colNumbers[i] ?? ''} onChange={(e) => handleAxisNumberChange(e, 'col', i)} className="w-full h-12 text-center bg-gray-50 border-2 border-gray-100 rounded-xl font-black text-indigo-900 outline-none focus:border-indigo-500" placeholder="?" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Participants/Add Names Section */}
            {activeSection === 'participants' && (
              <div className="space-y-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <h3 className="text-xl font-black text-indigo-900 uppercase">Add Participants</h3>
                    <button onClick={() => setShowAllParticipantsList(s => !s)} className="text-[11px] font-black text-indigo-400 uppercase bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-all">
                      {showAllParticipantsList ? 'Showing: All' : 'Show all names'}
                    </button>
                  </div>

                  <button onClick={() => setShowAddNameForm(!showAddNameForm)} className="bg-indigo-900 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] shadow-lg shadow-indigo-100"><i className={`fas ${showAddNameForm ? 'fa-times' : 'fa-plus'} mr-2`}></i> {showAddNameForm ? 'Cancel' : 'Add Person'}</button>
                </div>

                {showAddNameForm && (
                  <form onSubmit={handleAddName} className="bg-indigo-50 p-8 rounded-3xl border border-indigo-100 space-y-6 animate-in slide-in-from-top-4">
                    <p className="text-[10px] text-indigo-600 font-black uppercase">Alias is optional now and can be set when they pick a box</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><label className="text-[9px] font-black text-indigo-400 uppercase block mb-1">Full Name</label><input required value={newNameData.name} onChange={e => setNewNameData({ ...newNameData, name: e.target.value })} className="w-full p-4 bg-white rounded-xl font-bold outline-none" placeholder="e.g. John Smith" /></div>
                      <div><label className="text-[9px] font-black text-indigo-400 uppercase block mb-1">Email (Optional)</label><input type="email" value={newNameData.email} onChange={e => setNewNameData({ ...newNameData, email: e.target.value })} className="w-full p-4 bg-white rounded-xl font-bold outline-none" placeholder="john@example.com" /></div>
                      <div><label className="text-[9px] font-black text-indigo-400 uppercase block mb-1">Phone (Optional)</label><input type="tel" value={newNameData.phone} onChange={e => setNewNameData({ ...newNameData, phone: e.target.value })} className="w-full p-4 bg-white rounded-xl font-bold outline-none" placeholder="555-1234" /></div>
                      <div><label className="text-[9px] font-black text-indigo-400 uppercase block mb-1">Alias (Optional for now)</label><input value={newNameData.alias} onChange={e => setNewNameData({ ...newNameData, alias: e.target.value })} className="w-full p-4 bg-white rounded-xl font-bold outline-none" placeholder="e.g. JSmith" /></div>
                    </div>
                    <button type="submit" className="w-full py-4 bg-indigo-900 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-black transition-all">Add to Participant List</button>
                  </form>
                )}

                {/* Participants List */}
                {((showAllParticipantsList ? (allParticipants || participants) : (activePool?.participants || participants)) || []).length > 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50">
                            <th className="text-left px-6 py-4 text-[9px] font-black text-indigo-400 uppercase min-w-[220px]">Name</th>
                            <th className="text-left px-6 py-4 text-[9px] font-black text-indigo-400 uppercase">Email</th>
                            <th className="text-left px-6 py-4 text-[9px] font-black text-indigo-400 uppercase">Phone</th>
                            <th className="text-left px-6 py-4 text-[9px] font-black text-indigo-400 uppercase">Alias</th>
                            <th className="text-center px-6 py-4 text-[9px] font-black text-indigo-400 uppercase">Boxes</th>
                            <th className="text-center px-6 py-4 text-[9px] font-black text-indigo-400 uppercase">Total Played</th>
                            <th className="text-center px-6 py-4 text-[9px] font-black text-indigo-400 uppercase">Total Owed</th>
                            <th className="text-center px-6 py-4 text-[9px] font-black text-indigo-400 uppercase">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {((showAllParticipantsList ? (allParticipants || participants) : (activePool?.participants || participants)) || []).sort((a, b) => a.name.localeCompare(b.name)).map((p) => {
                            const boxCount = (activePool?.squares || []).filter(s => s.participantId === p.id).length;
                            const costPerBox = poolSettings?.costPerBox || 10;
                            const totalPaid = (p.paymentHistory || []).reduce((s, t) => s + (t.amount || 0), 0);
                            const totalDue = boxCount * costPerBox;
                            const totalOwed = Math.max(0, totalDue - totalPaid);

                            // gather boxes across all contests/pools
                            const boxesAcrossPools = (pools || []).map(pool => ({
                              poolId: pool.id,
                              poolName: pool.name,
                              boxIds: (pool.squares || []).filter(sq => sq.participantId === p.id).map(sq => sq.id)
                            })).filter(x => (x.boxIds || []).length > 0);

                            const fmt = (n: number) => `$${n.toFixed(2)}`;
                            const isInActivePool = (activePool?.participants || []).some(pp => pp.id === p.id);

                            return (
                              <React.Fragment key={p.id}>
                                <tr className="border-b border-gray-100 hover:bg-indigo-50/30 transition-all">
                                  <td className="px-6 py-4 text-sm font-bold text-indigo-900">{p.name}{!isInActivePool && showAllParticipantsList && <span className="ml-3 text-[10px] px-2 py-1 bg-indigo-50 text-indigo-500 rounded">global</span>}</td>
                                  <td className="px-6 py-4 text-sm text-gray-600">{p.email || '-'}</td>
                                  <td className="px-6 py-4 text-sm text-gray-600">{p.phone || '-'}</td>
                                  <td className="px-6 py-4 text-sm font-bold text-indigo-600 uppercase">{p.alias || <span className="text-gray-400">Not set</span>}</td>
                                  <td className="px-6 py-4 text-center text-sm font-bold text-indigo-900">{boxCount}</td>
                                  <td className="px-6 py-4 text-center text-sm font-bold text-indigo-900">{fmt(totalPaid)}</td>
                                  <td className="px-6 py-4 text-center text-sm font-bold text-red-500">{fmt(totalOwed)}</td>
                                  <td className="px-6 py-4 text-center flex items-center justify-center gap-2">
                                    <button title="Show boxes (all contests)" onClick={() => setSelectedParticipantBoxes(selectedParticipantBoxes === p.id ? null : p.id)} className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"><i className="fas fa-eye text-[10px]"></i></button>
                                    {!isInActivePool && showAllParticipantsList ? (
                                      <button title="Add to active pool" onClick={() => addExistingParticipantToPool(p)} className="w-8 h-8 bg-green-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all"><i className="fas fa-plus text-[10px]"></i></button>
                                    ) : (
                                      <button onClick={() => handleDeleteParticipant(p.id)} className="w-8 h-8 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"><i className="fas fa-trash-alt text-[10px]"></i></button>
                                    )}
                                  </td>
                                </tr>

                                {selectedParticipantBoxes === p.id && (
                                  <tr className="bg-gray-50">
                                    <td colSpan={8} className="px-6 py-4 text-sm text-gray-700">
                                      <div className="grid gap-3 md:grid-cols-2">
                                        {boxesAcrossPools.length === 0 ? (
                                          <div className="text-sm text-gray-500">No boxes assigned across any contests.</div>
                                        ) : (
                                          boxesAcrossPools.map(bp => (
                                            <div key={bp.poolId} className="p-3 bg-white rounded-xl border">
                                              <div className="text-xs font-black text-indigo-500 uppercase mb-2">{bp.poolName}</div>
                                              <div className="text-sm text-indigo-900 font-bold">{bp.boxIds.map(id => `#${id + 1}`).join(', ')}</div>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-8 text-center">
                    <p className="text-[11px] font-black text-indigo-600 uppercase">No participants added yet</p>
                    <p className="text-[9px] text-indigo-500 mt-2">Click "Add Person" to start building your participant list</p>
                  </div>
                )}
              </div>
            )}

            {/* Winners Section */}
            {activeSection === 'winners' && (
              <Winners activePool={activePool!} settings={{ ...globalSettings, ...poolSettings }} onAddScore={onAddScore} onUpdateScore={onUpdateScore} onDeleteScore={onDeleteScore} isAdmin={true} />
            )}

            {/* Stats Section */}
            {activeSection === 'stats' && (
              <Stats squares={squares} participants={participants} settings={{ ...globalSettings, ...poolSettings }} onUpdateSquare={onUpdateSquare} onUpdateParticipant={onUpdateParticipant} onUnassignSquare={onUnassignSquare} onClearUserBoxes={onClearUserBoxes} onApplyPayment={onApplyPayment} onEditPayment={onEditPayment} onDeletePayment={onDeletePayment} />
            )}

            {/* Global Organization Settings Section */}
            {activeSection === 'global' && (
              <div className="space-y-8">
                <h3 className="text-xl font-black text-indigo-900 uppercase">Global Organization Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div><label className="text-[9px] font-black text-indigo-400 uppercase mb-1 block">Main Organization/Charity Name</label><input onFocus={(e) => e.target.select()} value={globalSettings?.charityName || ''} onChange={e => onUpdateGlobalSettings({ charityName: e.target.value })} className="w-full px-5 py-4 bg-indigo-50 border-none rounded-2xl font-black text-indigo-900 uppercase text-sm" /></div>

                  <div>
                    <label className="text-[9px] font-black text-indigo-400 uppercase mb-1 block">Board Rules (for printout)</label>
                    <textarea
                      value={globalSettings?.rulesText || ''}
                      onChange={e => onUpdateGlobalSettings({ rulesText: e.target.value })}
                      className="w-full px-5 py-4 bg-indigo-50 border-none rounded-2xl font-mono text-indigo-900 text-xs min-h-[120px]"
                      placeholder={"How to Play:\n- Pick any open square(s) on the board and claim with your name/alias.\n- Once all squares are filled, the numbers 0-9 are randomly assigned to each row and column.\n- At the end of each quarter, the last digit of each team's score determines the winning square (row = Team A, column = Team B).\n- Payouts and charity split are shown in the contest details.\n- Pay for your squares using the provided payment options. Unpaid squares may be reassigned.\n- See the 'Winners' tab for live results and payout info."}
                    />
                    <p className="text-[9px] text-gray-400 mt-1">This text appears at the top of the printed board. Leave blank to use the default rules.</p>
                  </div>
                  <div><label className="text-[9px] font-black text-indigo-400 uppercase mb-1 block">Administrative Password</label><input type="text" onFocus={(e) => e.target.select()} value={globalSettings?.adminPassword || ''} onChange={e => onUpdateGlobalSettings({ adminPassword: e.target.value })} className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-black text-indigo-900 uppercase text-sm" /></div>
                  <div><label className="text-[9px] font-black text-indigo-400 uppercase mb-1 block">Venmo Link/Username</label><input type="text" value={globalSettings?.venmoAccount || ''} onChange={e => onUpdateGlobalSettings({ venmoAccount: e.target.value })} className="w-full px-5 py-4 bg-blue-50/50 rounded-2xl font-black text-indigo-900 text-sm" /></div>
                  <div><label className="text-[9px] font-black text-indigo-400 uppercase mb-1 block">Zelle Account Info</label><input type="text" value={globalSettings?.zelleAccount || ''} onChange={e => onUpdateGlobalSettings({ zelleAccount: e.target.value })} className="w-full px-5 py-4 bg-purple-50 rounded-2xl font-black text-indigo-900 text-sm" /></div>

                  <div>
                    <label className="text-[9px] font-black text-indigo-400 uppercase mb-1 block">Default Team A Logo (URL)</label>
                    <div className="flex gap-3">
                      <div className="flex gap-3 items-center">
                        <input value={teamALogoInput} onChange={e => setTeamALogoInput(e.target.value)} onBlur={async (e) => { const saved = await setAndValidateLogoUrl('global', 'A', teamALogoInput); if (!saved) setTeamALogoInput(globalSettings?.teamALogo || ''); }} className="flex-1 px-5 py-3 bg-white rounded-2xl font-black text-indigo-900 text-sm" placeholder="https://.../logo.png" />

                        <input id="global-teamA-file" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f, 'global', 'A'); e.currentTarget.value = ''; }} className="hidden" />
                        <button onClick={() => document.getElementById('global-teamA-file')?.click()} className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-black">Upload</button>

                        {globalSettings?.dropboxAppKey && <button onClick={() => handleChooseFromDropbox('global', 'A')} className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-black">Dropbox</button>}
                        {globalSettings?.githubToken && globalSettings?.githubRepo && (
                          <label className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-black cursor-pointer">
                            GH
                            <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadToGitHub(f, 'global', 'A'); e.currentTarget.value = ''; }} className="hidden" />
                          </label>
                        )}

                        {globalSettings?.teamALogo && <button onClick={() => onUpdateGlobalSettings({ teamALogo: '' })} className="px-3 py-2 bg-red-50 text-red-500 rounded-xl font-black">Clear</button>}
                      </div>
                      {globalSettings?.teamALogo && <img src={globalSettings.teamALogo} alt="Team A" className="mt-3 h-12 object-contain rounded" />}                      </div>
                    <div className="mt-4 grid grid-cols-1 gap-3">
                      <div>
                        <label className="text-[9px] font-black text-indigo-400 uppercase mb-1 block">GitHub Token (optional)</label>
                        <input type="password" value={globalSettings?.githubToken || ''} onChange={e => onUpdateGlobalSettings({ githubToken: e.target.value })} className="w-full px-5 py-3 bg-white rounded-2xl font-black text-indigo-900 text-sm" placeholder="ghp_xxx (stored in DB)" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-indigo-400 uppercase mb-1 block">GitHub Repo (owner/repo)</label>
                        <input value={globalSettings?.githubRepo || ''} onChange={e => onUpdateGlobalSettings({ githubRepo: e.target.value })} className="w-full px-5 py-3 bg-white rounded-2xl font-black text-indigo-900 text-sm" placeholder="yourname/your-repo (for hosting)" />
                        <p className="text-[9px] text-gray-400 mt-1">If set, Admin can upload logos to this repo using the token above.</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-indigo-400 uppercase mb-1 block">Default Team B Logo (URL)</label>
                    <div className="flex gap-3 items-center">
                      <input value={teamBLogoInput} onChange={e => setTeamBLogoInput(e.target.value)} onBlur={async (e) => { const saved = await setAndValidateLogoUrl('global', 'B', teamBLogoInput); if (!saved) setTeamBLogoInput(globalSettings?.teamBLogo || ''); }} className="flex-1 px-5 py-3 bg-white rounded-2xl font-black text-indigo-900 text-sm" placeholder="https://.../logo.png" />

                      <input id="global-teamB-file" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f, 'global', 'B'); e.currentTarget.value = ''; }} className="hidden" />
                      <button onClick={() => document.getElementById('global-teamB-file')?.click()} className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-black">Upload</button>

                      {globalSettings?.dropboxAppKey && <button onClick={() => handleChooseFromDropbox('global', 'B')} className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-black">Dropbox</button>}
                      {globalSettings?.githubToken && globalSettings?.githubRepo && (
                        <label className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-black cursor-pointer">
                          GH
                          <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadToGitHub(f, 'global', 'B'); e.currentTarget.value = ''; }} className="hidden" />
                        </label>
                      )}

                      {globalSettings?.teamBLogo && <button onClick={() => onUpdateGlobalSettings({ teamBLogo: '' })} className="px-3 py-2 bg-red-50 text-red-500 rounded-xl font-black">Clear</button>}
                    </div>
                    {globalSettings?.teamBLogo && <img src={globalSettings.teamBLogo} alt="Team B" className="mt-3 h-12 object-contain rounded" />}
                  </div>
                </div>
              </div>
            )}

            {/* Danger Zone Section */}
            {activeSection === 'danger' && (
              <div className="space-y-8">
                <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-2xl">
                  <h3 className="text-lg font-black text-red-700 uppercase mb-2">Danger Zone</h3>
                  <p className="text-sm text-red-600 mb-6">These actions are irreversible. Proceed with caution.</p>
                  <button onClick={onResetGrid} className="w-full py-4 text-red-500 font-black uppercase text-[10px] hover:bg-red-100 rounded-2xl border-2 border-dashed border-red-300 transition-all">Reset All Boxes for Active Grid</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
