
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, X, Lock, Unlock, Loader2, Pencil, Timer, Clock, CheckCircle2, BarChart2, Check, TrendingUp, Users, Search, Vote, AlertTriangle, Sparkles, Filter, FilterX, Shield, Award, Calendar } from 'lucide-react';
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
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Chargement des sondages impossible.', type: 'alert' });
    } finally {
      if(showLoader) setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    fetchPolls(true);
    API.classes.list().then(setClasses);
    const subscription = API.polls.subscribe(() => fetchPolls(false));
    return () => subscription.unsubscribe();
  }, [fetchPolls]);

  const openCreateModal = () => {
    setNewPoll({
      question: '',
      className: user?.role === UserRole.DELEGATE ? user.className : 'Général',
      options: ['', ''],
      startTime: '',
      endTime: ''
    });
    setIsModalOpen(true);
  };

  const displayedPolls = useMemo(() => {
    const now = new Date();
    return polls.filter(poll => {
      const target = (poll.className || 'Général').toLowerCase().trim();
      const userClass = (user?.className || '').toLowerCase().trim();
      
      // Visibilité logicielle plus souple
      const isVisible = user?.role === UserRole.ADMIN 
        ? true 
        : (target === userClass || target === 'général' || poll.className === 'Général');
      
      if (!isVisible) return false;

      const pollStart = poll.startTime ? new Date(poll.startTime) : null;
      const pollEnd = poll.endTime ? new Date(poll.endTime) : null;
      
      const isActuallyActive = poll.isActive && 
        (!pollStart || isNaN(pollStart.getTime()) || now >= pollStart) && 
        (!pollEnd || isNaN(pollEnd.getTime()) || now <= pollEnd);
      
      const isScheduled = poll.isActive && pollStart && !isNaN(pollStart.getTime()) && now < pollStart;
      const isClosed = !poll.isActive || (pollEnd && !isNaN(pollEnd.getTime()) && now > pollEnd);

      const matchesClassFilter = classFilter === 'all' || poll.className === classFilter;
      const matchesSearch = poll.question.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesStatus = true;
      if (statusFilter === 'active') matchesStatus = isActuallyActive;
      else if (statusFilter === 'closed') matchesStatus = isClosed;
      else if (statusFilter === 'scheduled') matchesStatus = isScheduled;

      return matchesClassFilter && matchesSearch && matchesStatus;
    }).sort((a, b) => {
        // Fallback sur createdAt si startTime est manquant
        const aTime = a.startTime ? new Date(a.startTime).getTime() : new Date((a as any).createdAt || 0).getTime();
        const bTime = b.startTime ? new Date(b.startTime).getTime() : new Date((b as any).createdAt || 0).getTime();
        return bTime - aTime;
    });
  }, [user, polls, searchTerm, statusFilter, classFilter]);

  const handleVote = async (poll: Poll, optionId: string) => {
    if (!user) return;
    
    const now = new Date();
    const pollStart = poll.startTime ? new Date(poll.startTime) : null;
    const pollEnd = poll.endTime ? new Date(poll.endTime) : null;
    
    const isActuallyActive = poll.isActive && 
      (!pollStart || isNaN(pollStart.getTime()) || now >= pollStart) && 
      (!pollEnd || isNaN(pollEnd.getTime()) || now <= pollEnd);

    if (!isActuallyActive) {
        addNotification({ title: 'Vote impossible', message: 'Ce sondage est programmé ou expiré.', type: 'warning' });
        return;
    }

    const originalPolls = [...polls];
    setPolls(prev => prev.map(p => {
        if (p.id === poll.id) {
            return {
                ...p, hasVoted: true, userVoteOptionId: optionId, totalVotes: p.totalVotes + 1,
                options: p.options.map(o => o.id === optionId ? { ...o, votes: o.votes + 1 } : o)
            };
        }
        return p;
    }));

    try {
      await API.polls.vote(poll.id, optionId);
      addNotification({ title: 'Vote enregistré', message: 'Merci !', type: 'success' });
    } catch (error) {
      setPolls(originalPolls);
      addNotification({ title: 'Erreur', message: 'Échec de la connexion.', type: 'alert' });
    }
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOptions = newPoll.options.filter(o => o.trim() !== '');
    if (cleanOptions.length < 2) {
      addNotification({ title: 'Options insuffisantes', message: 'Veuillez entrer au moins 2 options.', type: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      await API.polls.create({
        question: newPoll.question,
        className: newPoll.className,
        options: cleanOptions.map(o => ({ label: o })),
        startTime: newPoll.startTime,
        endTime: newPoll.endTime
      });
      setIsModalOpen(false);
      addNotification({ title: 'Sondage publié', message: 'La programmation est enregistrée.', type: 'success' });
      fetchPolls(false);
    } catch (error: any) {
      addNotification({ 
        title: 'Erreur de création', 
        message: error?.message || 'Une erreur est survenue.', 
        type: 'alert' 
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (poll: Poll) => {
    try {
      await API.polls.toggleStatus(poll.id);
      fetchPolls();
    } catch (error) {
       addNotification({ title: 'Erreur', message: 'Action impossible.', type: 'alert' });
    }
  };

  const handleDelete = async (id: string) => {
      if(!window.confirm("Supprimer ce sondage ?")) return;
      try {
          await API.polls.delete(id);
          fetchPolls();
      } catch(e) {
          addNotification({ title: 'Erreur', message: 'Action échouée.', type: 'alert' });
      }
  };

  const COLOR_PALETTE = [
    { start: '#0ea5e9', end: '#38bdf8' },
    { start: '#10b981', end: '#34d399' },
    { start: '#f59e0b', end: '#fbbf24' },
    { start: '#f43f5e', end: '#fb7185' },
    { start: '#8b5cf6', end: '#a78bfa' },
  ];

  const winnerOption = useMemo(() => {
    if (!selectedPollForResults) return null;
    return [...selectedPollForResults.options].sort((a,b) => b.votes - a.votes)[0];
  }, [selectedPollForResults]);

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-64 gap-4">
        <Loader2 className="animate-spin text-primary-500" size={40} />
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest italic animate-pulse">Lecture des urnes...</p>
    </div>
  );

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
                 <Users size={12}/> {displayedPolls.length} Sujets disponibles
              </p>
           </div>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 items-center gap-3 max-w-3xl">
           <div className="relative flex-1 w-full group">
             <Search className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
             <input 
                type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-primary-50 transition-all font-medium"
             />
           </div>
           
           <select 
             value={statusFilter} 
             onChange={e => setStatusFilter(e.target.value as any)}
             className="px-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-xs font-black text-gray-600 dark:text-gray-300 outline-none cursor-pointer uppercase tracking-widest"
           >
              <option value="all">Statut (Tous)</option>
              <option value="active">En cours</option>
              <option value="scheduled">Programmés</option>
              <option value="closed">Terminés</option>
           </select>

           {canManage && (
             <button onClick={openCreateModal} className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-6 py-3.5 rounded-2xl text-xs font-black shadow-xl shadow-primary-500/20 transition-all active:scale-95 uppercase tracking-widest">
               <Plus size={18} /> Nouveau
             </button>
           )}
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {displayedPolls.length > 0 ? displayedPolls.map(poll => {
            const totalVotes = poll.totalVotes || 0;
            const hasVoted = poll.hasVoted;
            
            const now = new Date();
            const pollStart = poll.startTime ? new Date(poll.startTime) : null;
            const pollEnd = poll.endTime ? new Date(poll.endTime) : null;
            const isActuallyActive = poll.isActive && (!pollStart || isNaN(pollStart.getTime()) || now >= pollStart) && (!pollEnd || isNaN(pollEnd.getTime()) || now <= pollEnd);
            const isScheduled = poll.isActive && pollStart && !isNaN(pollStart.getTime()) && now < pollStart;
            const isExpired = pollEnd && !isNaN(pollEnd.getTime()) && now > pollEnd;

            return (
              <div key={poll.id} className="bg-white dark:bg-gray-900 rounded-[3rem] p-10 shadow-soft border border-gray-100 dark:border-gray-800 transition-all flex flex-col relative overflow-hidden group hover:border-primary-400">
                <div className="flex justify-between items-center mb-8 relative z-10">
                   <div className="flex items-center gap-2 flex-wrap">
                      <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${
                        isActuallyActive ? 'bg-green-500 text-white' : 
                        isScheduled ? 'bg-blue-500 text-white' : 
                        'bg-gray-400 text-white'
                      }`}>
                        {isActuallyActive ? <><Timer size={12} /> Ouvert</> : 
                         isScheduled ? <><Calendar size={12} /> Programmé</> : 
                         <><Lock size={12} /> Clos</>}
                      </div>
                      <span className="text-[8px] font-black text-gray-400 uppercase tracking-[0.2em] border border-gray-100 dark:border-gray-800 px-3 py-1.5 rounded-full">{poll.className || 'Général'}</span>
                   </div>
                   {canManage && (
                        <div className="flex gap-2">
                            <button onClick={() => handleToggleStatus(poll)} className="p-2.5 bg-gray-50 dark:bg-gray-800 text-gray-500 hover:text-primary-500 rounded-xl transition-colors" title="Désactiver manuellement">
                                {poll.isActive ? <Lock size={18} /> : <Unlock size={18} />}
                            </button>
                            <button onClick={() => handleDelete(poll.id)} className="p-2.5 bg-gray-50 dark:bg-gray-800 text-gray-500 hover:text-red-500 rounded-xl transition-colors">
                                <Trash2 size={18} />
                            </button>
                        </div>
                   )}
                </div>

                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-8 leading-tight tracking-tighter italic">{poll.question}</h3>

                <div className="space-y-4 flex-1 relative z-10">
                  {poll.options.map(option => {
                    const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
                    const isSelected = poll.userVoteOptionId === option.id;
                    const canVote = isActuallyActive && !hasVoted;
                    
                    return (
                      <button 
                        key={option.id} 
                        onClick={() => canVote && handleVote(poll, option.id)} 
                        disabled={!canVote} 
                        className={`relative w-full text-left rounded-[2rem] overflow-hidden transition-all h-16 border-2 flex items-center px-6 ${
                          isSelected ? 'border-primary-500 bg-primary-50/10' : 'border-gray-100 dark:border-gray-800'
                        } ${!canVote ? 'cursor-default' : 'hover:border-primary-300'}`}
                      >
                         <div className={`absolute left-0 top-0 bottom-0 transition-all duration-1000 ${isSelected ? 'bg-primary-500/20' : 'bg-gray-50 dark:bg-gray-800/40'}`} style={{ width: `${percentage}%` }} />
                         <div className="flex-1 flex items-center justify-between z-10 relative">
                              <span className={`text-sm font-black italic ${isSelected ? 'text-primary-600' : 'text-gray-700 dark:text-gray-300'}`}>
                                {option.label}
                                {isSelected && <CheckCircle2 size={18} className="inline ml-3 text-primary-500" />}
                              </span>
                              <span className="font-black text-[11px] text-gray-400">{percentage}%</span>
                         </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-8 mb-10 text-[9px] font-bold text-gray-400 italic flex flex-col gap-1">
                   {pollStart && !isNaN(new Date(pollStart).getTime()) && <span>Début : {new Date(pollStart).toLocaleString()}</span>}
                   {pollEnd && !isNaN(new Date(pollEnd).getTime()) && <span className={isExpired ? "text-red-500" : ""}>Fin : {new Date(pollEnd).toLocaleString()} {isExpired && "(Expiré)"}</span>}
                </div>

                <div className="pt-8 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between relative z-10">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{totalVotes} VOTES</span>
                        <span className="text-[9px] font-black text-primary-500 uppercase tracking-widest mt-1">CIBLE : {poll.className || "L'école"}</span>
                    </div>
                    <button onClick={() => { setSelectedPollForResults(poll); setIsResultsModalOpen(true); }} className="p-3 bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-primary-500 rounded-2xl transition-all">
                       <TrendingUp size={18} />
                    </button>
                </div>
              </div>
            );
        }) : (
          <div className="col-span-full py-20 text-center bg-white/50 dark:bg-gray-900/50 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-gray-800 animate-fade-in">
              <FilterX size={64} className="mx-auto text-gray-100 dark:text-gray-800 mb-6 opacity-10" />
              <p className="text-sm font-black text-gray-400 uppercase tracking-widest italic opacity-60">Aucun sondage trouvé</p>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Lancer une consultation">
        <form onSubmit={handleCreatePoll} className="space-y-6">
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Question</label>
            <textarea 
              required rows={2} value={newPoll.question}
              onChange={e => setNewPoll({...newPoll, question: e.target.value})}
              placeholder="Sujet de consultation..."
              className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-bold outline-none focus:ring-4 focus:ring-primary-50 transition-all italic"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Date de début</label>
                <input type="datetime-local" value={newPoll.startTime} onChange={e => setNewPoll({...newPoll, startTime: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-[10px] font-black outline-none" />
             </div>
             <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Date de fin</label>
                <input type="datetime-local" value={newPoll.endTime} onChange={e => setNewPoll({...newPoll, endTime: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-[10px] font-black outline-none" />
             </div>
          </div>

          {user?.role === UserRole.ADMIN ? (
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Cible (Classe)</label>
              <select 
                value={newPoll.className}
                onChange={e => setNewPoll({...newPoll, className: e.target.value})}
                className="w-full px-5 py-3.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-black text-gray-900 dark:text-white outline-none focus:ring-4 focus:ring-primary-50 transition-all uppercase tracking-widest"
              >
                <option value="Général">Général (Toute l'école)</option>
                {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          ) : (
            <div className="p-4 bg-primary-50 dark:bg-primary-900/10 rounded-2xl border border-primary-100 dark:border-primary-800">
               <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest flex items-center gap-2">
                  <Shield size={14} /> Publication pour : {user?.className}
               </p>
            </div>
          )}

          <div className="space-y-3">
             <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Options</label>
             {newPoll.options.map((opt, idx) => (
                <div key={idx} className="flex gap-2">
                   <input required type="text" value={opt}
                      onChange={e => {
                        const next = [...newPoll.options];
                        next[idx] = e.target.value;
                        setNewPoll({...newPoll, options: next});
                      }}
                      className="flex-1 px-5 py-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-bold"
                   />
                   {newPoll.options.length > 2 && (
                      <button type="button" onClick={() => {
                        const next = [...newPoll.options];
                        next.splice(idx, 1);
                        setNewPoll({...newPoll, options: next});
                      }} className="p-3 text-red-500"><Trash2 size={18} /></button>
                   )}
                </div>
             ))}
             {newPoll.options.length < 5 && (
                <button type="button" onClick={() => setNewPoll({...newPoll, options: [...newPoll.options, '']})} className="text-[10px] font-black text-primary-500 uppercase flex items-center gap-2 py-2">
                   <Plus size={16} /> Ajouter une option
                </button>
             )}
          </div>

          <button type="submit" disabled={submitting} className="w-full bg-primary-500 hover:bg-primary-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary-500/20 transition-all flex justify-center items-center gap-2 uppercase tracking-widest">
            {submitting ? <Loader2 className="animate-spin" /> : <Vote size={20} />}
            {submitting ? 'Publication...' : 'Programmer la consultation'}
          </button>
        </form>
      </Modal>

      <Modal isOpen={isResultsModalOpen} onClose={() => setIsResultsModalOpen(false)} title="Analyse des résultats">
        {selectedPollForResults && (
          <div className="space-y-8">
             <div className="h-[320px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <defs>
                          {COLOR_PALETTE.map((color, index) => (
                            <linearGradient key={`grad-${index}`} id={`grad-${index}`} x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor={color.start} stopOpacity={1} />
                              <stop offset="100%" stopColor={color.end} stopOpacity={1} />
                            </linearGradient>
                          ))}
                        </defs>
                        <Pie 
                          data={selectedPollForResults.options.map(o => ({ ...o }))} 
                          cx="50%" cy="50%" 
                          innerRadius={70} outerRadius={100} 
                          paddingAngle={8} 
                          dataKey="votes" nameKey="label" 
                          stroke="none"
                          animationBegin={0}
                          animationDuration={1500}
                        >
                            {selectedPollForResults.options.map((_, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={`url(#grad-${index % COLOR_PALETTE.length})`} 
                                className="outline-none"
                              />
                            ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                            backdropFilter: 'blur(8px)',
                            border: 'none', 
                            borderRadius: '1rem', 
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                            fontSize: '12px',
                            fontWeight: '800'
                          }}
                          itemStyle={{ color: '#111827' }}
                        />
                        <Legend 
                          verticalAlign="bottom" 
                          iconType="circle"
                          wrapperStyle={{ 
                            paddingTop: '20px', 
                            fontSize: '10px', 
                            fontWeight: '900', 
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em'
                          }} 
                        />
                    </PieChart>
                </ResponsiveContainer>
                {winnerOption && (
                   <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center pointer-events-none">
                      <Award size={32} className="text-primary-500 mb-1" />
                      <span className="text-[10px] font-black uppercase text-primary-600">Majorité</span>
                   </div>
                )}
             </div>
             
             <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3 text-primary-500 mb-4">
                   <TrendingUp size={20} />
                   <h4 className="text-xs font-black uppercase tracking-widest">Résumé des participations</h4>
                </div>
                <div className="flex justify-between items-end">
                   <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total des voix</p>
                      <p className="text-3xl font-black text-gray-900 dark:text-white leading-none mt-1">{selectedPollForResults.totalVotes}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut actuel</p>
                      <p className={`text-xs font-black uppercase mt-1 ${selectedPollForResults.isActive ? 'text-green-500' : 'text-gray-500'}`}>
                         {selectedPollForResults.isActive ? 'Actif' : 'Clôturé'}
                      </p>
                   </div>
                </div>
             </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
