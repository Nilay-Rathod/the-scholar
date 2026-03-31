import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  FileText, 
  AlertCircle,
  CheckCircle2,
  Loader2,
  Search
} from 'lucide-react';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface SampleResponse {
  id: string;
  taskType: 'Task 1' | 'Task 2';
  examType: 'Academic' | 'General Training';
  bandScore: number;
  content: string;
  createdAt: any;
}

export default function SampleResponseManager() {
  const [samples, setSamples] = useState<SampleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State
  const [taskType, setTaskType] = useState<'Task 1' | 'Task 2'>('Task 1');
  const [examType, setExamType] = useState<'Academic' | 'General Training'>('Academic');
  const [bandScore, setBandScore] = useState<number>(7.0);
  const [content, setContent] = useState('');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast.error('Please enter sample content');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'samples'), {
        taskType,
        examType,
        bandScore,
        content: content.trim(),
        createdAt: serverTimestamp()
      });
      
      toast.success('Sample response added successfully');
      setContent('');
    } catch (error) {
      console.error('Error adding sample:', error);
      toast.error('Failed to add sample response');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sample?')) return;
    
    try {
      await deleteDoc(doc(db, 'samples', id));
      toast.success('Sample deleted');
    } catch (error) {
      toast.error('Failed to delete sample');
    }
  };

  const filteredSamples = samples.filter(s => 
    s.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.taskType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.examType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Entry Form */}
        <div className="scholar-card border-primary/20 bg-primary/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white">
              <Plus size={20} />
            </div>
            <div>
              <h3 className="text-xl font-serif italic text-primary">Add Sample Response</h3>
              <p className="text-xs text-ink-muted uppercase tracking-widest font-bold">Ground the AI with high/low band examples</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-ink-muted uppercase mb-2">Task Type</label>
                <div className="flex gap-2 p-1 bg-bg border border-line rounded-lg">
                  {['Task 1', 'Task 2'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setTaskType(type as any)}
                      className={cn(
                        "flex-1 py-2 text-xs font-bold rounded-md transition-all",
                        taskType === type ? "bg-primary text-white shadow-md" : "text-ink-muted hover:text-ink"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-ink-muted uppercase mb-2">Exam Type</label>
                <div className="flex gap-2 p-1 bg-bg border border-line rounded-lg">
                  {['Academic', 'General Training'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setExamType(type as any)}
                      className={cn(
                        "flex-1 py-2 text-[10px] font-bold rounded-md transition-all",
                        examType === type ? "bg-secondary text-white shadow-md" : "text-ink-muted hover:text-ink"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-ink-muted uppercase mb-2">Target Band Score</label>
              <input 
                type="range" 
                min="0" 
                max="9" 
                step="0.5" 
                value={bandScore}
                onChange={(e) => setBandScore(parseFloat(e.target.value))}
                className="w-full h-2 bg-line rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between mt-2">
                <span className="text-[10px] font-bold text-ink-muted">Band 0</span>
                <span className="text-lg font-serif italic text-primary">Band {bandScore.toFixed(1)}</span>
                <span className="text-[10px] font-bold text-ink-muted">Band 9.0</span>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-ink-muted uppercase mb-2">Sample Content / Essay</label>
              <textarea 
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={10}
                className="w-full bg-bg border border-line rounded-xl p-4 text-sm text-ink outline-none focus:border-primary transition-all font-serif italic"
                placeholder="Paste the sample essay content here..."
              />
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full scholar-button-primary py-3 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              Save Sample Response
            </button>
          </form>
        </div>

        {/* List View */}
        <div className="flex flex-col gap-4">
          <div className="scholar-card bg-surface/30">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <FileText className="text-secondary" />
                <h3 className="font-bold text-ink">Existing Samples</h3>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-ink-muted">
                  <Search size={14} />
                </div>
                <input 
                  type="text"
                  placeholder="Seach samples..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-bg border border-line rounded-lg pl-9 pr-4 py-2 text-xs outline-none focus:border-primary w-48 transition-all"
                />
              </div>
            </div>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center text-ink-muted">
                  <Loader2 className="animate-spin mb-2" />
                  <p className="text-xs">Loading samples...</p>
                </div>
              ) : filteredSamples.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-line rounded-2xl">
                  <AlertCircle size={32} className="mx-auto text-line mb-2" />
                  <p className="text-sm italic text-ink-muted">No samples found.</p>
                </div>
              ) : (
                filteredSamples.map(sample => (
                  <motion.div 
                    layout
                    key={sample.id}
                    className="p-4 bg-bg border border-line rounded-xl hover:border-primary/30 transition-all group relative"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex flex-wrap gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-bold uppercase",
                          sample.taskType === 'Task 1' ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
                        )}>
                          {sample.taskType}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-surface border border-line text-[9px] font-bold text-ink-muted uppercase">
                          {sample.examType}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-primary text-white text-[9px] font-bold">
                          BAND {sample.bandScore.toFixed(1)}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleDelete(sample.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-ink-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="text-xs text-ink-muted line-clamp-3 font-serif italic">
                      "{sample.content}"
                    </p>
                  </motion.div>
                ))
              )}
            </div>

            {filteredSamples.length > 0 && (
              <div className="mt-6 pt-4 border-t border-line flex items-center justify-between text-[10px] font-bold text-ink-muted uppercase tracking-widest">
                <span>Total Samples: {samples.length}</span>
                <div className="flex items-center gap-2 text-secondary">
                  <CheckCircle2 size={12} />
                  <span>Syncing with AI Engine</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
