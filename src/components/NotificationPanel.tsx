import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  CheckCircle2, 
  Info, 
  AlertCircle, 
  X, 
  Trash2, 
  Check,
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Notification } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { db } from '../firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';

interface NotificationPanelProps {
  notifications: Notification[];
  isOpen: boolean;
  onClose: () => void;
  onMarkAllRead: () => void;
}

export default function NotificationPanel({ notifications, isOpen, onClose, onMarkAllRead }: NotificationPanelProps) {
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="text-emerald-500" size={18} />;
      case 'warning': return <AlertCircle className="text-amber-500" size={18} />;
      case 'error': return <X className="text-red-500" size={18} />;
      default: return <Info className="text-blue-500" size={18} />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-transparent" 
            onClick={onClose} 
          />
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-full right-0 mt-4 w-96 bg-surface border border-line rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-line flex items-center justify-between bg-bg/50">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-primary" />
                <h3 className="font-serif italic font-bold text-primary">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="bg-primary text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {unreadCount} New
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button 
                    onClick={onMarkAllRead}
                    className="text-[10px] font-bold text-ink-muted hover:text-primary transition-colors flex items-center gap-1"
                  >
                    <Check size={12} /> Mark all read
                  </button>
                )}
                <button onClick={onClose} className="p-1 hover:bg-bg rounded-lg transition-colors text-ink-muted">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-bg rounded-full flex items-center justify-center mx-auto mb-4 text-ink-muted/20">
                    <Bell size={32} />
                  </div>
                  <p className="text-sm font-serif italic text-ink-muted">All caught up! No notifications yet.</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {notifications.map((n) => (
                    <div 
                      key={n.id}
                      className={cn(
                        "p-4 border-b border-line last:border-0 transition-colors flex gap-4 group",
                        !n.read ? "bg-primary/5" : "hover:bg-bg"
                      )}
                    >
                      <div className="mt-1 shrink-0">
                        {getIcon(n.type)}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className={cn("text-xs font-bold leading-tight", !n.read ? "text-ink" : "text-ink-muted")}>
                            {n.title}
                          </p>
                          <span className="text-[10px] text-ink-muted shrink-0">
                            {formatDistanceToNow(n.createdAt?.toDate ? n.createdAt.toDate() : new Date(n.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-[11px] text-ink-muted leading-relaxed line-clamp-2">
                          {n.message}
                        </p>
                        {n.link && (
                          <a 
                            href={n.link}
                            className="text-[10px] font-bold text-primary flex items-center gap-1 mt-2 hover:underline"
                            onClick={() => handleMarkRead(n.id)}
                          >
                            View details <ChevronRight size={10} />
                          </a>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!n.read && (
                          <button 
                            onClick={() => handleMarkRead(n.id)}
                            className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"
                            title="Mark as read"
                          >
                            <Check size={14} />
                          </button>
                        )}
                        <button 
                          onClick={() => handleDelete(n.id)}
                          className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-1 border-t border-line bg-bg/30" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
