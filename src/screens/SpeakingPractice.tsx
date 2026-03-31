import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic2, 
  Square, 
  Play, 
  Clock, 
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Sparkles,
  RotateCcw,
  Loader2,
  Zap,
  Headphones,
  Save,
  Send
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { evaluateSpeaking, generateSpeakingTask, SpeakingTask, generateFullSpeakingTest, evaluateFullSpeaking } from '../services/geminiService';
import { db, handleFirestoreError, OperationType, createAdminAlert } from '../firebase';
import { collection, addDoc, doc, setDoc, getDoc, getDocs, query, where, limit, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../App';
import TestSelectionScreen from '../components/TestSelectionScreen';

import { toast } from 'sonner';

export default function SpeakingPractice() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isFullTest = new URLSearchParams(location.search).get('mode') === 'full';
  
  const [testSource, setTestSource] = useState<'ai' | 'curated' | 'saved' | null>(null);
  const [currentPart, setCurrentPart] = useState<1 | 2 | 3>(1);
  const [task, setTask] = useState<SpeakingTask | null>(null);
  const [fullTestTasks, setFullTestTasks] = useState<SpeakingTask[]>([]);
  const [fullTestTranscripts, setFullTestTranscripts] = useState<Record<number, string>>({});
  const [isLoadingTask, setIsLoadingTask] = useState(false);
  const [isCheckingProgress, setIsCheckingProgress] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [prepTime, setPrepTime] = useState(60);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [submittedParts, setSubmittedParts] = useState<boolean[]>([false, false, false]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPlayingPlayback, setIsPlayingPlayback] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isAcademic, setIsAcademic] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const prepTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }
        if (finalTranscript) {
          setTranscript(prev => prev + finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const loadingMessages = [
    "Our AI Scholar is preparing a unique speaking prompt for you...",
    "Analyzing academic trends for your topic...",
    "Preparing your speaking challenge...",
    "Generating dynamic cue cards...",
    "Almost ready for your academic response..."
  ];

  const evaluationMessages = [
    "Our AI Scholar is analyzing your fluency and coherence...",
    "Checking lexical resource and pronunciation...",
    "Evaluating grammatical range and accuracy...",
    "Assessing your overall performance...",
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

  useEffect(() => {
    const checkProgress = async () => {
      if (!user) return;
      try {
        const progressId = `${user.uid}_Speaking_${isFullTest ? 'full' : 'short'}`;
        const progressDoc = await getDoc(doc(db, 'progress', progressId));
        if (progressDoc.exists()) {
          const data = progressDoc.data();
          if (data.parts && data.parts.length > 0) {
            setFullTestTasks(data.fullTestTasks || []);
            setTask(data.task || null);
            setFullTestTranscripts(data.fullTestTranscripts || {});
            setCurrentPart(data.currentPart || 1);
            setSubmittedParts(data.submittedParts || [false, false, false]);
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
        if (isFullTest) {
          const tasks = await generateFullSpeakingTest();
          setFullTestTasks(tasks);
          setTask(tasks[0]);
        } else {
          const data = await generateSpeakingTask(currentPart);
          setTask(data);
        }
      } catch (error) {
        console.error("Failed to fetch task:", error);
        toast.error("Failed to load AI test.");
        setTestSource(null);
      } finally {
        setIsLoadingTask(false);
      }
    } else {
      try {
        let testData;
        if (testId) {
          const docSnap = await getDoc(doc(db, 'tests', testId));
          if (docSnap.exists()) testData = { id: docSnap.id, ...docSnap.data() };
        } else {
          const q = query(
            collection(db, 'tests'),
            where('skill', '==', 'Speaking'),
            where('status', '==', 'active'),
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
        } catch(e) { /* fallback */ }
        
        if (Array.isArray(parsedContent)) {
           setFullTestTasks(parsedContent);
           setTask(parsedContent[currentPart - 1] || parsedContent[0]);
        } else {
           const singleTask = {
             id: testData.id,
             part: currentPart,
             prompt: testData.content,
             followUpPrompt: ""
           };
           setFullTestTasks([singleTask]);
           setTask(singleTask);
        }
      } catch (error) {
        toast.error("Failed to fetch curated test.");
        setTestSource(null);
      } finally {
        setIsLoadingTask(false);
      }
    }
    
    setRecordingTime(0);
    setTranscript(fullTestTranscripts[currentPart] || '');
    setIsRecording(false);
    setIsPreparing(false);
  };

  useEffect(() => {
    if (!testSource) return;
    const fetchTaskPart = async () => {
      setIsLoadingTask(true);
      try {
        if (fullTestTasks.length > 0) {
          setTask(fullTestTasks[currentPart - 1] || fullTestTasks[0]);
        } else if (testSource === 'ai') {
          const data = await generateSpeakingTask(currentPart);
          setTask(data);
        }
      } catch (error) {
        console.error("Failed to fetch task:", error);
      } finally {
        setIsLoadingTask(false);
      }
    };
    
    // Only fetch if switching part manually without full test data pre-loaded
    if (!isFullTest && testSource === 'ai') {
       fetchTaskPart();
    } else if (isFullTest && fullTestTasks.length > 0) {
       setTask(fullTestTasks[currentPart - 1] || fullTestTasks[0]);
    }
    
    setRecordingTime(0);
    setTranscript(fullTestTranscripts[currentPart] || '');
    setIsRecording(false);
    setIsPreparing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPart]);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  useEffect(() => {
    if (isPreparing) {
      prepTimerRef.current = setInterval(() => {
        setPrepTime(prev => {
          if (prev <= 1) {
            setIsPreparing(false);
            setIsRecording(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (prepTimerRef.current) clearInterval(prepTimerRef.current);
    }
    return () => {
      if (prepTimerRef.current) clearInterval(prepTimerRef.current);
    };
  }, [isPreparing]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (transcript) {
      setFullTestTranscripts(prev => ({ ...prev, [currentPart]: transcript }));
    }
  }, [transcript, currentPart]);

  const handlePlayback = () => {
    if (!transcript) return;
    
    if (isPlayingPlayback) {
      window.speechSynthesis.cancel();
      setIsPlayingPlayback(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(transcript);
    utterance.onend = () => setIsPlayingPlayback(false);
    utterance.onerror = () => setIsPlayingPlayback(false);
    setIsPlayingPlayback(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleToggleRecording = () => {
    if (isFullTest && submittedParts[currentPart - 1]) return;
    
    if (isRecording) {
      setIsRecording(false);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setFullTestTranscripts(prev => ({ ...prev, [currentPart]: transcript }));
    } else if (currentPart === 2 && !isPreparing && recordingTime === 0) {
      setIsPreparing(true);
      setPrepTime(60);
    } else {
      setRecordingTime(0);
      setIsRecording(true);
      setTranscript('');
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error("Failed to start recognition:", e);
        }
      }
    }
  };

  const handleSubmitPart = () => {
    const currentTranscript = isFullTest ? fullTestTranscripts[currentPart] || transcript : transcript;
    if (!currentTranscript?.trim()) {
      toast.error("Please record your response for this part before submitting.");
      return;
    }

    setSubmittedParts(prev => {
      const next = [...prev];
      next[currentPart - 1] = true;
      return next;
    });
    toast.success(`Part ${currentPart} submitted successfully.`);

    // Autosave
    if (user) {
      handleSaveProgress();
    }
  };

  const handleSaveProgress = async () => {
    if (!user) return;
    setIsSaving(true);
    const progressId = `${user.uid}_Speaking_${isFullTest ? 'full' : 'short'}`;
    const progressData = {
      userId: user.uid,
      skill: 'Speaking',
      isAcademic,
      isFullTest,
      fullTestTranscripts: fullTestTranscripts || {},
      currentPart: currentPart || 1,
      submittedParts: submittedParts || [false, false, false],
      updatedAt: serverTimestamp(),
      testId: task?.id || 'generated',
      fullTestTasks: fullTestTasks || [],
      task: task || null,
      parts: [1, 2, 3]
    };

    console.log(`[SpeakingPractice] Attempting to save progress to ${progressId}`, progressData);
    
    try {
      await setDoc(doc(db, 'progress', progressId), progressData);
      console.log(`[SpeakingPractice] Save successful for ${progressId}`);
      toast.success("Progress saved successfully.");
    } catch (error) {
      console.error(`[SpeakingPractice] SAVE FAILED for ${progressId}:`, error);
      const firestoreError = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to save progress: ${firestoreError.slice(0, 50)}...`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    const currentTranscript = isFullTest ? fullTestTranscripts[currentPart] || transcript : transcript;
    
    if (isFullTest && !submittedParts.every(s => s)) {
      toast.error("Please submit all three parts before evaluating.");
      return;
    } else if (!isFullTest && !submittedParts[currentPart - 1]) {
      toast.error("Please submit this part before evaluating.");
      return;
    }

    if (isFullTest) {
      // Check if all parts are recorded
      const allRecorded = [1, 2, 3].every(p => fullTestTranscripts[p] || (p === currentPart && transcript));
      if (!allRecorded) {
        toast.error("Please record responses for all three parts before submitting.");
        return;
      }
    } else if (!currentTranscript || !task || !user) {
      toast.error("Please record your response first.");
      return;
    }

    setIsSubmitting(true);
    try {
      let evaluation;
      let content;
      let prompt;

      if (isFullTest) {
        const responses = [1, 2, 3].map(p => ({
          part: p,
          prompt: fullTestTasks[p - 1].prompt,
          transcript: p === currentPart ? transcript : fullTestTranscripts[p]
        }));
        evaluation = await evaluateFullSpeaking(responses, isAcademic);
        content = responses.map(r => `Part ${r.part}:\n${r.transcript}`).join('\n\n');
        prompt = responses.map(r => `Part ${r.part}: ${r.prompt}`).join('\n\n');
      } else {
        evaluation = await evaluateSpeaking(currentPart, task.prompt, transcript, isAcademic);
        content = transcript;
        prompt = task.prompt;
      }
      
      // Save to Firestore
      const attemptData = {
        studentId: user.uid,
        type: 'Speaking',
        title: isFullTest ? `Full Speaking Test` : `Speaking Part ${currentPart}: ${task.prompt.slice(0, 50)}...`,
        date: new Date().toISOString(),
        score: evaluation.overallBand,
        feedback: evaluation.feedback,
        evaluation,
        content,
        prompt,
        needsAdminReview: true,
        adminEvaluation: null,
        status: 'pending_review'
      };
      
      const docRef = await addDoc(collection(db, 'attempts'), attemptData);

      // Create Admin Alert
      await createAdminAlert(
        'Speaking',
        `New Speaking submission from ${user.name || 'Student'}`,
        `/admin?tab=evaluations&id=${docRef.id}`
      );

      navigate(`/evaluation/${docRef.id}`, {
        state: {
          evaluation,
          content,
          prompt,
          type: 'Speaking'
        }
      });
    } catch (error) {
      console.error("Evaluation failed:", error);
      handleFirestoreError(error, OperationType.CREATE, 'attempts');
    } finally {
      setIsSubmitting(false);
    }
  };

  const parts = [
    { id: 1, title: 'Part 1: Introduction & Interview', description: 'General questions about yourself and familiar topics.' },
    { id: 2, title: 'Part 2: Individual Long Turn', description: 'Speak for 1-2 minutes on a specific topic given on a cue card.' },
    { id: 3, title: 'Part 3: Two-way Discussion', description: 'Further discussion of the topics and issues from Part 2.' },
  ];

  const isCurrentPartSubmitted = isFullTest && submittedParts[currentPart - 1];

  if (isCheckingProgress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {!testSource ? (
        <TestSelectionScreen 
          key="selection"
          skill="Speaking"
          onSelect={handleStartPractice}
          title={isFullTest ? "Full Speaking Test" : "Quick Speaking Practice"}
        />
      ) : (
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
                <div className="scholar-card bg-surface p-12 flex flex-col items-center gap-6 shadow-2xl max-w-md w-full border border-line">
                  <div className="relative">
                <Loader2 className="animate-spin text-primary" size={64} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Mic2 size={24} className="text-primary/40" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-serif italic text-primary">
                  {isLoadingTask ? "Generating Dynamic Task" : "Analyzing Your Speech"}
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
          <div className="w-12 h-12 rounded-xl bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-600/20">
            <Mic2 size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-serif italic text-primary">
              Speaking Practice: {isAcademic ? 'Academic' : 'General Training'}
            </h2>
            <p className="text-ink-muted text-sm">
              {isFullTest ? "Full Test Simulation" : "Live Simulation"} • Part {currentPart} of 3
            </p>
          </div>
        </div>
        
        <div className="flex gap-3">
          {isFullTest && (
            <div className="flex gap-2 mr-4">
              <button 
                onClick={() => {
                  setCurrentPart(prev => (prev > 1 ? (prev - 1) as 1 | 2 | 3 : prev));
                }}
                disabled={currentPart === 1}
                className="p-2 rounded-lg border border-line hover:bg-bg disabled:opacity-30 text-ink"
              >
                <ChevronLeft size={18} />
              </button>
              <button 
                onClick={() => {
                  setCurrentPart(prev => (prev < 3 ? (prev + 1) as 1 | 2 | 3 : prev));
                }}
                disabled={currentPart === 3 || (isFullTest && !submittedParts[currentPart - 1])}
                className="p-2 rounded-lg border border-line hover:bg-bg disabled:opacity-30 text-ink"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
          <button 
            onClick={handleSaveProgress}
            disabled={isSaving || isSubmitting}
            className="bg-surface border border-line px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-bg transition-all text-ink disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Save Progress
          </button>
          <button 
            onClick={() => {
              setCurrentPart(1);
              setIsRecording(false);
              setIsPreparing(false);
              setRecordingTime(0);
              setTranscript('');
              if (isFullTest) {
                setFullTestTranscripts({});
                setFullTestTasks([]);
              }
            }}
            className="bg-surface border border-line px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-bg transition-all text-ink"
          >
            <RotateCcw size={18} /> Reset Session
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting || (!isFullTest && !transcript) || isLoadingTask}
            className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-primary-light transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {isFullTest ? "Submit Full Test" : "End & Evaluate"}
          </button>
        </div>
      </div>

      {/* Part Selector */}
      <div className="flex gap-4">
        {parts.map((p) => {
          const isLocked = isFullTest && p.id > 1 && !submittedParts[p.id - 2];
          const isSubmitted = isFullTest && submittedParts[p.id - 1];
          
          return (
            <button
              key={p.id}
              disabled={isLocked}
              onClick={() => {
                setCurrentPart(p.id as 1 | 2 | 3);
              }}
              className={cn(
                "flex-1 p-4 rounded-xl border transition-all text-left relative",
                currentPart === p.id 
                  ? "bg-primary border-primary text-white shadow-md" 
                  : isLocked
                    ? "bg-bg border-line text-ink-muted opacity-50 cursor-not-allowed"
                    : "bg-surface border-line text-ink hover:bg-bg"
              )}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className={cn("text-[10px] uppercase tracking-widest font-bold mb-1", currentPart === p.id ? "text-white/70" : "text-ink-muted")}>Part {p.id}</p>
                  <p className="text-sm font-bold truncate">{p.title.split(': ')[1]}</p>
                </div>
                {isSubmitted ? (
                  <CheckCircle2 size={16} className={currentPart === p.id ? "text-white" : "text-emerald-500"} />
                ) : (isFullTest ? fullTestTranscripts[p.id] : (currentPart === p.id && transcript)) && (
                  <CheckCircle2 size={16} className={currentPart === p.id ? "text-white" : "text-secondary"} />
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Interaction Area */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="scholar-card bg-surface min-h-[400px] flex flex-col items-center justify-center text-center p-12 relative overflow-hidden border border-line">
            {isPreparing && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-primary/95 text-white flex flex-col items-center justify-center z-10"
              >
                <Clock size={48} className="mb-4 animate-pulse" />
                <h4 className="text-2xl font-serif italic mb-2">Preparation Time</h4>
                <p className="text-white/70 mb-8">You have 1 minute to prepare your response.</p>
                <div className="text-6xl font-mono font-bold">{prepTime}s</div>
                <button 
                  onClick={() => {
                    setIsPreparing(false);
                    setIsRecording(true);
                  }}
                  className="mt-12 bg-white text-primary px-8 py-3 rounded-full font-bold hover:bg-surface transition-all"
                >
                  Start Speaking Now
                </button>
              </motion.div>
            )}

            <AnimatePresence mode="wait">
              {task && (
                <motion.div
                  key={currentPart}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="max-w-md"
                >
                  <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center text-primary mx-auto mb-6">
                    <MessageSquare size={32} />
                  </div>
                  {task.imageUrl && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mb-8 rounded-xl overflow-hidden border border-line shadow-sm"
                    >
                      <img 
                        src={task.imageUrl} 
                        alt="Speaking Task Illustration" 
                        className="w-full h-auto object-contain max-h-[300px]"
                      />
                    </motion.div>
                  )}
                  <h3 className="text-2xl font-serif italic text-primary mb-4">
                    {task.prompt}
                  </h3>
                  {task.subPrompts && (
                    <ul className="text-left space-y-2 text-ink-muted text-sm mt-4">
                      {task.subPrompts.map((sp, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>{sp}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-12 flex flex-col items-center gap-6">
              <div className="flex items-center gap-8">
                <div className="flex flex-col items-center gap-2">
                  <button 
                    onClick={handleToggleRecording}
                    disabled={isLoadingTask || isCurrentPartSubmitted}
                    className={cn(
                      "w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl",
                      isRecording 
                        ? "bg-red-500 hover:bg-red-600 animate-pulse" 
                        : isCurrentPartSubmitted
                          ? "bg-bg border-line cursor-not-allowed opacity-50"
                          : "bg-primary hover:bg-primary-light"
                    )}
                  >
                    {isRecording ? <Square size={32} className="text-white" /> : <Mic2 size={32} className={isCurrentPartSubmitted ? "text-ink-muted" : "text-white"} />}
                  </button>
                  <span className={cn("text-xs font-bold uppercase tracking-widest", isRecording ? "text-red-500" : "text-ink-muted")}>
                    {isRecording ? "Recording..." : isCurrentPartSubmitted ? "Part Submitted" : currentPart === 2 && recordingTime === 0 ? "Start Prep" : "Start Speaking"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="bg-bg px-4 py-2 rounded-full border border-line flex items-center gap-2">
                  <Clock size={16} className="text-primary" />
                  <span className="text-sm font-mono font-bold text-ink">{formatTime(recordingTime)}</span>
                </div>
                {transcript && (
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={handlePlayback}
                      className="flex items-center gap-2 text-primary hover:underline text-sm font-bold"
                    >
                      {isPlayingPlayback ? <Square size={16} /> : <Play size={16} />}
                      {isPlayingPlayback ? "Stop Playback" : "Listen to Playback"}
                    </button>
                    {!submittedParts[currentPart - 1] && (
                      <>
                        <button
                          onClick={handleSaveProgress}
                          disabled={isSaving}
                          className="bg-surface border border-line px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-bg transition-all text-ink disabled:opacity-50"
                        >
                          {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                          Save Progress
                        </button>
                        <button
                          onClick={handleSubmitPart}
                          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                        >
                          <CheckCircle2 size={14} /> Submit Part {isFullTest ? currentPart : ''}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Live Transcription Box */}
          <AnimatePresence>
            {(isRecording || transcript) && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={cn("scholar-card border border-line mt-6 mb-2 overflow-hidden", isRecording ? "bg-primary/5 shadow-inner" : "bg-surface")}
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-sm uppercase tracking-widest text-primary flex items-center gap-2">
                    {isRecording && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                    {isRecording ? "Live Transcription" : "Recorded Transcript"}
                  </h4>
                </div>
                {transcript ? (
                  <p className="text-ink text-lg leading-relaxed font-serif">"{transcript}"</p>
                ) : (
                  <p className="text-ink-muted italic">Listening to your response...</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Audio Visualizer Placeholder */}
          {isRecording && (
            <div className="flex justify-center mb-6">
               <div className="h-12 flex items-center justify-center gap-1">
                 {Array.from({ length: 30 }).map((_, i) => (
                    <motion.div 
                      key={i}
                      animate={{ height: [10, Math.random() * 40 + 10, 10] }}
                      transition={{ repeat: Infinity, duration: 0.5 + Math.random() }}
                      className="w-1.5 bg-primary/40 rounded-full"
                    />
                 ))}
               </div>
            </div>
          )}
        </div>

        {/* Sidebar: Tips & Feedback */}
        <div className="flex flex-col gap-6">
          <div className="scholar-card bg-accent/5 border-accent/20">
            <div className="flex items-center gap-2 text-accent mb-4">
              <Sparkles size={18} />
              <h3 className="font-bold text-sm uppercase tracking-widest">Speaking Tips</h3>
            </div>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-xs text-ink leading-relaxed">
                <div className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0 font-bold">1</div>
                <span>Don't worry about your accent; focus on clarity and pronunciation.</span>
              </li>
              <li className="flex items-start gap-3 text-xs text-ink leading-relaxed">
                <div className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0 font-bold">2</div>
                <span>Use a variety of linking words to connect your ideas logically.</span>
              </li>
              <li className="flex items-start gap-3 text-xs text-ink leading-relaxed">
                <div className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0 font-bold">3</div>
                <span>In Part 2, use the 1 minute preparation time to write down keywords.</span>
              </li>
            </ul>
          </div>

          <div className="scholar-card">
            <h3 className="font-bold text-sm uppercase tracking-widest text-ink-muted mb-4">Fluency Metrics</h3>
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-ink">Confidence Level</span>
                  <span className="text-xs font-bold text-secondary">High</span>
                </div>
                <div className="h-2 bg-bg rounded-full overflow-hidden">
                  <div className="h-full bg-secondary w-[85%]" />
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-ink">Pace (Words/Min)</span>
                  <span className="text-xs font-bold text-ink-muted">142</span>
                </div>
                <div className="h-2 bg-bg rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-[70%]" />
                </div>
              </div>

              <div className="pt-4 border-t border-line">
                <p className="text-[10px] text-ink-muted uppercase tracking-widest font-bold mb-2">Common Fillers Detected</p>
                <div className="flex flex-wrap gap-2">
                  {['"um"', '"uh"', '"like"', '"you know"'].map((filler, i) => (
                    <span key={i} className="px-2 py-1 bg-bg rounded text-[10px] font-mono text-ink-muted border border-line">
                      {filler}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="scholar-card bg-ink text-white border-none">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={18} className="text-amber-400" />
              <h3 className="text-lg font-serif italic">Expert Tips</h3>
            </div>
            <ul className="space-y-4">
              <li className="text-xs leading-relaxed opacity-80">
                • Use a variety of linking words (e.g., "furthermore", "consequently").
              </li>
              <li className="text-xs leading-relaxed opacity-80">
                • Don't worry about small mistakes; focus on keeping a steady flow.
              </li>
              <li className="text-xs leading-relaxed opacity-80">
                • Extend your answers by providing examples or personal anecdotes.
              </li>
            </ul>
          </div>
        </div>
      </div>
      </motion.div>
    )}
    </AnimatePresence>
  );
}
