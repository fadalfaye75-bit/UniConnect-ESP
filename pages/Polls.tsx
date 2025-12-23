
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, X, Lock, Unlock, Loader2, Pencil, Timer, Clock, CheckCircle2, BarChart2, Check, TrendingUp, Users, Search, Vote, AlertTriangle, Sparkles, Filter, FilterX, Shield, Award, Calendar, RefreshCcw, ChevronDown, ChevronUp, Trophy, Radio, Power, Share2, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, Poll, ClassGroup } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export default function Polls() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  const themeColor = user?.themeColor || '#0ea5e9';
  
  const [polls, setPolls] = useState<Poll[]>([]);
  const [classes, setClasses] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedPollId, setExpandedPollId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [votingIds, setVotingIds] = useState<Set<string>>(new Set());
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed' | 'scheduled'>('all');

  const [newPoll, setNewPoll] = useState({
    question: '',
    className: '',
    options: ['', ''],
    startTime: '',
    endTime: ''
  });

  const canManage = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;
  const isAdmin = user?.role === UserRole.ADMIN;

  const fetchPolls = useCallback(async (showLoader = false) => {
    try {
      if(showLoader) setLoading(true); 
      const data = await API.polls.list();
      setPolls(data);
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: 'Chargement échoué.', type: 'alert' });
    } finally {
      if(showLoader) setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    fetchPolls(true);
    API.classes.list().then(setClasses);
    const subscription = API.polls.subscribe(() => fetchPolls(false));
    return () => { subscription.unsubscribe(); };
  }, [fetchPolls]);

  // Initialisation de la classe lors de l'ouverture du modal
  useEffect(() => {
    if (isModalOpen) {
      setNewPoll(prev => ({
        ...prev,
        className: isAdmin ? '' : (user?.className || '')
      }));
    }
  }, [isModalOpen, isAdmin, user?.className]);

  const handleVote = useCallback(async (poll: Poll, optionId: string) => {
    if (!user || votingIds.has(poll.id) || poll.userVoteOptionId === optionId) return;

    // Optimistic Update
    const oldOptionId = poll.userVoteOptionId;
    setPolls(prev => prev.map(p => {
        if (p.id !== poll.id) return p;
        return {
            ...p,
            hasVoted: true,
            userVoteOptionId: optionId,
            options: p.options.map(opt => {
                if (opt.id === optionId) return { ...opt, votes: opt.votes + 1 };
                if (opt.id === oldOptionId) return { ...opt, votes: Math.max(0, opt.votes - 1) };
                return opt;
            }),
            totalVotes: oldOptionId ? p.totalVotes : p.totalVotes + 1
        };
    }));

    try {
      await API.polls.vote(poll.id, optionId);
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: 'Échec de la mise à jour.', type: 'alert' });
      fetchPolls(false); // Rollback
    }
  }, [user, votingIds, addNotification, fetchPolls]);

  const handleTogglePollStatus = useCallback(async (poll: Poll) => {
    if (!canManage) return;
    const nextStatus = !poll.isActive;

    // Optimistic Update
    setPolls(prev => prev.map(p => p.id === poll.id ? { ...p, isActive: nextStatus } : p));

    try {
      await API.polls.update(poll.id, { isActive: nextStatus });
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: 'Action échouée.', type: 'alert' });
      fetchPolls(false); // Rollback
    }
  }, [canManage, addNotification, fetchPolls]);

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const targetClass = isAdmin ? newPoll.className : (user?.className || 'Général');
      const payload = {
        question: newPoll.question,
        className: targetClass,
        options: newPoll.options.filter(o => o.trim() !== '').map(label => ({ label })),
        startTime: newPoll.startTime,
        endTime: newPoll.endTime
      };
      await API.polls.create(payload);
      addNotification({ title: 'Succès', message: 'Consultation lancée.', type: 'success' });
      setIsModalOpen(false);
      fetchPolls(false);
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: 'Création impossible.', type: 'alert' });
    } finally {
      setSubmitting(false);
    }
  };

  const displayedPolls = useMemo(() => {
    const now = new Date();
    return polls.filter(poll => {
      const target = (poll.className || 'Général').toLowerCase().trim();
      const userClass = (user?.className || '').toLowerCase().trim();
      
      let isVisible = isAdmin || target === 'général' || target === 'general' || target === '' || target === userClass;
      if (!isVisible) return false;
      
      const pollStart = poll.startTime ? new Date(poll.startTime) : null;
      const pollEnd = poll.endTime ? new Date(poll.endTime) : null;
      const isActuallyActive = poll.isActive && (!pollStart || now >= pollStart) && (!pollEnd || now <= pollEnd);
      const isScheduled = poll.isActive && pollStart && now < pollStart;
      const isClosed = !poll.isActive || (pollEnd && now > pollEnd);

      const matchesSearch = poll.question.toLowerCase().includes(searchTerm.toLowerCase());
      let matchesStatus = true;
      if (statusFilter === 'active') matchesStatus = isActuallyActive;
      else if (statusFilter === 'closed') matchesStatus = isClosed;
      else if (statusFilter === 'scheduled') matchesStatus = isScheduled;

      return matchesSearch && matchesStatus;
    });
  }, [user, polls, searchTerm, statusFilter, isAdmin]);

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-64 gap-4">
        <Loader2 className="animate-spin" style={{ color: themeColor }} size={32} />
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic animate-pulse">Sync...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-32 animate-fade-in">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-gray-100 dark:border-gray-800 pb-10">
        <div className="flex items-center gap-5">
           <div className="w-16 h-16 text-white rounded-[2rem] flex items-center justify-center shadow-2xl rotate-3 transition-transform hover:rotate-6" style={{ backgroundColor: themeColor }}>
              <BarChart2 size={32} />
           </div>
           <div>
              <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter italic leading-none uppercase">Consultations</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-3">ESP DAKAR • DÉCISIONNEL</p>
           </div>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 items-center gap-3 max-w-3xl">
           <div className="relative flex-1 w-full">
             <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
             <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-16 pr-6 py-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-[2rem] text-sm outline-none transition-all font-bold italic" />
           </div>
           {canManage && (
             <button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto text-white px-10 py-5 rounded-2xl text-[11px] font-black shadow-xl active:scale-95 transition-all uppercase italic" style={{ backgroundColor: themeColor }}>
               <Plus size={20} className="inline mr-2" /> Nouveau
             </button>
           )}
        </div>
      </div>

      <div className="grid gap-6">
        {displayedPolls.map(poll => {
            const isActuallyActive = poll.isActive;
            const isExpanded = expandedPollId === poll.id;

            return (
              <div 
                key={poll.id} 
                onClick={() => !isExpanded && setExpandedPollId(poll.id)}
                className={`bg-white dark:bg-gray-900 rounded-[3.5rem] p-10 shadow-soft border-2 transition-all duration-200 flex flex-col relative overflow-hidden group cursor-pointer ${
                  isExpanded ? 'scale-[1.01] border-primary-500' : 'border-transparent hover:border-gray-100'
                }`}
              >
                <div className={`absolute top-0 left-0 w-3 h-full transition-colors duration-200 ${isActuallyActive ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>

                <div className="flex flex-wrap justify-between items-start mb-10 gap-6">
                   <div className="flex flex-wrap gap-3">
                      <div className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm transition-colors ${isActuallyActive ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                        {isActuallyActive ? <Radio className="animate-pulse" size={14} /> : <Lock size={14} />} {isActuallyActive ? 'Ouvert' : 'Fermé'}
                      </div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-800 px-5 py-2.5 rounded-full border border-gray-100 dark:border-gray-800">
                        {poll.className || 'ESP'}
                      </span>
                   </div>
                   
                   <div className="flex items-center gap-2">
                     {canManage && (
                        <button onClick={(e) => { e.stopPropagation(); handleTogglePollStatus(poll); }} className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-90 text-white ${poll.isActive ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                           {poll.isActive ? 'Clôturer' : 'Ouvrir'}
                        </button>
                     )}
                     <button onClick={(e) => { e.stopPropagation(); setExpandedPollId(isExpanded ? null : poll.id); }} className={`p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-400 transition-all ${isExpanded ? 'rotate-180' : ''}`}>
                        <ChevronDown size={24} />
                     </button>
                   </div>
                </div>

                <div className="flex-1">
                  <h3 className={`text-4xl font-black text-gray-900 dark:text-white leading-[1.05] tracking-tighter italic mb-10 transition-colors duration-200 ${isExpanded ? 'text-primary-500' : ''}`}>{poll.question}</h3>

                  <div className="space-y-4">
                    {poll.options.map(option => {
                      const percentage = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
                      const isSelected = poll.userVoteOptionId === option.id;
                      const canVote = isActuallyActive;
                      
                      return (
                        <button 
                          key={option.id}
                          onClick={(e) => { e.stopPropagation(); if(canVote) handleVote(poll, option.id); }} 
                          disabled={!canVote} 
                          className={`relative w-full text-left rounded-[2rem] overflow-hidden transition-all duration-200 h-24 flex items-center px-10 border-2 ${
                              isSelected ? 'bg-gray-50/20 shadow-lg' : 'border-gray-50 dark:border-gray-800 bg-white dark:bg-gray-900'
                          } ${!canVote ? 'cursor-default opacity-80' : 'hover:translate-x-1 active:scale-95'}`}
                          style={isSelected ? { borderColor: themeColor } : {}}
                        >
                             <div className="absolute left-0 top-0 bottom-0 transition-all duration-500 opacity-20" style={{ width: `${percentage}%`, backgroundColor: isSelected ? themeColor : '#94a3b8' }} />
                             
                             <div className="flex-1 flex items-center justify-between z-10 relative">
                                  <div className="flex items-center gap-6 min-w-0">
                                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'text-white' : 'border-gray-200'}`} style={isSelected ? { backgroundColor: themeColor, borderColor: themeColor } : {}}>
                                       {isSelected && <Check size={16} strokeWidth={4} />}
                                    </div>
                                    <p className={`text-lg font-black italic truncate ${isSelected ? '' : 'text-gray-800 dark:text-gray-200'}`} style={isSelected ? { color: themeColor } : {}}>{option.label}</p>
                                  </div>
                                  <div className="flex flex-col items-end shrink-0 ml-4">
                                    <span className="text-3xl font-black italic tracking-tighter" style={isSelected ? { color: themeColor } : {}}>{percentage}%</span>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{option.votes} voix</span>
                                  </div>
                             </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
        })}
      </div>

      {/* Modal de création */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Lancer une consultation">
        <form onSubmit={handleCreatePoll} className="space-y-6">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Question centrale</label>
            <textarea required value={newPoll.question} onChange={e => setNewPoll({...newPoll, question: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 font-bold outline-none italic" rows={3} placeholder="Quelle est votre opinion sur..." />
          </div>

          <div className="space-y-3">
             <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Options de vote</label>
             {newPoll.options.map((opt, i) => (
               <div key={i} className="flex gap-2">
                 <input 
                  type="text" value={opt} onChange={e => {
                    const next = [...newPoll.options];
                    next[i] = e.target.value;
                    setNewPoll({...newPoll, options: next});
                  }}
                  className="flex-1 px-5 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm font-bold italic outline-none"
                  placeholder={`Option ${i+1}`}
                 />
                 {newPoll.options.length > 2 && (
                   <button type="button" onClick={() => setNewPoll({...newPoll, options: newPoll.options.filter((_, idx) => idx !== i)})} className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-all"><X size={18}/></button>
                 )}
               </div>
             ))}
             <button type="button" onClick={() => setNewPoll({...newPoll, options: [...newPoll.options, '']})} className="text-[10px] font-black text-primary-500 uppercase tracking-widest flex items-center gap-2 px-2 hover:underline">
               <Plus size={14} /> Ajouter un choix
             </button>
          </div>

          <div>
             <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Cible</label>
             <select 
               disabled={!isAdmin}
               value={newPoll.className} 
               onChange={e => setNewPoll({...newPoll, className: e.target.value})} 
               className={`w-full px-5 py-4 rounded-xl bg-gray-50 dark:bg-gray-800 text-[10px] font-black uppercase outline-none ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
             >
                <option value="">Général (ESP)</option>
                {isAdmin ? (
                  classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)
                ) : (
                  <option value={user?.className}>{user?.className}</option>
                )}
             </select>
          </div>

          <button type="submit" disabled={submitting} className="w-full bg-primary-500 text-white font-black py-5 rounded-[2.5rem] shadow-xl uppercase tracking-widest italic flex items-center justify-center gap-2 active:scale-95 transition-all">
             {submitting ? <Loader2 className="animate-spin" /> : <Send size={20} />} Diffuser le scrutin
          </button>
        </form>
      </Modal>
    </div>
  );
}
