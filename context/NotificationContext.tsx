
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { AppNotification, Exam, UserRole } from '../types';
import { useAuth } from './AuthContext';
import { API } from '../services/api';
import { supabase } from '../services/supabaseClient';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  permission: NotificationPermission;
  requestPermission: () => Promise<void>;
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const notifiedItemsRef = useRef<Set<string>>(new Set());

  const triggerBrowserNotification = useCallback((title: string, message: string, options?: NotificationOptions) => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const n = new Notification(title, {
          body: message,
          icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
          badge: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
          ...options
        });
        
        n.onclick = () => {
          window.focus();
          n.close();
        };
      } catch (e) {
        console.warn("Failed to trigger native notification", e);
      }
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const allNotifs = await API.notifications.list();
      setNotifications(allNotifs);
    } catch (e) {
      console.warn("Notification fetch failed");
    }
  }, [user]);

  const checkImminentExams = useCallback(async () => {
    if (!user) return;
    try {
      const exams = await API.exams.list();
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      const imminentExams = exams.filter(exam => {
        const examDate = new Date(exam.date);
        const targetClass = exam.className || 'Général';
        const isForUser = targetClass === 'Général' || targetClass === user.className;
        
        return isForUser && examDate > now && examDate <= tomorrow && !notifiedItemsRef.current.has(`exam-${exam.id}`);
      });

      imminentExams.forEach(exam => {
        const timeStr = new Date(exam.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        triggerBrowserNotification(
          "📚 Examen Imminent !",
          `Rappel : Ton épreuve de ${exam.subject} commence demain à ${timeStr}.`,
          { tag: `exam-${exam.id}` }
        );
        notifiedItemsRef.current.add(`exam-${exam.id}`);
      });
    } catch (e) {
      console.warn("Imminent exams check failed");
    }
  }, [user, triggerBrowserNotification]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      notifiedItemsRef.current = new Set();
      return;
    }

    fetchNotifications();
    checkImminentExams();

    // 1. Écouteur pour les alertes personnelles
    const personalSub = supabase
      .channel(`personal-notifs-${user.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `target_user_id=eq.${user.id}`
      }, (payload) => {
        fetchNotifications();
        triggerBrowserNotification(payload.new.title, payload.new.message);
      })
      .subscribe();

    // 2. Écouteur global pour les nouvelles annonces
    const announcementsSub = supabase
      .channel('global-announcements')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'announcements' 
      }, (payload) => {
        const ann = payload.new;
        const targetClass = ann.classname || 'Général';
        if (targetClass === 'Général' || targetClass === user.className) {
          triggerBrowserNotification(`📢 Nouvelle Annonce : ${ann.title}`, ann.content.substring(0, 100) + "...");
          fetchNotifications(); // Refresh list
        }
      })
      .subscribe();

    // 3. Écouteur global pour les nouveaux sondages
    const pollsSub = supabase
      .channel('global-polls')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'polls' 
      }, (payload) => {
        const poll = payload.new;
        const targetClass = poll.classname || 'Général';
        if (targetClass === 'Général' || targetClass === user.className) {
          triggerBrowserNotification(`🗳️ Nouveau Sondage : ${poll.question}`, "Votre avis compte ! Participez à la consultation.");
        }
      })
      .subscribe();

    const examInterval = setInterval(checkImminentExams, 3600000); // Check hourly

    return () => {
      personalSub.unsubscribe();
      announcementsSub.unsubscribe();
      pollsSub.unsubscribe();
      clearInterval(examInterval);
    };
  }, [user, fetchNotifications, triggerBrowserNotification, checkImminentExams]);

  const requestPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      triggerBrowserNotification("UniConnect ESP", "Génial ! Vous recevrez désormais les alertes en temps réel.");
    }
  };

  const addNotification = async (notif: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>) => {
    await API.notifications.add(notif);
  };

  const markAsRead = async (id: string) => {
    await API.notifications.markRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllAsRead = async () => {
    await API.notifications.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const clearNotifications = async () => {
    await API.notifications.clear();
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      permission,
      requestPermission,
      addNotification,
      markAsRead,
      markAllAsRead,
      clearNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within a NotificationProvider');
  return context;
};
