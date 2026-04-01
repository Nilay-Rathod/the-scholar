import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LogIn, Loader2, Sparkles, BookOpen, Users, GraduationCap, Check } from 'lucide-react';
import { auth, googleProvider, signInWithPopup, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [loginRole, setLoginRole] = useState<'student' | 'teacher' | 'admin'>('student');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectPath = searchParams.get('redirect');

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const userEmail = user.email?.trim().toLowerCase() || '';
      
      // Check if user exists in Firestore by UID
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        // Check if a user was pre-enrolled with this email
        const q = query(collection(db, 'users'), where('email', '==', userEmail));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          // Link the pre-enrolled record to this UID
          const existingDoc = querySnapshot.docs[0];
          const existingData = existingDoc.data();
          
          // Create new doc with correct UID
          await setDoc(userRef, {
            ...existingData,
            uid: user.uid,
            name: user.displayName || existingData.name,
            avatar: user.photoURL || existingData.avatar,
            role: existingData.role || loginRole,
            isTeacher: existingData.role === 'teacher' || existingData.isTeacher || (loginRole === 'teacher' && existingData.role === 'teacher'),
            status: 'active'
          });
          
          // Delete ALL old docs with this email (to prevent duplicates)
          for (const oldDoc of querySnapshot.docs) {
            if (oldDoc.id !== user.uid) {
              try {
                await deleteDoc(oldDoc.ref);
              } catch (e) {
                console.warn("Cleanup failed for pre-enrolled document:", oldDoc.id);
              }
            }
          }
        } else {
          // NEW USER: Verification for Teacher Role
          if (loginRole === 'teacher') {
            toast.error("You are not registered as a teacher. Logging in as Scholar instead.");
            // Force student role for unauthorized teacher signups
          }

          const newUser = {
            uid: user.uid,
            name: user.displayName || 'IELTS Scholar',
            email: userEmail,
            avatar: user.photoURL || `https://i.pravatar.cc/150?u=${user.uid}`,
            role: loginRole === 'teacher' ? 'student' : loginRole, // Revert unauthorized teacher to student
            isTeacher: false,
            targetBand: 7.5,
            currentBand: 0,
            joinDate: new Date().toISOString(),
            status: 'active'
          };
          await setDoc(userRef, newUser);
        }
        
        // Final cleanup for ALL users (existing or new): remove ANY other doc with same email
        const emailQ = query(collection(db, 'users'), where('email', '==', userEmail));
        const emailSnap = await getDocs(emailQ);
        for (const orphan of emailSnap.docs) {
          if (orphan.id !== user.uid) {
            try {
              await deleteDoc(orphan.ref);
            } catch (e) {
              console.warn("Cleanup failed for orphan document:", orphan.id);
            }
          }
        }
      } else {
        // User exists: handle transitions
        const existingData = userSnap.data();
        const updates: any = {};
        
        // Promote developer to admin
        if (user.email === 'nilayrathod000@gmail.com' && existingData.role !== 'admin') {
          updates.role = 'admin';
        }
        
        // Ensure role-based flags
        if (existingData.role === 'teacher' || loginRole === 'teacher') {
          updates.isTeacher = true;
          if (loginRole === 'teacher' && existingData.role === 'teacher') {
            updates.role = 'teacher';
          }
        }

        if (Object.keys(updates).length > 0) {
          await updateDoc(userRef, updates);
        }

        // Cleanup placeholders for existing users too
        const emailQ = query(collection(db, 'users'), where('email', '==', userEmail));
        const emailSnap = await getDocs(emailQ);
        for (const orphan of emailSnap.docs) {
          if (orphan.id !== user.uid) {
            try {
              await deleteDoc(orphan.ref);
            } catch (e) {
              console.warn("Cleanup failed for orphan document:", orphan.id);
            }
          }
        }
      }
      
      

      
      navigate(redirectPath || '/');
    } catch (error: any) {
      console.error('Login failed:', error);
      toast.error(error.message || "Login failed. Please try again.");
      handleFirestoreError(error, OperationType.WRITE, 'users');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full scholar-card bg-surface p-12 flex flex-col items-center gap-8 shadow-2xl border border-line"
      >
        <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center text-white shadow-xl shadow-primary/20">
          <BookOpen size={40} />
        </div>
        
        <div className="text-center">
          <h2 className="text-3xl font-serif italic text-primary">IELTS Scholar</h2>
          <p className="text-ink-muted mt-2">Your journey to academic excellence begins here.</p>
        </div>

        <div className="w-full space-y-6">
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-widest font-bold text-ink-muted text-center mb-2">Select Your Portal</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => setLoginRole('student')}
                className={cn(
                  "w-full py-4 px-6 text-sm font-bold rounded-xl transition-all flex items-center justify-between border-2",
                  loginRole === 'student' 
                    ? "bg-primary/5 border-primary text-primary shadow-md" 
                    : "bg-surface border-line text-ink-muted hover:border-primary/30 hover:text-ink"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", loginRole === 'student' ? "bg-primary text-white" : "bg-bg text-ink-muted")}>
                    <Users size={20} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold">Scholar Portal</p>
                    <p className="text-[10px] opacity-70">Practice & Learn</p>
                  </div>
                </div>
                {loginRole === 'student' && <Check size={18} />}
              </button>

              <button 
                onClick={() => setLoginRole('teacher')}
                className={cn(
                  "w-full py-4 px-6 text-sm font-bold rounded-xl transition-all flex items-center justify-between border-2",
                  loginRole === 'teacher' 
                    ? "bg-secondary/5 border-secondary text-secondary shadow-md" 
                    : "bg-surface border-line text-ink-muted hover:border-secondary/30 hover:text-ink"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", loginRole === 'teacher' ? "bg-secondary text-white" : "bg-bg text-ink-muted")}>
                    <GraduationCap size={20} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold">Teacher Center</p>
                    <p className="text-[10px] opacity-70">Manage & Evaluate</p>
                  </div>
                </div>
                {loginRole === 'teacher' && <Check size={18} />}
              </button>

              <button 
                onClick={() => setLoginRole('admin')}
                className={cn(
                  "w-full py-2 px-4 text-[10px] uppercase tracking-widest font-bold rounded-lg transition-all border",
                  loginRole === 'admin' 
                    ? "bg-ink text-white border-ink shadow-sm" 
                    : "bg-surface border-line text-ink-muted hover:bg-bg"
                )}
              >
                Administration Panel
              </button>
            </div>
          </div>

          <button 
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full bg-primary text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-primary-light transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={24} />
            ) : (
              <>
                <LogIn size={24} />
                Sign in as {loginRole === 'admin' ? 'Administrator' : loginRole === 'teacher' ? 'Teacher' : 'Student'}
              </>
            )}
          </button>
          
          <div className="flex items-center gap-2 text-[10px] text-ink-muted uppercase tracking-widest justify-center">
            <Sparkles size={12} className="text-amber-500" />
            <span>AI-Powered IELTS Preparation</span>
          </div>
        </div>

        <p className="text-xs text-ink-muted text-center leading-relaxed">
          By signing in, you agree to our terms of service and academic integrity policy.
        </p>
      </motion.div>
    </div>
  );
}
