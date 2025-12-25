
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import { 
  Users, BookOpen, UserPlus, Search, Loader2, School, 
  Plus, Trash2, LayoutDashboard, Shield, 
  Ban, CheckCircle, PenSquare, Activity, Copy, Save, AlertCircle, Info, Filter, GraduationCap, Sparkles, Wand2, FileUp, CheckCircle2, AlertTriangle, Zap, Palette,
  Check, Eye, EyeOff, ClipboardCheck, FileDown, Download, Mail
} from 'lucide-react';
import { UserRole, ClassGroup, ActivityLog, User } from '../types';
import Modal from '../components/Modal';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

type TabType = 'dashboard' | 'users' | 'classes' | 'logs';

const THEME_COLORS = [
  { name: 'Bleu ESP', color: '#0ea5e9' },
  { name: 'Émeraude', color: '#10b981' },
  { name: 'Indigo', color: '#6366f1' },
  { name: 'Rose', color: '#f43f5e' },
  { name: 'Ambre', color: '#f59e0b' },
  { name: 'Violet', color: '#8b5cf6' },
  { name: 'Graphite', color: '#475569' },
  { name: 'Cerise', color: '#e11d48' },
];

export default function AdminPanel() {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  const [users, setUsers] = useState<User[]>([]);
  const [classesList, setClassesList] = useState<ClassGroup[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCreatedInfo, setShowCreatedInfo] = useState(false);
  
  const [newUser, setNewUser] = useState({ fullName: '', email: '', password: 'passer25', role: UserRole.STUDENT, className: '', schoolName: 'ESP Dakar' });
  const [showPass, setShowPass] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [classFormData, setClassFormData] = useState({ id: '', name: '', email: '', color: '#0ea5e9' });
  const [isEditClassMode, setIsEditClassMode] = useState(false);

  useEffect(() => {
    if (user?.role === UserRole.ADMIN) {
      fetchGlobalData();
    }
  }, [user]);

  const fetchGlobalData = async () => {
    setLoading(true);
    try {
        const [usersData, classesData, logsData] = await Promise.all([
            API.auth.getUsers(),
            API.classes.list(),
            API.logs.list()
        ]);
        setUsers(usersData);
        setClassesList(classesData);
        setLogs(logsData);
    } catch(e: any) {
        addNotification({ title: 'Erreur', message: e?.message || "Chargement échoué", type: 'alert' });
    } finally {
        setLoading(false);
    }
  };

  const downloadCSV = useCallback((data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${String(row[header] || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }, []);

  const handleExportData = async (type: 'users' | 'classes' | 'logs') => {
    setExporting(type);
    try {
      let dataToExport: any[] = [];
      let filename = "";
      if (type === 'users') {
        dataToExport = users.map(u => ({ Nom: u.name, Email: u.email, Role: u.role, Classe: u.className }));
        filename = "utilisateurs";
      } else if (type === 'classes') {
        dataToExport = classesList.map(c => ({ Nom: c.name, Email: c.email, Effectif: c.studentCount }));
        filename = "classes";
      } else {
        dataToExport = logs.map(l => ({ Date: l.timestamp, Acteur: l.actor, Action: l.action }));
        filename = "audit";
      }
      downloadCSV(dataToExport, filename);
      addNotification({ title: 'Export réussi', message: 'Fichier généré.', type: 'success' });
    } catch (e) { addNotification({ title: 'Erreur Export', message: 'Échec génération.', type: 'alert' }); } finally { setExporting(null); }
  };

  const dashboardStats = useMemo(() => {
    const rolesCount = { [UserRole.ADMIN]: 0, [UserRole.DELEGATE]: 0, [UserRole.STUDENT]: 0 };
    users.forEach(u => { if (rolesCount[u.role] !== undefined) rolesCount[u.role]++; });
    return {
        usersCount: users.length,
        classesCount: classesList.length,
        rolesData: [
            { name: 'Étudiants', value: rolesCount[UserRole.STUDENT], color: '#3B82F6' },
            { name: 'Délégués', value: rolesCount[UserRole.DELEGATE], color: '#10B981' },
            { name: 'Admins', value: rolesCount[UserRole.ADMIN], color: '#8B5CF6' },
        ],
        recentLogs: logs.slice(0, 10)
    };
  }, [users, classesList, logs]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await API.auth.createUser({
        name: newUser.fullName, email: newUser.email.trim().toLowerCase(), role: newUser.role,
        password: newUser.password, className: newUser.className, schoolName: newUser.schoolName
      });
      await fetchGlobalData();
      setShowCreatedInfo(true);
      addNotification({ title: 'Compte créé', message: 'Profil activé.', type: 'success' });
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: error?.message, type: 'alert' });
    } finally { setSubmitting(false); }
  };

  // FIX: Added missing function to handle opening user edit modal
  const handleOpenEditUser = (u: User) => {
    setEditingUser(u);
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSubmitting(true);
    try {
      await API.auth.updateProfile(editingUser.id, editingUser);
      await fetchGlobalData();
      setIsEditModalOpen(false);
      addNotification({ title: 'Succès', message: 'Profil mis à jour.', type: 'success' });
    } catch (error: any) { addNotification({ title: 'Erreur', message: error?.message, type: 'alert' }); } finally { setSubmitting(false); }
  };

  const handleDeleteUser = async (userId: string) => {
      if(!window.confirm("Supprimer ce compte ?")) return;
      try {
          await API.auth.deleteUser(userId);
          fetchGlobalData();
          addNotification({ title: 'Supprimé', message: 'Accès révoqué.', type: 'info' });
      } catch(e: any) { addNotification({ title: 'Erreur', message: e?.message, type: 'alert' }); }
  };

  // FIX: Added missing function to handle opening class modal for create/edit
  const openClassModal = (cls?: ClassGroup) => {
    if (cls) {
      setClassFormData({ id: cls.id, name: cls.name, email: cls.email || '', color: cls.color || '#0ea5e9' });
      setIsEditClassMode(true);
    } else {
      setClassFormData({ id: '', name: '', email: '', color: '#0ea5e9' });
      setIsEditClassMode(false);
    }
    setIsClassModalOpen(true);
  };

  const handleClassSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      try {
          if(isEditClassMode) await API.classes.update(classFormData.id, { name: classFormData.name, email: classFormData.email, color: classFormData.color });
          else await API.classes.create(classFormData.name, classFormData.email, classFormData.color);
          await fetchGlobalData();
          setIsClassModalOpen(false);
          addNotification({ title: 'Succès', message: 'Filière enregistrée.', type: 'success' });
      } catch (error: any) { addNotification({ title: 'Erreur', message: error?.message, type: 'alert' }); }
      finally { setSubmitting(false); }
  };

  const handleDeleteClass = async (id: string, name: string) => {
    if(!window.confirm(`Supprimer "${name}" ?`)) return;
    try {
        await API.classes.delete(id);
        await fetchGlobalData();
        addNotification({ title: 'Supprimé', message: 'Filière retirée.', type: 'info' });
    } catch (e: any) { addNotification({ title: 'Erreur', message: e?.message, type: 'alert' }); }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = (u.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);

  return (
    <div className="flex flex-col md:flex-row gap-8 h-[calc(100vh-140px)] animate-fade-in">
      <div className="w-full md:w-72 flex-shrink-0 space-y-4">
         <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-6 shadow-soft border border-gray-100 dark:border-gray-800">
             <div className="flex items-center gap-3 mb-8 px-2">
                <div className="p-3 bg-primary-500 text-white rounded-2xl shadow-lg">
                    <Shield size={20} />
                </div>
                <div>
                    <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider italic">Administration</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Contrôle UniConnect</p>
                </div>
             </div>
             <nav className="space-y-1">
                 {[
                   { id: 'dashboard', icon: LayoutDashboard, label: 'Tableau de Bord' },
                   { id: 'classes', icon: BookOpen, label: 'Classes & Filières' },
                   { id: 'users', icon: Users, label: 'Utilisateurs' },
                   { id: 'logs', icon: Activity, label: 'Journal d\'audit' }
                 ].map((tab) => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)} className={`w-full flex items-center gap-4 px-5 py-4 text-xs font-black rounded-2xl transition-all uppercase tracking-widest italic ${activeTab === tab.id ? 'bg-primary-500 text-white shadow-xl' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                        <tab.icon size={18} /> {tab.label}
                    </button>
                 ))}
             </nav>
         </div>
         <div className="bg-gradient-to-br from-gray-900 to-primary-900 rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-70">Extraction</p>
            <button onClick={() => handleExportData('users')} className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 mb-2">
                <FileDown size={14} /> CSV Utilisateurs
            </button>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-24">
         {activeTab === 'dashboard' && (
            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-soft border border-gray-100 dark:border-gray-800">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Inscrits</p>
                        <h3 className="text-5xl font-black text-gray-900 dark:text-white mt-4 italic tracking-tighter">{dashboardStats.usersCount}</h3>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-soft border border-gray-100 dark:border-gray-800">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Filières</p>
                        <h3 className="text-5xl font-black text-gray-900 dark:text-white mt-4 italic tracking-tighter">{dashboardStats.classesCount}</h3>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-900 p-10 rounded-[3rem] shadow-soft border border-gray-100 dark:border-gray-800">
                    <h3 className="text-sm font-black text-gray-800 dark:text-white mb-8 uppercase tracking-widest italic">Répartition</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart><Pie data={dashboardStats.rolesData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"><Cell fill="#3B82F6" /><Cell fill="#10B981" /><Cell fill="#8B5CF6" /></Pie><RechartsTooltip /><Legend /></PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
         )}
         
         {activeTab === 'users' && (
            <div className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-soft border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="p-8 border-b border-gray-50 dark:border-gray-800 flex flex-col lg:flex-row justify-between gap-4">
                    <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="px-5 py-3 bg-gray-50 dark:bg-gray-800 rounded-2xl text-sm font-bold outline-none" />
                    <button onClick={() => setIsUserModalOpen(true)} className="bg-primary-500 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-primary-500/20 active:scale-95 transition-all">Nouveau Compte</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800/50"><tr><th className="px-8 py-4">Nom</th><th className="px-8 py-4">Email</th><th className="px-8 py-4">Action</th></tr></thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                            {filteredUsers.map(u => (
                                <tr key={u.id} className="hover:bg-gray-50/20">
                                    <td className="px-8 py-4 font-black italic">{u.name} <span className="text-[8px] bg-gray-100 px-2 py-0.5 rounded ml-2">{u.role}</span></td>
                                    <td className="px-8 py-4 text-xs text-gray-400">{u.email}</td>
                                    <td className="px-8 py-4 flex gap-2"><button onClick={() => handleOpenEditUser(u)} className="p-2 text-primary-500"><PenSquare size={16}/></button><button onClick={() => handleDeleteUser(u.id)} className="p-2 text-red-500"><Trash2 size={16}/></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
         )}

         {activeTab === 'classes' && (
            <div className="space-y-6">
                <div className="flex justify-between items-center px-4">
                    <h3 className="text-xl font-black italic">Gestion des Filières</h3>
                    <button onClick={() => openClassModal()} className="bg-gray-900 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase">Ajouter</button>
                </div>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {classesList.map(cls => (
                        <div key={cls.id} className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border-2 shadow-soft flex flex-col" style={{ borderColor: cls.color }}>
                            <h4 className="text-xl font-black italic mb-2">{cls.name}</h4>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 mb-6 uppercase">
                                <Users size={12}/> {cls.studentCount || 0} inscrits
                            </div>
                            <div className="mt-auto flex gap-2">
                                {cls.email && (
                                  <a href={`mailto:${cls.email}`} className="flex-1 p-3 bg-primary-50 text-primary-600 rounded-xl text-center flex items-center justify-center" title="Contacter la classe"><Mail size={16}/></a>
                                )}
                                <button onClick={() => openClassModal(cls)} className="p-3 bg-gray-50 text-gray-400 rounded-xl"><PenSquare size={16}/></button>
                                <button onClick={() => handleDeleteClass(cls.id, cls.name)} className="p-3 bg-red-50 text-red-400 rounded-xl"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
         )}

         {activeTab === 'logs' && (
            <div className="bg-white dark:bg-gray-900 rounded-[3rem] p-4 space-y-2 border">
                {logs.map(log => (
                    <div key={log.id} className="flex items-center gap-4 p-4 border-b last:border-0"><div className="p-2 bg-blue-50 text-blue-500 rounded-xl"><Shield size={14}/></div><div className="flex-1"><p className="text-xs font-bold">{log.actor} <span className="text-gray-400">{log.action}</span> {log.target}</p><p className="text-[9px] text-gray-400 font-black uppercase mt-1">{new Date(log.timestamp).toLocaleString()}</p></div></div>
                ))}
            </div>
         )}
      </div>

      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title="Nouveau compte">
          <form onSubmit={handleCreateUser} className="space-y-4">
              <input required className="w-full p-4 rounded-2xl bg-gray-50 border-none font-bold text-sm" placeholder="Nom" value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} />
              <input required type="email" className="w-full p-4 rounded-2xl bg-gray-50 border-none font-bold text-sm" placeholder="Email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                  <select className="p-4 rounded-2xl bg-gray-50 border-none font-black text-[10px] uppercase" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}><option value={UserRole.STUDENT}>Étudiant</option><option value={UserRole.DELEGATE}>Délégué</option><option value={UserRole.ADMIN}>Admin</option></select>
                  <select className="p-4 rounded-2xl bg-gray-50 border-none font-black text-[10px] uppercase" value={newUser.className} onChange={e => setNewUser({...newUser, className: e.target.value})}><option value="">Classe...</option>{classesList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
              </div>
              <button disabled={submitting} type="submit" className="w-full bg-primary-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[11px] shadow-lg shadow-primary-500/20">Créer</button>
          </form>
      </Modal>

      <Modal isOpen={isClassModalOpen} onClose={() => setIsClassModalOpen(false)} title="Filière">
         <form onSubmit={handleClassSubmit} className="space-y-4">
            <input required className="w-full p-4 rounded-2xl bg-gray-50 border-none font-bold text-sm" placeholder="Nom" value={classFormData.name} onChange={e => setClassFormData({...classFormData, name: e.target.value})} />
            <input type="email" className="w-full p-4 rounded-2xl bg-gray-50 border-none font-bold text-sm" placeholder="Email Contact" value={classFormData.email} onChange={e => setClassFormData({...classFormData, email: e.target.value})} />
            <div className="grid grid-cols-4 gap-2">
                {THEME_COLORS.map(c => <button key={c.color} type="button" onClick={() => setClassFormData({...classFormData, color: c.color})} className={`h-10 rounded-xl ${classFormData.color === c.color ? 'ring-2 ring-black scale-110' : ''}`} style={{ backgroundColor: c.color }} />)}
            </div>
            <button disabled={submitting} type="submit" className="w-full bg-primary-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest">Valider</button>
         </form>
      </Modal>
    </div>
  );
}
