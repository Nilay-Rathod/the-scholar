import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  HelpCircle, 
  ChevronRight, 
  ChevronLeft,
  Clock,
  Loader2,
  CheckCircle2,
  Send,
  Save,
  Bot,
  GraduationCap
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { evaluateReadingListening, generateReadingSection, generateReadingPassage, ReadingPassage } from '../services/geminiService';
import { db, handleFirestoreError, OperationType, createAdminAlert } from '../firebase';
import { collection, addDoc, doc, setDoc, getDoc, getDocs, query, where, limit, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../App';
import TestSelectionScreen from '../components/TestSelectionScreen';

export default function ReadingPractice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isFullTest = searchParams.get('mode') === 'full';
  const [isAcademic, setIsAcademic] = useState(searchParams.get('type') !== 'gt');
  const { user } = useAuth();
  const [testSource, setTestSource] = useState<'ai' | 'curated' | 'saved' | null>(null);
  const [passages, setPassages] = useState<ReadingPassage[]>([]);
  const [currentPassageIdx, setCurrentPassageIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingNextSection, setIsLoadingNextSection] = useState(false);
  const [isCheckingProgress, setIsCheckingProgress] = useState(true);
  const [timeLeft, setTimeLeft] = useState(isFullTest ? 3600 : 1200);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submittedPassages, setSubmittedPassages] = useState<boolean[]>([false, false, false]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const currentPassage = passages[currentPassageIdx];

  const loadingMessages = [
    "Our AI Scholar is researching an academic topic for you...",
    "Analyzing academic trends for your passage...",
    "Preparing your reading challenge...",
    "Generating dynamic question sets...",
    "Almost ready for your academic response..."
  ];

  const evaluationMessages = [
    "Our AI Scholar is cross-referencing your answers...",
    "Checking accuracy and band score mapping...",
    "Evaluating your reading comprehension...",
    "Assessing your performance...",
    "Finalizing your band score report..."
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading || isSubmitting) {
      let i = 0;
      const messages = isLoading ? loadingMessages : evaluationMessages;
      setLoadingMessage(messages[0]);
      interval = setInterval(() => {
        i = (i + 1) % messages.length;
        setLoadingMessage(messages[i]);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isLoading, isSubmitting]);

  useEffect(() => {
    const checkProgress = async () => {
      if (!user) return;
      try {
        const progressId = `${user.uid}_Reading_${isFullTest ? 'full' : 'short'}`;
        const progressDoc = await getDoc(doc(db, 'progress', progressId));
        if (progressDoc.exists()) {
          const data = progressDoc.data();
          if (data.passages && data.passages.length > 0) {
            setPassages(data.passages);
            setCurrentPassageIdx(data.currentPassageIdx || 0);
            setAnswers(data.answers || {});
            setSubmittedPassages(data.submittedPassages || [false, false, false]);
            setTimeLeft(data.timeLeft || (isFullTest ? 3600 : 1200));
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

  // Section-wise generation: generate the next section lazily when current is submitted
  const generateNextSectionIfNeeded = async (nextIdx: number) => {
    if (passages[nextIdx] || !isFullTest || testSource !== 'ai') return; // Already generated or not AI
    setIsLoadingNextSection(true);
    try {
      const passageNumber = nextIdx + 1; // 1-indexed
      const newPassage = await generateReadingSection(passageNumber, isAcademic);
      setPassages(prev => {
        const updated = [...prev];
        updated[nextIdx] = newPassage;
        return updated;
      });
    } catch (error) {
      console.error(`Failed to generate section ${nextIdx + 1}:`, error);
      toast.error(`Failed to generate Passage ${nextIdx + 1}. Please try again.`);
    } finally {
      setIsLoadingNextSection(false);
    }
  };

  const handleStartPractice = async (source: 'ai' | 'curated', type: 'academic' | 'gt', testId?: string) => {
    setTestSource(source);
    setIsAcademic(type === 'academic');
    setIsLoading(true);
    
    if (source === 'ai') {
      try {
        if (isFullTest) {
          // Section-wise: only generate the FIRST passage immediately
          const firstPassage = await generateReadingSection(1, type === 'academic');
          setPassages([firstPassage]); // Start with just passage 1
          setSubmittedPassages([false, false, false]);
          // Pre-fetch passage 2 in the background (non-blocking)
          generateReadingSection(2, type === 'academic').then(p2 => {
            setPassages(prev => {
              const updated = [...prev];
              updated[1] = p2;
              return updated;
            });
          }).catch(err => console.warn('Background fetch of Passage 2 failed:', err));
        } else {
          const data = await generateReadingPassage(false, type === 'academic');
          setPassages([data]);
        }
      } catch (error) {
        console.error("Failed to fetch passage:", error);
        toast.error("Failed to load AI test.");
        setTestSource(null);
      } finally {
        setIsLoading(false);
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
            where('skill', '==', 'Reading'),
            where('type', '==', type === 'academic' ? 'Academic' : 'General Training'),
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
           setPassages(parsedContent.map((p: any, i: number) => ({ ...p, id: testData.id + '_' + i })));
        } else {
           setPassages([{
             id: testData.id,
             title: testData.title || "Teacher Curated Reading",
             content: testData.content,
             questions: [] 
           }]);
        }
      } catch (error) {
        toast.error("Failed to fetch curated test.");
        setTestSource(null);
      } finally {
        setIsLoading(false);
      }
    }
  };

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

  const handleAnswerChange = (qId: string, value: string) => {
    if (isFullTest && submittedPassages[currentPassageIdx]) return;
    setAnswers(prev => ({ ...prev, [qId]: value }));
  };

  const handleSubmitPassage = () => {
    const passageQuestions = passages[currentPassageIdx]?.questions || [];
    const answeredInPassage = passageQuestions.every(q => answers[q.id]?.trim());
    
    if (!answeredInPassage) {
      toast.error("Please answer all questions in this passage before submitting.");
      return;
    }

    setSubmittedPassages(prev => {
      const next = [...prev];
      next[currentPassageIdx] = true;
      return next;
    });
    toast.success(`Passage ${currentPassageIdx + 1} submitted successfully.`);

    // For section-wise: trigger generation of next section if needed
    if (isFullTest && currentPassageIdx < 2) {
      const nextIdx = currentPassageIdx + 1;
      if (!passages[nextIdx]) {
        generateNextSectionIfNeeded(nextIdx);
      }
      // Also pre-fetch section after that
      if (nextIdx + 1 <= 2 && !passages[nextIdx + 1]) {
        generateReadingSection(nextIdx + 2, isAcademic).then(p => {
          setPassages(prev => {
            const updated = [...prev];
            updated[nextIdx + 1] = p;
            return updated;
          });
        }).catch(() => {});
      }
    }
  };

  const handleSaveProgress = async () => {
    if (!user) return;
    setIsSaving(true);
    
    const progressId = `${user.uid}_Reading_${isFullTest ? 'full' : 'short'}`;
    const progressData = {
      userId: user.uid,
      skill: 'Reading',
      isAcademic,
      isFullTest,
      answers: answers || {},
      currentPassageIdx: currentPassageIdx || 0,
      submittedPassages: submittedPassages || [],
      timeLeft: timeLeft || 3600,
      updatedAt: serverTimestamp(),
      testId: passages[0]?.id || 'generated',
      passages: passages || []
    };

    try {
      await setDoc(doc(db, 'progress', progressId), progressData);
      toast.success("Progress saved successfully.");
    } catch (error) {
      console.error(`[ReadingPractice] SAVE FAILED:`, error);
      const firestoreError = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to save progress: ${firestoreError.slice(0, 50)}...`);
    } finally {
      setIsSaving(false);
    }
  };

  /** Core submit logic shared by both AI and Teacher submit */
  const executeSubmission = async (submitToTeacher: boolean) => {
    if (passages.length === 0 || !user) return;

    let totalQuestionsCount = 0;
    passages.forEach(p => totalQuestionsCount += p.questions.length);
    
    const answeredCount = Object.values(answers).filter(a => a.trim() !== '').length;
    
    if (!submittedPassages.slice(0, passages.length).every(s => s)) {
      toast.error(isFullTest ? "Please submit all passages before finalizing the test." : "Please submit the passage before finalizing the test.");
      return;
    }

    if (answeredCount < totalQuestionsCount) {
      toast.error(`Please attempt all ${totalQuestionsCount} questions before submitting. You have answered ${answeredCount}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const correctAnswers: Record<string, string> = {};
      let totalQuestions = 0;
      passages.forEach(p => {
        p.questions.forEach(q => {
          correctAnswers[q.id] = q.answer;
          totalQuestions++;
        });
      });

      const evaluationResult = await evaluateReadingListening('Reading', answers, correctAnswers, totalQuestions, isAcademic);
      
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
        type: 'Reading',
        isAcademic,
        title: isFullTest ? `Full ${isAcademic ? 'Academic' : 'General Training'} Reading Test` : `Reading (${isAcademic ? 'Academic' : 'GT'}): ${passages[0].title}`,
        date: new Date().toISOString(),
        score: evaluation.overallBand,
        feedback: evaluation.feedback,
        evaluation,
        content: `Raw Score: ${evaluationResult.score}/${totalQuestions}\nBand Score: ${evaluationResult.bandScore}`,
        prompt: isFullTest ? passages.map(p => p.title).join(', ') : passages[0].title,
        needsAdminReview: submitToTeacher,
        adminEvaluation: null,
        status: submitToTeacher ? 'pending_review' : 'completed'
      };
      
      const docRef = await addDoc(collection(db, 'attempts'), attemptData);

      await createAdminAlert(
        'Reading',
        submitToTeacher 
          ? `📝 ${user.name || 'Student'} submitted Reading for teacher review (AI Band: ${evaluationResult.bandScore})`
          : `New Reading submission from ${user.name || 'Student'}`,
        `/admin?tab=evaluations&id=${docRef.id}`
      );

      if (submitToTeacher) {
        toast.success(`Submitted to teacher! AI estimated Band: ${evaluationResult.bandScore}`);
      }

      navigate(`/evaluation/${docRef.id}`, {
        state: {
          evaluation,
          content: attemptData.content,
          prompt: isFullTest ? passages.map(p => p.title).join(', ') : passages[0].title,
          type: 'Reading'
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

  const answeredInPassage = (passage: ReadingPassage) => {
    return passage.questions.filter(q => answers[q.id]).length;
  };

  const totalQuestionsAnswered = Object.values(answers).filter(a => a.trim() !== '').length;
  const totalQuestionsExpected = isFullTest ? 40 : (currentPassage?.questions.length || 0);

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
          skill="Reading"
          onSelect={handleStartPractice}
          title={isFullTest ? "Full Reading Test" : "Quick Reading Practice"}
        />
      ) : (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="max-w-7xl mx-auto flex flex-col gap-4 md:gap-8 relative px-2 md:px-0"
        >
      <AnimatePresence>
        {(isSubmitting || isLoading) && (
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
                  <BookOpen size={24} className="text-primary/40" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-xl md:text-2xl font-serif italic text-primary">
                  {isLoading ? (isFullTest ? "Generating Section 1" : "Generating Dynamic Passage") : "Calculating Your Score"}
                </h3>
                <motion.p 
                  key={loadingMessage}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-ink-muted mt-2 min-h-[3rem] text-sm md:text-base"
                >
                  {loadingMessage}
                </motion.p>
                {isLoading && isFullTest && (
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
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/20 shrink-0">
            <BookOpen size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg md:text-2xl font-serif italic text-primary">
                Reading {isFullTest ? "Full Test" : "Practice"}
              </h2>
              <span className={cn(
                "px-2 py-0.5 text-[10px] font-bold rounded-md",
                isAcademic ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"
              )}>
                {isAcademic ? 'ACADEMIC' : 'GT'}
              </span>
            </div>
            <p className="text-ink-muted text-xs md:text-sm truncate">
              {isFullTest ? `Passage ${currentPassageIdx + 1} of 3` : currentPassage?.title || 'Loading...'}
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

      {/* Passage tabs — responsive */}
      {isFullTest && (
        <div className="flex gap-2 md:gap-4 overflow-x-auto pb-1">
          {[0, 1, 2].map((idx) => {
            const passage = passages[idx];
            const isLocked = idx > 0 && !submittedPassages[idx - 1];
            const isSubmitted = submittedPassages[idx];
            const isGenerating = !passage && !isLocked;
            
            return (
              <button
                key={idx}
                disabled={isLocked || !passage}
                onClick={() => setCurrentPassageIdx(idx)}
                className={cn(
                  "flex-1 min-w-[100px] p-2.5 md:p-4 rounded-xl border transition-all text-left relative",
                  currentPassageIdx === idx 
                    ? "bg-primary border-primary text-white shadow-md" 
                    : isLocked || !passage
                      ? "bg-bg border-line text-ink-muted opacity-50 cursor-not-allowed"
                      : "bg-surface border-line text-ink hover:bg-bg"
                )}
              >
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <p className={cn("text-[10px] uppercase tracking-widest font-bold mb-0.5", currentPassageIdx === idx ? "text-white/70" : "text-ink-muted")}>Passage {idx + 1}</p>
                    <p className="text-xs md:text-sm font-bold truncate max-w-[120px] md:max-w-[150px]">
                      {passage ? passage.title : (isGenerating ? "Generating..." : "Locked")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    {isSubmitted ? (
                      <CheckCircle2 size={14} className="text-emerald-500" />
                    ) : passage ? (
                      <span className="text-[10px] font-bold opacity-70">{answeredInPassage(passage)}/{passage.questions.length}</span>
                    ) : isGenerating ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Loading next section indicator */}
      {isLoadingNextSection && (
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
          <Loader2 size={18} className="animate-spin text-primary" />
          <p className="text-sm text-primary font-medium">Generating next passage in the background...</p>
        </div>
      )}

      {/* Main content — responsive grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8 min-h-[50vh] lg:h-[calc(100vh-320px)]">
        {/* Reading Passage */}
        <div className="scholar-card overflow-y-auto pr-4 md:pr-8 custom-scrollbar bg-surface border border-line max-h-[50vh] lg:max-h-none">
          {currentPassage ? (
            <>
              <img 
                src={currentPassage.imageUrl || `https://picsum.photos/seed/${currentPassage.id}/800/400`} 
                alt="Passage Visual" 
                className="w-full h-40 md:h-64 object-cover rounded-xl mb-4 md:mb-8 border border-line shadow-sm"
                referrerPolicy="no-referrer"
              />
              
              <h3 className="text-xl md:text-3xl font-serif italic text-primary mb-4 md:mb-6">
                {currentPassage.title}
              </h3>
              
              <div className="space-y-4 md:space-y-6 text-base md:text-lg font-serif italic leading-relaxed text-ink whitespace-pre-wrap">
                {currentPassage.content}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-12 text-ink-muted gap-4">
              <Loader2 size={32} className="animate-spin text-primary" />
              <p className="text-sm italic">Generating this passage...</p>
            </div>
          )}
        </div>

        {/* Questions Section */}
        <div className="scholar-card overflow-y-auto bg-surface/30 border-dashed border border-line max-h-[60vh] lg:max-h-none">
          <div className="flex items-center gap-2 text-primary mb-4 md:mb-8">
            <HelpCircle size={18} />
            <h3 className="font-bold text-sm uppercase tracking-widest">Questions</h3>
            {currentPassage && (
              <span className="ml-auto text-xs text-ink-muted">
                {answeredInPassage(currentPassage)}/{currentPassage.questions.length} answered
              </span>
            )}
          </div>

          <div className="space-y-6 md:space-y-10">
            {currentPassage?.questions.map((q, idx) => (
              <div key={q.id} className="space-y-3 md:space-y-4">
                <p className="text-sm font-bold text-ink">{idx + 1}. {q.text}</p>
                {(q.type === 'mcq' || q.type === 'true-false-ng') && q.options ? (
                  <div className="grid grid-cols-1 gap-2">
                    {q.options.map((opt) => (
                      <label key={opt} className="flex items-center gap-3 p-2.5 md:p-3 rounded-xl border border-line bg-bg hover:bg-primary/5 cursor-pointer transition-all">
                        <input 
                          type="radio" 
                          name={q.id} 
                          className="hidden" 
                          disabled={submittedPassages[currentPassageIdx]}
                          onChange={() => handleAnswerChange(q.id, opt)}
                          checked={answers[q.id] === opt}
                        />
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all shrink-0",
                          answers[q.id] === opt ? "bg-primary border-primary text-white" : "border-line text-ink-muted"
                        )}>
                          {opt[0]}
                        </div>
                        <span className="text-sm text-ink">{opt}</span>
                      </label>
                    ))}
                  </div>
                ) : q.type === 'true-false-ng' && !q.options ? (
                  <div className="grid grid-cols-3 gap-2">
                    {['True', 'False', 'Not Given'].map(opt => (
                      <button
                        key={opt}
                        disabled={submittedPassages[currentPassageIdx]}
                        onClick={() => handleAnswerChange(q.id, opt)}
                        className={cn(
                          "p-2.5 rounded-lg border text-sm font-bold text-center transition-all",
                          answers[q.id] === opt
                            ? "bg-primary border-primary text-white shadow-md"
                            : "bg-bg border-line hover:border-primary/50 text-ink disabled:opacity-50"
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input 
                    type="text"
                    value={answers[q.id] || ''}
                    disabled={isFullTest && submittedPassages[currentPassageIdx]}
                    onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                    placeholder="Type your answer here..."
                    className="w-full bg-bg border border-line rounded-lg px-4 py-2 text-sm outline-none focus:border-primary text-ink disabled:opacity-50"
                  />
                )}
              </div>
            ))}
          </div>
          
          {/* Bottom navigation + submit */}
          <div className="mt-8 md:mt-12 pt-6 md:pt-8 border-t border-line space-y-4">
            {/* Passage navigation */}
            <div className="flex justify-between items-center">
              <button 
                disabled={currentPassageIdx === 0}
                onClick={() => setCurrentPassageIdx(prev => prev - 1)}
                className="flex items-center gap-1 text-xs md:text-sm font-bold text-ink-muted hover:text-primary disabled:opacity-30"
              >
                <ChevronLeft size={16} /> Prev
              </button>
              
              {!submittedPassages[currentPassageIdx] && currentPassage && (
                <button
                  onClick={handleSubmitPassage}
                  className="bg-emerald-600 text-white px-4 md:px-6 py-2 rounded-lg text-xs md:text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                >
                  <CheckCircle2 size={16} /> Submit Passage {isFullTest ? currentPassageIdx + 1 : ''}
                </button>
              )}

              <button 
                disabled={currentPassageIdx >= (isFullTest ? 2 : passages.length - 1) || (isFullTest && !submittedPassages[currentPassageIdx]) || !passages[currentPassageIdx + 1]}
                onClick={() => setCurrentPassageIdx(prev => prev + 1)}
                className="flex items-center gap-1 text-xs md:text-sm font-bold text-ink-muted hover:text-primary disabled:opacity-30"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>

            {/* Dual submit buttons — show when all passages submitted */}
            {submittedPassages.slice(0, isFullTest ? 3 : passages.length).every(s => s) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-line">
                <button
                  onClick={handleSubmitToAI}
                  disabled={isSubmitting}
                  className="bg-primary text-white px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary-light transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Bot size={18} />}
                  Submit to AI Evaluation
                </button>
                <button
                  onClick={handleSubmitToTeacher}
                  disabled={isSubmitting}
                  className="bg-secondary text-white px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-secondary/90 transition-all shadow-lg shadow-secondary/20 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <GraduationCap size={18} />}
                  Submit to Teacher
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress indicator — mobile friendly */}
      <div className="flex items-center gap-3 bg-surface border border-line rounded-xl px-4 py-3">
        <div className="flex-1">
          <div className="flex justify-between text-xs text-ink-muted mb-1">
            <span>Total Progress</span>
            <span>{totalQuestionsAnswered} / {totalQuestionsExpected} questions</span>
          </div>
          <div className="h-1.5 bg-line rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500 rounded-full" 
              style={{ width: `${totalQuestionsExpected > 0 ? (totalQuestionsAnswered / totalQuestionsExpected) * 100 : 0}%` }} 
            />
          </div>
        </div>
      </div>

      </motion.div>
    )}
    </AnimatePresence>
  );
}
