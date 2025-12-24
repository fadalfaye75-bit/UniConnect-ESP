
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, X, Lock, Unlock, Loader2, Pencil, Timer, Clock, CheckCircle2, BarChart2, Check, TrendingUp, Users, Search, Vote, AlertTriangle, Sparkles, Filter, FilterX, Shield, Award, Calendar, RefreshCcw, ChevronDown, ChevronUp, Trophy, Radio, Power, Share2, Send, BarChart as BarChartIcon, PieChart as PieChartIcon, Maximize2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, Poll, ClassGroup } from '../types';
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
  PieChart,
  Pie,
  Legend
} from 'recharts';

export default function Polls() {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const themeColor = user?.themeColor || '#8b5cf6';
  
  const [polls, setPolls] = useState<Poll[]>([]);
  const [classes, setClasses] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingPoll, setViewingPoll] = useState<Poll | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [votingIds, setVotingIds] = useState<Set<string>>(new Set());
  
  const [votedOptionId, setVotedOptionId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');

  const [newPoll, setNewPoll] = useState({
    question: '',
    className: '',
    options: ['', ''],
  });

  const isAdmin = user?.role === UserRole.ADMIN;
  const canPost = API.auth.canPost(user);

  const fetchPolls = useCallback(async (showLoader = false) => {
    try {
      if(showLoader) setLoading(true); 
      const data = await API.polls.list();
      setPolls(data);
      
      if (viewingPoll) {
        const updated = data.find(p => p.id === viewingPoll.id);
        if (updated) setViewingPoll(updated);
      }
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: 'Chargement échoué.', type: 'alert' });
    } finally {
      if(showLoader) setLoading(false);
    }
  }, [addNotification, viewingPoll]);

  useEffect(() => {
    fetchPolls(true);
    API.classes.list().then(setClasses);
    const subscription = API.polls.subscribe(() => fetchPolls(false));
    return () => { subscription.unsubscribe(); };
  }, [fetchPolls]);

  const handleVote = async (pollId: string, optionId: string, currentVoteId?: string) => {
    if (currentVoteId === optionId) return;
    if (!user || votingIds.has(pollId)) return;
    
    setVotedOptionId(optionId);
    setVotingIds(prev => new Set(prev).add(pollId));

    try {
      await API.polls.vote(pollId, optionId);
      await fetchPolls(false);
      addNotification({ 
        title: currentVoteId ? 'Vote mis à jour' : 'Vote confirmé', 
        message: 'Votre participation a été enregistrée avec succès.', 
        type: 'success' 
      });
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: error.message || 'Échec du vote.', type: 'alert' });
    } finally {
      setVotingIds(prev => {
        const next = new Set(prev);
        next.delete(pollId);
        return next;
      });
      setTimeout(() => setVotedOptionId(null), 600);
    }
  };

  const handleToggleStatus = async (poll: Poll) => {
    try {
      await API.polls.update(poll.id, { isActive: !poll.isActive });
      fetchPolls(false);
      addNotification({ title: 'Statut mis à jour', message: poll.isActive ? 'Scrutin clos.' : 'Scrutin réouvert.', type: 'info' });
    } catch (e) {
      addNotification({ title: 'Erreur', message: 'Impossible de changer le statut.', type: 'alert' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Supprimer ce sondage et tous les votes associés ?")) return;
    try {
      await API.polls.delete(id);
      fetchPolls(false);
      addNotification({ title: 'Supprimé', message: 'Consultation retirée.', type: 'info' });
    } catch (e) {
      addNotification({ title: 'Erreur', message: 'Suppression impossible.', type: 'alert' });
    }
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const targetClass = isAdmin ? newPoll.className : (user?.className || 'Général');
      await API.polls.create({
        question: newPoll.question,
        className: targetClass,
        options: newPoll.options.filter(o => o.trim() !== '').map(label => ({ label }))
      });
      setIsModalOpen(false);
      await fetchPolls(false);
      setNewPoll({ question: '', className: '', options: ['', ''] });
      addNotification({ title: 'Succès', message: 'Sondage en ligne.', type: 'success' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Publication échouée.', type: 'alert' });
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
        <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-premium border border-gray-100 dark:border-gray-800">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">{payload[0].payload.label || payload[0].payload.name}</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: themeColor }} />
            <p className="text-sm font-black italic text-gray-900 dark:text-white">{payload[0].value} voix</p>
          </div>
        </div>
      );
    }
    return null;
  };

  const PIE_COLORS = ['#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#ec4899'];

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-full gap-8">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-gray-100 dark:border-gray-800 rounded-full"></div>
          <div className="absolute top-0 left-0 w-20 h-20 border-4 border-t-primary-500 rounded-full animate-spin"></div>
        </div>
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.5em] animate-pulse">Consultation des urnes...</span>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-32 animate-fade-in">
      {/* Header Premium */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-10 border-b border-gray-100 dark:border-gray-800 pb-12">
        <div className="flex items-center gap-8">
           <div className="w-24 h-24 text-white rounded-[2.8rem] flex items-center justify-center shadow-premium rotate-3 relative overflow-hidden group" style={{ backgroundColor: themeColor }}>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-700"></div>
              <BarChartIcon size={44} className="relative z-10" />
           </div>
           <div>
              <h2 className="text-6xl font-black text-gray-900 dark:text-white tracking-tighter italic uppercase leading-none">Scrutins</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.5em] mt-4 flex items-center gap-2">
                <Shield size={12} className="text-primary-500" /> Prises de décision ESP
              </p>
           </div>
        </div>
        {canPost && (
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="group relative w-full sm:w-auto overflow-hidden bg-gray-900 text-white px-14 py-6 rounded-[2.2rem] text-[11px] font-black uppercase tracking-[0.2em] shadow-premium active:scale-95 transition-all italic"
          >
            <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
            <span className="relative z-10 flex items-center justify-center gap-4">
               <Plus size={22} /> Nouveau Scrutin
            </span>
          </button>
        )}
      </div>

      {/* Barre de Filtres */}
      <div className="flex flex-col lg:flex-row gap-6 bg-white dark:bg-gray-900 p-8 rounded-[3.5rem] shadow-soft border border-gray-50 dark:border-gray-800">
        <div className="relative flex-1 group">
          <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={24} />
          <input 
            type="text" placeholder="Rechercher une consultation..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-20 pr-8 py-5 bg-gray-50 dark:bg-gray-800/50 border-none rounded-[1.8rem] text-sm font-bold outline-none italic focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/10 transition-all"
          />
        </div>
        <div className="flex gap-3">
          {['all', 'active', 'closed'].map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter as any)}
              className={`px-8 py-5 rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                statusFilter === filter 
                ? 'bg-gray-900 text-white shadow-xl italic' 
                : 'bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {filter === 'all' ? 'Tous' : filter === 'active' ? 'En cours' : 'Clos'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid des Sondages */}
      <div className="grid gap-16">
        {displayedPolls.map(poll => {
          const canEdit = API.auth.canEdit(user, poll);
          const canDelete = API.auth.canDelete(user);
          
          return (
            <div key={poll.id} className="group relative bg-white dark:bg-gray-900 rounded-[4.5rem] p-12 lg:p-16 shadow-soft border border-gray-100 dark:border-gray-800 hover:shadow-premium transition-all duration-700 overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-2 rounded-b-full opacity-40" style={{ backgroundColor: poll.isActive ? themeColor : '#94a3b8' }} />
              
              <div className="flex flex-col md:flex-row justify-between items-center mb-16 gap-8">
                 <div className="flex items-center gap-5">
                    <span className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-sm ${poll.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                      {poll.isActive ? '🟢 Urne Ouverte' : '⚪ Scrutin Clos'}
                    </span>
                    <span className="text-xs font-black text-primary-500 uppercase tracking-[0.3em] italic">{poll.className}</span>
                 </div>
                 <div className="flex gap-2">
                    <button 
                      onClick={() => setViewingPoll(poll)}
                      className="flex items-center gap-4 px-8 py-3 bg-gray-50 dark:bg-gray-800 rounded-3xl text-[12px] font-black text-gray-900 dark:text-white italic tracking-tight shadow-inner-soft hover:bg-gray-100 transition-all group/btn"
                    >
                        <BarChartIcon size={18} className="text-gray-400 group-hover/btn:text-primary-500 transition-colors" /> Stats
                    </button>
                    {canEdit && (
                      <button onClick={() => handleToggleStatus(poll)} className={`p-3 rounded-2xl transition-all ${poll.isActive ? 'bg-amber-50 text-amber-500' : 'bg-green-50 text-green-500'}`}>
                        {poll.isActive ? <Lock size={20}/> : <Unlock size={20}/>}
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => handleDelete(poll.id)} className="p-3 bg-red-50 text-red-500 rounded-2xl">
                        <Trash2 size={20}/>
                      </button>
                    )}
                 </div>
              </div>

              <h3 className="text-4xl md:text-5xl font-black italic tracking-tighter mb-16 text-gray-900 dark:text-white leading-[1.1] text-center max-w-4xl mx-auto cursor-pointer" onClick={() => setViewingPoll(poll)}>
                {poll.question}
              </h3>

              <div className="h-4 w-full bg-gray-100 dark:bg-gray-800 rounded-full mb-16 overflow-hidden flex">
                {poll.options.map((opt, idx) => (
                  <div 
                    key={opt.id}
                    className="h-full transition-all duration-1000 ease-out"
                    style={{ 
                      width: `${poll.totalVotes > 0 ? (opt.votes / poll.totalVotes) * 100 : 0}%`,
                      backgroundColor: PIE_COLORS[idx % PIE_COLORS.length],
                      opacity: poll.userVoteOptionId === opt.id ? 1 : 0.6
                    }}
                  />
                ))}
              </div>
              
              <div className="grid gap-6 max-w-4xl mx-auto">
                {poll.options.map(option => {
                  const percentage = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
                  const isProcessing = votingIds.has(poll.id);
                  const isSelected = poll.userVoteOptionId === option.id;
                  const isAnimating = votedOptionId === option.id;

                  return (
                    <button 
                      key={option.id} 
                      disabled={!poll.isActive || isProcessing}
                      onClick={() => handleVote(poll.id, option.id, poll.userVoteOptionId)} 
                      className={`relative w-full min-h-[6.5rem] rounded-[3rem] overflow-hidden px-10 border-2 transition-all duration-500 flex items-center justify-between group/opt ${
                        isSelected 
                        ? 'bg-white dark:bg-gray-900 border-primary-500 ring-8 ring-primary-50 dark:ring-primary-900/10' 
                        : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-primary-200 shadow-sm'
                      } ${isAnimating ? 'vote-pulse' : ''} ${!poll.isActive ? 'opacity-70 cursor-default' : 'hover:-translate-y-1 active:scale-[0.98]'}`}
                    >
                        <div 
                          className="progress-liquid absolute left-0 top-0 bottom-0 z-0" 
                          style={{ 
                            width: `${percentage}%`, 
                            background: isSelected 
                              ? `linear-gradient(90deg, ${themeColor}15 0%, ${themeColor}25 100%)` 
                              : 'rgba(0,0,0,0.02)' 
                          }} 
                        />
                        
                        <div className="flex items-center gap-8 z-10">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-700 border-2 ${
                              isSelected 
                              ? 'bg-primary-500 border-primary-500 text-white shadow-xl rotate-12' 
                              : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
                            }`}>
                                {isSelected ? (
                                  <Check size={22} strokeWidth={4} className="animate-pop-in" />
                                ) : (
                                  <div className="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700 group-hover/opt:scale-150 transition-transform" />
                                )}
                            </div>
                            <p className={`text-xl font-black italic transition-colors ${isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                                {option.label}
                            </p>
                        </div>

                        <div className="text-right z-10">
                            <div className="flex items-baseline gap-2 justify-end">
                               <span className="text-4xl font-black italic text-gray-900 dark:text-white transition-all">{percentage}</span>
                               <span className="text-[12px] font-black text-gray-400 uppercase tracking-widest">%</span>
                            </div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-2 opacity-60">
                               {option.votes} voix
                            </p>
                        </div>
                    </button>
                  );
                })}
              </div>

              {poll.hasVoted && poll.isActive && (
                <div className="mt-16 flex items-center justify-center gap-4 text-[11px] font-black text-primary-500 uppercase tracking-[0.3em] animate-pulse italic">
                   <Sparkles size={18} /> Vos statistiques sont mises à jour en temps réel
                </div>
              )}
            </div>
        )})}
      </div>

      {/* Modals existants (Analyse/Création) */}
      <Modal isOpen={!!viewingPoll} onClose={() => setViewingPoll(null)} title="Analyse de la consultation">
        {viewingPoll && (
          <div className="space-y-12 pb-6">
            <div className="text-center space-y-4">
              <span className="text-[10px] font-black text-primary-500 uppercase tracking-[0.4em] italic">{viewingPoll.className}</span>
              <h3 className="text-3xl font-black italic tracking-tighter text-gray-900 dark:text-white leading-tight">{viewingPoll.question}</h3>
              <div className="flex items-center justify-center gap-6 pt-2">
                <div className="flex items-center gap-2 text-gray-400 font-bold italic text-sm">
                  <Users size={16} /> {viewingPoll.totalVotes} votants
                </div>
                <div className="flex items-center gap-2 text-gray-400 font-bold italic text-sm">
                  <Clock size={16} /> Créé le {new Date(viewingPoll.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="h-64 bg-gray-50 dark:bg-gray-800/50 rounded-[2.5rem] p-6 border border-gray-100 dark:border-gray-700">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4 text-center">Répartition des voix</p>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={viewingPoll.options as any[]}
                      dataKey="votes"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                    >
                      {viewingPoll.options.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="h-64 bg-gray-50 dark:bg-gray-800/50 rounded-[2.5rem] p-6 border border-gray-100 dark:border-gray-700">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4 text-center">Volume par option</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={viewingPoll.options as any[]} layout="vertical" margin={{ left: -20, right: 20 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="label" type="category" tick={{ fontSize: 9, fontWeight: 900, fill: '#9ca3af' }} width={80} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="votes" radius={[0, 10, 10, 0]} barSize={20}>
                      {viewingPoll.options.map((option, index) => (
                        <Cell key={`cell-${index}`} fill={viewingPoll.userVoteOptionId === option.id ? themeColor : PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <button 
              onClick={() => setViewingPoll(null)}
              className="w-full py-5 bg-gray-900 text-white rounded-[2rem] font-black uppercase italic tracking-widest text-[11px] transition-all active:scale-95"
            >
              Fermer l'analyse
            </button>
          </div>
        )}
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Lancer une consultation officielle">
        <form onSubmit={handleCreatePoll} className="space-y-10">
          <div>
            <label className="block text-[11px] font-black text-gray-400 uppercase mb-4 ml-2 tracking-[0.3em]">Problématique / Question</label>
            <textarea required value={newPoll.question} onChange={e => setNewPoll({...newPoll, question: e.target.value})} className="w-full p-10 bg-gray-50 dark:bg-gray-800 rounded-[3rem] font-bold italic text-xl outline-none border-none shadow-inner-soft placeholder:opacity-30" rows={3} placeholder="Quelle est la question ?" />
          </div>
          
          <div className="space-y-5">
             <label className="block text-[11px] font-black text-gray-400 uppercase mb-2 ml-2 tracking-[0.3em]">Choix proposés</label>
             {newPoll.options.map((opt, i) => (
               <div key={i} className="group flex gap-4">
                  <div className="w-14 h-16 bg-gray-100 dark:bg-gray-800 rounded-[1.5rem] flex items-center justify-center font-black italic text-gray-400 group-focus-within:bg-primary-500 group-focus-within:text-white transition-all shadow-sm">
                    {i+1}
                  </div>
                  <input type="text" required value={opt} onChange={e => {
                      const next = [...newPoll.options];
                      next[i] = e.target.value;
                      setNewPoll({...newPoll, options: next});
                    }} className="flex-1 px-8 py-4 rounded-[1.5rem] bg-gray-50 dark:bg-gray-800 font-bold italic text-base outline-none border-none focus:ring-4 focus:ring-primary-50 transition-all" placeholder={`Libellé ${i+1}`} />
               </div>
             ))}
             <button type="button" onClick={() => setNewPoll({...newPoll, options: [...newPoll.options, '']})} className="w-full py-5 border-2 border-dashed border-gray-100 dark:border-gray-800 text-gray-400 hover:text-primary-500 hover:border-primary-200 rounded-[1.8rem] text-[11px] font-black uppercase tracking-[0.3em] transition-all italic">+ Ajouter une alternative</button>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <label className="block text-[11px] font-black text-gray-400 uppercase mb-2 ml-2 tracking-[0.3em]">Cible académique</label>
            <select disabled={!isAdmin} value={newPoll.className} onChange={e => setNewPoll({...newPoll, className: e.target.value})} className="p-6 w-full bg-gray-50 dark:bg-gray-800 rounded-[1.8rem] font-black text-[12px] uppercase tracking-widest outline-none shadow-sm cursor-pointer">
              <option value="Général">Toute l'École Polytechnique</option>
              {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          <button type="submit" disabled={submitting} className="w-full bg-primary-600 hover:bg-primary-700 text-white font-black py-7 rounded-[2.8rem] uppercase italic tracking-[0.3em] shadow-premium active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-4 text-xs">
             {submitting ? <Loader2 className="animate-spin" /> : <Send size={22} />}
             <span>Déclencher le scrutin officiel</span>
          </button>
        </form>
      </Modal>
    </div>
  );
}
