
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, Lock, Unlock, Loader2, BarChart2, Check, Users, Search, Sparkles, Shield, Send, Share2, AlertCircle, Vote, X, TrendingUp } from 'lucide-react';
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
  Cell
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
  const [votedOptionId, setVotedOptionId] = useState<string | null>(null); // Pour l'animation locale
  
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
    setVotedOptionId(optionId); // Trigger l'animation locale
    
    try {
      await API.polls.vote(pollId, optionId);
      addNotification({ 
        title: currentVoteId ? 'Vote modifié' : 'Merci pour votre vote !', 
        message: 'Votre choix a été enregistré avec succès.', 
        type: 'success' 
      });
      await fetchPolls(false);
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: error.message, type: 'alert' });
    } finally {
      setVotingId(null);
      setTimeout(() => setVotedOptionId(null), 600);
    }
  };

  const handleToggleStatus = async (poll: Poll) => {
    try {
      await API.polls.update(poll.id, { isActive: !poll.isActive });
      addNotification({ title: 'Statut mis à jour', message: poll.isActive ? 'Le sondage est maintenant clos.' : 'Le sondage est à nouveau ouvert.', type: 'info' });
      fetchPolls(false);
    } catch (e) {
      addNotification({ title: 'Erreur', message: 'Action impossible.', type: 'alert' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Supprimer définitivement ce sondage ?")) return;
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
      addNotification({ title: 'Succès', message: 'Votre sondage est maintenant en ligne.', type: 'success' });
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

  const isNew = (createdAt: string) => {
    const hoursSinceCreation = (new Date().getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
    return hoursSinceCreation < 48;
  };

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-64 gap-6">
        <Loader2 className="animate-spin text-primary-500" size={40} />
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse italic">Ouverture des urnes...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-32 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 border-b border-gray-100 dark:border-gray-800 pb-12">
        <div className="flex items-center gap-6">
           <div className="w-20 h-20 text-white rounded-[2rem] flex items-center justify-center shadow-premium rotate-3 relative overflow-hidden group" style={{ backgroundColor: themeColor }}>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
              <BarChart2 size={36} className="relative z-10" />
           </div>
           <div>
              <h2 className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter italic uppercase leading-none">Sondages</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] mt-4 flex items-center gap-2">
                <Shield size={12} className="text-primary-500" /> Consultations de classe
              </p>
           </div>
        </div>
        {canPost && (
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="group relative overflow-hidden bg-gray-900 text-white px-10 py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] shadow-premium active:scale-95 transition-all italic"
          >
            <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
            <span className="relative z-10 flex items-center gap-3"><Plus size={20} /> Nouveau Sondage</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4 bg-white dark:bg-gray-900 p-4 rounded-[2.5rem] shadow-soft border border-gray-50 dark:border-gray-800">
        <div className="relative flex-1 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={20} />
          <input 
            type="text" placeholder="Rechercher une question..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-6 py-4 bg-transparent border-none rounded-2xl text-sm font-bold italic outline-none"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'active', 'closed'].map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f as any)}
              className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                statusFilter === f ? 'bg-gray-900 text-white shadow-lg' : 'bg-gray-50 dark:bg-gray-800 text-gray-400'
              }`}
            >
              {f === 'all' ? 'Tous' : f === 'active' ? 'Actifs' : 'Clos'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-10">
        {displayedPolls.map(poll => {
          const isVoted = poll.hasVoted;
          const showResults = isVoted || !poll.isActive || isAdmin || isDelegate;
          const canManagePoll = isAdmin || (isDelegate && poll.user_id === user?.id);
          const isPollNew = isNew(poll.createdAt);
          
          return (
            <div key={poll.id} className="group relative bg-white dark:bg-gray-900 rounded-[3.5rem] p-10 shadow-soft border border-gray-100 dark:border-gray-800 hover:shadow-premium transition-all duration-500">
               <div className="absolute top-0 left-0 w-2 h-full opacity-40 transition-all group-hover:w-3" style={{ backgroundColor: poll.isActive ? themeColor : '#94a3b8' }} />
               
               <div className="flex flex-col lg:flex-row justify-between items-start mb-10 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                       <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm ${poll.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                         {poll.isActive ? '🟢 En cours' : '⚪ Terminé'}
                       </span>
                       <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest italic">{poll.className}</span>
                       {isPollNew && (
                         <span className="px-3 py-1 bg-amber-100 text-amber-600 rounded-lg text-[8px] font-black uppercase animate-pulse">Nouveau</span>
                       )}
                    </div>
                    <h3 className="text-3xl font-black italic tracking-tighter text-gray-900 dark:text-white leading-tight">
                      {poll.question}
                    </h3>
                  </div>

                  <div className="flex gap-2 shrink-0">
                     {canManagePoll && (
                       <>
                         <button onClick={() => handleToggleStatus(poll)} className={`p-4 rounded-2xl transition-all ${poll.isActive ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-600'}`}>
                           {poll.isActive ? <Lock size={20}/> : <Unlock size={20}/>}
                         </button>
                         <button onClick={() => handleDelete(poll.id)} className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all">
                           <Trash2 size={20}/>
                         </button>
                       </>
                     )}
                     <button onClick={() => { if(navigator.share) navigator.share({title: poll.question, text: `Votez sur UniConnect : ${poll.question}`}); }} className="p-4 bg-gray-50 dark:bg-gray-800 text-gray-400 rounded-2xl">
                        <Share2 size={20} />
                     </button>
                  </div>
               </div>

               <div className="grid lg:grid-cols-2 gap-12 items-center">
                  <div className="space-y-4">
                     {poll.options.map(option => {
                        const isSelected = poll.userVoteOptionId === option.id;
                        const percentage = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
                        const isAnimating = votedOptionId === option.id;
                        
                        return (
                          <div key={option.id} className="relative">
                            <button 
                              disabled={!poll.isActive || votingId === poll.id}
                              onClick={() => handleVote(poll.id, option.id, poll.userVoteOptionId)} 
                              className={`w-full p-6 rounded-[2rem] border-2 transition-all text-left group relative flex items-center justify-between overflow-hidden ${
                                isSelected 
                                ? 'bg-primary-500 border-primary-500 text-white shadow-xl' 
                                : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-primary-200'
                              } ${!poll.isActive ? 'cursor-default' : 'active:scale-[0.98]'} ${isAnimating ? 'vote-pulse' : ''}`}
                            >
                               {/* Jauge de fond fluide */}
                               {showResults && (
                                 <div 
                                   className={`absolute left-0 top-0 bottom-0 opacity-10 progress-liquid ${isSelected ? 'bg-white' : 'bg-primary-500'}`}
                                   style={{ width: `${percentage}%` }}
                                 />
                               )}

                               <div className="flex items-center gap-4 relative z-10">
                                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isSelected ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
                                     {isSelected ? <Check size={18} /> : <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />}
                                  </div>
                                  <span className="font-black italic text-lg tracking-tight">{option.label}</span>
                               </div>

                               {showResults && (
                                 <div className="relative z-10 flex flex-col items-end animate-fade-in">
                                    <span className="text-xl font-black italic">{percentage}%</span>
                                    <span className="text-[8px] font-black uppercase opacity-60 tracking-widest">{option.votes} voix</span>
                                 </div>
                               )}
                            </button>
                          </div>
                        );
                     })}
                  </div>

                  {/* Diagramme de Résultats */}
                  <div className="h-64 bg-gray-50/50 dark:bg-gray-800/30 rounded-[3.5rem] p-8 border border-gray-100 dark:border-gray-800 flex flex-col items-center justify-center relative group/chart">
                     {showResults ? (
                       <>
                         <div className="absolute top-6 left-8 flex items-center gap-2 opacity-30">
                            <TrendingUp size={14} />
                            <span className="text-[8px] font-black uppercase tracking-widest">Temps réel</span>
                         </div>
                         <ResponsiveContainer width="100%" height="100%">
                           <BarChart data={poll.options} layout="vertical" margin={{ left: 10, right: 30, top: 20, bottom: 20 }}>
                             <XAxis type="number" hide />
                             <YAxis dataKey="label" type="category" hide />
                             <Tooltip 
                               cursor={{ fill: 'transparent' }} 
                               content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    return (
                                      <div className="bg-gray-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl">
                                        {payload[0].payload.label} : {payload[0].value} voix
                                      </div>
                                    );
                                  }
                                  return null;
                               }}
                             />
                             <Bar dataKey="votes" radius={[0, 15, 15, 0]} barSize={32}>
                               {poll.options.map((option, index) => (
                                 <Cell 
                                  key={`cell-${index}`} 
                                  fill={poll.userVoteOptionId === option.id ? themeColor : '#cbd5e1'} 
                                  className="transition-all duration-500"
                                 />
                               ))}
                             </Bar>
                           </BarChart>
                         </ResponsiveContainer>
                         <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none group-hover/chart:scale-110 transition-transform">
                            <Users size={32} className="text-gray-200 dark:text-gray-700 mb-2" />
                            <span className="text-2xl font-black text-gray-300 dark:text-gray-600 italic leading-none">{poll.totalVotes}</span>
                            <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest mt-1">Participations</span>
                         </div>
                       </>
                     ) : (
                       <div className="text-center space-y-4">
                          <Vote size={48} className="mx-auto text-gray-200 animate-bounce" />
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] italic">Voulez-vous donner votre avis ?<br/>Votez pour voir les résultats.</p>
                       </div>
                     )}
                  </div>
               </div>

               {poll.isActive && isVoted && (
                 <div className="mt-8 flex items-center justify-center gap-3 text-[10px] font-black text-primary-500 uppercase tracking-widest italic animate-pulse">
                   <Sparkles size={14} /> Vous pouvez changer votre choix en un clic avant la clôture.
                 </div>
               )}
            </div>
          );
        })}

        {displayedPolls.length === 0 && (
           <div className="py-32 text-center bg-white dark:bg-gray-900 rounded-[4rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
              <AlertCircle size={48} className="mx-auto text-gray-100 mb-6" />
              <p className="text-sm font-black text-gray-400 uppercase tracking-widest italic opacity-50">Aucun scrutin en cours</p>
           </div>
        )}
      </div>

      {/* Modal Creation */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Lancer une consultation">
        <form onSubmit={handleCreatePoll} className="space-y-8">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Question du scrutin</label>
            <textarea 
              required 
              value={newPoll.question} 
              onChange={e => setNewPoll({...newPoll, question: e.target.value})} 
              className="w-full p-8 bg-gray-50 dark:bg-gray-800 rounded-[2rem] font-bold italic text-lg outline-none border-none shadow-inner-soft" 
              rows={3} 
              placeholder="ex: Quel jour préférez-vous pour le rattrapage ?" 
            />
          </div>
          
          <div className="space-y-4">
             <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Options de réponse</label>
             {newPoll.options.map((opt, i) => (
               <div key={i} className="flex gap-3">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center font-black italic text-gray-400 shrink-0">
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
                    className="flex-1 px-6 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 font-bold italic text-sm outline-none border-none" 
                    placeholder={`Option ${i+1}`} 
                  />
                  {i > 1 && (
                    <button type="button" onClick={() => setNewPoll({...newPoll, options: newPoll.options.filter((_, idx) => idx !== i)})} className="p-3 text-red-400 hover:bg-red-50 rounded-xl transition-all"><X size={18}/></button>
                  )}
               </div>
             ))}
             {newPoll.options.length < 10 && (
               <button type="button" onClick={() => setNewPoll({...newPoll, options: [...newPoll.options, '']})} className="w-full py-4 border-2 border-dashed border-gray-100 dark:border-gray-800 text-gray-400 hover:text-primary-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all italic">+ Ajouter une alternative</button>
             )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Cible académique</label>
              <select 
                disabled={!isAdmin} 
                value={newPoll.className} 
                onChange={e => setNewPoll({...newPoll, className: e.target.value})} 
                className="p-4 w-full bg-gray-50 dark:bg-gray-800 rounded-xl font-black text-[11px] uppercase outline-none shadow-sm cursor-pointer"
              >
                <option value="Général">Toute l'école</option>
                {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1 tracking-widest">Clôture (optionnel)</label>
              <input 
                type="datetime-local"
                value={newPoll.endTime}
                onChange={e => setNewPoll({...newPoll, endTime: e.target.value})}
                className="p-4 w-full bg-gray-50 dark:bg-gray-800 rounded-xl font-bold text-xs outline-none shadow-sm"
              />
            </div>
          </div>

          <button type="submit" disabled={submitting} className="w-full bg-primary-600 text-white font-black py-5 rounded-[2rem] uppercase italic tracking-widest shadow-xl active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3">
             {submitting ? <Loader2 className="animate-spin" /> : <Send size={20} />}
             <span>Publier la consultation</span>
          </button>
        </form>
      </Modal>
    </div>
  );
}
