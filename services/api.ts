
import { supabase } from './supabaseClient';
import { User, Announcement, Exam, MeetLink, Poll, ClassGroup, ActivityLog, AppNotification, UserRole, ScheduleFile } from '../types';

/**
 * handleAPIError
 * Centralise la gestion des erreurs.
 */
const handleAPIError = (error: any, fallback: string) => {
  if (!error) return;
  if (error.code === 'PGRST116') return;
  
  console.error(`[UniConnect API Error] ${fallback}:`, JSON.stringify(error, null, 2));
  
  let message = fallback;
  if (typeof error === 'string') message = error;
  else if (error && typeof error === 'object') {
    if (error.code === '23505') message = "Action déjà effectuée (doublon).";
    else message = error.message || error.error_description || `${fallback} (Erreur ${error.code || 'Inconnue'})`;
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
  isActive: dbProfile.is_active,
  themeColor: dbProfile.theme_color
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
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
      if (error) handleAPIError(error, "Identifiants invalides");
      const { data: profile, error: pError } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
      if (pError || !profile) throw new Error("Profil étudiant introuvable.");
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
      if (updates.themeColor !== undefined) dbUpdates.theme_color = updates.themeColor;
      
      const { data, error } = await supabase.from('profiles').update(dbUpdates).eq('id', id).select().maybeSingle();
      if (error || !data) handleAPIError(error, "Mise à jour du profil échouée");
      return mapProfile(data);
    },
    getUsers: async (): Promise<User[]> => {
      const { data, error } = await supabase.from('profiles').select('*').order('name');
      if (error) handleAPIError(error, "Échec du chargement des utilisateurs");
      return (data || []).map(mapProfile);
    },
    createUser: async (userData: { name: string, email: string, role: UserRole, className: string, schoolName?: string }) => {
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: 'passer25',
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
      return { ...userData, id: data.user?.id, isActive: true } as User;
    },
    toggleUserStatus: async (userId: string) => {
      const { data: profile } = await supabase.from('profiles').select('is_active').eq('id', userId).maybeSingle();
      const { error } = await supabase.from('profiles').update({ is_active: !profile?.is_active }).eq('id', userId);
      if (error) handleAPIError(error, "Action impossible");
    },
    deleteUser: async (userId: string) => {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) handleAPIError(error, "Suppression impossible");
    },
    updatePassword: async (userId: string, pass: string) => {
      const { error } = await supabase.auth.updateUser({ password: pass });
      if (error) handleAPIError(error, "Échec de modification du mot de passe");
    }
  },
  storage: {
    upload: async (bucket: string, file: File): Promise<string> => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data, error } = await supabase.storage.from(bucket).upload(filePath, file);
      if (error) handleAPIError(error, "Erreur lors du chargement du fichier sur Supabase");

      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return publicUrl;
    }
  },
  favorites: {
    toggle: async (contentId: string, contentType: 'announcement' | 'schedule') => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      
      const { data: existing } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('content_id', contentId)
        .eq('content_type', contentType)
        .maybeSingle();

      if (existing) {
        await supabase.from('favorites').delete().eq('id', existing.id);
        return false;
      } else {
        await supabase.from('favorites').insert({
          user_id: session.user.id,
          content_id: contentId,
          content_type: contentType
        });
        return true;
      }
    },
    list: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return [];
      const { data, error } = await supabase.from('favorites').select('*').eq('user_id', session.user.id);
      if (error) return [];
      return data;
    }
  },
  interactions: {
    incrementShare: async (table: 'announcements' | 'exams' | 'polls', id: string) => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        
        await supabase.from('interactions').insert({
          user_id: session.user.id,
          content_id: id,
          content_type: table.slice(0, -1),
          action_type: 'share'
        });

        await supabase.rpc('increment_share_count', { target_table: table, target_id: id });
      } catch (e) {
        console.warn("Share count update failed silently", e);
      }
    }
  },
  announcements: {
    list: async (page: number, size: number): Promise<Announcement[]> => {
      const { data, error } = await supabase.from('announcements').select('*').order('date', { ascending: false }).range(page * size, (page + 1) * size - 1);
      if (error) handleAPIError(error, "Erreur de flux");
      return (data || []).map(a => ({ ...a, className: a.classname }));
    },
    create: async (ann: any) => {
      const profile = await API.auth.getSession();
      if (!profile) throw new Error("Non authentifié");
      const { error, data } = await supabase.from('announcements').insert({ 
        user_id: profile.id,
        title: ann.title, 
        content: ann.content, 
        priority: ann.priority, 
        classname: ann.className || 'Général', 
        author: profile?.name || 'Système', 
        links: ann.links || [], 
        attachments: ann.attachments || [], 
        date: new Date().toISOString() 
      }).select().single();
      
      if (error) handleAPIError(error, "Publication échouée");

      await API.notifications.add({
        title: `Nouvelle Annonce: ${ann.title}`,
        message: ann.content.substring(0, 100) + '...',
        type: ann.priority === 'urgent' ? 'alert' : 'info',
        targetClass: ann.className || 'Général',
        link: '/announcements'
      });
      return data;
    },
    update: async (id: string, ann: any) => {
      const { error } = await supabase.from('announcements').update({ 
        title: ann.title, 
        content: ann.content, 
        priority: ann.priority, 
        classname: ann.className, 
        links: ann.links || [], 
        attachments: ann.attachments || [] 
      }).eq('id', id);
      if (error) handleAPIError(error, "Mise à jour échouée");
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) handleAPIError(error, "Suppression échouée");
    },
    subscribe: (callback: () => void) => {
      return supabase.channel('ann_db_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, callback).subscribe();
    }
  },
  exams: {
    list: async (): Promise<Exam[]> => {
      const { data, error } = await supabase.from('exams').select('*').order('date', { ascending: true });
      if (error) handleAPIError(error, "Erreur calendrier");
      return (data || []).map(e => ({ ...e, className: e.classname }));
    },
    create: async (exam: any) => {
      const profile = await API.auth.getSession();
      if (!profile) throw new Error("Non authentifié");
      const { error } = await supabase.from('exams').insert({ 
        user_id: profile.id,
        subject: exam.subject, 
        date: exam.date, 
        duration: exam.duration, 
        room: exam.room, 
        notes: exam.notes, 
        classname: exam.className 
      });
      if (error) handleAPIError(error, "Action impossible");

      await API.notifications.add({
        title: `Examen programmé: ${exam.subject}`,
        message: `Épreuve prévue le ${new Date(exam.date).toLocaleDateString()} en salle ${exam.room}.`,
        type: 'warning',
        targetClass: exam.className || 'Général',
        link: '/exams'
      });
    },
    update: async (id: string, exam: any) => {
      const { error } = await supabase.from('exams').update({ subject: exam.subject, date: exam.date, duration: exam.duration, room: exam.room, notes: exam.notes }).eq('id', id);
      if (error) handleAPIError(error, "Action impossible");
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('exams').delete().eq('id', id);
      if (error) handleAPIError(error, "Action impossible");
    }
  },
  notifications: {
    list: async (): Promise<AppNotification[]> => {
      const { data, error } = await supabase.from('notifications').select('*').order('timestamp', { ascending: false });
      if (error) return [];
      return (data || []).map(n => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        timestamp: n.timestamp,
        isRead: n.is_read,
        link: n.link
      }));
    },
    add: async (notif: any) => {
      await supabase.from('notifications').insert({
        title: notif.title,
        message: notif.message,
        type: notif.type,
        link: notif.link,
        target_role: notif.targetRole,
        target_class: notif.targetClass,
        target_user_id: notif.targetUserId
      });
    },
    markRead: async (id: string) => {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    },
    markAllRead: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from('notifications').update({ is_read: true }).eq('target_user_id', session.user.id);
      }
    },
    clear: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from('notifications').delete().eq('target_user_id', session.user.id);
      }
    },
    subscribe: (userId: string, callback: (payload: any) => void) => {
      return supabase.channel(`notif-${userId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, callback).subscribe();
    }
  },
  schedules: {
    list: async (): Promise<ScheduleFile[]> => {
      const { data, error } = await supabase.from('schedules').select('*').order('upload_date', { ascending: false });
      if (error) return [];
      return (data || []).map(s => ({
        id: s.id,
        user_id: s.user_id,
        version: s.version,
        uploadDate: s.upload_date,
        url: s.url,
        className: s.classname,
        category: s.category
      }));
    },
    create: async (sch: any) => {
      const { error } = await supabase.from('schedules').insert({
        version: sch.version,
        url: sch.url,
        classname: sch.className,
        category: sch.category,
        user_id: (await supabase.auth.getSession()).data.session?.user.id
      });
      if (error) handleAPIError(error, "Échec archivage");
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('schedules').delete().eq('id', id);
      if (error) handleAPIError(error, "Action impossible");
    }
  },
  polls: {
    list: async (): Promise<Poll[]> => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user.id;

      const { data: polls, error } = await supabase.from('polls').select(`
        *,
        poll_options (*),
        poll_votes!left (id, option_id, user_id)
      `).order('created_at', { ascending: false });

      if (error) return [];

      return polls.map((p: any) => {
        const userVote = userId ? p.poll_votes.find((v: any) => v.user_id === userId) : null;
        const totalVotes = p.poll_options.reduce((acc: number, opt: any) => acc + (opt.votes || 0), 0);

        return {
          id: p.id,
          user_id: p.user_id,
          question: p.question,
          className: p.classname,
          isActive: p.is_active,
          createdAt: p.created_at,
          totalVotes: totalVotes,
          hasVoted: !!userVote,
          userVoteOptionId: userVote?.option_id,
          options: p.poll_options.map((o: any) => ({
            id: o.id,
            label: o.label,
            votes: o.votes || 0
          }))
        };
      });
    },
    create: async (poll: any) => {
      const { data: newPoll, error: pError } = await supabase.from('polls').insert({
        question: poll.question,
        classname: poll.className || 'Général',
        user_id: (await supabase.auth.getSession()).data.session?.user.id
      }).select().single();

      if (pError) throw pError;

      const optionsToInsert = poll.options.map((opt: any) => ({
        poll_id: newPoll.id,
        label: opt.label,
        votes: 0
      }));

      const { error: oError } = await supabase.from('poll_options').insert(optionsToInsert);
      if (oError) throw oError;

      await API.notifications.add({
        title: "Nouveau Sondage",
        message: poll.question,
        type: 'info',
        targetClass: poll.className || 'Général',
        link: '/polls'
      });
    },
    vote: async (pollId: string, optionId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Veuillez vous reconnecter.");

      // Vérification atomique
      const { data: existing } = await supabase
        .from('poll_votes')
        .select('id')
        .eq('poll_id', pollId)
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (existing) {
        throw new Error("Vous avez déjà voté pour ce scrutin.");
      }

      const { error } = await supabase.from('poll_votes').insert({
        poll_id: pollId,
        option_id: optionId,
        user_id: session.user.id
      });

      if (error) {
        handleAPIError(error, "Vote impossible");
        return;
      }
      
      await supabase.rpc('increment_option_vote', { opt_id: optionId });
    },
    update: async (id: string, updates: any) => {
      const dbUpdates: any = {};
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
      const { error } = await supabase.from('polls').update(dbUpdates).eq('id', id);
      if (error) handleAPIError(error, "Mise à jour échouée");
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('polls').delete().eq('id', id);
      if (error) handleAPIError(error, "Suppression impossible");
    },
    subscribe: (callback: () => void) => {
      return supabase.channel('polls_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, callback).subscribe();
    }
  },
  classes: {
    list: async (): Promise<ClassGroup[]> => {
      const { data, error } = await supabase.from('classes').select('*').order('name');
      if (error) return [];
      return data.map(c => ({ id: c.id, name: c.name, email: c.email, studentCount: c.student_count }));
    },
    create: async (name: string, email: string) => {
      await supabase.from('classes').insert({ name, email });
    },
    update: async (id: string, updates: any) => {
      await supabase.from('classes').update(updates).eq('id', id);
    },
    delete: async (id: string) => {
      await supabase.from('classes').delete().eq('id', id);
    }
  },
  logs: {
    list: async (): Promise<ActivityLog[]> => {
      const { data, error } = await supabase.from('activity_logs').select('*').order('timestamp', { ascending: false }).limit(50);
      if (error) return [];
      return data;
    }
  },
  meet: {
    list: async (): Promise<MeetLink[]> => {
      const { data, error } = await supabase.from('meet_links').select('*').order('time', { ascending: true });
      if (error) return [];
      return data.map(m => ({
        id: m.id,
        user_id: m.user_id,
        title: m.title,
        platform: m.platform,
        url: m.url,
        time: m.time,
        className: m.classname
      }));
    },
    create: async (meet: any) => {
      await supabase.from('meet_links').insert({
        title: meet.title,
        platform: meet.platform,
        url: meet.url,
        time: meet.time,
        classname: meet.className,
        user_id: (await supabase.auth.getSession()).data.session?.user.id
      });
    },
    update: async (id: string, meet: any) => {
      await supabase.from('meet_links').update({
        title: meet.title,
        platform: meet.platform,
        url: meet.url,
        time: meet.time,
        classname: meet.className
      }).eq('id', id);
    },
    delete: async (id: string) => {
      await supabase.from('meet_links').delete().eq('id', id);
    }
  },
  settings: {
    getAI: async () => {
      const { data, error } = await supabase.from('app_settings').select('*').eq('key', 'ai_assistant').maybeSingle();
      if (error || !data) return { isActive: true, tone: 'friendly', verbosity: 'medium', customInstructions: '' };
      return data.value;
    },
    updateAI: async (value: any) => {
      await supabase.from('app_settings').upsert({ key: 'ai_assistant', value }, { onConflict: 'key' });
    }
  }
};
