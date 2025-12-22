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
  isActive?: boolean;
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
  priority: AnnouncementPriority;
  links?: ExternalLink[];
  attachments?: string[];
}

export interface Exam {
  id: string;
  subject: string;
  date: string;
  duration: string;
  room: string;
  notes?: string;
  className: string;
  links?: ExternalLink[];
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
  isActive: boolean;
  startTime?: string;
  endTime?: string;
  hasVoted: boolean; 
  userVoteOptionId?: string;
  totalVotes: number;
  createdAt: string;
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
  timestamp: string;
  isRead: boolean;
  link?: string;
  targetRole?: UserRole;
  targetClass?: string;
}

export interface ActivityLog {
  id: string;
  actor: string;
  action: string;
  target: string;
  type: 'create' | 'update' | 'delete' | 'security';
  timestamp: string;
}
