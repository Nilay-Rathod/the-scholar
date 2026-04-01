import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  BookOpen, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical,
  GraduationCap,
  Calendar,
  PenTool,
  Mic2,
  Headphones,
  FileText,
  TrendingUp,
  Layout,
  Upload,
  AlertCircle,
  ChevronRight,
  Mail,
  Zap,
  Check,
  X,
  Loader2,
  Trash2,
  Archive,
  Copy,
  RefreshCcw,
  Link as LinkIcon
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  doc, 
  updateDoc, 
  setDoc, 
  serverTimestamp,
  getDocs,
  limit,
  writeBatch,
  deleteDoc
} from 'firebase/firestore';
import { useAuth } from '../App';
import { Class, Student, PracticeAttempt, TestContent, ScheduledTask, Notification } from '../types';
import { cn, generateClassCode } from '../lib/utils';
import { toast } from 'sonner';
import AdminEvaluationReview from '../components/AdminEvaluationReview';

const StatCard = ({ label, value, subtext, icon: Icon, color }: { label: string, value: string, subtext: string, icon: any, color: string }) => (
  <div className="scholar-card flex items-center gap-6">
    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg", color)}>
      <Icon size={24} />
    </div>
    <div>
      <p className="text-xs font-bold text-ink-muted uppercase tracking-widest">{label}</p>
      <h3 className="text-2xl font-serif italic text-primary mt-1">{value}</h3>
      <p className="text-[10px] text-secondary font-bold mt-1">{subtext}</p>
    </div>
  </div>
);

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'classes' | 'students' | 'evaluations' | 'tasks'>('classes');
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([]);
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [managingClass, setManagingClass] = useState<Class | null>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewingAttempt, setReviewingAttempt] = useState<PracticeAttempt | null>(null);

  // Form States
  const [newClass, setNewClass] = useState({ name: '' });
  const [newStudent, setNewStudent] = useState({ name: '', email: '', classId: '' });
  const [newTask, setNewTask] = useState({ 
    title: '', 
    description: '', 
    dueDate: '', 
    type: 'Practice' as any, 
    skill: 'Writing' as any,
    classId: '' 
  });

  useEffect(() => {
    if (!user) return;

    // Safety timeout: if loading hasn't resolved in 5s, force it off
    const safetyTimer = setTimeout(() => setLoading(false), 5000);

    // Listen to Teacher's Classes
    const classesQuery = query(collection(db, 'classes'), where('teacherId', '==', user.uid));
    const unsubscribeClasses = onSnapshot(classesQuery, (snapshot) => {
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
    }, (error) => {
      console.error('[TeacherDashboard] Classes query error:', error);
    });

    // Listen to Students assigned to this teacher
    const studentsQuery = query(collection(db, 'users'), where('teacherId', '==', user.uid));
    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Student)));
      setLoading(false);
    }, (error) => {
      console.error('[TeacherDashboard] Students query error:', error);
      setLoading(false);
      if (error.code === 'permission-denied') {
        toast.error("Access denied. Please ensure you are enrolled as a teacher.");
      }
    });

    // Listen to practice attempts — simple query without composite index
    const attemptsQuery = query(
      collection(db, 'attempts'), 
      where('assignedTeacherId', '==', user.uid)
    );
    const unsubscribeAttempts = onSnapshot(attemptsQuery, (snapshot) => {
      const sorted = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as PracticeAttempt))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAttempts(sorted);
    }, (error) => {
      console.error('[TeacherDashboard] Attempts query error:', error);
    });

    // Listen to teacher's scheduled tasks
    const tasksQuery = query(collection(db, 'schedule'), where('assignedBy', '==', user.uid));
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduledTask)));
    }, (error) => {
      console.error('[TeacherDashboard] Tasks query error:', error);
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribeClasses();
      unsubscribeStudents();
      unsubscribeAttempts();
      unsubscribeTasks();
    };
  }, [user]);

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
      toast.error("Unauthorized: Only teachers or admins can create classes.");
      return;
    }
    if (!newClass.name.trim()) {
      toast.error("Please provide a class name");
      return;
    }
    setIsSubmitting(true);
    try {
      const classData = {
        name: newClass.name.trim(),
        teacherId: user.uid,
        classCode: generateClassCode(),
        studentIds: [],
        createdAt: serverTimestamp(),
        status: 'active'
      };
      await addDoc(collection(db, 'classes'), classData);
      toast.success("Class created successfully!");
      setIsClassModalOpen(false);
      setNewClass({ name: '' });
    } catch (error) {
      console.error("Error creating class:", error);
      toast.error("Failed to create class. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetClassCode = async (classId: string) => {
    try {
      const newCode = generateClassCode();
      await updateDoc(doc(db, 'classes', classId), { classCode: newCode });
      toast.success(`New class code generated: ${newCode}`);
    } catch (error) {
      console.error("Error resetting class code:", error);
      toast.error("Failed to reset class code.");
    }
  };

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    try {
      const studentEmail = newStudent.email.trim().toLowerCase();
      // Find or create student
      const userRef = collection(db, 'users');
      const q = query(userRef, where('email', '==', studentEmail));
      const querySnapshot = await getDocs(q);
      
      let studentUid = '';
      if (!querySnapshot.empty) {
        studentUid = querySnapshot.docs[0].id;
        await updateDoc(doc(db, 'users', studentUid), {
          teacherId: user.uid,
          classId: newStudent.classId || null
        });
        toast.success(`${newStudent.name} is already a student and has been linked to your classes!`);
      } else {
        // Create placeholder
        const newRef = doc(collection(db, 'users'));
        studentUid = newRef.id;
        await setDoc(newRef, {
          uid: studentUid,
          name: newStudent.name,
          email: studentEmail,
          role: 'student',
          teacherId: user.uid,
          classId: newStudent.classId || null,
          status: 'pending',
          joinDate: new Date().toISOString(),
          targetBand: 7.0,
          currentBand: 0,
          avatar: `https://i.pravatar.cc/150?u=${studentEmail}`,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast.success(`Enrollment invite sent to ${newStudent.name}!`);
      }

      // Add to class if specified
      if (newStudent.classId) {
        const classRef = doc(db, 'classes', newStudent.classId);
        const classSnap = await getDocs(query(collection(db, 'classes'), where('__name__', '==', newStudent.classId)));
        if (!classSnap.empty) {
          const currentStudents = classSnap.docs[0].data().studentIds || [];
          if (!currentStudents.includes(studentUid)) {
            await updateDoc(classRef, {
              studentIds: [...currentStudents, studentUid]
            });
          }
        }
      }

      // Send notification to student
      await addDoc(collection(db, 'notifications'), {
        userId: studentUid,
        title: "Enrolled in Classroom",
        message: `Teacher ${user.name} has enrolled you in their classroom.`,
        type: 'success',
        read: false,
        createdAt: serverTimestamp()
      });

      toast.success("Student enrolled successfully!");
      setIsStudentModalOpen(false);
      setNewStudent({ name: '', email: '', classId: '' });
    } catch (error) {
      console.error(error);
      toast.error('Failed to update student assignment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStudentInClass = async (studentId: string, currentClass: Class) => {
    setIsSubmitting(true);
    try {
      const classRef = doc(db, 'classes', currentClass.id);
      const userRef = doc(db, 'users', studentId);
      
      let updatedStudentIds = [...currentClass.studentIds];
      let newClassId: string | null = currentClass.id;
      
      if (updatedStudentIds.includes(studentId)) {
        // Remove
        updatedStudentIds = updatedStudentIds.filter(id => id !== studentId);
        newClassId = null;
      } else {
        // Add
        updatedStudentIds.push(studentId);
      }
      
      setManagingClass({...currentClass, studentIds: updatedStudentIds});

      await updateDoc(classRef, { studentIds: updatedStudentIds });
      await updateDoc(userRef, { classId: newClassId });
      
      toast.success(newClassId ? 'Student enrolled in class' : 'Student removed from class');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update class enrollment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    try {
      const taskData = {
        ...newTask,
        status: 'upcoming',
        assignedBy: user.uid,
        createdAt: new Date().toISOString()
      };
      
      const docRef = await addDoc(collection(db, 'schedule'), taskData);

      // Notify students
      if (newTask.classId) {
        const targetClass = classes.find(c => c.id === newTask.classId);
        if (targetClass) {
          const batch = writeBatch(db);
          targetClass.studentIds.forEach(sid => {
            const notifRef = doc(collection(db, 'notifications'));
            batch.set(notifRef, {
              userId: sid,
              title: "New Task Assigned",
              message: `Your teacher assigned a new ${newTask.type}: ${newTask.title}`,
              type: 'info',
              read: false,
              link: `/practice/${newTask.type.toLowerCase()}`,
              createdAt: serverTimestamp()
            });
          });
          await batch.commit();
        }
      }

      toast.success("Task created and assigned!");
      setIsTaskModalOpen(false);
      setNewTask({ title: '', description: '', dueDate: '', type: 'Practice', skill: 'Writing', classId: '' });
    } catch (error) {
      toast.error("Failed to create task");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 relative w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif italic text-primary">Teacher Workspace</h2>
          <p className="text-ink-muted mt-1">Manage your academic cohorts and evaluate scholar excellence.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setIsClassModalOpen(true)}
            className="scholar-button-secondary py-2 flex items-center gap-2"
          >
            <Layout size={18} /> New Class
          </button>
          <button 
            onClick={() => setIsStudentModalOpen(true)}
            className="scholar-button-primary py-2 flex items-center gap-2"
          >
            <Plus size={18} /> Enroll Student
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Active Classes" 
          value={classes.length.toString()} 
          subtext="Total Cohorts" 
          icon={Layout} 
          color="bg-primary"
        />
        <StatCard 
          label="Total Students" 
          value={students.length.toString()} 
          subtext="Assigned Scholars" 
          icon={Users} 
          color="bg-secondary"
        />
        <StatCard 
          label="Pending Evals" 
          value={attempts.filter(a => !a.evaluation).length.toString()} 
          subtext="To be reviewed" 
          icon={Clock} 
          color="bg-amber-500"
        />
        <StatCard 
          label="Completed" 
          value={attempts.filter(a => a.evaluation).length.toString()} 
          subtext="Graded tasks" 
          icon={CheckCircle2} 
          color="bg-emerald-500"
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-line gap-8">
        {[
          { id: 'classes', label: 'My Classes', icon: Layout },
          { id: 'students', label: 'Scholars', icon: Users },
          { id: 'evaluations', label: 'Evaluation Requests', icon: PenTool },
          { id: 'tasks', label: 'Task Library', icon: BookOpen },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 py-4 border-b-2 transition-all font-bold text-sm",
              activeTab === tab.id 
                ? "border-primary text-primary" 
                : "border-transparent text-ink-muted hover:text-ink"
            )}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center p-24">
            <Loader2 className="animate-spin text-primary" size={48} />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'classes' && (
              <motion.div 
                key="classes"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {classes.length === 0 ? (
                  <div className="col-span-full py-12 text-center bg-surface border border-dashed border-line rounded-2xl">
                    <Layout size={48} className="mx-auto text-line mb-4" />
                    <p className="text-ink-muted italic font-serif">No classes established yet. Create your first cohort to begin.</p>
                  </div>
                ) : (
                  classes.map(c => (
                    <div key={c.id} className={cn(
                      "scholar-card group hover:border-primary transition-all",
                      c.status === 'archived' && "opacity-60 grayscale-[0.5]"
                    )}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-primary/5 rounded-lg text-primary">
                            <TrendingUp size={20} />
                          </div>
                          {c.status === 'archived' && (
                            <span className="text-[10px] bg-ink-muted/10 text-ink-muted px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">Archived</span>
                          )}
                        </div>
                        <div className="relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === c.id ? null : c.id);
                            }}
                            className={cn(
                              "p-1 rounded-lg transition-colors",
                              activeMenuId === c.id ? "bg-primary text-white" : "hover:bg-bg text-ink-muted"
                            )}
                          >
                            <MoreVertical size={18} />
                          </button>
                          
                          <AnimatePresence>
                            {activeMenuId === c.id && (
                              <>
                                <div 
                                  className="fixed inset-0 z-30" 
                                  onClick={() => setActiveMenuId(null)} 
                                />
                                <motion.div 
                                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute right-0 top-full mt-2 w-48 bg-surface border border-line rounded-xl shadow-2xl z-40 py-2 overflow-hidden"
                                  >
                                    <button 
                                      onClick={() => {
                                        setManagingClass(c);
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full px-4 py-2 text-left text-xs font-bold text-ink hover:bg-primary/5 hover:text-primary flex items-center gap-2 transition-colors"
                                    >
                                      <Users size={14} /> Manage Students
                                    </button>
                                    <button 
                                      onClick={() => {
                                        // setAssignTaskClassId(c.id); // Placeholder for task assignment functionality
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full px-4 py-2 text-left text-xs font-bold text-ink hover:bg-primary/5 hover:text-primary flex items-center gap-2 transition-colors"
                                    >
                                      <PenTool size={14} /> Assign Task
                                    </button>
                                    <button 
                                      onClick={() => {
                                        handleResetClassCode(c.id);
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full px-4 py-2 text-left text-xs font-bold text-ink hover:bg-primary/5 hover:text-primary flex items-center gap-2 transition-colors"
                                    >
                                      <RefreshCcw size={14} /> {c.classCode ? 'Reset Join Code' : 'Generate Join Code'}
                                    </button>
                                    <div className="h-px bg-line my-1" />
                                  <button 
                                    onClick={() => {
                                      const newStatus = c.status === 'archived' ? 'active' : 'archived';
                                      updateDoc(doc(db, 'classes', c.id), { status: newStatus })
                                        .then(() => {
                                          toast.success(`Class ${newStatus === 'archived' ? 'archived' : 'restored'}`);
                                          setActiveMenuId(null);
                                        })
                                        .catch(() => toast.error('Failed to update class status'));
                                    }}
                                    className="w-full px-4 py-2 text-left text-xs font-bold text-ink hover:bg-primary/5 hover:text-primary flex items-center gap-2 transition-colors"
                                  >
                                    {c.status === 'archived' ? <Check size={14} /> : <Archive size={14} />}
                                    {c.status === 'archived' ? 'Restore Class' : 'Archive Class'}
                                  </button>
                                  <button 
                                    onClick={() => {
                                      if (confirm('Are you sure you want to delete this class permanently? Students will remain but will be unassigned from this class.')) {
                                        deleteDoc(doc(db, 'classes', c.id))
                                          .then(() => {
                                            toast.success('Class deleted permanently');
                                            setActiveMenuId(null);
                                          })
                                          .catch(() => toast.error('Failed to delete class (Permissions Check)'));
                                      }
                                    }}
                                    className="w-full px-4 py-2 text-left text-xs font-bold text-error hover:bg-error/5 flex items-center gap-2 transition-colors"
                                  >
                                    <Trash2 size={14} /> Delete Permanently
                                  </button>
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                      <h4 className="text-lg font-serif italic text-primary group-hover:text-ink transition-colors">{c.name}</h4>
                      <div className="flex items-center gap-4 mt-4">
                        <div className="flex -space-x-2">
                          {[1,2,3].map(i => (
                            <div key={i} className="w-8 h-8 rounded-full border-2 border-surface bg-bg flex items-center justify-center text-[10px] font-bold text-ink-muted">
                              {i}
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-ink-muted">
                          {c.studentIds.length} Students enrolled
                        </p>
                      </div>

                      <div className="mt-4 p-3 bg-bg rounded-xl border border-line flex items-center justify-between group/code relative overflow-hidden">
                        <div className="relative z-10">
                          <p className="text-[8px] uppercase tracking-tighter font-bold text-ink-muted">Join Code</p>
                          <p className="text-sm font-mono font-black text-primary mt-0.5">{c.classCode || '------'}</p>
                        </div>
                        <div className="flex items-center gap-1 relative z-10">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!c.classCode) {
                                toast.error("Please generate a code first via menu");
                                return;
                              }
                              navigator.clipboard.writeText(c.classCode)
                                .then(() => toast.success("Code copied to clipboard!"))
                                .catch(() => toast.error("Failed to copy code. Please copy manually."));
                            }}
                            className="p-2 hover:bg-primary/10 rounded-lg transition-colors text-primary"
                            title="Copy Code"
                          >
                            <Copy size={16} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!c.classCode) {
                                toast.error("Please generate a code first via menu");
                                return;
                              }
                              const joinLink = `${window.location.origin}/join/${c.classCode}`;
                              navigator.clipboard.writeText(joinLink)
                                .then(() => toast.success("Invite link copied!"))
                                .catch(() => {
                                  toast.error("Failed to copy link.");
                                  console.error("Clipboard Error");
                                });
                            }}
                            className="p-2 hover:bg-primary/10 rounded-lg transition-colors text-primary"
                            title="Copy Join Link"
                          >
                            <LinkIcon size={16} />
                          </button>
                        </div>
                        <div className="absolute right-0 top-0 w-12 h-full bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
                      </div>

                      <button 
                        onClick={() => {
                          setManagingClass(c);
                        }}
                        className="w-full mt-6 py-2 bg-bg hover:bg-primary hover:text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                      >
                        Manage Class <ChevronRight size={14} />
                      </button>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'students' && (
              <motion.div 
                key="students"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="scholar-card overflow-hidden p-0"
              >
                <div className="p-6 border-b border-line flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={18} />
                    <input 
                      type="text" 
                      placeholder="Search assigned scholars..."
                      className="w-full pl-10 pr-4 py-2 bg-bg border border-line rounded-xl text-sm outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-ink-muted border border-line rounded-xl hover:bg-bg transition-colors">
                      <Filter size={18} /> Filter
                    </button>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-bg/50 border-b border-line">
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-ink-muted">Scholar</th>
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-ink-muted">Class</th>
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-ink-muted">Current Band</th>
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-ink-muted">Status</th>
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-ink-muted">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {students.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-ink-muted italic italic">No students assigned to your roster.</td>
                        </tr>
                      ) : (
                        students.map(s => (
                          <tr key={s.uid} className="hover:bg-bg/20 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <img src={s.avatar} alt="" className="w-8 h-8 rounded-full border border-line" />
                                <div>
                                  <p className="text-sm font-bold text-ink">{s.name}</p>
                                  <p className="text-[10px] text-ink-muted uppercase tracking-tighter">{s.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs font-bold text-primary bg-primary/5 px-2 py-1 rounded-lg">
                                {classes.find(c => c.id === s.classId)?.name || 'Unassigned'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-serif italic font-bold text-secondary">{s.currentBand.toFixed(1)}</span>
                                <div className="h-1.5 w-16 bg-line rounded-full overflow-hidden">
                                  <div className="h-full bg-secondary" style={{ width: `${(s.currentBand/9)*100}%` }} />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full",
                                s.status === 'active' ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                              )}>
                                {s.status}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <button 
                                onClick={() => setActiveTab('evaluations')}
                                className="scholar-button-primary py-2 px-4 text-xs flex items-center gap-2 ml-auto shadow-sm hover:shadow-md transition-shadow"
                              >
                                <PenTool size={14} /> Evaluate Now
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'evaluations' && (
              <motion.div 
                key="evaluations"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-6"
              >
                {attempts.length === 0 ? (
                  <div className="py-24 text-center bg-surface border border-line rounded-2xl">
                    <PenTool size={48} className="mx-auto text-line mb-4" />
                    <p className="text-ink-muted italic font-serif">Queue is empty. No scholarly works pending evaluation.</p>
                  </div>
                ) : (
                  attempts.map(a => (
                    <div key={a.id} className="scholar-card flex flex-col md:flex-row items-center gap-6 group hover:border-secondary transition-all">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0",
                        a.type === 'Writing' ? "bg-blue-600" : a.type === 'Speaking' ? "bg-rose-600" : "bg-emerald-600"
                      )}>
                        {a.type === 'Writing' ? <PenTool size={24} /> : a.type === 'Speaking' ? <Mic2 size={24} /> : <BookOpen size={24} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-ink truncate">{a.title}</h4>
                          <span className={cn(
                            "text-[8px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full",
                            a.evaluation ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                          )}>
                            {a.evaluation ? 'Reviewed' : 'Pending'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <p className="text-xs text-ink-muted font-bold flex items-center gap-1">
                            <Users size={12} /> {students.find(s => s.uid === a.studentId)?.name || 'Unknown Scholar'}
                          </p>
                          <p className="text-xs text-ink-muted font-bold flex items-center gap-1">
                            <Clock size={12} /> {new Date(a.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right mr-4">
                          <p className="text-[10px] uppercase font-bold text-ink-muted">AI Prem-Score</p>
                          <p className="text-xl font-serif italic text-primary">{a.score.toFixed(1)}</p>
                        </div>
                        <button 
                          onClick={() => setReviewingAttempt(a)}
                          className="scholar-button-primary py-2 px-6"
                        >
                          {a.evaluation ? 'Edit Feedback' : 'Evaluate Now'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'tasks' && (
              <motion.div 
                key="tasks"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-6"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-serif italic text-primary">Curated Task Repository</h3>
                  <button 
                    onClick={() => setIsTaskModalOpen(true)}
                    className="scholar-button-secondary py-2 flex items-center gap-2 text-xs"
                  >
                    <Plus size={16} /> Create Task
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {tasks.length === 0 ? (
                    <div className="col-span-full py-24 text-center bg-surface border border-line rounded-2xl">
                      <BookOpen size={48} className="mx-auto text-line mb-4" />
                      <p className="text-ink-muted italic font-serif">Repository is currently empty.</p>
                    </div>
                  ) : (
                    tasks.map(t => (
                      <div key={t.id} className="scholar-card border-line hover:border-primary transition-all group">
                         <div className="flex items-start justify-between mb-4">
                           <div className={cn(
                             "w-10 h-10 rounded-lg flex items-center justify-center text-white",
                             t.type === 'Exam' ? "bg-red-500" : "bg-emerald-500"
                           )}>
                             {t.type === 'Exam' ? <GraduationCap size={20} /> : <Zap size={20} />}
                           </div>
                           <div className="flex flex-col items-end">
                             <span className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">{t.status}</span>
                             <p className="text-xs font-bold text-primary mt-1 flex items-center gap-1">
                               <Clock size={12} /> {new Date(t.dueDate).toLocaleDateString()}
                             </p>
                           </div>
                         </div>
                         <h4 className="font-bold text-ink group-hover:text-primary transition-colors">{t.title}</h4>
                         <p className="text-xs text-ink-muted mt-2 line-clamp-2 leading-relaxed">{t.description}</p>
                         <div className="mt-6 pt-4 border-t border-line flex items-center justify-between">
                           <span className="text-[10px] font-bold text-ink-muted uppercase">
                             Assigned to: {classes.find(c => c.id === t.classId)?.name || 'Global'}
                           </span>
                           <button className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1 uppercase">
                             Edit Task <ChevronRight size={12} />
                           </button>
                         </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isClassModalOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
          >
            <div className="bg-bg w-full max-w-md rounded-3xl shadow-2xl p-6 relative">
              <button 
                onClick={() => setIsClassModalOpen(false)}
                className="absolute top-4 right-4 text-ink-muted hover:text-ink transition-colors"
              >
                <X size={20} />
              </button>
              <div className="flex items-center gap-3 mb-6">
                <Layout className="text-primary" size={24} />
                <h3 className="text-xl font-serif text-primary">Create New Cohort</h3>
              </div>
              <form onSubmit={handleAddClass} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-ink-muted uppercase tracking-widest mb-2">Class Name</label>
                  <input 
                    type="text" 
                    value={newClass.name}
                    onChange={(e) => setNewClass({ name: e.target.value })}
                    className="w-full px-4 py-3 bg-surface border border-line rounded-xl outline-none focus:border-primary transition-all text-sm"
                    placeholder="e.g. Intensive Reading Group A"
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-line">
                  <button 
                    type="button" 
                    onClick={() => setIsClassModalOpen(false)}
                    className="px-4 py-2 font-bold text-sm text-ink-muted hover:text-ink transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="scholar-button-primary disabled:opacity-50"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Class'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
        
        {managingClass && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
          >
            <div className="bg-bg w-full max-w-lg rounded-3xl shadow-2xl p-6 relative">
              <button onClick={() => setManagingClass(null)} className="absolute top-4 right-4 text-ink-muted hover:text-ink transition-colors"><X size={20}/></button>
              <div className="flex items-center gap-3 mb-6">
                <Users className="text-primary" size={24} />
                <div>
                   <h3 className="text-xl font-serif text-primary">Manage Class Roster</h3>
                   <p className="text-xs text-ink-muted uppercase tracking-widest">{managingClass.name}</p>
                </div>
              </div>
              
              <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-2">
                 {students.length === 0 ? (
                   <div className="py-12 text-center text-ink-muted italic border-2 border-dashed border-line rounded-2xl">
                     No scholars available in your roster to enroll.
                   </div>
                 ) : (
                   students.map(s => {
                     const isEnrolled = managingClass.studentIds.includes(s.uid);
                     return (
                       <div key={s.uid} className="flex items-center justify-between p-3 border border-line rounded-xl hover:bg-surface/50 transition-colors">
                          <div className="flex items-center gap-3">
                             <img src={s.avatar} alt="Avatar" className="w-8 h-8 rounded-full border border-line" referrerPolicy="no-referrer" />
                             <div>
                               <p className="font-bold text-sm text-ink">{s.name}</p>
                               <p className="text-[10px] text-ink-muted">{s.email}</p>
                             </div>
                          </div>
                          <button 
                             onClick={() => handleToggleStudentInClass(s.uid, managingClass)}
                             disabled={isSubmitting}
                             className={cn(
                               "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                               isEnrolled 
                                 ? "bg-primary/10 text-primary hover:bg-error/10 hover:text-error" 
                                 : "bg-surface border border-line hover:border-primary text-ink-muted hover:text-primary",
                               isSubmitting && "opacity-50 cursor-not-allowed"
                             )}
                          >
                             {isEnrolled ? (
                               <><Check size={14} /> Enrolled</>
                             ) : (
                               <><Plus size={14} /> Enroll</>
                             )}
                          </button>
                       </div>
                     )
                   })
                 )}
              </div>
              <div className="pt-4 mt-4 flex justify-end">
                <button 
                  onClick={() => setManagingClass(null)}
                  className="px-4 py-2 font-bold text-sm text-ink-muted hover:text-ink transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {isStudentModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsStudentModalOpen(false)}
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-surface w-full max-w-lg rounded-2xl shadow-2xl p-6 md:p-8 border border-line max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-2xl font-serif italic text-primary mb-6">Enroll Scholar</h3>
              <form onSubmit={handleEnrollStudent} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted ml-1 mb-1">Full Name</label>
                    <input 
                      type="text" 
                      required 
                      value={newStudent.name}
                      onChange={(e) => setNewStudent({...newStudent, name: e.target.value})}
                      className="scholar-input"
                      placeholder="Scholar Name"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted ml-1 mb-1">Email Address</label>
                    <input 
                      type="email" 
                      required 
                      value={newStudent.email}
                      onChange={(e) => setNewStudent({...newStudent, email: e.target.value})}
                      className="scholar-input"
                      placeholder="scholar@example.com"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted ml-1 mb-1">Assign to Class</label>
                  <select 
                    value={newStudent.classId}
                    onChange={(e) => setNewStudent({...newStudent, classId: e.target.value})}
                    className="scholar-input"
                  >
                    <option value="">No specific class (Individual)</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsStudentModalOpen(false)} className="flex-1 scholar-button-secondary py-3">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 scholar-button-primary py-3 flex items-center justify-center gap-2">
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Enroll Scholar"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isTaskModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsTaskModalOpen(false)}
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-surface w-full max-w-lg rounded-2xl shadow-2xl p-6 md:p-8 border border-line max-h-[90vh] overflow-y-auto scrollbar-hide"
            >
              <h3 className="text-2xl font-serif italic text-primary mb-6">Create & Assign Task</h3>
              <form onSubmit={handleCreateTask} className="space-y-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted ml-1 mb-1">Task Title</label>
                  <input 
                    type="text" 
                    required 
                    value={newTask.title}
                    onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                    className="scholar-input font-bold"
                    placeholder="e.g., Academic Writing Task 2"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted ml-1 mb-1">Description</label>
                  <textarea 
                    required 
                    value={newTask.description}
                    onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                    className="scholar-input h-32 pt-3 resize-none"
                    placeholder="Provide task details or prompt reference..."
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted ml-1 mb-1">Task Type</label>
                    <select 
                      value={newTask.type}
                      onChange={(e) => setNewTask({...newTask, type: e.target.value as any})}
                      className="scholar-input"
                    >
                      <option value="Practice">Practice</option>
                      <option value="Exam">Mock Exam</option>
                      <option value="Submission">Essay Submission</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted ml-1 mb-1">Due Date</label>
                    <input 
                      type="datetime-local" 
                      required 
                      value={newTask.dueDate}
                      onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                      className="scholar-input"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted ml-1 mb-1">Target Skill</label>
                    <select 
                      value={newTask.skill}
                      onChange={(e) => setNewTask({...newTask, skill: e.target.value as any})}
                      className="scholar-input"
                    >
                      <option value="Writing">Writing</option>
                      <option value="Reading">Reading</option>
                      <option value="Listening">Listening</option>
                      <option value="Speaking">Speaking</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted ml-1 mb-1">Assign to Class</label>
                    <select 
                      value={newTask.classId}
                      onChange={(e) => setNewTask({...newTask, classId: e.target.value})}
                      className="scholar-input"
                    >
                      <option value="">All My Students</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsTaskModalOpen(false)} className="flex-1 scholar-button-secondary py-3">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 scholar-button-primary py-3 flex items-center justify-center gap-2">
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Assign Task"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Evaluation Review Modal */}
      {reviewingAttempt && (
        <AdminEvaluationReview 
          attempt={reviewingAttempt}
          onClose={() => setReviewingAttempt(null)}
          onUpdated={() => {
            // Firestore listener will update the list
            toast.success("Evaluation updated successfully");
          }}
        />
      )}
    </div>
  );
}
