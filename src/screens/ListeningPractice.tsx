import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Headphones, 
  Play, 
  Pause, 
  Volume2,
  CheckCircle2,
  HelpCircle,
  Clock,
  Loader2,
  FileText,
  ChevronRight,
  ChevronLeft,
  Send,
  Save,
  Bot,
  GraduationCap
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '../lib/utils';
import { evaluateReadingListening, generateListeningSection, ListeningTask, generateAudio } from '../services/geminiService';
import { db, handleFirestoreError, OperationType, createAdminAlert } from '../firebase';
import { collection, addDoc, doc, setDoc, getDoc, getDocs, query, where, limit, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../App';
import TestSelectionScreen from '../components/TestSelectionScreen';

export default function ListeningPractice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isFullTest = searchParams.get('mode') === 'full';
  const [isAcademic, setIsAcademic] = useState(searchParams.get('type') !== 'gt');
  const { user } = useAuth();
  const [testSource, setTestSource] = useState<'ai' | 'curated' | 'saved' | null>(null);
  const [sections, setSections] = useState<ListeningTask[]>([]);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [isLoadingTask, setIsLoadingTask] = useState(false);
  const [isLoadingNextSection, setIsLoadingNextSection] = useState(false);
  const [isCheckingProgress, setIsCheckingProgress] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState(2400);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submittedSections, setSubmittedSections] = useState<boolean[]>([false, false, false, false]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const task = sections[activeSectionIdx];

  const loadingMessages = [
    "Our AI Scholar is preparing a unique listening task for you...",
    "Analyzing academic trends for your audio...",
    "Preparing your listening challenge...",
    "Generating dynamic question sets...",
    "Almost ready for your academic response..."
  ];

  const evaluationMessages = [
    "Our AI Scholar is cross-referencing your answers...",
    "Checking accuracy and band score mapping...",
    "Evaluating your listening comprehension...",
    "Assessing your performance...",
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
        const progressId = `${user.uid}_Listening_${isFullTest ? 'full' : 'short'}`;
        const progressDoc = await getDoc(doc(db, 'progress', progressId));
        if (progressDoc.exists()) {
          const data = progressDoc.data();
          if (data.sections && data.sections.length > 0) {
            setSections(data.sections);
            setActiveSectionIdx(data.activeSectionIdx || 0);
            setAnswers(data.answers || {});
            setSubmittedSections(data.submittedSections || [false, false, false, false]);
            setTimeLeft(data.timeLeft || 2400);
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

  // Generate next section in the background
  const generateNextSectionIfNeeded = async (nextIdx: number) => {
    if (sections[nextIdx] || testSource !== 'ai') return;
    setIsLoadingNextSection(true);
    try {
      const sectionNumber = nextIdx + 1;
      const newSection = await generateListeningSection(sectionNumber);
      setSections(prev => {
        const updated = [...prev];
        updated[nextIdx] = newSection;
        return updated;
      });
    } catch (error) {
      console.error(`Failed to generate section ${nextIdx + 1}:`, error);
      toast.error(`Failed to generate Section ${nextIdx + 1}. Please try again.`);
    } finally {
      setIsLoadingNextSection(false);
    }
  };

  const handleStartPractice = async (source: 'ai' | 'curated', type: 'academic' | 'gt', testId?: string) => {
    setTestSource(source);
    setIsAcademic(type === 'academic');
    setIsLoadingTask(true);
    
    if (source === 'ai') {
      try {
        if (isFullTest) {
          // Section-wise: only generate Section 1 immediately
          const section1 = await generateListeningSection(1);
          setSections([section1]);
          setSubmittedSections([false, false, false, false]);
          setAnswers({});
          setProgress(0);
          setIsPlaying(false);
          setShowTranscript(false);

          // Pre-fetch section 2 in background
          generateListeningSection(2).then(s2 => {
            setSections(prev => {
              const updated = [...prev];
              updated[1] = s2;
              return updated;
            });
          }).catch(err => console.warn('Background fetch of Section 2 failed:', err));
        } else {
          // Quick practice — single section
          const section1 = await generateListeningSection(1);
          setSections([section1]);
          setSubmittedSections([false]);
          setAnswers({});
          setProgress(0);
          setIsPlaying(false);
          setShowTranscript(false);
        }
      } catch (error) {
        console.error("Failed to fetch task:", error);
        toast.error("Failed to load listening sections. Please refresh.");
        setTestSource(null);
      } finally {
        setIsLoadingTask(false);
      }
    } else {
      try {
        let testData: any;
        if (testId) {
          const docSnap = await getDoc(doc(db, 'tests', testId));
          if (docSnap.exists()) testData = { id: docSnap.id, ...docSnap.data() };
        } else {
          const q = query(
            collection(db, 'tests'),
            where('skill', '==', 'Listening'),
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
           setSections(parsedContent);
           setSubmittedSections(new Array(parsedContent.length).fill(false));
        } else {
           setSections([{
             id: testData.id,
             section: 1,
             title: testData.title || "Teacher Curated Listening",
             transcript: testData.content,
             audioUrl: testData.audioUrl || "",
             questions: [] 
           }]);
           setSubmittedSections([false]);
        }
      } catch (error) {
        toast.error("Failed to fetch curated test.");
        setTestSource(null);
      } finally {
        setIsLoadingTask(false);
      }
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchAudio = async () => {
      if (!task) return;
      setIsLoadingAudio(true);
      setAudioUrl(null);
      try {
        if (audioUrl && audioUrl.startsWith('blob:')) {
          URL.revokeObjectURL(audioUrl);
        }

        if (task.audioUrl) {
          setAudioUrl(task.audioUrl);
        } else {
          const url = await generateAudio(task.transcript);
          setAudioUrl(url);
        }
        setProgress(0);
        setIsPlaying(false);
      } catch (error) {
        console.error("Failed to fetch audio:", error);
        toast.error("Audio failed to load. You can still answer using the transcript.");
        setShowTranscript(true);
        setAudioUrl(null);
      } finally {
        setIsLoadingAudio(false);
      }
    };
    fetchAudio();
    
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [activeSectionIdx, task?.id]);

  const isBrowserTTS = audioUrl?.startsWith('browser-tts://') || false;
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (isBrowserTTS) {
      if (isPlaying) {
        window.speechSynthesis.cancel();
        const text = decodeURIComponent(audioUrl!.replace('browser-tts://', ''));
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.onend = () => {
          setIsPlaying(false);
          setProgress(100);
        };
        utterance.onboundary = (event) => {
          const p = (event.charIndex / text.length) * 100;
          setProgress(p);
        };
        speechRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      } else {
        window.speechSynthesis.cancel();
      }
    } else if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(error => {
          console.error("Playback failed:", error);
          setIsPlaying(false);
        });
      } else {
        audioRef.current.pause();
      }
    }

    return () => {
      if (isBrowserTTS) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isPlaying, audioUrl]);

  const handleTimeUpdate = () => {
    if (!isBrowserTTS && audioRef.current) {
      const p = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(p);
      if (p >= 100) {
        setIsPlaying(false);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = (qId: string, value: string) => {
    if (isFullTest && submittedSections[activeSectionIdx]) return;
    setAnswers(prev => ({ ...prev, [qId]: value }));
  };

  const handleSubmitSection = async () => {
    const sectionQuestions = sections[activeSectionIdx]?.questions || [];
    const allAnswered = sectionQuestions.every(q => answers[q.id]?.trim());
    
    if (!allAnswered) {
      toast.error("Please answer all questions in this section before submitting.");
      return;
    }

    const newSubmitted = [...submittedSections];
    newSubmitted[activeSectionIdx] = true;
    setSubmittedSections(newSubmitted);
    toast.success(`Section ${activeSectionIdx + 1} submitted successfully!`);

    // Trigger generation of next section if needed
    if (isFullTest && activeSectionIdx < 3) {
      const nextIdx = activeSectionIdx + 1;
      if (!sections[nextIdx]) {
        generateNextSectionIfNeeded(nextIdx);
      }
      // Also pre-fetch the one after
      if (nextIdx + 1 <= 3 && !sections[nextIdx + 1]) {
        generateListeningSection(nextIdx + 2).then(s => {
          setSections(prev => {
            const updated = [...prev];
            updated[nextIdx + 1] = s;
            return updated;
          });
        }).catch(() => {});
      }
    }

    // Auto-advance to next section if available
    if (activeSectionIdx < sections.length - 1) {
      setTimeout(() => setActiveSectionIdx(activeSectionIdx + 1), 500);
    } else if (isFullTest && activeSectionIdx < 3 && sections[activeSectionIdx + 1]) {
      setTimeout(() => setActiveSectionIdx(activeSectionIdx + 1), 500);
    }

    // Autosave progress
    if (user) {
      try {
        const progressData = {
          userId: user.uid,
          skill: 'Listening',
          isFullTest,
          answers,
          activeSectionIdx: activeSectionIdx < (isFullTest ? 3 : sections.length - 1) ? activeSectionIdx + 1 : activeSectionIdx,
          submittedSections: newSubmitted,
          timeLeft,
          updatedAt: serverTimestamp(),
          testId: sections[0]?.id || 'generated',
          sections: sections
        };
        const progressId = `${user.uid}_Listening_${isFullTest ? 'full' : 'short'}`;
        await setDoc(doc(db, 'progress', progressId), progressData);
      } catch (error) {
        console.error("Failed to autosave:", error);
      }
    }
  };

  const handleSaveProgress = async () => {
    if (!user) return;
    setIsSaving(true);
    const progressId = `${user.uid}_Listening_${isFullTest ? 'full' : 'short'}`;
    const progressData = {
      userId: user.uid,
      skill: 'Listening',
      isAcademic,
      isFullTest,
      answers: answers || {},
      activeSectionIdx: activeSectionIdx || 0,
      submittedSections: submittedSections || [],
      timeLeft: timeLeft || 1800,
      updatedAt: serverTimestamp(),
      testId: sections[0]?.id || 'generated',
      sections: sections || []
    };

    try {
      await setDoc(doc(db, 'progress', progressId), progressData);
      toast.success("Progress saved successfully.");
    } catch (error) {
      console.error(`[ListeningPractice] SAVE FAILED:`, error);
      const firestoreError = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to save progress: ${firestoreError.slice(0, 50)}...`);
    } finally {
      setIsSaving(false);
    }
  };

  /** Core submit logic shared by AI and Teacher submit */
  const executeSubmission = async (submitToTeacher: boolean) => {
    if (sections.length === 0 || !user) return;

    let totalQuestions = 0;
    sections.forEach(s => totalQuestions += s.questions.length);
    
    const answeredCount = Object.values(answers).filter(a => a.trim() !== '').length;
    const expectedSections = isFullTest ? 4 : sections.length;
    
    if (!submittedSections.slice(0, expectedSections).every(s => s)) {
      const unsubmittedCount = submittedSections.slice(0, expectedSections).filter(s => !s).length;
      toast.error(`Please submit all ${expectedSections} sections before finalizing. ${unsubmittedCount} section(s) remaining.`);
      return;
    }

    if (answeredCount < totalQuestions) {
      toast.error(`Please attempt all ${totalQuestions} questions before submitting. You have answered ${answeredCount}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const correctAnswers: Record<string, string> = {};
      let totalQ = 0;
      sections.forEach(s => {
        s.questions.forEach(q => {
          correctAnswers[q.id] = q.answer;
          totalQ++;
        });
      });

      const evaluationResult = await evaluateReadingListening('Listening', answers, correctAnswers, totalQ, isAcademic);
      
      const evaluation = {
        overallBand: evaluationResult.bandScore,
        criteria: {
          taskResponse: evaluationResult.score,
          coherenceCohesion: evaluationResult.bandScore,
          lexicalResource: 0,
          grammaticalRange: 0
        },
        feedback: evaluationResult.feedback,
        corrections: Object.keys(correctAnswers).map(key => ({
          original: answers[key] || 'No answer',
          correction: correctAnswers[key],
          reason: answers[key]?.toLowerCase().trim() === correctAnswers[key].toLowerCase().trim() ? 'Correct' : 'Incorrect'
        }))
      };

      const attemptData = {
        studentId: user.uid,
        type: 'Listening',
        isAcademic,
        title: isFullTest ? `Full Listening Test` : `Listening Section 1: ${sections[0].title}`,
        date: new Date().toISOString(),
        score: evaluation.overallBand,
        feedback: evaluation.feedback,
        evaluation,
        content: `Raw Score: ${evaluationResult.score}/${totalQ}\nBand Score: ${evaluationResult.bandScore}`,
        prompt: isFullTest ? sections.map(s => s.title).join(', ') : sections[0].title,
        needsAdminReview: submitToTeacher,
        adminEvaluation: null,
        status: submitToTeacher ? 'pending_review' : 'completed'
      };
      
      const docRef = await addDoc(collection(db, 'attempts'), attemptData);

      await createAdminAlert(
        'Listening',
        submitToTeacher 
          ? `📝 ${user.name || 'Student'} submitted Listening for teacher review (AI Band: ${evaluationResult.bandScore})`
          : `New Listening submission from ${user.name || 'Student'}`,
        `/admin?tab=evaluations&id=${docRef.id}`
      );

      if (submitToTeacher) {
        toast.success(`Submitted to teacher! AI estimated Band: ${evaluationResult.bandScore}`);
      }

      navigate(`/evaluation/${docRef.id}`, {
        state: {
          evaluation,
          content: attemptData.content,
          prompt: isFullTest ? sections.map(s => s.title).join(', ') : sections[0].title,
          type: 'Listening'
        }
      });
    } catch (error) {
      console.error("Evaluation failed:", error);
      handleFirestoreError(error, OperationType.CREATE, 'attempts');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitToAI = () => executeSubmission(false);
  const handleSubmitToTeacher = () => executeSubmission(true);

  const answeredInSection = (section: ListeningTask) => {
    return section.questions.filter(q => answers[q.id]).length;
  };

  const totalQuestionsAnswered = Object.values(answers).filter(a => a.trim() !== '').length;
  const totalQuestionsExpected = isFullTest ? 40 : (task?.questions.length || 0);
  const allSectionsSubmitted = submittedSections.slice(0, isFullTest ? 4 : sections.length).every(s => s);

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
          skill="Listening"
          onSelect={handleStartPractice}
          title={isFullTest ? "Full Listening Test" : "Quick Listening Practice"}
        />
      ) : (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="max-w-5xl mx-auto flex flex-col gap-4 md:gap-8 relative px-2 md:px-0"
        >
          <AnimatePresence>
            {(isSubmitting || isLoadingTask) && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              >
                <div className="scholar-card bg-surface p-8 md:p-12 flex flex-col items-center gap-6 shadow-2xl max-w-md w-full border border-line">
                  <div className="relative">
                    <Loader2 className="animate-spin text-primary" size={64} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Headphones size={24} className="text-primary/40" />
                    </div>
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl md:text-2xl font-serif italic text-primary">
                      {isLoadingTask ? "Generating Section 1" : "Calculating Your Score"}
                    </h3>
                    <motion.p 
                      key={loadingMessage}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-ink-muted mt-2 min-h-[3rem] text-sm md:text-base"
                    >
                      {loadingMessage}
                    </motion.p>
                    {isLoadingTask && isFullTest && (
                      <p className="text-xs text-ink-muted mt-4 bg-primary/5 px-4 py-2 rounded-lg">
                        💡 Sections load one at a time for faster start
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

      {/* Header — responsive */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-600/20 shrink-0">
            <Headphones size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg md:text-2xl font-serif italic text-primary">
                Listening {isFullTest ? "Full Test" : "Practice"}
              </h2>
              <span className={cn(
                "px-2 py-0.5 text-[10px] font-bold rounded-md",
                isAcademic ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"
              )}>
                {isAcademic ? 'ACADEMIC' : 'GT'}
              </span>
            </div>
            <p className="text-ink-muted text-xs md:text-sm truncate">
              {isFullTest ? `Section ${activeSectionIdx + 1} of 4` : 
               activeSectionIdx === 0 ? "Social Context • Conversation" : 
               activeSectionIdx === 1 ? "Social Context • Monologue" : 
               activeSectionIdx === 2 ? "Educational Context • Discussion" : 
               "Academic Lecture • Monologue"}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4 flex-wrap">
          <div className="flex items-center gap-2 bg-surface px-3 py-1.5 md:px-4 md:py-2 rounded-lg border border-line">
            <Clock size={16} className={cn(timeLeft < 300 ? "text-red-500" : "text-primary")} />
            <span className={cn("text-base md:text-lg font-mono font-bold", timeLeft < 300 ? "text-red-500" : "text-ink")}>
              {formatTime(timeLeft)}
            </span>
          </div>
          <button 
            onClick={handleSaveProgress}
            disabled={isSaving || isSubmitting}
            className="bg-surface border border-line px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-bold flex items-center gap-1.5 hover:bg-bg transition-all text-ink disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            <span className="hidden sm:inline">Save</span>
          </button>
        </div>
      </div>

      {/* Section tabs — responsive */}
      {isFullTest && (
        <div className="flex gap-2 md:gap-3 overflow-x-auto pb-1">
          {[0, 1, 2, 3].map((idx) => {
            const section = sections[idx];
            const isLocked = idx > 0 && !submittedSections[idx - 1];
            const isSubmitted = submittedSections[idx];
            const isAvailable = !!section;
            
            return (
              <button
                key={idx}
                disabled={isLocked || !isAvailable}
                onClick={() => {
                  setActiveSectionIdx(idx);
                  setProgress(0);
                  setIsPlaying(false);
                }}
                className={cn(
                  "flex-1 min-w-[80px] px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-xs md:text-sm font-bold transition-all border flex items-center justify-between",
                  activeSectionIdx === idx 
                    ? "bg-primary text-white border-primary shadow-md" 
                    : isLocked || !isAvailable
                      ? "bg-bg border-line text-ink-muted opacity-50 cursor-not-allowed"
                      : "bg-surface text-ink border-line hover:bg-bg"
                )}
              >
                <span>S{idx + 1}</span>
                <div className="flex items-center gap-1">
                  {isSubmitted ? (
                    <CheckCircle2 size={14} className="text-emerald-500" />
                  ) : isAvailable ? (
                    <span className="text-[10px] opacity-70">{answeredInSection(section)}/{section.questions.length}</span>
                  ) : !isLocked ? (
                    <Loader2 size={12} className="animate-spin opacity-50" />
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Loading next section indicator */}
      {isLoadingNextSection && (
        <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
          <Loader2 size={18} className="animate-spin text-amber-600" />
          <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">Generating next section in the background...</p>
        </div>
      )}

      {/* Audio Player — responsive */}
      <div className="scholar-card bg-surface p-4 md:p-8">
        {audioUrl && (
          <audio 
            ref={audioRef} 
            src={audioUrl} 
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
        )}
        <div className="flex items-center gap-4 md:gap-8">
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={isLoadingTask || isLoadingAudio || !audioUrl}
            className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-primary text-white flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-primary/20 disabled:opacity-50 shrink-0"
          >
            {isLoadingAudio ? (
              <Loader2 className="animate-spin" size={24} />
            ) : isPlaying ? (
              <Pause size={24} />
            ) : (
              <Play size={24} className="ml-1" />
            )}
          </button>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2 md:mb-4 flex-wrap gap-2">
              <span className="text-xs font-bold text-ink">
                {isLoadingAudio ? "Generating audio..." : isPlaying ? "Audio playing..." : progress >= 100 ? "Audio finished" : "Ready to play"}
              </span>
              <div className="flex items-center gap-2 md:gap-4">
                <span className="text-[10px] font-mono text-ink-muted">
                  {audioRef.current ? formatTime(audioRef.current.currentTime) : "0:00"} / {audioRef.current ? formatTime(audioRef.current.duration) : "0:00"}
                </span>
                <button 
                  onClick={() => setShowTranscript(!showTranscript)}
                  className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                >
                  <FileText size={14} /> <span className="hidden sm:inline">{showTranscript ? "Hide" : "Show"}</span> Transcript
                </button>
              </div>
            </div>
            
            {/* Waveform */}
            <div className="h-8 md:h-12 flex items-center gap-0.5 md:gap-1">
              {Array.from({ length: 40 }).map((_, i) => (
                <div 
                  key={i}
                  className={cn(
                    "flex-1 rounded-full transition-all duration-300",
                    (i / 40) * 100 < progress ? "bg-primary" : "bg-primary/10"
                  )}
                  style={{ height: `${Math.random() * 80 + 20}%`, minHeight: '4px' }}
                />
              ))}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showTranscript && task && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 md:mt-8 pt-4 md:pt-8 border-t border-line overflow-hidden"
            >
              <h4 className="text-sm font-bold uppercase tracking-widest text-ink-muted mb-4">Audio Transcript</h4>
              <p className="text-ink leading-relaxed italic whitespace-pre-wrap text-sm md:text-base">{task.transcript}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main content — responsive grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
        {/* Questions Section */}
        <div className="lg:col-span-2 flex flex-col gap-4 md:gap-6">
          <div className="scholar-card">
            <div className="flex items-center gap-2 text-primary mb-4 md:mb-6">
              <HelpCircle size={18} />
              <h3 className="font-bold text-sm uppercase tracking-widest">Questions</h3>
              {task && (
                <span className="ml-auto text-xs text-ink-muted">
                  {answeredInSection(task)}/{task.questions.length} answered
                </span>
              )}
            </div>
            
            {task ? (
              <div className="space-y-6 md:space-y-8">
                {task.imageUrl && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-4 md:mb-8 rounded-xl overflow-hidden border border-line shadow-sm"
                  >
                    <img 
                      src={task.imageUrl} 
                      alt="Listening Illustration" 
                      className="w-full h-auto object-contain max-h-[200px] md:max-h-[300px]"
                    />
                  </motion.div>
                )}
                <p className="text-xs md:text-sm text-ink-muted italic">Answer the questions below based on the audio.</p>
                
                <div className="space-y-4 md:space-y-6">
                  <h4 className="text-base md:text-lg font-serif italic text-primary border-b border-line pb-2">
                    {task.title}
                  </h4>
                  
                  <div className="space-y-6 md:space-y-8 text-ink">
                    {task.questions.map((q, idx) => (
                      <div key={q.id} className="space-y-3">
                        <div className="flex items-start gap-2 md:gap-3">
                          <span className="font-bold text-primary shrink-0">{idx + 1}.</span>
                          <div className="flex-1 min-w-0">
                            {q.type === 'gap-fill' ? (
                              <div className="flex items-baseline gap-2 flex-wrap leading-loose">
                                {q.text.split('_____').map((part, i, arr) => (
                                  <React.Fragment key={i}>
                                    <span className="text-sm">{part}</span>
                                    {i < arr.length - 1 && (
                                      <input 
                                        type="text" 
                                        value={answers[q.id] || ''}
                                        disabled={submittedSections[activeSectionIdx]}
                                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                        className="border-b-2 border-line focus:border-primary outline-none px-2 w-24 md:w-32 bg-transparent text-center font-bold text-ink disabled:opacity-50 text-sm" 
                                      />
                                    )}
                                  </React.Fragment>
                                ))}
                              </div>
                            ) : (
                              <div className="space-y-3 md:space-y-4">
                                <p className="text-sm">{q.text}</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                                  {q.options?.map((opt, i) => (
                                    <button
                                      key={i}
                                      disabled={submittedSections[activeSectionIdx]}
                                      onClick={() => handleAnswerChange(q.id, opt)}
                                      className={cn(
                                        "p-2.5 md:p-3 rounded-lg border text-xs md:text-sm text-left transition-all",
                                        answers[q.id] === opt
                                          ? "bg-primary border-primary text-white shadow-md"
                                          : "bg-bg border-line hover:border-primary/50 text-ink disabled:opacity-50"
                                      )}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Section navigation within questions area */}
                  {isFullTest && (
                    <div className="mt-8 md:mt-12 pt-6 md:pt-8 border-t border-line flex flex-col sm:flex-row justify-between items-center gap-4">
                      <button
                        onClick={() => { setActiveSectionIdx(prev => prev - 1); setProgress(0); setIsPlaying(false); }}
                        disabled={activeSectionIdx === 0}
                        className="flex items-center gap-2 text-xs md:text-sm font-bold text-ink-muted hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft size={18} /> Previous Section
                      </button>

                      <div className="flex items-center gap-2">
                        {activeSectionIdx < 3 && sections[activeSectionIdx + 1] && (
                          <button
                            onClick={() => { setActiveSectionIdx(prev => prev + 1); setProgress(0); setIsPlaying(false); }}
                            disabled={!submittedSections[activeSectionIdx]}
                            className="bg-primary text-white px-4 md:px-8 py-2 md:py-3 rounded-xl font-bold text-xs md:text-sm flex items-center gap-2 hover:bg-primary-light transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                          >
                            Next Section <ChevronRight size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-ink-muted gap-4">
                <Loader2 size={32} className="animate-spin text-primary" />
                <p className="text-sm italic">Generating this section...</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar — Instructions & Progress */}
        <div className="flex flex-col gap-4 md:gap-6">
          <div className="scholar-card">
            <h3 className="font-bold text-sm uppercase tracking-widest text-ink-muted mb-4">Instructions</h3>
            <ul className="space-y-3 md:space-y-4">
              <li className="flex items-start gap-3 text-xs text-ink leading-relaxed">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 font-bold">1</div>
                <span>Listen carefully to the audio. In the real test, it plays only once.</span>
              </li>
              <li className="flex items-start gap-3 text-xs text-ink leading-relaxed">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 font-bold">2</div>
                <span>You can type your answers as you listen or use the transcript for practice.</span>
              </li>
            </ul>
          </div>

          {/* Progress card */}
          <div className="scholar-card bg-primary text-white border-none">
            <h3 className="text-base md:text-lg font-serif italic mb-4">Session Progress</h3>
            <div className="space-y-4">
              <div className="flex justify-between text-xs opacity-70">
                <span>Questions Answered</span>
                <span>{totalQuestionsAnswered} / {totalQuestionsExpected}</span>
              </div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white transition-all duration-500 rounded-full" style={{ width: `${totalQuestionsExpected > 0 ? (totalQuestionsAnswered / totalQuestionsExpected) * 100 : 0}%` }} />
              </div>
            </div>
          </div>

          {/* Section Navigation sidebar — for full test */}
          {isFullTest && (
            <div className="scholar-card">
              <h3 className="font-bold text-sm uppercase tracking-widest text-ink-muted mb-4">Sections</h3>
              <div className="flex flex-col gap-2">
                {[0, 1, 2, 3].map((idx) => {
                  const section = sections[idx];
                  const isLocked = idx > 0 && !submittedSections[idx - 1];
                  const isSubmitted = submittedSections[idx];
                  const isAvailable = !!section;
                  
                  return (
                    <button
                      key={idx}
                      disabled={isLocked || !isAvailable}
                      onClick={() => {
                        setActiveSectionIdx(idx);
                        setProgress(0);
                        setIsPlaying(false);
                      }}
                      className={cn(
                        "w-full px-3 py-2.5 md:px-4 md:py-3 rounded-lg text-xs md:text-sm font-bold transition-all border flex items-center justify-between",
                        activeSectionIdx === idx 
                          ? "bg-primary text-white border-primary shadow-md" 
                          : isLocked || !isAvailable
                            ? "bg-bg border-line text-ink-muted opacity-50 cursor-not-allowed"
                            : "bg-surface text-ink border-line hover:bg-bg"
                      )}
                    >
                      <span>Section {idx + 1}</span>
                      <div className="flex items-center gap-2">
                        {isSubmitted ? (
                          <CheckCircle2 size={14} className="text-emerald-500" />
                        ) : isAvailable ? (
                          <span className="text-[10px] opacity-70">{answeredInSection(section)}/{section.questions.length}</span>
                        ) : !isLocked ? (
                          <Loader2 size={12} className="animate-spin opacity-50" />
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Submit section button */}
          {!submittedSections[activeSectionIdx] && task && (
            <div className="flex flex-col gap-3">
              <button
                onClick={handleSaveProgress}
                disabled={isSaving || isSubmitting}
                className="w-full bg-surface border border-line py-2.5 md:py-3 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-2 hover:bg-bg transition-all text-ink disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Save Progress
              </button>
              <button
                onClick={handleSubmitSection}
                className="w-full bg-emerald-600 text-white py-2.5 md:py-3 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
              >
                <CheckCircle2 size={16} /> Submit Section {isFullTest ? activeSectionIdx + 1 : ''}
              </button>
            </div>
          )}

          {/* Dual submit buttons — show when all sections submitted */}
          {allSectionsSubmitted && (
            <div className="flex flex-col gap-3">
              <button
                onClick={handleSubmitToAI}
                disabled={isSubmitting}
                className="w-full bg-primary text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary-light transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Bot size={18} />}
                Submit to AI Evaluation
              </button>
              <button
                onClick={handleSubmitToTeacher}
                disabled={isSubmitting}
                className="w-full bg-secondary text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-secondary/90 transition-all shadow-lg shadow-secondary/20 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <GraduationCap size={18} />}
                Submit to Teacher
              </button>
            </div>
          )}
        </div>
      </div>
      </motion.div>
    )}
    </AnimatePresence>
  );
}
