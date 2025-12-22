
import React, { useState, useEffect, useMemo, useCallback } from 'react';
// Added Radio to the imports from lucide-react
import { Plus, Trash2, X, Lock, Unlock, Loader2, Pencil, Timer, Clock, CheckCircle2, BarChart2, Check, TrendingUp, Users, Search, Vote, AlertTriangle, Sparkles, Filter, FilterX, Shield, Award, Calendar, RefreshCcw, ChevronDown, ChevronUp, Trophy, Radio } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, Poll, ClassGroup } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export default function Polls() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  
  const [polls, setPolls] = useState<Poll[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedPollId, setExpandedPollId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  const [votingIds, setVotingIds] = useState<Set<string>>(new Set());
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed' | 'scheduled'>('all');
  const [classFilter, setClassFilter] = useState<string>('all');

  const [newPoll, setNewPoll] = useState({
    question: '',
    className: '',
    options: ['', ''],
    startTime: '',
    endTime: ''
  });

  const canManage = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;

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

  const displayedPolls = useMemo(() => {
    const now = new Date();
    return polls.filter(poll => {
      const target = (poll.className || 'Général').toLowerCase().trim();
      const userClass = (user?.className || '').toLowerCase().trim();
      const isVisible = user?.role === UserRole.ADMIN ? true : (target === userClass || target === 'général');
      
      if (!isVisible) return false;
      const pollStart = poll.startTime ? new Date(poll.startTime) : null;
      const pollEnd = poll.endTime ? new Date(poll.endTime) : null;
      const isActuallyActive = poll.isActive && (!pollStart || now >= pollStart) && (!pollEnd || now <= pollEnd);
      const isScheduled = poll.isActive && pollStart && now < pollStart;
      const isClosed = !poll.isActive || (pollEnd && now > pollEnd);

      const matchesClassFilter = classFilter === 'all' || poll.className === classFilter;
      const matchesSearch = poll.question.toLowerCase().includes(searchTerm.toLowerCase());
      let matchesStatus = true;
      if (statusFilter === 'active') matchesStatus = isActuallyActive;
      else if (statusFilter === 'closed') matchesStatus = isClosed;
      else if (statusFilter === 'scheduled') matchesStatus = isScheduled;

      return matchesClassFilter && matchesSearch && matchesStatus;
    });
  }, [user, polls, searchTerm, statusFilter, classFilter]);

  const handleVote = async (poll: Poll, optionId: string) => {
    if (!user || votingIds.has(poll.id)) return;
    
    const isChangingVote = poll.hasVoted && poll.userVoteOptionId !== optionId;
    if (poll.userVoteOptionId === optionId) return;

    setVotingIds(prev => new Set(prev).add(poll.id));
    
    // Optimistic UI update
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
      addNotification({ 
        title: isChangingVote ? 'Vote modifié' : 'Vote enregistré', 
        message: 'Votre choix a été mis à jour avec succès.', 
        type: 'success' 
      });
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: 'Échec de la mise à jour.', type: 'alert' });
      fetchPolls(false); 
    } finally {
      setVotingIds(prev => {
        const next = new Set(prev);
        next.delete(poll.id);
        return next;
      });
    }
  };

  const toggleExpand = (pollId: string) => {
    setExpandedPollId(expandedPollId === pollId ? null : pollId);
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await API.polls.create({
        question: newPoll.question,
        className: newPoll.className,
        options: newPoll.options.filter(o => o.trim() !== '').map(o => ({ label: o })),
        startTime: newPoll.startTime,
        endTime: newPoll.endTime
      });
      setIsModalOpen(false);
      addNotification({ title: 'Sondage publié', message: 'La consultation est ouverte.', type: 'success' });
      fetchPolls(false);
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: 'Création impossible.', type: 'alert' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-full gap-4">
        <Loader2 className="animate-spin text-primary-500" size={40} />
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse italic">Synchronisation des scrutins...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-32 animate-fade-in">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-gray-100 dark:border-gray-800 pb-8 sticky top-0 bg-gray-50/95 dark:bg-gray-950/95 z-20 backdrop-blur-md">
        <div className="flex items-center gap-5">
           <div className="w-14 h-14 bg-gradient-to-br from-violet-600 to-primary-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/20">
              <BarChart2 size={32} />
           </div>
           <div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter italic leading-none uppercase">Consultations</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
                 <Users size={12}/> {user?.className} • DÉCISIONNEL
              </p>
           </div>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 items-center gap-3 max-w-3xl">
           <div className="relative flex-1 w-full group">
             <Search className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
             <input type="text" placeholder="Rechercher un scrutin..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-primary-50 transition-all font-bold italic" />
           </div>
           {canManage && (
             <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-primary-600 text-white px-8 py-3.5 rounded-2xl text-xs font-black shadow-xl shadow-primary-500/20 active:scale-95 transition-all uppercase tracking-widest italic">
               <Plus size={18} /> Nouveau Scrutin
             </button>
           )}
        </div>
      </div>

      <div className="grid gap-8">
        {displayedPolls.map(poll => {
            const now = new Date();
            const pollStart = poll.startTime ? new Date(poll.startTime) : null;
            const pollEnd = poll.endTime ? new Date(poll.endTime) : null;
            const isActuallyActive = poll.isActive && (!pollStart || now >= pollStart) && (!pollEnd || now <= pollEnd);
            const isExpanded = expandedPollId === poll.id;
            const maxVotes = Math.max(...poll.options.map(o => o.votes), 1);

            return (
              <div 
                key={poll.id} 
                onClick={() => !isExpanded && toggleExpand(poll.id)}
                className={`bg-white dark:bg-gray-900 rounded-[3rem] p-8 md:p-12 shadow-soft border-2 transition-all duration-500 flex flex-col relative overflow-hidden group cursor-pointer ${
                  isExpanded ? 'border-primary-500 shadow-2xl scale-[1.01]' : 'border-transparent hover:border-gray-100 hover:shadow-xl'
                }`}
              >
                {/* Visual Accent */}
                <div className={`absolute top-0 left-0 w-2 h-full ${isActuallyActive ? 'bg-green-500' : 'bg-gray-300'}`}></div>

                <div className="flex justify-between items-start mb-8">
                   <div className="flex flex-wrap gap-3">
                      <div className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm ${isActuallyActive ? 'bg-green-100 text-green-600 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                        {isActuallyActive ? <><Radio className="animate-pulse" size={14} /> Scrutin en cours</> : <><Lock size={14} /> Consultation fermée</>}
                      </div>
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-800 px-5 py-2 rounded-full border border-gray-100 dark:border-gray-800">
                        {poll.className || 'ESP DAKAR'}
                      </span>
                   </div>
                   <button 
                    onClick={(e) => { e.stopPropagation(); toggleExpand(poll.id); }}
                    className={`p-3 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-primary-500 transition-all ${isExpanded ? 'rotate-180 bg-primary-50 text-primary-500' : ''}`}
                   >
                     <ChevronDown size={24} />
                   </button>
                </div>

                <div className="flex-1">
                  <h3 className={`text-3xl font-black text-gray-900 dark:text-white leading-[1.1] tracking-tighter italic mb-10 transition-colors ${isExpanded ? 'text-primary-600' : ''}`}>
                    {poll.question}
                  </h3>

                  <div className="space-y-4">
                    {poll.options.map(option => {
                      const percentage = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
                      const isSelected = poll.userVoteOptionId === option.id;
                      const isLeader = option.votes === maxVotes && poll.totalVotes > 0;
                      const canVote = isActuallyActive && !votingIds.has(poll.id);
                      
                      return (
                        <div key={option.id} className="relative">
                          <button 
                            onClick={(e) => { e.stopPropagation(); if(canVote) handleVote(poll, option.id); }} 
                            disabled={!canVote} 
                            className={`relative w-full text-left rounded-[2rem] overflow-hidden transition-all h-24 flex items-center px-10 border-2 ${
                                isSelected 
                                ? 'border-primary-500 bg-primary-50/20 shadow-lg' 
                                : 'border-gray-50 dark:border-gray-800 bg-white dark:bg-gray-900'
                            } ${!canVote ? 'cursor-default' : 'hover:border-primary-300 hover:translate-x-1 active:scale-95'}`}
                          >
                             {/* Progress Bar with Gradient */}
                             <div 
                                className={`absolute left-0 top-0 bottom-0 transition-all duration-1000 ease-out opacity-20 ${
                                    isSelected ? 'bg-gradient-to-r from-primary-600 to-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
                                }`} 
                                style={{ width: `${percentage}%` }} 
                             />
                             
                             <div className="flex-1 flex items-center justify-between z-10 relative">
                                  <div className="flex items-center gap-6 min-w-0">
                                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-primary-500 border-primary-500 text-white scale-125' : 'border-gray-200'}`}>
                                       {isSelected ? <Check size={16} strokeWidth={4} /> : null}
                                    </div>
                                    <div className="min-w-0">
                                      <p className={`text-lg font-black italic truncate ${isSelected ? 'text-primary-600' : 'text-gray-800 dark:text-gray-200'}`}>
                                        {option.label}
                                      </p>
                                      {isLeader && isExpanded && (
                                        <span className="text-[9px] font-black text-amber-500 uppercase flex items-center gap-1 mt-1">
                                          <Trophy size={10} /> En tête du vote
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex flex-col items-end shrink-0 ml-4">
                                    <span className={`text-3xl font-black italic tracking-tighter ${isSelected ? 'text-primary-600' : 'text-gray-900 dark:text-white'}`}>
                                      {percentage}%
                                    </span>
                                    <div className="flex items-center gap-2">
                                       <span className="text-[10px] font-bold text-gray-400 uppercase">{option.votes} voix</span>
                                    </div>
                                  </div>
                             </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Expanded Section with More Charts */}
                {isExpanded && (
                  <div className="mt-12 pt-12 border-t-2 border-dashed border-gray-100 dark:border-gray-800 space-y-10 animate-in slide-in-from-top-4 duration-500">
                    <div className="grid md:grid-cols-2 gap-10">
                      <div className="bg-gray-50 dark:bg-gray-800/40 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                          <TrendingUp size={14} className="text-primary-500" /> Répartition Analytique
                        </h4>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={poll.options} layout="vertical">
                              <XAxis type="number" hide />
                              <YAxis dataKey="label" type="category" hide />
                              <Tooltip 
                                contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: '900', fontSize: '10px' }}
                              />
                              <Bar dataKey="votes" radius={[0, 10, 10, 0]}>
                                {poll.options.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.id === poll.userVoteOptionId ? '#0ea5e9' : '#e2e8f0'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="flex flex-col justify-center space-y-6">
                        <div className="p-8 bg-primary-500 text-white rounded-[2.5rem] shadow-xl shadow-primary-500/20 relative overflow-hidden">
                           <Users className="absolute -bottom-6 -right-6 w-32 h-32 opacity-10" />
                           <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Participation Totale</p>
                           <h4 className="text-5xl font-black italic tracking-tighter mt-2">{poll.totalVotes}</h4>
                           <p className="text-[11px] font-bold mt-4 uppercase tracking-widest">Voix exprimées à l'ESP</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-6 bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Statut</span>
                            <p className={`text-sm font-black italic mt-1 ${isActuallyActive ? 'text-green-500' : 'text-gray-500'}`}>
                              {isActuallyActive ? 'ACTIF' : 'CLOS'}
                            </p>
                          </div>
                          <div className="p-6 bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Type</span>
                            <p className="text-sm font-black italic mt-1 text-primary-500 uppercase">ANONYME</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center">
                       <button 
                        onClick={() => toggleExpand(poll.id)}
                        className="flex items-center gap-2 px-10 py-4 bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 rounded-2xl text-[10px] font-black uppercase tracking-widest italic shadow-xl hover:scale-105 active:scale-95 transition-all"
                       >
                         <ChevronUp size={16} /> Replier les détails
                       </button>
                    </div>
                  </div>
                )}

                {/* Footer simple (si non étendu) */}
                {!isExpanded && (
                  <div className="mt-8 pt-8 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between opacity-60">
                     <div className="flex items-center gap-3">
                        <Users size={16} className="text-gray-400" />
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">{poll.totalVotes} PARTICIPANTS</span>
                     </div>
                     <span className="text-[9px] font-black text-primary-500 uppercase tracking-[0.2em] italic group-hover:translate-x-2 transition-transform">Cliquez pour analyser <ChevronDown className="-rotate-90 inline ml-1" size={12}/></span>
                  </div>
                )}
              </div>
            );
        })}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Lancer une consultation">
        <form onSubmit={handleCreatePoll} className="space-y-6">
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Question de la consultation</label>
            <textarea required rows={3} value={newPoll.question} onChange={e => setNewPoll({...newPoll, question: e.target.value})} className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-bold outline-none focus:ring-4 focus:ring-primary-50 transition-all italic text-lg" placeholder="Quelle est votre opinion sur..." />
          </div>
          <div className="space-y-3">
             <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Options de réponse</label>
             {newPoll.options.map((opt, idx) => (
                <div key={idx} className="relative group">
                    <input required type="text" value={opt} placeholder={`Option ${idx + 1}`} onChange={e => {
                        const next = [...newPoll.options];
                        next[idx] = e.target.value;
                        setNewPoll({...newPoll, options: next});
                    }} className="w-full px-5 py-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-bold focus:bg-white transition-all" />
                    {newPoll.options.length > 2 && (
                        <button type="button" onClick={() => setNewPoll({...newPoll, options: newPoll.options.filter((_, i) => i !== idx)})} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-500"><X size={16}/></button>
                    )}
                </div>
             ))}
             <button type="button" onClick={() => setNewPoll({...newPoll, options: [...newPoll.options, '']})} className="text-[10px] font-black text-primary-500 uppercase flex items-center gap-2 py-3 px-4 bg-primary-50 rounded-xl w-full justify-center border border-dashed border-primary-200 hover:bg-primary-100 transition-all">
                <Plus size={16} /> Ajouter un choix
             </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Classe cible</label>
                <select value={newPoll.className} onChange={e => setNewPoll({...newPoll, className: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 font-bold text-xs uppercase">
                    <option value="">Général</option>
                    {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
             </div>
             <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Date de clôture</label>
                <input type="date" value={newPoll.endTime} onChange={e => setNewPoll({...newPoll, endTime: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 font-bold text-xs" />
             </div>
          </div>

          <button type="submit" disabled={submitting} className="w-full bg-primary-500 hover:bg-primary-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-primary-500/20 transition-all flex justify-center items-center gap-3 uppercase tracking-widest active:scale-95 italic">
            {submitting ? <Loader2 className="animate-spin" /> : <Vote size={24} />}
            {submitting ? 'Publication...' : 'Ouvrir le scrutin'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
