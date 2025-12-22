
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { API } from '../services/api';
import { 
  Users, BookOpen, UserPlus, Search, Loader2, School, 
  Plus, Trash2, LayoutDashboard, Shield, 
  Ban, CheckCircle, PenSquare, Activity, Copy, Save, AlertCircle, Info, Filter, GraduationCap, Sparkles, Wand2, FileUp, CheckCircle2, AlertTriangle, Zap
} from 'lucide-react';
import { UserRole, ClassGroup, ActivityLog, User } from '../types';
import Modal from '../components/Modal';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

type TabType = 'dashboard' | 'users' | 'classes' | 'bulk' | 'logs';

interface BulkUser {
  name: string;
  email: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
}

export default function AdminPanel() {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  const [users, setUsers] = useState<User[]>([]);
  const [classesList, setClassesList] = useState<ClassGroup[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  
  // Modals
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [newUser, setNewUser] = useState({ fullName: '', email: '', role: UserRole.STUDENT, className: '', schoolName: 'ESP Dakar' });
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [classFormData, setClassFormData] = useState({ id: '', name: '', email: '' });
  const [isEditClassMode, setIsEditClassMode] = useState(false);

  // Bulk Import
  const [bulkInput, setBulkInput] = useState('');
  const [bulkUsers, setBulkUsers] = useState<BulkUser[]>([]);
  const [bulkTargetClass, setBulkTargetClass] = useState('');
  const [bulkIsProcessing, setBulkIsProcessing] = useState(false);

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

  const handleParseBulk = () => {
    const lines = bulkInput.split('\n').filter(line => line.trim().length > 0);
    const parsed: BulkUser[] = lines.map(line => {
        // Supporte "Nom;Email" ou "Nom Email"
        const parts = line.includes(';') ? line.split(';') : line.split(',');
        if (parts.length >= 2) {
            return { name: parts[0].trim(), email: parts[1].trim(), status: 'pending' };
        }
        return { name: line.trim(), email: '', status: 'error', error: 'Format invalide' };
    });
    setBulkUsers(parsed);
  };

  const handleTriggerBulkCreation = async () => {
    if (!bulkTargetClass) {
        addNotification({ title: 'Attention', message: 'Veuillez sélectionner une classe cible.', type: 'warning' });
        return;
    }
    
    setBulkIsProcessing(true);
    const updatedUsers = [...bulkUsers];

    for (let i = 0; i < updatedUsers.length; i++) {
        if (updatedUsers[i].status === 'error') continue;
        
        updatedUsers[i].status = 'processing';
        setBulkUsers([...updatedUsers]);

        try {
            await API.auth.createUser({
                name: updatedUsers[i].name,
                email: updatedUsers[i].email,
                role: UserRole.STUDENT,
                className: bulkTargetClass
            });
            updatedUsers[i].status = 'success';
        } catch (error: any) {
            updatedUsers[i].status = 'error';
            updatedUsers[i].error = error.message;
        }
        setBulkUsers([...updatedUsers]);
        // Petit délai pour l'effet visuel de cascade
        await new Promise(r => setTimeout(r, 400));
    }

    setBulkIsProcessing(false);
    addNotification({ title: 'Opération terminée', message: 'La création des comptes est achevée.', type: 'success' });
    fetchGlobalData();
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
        name: newUser.fullName, email: newUser.email, role: newUser.role,
        className: newUser.className, schoolName: newUser.schoolName
      });
      await fetchGlobalData();
      setIsUserModalOpen(false);
      setNewUser({ fullName: '', email: '', role: UserRole.STUDENT, className: '', schoolName: 'ESP Dakar' });
      addNotification({ title: 'Compte créé', message: 'Profil activé avec succès.', type: 'success' });
    } catch (error: any) {
      addNotification({ title: 'Erreur', message: error?.message || "Impossible de créer.", type: 'alert' });
    } finally { setSubmitting(false); }
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
      addNotification({ title: 'Erreur', message: error?.message || 'Échec.', type: 'alert' });
    } finally { setSubmitting(false); }
  };

  const handleCopyUserDetails = (u: User) => {
    const text = `UniConnect ESP Dakar\nNom: ${u.name}\nEmail: ${u.email}\nMot de passe: passer25\nRôle: ${u.role}\nClasse: ${u.className || 'N/A'}`;
    navigator.clipboard.writeText(text).then(() => {
      addNotification({ title: 'Copié', message: 'Coordonnées copiées.', type: 'success' });
    });
  };

  const handleToggleStatus = async (userId: string) => {
      if(!window.confirm("Changer le statut d'accès ?")) return;
      try {
          await API.auth.toggleUserStatus(userId);
          fetchGlobalData();
          addNotification({ title: 'Statut mis à jour', message: 'Succès.', type: 'info' });
      } catch(e: any) { addNotification({ title: 'Erreur', message: e?.message, type: 'alert' }); }
  };

  const handleDeleteUser = async (userId: string) => {
      if(!window.confirm("Supprimer définitivement ?")) return;
      try {
          await API.auth.deleteUser(userId);
          fetchGlobalData();
          addNotification({ title: 'Supprimé', message: 'Compte retiré.', type: 'info' });
      } catch(e: any) { addNotification({ title: 'Erreur', message: e?.message, type: 'alert' }); }
  };

  const handleDeleteClass = async (id: string, name: string) => {
      if(!window.confirm(`Supprimer la classe ${name} ?`)) return;
      try {
          await API.classes.delete(id);
          await fetchGlobalData();
          addNotification({ title: 'Supprimé', message: 'Classe retirée.', type: 'info' });
      } catch(e: any) { addNotification({ title: 'Erreur', message: e?.message, type: 'alert' }); }
  };

  const openClassModal = (cls?: ClassGroup) => {
      if(cls) {
          setClassFormData({ id: cls.id, name: cls.name, email: cls.email });
          setIsEditClassMode(true);
      } else {
          setClassFormData({ id: '', name: '', email: '' });
          setIsEditClassMode(false);
      }
      setIsClassModalOpen(true);
  };

  const handleClassSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      try {
          if(isEditClassMode) await API.classes.update(classFormData.id, { name: classFormData.name, email: classFormData.email });
          else await API.classes.create(classFormData.name, classFormData.email);
          await fetchGlobalData();
          setIsClassModalOpen(false);
          addNotification({ title: 'Succès', message: 'Classe enregistrée.', type: 'success' });
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
                   { id: 'bulk', icon: Zap, label: 'Importation Massive' },
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
            <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-70">Support Système</p>
            <h4 className="text-xl font-black italic tracking-tighter mb-4">Besoin d'aide technique ?</h4>
            <button className="w-full py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Consulter Docs</button>
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

                {activeTab === 'bulk' && (
                    <div className="space-y-8 animate-in slide-in-from-right-10 duration-500">
                        <div className="bg-white dark:bg-gray-900 rounded-[3rem] p-10 shadow-soft border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-4 bg-primary-500 text-white rounded-3xl shadow-xl shadow-primary-500/20">
                                    <Zap size={28} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter italic">Importation Massive</h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Déclenchez la création automatique de comptes</p>
                                </div>
                            </div>

                            <div className="grid lg:grid-cols-2 gap-10">
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Liste des utilisateurs (Format : Nom;Email)</label>
                                        <textarea 
                                            rows={10}
                                            value={bulkInput}
                                            onChange={(e) => setBulkInput(e.target.value)}
                                            placeholder="Moussa Ndiaye;moussa@esp.sn&#10;Awa Diop;awa@esp.sn"
                                            className="w-full p-6 bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[2rem] font-bold text-sm outline-none focus:border-primary-400 focus:bg-white transition-all italic"
                                        />
                                    </div>
                                    <div className="flex gap-4">
                                        <select 
                                            value={bulkTargetClass}
                                            onChange={(e) => setBulkTargetClass(e.target.value)}
                                            className="flex-1 px-6 py-4 bg-gray-100 dark:bg-gray-800 border-none rounded-2xl font-black text-xs uppercase tracking-widest outline-none"
                                        >
                                            <option value="">Sélectionner une classe</option>
                                            {classesList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                        </select>
                                        <button 
                                            onClick={handleParseBulk}
                                            className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all"
                                        >
                                            Analyser
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-[2.5rem] p-8 border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
                                    <div className="flex justify-between items-center mb-6">
                                        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Prévisualisation ({bulkUsers.length})</h4>
                                        {bulkUsers.length > 0 && !bulkIsProcessing && (
                                            <button 
                                                onClick={handleTriggerBulkCreation}
                                                className="flex items-center gap-2 px-6 py-2.5 bg-primary-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary-500/20 animate-pulse"
                                            >
                                                Lancer le Trigger <Zap size={14} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar max-h-[300px] pr-2">
                                        {bulkUsers.map((u, i) => (
                                            <div key={i} className={`flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-2xl border ${
                                                u.status === 'success' ? 'border-green-200 bg-green-50/50' : 
                                                u.status === 'error' ? 'border-red-200 bg-red-50/50' : 
                                                'border-gray-100 dark:border-gray-800'
                                            }`}>
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-black text-gray-900 dark:text-white truncate max-w-[150px]">{u.name || 'Inconnu'}</span>
                                                    <span className="text-[9px] font-bold text-gray-400 truncate max-w-[150px]">{u.email || 'Email manquant'}</span>
                                                </div>
                                                {/* Fix: Moved title attribute to parent div to avoid Lucide icon type error */}
                                                <div title={u.status === 'error' ? u.error : undefined}>
                                                    {u.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-gray-100"></div>}
                                                    {u.status === 'processing' && <Loader2 className="animate-spin text-primary-500" size={18} />}
                                                    {u.status === 'success' && <CheckCircle2 className="text-green-500" size={18} />}
                                                    {u.status === 'error' && <AlertTriangle className="text-red-500" size={18} />}
                                                </div>
                                            </div>
                                        ))}

                                        {bulkUsers.length === 0 && (
                                            <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-30">
                                                <FileUp size={48} className="mb-4" />
                                                <p className="text-[10px] font-black uppercase tracking-widest italic">En attente de données</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
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
                                <div key={cls.id} className="group p-8 bg-gray-50 dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 hover:border-primary-400 hover:bg-white transition-all relative overflow-hidden flex flex-col">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/5 -mr-12 -mt-12 rounded-full group-hover:scale-125 transition-transform"></div>
                                    <div className="p-3 bg-white dark:bg-gray-700 text-primary-500 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-600 self-start mb-6">
                                        <GraduationCap size={24} />
                                    </div>
                                    <span className="text-lg font-black text-gray-900 dark:text-white leading-tight italic mb-2">{cls.name}</span>
                                    <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-8">
                                        <Users size={12}/> {cls.studentCount || 0} Étudiants
                                    </div>
                                    <div className="mt-auto flex gap-2">
                                        <button onClick={() => openClassModal(cls)} className="flex-1 p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 text-gray-400 hover:text-primary-500 rounded-xl transition-all"><PenSquare size={16} className="mx-auto" /></button>
                                        <button onClick={() => handleDeleteClass(cls.id, cls.name)} className="p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 text-gray-400 hover:text-red-500 rounded-xl transition-all"><Trash2 size={16} className="mx-auto" /></button>
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

      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title="Nouveau compte">
         <form onSubmit={handleCreateUser} className="space-y-4">
            <input required className="w-full p-3.5 rounded-2xl border-none bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none" placeholder="Nom Complet" value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} />
            <input required type="email" className="w-full p-3.5 rounded-2xl border-none bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none" placeholder="Email Institutionnel (@esp.sn)" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
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
                
                <div className="flex gap-2">
                    <button type="button" onClick={() => handleCopyUserDetails(editingUser)} className="flex-1 bg-gray-100 hover:bg-gray-200 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"><Copy size={16}/> Copier accès</button>
                    <button type="button" onClick={() => handleToggleStatus(editingUser.id)} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${editingUser.isActive ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                        {editingUser.isActive ? <Ban size={16}/> : <CheckCircle size={16}/>} {editingUser.isActive ? 'Bloquer' : 'Activer'}
                    </button>
                </div>
                <button disabled={submitting} type="submit" className="w-full bg-primary-500 hover:bg-primary-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary-500/20 flex items-center justify-center gap-2 uppercase tracking-widest transition-all">
                    {submitting ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Enregistrer les modifications
                </button>
            </form>
         )}
      </Modal>

      <Modal isOpen={isClassModalOpen} onClose={() => setIsClassModalOpen(false)} title={isEditClassMode ? "Modifier la classe" : "Ajouter une classe"}>
         <form onSubmit={handleClassSubmit} className="space-y-4">
            <input required className="w-full p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none" placeholder="Nom de la classe (ex: Licence 3 INFO)" value={classFormData.name} onChange={e => setClassFormData({...classFormData, name: e.target.value})} />
            <input type="email" className="w-full p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800 font-bold text-sm outline-none" placeholder="Email de contact (optionnel)" value={classFormData.email} onChange={e => setClassFormData({...classFormData, email: e.target.value})} />
            <button disabled={submitting} type="submit" className="w-full bg-primary-500 hover:bg-primary-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary-500/20 uppercase tracking-widest transition-all">
                {submitting ? <Loader2 className="animate-spin" size={18}/> : (isEditClassMode ? "Enregistrer" : "Créer la section")}
            </button>
         </form>
      </Modal>
    </div>
  );
}
