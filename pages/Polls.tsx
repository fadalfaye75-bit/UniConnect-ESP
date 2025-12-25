
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, Lock, Unlock, Loader2, BarChart2, Check, Users, Search, Sparkles, Shield, Send, Share2, AlertCircle, Vote as VoteIcon, X, TrendingUp, Trophy, Crown, ArrowRight, MessageCircle, Mail, BarChart3, CheckCircle2, Activity } from 'lucide-react';
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
  Cell
} from 'recharts';

export default function Polls() {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const themeColor = user?.themeColor || '#0ea5e9';
  
  const [polls, setPolls] = useState<Poll[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [votingPollId, setVotingPollId] = useState<string | null>(null);
  const [justVotedOptionId, setJustVotedOptionId] = useState<string | null>(null);
  
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
      addNotification({ title: 'Erreur Sync', message: 'Urnes inaccessibles.', type: 'alert' });
    } finally {
      if(showLoader) setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    fetchPolls(true);
    API.classes.list().then(setClasses).catch(() => {});
    const subscription = API.polls.subscribe(() => fetchPolls(false));
    return () => { subscription.unsubscribe(); };
  }, [fetchPolls]);

  const handleShareWhatsApp = (poll: Poll) => {
    try {
      const className = poll.className || 'Filière';
      const maxVotes = Math.max(...poll.options.map(o => o.votes));
      const leader = poll.options.find(o => o.votes === maxVotes);
      
      let optionsText = poll.options
        .map(o => {
          const p = poll.totalVotes > 0 ? Math.round((o.votes / poll.totalVotes) * 100) : 0;
          return `🔹 ${o.label} : ${p}%`;
        })
        .join('\n');

      const text = `🔵 *JangHup – ${className}*\n\n*📊 CONSULTATION : ${poll.question.toUpperCase()}*\n\n${optionsText}\n\n👥 *Total de participations :* ${poll.totalVotes}\n🏆 *Tendance actuelle :* ${leader?.label || 'En attente'}\n\n🗳️ *Voter sur JangHup :*\nhttps://janghup.app/#/polls\n\n—\nPlateforme JangHup\nCommunication académique officielle`;
      
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      API.interactions.incrementShare('polls', poll.id).catch(() => {});
    } catch (e) {
      console.error("WhatsApp share failed", e);
    }
  };

  const handleVote = async (pollId: string, optionId: string, currentVoteId?: string) => {
    if (currentVoteId === optionId) return;
    if (!user || votingPollId) return;
    setVotingPollId(pollId);
    setJustVotedOptionId(optionId);
    try {
      await API.polls.vote(pollId, optionId);
      addNotification({ 
        title: currentVoteId ? 'Vote mis à jour' : 'Merci !', 
        message: currentVoteId ? 'Votre choix a été modifié.' : 'Votre participation est enregistrée.', 
        type: 'success' 
      });
      await fetchPolls(false);
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: "Impossible de voter.", type: 'alert' });
    } finally {
      setVotingPollId(null);
      setTimeout(() => setJustVotedOptionId(null), 800);
    }
  };

  const handleToggleStatus = async (poll: Poll) => {
    try {
      await API.polls.update(poll.id, { isActive: !poll.isActive });
      addNotification({ title: 'Statut mis à jour', message: poll.isActive ? 'Scrutin clos.' : 'Scrutin ouvert.', type: 'info' });
      fetchPolls(false);
    } catch (e) {
      addNotification({ title: 'Erreur', message: 'Action impossible.', type: 'alert' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Supprimer définitivement ce scrutin ?")) return;
    try {
      await API.polls.delete(id);
      addNotification({ title: 'Supprimé', message: 'Sondage retiré.', type: 'info' });
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
      addNotification({ title: 'Attention', message: 'Minimum 2 options requises.', type: 'warning' });
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
      addNotification({ title: 'Succès', message: 'Le scrutin est lancé.', type: 'success' });
      await fetchPolls(false);
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Échec création.', type: 'alert' });
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
        <div className="bg-gray-900 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl border border-gray-700">
          <p className="mb-1">{payload[0].payload.label}</p>
          <p className="text-primary-400">{payload[0].value} voix</p>
        </div>
      );
    }
    return null;
  };

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-[60vh] gap-6">
        <Loader2 className="animate-spin text-primary-500" size={48} />
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] animate-pulse italic">Récupération des scrutins...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-32 animate-fade-in px-4">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 border-b border-gray-100 dark:border-gray-800 pb-12">
        <div className="flex items-center gap-6">
           <div className="w-16 h-16 sm:w-20 sm:h-20 text-white rounded-[2rem] flex items-center justify-center shadow-premium shrink-0" style={{ backgroundColor: themeColor }}>
              <BarChart3 size={36} />
           </div>
           <div>
              <h2 className="text-3xl sm:text-5xl font-black text-gray-900 dark:text-white tracking-tighter italic uppercase leading-none">Consultations</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] mt-4 flex items-center gap-2">
                <Shield size={12} className="text-primary-500" /> Scrutins & Démocratie JangHup
              </p>
           </div>
        </div>
        {canPost && (
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="bg-gray-900 text-white px-10 py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] shadow-premium active:scale-95 transition-all italic flex items-center justify-center gap-3 hover:bg-black w-full sm:w-auto"
          >
            <Plus size={20} /> Lancer un scrutin
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col lg:flex-row gap-4 bg-white/80 dark:bg-gray-900/80 p-4 rounded-[3rem] shadow-soft border border-gray-100 dark:border-gray-800 sticky top-4 z-30 backdrop-blur-lg">
        <div className="relative flex-1 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={20} />
          <input 
            type="text" placeholder="Trouver une consultation..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-6 py-4 bg-transparent border-none rounded-2xl text-sm font-bold italic outline-none"
          />
        </div>
        <div className="flex gap-2 p-1 bg-gray-50 dark:bg-gray-800 rounded-[1.8rem]">
          {['all', 'active', 'closed'].map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f as any)}
              className={`px-8 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
                statusFilter === f ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {f === 'all' ? 'Tous' : f === 'active' ? 'Actifs' : 'Clos'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Polls */}
      <div className="grid gap-16">
        {displayedPolls.map((poll) => {
          const isVoted = poll.hasVoted;
          const showResults = isVoted || !poll.isActive || isAdmin || isDelegate;
          const maxVotes = Math.max(...poll.options.map(o => o.votes));
          const hasVotes = poll.totalVotes > 0;
          const isVotingThisPoll = votingPollId === poll.id;

          return (
            <div key={poll.id} className={`group bg-white dark:bg-gray-900 rounded-[4rem] p-10 md:p-14 shadow-soft border-2 transition-all duration-500 flex flex-col relative ${poll.isActive ? 'border-transparent hover:border-primary-100' : 'border-gray-50 opacity-90'}`}>
               {/* Indicateur de chargement discret sur le côté */}
               {isVotingThisPoll && (
                 <div className="absolute top-10 right-10 flex items-center gap-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur p-2 rounded-full shadow-lg z-30 animate-in fade-in zoom-in">
                    <Loader2 className="animate-spin text-primary-500" size={16} />
                 </div>
               )}

               <div className="flex flex-col lg:flex-row justify-between items-start mb-12 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                       <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${poll.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                         <span className={`w-2 h-2 rounded-full ${poll.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></span>
                         {poll.isActive ? 'Actif' : 'Clôturé'}
                       </span>
                       <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest italic bg-primary-50 px-4 py-1.5 rounded-full">{poll.className}</span>
                    </div>
                    <h3 className="text-3xl sm:text-4xl font-black italic tracking-tighter text-gray-900 dark:text-white leading-tight max-w-4xl">
                      {poll.question}
                    </h3>
                  </div>

                  <div className="flex gap-2">
                     { (isAdmin || (isDelegate && poll.user_id === user?.id)) && (
                       <>
                         <button onClick={() => handleToggleStatus(poll)} className="p-4 bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-primary-500 rounded-2xl transition-all shadow-sm">
                           {poll.isActive ? <Lock size={20}/> : <Unlock size={20}/>}
                         </button>
                         <button onClick={() => handleDelete(poll.id)} className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-sm">
                           <Trash2 size={20}/>
                         </button>
                       </>
                     )}
                     <button onClick={() => handleShareWhatsApp(poll)} className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm active:scale-95" title="Partager WhatsApp">
                        <Share2 size={20} />
                     </button>
                  </div>
               </div>

               <div className="grid lg:grid-cols-5 gap-16 items-stretch flex-1">
                  <div className="lg:col-span-3 space-y-5">
                     {poll.options.map(option => {
                        const isSelected = poll.userVoteOptionId === option.id;
                        const isLeader = maxVotes > 0 && option.votes === maxVotes;
                        const percentage = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
                        const isJustVoted = justVotedOptionId === option.id;
                        
                        return (
                          <div key={option.id} className="relative min-h-[100px]">
                            <button 
                              disabled={!poll.isActive || isVotingThisPoll}
                              onClick={() => handleVote(poll.id, option.id, poll.userVoteOptionId)} 
                              className={`w-full p-8 rounded-[2.5rem] border-2 transition-all text-left relative flex items-center justify-between overflow-hidden shadow-sm ${
                                isSelected 
                                ? 'bg-gray-900 border-gray-900 text-white scale-[1.02] shadow-xl z-10' 
                                : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-primary-400'
                              } ${!poll.isActive ? 'cursor-default' : 'active:scale-[0.98]'} ${isJustVoted ? 'vote-vibrate' : ''}`}
                            >
                               {/* Barre de progression raffinée avec transition lisse */}
                               {showResults && (
                                 <div 
                                   className={`absolute left-0 top-0 bottom-0 opacity-10 transition-all duration-1000 cubic-bezier(0.4, 0, 0.2, 1) ${isSelected ? 'bg-white' : 'bg-primary-500'}`}
                                   style={{ width: `${percentage}%` }}
                                 />
                               )}

                               <div className="flex items-center gap-5 relative z-10 min-w-0">
                                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shrink-0 ${isSelected ? 'bg-white text-gray-900 shadow-lg scale-110' : 'bg-gray-50 dark:bg-gray-800'}`}>
                                     {isSelected ? <CheckCircle2 size={24} className="animate-in zoom-in duration-300" /> : <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />}
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-3">
                                       <span className="font-black italic text-xl tracking-tight leading-none truncate">{option.label}</span>
                                       {isLeader && showResults && (
                                         <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg shrink-0" title="Tendance">
                                           <TrendingUp size={14} />
                                         </div>
                                       )}
                                    </div>
                                    {isSelected && <span className="text-[9px] font-black uppercase tracking-widest mt-2 opacity-60 flex items-center gap-2"><Sparkles size={10} /> Votre choix actuel</span>}
                                  </div>
                               </div>

                               {showResults && (
                                 <div className="relative z-10 flex flex-col items-end animate-fade-in shrink-0 ml-4">
                                    <span className="text-2xl font-black italic leading-none">{percentage}%</span>
                                    <span className="text-[9px] font-bold uppercase opacity-40 tracking-widest mt-1">{option.votes} voix</span>
                                 </div>
                               )}
                            </button>
                          </div>
                        );
                     })}
                  </div>

                  <div className="lg:col-span-2 h-full flex flex-col min-h-[400px]">
                     <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-[3.5rem] p-10 border border-gray-100 dark:border-gray-700 flex flex-col h-full">
                        {showResults ? (
                          <div className="h-full flex flex-col">
                            <div className="flex items-center justify-between mb-8">
                               <div className="flex items-center gap-3">
                                  <div className="p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm text-primary-500">
                                     <Users size={18} />
                                  </div>
                                  <div>
                                     <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Urne Digitale</p>
                                     <p className="text-xl font-black italic text-gray-900 dark:text-white leading-none">{poll.totalVotes} participations</p>
                                  </div>
                               </div>
                            </div>

                            <div className="flex-1 min-h-[220px]">
                               <ResponsiveContainer width="100%" height="100%">
                                 <BarChart data={poll.options} layout="vertical" margin={{ left: -30, right: 30 }}>
                                   <XAxis type="number" hide />
                                   <YAxis dataKey="label" type="category" hide />
                                   <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                                   <Bar dataKey="votes" radius={[0, 15, 15, 0]} barSize={35} animationDuration={1500}>
                                     {poll.options.map((option, index) => (
                                       <Cell 
                                        key={`cell-${index}`} 
                                        fill={poll.userVoteOptionId === option.id ? themeColor : (option.votes === maxVotes && hasVotes ? '#f59e0b' : '#cbd5e1')} 
                                        className="transition-all duration-1000"
                                       />
                                     ))}
                                   </Bar>
                                 </BarChart>
                               </ResponsiveContainer>
                            </div>
                            
                            <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center text-gray-400">
                               <p className="text-[9px] font-black uppercase tracking-widest italic flex items-center gap-2">
                                  <Activity size={12} className="text-primary-500" /> Analyse live
                               </p>
                               <span className="text-[9px] font-bold">{poll.isActive ? 'MAJ en continu' : 'Scrutin clos'}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-8 animate-fade-in">
                             <div className="w-32 h-32 bg-white dark:bg-gray-800 rounded-[3rem] shadow-premium flex items-center justify-center text-primary-500 border-4 border-gray-50/50">
                                <VoteIcon size={60} className="animate-pulse" />
                             </div>
                             <div className="space-y-4">
                                <h4 className="text-xl font-black italic text-gray-900 dark:text-white uppercase tracking-tight leading-tight">Résultats confidentiels</h4>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] leading-relaxed px-4 italic">Exprimez votre choix pour débloquer les tendances de la section.</p>
                             </div>
                             <div className="h-2 w-full max-w-[150px] bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-primary-500 animate-[loading-shimmer_2s_infinite]" style={{ width: '30%' }} />
                             </div>
                          </div>
                        )}
                     </div>
                  </div>
               </div>
            </div>
          );
        })}

        {displayedPolls.length === 0 && (
           <div className="py-32 text-center bg-white dark:bg-gray-900 rounded-[4rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
              <AlertCircle size={48} className="mx-auto text-gray-100 mb-6" />
              <p className="text-sm font-black text-gray-400 uppercase tracking-widest italic">Aucun scrutin ne correspond à votre recherche</p>
           </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nouveau scrutin">
        <form onSubmit={handleCreatePoll} className="space-y-8">
           <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Question du Scrutin</label>
              <textarea required rows={3} value={newPoll.question} onChange={e => setNewPoll({...newPoll, question: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold italic text-sm outline-none focus:ring-4 focus:ring-primary-50" placeholder="ex: Que pensez-vous du nouveau planning ?" />
           </div>

           <div className="space-y-4">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Options de Réponse</label>
              {newPoll.options.map((opt, i) => (
                <div key={i} className="flex gap-3">
                   <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[10px] font-black shrink-0">{i+1}</div>
                   <input required value={opt} onChange={e => {
                     const next = [...newPoll.options];
                     next[i] = e.target.value;
                     setNewPoll({...newPoll, options: next});
                   }} className="flex-1 px-5 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border-none text-sm font-bold outline-none" placeholder={`Option ${i+1}`} />
                   {newPoll.options.length > 2 && (
                     <button type="button" onClick={() => setNewPoll({...newPoll, options: newPoll.options.filter((_, idx) => idx !== i)})} className="p-3 text-red-400 hover:text-red-500"><Trash2 size={16}/></button>
                   )}
                </div>
              ))}
              <button type="button" onClick={() => setNewPoll({...newPoll, options: [...newPoll.options, '']})} className="text-[10px] font-black text-primary-500 uppercase tracking-widest flex items-center gap-2 mt-2 hover:underline">
                <Plus size={16}/> Ajouter un choix
              </button>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Cible</label>
                <select disabled={!isAdmin} value={newPoll.className} onChange={e => setNewPoll({...newPoll, className: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 font-black text-[10px] uppercase outline-none border-none cursor-pointer">
                   <option value="Général">Toute l'école</option>
                   {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Date limite (Optionnel)</label>
                <input type="datetime-local" value={newPoll.endTime} onChange={e => setNewPoll({...newPoll, endTime: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none" />
              </div>
           </div>

           <button type="submit" disabled={submitting} className="w-full bg-primary-500 text-white font-black py-5 rounded-[2rem] shadow-xl uppercase tracking-[0.2em] italic text-xs active:scale-95 transition-all">
              {submitting ? <Loader2 className="animate-spin mx-auto" size={20}/> : "Lancer la consultation publique"}
           </button>
        </form>
      </Modal>

      <style>{`
        .vote-vibrate {
          animation: vote-vibrate-anim 0.4s cubic-bezier(.36,.07,.19,.97) both;
        }
        @keyframes vote-vibrate-anim {
          10%, 90% { transform: translate3d(-1px, 0, 0) scale(1.02); }
          20%, 80% { transform: translate3d(2px, 0, 0) scale(1.02); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0) scale(1.02); }
          40%, 60% { transform: translate3d(4px, 0, 0) scale(1.02); }
        }
        @keyframes loading-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
