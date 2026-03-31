import React, { useState, useEffect } from 'react';
import { Bot, UserRound, GraduationCap, Zap, ChevronRight, Loader2, BookOpen } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { cn } from '../lib/utils';

interface Props {
  onSelect: (source: 'ai' | 'curated', type: 'academic' | 'gt', testId?: string) => void;
  skill: 'Writing' | 'Reading' | 'Listening' | 'Speaking';
  title?: string;
}

export default function TestSelectionScreen({ onSelect, skill, title = "Choose Your Practice Path" }: Props) {
  const [source, setSource] = useState<'ai' | 'curated' | null>(null);
  const [testType, setTestType] = useState<'academic' | 'gt'>('academic');
  const [curatedTests, setCuratedTests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (source === 'curated') {
      fetchCuratedTests();
    }
  }, [source, testType]);

  const fetchCuratedTests = async () => {
    setIsLoading(true);
    try {
      const q = query(
        collection(db, 'tests'),
        where('skill', '==', skill),
        where('type', '==', testType === 'academic' ? 'Academic' : 'General Training')
      );
      const snapshot = await getDocs(q);
      setCuratedTests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching tests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 p-4">
      <div className="text-center max-w-2xl">
        <h2 className="text-4xl font-serif italic text-primary mb-3">{title}</h2>
        <p className="text-ink-muted">Tailor your IELTS preparation with precision. Choose between our adaptive AI engine or instructor-vetted curated sets.</p>
      </div>

      <div className="flex flex-col gap-8 w-full max-w-4xl">
        {/* Type Selection (Academic vs GT) */}
        <div className="flex justify-center">
          <div className="bg-surface border border-line p-1 rounded-xl flex gap-1 shadow-sm">
            <button 
              onClick={() => setTestType('academic')}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all",
                testType === 'academic' ? "bg-primary text-white shadow-md shadow-primary/20" : "text-ink-muted hover:bg-bg"
              )}
            >
              <GraduationCap size={16} /> Academic
            </button>
            <button 
              onClick={() => setTestType('gt')}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all",
                testType === 'gt' ? "bg-secondary text-white shadow-md shadow-secondary/20" : "text-ink-muted hover:bg-bg"
              )}
            >
              <BookOpen size={16} /> General Training
            </button>
          </div>
        </div>

        {!source ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button 
              onClick={() => onSelect('ai', testType)}
              className="scholar-card group relative overflow-hidden p-8 hover:border-primary transition-all flex flex-col items-center text-center gap-6"
            >
              <div className="w-20 h-20 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-500">
                <Bot size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-serif italic text-primary">AI Generated Test</h3>
                <p className="text-sm text-ink-muted leading-relaxed">
                  Dynamic scenarios crafted in real-time by the AI Scholar. Perfect for infinite variety and high-frequency practice.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-2 text-primary text-sm font-bold">
                Start AI Session <ChevronRight size={16} />
              </div>
            </button>

            <button 
              onClick={() => setSource('curated')}
              className="scholar-card group relative overflow-hidden p-8 hover:border-secondary transition-all flex flex-col items-center text-center gap-6"
            >
              <div className="w-20 h-20 rounded-2xl bg-secondary/5 flex items-center justify-center text-secondary group-hover:scale-110 transition-transform duration-500">
                <UserRound size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-serif italic text-secondary">Teacher Curated Test</h3>
                <p className="text-sm text-ink-muted leading-relaxed">
                  Hand-picked, high-quality material used in official environments. Targeted at specific band score requirements.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-2 text-secondary text-sm font-bold">
                Browse Curated Sets <ChevronRight size={16} />
              </div>
            </button>
          </div>
        ) : (
          <div className="scholar-card p-0 overflow-hidden border-primary/20">
            <div className="p-6 border-b border-line bg-surface flex items-center justify-between">
              <div>
                <h3 className="text-xl font-serif italic text-primary">Available Curated Sets</h3>
                <p className="text-xs text-ink-muted uppercase tracking-widest mt-1">{skill} • {testType === 'academic' ? 'Academic' : 'General Training'}</p>
              </div>
              <button 
                onClick={() => setSource(null)}
                className="text-xs font-bold text-ink-muted hover:text-primary transition-colors flex items-center gap-1"
              >
                <ChevronRight size={14} className="rotate-180" /> Back to Choice
              </button>
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-6">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-ink-muted gap-3">
                  <Loader2 className="animate-spin" size={32} />
                  <p className="text-sm italic">Retrieving scholarly materials...</p>
                </div>
              ) : curatedTests.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {curatedTests.map(test => (
                    <button 
                      key={test.id}
                      onClick={() => onSelect('curated', testType, test.id)}
                      className="flex items-center justify-between p-4 rounded-xl border border-line bg-bg hover:border-primary hover:bg-surface transition-all group"
                    >
                      <div className="text-left flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-primary border border-line group-hover:bg-primary group-hover:text-white transition-colors">
                          <Zap size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-ink group-hover:text-primary transition-colors">{test.title}</p>
                          <p className="text-[10px] text-ink-muted uppercase tracking-tighter mt-1">Set ID: {test.id.slice(0, 8)}</p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-ink-muted group-hover:text-primary transform group-hover:translate-x-1 transition-all" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-ink-muted gap-4">
                  <Bot size={48} className="opacity-20" />
                  <p className="text-sm italic text-center max-w-xs">No curated sets found for this combination. Try a different category or use our AI Scholar.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
