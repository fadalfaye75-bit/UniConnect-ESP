
// Complete implementation of the API service using Supabase client.
import { supabase } from './supabaseClient';
import { User, Announcement, Exam, MeetLink, Poll, ClassGroup, ActivityLog, AppNotification, UserRole, ScheduleFile } from '../types';

const handleAPIError = (error: any, fallback: string) => {
  if (!error) return;
  if (error.code === 'PGRST116') return;
  console.error(`[UniConnect API Error] ${fallback}:`, JSON.stringify(error, null, 2));
  
  let message = fallback;
  if (typeof error === 'string') message = error;
  else if (error && typeof error === 'object') {
    if (error.message) message = error.message;
    else if (error.error_description) message = error.error_description;
    else if (error.code) message = `${fallback} (Erreur ${error.code})`;
  }
  throw new Error(message);
};

const mapProfile = (dbProfile: any): User => ({
  id: dbProfile.id,
  name: dbProfile.name,
  email: dbProfile.email,
  role: dbProfile.role as UserRole,
  className: dbProfile.classname,
  avatar: dbProfile.avatar,
  schoolName: dbProfile.school_name,
  isActive: dbProfile.is_active
});

export const API = {
  auth: {
    getSession: async (): Promise<User | null> => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return null;
        const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        if (error || !profile) return null;
        return mapProfile(profile);
      } catch (e) {
        return null;
      }
    },
    login: async (email: string, pass: string): Promise<User> => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) handleAPIError(error, "Erreur d'authentification");
      const { data: profile, error: pError } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
      if (pError || !profile) throw new Error("Profil utilisateur introuvable.");
      return mapProfile(profile);
    },
    updateProfile: async (id: string, updates: Partial<User>): Promise<User> => {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.className !== undefined) dbUpdates.classname = updates.className;
      if (updates.schoolName !== undefined) dbUpdates.school_name = updates.schoolName;
      if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
      if (updates.role !== undefined) dbUpdates.role = updates.role;
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
      const { data, error } = await supabase.from('profiles').update(dbUpdates).eq('id', id).select().maybeSingle();
      if (error || !data) handleAPIError(error, "Mise à jour échouée");
      return mapProfile(data);
    },
    getUsers: async (): Promise<User[]> => {
      const { data, error } = await supabase.from('profiles').select('*').order('name');
      if (error) handleAPIError(error, "Chargement des utilisateurs échoué");
      return (data || []).map(mapProfile);
    },
    createUser: async (userData: { name: string, email: string, role: UserRole, className: string, schoolName?: string }) => {
      // NOTE: Le trigger SQL handle_new_user s'occupe de créer le profil automatiquement.
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: 'passer25', // Mot de passe par défaut pour tous les nouveaux comptes universitaires
        options: { 
          data: { 
            name: userData.name, 
            role: userData.role, 
            className: userData.className, 
            school_name: userData.schoolName || 'ESP Dakar' 
          } 
        }
      });
      if (error) handleAPIError(error, "Création du compte impossible");
      if (!data.user) throw new Error("Utilisateur non créé.");
      
      // On retourne le profil tel qu'il devrait être (le trigger SQL fera le reste en DB)
      return {
        id: data.user.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        className: userData.className,
        isActive: true
      } as User;
    },
    toggleUserStatus: async (userId: string) => {
      const { data: profile } = await supabase.from('profiles').select('is_active').eq('id', userId).maybeSingle();
      const { error } = await supabase.from('profiles').update({ is_active: !profile?.is_active }).eq('id', userId);
      if (error) handleAPIError(error, "Modification du statut impossible");
    },
    deleteUser: async (userId: string) => {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) handleAPIError(error, "Suppression échouée");
    },
    updatePassword: async (userId: string, pass: string) => {
      const { error } = await supabase.auth.updateUser({ password: pass });
      if (error) handleAPIError(error, "Mise à jour du mot de passe impossible");
    }
  },
  announcements: {
    list: async (page: number, size: number): Promise<Announcement[]> => {
      const { data, error } = await supabase.from('announcements').select('*').order('date', { ascending: false }).range(page * size, (page + 1) * size - 1);
      if (error) handleAPIError(error, "Chargement impossible");
      return (data || []).map(a => ({ ...a, className: a.classname }));
    },
    create: async (ann: any) => {
      const profile = await API.auth.getSession();
      const { error } = await supabase.from('announcements').insert({ title: ann.title, content: ann.content, priority: ann.priority, classname: ann.className, author: profile?.name || 'Admin', links: ann.links || [], attachments: ann.attachments || [], date: new Date().toISOString() });
      if (error) handleAPIError(error, "Publication impossible");
    },
    update: async (id: string, ann: any) => {
      const { error } = await supabase.from('announcements').update({ title: ann.title, content: ann.content, priority: ann.priority, classname: ann.className, links: ann.links || [], attachments: ann.attachments || [] }).eq('id', id);
      if (error) handleAPIError(error, "Mise à jour impossible");
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) handleAPIError(error, "Suppression impossible");
    },
    subscribe: (callback: () => void) => {
      return supabase.channel('ann_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, callback).subscribe();
    }
  },
  exams: {
    list: async (): Promise<Exam[]> => {
      const { data, error } = await supabase.from('exams').select('*').order('date', { ascending: true });
      if (error) handleAPIError(error, "Chargement impossible");
      return (data || []).map(e => ({ ...e, className: e.classname }));
    },
    create: async (exam: any) => {
      const { error } = await supabase.from('exams').insert({ subject: exam.subject, date: exam.date, duration: exam.duration, room: exam.room, notes: exam.notes, classname: exam.className });
      if (error) handleAPIError(error, "Ajout impossible");
    },
    update: async (id: string, exam: any) => {
      const { error } = await supabase.from('exams').update({ subject: exam.subject, date: exam.date, duration: exam.duration, room: exam.room, notes: exam.notes }).eq('id', id);
      if (error) handleAPIError(error, "Mise à jour impossible");
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('exams').delete().eq('id', id);
      if (error) handleAPIError(error, "Suppression impossible");
    }
  },
  meet: {
    list: async (): Promise<MeetLink[]> => {
      const { data, error } = await supabase.from('meet_links').select('*');
      if (error) handleAPIError(error, "Chargement impossible");
      return (data || []).map(m => ({ ...m, className: m.classname }));
    },
    create: async (meet: any) => {
      const { error } = await supabase.from('meet_links').insert({ title: meet.title, platform: meet.platform, url: meet.url, time: meet.time, classname: meet.className });
      if (error) handleAPIError(error, "Ajout impossible");
    },
    update: async (id: string, meet: any) => {
      const { error } = await supabase.from('meet_links').update({ title: meet.title, platform: meet.platform, url: meet.url, time: meet.time }).eq('id', id);
      if (error) handleAPIError(error, "Mise à jour impossible");
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('meet_links').delete().eq('id', id);
      if (error) handleAPIError(error, "Suppression impossible");
    }
  },
  polls: {
    list: async (): Promise<Poll[]> => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      const { data: polls, error } = await supabase.from('polls').select('*, options:poll_options(*)').order('created_at', { ascending: false });
      if (error) handleAPIError(error, "Chargement impossible");
      const { data: votes } = user ? await supabase.from('poll_votes').select('*').eq('user_id', user.id) : { data: [] };
      return (polls || []).map(p => ({
        id: p.id, question: p.question, className: p.classname, isActive: p.is_active, startTime: p.start_time, endTime: p.end_time, createdAt: p.created_at, options: p.options || [],
        hasVoted: votes?.some(v => v.poll_id === p.id) || false, userVoteOptionId: votes?.find(v => v.poll_id === p.id)?.option_id,
        totalVotes: (p.options || []).reduce((acc: number, o: any) => acc + (o.votes || 0), 0)
      })) as Poll[];
    },
    vote: async (pollId: string, optionId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error("Veuillez vous connecter.");
      const { error } = await supabase.from('poll_votes').upsert({ poll_id: pollId, user_id: user.id, option_id: optionId }, { onConflict: 'poll_id,user_id' });
      if (error) handleAPIError(error, "Vote impossible");
    },
    create: async (poll: any) => {
      const { data, error } = await supabase.from('polls').insert({ question: poll.question, classname: poll.className, start_time: poll.startTime || null, end_time: poll.endTime || null, is_active: true }).select().maybeSingle();
      if (error || !data) handleAPIError(error, "Sondage impossible");
      const options = poll.options.map((o: any) => ({ poll_id: data.id, label: o.label, votes: 0 }));
      const { error: optError } = await supabase.from('poll_options').insert(options);
      if (optError) handleAPIError(optError, "Options impossibles");
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('polls').delete().eq('id', id);
      if (error) handleAPIError(error, "Suppression impossible");
    },
    subscribe: (callback: () => void) => {
      return supabase.channel('polls_chan').on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, callback).on('postgres_changes', { event: '*', schema: 'public', table: 'poll_options' }, callback).on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, callback).subscribe();
    }
  },
  classes: {
    list: async (): Promise<ClassGroup[]> => {
      const { data, error } = await supabase.from('classes').select('*');
      if (error) handleAPIError(error, "Chargement impossible");
      return (data || []).map(c => ({ id: c.id, name: c.name, email: c.email, studentCount: c.student_count }));
    },
    create: async (name: string, email: string) => {
      const { error } = await supabase.from('classes').insert({ name, email });
      if (error) handleAPIError(error, "Création impossible");
    },
    update: async (id: string, updates: any) => {
      const { error } = await supabase.from('classes').update(updates).eq('id', id);
      if (error) handleAPIError(error, "Mise à jour impossible");
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) handleAPIError(error, "Suppression impossible");
    }
  },
  schedules: {
    list: async (): Promise<ScheduleFile[]> => {
      const { data, error } = await supabase.from('schedules').select('*').order('upload_date', { ascending: false });
      if (error) handleAPIError(error, "Chargement impossible");
      return (data || []).map(s => ({ id: s.id, version: s.version, url: s.url, className: s.classname, uploadDate: s.upload_date, category: s.category || 'Planning' }));
    },
    create: async (sch: any) => {
      const { error } = await supabase.from('schedules').insert({ version: sch.version, url: sch.url, classname: sch.className, category: sch.category, upload_date: new Date().toISOString() });
      if (error) handleAPIError(error, "Publication impossible");
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('schedules').delete().eq('id', id);
      if (error) handleAPIError(error, "Suppression impossible");
    }
  },
  notifications: {
    list: async (): Promise<AppNotification[]> => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      const profile = await API.auth.getSession();
      const { data, error } = await supabase.from('notifications').select('*').or(`target_user_id.eq.${user?.id},target_role.eq.${profile?.role},target_class.eq.${profile?.className}`).order('timestamp', { ascending: false });
      if (error) handleAPIError(error, "Chargement impossible");
      return (data || []).map(n => ({ id: n.id, title: n.title, message: n.message, type: n.type, timestamp: n.timestamp, isRead: n.is_read }));
    },
    add: async (notif: any) => {
      const { error } = await supabase.from('notifications').insert({ ...notif, timestamp: new Date().toISOString(), is_read: false });
      if (error) handleAPIError(error, "Ajout impossible");
    },
    markRead: async (id: string) => {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      if (error) handleAPIError(error, "Action impossible");
    },
    markAllRead: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('target_user_id', user.id);
      if (error) handleAPIError(error, "Action impossible");
    },
    clear: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;
      const { error } = await supabase.from('notifications').delete().eq('target_user_id', user.id);
      if (error) handleAPIError(error, "Action impossible");
    },
    subscribe: (userId: string, callback: () => void) => {
      return supabase.channel(`notifs_${userId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, callback).subscribe();
    }
  },
  settings: {
    getAI: async () => {
      const { data } = await supabase.from('settings').select('*').eq('key', 'ai_assistant').maybeSingle();
      return data?.value || { isActive: true, verbosity: 'medium', tone: 'friendly', customInstructions: "Assistant UniConnect ESP." };
    }
  },
  logs: {
    list: async (): Promise<ActivityLog[]> => {
      const { data, error } = await supabase.from('activity_logs').select('*').order('timestamp', { ascending: false });
      if (error) handleAPIError(error, "Logs impossibles");
      return data as ActivityLog[];
    }
  }
};
