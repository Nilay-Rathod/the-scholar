import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  User, 
  Calendar, 
  BookOpen, 
  MessageSquare,
  GraduationCap,
  PenTool,
  Loader2,
  Copy,
  LayoutDashboard,
  BrainCircuit,
  Quote
} from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { WritingEvaluation } from '../services/geminiService';

interface AdminEvaluationReviewProps {
  attempt: any;
  onClose: () => void;
  onUpdated: () => void;
}

export default function AdminEvaluationReview({ attempt, onClose, onUpdated }: AdminEvaluationReviewProps) {
  const aiEvaluation: WritingEvaluation | null = attempt.evaluation || null;
  const [activeTab, setActiveTab] = useState<'taskResponse' | 'coherenceCohesion' | 'lexicalResource' | 'grammaticalRange'>('taskResponse');
  const [manualEvaluation, setManualEvaluation] = useState<any>({
    score: attempt.adminEvaluation?.score || attempt.score || 6.0,
    overallFeedback: attempt.adminEvaluation?.overallFeedback || attempt.adminEvaluation?.feedback || '',
    criteria: attempt.adminEvaluation?.criteria || {
      taskResponse: { score: 6.0, feedback: '' },
      coherenceCohesion: { score: 6.0, feedback: '' },
      lexicalResource: { score: 6.0, feedback: '' },
      grammaticalRange: { score: 6.0, feedback: '' }
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCloneAI = () => {
    if (!aiEvaluation) {
      toast.error("No AI evaluation found to clone.");
      return;
    }

    const clonedCriteria: any = {};
    Object.keys(aiEvaluation.criteria).forEach(key => {
      const crit = aiEvaluation.criteria[key as keyof typeof aiEvaluation.criteria];
      clonedCriteria[key] = {
        score: typeof crit === 'object' ? crit.score : crit,
        feedback: typeof crit === 'object' ? crit.feedback : ''
      };
    });

    setManualEvaluation({
      ...manualEvaluation,
      score: aiEvaluation.overallBand,
      overallFeedback: aiEvaluation.overallFeedback,
      criteria: clonedCriteria
    });
    toast.success("AI findings cloned! You can now refine the feedback.");
  };

  const updateCriterion = (field: string, value: any) => {
    setManualEvaluation({
      ...manualEvaluation,
      criteria: {
        ...manualEvaluation.criteria,
        [activeTab]: {
          ...manualEvaluation.criteria[activeTab],
          [field]: value
        }
      }
    });
  };

  const calculateOverallScore = () => {
    const scores = Object.values(manualEvaluation.criteria).map((c: any) => c.score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    // IELTS rounds to nearest 0.5
    return Math.round(avg * 2) / 2;
  };

  const handleSubmitReview = async () => {
    if (!manualEvaluation.overallFeedback.trim()) {
      toast.error("Please provide overall feedback for the student.");
      return;
    }

    setIsSubmitting(true);
    try {
      const finalScore = calculateOverallScore();
      const attemptRef = doc(db, 'attempts', attempt.id);
      await updateDoc(attemptRef, {
        adminEvaluation: {
          ...manualEvaluation,
          score: finalScore,
          reviewedAt: new Date().toISOString(),
          status: 'reviewed'
        },
        status: 'reviewed',
        needsAdminReview: false
      });
      
      toast.success("Official evaluation submitted successfully.");
      onUpdated();
      onClose();
    } catch (error) {
      console.error("Failed to submit review:", error);
      toast.error("Failed to submit review.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-bg w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-line"
      >
        {/* Header */}
        <div className="p-6 border-b border-line flex items-center justify-between bg-surface">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white">
              <GraduationCap size={24} />
            </div>
            <div>
              <h2 className="text-xl font-serif italic text-primary">Post-Examination Review</h2>
              <p className="text-[10px] uppercase tracking-widest font-bold text-ink-muted">Manual Evaluation Interface</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-bg rounded-xl transition-all text-ink-muted hover:text-red-500"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Left: Submission Content */}
            <div className="space-y-8">
              <div>
                <div className="flex items-center gap-2 text-ink-muted mb-4 uppercase tracking-widest text-[10px] font-bold">
                  <User size={14} /> Student Information
                </div>
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface border border-line">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {attempt.studentName?.charAt(0) || 'S'}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ink">{attempt.studentName || 'Scholar'}</p>
                    <div className="flex gap-3 mt-1">
                      <span className="text-[10px] text-ink-muted flex items-center gap-1">
                        <Calendar size={10} /> {new Date(attempt.date).toLocaleDateString()}
                      </span>
                      <span className="text-[10px] text-ink-muted flex items-center gap-1 text-primary lowercase">
                        <BookOpen size={10} /> {attempt.type}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 text-primary mb-4 uppercase tracking-widest text-[10px] font-bold">
                  <MessageSquare size={14} /> Evaluation Prompt
                </div>
                <div className="p-6 rounded-2xl bg-surface border-l-4 border-l-primary border-y border-r border-line italic font-serif text-ink leading-relaxed">
                  {attempt.prompt}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 text-ink-muted mb-4 uppercase tracking-widest text-[10px] font-bold">
                  <PenTool size={14} /> Student Submission
                </div>
                <div className="p-8 rounded-3xl bg-surface border border-line text-lg font-serif leading-relaxed text-ink whitespace-pre-wrap italic">
                  {attempt.content}
                </div>
              </div>
            </div>

            {/* Right: Marking Form */}
            <div className="space-y-8 h-fit">
              <div className="scholar-card border-secondary/20 bg-secondary/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <BrainCircuit size={48} className="text-secondary" />
                </div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-secondary uppercase tracking-widest text-[10px] font-bold">
                    <CheckCircle2 size={16} /> AI Reference
                  </div>
                  <button 
                    onClick={handleCloneAI}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-white text-[10px] font-bold hover:bg-secondary-dark transition-all shadow-lg shadow-secondary/20"
                  >
                    <Copy size={12} />
                    Clone AI Findings
                  </button>
                </div>
                <div className="flex items-end gap-3 mb-4">
                  <span className="text-5xl font-serif italic text-secondary">{aiEvaluation?.overallBand?.toFixed(1) || attempt.score?.toFixed(1)}</span>
                  <span className="text-xs font-bold text-ink-muted mb-2 uppercase tracking-tighter">Predicted Band</span>
                </div>
                {aiEvaluation && (
                  <div className="space-y-2 border-t border-secondary/10 pt-4">
                    <p className="text-[9px] font-extrabold uppercase tracking-widest text-secondary/60">Key AI Reasoning</p>
                    <p className="text-xs text-ink-muted italic leading-relaxed line-clamp-3">
                      "{aiEvaluation.overallFeedback}"
                    </p>
                  </div>
                )}
              </div>

              <div className="scholar-card border-primary/20 bg-primary/[0.01]">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2 text-primary uppercase tracking-widest text-[10px] font-bold">
                    <PenTool size={16} /> Human Expert Evaluation
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-serif italic text-primary">{calculateOverallScore().toFixed(1)}</span>
                    <span className="text-[9px] font-bold text-ink-muted uppercase">Final Score</span>
                  </div>
                </div>

                <div className="flex gap-1 mb-8 p-1 bg-surface border border-line rounded-2xl overflow-x-auto">
                  {[
                    { id: 'taskResponse', label: 'TR', full: 'Task Response' },
                    { id: 'coherenceCohesion', label: 'CC', full: 'Coherence' },
                    { id: 'lexicalResource', label: 'LR', full: 'Lexical' },
                    { id: 'grammaticalRange', label: 'GRA', full: 'Grammar' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={cn(
                        "flex-1 py-3 px-2 rounded-xl text-[10px] font-black tracking-tighter transition-all flex flex-col items-center gap-1 min-w-[70px]",
                        activeTab === tab.id 
                          ? "bg-primary text-white shadow-md" 
                          : "text-ink-muted hover:bg-primary/5 hover:text-primary"
                      )}
                    >
                      <span className="opacity-60">{tab.label}</span>
                      <span className="text-xs">{manualEvaluation.criteria[tab.id].score.toFixed(1)}</span>
                    </button>
                  ))}
                </div>

                <div className="space-y-8">
                  {/* Criterion Score */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <label className="text-[10px] uppercase tracking-widest font-black text-ink-muted">
                        {activeTab.replace(/([A-Z])/g, ' $1').trim()} Score
                      </label>
                      <span className="text-xs font-bold text-primary italic">Band {manualEvaluation.criteria[activeTab].score.toFixed(1)}</span>
                    </div>
                    <div className="grid grid-cols-5 sm:grid-cols-9 gap-1.5">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 4.5, 5.5, 6.5, 7.5, 8.5].sort((a,b) => a-b).map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => updateCriterion('score', val)}
                          className={cn(
                            "py-1.5 rounded-lg text-[10px] font-bold transition-all border",
                            manualEvaluation.criteria[activeTab].score === val 
                              ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" 
                              : "bg-surface text-ink-muted border-line hover:border-primary/20"
                          )}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Criterion Specific Feedback */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Quote size={12} className="text-primary/40" />
                      <label className="text-[10px] uppercase tracking-widest font-black text-ink-muted">Refined Criterion Feedback</label>
                    </div>
                    <textarea 
                      rows={4}
                      value={manualEvaluation.criteria[activeTab].feedback}
                      onChange={(e) => updateCriterion('feedback', e.target.value)}
                      placeholder={`Enter specific observations for ${activeTab.replace(/([A-Z])/g, ' $1').trim()}...`}
                      className="w-full bg-surface border border-line rounded-2xl p-4 text-xs font-serif italic outline-none focus:border-primary transition-all text-ink resize-none shadow-inner"
                    />
                  </div>

                  {/* Overall Professional Feedback */}
                  <div className="pt-6 border-t border-line">
                    <label className="text-[10px] uppercase tracking-widest font-black text-primary block mb-3">Official Closing Summary</label>
                    <textarea 
                      rows={5}
                      value={manualEvaluation.overallFeedback}
                      onChange={(e) => setManualEvaluation({...manualEvaluation, overallFeedback: e.target.value})}
                      placeholder="Combine your findings into a definitive professional summary for the student..."
                      className="w-full bg-surface border-2 border-primary/10 rounded-2xl p-4 text-sm font-serif italic outline-none focus:border-primary transition-all text-ink resize-none"
                    />
                  </div>

                  <button
                    onClick={handleSubmitReview}
                    disabled={isSubmitting}
                    className="w-full bg-primary text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-primary-light transition-all shadow-xl shadow-primary/25 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                    Finalize & Dispatch Evaluation
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
