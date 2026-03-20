/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  Camera, 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  History as HistoryIcon, 
  Share2, 
  Download, 
  Plus, 
  X,
  Volume2,
  Languages
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, signIn, handleFirestoreError, FirestoreOperationType, logAppEvent } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, query, where, onSnapshot, orderBy, Timestamp, serverTimestamp } from 'firebase/firestore';
import { processMedicalInput, EmergencyCardData } from './services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Markdown from 'react-markdown';
import { format } from 'date-fns';

// Utility for Tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface EmergencyCard extends EmergencyCardData {
  id: string;
  userId: string;
  createdAt: Timestamp;
  rawInput?: string;
}

// --- Components ---

const Header = () => (
  <header role="banner" className="sticky top-0 z-50 w-full border-b border-teal-900/10 bg-white/80 backdrop-blur-md">
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow-lg shadow-teal-600/20">
          <Plus className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-teal-900">MediBridge</h1>
          <p className="text-[10px] font-medium uppercase tracking-widest text-teal-600/60">Emergency Context Translator</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600 sm:flex" aria-label="Emergency Alert">
          <AlertCircle className="h-5 w-5" />
        </div>
      </div>
    </div>
  </header>
);

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <motion.div
      animate={{ 
        scale: [1, 1.2, 1],
        rotate: [0, 180, 360]
      }}
      transition={{ 
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }}
      className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-600"
    >
      <Loader2 className="h-8 w-8 animate-spin" />
    </motion.div>
    <h3 className="text-lg font-semibold text-teal-900">Gemini is thinking...</h3>
    <p className="max-w-xs text-sm text-teal-600/60">Analyzing medical context and generating your emergency action card.</p>
  </div>
);

const ActionCard = ({ card }: { card: EmergencyCard }) => {
  /**
   * Uses Speech Synthesis to read out the actions.
   * @param {string} text The text to speak.
   */
  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
    logAppEvent('speak_actions', { cardId: card.id });
  };

  /**
   * Handles sharing the emergency card.
   */
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'MediBridge Emergency Card',
          text: `Emergency Situation: ${card.situation}\nActions: ${card.actions.join(', ')}`,
          url: window.location.href,
        });
        logAppEvent('share_card', { cardId: card.id });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-3xl border border-teal-900/10 bg-white shadow-2xl shadow-teal-900/5"
      role="article"
      aria-labelledby={`card-title-${card.id}`}
    >
      <div className="bg-teal-600 p-6 text-white">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur-sm">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            Card Generated
          </div>
          <div className="text-xs opacity-60">
            {format(card.createdAt.toDate(), 'MMM d, yyyy • HH:mm')}
          </div>
        </div>
        <h2 id={`card-title-${card.id}`} className="text-2xl font-bold leading-tight">{card.situation}</h2>
        <div className="mt-2 flex items-center gap-2 text-sm opacity-80">
          <Languages className="h-4 w-4" aria-hidden="true" />
          Detected: {card.language}
        </div>
      </div>

      <div className="p-6">
        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-2xl bg-teal-50 p-4">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-teal-600/60">Age</p>
            <p className="font-semibold text-teal-900">{card.patientSummary.age}</p>
          </div>
          <div className="rounded-2xl bg-teal-50 p-4">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-teal-600/60">Conditions</p>
            <p className="text-sm font-semibold text-teal-900">{card.patientSummary.conditions.join(', ') || 'None'}</p>
          </div>
          <div className="rounded-2xl bg-teal-50 p-4">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-teal-600/60">Medications</p>
            <p className="text-sm font-semibold text-teal-900">{card.patientSummary.medications.join(', ') || 'None'}</p>
          </div>
        </div>

        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-widest text-teal-900/40">Immediate Actions</h3>
            <button 
              onClick={() => speak(`Immediate actions: ${card.actions.join('. ')}`)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-teal-600 hover:bg-teal-100 transition-colors"
              aria-label="Read actions aloud"
            >
              <Volume2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="space-y-3">
            {card.actions.map((action, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white" aria-hidden="true">
                  {i + 1}
                </div>
                <p className="text-teal-900">{action}</p>
              </div>
            ))}
          </div>
        </div>

        {card.warnings.length > 0 && (
          <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-4" role="alert">
            <div className="mb-2 flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Red Flag Warnings</h3>
            </div>
            <ul className="list-inside list-disc space-y-1 text-sm text-amber-900/80">
              {card.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3">
          <button 
            onClick={handleShare}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-teal-900/10 bg-white py-3 text-sm font-semibold text-teal-900 hover:bg-teal-50 transition-colors"
            aria-label="Share this card"
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            Share
          </button>
          <button 
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-teal-900 py-3 text-sm font-semibold text-white hover:bg-teal-800 transition-colors"
            aria-label="Download card as PDF"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download PDF
          </button>
        </div>
      </div>
    </motion.div>
  );
};

/**
 * Main application component for MediBridge.
 * Handles authentication, medical input processing, and emergency card management.
 * @returns {JSX.Element} The rendered application.
 */
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cards, setCards] = useState<EmergencyCard[]>([]);
  const [activeCard, setActiveCard] = useState<EmergencyCard | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
      } else {
        signIn().catch(err => {
          console.error("Auth error:", err);
          setError("Failed to sign in anonymously.");
        });
      }
    });

    // Setup Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputText(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };
    }

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'emergencyCards'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newCards = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as EmergencyCard[];
      setCards(newCards);
    }, (err) => {
      handleFirestoreError(err, FirestoreOperationType.LIST, 'emergencyCards');
    });

    return () => unsubscribe();
  }, [user]);

  /**
   * Toggles the speech recognition recording state.
   */
  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      logAppEvent('stop_recording');
    } else {
      setInputText('');
      recognitionRef.current?.start();
      logAppEvent('start_recording');
    }
    setIsRecording(!isRecording);
  };

  /**
   * Processes the medical input (text or multimodal) using Gemini.
   * @param {string | { data: string; mimeType: string }} input The input to process.
   * @param {boolean} isMultimodal Whether the input is multimodal (image).
   */
  const handleProcess = async (input: string | { data: string; mimeType: string }, isMultimodal = false) => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    setActiveCard(null);
    logAppEvent('process_medical_input', { type: isMultimodal ? 'image' : 'text' });

    try {
      const result = await processMedicalInput(input, isMultimodal);
      
      const docRef = await addDoc(collection(db, 'emergencyCards'), {
        ...result,
        userId: user.uid,
        createdAt: serverTimestamp(),
        rawInput: typeof input === 'string' ? input : '[Image Data]'
      });

      logAppEvent('card_generated', { cardId: docRef.id });
    } catch (err) {
      console.error('Processing error:', err);
      setError("Failed to process medical information. Please try again.");
      logAppEvent('processing_error', { error: String(err) });
    } finally {
      setIsLoading(false);
      setInputText('');
    }
  };

  /**
   * Handles file upload for image-based medical context.
   * @param {React.ChangeEvent<HTMLInputElement>} e The change event.
   */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    logAppEvent('upload_image', { fileName: file.name, fileType: file.type });
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const data = base64.split(',')[1];
      handleProcess({ data, mimeType: file.type }, true);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-teal-50/30 font-sans text-teal-900">
      <Header />

      <main role="main" className="mx-auto max-w-3xl px-4 py-8">
        <AnimatePresence mode="wait">
          {!activeCard && !isLoading && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center">
                <h2 className="text-3xl font-bold tracking-tight text-teal-900">How can we help?</h2>
                <p className="mt-2 text-teal-600/60">Record symptoms, upload a prescription, or type medical history.</p>
              </div>

              <div className="relative overflow-hidden rounded-[2.5rem] border border-teal-900/10 bg-white p-2 shadow-2xl shadow-teal-900/5">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type symptoms or medical history here..."
                  aria-label="Medical history or symptoms input"
                  className="h-40 w-full resize-none rounded-[2rem] border-none bg-transparent p-6 text-lg focus:ring-0"
                />
                
                <div className="flex items-center justify-between p-4">
                  <div className="flex gap-2">
                    <button 
                      onClick={toggleRecording}
                      aria-label={isRecording ? "Stop recording" : "Start recording"}
                      className={cn(
                        "flex h-14 w-14 items-center justify-center rounded-2xl transition-all",
                        isRecording ? "bg-red-500 text-white animate-pulse" : "bg-teal-50 text-teal-600 hover:bg-teal-100"
                      )}
                    >
                      <Mic className="h-6 w-6" aria-hidden="true" />
                    </button>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Upload medical document image"
                      className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 hover:bg-teal-100 transition-all"
                    >
                      <Camera className="h-6 w-6" aria-hidden="true" />
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      accept="image/*" 
                      className="hidden" 
                      aria-hidden="true"
                    />
                  </div>
                  
                  <button 
                    onClick={() => handleProcess(inputText)}
                    disabled={!inputText.trim() || isLoading}
                    aria-label="Process medical information"
                    className="flex h-14 items-center gap-2 rounded-2xl bg-teal-900 px-8 font-bold text-white transition-all hover:bg-teal-800 disabled:opacity-50"
                  >
                    <span>Process</span>
                    <Send className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-red-600" role="alert">
                  <AlertCircle className="h-5 w-5" aria-hidden="true" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              {cards.length > 0 && (
                <section className="pt-8" aria-labelledby="history-title">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 id="history-title" className="text-sm font-bold uppercase tracking-widest text-teal-900/40">Recent Cards</h3>
                    <button 
                      onClick={() => {
                        setShowHistory(true);
                        logAppEvent('view_all_history');
                      }}
                      className="text-sm font-semibold text-teal-600 hover:text-teal-700"
                      aria-label="View all card history"
                    >
                      View All
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {cards.slice(0, 2).map(card => (
                      <button
                        key={card.id}
                        onClick={() => {
                          setActiveCard(card);
                          logAppEvent('select_card_from_history', { cardId: card.id });
                        }}
                        className="flex flex-col items-start rounded-3xl border border-teal-900/5 bg-white p-6 text-left transition-all hover:border-teal-900/10 hover:shadow-lg hover:shadow-teal-900/5"
                        aria-label={`View card for ${card.situation}`}
                      >
                        <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                          <HistoryIcon className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <h4 className="line-clamp-1 font-bold text-teal-900">{card.situation}</h4>
                        <p className="mt-1 text-xs text-teal-600/60">{format(card.createdAt.toDate(), 'MMM d, HH:mm')}</p>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </motion.div>
          )}

          {isLoading && <LoadingState key="loading" />}

          {activeCard && (
            <div key="card" className="space-y-6">
              <button 
                onClick={() => setActiveCard(null)}
                className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-teal-600 hover:text-teal-700"
              >
                <Plus className="h-4 w-4 rotate-45" />
                Back to Input
              </button>
              <ActionCard card={activeCard} />
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* History Modal */}
      <AnimatePresence>
        {showHistory && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="absolute inset-0 bg-teal-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-lg overflow-hidden rounded-t-[2.5rem] bg-white shadow-2xl sm:rounded-[2.5rem]"
            >
              <div className="flex items-center justify-between border-b border-teal-900/5 p-6">
                <h3 className="text-xl font-bold text-teal-900">History</h3>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-teal-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="max-h-[70vh] overflow-y-auto p-6 space-y-4">
                {cards.map(card => (
                  <button
                    key={card.id}
                    onClick={() => {
                      setActiveCard(card);
                      setShowHistory(false);
                    }}
                    className="flex w-full items-center gap-4 rounded-2xl border border-teal-900/5 p-4 text-left transition-all hover:bg-teal-50"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                      <Plus className="h-6 w-6" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h4 className="truncate font-bold text-teal-900">{card.situation}</h4>
                      <p className="text-xs text-teal-600/60">{format(card.createdAt.toDate(), 'MMMM d, yyyy • HH:mm')}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Error Boundary Placeholder */}
      <div id="error-boundary-root"></div>
    </div>
  );
}
