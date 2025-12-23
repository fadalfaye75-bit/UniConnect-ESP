
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, X, Lock, Unlock, Loader2, Pencil, Timer, Clock, CheckCircle2, BarChart2, Check, TrendingUp, Users, Search, Vote, AlertTriangle, Sparkles, Filter, FilterX, Shield, Award, Calendar, RefreshCcw, ChevronDown, ChevronUp, Trophy, Radio, Power, Share2, Send, BarChart as BarChartIcon } from 'lucide-react';
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
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LabelList
} from 'recharts';

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
  const [pollToDelete, setPollToDelete] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');

  const [newPoll, setNewPoll] = useState({
    question: '',
    className: '',
    options: ['', ''],
    startTime: '',
    endTime: ''
  });

  const canManageAtAll = user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE;
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

  useEffect(() => {
    if (isModalOpen) {
      setNewPoll(prev => ({ ...prev, className: isAdmin ? '' : (user?.className || '') }));
    }
  }, [isModalOpen, isAdmin, user?.className]);

  const handleVote = useCallback(async (poll: Poll, optionId: string) => {
    if (!user || poll.hasVoted) return;
    try {
      await API.polls.vote(poll.id, optionId);
      fetchPolls(false);
      addNotification({ title: 'Vote enregistré', message: 'Merci pour votre participation.', type: 'success' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Action impossible ou déjà voté.', type: 'alert' });
    }
  }, [user, addNotification, fetchPolls]);

  const handleTogglePollStatus = useCallback(async (poll: Poll) => {
    const canModify = isAdmin || poll.user_id === user?.id;
    if (!canModify) return;
    try {
      await API.polls.update(poll.id, { isActive: !poll.isActive });
      fetchPolls(false);
      addNotification({ title: poll.isActive ? 'Scrutin fermé' : 'Scrutin ouvert', message: 'Statut mis à jour.', type: 'info' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Action échouée.', type: 'alert' });
    }
  }, [isAdmin, user?.id, addNotification, fetchPolls]);

  const handleDeletePoll = async () => {
    if (!pollToDelete) return;
    setSubmitting(true);
    try {
      await API.polls.delete(pollToDelete);
      setPollToDelete(null);
      fetchPolls(false);
      addNotification({ title: 'Supprimé', message: 'Le sondage a été retiré.', type: 'info' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Suppression impossible.', type: 'alert' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const targetClass = isAdmin ? newPoll.className : (user?.className || 'Général');
      await API.polls.create({
        question: newPoll.question,
        className: targetClass,
        options: newPoll.options.filter(o => o.trim() !== '').map(label => ({ label }))
      });
      setIsModalOpen(false);
      fetchPolls(false);
      setNewPoll({ question: '', className: '', options: ['', ''], startTime: '', endTime: '' });
      addNotification({ title: 'Sondage lancé', message: 'Il est désormais visible par la classe.', type: 'success' });
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Échec de création.', type: 'alert' });
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
        <div className="bg-white dark:bg-gray-800 p-4 shadow-premium rounded-[1.5rem] border border-gray-100 dark:border-gray-700">
          <p className="text-[10px] font-black uppercase text-gray-400 mb-1 tracking-widest">{payload[0].payload.name}</p>
          <p className="text-lg font-black italic" style={{ color: themeColor }}>
            {payload[0].value} voix ({payload[0].payload.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-full gap-6">
        <Loader2 className="animate-spin" style={{ color: '#8b5cf6' }} size={40} />
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Ouverture de l'urne...</span>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-32 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 border-b border-gray-100 dark:border-gray-800 pb-10">
        <div className="flex items-center gap-5">
           <div className="w-16 h-16 text-white rounded-[1.8rem] flex items-center justify-center shadow-xl -rotate-6" style={{ backgroundColor: '#8b5cf6' }}>
              <BarChart2 size={32} />
           </div>
           <div>
              <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter italic uppercase">Consultations</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-3">Portail de Vote • {user?.schoolName}</p>
           </div>
        </div>
        
        {canManageAtAll && (
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="w-full sm:w-auto flex items-center justify-center gap-3 text-white px-10 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all italic hover:brightness-110"
            style={{ backgroundColor: '#8b5cf6' }}
          >
            <Plus size={20} /> Nouveau scrutin
          </button>
        )}
      </div>

      {/* Control Bar */}
      <div className="flex flex-col lg:flex-row gap-4 bg-white dark:bg-gray-900 p-4 rounded-[2.5rem] shadow-soft border border-gray-50 dark:border-gray-800">
        <div className="relative flex-1 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-500 transition-colors" size={20} />
          <input 
            type="text" placeholder="Rechercher une question..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-6 py-4 bg-transparent border-none rounded-2xl text-sm font-bold outline-none italic"
          />
        </div>
        <div className="flex gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="px-6 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl text-[10px] font-black uppercase outline-none border-none cursor-pointer">
             <option value="all">Tous les scrutins</option>
             <option value="active">Ouverts</option>
             <option value="closed">Archives</option>
          </select>
        </div>
      </div>

      {/* Grid of Polls */}
      <div className="grid gap-8">
        {displayedPolls.map(poll => {
            const isExpanded = expandedPollId === poll.id;
            const canModify = isAdmin || poll.user_id === user?.id;
            
            const chartData = poll.options.map(option => ({
              name: option.label,
              value: option.votes,
              percentage: poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0
            }));

            return (
              <div key={poll.id} className={`group relative bg-white dark:bg-gray-900 rounded-[3.5rem] p-10 shadow-soft border-2 transition-all duration-500 ${
                isExpanded ? 'border-purple-200 dark:border-purple-900/30' : 'border-transparent hover:border-gray-100'
              }`}>
                <div className="absolute top-0 left-0 w-2 h-full rounded-l-[3.5rem]" style={{ backgroundColor: poll.isActive ? '#8b5cf6' : '#94a3b8' }} />

                <div className="flex flex-col md:flex-row justify-between items-start mb-10 gap-6">
                   <div className="flex flex-wrap gap-3">
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${poll.isActive ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                        {poll.isActive ? 'Scrutin Ouvert' : 'Sondage Clos'}
                      </span>
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-800 px-4 py-1.5 rounded-full">{poll.className || 'Global'}</span>
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-800 px-4 py-1.5 rounded-full flex items-center gap-2">
                        <Users size={12} /> {poll.totalVotes} voix exprimées
                      </span>
                   </div>
                   <div className="flex items-center gap-2">
                     {canModify && (
                        <div className="flex gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleTogglePollStatus(poll); }} 
                            className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase text-white transition-all active:scale-90 shadow-md ${poll.isActive ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
                          >
                             {poll.isActive ? 'Fermer' : 'Réouvrir'}
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setPollToDelete(poll.id); }} 
                            className="p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all active:scale-90"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                     )}
                     <button 
                       onClick={() => setExpandedPollId(isExpanded ? null : poll.id)} 
                       className={`p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-400 transition-all active:scale-90 ${isExpanded ? 'rotate-180 bg-purple-50 text-purple-600 shadow-inner' : ''}`}
                     >
                       <ChevronDown size={24} />
                     </button>
                   </div>
                </div>

                <h3 className="text-3xl font-black italic tracking-tighter mb-12 leading-tight text-gray-900 dark:text-white">{poll.question}</h3>
                
                <div className="grid lg:grid-cols-2 gap-12 items-start">
                  <div className="space-y-4">
                    {poll.options.map(option => {
                      const percentage = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
                      const isSelected = poll.userVoteOptionId === option.id;
                      const alreadyVotedOnThisPoll = poll.hasVoted;
                      
                      return (
                        <button 
                          key={option.id} 
                          disabled={!poll.isActive || alreadyVotedOnThisPoll}
                          onClick={() => handleVote(poll, option.id)} 
                          className={`relative w-full h-20 rounded-[2rem] overflow-hidden px-10 border-2 transition-all ${
                            isSelected 
                              ? 'shadow-lg bg-purple-50 dark:bg-purple-900/10' 
                              : 'bg-white dark:bg-gray-900 border-gray-50 dark:border-gray-800'
                          } ${!poll.isActive || alreadyVotedOnThisPoll ? 'cursor-default' : 'hover:border-purple-200 active:scale-95'}`} 
                          style={isSelected ? { borderColor: '#8b5cf6' } : {}}
                        >
                            <div className="absolute left-0 top-0 bottom-0 opacity-10 transition-all duration-1000 ease-out" style={{ width: `${percentage}%`, backgroundColor: '#8b5cf6' }} />
                            <div className="flex justify-between items-center z-10 relative">
                               <div className="flex items-center gap-4">
                                  {isSelected ? (
                                    <CheckCircle2 size={20} className="text-purple-600" />
                                  ) : alreadyVotedOnThisPoll ? (
                                    <div className="w-5 h-5 rounded-full border-2 border-gray-200" />
                                  ) : null}
                                  <p className={`font-black italic text-left leading-tight ${isSelected ? 'text-purple-600' : 'text-gray-800 dark:text-gray-100'}`}>{option.label}</p>
                               </div>
                               <div className="text-right shrink-0">
                                 <span className={`text-2xl font-black italic ${isSelected ? 'text-purple-600' : 'text-gray-900 dark:text-white'}`}>{percentage}%</span>
                                 <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{option.votes} voix</p>
                               </div>
                            </div>
                        </button>
                      );
                    })}
                    {poll.hasVoted && poll.isActive && (
                      <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest text-center italic mt-4">Votre participation a été enregistrée avec succès</p>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-10 rounded-[3.5rem] h-[400px] animate-in slide-in-from-right-5 duration-700 shadow-inner border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Visualisation des données</p>
                          <h4 className="text-sm font-black italic text-gray-900 dark:text-white mt-1">Répartition des votes</h4>
                        </div>
                        <TrendingUp size={24} className="text-purple-500 opacity-50" />
                      </div>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={chartData} margin={{ top: 0, right: 60, left: 10, bottom: 0 }}>
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" hide />
                          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                          <Bar dataKey="value" radius={[0, 20, 20, 0]} barSize={45}>
                            {chartData.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={index % 2 === 0 ? '#8b5cf6' : '#a78bfa'} 
                                className="transition-all duration-500 hover:opacity-80"
                              />
                            ))}
                            <LabelList 
                              dataKey="percentage" 
                              position="right" 
                              formatter={(val: number) => `${val}%`}
                              style={{ fontSize: '12px', fontWeight: '900', fill: '#8b5cf6', fontStyle: 'italic', letterSpacing: '0.05em' }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            );
        })}

        {displayedPolls.length === 0 && (
           <div className="py-32 text-center bg-white dark:bg-gray-900 rounded-[4rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
              <BarChartIcon size={48} className="mx-auto text-gray-100 mb-6" />
              <p className="text-sm font-black text-gray-400 uppercase tracking-widest italic">Aucune consultation en cours</p>
           </div>
        )}
      </div>

      {/* Creation Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Lancer une consultation">
        <form onSubmit={handleCreatePoll} className="space-y-8">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Question principale</label>
            <textarea required value={newPoll.question} onChange={e => setNewPoll({...newPoll, question: e.target.value})} className="w-full p-6 bg-gray-50 dark:bg-gray-800 rounded-2xl font-bold italic outline-none border-none focus:ring-4 focus:ring-purple-50 transition-all" rows={4} placeholder="ex: Êtes-vous favorables au décalage de l'examen d'Analyse ?" />
          </div>
          
          <div className="space-y-4">
             <div className="flex items-center justify-between mb-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Options de réponse</label>
                <button type="button" onClick={() => setNewPoll({...newPoll, options: [...newPoll.options, '']})} className="text-[10px] font-black text-purple-600 uppercase flex items-center gap-1 bg-purple-50 px-3 py-1.5 rounded-lg active:scale-95 transition-all">
                  <Plus size={14} /> Ajouter
                </button>
             </div>
             {newPoll.options.map((opt, i) => (
               <div key={i} className="flex gap-2 animate-in slide-in-from-right-3 duration-300">
                 <input 
                  type="text" required value={opt} 
                  onChange={e => {
                    const next = [...newPoll.options];
                    next[i] = e.target.value;
                    setNewPoll({...newPoll, options: next});
                  }} 
                  className="flex-1 px-6 py-4 rounded-xl bg-gray-50 dark:bg-gray-800 font-bold italic outline-none border-none focus:bg-white transition-colors" placeholder={`Réponse possible #${i+1}`} 
                 />
                 {newPoll.options.length > 2 && (
                   <button type="button" onClick={() => setNewPoll({...newPoll, options: newPoll.options.filter((_, idx) => idx !== i)})} className="p-4 text-red-500 bg-red-50 rounded-xl active:scale-90 transition-all"><X size={18} /></button>
                 )}
               </div>
             ))}
          </div>
          
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Diffusion du scrutin</label>
            <select disabled={!isAdmin} value={newPoll.className} onChange={e => setNewPoll({...newPoll, className: e.target.value})} className="w-full p-5 bg-gray-50 dark:bg-gray-800 rounded-xl font-black text-[10px] uppercase outline-none border-none cursor-pointer">
                <option value="">Public (Toute l'école)</option>
                {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          
          <button type="submit" disabled={submitting} className="w-full bg-purple-600 text-white font-black py-5 rounded-[2.5rem] uppercase italic shadow-2xl active:scale-95 transition-all hover:bg-purple-700 flex items-center justify-center gap-3">
             {submitting ? <Loader2 className="animate-spin" /> : <Send size={20} />}
             Ouvrir l'urne électronique
          </button>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={!!pollToDelete} onClose={() => setPollToDelete(null)} title="Retirer le scrutin">
         <div className="text-center space-y-8">
            <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
               <AlertTriangle size={48} />
            </div>
            <div>
              <h4 className="text-xl font-black italic text-gray-900 dark:text-white">Action irréversible</h4>
              <p className="text-sm font-bold text-gray-500 dark:text-gray-400 italic mt-2">Souhaitez-vous vraiment supprimer ce sondage et tous les votes enregistrés ?</p>
            </div>
            <div className="flex gap-4">
               <button onClick={() => setPollToDelete(null)} className="flex-1 py-5 rounded-[2rem] bg-gray-100 font-black text-[10px] uppercase tracking-widest text-gray-500 active:scale-95 transition-all">Conserver</button>
               <button onClick={handleDeletePoll} disabled={submitting} className="flex-1 py-5 rounded-[2rem] bg-red-500 text-white font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center">
                 {submitting ? <Loader2 className="animate-spin" /> : "Confirmer"}
               </button>
            </div>
         </div>
      </Modal>
    </div>
  );
}
