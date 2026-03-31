import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  PenTool, 
  BookOpen, 
  Headphones, 
  Mic2, 
  ChevronRight, 
  Clock, 
  Zap,
  CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

const SkillCard = ({ 
  icon: Icon, 
  title, 
  description, 
  duration, 
  questions, 
  color, 
  selected, 
  onClick 
}: { 
  icon: any, 
  title: string, 
  description: string, 
  duration: string, 
  questions: string, 
  color: string, 
  selected: boolean, 
  onClick: () => void 
}) => (
  <button
    onClick={onClick}
    className={cn(
      "scholar-card text-left transition-all relative overflow-hidden group",
      selected ? "ring-2 ring-primary border-primary bg-primary/5" : "hover:border-primary/50"
    )}
  >
    <div className="flex items-start gap-4">
      <div className={cn("p-3 rounded-xl text-white shadow-lg", color)}>
        <Icon size={24} />
      </div>
      <div className="flex-1">
        <h3 className="text-lg font-serif italic text-primary">{title}</h3>
        <p className="text-xs text-ink-muted mt-1 leading-relaxed">{description}</p>
        
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-ink-muted uppercase tracking-wider">
            <Clock size={12} />
            {duration}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-ink-muted uppercase tracking-wider">
            <Zap size={12} />
            {questions}
          </div>
        </div>
      </div>
      {selected && (
        <div className="absolute top-4 right-4 text-primary">
          <CheckCircle2 size={20} />
        </div>
      )}
    </div>
  </button>
);

export default function ShortPractice() {
  const navigate = useNavigate();
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  const skills = [
    { 
      id: 'listening', 
      title: 'Listening Focus', 
      icon: Headphones, 
      description: 'Practice specific sections: Conversations or Academic Lectures.', 
      duration: '10-15 Mins', 
      questions: '10 Questions', 
      color: 'bg-amber-600',
      path: '/practice/listening'
    },
    { 
      id: 'reading', 
      title: 'Reading Drill', 
      icon: BookOpen, 
      description: 'Focus on one academic passage with targeted question types.', 
      duration: '20 Mins', 
      questions: '13-14 Questions', 
      color: 'bg-emerald-600',
      path: '/practice/reading'
    },
    { 
      id: 'writing', 
      title: 'Writing Task 1', 
      icon: PenTool, 
      description: 'Describe graphs, charts, or diagrams in a formal academic style.', 
      duration: '20 Mins', 
      questions: '1 Task', 
      color: 'bg-blue-600',
      path: '/practice/writing'
    },
    { 
      id: 'speaking', 
      title: 'Speaking Part 2', 
      icon: Mic2, 
      description: 'The "Long Turn" simulation. Practice cue cards and prep time.', 
      duration: '5 Mins', 
      questions: '1 Cue Card', 
      color: 'bg-rose-600',
      path: '/practice/speaking'
    },
  ];

  const toggleSkill = (id: string) => {
    setSelectedSkills(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleStart = () => {
    if (selectedSkills.length > 0) {
      // For demo, just navigate to the first selected skill
      const skill = skills.find(s => s.id === selectedSkills[0]);
      if (skill) navigate(skill.path);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-5xl mx-auto flex flex-col gap-8"
    >
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif italic text-primary">Short Practice Panel</h2>
          <p className="text-ink-muted mt-1">Select one or more skills for a focused, high-intensity session.</p>
        </div>
        <button 
          disabled={selectedSkills.length === 0}
          onClick={handleStart}
          className={cn(
            "px-8 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg",
            selectedSkills.length > 0 
              ? "bg-primary text-white shadow-primary/20 hover:bg-primary-light" 
              : "bg-surface text-ink-muted cursor-not-allowed border border-line"
          )}
        >
          Start Selected Session <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {skills.map((skill) => (
          <SkillCard 
            key={skill.id}
            {...skill}
            selected={selectedSkills.includes(skill.id)}
            onClick={() => toggleSkill(skill.id)}
          />
        ))}
      </div>

      <div className="scholar-card bg-surface/50 border-dashed border-line p-8 flex flex-col items-center text-center transition-colors">
        <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center text-primary mb-4">
          <Clock size={24} />
        </div>
        <h3 className="text-xl font-serif italic text-primary">Why Short Practice?</h3>
        <p className="text-sm text-ink-muted max-w-2xl mt-2 leading-relaxed">
          The full IELTS exam takes nearly 3 hours. Short practice sessions allow you to maintain your "Lexical Precision" and "Fluency Coherence" without the fatigue of a full simulation. Perfect for daily academic maintenance.
        </p>
      </div>
    </motion.div>
  );
}
