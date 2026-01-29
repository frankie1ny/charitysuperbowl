
import React, { useMemo, useState } from 'react';
import { Square, GameSettings, Participant, PaymentTransaction } from '../types';

interface StatsProps {
  squares: Square[];
  participants: Participant[];
  settings: GameSettings;
  onUpdateSquare: (id: number, updates: Partial<Square>) => void;
  onUpdateParticipant: (id: string, updates: Partial<Participant>) => void;
  onApplyPayment: (participantId: string, amount: number, method: string, notes: string) => void;
}

const Stats: React.FC<StatsProps> = ({ squares, participants, settings, onUpdateSquare, onUpdateParticipant, onApplyPayment }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  
  // New Modal State
  const [paymentModalParticipant, setPaymentModalParticipant] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentNotes, setPaymentNotes] = useState('');

  const costPerBox = settings.costPerBox || 0;

  const roster = useMemo(() => {
    return participants.map(p => {
      const userSquares = squares.filter(s => s.participantId === p.id);
      const totalPaid = userSquares.reduce((sum, s) => sum + s.paidAmount, 0);
      const totalOwed = userSquares.length * costPerBox;
      
      const methods = Array.from(new Set(userSquares.map(s => s.paymentMethod).filter(Boolean))) as string[];
      
      return {
        ...p,
        boxCount: userSquares.length,
        totalPaid,
        totalOwed,
        squareIds: userSquares.map(s => s.id),
        amountRemaining: totalOwed - totalPaid,
        paymentMethods: methods.length > 0 ? methods : ['None']
      };
    }).sort((a, b) => b.boxCount - a.boxCount);
  }, [squares, participants, costPerBox]);

  const totals = useMemo(() => {
    const totalPotential = squares.filter(s => s.assigned).length * costPerBox;
    const totalCollected = squares.reduce((sum, s) => sum + s.paidAmount, 0);
    return {
      totalDue: totalPotential,
      totalCollected: totalCollected,
      outstanding: Math.max(0, totalPotential - totalCollected),
      percentCollected: totalPotential > 0 ? (totalCollected / totalPotential) * 100 : 0
    };
  }, [squares, costPerBox]);

  const filteredRoster = roster.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.alias.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openPaymentModal = (p: any) => {
    const balance = Math.max(0, p.totalOwed - p.totalPaid);
    setPaymentModalParticipant(p);
    setPaymentAmount(balance > 0 ? balance.toString() : '');
    setPaymentMethod('Cash');
    setPaymentNotes('');
  };

  const closePaymentModal = () => {
    setPaymentModalParticipant(null);
    setPaymentAmount('');
    setPaymentNotes('');
  };

  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalParticipant) return;
    
    const amount = parseFloat(paymentAmount.replace(/[$,\s]/g, ''));
    if (!isNaN(amount) && amount > 0) {
      onApplyPayment(paymentModalParticipant.id, amount, paymentMethod, paymentNotes);
      closePaymentModal();
    } else {
      alert("Please enter a valid amount greater than 0.");
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Financial Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-indigo-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-125 transition-transform duration-500">
            <i className="fas fa-hand-holding-heart text-9xl"></i>
          </div>
          <p className="text-indigo-300 text-xs font-black uppercase tracking-widest mb-2">Goal Pledged</p>
          <p className="text-4xl font-black">${totals.totalDue}</p>
        </div>
        
        <div className="bg-white border-2 border-green-500/20 p-6 rounded-3xl shadow-lg relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 text-green-500/10 group-hover:scale-125 transition-transform duration-500">
            <i className="fas fa-check-double text-9xl"></i>
          </div>
          <p className="text-green-600 text-xs font-black uppercase tracking-widest mb-2">Collected</p>
          <p className="text-4xl font-black text-gray-900">${totals.totalCollected}</p>
        </div>

        <div className="bg-white border-2 border-orange-500/20 p-6 rounded-3xl shadow-lg relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 text-orange-500/10 group-hover:scale-125 transition-transform duration-500">
            <i className="fas fa-hourglass-half text-9xl"></i>
          </div>
          <p className="text-orange-600 text-xs font-black uppercase tracking-widest mb-2">Waiting</p>
          <p className="text-4xl font-black text-gray-900">${totals.outstanding}</p>
        </div>

        <div className="bg-white border-2 border-indigo-500/10 p-6 rounded-3xl shadow-lg flex flex-col justify-center items-center">
           <div className="relative w-24 h-24">
             <svg className="w-full h-full transform -rotate-90">
               <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-100" />
               <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251} strokeDashoffset={251 - (251 * totals.percentCollected) / 100} className="text-indigo-600 transition-all duration-1000" />
             </svg>
             <span className="absolute inset-0 flex items-center justify-center font-black text-indigo-900">{Math.round(totals.percentCollected)}%</span>
           </div>
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">Funds Collected</p>
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-8 border-b bg-gray-50/50 flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Participant Roster</h3>
            <p className="text-sm text-gray-500">Track entries and payment history</p>
          </div>
          <div className="relative w-full md:w-80 group">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors"></i>
            <input 
              type="text" 
              placeholder="Search by name, email or alias..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-3 bg-white border-2 border-gray-100 rounded-2xl focus:border-indigo-500 focus:outline-none transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                <th className="px-8 py-5">Player Info</th>
                <th className="px-8 py-5">Grid Alias</th>
                <th className="px-8 py-5 text-center">Boxes</th>
                <th className="px-8 py-5">Payment Status</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredRoster.map((p) => {
                const isEditing = editingId === p.id;
                const isHistoryExpanded = expandedHistoryId === p.id;
                const balance = Math.max(0, p.totalOwed - p.totalPaid);
                const hasBoxes = p.boxCount > 0;
                const isFullyPaid = hasBoxes && balance === 0;

                return (
                  <React.Fragment key={p.id}>
                    <tr className={`hover:bg-indigo-50/30 transition-colors ${isHistoryExpanded ? 'bg-indigo-50/20' : ''}`}>
                      <td className="px-8 py-6">
                        {isEditing ? (
                          <div className="space-y-2">
                            <input 
                              className="text-sm font-bold border-2 border-indigo-100 rounded-xl px-2 py-1 w-full outline-none focus:border-indigo-500" 
                              value={p.name} 
                              onChange={e => onUpdateParticipant(p.id, { name: e.target.value })} 
                            />
                            <input 
                              className="text-xs border-2 border-indigo-100 rounded-xl px-2 py-1 w-full outline-none focus:border-indigo-500" 
                              value={p.email} 
                              onChange={e => onUpdateParticipant(p.id, { email: e.target.value })} 
                            />
                          </div>
                        ) : (
                          <div>
                            <p className="font-black text-gray-900">{p.name}</p>
                            <p className="text-xs text-indigo-500 font-medium">{p.email}</p>
                          </div>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        {isEditing ? (
                          <input 
                            className="text-sm font-black border-2 border-indigo-100 rounded-xl px-2 py-1 w-full text-indigo-700 uppercase outline-none focus:border-indigo-500" 
                            value={p.alias} 
                            onChange={e => onUpdateParticipant(p.id, { alias: e.target.value })} 
                          />
                        ) : (
                          <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-black rounded-lg uppercase tracking-wider">
                            {p.alias}
                          </span>
                        )}
                      </td>
                      <td className="px-8 py-6 text-center">
                        <span className="text-xl font-black text-gray-900">{p.boxCount}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="space-y-2 min-w-[140px]">
                          <div className="flex flex-col">
                             <div className="flex justify-between items-baseline">
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Amount Paid</span>
                                <div className="text-right">
                                  <p className={`text-lg font-black leading-none ${isFullyPaid ? 'text-green-600' : (balance > 0 ? 'text-orange-600' : 'text-indigo-900')}`}>
                                    ${p.totalPaid}
                                  </p>
                                </div>
                             </div>
                             <div className="flex justify-between items-center mt-0.5">
                                <span className="text-[9px] font-bold text-gray-400 uppercase">Total Due: ${p.totalOwed}</span>
                                {balance > 0 && (
                                  <span className="text-[9px] font-black text-red-500 uppercase bg-red-50 px-1.5 py-0.5 rounded-md">Bal: ${balance}</span>
                                )}
                             </div>
                          </div>
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 ${isFullyPaid ? 'bg-green-500' : 'bg-orange-400'}`}
                              style={{ width: `${p.totalOwed > 0 ? Math.min(100, (p.totalPaid / p.totalOwed) * 100) : 0}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => setExpandedHistoryId(isHistoryExpanded ? null : p.id)}
                            className={`p-2 rounded-lg transition-all ${isHistoryExpanded ? 'bg-indigo-900 text-white' : 'bg-gray-100 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                            title="View History"
                          >
                            <i className="fas fa-history"></i>
                          </button>
                          <button 
                            onClick={() => setEditingId(isEditing ? null : p.id)}
                            className={`p-2 rounded-lg transition-all ${isEditing ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                            title="Edit Participant"
                          >
                            <i className={`fas ${isEditing ? 'fa-check' : 'fa-edit'}`}></i>
                          </button>
                          <button 
                            onClick={() => openPaymentModal(p)}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all shadow-sm bg-green-600 text-white hover:bg-green-700 shadow-green-200 active:scale-95 flex items-center gap-2`}
                            title="Add Payment or Donation"
                          >
                            <i className="fas fa-plus"></i>
                            Add
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {isHistoryExpanded && (
                      <tr className="bg-gray-50/80 animate-in slide-in-from-top-2 duration-300">
                        <td colSpan={5} className="px-12 py-6 border-b border-gray-100">
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                              <i className="fas fa-history text-indigo-400 text-xs"></i>
                              <h4 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Payment Transaction Log</h4>
                            </div>
                            
                            {(p.paymentHistory && p.paymentHistory.length > 0) ? (
                              <div className="grid grid-cols-1 gap-2">
                                {p.paymentHistory.map((entry: PaymentTransaction) => (
                                  <div key={entry.id} className="flex items-start justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm group hover:border-indigo-200 transition-all">
                                    <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors flex-shrink-0">
                                        <i className={`fas ${entry.method.toLowerCase().includes('cash') ? 'fa-money-bill-wave' : 'fa-mobile-alt'}`}></i>
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <p className="text-sm font-black text-gray-900">${entry.amount}</p>
                                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">via {entry.method}</p>
                                        </div>
                                        {entry.notes && (
                                          <p className="text-xs text-gray-500 mt-1 font-medium italic border-l-2 border-indigo-100 pl-3">
                                            {entry.notes}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                      <p className="text-[10px] font-black text-indigo-400 uppercase">{new Date(entry.timestamp).toLocaleDateString()}</p>
                                      <p className="text-[9px] font-bold text-gray-300">{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-6 bg-white rounded-3xl border border-dashed border-gray-200">
                                <p className="text-xs text-gray-400 font-medium italic">No transactions recorded yet.</p>
                              </div>
                            )}
                            
                            <div className="pt-2 flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-indigo-300">
                              <span>Total Collected for {p.alias}: ${p.totalPaid}</span>
                              <button onClick={() => setExpandedHistoryId(null)} className="hover:text-indigo-600 transition-colors">Close Log</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filteredRoster.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <i className="fas fa-users-slash text-gray-300 text-3xl"></i>
                      </div>
                      <p className="text-gray-400 font-bold">No participants found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* NEW: Payment Modal UI */}
      {paymentModalParticipant && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-indigo-950/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300">
            <div className="bg-green-600 p-8 text-white flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tight">Record Payment</h3>
                <p className="text-green-100 text-xs font-bold uppercase tracking-widest">{paymentModalParticipant.alias}</p>
              </div>
              <button onClick={closePaymentModal} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleConfirmPayment} className="p-10 space-y-6 max-h-[75vh] overflow-y-auto scrollbar-hide">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Payment Amount ($)</label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-indigo-900 text-2xl">$</span>
                  <input 
                    autoFocus
                    type="number"
                    step="0.01"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full pl-12 pr-6 py-5 bg-gray-50 border-2 border-transparent focus:border-green-500 focus:bg-white rounded-[2rem] outline-none transition-all font-black text-2xl text-indigo-900"
                    placeholder="0.00"
                  />
                </div>
                {paymentModalParticipant.totalOwed > 0 && (
                  <p className="text-[10px] text-gray-400 mt-3 ml-2 font-bold uppercase">Remaining Balance: ${Math.max(0, paymentModalParticipant.totalOwed - paymentModalParticipant.totalPaid)}</p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Payment Method</label>
                <div className="grid grid-cols-2 gap-3">
                  {['Cash', 'Venmo', 'PayPal', 'Zelle'].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-3 rounded-2xl border-2 font-black uppercase text-[10px] tracking-widest transition-all ${paymentMethod === method ? 'bg-indigo-900 border-indigo-900 text-white shadow-lg' : 'bg-white border-gray-100 text-gray-400 hover:border-indigo-100'}`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Transaction Notes</label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-green-500 focus:bg-white rounded-2xl outline-none transition-all font-medium text-xs text-indigo-900 resize-none h-24"
                  placeholder="e.g. Received via Zelle, donor matching, etc."
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full bg-green-600 text-white py-5 rounded-[2rem] font-black uppercase tracking-widest text-sm hover:bg-green-700 shadow-xl shadow-green-100 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  <i className="fas fa-check-circle"></i>
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stats;