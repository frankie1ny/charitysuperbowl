
import React, { useState, useEffect } from 'react';
import { Participant, GameSettings, Square } from '../types';

interface EntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Participant, 'id'>) => void;
  onUnassign: (id: number) => void;
  onConfirmPayment: (participantId: string, amount: number, method: string) => void;
  selectedSquare: Square | null;
  existingParticipants: Participant[];
  settings: GameSettings;
}

const EntryModal: React.FC<EntryModalProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  onUnassign,
  onConfirmPayment,
  selectedSquare,
  existingParticipants, 
  settings 
}) => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationError, setVerificationError] = useState(false);
  const [activeQR, setActiveQR] = useState<'paypal' | 'venmo' | 'zelle' | null>(null);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    alias: '',
  });

  // Reset internal states when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsSubmitted(false);
      setIsVerified(false);
      setVerificationEmail('');
      setVerificationError(false);
      setActiveQR(null);
      setIsMarkingPaid(false);
      setFormData({ name: '', email: '', phone: '', alias: '' });
    }
  }, [isOpen]);

  if (!isOpen || !selectedSquare) return null;

  const isAssigned = selectedSquare.assigned;
  const isFullyPaid = selectedSquare.paidAmount >= settings.costPerBox;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setIsSubmitted(true);
  };

  const handleSelfConfirmPayment = () => {
    // Find the participant (they might be newly created or existing)
    const participant = existingParticipants.find(p => p.email.toLowerCase() === formData.email.toLowerCase() || p.id === selectedSquare.participantId);
    if (participant) {
      onConfirmPayment(participant.id, settings.costPerBox, 'Self-Reported');
      setIsMarkingPaid(true);
      setTimeout(() => {
        handleClose();
      }, 1500);
    }
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const participant = existingParticipants.find(p => p.id === selectedSquare.participantId);
    if (participant && participant.email.toLowerCase() === verificationEmail.toLowerCase()) {
      setIsVerified(true);
      setVerificationError(false);
    } else {
      setVerificationError(true);
    }
  };

  const handleClose = () => {
    setIsSubmitted(false);
    onClose();
  };

  const selectExisting = (p: Participant) => {
    setFormData({
      name: p.name,
      email: p.email,
      phone: p.phone,
      alias: p.alias
    });
  };

  const hasPaymentInfo = settings.zelleAccount || settings.paypalAccount || settings.venmoAccount;

  const getPaypalLink = (handle: string) => {
    if (handle.startsWith('http')) return handle;
    const cleanHandle = handle.startsWith('@') ? handle.substring(1) : handle;
    return `https://www.paypal.com/paypalme/${cleanHandle}/${settings.costPerBox}`;
  };

  const getVenmoLink = (handle: string) => {
    if (handle.startsWith('http')) return handle;
    const cleanHandle = handle.startsWith('@') ? handle.substring(1) : handle;
    return `https://venmo.com/${cleanHandle}?txn=pay&amount=${settings.costPerBox}&note=SuperBowlSquares_${selectedSquare.alias}`;
  };

  const getQRUrl = (data: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}&margin=10`;
  };

  const PaymentActions = ({ currentAlias, showConfirm = false }: { currentAlias: string, showConfirm?: boolean }) => (
    <div className="space-y-4">
      {settings.paypalAccount && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <a
              href={getPaypalLink(settings.paypalAccount)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-grow flex items-center justify-center gap-3 py-4 bg-[#003087] text-white rounded-2xl font-black uppercase tracking-widest hover:brightness-110 shadow-lg shadow-blue-50 transition-all"
            >
              <i className="fab fa-paypal text-xl"></i>
              Pay via PayPal
            </a>
            <button 
              onClick={() => setActiveQR(activeQR === 'paypal' ? null : 'paypal')}
              className={`p-4 rounded-2xl border-2 transition-all ${activeQR === 'paypal' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-100 text-gray-400 hover:border-indigo-200'}`}
              title="Show QR Code"
            >
              <i className="fas fa-qrcode text-xl"></i>
            </button>
          </div>
          {activeQR === 'paypal' && (
            <div className="p-4 bg-white border-2 border-indigo-100 rounded-3xl flex flex-col items-center animate-in zoom-in-95 duration-200">
              <img src={getQRUrl(getPaypalLink(settings.paypalAccount))} alt="PayPal QR" className="w-40 h-40" />
              <p className="text-[10px] font-black text-indigo-400 uppercase mt-2">Scan to pay with PayPal</p>
            </div>
          )}
        </div>
      )}

      {settings.venmoAccount && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <a
              href={getVenmoLink(settings.venmoAccount)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-grow flex items-center justify-center gap-3 py-4 bg-[#3d95ce] text-white rounded-2xl font-black uppercase tracking-widest hover:brightness-110 shadow-lg shadow-blue-50 transition-all"
            >
              <i className="fab fa-vimeo-v text-xl"></i>
              Pay via Venmo
            </a>
            <button 
              onClick={() => setActiveQR(activeQR === 'venmo' ? null : 'venmo')}
              className={`p-4 rounded-2xl border-2 transition-all ${activeQR === 'venmo' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-100 text-gray-400 hover:border-indigo-200'}`}
              title="Show QR Code"
            >
              <i className="fas fa-qrcode text-xl"></i>
            </button>
          </div>
          {activeQR === 'venmo' && (
            <div className="p-4 bg-white border-2 border-indigo-100 rounded-3xl flex flex-col items-center animate-in zoom-in-95 duration-200">
              <img src={getQRUrl(getVenmoLink(settings.venmoAccount))} alt="Venmo QR" className="w-40 h-40" />
              <p className="text-[10px] font-black text-indigo-400 uppercase mt-2">Scan to pay with Venmo</p>
            </div>
          )}
        </div>
      )}

      {settings.zelleAccount && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(settings.zelleAccount!);
                alert("Zelle account info copied!");
              }}
              className="flex-grow flex items-center justify-center gap-3 py-4 bg-[#6d1ed4] text-white rounded-2xl font-black uppercase tracking-widest hover:brightness-110 shadow-lg shadow-purple-50 transition-all"
            >
              <i className="fas fa-university text-xl"></i>
              Copy Zelle Info
            </button>
            <button 
              onClick={() => setActiveQR(activeQR === 'zelle' ? null : 'zelle')}
              className={`p-4 rounded-2xl border-2 transition-all ${activeQR === 'zelle' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-100 text-gray-400 hover:border-indigo-200'}`}
              title="Show QR Code"
            >
              <i className="fas fa-qrcode text-xl"></i>
            </button>
          </div>
          {activeQR === 'zelle' && (
            <div className="p-4 bg-white border-2 border-indigo-100 rounded-3xl flex flex-col items-center animate-in zoom-in-95 duration-200">
              <img src={getQRUrl(settings.zelleAccount)} alt="Zelle QR" className="w-40 h-40" />
              <p className="text-[10px] font-black text-indigo-400 uppercase mt-2">Scan or use: {settings.zelleAccount}</p>
            </div>
          )}
        </div>
      )}

      {showConfirm && (
        <div className="pt-4 border-t border-gray-100">
          <button 
            disabled={isMarkingPaid}
            onClick={handleSelfConfirmPayment}
            className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl flex items-center justify-center gap-3 ${isMarkingPaid ? 'bg-green-600 text-white scale-95 opacity-80' : 'bg-white border-2 border-green-600 text-green-600 hover:bg-green-50 shadow-green-100'}`}
          >
            {isMarkingPaid ? (
              <>
                <i className="fas fa-check-circle animate-bounce"></i>
                Marked Paid!
              </>
            ) : (
              <>
                <i className="fas fa-receipt"></i>
                Confirm I have Paid
              </>
            )}
          </button>
        </div>
      )}
      <p className="text-[10px] text-gray-400 italic text-center px-4">Important: Include "{currentAlias}" in payment memo!</p>
    </div>
  );

  // The success screen (shown after a NEW claim)
  if (isSubmitted) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-indigo-950/40 backdrop-blur-md">
        <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300 border border-white/20">
          <div className="bg-green-600 p-8 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <i className="fas fa-check-circle text-8xl rotate-12"></i>
            </div>
            <div className="relative z-10 space-y-2">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <i className="fas fa-check text-2xl"></i>
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight leading-none">Box Reserved!</h2>
              <p className="text-green-100 text-sm font-bold uppercase tracking-widest">Alias: {formData.alias}</p>
            </div>
          </div>

          <div className="p-8 space-y-6 text-center max-h-[60vh] overflow-y-auto scrollbar-hide">
            <div className="space-y-2">
              <p className="text-gray-500 text-sm font-medium">To finalize your entry, please pay:</p>
              <p className="text-5xl font-black text-indigo-900">${settings.costPerBox}</p>
              <p className="text-xs text-indigo-400 font-bold uppercase tracking-widest">Supporting {settings.charityName}</p>
            </div>

            {hasPaymentInfo ? (
              <PaymentActions currentAlias={formData.alias} showConfirm={true} />
            ) : (
              <p className="text-gray-400 italic text-sm">No payment links configured. Please contact the administrator to pay.</p>
            )}

            <button
              onClick={handleClose}
              className="w-full text-indigo-600 font-black uppercase text-xs tracking-widest hover:bg-indigo-50 py-3 rounded-xl transition-all"
            >
              Done, back to grid
            </button>
          </div>
        </div>
      </div>
    );
  }

  // The main claim or management screen
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-indigo-950/40 backdrop-blur-md">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300 border border-white/20">
        <div className={`p-8 text-white flex justify-between items-center relative overflow-hidden ${isAssigned ? 'bg-indigo-900' : 'bg-gradient-to-r from-indigo-900 to-indigo-800'}`}>
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <i className={`fas ${isAssigned ? (isVerified ? 'fa-user-check' : 'fa-user-shield') : 'fa-football-ball'} text-6xl rotate-12`}></i>
          </div>
          <div className="relative z-10">
            <h2 className="text-2xl font-black uppercase tracking-tight">
              {isAssigned ? (isVerified ? 'Box Management' : 'Manage Reservation') : 'Claim Your Square'}
            </h2>
            <p className="text-indigo-300 text-xs font-bold uppercase tracking-widest">
              {isAssigned ? `Reserved by ${selectedSquare.alias}` : `Supports ${settings.charityName}`}
            </p>
          </div>
          <button onClick={handleClose} className="bg-white/10 hover:bg-white/20 w-10 h-10 rounded-full flex items-center justify-center transition-all z-10">
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-hide">
          {!isAssigned ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {existingParticipants.length > 0 && (
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Recent Participants</label>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {existingParticipants.slice(0, 5).map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectExisting(p)}
                        className="flex-shrink-0 px-4 py-2 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-100 hover:bg-indigo-100 transition-all hover:scale-105"
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Full Legal Name</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold"
                    placeholder="John Doe"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Email Address</label>
                    <input
                      required
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold"
                      placeholder="john@me.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Phone Number</label>
                    <input
                      required
                      type="tel"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold"
                      placeholder="(555) 000-0000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Display Alias</label>
                  <input
                    required
                    type="text"
                    value={formData.alias}
                    onChange={e => setFormData({ ...formData, alias: e.target.value })}
                    className="w-full px-5 py-3 bg-indigo-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-black text-indigo-700 uppercase"
                    placeholder="SUPERFAN_2025"
                  />
                  <p className="text-[10px] text-gray-400 mt-2 italic px-1 text-center">Your alias is shown on the grid to protect your privacy.</p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-indigo-600 text-white py-4 rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
                >
                  Confirm Selection
                  <i className="fas fa-arrow-right text-xs group-hover:translate-x-1 transition-transform"></i>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100">
                <h3 className="font-black text-indigo-900 uppercase text-xs mb-3">Current Status</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Alias</span>
                    <span className="font-black text-indigo-700 uppercase">{selectedSquare.alias}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Payment Status</span>
                    <span className={`font-black uppercase text-xs px-2 py-1 rounded-lg ${isFullyPaid ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      ${selectedSquare.paidAmount} / ${settings.costPerBox}
                    </span>
                  </div>
                  {isFullyPaid && (
                    <div className="flex items-center gap-2 text-green-600 text-[10px] font-black uppercase tracking-widest pt-1 border-t border-indigo-100">
                      <i className="fas fa-certificate"></i>
                      Verified Reservation
                    </div>
                  )}
                </div>
              </div>

              {!isVerified ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-900">Is this your box?</p>
                    <p className="text-xs text-gray-400">Verify your email to pay or cancel.</p>
                  </div>

                  <form onSubmit={handleVerify} className="space-y-4">
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={verificationEmail}
                        onChange={(e) => {
                          setVerificationEmail(e.target.value);
                          setVerificationError(false);
                        }}
                        className={`w-full px-5 py-3 border-2 rounded-2xl outline-none transition-all font-bold ${verificationError ? 'border-red-500 bg-red-50' : 'border-gray-100 bg-gray-50 focus:border-indigo-500 focus:bg-white'}`}
                        placeholder="your@email.com"
                      />
                      {verificationError && (
                        <p className="text-[10px] text-red-500 font-bold uppercase mt-2 text-center">Email does not match this box</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-indigo-600 text-white py-4 rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center gap-3 group shadow-xl shadow-indigo-100"
                    >
                      <i className="fas fa-shield-alt text-xs"></i>
                      Verify Email
                    </button>
                  </form>
                </div>
              ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                  {!isFullyPaid && (
                    <div className="space-y-4">
                       <div className="text-center">
                        <p className="text-sm font-bold text-gray-900">Complete Payment</p>
                        <p className="text-xs text-gray-400">Total remaining: ${settings.costPerBox - selectedSquare.paidAmount}</p>
                      </div>

                      <PaymentActions currentAlias={selectedSquare.alias} showConfirm={true} />
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-100">
                    <button
                      onClick={() => {
                        if (window.confirm("Are you sure you want to relinquish this square?")) {
                          onUnassign(selectedSquare.id);
                        }
                      }}
                      className="w-full bg-red-50 text-red-600 py-4 rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all active:scale-[0.98] flex items-center justify-center gap-3 group border border-red-100 shadow-lg shadow-red-50"
                    >
                      <i className="fas fa-trash-alt text-xs"></i>
                      Cancel Reservation
                    </button>
                    <p className="text-[10px] text-gray-400 text-center mt-4 italic px-4 uppercase font-black tracking-widest">Ownership Verified</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EntryModal;
