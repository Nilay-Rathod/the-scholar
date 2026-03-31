import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  FileText, 
  ChevronRight, 
  BookOpen, 
  Zap,
  Filter,
  ArrowLeft,
  Calendar,
  Award,
  BookOpenCheck
} from 'lucide-react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { Loader2 } from 'lucide-react';

interface SampleResponse {
  id: string;
  taskType: 'Task 1' | 'Task 2';
  examType: 'Academic' | 'General Training';
  bandScore: number;
  content: string;
  createdAt: any;
}

export default function Samples() {
  const [samples, setSamples] = useState<SampleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTaskType, setSelectedTaskType] = useState<string | null>(null);
  const [selectedExamType, setSelectedExamType] = useState<string | null>(null);
  const [selectedSample, setSelectedSample] = useState<SampleResponse | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'samples'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sampleData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SampleResponse[];
      setSamples(sampleData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredSamples = samples.filter(s => {
    const matchesSearch = s.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        s.taskType.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        s.examType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTask = !selectedTaskType || s.taskType === selectedTaskType;
    const matchesExam = !selectedExamType || s.examType === selectedExamType;
    return matchesSearch && matchesTask && matchesExam;
  });

  if (selectedSample) {
    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="max-w-4xl mx-auto"
      >
        <button 
          onClick={() => setSelectedSample(null)}
          className="flex items-center gap-2 text-ink-muted hover:text-primary mb-8 transition-colors group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-bold text-sm uppercase tracking-widest">Back to Library</span>
        </button>

        <div className="scholar-card mb-8">
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <span className={cn(
              "px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider",
              selectedSample.taskType === 'Task 1' ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
            )}>
              {selectedSample.taskType}
            </span>
            <span className="px-3 py-1 rounded-lg bg-surface border border-line text-xs font-bold text-ink-muted uppercase tracking-wider">
              {selectedSample.examType}
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <Award className="text-secondary" size={20} />
              <span className="text-2xl font-serif italic text-primary">Band {selectedSample.bandScore.toFixed(1)}</span>
            </div>
          </div>

          <div className="prose prose-slate max-w-none">
            <h3 className="text-xl font-serif italic text-primary mb-4">Sample Response</h3>
            <div className="bg-bg/50 border border-line rounded-2xl p-8 font-serif text-lg leading-relaxed italic text-ink whitespace-pre-wrap">
              {selectedSample.content}
            </div>
          </div>

          <div className="mt-12 p-6 bg-secondary/5 rounded-2xl border border-secondary/20">
            <div className="flex items-center gap-3 mb-4">
              <BookOpenCheck className="text-secondary" />
              <h4 className="font-bold text-secondary uppercase tracking-widest text-sm">Philosopher's Note</h4>
            </div>
            <p className="text-sm text-ink-muted leading-relaxed">
              This response serves as a benchmark for achieving a Band {selectedSample.bandScore.toFixed(1)}. 
              Note the use of varied sentence structures and academic vocabulary. For IELTS {selectedSample.taskType}, 
              clarity and cohesion are paramount. Analyze how transitions are used to build a logical flow.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-serif italic text-primary">Sample Library</h2>
          <p className="text-ink-muted mt-2 max-w-2xl">
            Explore expert-curated sample responses across different band scores. 
            Study these benchmarks to understand what examiners look for in your Writing and Speaking tasks.
          </p>
        </div>
        <div className="bg-surface px-4 py-2 rounded-xl border border-line flex items-center gap-3 shadow-sm">
          <BookOpen size={20} className="text-primary" />
          <span className="text-sm font-bold text-ink uppercase tracking-tighter">
            {samples.length} Benchmarks Available
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Search and Filters */}
        <div className="md:col-span-1 space-y-6">
          <div className="scholar-card p-4">
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={18} />
              <input 
                type="text"
                placeholder="Search samples..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-bg border border-line rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:border-primary transition-all"
              />
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-3 block">Task Type</label>
                <div className="flex flex-col gap-2">
                  {[null, 'Task 1', 'Task 2'].map((type) => (
                    <button
                      key={type || 'all'}
                      onClick={() => setSelectedTaskType(type)}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all",
                        selectedTaskType === type 
                          ? "bg-primary text-white shadow-md shadow-primary/20" 
                          : "text-ink-muted hover:bg-bg"
                      )}
                    >
                      {type || 'All Tasks'}
                      {selectedTaskType === type && <ChevronRight size={14} />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-line" />

              <div>
                <label className="text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-3 block">Exam Type</label>
                <div className="flex flex-col gap-2">
                  {[null, 'Academic', 'General Training'].map((type) => (
                    <button
                      key={type || 'all'}
                      onClick={() => setSelectedExamType(type)}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all",
                        selectedExamType === type 
                          ? "bg-secondary text-white shadow-md shadow-secondary/20" 
                          : "text-ink-muted hover:bg-bg"
                      )}
                    >
                      {type || 'All Exam Types'}
                      {selectedExamType === type && <ChevronRight size={14} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="scholar-card bg-primary text-white border-none p-6 text-center">
            <Zap size={32} className="mx-auto mb-4 opacity-80" />
            <h4 className="font-serif italic text-lg mb-2">Philosophy of Study</h4>
            <p className="text-xs opacity-70 leading-relaxed">
              "To attain mastery, one must first understand the form of excellence."
            </p>
          </div>
        </div>

        {/* Samples Grid */}
        <div className="md:col-span-3">
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : filteredSamples.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredSamples.map((sample) => (
                  <motion.div
                    layout
                    key={sample.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onClick={() => setSelectedSample(sample)}
                    className="scholar-card group cursor-pointer hover:border-primary transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-tighter",
                          sample.taskType === 'Task 1' ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
                        )}>
                          {sample.taskType}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-surface border border-line text-[9px] font-bold text-ink-muted uppercase tracking-tighter">
                          {sample.examType}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-serif italic text-primary block leading-none">Band {sample.bandScore.toFixed(1)}</span>
                        <span className="text-[8px] font-bold text-ink-muted uppercase tracking-widest">Target</span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-ink leading-relaxed font-serif italic line-clamp-4 mb-6">
                      "{sample.content}"
                    </p>

                    <div className="pt-4 border-t border-line flex items-center justify-between text-ink-muted group-hover:text-primary transition-colors">
                      <div className="flex items-center gap-2">
                        <Calendar size={12} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Added {new Date(sample.createdAt?.toDate()).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest">
                        Read More <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-line rounded-3xl text-ink-muted gap-4">
              <Filter size={48} className="opacity-20" />
              <div className="text-center">
                <p className="font-bold">No samples found matching filters</p>
                <p className="text-xs uppercase tracking-widest mt-1 italic">Try adjusting your search or categories</p>
              </div>
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setSelectedTaskType(null);
                  setSelectedExamType(null);
                }}
                className="text-primary font-bold text-xs hover:underline mt-2"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
