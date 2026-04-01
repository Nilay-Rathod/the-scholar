import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  Target, 
  Calendar, 
  ChevronRight, 
  PenTool, 
  BookOpen, 
  Headphones, 
  Mic2,
  ArrowUpRight,
  GraduationCap,
  Zap,
  Loader2,
  Clock,
  FileText,
  Copy,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  Plus
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, limit, onSnapshot, getDocs, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../App';
import { PracticeAttempt, Student } from '../types';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

const data = [
  { name: 'Jan', score: 6.0 },
  { name: 'Feb', score: 6.5 },
  { name: 'Mar', score: 7.5 },
  { name: 'Apr', score: 7.0 },
  { name: 'May', score: 8.0 },
];

const ScoreCard = ({ label, score, icon: Icon, color, onClick }: { label: string, score: number, icon: any, color: string, onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={cn(
      "scholar-card flex flex-col gap-4 transition-all cursor-pointer group",
      onClick && "hover:border-primary hover:shadow-md active:scale-95"
    )}
  >
    <div className="flex items-center justify-between">
      <div className={cn("p-2 rounded-lg transition-transform group-hover:scale-110", color)}>
        <Icon size={20} className="text-white" />
      </div>
      <span className="text-2xl font-serif italic text-primary">{score.toFixed(1)}</span>
    </div>
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-ink">{label}</p>
        <ArrowUpRight size={14} className="text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <p className="text-[10px] text-ink-muted uppercase tracking-wider mt-1">Current Band</p>
    </div>
  </div>
);



export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [classCode, setClassCode] = useState('');
  const [currentClass, setCurrentClass] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'attempts'),
      where('studentId', '==', user.uid),
      orderBy('date', 'desc'),
      limit(10)
    );

    const unsubscribeAttempts = onSnapshot(q, (snapshot) => {
      const attemptData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as PracticeAttempt[];
      setAttempts(attemptData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'attempts');
    });

    const scheduleQuery = query(
      collection(db, 'schedule'),
      where('status', 'in', ['upcoming', 'active'])
    );

    const unsubscribeSchedule = onSnapshot(scheduleQuery, (snapshot) => {
      const studentClassId = (user as Student).classId;
      const allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // Filter for student's class or tasks assigned by their teacher
      const filteredTasks = allTasks.filter(task => 
        !task.classId || task.classId === studentClassId || task.assignedBy === (user as Student).teacherId
      );

      // Sort by dueDate ASC in memory
      const sortedTasks = filteredTasks.sort((a, b) => 
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      ).slice(0, 5);

      setScheduledTasks(sortedTasks);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'schedule');
    });

    const assignmentsQuery = query(
      collection(db, 'assignments'),
      where('status', '==', 'active')
    );

    const unsubscribeAssignments = onSnapshot(assignmentsQuery, (snapshot) => {
      const studentClassId = (user as Student).classId;
      const allAssignments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // Filter by class or creator (if teacher is assigned)
      const filtered = allAssignments.filter(a => 
        !a.classId || a.classId === studentClassId || a.teacherId === (user as Student).teacherId
      );

      const sorted = filtered.sort((a, b) => 
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      ).slice(0, 5);

      setAssignments(sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'assignments');
    });

    // Listen to current class info if enrolled
    let unsubscribeClass: (() => void) | undefined;
    if (user.role === 'student' && (user as Student).classId) {
      const classRef = doc(db, 'classes', (user as Student).classId!);
      unsubscribeClass = onSnapshot(classRef, (snap) => {
        if (snap.exists()) {
          setCurrentClass({ id: snap.id, ...snap.data() });
        }
      });
    }

    return () => {
      unsubscribeAttempts();
      unsubscribeSchedule();
      unsubscribeAssignments();
      if (unsubscribeClass) unsubscribeClass();
    };
  }, [user]);

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== 'student') return;
    if (!classCode.trim()) {
      toast.error("Please enter a class code");
      return;
    }

    const student = user as Student;
    if (student.classId) {
      toast.error("You are already enrolled in a class. Please contact your teacher to move classes.");
      return;
    }

    setJoining(true);
    try {
      // Find class by code (exact match)
      const q = query(collection(db, 'classes'), where('classCode', '==', classCode.trim()));
      const snap = await getDocs(q);

      if (snap.empty) {
        toast.error("Invalid class code. Please check and try again.");
        return;
      }

      const classDoc = snap.docs[0];
      const classData = classDoc.data();

      // Enroll student
      const batch = []; // We can't use real batch with arrayUnion easily in some versions, but updateDoc is fine
      
      // Update student record
      await updateDoc(doc(db, 'users', user.uid), {
        classId: classDoc.id,
        teacherId: classData.teacherId
      });

      // Update class record
      await updateDoc(doc(db, 'classes', classDoc.id), {
        studentIds: arrayUnion(user.uid)
      });

      toast.success(`Successfully joined "${classData.name}"!`);
      setClassCode('');
    } catch (error) {
      console.error("Error joining class:", error);
      toast.error("Failed to join class. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  const chartData = attempts.slice().reverse().map(a => ({
    name: new Date(a.date).toLocaleDateString('en-US', { month: 'short' }),
    score: a.score
  }));

  const getLatestScore = (type: string) => {
    const latest = attempts.find(a => a.type === type);
    return latest ? latest.score : 0;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col gap-8"
    >
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif italic text-primary">Welcome back, {user?.name.split(' ')[0]}</h2>
          <p className="text-ink-muted mt-1">
            Your academic journey is progressing well. 
            {user?.role === 'student' ? (
              <> You're {(((user as Student).targetBand || 7.5) - ((user as Student).currentBand || 0)).toFixed(1)} bands away from your goal.</>
            ) : (
              <> Empowering the next generation of scholars.</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => navigate('/practice/short')}
            className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-primary-light transition-all shadow-lg shadow-primary/20"
          >
            <Zap size={18} /> Quick Practice
          </button>
          <div className="bg-surface px-4 py-2 rounded-lg border border-line flex items-center gap-3 shadow-sm transition-colors">
            <Calendar size={18} className="text-primary" />
            <span className="text-sm font-bold text-ink">
              Next Exam: {user?.role === 'student' && (user as Student).examDate ? new Date((user as Student).examDate!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not Scheduled'}
            </span>
          </div>
        </div>
      </div>

      {/* Scholar's Quote */}
      <div className="scholar-card bg-surface border-line py-6 px-8 flex flex-col md:flex-row items-center gap-6">
        <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center text-primary shrink-0">
          <GraduationCap size={24} />
        </div>
        <div className="flex-1 text-center md:text-left">
          <p className="text-lg font-serif italic text-primary leading-relaxed">
            "Education is not the filling of a pail, but the lighting of a fire."
          </p>
          <p className="text-[10px] uppercase tracking-widest font-bold text-ink-muted mt-2">— William Butler Yeats</p>
        </div>
        <div className="h-12 w-px bg-line hidden md:block" />
        <div className="flex flex-col gap-1 items-start md:items-end">
          <div className="flex items-center gap-2 text-ink-muted">
            <Calendar size={14} />
            <span className="text-xs uppercase tracking-widest font-bold">Exam Date:</span>
            <span className="text-xs font-serif italic text-primary">
              {user?.role === 'student' ? new Date((user as Student).examDate || '').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not set'}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex flex-col items-end">
              <span className="text-[8px] uppercase tracking-tighter text-ink-muted font-bold">Target</span>
              <span className="text-sm font-serif italic text-secondary">{user?.role === 'student' ? (user as Student).targetBand : '-'}</span>
            </div>
            <div className="w-px h-8 bg-line" />
            <div className="flex flex-col items-end">
              <span className="text-[8px] uppercase tracking-tighter text-ink-muted font-bold">Current</span>
              <span className="text-sm font-serif italic text-primary">{user?.role === 'student' ? (user as Student).currentBand : '-'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <ScoreCard label="Writing" score={getLatestScore('Writing')} icon={PenTool} color="bg-blue-600" onClick={() => navigate('/practice/writing?mode=full')} />
        <ScoreCard label="Reading" score={getLatestScore('Reading')} icon={BookOpen} color="bg-emerald-600" onClick={() => navigate('/practice/reading?mode=full')} />
        <ScoreCard label="Listening" score={getLatestScore('Listening')} icon={Headphones} color="bg-amber-600" onClick={() => navigate('/practice/listening?mode=full')} />
        <ScoreCard label="Speaking" score={getLatestScore('Speaking')} icon={Mic2} color="bg-rose-600" onClick={() => navigate('/practice/speaking?mode=full')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Progress Chart */}
        <div className="lg:col-span-2 scholar-card">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-serif italic text-primary">Progress Insight</h3>
              <p className="text-xs text-ink-muted mt-1">Overall band score trend over recent attempts</p>
            </div>
            <div className="flex items-center gap-2 text-secondary bg-secondary/10 px-3 py-1 rounded-full">
              <TrendingUp size={14} />
              <span className="text-xs font-bold">Real-time Data</span>
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={32} />
              </div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: 'var(--ink-muted)' }} 
                    dy={10}
                  />
                  <YAxis 
                    domain={[0, 9]} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: 'var(--ink-muted)' }} 
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--line)', backgroundColor: 'var(--surface)', color: 'var(--ink)' }}
                    itemStyle={{ color: 'var(--primary)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="score" 
                    stroke="var(--primary)" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorScore)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-ink-muted gap-4">
                <Target size={48} className="opacity-20" />
                <p>No practice data available yet. Start your first session!</p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Tasks & Recent Activity */}
        <div className="flex flex-col gap-6">
          {/* Class Enrollment Section */}
          <div className="scholar-card border-primary/20 bg-primary/[0.02]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-serif italic text-primary">Classroom</h3>
              <GraduationCap size={20} className="text-primary" />
            </div>
            
            {currentClass ? (
              <div className="space-y-3">
                <div className="p-3 bg-white rounded-xl border border-line shadow-sm">
                  <p className="text-[8px] uppercase tracking-widest font-bold text-ink-muted">Enrolled In</p>
                  <p className="text-sm font-bold text-ink truncate mt-1">{currentClass.name}</p>
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-line/50">
                    <CheckCircle2 size={12} className="text-emerald-500" />
                    <span className="text-[10px] font-bold text-emerald-600 uppercase">Status: Active</span>
                  </div>
                </div>
                <p className="text-[10px] text-ink-muted italic px-2">Need to change class? Contact your teacher.</p>
              </div>
            ) : (
              <form onSubmit={handleJoinClass} className="space-y-4">
                <p className="text-xs text-ink-muted">Join your teacher's class to receive assignments and feedback.</p>
                <div className="relative group/input">
                  <input 
                    type="text" 
                    value={classCode}
                    onChange={(e) => setClassCode(e.target.value)}
                    placeholder="Enter Class Code"
                    className="w-full px-4 py-3 bg-white border border-line rounded-xl text-sm font-mono font-bold outline-none focus:border-primary transition-all group-hover/input:shadow-sm"
                  />
                  <div className="absolute inset-y-0 right-3 flex items-center">
                    <Zap size={14} className="text-primary/30" />
                  </div>
                </div>
                <button 
                  type="submit"
                  disabled={joining || !classCode.trim()}
                  className="w-full py-3 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-light transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
                >
                  {joining ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  Join Class
                </button>
              </form>
            )}
          </div>

          <div className="scholar-card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-serif italic text-primary">Upcoming Tasks</h3>
              <span className="text-[10px] uppercase tracking-widest font-bold text-secondary bg-secondary/10 px-2 py-1 rounded-full">Active</span>
            </div>
            <div className="space-y-4">
              {scheduledTasks.length > 0 ? (
                scheduledTasks.map(task => (
                  <div 
                    key={task.id} 
                    onClick={() => {
                      if (task.skill) {
                        navigate(`/practice/${task.skill.toLowerCase()}`);
                      } else {
                        toast.info("Task details: " + task.description);
                      }
                    }}
                    className="flex items-start gap-3 p-3 rounded-xl bg-bg/50 border border-line/50 hover:border-primary cursor-pointer active:scale-[0.98] transition-all group"
                  >
                    <div className={cn(
                      "w-8 h-8 rounded flex items-center justify-center text-white shrink-0 shadow-sm transition-transform group-hover:scale-110",
                      task.type === 'Exam' ? "bg-red-500" : task.type === 'Practice' ? "bg-emerald-500" : "bg-blue-500"
                    )}>
                      {task.type === 'Exam' ? <GraduationCap size={16} /> : task.type === 'Practice' ? <Zap size={16} /> : <FileText size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-ink truncate group-hover:text-primary transition-colors">{task.title}</p>
                        <span className={cn(
                          "text-[8px] uppercase font-bold px-1.5 py-0.5 rounded-full",
                          task.status === 'active' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                        )}>
                          {task.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-2">
                          <Clock size={10} className="text-primary" />
                          <p className="text-[10px] text-ink-muted uppercase tracking-tighter">Due: {new Date(task.dueDate).toLocaleDateString()}</p>
                        </div>
                        {task.skill && (
                          <span className="text-[8px] font-bold text-primary/70 uppercase">{task.skill}</span>
                        )}
                      </div>
                    </div>
                  </div>

                ))
              ) : (
                <p className="text-xs text-ink-muted text-center py-4 italic">No upcoming tasks</p>
              )}
            </div>
          </div>

          <div className="scholar-card border-secondary/20 bg-secondary/[0.02]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-serif italic text-secondary">New Assignments</h3>
              <span className="text-[10px] uppercase tracking-widest font-bold text-white bg-secondary px-2 py-1 rounded-full">Scholar Classroom</span>
            </div>
            <div className="space-y-4">
              {assignments.length > 0 ? (
                assignments.map(assignment => (
                  <div 
                    key={assignment.id} 
                    onClick={() => navigate(`/practice/${assignment.type.toLowerCase()}`)}
                    className="flex items-start gap-3 p-3 rounded-xl bg-white border border-line hover:border-secondary transition-all cursor-pointer group shadow-sm"
                  >
                    <div className={cn(
                      "w-8 h-8 rounded flex items-center justify-center text-white shrink-0",
                      assignment.type === 'Writing' ? "bg-amber-500" : 
                      assignment.type === 'Speaking' ? "bg-blue-500" : 
                      "bg-emerald-500"
                    )}>
                      {assignment.type === 'Writing' ? <PenTool size={16} /> : 
                       assignment.type === 'Speaking' ? <Mic2 size={16} /> : 
                       <FileText size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-ink truncate group-hover:text-secondary transition-colors">{assignment.title}</p>
                        <span className="text-[8px] font-bold text-secondary uppercase tracking-tighter">{assignment.points}pts</span>
                      </div>
                      <p className="text-[10px] text-ink-muted line-clamp-1 mt-0.5">{assignment.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Clock size={10} className="text-secondary" />
                        <p className="text-[9px] text-secondary font-bold uppercase tracking-tighter">Due: {new Date(assignment.dueDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center">
                  <GraduationCap size={32} className="mx-auto text-line mb-3" />
                  <p className="text-xs text-ink-muted italic">All caught up! No pending assignments.</p>
                </div>
              )}
            </div>
          </div>

          <div className="scholar-card bg-primary text-white border-none overflow-hidden relative">
            <div className="relative z-10">
              <p className="text-[10px] uppercase tracking-widest font-bold opacity-70">Next Milestone</p>
              <h3 className="text-2xl font-serif italic mt-2">Mastering Lexical Resource</h3>
              <p className="text-sm opacity-80 mt-2 leading-relaxed">Focus on academic collocations and idiomatic expressions to push your Writing band to 8.0.</p>
              <button 
                onClick={() => navigate('/practice/writing')}
                className="mt-6 bg-white text-primary px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-opacity-90 transition-all"
              >
                Start Module <ArrowUpRight size={16} />
              </button>
            </div>
            {/* Watermark/Fading fonts for context */}
            <div className="absolute right-0 top-0 opacity-10 pointer-events-none select-none">
              <p className="text-6xl font-serif italic -rotate-12 translate-x-12 translate-y-4">Scholar</p>
            </div>
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute -left-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-xl" />
          </div>

          <div className="scholar-card flex-1">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-serif italic text-primary">Recent Attempts</h3>
              <button onClick={() => navigate('/history')} className="text-xs font-bold text-primary hover:underline">View All</button>
            </div>
            <div className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin text-primary" size={24} />
                </div>
              ) : attempts.length > 0 ? (
                attempts.slice(0, 3).map(attempt => (
                  <div key={attempt.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-bg transition-colors cursor-pointer group">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center text-white",
                      attempt.type === 'Writing' ? 'bg-blue-600' : 
                      attempt.type === 'Reading' ? 'bg-emerald-600' : 
                      attempt.type === 'Listening' ? 'bg-amber-600' : 'bg-rose-600'
                    )}>
                      {attempt.type === 'Writing' ? <PenTool size={18} /> : 
                       attempt.type === 'Reading' ? <BookOpen size={18} /> : 
                       attempt.type === 'Listening' ? <Headphones size={18} /> : <Mic2 size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-ink truncate">{attempt.title}</p>
                      <p className="text-[10px] text-ink-muted mt-0.5">{new Date(attempt.date).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-serif italic text-primary">{attempt.score.toFixed(1)}</p>
                      <ChevronRight size={14} className="text-ink-muted ml-auto mt-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-ink-muted text-center py-8 italic">No recent activity</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
