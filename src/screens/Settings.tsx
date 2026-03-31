import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  User, 
  Bell, 
  Shield, 
  Globe, 
  CreditCard, 
  Camera,
  CheckCircle2,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { useAuth } from '../App';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';

import { toast } from 'sonner';

export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    targetBand: user?.targetBand || 7.5
  });

  const tabs = [
    { id: 'profile', label: 'Profile Settings', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'billing', label: 'Billing & Plan', icon: CreditCard },
  ];

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        name: formData.name,
        targetBand: formData.targetBand
      });
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error("Update failed:", error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-4xl mx-auto flex flex-col gap-8"
    >
      <div>
        <h2 className="text-3xl font-serif italic text-primary">Account Settings</h2>
        <p className="text-ink-muted mt-1">Manage your academic profile and institutional preferences.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Settings Navigation */}
        <div className="w-full md:w-64 flex flex-col gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left",
                  activeTab === tab.id 
                    ? "bg-primary text-white shadow-lg shadow-primary/20" 
                    : "text-ink-muted hover:bg-surface hover:text-primary border border-transparent hover:border-line"
                )}
              >
                <Icon size={18} />
                <span className="text-sm font-bold">{tab.label}</span>
                {activeTab === tab.id && <ChevronRight size={16} className="ml-auto" />}
              </button>
            );
          })}
        </div>

        {/* Settings Content */}
        <div className="flex-1 flex flex-col gap-6">
          {activeTab === 'profile' && (
            <motion.div 
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="scholar-card"
            >
              <h3 className="text-xl font-serif italic text-primary mb-8">Personal Information</h3>
              
              <div className="flex flex-col gap-8">
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    <img 
                      src={user?.avatar || "https://i.pravatar.cc/150?u=aria"} 
                      alt="Profile" 
                      className="w-24 h-24 rounded-full border-4 border-surface shadow-md"
                      referrerPolicy="no-referrer"
                    />
                    <button className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full shadow-lg hover:bg-primary-light transition-all">
                      <Camera size={16} />
                    </button>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-ink">{user?.name}</h4>
                    <p className="text-sm text-ink-muted">Scholar ID: #{user?.uid.slice(0, 8)}</p>
                    <p className="text-xs text-secondary font-bold mt-1 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Verified Academic Account
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted">Full Name</label>
                    <input 
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-surface border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary transition-all text-ink"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted">Email Address</label>
                    <input 
                      type="email" 
                      disabled
                      value={formData.email}
                      className="w-full bg-surface border border-line rounded-lg px-4 py-2.5 text-sm outline-none opacity-50 cursor-not-allowed text-ink"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted">Target Band Score</label>
                    <select 
                      value={formData.targetBand}
                      onChange={(e) => setFormData({ ...formData, targetBand: parseFloat(e.target.value) })}
                      className="w-full bg-surface border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary transition-all text-ink"
                    >
                      <option value="6.5">6.5</option>
                      <option value="7.0">7.0</option>
                      <option value="7.5">7.5</option>
                      <option value="8.0">8.0</option>
                      <option value="8.5">8.5</option>
                      <option value="9.0">9.0</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-ink-muted">Timezone</label>
                    <div className="relative">
                      <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
                      <select className="w-full bg-surface border border-line rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary transition-all text-ink">
                        <option>London (GMT +0)</option>
                        <option>New York (EST -5)</option>
                        <option>Singapore (SGT +8)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-line flex justify-end gap-3">
                  <button className="px-6 py-2 rounded-lg text-sm font-bold text-ink-muted hover:bg-surface transition-all">Cancel</button>
                  <button 
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="px-6 py-2 rounded-lg text-sm font-bold bg-primary text-white hover:bg-primary-light transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Save Changes'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'notifications' && (
            <motion.div 
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="scholar-card"
            >
              <h3 className="text-xl font-serif italic text-primary mb-8">Notification Preferences</h3>
              <div className="space-y-6">
                {[
                  { title: 'Evaluation Reports', desc: 'Receive an email when your practice session is evaluated.', default: true },
                  { title: 'Institutional Updates', desc: 'Stay informed about new lessons and academic resources.', default: true },
                  { title: 'Practice Reminders', desc: 'Daily nudges to keep your study streak alive.', default: false },
                  { title: 'Security Alerts', desc: 'Critical notifications about your account security.', default: true },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-4 border-b border-line last:border-0">
                    <div>
                      <h4 className="text-sm font-bold text-ink">{item.title}</h4>
                      <p className="text-xs text-ink-muted mt-1">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked={item.default} className="sr-only peer" />
                      <div className="w-11 h-6 bg-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'security' && (
            <motion.div 
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="scholar-card"
            >
              <h3 className="text-xl font-serif italic text-primary mb-8">Security & Privacy</h3>
              <div className="space-y-8">
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-ink uppercase tracking-widest text-ink-muted">Change Password</h4>
                  <div className="grid grid-cols-1 gap-4">
                    <input type="password" placeholder="Current Password" className="w-full bg-surface border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary transition-all text-ink" />
                    <input type="password" placeholder="New Password" className="w-full bg-surface border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary transition-all text-ink" />
                    <input type="password" placeholder="Confirm New Password" className="w-full bg-surface border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary transition-all text-ink" />
                  </div>
                  <button className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-white hover:bg-primary-light transition-all">Update Password</button>
                </div>

                <div className="pt-8 border-t border-line space-y-4">
                  <h4 className="text-sm font-bold text-ink uppercase tracking-widest text-ink-muted">Two-Factor Authentication</h4>
                  <p className="text-xs text-ink-muted leading-relaxed">Add an extra layer of security to your account by requiring more than just a password to log in.</p>
                  <button className="px-4 py-2 rounded-lg text-sm font-bold border border-line hover:bg-surface transition-all text-ink">Enable 2FA</button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'billing' && (
            <motion.div 
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="scholar-card"
            >
              <h3 className="text-xl font-serif italic text-primary mb-8">Subscription Plan</h3>
              <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 bg-primary text-white text-[10px] font-bold uppercase tracking-widest rounded-full">Current Plan</span>
                  <span className="text-sm font-bold text-primary">$29.99 / month</span>
                </div>
                <h4 className="text-2xl font-serif italic text-primary">Scholar Pro</h4>
                <p className="text-sm text-ink-muted mt-2">Unlimited evaluations, AI-powered insights, and priority support.</p>
                <div className="mt-6 flex gap-3">
                  <button className="flex-1 bg-primary text-white py-2.5 rounded-lg text-sm font-bold hover:bg-primary-light transition-all">Manage Subscription</button>
                  <button className="flex-1 bg-surface border border-line py-2.5 rounded-lg text-sm font-bold hover:bg-bg transition-all text-ink">View Invoices</button>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-ink uppercase tracking-widest text-ink-muted">Payment Method</h4>
                <div className="flex items-center justify-between p-4 border border-line rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-8 bg-surface rounded flex items-center justify-center border border-line font-bold text-[10px] text-ink-muted italic">VISA</div>
                    <div>
                      <p className="text-sm font-bold text-ink">•••• •••• •••• 4242</p>
                      <p className="text-xs text-ink-muted">Expires 12/26</p>
                    </div>
                  </div>
                  <button className="text-xs font-bold text-primary hover:underline">Edit</button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
