import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  BarChart3, 
  History, 
  PenTool, 
  BookOpen, 
  Headphones, 
  Mic2, 
  Settings, 
  LogOut,
  Bell,
  Search,
  GraduationCap,
  Zap,
  Loader2,
  BookOpenCheck,
  Moon,
  Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { auth, onAuthStateChanged, db, signOut } from './firebase';
import { 
  doc, 
  onSnapshot, 
  updateDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  writeBatch 
} from 'firebase/firestore';
import { User, Notification } from './types';
import { Toaster } from 'sonner';

// Screens
import Dashboard from './screens/Dashboard';
import Administration from './screens/Administration';
import Analytics from './screens/Analytics';
import Samples from './screens/Samples';
import HistoryLogs from './screens/HistoryLogs';
import WritingPractice from './screens/WritingPractice';
import ReadingPractice from './screens/ReadingPractice';
import ListeningPractice from './screens/ListeningPractice';
import SpeakingPractice from './screens/SpeakingPractice';
import EvaluationReport from './screens/EvaluationReport';
import SettingsScreen from './screens/Settings';
import ShortPractice from './screens/ShortPractice';
import Login from './screens/Login';
import SitePage from './screens/SitePage';
import TeacherDashboard from './screens/TeacherDashboard';
import JoinClassHandler from './screens/JoinClassHandler';
import NotificationPanel from './components/NotificationPanel';

// Auth Context
interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, logout: async () => {} });

// Theme Context
interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ theme: 'light', toggleTheme: () => {} });

export const useAuth = () => useContext(AuthContext);
export const useTheme = () => useContext(ThemeContext);

const ProtectedRoute = ({ children, adminOnly = false, teacherOnly = false }: { children: React.ReactNode, adminOnly?: boolean, teacherOnly?: boolean }) => {
  const { user, loading } = useAuth();
  
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <Loader2 className="animate-spin text-primary" size={48} />
    </div>
  );
  
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" />;
  if (teacherOnly && user.role !== 'teacher' && user.role !== 'admin') return <Navigate to="/" />;
  
  return <>{children}</>;
};

const SidebarItem = ({ to, icon: Icon, label, active }: { to: string, icon: any, label: string, active: boolean }) => (
  <Link to={to} className={cn("sidebar-item", active && "sidebar-item-active")}>
    <Icon size={20} className={cn(active ? "text-white" : "text-ink-muted")} />
    <span className="font-medium">{label}</span>
    {active && <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />}
  </Link>
);

const Sidebar = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const menuItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin', icon: Users, label: 'Administration', adminOnly: true },
    { to: '/samples', icon: BookOpenCheck, label: 'Sample Library' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/history', icon: History, label: 'History Logs' },
  ];

  const filteredMenuItems = menuItems.filter(item => !item.adminOnly || user?.role === 'admin');

  const practiceItems = [
    { to: '/practice/short', icon: Zap, label: 'Short Practice' },
    { to: '/practice/writing', icon: PenTool, label: 'Writing Task Practice' },
    { to: '/practice/reading', icon: BookOpen, label: 'Reading Practice' },
    { to: '/practice/listening', icon: Headphones, label: 'Listening Practice' },
    { to: '/practice/speaking', icon: Mic2, label: 'Speaking Practice' },
    { to: '/teacher', icon: GraduationCap, label: 'Teacher Center', teacherOnly: true },
  ];

  const filteredPracticeItems = practiceItems.filter(item => {
    if ((item as any).teacherOnly) return user?.role === 'teacher' || user?.role === 'admin';
    return true;
  });

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="w-72 h-screen sticky top-0 bg-surface border-r border-line flex flex-col p-6 gap-8 overflow-y-auto custom-scrollbar transition-colors duration-300">
      <div className="flex items-center gap-3 px-2">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
          <GraduationCap size={24} />
        </div>
        <div>
          <h1 className="text-xl font-serif italic leading-none text-primary">The Scholar</h1>
          <p className="text-[10px] uppercase tracking-widest font-bold text-ink-muted mt-1">IELTS Preparation</p>
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-8">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-widest font-bold text-ink-muted px-4 mb-3">Main Menu</p>
          {filteredMenuItems.map(item => (
            <SidebarItem key={item.to} {...item} active={location.pathname === item.to} />
          ))}
        </div>

        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-widest font-bold text-ink-muted px-4 mb-3">Practice & Teaching</p>
          {filteredPracticeItems.map(item => (
            <SidebarItem key={item.to} {...item} active={location.pathname.startsWith(item.to)} />
          ))}
        </div>
      </nav>

      <div className="pt-6 border-t border-line space-y-1">
        <SidebarItem to="/settings" icon={Settings} label="Settings" active={location.pathname === '/settings'} />
        <button 
          onClick={handleLogout}
          className="sidebar-item w-full text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <LogOut size={20} />
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

const TopBar = ({ notifications, onMarkAllRead }: { notifications: Notification[], onMarkAllRead: () => void }) => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;
  
  return (
    <header className="h-20 bg-surface/80 backdrop-blur-md border-b border-line sticky top-0 z-10 px-8 flex items-center justify-between transition-colors duration-300">
      <div className="flex items-center gap-4 bg-bg px-4 py-2 rounded-full border border-line w-96 transition-colors">
        <Search size={18} className="text-ink-muted" />
        <input 
          type="text" 
          placeholder="Search for lessons, students, or reports..." 
          className="bg-transparent border-none outline-none text-sm w-full placeholder:text-ink-muted text-ink"
        />
      </div>

      <div className="flex items-center gap-6">
        <button 
          onClick={toggleTheme}
          className="p-2 text-ink-muted hover:text-primary transition-colors rounded-lg hover:bg-bg"
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        <div className="relative">
          <button 
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className={cn(
              "p-2 transition-colors rounded-lg hover:bg-bg relative",
              isNotificationsOpen ? "text-primary bg-bg" : "text-ink-muted hover:text-primary"
            )}
          >
            <Bell size={22} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-surface font-bold">
                {unreadCount}
              </span>
            )}
          </button>
          
          <NotificationPanel 
            isOpen={isNotificationsOpen} 
            onClose={() => setIsNotificationsOpen(false)}
            notifications={notifications}
            onMarkAllRead={onMarkAllRead}
          />
        </div>
        
        <div className="h-8 w-px bg-line" />
        
        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="text-right">
            <p className="text-sm font-bold text-ink leading-none">{user?.name || 'Scholar'}</p>
            <p className="text-[10px] text-ink-muted mt-1 uppercase tracking-widest font-bold">
              {user?.role === 'admin' ? 'Administrator' : user?.role === 'teacher' ? 'Expert Teacher' : `Scholar ID: #${user?.uid.slice(0, 8)}`}
            </p>
          </div>
          <img 
            src={user?.avatar || 'https://i.pravatar.cc/150'} 
            alt="Avatar" 
            className="w-10 h-10 rounded-full border-2 border-primary/10 group-hover:border-primary transition-all shadow-sm"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </header>
  );
};

const AppContent = ({ notifications, onMarkAllRead }: { notifications: Notification[], onMarkAllRead: () => void }) => {
  const location = useLocation();
  
  return (
    <div className="flex min-h-screen bg-bg transition-colors duration-300">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <TopBar notifications={notifications} onMarkAllRead={onMarkAllRead} />
        <div className="p-8 flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute adminOnly><Administration /></ProtectedRoute>} />
              <Route path="/administration" element={<Navigate to="/admin" replace />} />
              <Route path="/teacher" element={<ProtectedRoute teacherOnly><TeacherDashboard /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
              <Route path="/samples" element={<ProtectedRoute><Samples /></ProtectedRoute>} />
              <Route path="/history" element={<ProtectedRoute><HistoryLogs /></ProtectedRoute>} />
              <Route path="/practice/writing" element={<ProtectedRoute><WritingPractice /></ProtectedRoute>} />
              <Route path="/practice/reading" element={<ProtectedRoute><ReadingPractice /></ProtectedRoute>} />
              <Route path="/practice/listening" element={<ProtectedRoute><ListeningPractice /></ProtectedRoute>} />
              <Route path="/practice/speaking" element={<ProtectedRoute><SpeakingPractice /></ProtectedRoute>} />
              <Route path="/practice/short" element={<ProtectedRoute><ShortPractice /></ProtectedRoute>} />
              <Route path="/evaluation/:id" element={<ProtectedRoute><EvaluationReport /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsScreen /></ProtectedRoute>} />
              <Route path="/join/:code" element={<JoinClassHandler />} />
              <Route path="/:path" element={<SitePage />} />
            </Routes>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;
    let unsubscribeNotifications: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        unsubscribeDoc = onSnapshot(userRef, async (userSnap) => {
          if (userSnap.exists()) {
            const userData = userSnap.data() as User;
            
            // Set up notification listener
            const notifQuery = query(
              collection(db, 'notifications'),
              where('userId', '==', firebaseUser.uid)
            );
            
            if (unsubscribeNotifications) unsubscribeNotifications();
            unsubscribeNotifications = onSnapshot(notifQuery, (notifSnap) => {
              const fetchedNotifs = notifSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
              // Sort in memory to avoid index requirement
              const sortedNotifs = fetchedNotifs.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || new Date(0);
                return dateB.getTime() - dateA.getTime();
              });
              setNotifications(sortedNotifs);
            }, (error) => {
              console.warn("Notification listener failed (likely index needed):", error);
            });

            // Ensure developer is admin
            if (firebaseUser.email === 'nilayrathod000@gmail.com' && userData.role !== 'admin') {
              await updateDoc(userRef, { role: 'admin' });
              setUser({ ...userData, role: 'admin' });
            } else {
              setUser(userData);
            }
          } else {
            setUser(null);
            setNotifications([]);
          }
          setLoading(false);
        }, (error) => {
          console.error("Firestore snapshot error:", error);
          setUser(null);
          setNotifications([]);
          setLoading(false);
        });
      } else {
        if (unsubscribeDoc) unsubscribeDoc();
        if (unsubscribeNotifications) unsubscribeNotifications();
        setUser(null);
        setNotifications([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
      if (unsubscribeNotifications) unsubscribeNotifications();
    };
  }, []);

  const handleMarkAllRead = async () => {
    if (!user) return;
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;
    
    const batch = writeBatch(db);
    unread.forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    try {
      await batch.commit();
    } catch (e) {
      console.error("Batch update failed:", e);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        <Toaster position="top-right" richColors />
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={<AppContent notifications={notifications} onMarkAllRead={handleMarkAllRead} />} />
          </Routes>
        </Router>
      </ThemeContext.Provider>
    </AuthContext.Provider>
  );
}
