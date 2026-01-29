
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { GlobalSettings, Pool } from '../types';

interface AIAssistantProps {
  globalSettings: GlobalSettings;
  activePool: Pool;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ globalSettings, activePool }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'ai', text: string}[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const context = `
        You are the "Charity Squares Assistant" for a Super Bowl squares contest.
        Current Charity: ${globalSettings.charityName}.
        Current Matchup: ${activePool.settings.teamA} vs ${activePool.settings.teamB}.
        Cost per square: $${activePool.settings.costPerBox}.
        Board Name: ${activePool.name}.
        Rules: Participants pick a square. Once the board is full, axes (0-9) are randomized. 
        Winning square is determined by the last digit of the score for each team at various intervals (usually quarters).
        Keep responses helpful, enthusiastic about charity, and concise.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${context}\n\nUser Question: ${userMsg}`,
      });

      setMessages(prev => [...prev, { role: 'ai', text: response.text || "I'm sorry, I couldn't process that." }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', text: "Error connecting to AI. Please try again later." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-[100] border-4 border-white animate-bounce-slow"
      >
        <i className={`fas ${isOpen ? 'fa-times' : 'fa-magic'} text-xl`}></i>
      </button>

      {isOpen && (
        <div className="fixed bottom-28 right-8 w-80 md:w-96 bg-white rounded-[2rem] shadow-2xl z-[100] border border-gray-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-indigo-600 p-6 text-white">
            <h3 className="font-black uppercase tracking-tight flex items-center gap-2">
              <i className="fas fa-robot"></i>
              Contest Assistant
            </h3>
            <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-widest mt-1">Ask me anything about the rules!</p>
          </div>

          <div 
            ref={scrollRef}
            className="flex-grow p-4 h-80 overflow-y-auto space-y-4 scrollbar-hide"
          >
            {messages.length === 0 && (
              <div className="text-center py-10">
                <p className="text-gray-400 text-xs italic">"How do I win?" or "What's the charity for?"</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed ${m.role === 'user' ? 'bg-indigo-100 text-indigo-900 rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 p-3 rounded-2xl rounded-bl-none">
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-50 flex gap-2">
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Type a message..."
              className="flex-grow bg-gray-50 border-none rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button 
              onClick={handleSend}
              className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-black transition-colors"
            >
              <i className="fas fa-paper-plane text-xs"></i>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistant;
