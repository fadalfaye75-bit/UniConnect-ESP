
import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Bot, Loader2, RefreshCcw, Trash2 } from 'lucide-react';
import { generateAIResponseStream } from '../services/geminiService';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';

interface Message {
  role: 'user' | 'model';
  text: string;
}

export default function GeminiChat() {
  const { user } = useAuth();
  const { isOpen, openChat, closeChat } = useChat();
  const initialGreeting = `Bonjour ${user?.name.split(' ')[0]} ! Je suis ton assistant JangHup. Une question sur tes cours ou ton planning ?`;
  
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: initialGreeting }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsLoading(true);

    const context = `L'utilisateur est un ${user?.role} dans la classe ${user?.className}. Son nom est ${user?.name}.`;
    
    // Initialiser le message du modèle vide
    setMessages(prev => [...prev, { role: 'model', text: '' }]);
    
    let fullResponse = "";
    try {
      const stream = generateAIResponseStream(userMsg, context);
      for await (const chunk of stream) {
        fullResponse += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last.role === 'model') {
            return [...prev.slice(0, -1), { role: 'model', text: fullResponse }];
          }
          return prev;
        });
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => {
          const next = [...prev];
          if (next[next.length - 1].role === 'model') {
              next[next.length - 1].text = "Désolé, j'ai rencontré une erreur technique.";
          }
          return next;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    if (window.confirm("Réinitialiser la conversation ?")) {
      setMessages([{ role: 'model', text: initialGreeting }]);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={openChat}
        className="fixed bottom-20 md:bottom-8 right-6 p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all z-40 group border-4 border-white dark:border-gray-800"
      >
        <Bot size={28} />
        <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity shadow-xl">
          Assistant IA
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 md:bottom-8 right-6 w-80 md:w-96 h-[550px] bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl flex flex-col z-40 border border-gray-100 dark:border-gray-700 animate-in slide-in-from-bottom-10 fade-in duration-300 overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
            <Bot size={20} />
          </div>
          <div>
            <h3 className="font-black text-sm uppercase tracking-widest italic leading-none">JangHup AI</h3>
            <p className="text-[9px] opacity-70 mt-1 uppercase font-bold tracking-tighter">Assistant Virtuel ESP</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={handleReset} 
            className="p-2 hover:bg-white/20 rounded-full transition-colors group relative"
            title="Réinitialiser"
          >
            <Trash2 size={18} />
          </button>
          <button onClick={closeChat} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50 dark:bg-gray-900/50 custom-scrollbar">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            <div className={`max-w-[85%] rounded-[1.5rem] px-5 py-3 text-sm font-medium leading-relaxed italic ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none shadow-lg shadow-blue-500/10' 
                : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-600 rounded-tl-none shadow-sm'
            }`}>
              {msg.text || (isLoading && idx === messages.length - 1 ? "..." : "")}
            </div>
          </div>
        ))}
        {isLoading && !messages[messages.length - 1].text && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-700 p-4 rounded-2xl rounded-tl-none shadow-sm">
              <Loader2 className="animate-spin text-blue-500" size={16} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Posez votre question..."
            className="flex-1 px-5 py-3 text-sm bg-gray-100 dark:bg-gray-900 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500 dark:text-white font-medium"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isLoading}
            className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
