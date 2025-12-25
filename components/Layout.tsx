
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Megaphone, Calendar, GraduationCap, Video, 
  BarChart2, Search, LogOut, Menu, Moon, Sun, 
  ShieldCheck, UserCircle, Bell, Check, School, 
  CheckCheck, Clock, BellRing, Settings
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import { UserRole } from '../types';

export const UserAvatar = React.memo(({ name, color, className = "w-10 h-10", textClassName = "text-xs" }: { name: string, color?: string, className?: string, textClassName?: string }) => {
  const initials = useMemo(() => {
    if (!name) return "?";
    const parts = name.split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }, [name]);

  const bgColor = color || '#0ea5e9';

  return (
    <div 
      className={`${className} rounded-2xl flex items-center justify-center text-white font-black shadow-lg border-2 border-white dark:border-gray-800 shrink-0 transform hover:rotate-3 transition-transform`}
      style={{ backgroundColor: bgColor }}
    >
      <span className={textClassName}>{initials}</span>
    </div>
  );
});

export default function Layout() {
  const { user, logout, toggleTheme, isDarkMode } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications, permission, requestPermission } = useNotification();
  
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isNotifOpen, setNotifOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [allData, setAllData] = useState<{anns: any[], exams: any[], schs: any[]}>({anns: [], exams: [], schs: []});
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const themeColor = user?.themeColor || '#0ea5e9';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setNotifOpen(false);
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setIsSearchOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
    setNotifOpen(false);
    setIsSearchOpen(false);
  }, [location]);

  const prefetchSearchData = useCallback(async () => {
    if (isDataLoaded) return;
    try {
      const [anns, exams, schs] = await Promise.all([
        API.announcements.list(0, 100),
        API.exams.list(),
        API.schedules.list()
      ]);
      setAllData({ anns, exams, schs });
      setIsDataLoaded(true);
    } catch (e) { console.error(e); }
  }, [isDataLoaded]);

  const searchResults = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (query.length < 2) return { announcements: [], exams: [], schedules: [] };
    const filterByAccess = (item: any) => {
      const target = (item.className || item.classname || 'Général').toLowerCase().trim();
      if (user?.role === UserRole.ADMIN) return true;
      const userClass = (user?.className || '').toLowerCase().trim();
      return target === userClass || target === 'général';
    };
    return {
      announcements: allData.anns.filter(a => filterByAccess(a) && (a.title.toLowerCase().includes(query) || a.content.toLowerCase().includes(query))).slice(0, 4),
      exams: allData.exams.filter(e => filterByAccess(e) && (e.subject.toLowerCase().includes(query))).slice(0, 4),
      schedules: allData.schs.filter(s => filterByAccess(s) && (s.category.toLowerCase().includes(query))).slice(0, 4)
    };
  }, [searchQuery, allData, user]);

  const navItems = useMemo(() => {
    const items = [
      { to: '/', icon: LayoutDashboard, label: 'Tableau de Bord', end: true },
      { to: '/announcements', icon: Megaphone, label: 'Annonces' },
      { to: '/schedule', icon: Calendar, label: 'Planning & Cours' },
      { to: '/exams', icon: GraduationCap, label: 'Examens' },
      { to: '/meet', icon: Video, label: 'Directs' },
      { to: '/polls', icon: BarChart2, label: 'Consultations' },
      { to: '/profile', icon: UserCircle, label: 'Profil' },
    ];
    if (user?.role === UserRole.ADMIN) items.push({ to: '/admin', icon: ShieldCheck, label: 'Administration' } as any);
    return items;
  }, [user?.role]);

  const handleLogout = useCallback(async () => {
    if (window.confirm("Voulez-vous vraiment quitter le portail JangHup ?")) {
      await logout();
    }
  }, [logout]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200 font-sans overflow-hidden">
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-gray-900/60 md:hidden backdrop-blur-sm transition-opacity" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 transform transition-transform duration-300 md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col shadow-premium md:shadow-none`}>
        <div className="p-8 h-24 flex-shrink-0 flex items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center text-white rounded-[1.2rem] shadow-xl" style={{ backgroundColor: themeColor }}>
             <School size={28} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black text-gray-900 dark:text-white tracking-tighter uppercase italic leading-none">JangHup</h1>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] mt-1 opacity-70" style={{ color: themeColor }}>{user?.schoolName || 'ESP DAKAR'}</p>
          </div>
        </div>

        <div className="px-6 py-2 flex-1 overflow-y-auto custom-scrollbar">
          <NavLink to="/profile" className={({ isActive }) => `flex items-center gap-4 mb-10 p-5 rounded-[2.2rem] transition-all border-2 ${isActive ? 'bg-gray-50/50 border-gray-200 dark:bg-gray-800/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-transparent shadow-sm'}`}>
             <UserAvatar name={user?.name || "U"} color={themeColor} className="w-12 h-12" textClassName="text-xl" />
             <div className="flex-1 min-w-0">
               <p className="text-sm font-black truncate text-gray-900 dark:text-white italic">{user?.name.split(' ')[0]}</p>
               <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest mt-0.5">{user?.className}</p>
             </div>
          </NavLink>

          <nav className="space-y-1.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `flex items-center gap-4 px-6 py-4 text-xs font-black uppercase tracking-widest rounded-2xl transition-all group
                  ${isActive ? 'text-white shadow-xl italic' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/20'}`}
                style={({ isActive }) => isActive ? { backgroundColor: themeColor } : {}}
              >
                <item.icon size={20} className="group-hover:rotate-12 transition-transform" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="p-6">
          <button 
            onClick={handleLogout} 
            className="flex items-center gap-3 w-full px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-red-400 hover:text-white hover:bg-red-500 dark:hover:bg-red-900 rounded-2xl transition-all italic active:scale-95 border border-red-50 dark:border-red-900/30"
          >
            <LogOut size={18} /> Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex-1 md:ml-72 flex flex-col h-screen overflow-hidden">
        <header className="h-24 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-8 z-20 sticky top-0">
          <div className="flex items-center gap-6 flex-1 max-w-2xl">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-3 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all active:scale-90">
              <Menu size={24} />
            </button>
            
            <div className="relative flex-1 group hidden sm:block" ref={searchRef}>
              <div className="relative">
                <Search className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${isSearchOpen ? 'text-primary-500' : 'text-gray-400'}`} size={20} />
                <input 
                  type="text" placeholder="Trouver un cours, un examen..." value={searchQuery}
                  onFocus={() => { setIsSearchOpen(true); prefetchSearchData(); }}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-14 pr-12 py-3.5 bg-gray-50 dark:bg-gray-800/50 border-none rounded-2xl text-sm font-bold italic outline-none focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/10 transition-all duration-300"
                />
              </div>

              {isSearchOpen && (searchQuery.length >= 2) && (
                <div className="absolute top-full left-0 right-0 mt-4 bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-premium border border-gray-100 dark:border-gray-800 z-[100] overflow-hidden animate-in slide-in-from-top-2">
                  <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-6 space-y-6">
                    {Object.values(searchResults).every((arr: any) => arr.length === 0) ? (
                      <div className="py-12 text-center opacity-30 italic font-black text-[10px] uppercase">Rien trouvé</div>
                    ) : (
                      <>
                        {searchResults.announcements.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="px-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Annonces</h4>
                            {searchResults.announcements.map(ann => (
                              <button key={ann.id} onClick={() => { setIsSearchOpen(false); navigate('/announcements'); }} className="w-full text-left p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all group">
                                <p className="text-sm font-black text-gray-900 dark:text-white italic group-hover:text-primary-500">{ann.title}</p>
                                <p className="text-[10px] text-gray-400 line-clamp-1 mt-1">{ann.content}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4" ref={notifRef}>
             <div className="relative">
               <button onClick={() => setNotifOpen(!isNotifOpen)} className={`p-3 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all active:scale-90 ${isNotifOpen ? 'bg-gray-50 dark:bg-gray-800 shadow-inner' : ''}`}>
                 <Bell size={24} style={isNotifOpen ? { color: themeColor } : {}} />
                 {unreadCount > 0 && (
                   <span className="absolute top-2 right-2 w-3.5 h-3.5 bg-red-500 rounded-full ring-4 ring-white dark:ring-gray-900 animate-pulse border border-white"></span>
                 )}
               </button>

               {isNotifOpen && (
                 <div className="absolute top-full right-0 mt-4 w-80 bg-white dark:bg-gray-900 rounded-[3rem] shadow-premium border border-gray-100 dark:border-gray-800 z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-8 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                      <div>
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Notifications</h4>
                        <p className="text-sm font-black italic mt-1">{unreadCount} non lues</p>
                      </div>
                      {unreadCount > 0 && (
                        <button onClick={markAllAsRead} className="p-3 bg-white dark:bg-gray-700 text-primary-500 hover:bg-primary-500 hover:text-white rounded-2xl shadow-sm transition-all active:scale-90" title="Tout marquer comme lu">
                          <CheckCheck size={20} />
                        </button>
                      )}
                    </div>
                    
                    {/* Invitation aux notifications Push */}
                    {permission !== 'granted' && (
                      <div className="mx-4 mt-4 p-5 bg-primary-50/50 dark:bg-primary-900/10 border border-primary-100/50 rounded-2xl flex items-center gap-4 group animate-pulse-subtle">
                         <div className="p-2.5 bg-white dark:bg-gray-800 rounded-xl shadow-sm text-primary-500">
                           <BellRing size={18} />
                         </div>
                         <div className="flex-1 min-w-0">
                           <p className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest">Alertes Bureau</p>
                           <button onClick={requestPermission} className="text-[9px] font-bold text-primary-600 uppercase mt-0.5 hover:underline">Activer maintenant</button>
                         </div>
                      </div>
                    )}

                    <div className="max-h-[50vh] overflow-y-auto custom-scrollbar p-3 space-y-2">
                      {notifications.length > 0 ? notifications.map(notif => (
                        <div key={notif.id} className={`p-5 rounded-[2rem] flex gap-4 transition-all relative group ${notif.isRead ? 'opacity-50 grayscale' : 'bg-primary-50/30 dark:bg-primary-900/10'}`}>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                            notif.type === 'alert' ? 'bg-rose-100 text-rose-500' : 'bg-primary-100 text-primary-500'
                          }`}>
                            <Bell size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-black text-gray-900 dark:text-white leading-tight italic">{notif.title}</p>
                            <p className="text-[10px] text-gray-500 line-clamp-2 mt-1 italic">{notif.message}</p>
                            <p className="text-[8px] font-black text-gray-400 uppercase mt-2 tracking-widest">{new Date(notif.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                          </div>
                          {!notif.isRead && (
                            <button onClick={() => markAsRead(notif.id)} className="p-2 text-primary-500 hover:scale-125 transition-transform absolute top-4 right-4">
                              <Check size={14} />
                            </button>
                          )}
                        </div>
                      )) : (
                        <div className="py-20 text-center opacity-30 grayscale italic text-[10px] font-black uppercase">Flux vide</div>
                      )}
                    </div>
                    <div className="p-5 border-t border-gray-50 dark:border-gray-800 bg-gray-50/20">
                      <button onClick={clearNotifications} className="w-full py-4 text-[9px] font-black text-gray-400 uppercase tracking-[0.3em] hover:text-red-500 transition-colors italic">Vider l'historique</button>
                    </div>
                 </div>
               )}
             </div>

             <button onClick={toggleTheme} className="p-3 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all active:scale-90">
               {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
             </button>

             <button 
                onClick={handleLogout} 
                className="p-3 text-red-400 hover:text-white hover:bg-red-500 dark:hover:bg-red-900 rounded-2xl transition-all active:scale-90 border border-transparent hover:border-red-200 dark:hover:border-red-800"
                title="Déconnexion sécurisée"
              >
               <LogOut size={24} />
             </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 sm:p-12 pb-32 bg-gray-50/50 dark:bg-gray-950 custom-scrollbar animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
