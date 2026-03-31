export type BandScore = number;

export interface User {
  uid: string;
  name: string;
  email: string;
  avatar: string;
  role: 'student' | 'teacher' | 'admin';
  status: 'active' | 'inactive';
  targetBand?: number;
  currentBand?: number;
}

export interface Teacher extends User {
  role: 'teacher';
  assignedStudentIds: string[];
  classIds: string[];
}

export interface Student extends User {
  role: 'student';
  targetBand: BandScore;
  currentBand: BandScore;
  joinDate: string;
  examDate?: string;
  teacherId?: string;
  classId?: string;
}

export interface PracticeAttempt {
  id: string;
  studentId: string;
  type: 'Writing' | 'Reading' | 'Listening' | 'Speaking';
  title: string;
  date: string;
  score: BandScore;
  feedback?: string;
  evaluation?: any;
  content?: string;
  prompt?: string;
  evaluatorId?: string; // AI or Teacher UID
}

export interface TestContent {
  id: string;
  type: 'Academic' | 'General Training';
  skill: 'Reading' | 'Listening' | 'Writing' | 'Speaking';
  title: string;
  content: string;
  answerKey?: Record<string, string>;
  createdAt: string;
  status: 'active' | 'archived';
  authorId?: string; // Admin or Teacher UID
}

export interface ScheduledTask {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  type: 'Exam' | 'Practice' | 'Submission';
  status: 'upcoming' | 'active' | 'completed';
  assignedTo?: string[]; // student UIDs, if empty, assigned to all
  classId?: string;
  skill?: 'Reading' | 'Listening' | 'Writing' | 'Speaking';
  testId?: string;
}


export interface Class {
  id: string;
  name: string;
  teacherId: string;
  studentIds: string[];
  createdAt: string;
  status?: 'active' | 'archived';
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  link?: string;
  createdAt: any;
}
