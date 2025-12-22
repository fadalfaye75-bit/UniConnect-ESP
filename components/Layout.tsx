
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Megaphone, Calendar, GraduationCap, Video, 
  BarChart2, Search, LogOut, Menu, X, Moon, Sun, 
  ShieldCheck, UserCircle, Bell, Check, Trash2, Info, AlertTriangle, Settings, Loader2, ArrowRight, Filter, CalendarDays, Clock, CheckCircle2, MessageSquare
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';

const COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 
  'bg-amber-500', 'bg-rose-500', 'bg-indigo-500',
  'bg-cyan-500', 'bg-orange-500'
];

export const UserAvatar = ({ name, className = "w-10 h-10", textClassName = "text-xs" }: { name: string, className?: string, textClassName?: string }) => {
  const initials = useMemo(() => {
    if (!name) return "?";
    const parts = name.split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }, [name]);

  const color = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return COLORS[Math.abs(hash) % COLORS.length];
  }, [name]);

  return (
    <div className={`${className} ${color} rounded-full flex items-center justify-center text-white font-black shadow-lg border-2 border-white dark:border-gray-800 shrink-0`}>
      <span className={textClassName}>{initials}</span>
    </div>
  );
};

export default function Layout() {
  const { user, logout, toggleTheme, isDarkMode } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } = useNotification();
  
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isNotifOpen, setNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const location = useLocation();
  const navigate = useNavigate();
  const notifRef = useRef<HTMLDivElement>(null);

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
    setNotifOpen(false);
  }, [location]);

  const navItems = useMemo(() => {
    const items = [
      { to: '/', icon: LayoutDashboard, label: 'Tableau de Bord', end: true },
      { to: '/announcements', icon: Megaphone, label: 'Annonces' },
      { to: '/schedule', icon: Calendar, label: 'Emploi du Temps' },
      { to: '/exams', icon: GraduationCap, label: 'Examens' },
      { to: '/meet', icon: Video, label: 'Visioconférence' },
      { to: '/polls', icon: BarChart2, label: 'Consultations' },
      { to: '/profile', icon: UserCircle, label: 'Mon Profil' },
    ];
    if (user?.role === 'ADMIN') items.push({ to: '/admin', icon: ShieldCheck, label: 'Administration' } as any);
    return items;
  }, [user?.role]);

  const handleLogout = async () => {
    if (window.confirm("Se déconnecter de la plateforme ?")) {
      await logout();
      navigate('/login');
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'alert': return <AlertTriangle size={16} className="text-red-500" />;
      case 'success': return <CheckCircle2 size={16} className="text-emerald-500" />;
      case 'warning': return <AlertTriangle size={16} className="text-orange-500" />;
      default: return <Info size={16} className="text-blue-500" />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 transition-colors font-sans overflow-hidden">
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-gray-900/60 md:hidden backdrop-blur-sm transition-opacity duration-300" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} shadow-2xl md:shadow-none flex flex-col`}>
        <div className="flex items-center justify-between p-6 h-20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center text-primary-500 bg-primary-50 dark:bg-primary-900/30 rounded-xl">
               < GraduationCap size={24} />
            </div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tighter uppercase italic">UniConnect</h1>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="px-4 py-2 flex-1 overflow-y-auto custom-scrollbar">
          <NavLink 
            to="/profile" 
            className={({ isActive }) => `flex items-center gap-4 mb-10 p-4 rounded-2xl transition-all group border ${isActive ? 'bg-primary-50/80 border-primary-100 dark:bg-primary-900/20 dark:border-primary-800/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-transparent'}`}
          >
             <UserAvatar name={user?.name || "U"} className="w-16 h-16" textClassName="text-xl" />
             <div className="flex-1 min-w-0">
               <p className="text-sm font-black truncate text-gray-900 dark:text-white leading-tight">{user?.name.split(' ')[0]}</p>
               <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate font-black uppercase tracking-widest mt-0.5">{user?.role === 'ADMIN' ? 'Admin' : user?.className}</p>
             </div>
          </NavLink>

          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `flex items-center gap-3 px-4 py-3.5 text-sm font-bold rounded-xl transition-all duration-200 group
                  ${isActive 
                    ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary-600 dark:hover:text-primary-400'
                  }`}
              >
                <item.icon size={20} className="transition-transform group-hover:scale-110" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="p-4 m-4 border-t border-gray-100 dark:border-gray-800">
          <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 text-sm font-bold text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-xl transition-all">
            <LogOut size={20} />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden">
        <header className="h-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-6 z-20 sticky top-0 transition-all">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
            <Menu size={24} />
          </button>
          <div className="hidden md:flex flex-1 max-w-md">
             <div onClick={() => setSearchOpen(true)} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700 transition-all cursor-text group">
               <Search size={18} className="group-hover:text-primary-500 transition-colors" />
               <span className="font-medium">Rechercher...</span>
             </div>
          </div>
          <div className="flex items-center gap-4 relative" ref={notifRef}>
             <button 
                onClick={() => setNotifOpen(!isNotifOpen)} 
                className={`p-2.5 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl relative transition-all active:scale-95 ${isNotifOpen ? 'bg-gray-100 dark:bg-gray-800 ring-2 ring-primary-100 dark:ring-primary-900/30' : ''}`}
              >
               <Bell size={22} />
               {unreadCount > 0 && (
                 <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-black rounded-full ring-2 ring-white dark:ring-gray-900 flex items-center justify-center animate-in zoom-in-50 duration-300">
                   {unreadCount}
                 </span>
               )}
             </button>

             {/* Notifications Popover */}
             {isNotifOpen && (
               <div className="absolute top-full right-0 mt-3 w-80 sm:w-96 bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-premium border border-gray-100 dark:border-gray-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                 <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/30">
                    <div>
                      <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest italic leading-none">Centre de Notifications</h3>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mt-1 tracking-tighter">{unreadCount} nouveaux messages</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={markAllAsRead} className="p-2 text-gray-400 hover:text-primary-500 transition-colors" title="Tout marquer comme lu">
                        <CheckCircle2 size={18} />
                      </button>
                      <button onClick={clearNotifications} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Tout effacer">
                        <Trash2 size={18} />
                      </button>
                    </div>
                 </div>
                 
                 <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                    {notifications.length > 0 ? (
                      <div className="divide-y divide-gray-50 dark:divide-gray-800">
                        {notifications.map((notif) => (
                          <div 
                            key={notif.id} 
                            onClick={() => {
                              markAsRead(notif.id);
                              if (notif.link) navigate(notif.link);
                            }}
                            className={`p-5 flex gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer relative group ${!notif.isRead ? 'bg-primary-50/10 dark:bg-primary-900/5' : ''}`}
                          >
                            {!notif.isRead && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500"></div>}
                            <div className={`p-3 rounded-2xl shrink-0 h-fit ${
                              notif.type === 'alert' ? 'bg-red-50 dark:bg-red-900/20' : 
                              notif.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-primary-50 dark:bg-primary-900/20'
                            }`}>
                              {getNotifIcon(notif.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                               <div className="flex justify-between items-start gap-2">
                                  <h4 className={`text-xs font-black italic tracking-tight leading-tight mb-1 ${!notif.isRead ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                                    {notif.title}
                                  </h4>
                                  <span className="text-[8px] font-bold text-gray-300 uppercase whitespace-nowrap">{new Date(notif.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                               </div>
                               <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 italic font-medium opacity-80">{notif.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                           <MessageSquare size={24} className="text-gray-200" />
                        </div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Aucun message pour le moment</p>
                      </div>
                    )}
                 </div>

                 {notifications.length > 0 && (
                    <div className="p-4 bg-gray-50/50 dark:bg-gray-800/20 border-t border-gray-100 dark:border-gray-800">
                      <button 
                        onClick={() => { setNotifOpen(false); navigate('/profile'); }}
                        className="w-full py-2.5 text-[9px] font-black text-primary-500 uppercase tracking-[0.2em] hover:bg-white dark:hover:bg-gray-800 rounded-xl transition-all border border-primary-100 dark:border-primary-900/30"
                      >
                        Paramètres de notification
                      </button>
                    </div>
                 )}
               </div>
             )}

             <button onClick={toggleTheme} className="p-2.5 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all">
               {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
             </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-32 md:pb-8 bg-gray-50/50 dark:bg-gray-950 custom-scrollbar animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
