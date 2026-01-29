
import React, { useState, useMemo } from 'react';
import { AppState } from '../types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  appState: AppState;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, appState }) => {
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => {
    try {
      const serialized = btoa(JSON.stringify(appState));
      const url = new URL(window.location.origin + window.location.pathname);
      url.searchParams.set('data', serialized);
      return url.toString();
    } catch (e) {
      console.error("Error generating share URL", e);
      return window.location.href;
    }
  }, [appState, isOpen]);

  const qrCodeUrl = useMemo(() => {
    // QR Server API - convenient for local-first apps
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shareUrl)}&margin=10`;
  }, [shareUrl]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  const isUrlLarge = shareUrl.length > 7000;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-indigo-950/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="bg-green-600 p-8 text-white flex justify-between items-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <i className="fas fa-share-alt text-8xl rotate-12"></i>
          </div>
          <div className="relative z-10">
            <h2 className="text-3xl font-black uppercase tracking-tight">Share Your Board</h2>
            <p className="text-green-100 text-xs font-bold uppercase tracking-widest">Snapshot Sharing Enabled</p>
          </div>
          <button onClick={onClose} className="bg-white/10 hover:bg-white/20 w-12 h-12 rounded-full flex items-center justify-center transition-all z-10">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="p-10 space-y-8 text-center max-h-[80vh] overflow-y-auto scrollbar-hide">
          <div className="space-y-4">
            <div className="bg-gray-50 p-6 rounded-[2.5rem] border-2 border-dashed border-gray-200 inline-block">
              <img src={qrCodeUrl} alt="Share QR Code" className="w-56 h-56 mx-auto rounded-xl shadow-inner" />
            </div>
            <p className="text-gray-500 text-sm font-medium px-4">
              Ask participants to <span className="font-black text-indigo-900">scan this code</span> with their phone to instantly see the current board state.
            </p>
          </div>

          <div className="space-y-4">
            <div className="relative group">
              <input 
                readOnly
                value={shareUrl}
                className="w-full pl-6 pr-32 py-5 bg-gray-50 border-2 border-gray-100 rounded-3xl font-mono text-xs text-gray-400 outline-none truncate"
              />
              <button 
                onClick={handleCopy}
                className={`absolute right-2 top-2 bottom-2 px-6 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${copied ? 'bg-green-600 text-white' : 'bg-indigo-900 text-white hover:bg-black shadow-lg shadow-indigo-100'}`}
              >
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
            
            {isUrlLarge && (
              <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-2xl text-left">
                <i className="fas fa-exclamation-triangle text-orange-500 mt-1"></i>
                <p className="text-[10px] text-orange-800 font-bold uppercase leading-relaxed">
                  Notice: This board has a lot of data. Snapshot links may not work in older browsers. If problems occur, use the "Export JSON" backup feature in Admin.
                </p>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2">
                <i className="fas fa-info-circle"></i>
                How it works
              </h4>
              <p className="text-[10px] text-gray-500 leading-relaxed font-medium">
                Your data is stored "inside" the link. When someone opens it, their browser saves a copy. No login or database required!
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2">
                <i className="fas fa-sync-alt"></i>
                Updates
              </h4>
              <p className="text-[10px] text-gray-500 leading-relaxed font-medium">
                If you change the board later, you must <span className="text-indigo-600 font-bold">generate a new link</span> for others to see the changes.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-4 text-indigo-400 font-black uppercase text-[10px] tracking-widest hover:text-indigo-900 transition-colors"
          >
            Back to Grid
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
