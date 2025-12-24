
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, Lock, Unlock, Loader2, BarChart2, Check, Users, Search, Sparkles, Shield, Send, Share2, AlertCircle, Vote as VoteIcon, X, TrendingUp, Trophy, Crown, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, Poll } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  CartesianGrid
} from 'recharts';

export default function Polls() {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const themeColor = user?.themeColor || '#0ea5e9';
  
  const [polls, setPolls] = useState<Poll[]>([]);
  const [classes, setClasses] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [animatingOptionId, setAnimatingOptionId] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');

  const [newPoll, setNewPoll] = useState({
    question: '',
    className: '',
    options: ['', ''],
    endTime: ''
  });

  const isAdmin = user?.role === UserRole.ADMIN;
  const isDelegate = user?.role === UserRole.DELEGATE;
  const canPost = isAdmin || isDelegate;

  const fetchPolls = useCallback(async (showLoader = false) => {
    try {
      if(showLoader) setLoading(true); 
      const data = await API.polls.list();
      setPolls(data);
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: 'Impossible de charger les sondages.', type: 'alert' });
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

  const handleVote = async (pollId: string, optionId: string, currentVoteId?: string) => {
    if (currentVoteId === optionId) return;
    if (!user || votingId) return;
    
    setVotingId(pollId);
    setAnimatingOptionId(optionId);
    
    try {
      await API.polls.vote(pollId, optionId);
      addNotification({ 
        title: currentVoteId ? 'Vote mis à jour' : 'Merci pour votre vote !', 
        message: currentVoteId ? 'Votre nouveau choix a été enregistré.' : 'Votre participation compte.', 
        type: 'success' 
      });
      await fetchPolls(false);
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: error.message, type: 'alert' });
    } finally {
      setVotingId(null);
      setTimeout(() => setAnimatingOptionId(null), 800);
    }
  };

  const handleToggleStatus = async (poll: Poll) => {
    try {
      await API.polls.update(poll.id, { isActive: !poll.isActive });
      addNotification({ title: 'Statut mis à jour', message: poll.isActive ? 'Clôture du scrutin.' : 'Ouverture du scrutin.', type: 'info' });
      fetchPolls(false);
    } catch (e) {
      addNotification({ title: 'Erreur', message: 'Action impossible.', type: 'alert' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Archiver définitivement ce sondage ?")) return;
    try {
      await API.polls.delete(id);
      addNotification({ title: 'Supprimé', message: 'Le sondage a été retiré.', type: 'info' });
      fetchPolls(false);
    } catch (e) {
      addNotification({ title: 'Erreur', message: 'Suppression impossible.', type: 'alert' });
    }
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    
    const validOptions = newPoll.options.filter(o => o.trim() !== '');
    if (validOptions.length < 2) {
      addNotification({ title: 'Attention', message: 'Il faut au moins 2 options.', type: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      const targetClass = isAdmin ? newPoll.className : (user?.className || 'Général');
      await API.polls.create({
        question: newPoll.question,
        className: targetClass,
        options: validOptions.map(label => ({ label })),
        endTime: newPoll.endTime || null
      });
      setIsModalOpen(false);
      setNewPoll({ question: '', className: '', options: ['', ''], endTime: '' });
      addNotification({ title: 'Succès', message: 'Votre sondage est en ligne.', type: 'success' });
      await fetchPolls(false);
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Échec de la création.', type: 'alert' });
    } finally {
      setSubmitting(false);
    }
  };

  const displayedPolls = useMemo(() => {
    return polls.filter(poll => {
      const target = poll.className || 'Général';
      if (!isAdmin && target !== 'Général' && target !== user?.className) return false;
      
      const matchesSearch = poll.question.toLowerCase().includes(searchTerm.toLowerCase());
      let matchesStatus = true;
      if (statusFilter === 'active') matchesStatus = poll.isActive;
      else if (statusFilter === 'closed') matchesStatus = !poll.isActive;
      
      return matchesSearch && matchesStatus;
    });
  }, [user, polls, searchTerm, statusFilter, isAdmin]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-2xl border border-gray-700">
          <p>{`${payload[0].payload.label}: ${payload[0].value} voix`}</p>
        </div>
      );
    }
    return null;
  };

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-[60vh] gap-6">
        <Loader2 className="animate-spin text-primary-500" size={40} />
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse italic">Synchronisation des urnes...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-32 animate-fade-in custom-scrollbar">
      {/* Page Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 border-b border-gray-100 dark:border-gray-800 pb-12 transition-all">
        <div className="flex items-center gap-6">
           <div className="w-20 h-20 text-white rounded-[2.5rem] flex items-center justify-center shadow-premium rotate-3 relative overflow-hidden group" style={{ backgroundColor: themeColor }}>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
              <BarChart2 size={36} className="relative z-10" />
           </div>
           <div>
              <h2 className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter italic uppercase leading-none">Consultations</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] mt-4 flex items-center gap-2">
                <Shield size={12} className="text-primary-500" /> Plateforme de décision collective
              </p>
           </div>
        </div>
        {canPost && (
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="group relative overflow-hidden bg-gray-900 text-white px-10 py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] shadow-premium active:scale-95 transition-all italic hover:brightness-110"
          >
            <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
            <span className="relative z-10 flex items-center gap-3"><Plus size={20} /> Lancer un scrutin</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col lg:flex-row gap-4 bg-white/80 dark:bg-gray-900/80 p-4 rounded-[2.5rem] shadow-soft border border-gray-100 dark:border-gray-800 sticky top-4 z-20 backdrop-blur-md">
        <div className="relative flex-1 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={20} />
          <input 
            type="text" placeholder="Rechercher un scrutin..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-6 py-4 bg-transparent border-none rounded-2xl text-sm font-bold italic outline-none"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'active', 'closed'].map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f as any)}
              className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                statusFilter === f ? 'bg-gray-900 text-white shadow-lg' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 hover:bg-gray-100'
              }`}
            >
              {f === 'all' ? 'Tous' : f === 'active' ? 'En cours' : 'Clos'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Polls */}
      <div className="grid gap-16">
        {displayedPolls.map((poll, idx) => {
          const isVoted = poll.hasVoted;
          const showResults = isVoted || !poll.isActive || isAdmin || isDelegate;
          
          // Calculate max votes for highlighting the leader
          const maxVotes = Math.max(...poll.options.map(o => o.votes));
          const hasMultipleWinners = poll.options.filter(o => o.votes === maxVotes && maxVotes > 0).length > 1;

          return (
            <div key={poll.id} className={`stagger-item group relative bg-white dark:bg-gray-900 rounded-[4rem] p-12 shadow-soft border border-gray-100 dark:border-gray-800 hover:shadow-premium transition-all duration-700`}>
               <div className="absolute top-0 left-0 w-3 h-full opacity-40 rounded-l-[4rem]" style={{ backgroundColor: poll.isActive ? themeColor : '#94a3b8' }} />
               
               <div className="flex flex-col lg:flex-row justify-between items-start mb-12 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                       <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2 ${poll.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                         <span className={`w-2 h-2 rounded-full ${poll.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></span>
                         {poll.isActive ? 'Scrutin ouvert' : 'Urne clôturée'}
                       </span>
                       <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest italic bg-primary-50 px-4 py-1.5 rounded-xl">{poll.className}</span>
                    </div>
                    <h3 className="text-3xl lg:text-4xl font-black italic tracking-tighter text-gray-900 dark:text-white leading-tight max-w-3xl">
                      {poll.question}
                    </h3>
                  </div>

                  <div className="flex gap-2 shrink-0">
                     { (isAdmin || (isDelegate && poll.user_id === user?.id)) && (
                       <>
                         <button onClick={() => handleToggleStatus(poll)} className={`p-4 rounded-2xl transition-all shadow-sm ${poll.isActive ? 'bg-amber-50 text-amber-500 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`} title={poll.isActive ? "Fermer le vote" : "Réouvrir le vote"}>
                           {poll.isActive ? <Lock size={20}/> : <Unlock size={20}/>}
                         </button>
                         <button onClick={() => handleDelete(poll.id)} className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-sm">
                           <Trash2 size={20}/>
                         </button>
                       </>
                     )}
                     <button onClick={() => { if(navigator.share) navigator.share({title: poll.question, text: `Scrutin UniConnect : ${poll.question}`}); }} className="p-4 bg-gray-50 dark:bg-gray-800 text-gray-400 rounded-2xl hover:bg-gray-100 transition-all shadow-sm">
                        <Share2 size={20} />
                     </button>
                  </div>
               </div>

               <div className="grid lg:grid-cols-5 gap-16 items-start">
                  {/* Left: Voting Options */}
                  <div className="lg:col-span-3 space-y-4">
                     <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-1 flex items-center gap-2">
                        {showResults ? <TrendingUp size={14}/> : <VoteIcon size={14}/>}
                        {showResults ? "Tendances actuelles" : "Exprimez votre choix"}
                     </p>
                     
                     {poll.options.map(option => {
                        const isSelected = poll.userVoteOptionId === option.id;
                        const isLeader = maxVotes > 0 && option.votes === maxVotes;
                        const percentage = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
                        const isAnimating = animatingOptionId === option.id;
                        
                        return (
                          <div key={option.id} className="relative group/opt">
                            <button 
                              disabled={!poll.isActive || votingId === poll.id}
                              onClick={() => handleVote(poll.id, option.id, poll.userVoteOptionId)} 
                              className={`w-full p-7 rounded-[2.5rem] border-2 transition-all text-left relative flex items-center justify-between overflow-hidden shadow-sm hover:shadow-md ${
                                isSelected 
                                ? 'bg-primary-600 border-primary-600 text-white shadow-xl scale-[1.02] z-10' 
                                : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-primary-300'
                              } ${!poll.isActive ? 'cursor-default' : 'active:scale-[0.98]'} ${isAnimating ? 'vote-pulse' : ''}`}
                            >
                               {/* Liquid Background Jauge */}
                               {showResults && (
                                 <div 
                                   className={`absolute left-0 top-0 bottom-0 opacity-10 transition-all duration-1000 ease-out ${isSelected ? 'bg-white' : 'bg-primary-500'}`}
                                   style={{ width: `${percentage}%` }}
                                 />
                               )}

                               <div className="flex items-center gap-5 relative z-10">
                                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isSelected ? 'bg-white/20' : 'bg-gray-50 dark:bg-gray-800'}`}>
                                     {isSelected ? <Check size={24} className="animate-bounce" /> : <div className="w-2.5 h-2.5 rounded-full bg-gray-300 group-hover/opt:scale-150 group-hover/opt:bg-primary-500 transition-all" />}
                                  </div>
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                       <span className="font-black italic text-xl tracking-tight leading-none">{option.label}</span>
                                       {isLeader && showResults && !hasMultipleWinners && (
                                         <div className="p-1 bg-amber-100 text-amber-600 rounded-lg animate-pulse" title="Leader actuel">
                                           <Crown size={12} fill="currentColor"/>
                                         </div>
                                       )}
                                    </div>
                                    {isSelected && <span className="text-[9px] font-black uppercase tracking-widest mt-2 opacity-80">Votre choix actuel</span>}
                                  </div>
                               </div>

                               {showResults && (
                                 <div className="relative z-10 flex flex-col items-end animate-fade-in">
                                    <span className="text-2xl font-black italic leading-none">{percentage}%</span>
                                    <span className="text-[9px] font-black uppercase opacity-60 tracking-widest mt-1">{option.votes} voix</span>
                                 </div>
                               )}
                            </button>
                          </div>
                        );
                     })}
                  </div>

                  {/* Right: Charts and Stats */}
                  <div className="lg:col-span-2 space-y-8">
                     <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-[3.5rem] p-10 border border-gray-100 dark:border-gray-800 flex flex-col h-full min-h-[400px]">
                        {showResults ? (
                          <div className="flex-1 flex flex-col">
                            <div className="flex items-center justify-between mb-10">
                               <div className="flex items-center gap-3">
                                  <div className="p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm text-primary-500">
                                     <Users size={20} />
                                  </div>
                                  <div>
                                     <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Participations</p>
                                     <p className="text-xl font-black italic text-gray-900 dark:text-white leading-none">{poll.totalVotes}</p>
                                  </div>
                               </div>
                               <div className="text-right">
                                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Majorité</p>
                                  <p className="text-xl font-black italic text-primary-500 leading-none">
                                    {Math.max(...poll.options.map(o => o.votes))} v.
                                  </p>
                               </div>
                            </div>

                            <div className="flex-1 min-h-[250px] relative">
                               <ResponsiveContainer width="100%" height="100%">
                                 <BarChart data={poll.options} layout="vertical" margin={{ left: -30, right: 30, top: 0, bottom: 0 }}>
                                   <XAxis type="number" hide />
                                   <YAxis dataKey="label" type="category" hide />
                                   <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                                   <Bar dataKey="votes" radius={[0, 15, 15, 0]} barSize={36} animationDuration={1500}>
                                     {poll.options.map((option, index) => (
                                       <Cell 
                                        key={`cell-${index}`} 
                                        fill={poll.userVoteOptionId === option.id ? themeColor : (option.votes === maxVotes && maxVotes > 0 ? '#fbbf24' : '#cbd5e1')} 
                                        className="transition-all duration-1000"
                                       />
                                     ))}
                                   </Bar>
                                 </BarChart>
                               </ResponsiveContainer>
                               
                               <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
                                  <BarChart2 size={120} />
                               </div>
                            </div>
                            
                            <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-4">
                               <div className="bg-white dark:bg-gray-800/50 p-4 rounded-3xl text-center">
                                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Moyenne</p>
                                  <p className="text-sm font-black italic">{(poll.totalVotes / poll.options.length).toFixed(1)} v/opt</p>
                               </div>
                               <div className="bg-white dark:bg-gray-800/50 p-4 rounded-3xl text-center">
                                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                                  <p className="text-sm font-black italic text-emerald-500">{poll.isActive ? 'Actif' : 'Scellé'}</p>
                               </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-8">
                             <div className="w-32 h-32 bg-white dark:bg-gray-800 rounded-[3rem] shadow-premium flex items-center justify-center text-primary-500 animate-pulse border-4 border-gray-50">
                                <VoteIcon size={64} />
                             </div>
                             <div className="space-y-4">
                                <h4 className="text-xl font-black italic text-gray-900 dark:text-white uppercase tracking-tight">Donnez votre avis</h4>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] leading-relaxed">Les résultats en temps réel ne sont accessibles qu'aux votants pour préserver l'intégrité du scrutin.</p>
                             </div>
                             <button className="flex items-center gap-3 px-8 py-4 bg-primary-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">
                               Participer maintenant <ArrowRight size={16}/>
                             </button>
                          </div>
                        )}
                     </div>
                  </div>
               </div>

               {poll.isActive && isVoted && (
                 <div className="mt-10 p-6 bg-primary-50 dark:bg-primary-900/10 rounded-[2rem] border border-primary-100 dark:border-primary-900/20 flex flex-col sm:flex-row items-center justify-center gap-4 group">
                    <Sparkles size={20} className="text-primary-500 animate-pulse group-hover:rotate-45 transition-transform" />
                    <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest italic text-center sm:text-left">
                       Vous avez déjà voté. Vous pouvez changer d'avis jusqu'à la clôture du scrutin par l'administrateur.
                    </p>
                 </div>
               )}
            </div>
          );
        })}

        {displayedPolls.length === 0 && (
           <div className="py-32 text-center bg-white dark:bg-gray-900 rounded-[4rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
              <AlertCircle size={48} className="mx-auto text-gray-100 mb-6" />
              <p className="text-sm font-black text-gray-400 uppercase tracking-widest italic opacity-50">Aucune consultation disponible</p>
           </div>
        )}
      </div>

      {/* Modal: Create Poll */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Lancer une consultation">
        <form onSubmit={handleCreatePoll} className="space-y-8">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Question du scrutin</label>
            <textarea 
              required 
              value={newPoll.question} 
              onChange={e => setNewPoll({...newPoll, question: e.target.value})} 
              className="w-full p-8 bg-gray-50 dark:bg-gray-800 rounded-[2.5rem] font-bold italic text-lg outline-none border-none shadow-inner-soft focus:ring-4 focus:ring-primary-50 transition-all" 
              rows={3} 
              placeholder="ex: Quel horaire préférez-vous pour le rattrapage ?" 
            />
          </div>
          
          <div className="space-y-4">
             <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Options de réponse</label>
             {newPoll.options.map((opt, i) => (
               <div key={i} className="flex gap-3">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center font-black italic text-gray-400 shrink-0">
                    {i+1}
                  </div>
                  <input 
                    type="text" 
                    required={i < 2}
                    value={opt} 
                    onChange={e => {
                      const next = [...newPoll.options];
                      next[i] = e.target.value;
                      setNewPoll({...newPoll, options: next});
                    }} 
                    className="flex-1 px-6 py-4 rounded-xl bg-gray-50 dark:bg-gray-800 font-bold italic text-sm outline-none border-none focus:ring-4 focus:ring-primary-50 transition-all" 
                    placeholder={`Option ${i+1}`} 
                  />
                  {i > 1 && (
                    <button type="button" onClick={() => setNewPoll({...newPoll, options: newPoll.options.filter((_, idx) => idx !== i)})} className="p-4 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"><X size={20}/></button>
                  )}
               </div>
             ))}
             {newPoll.options.length < 10 && (
               <button type="button" onClick={() => setNewPoll({...newPoll, options: [...newPoll.options, '']})} className="w-full py-4 border-2 border-dashed border-gray-100 dark:border-gray-800 text-gray-400 hover:text-primary-500 hover:border-primary-200 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all italic">+ Ajouter une alternative</button>
             )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 ml-1 tracking-widest">Audience académique</label>
              <select 
                disabled={!isAdmin} 
                value={newPoll.className} 
                onChange={e => setNewPoll({...newPoll, className: e.target.value})} 
                className="p-4 w-full bg-gray-50 dark:bg-gray-800 rounded-xl font-black text-[11px] uppercase outline-none shadow-sm cursor-pointer"
              >
                <option value="Général">Toute l'ESP</option>
                {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 ml-1 tracking-widest">Clôture prévue</label>
              <input 
                type="datetime-local"
                value={newPoll.endTime}
                onChange={e => setNewPoll({...newPoll, endTime: e.target.value})}
                className="p-4 w-full bg-gray-50 dark:bg-gray-800 rounded-xl font-bold text-xs outline-none shadow-sm"
              />
            </div>
          </div>

          <button type="submit" disabled={submitting} className="w-full bg-primary-600 text-white font-black py-6 rounded-[2.5rem] uppercase italic tracking-widest shadow-xl active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3">
             {submitting ? <Loader2 className="animate-spin" /> : <Send size={24} />}
             <span>Ouvrir le scrutin</span>
          </button>
        </form>
      </Modal>

      <style>{`
        .vote-pulse {
          animation: pulse-ring 0.8s cubic-bezier(0.4, 0, 0.6, 1);
        }
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.4); }
          70% { box-shadow: 0 0 0 15px rgba(14, 165, 233, 0); }
          100% { box-shadow: 0 0 0 0 rgba(14, 165, 233, 0); }
        }
      `}</style>
    </div>
  );
}

