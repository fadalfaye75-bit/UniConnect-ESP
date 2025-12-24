
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import { 
  Users, BookOpen, UserPlus, Search, Loader2, School, 
  Plus, Trash2, LayoutDashboard, Shield, 
  Ban, CheckCircle, PenSquare, Activity, Copy, Save, AlertCircle, Info, Filter, GraduationCap, Sparkles, Wand2, FileUp, CheckCircle2, AlertTriangle, Zap, Palette,
  Check, Eye, EyeOff, ClipboardCheck, FileDown, Download
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

  // Helper pour l'exportation CSV
  const downloadCSV = useCallback((data: any[], filename: string) => {
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const val = row[header] === null || row[header] === undefined ? "" : row[header];
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleExportData = async (type: 'users' | 'classes' | 'logs') => {
    setExporting(type);
    try {
      let dataToExport: any[] = [];
      let filename = "";

      if (type === 'users') {
        dataToExport = users.map(u => ({
          Nom: u.name,
          Email: u.email,
          Role: u.role,
          Classe: u.className,
          Ecole: u.schoolName,
          Statut: u.isActive ? 'Actif' : 'Bloqué'
        }));
        filename = "utilisateurs_uniconnect";
      } else if (type === 'classes') {
        dataToExport = classesList.map(c => ({
          Nom: c.name,
          Email: c.email,
          Effectif: c.studentCount
        }));
        filename = "classes_uniconnect";
      } else {
        dataToExport = logs.map(l => ({
          Date: new Date(l.timestamp).toLocaleString(),
          Acteur: l.actor,
          Action: l.action,
          Cible: l.target
        }));
        filename = "activites_uniconnect";
      }

      downloadCSV(dataToExport, filename);
      addNotification({ title: 'Export réussi', message: 'Le fichier CSV est prêt.', type: 'success' });
    } catch (e) {
      addNotification({ title: 'Erreur Export', message: 'Impossible de générer le fichier.', type: 'alert' });
    } finally {
      setExporting(null);
    }
  };

  const dashboardStats = useMemo(() => {
    const rolesCount = { [UserRole.ADMIN]: 0, [UserRole.DELEGATE]: 0, [UserRole.STUDENT]: 0 };
    users.forEach(u => { 
        if (rolesCount[u.role] !== undefined) rolesCount[u.role]++; 
    });
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
    if (!newUser.fullName || !newUser.email) {
      addNotification({ title: 'Données manquantes', message: 'Remplissez tous les champs.', type: 'warning' });
      return;
    }
    setSubmitting(true);
    try {
      await API.auth.createUser({
        name: newUser.fullName, email: newUser.email.trim().toLowerCase(), role: newUser.role,
        password: newUser.password,
        className: newUser.className, schoolName: newUser.schoolName
      });
      await fetchGlobalData();
      setShowCreatedInfo(true);
      addNotification({ title: 'Compte créé', message: 'Profil activé avec succès.', type: 'success' });
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: error?.message || "Impossible de créer le compte.", type: 'alert' });
    } finally { setSubmitting(false); }
  };

  const handleCopyNewUserDetails = () => {
    const text = `UniConnect ESP Dakar\nNom: ${newUser.fullName}\nEmail: ${newUser.email}\nMot de passe: ${newUser.password}\nRôle: ${newUser.role}\nClasse: ${newUser.className || 'Général'}`;
    navigator.clipboard.writeText(text).then(() => {
      addNotification({ title: 'Accès Copiés', message: 'Les identifiants sont dans votre presse-papier.', type: 'success' });
    });
  };

  const closeUserModal = () => {
    setIsUserModalOpen(false);
    setShowCreatedInfo(false);
    setNewUser({ fullName: '', email: '', password: 'passer25', role: UserRole.STUDENT, className: '', schoolName: 'ESP Dakar' });
  };

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
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: error?.message || 'Échec de la mise à jour.', type: 'alert' });
    } finally { setSubmitting(false); }
  };

  const handleToggleStatus = async (userId: string) => {
      if(!window.confirm("Changer le statut d'accès de cet utilisateur ?")) return;
      try {
          await API.auth.toggleUserStatus(userId);
          fetchGlobalData();
          addNotification({ title: 'Statut mis à jour', message: 'Action effectuée avec succès.', type: 'info' });
      } catch(e: any) { addNotification({ title: 'Erreur', message: e?.message, type: 'alert' }); }
  };

  const handleDeleteUser = async (userId: string) => {
      if(!window.confirm("Supprimer définitivement ce compte ? Cette action est irréversible.")) return;
      try {
          await API.auth.deleteUser(userId);
          fetchGlobalData();
          addNotification({ title: 'Supprimé', message: 'Le compte a été retiré de la plateforme.', type: 'info' });
      } catch(e: any) { addNotification({ title: 'Erreur', message: e?.message, type: 'alert' }); }
  };

  const openClassModal = (cls?: ClassGroup) => {
      if(cls) {
          setClassFormData({ id: cls.id, name: cls.name, email: cls.email, color: cls.color || '#0ea5e9' });
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
          addNotification({ title: 'Succès', message: 'Filière enregistrée avec succès.', type: 'success' });
      } catch (error: any) { addNotification({ title: 'Erreur', message: error?.message, type: 'alert' }); }
      finally { setSubmitting(false); }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = (u.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);

  return (
    <div className="flex flex-col md:flex-row gap-8 h-[calc(100vh-140px)] animate-fade-in">
      <div className="w-full md:w-72 flex-shrink-0 space-y-4">
         <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-6 shadow-soft border border-gray-100 dark:border-gray-800">
             <div className="flex items-center gap-3 mb-8 px-2">
                <div className="p-3 bg-primary-500 text-white rounded-2xl shadow-lg shadow-primary-500/20">
                    <Shield size={20} />
                </div>
                <div>
                    <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider italic">Admin Panel</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Contrôle ESP</p>
                </div>
             </div>

             <nav className="space-y-1">
                 {[
                   { id: 'dashboard', icon: LayoutDashboard, label: 'Tableau de Bord' },
                   { id: 'classes', icon: BookOpen, label: 'Classes & Filières' },
                   { id: 'users', icon: Users, label: 'Utilisateurs' },
                   { id: 'logs', icon: Activity, label: 'Journal d\'audit' }
                 ].map((tab) => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)} 
                        className={`w-full flex items-center gap-4 px-5 py-4 text-xs font-black rounded-2xl transition-all uppercase tracking-widest italic ${
                            activeTab === tab.id 
                            ? 'bg-primary-500 text-white shadow-xl shadow-primary-500/20' 
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary-600'
                        }`}
                    >
                        <tab.icon size={18} /> {tab.label}
                    </button>
                 ))}
             </nav>
         </div>

         <div className="bg-gradient-to-br from-indigo-600 to-primary-700 rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden group">
            <Sparkles className="absolute -bottom-4 -right-4 w-24 h-24 opacity-10 group-hover:scale-125 transition-transform" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-70">Centre d'Exportation</p>
            <h4 className="text-lg font-black italic tracking-tighter mb-4">Extraire les données</h4>
            <div className="space-y-2">
              <button 
                onClick={() => handleExportData('users')}
                disabled={exporting === 'users'}
                className="w-full py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                {exporting === 'users' ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={14} />} Users CSV
              </button>
              <button 
                onClick={() => handleExportData('classes')}
                disabled={exporting === 'classes'}
                className="w-full py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                {exporting === 'classes' ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={14} />} Classes CSV
              </button>
            </div>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-24">
         {loading && !users.length ? (
            <div className="flex flex-col justify-center items-center h-64 gap-4">
                <Loader2 className="animate-spin text-primary-500" size={40} />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Synchronisation des données...</span>
            </div>
         ) : (
            <>
                {activeTab === 'dashboard' && (
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-soft border border-gray-100 dark:border-gray-800 group hover:border-primary-400 transition-all">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Utilisateurs inscrits</p>
                                <h3 className="text-5xl font-black text-gray-900 dark:text-white mt-4 italic tracking-tighter">{dashboardStats.usersCount}</h3>
                                <div className="mt-6 flex items-center gap-2 text-green-500 text-[10px] font-black uppercase">
                                    <CheckCircle2 size={14}/> Base de données à jour
                                </div>
                            </div>
                            <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-soft border border-gray-100 dark:border-gray-800 group hover:border-emerald-400 transition-all">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sections actives</p>
                                <h3 className="text-5xl font-black text-gray-900 dark:text-white mt-4 italic tracking-tighter">{dashboardStats.classesCount}</h3>
                                <div className="mt-6 flex items-center gap-2 text-primary-500 text-[10px] font-black uppercase">
                                    <GraduationCap size={14}/> Filières ESP Dakar
                                </div>
                            </div>
                        </div>
                        <div className="grid lg:grid-cols-2 gap-8">
                            <div className="bg-white dark:bg-gray-900 p-10 rounded-[3rem] shadow-soft border border-gray-100 dark:border-gray-800">
                                <h3 className="text-sm font-black text-gray-800 dark:text-white mb-8 flex items-center gap-3 uppercase tracking-widest italic">
                                    <Users size={20} className="text-primary-500" /> Répartition par Rôles
                                </h3>
                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie 
                                                data={dashboardStats.rolesData} 
                                                cx="50%" cy="50%" 
                                                innerRadius={70} 
                                                outerRadius={100} 
                                                paddingAngle={8} 
                                                dataKey="value" 
                                                stroke="none"
                                            >
                                                {dashboardStats.rolesData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                            </Pie>
                                            <RechartsTooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} />
                                            <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ paddingTop: '20px', fontWeight: 'bold', fontSize: '10px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-gray-900 p-10 rounded-[3rem] shadow-soft border border-gray-100 dark:border-gray-800 flex flex-col justify-center items-center text-center">
                               <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-3xl flex items-center justify-center text-gray-400 mb-6">
                                  <FileDown size={40} />
                               </div>
                               <h4 className="text-sm font-black uppercase tracking-widest italic mb-4">Rapports Complets</h4>
                               <p className="text-[10px] text-gray-400 font-bold uppercase mb-8">Téléchargez l'intégralité des données en un clic.</p>
                               <button 
                                 onClick={() => handleExportData('logs')} 
                                 disabled={exporting === 'logs'}
                                 className="px-10 py-4 bg-gray-900 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-3 active:scale-95 transition-all"
                               >
                                 {exporting === 'logs' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Journal d'Audit CSV
                               </button>
                            </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'users' && (
                    <div className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-soft border border-gray-100 dark:border-gray-800 overflow-hidden">
                        <div className="p-8 border-b border-gray-50 dark:border-gray-800 flex flex-col lg:flex-row justify-between items-center gap-6">
                            <div className="flex flex-col sm:flex-row gap-4 w-full lg:flex-1">
                                <div className="relative flex-1 group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                                    <input 
                                        type="text" placeholder="Nom, email..." value={searchTerm} 
                                        onChange={e => setSearchTerm(e.target.value)} 
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary-50 transition-all" 
                                    />
                                </div>
                                <select 
                                    value={roleFilter} onChange={e => setRoleFilter(e.target.value)} 
                                    className="px-6 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-xs font-black uppercase tracking-widest outline-none cursor-pointer"
                                >
                                    <option value="ALL">Tous les rôles</option>
                                    <option value={UserRole.STUDENT}>Étudiants</option>
                                    <option value={UserRole.DELEGATE}>Délégués</option>
                                    <option value={UserRole.ADMIN}>Admins</option>
                                </select>
                            </div>
                            <button onClick={() => setIsUserModalOpen(true)} className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary-500/20 active:scale-95 transition-all flex items-center gap-2">
                                <Plus size={18} /> Nouveau Compte
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead className="bg-gray-50 dark:bg-gray-800/50">
                                    <tr>
                                        <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Utilisateur</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Identifiant / Classe</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                    {filteredUsers.map(u => (
                                        <tr key={u.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-xl flex items-center justify-center font-black">
                                                        {u.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-gray-900 dark:text-white italic">{u.name}</p>
                                                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${u.role === UserRole.ADMIN ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                                            {u.role}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <p className="text-xs font-bold text-gray-500 truncate max-w-[150px]">{u.email}</p>
                                                <p className="text-[10px] font-black text-primary-500 uppercase mt-1 tracking-widest">{u.className || 'Non assigné'}</p>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => handleOpenEditUser(u)} className="p-2.5 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-xl transition-all"><PenSquare size={16} /></button>
                                                    <button onClick={() => handleDeleteUser(u.id)} className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'classes' && (
                    <div className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-soft border border-gray-100 dark:border-gray-800 p-10">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h3 className="text-xl font-black text-gray-900 dark:text-white italic tracking-tight">Classes & Filières</h3>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Organisation de l'établissement</p>
                            </div>
                            <button onClick={() => openClassModal()} className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary-500/20 active:scale-95 transition-all">
                                <Plus size={18} /> Ajouter une Filière
                            </button>
                        </div>
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {classesList.map(cls => (
                                <div key={cls.id} className="group p-8 bg-white dark:bg-gray-800 rounded-[2.5rem] border-2 shadow-soft hover:shadow-premium transition-all relative overflow-hidden flex flex-col" style={{ borderColor: cls.color || '#f3f4f6' }}>
                                    <div className="absolute top-0 right-0 w-24 h-24 -mr-12 -mt-12 rounded-full group-hover:scale-125 transition-transform opacity-10" style={{ backgroundColor: cls.color }}></div>
                                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-600 self-start mb-6" style={{ color: cls.color }}>
                                        <GraduationCap size={24} />
                                    </div>
                                    <span className="text-lg font-black text-gray-900 dark:text-white leading-tight italic mb-2">{cls.name}</span>
                                    <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-8">
                                        <Users size={12}/> {cls.studentCount || 0} Étudiants
                                    </div>
                                    <div className="mt-auto flex gap-2">
                                        <button onClick={() => openClassModal(cls)} className="flex-1 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 text-gray-400 hover:text-primary-500 rounded-xl transition-all"><PenSquare size={16} className="mx-auto" /></button>
                                        <button onClick={() => handleDeleteClass(cls.id, cls.name)} className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 text-gray-400 hover:text-red-500 rounded-xl transition-all"><Trash2 size={16} className="mx-auto" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'logs' && (
                    <div className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-soft border border-gray-100 dark:border-gray-800 overflow-hidden">
                        <div className="p-8 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between">
                            <h3 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-widest italic">Journal de Sécurité</h3>
                            <button onClick={fetchGlobalData} className="p-2 text-gray-400 hover:text-primary-500 transition-all"><Plus size={18} className="rotate-45" /></button>
                        </div>
                        <div className="p-4 space-y-2">
                            {logs.map(log => (
                                <div key={log.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-50 dark:border-gray-800 last:border-0">
                                    <div className={`p-2 rounded-xl ${log.type === 'security' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                                        <Shield size={14} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-gray-800 dark:text-white">{log.actor} <span className="text-gray-400 font-medium">{log.action}</span> {log.target}</p>
                                        <p className="text-[10px] text-gray-400 font-black uppercase mt-1 tracking-widest">{new Date(log.timestamp).toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </>
         )}
      </div>

      <Modal isOpen={isUserModalOpen} onClose={closeUserModal} title={showCreatedInfo ? "Compte créé avec succès" : "Nouveau compte"}>
         {!showCreatedInfo ? (
           <form onSubmit={handleCreateUser} className="space-y-4">
              <input required className="w-full p-3.5 rounded-2xl border-none bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none" placeholder="Nom Complet" value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} />
              <input required type="email" className="w-full p-3.5 rounded-2xl border-none bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none" placeholder="Email Institutionnel (@esp.sn)" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
              <div className="relative">
                <input required type={showPass ? "text" : "password"} className="w-full p-3.5 rounded-2xl border-none bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none pr-12" placeholder="Mot de passe par défaut" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <select className="p-3.5 rounded-2xl border-none bg-gray-50 dark:bg-gray-800 text-xs font-black uppercase outline-none" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}>
                      <option value={UserRole.STUDENT}>Étudiant</option>
                      <option value={UserRole.DELEGATE}>Délégué</option>
                      <option value={UserRole.ADMIN}>Admin</option>
                  </select>
                  <select className="p-3.5 rounded-2xl border-none bg-gray-50 dark:bg-gray-800 text-xs font-black uppercase outline-none" value={newUser.className} onChange={e => setNewUser({...newUser, className: e.target.value})}>
                      <option value="">Classe...</option>
                      {classesList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
              </div>
              <button disabled={submitting} type="submit" className="w-full bg-primary-500 hover:bg-primary-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary-500/20 uppercase tracking-widest text-[11px] transition-all active:scale-95">
                  {submitting ? <Loader2 className="animate-spin mx-auto" size={18}/> : "Déclencher l'inscription"}
              </button>
           </form>
         ) : (
           <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                 <CheckCircle2 size={32} />
              </div>
              <p className="text-sm font-bold text-gray-600 dark:text-gray-300">
                Le compte de <span className="text-primary-600">{newUser.fullName}</span> a été créé.
              </p>
              <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl text-left space-y-2 border border-dashed border-gray-200 dark:border-gray-700">
                 <p className="text-[10px] font-black uppercase text-gray-400">Identifiants de connexion :</p>
                 <p className="text-xs font-bold italic">Email: <span className="text-gray-900 dark:text-white">{newUser.email}</span></p>
                 <p className="text-xs font-bold italic">Pass: <span className="text-gray-900 dark:text-white">{newUser.password}</span></p>
              </div>
              <div className="flex gap-3">
                 <button onClick={handleCopyNewUserDetails} className="flex-1 bg-gray-900 text-white py-4 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-black transition-all">
                    <ClipboardCheck size={16}/> Copier les accès
                 </button>
                 <button onClick={closeUserModal} className="flex-1 bg-gray-100 text-gray-600 py-4 rounded-xl text-[10px] font-black uppercase hover:bg-gray-200 transition-all">
                    Terminer
                 </button>
              </div>
           </div>
         )}
      </Modal>

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Modifier profil">
         {editingUser && (
            <form onSubmit={handleUpdateUser} className="space-y-6">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-primary-50 rounded-3xl flex items-center justify-center text-2xl font-black text-primary-500 border border-primary-100">
                        {editingUser.name.charAt(0)}
                    </div>
                    <div>
                        <h4 className="font-black italic text-gray-900 dark:text-white leading-none">{editingUser.name}</h4>
                        <p className="text-xs text-gray-400 mt-2">{editingUser.email}</p>
                    </div>
                </div>
                
                <div className="space-y-4">
                    <input required className="w-full p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none" placeholder="Nom Complet" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} />
                    <div className="grid grid-cols-2 gap-4">
                        <select className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800 text-xs font-black uppercase outline-none" value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as UserRole})}>
                            <option value={UserRole.STUDENT}>Étudiant</option>
                            <option value={UserRole.DELEGATE}>Délégué</option>
                            <option value={UserRole.ADMIN}>Administrateur</option>
                        </select>
                        <select className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800 text-xs font-black uppercase outline-none" value={editingUser.className} onChange={e => setEditingUser({...editingUser, className: e.target.value})}>
                            <option value="">Classe...</option>
                            {classesList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                </div>
                
                <button disabled={submitting} type="submit" className="w-full bg-primary-500 hover:bg-primary-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary-500/20 flex items-center justify-center gap-2 uppercase tracking-widest transition-all">
                    {submitting ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Enregistrer les modifications
                </button>
            </form>
         )}
      </Modal>

      <Modal isOpen={isClassModalOpen} onClose={() => setIsClassModalOpen(false)} title={isEditClassMode ? "Modifier la classe" : "Ajouter une classe"}>
         <form onSubmit={handleClassSubmit} className="space-y-6">
            <div className="space-y-4">
              <input required className="w-full p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none" placeholder="Nom de la classe (ex: Licence 3 INFO)" value={classFormData.name} onChange={e => setClassFormData({...classFormData, name: e.target.value})} />
              <input type="email" className="w-full p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none" placeholder="Email de contact (optionnel)" value={classFormData.email} onChange={e => setClassFormData({...classFormData, email: e.target.value})} />
            </div>
            
            <div className="space-y-4">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                <Palette size={14} /> Couleur Officielle
              </label>
              <div className="grid grid-cols-4 gap-2">
                 {THEME_COLORS.map(c => (
                   <button 
                    key={c.color} 
                    type="button" 
                    onClick={() => setClassFormData({...classFormData, color: c.color})}
                    className={`h-10 rounded-xl transition-all flex items-center justify-center ${classFormData.color === c.color ? 'ring-2 ring-offset-2 ring-gray-900 scale-110' : 'hover:scale-105 opacity-70'}`}
                    style={{ backgroundColor: c.color }}
                   >
                     {classFormData.color === c.color && <Check size={16} className="text-white" />}
                   </button>
                 ))}
              </div>
            </div>

            <button disabled={submitting} type="submit" className="w-full bg-primary-500 hover:bg-primary-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary-500/20 uppercase tracking-widest transition-all">
                {submitting ? <Loader2 className="animate-spin" size={18}/> : (isEditClassMode ? "Enregistrer" : "Créer la section")}
            </button>
         </form>
      </Modal>
    </div>
  );
}
