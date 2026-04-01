import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../App';
import { Student } from '../types';
import { motion } from 'motion/react';
import { Loader2, CheckCircle2, XCircle, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';

const JoinClassHandler: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already-enrolled'>('loading');
  const [className, setClassName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleJoinWithLink = async () => {
      if (authLoading) return;

      if (!user) {
        // Not logged in, redirect to login with return url
        toast.info("Please login to join the class");
        navigate(`/login?redirect=/join/${code}`);
        return;
      }

      if (user.role !== 'student') {
        setStatus('error');
        setErrorMessage("Only students can join classes using a code.");
        return;
      }

      const student = user as Student;
      if (student.classId) {
        setStatus('already-enrolled');
        return;
      }

      try {
        const q = query(collection(db, 'classes'), where('classCode', '==', code));
        const snap = await getDocs(q);

        if (snap.empty) {
          setStatus('error');
          setErrorMessage("Invalid or expired class link. Please check with your teacher.");
          return;
        }

        const classDoc = snap.docs[0];
        const classData = classDoc.data();
        setClassName(classData.name);

        // Update student record
        await updateDoc(doc(db, 'users', user.uid), {
          classId: classDoc.id,
          teacherId: classData.teacherId
        });

        // Update class record
        await updateDoc(doc(db, 'classes', classDoc.id), {
          studentIds: arrayUnion(user.uid)
        });

        setStatus('success');
        toast.success(`Welcome to ${classData.name}!`);
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          navigate('/dashboard');
        }, 3000);
      } catch (error) {
        console.error("Error joining class via link:", error);
        setStatus('error');
        setErrorMessage("An error occurred while joining the class. Please try again.");
      }
    };

    handleJoinWithLink();
  }, [code, user, authLoading, navigate]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full scholar-card p-8 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center text-primary mx-auto mb-6">
          <GraduationCap size={32} />
        </div>

        {status === 'loading' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-serif italic text-primary">Joining Class...</h2>
            <p className="text-ink-muted">Please wait while we process your request.</p>
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="flex justify-center mb-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-serif italic text-primary">Success!</h2>
            <p className="text-ink">You have successfully joined <span className="font-bold">{className}</span>.</p>
            <p className="text-sm text-ink-muted">Redirecting you to your dashboard...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="flex justify-center mb-2">
              <XCircle className="w-12 h-12 text-rose-500" />
            </div>
            <h2 className="text-2xl font-serif italic text-primary">Unable to Join</h2>
            <p className="text-rose-600 font-medium">{errorMessage}</p>
            <button 
              onClick={() => navigate('/dashboard')}
              className="mt-6 px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-light transition-all"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {status === 'already-enrolled' && (
          <div className="space-y-4">
            <div className="flex justify-center mb-2">
              <XCircle className="w-12 h-12 text-amber-500" />
            </div>
            <h2 className="text-2xl font-serif italic text-primary">Already Enrolled</h2>
            <p className="text-ink-muted">You are already a member of a class. Students cannot switch classes on their own.</p>
            <p className="text-sm italic text-ink-muted mt-2">Please contact your teacher if you need to be moved.</p>
            <button 
              onClick={() => navigate('/dashboard')}
              className="mt-6 px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-light transition-all"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default JoinClassHandler;
