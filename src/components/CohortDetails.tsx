import React from 'react';
import { motion } from 'motion/react';
import { Users, TrendingUp, GraduationCap, ArrowRight, User, Mail, Target } from 'lucide-react';
import { cn } from '../lib/utils';
import { Student, Class, Teacher } from '../types';

interface CohortDetailsProps {
  cohort: Class;
  students: Student[];
  teachers: Teacher[];
  attempts: any[];
  onClose: () => void;
  onViewStudent: (student: Student) => void;
}

export default function CohortDetails({ 
  cohort, 
  students, 
  teachers, 
  attempts, 
  onClose,
  onViewStudent
}: CohortDetailsProps) {
  const cohortStudents = students.filter(s => cohort.studentIds?.includes(s.uid) || s.classId === cohort.id);
  const teacher = teachers.find(t => t.uid === cohort.teacherId);

  // Calculate cohort stats
  const cohortAttempts = attempts.filter(a => cohortStudents.some(s => s.uid === a.studentId));
  const averageBand = cohortAttempts.length > 0 
    ? cohortAttempts.reduce((acc, curr) => acc + (curr.score || 0), 0) / cohortAttempts.length 
    : 0;

  return (
    <div className="space-y-8">
      {/* Header Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="scholar-card bg-primary/5 border-primary/10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Users size={16} />
            </div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-ink-muted">Total Scholars</p>
          </div>
          <h3 className="text-3xl font-serif italic text-primary">{cohortStudents.length}</h3>
        </div>

        <div className="scholar-card bg-secondary/5 border-secondary/10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
              <TrendingUp size={16} />
            </div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-ink-muted">Cohort Average</p>
          </div>
          <h3 className="text-3xl font-serif italic text-secondary">{averageBand > 0 ? averageBand.toFixed(1) : 'N/A'}</h3>
        </div>

        <div className="scholar-card bg-bg border-line">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-bg border border-line flex items-center justify-center text-ink-muted">
              <GraduationCap size={16} />
            </div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-ink-muted">Lead Teacher</p>
          </div>
          <h3 className="text-lg font-serif italic text-primary truncate">{teacher?.name || 'Unassigned'}</h3>
          <p className="text-[8px] text-ink-muted uppercase font-bold tracking-widest">{teacher?.email || 'No email'}</p>
        </div>
      </div>

      {/* Student List */}
      <div className="scholar-card p-0 overflow-hidden border-line">
        <div className="px-6 py-4 border-b border-line bg-surface/50">
          <h4 className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary italic font-serif">Cohort Members</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg/50">
                <th className="px-6 py-4 text-[10px] font-bold text-ink-muted uppercase tracking-widest">Scholar</th>
                <th className="px-6 py-4 text-[10px] font-bold text-ink-muted uppercase tracking-widest">Progress</th>
                <th className="px-6 py-4 text-[10px] font-bold text-ink-muted uppercase tracking-widest">Target</th>
                <th className="px-6 py-4 text-[10px] font-bold text-ink-muted uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {cohortStudents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-ink-muted italic text-sm">
                    No scholars assigned to this cohort yet.
                  </td>
                </tr>
              ) : (
                cohortStudents.map((student) => {
                  const studentAttempts = attempts.filter(a => a.studentId === student.uid);
                  const lastAttempt = studentAttempts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                  
                  return (
                    <tr key={student.uid} className="hover:bg-primary/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-surface border border-line flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                            {student.avatar ? (
                              <img src={student.avatar} alt={student.name} className="w-full h-full rounded-xl object-cover" />
                            ) : (
                              <User size={20} />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-ink">{student.name}</p>
                            <p className="text-[10px] text-ink-muted flex items-center gap-1">
                              <Mail size={10} /> {student.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 max-w-[100px] h-1.5 bg-bg rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, (studentAttempts.length / 10) * 100)}%` }}
                              className="h-full bg-secondary"
                            />
                          </div>
                          <span className="text-[10px] font-bold text-ink-muted">{studentAttempts.length} Tests</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <Target size={12} className="text-secondary" />
                            <span className="text-sm font-serif italic text-primary font-bold">{student.targetBand || '7.5'}</span>
                          </div>
                          <p className="text-[8px] text-ink-muted uppercase font-bold tracking-widest pl-4">Target Band</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => onViewStudent(student)}
                          className="p-2 hover:bg-primary/10 rounded-lg text-primary transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ml-auto"
                        >
                          Details <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-line">
        <button 
          onClick={onClose}
          className="px-6 py-2 rounded-xl bg-bg border border-line text-ink-muted text-xs font-bold uppercase tracking-widest hover:bg-surface transition-all"
        >
          Close View
        </button>
      </div>
    </div>
  );
}
