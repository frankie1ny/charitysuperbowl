
import React, { useMemo, useState, useRef, useEffect } from 'react';
import BoardPrintHeader from './BoardPrintHeader';
import { Square, GameSettings, Participant, Pool, ScoreEntry } from '../types';

interface GridProps {
  squares: Square[];
  pendingSelection: number[];
  settings: GameSettings;
  onSquareClick: (id: number) => void;
  participants: Participant[];
  onCheckout?: () => void;
  onSetPendingSelection?: (ids: number[]) => void;
  activePool: Pool;
}

const Grid: React.FC<GridProps> = ({ squares, pendingSelection, settings, onSquareClick, participants, onCheckout, onSetPendingSelection, activePool }) => {
  // Use custom rules if set, else fallback to default
  const rules = settings.rulesText && settings.rulesText.trim().length > 0
    ? settings.rulesText
    : `How to Play:\n- Pick any open square(s) on the board and claim with your name/alias.\n- Once all squares are filled, the numbers 0-9 are randomly assigned to each row and column.\n- At the end of each quarter, the last digit of each team's score determines the winning square (row = Team A, column = Team B).\n- Payouts and charity split are shown in the contest details.\n- Pay for your squares using the provided payment options. Unpaid squares may be reassigned.\n- See the 'Winners' tab for live results and payout info.`;
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [zoom, setZoom] = useState(1);
  const gridRef = useRef<HTMLDivElement>(null);
  const lastTouchDist = useRef<number | null>(null);

  // Automatic Fit-to-Width Logic
  useEffect(() => {
    const fitToWidth = () => {
      if (gridRef.current) {
        const container = gridRef.current;
        const innerContent = container.querySelector('.grid-inner-content') as HTMLElement;

        if (innerContent) {
          const containerWidth = container.clientWidth - 40; // Allow some padding
          const boardWidth = innerContent.offsetWidth;

          if (boardWidth > 0) {
            const calculatedZoom = containerWidth / boardWidth;
            setZoom(Math.min(1.0, parseFloat(calculatedZoom.toFixed(2))));
          }
        }
      }
    };

    const timer = setTimeout(fitToWidth, 300);
    window.addEventListener('resize', fitToWidth);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', fitToWidth);
    };
  }, []);

  const participantMap = useMemo(() => {
    const map: Record<string, Participant> = {};
    (participants || []).forEach(p => {
      map[p.id] = p;
    });
    return map;
  }, [participants]);

  const getLabel = (type: 'row' | 'col', index: number) => {
    const list = type === 'row' ? settings.rowNumbers : settings.colNumbers;
    return (list && list.length > 0) ? list[index] : '?';
  };

  const rows = useMemo(() => Array.from({ length: 10 }, (_, rowIndex) =>
    (squares || []).filter(sq => sq.row === rowIndex)
  ), [squares]);

  const winningSquareIds = useMemo(() => {
    const ids = new Set<number>();
    const { scores = [] } = activePool;
    const { rowNumbers, colNumbers } = settings;

    (scores || []).forEach(s => {
      const lastDigitA = s.teamAScore % 10;
      const lastDigitB = s.teamBScore % 10;
      const rowIndex = (rowNumbers || []).indexOf(lastDigitA);
      const colIndex = (colNumbers || []).indexOf(lastDigitB);

      if (rowIndex !== -1 && colIndex !== -1) {
        const winningSquare = squares.find(sq => sq.row === rowIndex && sq.col === colIndex);
        if (winningSquare) ids.add(winningSquare.id);
      }
    });
    return ids;
  }, [activePool.scores, squares, settings.rowNumbers, settings.colNumbers]);

  const stats = useMemo(() => {
    const assignedCount = squares.filter(s => s.assigned).length;
    const costPerBox = settings.costPerBox || 10;
    const totalRaised = squares.reduce((acc, sq) => acc + (sq.paidAmount || 0), 0);
    const potentialTotal = 100 * costPerBox;
    const totalCommitted = assignedCount * costPerBox;

    return {
      assigned: assignedCount,
      remaining: 100 - assignedCount,
      totalRaised,
      totalCommitted,
      potentialTotal
    };
  }, [squares, settings.costPerBox]);

  const prizeBreakdown = useMemo(() => {
    const { payouts, costPerBox } = settings;
    const totalPot = 100 * costPerBox;

    if (payouts.mode === 'scoreChange') {
      return {
        isScoreChange: true,
        multiplier: payouts.scoreChangeMultiplier,
        perChange: costPerBox * payouts.scoreChangeMultiplier,
        charity: payouts.charityPayoutType === 'fixed' ? payouts.charityFixedAmount : (totalPot * (payouts.charityPercent / 100))
      };
    }

    let charityAmount = 0;
    if (payouts.charityPayoutType === 'fixed') {
      charityAmount = payouts.charityFixedAmount || 0;
    } else {
      charityAmount = totalPot * (payouts.charityPercent / 100);
    }

    const playerPot = totalPot - charityAmount;

    const calculatePrize = (val: number) => {
      return payouts.standardPayoutType === 'fixed' ? val : (playerPot * (val / 100));
    };

    return {
      isScoreChange: false,
      q1: calculatePrize(payouts.standardSplits.q1),
      half: calculatePrize(payouts.standardSplits.half),
      q3: calculatePrize(payouts.standardSplits.q3),
      final: calculatePrize(payouts.standardSplits.final),
      charity: charityAmount
    };
  }, [settings]);

  const liveWinners = useMemo(() => {
    const { scores = [] } = activePool;
    const { payouts, costPerBox, rowNumbers, colNumbers } = settings;
    const totalPot = 100 * costPerBox;

    let charityAmount = 0;
    if (payouts.charityPayoutType === 'fixed') {
      charityAmount = payouts.charityFixedAmount || 0;
    } else {
      charityAmount = totalPot * (payouts.charityPercent / 100);
    }

    const payoutPot = totalPot - charityAmount;

    return (scores || []).map((s, index) => {
      const lastDigitA = s.teamAScore % 10;
      const lastDigitB = s.teamBScore % 10;
      const rowIndex = (rowNumbers || []).indexOf(lastDigitA);
      const colIndex = (colNumbers || []).indexOf(lastDigitB);

      const winnerSquare = squares.find(sq => sq.row === rowIndex && sq.col === colIndex);

      let payout = 0;
      if (payouts.mode === 'standard') {
        if (payouts.standardPayoutType === 'fixed') {
          payout = payouts.standardSplits[s.label.toLowerCase() as keyof typeof payouts.standardSplits] || 0;
        } else {
          const split = payouts.standardSplits[s.label.toLowerCase() as keyof typeof payouts.standardSplits] || 0;
          payout = payoutPot * (split / 100);
        }
      } else {
        const isZeroZero = s.teamAScore === 0 && s.teamBScore === 0;
        const previousZeroZero = scores.slice(0, index).some(prev => prev.teamAScore === 0 && prev.teamBScore === 0);
        payout = (isZeroZero && !previousZeroZero) ? costPerBox : (costPerBox * (payouts.scoreChangeMultiplier || 3));
      }

      return { label: s.label, score: `${s.teamAScore}-${s.teamBScore}`, winner: winnerSquare?.assigned ? winnerSquare.alias : (winnerSquare ? 'UNCLAIMED' : 'PENDING'), payout };
    }).reverse();
  }, [activePool.scores, settings, squares]);

  const handleStandardPrint = () => {
    window.print();
    setShowExportMenu(false);
  };

  const handleIsolatedPrint = () => {
    if (gridRef.current) {
      const content = gridRef.current.innerHTML;
      if ((window as any).openPrintWindow) {
        (window as any).openPrintWindow(content);
      }
    }
    setShowExportMenu(false);
  };

  const handleExportCSV = () => {
    const headers = ["Square #", "Row Num", "Col Num", "Player Alias", "Real Name", "Email", "Phone", "Status"];
    const csvRows = (squares || []).map(sq => {
      const p = sq.participantId ? participantMap[sq.participantId] : null;
      return [
        sq.id + 1,
        getLabel('row', sq.row),
        getLabel('col', sq.col),
        sq.assigned ? sq.alias : "Unassigned",
        p ? p.name : "",
        p ? p.email : "",
        p ? p.phone : "",
        sq.paidAmount >= settings.costPerBox ? "Paid" : (sq.assigned ? "Pending" : "Available")
      ];
    });

    csvRows.sort((a, b) => {
      const phoneA = String(a[6] || "").replace(/\D/g, '');
      const phoneB = String(b[6] || "").replace(/\D/g, '');
      if (!phoneA && phoneB) return 1;
      if (phoneA && !phoneB) return -1;
      return phoneA.localeCompare(phoneB);
    });

    const content = [headers, ...csvRows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `grid_mapping_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    setShowExportMenu(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      lastTouchDist.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDist.current !== null) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      const delta = dist / lastTouchDist.current;
      setZoom(prev => {
        const nextZoom = Math.min(Math.max(0.1, prev * delta), 2.5);
        return parseFloat(nextZoom.toFixed(2));
      });
      lastTouchDist.current = dist;
    }
  };

  const handleTouchEnd = () => {
    lastTouchDist.current = null;
  };

  const LABEL_WIDTH_CLASS = "w-28 md:w-40";
  const ROW_NUM_WIDTH_CLASS = "w-14 md:w-28";
  const TEAM_VERTICAL_WIDTH_CLASS = "w-20 md:w-40";
  // LEFT_SPACER matches TEAM_VERTICAL_WIDTH_CLASS + ROW_NUM_WIDTH_CLASS
  const LEFT_SPACER_CLASS = "min-w-[136px] md:min-w-[272px]";

  return (
    <div id="board-container" className="print-board-root flex flex-col items-center w-full relative">
      {/* Print header with rules and print button */}
      <BoardPrintHeader onPrint={handleStandardPrint} rules={rules} />
      <div
        ref={gridRef}
        className="w-full overflow-auto max-h-[85vh] pb-8 mb-4 touch-pan-x touch-pan-y custom-scrollbar print:overflow-visible relative flex justify-center"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="inline-block p-4 print:p-0 min-w-max transition-transform duration-300 origin-top"
          style={{ transform: `scale(${zoom})` }}
        >
          <div className="grid-inner-content flex flex-col">
            <div className="flex items-end">
              <div className={`${LEFT_SPACER_CLASS} flex-shrink-0`}></div>
              <div className="flex flex-col items-center w-full">
                <div className="bg-indigo-900 border-2 border-indigo-900 py-6 rounded-t-[3rem] shadow-sm mb-0 w-full flex items-center justify-center gap-12">
                  {settings.teamBLogo ? (
                    <img src={settings.teamBLogo} className="h-8 md:h-16 w-auto object-contain drop-shadow-lg" alt="Team B Logo" />
                  ) : (
                    <i className="fas fa-helmet-safety text-white/50 text-xl md:text-3xl"></i>
                  )}
                  <span className="text-2xl md:text-5xl lg:text-6xl font-black text-white uppercase tracking-[0.2em] whitespace-nowrap leading-tight text-center max-w-[50%]">
                    {settings.teamB || 'AFC'}
                  </span>
                  {settings.teamBLogo ? (
                    <img src={settings.teamBLogo} className="h-8 md:h-16 w-auto object-contain drop-shadow-lg" alt="Team B Logo" />
                  ) : (
                    <i className="fas fa-helmet-safety text-white/50 text-xl md:text-3xl"></i>
                  )}
                </div>
                <div className="flex gap-[1px] md:gap-[2px] w-full">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className={`${LABEL_WIDTH_CLASS} h-10 md:h-14 flex items-center justify-center font-black text-sm md:text-2xl text-indigo-900 bg-indigo-50 rounded-t-lg border-b border-indigo-200`}>{getLabel('col', i)}</div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex">
              <div className={`${TEAM_VERTICAL_WIDTH_CLASS} flex flex-col items-center justify-center bg-indigo-900 rounded-l-[3rem] shadow-lg mr-1 md:mr-2 flex-shrink-0 py-24 px-1`}>
                {settings.teamALogo ? (
                  <img src={settings.teamALogo} className="w-18 md:w-36 h-auto object-contain drop-shadow-lg mb-16 -rotate-90" alt="Team A Logo" />
                ) : (
                  <i className="fas fa-helmet-safety text-white/30 text-lg md:text-3xl mb-16"></i>
                )}
                <span className="text-xl md:text-4xl lg:text-5xl font-black text-white uppercase tracking-[0.15em] whitespace-nowrap [writing-mode:vertical-lr] rotate-180 leading-none">
                  {settings.teamA || 'NFC'}
                </span>
                {settings.teamALogo ? (
                  <img src={settings.teamALogo} className="w-18 md:w-36 h-auto object-contain drop-shadow-lg mt-16 -rotate-90" alt="Team A Logo" />
                ) : (
                  <i className="fas fa-helmet-safety text-white/30 text-lg md:text-3xl mt-16"></i>
                )}
              </div>
              <div className="flex flex-col gap-[1px] md:gap-[2px] mr-[1px] md:mr-[2px] flex-shrink-0">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className={`axis-label h-24 md:h-36 ${ROW_NUM_WIDTH_CLASS} flex items-center justify-center font-black text-sm md:text-2xl text-white bg-indigo-800 border-r border-indigo-900/50`}>{getLabel('row', i)}</div>
                ))}
              </div>
              <div className="grid-body-container flex flex-col gap-[1px] md:gap-[2px] bg-indigo-900 border-2 md:border-4 border-indigo-900 rounded-tr-lg rounded-br-lg overflow-hidden shadow-2xl">
                {rows.map((rowSquares, rowIndex) => (
                  <div key={rowIndex} className="flex gap-[1px] md:gap-[2px]">
                    {rowSquares.map((sq) => {
                      const cost = settings?.costPerBox || 10;
                      const paid = sq.paidAmount || 0;
                      const isFullyPaid = paid >= cost && cost > 0;
                      const isPartiallyPaid = paid > 0 && !isFullyPaid;
                      const isPendingInCart = pendingSelection.includes(sq.id);
                      const displayAlias = sq.alias.slice(0, 16).toUpperCase();
                      const participant = sq.participantId ? participantMap[sq.participantId] : null;
                      const fullName = participant ? participant.name : '';
                      const isWinner = winningSquareIds.has(sq.id);

                      return (
                        <div
                          key={sq.id}
                          title={sq.assigned ? `Player: ${fullName}\nAlias: ${displayAlias}` : `Box #${sq.id + 1}`}
                          className={`group square-box cursor-pointer ${LABEL_WIDTH_CLASS} h-24 md:h-36 flex flex-col items-center justify-center p-2 transition-all relative ${isWinner ? 'bg-yellow-100 !border-yellow-300' :
                            sq.assigned ? (isFullyPaid ? 'bg-green-50' : (isPartiallyPaid ? 'bg-orange-50' : 'bg-indigo-50')) :
                              (isPendingInCart ? 'bg-indigo-600 ring-4 ring-indigo-400/50 scale-95 z-10 shadow-inner' : (settings?.isLocked ? 'bg-gray-100' : 'bg-white'))
                            }`}
                          onClick={() => onSquareClick(sq.id)}
                        >
                          <span className={`absolute inset-0 flex items-center justify-center text-[24px] md:text-[48px] font-black pointer-events-none transition-opacity ${isPendingInCart ? 'text-white/10' : 'text-indigo-950/10'} ${sq.assigned ? 'opacity-20' : ''}`}>{sq.id + 1}</span>

                          {sq.assigned ? (
                            <div className="flex flex-col items-center justify-center w-full h-full relative z-10 text-center overflow-hidden">
                              <span className={`text-[10px] md:text-[14px] font-black ${isFullyPaid ? 'text-green-600' : 'text-indigo-950'} uppercase leading-tight line-clamp-3 break-words w-full group-hover:hidden px-1`}>
                                {displayAlias}
                              </span>
                              <span className={`hidden group-hover:block text-[9px] md:text-[12px] font-black ${isFullyPaid ? 'text-green-700' : 'text-indigo-800'} uppercase leading-tight line-clamp-3 break-words w-full animate-in fade-in duration-200 px-1 italic`}>
                                {fullName}
                              </span>
                            </div>
                          ) : isPendingInCart ? (
                            <div className="animate-pulse no-print relative z-10"><i className="fas fa-shopping-cart text-white text-[12px] md:text-[18px]"></i></div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-controls w-full max-w-5xl flex flex-col md:flex-row items-center justify-between mb-8 print-hidden px-4 gap-4 z-[90] relative">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 relative">
            <button
              type="button"
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="bg-white text-indigo-900 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center gap-3 border-2 border-indigo-100 shadow-xl cursor-pointer active:scale-95 select-none"
            >
              <i className="fas fa-file-export text-indigo-600"></i> Export & Print
              <i className={`fas fa-chevron-${showExportMenu ? 'up' : 'down'} text-[8px] transition-transform`}></i>
            </button>

            {showExportMenu && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-indigo-50 p-2 animate-in slide-in-from-top-2 duration-200 z-[100]">
                <button onClick={handleStandardPrint} className="w-full text-left px-4 py-3 hover:bg-indigo-50 rounded-xl flex items-center gap-3 transition-colors">
                  <i className="fas fa-desktop text-indigo-400 text-xs"></i>
                  <div>
                    <p className="text-[10px] font-black text-indigo-900 uppercase">Browser Print</p>
                    <p className="text-[8px] text-gray-400 font-bold uppercase">Standard system dialog</p>
                  </div>
                </button>
                <button onClick={handleIsolatedPrint} className="w-full text-left px-4 py-3 hover:bg-indigo-50 rounded-xl flex items-center gap-3 transition-colors">
                  <i className="fas fa-window-maximize text-indigo-400 text-xs"></i>
                  <div>
                    <p className="text-[10px] font-black text-indigo-900 uppercase">Isolated Print View</p>
                    <p className="text-[8px] text-gray-400 font-bold uppercase">Best for mobile & tablets</p>
                  </div>
                </button>
                <div className="h-[1px] bg-indigo-50 my-1"></div>
                <button onClick={handleExportCSV} className="w-full text-left px-4 py-3 hover:bg-green-50 rounded-xl flex items-center gap-3 transition-colors">
                  <i className="fas fa-file-csv text-green-500 text-xs"></i>
                  <div>
                    <p className="text-[10px] font-black text-indigo-900 uppercase">Export Grid CSV</p>
                    <p className="text-[8px] text-gray-400 font-bold uppercase">Download mapping data</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 bg-white p-2 rounded-2xl border-2 border-indigo-50 shadow-sm print-hidden">
            <button title="Zoom Out" onClick={() => setZoom(prev => Math.max(0.1, prev - 0.1))} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl text-indigo-900 hover:bg-indigo-50"><i className="fas fa-minus text-[10px]"></i></button>
            <div className="px-3 min-w-[60px] text-center"><span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">{Math.round(zoom * 100)}%</span></div>
            <button title="Zoom In" onClick={() => setZoom(prev => Math.min(2.5, prev + 0.1))} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl text-indigo-900 hover:bg-indigo-50"><i className="fas fa-plus text-[10px]"></i></button>
            <button onClick={() => setZoom(1)} className="ml-1 px-3 py-2 text-[8px] font-black uppercase text-indigo-400">1:1</button>
          </div>
        </div>

        {pendingSelection.length > 0 && (
          <button onClick={onCheckout} className="bg-green-600 text-white px-10 py-4 rounded-2xl text-[12px] font-black uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all flex items-center gap-3 shadow-2xl">
            <i className="fas fa-shopping-cart"></i> Claim {pendingSelection.length} Box{pendingSelection.length > 1 ? 'es' : ''}
          </button>
        )}
      </div>

      <div className="w-full max-w-6xl mb-6 px-4 print-hidden">
        <div className="bg-indigo-900 rounded-[2rem] p-6 shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-6 border-b-4 border-indigo-950 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <i className="fas fa-football-ball text-[120px] rotate-12"></i>
          </div>

          <div className="flex items-center gap-4 w-full lg:w-auto z-10">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white flex-shrink-0">
              <i className="fas fa-hand-holding-heart text-xl"></i>
            </div>
            <div>
              <p className="text-indigo-300 text-[9px] font-black uppercase tracking-widest">Charity Impact Goal</p>
              <h3 className="text-xl font-black text-white uppercase leading-none mt-1 whitespace-nowrap">
                ${stats.totalRaised} <span className="text-indigo-400">/ ${stats.potentialTotal} Raised</span>
              </h3>
            </div>
          </div>

          <div className="flex-grow flex flex-wrap justify-center gap-2 md:gap-4 px-4 border-l border-r border-white/5 z-10">
            {prizeBreakdown.isScoreChange ? (
              <div className="flex items-center gap-4">
                <div className="px-4 py-2 bg-green-500/10 rounded-xl border border-green-500/20 text-center">
                  <span className="text-[8px] font-black text-green-400 uppercase block">Score Change Prize</span>
                  <span className="text-sm font-black text-white">${prizeBreakdown.perChange} <span className="text-[10px] text-green-400">({prizeBreakdown.multiplier}x)</span></span>
                </div>
                <div className="w-[1px] h-6 bg-white/10 self-center"></div>
                <div className="flex flex-col items-center">
                  <span className="text-[7px] font-black text-indigo-400 uppercase tracking-widest">Charity</span>
                  <span className="text-xs md:text-sm font-black text-white">${prizeBreakdown.charity?.toFixed(0)}</span>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center">
                  <span className="text-[7px] font-black text-indigo-400 uppercase tracking-widest">Q1</span>
                  <span className="text-xs md:text-sm font-black text-white">${prizeBreakdown.q1?.toFixed(0)}</span>
                </div>
                <div className="w-[1px] h-6 bg-white/10 self-center"></div>
                <div className="flex flex-col items-center">
                  <span className="text-[7px] font-black text-indigo-400 uppercase tracking-widest">Half</span>
                  <span className="text-xs md:text-sm font-black text-white">${prizeBreakdown.half?.toFixed(0)}</span>
                </div>
                <div className="w-[1px] h-6 bg-white/10 self-center"></div>
                <div className="flex flex-col items-center">
                  <span className="text-[7px] font-black text-indigo-400 uppercase tracking-widest">Q3</span>
                  <span className="text-xs md:text-sm font-black text-white">${prizeBreakdown.q3?.toFixed(0)}</span>
                </div>
                <div className="w-[1px] h-6 bg-white/10 self-center"></div>
                <div className="flex flex-col items-center">
                  <span className="text-[7px] font-black text-indigo-400 uppercase tracking-widest">Final</span>
                  <span className="text-xs md:text-sm font-black text-white">${prizeBreakdown.final?.toFixed(0)}</span>
                </div>
                <div className="w-[1px] h-6 bg-white/10 self-center"></div>
                <div className="flex flex-col items-center">
                  <span className="text-[7px] font-black text-green-400 uppercase tracking-widest">Charity</span>
                  <span className="text-xs md:text-sm font-black text-green-400">${prizeBreakdown.charity?.toFixed(0)}</span>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap justify-center md:justify-end gap-3 flex-shrink-0 z-10">
            <div className="px-4 py-2 bg-white/5 rounded-2xl border border-white/10 flex flex-col items-center min-w-[90px] backdrop-blur-sm">
              <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Money Committed</span>
              <span className="text-base font-black text-indigo-200">${stats.totalCommitted}</span>
            </div>
            <div className="px-4 py-2 bg-white/5 rounded-2xl border border-white/10 flex flex-col items-center min-w-[90px] backdrop-blur-sm">
              <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Raised So Far</span>
              <span className="text-base font-black text-white">${stats.totalRaised}</span>
            </div>
            <div className="px-4 py-2 bg-white/5 rounded-2xl border border-white/10 flex flex-col items-center min-w-[90px] backdrop-blur-sm">
              <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Boxes Left</span>
              <span className="text-base font-black text-white">{stats.remaining}</span>
            </div>
            <div className="px-4 py-2 bg-white/10 rounded-2xl border border-white/20 flex flex-col items-center min-w-[90px] backdrop-blur-sm bg-indigo-500/10">
              <span className="text-[8px] font-black text-indigo-200 uppercase tracking-widest">Cost/Box</span>
              <span className="text-base font-black text-white">${settings.costPerBox}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="status-bar w-full max-w-2xl mb-6 px-4 print-hidden">
        <div className="flex items-center justify-between bg-white border border-indigo-100 rounded-2xl p-4 shadow-sm">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Contest Availability</span>
            <p className="text-xl font-black text-indigo-900 uppercase leading-none mt-1">{stats.remaining} <span className="text-sm font-bold text-gray-400 ml-1">Boxes Left</span></p>
          </div>
          <div className="flex gap-2">
            <div className="h-2 w-32 bg-gray-100 rounded-full overflow-hidden self-center">
              <div className={`h-full transition-all duration-1000 ${stats.remaining < 10 ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${stats.assigned}%` }}></div>
            </div>
            <span className="text-[10px] font-black text-indigo-900">{stats.assigned}% Full</span>
          </div>
        </div>
      </div>

      <div className="w-full max-w-4xl space-y-6 px-4 mb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-indigo-50/50 p-6 md:p-8 rounded-[2rem] border border-indigo-100 backdrop-blur-sm print-hidden">
            <h3 className="font-black text-indigo-900 uppercase tracking-tight text-xs md:text-sm mb-6 flex items-center gap-2">
              <i className="fas fa-info-circle text-indigo-400"></i> Box Status Legend
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-100"><i className="fas fa-check-circle text-green-600"></i><span className="font-black text-green-900 uppercase text-[9px]">Fully Paid</span></div>
              <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-xl border border-orange-100"><i className="fas fa-dot-circle text-orange-500"></i><span className="font-black text-orange-900 uppercase text-[9px]">Partial</span></div>
              <div className="flex items-center gap-2 p-3 bg-yellow-100 rounded-xl border border-yellow-200"><i className="fas fa-trophy text-yellow-600"></i><span className="font-black text-yellow-900 uppercase text-[9px]">Winner</span></div>
              <div className="flex items-center gap-2 p-3 bg-indigo-600 rounded-xl border border-indigo-700"><i className="fas fa-shopping-cart text-white"></i><span className="font-black text-white uppercase text-[9px]">In Cart</span></div>
            </div>
          </div>

          <div className="bg-white border-2 border-green-100 p-6 md:p-8 rounded-[2rem] shadow-sm relative overflow-hidden">
            <div className="absolute -top-4 -right-4 opacity-5 rotate-12"><i className="fas fa-trophy text-6xl text-green-600"></i></div>
            <h3 className="font-black text-indigo-900 uppercase tracking-tight text-xs md:text-sm mb-6 flex items-center gap-2 relative z-10">
              <i className="fas fa-trophy text-green-500"></i> Live Winner Breakdown
            </h3>
            {liveWinners.length === 0 ? (
              <div className="h-24 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-2xl">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Awaiting Kickoff</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-48 overflow-y-auto scrollbar-hide">
                {liveWinners.map((w, idx) => (
                  <div key={idx} className={`p-3 rounded-xl flex items-center justify-between border-b last:border-0 ${idx === 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-[8px] font-black uppercase text-indigo-400 w-12">{w.label}</span>
                      <span className="text-xs font-black text-indigo-900">{w.winner}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-gray-950">${w.payout.toFixed(0)}</p>
                      <p className="text-[7px] font-bold text-gray-400 uppercase leading-none mt-0.5">Score: {w.score}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Grid;
