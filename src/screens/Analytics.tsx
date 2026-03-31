import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Brain, 
  Target, 
  TrendingUp, 
  AlertCircle, 
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Users
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from 'recharts';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../App';
import { PracticeAttempt, Student } from '../types';

const GapCard = ({ title, description, impact, color }: { title: string, description: string, impact: string, color: string }) => (
  <div className="scholar-card border-l-4" style={{ borderLeftColor: color }}>
    <div className="flex items-start justify-between">
      <div>
        <h4 className="text-sm font-bold text-ink">{title}</h4>
        <p className="text-xs text-ink-muted mt-1 leading-relaxed">{description}</p>
      </div>
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
        <AlertCircle size={12} />
        {impact}
      </div>
    </div>
  </div>
);

export default function Analytics() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([]);
  const [topScholars, setTopScholars] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState('6m');

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        // Fetch attempts
        let attemptsQuery;
        if (user.role === 'admin') {
          attemptsQuery = query(collection(db, 'attempts'), orderBy('date', 'desc'), limit(500));
        } else {
          attemptsQuery = query(collection(db, 'attempts'), where('studentId', '==', user.uid), orderBy('date', 'desc'));
        }
        
        const attemptsSnap = await getDocs(attemptsQuery);
        const attemptsData = attemptsSnap.docs.map(doc => ({ ...(doc.data() as any), id: doc.id })) as PracticeAttempt[];
        setAttempts(attemptsData);

        // If admin, fetch top scholars
        if (user.role === 'admin') {
          const studentsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student'), limit(10)));
          const studentsData = studentsSnap.docs.map(doc => doc.data() as Student);
          
          const scholarsWithScores = studentsData.map(s => {
            const studentAttempts = attemptsData.filter(a => a.studentId === s.uid);
            const avgScore = studentAttempts.length > 0 
              ? studentAttempts.reduce((acc, curr) => acc + curr.score, 0) / studentAttempts.length 
              : s.currentBand;
            
            return {
              name: s.name,
              score: avgScore,
              trend: Math.random() > 0.5 ? 'up' : 'down' // Mock trend for now
            };
          }).sort((a, b) => b.score - a.score).slice(0, 5);
          
          setTopScholars(scholarsWithScores);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, timeRange]);

  // Process trend data
  const processTrendData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();
    const last6Months = [];
    
    for (let i = 5; i >= 0; i--) {
      const m = (currentMonth - i + 12) % 12;
      last6Months.push(months[m]);
    }

    return last6Months.map(month => {
      const monthAttempts = attempts.filter(a => {
        const d = new Date(a.date);
        return months[d.getMonth()] === month;
      });

      const getAvg = (type: string) => {
        const typeAttempts = monthAttempts.filter(a => a.type === type);
        return typeAttempts.length > 0 
          ? typeAttempts.reduce((acc, curr) => acc + curr.score, 0) / typeAttempts.length 
          : null;
      };

      return {
        month,
        writing: getAvg('Writing'),
        reading: getAvg('Reading'),
        listening: getAvg('Listening'),
        speaking: getAvg('Speaking'),
      };
    });
  };

  const trendData = processTrendData();

  const getRadarData = () => {
    const skills = ['Writing', 'Reading', 'Listening', 'Speaking'];
    return skills.map(skill => {
      const skillAttempts = attempts.filter(a => a.type === skill);
      const avg = skillAttempts.length > 0 
        ? skillAttempts.reduce((acc, curr) => acc + curr.score, 0) / skillAttempts.length 
        : 0;
      return {
        subject: skill,
        A: avg,
        fullMark: 9,
      };
    });
  };

  const radarData = getRadarData();

  const getDistributionData = () => {
    const bands = [4, 5, 6, 7, 8, 9];
    return bands.map(band => {
      const count = attempts.filter(a => Math.floor(a.score) === band).length;
      return {
        band: `Band ${band}`,
        count
      };
    });
  };

  const distributionData = getDistributionData();

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col gap-8"
    >
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-serif italic text-primary">
            {user?.role === 'admin' ? 'Institutional Insight' : 'Personal Analytics'}
          </h2>
          <p className="text-ink-muted mt-1">
            {user?.role === 'admin' 
              ? 'Synthesis of cognitive performance and cohort-wide trends.' 
              : 'Detailed breakdown of your academic progress and skill gaps.'}
          </p>
        </div>
        <div className="flex gap-3">
          <select 
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-surface border border-line px-4 py-2 rounded-lg text-sm font-bold outline-none text-ink"
          >
            <option value="6m">Last 6 Months</option>
            <option value="1y">Last Year</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Trend Chart */}
        <div className="lg:col-span-2 scholar-card">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-serif italic text-primary">Temporal Score Trends</h3>
              <p className="text-xs text-ink-muted mt-1">Average band scores across all modules</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-600" />
                <span className="text-[10px] font-bold uppercase text-ink-muted">Writing</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-600" />
                <span className="text-[10px] font-bold uppercase text-ink-muted">Reading</span>
              </div>
            </div>
          </div>
          
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-muted)' }} dy={10} />
                <YAxis domain={[0, 9]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-muted)' }} />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: '1px solid var(--line)', 
                    backgroundColor: 'var(--surface)',
                    color: 'var(--ink)',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' 
                  }}
                  itemStyle={{ color: 'var(--ink)' }}
                />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ color: 'var(--ink)' }} />
                <Line name="Writing" type="monotone" dataKey="writing" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#2563eb' }} activeDot={{ r: 6 }} connectNulls />
                <Line name="Reading" type="monotone" dataKey="reading" stroke="#059669" strokeWidth={3} dot={{ r: 4, fill: '#059669' }} activeDot={{ r: 6 }} connectNulls />
                <Line name="Listening" type="monotone" dataKey="listening" stroke="#d97706" strokeWidth={3} dot={{ r: 4, fill: '#d97706' }} activeDot={{ r: 6 }} connectNulls />
                <Line name="Speaking" type="monotone" dataKey="speaking" stroke="#e11d48" strokeWidth={3} dot={{ r: 4, fill: '#e11d48' }} activeDot={{ r: 6 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Skill Balance Radar */}
        <div className="scholar-card flex flex-col items-center justify-center">
          <div className="w-full mb-6">
            <h3 className="text-xl font-serif italic text-primary">Skill Balance</h3>
            <p className="text-xs text-ink-muted mt-1">Equilibrium across IELTS modules</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="var(--line)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 'bold', fill: 'var(--ink)' }} />
                <PolarRadiusAxis angle={30} domain={[0, 9]} tick={{ fontSize: 10, fill: 'var(--ink-muted)' }} />
                <Radar
                  name="Scholar"
                  dataKey="A"
                  stroke="var(--primary)"
                  fill="var(--primary)"
                  fillOpacity={0.6}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: '1px solid var(--line)', 
                    backgroundColor: 'var(--surface)',
                    color: 'var(--ink)'
                  }} 
                  itemStyle={{ color: 'var(--ink)' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Band Distribution */}
        <div className="scholar-card">
          <h3 className="text-xl font-serif italic text-primary mb-6">Band Distribution</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                <XAxis dataKey="band" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--ink-muted)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--ink-muted)' }} />
                <Tooltip 
                  cursor={{ fill: 'var(--bg)' }} 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: '1px solid var(--line)', 
                    backgroundColor: 'var(--surface)',
                    color: 'var(--ink)'
                  }}
                  itemStyle={{ color: 'var(--ink)' }}
                />
                <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
