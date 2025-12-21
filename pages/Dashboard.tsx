
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../services/api';
import { Announcement, Exam, UserRole, Poll, MeetLink } from '../types';
import { Clock, FileText, GraduationCap, Loader2, ChevronRight, BarChart2, Calendar, Video, Settings, ArrowRight, User as UserIcon, Sparkles, Megaphone, Radio } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

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

  const fetchDashboardData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      
      const userClass = user?.className;

      const [allAnns, allExams, allPolls, allMeets] = await Promise.all([
          API.announcements.list(0, 50),
          API.exams.list(),
          API.polls.list(),
          API.meet.list()
      ]);

      const isVisible = (itemClass: string) => {
        const target = itemClass || 'Général';
        if (isAdmin && !adminViewClass) return true; 
        if (adminViewClass) return target === adminViewClass || target === 'Général';
        return target === userClass || target === 'Général';
      };

      const visibleAnns = allAnns.filter(a => isVisible(a.className));
      const visibleExams = allExams.filter(e => isVisible(e.className));
      const visiblePolls = allPolls.filter(p => isVisible(p.className) && p.isActive);
      const visibleMeets = allMeets.filter(m => isVisible(m.className));

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
      console.error('Dashboard sync error:', error);
    } finally {
      setLoading(false);
    }
  }, [user, adminViewClass, isAdmin]);

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
  }, [user, adminViewClass, fetchDashboardData]);

  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[calc(100vh-160px)] gap-6">
        <div className="relative">
            <div className="w-16 h-16 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin"></div>
            <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary-500 animate-pulse" size={24} />
        </div>
        <span className="text-sm font-black text-gray-400 uppercase tracking-[0.3em] animate-pulse italic">Indexation ESP Dakar...</span>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-7xl mx-auto animate-fade-in pb-24 md:pb-12">
      {/* Hero Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div>
           <div className="flex items-center gap-3 mb-4">
              <div className="px-3 py-1 bg-green-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-green-500/20">Système En Ligne</div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 italic">Plateforme Synchronisée</span>
           </div>
           <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 dark:text-white tracking-tighter leading-[1.1]">
             Bonjour, <span className="text-primary-600 italic block sm:inline">{user?.name.split(' ')[0]}</span>
           </h2>
           <p className="text-gray-500 dark:text-gray-400 mt-4 text-sm sm:text-base font-medium max-w-xl leading-relaxed italic opacity-80">
             {isAdmin ? (adminViewClass ? `Focalisation sur la classe : ${adminViewClass}` : "Surveillance globale des activités de l'ESP Dakar.") : `UniConnect centralise vos informations de la classe ${user?.className}.`}
           </p>
        </div>
        
        <div className="flex flex-col items-end gap-3 self-start lg:self-center">
            <div className="flex items-center gap-4 text-[11px] font-black text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 px-8 py-5 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-soft uppercase tracking-[0.2em] italic">
                <Calendar size={18} className="text-primary-500" />
                {formattedDate}
            </div>
            {isAdmin && (
                <Link to="/admin" className="flex items-center gap-2 text-[10px] font-black text-primary-600 hover:text-primary-700 uppercase tracking-widest hover:underline px-4">
                    <Settings size={14} /> Accès Administration
                </Link>
            )}
        </div>
      </div>

      {/* Metrics Center */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
            { to: '/announcements', label: 'Annonces', count: totals.anns, icon: Megaphone, color: 'blue' },
            { to: '/exams', label: 'Épreuves', count: totals.exams, icon: GraduationCap, color: 'orange' },
            { to: '/polls', label: 'Consultations', count: totals.polls, icon: BarChart2, color: 'purple' },
            { to: '/meet', label: 'Salles Direct', count: totals.meets, icon: Radio, color: 'emerald' }
        ].map((stat) => (
            <Link 
              key={stat.to} 
              to={stat.to} 
              className="group bg-white dark:bg-gray-900 p-8 rounded-[3rem] shadow-soft border border-gray-100 dark:border-gray-800 hover:scale-[1.02] transition-all relative overflow-hidden active:scale-95"
            >
                <div className="flex items-center justify-between mb-6 relative z-10">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</div>
                    <div className={`p-3 bg-${stat.color}-50 dark:bg-${stat.color}-900/30 text-${stat.color}-500 rounded-2xl group-hover:bg-${stat.color}-500 group-hover:text-white transition-all shadow-sm`}>
                        <stat.icon size={20} />
                    </div>
                </div>
                <div className="text-5xl font-black text-gray-900 dark:text-white relative z-10 group-hover:translate-x-1 transition-transform">{stat.count}</div>
                <div className={`absolute -bottom-8 -right-8 text-${stat.color}-500/5 group-hover:text-${stat.color}-500/10 transition-all duration-700`}>
                    <stat.icon size={160} />
                </div>
            </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-12">
        {/* News Feed & Agenda */}
        <div className="lg:col-span-2 space-y-12">
          
          {/* Agenda Priority */}
          <section className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="font-black text-gray-900 dark:text-white uppercase text-[11px] tracking-[0.4em] flex items-center gap-2 italic">
                <Clock size={16} className="text-orange-500" /> Agenda Prioritaire
              </h3>
              <Link to="/exams" className="text-[10px] text-primary-600 font-black hover:underline uppercase tracking-widest flex items-center gap-2 active:scale-95">Explorer tout <ArrowRight size={14}/></Link>
            </div>
            
            <div className="grid gap-4">
               {exams.length > 0 ? exams.map(exam => (
                 <div 
                    key={exam.id} 
                    onClick={() => navigate('/exams')} 
                    className="bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] shadow-soft border border-gray-100 dark:border-gray-800 flex items-center justify-between hover:border-orange-400 hover:shadow-xl transition-all cursor-pointer group active:scale-[0.98] overflow-hidden relative"
                 >
                    <div className="absolute top-0 right-0 w-24 h-full bg-orange-500/0 group-hover:bg-orange-500/5 transition-colors"></div>
                    <div className="flex items-center gap-6 relative z-10">
                      <div className="w-16 h-16 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-2xl flex flex-col items-center justify-center border border-orange-100 dark:border-orange-800/50 group-hover:scale-105 transition-transform">
                          <span className="text-[9px] font-black uppercase tracking-tight">{new Date(exam.date).toLocaleDateString('fr-FR', {month: 'short'})}</span>
                          <span className="text-2xl font-black leading-none">{new Date(exam.date).getDate()}</span>
                      </div>
                      <div className="min-w-0">
                          <h4 className="font-black text-xl text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors truncate tracking-tighter italic leading-tight">{exam.subject}</h4>
                          <div className="flex flex-wrap items-center gap-4 text-[10px] text-gray-500 mt-2 font-black uppercase tracking-widest opacity-70">
                              <span className="flex items-center gap-2"><Clock size={12} className="text-orange-500" /> {new Date(exam.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                              <span className="flex items-center gap-2"><FileText size={12} className="text-orange-500" /> Salle {exam.room}</span>
                              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-primary-500 text-[8px] border border-gray-200 dark:border-gray-700">{exam.className}</span>
                          </div>
                      </div>
                    </div>
                    <ArrowRight size={20} className="text-gray-200 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" />
                 </div>
               )) : (
                 <div className="p-16 bg-white dark:bg-gray-900 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-gray-800 text-center">
                    <GraduationCap size={48} className="mx-auto text-gray-100 dark:text-gray-800 mb-4" />
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest italic opacity-60">Repos mérité : Aucune épreuve programmée</p>
                 </div>
               )}
            </div>
          </section>

          {/* Announcements Grid */}
          <section className="space-y-6">
            <div className="flex items-center justify-between px-2">
               <h3 className="font-black text-gray-900 dark:text-white uppercase text-[11px] tracking-[0.4em] flex items-center gap-2 italic">
                  <Megaphone size={16} className="text-blue-500" /> Avis de l'ESP
               </h3>
               <Link to="/announcements" className="text-[10px] text-primary-600 font-black hover:underline uppercase tracking-widest flex items-center gap-2 active:scale-95">Le Mur d'Avis <ArrowRight size={14}/></Link>
            </div>
            {announcements.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-8">
                    {announcements.map(ann => (
                        <div 
                          key={ann.id} 
                          onClick={() => navigate('/announcements')} 
                          className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-soft border border-gray-100 dark:border-gray-800 hover:shadow-2xl hover:border-primary-400 transition-all cursor-pointer group flex flex-col p-8 active:scale-[0.98] relative overflow-hidden"
                        >
                          <div className={`absolute top-0 right-0 w-2 h-full ${ann.priority === 'urgent' ? 'bg-red-500' : (ann.priority === 'important' ? 'bg-orange-500' : 'bg-primary-500')}`}></div>
                          
                          <div className="flex items-center justify-between mb-8">
                              <span className={`text-[9px] font-black uppercase px-4 py-2 rounded-2xl border tracking-widest ${
                                  ann.priority === 'urgent' ? 'bg-red-50 text-red-600 border-red-100' : 
                                  ann.priority === 'important' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-primary-50 text-primary-600 border-primary-100'
                              }`}>
                                  {ann.priority}
                              </span>
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Clock size={14}/> {new Date(ann.date).toLocaleDateString()}</span>
                          </div>
                          <h4 className="text-2xl font-black text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors line-clamp-2 leading-[1.2] mb-4 tracking-tighter italic">{ann.title}</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed mb-8 font-medium italic opacity-80">{ann.content}</p>
                          <div className="mt-auto pt-6 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-black text-xs uppercase shadow-sm">{ann.author.charAt(0)}</div>
                                  <span className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-tight">{ann.author.split(' ')[0]}</span>
                              </div>
                              <span className="text-[9px] font-black uppercase text-primary-500 px-3 py-1 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800/50">{ann.className}</span>
                          </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="p-16 bg-white dark:bg-gray-900 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-gray-800 text-center">
                    <Megaphone size={48} className="mx-auto text-gray-100 dark:text-gray-800 mb-4" />
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest italic opacity-60">Silence radio : Aucun avis publié aujourd'hui</p>
                </div>
            )}
          </section>
        </div>

        {/* Action Sidebar */}
        <div className="space-y-12">
          
          {/* Active Polls */}
          <section className="space-y-6">
             <h3 className="font-black text-gray-900 dark:text-white uppercase text-[11px] tracking-[0.4em] px-2 italic flex items-center gap-2">
                <BarChart2 size={16} className="text-purple-500" /> Consultations
             </h3>
             <div className="bg-white dark:bg-gray-900 rounded-[3rem] border border-gray-100 dark:border-gray-800 p-8 shadow-soft space-y-6">
                {polls.length > 0 ? polls.map(poll => (
                   <div key={poll.id} onClick={() => navigate('/polls')} className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-[2rem] border-2 border-transparent hover:border-primary-400 cursor-pointer transition-all group active:scale-95 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                         <span className="text-[9px] font-black text-primary-500 uppercase tracking-[0.2em]">{poll.className}</span>
                         <span className="text-[9px] font-black text-gray-400 flex items-center gap-1"><UserIcon size={12}/> {poll.totalVotes} participations</span>
                      </div>
                      <p className="text-lg font-black text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors line-clamp-3 leading-tight tracking-tight italic">{poll.question}</p>
                   </div>
                )) : (
                   <div className="py-8 text-center text-gray-400">
                      <BarChart2 size={32} className="mx-auto opacity-10 mb-3" />
                      <p className="text-[10px] font-black uppercase tracking-widest italic opacity-50">Aucun vote en cours</p>
                   </div>
                )}
                <Link to="/polls" className="flex items-center justify-center gap-3 w-full py-5 text-[11px] font-black text-primary-600 bg-primary-50 dark:bg-primary-900/20 rounded-2xl hover:bg-primary-500 hover:text-white transition-all uppercase tracking-[0.3em] active:scale-95 shadow-sm border border-primary-100 dark:border-primary-800/50">
                   PARTICIPER <ArrowRight size={16} />
                </Link>
             </div>
          </section>

          {/* Direct Courses */}
          <section className="space-y-6">
             <h3 className="font-black text-gray-900 dark:text-white uppercase text-[11px] tracking-[0.4em] px-2 italic flex items-center gap-2">
                <Radio size={16} className="text-emerald-500" /> Salles en Direct
             </h3>
             <div className="bg-gradient-to-br from-primary-600 to-indigo-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group">
                <Radio className="absolute -bottom-8 -right-8 w-40 h-40 opacity-10 group-hover:rotate-12 transition-transform duration-1000" />
                <div className="relative z-10 space-y-10">
                   {meets.length > 0 ? meets.map(meet => (
                      <div key={meet.id} className="border-b border-white/10 last:border-0 pb-8 last:pb-0 group/meet">
                         <div className="flex items-center gap-2 mb-2">
                             <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></span>
                             <p className="text-[9px] font-black text-primary-200 uppercase tracking-widest">{meet.time}</p>
                         </div>
                         <h4 className="font-black text-xl tracking-tighter leading-tight mb-4 italic group-hover/meet:translate-x-1 transition-transform">{meet.title}</h4>
                         <a href={meet.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-3 text-[10px] font-black bg-white/10 hover:bg-white text-white hover:text-primary-700 px-6 py-3 rounded-2xl transition-all uppercase tracking-widest shadow-xl backdrop-blur-md active:scale-95 border border-white/10">
                            REJOINDRE <ChevronRight size={14} />
                         </a>
                      </div>
                   )) : (
                     <div className="py-6 space-y-4">
                        <Video size={40} className="text-white/20 mx-auto" />
                        <p className="text-[10px] font-black text-white/50 text-center uppercase tracking-widest italic">Aucun cours en visioconférence pour le moment</p>
                     </div>
                   )}
                </div>
             </div>
          </section>

          {/* Quick Access List */}
          <div className="bg-white dark:bg-gray-900 rounded-[3rem] border border-gray-100 dark:border-gray-800 p-10 shadow-soft">
             <h3 className="font-black text-gray-900 dark:text-white mb-10 text-[11px] uppercase tracking-[0.4em] flex items-center gap-2 italic">
                <Sparkles size={16} className="text-primary-500" /> Services ESP
             </h3>
             <div className="space-y-8">
               <Link to="/schedule" className="flex items-center gap-5 group active:scale-95">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-2xl group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-xl shadow-emerald-500/5 border border-emerald-100 dark:border-emerald-800"><Calendar size={20} /></div>
                  <div className="flex flex-col">
                    <span className="font-black text-sm text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors tracking-tight italic">Emploi du Temps</span>
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] opacity-60">Planning & PDF</span>
                  </div>
               </Link>
               <Link to="/profile" className="flex items-center gap-5 group active:scale-95">
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 text-gray-500 rounded-2xl group-hover:bg-gray-900 group-hover:text-white transition-all shadow-xl shadow-gray-500/5 border border-gray-100 dark:border-gray-700"><UserIcon size={20} /></div>
                  <div className="flex flex-col">
                    <span className="font-black text-sm text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors tracking-tight italic">Mon Compte</span>
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] opacity-60">Profil & Sécurité</span>
                  </div>
               </Link>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
