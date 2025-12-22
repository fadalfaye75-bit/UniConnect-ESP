
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { Announcement, Exam, UserRole, Poll, MeetLink } from '../types';
import { Clock, FileText, GraduationCap, Loader2, ChevronRight, BarChart2, Calendar, Video, Settings, ArrowRight, User as UserIcon, Sparkles, Megaphone, Radio, Zap, TrendingUp, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

/**
 * Dashboard final : Puissant, Rapide, Scalable.
 */
export default function Dashboard() {
  const { user, adminViewClass } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === UserRole.ADMIN;

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [meets, setMeets] = useState<MeetLink[]>([]);
  const [totals, setTotals] = useState({ anns: 0, exams: 0, polls: 0, meets: 0 });
  const [loading, setLoading] = useState(true);

  // Optimisation du fetch : regroupement des requêtes
  const fetchDashboardData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      
      const [allAnns, allExams, allPolls, allMeets] = await Promise.all([
          API.announcements.list(0, 20),
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

      setTotals({
          anns: visibleAnns.length,
          exams: visibleExams.length,
          polls: visiblePolls.length,
          meets: visibleMeets.length
      });

      const upcomingExams = visibleExams.filter(e => new Date(e.date) >= new Date());
      setExams(upcomingExams.slice(0, 3));
      setAnnouncements(visibleAnns.slice(0, 4));
      setPolls(visiblePolls.slice(0, 2));
      setMeets(visibleMeets.slice(0, 2));

    } catch (error) {
      console.error('Dashboard Error:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.className, adminViewClass, isAdmin]);

  useEffect(() => {
    if (user) {
      fetchDashboardData(true);
      const subAnn = API.announcements.subscribe(() => fetchDashboardData(false));
      const subPoll = API.polls.subscribe(() => fetchDashboardData(false));
      return () => {
        subAnn.unsubscribe();
        subPoll.unsubscribe();
      };
    }
  }, [user, fetchDashboardData]);

  const statsCards = useMemo(() => [
    { to: '/announcements', label: 'Annonces', count: totals.anns, icon: Megaphone, color: 'blue', desc: 'Dernières nouvelles' },
    { to: '/exams', label: 'Évaluations', count: totals.exams, icon: GraduationCap, color: 'orange', desc: 'Calendrier des DS' },
    { to: '/polls', label: 'Consultations', count: totals.polls, icon: BarChart2, color: 'purple', desc: 'Votre avis compte' },
    { to: '/meet', label: 'Directs', count: totals.meets, icon: Radio, color: 'emerald', desc: 'Cours en visio' }
  ], [totals]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[calc(100vh-160px)] gap-6 animate-fade-in">
        <div className="relative">
            <div className="w-16 h-16 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin"></div>
            <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary-500 animate-pulse" size={20} />
        </div>
        <p className="text-xs font-black text-gray-400 uppercase tracking-[0.4em] animate-pulse italic">UniConnect Engine...</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 max-w-7xl mx-auto animate-fade-in pb-24">
      {/* Dynamic Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-2">
           <div className="flex items-center gap-2 mb-4">
              <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Système opérationnel • ESP Dakar</span>
           </div>
           <h1 className="text-4xl md:text-6xl font-black text-gray-900 dark:text-white tracking-tighter italic leading-none">
             Bienvenue, <span className="text-primary-500">{user?.name.split(' ')[0]}</span>
           </h1>
           <p className="text-gray-500 dark:text-gray-400 text-sm font-medium italic opacity-80 max-w-lg">
             {isAdmin ? (adminViewClass ? `Gestion centralisée de la classe ${adminViewClass}` : "Supervision globale de l'établissement") : `Ton portail étudiant personnalisé pour ${user?.className}.`}
           </p>
        </div>
        
        <div className="flex items-center gap-4 bg-white dark:bg-gray-900 px-6 py-4 rounded-[2rem] shadow-soft border border-gray-100 dark:border-gray-800">
           <Calendar size={20} className="text-primary-500" />
           <span className="text-xs font-black uppercase tracking-widest text-gray-700 dark:text-gray-300">
             {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
           </span>
        </div>
      </div>

      {/* Power Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat) => (
            <Link 
              key={stat.to} 
              to={stat.to} 
              className="group relative bg-white dark:bg-gray-900 p-8 rounded-[3rem] shadow-soft border border-gray-100 dark:border-gray-800 hover:scale-[1.02] hover:shadow-premium transition-all active:scale-95 overflow-hidden"
            >
                <div className={`absolute top-0 right-0 w-32 h-32 bg-${stat.color}-500/5 -mr-16 -mt-16 rounded-full group-hover:scale-150 transition-transform duration-700`}></div>
                <div className="flex items-center justify-between mb-6 relative z-10">
                    <div className={`p-4 bg-${stat.color}-50 dark:bg-${stat.color}-900/20 text-${stat.color}-500 rounded-2xl group-hover:bg-${stat.color}-500 group-hover:text-white transition-all`}>
                        <stat.icon size={24} />
                    </div>
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</div>
                </div>
                <div className="text-5xl font-black text-gray-900 dark:text-white relative z-10 tracking-tighter mb-2">{stat.count}</div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest relative z-10">{stat.desc}</p>
            </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-12">
        {/* Main Stream */}
        <div className="lg:col-span-2 space-y-12">
          
          {/* Urgent Agenda */}
          <section className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="font-black text-gray-900 dark:text-white uppercase text-[11px] tracking-[0.4em] flex items-center gap-2 italic">
                <Clock size={16} className="text-orange-500" /> Agenda Prioritaire
              </h3>
              <Link to="/exams" className="text-[10px] text-primary-600 font-black hover:underline uppercase tracking-widest flex items-center gap-2">Voir Tout <ArrowRight size={14}/></Link>
            </div>
            
            <div className="grid gap-4">
               {exams.length > 0 ? exams.map(exam => (
                 <div key={exam.id} onClick={() => navigate('/exams')} className="bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] shadow-soft border border-gray-100 dark:border-gray-800 flex items-center justify-between hover:border-orange-400 hover:shadow-xl transition-all cursor-pointer group active:scale-[0.98]">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-2xl flex flex-col items-center justify-center border border-orange-100 dark:border-orange-800/50 group-hover:scale-105 transition-transform">
                          <span className="text-[9px] font-black uppercase tracking-tight">{new Date(exam.date).toLocaleDateString('fr-FR', {month: 'short'})}</span>
                          <span className="text-2xl font-black leading-none">{new Date(exam.date).getDate()}</span>
                      </div>
                      <div>
                          <h4 className="font-black text-xl text-gray-900 dark:text-white tracking-tighter italic leading-tight group-hover:text-primary-500 transition-colors">{exam.subject}</h4>
                          <div className="flex items-center gap-4 text-[10px] text-gray-500 mt-2 font-black uppercase tracking-widest opacity-70">
                              <span className="flex items-center gap-1"><Clock size={12} className="text-orange-500" /> {new Date(exam.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                              <span className="flex items-center gap-1"><FileText size={12} className="text-orange-500" /> Salle {exam.room}</span>
                          </div>
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-gray-300 group-hover:text-primary-500 group-hover:translate-x-1 transition-all">
                       <ArrowRight size={20} />
                    </div>
                 </div>
               )) : (
                 <div className="p-16 bg-white dark:bg-gray-900 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-gray-800 text-center opacity-60">
                    <CheckCircle2 size={48} className="mx-auto text-green-500/20 mb-4" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] italic">Aucun examen programmé</p>
                 </div>
               )}
            </div>
          </section>

          {/* Wall of News */}
          <section className="space-y-6">
            <div className="flex items-center justify-between px-2">
               <h3 className="font-black text-gray-900 dark:text-white uppercase text-[11px] tracking-[0.4em] flex items-center gap-2 italic">
                  <Megaphone size={16} className="text-blue-500" /> Le Mur d'Avis
               </h3>
               <Link to="/announcements" className="text-[10px] text-primary-600 font-black hover:underline uppercase tracking-widest flex items-center gap-2">Mur complet <ArrowRight size={14}/></Link>
            </div>
            <div className="grid sm:grid-cols-2 gap-6">
                {announcements.map(ann => (
                    <div key={ann.id} onClick={() => navigate('/announcements')} className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-soft border border-gray-100 dark:border-gray-800 hover:shadow-2xl hover:border-primary-400 transition-all cursor-pointer group flex flex-col p-8 active:scale-[0.98] relative overflow-hidden">
                      <div className={`absolute top-0 right-0 w-1.5 h-full ${ann.priority === 'urgent' ? 'bg-red-500' : (ann.priority === 'important' ? 'bg-orange-500' : 'bg-primary-500')}`}></div>
                      <div className="flex items-center justify-between mb-6">
                          <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg tracking-widest ${
                              ann.priority === 'urgent' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-primary-50 text-primary-600 border border-primary-100'
                          }`}>
                              {ann.priority}
                          </span>
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{new Date(ann.date).toLocaleDateString()}</span>
                      </div>
                      <h4 className="text-xl font-black text-gray-900 dark:text-white group-hover:text-primary-500 transition-colors line-clamp-2 leading-tight mb-4 tracking-tighter italic">{ann.title}</h4>
                      <p className="text-sm text-gray-500 line-clamp-3 italic opacity-80 mb-8">{ann.content}</p>
                      <div className="mt-auto pt-6 border-t border-gray-50 dark:border-gray-800 flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center text-[10px] font-black text-primary-600">{ann.author.charAt(0)}</div>
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{ann.author.split(' ')[0]} • {ann.className}</span>
                      </div>
                    </div>
                ))}
            </div>
          </section>
        </div>

        {/* Side Actions */}
        <div className="space-y-12">
          
          {/* Active Polls */}
          <section className="space-y-6">
             <h3 className="font-black text-gray-900 dark:text-white uppercase text-[11px] tracking-[0.4em] px-2 italic flex items-center gap-2">
                <TrendingUp size={16} className="text-purple-500" /> Consultations
             </h3>
             <div className="bg-white dark:bg-gray-900 rounded-[3rem] border border-gray-100 dark:border-gray-800 p-8 shadow-soft">
                {polls.length > 0 ? polls.map(poll => (
                   <div key={poll.id} onClick={() => navigate('/polls')} className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-[2rem] border-2 border-transparent hover:border-primary-400 cursor-pointer transition-all active:scale-95 mb-4 last:mb-0">
                      <div className="flex items-center justify-between mb-3">
                         <span className="text-[9px] font-black text-primary-500 uppercase tracking-widest">{poll.className}</span>
                         <span className="text-[9px] font-bold text-gray-400 uppercase">{poll.totalVotes} votes</span>
                      </div>
                      <p className="text-lg font-black text-gray-900 dark:text-white leading-tight italic tracking-tight">{poll.question}</p>
                   </div>
                )) : (
                   <p className="text-[10px] font-black text-gray-400 text-center uppercase py-8 opacity-50">Aucun vote actif</p>
                )}
                <Link to="/polls" className="mt-6 flex items-center justify-center gap-3 w-full py-4 text-[10px] font-black text-white bg-gray-900 dark:bg-primary-500 rounded-2xl hover:scale-105 transition-all uppercase tracking-widest active:scale-95 shadow-lg">
                   Participer <ChevronRight size={14} />
                </Link>
             </div>
          </section>

          {/* Direct Courses */}
          <section className="space-y-6">
             <h3 className="font-black text-gray-900 dark:text-white uppercase text-[11px] tracking-[0.4em] px-2 italic flex items-center gap-2">
                <Radio size={16} className="text-emerald-500" /> Salles Directes
             </h3>
             <div className="bg-gradient-to-br from-primary-600 to-indigo-900 rounded-[3rem] p-10 text-white shadow-premium relative overflow-hidden group">
                <Radio className="absolute -bottom-8 -right-8 w-40 h-40 opacity-10 group-hover:rotate-12 transition-transform duration-1000" />
                <div className="relative z-10 space-y-8">
                   {meets.length > 0 ? meets.map(meet => (
                      <div key={meet.id} className="border-b border-white/10 last:border-0 pb-6 last:pb-0">
                         <div className="flex items-center gap-2 mb-2">
                             <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                             <p className="text-[9px] font-black text-primary-200 uppercase tracking-widest">{meet.time}</p>
                         </div>
                         <h4 className="font-black text-xl italic tracking-tighter mb-4">{meet.title}</h4>
                         <a href={meet.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-3 text-[9px] font-black bg-white/20 hover:bg-white hover:text-primary-700 px-6 py-2.5 rounded-xl transition-all uppercase tracking-widest backdrop-blur-md active:scale-95">
                            Rejoindre <ChevronRight size={12} />
                         </a>
                      </div>
                   )) : (
                     <div className="text-center space-y-4 py-4">
                        <Video size={32} className="text-white/20 mx-auto" />
                        <p className="text-[10px] font-black text-white/50 uppercase tracking-widest italic">Aucun cours en direct</p>
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
