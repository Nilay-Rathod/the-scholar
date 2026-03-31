import { Student, PracticeAttempt } from './types';

export const mockStudents: Student[] = [
  { uid: '1', name: 'Aria Sterling', email: 'aria@scholar.edu', avatar: 'https://i.pravatar.cc/150?u=aria', targetBand: 8.5, currentBand: 7.5, joinDate: '2024-01-15', status: 'active', role: 'student' },
  { uid: '2', name: 'Julian Thorne', email: 'julian@scholar.edu', avatar: 'https://i.pravatar.cc/150?u=julian', targetBand: 8.0, currentBand: 7.0, joinDate: '2024-02-01', status: 'active', role: 'student' },
  { uid: '3', name: 'Elena Vance', email: 'elena@scholar.edu', avatar: 'https://i.pravatar.cc/150?u=elena', targetBand: 7.5, currentBand: 6.5, joinDate: '2024-02-10', status: 'active', role: 'student' },
  { uid: '4', name: 'Marcus Reed', email: 'marcus@scholar.edu', avatar: 'https://i.pravatar.cc/150?u=marcus', targetBand: 8.5, currentBand: 8.0, joinDate: '2023-12-05', status: 'active', role: 'student' },
];

export const mockAttempts: PracticeAttempt[] = [
  { id: 'a1', studentId: '1', type: 'Writing', title: 'Task 2: Environmental Policy', date: '2024-03-20', score: 7.5, feedback: 'Strong arguments, but lexical resource needs more academic variety.' },
  { id: 'a2', studentId: '1', type: 'Reading', title: 'Academic Reading: The History of Printing', date: '2024-03-18', score: 8.0 },
  { id: 'a3', studentId: '1', type: 'Listening', title: 'Section 4: Urban Planning Lecture', date: '2024-03-15', score: 8.5 },
  { id: 'a4', studentId: '1', type: 'Speaking', title: 'Part 2: Describe a memorable journey', date: '2024-03-12', score: 7.0 },
];
