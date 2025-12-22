
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, X, Lock, Unlock, Loader2, Pencil, Timer, Clock, CheckCircle2, BarChart2, Check, TrendingUp, Users, Search, Vote, AlertTriangle, Sparkles, Filter, FilterX, Shield, Award, Calendar, RefreshCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, Poll, ClassGroup } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export default function Polls() {
  const { user, adminViewClass } = useAuth();
  const { addNotification } = useNotification();
  
  const [polls, setPolls] = useState<Poll[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [selectedPollForResults, setSelectedPollForResults] = useState<Poll | null>(null);
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
    
    // Optimistic UI : On simule le changement localement pour l'élégance
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
      fetchPolls(false); // Rollback en cas d'erreur
    } finally {
      setVotingIds(prev => {
        const next = new Set(prev);
        next.delete(poll.id);
        return next;
      });
    }
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

  const COLOR_PALETTE = [{ start: '#0ea5e9', end: '#38bdf8' }, { start: '#10b981', end: '#34d399' }, { start: '#f59e0b', end: '#fbbf24' }];

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-32 animate-fade-in">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-gray-100 dark:border-gray-800 pb-8 sticky top-0 bg-gray-50/95 dark:bg-gray-950/95 z-20 backdrop-blur-md">
        <div className="flex items-center gap-5">
           <div className="w-14 h-14 bg-primary-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/20">
              <BarChart2 size={32} />
           </div>
           <div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter italic leading-none">Consultations</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
                 <Users size={12}/> Prenez part aux décisions de l'ESP
              </p>
           </div>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 items-center gap-3 max-w-3xl">
           <div className="relative flex-1 w-full group">
             <Search className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
             <input type="text" placeholder="Rechercher une question..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-primary-50 transition-all font-medium" />
           </div>
           {canManage && (
             <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-6 py-3.5 rounded-2xl text-xs font-black shadow-xl shadow-primary-500/20 transition-all active:scale-95 uppercase tracking-widest">
               <Plus size={18} /> Créer un sondage
             </button>
           )}
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {displayedPolls.map(poll => {
            const now = new Date();
            const pollStart = poll.startTime ? new Date(poll.startTime) : null;
            const pollEnd = poll.endTime ? new Date(poll.endTime) : null;
            const isActuallyActive = poll.isActive && (!pollStart || now >= pollStart) && (!pollEnd || now <= pollEnd);

            return (
              <div key={poll.id} className="bg-white dark:bg-gray-900 rounded-[3rem] p-10 shadow-soft border border-gray-100 dark:border-gray-800 transition-all flex flex-col relative overflow-hidden group hover:border-primary-400 hover:shadow-2xl">
                <div className="flex justify-between items-center mb-8 relative z-10">
                   <div className="flex items-center gap-2">
                      <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${isActuallyActive ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'}`}>
                        {isActuallyActive ? <><Timer size={12} className="animate-pulse" /> Ouvert</> : <><Lock size={12} /> Clos</>}
                      </div>
                      <span className="text-[8px] font-black text-gray-400 uppercase tracking-[0.2em] border border-gray-100 dark:border-gray-800 px-3 py-1.5 rounded-full">{poll.className || 'Général'}</span>
                   </div>
                   {poll.hasVoted && isActuallyActive && (
                     <div className="group/change relative">
                        <span className="text-[9px] font-black text-primary-500 uppercase tracking-widest flex items-center gap-2 bg-primary-50 dark:bg-primary-900/20 px-3 py-1.5 rounded-xl border border-primary-100">
                            <RefreshCcw size={14} className="group-hover/change:rotate-180 transition-transform duration-500" /> Vote modifiable
                        </span>
                     </div>
                   )}
                </div>

                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-8 leading-tight tracking-tighter italic">{poll.question}</h3>

                <div className="space-y-4 flex-1 relative z-10">
                  {poll.options.map(option => {
                    const percentage = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
                    const isSelected = poll.userVoteOptionId === option.id;
                    const canVote = isActuallyActive && !votingIds.has(poll.id);
                    
                    return (
                      <button 
                        key={option.id} 
                        onClick={() => canVote && handleVote(poll, option.id)} 
                        disabled={!canVote} 
                        className={`relative w-full text-left rounded-[2rem] overflow-hidden transition-all h-20 border-2 flex items-center px-8 ${
                            isSelected 
                            ? 'border-primary-500 bg-primary-50/10' 
                            : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900'
                        } ${!canVote ? 'cursor-default' : 'hover:border-primary-300 hover:scale-[1.01] active:scale-95 shadow-sm'}`}
                      >
                         <div 
                            className={`absolute left-0 top-0 bottom-0 transition-all duration-1000 ease-out ${
                                isSelected ? 'bg-primary-500/20 shadow-[inset_-5px_0_15px_rgba(14,165,233,0.1)]' : 'bg-gray-50 dark:bg-gray-800/40'
                            }`} 
                            style={{ width: `${percentage}%` }} 
                         />
                         
                         <div className="flex-1 flex items-center justify-between z-10 relative">
                              <div className="flex flex-col">
                                <span className={`text-sm font-black italic flex items-center gap-3 ${isSelected ? 'text-primary-600' : 'text-gray-700 dark:text-gray-300'}`}>
                                    {option.label}
                                    {isSelected && <CheckCircle2 size={20} className="text-primary-500 animate-in zoom-in duration-500" />}
                                </span>
                                {isSelected && <span className="text-[8px] font-black uppercase text-primary-400 mt-1 tracking-widest">Votre sélection</span>}
                              </div>
                              <div className="flex flex-col items-end">
                                <span className={`font-black text-xl ${isSelected ? 'text-primary-600' : 'text-gray-400'}`}>{percentage}%</span>
                                <span className="text-[8px] font-bold text-gray-300 uppercase">{option.votes} voix</span>
                              </div>
                         </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-10 pt-8 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="flex -space-x-3">
                            {[1,2,3].map(i => (
                                <div key={i} className={`w-8 h-8 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center text-[10px] font-black text-white bg-primary-${300 + (i*100)}`}>
                                    {String.fromCharCode(64 + i)}
                                </div>
                            ))}
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{poll.totalVotes} PARTICIPANTS</span>
                    </div>
                    <button onClick={() => { setSelectedPollForResults(poll); setIsResultsModalOpen(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-gray-50 dark:bg-gray-800 text-gray-500 hover:text-primary-500 hover:bg-primary-50 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest group">
                       <TrendingUp size={16} className="group-hover:translate-y-[-2px] transition-transform" /> ANALYSE
                    </button>
                </div>
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
                <select value={newPoll.className} onChange={e => setNewPoll({...newPoll, className: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 font-bold text-xs">
                    <option value="">Général</option>
                    {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
             </div>
             <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Date de clôture</label>
                <input type="date" value={newPoll.endTime} onChange={e => setNewPoll({...newPoll, endTime: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 font-bold text-xs" />
             </div>
          </div>

          <button type="submit" disabled={submitting} className="w-full bg-primary-500 hover:bg-primary-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-primary-500/20 transition-all flex justify-center items-center gap-3 uppercase tracking-widest active:scale-95">
            {submitting ? <Loader2 className="animate-spin" /> : <Vote size={24} />}
            {submitting ? 'Publication en cours...' : 'Programmer la consultation'}
          </button>
        </form>
      </Modal>

      <Modal isOpen={isResultsModalOpen} onClose={() => setIsResultsModalOpen(false)} title="Analyse détaillée des voix">
        {selectedPollForResults && (
          <div className="space-y-8">
             <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-[2rem] border border-gray-100">
                <h4 className="text-sm font-black text-gray-800 italic mb-4">Question : {selectedPollForResults.question}</h4>
                <div className="h-[300px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie 
                                data={selectedPollForResults.options as any[]} 
                                cx="50%" cy="50%" 
                                innerRadius={70} 
                                outerRadius={100} 
                                paddingAngle={8} 
                                dataKey="votes" 
                                nameKey="label" 
                                stroke="none"
                            >
                                {selectedPollForResults.options.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLOR_PALETTE[index % COLOR_PALETTE.length].start} />
                                ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{ borderRadius: '1.5rem', fontWeight: '800', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }} 
                            />
                            <Legend verticalAlign="bottom" iconType="circle" />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
             </div>
             
             <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100">
                    <span className="block text-[10px] font-black text-blue-400 uppercase tracking-widest">Total Voix</span>
                    <span className="text-3xl font-black text-blue-600">{selectedPollForResults.totalVotes}</span>
                </div>
                <div className="p-5 bg-purple-50 rounded-2xl border border-purple-100">
                    <span className="block text-[10px] font-black text-purple-400 uppercase tracking-widest">Classe</span>
                    <span className="text-lg font-black text-purple-600 truncate block">{selectedPollForResults.className || 'Global'}</span>
                </div>
             </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
