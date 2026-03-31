import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Headphones, 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2,
  CheckCircle2,
  HelpCircle,
  Clock,
  Loader2,
  FileText,
  ChevronRight,
  ChevronLeft,
  Send,
  Save
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '../lib/utils';
import { evaluateReadingListening, generateListeningTask, generateFullListeningTest, ListeningTask, generateAudio } from '../services/geminiService';
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
  const [isCheckingProgress, setIsCheckingProgress] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState(2400); // 40 minutes for listening test
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

  const handleStartPractice = async (source: 'ai' | 'curated', type: 'academic' | 'gt', testId?: string) => {
    setTestSource(source);
    setIsAcademic(type === 'academic');
    setIsLoadingTask(true);
    
    if (source === 'ai') {
      try {
        // Always load all 4 sections (40 questions total)
        const data = await generateFullListeningTest();
        setSections(data.sections);
        setSubmittedSections(new Array(data.sections.length).fill(false));
        setAnswers({});
        setProgress(0);
        setIsPlaying(false);
        setShowTranscript(false);
      } catch (error) {
        console.error("Failed to fetch task:", error);
        toast.error("Failed to load listening sections. Please refresh.");
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
             audioUrl: testData.audioUrl || "", // Check top level too
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
        // Revoke old URL if it was a blob URL
        if (audioUrl && audioUrl.startsWith('blob:')) {
          URL.revokeObjectURL(audioUrl);
        }

        if (task.audioUrl) {
          // Use provided audio URL (from Firebase Storage)
          setAudioUrl(task.audioUrl);
        } else {
          // Generate AI audio
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
      // Browser TTS mode
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

  const handleNextSection = () => {
    if (activeSectionIdx < sections.length - 1) {
      setActiveSectionIdx(prev => prev + 1);
    }
  };

  const handlePrevSection = () => {
    if (activeSectionIdx > 0) {
      setActiveSectionIdx(prev => prev - 1);
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

    // Auto-advance to next section if available
    if (activeSectionIdx < sections.length - 1) {
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
          activeSectionIdx: activeSectionIdx < sections.length - 1 ? activeSectionIdx + 1 : activeSectionIdx,
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

    console.log(`[ListeningPractice] Attempting to save progress to ${progressId}`, progressData);
    
    try {
      await setDoc(doc(db, 'progress', progressId), progressData);
      console.log(`[ListeningPractice] Save successful for ${progressId}`);
      toast.success("Progress saved successfully.");
    } catch (error) {
      console.error(`[ListeningPractice] SAVE FAILED for ${progressId}:`, error);
      const firestoreError = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to save progress: ${firestoreError.slice(0, 50)}...`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (sections.length === 0 || !user) return;

    // Count total questions across all sections
    let totalQuestions = 0;
    sections.forEach(s => totalQuestions += s.questions.length);
    
    const answeredCount = Object.values(answers).filter(a => a.trim() !== '').length;
    
    if (!submittedSections.slice(0, sections.length).every(s => s)) {
      const unsubmittedCount = submittedSections.slice(0, sections.length).filter(s => !s).length;
      toast.error(`Please submit all ${sections.length} sections before finalizing. ${unsubmittedCount} section(s) remaining.`);
      return;
    }

    if (answeredCount < totalQuestions) {
      toast.error(`Please attempt all ${totalQuestions} questions before submitting. You have answered ${answeredCount}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const correctAnswers: Record<string, string> = {};
      let totalQuestions = 0;
      sections.forEach(s => {
        s.questions.forEach(q => {
          correctAnswers[q.id] = q.answer;
          totalQuestions++;
        });
      });

      const evaluationResult = await evaluateReadingListening('Listening', answers, correctAnswers, totalQuestions, isAcademic);
      
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

      // Save to Firestore
      const attemptData = {
        studentId: user.uid,
        type: 'Listening',
        isAcademic,
        title: isFullTest ? `Full Listening Test` : `Listening Section 1: ${sections[0].title}`,
        date: new Date().toISOString(),
        score: evaluation.overallBand,
        feedback: evaluation.feedback,
        evaluation,
        content: `Raw Score: ${evaluationResult.score}/${totalQuestions}\nBand Score: ${evaluationResult.bandScore}`,
        prompt: isFullTest ? sections.map(s => s.title).join(', ') : sections[0].title,
        needsAdminReview: false,
        adminEvaluation: null,
        status: 'completed'
      };
      
      const docRef = await addDoc(collection(db, 'attempts'), attemptData);

      // Create Admin Alert
      await createAdminAlert(
        'Listening',
        `New Listening submission from ${user.name || 'Student'}`,
        `/admin?tab=evaluations&id=${docRef.id}`
      );

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

  const answeredInSection = (section: ListeningTask) => {
    return section.questions.filter(q => answers[q.id]).length;
  };

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
                  <Headphones size={24} className="text-primary/40" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-serif italic text-primary">
                  {isLoadingTask ? (isFullTest ? "Generating Full Listening Test" : "Generating Dynamic Task") : "Calculating Your Score"}
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
          <div className="w-12 h-12 rounded-xl bg-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-600/20">
            <Headphones size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-serif italic text-primary">
              Listening Practice: {isAcademic ? 'Academic' : 'General Training'}
            </h2>
            <p className="text-ink-muted text-sm">
              {isFullTest ? `Section ${activeSectionIdx + 1} of 4` : 
               activeSectionIdx === 0 ? "Social Context • Conversation" : 
               activeSectionIdx === 1 ? "Social Context • Monologue" : 
               activeSectionIdx === 2 ? "Educational Context • Discussion" : 
               "Academic Lecture • Monologue"}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-surface px-4 py-2 rounded-lg border border-line">
            <Clock size={18} className={cn(timeLeft < 300 ? "text-red-500" : "text-primary")} />
            <span className={cn("text-lg font-mono font-bold", timeLeft < 300 ? "text-red-500" : "text-ink")}>
              {formatTime(timeLeft)}
            </span>
          </div>
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
            disabled={isSubmitting || isLoadingTask}
            className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-primary-light transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {isFullTest ? "Submit Full Test" : "Submit Answers"}
          </button>
        </div>
      </div>

      {/* Audio Player */}
      <div className="scholar-card bg-surface p-8">
        {audioUrl && (
          <audio 
            ref={audioRef} 
            src={audioUrl} 
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
        )}
        <div className="flex items-center gap-8">
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={isLoadingTask || isLoadingAudio || !audioUrl}
            className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {isLoadingAudio ? (
              <Loader2 className="animate-spin" size={32} />
            ) : isPlaying ? (
              <Pause size={32} />
            ) : (
              <Play size={32} className="ml-1" />
            )}
          </button>
          
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-ink">
                {isLoadingAudio ? "Generating audio..." : isPlaying ? "Audio playing..." : progress >= 100 ? "Audio finished" : "Ready to play"}
              </span>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-mono text-ink-muted">
                  {audioRef.current ? formatTime(audioRef.current.currentTime) : "0:00"} / {audioRef.current ? formatTime(audioRef.current.duration) : "0:00"}
                </span>
                <button 
                  onClick={() => setShowTranscript(!showTranscript)}
                  className="flex items-center gap-2 text-xs font-bold text-primary hover:underline"
                >
                  <FileText size={16} /> {showTranscript ? "Hide Transcript" : "Show Transcript"}
                </button>
              </div>
            </div>
            
            {/* Waveform */}
            <div className="h-12 flex items-center gap-1">
              {Array.from({ length: 60 }).map((_, i) => (
                <div 
                  key={i}
                  className={cn(
                    "flex-1 rounded-full transition-all duration-300",
                    (i / 60) * 100 < progress ? "bg-primary" : "bg-primary/10"
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
              className="mt-8 pt-8 border-t border-line overflow-hidden"
            >
              <h4 className="text-sm font-bold uppercase tracking-widest text-ink-muted mb-4">Audio Transcript</h4>
              <p className="text-ink leading-relaxed italic whitespace-pre-wrap">{task.transcript}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Questions Section */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="scholar-card">
            <div className="flex items-center gap-2 text-primary mb-6">
              <HelpCircle size={18} />
              <h3 className="font-bold text-sm uppercase tracking-widest">Questions</h3>
            </div>
            
            {task && (
              <div className="space-y-8">
                {task.imageUrl && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-8 rounded-xl overflow-hidden border border-line shadow-sm"
                  >
                    <img 
                      src={task.imageUrl} 
                      alt="Listening Illustration" 
                      className="w-full h-auto object-contain max-h-[300px]"
                    />
                  </motion.div>
                )}
                <p className="text-sm text-ink-muted italic">Answer the questions below based on the audio.</p>
                
                <div className="space-y-6">
                  <h4 className="text-lg font-serif italic text-primary border-b border-line pb-2">
                    {task.title}
                  </h4>
                  
                  <div className="space-y-8 text-ink">
                    {task.questions.map((q, idx) => (
                      <div key={q.id} className="space-y-3">
                        <div className="flex items-start gap-3">
                          <span className="font-bold text-primary">{idx + 1}.</span>
                          <div className="flex-1">
                            {q.type === 'gap-fill' ? (
                              <div className="flex items-baseline gap-2 flex-wrap leading-loose">
                                {q.text.split('_____').map((part, i, arr) => (
                                  <React.Fragment key={i}>
                                    <span>{part}</span>
                                    {i < arr.length - 1 && (
                                      <input 
                                        type="text" 
                                        value={answers[q.id] || ''}
                                        disabled={submittedSections[activeSectionIdx]}
                                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                        className="border-b-2 border-line focus:border-primary outline-none px-2 w-32 bg-transparent text-center font-bold text-ink disabled:opacity-50" 
                                      />
                                    )}
                                  </React.Fragment>
                                ))}
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <p>{q.text}</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {q.options?.map((opt, i) => (
                                    <button
                                      key={i}
                                      disabled={submittedSections[activeSectionIdx]}
                                      onClick={() => handleAnswerChange(q.id, opt)}
                                      className={cn(
                                        "p-3 rounded-lg border text-sm text-left transition-all",
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

                  {isFullTest && (
                    <div className="mt-12 pt-8 border-t border-line flex justify-between items-center">
                      <button
                        onClick={handlePrevSection}
                        disabled={activeSectionIdx === 0}
                        className="flex items-center gap-2 text-sm font-bold text-ink-muted hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft size={20} /> Previous Section
                      </button>

                      <div className="flex items-center gap-2">
                        {activeSectionIdx < sections.length - 1 ? (
                          <button
                            onClick={handleNextSection}
                            className="bg-primary text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-primary-light transition-all shadow-lg shadow-primary/20"
                          >
                            Next Section <ChevronRight size={20} />
                          </button>
                        ) : (
                          <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="bg-ink text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-ink-light transition-all shadow-lg shadow-ink/20"
                          >
                            {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                            Submit Full Test
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Instructions & Progress */}
        <div className="flex flex-col gap-6">
          <div className="scholar-card">
            <h3 className="font-bold text-sm uppercase tracking-widest text-ink-muted mb-4">Instructions</h3>
            <ul className="space-y-4">
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

          <div className="scholar-card bg-primary text-white border-none">
            <h3 className="text-lg font-serif italic mb-4">Session Progress</h3>
            <div className="space-y-4">
              <div className="flex justify-between text-xs opacity-70">
                <span>Questions Answered</span>
                <span>{Object.values(answers).filter(a => a.trim() !== '').length} / {isFullTest ? 40 : (task?.questions.length || 0)}</span>
              </div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white transition-all duration-500" style={{ width: `${(Object.values(answers).filter(a => a.trim() !== '').length / (isFullTest ? 40 : (task?.questions.length || 1))) * 100}%` }} />
              </div>
            </div>
          </div>

          {/* Section Navigation (Sidebar) */}
          {isFullTest && (
            <div className="scholar-card">
              <h3 className="font-bold text-sm uppercase tracking-widest text-ink-muted mb-4">Sections</h3>
              <div className="flex flex-col gap-2">
                {sections.map((s, idx) => {
                  const isLocked = isFullTest && idx > 0 && !submittedSections[idx - 1];
                  const isSubmitted = submittedSections[idx];
                  
                  return (
                    <button
                      key={s.id}
                      disabled={isLocked}
                      onClick={() => {
                        setActiveSectionIdx(idx);
                        setProgress(0);
                        setIsPlaying(false);
                      }}
                      className={cn(
                        "w-full px-4 py-3 rounded-lg text-sm font-bold transition-all border flex items-center justify-between",
                        activeSectionIdx === idx 
                          ? "bg-primary text-white border-primary shadow-md" 
                          : isLocked
                            ? "bg-bg border-line text-ink-muted opacity-50 cursor-not-allowed"
                            : "bg-surface text-ink border-line hover:bg-bg"
                      )}
                    >
                      <span>Section {idx + 1}</span>
                      <div className="flex items-center gap-2">
                        {isSubmitted ? (
                          <CheckCircle2 size={14} className="text-emerald-500" />
                        ) : (
                          <span className="text-[10px] opacity-70">{answeredInSection(s)}/{s.questions.length}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

            </div>
          )}

          {!submittedSections[activeSectionIdx] && (
            <div className="flex gap-4 items-center">
              <button
                onClick={handleSaveProgress}
                disabled={isSaving || isSubmitting}
                className="w-full mt-4 bg-surface border border-line py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-bg transition-all text-ink disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Save Progress
              </button>
              <button
                onClick={handleSubmitSection}
                className="w-full mt-4 bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
              >
                <CheckCircle2 size={18} /> Submit Section {isFullTest ? activeSectionIdx + 1 : ''}
              </button>
            </div>
          )}

          {/* Submit Button (Sidebar) */}
          {(submittedSections.slice(0, sections.length).every(s => s)) && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full bg-ink text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-ink-light transition-all shadow-lg shadow-ink/20"
            >
              {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              {isFullTest ? "Submit Full Test" : "End & Evaluate"}
            </button>
          )}
        </div>
      </div>
      </motion.div>
    )}
    </AnimatePresence>
  );
}


