
export enum UserRole {
  STUDENT = 'STUDENT',
  DELEGATE = 'DELEGATE',
  ADMIN = 'ADMIN'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  className: string; // e.g., "Licence 2 - Info"
  avatar?: string;
  schoolName?: string;
  isActive?: boolean; // New field for banning/disabling
}

export interface AISettings {
  tone: 'concise' | 'detailed' | 'academic' | 'friendly';
  verbosity: 'low' | 'medium' | 'high';
  customInstructions: string;
  isActive: boolean;
}

export type AnnouncementPriority = 'normal' | 'important' | 'urgent';

export interface ExternalLink {
  label: string;
  url: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  author: string;
  date: string;
  className: string;
  priority: AnnouncementPriority; // Remplacera isImportant pour le tri principal
  isImportant?: boolean; // Gardé pour rétrocompatibilité (calculé depuis priority)
  links?: ExternalLink[];
  attachments?: string[]; // URLs vers des fichiers
}

export interface Exam {
  id: string;
  subject: string;
  date: string; // ISO string
  duration: string;
  room: string;
  notes?: string;
  className: string;
  links?: ExternalLink[]; // New field for attachments/resources
}

export interface ScheduleFile {
  id: string;
  version: string;
  uploadDate: string;
  url: string;
  className: string;
}

export interface MeetLink {
  id: string;
  title: string;
  platform: 'Zoom' | 'Teams' | 'Google Meet' | 'Other';
  url: string;
  time: string;
  className: string;
}

export interface PollOption {
  id: string;
  label: string;
  votes: number;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  className: string;
  isActive: boolean; // Manual toggle
  startTime?: string; // New: Automatic start
  endTime?: string; // New: Automatic end
  hasVoted: boolean; 
  userVoteOptionId?: string; // New field to track which option the user picked
  totalVotes: number;
  createdAt: string; // ISO String
}

export interface ClassGroup {
  id: string;
  name: string;
  email: string;
  studentCount: number;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  timestamp: string; // ISO string
  isRead: boolean;
  link?: string;
  targetRole?: UserRole; // Pour cibler un rôle spécifique (ex: ADMIN)
  targetClass?: string;  // Pour cibler une classe spécifique
}

export interface ActivityLog {
  id: string;
  actor: string;
  action: string;
  target: string;
  type: 'create' | 'update' | 'delete' | 'security';
  timestamp: string;
}
