
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, X, Lock, Unlock, Loader2, Pencil, Timer, Clock, CheckCircle2, BarChart2, Check, TrendingUp, Users, Search, Vote, AlertTriangle, Sparkles, Filter, FilterX, Shield, Award, Calendar, RefreshCcw, ChevronDown, ChevronUp, Trophy, Radio, Power, Share2, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, Poll, ClassGroup } from '../types';
import Modal from '../components/Modal';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';

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
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');

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

  useEffect(() => {
    if (isModalOpen) {
      setNewPoll(prev => ({ ...prev, className: isAdmin ? '' : (user?.className || '') }));
    }
  }, [isModalOpen, isAdmin, user?.className]);

  const handleVote = useCallback(async (poll: Poll, optionId: string) => {
    if (!user || poll.userVoteOptionId === optionId) return;
    try {
      await API.polls.vote(poll.id, optionId);
      fetchPolls(false);
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Vote impossible.', type: 'alert' });
    }
  }, [user, addNotification, fetchPolls]);

  const handleTogglePollStatus = useCallback(async (poll: Poll) => {
    const canModify = isAdmin || poll.user_id === user?.id;
    if (!canModify) return;
    try {
      await API.polls.update(poll.id, { isActive: !poll.isActive });
      fetchPolls(false);
    } catch (error) {
      addNotification({ title: 'Erreur', message: 'Action échouée.', type: 'alert' });
    }
  }, [isAdmin, user?.id, addNotification, fetchPolls]);

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
      addNotification({ title: 'Succès', message: 'Sondage lancé.', type: 'success' });
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

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-primary-500" size={32} /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-32 animate-fade-in">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-gray-100 dark:border-gray-800 pb-10">
        <div className="flex items-center gap-5">
           <div className="w-16 h-16 text-white rounded-[2rem] flex items-center justify-center shadow-2xl" style={{ backgroundColor: themeColor }}><BarChart2 size={32} /></div>
           <div>
              <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter italic uppercase">Consultations</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-3">{user?.className || 'ESP'}</p>
           </div>
        </div>
        <div className="flex flex-col lg:flex-row flex-1 items-center gap-3 max-w-3xl">
           <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full px-6 py-5 bg-white dark:bg-gray-900 border border-gray-100 rounded-[2rem] text-sm outline-none font-bold" />
           {canManage && (
             <button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto text-white px-10 py-5 rounded-2xl text-[11px] font-black uppercase italic shadow-xl" style={{ backgroundColor: themeColor }}>
               <Plus size={20} className="inline mr-2" /> Nouveau
             </button>
           )}
        </div>
      </div>

      <div className="grid gap-6">
        {displayedPolls.map(poll => {
            const isExpanded = expandedPollId === poll.id;
            const canModify = isAdmin || poll.user_id === user?.id;
            return (
              <div key={poll.id} onClick={() => !isExpanded && setExpandedPollId(poll.id)} className={`bg-white dark:bg-gray-900 rounded-[3.5rem] p-10 shadow-soft border-2 transition-all cursor-pointer ${isExpanded ? 'border-primary-500' : 'border-transparent'}`}>
                <div className="flex justify-between items-start mb-10 gap-6">
                   <div className="flex gap-3">
                      <span className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest ${poll.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                        {poll.isActive ? 'Ouvert' : 'Fermé'}
                      </span>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-800 px-5 py-2.5 rounded-full">{poll.className || 'ESP'}</span>
                   </div>
                   <div className="flex items-center gap-2">
                     {canModify && (
                        <button onClick={(e) => { e.stopPropagation(); handleTogglePollStatus(poll); }} className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase text-white ${poll.isActive ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                           {poll.isActive ? 'Clôturer' : 'Ouvrir'}
                        </button>
                     )}
                     <button onClick={(e) => { e.stopPropagation(); setExpandedPollId(isExpanded ? null : poll.id); }} className={`p-4 rounded-2xl bg-gray-50 text-gray-400 ${isExpanded ? 'rotate-180' : ''}`}><ChevronDown size={24} /></button>
                   </div>
                </div>
                <h3 className="text-3xl font-black italic tracking-tighter mb-10">{poll.question}</h3>
                <div className="space-y-4">
                  {poll.options.map(option => {
                    const percentage = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
                    const isSelected = poll.userVoteOptionId === option.id;
                    return (
                      <button key={option.id} onClick={(e) => { e.stopPropagation(); if(poll.isActive) handleVote(poll, option.id); }} className={`relative w-full h-20 rounded-[2rem] overflow-hidden px-10 border-2 ${isSelected ? 'shadow-lg' : 'bg-white dark:bg-gray-900 border-gray-50 dark:border-gray-800'}`} style={isSelected ? { borderColor: themeColor } : {}}>
                          <div className="absolute left-0 top-0 bottom-0 opacity-20 transition-all duration-500" style={{ width: `${percentage}%`, backgroundColor: themeColor }} />
                          <div className="flex justify-between items-center z-10 relative">
                             <div className="flex items-center gap-6"><p className="font-black italic">{option.label}</p></div>
                             <div className="text-right"><span className="text-2xl font-black italic">{percentage}%</span></div>
                          </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
        })}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Lancer un sondage">
        <form onSubmit={handleCreatePoll} className="space-y-6">
          <textarea required value={newPoll.question} onChange={e => setNewPoll({...newPoll, question: e.target.value})} className="w-full p-6 bg-gray-50 dark:bg-gray-800 rounded-2xl font-bold italic outline-none" rows={3} placeholder="Question..." />
          <div className="space-y-3">
             {newPoll.options.map((opt, i) => (
               <input key={i} type="text" value={opt} onChange={e => {
                  const next = [...newPoll.options];
                  next[i] = e.target.value;
                  setNewPoll({...newPoll, options: next});
               }} className="w-full px-5 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 font-bold italic outline-none" placeholder={`Option ${i+1}`} />
             ))}
             <button type="button" onClick={() => setNewPoll({...newPoll, options: [...newPoll.options, '']})} className="text-[10px] font-black text-primary-500 uppercase">Ajouter un choix</button>
          </div>
          <div>
             <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Audience</label>
             <select disabled={!isAdmin} value={newPoll.className} onChange={e => setNewPoll({...newPoll, className: e.target.value})} className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-xl font-black text-[10px] uppercase">
                <option value="">Général</option>
                {isAdmin ? classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>) : <option value={user?.className}>{user?.className}</option>}
             </select>
          </div>
          <button type="submit" disabled={submitting} className="w-full bg-primary-500 text-white font-black py-5 rounded-[2.5rem] uppercase italic shadow-xl">Diffuser</button>
        </form>
      </Modal>
    </div>
  );
}
