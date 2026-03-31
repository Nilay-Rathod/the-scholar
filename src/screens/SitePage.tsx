import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { db } from '../firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { Loader2, ArrowLeft, Globe, Calendar, User } from 'lucide-react';
import { cn } from '../lib/utils';

interface Section {
  id: number;
  type: 'Hero' | 'Text' | 'Gallery' | 'Testimonials';
  content: {
    title?: string;
    text?: string;
    cta?: string;
    imageUrl?: string;
  };
}

interface PageData {
  id: string;
  title: string;
  path: string;
  sections: Section[];
  type?: 'page' | 'blog';
  category?: string;
  updatedAt?: any;
}

export default function SitePage() {
  const { path } = useParams<{ path: string }>();
  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPage = async () => {
      setLoading(true);
      setError(null);
      try {
        // Try pages collection first
        const pagesRef = collection(db, 'pages');
        const q = query(pagesRef, where('path', '==', path), limit(1));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const doc = querySnapshot.docs[0];
          setPage({ id: doc.id, ...doc.data() } as PageData);
          setLoading(false);
          return;
        }

        // Try blogs collection next
        const blogsRef = collection(db, 'blogs');
        const bq = query(blogsRef, where('path', '==', path), limit(1));
        const blogSnapshot = await getDocs(bq);

        if (!blogSnapshot.empty) {
          const doc = blogSnapshot.docs[0];
          setPage({ id: doc.id, ...doc.data(), type: 'blog' } as PageData);
          setLoading(false);
          return;
        }

        setError('Page not found');
      } catch (err) {
        console.error('Error fetching page:', err);
        setError('Failed to load page');
      } finally {
        setLoading(false);
      }
    };

    if (path) fetchPage();
  }, [path]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-primary" size={48} />
        <p className="text-sm font-bold uppercase tracking-widest text-ink-muted animate-pulse">Summoning Content...</p>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-6">
          <Globe size={40} />
        </div>
        <h2 className="text-3xl font-serif italic text-primary mb-4">{error || 'Page Not Found'}</h2>
        <p className="text-ink-muted mb-8 max-w-md italic">The path you seek has not been chronicled in our archives or has vanished into the ether.</p>
        <Link 
          to="/" 
          className="bg-primary text-white px-8 py-3 rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-primary-light transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
        >
          <ArrowLeft size={18} /> Return to Sanctum
        </Link>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-5xl mx-auto space-y-16 py-12"
    >
      {/* Blog Metadata Header */}
      {page.type === 'blog' && (
        <div className="border-b border-line pb-8 mb-12">
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-primary/10 text-primary px-3 py-1 rounded text-xs font-extrabold uppercase tracking-widest">
              {page.category || 'Scholarship'}
            </span>
          </div>
          <h1 className="text-5xl font-serif italic text-primary mb-6">{page.title}</h1>
          <div className="flex items-center gap-6 text-ink-muted text-sm italic">
            <div className="flex items-center gap-2">
              <User size={16} />
              <span>Scholar Editorial</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={16} />
              <span>{new Date(page.updatedAt?.toDate?.() || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Sections */}
      <div className="space-y-24">
        {page.sections?.map((section, idx) => (
          <section key={section.id || idx} className="relative">
            {section.type === 'Hero' ? (
              <div className="text-center space-y-8 py-12">
                <motion.h2 
                  initial={{ y: 20, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  className="text-6xl font-serif italic text-primary leading-tight"
                >
                  {section.content?.title}
                </motion.h2>
                <motion.p 
                  initial={{ y: 20, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                  className="text-xl text-ink-muted max-w-2xl mx-auto leading-relaxed"
                >
                  {section.content?.text}
                </motion.p>
                {section.content?.cta && (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                  >
                    <button className="bg-secondary text-white px-10 py-4 rounded-xl font-bold uppercase tracking-widest text-sm hover:translate-y-[-2px] transition-all shadow-xl shadow-secondary/20">
                      {section.content.cta}
                    </button>
                  </motion.div>
                )}
              </div>
            ) : section.type === 'Text' ? (
              <div className="max-w-3xl mx-auto prose prose-slate">
                {section.content?.title && (
                  <h3 className="text-3xl font-serif italic text-primary mb-6">{section.content.title}</h3>
                )}
                <div className="font-serif text-lg leading-relaxed text-ink whitespace-pre-wrap">
                  {section.content?.text}
                </div>
              </div>
            ) : section.type === 'Gallery' || section.type === 'Testimonials' ? (
              <div className="bg-surface/50 border border-line rounded-3xl p-12 text-center italic text-ink-muted">
                <Globe size={32} className="mx-auto mb-4 opacity-20" />
                <p>The {section.type} visualization is being curated by our cartographers.</p>
                <p className="text-xs uppercase tracking-widest mt-2 font-bold opacity-50">Experimental Component</p>
              </div>
            ) : null}
          </section>
        ))}
      </div>

      {!page.type && (
        <div className="pt-24 border-t border-line text-center">
          <p className="text-xs uppercase tracking-[0.3em] font-bold text-ink-muted opacity-30">
            End of Document
          </p>
        </div>
      )}
    </motion.div>
  );
}
