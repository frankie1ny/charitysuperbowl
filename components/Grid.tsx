
import React from 'react';
import { Square, GameSettings } from '../types';

interface GridProps {
  squares: Square[];
  settings: GameSettings;
  onSquareClick: (id: number) => void;
}

const Grid: React.FC<GridProps> = ({ squares, settings, onSquareClick }) => {
  const getLabel = (type: 'row' | 'col', index: number) => {
    const list = type === 'row' ? settings.rowNumbers : settings.colNumbers;
    return list.length > 0 ? list[index] : '?';
  };

  // Group squares into rows for better layout control
  const rows = Array.from({ length: 10 }, (_, rowIndex) => 
    squares.filter(sq => sq.row === rowIndex)
  );

  return (
    <div className="flex flex-col items-center">
      {/* Stylized Matchup Header - Team Names on separate lines */}
      <div className="w-full text-center mb-12">
        <div className="inline-flex flex-col items-center gap-4 w-full max-w-2xl">
          <div className="w-full">
            <p className="text-indigo-400 text-[10px] font-black uppercase tracking-widest mb-1">NFC Champion</p>
            <div className="px-10 py-4 bg-indigo-900 text-white rounded-3xl transform -skew-x-2 shadow-2xl border-b-8 border-indigo-950">
              <span className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">{settings.teamA}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="h-[2px] w-20 bg-gradient-to-r from-transparent to-indigo-200"></div>
            <span className="text-indigo-300 font-black italic text-xl uppercase tracking-[0.4em]">VS</span>
            <div className="h-[2px] w-20 bg-gradient-to-l from-transparent to-indigo-200"></div>
          </div>
          
          <div className="w-full">
            <p className="text-indigo-400 text-[10px] font-black uppercase tracking-widest mb-1">AFC Champion</p>
            <div className="px-10 py-4 bg-white border-4 border-indigo-900 text-indigo-900 rounded-3xl transform skew-x-2 shadow-2xl">
              <span className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">{settings.teamB}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto pb-12 scrollbar-hide flex justify-center">
        <div className="inline-block p-4">
          <div className="flex flex-col">
            {/* Top Axis - Team B Column Numbers */}
            <div className="flex items-center mb-2">
              {/* Spacer for vertical axis label and row numbers */}
              <div className="w-24"></div> 
              <div className="flex gap-[2px]">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div 
                    key={i} 
                    className="w-14 h-12 flex items-center justify-center font-black text-2xl text-indigo-600 bg-indigo-50 rounded-t-xl border-b-2 border-indigo-200"
                  >
                    {getLabel('col', i)}
                  </div>
                ))}
              </div>
            </div>

            {/* Grid Core - Row Labels + Squares */}
            <div className="flex">
              {/* Left Label - "Vertical Axis" rotated text */}
              <div className="w-8 flex items-center justify-center mr-2">
                 <p className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.5em] [writing-mode:vertical-lr] rotate-180">
                   {settings.teamA}
                 </p>
              </div>

              {/* Rows Container */}
              <div className="flex flex-col gap-[2px] bg-indigo-900 border-4 border-indigo-900 rounded-2xl overflow-hidden shadow-[0_40px_80px_-15px_rgba(30,27,75,0.5)]">
                {rows.map((rowSquares, rowIndex) => (
                  <div key={rowIndex} className="flex gap-[2px]">
                    {/* Row Label (Team A Number) */}
                    <div className="h-14 w-12 flex items-center justify-center font-black text-2xl text-indigo-100 bg-indigo-800/50 border-r-2 border-indigo-900/50">
                      {getLabel('row', rowIndex)}
                    </div>

                    {/* Squares for this row */}
                    {rowSquares.map((sq) => {
                      const isFullyPaid = sq.paidAmount >= settings.costPerBox;
                      const isPartiallyPaid = sq.paidAmount > 0 && !isFullyPaid;
                      const isPending = sq.assigned && sq.paidAmount === 0;

                      return (
                        <button
                          key={sq.id}
                          onClick={() => onSquareClick(sq.id)}
                          disabled={settings.isLocked}
                          className={`w-14 h-14 flex flex-col items-center justify-between p-1 transition-all duration-200 group relative
                            ${sq.assigned 
                              ? (isFullyPaid ? 'bg-green-50' : (isPartiallyPaid ? 'bg-orange-50' : 'bg-indigo-50/90')) 
                              : (settings.isLocked ? 'bg-gray-100 grayscale' : 'bg-white hover:bg-indigo-100 hover:scale-[1.1] hover:z-20 hover:rounded-sm shadow-sm')}
                          `}
                        >
                          {/* Sequential Box Number */}
                          <span className="absolute top-0.5 left-1 text-[7px] font-bold text-indigo-200 pointer-events-none group-hover:text-indigo-400 transition-colors">
                            {sq.id + 1}
                          </span>

                          {sq.assigned ? (
                            <>
                              <span className="text-[8px] font-black text-indigo-900 uppercase leading-tight truncate w-full px-1 text-center mt-3">
                                {sq.alias}
                              </span>
                              
                              <div className="flex items-center justify-center w-full pb-1">
                                {isFullyPaid && (
                                  <div className="flex flex-col items-center">
                                    <i className="fas fa-check-circle text-green-600 text-[10px]"></i>
                                    <span className="text-[6px] font-black text-green-700 uppercase">Paid</span>
                                  </div>
                                )}
                                {isPartiallyPaid && (
                                  <div className="flex flex-col items-center">
                                    <i className="fas fa-dot-circle text-orange-500 text-[10px]"></i>
                                    <span className="text-[6px] font-black text-orange-700 uppercase">Part</span>
                                  </div>
                                )}
                                {isPending && (
                                  <div className="flex flex-col items-center opacity-60">
                                    <i className="fas fa-clock text-indigo-400 text-[10px]"></i>
                                    <span className="text-[6px] font-black text-indigo-500 uppercase">Unpaid</span>
                                  </div>
                                )}
                              </div>

                              <div className={`absolute top-0 right-0 w-3 h-3 border-t-4 border-r-4 rounded-tr-sm
                                ${isFullyPaid ? 'border-green-500' : (isPartiallyPaid ? 'border-orange-400' : 'border-indigo-300')}
                              `}></div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full w-full">
                              <span className="text-[10px] font-bold text-gray-300 group-hover:text-indigo-400 group-hover:scale-110 transition-transform mt-1">
                                {settings.isLocked ? 'Closed' : 'Pick'}
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-3xl bg-indigo-50/50 p-8 rounded-[2.5rem] border border-indigo-100 mt-4 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-200">
            <i className="fas fa-info-circle text-white"></i>
          </div>
          <div>
            <h3 className="font-black text-indigo-900 uppercase tracking-tight">Payment Status Legend</h3>
            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">How to read the grid</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-700">
           <div className="flex items-center gap-3 p-3 bg-green-50 rounded-2xl shadow-sm border border-green-200">
             <i className="fas fa-check-circle text-green-600 text-lg"></i>
             <div>
               <span className="block font-black text-green-900 uppercase text-xs">Fully Paid</span>
               <span className="text-[10px] text-green-700">${settings.costPerBox} Received</span>
             </div>
           </div>
           <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-2xl shadow-sm border border-orange-200">
             <i className="fas fa-dot-circle text-orange-500 text-lg"></i>
             <div>
               <span className="block font-black text-orange-900 uppercase text-xs">Partially Paid</span>
               <span className="text-[10px] text-orange-700">Payment in progress</span>
             </div>
           </div>
           <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-2xl shadow-sm border border-indigo-200">
             <i className="fas fa-clock text-indigo-400 text-lg"></i>
             <div>
               <span className="block font-black text-indigo-900 uppercase text-xs">Unpaid</span>
               <span className="text-[10px] text-indigo-700">Awaiting funds</span>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Grid;
