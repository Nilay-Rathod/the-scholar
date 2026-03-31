import React from 'react';
import { motion } from 'motion/react';
import { 
  FileText, 
  CheckCircle2, 
  MessageSquare, 
  ArrowLeft,
  Download,
  Share2,
  AlertCircle,
  Lightbulb,
  Loader2,
  GraduationCap,
  Clock,
  Zap,
  TrendingUp,
  Library,
  ChevronRight,
  Quote
} from 'lucide-react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../App';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';

const ScoreBadge = ({ label, score, delay = 0, active = false, onClick }: { label: string, score: number, delay?: number, active?: boolean, onClick?: () => void }) => {
  const percentage = (score / 9) * 100;
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      onClick={onClick}
      className={cn(
        "flex flex-col gap-2 p-3 rounded-xl border transition-all group shadow-sm cursor-pointer",
        active ? "bg-primary/5 border-primary shadow-md" : "bg-bg border-line hover:border-primary/30"
      )}
    >
      <div className="flex justify-between items-center">
        <span className={cn(
          "text-[10px] uppercase tracking-widest font-bold transition-colors",
          active ? "text-primary" : "text-ink-muted group-hover:text-primary"
        )}>{label}</span>
        <span className={cn(
          "text-lg font-serif italic font-bold",
          active ? "text-primary" : "text-primary/60 group-hover:text-primary"
        )}>{score.toFixed(1)}</span>
      </div>
      <div className="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ delay: delay + 0.3, duration: 1, ease: "easeOut" }}
          className={cn(
            "h-full shadow-[0_0_10px_rgba(var(--secondary),0.5)]",
            active ? "bg-secondary" : "bg-secondary/40 group-hover:bg-secondary"
          )}
        />
      </div>
    </motion.div>
  );
};

export default function EvaluationReport() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { id } = useParams();
  const reportRef = React.useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [submissionData, setSubmissionData] = React.useState<any>(location.state);
  const [activeCriteria, setActiveCriteria] = React.useState<string>('taskResponse');
  const [isRequestingReview, setIsRequestingReview] = React.useState(false);
  
  React.useEffect(() => {
    const fetchAttempt = async () => {
      if (!submissionData && id) {
        setIsLoading(true);
        try {
          const docRef = doc(db, 'attempts', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setSubmissionData(docSnap.data());
          }
        } catch (error) {
          console.error("Error fetching attempt:", error);
          handleFirestoreError(error, OperationType.GET, `attempts/${id}`);
        } finally {
          setIsLoading(false);
        }
      }
    };
    fetchAttempt();
  }, [id, submissionData]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `IELTS ${submissionData?.type || 'Practice'} Report`,
          text: `Check out my IELTS ${submissionData?.type} practice report! I scored a band ${submissionData?.evaluation?.overallBand?.toFixed(1)}.`,
          url: window.location.href,
        });
        toast.success('Report shared successfully!');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          toast.error('Failed to share report');
        }
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    }
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  const handleRequestReview = async () => {
    if (!id || isRequestingReview) return;
    
    setIsRequestingReview(true);
    try {
      const docRef = doc(db, 'attempts', id!);
      const updateData: any = {
        needsAdminReview: true,
        status: 'pending_review',
        reviewRequestedAt: new Date().toISOString(),
        assignedTeacherId: null, // Reset assignment so admin can re-assign
      };

      // If it's a re-evaluation, we might want to preserve the old evaluation in a history field
      // For now, we just reset the primary evaluation fields to trigger a fresh review
      if (submissionData?.adminEvaluation) {
        updateData.previousEvaluation = submissionData.adminEvaluation;
        updateData.adminEvaluation = null;
      }

      await updateDoc(docRef, updateData);
      
      setSubmissionData({
        ...submissionData,
        ...updateData
      });
      toast.success(submissionData?.adminEvaluation ? "Re-evaluation request submitted!" : "Professional review requested! A teacher will evaluate your work shortly.");
    } catch (error) {
      console.error("Error requesting review:", error);
      toast.error("Failed to request review. Please try again.");
    } finally {
      setIsRequestingReview(false);
    }
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Loader2 size={48} className="animate-spin text-primary" />
      <p className="text-xl font-serif italic text-primary">Retrieving your evaluation...</p>
    </div>
  );

  if (!submissionData || !submissionData.evaluation) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <AlertCircle size={48} className="text-amber-500" />
      <p className="text-xl font-serif italic text-primary">No evaluation data found.</p>
      <button onClick={() => navigate(-1)} className="text-primary font-bold hover:underline">Go Back</button>
    </div>
  );

  const { evaluation, content, prompt, type = 'Writing' } = submissionData;

  const isReadingListening = type === 'Reading' || type === 'Listening';

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="max-w-6xl mx-auto flex flex-col gap-8 pb-12"
    >
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-ink-muted hover:text-primary transition-colors font-bold text-sm"
        >
          <ArrowLeft size={18} /> Back to Archive
        </button>
        <div className="flex gap-3">
          <button 
            onClick={() => navigate(`/practice/${type.toLowerCase()}`)}
            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-primary-light transition-all shadow-lg shadow-primary/20"
          >
            Next Practice Session
          </button>
          <button 
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="bg-white border border-line px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-surface transition-all disabled:opacity-50"
          >
            {isDownloading ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
            {isDownloading ? 'Generating...' : 'Download PDF'}
          </button>
          <button 
            onClick={handleShare}
            className="bg-white border border-line px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-surface transition-all"
          >
            <Share2 size={18} /> Share Report
          </button>
        </div>
      </div>

      <div id="report-content" ref={reportRef} className="bg-bg p-8 rounded-2xl transition-colors duration-300">
        {/* Review Status Banner */}
        {submissionData.needsAdminReview && !submissionData.adminEvaluation && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600 shrink-0">
              <Clock size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-700">Awaiting Professional Review</p>
              <p className="text-xs text-amber-600/80 italic">An official IELTS marker will review your submission shortly. You'll see your human-validated score here once complete.</p>
            </div>
          </motion.div>
        )}

        {submissionData.adminEvaluation && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 shrink-0">
              <CheckCircle2 size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-emerald-700">Official Evaluation Complete</p>
              <p className="text-xs text-emerald-600/80 italic">Your submission has been reviewed and validated by an expert IELTS marker.</p>
            </div>
          </motion.div>
        )}

        {/* Student Info Header */}
        <div className="flex items-center justify-between mb-12 pb-8 border-b border-line">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-white shadow-xl shadow-primary/20">
              <GraduationCap size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-serif italic text-primary">Academic Evaluation Report</h1>
              <p className="text-ink-muted text-sm uppercase tracking-widest font-bold">IELTS Scholar Practice Module</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-ink">{user?.name || 'Scholar'}</p>
            <p className="text-xs text-ink-muted">ID: {user?.uid?.slice(-8).toUpperCase() || 'N/A'}</p>
            <p className="text-xs text-ink-muted mt-1">{new Date(submissionData?.date || Date.now()).toLocaleDateString('en-US', { dateStyle: 'long' })}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Column: Scores & Feedback */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="scholar-card border-2 border-primary/20 overflow-hidden relative shadow-2xl transition-all duration-500">
            <div className="flex justify-between items-start mb-4">
              <p className="text-[10px] uppercase tracking-widest font-bold text-ink-muted">AI Band Score</p>
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[8px] font-bold uppercase">Automated</span>
            </div>
            <motion.div 
              initial={{ scale: 1.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="relative z-10"
            >
              <h3 className="text-8xl font-serif italic text-primary drop-shadow-sm tracking-tighter">{evaluation.overallBand.toFixed(1)}</h3>
            </motion.div>
            
            <div className="mt-8 pt-8 border-t border-line flex flex-col gap-4 relative z-10">
              <ScoreBadge 
                label={isReadingListening ? "Raw Score" : "Task Response"} 
                score={typeof evaluation.criteria.taskResponse === 'object' ? evaluation.criteria.taskResponse.score : evaluation.criteria.taskResponse} 
                active={activeCriteria === 'taskResponse'}
                onClick={() => setActiveCriteria('taskResponse')}
                delay={0.1} 
              />
              <ScoreBadge 
                label={isReadingListening ? "Band Score" : "Coherence"} 
                score={typeof evaluation.criteria.coherenceCohesion === 'object' ? evaluation.criteria.coherenceCohesion.score : evaluation.criteria.coherenceCohesion} 
                active={activeCriteria === 'coherenceCohesion'}
                onClick={() => setActiveCriteria('coherenceCohesion')}
                delay={0.2} 
              />
              <ScoreBadge 
                label="Lexical" 
                score={typeof evaluation.criteria.lexicalResource === 'object' ? evaluation.criteria.lexicalResource.score : evaluation.criteria.lexicalResource} 
                active={activeCriteria === 'lexicalResource'}
                onClick={() => setActiveCriteria('lexicalResource')}
                delay={0.3} 
              />
              <ScoreBadge 
                label="Grammar" 
                score={typeof evaluation.criteria.grammaticalRange === 'object' ? evaluation.criteria.grammaticalRange.score : evaluation.criteria.grammaticalRange} 
                active={activeCriteria === 'grammaticalRange'}
                onClick={() => setActiveCriteria('grammaticalRange')}
                delay={0.4} 
              />
            </div>
          </div>

          {/* Request Expert Review Button */}
          {(!submissionData.needsAdminReview) && (
            <button
              onClick={handleRequestReview}
              disabled={isRequestingReview}
              className="w-full py-4 rounded-2xl bg-surface border border-line text-primary font-bold text-xs uppercase tracking-widest hover:border-primary transition-all flex items-center justify-center gap-2 group"
            >
              {isRequestingReview ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <GraduationCap size={16} className="group-hover:scale-110 transition-transform" />
              )}
              {submissionData.adminEvaluation ? "Request Re-evaluation" : "Request Expert Review"}
            </button>
          )}

          {submissionData.adminEvaluation && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="scholar-card border-2 border-secondary/20 bg-secondary/5 overflow-hidden relative shadow-xl"
            >
              <div className="flex justify-between items-start mb-4">
                <p className="text-[10px] uppercase tracking-widest font-bold text-secondary">Official Score</p>
                <span className="px-2 py-0.5 rounded-full bg-secondary text-white text-[8px] font-bold uppercase">Validated</span>
              </div>
              <h3 className="text-7xl font-serif italic text-secondary drop-shadow-sm tracking-tighter">
                {submissionData.adminEvaluation.score.toFixed(1)}
              </h3>
              <p className="text-[10px] text-ink-muted mt-2 font-bold uppercase tracking-widest">Expert Mark</p>
            </motion.div>
          )}

          <div className="scholar-card">
            <div className="flex items-center gap-2 text-primary mb-4">
              <MessageSquare size={18} />
              <h3 className="font-bold text-sm uppercase tracking-widest">Scholar's Feedback</h3>
            </div>
            <p className="text-sm text-ink leading-relaxed italic mb-6">
              "{evaluation.overallFeedback || evaluation.feedback}"
            </p>

            {submissionData.adminEvaluation && (
              <div className="mt-8 pt-8 border-t-2 border-line border-dashed">
                <div className="flex items-center gap-2 text-secondary mb-4">
                  <GraduationCap size={18} />
                  <h3 className="font-bold text-sm uppercase tracking-widest">Professional Feedback</h3>
                </div>
                <div className="p-6 rounded-2xl bg-secondary/5 border border-secondary/10 italic text-sm text-ink leading-relaxed font-serif">
                  "{submissionData.adminEvaluation.feedback}"
                </div>
              </div>
            )}
            
            {evaluation.task1Analysis && (
              <div className="mt-6 pt-6 border-t border-line">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-primary">Task 1 Analysis</h4>
                  <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded">Band {evaluation.task1Analysis.score}</span>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed mb-4 italic">"{evaluation.task1Analysis.feedback}"</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-emerald-600 mb-1">Strengths</p>
                    <ul className="text-[10px] list-disc list-inside text-ink-muted">
                      {evaluation.task1Analysis.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-amber-600 mb-1">Weaknesses</p>
                    <ul className="text-[10px] list-disc list-inside text-ink-muted">
                      {evaluation.task1Analysis.weaknesses.map((w: string, i: number) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {evaluation.task2Analysis && (
              <div className="mt-6 pt-6 border-t border-line">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-primary">Task 2 Analysis</h4>
                  <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded">Band {evaluation.task2Analysis.score}</span>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed mb-4 italic">"{evaluation.task2Analysis.feedback}"</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-emerald-600 mb-1">Strengths</p>
                    <ul className="text-[10px] list-disc list-inside text-ink-muted">
                      {evaluation.task2Analysis.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-amber-600 mb-1">Weaknesses</p>
                    <ul className="text-[10px] list-disc list-inside text-ink-muted">
                      {evaluation.task2Analysis.weaknesses.map((w: string, i: number) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {evaluation.actionPlan && (
            <div className="scholar-card border-secondary/20 bg-secondary/[0.02]">
              <div className="flex items-center gap-2 text-secondary mb-6">
                <TrendingUp size={18} />
                <h3 className="font-bold text-sm uppercase tracking-widest">Growth Strategy</h3>
              </div>
              
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 text-emerald-600 mb-2">
                    <Zap size={14} />
                    <span className="text-[10px] font-extrabold uppercase tracking-widest">Immediate Fixes</span>
                  </div>
                  <ul className="space-y-2">
                    {evaluation.actionPlan.immediate.map((item: string, i: number) => (
                      <li key={i} className="text-xs text-ink flex gap-2">
                        <ChevronRight size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-primary mb-2">
                    <TrendingUp size={14} />
                    <span className="text-[10px] font-extrabold uppercase tracking-widest">Short-term Goals</span>
                  </div>
                  <ul className="space-y-2">
                    {evaluation.actionPlan.shortTerm.map((item: string, i: number) => (
                      <li key={i} className="text-xs text-ink flex gap-2">
                        <ChevronRight size={12} className="text-primary shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-ink-muted mb-2">
                    <Library size={14} />
                    <span className="text-[10px] font-extrabold uppercase tracking-widest">Recommended Resources</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {evaluation.actionPlan.resources.map((res: string, i: number) => (
                      <span key={i} className="text-[9px] bg-surface border border-line px-2 py-1 rounded-full font-bold text-ink-muted">
                        {res}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Submission & Corrections */}
        <div className="lg:col-span-3 flex flex-col gap-8">
          <div className="scholar-card">
            <h3 className="text-xl font-serif italic text-primary mb-6">{type} Practice Report</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="p-6 bg-surface rounded-3xl border border-line relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <Quote size={64} className="text-primary" />
                </div>
                <div className="flex items-center gap-2 text-primary mb-4">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Lightbulb size={16} />
                  </div>
                  <h4 className="text-[10px] font-extrabold uppercase tracking-widest">Rubric Analysis: {activeCriteria.replace(/([A-Z])/g, ' $1').trim()}</h4>
                </div>
                
                {typeof evaluation.criteria[activeCriteria] === 'object' ? (
                  <div className="space-y-4">
                    <p className="text-sm text-ink leading-relaxed font-serif italic">
                      {evaluation.criteria[activeCriteria].feedback}
                    </p>
                    {evaluation.criteria[activeCriteria].evidence?.length > 0 && (
                      <div className="pt-4 border-t border-line/50">
                        <p className="text-[9px] font-bold text-ink-muted uppercase tracking-wider mb-2">Evidence from your text:</p>
                        <div className="flex flex-col gap-2">
                          {evaluation.criteria[activeCriteria].evidence.map((quote: string, i: number) => (
                            <div key={i} className="text-xs text-ink-muted border-l-2 border-primary/20 pl-3 py-1 bg-primary/[0.02]">
                              "{quote}"
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-ink-muted italic">Click on a score badge to view detailed rubric analysis and evidence.</p>
                )}
              </div>

              {prompt.includes('Task 1:') && prompt.includes('Task 2:') ? (
                <div className="space-y-4">
                  <div className="p-4 bg-bg rounded-2xl border border-line">
                    <p className="text-[8px] uppercase tracking-widest font-bold text-primary mb-1">Task 1 Prompt</p>
                    <p className="text-[10px] font-serif italic text-ink-muted line-clamp-2">
                      {prompt.split('Task 2:')[0].replace('Task 1:', '').trim()}
                    </p>
                  </div>
                  <div className="p-4 bg-bg rounded-2xl border border-line">
                    <p className="text-[8px] uppercase tracking-widest font-bold text-primary mb-1">Task 2 Topic</p>
                    <p className="text-[10px] font-serif italic text-ink-muted line-clamp-2">
                      {prompt.split('Task 2:')[1]?.trim()}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-bg rounded-3xl border border-line flex flex-col justify-center">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-ink-muted mb-2">Examination Prompt</p>
                  <p className="text-sm font-serif italic text-ink-muted leading-relaxed line-clamp-4">
                    {prompt}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <p className="text-[10px] uppercase tracking-widest font-bold text-ink-muted">
                {type === 'Speaking' ? 'Transcript' : type === 'Writing' ? 'Your Submission' : 'Performance Summary'}
              </p>
              <div className="text-lg font-serif italic leading-relaxed text-ink whitespace-pre-wrap">
                {type === 'Writing' && content.includes('Task 1:') && content.includes('Task 2:') ? (
                  <div className="space-y-8">
                    <div>
                      <h4 className="text-sm font-bold text-primary mb-4 border-b border-line pb-2">Task 1 Response</h4>
                      <div className="text-base font-serif italic leading-relaxed text-ink">
                        {content.split('Task 2:')[0].replace('Task 1:', '').trim().split('\n\n').map((para: string, i: number) => (
                          <p key={i} className="mb-4">{para}</p>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-primary mb-4 border-b border-line pb-2">Task 2 Response</h4>
                      <div className="text-base font-serif italic leading-relaxed text-ink">
                        {content.split('Task 2:')[1]?.trim().split('\n\n').map((para: string, i: number) => (
                          <p key={i} className="mb-4">{para}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : type === 'Writing' || type === 'Speaking' ? (
                  content.split('\n\n').map((para: string, i: number) => (
                    <p key={i} className="mb-6">
                      {para}
                    </p>
                  ))
                ) : (
                  <p>{content}</p>
                )}
              </div>
            </div>
          </div>

          {evaluation.corrections && evaluation.corrections.length > 0 && (
            <div className="scholar-card">
              <h3 className="text-lg font-serif italic text-primary mb-6">
                {isReadingListening ? 'Answer Key Review' : 'Detailed Corrections'}
              </h3>
              <div className="space-y-4">
                {evaluation.corrections.map((corr: any, i: number) => (
                  <div key={i} className="flex items-start gap-6 p-4 rounded-xl border border-line hover:bg-surface transition-all">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={cn(
                          "text-xs font-bold",
                          isReadingListening ? "text-ink" : "text-red-500 line-through"
                        )}>
                          {isReadingListening ? `Your Answer: ${corr.original}` : corr.original}
                        </span>
                        <span className="text-xs font-bold text-secondary">
                          {isReadingListening ? `Correct: ${corr.correction}` : `→ ${corr.correction}`}
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted italic">{corr.reason}</p>
                    </div>
                    <div className={cn(
                      "p-2 rounded-lg",
                      corr.reason === 'Correct' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {corr.reason === 'Correct' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </motion.div>
  );
}
