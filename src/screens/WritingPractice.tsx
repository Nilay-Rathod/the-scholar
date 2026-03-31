import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PenTool, 
  Save, 
  Send, 
  Clock, 
  Info,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import { evaluateWriting, generateWritingTask, WritingTask } from '../services/geminiService';
import { db, handleFirestoreError, OperationType, createAdminAlert } from '../firebase';
import { collection, addDoc, getDoc, doc, setDoc, getDocs, query, where, limit, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../App';
import { toast } from 'sonner';
import TestSelectionScreen from '../components/TestSelectionScreen';

import { 
  LineChart, 
  Line, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';

export default function WritingPractice() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [testSource, setTestSource] = useState<'ai' | 'curated' | 'saved' | null>(null);
  const [taskType, setTaskType] = useState<1 | 2>(1);
  const [task1, setTask1] = useState<WritingTask | null>(null);
  const [task2, setTask2] = useState<WritingTask | null>(null);
  const [isLoadingTask, setIsLoadingTask] = useState(false);
  const [isCheckingProgress, setIsCheckingProgress] = useState(true);
  const [content1, setContent1] = useState('');
  const [content2, setContent2] = useState('');
  const [submittedTasks, setSubmittedTasks] = useState<boolean[]>([false, false]);
  const [timeLeft, setTimeLeft] = useState(3600); // 60 minutes total for both tasks
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isFullTest, setIsFullTest] = useState(true);

  const currentTask = taskType === 1 ? task1 : task2;
  const content = taskType === 1 ? content1 : content2;
  const setContent = taskType === 1 ? setContent1 : setContent2;

  const loadingMessages = [
    "Our AI Scholar is crafting unique IELTS prompts for you...",
    "Analyzing academic trends for your tasks...",
    "Preparing your lexical challenges...",
    "Generating dynamic data sets...",
    "Almost ready for your academic response..."
  ];

  const evaluationMessages = [
    "Our AI Scholar is analyzing your lexical resource...",
    "Checking grammatical range and accuracy...",
    "Evaluating coherence and cohesion...",
    "Assessing task response and development...",
    "Finalizing your band score report..."
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoadingTask || isSubmitting) {
      let i = 0;
      const messages = isLoadingTask ? loadingMessages : evaluationMessages;
      setLoadingMessage(messages[0]);
      interval = setInterval(() => {
        i = (i + 1) % messages.length;
        setLoadingMessage(messages[i]);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isLoadingTask, isSubmitting]);

  const [isAcademic, setIsAcademic] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const typeParam = params.get('type');
    if (typeParam === 'gt') setIsAcademic(false);
    
    const modeParam = params.get('mode');
    if (modeParam === 'short') setIsFullTest(false);
  }, []);

  // Check saved progress on mount
  useEffect(() => {
    const checkProgress = async () => {
      if (!user) return;
      try {
        const progressId = `${user.uid}_Writing_${isFullTest ? 'full' : 'short'}`;
        const progressDoc = await getDoc(doc(db, 'progress', progressId));
        if (progressDoc.exists()) {
          const data = progressDoc.data();
          if (data.task1 || data.task2) {
            setTask1(data.task1 || null);
            setTask2(data.task2 || null);
            setContent1(data.content1 || '');
            setContent2(data.content2 || '');
            setSubmittedTasks(data.submittedTasks || [false, false]);
            setTimeLeft(data.timeLeft || 3600);
            setTaskType(data.taskType || 1);
            setTestSource('saved');
            toast.info("Resumed from your last saved progress.");
          }
        }
      } catch (error) {
        console.error("Failed to load progress:", error);
      } finally {
        setIsCheckingProgress(false);
      }
    };
    checkProgress();
  }, [user, isFullTest]);

  const handleStartPractice = async (source: 'ai' | 'curated', type: 'academic' | 'gt', testId?: string) => {
    setTestSource(source);
    setIsAcademic(type === 'academic');
    setIsLoadingTask(true);
    
    if (source === 'ai') {
      try {
        const [t1, t2] = await Promise.all([
          generateWritingTask(1, type === 'academic'),
          isFullTest ? generateWritingTask(2, type === 'academic') : Promise.resolve(null)
        ]);
        setTask1(t1);
        setTask2(t2);
      } catch (error) {
        toast.error("Failed to load tasks.");
        setTestSource(null);
      } finally {
        setIsLoadingTask(false);
      }
    } else {
      // Curated
      try {
        let testData;
        if (testId) {
          const docSnap = await getDoc(doc(db, 'tests', testId));
          if (docSnap.exists()) testData = { id: docSnap.id, ...docSnap.data() };
        } else {
          const q = query(
            collection(db, 'tests'),
            where('skill', '==', 'Writing'),
            where('type', '==', type === 'academic' ? 'Academic' : 'General Training'),
            limit(1)
          );
          const snapshot = await getDocs(q);
          if (!snapshot.empty) testData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        }

        if (!testData) {
          toast.info("No curated tests available for this selection. Starting AI test.");
          return handleStartPractice('ai', type);
        }
        
        let parsedContent;
        try {
          parsedContent = JSON.parse(testData.content);
        } catch(e) { /* Raw text fallback */ }
        
        if (Array.isArray(parsedContent)) {
           setTask1({ id: testData.id, type: 1, prompt: parsedContent[0]?.prompt || "Teacher Curated Task 1" });
           setTask2(isFullTest ? { id: testData.id + '_2', type: 2, prompt: parsedContent[1]?.prompt || "Teacher Curated Task 2" } : null);
        } else {
           setTask1({ id: testData.id, type: 1, prompt: testData.content });
           setTask2(isFullTest ? { id: testData.id + '_2', type: 2, prompt: testData.content + " (Task 2 portion)" } : null);
        }
      } catch (error) {
        toast.error("Failed to fetch curated test.");
        setTestSource(null);
      } finally {
        setIsLoadingTask(false);
      }
    }
  };

  const wordCount1 = content1.trim() ? content1.trim().split(/\s+/).length : 0;
  const wordCount2 = content2.trim() ? content2.trim().split(/\s+/).length : 0;
  const minWords1 = 150;
  const minWords2 = 250;
  const targetMet1 = wordCount1 >= minWords1;
  const targetMet2 = wordCount2 >= minWords2;
  const wordCount = taskType === 1 ? wordCount1 : wordCount2;
  const minWords = taskType === 1 ? minWords1 : minWords2;
  const targetMet = taskType === 1 ? targetMet1 : targetMet2;

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmitTask = () => {
    const currentContent = taskType === 1 ? content1 : content2;
    const currentMinWords = taskType === 1 ? minWords1 : minWords2;
    const currentWordCount = currentContent.trim() ? currentContent.trim().split(/\s+/).length : 0;

    if (currentWordCount < currentMinWords) {
      toast.warning(`Word Count Warning: You have only written ${currentWordCount} words. IELTS Task ${taskType} requires at least ${currentMinWords} words for a better score. You can still proceed if you wish.`, {
        duration: 5000,
        icon: <AlertCircle className="text-amber-500" />
      });
    }

    setSubmittedTasks(prev => {
      const next = [...prev];
      next[taskType - 1] = true;
      return next;
    });
    toast.success(`Task ${taskType} submitted successfully.`);
  };

  const handleSaveProgress = async () => {
    if (!user) return;
    setIsSaving(true);
    
    const progressId = `${user.uid}_Writing_${isFullTest ? 'full' : 'short'}`;
    const progressData = {
      userId: user.uid,
      skill: 'Writing',
      isFullTest,
      task1: task1 || null,
      task2: task2 || null,
      content1: content1 || '',
      content2: content2 || '',
      submittedTasks: submittedTasks || [false, false],
      timeLeft: timeLeft || 3600,
      taskType: taskType || 1,
      updatedAt: serverTimestamp(),
      testId: task1?.id || 'generated'
    };

    console.log(`[WritingPractice] Attempting to save progress to ${progressId}`, progressData);
    
    try {
      await setDoc(doc(db, 'progress', progressId), progressData);
      console.log(`[WritingPractice] Save successful for ${progressId}`);
      toast.success("Progress saved successfully.");
    } catch (error) {
      console.error(`[WritingPractice] SAVE FAILED for ${progressId}:`, error);
      const firestoreError = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to save progress: ${firestoreError.slice(0, 50)}...`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!content1.trim() || !content2.trim() || !task1 || !task2 || !user) return;
    
    if (!submittedTasks.every(s => s)) {
      toast.error("Please submit both tasks before finalizing the test.");
      return;
    }

    setIsSubmitting(true);
    try {
      const evaluation = await evaluateWriting([
        { prompt: task1.prompt, content: content1, type: 1 },
        { prompt: task2.prompt, content: content2, type: 2 }
      ], isAcademic);
      
      // Save to Firestore
      const attemptData = {
        studentId: user.uid,
        type: 'Writing',
        isAcademic,
        title: `IELTS Writing: Task 1 & 2 (${isAcademic ? 'Academic' : 'General Training'})`,
        date: new Date().toISOString(),
        score: evaluation.overallBand,
        feedback: evaluation.overallFeedback,
        evaluation,
        content: `Task 1:\n${content1}\n\nTask 2:\n${content2}`,
        prompt: `Task 1: ${task1.prompt}\n\nTask 2: ${task2.prompt}`,
        needsAdminReview: true,
        adminEvaluation: null,
        status: 'pending_review'
      };
      
      const docRef = await addDoc(collection(db, 'attempts'), attemptData);

      // Create Admin Alert
      await createAdminAlert(
        'Writing',
        `New Writing submission from ${user.name || 'Student'}`,
        `/admin?tab=evaluations&id=${docRef.id}`
      );

      navigate(`/evaluation/${docRef.id}`, { 
        state: { 
          evaluation, 
          content: attemptData.content, 
          prompt: attemptData.prompt,
          type: 'Writing'
        } 
      });
    } catch (error) {
      console.error("Evaluation failed:", error);
      handleFirestoreError(error, OperationType.CREATE, 'attempts');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingProgress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (!testSource) {
    return (
      <TestSelectionScreen 
        skill="Writing"
        onSelect={handleStartPractice} 
        title={isFullTest ? "Full Writing Test" : "Quick Writing Practice"} 
      />
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-5xl mx-auto flex flex-col gap-8 relative"
    >
      <AnimatePresence>
        {(isSubmitting || isLoadingTask) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <div className="scholar-card bg-surface p-12 flex flex-col items-center gap-6 shadow-2xl max-w-md w-full transition-colors">
              <div className="relative">
                <Loader2 className="animate-spin text-primary" size={64} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <PenTool size={24} className="text-primary/40" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-serif italic text-primary">
                  {isLoadingTask ? "Generating Dynamic Task" : "Evaluating Your Response"}
                </h3>
                <motion.p 
                  key={loadingMessage}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-ink-muted mt-2 min-h-[3rem]"
                >
                  {loadingMessage}
                </motion.p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
            <PenTool size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-serif italic text-primary">
              {isAcademic ? 'Academic' : 'General Training'} Writing Task {taskType}
            </h2>
            <p className="text-ink-muted text-sm">
              {taskType === 1 
                ? (isAcademic ? "Data Description • Graph Analysis" : "Letter Writing • Situational") 
                : "Essay Response • Argumentative"}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-surface px-4 py-2 rounded-lg border border-line transition-colors">
            <Clock size={18} className={cn(timeLeft < 300 ? "text-red-500" : "text-primary")} />
            <span className={cn("text-lg font-mono font-bold", timeLeft < 300 ? "text-red-500" : "text-ink")}>
              {formatTime(timeLeft)}
            </span>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleSaveProgress}
              disabled={isSaving || isSubmitting}
              className="bg-surface border border-line px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-bg transition-all text-ink disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Save Progress
            </button>
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting || !submittedTasks.every(s => s) || isLoadingTask}
              className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-primary-light transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} /> Submit Both Tasks
            </button>
          </div>
        </div>
      </div>

      {/* Task Selector */}
      <div className="flex gap-4">
        <button 
          onClick={() => setTaskType(1)}
          className={cn(
            "flex-1 p-4 rounded-xl border transition-all text-left relative",
            taskType === 1 ? "bg-primary border-primary text-white shadow-md" : "bg-surface border-line text-ink hover:bg-bg"
          )}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className={cn("text-[10px] uppercase tracking-widest font-bold mb-1", taskType === 1 ? "text-white/70" : "text-ink-muted")}>Task 1</p>
              <p className="text-sm font-bold">Graph/Chart Description (20m)</p>
            </div>
            {submittedTasks[0] ? (
              <CheckCircle2 size={16} className={taskType === 1 ? "text-white" : "text-emerald-500"} />
            ) : content1.trim() && (
              <CheckCircle2 size={16} className={taskType === 1 ? "text-white" : "text-secondary"} />
            )}
          </div>
        </button>
        <button 
          onClick={() => setTaskType(2)}
          disabled={!submittedTasks[0]}
          className={cn(
            "flex-1 p-4 rounded-xl border transition-all text-left relative",
            taskType === 2 
              ? "bg-primary border-primary text-white shadow-md" 
              : !submittedTasks[0]
                ? "bg-bg border-line text-ink-muted opacity-50 cursor-not-allowed"
                : "bg-surface border-line text-ink hover:bg-bg"
          )}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className={cn("text-[10px] uppercase tracking-widest font-bold mb-1", taskType === 2 ? "text-white/70" : "text-ink-muted")}>Task 2</p>
              <p className="text-sm font-bold">Argumentative Essay (40m)</p>
            </div>
            {submittedTasks[1] ? (
              <CheckCircle2 size={16} className={taskType === 2 ? "text-white" : "text-emerald-500"} />
            ) : content2.trim() && (
              <CheckCircle2 size={16} className={taskType === 2 ? "text-white" : "text-secondary"} />
            )}
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Prompt Section */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="scholar-card">
            <div className="flex items-center gap-2 text-primary mb-4">
              <Info size={18} />
              <h3 className="font-bold text-sm uppercase tracking-widest">Task Prompt</h3>
            </div>
            {currentTask && (
              <div className="space-y-4">
                {currentTask.imageUrl && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-xl overflow-hidden border border-line bg-surface shadow-sm"
                  >
                    <img 
                      src={currentTask.imageUrl} 
                      alt="Task Illustration" 
                      className="w-full h-auto object-contain max-h-[300px]"
                    />
                  </motion.div>
                )}
                {taskType === 1 && currentTask.data && (
                  <div className="h-64 bg-bg rounded-lg border border-line p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={currentTask.data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                        <XAxis dataKey="label" stroke="var(--ink-muted)" fontSize={10} />
                        <YAxis stroke="var(--ink-muted)" fontSize={10} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--line)', color: 'var(--ink)' }}
                          itemStyle={{ fontSize: '10px', color: 'var(--primary)' }}
                        />
                        <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <p className="text-ink leading-relaxed font-serif italic text-lg">
                  "{currentTask.prompt}"
                </p>
              </div>
            )}
            {!submittedTasks[0] || !submittedTasks[1] ? (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-[10px] text-red-600 font-bold uppercase tracking-widest mb-1">Required</p>
                <p className="text-[10px] text-red-500 italic">
                  Submit both tasks individually to unlock final submission.
                </p>
              </div>
            ) : (
              <div className="mt-4 p-3 rounded-lg bg-secondary/10 border border-secondary/20">
                <p className="text-[10px] text-secondary font-bold uppercase tracking-widest mb-1">Ready</p>
                <p className="text-[10px] text-secondary italic">
                  Both tasks submitted. You can now finalize the test.
                </p>
              </div>
            )}
          </div>

          <div className="scholar-card">
            <h3 className="font-bold text-sm uppercase tracking-widest text-ink-muted mb-4">Live Metrics</h3>
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-ink">Word Count</span>
                  <span className={cn("text-xs font-bold", targetMet ? "text-secondary" : "text-ink-muted")}>
                    {wordCount} / {minWords}
                  </span>
                </div>
                <div className="h-2 bg-line rounded-full overflow-hidden">
                  <motion.div 
                    className={cn("h-full transition-all duration-500", targetMet ? "bg-secondary" : "bg-primary")}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((wordCount / minWords) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-bg">
                {targetMet ? (
                  <CheckCircle2 size={20} className="text-secondary" />
                ) : (
                  <AlertCircle size={20} className="text-amber-500" />
                )}
                <p className="text-xs text-ink">
                  {targetMet ? "Minimum word count achieved." : `You need at least ${minWords} words.`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Editor Section */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="scholar-card p-0 flex-1 flex flex-col overflow-hidden min-h-[600px]">
            <div className="bg-surface px-6 py-3 border-b border-line flex items-center gap-4">
              <div className="flex gap-2">
                <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-bg transition-colors font-bold text-sm text-ink">B</button>
                <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-bg transition-colors italic font-serif text-ink">I</button>
                <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-bg transition-colors underline text-ink">U</button>
              </div>
              <div className="w-px h-4 bg-line" />
              <p className="text-[10px] uppercase tracking-widest font-bold text-ink-muted">
                {isAcademic ? 'Academic' : 'General Training'} Writing Mode
              </p>
            </div>
            <textarea 
              value={content}
              disabled={submittedTasks[taskType - 1]}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Begin your academic response here..."
              className="flex-1 p-8 text-lg font-serif italic leading-relaxed outline-none resize-none bg-transparent placeholder:text-ink-muted/30 text-ink disabled:opacity-50"
            />
            {content.trim() && !submittedTasks[taskType - 1] && (
              <div className="p-6 border-t border-line flex justify-end">
                <button
                  onClick={handleSubmitTask}
                  className="bg-emerald-600 text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                >
                  <CheckCircle2 size={18} /> Submit Task {taskType}
                </button>
              </div>
            )}
          </div>
          <p className="text-center text-[10px] text-ink-muted uppercase tracking-widest">
            Auto-saved at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
