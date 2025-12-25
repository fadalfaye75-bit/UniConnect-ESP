
import { supabase } from './supabaseClient';
import { User, Announcement, Exam, MeetLink, Poll, ClassGroup, ActivityLog, AppNotification, UserRole, ScheduleFile, ScheduleSlot } from '../types';

const getErrorMessage = (error: any): string => {
  if (!error) return "";
  if (typeof error === 'string') return error;
  if (error.message && typeof error.message === 'string') return error.message;
  if (error.error_description) return error.error_description;
  return "Erreur inconnue";
};

const handleAPIError = (error: any, fallback: string) => {
  if (!error) return;
  const detailedMsg = getErrorMessage(error);
  console.error(`[JangHup API Error] ${fallback}:`, error);
  
  let message = fallback;
  if (error.code === '23505') message = "Cette donnée existe déjà.";
  else if (error.code === '42501') message = "Accès refusé. Permissions insuffisantes.";
  else if (detailedMsg.includes("New password should be different")) message = "Le nouveau mot de passe doit être différent.";
  else if (detailedMsg && detailedMsg !== "{}") message = `${fallback}: ${detailedMsg}`;
  
  throw new Error(message);
};

const mapProfile = (dbProfile: any): User => ({
  id: dbProfile.id,
  name: dbProfile.name || 'Utilisateur',
  email: dbProfile.email || '',
  role: (dbProfile.role as UserRole) || UserRole.STUDENT,
  className: dbProfile.classname || 'Général',
  avatar: dbProfile.avatar,
  schoolName: dbProfile.school_name,
  isActive: dbProfile.is_active ?? true,
  themeColor: dbProfile.theme_color
});

export const API = {
  auth: {
    canPost: (user: User | null): boolean => user?.role === UserRole.ADMIN || user?.role === UserRole.DELEGATE,
    canEdit: (user: User | null, item: any): boolean => {
      if (!user) return false;
      if (user.role === UserRole.ADMIN) return true;
      return user.role === UserRole.DELEGATE && item.user_id === user.id;
    },
    canDelete: (user: User | null): boolean => user?.role === UserRole.ADMIN,
    
    getSession: async (): Promise<User | null> => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return null;
        const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        if (error || !profile) return null;
        return mapProfile(profile);
      } catch (e) { return null; }
    },
    
    login: async (email: string, pass: string): Promise<User> => {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pass });
      if (error) handleAPIError(error, "Connexion échouée");
      if (!data?.user) throw new Error("Utilisateur introuvable");
      const { data: profile, error: pErr } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
      if (pErr || !profile) throw new Error("Profil non configuré");
      return mapProfile(profile);
    },

    getUsers: async (): Promise<User[]> => {
      const { data, error } = await supabase.from('profiles').select('*').order('name');
      if (error) handleAPIError(error, "Erreur liste utilisateurs");
      return (data || []).map(mapProfile);
    },

    createUser: async (userData: any) => {
      const { data, error } = await supabase.auth.signUp({
        email: userData.email.trim().toLowerCase(), 
        password: userData.password,
        options: { data: { name: userData.name, role: userData.role, className: userData.className, school_name: userData.schoolName } }
      });
      if (error) handleAPIError(error, "Création impossible");
      return data.user;
    },

    updateProfile: async (id: string, updates: Partial<User>) => {
      const dbUpdates: any = {};
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.role) dbUpdates.role = updates.role;
      if (updates.className) dbUpdates.classname = updates.className;
      if (updates.themeColor) dbUpdates.theme_color = updates.themeColor;
      if (updates.schoolName) dbUpdates.school_name = updates.schoolName;
      
      const { data, error } = await supabase.from('profiles').update(dbUpdates).eq('id', id).select().maybeSingle();
      if (error) handleAPIError(error, "Mise à jour profil échouée");
      return data ? mapProfile(data) : null;
    },

    updatePassword: async (userId: string, newPass: string) => {
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) handleAPIError(error, "Changement de mot de passe échoué");
    },

    deleteUser: async (userId: string) => {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) handleAPIError(error, "Suppression du profil échouée");
    }
  },

  announcements: {
    list: async (page: number, size: number): Promise<Announcement[]> => {
      const { data, error } = await supabase.from('announcements').select('*').order('date', { ascending: false }).range(page * size, (page + 1) * size - 1);
      if (error) handleAPIError(error, "Chargement annonces échoué");
      return (data || []).map(a => ({ ...a, className: a.classname }));
    },
    create: async (ann: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('name').eq('id', user?.id).single();
      const { error } = await supabase.from('announcements').insert({ 
        user_id: user?.id, title: ann.title, content: ann.content, priority: ann.priority, 
        classname: ann.className || 'Général', author: profile?.name || 'Admin', date: new Date().toISOString()
      });
      if (error) handleAPIError(error, "Publication échouée");
    },
    update: async (id: string, ann: any) => {
      const { error } = await supabase.from('announcements').update({ title: ann.title, content: ann.content, priority: ann.priority, classname: ann.className }).eq('id', id);
      if (error) handleAPIError(error, "Modification échouée");
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) handleAPIError(error, "Suppression échouée");
    },
    subscribe: (callback: () => void) => supabase.channel('ann_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, callback).subscribe()
  },

  exams: {
    list: async (): Promise<Exam[]> => {
      const { data, error } = await supabase.from('exams').select('*').order('date', { ascending: true });
      if (error) handleAPIError(error, "Chargement examens échoué");
      return (data || []).map(e => ({ ...e, className: e.classname }));
    },
    create: async (exam: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('exams').insert({ 
        user_id: user?.id, subject: exam.subject, date: exam.date, duration: exam.duration, 
        room: exam.room, notes: exam.notes, classname: exam.className 
      });
      if (error) handleAPIError(error, "Planification échouée");
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('exams').delete().eq('id', id);
      if (error) handleAPIError(error, "Suppression échouée");
    },
    update: async (id: string, exam: any) => {
      const { error } = await supabase.from('exams').update({ subject: exam.subject, date: exam.date, duration: exam.duration, room: exam.room, notes: exam.notes, classname: exam.className }).eq('id', id);
      if (error) handleAPIError(error, "Modification examen échouée");
    }
  },

  polls: {
    list: async (): Promise<Poll[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: polls, error } = await supabase.from('polls').select('*, poll_options (*), poll_votes (id, option_id, user_id)').order('created_at', { ascending: false });
      if (error) return [];
      return (polls || []).map((p: any) => {
        const userVote = user ? (p.poll_votes || []).find((v: any) => v.user_id === user.id) : null;
        return { 
          id: p.id, user_id: p.user_id, question: p.question, className: p.classname, isActive: p.is_active, createdAt: p.created_at, 
          startTime: p.start_time, endTime: p.end_time,
          totalVotes: (p.poll_options || []).reduce((acc: number, opt: any) => acc + (opt.votes || 0), 0), 
          hasVoted: !!userVote, userVoteOptionId: userVote?.option_id, 
          options: (p.poll_options || []).map((o: any) => ({ id: o.id, label: o.label, votes: o.votes || 0 })) 
        };
      });
    },
    vote: async (pollId: string, optionId: string) => {
      const { error } = await supabase.rpc('cast_poll_vote', { p_poll_id: pollId, p_option_id: optionId });
      if (error) handleAPIError(error, "Vote non enregistré");
    },
    create: async (poll: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: newPoll, error } = await supabase.from('polls').insert({ question: poll.question, classname: poll.className, user_id: user?.id, end_time: poll.endTime }).select().single();
      if (error) handleAPIError(error, "Sondage non créé");
      const opts = poll.options.map((opt: any) => ({ poll_id: newPoll.id, label: opt.label }));
      await supabase.from('poll_options').insert(opts);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('polls').delete().eq('id', id);
      if (error) handleAPIError(error, "Suppression sondage échouée");
    },
    update: async (id: string, updates: any) => {
      const { error } = await supabase.from('polls').update({ is_active: updates.isActive }).eq('id', id);
      if (error) handleAPIError(error, "Mise à jour statut échouée");
    },
    // Fix: Added subscribe method to handle real-time poll updates
    subscribe: (callback: () => void) => supabase.channel('poll_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, callback).subscribe()
  },

  classes: {
    list: async (): Promise<ClassGroup[]> => {
      const { data, error } = await supabase.from('classes').select('*').order('name');
      if (error) return [];
      return data.map(c => ({ id: c.id, name: c.name, email: c.email, studentCount: c.student_count, color: c.color }));
    },
    create: async (name: string, email: string, color: string) => {
      const { error } = await supabase.from('classes').insert({ name, email, color });
      if (error) handleAPIError(error, "Création classe échouée");
    },
    update: async (id: string, updates: any) => {
      const { error } = await supabase.from('classes').update(updates).eq('id', id);
      if (error) handleAPIError(error, "Modification classe échouée");
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) handleAPIError(error, "Suppression classe échouée");
    }
  },

  schedules: {
    list: async (): Promise<ScheduleFile[]> => {
      const { data, error } = await supabase.from('schedules').select('*').order('upload_date', { ascending: false });
      if (error) return [];
      return (data || []).map(s => ({ id: s.id, user_id: s.user_id, version: s.version, uploadDate: s.upload_date, url: s.url, className: s.classname, category: s.category }));
    },
    getSlots: async (className: string): Promise<ScheduleSlot[]> => {
      const { data, error } = await supabase.from('schedule_slots').select('*').or(`classname.eq.${className},classname.eq.Général`);
      if (error) return [];
      return data.map(s => ({ id: s.id, day: s.day, startTime: s.start_time, endTime: s.end_time, subject: s.subject, teacher: s.teacher, room: s.room, color: s.color }));
    },
    saveSlots: async (className: string, slots: ScheduleSlot[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('schedule_slots').delete().eq('classname', className);
      const toInsert = slots.map(s => ({ day: s.day, start_time: s.startTime, end_time: s.endTime, subject: s.subject, teacher: s.teacher, room: s.room, color: s.color, classname: className, user_id: user?.id }));
      const { error } = await supabase.from('schedule_slots').insert(toInsert);
      if (error) handleAPIError(error, "Publication échouée");
    },
    deleteFile: async (id: string) => {
      const { error } = await supabase.from('schedules').delete().eq('id', id);
      if (error) handleAPIError(error, "Suppression du document échouée");
    }
  },

  meet: {
    list: async (): Promise<MeetLink[]> => {
      const { data, error } = await supabase.from('meet_links').select('*').order('time', { ascending: true });
      if (error) return [];
      return data.map(m => ({ id: m.id, user_id: m.user_id, title: m.title, platform: m.platform, url: m.url, time: m.time, className: m.classname }));
    },
    create: async (meet: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error = null } = await supabase.from('meet_links').insert({ ...meet, user_id: user?.id, classname: meet.className });
      if (error) handleAPIError(error, "Création Meet échouée");
    },
    update: async (id: string, meet: any) => {
      const { error } = await supabase.from('meet_links').update({ title: meet.title, platform: meet.platform, url: meet.url, time: meet.time, classname: meet.className }).eq('id', id);
      if (error) handleAPIError(error, "Modification Meet échouée");
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('meet_links').delete().eq('id', id);
      if (error) handleAPIError(error, "Suppression Meet échouée");
    }
  },

  favorites: {
    toggle: async (contentId: string, contentType: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data: existing } = await supabase.from('favorites').select('id').eq('user_id', user.id).eq('content_id', contentId).eq('content_type', contentType).maybeSingle();
      if (existing) { await supabase.from('favorites').delete().eq('id', existing.id); return false; }
      else { await supabase.from('favorites').insert({ user_id: user.id, content_id: contentId, content_type: contentType }); return true; }
    },
    list: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from('favorites').select('*').eq('user_id', user.id);
      return data || [];
    }
  },

  interactions: {
    incrementShare: async (table: string, id: string) => { 
      try { await supabase.rpc('increment_share_count', { target_table: table, target_id: id }); } catch (e) {}
    }
  },

  logs: {
    list: async (): Promise<ActivityLog[]> => {
      const { data } = await supabase.from('activity_logs').select('*').order('timestamp', { ascending: false }).limit(50);
      return data || [];
    }
  },

  notifications: {
    list: async (): Promise<AppNotification[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from('notifications').select('*').eq('target_user_id', user?.id).order('timestamp', { ascending: false });
      if (error) return [];
      return (data || []).map(n => ({ id: n.id, title: n.title, message: n.message, type: n.type, timestamp: n.timestamp, isRead: n.is_read }));
    },
    add: async (notif: any) => { await supabase.from('notifications').insert(notif); },
    markRead: async (id: string) => { await supabase.from('notifications').update({ is_read: true }).eq('id', id); },
    markAllRead: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('notifications').update({ is_read: true }).eq('target_user_id', user?.id);
    },
    clear: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('notifications').delete().eq('target_user_id', user?.id);
    }
  },

  settings: {
    getAI: async () => {
      try {
        const { data } = await supabase.from('ai_settings').select('*').maybeSingle();
        return { isActive: data?.is_active ?? true, verbosity: data?.verbosity ?? 'medium', tone: data?.tone ?? 'balanced', customInstructions: data?.custom_instructions ?? "Assistant JangHup." };
      } catch (e) { return { isActive: true, verbosity: 'medium', tone: 'balanced', customInstructions: "Assistant JangHup." }; }
    }
  }
};
