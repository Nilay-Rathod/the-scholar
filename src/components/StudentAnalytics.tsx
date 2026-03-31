import React from 'react';
import { motion } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { GraduationCap, TrendingUp, Calendar, Target } from 'lucide-react';
import { cn } from '../lib/utils';

interface StudentAnalyticsProps {
  student: any;
  attempts: any[];
}

export default function StudentAnalytics({ student, attempts }: StudentAnalyticsProps) {
  // Filter and format data for the chart
  const studentAttempts = attempts
    .filter(a => a.studentId === student.uid)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const chartData = studentAttempts.map(a => ({
    date: new Date(a.date).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    score: a.score || 0,
    type: a.type
  }));

  const averageScore = studentAttempts.length > 0 
    ? studentAttempts.reduce((acc, curr) => acc + (curr.score || 0), 0) / studentAttempts.length 
    : 0;

  const highestScore = Math.max(...studentAttempts.map(a => a.score || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="scholar-card bg-primary/5 border-primary/10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <TrendingUp size={16} />
            </div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-ink-muted">Average Band</p>
          </div>
          <h3 className="text-3xl font-serif italic text-primary">{averageScore.toFixed(1)}</h3>
        </div>

        <div className="scholar-card bg-secondary/5 border-secondary/10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
              <Target size={16} />
            </div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-ink-muted">Highest Score</p>
          </div>
          <h3 className="text-3xl font-serif italic text-secondary">{highestScore.toFixed(1)}</h3>
        </div>

        <div className="scholar-card bg-amber-50 border-amber-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
              <Calendar size={16} />
            </div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-ink-muted">Practices Done</p>
          </div>
          <h3 className="text-3xl font-serif italic text-amber-600">{studentAttempts.length}</h3>
        </div>
      </div>

      <div className="scholar-card h-[400px]">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-sm font-bold uppercase tracking-widest text-ink">Progress Trajectory</h4>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-[10px] text-ink-muted uppercase font-bold">Band Score</span>
            </div>
          </div>
        </div>
        
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis 
              dataKey="date" 
              fontSize={10} 
              tickMargin={10} 
              axisLine={false} 
              tickLine={false}
              fontFamily="Inter"
            />
            <YAxis 
              domain={[0, 9]} 
              ticks={[0, 2, 4, 6, 8, 9]}
              fontSize={10} 
              axisLine={false} 
              tickLine={false}
              fontFamily="Inter"
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                borderRadius: '12px', 
                border: '1px solid rgba(0,0,0,0.1)',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                fontSize: '12px',
                fontFamily: 'Inter'
              }} 
            />
            <Area 
              type="monotone" 
              dataKey="score" 
              stroke="var(--primary)" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorScore)" 
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="scholar-card">
        <h4 className="text-xs font-bold uppercase tracking-widest text-ink mb-4">Recent Performance</h4>
        <div className="space-y-3">
          {studentAttempts.slice().reverse().slice(0, 5).map((attempt, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-surface rounded-xl border border-line">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center text-white",
                  attempt.type === 'Writing' ? "bg-blue-500" :
                  attempt.type === 'Speaking' ? "bg-purple-500" :
                  "bg-emerald-500"
                )}>
                  <span className="text-[10px] font-bold">{attempt.type[0]}</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-ink">{attempt.title}</p>
                  <p className="text-[10px] text-ink-muted">{new Date(attempt.date).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-serif italic text-primary font-bold">{attempt.score.toFixed(1)}</p>
                <p className="text-[8px] text-ink-muted uppercase font-bold tracking-widest">Band</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
