
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { Announcement, Exam, UserRole, Poll, MeetLink } from '../types';
import { Clock, FileText, GraduationCap, Loader2, ChevronRight, BarChart2, Calendar, Video, Settings, ArrowRight, User as UserIcon, Sparkles, Megaphone, Radio, Zap, TrendingUp, CheckCircle2, MapPin, BellRing, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';

export default function Dashboard() {
  const { user, adminViewClass } = useAuth();
  const { permission, requestPermission } = useNotification();
  const navigate = useNavigate();
  const isAdmin = user?.role === UserRole.ADMIN;
  const themeColor = user?.themeColor || '#0ea5e9';

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [meets, setMeets] = useState<MeetLink[]>([]);
  const [totals, setTotals] = useState({ anns: 0, exams: 0, polls: 0, meets: 0 });
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const [allAnns, allExams, allPolls, allMeets] = await Promise.all([
          API.announcements.list(0, 10),
          API.exams.list(),
          API.polls.list(),
          API.meet.list()
      ]);

      const filterByClass = (itemClass: string) => {
        const target = itemClass || 'Général';
        if (isAdmin && !adminViewClass) return true; 
        if (adminViewClass) return target === adminViewClass || target === 'Général';
        return target === user?.className || target === 'Général';
      };

      const visibleAnns = allAnns.filter(a => filterByClass(a.className));
      const visibleExams = allExams.filter(e => filterByClass(e.className));
      const visiblePolls = allPolls.filter(p => filterByClass(p.className) && p.isActive);
      const visibleMeets = allMeets.filter(m => filterByClass(m.className));

      setTotals({ anns: visibleAnns.length, exams: visibleExams.length, polls: visiblePolls.length, meets: visibleMeets.length });
      setExams(visibleExams.filter(e => new Date(e.date) >= new Date()).slice(0, 3));
      setAnnouncements(visibleAnns.slice(0, 4));
      setPolls(visiblePolls.slice(0, 2));
      setMeets(visibleMeets.slice(0, 2));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user?.className, adminViewClass, isAdmin]);

  useEffect(() => {
    if (user) {
      fetchDashboardData(true);
      const subAnn = API.announcements.subscribe(() => fetchDashboardData(false));
      return () => {
        subAnn.unsubscribe();
      };
    }
  }, [user, fetchDashboardData]);

  const metrics = useMemo(() => [
    { to: '/announcements', label: 'Avis', count: totals.anns, icon: Megaphone, color: themeColor },
    { to: '/exams', label: 'Examens', count: totals.exams, icon: GraduationCap, color: '#f59e0b' },
    { to: '/polls', label: 'Votes', count: totals.polls, icon: BarChart2, color: '#8b5cf6' },
    { to: '/meet', label: 'Live', count: totals.meets, icon: Radio, color: '#10b981' }
  ], [totals, themeColor]);

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-full gap-6">
        <div className="w-16 h-16 border-4 border-gray-100 border-t-primary-500 rounded-full animate-spin"></div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic animate-pulse">Synchronisation UniConnect...</p>
    </div>
  );

  return (
    <div className="space-y-12 max-w-7xl mx-auto animate-fade-in pb-20">
      {/* Dynamic Branding Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
           <div className="inline-flex items-center gap-3 px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <Sparkles size={16} className="animate-pulse" style={{ color: themeColor }} />
              <span className="text-[10px] font-black uppercase tracking-widest">{user?.schoolName || 'ESP DAKAR'} • PORTAIL ÉTUDIANT</span>
           </div>
           <h1 className="text-5xl md:text-7xl font-black text-gray-900 dark:text-white tracking-tighter italic leading-[0.9]">
             Salut, <span style={{ color: themeColor }}>{user?.name.split(' ')[0]}</span>
           </h1>
           <p className="text-gray-500 dark:text-gray-400 text-sm font-medium italic max-w-lg">
             Prêt pour ta journée en <span className="text-gray-900 dark:text-white font-black">{user?.className}</span> ? Voici l'essentiel de ton campus.
           </p>
        </div>
        
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4 bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] shadow-soft border border-gray-100 dark:border-gray-800 group hover:border-gray-300 transition-all cursor-default">
             <Calendar size={24} style={{ color: themeColor }} className="group-hover:rotate-12 transition-transform" />
             <div className="text-right">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Date du jour</p>
                <span className="text-sm font-black text-gray-900 dark:text-white italic capitalize">
                  {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
             </div>
          </div>
          
          {permission === 'default' && (
            <button 
              onClick={requestPermission}
              className="flex items-center gap-4 bg-emerald-500 text-white p-6 rounded-[2.5rem] shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all group"
            >
              <BellRing size={24} className="animate-bounce" />
              <div className="text-left">
                 <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">Alertes Campus</p>
                 <span className="text-sm font-black italic">Activer les Notifications</span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Vibrant Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((m) => (
            <Link 
              key={m.to} 
              to={m.to} 
              className="group relative p-10 rounded-[3rem] bg-white dark:bg-gray-900 shadow-soft border border-gray-100 dark:border-gray-800 hover:scale-[1.03] active:scale-95 transition-all overflow-hidden"
              style={{ borderBottomWidth: '6px', borderBottomColor: m.color }}
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 dark:bg-gray-800 -mr-16 -mt-16 rounded-full group-hover:scale-150 transition-transform duration-700 opacity-50"></div>
                <div className="flex items-center justify-between mb-8">
                    <div 
                      className="p-4 rounded-2xl text-white shadow-lg group-hover:rotate-6 transition-transform"
                      style={{ backgroundColor: m.color }}
                    >
                        <m.icon size={28} />
                    </div>
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{m.label}</span>
                </div>
                <div className="text-6xl font-black text-gray-900 dark:text-white tracking-tighter italic mb-1">{m.count}</div>
                <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Consulter <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
            </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-12">
        {/* News Wall with Personal Color Accents */}
        <div className="lg:col-span-3 space-y-8">
          <div className="flex items-center justify-between px-4">
             <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-[0.3em] flex items-center gap-3 italic">
                <Megaphone size={18} style={{ color: themeColor }} /> Flux d'informations
             </h3>
             <Link to="/announcements" className="p-2 text-gray-400 hover:text-gray-900 transition-colors"><ArrowRight size={20}/></Link>
          </div>
          
          <div className="grid gap-6">
              {announcements.map((ann, i) => (
                  <div key={ann.id} onClick={() => navigate('/announcements')} className="group relative bg-white dark:bg-gray-900 p-8 rounded-[3rem] shadow-soft border border-gray-100 dark:border-gray-800 transition-all hover:shadow-2xl hover:-translate-y-1 cursor-pointer flex flex-col md:flex-row gap-6">
                    <div 
                      className="absolute top-0 left-0 w-2 h-full rounded-l-[3rem]"
                      style={{ backgroundColor: ann.priority === 'urgent' ? '#f43f5e' : themeColor }}
                    ></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md tracking-widest ${
                           ann.priority === 'urgent' ? 'bg-rose-100 text-rose-600' : 'bg-gray-100 text-gray-500'
                        }`}>{ann.priority}</span>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{new Date(ann.date).toLocaleDateString()}</span>
                      </div>
                      <h4 className="text-xl font-black text-gray-900 dark:text-white italic tracking-tighter line-clamp-2 leading-tight group-hover:text-primary-500 transition-colors">{ann.title}</h4>
                      <p className="text-sm text-gray-500 mt-2 line-clamp-2 italic leading-relaxed">{ann.content}</p>
                    </div>
                    <div className="flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-800 rounded-3xl group-hover:bg-gray-100 transition-colors">
                        <ArrowRight size={24} className="text-gray-300 group-hover:translate-x-1 transition-all" style={{ color: themeColor }} />
                    </div>
                  </div>
              ))}
          </div>
        </div>

        {/* Calendar & Direct with Theme Colors */}
        <div className="lg:col-span-2 space-y-12">
          <section className="space-y-6">
             <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-[0.3em] px-4 flex items-center gap-3 italic">
                <Clock size={18} style={{ color: '#f59e0b' }} /> Échéances Proches
             </h3>
             <div className="bg-white dark:bg-gray-900 p-10 rounded-[3.5rem] shadow-soft border border-gray-100 dark:border-gray-800 space-y-8 relative overflow-hidden">
                {exams.length > 0 ? exams.map(exam => (
                   <div key={exam.id} onClick={() => navigate('/exams')} className="flex items-center gap-6 group cursor-pointer border-b border-gray-50 dark:border-gray-800 last:border-0 pb-6 last:pb-0">
                      <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-rose-500 text-white rounded-2xl flex flex-col items-center justify-center shadow-lg group-hover:rotate-6 transition-transform shrink-0">
                          <span className="text-[9px] font-black uppercase tracking-tight">{new Date(exam.date).toLocaleDateString('fr-FR', {month: 'short'})}</span>
                          <span className="text-2xl font-black leading-none">{new Date(exam.date).getDate()}</span>
                      </div>
                      <div className="min-w-0">
                         <h4 className="font-black text-lg text-gray-900 dark:text-white tracking-tighter italic leading-tight truncate group-hover:text-orange-500 transition-colors">{exam.subject}</h4>
                         <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                            <span className="flex items-center gap-1"><MapPin size={10} /> {exam.room}</span>
                            <span>•</span>
                            <span>{new Date(exam.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                         </div>
                      </div>
                   </div>
                )) : (
                   <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest text-center py-6">Rien d'imminent</p>
                )}
             </div>
          </section>

          <section className="space-y-6">
             <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-[0.3em] px-4 flex items-center gap-3 italic">
                <Radio size={18} style={{ color: themeColor }} /> Salles en Direct
             </h3>
             <div 
               className="p-10 rounded-[3.5rem] text-white shadow-premium relative overflow-hidden group"
               style={{ background: `linear-gradient(135deg, ${themeColor}, #000000)` }}
             >
                <Radio className="absolute -bottom-10 -right-10 w-48 h-48 opacity-10 group-hover:rotate-12 transition-transform duration-1000" />
                <div className="relative z-10 space-y-8">
                   {meets.length > 0 ? meets.map(meet => (
                      <div key={meet.id} className="space-y-4">
                         <div>
                            <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 opacity-80">
                               <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span> {meet.time}
                            </p>
                            <h4 className="text-2xl font-black italic tracking-tighter leading-tight mt-1">{meet.title}</h4>
                         </div>
                         <a href={meet.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-3 px-6 py-3 bg-white/20 hover:bg-white hover:text-gray-900 backdrop-blur-md rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg">
                            Accéder au direct <ArrowRight size={14} />
                         </a>
                      </div>
                   )) : (
                      <div className="text-center py-6 opacity-40">
                         <Video size={32} className="mx-auto mb-3" />
                         <p className="text-[10px] font-black uppercase tracking-widest">Aucun direct programmé</p>
                      </div>
                   )}
                </div>
             </div>
          </section>
        </div>
      </div>
    </div>
  );
}
