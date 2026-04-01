import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Search, 
  Filter, 
  MoreVertical, 
  Download, 
  Plus,
  Mail,
  CheckCircle2,
  Clock,
  X,
  Loader2,
  FileText,
  Upload,
  Check,
  PenTool,
  GraduationCap,
  Zap,
  AlertCircle,
  Layout,
  Globe,
  MessageSquare,
  Bell,
  TrendingUp,
  Trash2,
  Copy,
  Share2,
  Archive,
  RefreshCcw,
  Link as LinkIcon
} from 'lucide-react';
import AdminEvaluationReview from '../components/AdminEvaluationReview';
import StudentAnalytics from '../components/StudentAnalytics';
import CohortDetails from '../components/CohortDetails';
import SampleResponseManager from '../components/SampleResponseManager';
import { db, handleFirestoreError, OperationType, storage, auth } from '../firebase';
import { collection, onSnapshot, query, orderBy, setDoc, doc, serverTimestamp, addDoc, where as fsWhere, getDocs, limit, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Student } from '../types';
import { cn, generateClassCode } from '../lib/utils';
import { toast } from 'sonner';
import { useAuth } from '../App';

const StatCard = ({ label, value, subtext, icon: Icon }: { label: string, value: string, subtext: string, icon: any }) => (
  <div className="scholar-card flex items-center gap-6">
    <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
      <Icon size={24} />
    </div>
    <div>
      <p className="text-xs font-bold text-ink-muted uppercase tracking-widest">{label}</p>
      <h3 className="text-2xl font-serif italic text-primary mt-1">{value}</h3>
      <p className="text-[10px] text-secondary font-bold mt-1">{subtext}</p>
    </div>
  </div>
);

export default function Administration() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'scholars' | 'teachers' | 'classes' | 'content' | 'evaluations' | 'site' | 'schedule' | 'assignments' | 'samples'>('scholars');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [activeClassMenuId, setActiveClassMenuId] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [newTeacher, setNewTeacher] = useState({ name: '', email: '' });
  const [newClass, setNewClass] = useState({ name: '', teacherId: '' });
  const [assigningStudent, setAssigningStudent] = useState<Student | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [samples, setSamples] = useState<any[]>([]);
  const [isLoadingSamples, setIsLoadingSamples] = useState(false);
  const [scheduledTasks, setScheduledTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, type: 'test' | 'schedule' | 'class' | 'sample' } | null>(null);
  const [newStudent, setNewStudent] = useState({ name: '', email: '', targetBand: 7.5, examDate: '' });
  const [newSchedule, setNewSchedule] = useState({ title: '', description: '', dueDate: '', type: 'Exam' as any, status: 'upcoming' as any, skill: 'Reading' as any });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [attempts, setAttempts] = useState<any[]>([]);
  const [reviewingAttempt, setReviewingAttempt] = useState<any | null>(null);
  const [viewingStudentAnalytics, setViewingStudentAnalytics] = useState<Student | null>(null);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [pages, setPages] = useState<any[]>([]);
  const [blogs, setBlogs] = useState<any[]>([]);
  const [activeCmsTab, setActiveCmsTab] = useState<'pages' | 'blogs' | 'sections'>('pages');
  const [editingPage, setEditingPage] = useState<any | null>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [newAssignment, setNewAssignment] = useState({ title: '', description: '', points: 100, dueDate: '', type: 'Writing' });
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  // Content Upload State
  const [testType, setTestType] = useState<'Academic' | 'General Training'>('Academic');
  const [skillType, setSkillType] = useState<'Reading' | 'Listening' | 'Writing' | 'Speaking'>('Reading');
  const [uploadData, setUploadData] = useState({ title: '', content: '' });
  const [testParts, setTestParts] = useState<{ content: string, imageUrl: string, audioFile: File | null, audioUrl: string }[]>([
    { content: '', imageUrl: '', audioFile: null, audioUrl: '' },
    { content: '', imageUrl: '', audioFile: null, audioUrl: '' },
    { content: '', imageUrl: '', audioFile: null, audioUrl: '' }
  ]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [materialCsvFile, setMaterialCsvFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [viewingTest, setViewingTest] = useState<any | null>(null);
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});

  // Automated Creation of requested "Bsc" class
  useEffect(() => {
    const createBscClass = async () => {
      const isAdminEmail = user?.email?.toLowerCase() === 'nilayrathod000@gmail.com';
      const isAdminUid = user?.uid === 'fl8iYfbOPhczkspJp2IP7qJoEBb2';
      
      if (!user || (!isAdminEmail && !isAdminUid)) return;
      
      // Wait for classes and students to settle
      if (loading || classes.length === 0) return;
      
      const bscExists = classes.some(c => c.name.toLowerCase() === 'bsc');
      if (!bscExists) {
        console.log("[Auto-Maintenance] Creating missing 'Bsc' class...");
        try {
          await addDoc(collection(db, 'classes'), {
            name: 'Bsc',
            teacherId: user.uid,
            studentIds: [],
            createdAt: serverTimestamp()
          });
          toast.success("Automated Maintenance: 'Bsc' class created successfully!");
        } catch (error) {
          console.error("[Auto-Maintenance] Failed to create 'Bsc' class:", error);
        }
      }
    };
    
    const timer = setTimeout(createBscClass, 3000); // Wait 3s for data to settle
    return () => clearTimeout(timer);
  }, [user, classes]);

  useEffect(() => {
    if (editingTestId) return; // Don't reset when editing
    
    let count = 1;
    if (skillType === 'Writing') count = 2;
    if (skillType === 'Reading') count = 3;
    if (skillType === 'Speaking') count = 3;
    if (skillType === 'Listening') count = 4;
    
    setTestParts(Array(count).fill(null).map(() => ({ content: '', imageUrl: '', audioFile: null, audioUrl: '' })));
  }, [skillType, editingTestId]);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('joinDate', 'desc'));
    const unsubscribeUsers = onSnapshot(q, (snapshot) => {
      const studentData = snapshot.docs.map(doc => ({
        ...doc.data(),
        uid: doc.id
      })) as Student[];
      setStudents(studentData.filter(u => u.role === 'student' || !u.role));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const testsQuery = query(collection(db, 'tests'), orderBy('createdAt', 'desc'));
    const unsubscribeTests = onSnapshot(testsQuery, (snapshot) => {
      setTests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const samplesQuery = query(collection(db, 'samples'), orderBy('createdAt', 'desc'));
    const unsubscribeSamples = onSnapshot(samplesQuery, (snapshot) => {
      setSamples(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const scheduleQuery = query(collection(db, 'schedule'), orderBy('dueDate', 'asc'));
    const unsubscribeSchedule = onSnapshot(scheduleQuery, (snapshot) => {
      setScheduledTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeProgress = onSnapshot(collection(db, 'progress'), (snapshot) => {
      const counts: Record<string, number> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.testId) {
          counts[data.testId] = (counts[data.testId] || 0) + 1;
        }
      });
      setAttemptCounts(counts);
    });

    const attemptsQuery = query(collection(db, 'attempts'), orderBy('date', 'desc'));
    const unsubscribeAttempts = onSnapshot(attemptsQuery, (snapshot) => {
      const attemptsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAttempts(attemptsData);
    });

    const classesQuery = query(collection(db, 'classes'), orderBy('name', 'asc'));
    const unsubscribeClasses = onSnapshot(classesQuery, (snapshot) => {
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const teachersQuery = query(collection(db, 'users'), fsWhere('role', 'in', ['teacher', 'admin']));
    const unsubscribeTeachers = onSnapshot(teachersQuery, (snapshot) => {
      const allTeachers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as any));
      // De-duplicate by email, favoring records with isTeacher: true (actual logged in accounts)
      const uniqueTeachers: any[] = [];
      const emailMap = new Map<string, any>();
      
      allTeachers.forEach(t => {
        if (!t.email) return;
        const existing = emailMap.get(t.email);
        if (!existing || (t.isTeacher && !existing.isTeacher) || (t.status === 'active' && existing.status !== 'active')) {
          emailMap.set(t.email, t);
        }
      });
      
      setTeachers(Array.from(emailMap.values()));
    }, (error) => {
      console.error("Error fetching teachers:", error);
    });
    const pagesQuery = query(collection(db, 'pages'), orderBy('updatedAt', 'desc'));

    const unsubscribePages = onSnapshot(pagesQuery, (snapshot) => {
      setPages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const blogsQuery = query(collection(db, 'blogs'), orderBy('updatedAt', 'desc'));
    const unsubscribeBlogs = onSnapshot(blogsQuery, (snapshot) => {
      setBlogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const assignmentsQuery = query(collection(db, 'assignments'), orderBy('dueDate', 'desc'));
    const unsubscribeAssignments = onSnapshot(assignmentsQuery, (snapshot) => {
      setAssignments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const alertsQuery = query(collection(db, 'alerts'), orderBy('timestamp', 'desc'), limit(20));
    const unsubscribeAlerts = onSnapshot(alertsQuery, (snapshot) => {
      setAlerts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeUsers();
      unsubscribeTests();
      unsubscribeSamples();
      unsubscribeSchedule();
      unsubscribeProgress();
      unsubscribeAttempts();
      unsubscribePages();
      unsubscribeBlogs();
      unsubscribeAssignments();
      unsubscribeAlerts();
      unsubscribeClasses();
      unsubscribeTeachers();
    };
  }, []);

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // In a real app, this might send an invite email or create a placeholder account
      // For this demo, we'll create a user record with a generated ID
      const tempId = `scholar-${Math.random().toString(36).substr(2, 9)}`;
      const studentData = {
        uid: tempId,
        name: newStudent.name,
        email: newStudent.email,
        targetBand: newStudent.targetBand,
        examDate: newStudent.examDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        avatar: `https://i.pravatar.cc/150?u=${newStudent.email}`,
        role: 'student',
        currentBand: 0,
        joinDate: new Date().toISOString(),
        status: 'active'
      };

      await setDoc(doc(db, 'users', tempId), studentData);
      
      setIsModalOpen(false);
      setNewStudent({ name: '', email: '', targetBand: 7.5, examDate: '' });
    } catch (error) {
      console.error("Enrollment failed:", error);
      handleFirestoreError(error, OperationType.CREATE, 'users');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnrollTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const teacherEmail = newTeacher.email.trim().toLowerCase();
      // Check if the user already exists in the system with this email
      const userQ = query(collection(db, 'users'), fsWhere('email', '==', teacherEmail));
      const userSnap = await getDocs(userQ);

      if (!userSnap.empty) {
        // User exists — directly promote them to teacher
        const existingUser = userSnap.docs[0];
        const userData = existingUser.data();
        const inviteCode = userData.inviteCode || 'TCH-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        
        await updateDoc(doc(db, 'users', existingUser.id), {
          role: 'teacher',
          isTeacher: true,
          status: 'active',
          inviteCode
        });
        toast.success(`${newTeacher.name} has been promoted to Teacher! Invite Code: ${inviteCode}`, {
          action: {
            label: 'Copy Code',
            onClick: () => {
              navigator.clipboard.writeText(inviteCode);
              toast.success('Code copied to clipboard!');
            }
          },
          duration: 10000
        });
      } else {
        // User doesn't exist yet — pre-register as teacher with a placeholder UID
        const inviteCode = 'TCH-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const placeholderRef = doc(collection(db, 'users'));
        await setDoc(placeholderRef, {
          uid: placeholderRef.id,
          name: newTeacher.name,
          email: teacherEmail,
          role: 'teacher',
          isTeacher: false, // Placeholder
          status: 'pending',
          inviteCode,
          joinDate: new Date().toISOString(),
          avatar: `https://i.pravatar.cc/150?u=${teacherEmail}`
        });
        toast.success(`Teacher invite created! Code: ${inviteCode}`, {
          action: {
            label: 'Copy Code',
            onClick: () => {
              navigator.clipboard.writeText(inviteCode);
              toast.success('Code copied to clipboard!');
            }
          },
          duration: 10000
        });
      }

      setIsTeacherModalOpen(false);
      setNewTeacher({ name: '', email: '' });
    } catch (error: any) {
      console.error("[Teacher Enrollment] Critical Failure:", error);
      const errorMessage = error?.message || "Unknown error";
      toast.error(`Failed to enroll teacher: ${errorMessage.includes('permission') ? 'Permission Denied' : errorMessage}`);
      
      try {
        handleFirestoreError(error, OperationType.CREATE, 'users');
      } catch (e) {}
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[Class Creation] Starting...", newClass);
    
    if (!newClass.name.trim()) {
      toast.error("Class name is required");
      return;
    }
    if (!newClass.teacherId) {
      toast.error("Please select a primary teacher from the list");
      return;
    }

    setIsSubmitting(true);
    try {
      const classData = {
        name: newClass.name.trim(),
        teacherId: newClass.teacherId,
        studentIds: [],
        createdAt: serverTimestamp(),
        status: 'active',
        classCode: generateClassCode()
      };
      
      console.log("[Diagnostic] Initiating class creation...", {
        user: auth.currentUser?.email,
        uid: auth.currentUser?.uid,
        timestamp: new Date().toISOString()
      });

      const docRef = await addDoc(collection(db, 'classes'), classData);
      console.log("[Class Creation] Success! Doc ID:", docRef.id);
      
      toast.success("Class created successfully!");
      setIsClassModalOpen(false);
      setNewClass({ name: '', teacherId: '' });
    } catch (error: any) {
      console.error("[Class Creation] Critical Failure:", error);
      
      let errorMsg = "Failed to create class.";
      if (error.code === 'permission-denied') {
        errorMsg = "Permission Denied. Please ensure you have deployed the latest firestore.rules using 'firebase deploy --only firestore'.";
      } else if (error.message) {
        errorMsg = `Failed to create class: ${error.message}`;
      }
      
      toast.error(errorMsg);
      
      try {
        handleFirestoreError(error, OperationType.CREATE, 'classes');
      } catch (e) {
        // handleFirestoreError throws, but we already showed the toast
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignStudent = async (studentId: string, teacherId: string, classId?: string) => {
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'users', studentId), {
        teacherId,
        classId: classId || null
      });

      if (classId) {
        const classRef = doc(db, 'classes', classId);
        const targetClass = classes.find(c => c.id === classId);
        if (targetClass && !targetClass.studentIds.includes(studentId)) {
          await updateDoc(classRef, {
            studentIds: [...targetClass.studentIds, studentId]
          });
        }
      }

      toast.success("Assignment updated!");
      setAssigningStudent(null);
    } catch (error) {
      toast.error("Update failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetClassCode = async (classId: string) => {
    try {
      const newCode = generateClassCode();
      await updateDoc(doc(db, 'classes', classId), {
        classCode: newCode
      });
      toast.success('Class code updated!');
      setActiveClassMenuId(null);
    } catch (error) {
      console.error('Error resetting class code:', error);
      toast.error('Failed to reset class code');
    }
  };

  const handleAssignTeacherToAttempt = async (attemptId: string, teacherId: string) => {
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'attempts', attemptId), {
        assignedTeacherId: teacherId,
        status: 'pending_review',
        needsAdminReview: true
      });
      toast.success("Teacher assigned to evaluation!");
    } catch (error) {
      console.error("Assignment failed:", error);
      toast.error("Failed to assign teacher.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTestId && !csvFile && !materialCsvFile && (skillType === 'Reading' || skillType === 'Listening')) {
      toast.error("Please upload a CSV answer key or Material CSV.");
      return;
    }

    setIsUploading(true);
    try {
      let answerKeyObj: Record<string, string> = {};
      let finalContent = uploadData.content;

      // Robust CSV parser
      const parseCSVLine = (text: string) => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          if (char === '"' && text[i+1] === '"') {
            current += '"';
            i++;
          } else if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim().replace(/^"|"$/g, ''));
        return result;
      };

      // Handle Material CSV
      if (materialCsvFile) {
        const text = await materialCsvFile.text();
        const lines = text.split('\n').filter(l => l.trim() !== '');
        const headers = parseCSVLine(lines[0]);
        
        const parsedData = lines.slice(1).map(line => {
          const values = parseCSVLine(line);
          const obj: any = {};
          headers.forEach((header, i) => {
            obj[header] = values[i];
          });
          return obj;
        });

        finalContent = JSON.stringify(parsedData);
        
        parsedData.forEach(row => {
          if (row.QuestionNumber && row.CorrectAnswer) {
            answerKeyObj[row.QuestionNumber] = row.CorrectAnswer;
          }
        });
      }

      // Handle Answer Key CSV
      if (csvFile) {
        const text = await csvFile.text();
        const lines = text.split('\n');
        lines.forEach(line => {
          if (!line.trim()) return;
          const cols = parseCSVLine(line);
          const num = cols[0];
          const ans = cols[1];
          if (num && ans && !isNaN(Number(num))) {
            answerKeyObj[num] = ans;
          }
        });
      }

      // Handle manual multi-part entry
      if (!materialCsvFile && testParts.some(p => p.content.trim() || p.audioFile)) {
        const processedParts = await Promise.all(testParts.map(async (p, i) => {
          let audioUrl = p.audioUrl;
          if (p.audioFile) {
            const storageRef = ref(storage, `audio/${Date.now()}_${p.audioFile.name}`);
            const uploadTask = await uploadBytesResumable(storageRef, p.audioFile);
            audioUrl = await getDownloadURL(uploadTask.ref);
          }

          return {
            id: i + 1,
            part: i + 1,
            prompt: p.content,
            content: p.content,
            passage: p.content,
            section: i + 1,
            imageUrl: p.imageUrl,
            audioUrl: audioUrl
          };
        }));
        finalContent = JSON.stringify(processedParts);
      }

      const testData = {
        type: testType,
        skill: skillType,
        title: uploadData.title,
        content: finalContent,
        answerKey: answerKeyObj,
        updatedAt: serverTimestamp(),
        status: 'active'
      };

      if (editingTestId) {
        await setDoc(doc(db, 'tests', editingTestId), testData, { merge: true });
        toast.success("Test updated successfully.");
      } else {
        await addDoc(collection(db, 'tests'), {
          ...testData,
          createdAt: serverTimestamp(),
        });
        toast.success(`Test Data Received. ${testType} status updated. ${skillType} content and Answer Keys are now active for the Student Panel.`, {
          duration: 5000,
          icon: <Check className="text-secondary" />
        });
      }

      setUploadData({ title: '', content: '' });
      setTestParts(skillType === 'Writing' ? [{content:'', imageUrl:'', audioFile: null, audioUrl: ''}, {content:'', imageUrl:'', audioFile: null, audioUrl: ''}] : 
                   skillType === 'Listening' ? Array(4).fill({content:'', imageUrl:'', audioFile: null, audioUrl: ''}) : 
                   Array(3).fill({content:'', imageUrl:'', audioFile: null, audioUrl: ''}));
      setCsvFile(null);
      setEditingTestId(null);
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Failed to upload test data.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditTest = (test: any) => {
    setEditingTestId(test.id);
    setTestType(test.type);
    setSkillType(test.skill);
    setUploadData({ title: test.title, content: test.content });
    try {
      const parsed = JSON.parse(test.content);
      if (Array.isArray(parsed)) {
        setTestParts(parsed.map((p: any) => ({
          content: p.content || p.prompt || p.passage || "",
          imageUrl: p.imageUrl || "",
          audioFile: null,
          audioUrl: p.audioUrl || ""
        })));
      } else {
        setTestParts([{ content: test.content, imageUrl: "", audioFile: null, audioUrl: "" }]);
      }
    } catch (e) {
      setTestParts([{ content: test.content, imageUrl: "", audioFile: null, audioUrl: "" }]);
    }
    setActiveTab('content');
  };

  const handleDeleteTest = (id: string) => {
    setDeleteConfirm({ id, type: 'test' });
  };

  const handleDeleteClass = (id: string) => {
    setDeleteConfirm({ id, type: 'class' });
  };

  const handleCreateSample = async (sampleData: any) => {
    try {
      await addDoc(collection(db, 'samples'), {
        ...sampleData,
        createdAt: serverTimestamp(),
        uploadedBy: user?.uid,
        authorName: user?.name || 'Admin'
      });
      toast.success("Sample response added to library.");
    } catch (error) {
      console.error("Error creating sample:", error);
      toast.error("Failed to add sample.");
    }
  };

  const handleDeleteSample = async (id: string) => {
    setDeleteConfirm({ id, type: 'sample' });
  };

  const handleArchiveClass = async (id: string, currentStatus: string) => {
    setIsSubmitting(true);
    try {
      const newStatus = currentStatus === 'archived' ? 'active' : 'archived';
      await updateDoc(doc(db, 'classes', id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      toast.success(`Class ${newStatus === 'archived' ? 'archived' : 'restored'} successfully.`);
      setActiveClassMenuId(null);
    } catch (error) {
      toast.error("Failed to update class status.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setIsSubmitting(true);
    try {
      if (deleteConfirm.type === 'test') {
        await deleteDoc(doc(db, 'tests', deleteConfirm.id));
        toast.success("Test deleted successfully.");
      } else if (deleteConfirm.type === 'class') {
        await deleteDoc(doc(db, 'classes', deleteConfirm.id));
        toast.success("Class deleted permanently.");
      } else {
        await deleteDoc(doc(db, 'schedule', deleteConfirm.id));
        toast.success("Task deleted.");
      }
      setDeleteConfirm(null);
    } catch (error) {
      toast.error("Failed to delete item.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'schedule'), {
        ...newSchedule,
        createdAt: serverTimestamp()
      });
      toast.success("Task scheduled successfully.");
      setIsScheduleModalOpen(false);
      setNewSchedule({ title: '', description: '', dueDate: '', type: 'Exam' as any, status: 'upcoming' as any, skill: 'Reading' as any });
    } catch (error) {
      toast.error("Failed to schedule task.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSchedule = (id: string) => {
    setDeleteConfirm({ id, type: 'schedule' });
  };

  const downloadExampleCSV = () => {
    const csvContent = "QuestionNumber,Answer\n1,TRUE\n2,FALSE\n3,NOT GIVEN\n4,B\n5,C\n6,environment";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'ielts_answer_key_example.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadMaterialExampleCSV = () => {
    const csvContent = "Section,Title,Content,QuestionNumber,QuestionText,OptionA,OptionB,OptionC,OptionD,CorrectAnswer\n1,Climate Change,Passage text here...,1,What is the main cause?,Pollution,Deforestation,Greenhouse gases,Solar flares,Greenhouse gases";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'ielts_material_example.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const filteredStudents = students.filter(s => 
    (s.role === 'student' || !s.role) && (
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.email.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const totalScholarsCount = students.filter(s => s.role === 'student' || !s.role).length;

  const avgBand = totalScholarsCount > 0 
    ? (students.filter(s => s.role === 'student' || !s.role).reduce((acc, s) => acc + (s.currentBand || 0), 0) / totalScholarsCount).toFixed(1)
    : '0.0';

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col gap-8"
    >
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-6">
          <div>
            <h2 className="text-3xl font-serif italic text-primary">Institutional Control</h2>
            <p className="text-ink-muted mt-1">Manage scholars and examination content from a unified interface.</p>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-12 h-12 rounded-xl bg-surface border border-line flex items-center justify-center text-ink-muted hover:text-primary hover:border-primary transition-all relative"
            >
              <Bell size={20} />
              {alerts.filter(a => !a.read).length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-secondary text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-bg animate-pulse">
                  {alerts.filter(a => !a.read).length}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-14 left-0 w-80 bg-bg border border-line rounded-2xl shadow-2xl z-50 overflow-hidden"
                >
                  <div className="p-4 border-b border-line flex items-center justify-between bg-surface/50">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-ink">Notifications</h4>
                    {alerts.some(a => !a.read) && (
                      <button 
                        onClick={async () => {
                          const { updateDoc, doc } = await import('firebase/firestore');
                          for (const alert of alerts.filter(a => !a.read)) {
                            await updateDoc(doc(db, 'alerts', alert.id), { read: true });
                          }
                        }}
                        className="text-[10px] font-bold text-primary hover:underline"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="max-h-[400px] overflow-y-auto divide-y divide-line">
                    {alerts.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell size={32} className="mx-auto text-line mb-2" />
                        <p className="text-xs text-ink-muted italic">No new activity</p>
                      </div>
                    ) : (
                      alerts.map(alert => (
                        <div 
                          key={alert.id}
                          className={cn(
                            "p-4 hover:bg-surface transition-colors cursor-pointer group",
                            !alert.read && "bg-primary/5"
                          )}
                          onClick={async () => {
                            const { updateDoc, doc } = await import('firebase/firestore');
                            if (!alert.read) await updateDoc(doc(db, 'alerts', alert.id), { read: true });
                            
                            // Extract ID from link if possible or navigate
                            if (alert.link.includes('id=')) {
                              const attemptId = alert.link.split('id=')[1];
                              const attempt = attempts.find(a => a.id === attemptId);
                              if (attempt) {
                                setReviewingAttempt(attempt);
                                setActiveTab('evaluations');
                              }
                            }
                            setShowNotifications(false);
                          }}
                        >
                          <div className="flex gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                              alert.type === 'Writing' ? "bg-blue-100 text-blue-600" :
                              alert.type === 'Speaking' ? "bg-purple-100 text-purple-600" :
                              "bg-emerald-100 text-emerald-600"
                            )}>
                              {alert.type === 'Writing' ? <PenTool size={14} /> : 
                               alert.type === 'Speaking' ? <MessageSquare size={14} /> : 
                               <GraduationCap size={14} />}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-ink mb-1">{alert.message}</p>
                              <p className="text-[10px] text-ink-muted flex items-center gap-1">
                                <Clock size={10} />
                                {alert.timestamp?.toDate ? new Date(alert.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {alerts.length > 0 && (
                    <div className="p-3 bg-surface/30 border-t border-line text-center">
                      <button 
                        onClick={() => {
                          setActiveTab('evaluations');
                          setShowNotifications(false);
                        }}
                        className="text-[10px] font-bold text-ink-muted hover:text-primary uppercase tracking-widest"
                      >
                        View All Activity
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="flex gap-3">
          {activeTab === 'scholars' ? (
            <>
              <button className="bg-surface border border-line px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-bg transition-all">
                <Download size={18} /> Export Data
              </button>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-primary-light transition-all shadow-lg shadow-primary/20"
              >
                <Plus size={18} /> Enroll Scholar
              </button>
            </>
          ) : (
            <button 
              onClick={() => {
                const el = document.getElementById('active-content-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-surface border border-line px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-bg transition-all"
            >
              <FileText size={18} /> View Active Tests
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-8 border-b border-line overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveTab('scholars')}
          className={cn(
            "pb-4 text-[10px] font-bold tracking-widest uppercase transition-all relative whitespace-nowrap",
            activeTab === 'scholars' ? "text-primary" : "text-ink-muted hover:text-ink"
          )}
        >
          Scholars
          {activeTab === 'scholars' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
        <button 
          onClick={() => setActiveTab('teachers')}
          className={cn(
            "pb-4 text-[10px] font-bold tracking-widest uppercase transition-all relative whitespace-nowrap",
            activeTab === 'teachers' ? "text-primary" : "text-ink-muted hover:text-ink"
          )}
        >
          Teachers
          {activeTab === 'teachers' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
        <button 
          onClick={() => setActiveTab('classes')}
          className={cn(
            "pb-4 text-[10px] font-bold tracking-widest uppercase transition-all relative whitespace-nowrap",
            activeTab === 'classes' ? "text-primary" : "text-ink-muted hover:text-ink"
          )}
        >
          Classes
          {activeTab === 'classes' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
        <button 
          onClick={() => setActiveTab('content')}
          className={cn(
            "pb-4 text-[10px] font-bold tracking-widest uppercase transition-all relative whitespace-nowrap",
            activeTab === 'content' ? "text-primary" : "text-ink-muted hover:text-ink"
          )}
        >
          Content
          {activeTab === 'content' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
        <button 
          onClick={() => setActiveTab('schedule')}
          className={cn(
            "pb-4 text-[10px] font-bold tracking-widest uppercase transition-all relative whitespace-nowrap",
            activeTab === 'schedule' ? "text-primary" : "text-ink-muted hover:text-ink"
          )}
        >
          Schedule
          {activeTab === 'schedule' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
        <button 
          onClick={() => setActiveTab('evaluations')}
          className={cn(
            "pb-4 text-[10px] font-bold tracking-widest uppercase transition-all relative whitespace-nowrap",
            activeTab === 'evaluations' ? "text-primary" : "text-ink-muted hover:text-ink"
          )}
        >
          Evaluations
          {activeTab === 'evaluations' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
        <button 
          onClick={() => setActiveTab('assignments')}
          className={cn(
            "pb-4 text-[10px] font-bold tracking-widest uppercase transition-all relative whitespace-nowrap",
            activeTab === 'assignments' ? "text-primary" : "text-ink-muted hover:text-ink"
          )}
        >
          Assignments
          {activeTab === 'assignments' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
        <button 
          onClick={() => setActiveTab('site')}
          className={cn(
            "pb-4 text-[10px] font-bold tracking-widest uppercase transition-all relative whitespace-nowrap",
            activeTab === 'site' ? "text-primary" : "text-ink-muted hover:text-ink"
          )}
        >
          Site Builder
          {activeTab === 'site' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
        <button 
          onClick={() => setActiveTab('samples')}
          className={cn(
            "pb-4 text-[10px] font-bold tracking-widest uppercase transition-all relative whitespace-nowrap",
            activeTab === 'samples' ? "text-primary" : "text-ink-muted hover:text-ink"
          )}
        >
          AI Samples
          {activeTab === 'samples' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
      </div>

      <div className="flex justify-end mt-4 mb-2">
        {activeTab === 'teachers' && (
          <button onClick={() => setIsTeacherModalOpen(true)} className="scholar-button-primary py-2 flex items-center gap-2">
            <Plus size={16} /> Enroll Teacher
          </button>
        )}
        {activeTab === 'classes' && (
          <button onClick={() => setIsClassModalOpen(true)} className="scholar-button-primary py-2 flex items-center gap-2">
            <Plus size={16} /> Create Class
          </button>
        )}
      </div>

      {activeTab === 'scholars' ? (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard label="Total Scholars" value={totalScholarsCount.toLocaleString()} subtext="+12% from last month" icon={Users} />
            <StatCard label="Avg. Band Score" value={avgBand} subtext="Top 5% globally" icon={CheckCircle2} />
            <StatCard label="Active Now" value="42" subtext="Live in practice sessions" icon={Clock} />
          </div>

          {/* Student Table */}
          <div className="scholar-card p-0 overflow-hidden">
            <div className="p-6 border-b border-line flex items-center justify-between bg-surface">
              <div className="flex items-center gap-4 bg-bg px-4 py-2 rounded-lg border border-line w-80">
                <Search size={18} className="text-ink-muted" />
                <input 
                  type="text" 
                  placeholder="Filter by name or email..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm w-full text-ink"
                />
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-ink-muted hover:text-primary hover:bg-bg rounded-lg transition-all">
                  <Filter size={20} />
                </button>
                <button className="p-2 text-ink-muted hover:text-primary hover:bg-bg rounded-lg transition-all">
                  <MoreVertical size={20} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-12 flex items-center justify-center">
                  <Loader2 className="animate-spin text-primary" size={32} />
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface/50">
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-ink-muted">Scholar</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-ink-muted">Status</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-ink-muted">Current Band</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-ink-muted">Target</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-ink-muted">Join Date</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-ink-muted text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filteredStudents.map(student => (
                      <tr key={student.uid} className="hover:bg-surface/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img 
                              src={student.avatar} 
                              alt={student.name} 
                              className="w-10 h-10 rounded-full border border-line"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <p className="text-sm font-bold text-ink">{student.name}</p>
                              <p className="text-xs text-ink-muted">{student.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            student.status === 'active' ? "bg-secondary/10 text-secondary" : "bg-ink-muted/10 text-ink-muted"
                          )}>
                            {student.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-serif italic text-primary">{student.currentBand?.toFixed(1) || '0.0'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-serif italic text-ink-muted">{student.targetBand?.toFixed(1) || '0.0'}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-ink-muted">
                          {new Date(student.joinDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right overflow-visible">
                            <div className="relative">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(activeMenuId === student.uid ? null : student.uid);
                                }}
                                className={cn(
                                  "p-2 rounded-lg border border-transparent transition-all",
                                  activeMenuId === student.uid 
                                    ? "text-primary bg-bg border-line shadow-inner" 
                                    : "text-ink-muted hover:text-primary hover:bg-bg hover:border-line"
                                )}
                              >
                                <MoreVertical size={16} />
                              </button>

                              <AnimatePresence>
                                {activeMenuId === student.uid && (
                                  <>
                                    <div 
                                      className="fixed inset-0 z-30" 
                                      onClick={() => setActiveMenuId(null)} 
                                    />
                                    <motion.div 
                                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                      className="absolute right-0 top-12 w-48 bg-surface border border-line rounded-xl shadow-2xl z-40 py-2 overflow-hidden"
                                    >
                                      <button 
                                        onClick={() => {
                                          setViewingStudentAnalytics(student);
                                          setActiveMenuId(null);
                                        }}
                                        className="w-full px-4 py-2.5 text-left text-xs font-bold text-ink hover:bg-primary/5 hover:text-primary flex items-center gap-3 transition-colors"
                                      >
                                        <TrendingUp size={14} /> View Analytics
                                      </button>
                                      <button 
                                        onClick={() => {
                                          setAssigningStudent(student);
                                          setActiveMenuId(null);
                                        }}
                                        className="w-full px-4 py-2.5 text-left text-xs font-bold text-ink hover:bg-emerald-50 hover:text-emerald-600 flex items-center gap-3 transition-colors"
                                      >
                                        <Plus size={14} /> Assign Teacher/Class
                                      </button>
                                      <div className="h-px bg-line my-1" />
                                      <button 
                                        onClick={() => {
                                          if (confirm(`Are you sure you want to delete ${student.name}?`)) {
                                            deleteDoc(doc(db, 'users', student.uid))
                                              .then(() => toast.success('Scholar deleted'))
                                              .catch(() => toast.error('Failed to delete scholar'));
                                          }
                                          setActiveMenuId(null);
                                        }}
                                        className="w-full px-4 py-2.5 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                                      >
                                        <Trash2 size={14} /> Delete Scholar
                                      </button>
                                    </motion.div>
                                  </>
                                )}
                              </AnimatePresence>
                            </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="p-6 bg-surface/30 border-t border-line flex items-center justify-between">
              <p className="text-xs text-ink-muted">Showing {filteredStudents.length} of {totalScholarsCount} scholars</p>
              <div className="flex gap-2">
                <button className="px-3 py-1 text-xs font-bold border border-line rounded bg-surface hover:bg-bg disabled:opacity-50" disabled>Previous</button>
                <button className="px-3 py-1 text-xs font-bold border border-line rounded bg-surface hover:bg-bg">Next</button>
              </div>
            </div>
          </div>

          {/* Student Analytics Modal/Section */}
          <AnimatePresence>
            {viewingStudentAnalytics && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
              >
                <div className="bg-bg w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl relative">
                  <div className="sticky top-0 z-10 bg-bg/80 backdrop-blur-md p-6 border-b border-line flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <img 
                        src={viewingStudentAnalytics.avatar} 
                        alt={viewingStudentAnalytics.name} 
                        className="w-12 h-12 rounded-2xl border-2 border-primary/20"
                      />
                      <div>
                        <h3 className="text-xl font-serif italic text-primary">{viewingStudentAnalytics.name}'s Analytics</h3>
                        <p className="text-xs text-ink-muted uppercase tracking-widest font-bold">Comprehensive Performance Overview</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setViewingStudentAnalytics(null)}
                      className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-ink-muted hover:text-red-500 hover:bg-red-50 transition-all"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="p-8">
                    <StudentAnalytics 
                      student={viewingStudentAnalytics} 
                      attempts={attempts} 
                    />
                  </div>
                </div>
              </motion.div>
            )}
        </AnimatePresence>
        </>
      ) : activeTab === 'teachers' ? (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button 
              onClick={async () => {
                if (!confirm("This will find and remove duplicate placeholder accounts for teachers who have already signed in. Continue?")) return;
                try {
                  const q = query(collection(db, 'users'), fsWhere('role', '==', 'teacher'));
                  const snap = await getDocs(q);
                  const emailGroups = new Map<string, any[]>();
                  
                  snap.docs.forEach(d => {
                    const data = { uid: d.id, ...d.data() } as any;
                    if (data.email) {
                      const group = emailGroups.get(data.email) || [];
                      group.push(data);
                      emailGroups.set(data.email, group);
                    }
                  });

                  const batch = writeBatch(db);
                  let count = 0;

                  emailGroups.forEach((docs, email) => {
                    if (docs.length > 1) {
                      // Keep the one with isTeacher: true, or the first one if none have it
                      const keeper = docs.find(d => d.isTeacher) || docs[0];
                      docs.forEach(d => {
                        if (d.uid !== keeper.uid) {
                          batch.delete(doc(db, 'users', d.uid));
                          count++;
                        }
                      });
                    }
                  });

                  if (count > 0) {
                    await batch.commit();
                    alert(`Cleaned up ${count} duplicate records.`);
                  } else {
                    alert("No duplicates found.");
                  }
                } catch (err) {
                  console.error(err);
                  alert("Error cleaning duplicates.");
                }
              }}
              className="px-4 py-2 bg-red-500/10 text-red-500 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
            >
              Clean Duplicates
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teachers.length === 0 ? (
              <div className="col-span-full py-24 text-center bg-surface border border-line rounded-2xl border-dashed">
                <Users size={48} className="mx-auto text-line mb-4" />
                <p className="text-ink-muted italic font-serif text-lg">No teachers enrolled in the system.</p>
              </div>
            ) : (
              teachers.map(t => (
                <div key={t.uid} className="scholar-card group hover:border-primary transition-all">
                  <div className="flex items-center gap-4 mb-4">
                    <img src={t.avatar} alt="" className="w-12 h-12 rounded-xl border border-line" />
                    <div>
                      <h4 className="font-bold text-ink">{t.name}</h4>
                      <p className="text-[10px] text-ink-muted uppercase tracking-widest">{t.email}</p>
                      {t.inviteCode && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[10px] font-mono bg-bg border border-line px-2 py-0.5 rounded text-primary font-bold">
                            {t.inviteCode}
                          </span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(t.inviteCode);
                              toast.success('Invite code copied!');
                            }}
                            className="p-1 hover:text-primary transition-colors text-ink-muted"
                            title="Copy Invite Code"
                          >
                            <Copy size={12} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const text = `Hello ${t.name}, you have been enrolled as a Teacher on IELTS Scholar. Join here: ${window.location.origin}/login and use your Google account. Your invite code (if needed) is: ${t.inviteCode}`;
                              navigator.clipboard.writeText(text);
                              toast.success('Invitation message copied to clipboard!');
                            }}
                            className="p-1 hover:text-emerald-500 transition-colors text-ink-muted"
                            title="Share Invitation"
                          >
                            <Share2 size={12} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Are you sure you want to delete ${t.name}? This will NOT delete their students or classes, but they will lose teacher access.`)) {
                                deleteDoc(doc(db, 'users', t.uid))
                                  .then(() => toast.success('Teacher removed'))
                                  .catch(() => toast.error('Failed to remove teacher'));
                              }
                            }}
                            className="p-1 hover:text-red-500 transition-colors text-ink-muted"
                            title="Remove Teacher"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-line">
                    <div>
                      <p className="text-[10px] font-bold text-ink-muted uppercase">Students</p>
                      <p className="text-sm font-serif italic text-primary">{students.filter(s => s.teacherId === t.uid).length}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-ink-muted uppercase">Classes</p>
                      <p className="text-sm font-serif italic text-secondary">{classes.filter(c => c.teacherId === t.uid).length}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : activeTab === 'classes' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.length === 0 ? (
              <div className="col-span-full py-24 text-center bg-surface border border-line rounded-2xl border-dashed">
                <Layout size={48} className="mx-auto text-line mb-4" />
                <p className="text-ink-muted italic font-serif text-lg">No academic cohorts established.</p>
              </div>
            ) : (
              classes.map(c => (
                <div key={c.id} className={cn(
                  "scholar-card group hover:border-secondary transition-all relative overflow-visible",
                  c.status === 'archived' && "opacity-60 grayscale-[0.5]"
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-lg font-serif italic text-primary">{c.name}</h4>
                      {c.status === 'archived' && (
                        <span className="text-[10px] bg-ink-muted/10 text-ink-muted px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">Archived</span>
                      )}
                    </div>
                    
                    <div className="relative">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveClassMenuId(activeClassMenuId === c.id ? null : c.id);
                        }}
                        className={cn(
                          "p-1.5 rounded-lg transition-all",
                          activeClassMenuId === c.id ? "bg-secondary text-white" : "hover:bg-secondary/10 text-ink-muted"
                        )}
                      >
                        <MoreVertical size={16} />
                      </button>

                      <AnimatePresence>
                        {activeClassMenuId === c.id && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setActiveClassMenuId(null)} />
                            <motion.div
                              initial={{ opacity: 0, y: 5, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 5, scale: 0.95 }}
                              className="absolute right-0 top-full mt-2 w-48 bg-surface border border-line rounded-xl shadow-2xl z-40 py-2"
                            >
                              <button 
                                onClick={() => handleArchiveClass(c.id, c.status)}
                                className="w-full px-4 py-2 text-left text-xs font-bold text-ink hover:bg-secondary/5 hover:text-secondary flex items-center gap-2 transition-colors"
                              >
                                {c.status === 'archived' ? <Check size={14} /> : <Archive size={14} />}
                                {c.status === 'archived' ? 'Restore Class' : 'Archive Class'}
                              </button>
                              <button 
                                onClick={() => handleResetClassCode(c.id)}
                                className="w-full px-4 py-2 text-left text-xs font-bold text-ink hover:bg-secondary/5 hover:text-secondary flex items-center gap-2 transition-colors"
                              >
                                <RefreshCcw size={14} /> 
                                {c.classCode ? 'Reset Join Code' : 'Generate Join Code'}
                              </button>
                              <div className="h-px bg-line my-1" />
                              <button 
                                onClick={() => handleDeleteClass(c.id)}
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
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-[10px] font-bold text-secondary bg-secondary/10 px-2 py-1 rounded">
                      {c.studentIds?.length || 0} Students
                    </span>
                    <span className="text-[10px] text-ink-muted uppercase tracking-widest font-bold">
                      • {teachers.find(t => t.uid === c.teacherId)?.name || 'Unassigned'}
                    </span>
                  </div>

                  {/* Class Code Section */}
                  <div className="mb-4 p-3 bg-bg border border-line rounded-xl flex items-center justify-between group/code relative overflow-hidden">
                    <div className="absolute inset-0 bg-secondary/5 opacity-0 group-hover/code:opacity-100 transition-opacity" />
                    <div>
                      <p className="text-[10px] font-bold text-ink-muted uppercase tracking-tighter">Join Code</p>
                      <p className="text-sm font-mono font-bold text-secondary">
                        {c.classCode || 'NO CODE'}
                      </p>
                    </div>
                    {c.classCode && (
                      <div className="flex gap-1 items-center">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(c.classCode);
                            toast.success('Code copied!');
                          }}
                          className="p-1.5 rounded-lg hover:bg-white text-ink-muted hover:text-secondary transition-all"
                          title="Copy Code"
                        >
                          <Copy size={12} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const link = `${window.location.origin}/join/${c.classCode}`;
                            navigator.clipboard.writeText(link);
                            toast.success('Invite link copied!');
                          }}
                          className="p-1.5 rounded-lg hover:bg-white text-ink-muted hover:text-secondary transition-all"
                          title="Copy Invite Link"
                        >
                          <LinkIcon size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => setSelectedCohortId(c.id)}
                    className="w-full mt-2 py-2 bg-bg hover:bg-secondary hover:text-white rounded-lg text-xs font-bold transition-all"
                  >
                    View Cohort Details
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : activeTab === 'evaluations' ? (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-serif italic text-primary">Pending Evaluations</h3>
              <p className="text-xs text-ink-muted uppercase tracking-widest font-bold">Review and mark student submissions</p>
            </div>
            <div className="flex items-center gap-2 bg-secondary/10 px-4 py-2 rounded-lg border border-secondary/20">
              <AlertCircle size={16} className="text-secondary" />
              <span className="text-xs font-bold text-secondary uppercase tracking-tighter">
                {attempts.filter(a => a.needsAdminReview).length} Submissions Pending
              </span>
            </div>
          </div>

          <div className="scholar-card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface/50">
                    <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-ink-muted">Scholar</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-ink-muted">Test Module</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-ink-muted">Submission Date</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-ink-muted">AI Score</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-ink-muted">Status</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-ink-muted">Reviewer</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-ink-muted text-right">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {attempts.map(attempt => (
                    <tr key={attempt.id} className="hover:bg-surface/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                            {attempt.studentId?.slice(-2).toUpperCase()}
                          </div>
                          <span className="text-sm font-bold text-ink">{attempt.studentName || 'Scholar'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                            attempt.type === 'Writing' ? "bg-amber-100 text-amber-700" :
                            attempt.type === 'Speaking' ? "bg-blue-100 text-blue-700" :
                            "bg-emerald-100 text-emerald-700"
                          )}>
                            {attempt.type}
                          </span>
                          <span className="text-xs text-ink-muted truncate max-w-[200px] italic">{attempt.title}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-ink-muted">
                        {new Date(attempt.date).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-serif italic text-secondary">{attempt.score?.toFixed(1) || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider",
                          attempt.status === 'reviewed' ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                        )}>
                          {attempt.status || 'pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          className="bg-bg border border-line rounded-lg text-[10px] font-bold px-2 py-1 outline-none focus:border-primary transition-all w-32"
                          value={attempt.assignedTeacherId || ""}
                          onChange={(e) => handleAssignTeacherToAttempt(attempt.id, e.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {teachers.map(t => (
                            <option key={t.uid} value={t.uid}>{t.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                        <button 
                          onClick={() => setReviewingAttempt(attempt)}
                          className="px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-primary text-white hover:bg-primary-light transition-all shadow-lg shadow-primary/10"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                  {attempts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-ink-muted italic">No submissions found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'assignments' ? (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-serif italic text-primary">Classroom Assignments</h3>
              <p className="text-xs text-ink-muted uppercase tracking-widest font-bold">Create and manage tasks for your scholars</p>
            </div>
            <button 
              onClick={() => setIsAssignmentModalOpen(true)}
              className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-primary-light transition-all shadow-lg shadow-primary/20"
            >
              <Plus size={18} /> Create Assignment
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assignments.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-surface/30 rounded-3xl border-2 border-dashed border-line">
                <GraduationCap size={48} className="mx-auto text-line mb-4" />
                <h4 className="text-lg font-serif italic text-ink-muted mb-2">No assignments yet</h4>
                <p className="text-xs text-ink-muted mb-6">Start by creating a task for your students to complete.</p>
                <button 
                  onClick={() => setIsAssignmentModalOpen(true)}
                  className="text-primary font-bold hover:underline"
                >
                  Create your first assignment
                </button>
              </div>
            ) : (
              assignments.map(assignment => (
                <div key={assignment.id} className="scholar-card border-line hover:border-primary/30 transition-all group">
                  <div className="flex items-center justify-between mb-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      assignment.type === 'Writing' ? "bg-amber-100 text-amber-600" :
                      assignment.type === 'Speaking' ? "bg-blue-100 text-blue-600" :
                      "bg-emerald-100 text-emerald-600"
                    )}>
                      {assignment.type === 'Writing' ? <PenTool size={20} /> : 
                       assignment.type === 'Speaking' ? <MessageSquare size={20} /> : 
                       <FileText size={20} />}
                    </div>
                    <span className="text-[10px] font-bold text-ink-muted bg-surface px-2 py-1 rounded border border-line">
                      {assignment.points} Points
                    </span>
                  </div>
                  <h4 className="font-bold text-ink mb-1">{assignment.title}</h4>
                  <p className="text-xs text-ink-muted mb-4 line-clamp-2">{assignment.description}</p>
                  <div className="flex items-center justify-between border-t border-line pt-4 mt-auto">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-ink-muted uppercase">
                      <Clock size={12} />
                      Due {new Date(assignment.dueDate).toLocaleDateString()}
                    </div>
                    <div className="flex -space-x-2">
                       {/* Placeholder for submitted students avatars */}
                       {[1,2,3].map(i => (
                         <div key={i} className="w-6 h-6 rounded-full border-2 border-bg bg-line flex items-center justify-center text-[8px] font-bold text-ink-muted">
                           {String.fromCharCode(64 + i)}
                         </div>
                       ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : activeTab === 'site' ? (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-serif italic text-primary">Site Builder</h3>
              <p className="text-xs text-ink-muted uppercase tracking-widest font-bold">Manage landing pages, layouts, and blogs</p>
            </div>
            {!editingPage && (
              <button 
                onClick={() => setEditingPage({ 
                  title: '', 
                  path: '', 
                  sections: [], 
                  status: 'draft',
                  type: activeCmsTab === 'blogs' ? 'blog' : 'page',
                  category: activeCmsTab === 'blogs' ? 'News' : undefined
                })}
                className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-primary-light transition-all shadow-lg shadow-primary/20"
              >
                <Plus size={18} /> {activeCmsTab === 'pages' ? 'Create Page' : 'Create Blog Post'}
              </button>
            )}
          </div>

          {!editingPage ? (
            <>
              <div className="flex gap-6 border-b border-line">
                <button 
                  onClick={() => setActiveCmsTab('pages')}
                  className={cn(
                    "pb-3 text-[10px] font-bold tracking-widest uppercase transition-all relative",
                    activeCmsTab === 'pages' ? "text-primary" : "text-ink-muted hover:text-ink"
                  )}
                >
                  Pages
                  {activeCmsTab === 'pages' && <motion.div layoutId="cms-tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
                </button>
                <button 
                  onClick={() => setActiveCmsTab('blogs')}
                  className={cn(
                    "pb-3 text-[10px] font-bold tracking-widest uppercase transition-all relative",
                    activeCmsTab === 'blogs' ? "text-primary" : "text-ink-muted hover:text-ink"
                  )}
                >
                  Blog Posts
                  {activeCmsTab === 'blogs' && <motion.div layoutId="cms-tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
                </button>
                <button 
                  onClick={() => setActiveCmsTab('sections')}
                  className={cn(
                    "pb-3 text-[10px] font-bold tracking-widest uppercase transition-all relative",
                    activeCmsTab === 'sections' ? "text-primary" : "text-ink-muted hover:text-ink"
                  )}
                >
                  Global Sections
                  {activeCmsTab === 'sections' && <motion.div layoutId="cms-tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
                </button>
              </div>

              {activeCmsTab === 'pages' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pages.length === 0 ? (
                    <div className="col-span-full py-12 text-center bg-surface/50 rounded-2xl border-2 border-dashed border-line">
                      <Globe size={48} className="mx-auto text-line mb-4" />
                      <p className="text-ink-muted mb-4 font-serif italic">No custom pages created yet.</p>
                      <button 
                        onClick={() => setEditingPage({ title: '', path: '', sections: [], status: 'draft', type: 'page' })}
                        className="text-primary font-bold hover:underline"
                      >
                        Start by creating your first page
                      </button>
                    </div>
                  ) : (
                    pages.map(page => (
                      <div 
                        key={page.id}
                        onClick={() => setEditingPage(page)}
                        className="scholar-card border-line hover:border-primary/30 cursor-pointer transition-all group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
                          <Globe size={20} />
                        </div>
                        <h4 className="font-bold text-ink mb-1">{page.title}</h4>
                        <p className="text-[10px] text-ink-muted uppercase tracking-widest font-bold mb-4">{page.path}</p>
                        <div className="flex items-center justify-between border-t border-line pt-4">
                          <span className={cn(
                            "text-[10px] uppercase tracking-widest font-bold",
                            page.status === 'published' ? "text-emerald-500" : "text-amber-500"
                          )}>
                            {page.status}
                          </span>
                          <span className="text-[10px] text-ink-muted">
                            {page.updatedAt?.toDate ? new Date(page.updatedAt.toDate()).toLocaleDateString() : 'Just now'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : activeCmsTab === 'blogs' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {blogs.length === 0 ? (
                    <div className="col-span-full py-12 text-center bg-surface/50 rounded-2xl border-2 border-dashed border-line">
                      <MessageSquare size={48} className="mx-auto text-line mb-4" />
                      <p className="text-ink-muted mb-4 font-serif italic">The scholarship blog is empty.</p>
                      <button 
                        onClick={() => setEditingPage({ title: '', category: 'News', sections: [], status: 'draft', type: 'blog' })}
                        className="text-primary font-bold hover:underline"
                      >
                        Write your first article
                      </button>
                    </div>
                  ) : (
                    blogs.map(post => (
                      <div 
                        key={post.id}
                        onClick={() => setEditingPage({...post, type: 'blog'})}
                        className="scholar-card flex gap-6 items-start hover:border-primary/30 cursor-pointer transition-all"
                      >
                        {post.coverImage && (
                          <img src={post.coverImage} className="w-24 h-24 rounded-lg object-cover" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[8px] bg-primary/10 text-primary px-2 py-0.5 rounded uppercase font-extrabold tracking-widest">{post.category}</span>
                            <span className="text-[10px] text-ink-muted">{new Date(post.updatedAt?.toDate?.() || Date.now()).toLocaleDateString()}</span>
                          </div>
                          <h4 className="font-bold text-ink mb-2 line-clamp-1">{post.title}</h4>
                          <p className="text-xs text-ink-muted line-clamp-2">{post.excerpt || 'No excerpt available.'}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="scholar-card bg-surface/30 border-dashed">
                    <div className="w-10 h-10 rounded-lg bg-ink/5 flex items-center justify-center text-ink-muted mb-4">
                      <Layout size={20} />
                    </div>
                    <h4 className="font-bold text-ink mb-1 italic font-serif">Header Layout</h4>
                    <p className="text-xs text-ink-muted">Configure the global navigation menu.</p>
                  </div>
                  <div className="scholar-card bg-surface/30 border-dashed">
                    <div className="w-10 h-10 rounded-lg bg-ink/5 flex items-center justify-center text-ink-muted mb-4">
                      <Layout size={20} />
                    </div>
                    <h4 className="font-bold text-ink mb-1 italic font-serif">Footer Blocks</h4>
                    <p className="text-xs text-ink-muted">Manage footer links and social branding.</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="scholar-card bg-surface/20 min-h-[600px] flex flex-col p-0 overflow-hidden relative">
              <div className="p-4 border-b border-line bg-surface/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setEditingPage(null)}
                    className="p-2 hover:bg-bg rounded-lg text-ink-muted"
                  >
                    <X size={20} />
                  </button>
                  <input 
                    type="text"
                    value={editingPage.title}
                    onChange={(e) => setEditingPage({...editingPage, title: e.target.value})}
                    placeholder="Untilted Page..."
                    className="bg-transparent border-none outline-none font-serif italic text-xl text-primary w-64"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-tighter text-ink-muted px-2 py-1 bg-surface rounded-md border border-line">
                    Auto-saving...
                  </span>
                  <button 
                    className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-light transition-all flex items-center gap-2"
                    onClick={async () => {
                      const collectionName = editingPage.type === 'blog' ? 'blogs' : 'pages';
                      const id = editingPage.id || `cms-${Math.random().toString(36).substr(2, 9)}`;
                      await setDoc(doc(db, collectionName, id), {
                        ...editingPage,
                        status: 'published',
                        updatedAt: serverTimestamp()
                      }, { merge: true });
                      setEditingPage(null);
                    }}
                  >
                    <Check size={16} /> Publish
                  </button>
                </div>
              </div>

              <div className="flex-1 p-12 overflow-y-auto">
                <div className="max-w-2xl mx-auto space-y-12">
                  <div className="text-center space-y-4 mb-12">
                    <input 
                      type="text"
                      value={editingPage.title}
                      onChange={(e) => setEditingPage({...editingPage, title: e.target.value})}
                      className="text-5xl font-serif italic text-primary bg-transparent text-center w-full outline-none"
                      placeholder="Enter Page Title"
                    />
                    <div className="flex items-center justify-center gap-4 border-y border-line/30 py-4">
                      {editingPage.type !== 'blog' && (
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-ink-muted">
                          <Globe size={12} />
                          Path: /<input 
                            type="text" 
                            className="bg-bg/50 border border-line rounded px-1 outline-none font-mono text-ink lowercase" 
                            value={editingPage.path}
                            onChange={(e) => setEditingPage({...editingPage, path: e.target.value.replace(/\s+/g, '-')})}
                          />
                        </div>
                      )}
                      <div className="w-1 h-1 rounded-full bg-line" />
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-ink-muted">
                        <Clock size={12} />
                        Status: <span className="text-amber-500">{editingPage.status}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-12">
                    {(editingPage.sections || []).map((section: any, idx: number) => (
                      <div key={section.id} className="relative group bg-bg border border-line rounded-2xl p-6 transition-all hover:shadow-xl">
                        <div className="absolute -top-3 -right-3 hidden group-hover:flex gap-1">
                          <button 
                            onClick={() => {
                              const newSections = [...editingPage.sections];
                              newSections.splice(idx, 1);
                              setEditingPage({...editingPage, sections: newSections});
                            }}
                            className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <div className="flex items-center gap-3 mb-4 text-[10px] font-bold uppercase tracking-widest text-primary/40">
                          <Layout size={12} /> Section {idx + 1}: {section.type}
                        </div>
                        
                        {/* Section Content Editor */}
                        <div className="space-y-4">
                          {section.type === 'Hero' || section.type === 'Text' ? (
                            <div className="space-y-4">
                              <input 
                                type="text"
                                value={section.content?.title || ''}
                                onChange={(e) => {
                                  const newSections = [...editingPage.sections];
                                  newSections[idx] = { ...section, content: { ...section.content, title: e.target.value } };
                                  setEditingPage({...editingPage, sections: newSections});
                                }}
                                placeholder={section.type === 'Hero' ? "Hero Title" : "Section Heading"}
                                className="w-full bg-surface border border-line/30 rounded-lg px-4 py-2 text-primary font-serif italic text-lg outline-none focus:border-primary/50"
                              />
                              <textarea 
                                value={section.content?.text || ''}
                                onChange={(e) => {
                                  const newSections = [...editingPage.sections];
                                  newSections[idx] = { ...section, content: { ...section.content, text: e.target.value } };
                                  setEditingPage({...editingPage, sections: newSections});
                                }}
                                placeholder={section.type === 'Hero' ? "Hero Subtitle/Description" : "Section Body Content"}
                                className="w-full bg-surface border border-line/30 rounded-lg px-4 py-2 text-ink-muted text-sm outline-none focus:border-primary/50 min-h-[100px]"
                              />
                              {section.type === 'Hero' && (
                                <input 
                                  type="text"
                                  value={section.content?.cta || ''}
                                  onChange={(e) => {
                                    const newSections = [...editingPage.sections];
                                    newSections[idx] = { ...section, content: { ...section.content, cta: e.target.value } };
                                    setEditingPage({...editingPage, sections: newSections});
                                  }}
                                  placeholder="CTA Button Label"
                                  className="w-full bg-surface border border-line/30 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-widest outline-none focus:border-primary/50"
                                />
                              )}
                            </div>
                          ) : (
                            <div className="p-12 bg-surface/50 rounded-xl border border-line border-dashed text-center italic text-xs text-ink-muted">
                              {section.type} Section Configurator (Coming Soon)
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    <div className="group relative py-12 border-2 border-dashed border-line rounded-3xl hover:border-primary/30 transition-all text-center">
                      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/[0.02] transition-colors" />
                      <div className="relative z-10">
                        <Plus size={32} className="mx-auto text-line mb-4" />
                        <p className="text-sm text-ink-muted font-serif italic">Add a new section to your {(editingPage.type || 'page')}</p>
                        <div className="mt-6 flex justify-center gap-3">
                          {['Hero', 'Text', 'Gallery', 'Testimonials'].map(type => (
                            <button 
                              key={type}
                              onClick={() => {
                                const newSection = { id: Date.now(), type, content: { title: '', text: '', cta: '' } };
                                setEditingPage({...editingPage, sections: [...(editingPage.sections || []), newSection]});
                              }}
                              className="px-3 py-1.5 bg-bg border border-line rounded-lg text-[10px] font-bold uppercase tracking-widest hover:border-primary transition-all text-ink-muted hover:text-primary"
                            >
                              + {type}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'samples' ? (
        <SampleResponseManager />
      ) : activeTab === 'content' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="scholar-card">
              <h3 className="text-xl font-serif italic text-primary mb-6">
                {editingTestId ? 'Edit Examination Material' : 'Upload New Examination Material'}
              </h3>
              <form onSubmit={handleUploadTest} className="space-y-6">
                {/* ... existing form fields ... */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted block mb-2">Test Category</label>
                    <div className="flex gap-2">
                      {['Academic', 'General Training'].map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setTestType(type as any)}
                          className={cn(
                            "flex-1 py-2 text-xs font-bold border rounded-lg transition-all",
                            testType === type ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-bg text-ink-muted border-line hover:border-primary"
                          )}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted block mb-2">Skill Module</label>
                    <select 
                      value={skillType}
                      onChange={(e) => setSkillType(e.target.value as any)}
                      className="w-full bg-bg border border-line rounded-lg px-4 py-2 text-sm outline-none focus:border-primary transition-all text-ink"
                    >
                      <option>Reading</option>
                      <option>Listening</option>
                      <option>Writing</option>
                      <option>Speaking</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted block mb-2">Test Title</label>
                  <input 
                    required
                    type="text" 
                    value={uploadData.title}
                    onChange={(e) => setUploadData({...uploadData, title: e.target.value})}
                    placeholder="e.g. Cambridge IELTS 18 - Test 1"
                    className="w-full bg-bg border border-line rounded-lg px-4 py-2 text-sm outline-none focus:border-primary transition-all text-ink"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted block mb-2">Content (Tasks/Sections/Passages)</label>
                  <div className="space-y-6">
                    {testParts.map((part, index) => (
                      <div key={index} className="p-4 bg-bg border border-line rounded-xl space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-primary italic">
                            {skillType === 'Writing' ? `Task ${index + 1}` : 
                             skillType === 'Speaking' ? `Part ${index + 1}` : 
                             skillType === 'Listening' ? `Section ${index + 1}` : 
                             `Passage ${index + 1}`}
                          </span>
                          {testParts.length > 1 && (
                            <button 
                              type="button"
                              onClick={() => setTestParts(testParts.filter((_, i) => i !== index))}
                              className="text-ink-muted hover:text-red-500 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                        
                        <textarea 
                          required
                          rows={4}
                          value={part.content}
                          onChange={(e) => {
                            const next = [...testParts];
                            next[index].content = e.target.value;
                            setTestParts(next);
                          }}
                          placeholder={`Enter content for ${skillType} Part ${index + 1}...`}
                          className="w-full bg-surface border border-line rounded-lg px-4 py-2 text-sm outline-none focus:border-primary transition-all text-ink font-mono"
                        />

                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold text-ink-muted block mb-1">Image/Graph URL (Optional)</label>
                          <input 
                            type="text"
                            value={part.imageUrl}
                            onChange={(e) => {
                              const next = [...testParts];
                              next[index].imageUrl = e.target.value;
                              setTestParts(next);
                            }}
                            placeholder="https://example.com/image.png"
                            className="w-full bg-surface border border-line rounded-lg px-4 py-2 text-xs outline-none focus:border-primary transition-all text-ink"
                          />
                        </div>

                        {skillType === 'Listening' && (
                          <div>
                            <label className="text-[9px] uppercase tracking-widest font-bold text-ink-muted block mb-1">Upload Audio (.mp3/.wav)</label>
                            <label className="flex items-center gap-2 bg-surface border border-line rounded-lg px-4 py-2 cursor-pointer hover:border-primary transition-all group">
                              <Upload size={14} className="text-ink-muted group-hover:text-primary" />
                              <span className="text-[10px] text-ink-muted group-hover:text-ink truncate">
                                {part.audioFile ? part.audioFile.name : part.audioUrl ? "Audio URL present" : "Select Audio File"}
                              </span>
                              <input 
                                type="file" 
                                accept="audio/*" 
                                className="hidden" 
                                onChange={(e) => {
                                  const next = [...testParts];
                                  next[index].audioFile = e.target.files?.[0] || null;
                                  setTestParts(next);
                                }}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    <button 
                      type="button"
                      onClick={() => setTestParts([...testParts, { content: '', imageUrl: '', audioFile: null, audioUrl: '' }])}
                      className="w-full py-2 border-2 border-dashed border-line rounded-lg text-xs font-bold text-ink-muted hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={14} /> Add Another Part
                    </button>

                    <div className="flex flex-col gap-3 pt-4 border-t border-line">
                      <p className="text-[10px] text-ink-muted uppercase tracking-widest font-bold">Bulk Upload Alternative</p>
                      <div className="flex items-center gap-4">
                        <label className="flex-1 flex items-center justify-center gap-2 bg-bg border-2 border-dashed border-line rounded-lg px-4 py-4 cursor-pointer hover:border-primary transition-all group">
                          <Upload size={20} className="text-ink-muted group-hover:text-primary" />
                          <span className="text-sm text-ink-muted group-hover:text-ink">
                            {materialCsvFile ? materialCsvFile.name : "Upload Material CSV"}
                          </span>
                          <input 
                            type="file" 
                            accept=".csv" 
                            className="hidden" 
                            onChange={(e) => setMaterialCsvFile(e.target.files?.[0] || null)}
                          />
                        </label>
                        <button 
                          type="button"
                          onClick={() => {
                            const headers = ["TaskNumber", "Content", "ImageUrl"];
                            const csvContent = headers.join(",") + "\n1,\"Sample Text\",\"https://...\"";
                            const blob = new Blob([csvContent], { type: 'text/csv' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'material_example.csv';
                            a.click();
                          }}
                          className="bg-surface border border-line p-4 rounded-lg text-primary hover:bg-bg transition-all flex flex-col items-center gap-1"
                          title="Download Material Example CSV"
                        >
                          <Download size={20} />
                          <span className="text-[8px] font-bold uppercase">Example</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted block mb-2">Answer Key (CSV File)</label>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-4">
                      <label className="flex-1 flex items-center justify-center gap-2 bg-bg border-2 border-dashed border-line rounded-lg px-4 py-4 cursor-pointer hover:border-primary transition-all group">
                        <Upload size={20} className="text-ink-muted group-hover:text-primary" />
                        <span className="text-sm text-ink-muted group-hover:text-ink">
                          {csvFile ? csvFile.name : "Click to upload CSV Answer Key"}
                        </span>
                        <input 
                          type="file" 
                          accept=".csv" 
                          className="hidden" 
                          onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                        />
                      </label>
                      <button 
                        type="button"
                        onClick={downloadExampleCSV}
                        className="bg-surface border border-line p-4 rounded-lg text-primary hover:bg-bg transition-all flex flex-col items-center gap-1"
                        title="Download Example CSV"
                      >
                        <Download size={20} />
                        <span className="text-[8px] font-bold uppercase">Example</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-ink-muted italic">Format: QuestionNumber,Answer (e.g. 1,TRUE)</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  {editingTestId && (
                    <button 
                      type="button"
                      onClick={() => {
                        setEditingTestId(null);
                        setUploadData({ title: '', content: '' });
                      }}
                      className="flex-1 bg-surface border border-line py-3 rounded-lg font-bold text-ink hover:bg-bg transition-all"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button 
                    type="submit"
                    disabled={isUploading}
                    className="flex-[2] bg-primary text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-primary-light transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                  >
                    {isUploading ? <Loader2 className="animate-spin" size={20} /> : <><Upload size={20} /> {editingTestId ? 'Update Test' : 'Deploy to Student Panel'}</>}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="space-y-6">
            <div className="scholar-card border-primary/20 bg-primary/5">
              <h4 className="font-serif italic text-lg mb-2 text-primary">Admin Guidelines</h4>
              <p className="text-sm text-ink-muted leading-relaxed">
                As a Content Manager, you are responsible for maintaining the integrity of the examination database. 
                Ensure all answer keys are uploaded as CSV files to enable automated scoring.
              </p>
              <div className="mt-6 p-4 bg-surface rounded-lg border border-line">
                <p className="text-[10px] uppercase tracking-widest font-bold mb-2 text-ink-muted">System Status</p>
                <div className="flex items-center gap-2 text-sm text-emerald-500">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync Active
                </div>
              </div>
            </div>

            <div id="active-content-section" className="scholar-card">
              <h4 className="font-serif italic text-lg text-primary mb-4">Active Content</h4>
              <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                {tests.map(test => (
                  <div key={test.id} className="flex flex-col gap-2 pb-4 border-b border-line last:border-0 last:pb-0 group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded bg-bg flex items-center justify-center text-primary">
                          <FileText size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-ink">{test.title}</p>
                          <p className="text-[10px] text-ink-muted uppercase tracking-tighter">{test.type} • {test.skill}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setViewingTest(test)}
                          className="p-1 text-ink-muted hover:text-primary"
                          title="View Details"
                        >
                          <Search size={14} />
                        </button>
                        <button 
                          onClick={() => handleEditTest(test)}
                          className="p-1 text-ink-muted hover:text-primary"
                          title="Edit"
                        >
                          <PenTool size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteTest(test.id)}
                          className="p-1 text-ink-muted hover:text-red-500"
                          title="Delete"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-bg rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-secondary transition-all" 
                          style={{ width: `${Math.min(100, (attemptCounts[test.id] || 0) * 10)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-ink-muted whitespace-nowrap">
                        {attemptCounts[test.id] || 0} Attempts
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-serif italic text-primary">Examination Schedule</h3>
            <button 
              onClick={() => setIsScheduleModalOpen(true)}
              className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-primary-light transition-all shadow-lg shadow-primary/20"
            >
              <Clock size={18} /> Schedule New Task
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {scheduledTasks.map(task => (
              <div key={task.id} className="scholar-card relative group">
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleDeleteSchedule(task.id)}
                    className="p-1.5 text-ink-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    task.type === 'Exam' ? "bg-red-100 text-red-600" : 
                    task.type === 'Practice' ? "bg-emerald-100 text-emerald-600" : 
                    "bg-blue-100 text-blue-600"
                  )}>
                    {task.type === 'Exam' ? <GraduationCap size={20} /> : 
                     task.type === 'Practice' ? <Zap size={20} /> : 
                     <FileText size={20} />}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-ink-muted">{task.type}</p>
                    <h4 className="text-lg font-serif italic text-primary">{task.title}</h4>
                  </div>
                </div>
                <p className="text-sm text-ink-muted mb-6 line-clamp-2">{task.description}</p>
                <div className="flex items-center justify-between pt-4 border-t border-line">
                  <div className="flex items-center gap-2 text-xs font-bold text-ink">
                    <Clock size={14} className="text-primary" />
                    {new Date(task.dueDate).toLocaleDateString()}
                  </div>
                  <span className={cn(
                    "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    task.status === 'active' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                  )}>
                    {task.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cohort Details Modal */}
      <AnimatePresence>
        {selectedCohortId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink/20 backdrop-blur-sm shadow-[0_0_100px_rgba(0,0,0,0.2)]">
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="bg-surface rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-line flex flex-col"
            >
              <div className="p-6 border-b border-line flex items-center justify-between bg-surface/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Users size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-serif italic text-primary">
                      {classes.find(c => c.id === selectedCohortId)?.name}
                    </h3>
                    <p className="text-[10px] text-ink-muted uppercase tracking-[0.2em] font-bold">Comprehensive Cohort Performance</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedCohortId(null)}
                  className="p-2 hover:bg-red-50 hover:text-red-500 rounded-lg transition-all text-ink-muted"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                <CohortDetails 
                  cohort={classes.find(c => c.id === selectedCohortId)!}
                  students={students}
                  teachers={teachers}
                  attempts={attempts}
                  onClose={() => setSelectedCohortId(null)}
                  onViewStudent={(student) => {
                    setSelectedCohortId(null);
                    setViewingStudentAnalytics(student);
                  }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-ink/20 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-line p-6 text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-serif italic text-primary mb-2">Confirm Deletion</h3>
              <p className="text-sm text-ink-muted mb-6">
                Are you sure you want to delete this {deleteConfirm.type}? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-bold border border-line hover:bg-bg transition-all text-ink"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  disabled={isSubmitting}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Schedule Modal */}
      <AnimatePresence>
        {isScheduleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink/20 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-line"
            >
              <div className="p-6 border-b border-line flex items-center justify-between">
                <h3 className="text-xl font-serif italic text-primary">Schedule New Task</h3>
                <button onClick={() => setIsScheduleModalOpen(false)} className="text-ink-muted hover:text-ink">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleCreateSchedule} className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted block mb-1">Task Title</label>
                  <input 
                    required
                    type="text" 
                    value={newSchedule.title}
                    onChange={(e) => setNewSchedule({...newSchedule, title: e.target.value})}
                    className="w-full bg-bg border border-line rounded-lg px-4 py-2 text-sm outline-none focus:border-primary transition-all text-ink"
                    placeholder="e.g. Mock Test 1"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted block mb-1">Description</label>
                  <textarea 
                    required
                    value={newSchedule.description}
                    onChange={(e) => setNewSchedule({...newSchedule, description: e.target.value})}
                    className="w-full bg-bg border border-line rounded-lg px-4 py-2 text-sm outline-none focus:border-primary transition-all text-ink"
                    placeholder="Brief details about the task..."
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted ml-1">Due Date</label>
                    <input 
                      required
                      type="date" 
                      value={newSchedule.dueDate}
                      onChange={(e) => setNewSchedule({...newSchedule, dueDate: e.target.value})}
                      className="scholar-input"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted ml-1">Skill Category</label>
                    <select 
                      value={newSchedule.skill}
                      onChange={(e) => setNewSchedule({...newSchedule, skill: e.target.value as any})}
                      className="scholar-input"
                    >
                      <option value="Reading">Reading</option>
                      <option value="Listening">Listening</option>
                      <option value="Writing">Writing</option>
                      <option value="Speaking">Speaking</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted block mb-1">Type</label>
                    <select 
                      value={newSchedule.type}
                      onChange={(e) => setNewSchedule({...newSchedule, type: e.target.value as any})}
                      className="w-full bg-bg border border-line rounded-lg px-4 py-2 text-sm outline-none focus:border-primary transition-all text-ink"
                    >
                      <option value="Exam">Exam</option>
                      <option value="Practice">Practice</option>
                      <option value="Submission">Submission</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted block mb-1">Status</label>
                    <select 
                      value={newSchedule.status}
                      onChange={(e) => setNewSchedule({...newSchedule, status: e.target.value as any})}
                      className="w-full bg-bg border border-line rounded-lg px-4 py-2 text-sm outline-none focus:border-primary transition-all text-ink"
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="active">Active</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsScheduleModalOpen(false)}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-bold border border-line hover:bg-bg transition-all text-ink"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary-light transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Schedule Task'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Enroll Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink/20 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-line"
            >
              <div className="p-6 border-b border-line flex items-center justify-between">
                <h3 className="text-xl font-serif italic text-primary">Enroll New Scholar</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-ink-muted hover:text-ink">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleEnroll} className="p-6 space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted ml-1">Full Name</label>
                  <input 
                    required
                    type="text" 
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({...newStudent, name: e.target.value})}
                    className="scholar-input"
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted ml-1">Email Address</label>
                  <input 
                    required
                    type="email" 
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({...newStudent, email: e.target.value})}
                    className="scholar-input"
                    placeholder="e.g. john@example.com"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted ml-1">Target Band Score</label>
                    <input 
                      required
                      type="number" 
                      step="0.5"
                      min="0"
                      max="9"
                      value={newStudent.targetBand}
                      onChange={(e) => setNewStudent({...newStudent, targetBand: parseFloat(e.target.value)})}
                      className="scholar-input"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted ml-1">Exam Date</label>
                    <input 
                      required
                      type="date" 
                      value={newStudent.examDate}
                      onChange={(e) => setNewStudent({...newStudent, examDate: e.target.value})}
                      className="scholar-input"
                    />
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-bold border border-line hover:bg-bg transition-all text-ink"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary-light transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Enroll Scholar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Viewing Test Modal */}
      <AnimatePresence>
        {viewingTest && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl border border-line flex flex-col"
            >
              <div className="p-6 border-b border-line flex items-center justify-between bg-surface sticky top-0 z-10">
                <div>
                  <h3 className="text-2xl font-serif italic text-primary">{viewingTest.title}</h3>
                  <p className="text-xs text-ink-muted uppercase tracking-widest mt-1">
                    {viewingTest.type} • {viewingTest.skill} • {attemptCounts[viewingTest.id] || 0} Attempts
                  </p>
                </div>
                <button 
                  onClick={() => setViewingTest(null)}
                  className="p-2 hover:bg-bg rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-widest text-ink-muted mb-4 border-b border-line pb-2 flex items-center gap-2">
                    <FileText size={16} /> Content Breakdown
                  </h4>
                  <div className="space-y-6">
                    {(() => {
                      try {
                        const parsed = JSON.parse(viewingTest.content);
                        if (Array.isArray(parsed)) {
                          return parsed.map((p: any, i: number) => (
                            <div key={i} className="p-6 bg-bg rounded-xl border border-line space-y-4">
                              <div className="flex items-center justify-between">
                                <span className="font-serif italic text-primary">Part {i + 1}</span>
                                {p.imageUrl && <span className="text-[10px] bg-secondary/10 text-secondary px-2 py-1 rounded font-bold">Has Image</span>}
                                {p.audioUrl && <span className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded font-bold">Has Audio</span>}
                              </div>
                              <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{p.content || p.prompt || p.passage}</p>
                              {p.imageUrl && (
                                <img src={p.imageUrl} alt="Part Visual" className="w-full max-h-[200px] object-contain rounded-lg border border-line" />
                              )}
                              {p.audioUrl && (
                                <audio src={p.audioUrl} controls className="w-full h-10" />
                              )}
                            </div>
                          ));
                        }
                        return <p className="text-sm text-ink whitespace-pre-wrap">{viewingTest.content}</p>;
                      } catch (e) {
                        return <p className="text-sm text-ink whitespace-pre-wrap">{viewingTest.content}</p>;
                      }
                    })()}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold uppercase tracking-widest text-ink-muted mb-4 border-b border-line pb-2 flex items-center gap-2">
                    <CheckCircle2 size={16} /> Answer Key
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {Object.entries(viewingTest.answerKey || {}).map(([num, ans]) => (
                      <div key={num} className="bg-surface p-3 rounded-lg border border-line flex flex-col items-center">
                        <span className="text-[10px] text-ink-muted font-bold">Q{num}</span>
                        <span className="text-sm font-bold text-primary">{ans as string}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-surface border-t border-line flex justify-end gap-3 sticky bottom-0 z-10">
                <button 
                  onClick={() => setViewingTest(null)}
                  className="px-6 py-2 border border-line rounded-lg text-sm font-bold hover:bg-bg"
                >
                  Close View
                </button>
                <button 
                  onClick={() => {
                    handleEditTest(viewingTest);
                    setViewingTest(null);
                  }}
                  className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-light flex items-center gap-2"
                >
                  <PenTool size={16} /> Edit This Test
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Assignment Modal */}
      <AnimatePresence>
        {isAssignmentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink/20 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-line"
            >
              <div className="p-6 border-b border-line flex items-center justify-between">
                <h3 className="text-xl font-serif italic text-primary">New Assignment</h3>
                <button onClick={() => setIsAssignmentModalOpen(false)} className="text-ink-muted hover:text-ink">
                  <X size={20} />
                </button>
              </div>
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  setIsSubmitting(true);
                  try {
                    const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
                    await addDoc(collection(db, 'assignments'), {
                      ...newAssignment,
                      createdAt: serverTimestamp(),
                      status: 'active'
                    });
                    setIsAssignmentModalOpen(false);
                    setNewAssignment({ title: '', description: '', points: 100, dueDate: '', type: 'Writing' });
                  } catch (error) {
                    handleFirestoreError(error, OperationType.CREATE, 'assignments');
                  } finally {
                    setIsSubmitting(false);
                  }
                }} 
                className="p-6 space-y-4"
              >
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted block mb-1">Assignment Title</label>
                  <input 
                    required
                    type="text" 
                    value={newAssignment.title}
                    onChange={(e) => setNewAssignment({...newAssignment, title: e.target.value})}
                    className="w-full bg-bg border border-line rounded-lg px-4 py-2 text-sm outline-none focus:border-primary transition-all text-ink"
                    placeholder="e.g. Essay: Environmental Impact"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted block mb-1">Instructions</label>
                  <textarea 
                    required
                    value={newAssignment.description}
                    onChange={(e) => setNewAssignment({...newAssignment, description: e.target.value})}
                    className="w-full bg-bg border border-line rounded-lg px-4 py-2 text-sm outline-none focus:border-primary transition-all text-ink h-32"
                    placeholder="Provide clear instructions for the scholars..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted block mb-1">Due Date</label>
                    <input 
                      required
                      type="date" 
                      value={newAssignment.dueDate}
                      onChange={(e) => setNewAssignment({...newAssignment, dueDate: e.target.value})}
                      className="w-full bg-bg border border-line rounded-lg px-4 py-2 text-sm outline-none focus:border-primary transition-all text-ink"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted block mb-1">Points</label>
                    <input 
                      required
                      type="number" 
                      value={newAssignment.points}
                      onChange={(e) => setNewAssignment({...newAssignment, points: parseInt(e.target.value)})}
                      className="w-full bg-bg border border-line rounded-lg px-4 py-2 text-sm outline-none focus:border-primary transition-all text-ink"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted block mb-1">Task Type</label>
                  <select 
                    value={newAssignment.type}
                    onChange={(e) => setNewAssignment({...newAssignment, type: e.target.value})}
                    className="w-full bg-bg border border-line rounded-lg px-4 py-2 text-sm outline-none focus:border-primary transition-all text-ink"
                  >
                    <option value="Writing">Writing Task</option>
                    <option value="Speaking">Speaking Interview</option>
                    <option value="Reading">Reading Practice</option>
                    <option value="Listening">Listening Practice</option>
                  </select>
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsAssignmentModalOpen(false)}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-bold border border-line hover:bg-bg transition-all text-ink"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary-light transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Post Assignment'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTeacherModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-ink/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface rounded-2xl w-full max-w-md p-8 border border-line">
              <h3 className="text-2xl font-serif italic text-primary mb-6">Enroll Teacher</h3>
              <form onSubmit={handleEnrollTeacher} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted ml-1">Full Name</label>
                  <input required placeholder="Prof. Nilay Rathod" value={newTeacher.name} onChange={e => setNewTeacher({...newTeacher, name: e.target.value})} className="scholar-input" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted ml-1">Email Address</label>
                  <input required type="email" placeholder="teacher@example.com" value={newTeacher.email} onChange={e => setNewTeacher({...newTeacher, email: e.target.value})} className="scholar-input" />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsTeacherModalOpen(false)} className="flex-1 scholar-button-secondary py-3">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 scholar-button-primary py-3">{isSubmitting ? <Loader2 className="animate-spin mx-auto" size={18} /> : "Enroll Teacher"}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isClassModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-ink/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface rounded-2xl w-full max-w-md p-8 border border-line">
              <h3 className="text-2xl font-serif italic text-primary mb-6">Create Class</h3>
              <form onSubmit={handleCreateClass} className="space-y-4">
                <input placeholder="Class Name" value={newClass.name} onChange={e => setNewClass({...newClass, name: e.target.value})} className="scholar-input" />
                <select value={newClass.teacherId} onChange={e => setNewClass({...newClass, teacherId: e.target.value})} className="scholar-input">
                  <option value="">Select Primary Teacher</option>
                  {teachers.map(t => <option key={t.uid} value={t.uid}>{t.name}</option>)}
                </select>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsClassModalOpen(false)} className="flex-1 scholar-button-secondary py-3">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 scholar-button-primary py-3">{isSubmitting ? <Loader2 className="animate-spin mx-auto" size={18} /> : "Create Class"}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {assigningStudent && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-ink/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface rounded-2xl w-full max-w-md p-8 border border-line">
              <h3 className="text-2xl font-serif italic text-primary mb-6">Assign Scholar</h3>
              <div className="flex items-center gap-4 mb-8 p-4 bg-primary/5 rounded-xl">
                <img src={assigningStudent.avatar} className="w-12 h-12 rounded-full" />
                <div>
                  <p className="font-bold text-ink">{assigningStudent.name}</p>
                  <p className="text-xs text-ink-muted">{assigningStudent.email}</p>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-ink-muted uppercase block mb-2">Assign to Teacher</label>
                  <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-2">
                    {teachers.map(t => (
                      <button 
                        key={t.uid} 
                        onClick={() => handleAssignStudent(assigningStudent.uid, t.uid)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                          assigningStudent.teacherId === t.uid ? "border-primary bg-primary/5 shadow-sm" : "border-line hover:border-primary/50"
                        )}
                      >
                        <img src={t.avatar} className="w-8 h-8 rounded-lg" />
                        <span className="text-sm font-bold text-ink">{t.name}</span>
                        {assigningStudent.teacherId === t.uid && <Check size={16} className="ml-auto text-primary" />}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-ink-muted uppercase block mb-2">Assign to Class</label>
                  <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-2">
                    {classes.map(c => (
                      <button 
                        key={c.id} 
                        onClick={() => handleAssignStudent(assigningStudent.uid, assigningStudent.teacherId || '', c.id)}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-xl border text-left transition-all",
                          assigningStudent.classId === c.id ? "border-secondary bg-secondary/5 shadow-sm" : "border-line hover:border-secondary/50"
                        )}
                      >
                        <span className="text-sm font-bold text-ink">{c.name}</span>
                        {assigningStudent.classId === c.id && <Check size={16} className="text-secondary" />}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={() => setAssigningStudent(null)} className="w-full scholar-button-secondary py-3 mt-4">Close Registration</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {reviewingAttempt && (
        <AdminEvaluationReview 
          attempt={reviewingAttempt} 
          onClose={() => setReviewingAttempt(null)}
          onUpdated={() => {
            // Re-fetch handled by onSnapshot
          }}
        />
      )}
    </motion.div>
  );
}
