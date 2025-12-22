
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, X, Lock, Unlock, Loader2, Pencil, Timer, Clock, CheckCircle2, BarChart2, Check, TrendingUp, Users, Search, Vote, AlertTriangle, Sparkles, Filter, FilterX, Shield, Award, Calendar, RefreshCcw, ChevronDown, ChevronUp, Trophy, Radio, Power, Share2 } from 'lucide-react';
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

  const handleRelay = async (poll: Poll) => {
    const structuredContent = `🗳️ *UniConnect - Consultation Étudiante*\n\n❓ *Question:* ${poll.question}\n\n📌 *Classe:* ${poll.className || 'ESP Global'}\n📊 *Statut:* Vote Ouvert\n\n📢 Votre avis compte pour la prise de décision. Vient voter directement sur le portail UniConnect !\n\n_Diffusé par le bureau des délégués_`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Sondage: ${poll.question}`,
          text: structuredContent
        });
      } else {
        await navigator.clipboard.writeText(structuredContent);
        addNotification({ title: 'Contenu copié', message: 'Message de consultation prêt pour diffusion.', type: 'success' });
      }
      await API.interactions.incrementShare('polls', poll.id);
    } catch (e) {
      console.debug("Share poll ended", e);
    }
  };

  const toggleExpand = (pollId: string) => {
    setExpandedPollId(expandedPollId === pollId ? null : pollId);
  };

  const handleTogglePollStatus = async (poll: Poll) => {
    if (!canManage) return;
    try {
      await API.polls.update(poll.id, { isActive: !poll.isActive });
      addNotification({ 
        title: poll.isActive ? 'Scrutin clôturé' : 'Scrutin réouvert', 
        message: `Le sondage est désormais ${poll.isActive ? 'fermé' : 'ouvert'}.`, 
        type: 'success' 
      });
      fetchPolls(false);
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: 'Action échouée.', type: 'alert' });
    }
  };

  const handleDeletePoll = async (poll: Poll) => {
    if (!canManage || !window.confirm("Supprimer ce scrutin définitivement ?")) return;
    try {
      await API.polls.delete(poll.id);
      addNotification({ title: 'Supprimé', message: 'Le sondage a été retiré.', type: 'info' });
      fetchPolls(false);
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: 'Suppression impossible.', type: 'alert' });
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

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-full gap-4">
        <Loader2 className="animate-spin" style={{ color: themeColor }} size={40} />
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse italic">Synchronisation des scrutins...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-32 animate-fade-in">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-gray-100 dark:border-gray-800 pb-10">
        <div className="flex items-center gap-5">
           <div 
            className="w-16 h-16 text-white rounded-[2rem] flex items-center justify-center shadow-2xl rotate-3"
            style={{ backgroundColor: themeColor, boxShadow: `0 20px 40px -10px ${themeColor}66` }}
           >
              <BarChart2 size={32} />
           </div>
           <div>
              <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter italic leading-none uppercase">Consultations</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-3 flex items-center gap-2">
                 <Users size={12}/> {user?.className} • DÉCISIONNEL ESP
              </p>
           </div>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 items-center gap-3 max-w-3xl">
           <div className="relative flex-1 w-full group">
             <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={20} />
             <input type="text" placeholder="Rechercher un scrutin..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-16 pr-6 py-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-[2rem] text-sm outline-none focus:ring-4 transition-all font-bold italic" />
           </div>
           {canManage && (
             <button 
                onClick={() => setIsModalOpen(true)} 
                className="w-full sm:w-auto flex items-center justify-center gap-3 text-white px-10 py-5 rounded-2xl text-[11px] font-black shadow-xl active:scale-95 transition-all uppercase tracking-widest italic"
                style={{ backgroundColor: themeColor, boxShadow: `0 15px 25px -5px ${themeColor}55` }}
             >
               <Plus size={20} /> Nouveau Scrutin
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
                className={`bg-white dark:bg-gray-900 rounded-[3.5rem] p-10 md:p-14 shadow-soft border-2 transition-all duration-700 flex flex-col relative overflow-hidden group cursor-pointer ${
                  isExpanded ? 'shadow-premium scale-[1.01]' : 'border-transparent hover:border-gray-100 hover:shadow-xl'
                }`}
                style={isExpanded ? { borderColor: themeColor } : {}}
              >
                {/* Visual Accent */}
                <div className={`absolute top-0 left-0 w-3 h-full ${isActuallyActive ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>

                <div className="flex flex-wrap justify-between items-start mb-10 gap-6">
                   <div className="flex flex-wrap gap-3">
                      <div className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm ${isActuallyActive ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                        {isActuallyActive ? <><Radio className="animate-pulse" size={16} /> Scrutin Ouvert</> : <><Lock size={16} /> Vote Clôturé</>}
                      </div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-800 px-6 py-3 rounded-full border border-gray-100 dark:border-gray-800">
                        {poll.className || 'ESP DAKAR'}
                      </span>
                   </div>
                   
                   <div className="flex items-center gap-3 ml-auto">
                     <button 
                        onClick={(e) => { e.stopPropagation(); handleRelay(poll); }}
                        className="p-3.5 bg-gray-900 text-white rounded-2xl shadow-lg hover:scale-110 transition-all flex items-center gap-2"
                        title="Relayer Directement"
                     >
                        <Share2 size={18} /> <span className="text-[10px] font-black uppercase hidden sm:inline">Diffuser</span>
                     </button>
                     {canManage && (
                        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 p-2.5 rounded-[2rem] border border-gray-100 dark:border-gray-700">
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleTogglePollStatus(poll); }}
                                className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg ${poll.isActive ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}
                            >
                                {poll.isActive ? <><Power size={14} /> Clôturer</> : <><RefreshCcw size={14} /> Réouvrir</>}
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDeletePoll(poll); }}
                                className="p-3.5 rounded-2xl text-red-500 hover:bg-red-50 transition-all border border-transparent hover:border-red-100"
                                title="Supprimer définitivement"
                            >
                                <Trash2 size={20} />
                            </button>
                        </div>
                     )}
                     <button 
                        onClick={(e) => { e.stopPropagation(); toggleExpand(poll.id); }}
                        className={`p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-400 transition-all ${isExpanded ? 'rotate-180 bg-gray-200 dark:bg-gray-700' : ''}`}
                        style={isExpanded ? { color: themeColor } : {}}
                     >
                        <ChevronDown size={28} />
                     </button>
                   </div>
                </div>

                <div className="flex-1">
                  <h3 
                    className={`text-4xl font-black text-gray-900 dark:text-white leading-[1.05] tracking-tighter italic mb-12 transition-colors duration-500`}
                    style={isExpanded ? { color: themeColor } : {}}
                  >
                    {poll.question}
                  </h3>

                  <div className="space-y-5">
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
                            className={`relative w-full text-left rounded-[2.5rem] overflow-hidden transition-all h-28 flex items-center px-12 border-2 ${
                                isSelected 
                                ? 'bg-gray-50/20 shadow-xl' 
                                : 'border-gray-50 dark:border-gray-800 bg-white dark:bg-gray-900'
                            } ${!canVote ? 'cursor-default' : 'hover:translate-x-2 active:scale-95'}`}
                            style={isSelected ? { borderColor: themeColor } : {}}
                          >
                             {/* Progress Bar with Gradient */}
                             <div 
                                className={`absolute left-0 top-0 bottom-0 transition-all duration-1000 ease-out opacity-20`} 
                                style={{ 
                                    width: `${percentage}%`,
                                    backgroundColor: isSelected ? themeColor : '#94a3b8'
                                }} 
                             />
                             
                             <div className="flex-1 flex items-center justify-between z-10 relative">
                                  <div className="flex items-center gap-8 min-w-0">
                                    <div 
                                        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'text-white scale-125' : 'border-gray-200'}`}
                                        style={isSelected ? { backgroundColor: themeColor, borderColor: themeColor } : {}}
                                    >
                                       {isSelected ? <Check size={20} strokeWidth={4} /> : null}
                                    </div>
                                    <div className="min-w-0">
                                      <p 
                                        className={`text-xl font-black italic truncate ${isSelected ? '' : 'text-gray-800 dark:text-gray-200'}`}
                                        style={isSelected ? { color: themeColor } : {}}
                                      >
                                        {option.label}
                                      </p>
                                      {isLeader && isExpanded && (
                                        <span className="text-[10px] font-black text-amber-500 uppercase flex items-center gap-1 mt-1">
                                          <Trophy size={12} /> Choix Majoritaire
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex flex-col items-end shrink-0 ml-4">
                                    <span 
                                        className={`text-4xl font-black italic tracking-tighter ${isSelected ? '' : 'text-gray-900 dark:text-white'}`}
                                        style={isSelected ? { color: themeColor } : {}}
                                    >
                                      {percentage}%
                                    </span>
                                    <div className="flex items-center gap-2">
                                       <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{option.votes} voix</span>
                                    </div>
                                  </div>
                             </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-14 pt-14 border-t-2 border-dashed border-gray-100 dark:border-gray-800 space-y-12 animate-in slide-in-from-top-6 duration-700">
                    <div className="grid md:grid-cols-2 gap-12">
                      <div className="bg-gray-50 dark:bg-gray-800/40 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-700">
                        <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                          <TrendingUp size={16} style={{ color: themeColor }} /> Analytique en temps réel
                        </h4>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={poll.options} layout="vertical">
                              <XAxis type="number" hide />
                              <YAxis dataKey="label" type="category" hide />
                              <Tooltip 
                                cursor={{fill: 'transparent'}}
                                contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 15px 35px rgba(0,0,0,0.1)', fontWeight: '900', fontSize: '11px' }}
                              />
                              <Bar dataKey="votes" radius={[0, 15, 15, 0]} barSize={30}>
                                {poll.options.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.id === poll.userVoteOptionId ? themeColor : '#e2e8f0'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="flex flex-col justify-center space-y-8">
                        <div 
                            className="p-10 text-white rounded-[3rem] shadow-premium relative overflow-hidden"
                            style={{ backgroundColor: themeColor, boxShadow: `0 25px 35px -10px ${themeColor}44` }}
                        >
                           <Users className="absolute -bottom-8 -right-8 w-40 h-40 opacity-10" />
                           <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-60">Quorum ESP atteint</p>
                           <h4 className="text-6xl font-black italic tracking-tighter mt-3">{poll.totalVotes}</h4>
                           <p className="text-[12px] font-bold mt-5 uppercase tracking-widest">Voix uniques certifiées</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
        })}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Engager une consultation">
        <form onSubmit={handleCreatePoll} className="space-y-8">
          <div>
            <textarea required rows={4} value={newPoll.question} onChange={e => setNewPoll({...newPoll, question: e.target.value})} className="w-full px-8 py-6 rounded-[2rem] border-none bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-black italic outline-none focus:ring-4 transition-all text-xl" placeholder="Objet de la décision..." />
          </div>
          <button type="submit" disabled={submitting} className="w-full text-white font-black py-6 rounded-[2.5rem] shadow-2xl transition-all flex justify-center items-center gap-4 uppercase tracking-widest italic active:scale-95" style={{ backgroundColor: themeColor }}>
            {submitting ? <Loader2 className="animate-spin" /> : <Vote size={28} />}
            {submitting ? 'Lancement...' : 'Ouvrir les votes'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
