import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  History, 
  Search, 
  Filter, 
  ChevronRight, 
  ExternalLink,
  PenTool,
  BookOpen,
  Headphones,
  Mic2,
  Trophy,
  Loader2
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../App';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

export default function HistoryLogs() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'attempts'),
      where('studentId', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const attemptsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAttempts(attemptsData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching attempts:", error);
      handleFirestoreError(error, OperationType.LIST, 'attempts');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredAttempts = attempts.filter(attempt => 
    attempt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    attempt.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const trendData = [...attempts]
    .reverse()
    .slice(-10)
    .map(attempt => ({
      date: new Date(attempt.date).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' }),
      score: attempt.score
    }));

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Loader2 size={48} className="animate-spin text-primary" />
      <p className="text-xl font-serif italic text-primary">Loading your practice history...</p>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col gap-8"
    >
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-serif italic text-primary">Your Practice Archive</h2>
          <p className="text-ink-muted mt-1">Review your past performance and track your academic evolution.</p>
        </div>
        <div className="bg-surface px-4 py-2 rounded-lg border border-line flex items-center gap-3 transition-colors">
          <Trophy size={18} className="text-accent" />
          <span className="text-sm font-bold text-ink">Academic Goal: Band {user?.targetBand || '8.5'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* List of attempts */}
          <div className="scholar-card p-0 overflow-hidden">
            <div className="p-6 border-b border-line flex items-center justify-between bg-surface transition-colors">
              <div className="flex items-center gap-4 bg-bg px-4 py-2 rounded-lg border border-line w-80 transition-colors">
                <Search size={18} className="text-ink-muted" />
                <input 
                  type="text" 
                  placeholder="Search by task title..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm w-full text-ink placeholder:text-ink-muted/50"
                />
              </div>
              <button className="p-2 text-ink-muted hover:text-primary hover:bg-bg rounded-lg transition-all">
                <Filter size={20} />
              </button>
            </div>

            <div className="divide-y divide-line">
              {filteredAttempts.length > 0 ? filteredAttempts.map(attempt => (
                <div 
                  key={attempt.id} 
                  className="flex items-center gap-6 p-6 hover:bg-bg transition-all cursor-pointer group"
                  onClick={() => navigate(`/evaluation/${attempt.id}`)}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm",
                    attempt.type === 'Writing' ? 'bg-blue-600' : 
                    attempt.type === 'Reading' ? 'bg-emerald-600' : 
                    attempt.type === 'Listening' ? 'bg-amber-600' : 'bg-rose-600'
                  )}>
                    {attempt.type === 'Writing' ? <PenTool size={24} /> : 
                     attempt.type === 'Reading' ? <BookOpen size={24} /> : 
                     attempt.type === 'Listening' ? <Headphones size={24} /> : <Mic2 size={24} />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">{attempt.type}</span>
                      <span className="w-1 h-1 rounded-full bg-line" />
                      <span className="text-[10px] font-bold text-ink-muted">
                        {new Date(attempt.date).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-ink mt-1 truncate">{attempt.title}</h4>
                    {attempt.feedback && (
                      <p className="text-xs text-ink-muted mt-1 line-clamp-1 italic">"{attempt.feedback}"</p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-serif italic text-primary leading-none">{attempt.score.toFixed(1)}</p>
                    <p className="text-[10px] text-ink-muted uppercase tracking-widest mt-1">Band Score</p>
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 text-primary hover:bg-bg rounded-lg border border-line transition-all">
                      <ExternalLink size={18} />
                    </button>
                    <ChevronRight size={20} className="text-ink-muted group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              )) : (
                <div className="p-12 text-center">
                  <p className="text-ink-muted italic">No practice sessions found matching your search.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {/* Score Trend Mini Chart */}
          <div className="scholar-card">
            <h3 className="text-lg font-serif italic text-primary mb-6">Score Trajectory</h3>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="date" hide />
                  <YAxis domain={[5, 9]} hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--line)', backgroundColor: 'var(--surface)', color: 'var(--ink)' }}
                    itemStyle={{ color: 'var(--primary)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="var(--primary)" 
                    strokeWidth={3} 
                    dot={false}
                    activeDot={{ r: 6, fill: 'var(--primary)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-ink-muted">
              <span>Start</span>
              <span>Latest</span>
            </div>
          </div>

          {/* Tips Card */}
          <div className="scholar-card bg-accent/10 border-accent/20">
            <h3 className="text-lg font-serif italic text-accent mb-3">Scholar's Tip</h3>
            <p className="text-sm text-ink leading-relaxed">
              Reviewing your past Writing Task 2 feedback is the fastest way to identify recurring grammatical errors. Focus on your "Lexical Resource" scores this week.
            </p>
            <button className="mt-4 text-xs font-bold text-accent hover:underline flex items-center gap-1">
              Read more tips <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
