/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertCircle, 
  Shield, 
  MapPin, 
  User, 
  Users, 
  MessageSquare, 
  Phone, 
  Activity, 
  Flame, 
  ShieldAlert, 
  Waves, 
  Car, 
  Zap, 
  Wind, 
  ChevronRight, 
  LogOut, 
  Settings, 
  Heart, 
  Stethoscope, 
  Clock, 
  CheckCircle2, 
  Radio, 
  EyeOff, 
  Star, 
  Menu, 
  Moon, 
  Sun,
  Map as MapIcon,
  Plus,
  Mic,
  MicOff
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  auth, 
  db, 
  googleProvider, 
  handleFirestoreError, 
  OperationType 
} from './lib/firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  Timestamp, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { UserProfile, Incident, Screen, Language } from './types';
import { translations } from './translations';

// Fix Leaflet icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Gemini setup
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Speech recognition types
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

// --- Components ---

const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string>('');

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error?.message) {
        try {
          const parsed = JSON.parse(event.error.message);
          if (parsed.error) {
            setHasError(true);
            setErrorInfo(parsed.error);
          }
        } catch (e) {
          // Not a JSON error
        }
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#F8F9FA] p-6 text-center">
        <div className="w-20 h-20 bg-error rounded-ui flex items-center justify-center shadow-soft mb-6">
          <AlertCircle className="w-10 h-10 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Something went wrong</h1>
        <p className="text-slate-600 mb-6">{errorInfo || "An unexpected error occurred."}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-8 py-3 bg-primary text-slate-800 rounded-ui font-bold shadow-lifted hover:scale-[0.98] transition-all"
        >
          Reload App
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

const MapUpdater = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    if (map && center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
};

const WaveBackground = ({ color = "var(--primary-app)", opacity = 1, flip = false }: { color?: string, opacity?: number, flip?: boolean }) => (
  <div className={`absolute ${flip ? 'bottom-0' : 'top-0'} left-0 right-0 h-64 overflow-hidden z-0 pointer-events-none`}>
    <svg 
      viewBox="0 0 1440 320" 
      className={`w-full h-full ${flip ? 'rotate-180' : ''}`} 
      preserveAspectRatio="none"
    >
      <path 
        fill={color} 
        fillOpacity={opacity} 
        d="M0,160L48,176C96,192,192,224,288,224C384,224,480,192,576,165.3C672,139,768,117,864,128C960,139,1056,181,1152,197.3C1248,213,1344,203,1392,197.3L1440,192L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"
      />
    </svg>
  </div>
);

const ThemeToggle = ({ isDarkMode, setIsDarkMode }: { isDarkMode: boolean, setIsDarkMode: (v: boolean) => void }) => (
  <button 
    onClick={() => setIsDarkMode(!isDarkMode)}
    className="p-3 bg-surface dark:bg-slate-800 rounded-full shadow-soft border border-border-ui dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:scale-110 transition-all z-50"
  >
    {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
  </button>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: keyof typeof translations.en) => {
    return translations[language][key] || translations.en[key] || key;
  };
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [location, setLocation] = useState<[number, number]>([51.505, -0.09]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showMedEdit, setShowMedEdit] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', relation: '' });
  const [toast, setToast] = useState<string | null>(null);

  // --- Auth & Profile ---

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as UserProfile;
          setProfile(data);
          if (data.language) setLanguage(data.language);
        } else {
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName,
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL,
            role: 'user',
            status: 'safe',
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setIsAuthReady(true);
    });
    return unsubscribe;
  }, []);

  // --- Listeners ---

  useEffect(() => {
    if (!user) return;

    const incidentsQuery = query(
      collection(db, 'incidents'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(incidentsQuery, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Incident));
      setIncidents(docs);
      
      // Find active incident for current user
      const active = docs.find(inc => inc.reporterUid === user.uid && inc.status !== 'resolved');
      setActiveIncident(active || null);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'incidents');
    });

    return unsubscribe;
  }, [user]);

  // --- Geolocation ---

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setLocation([position.coords.latitude, position.coords.longitude]);
      });
    }
  }, []);

  // --- Theme Logic ---

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // --- Actions ---

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setCurrentScreen('home');
    } catch (error) {
      console.error("Login failed", error);
      showToast("Login failed. Please try again.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentScreen('splash');
  };

  const changeLanguage = async (newLang: Language) => {
    setLanguage(newLang);
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), { language: newLang });
        setProfile(prev => prev ? { ...prev, language: newLang } : null);
      } catch (error) {
        console.error("Failed to update language", error);
      }
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const reportIncident = async (type: string, severity: 'critical' | 'moderate' | 'low', phone?: string) => {
    if (!user) return;
    
    try {
      const newIncident: Omit<Incident, 'id'> = {
        type,
        description: "Emergency report via RapidReach",
        severity,
        status: 'reported',
        reporterUid: user.uid,
        location: {
          lat: location[0],
          lng: location[1],
          address: "Current Location"
        },
        createdAt: serverTimestamp() as Timestamp,
      };
      
      await addDoc(collection(db, 'incidents'), newIncident);
      showToast(t('alertSent'));
      
      if (phone) {
        window.location.href = `tel:${phone}`;
      }
      
      setCurrentScreen('track');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'incidents');
    }
  };

  const startVoiceSOS = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast(t('voiceNotSupported'));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      showToast(t('describeEmergency'));
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      showToast(`${t('analyzing')} "${transcript}"`);
      await processVoiceIntent(transcript);
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      showToast(t('voiceFailed'));
      console.error(event.error);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const processVoiceIntent = async (transcript: string) => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: transcript,
        config: {
          systemInstruction: `Analyze the user's emergency transcript. 
          Respond ONLY with a JSON object.
          Incident types: 'Medical', 'Fire', 'Security', 'Flood', 'Rescue', 'Accident'.
          Schema: {"isEmergency": boolean, "type": string, "severity": "critical"|"moderate"|"low", "confidence": number}`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isEmergency: { type: Type.BOOLEAN },
              type: { 
                type: Type.STRING,
                description: "One of: Medical, Fire, Security, Flood, Rescue, Accident"
              },
              severity: { 
                type: Type.STRING, 
                enum: ["critical", "moderate", "low"]
              },
              confidence: { type: Type.NUMBER }
            },
            required: ["isEmergency", "type", "severity", "confidence"]
          }
        }
      });

      const result = JSON.parse(response.text);
      if (result.isEmergency && result.confidence > 0.6) {
        showToast(`${t('aiDetected')} ${result.type} Emergency`);
        const helplineMap: Record<string, string> = {
          'Medical': '108',
          'Fire': '101',
          'Security': '100',
          'Flood': '100',
          'Rescue': '100',
          'Accident': '102'
        };
        await reportIncident(result.type, result.severity, helplineMap[result.type]);
      } else {
        showToast(t('intentUnclear'));
      }
    } catch (error) {
      console.error("Gemini Intent Analysis failed", error);
      showToast(t('aiUnavailable'));
    }
  };

  const updateMedicalProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), data);
      setProfile(prev => prev ? { ...prev, ...data } : null);
      showToast(t('profileSaved'));
      setShowMedEdit(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const addFamilyMember = async () => {
    if (!user || !newMember.name || !newMember.relation) return;
    try {
      const updatedMembers = [...(profile?.familyMembers || []), { ...newMember, status: 'safe' as const }];
      await updateDoc(doc(db, 'users', user.uid), { familyMembers: updatedMembers });
      setProfile(prev => prev ? { ...prev, familyMembers: updatedMembers } : null);
      showToast(t('memberAdded'));
      setShowAddMember(false);
      setNewMember({ name: '', relation: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  // --- UI Helpers ---

  const ScreenWrapper = ({ children, id }: { children: React.ReactNode, id: Screen }) => (
    <motion.div 
      key={id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex-1 overflow-y-auto bg-[var(--bg-app)] pb-24 relative"
    >
      {children}
    </motion.div>
  );

  if (!isAuthReady) return null;

  return (
    <ErrorBoundary>
      <div className={`flex flex-col h-screen max-w-md mx-auto bg-surface dark:bg-slate-900 shadow-lifted overflow-hidden relative ${isDarkMode ? 'dark' : ''}`}>
        
        {/* Status Bar Mock */}
        <div className="h-11 bg-surface dark:bg-slate-900 flex items-center justify-end px-6 border-b border-border-ui dark:border-slate-800 z-50">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-1 text-slate-400 hover:text-focus transition-colors">
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="flex gap-1.5">
              <div className="w-4 h-4 bg-slate-100 dark:bg-slate-800 rounded-sm" />
              <div className="w-4 h-4 bg-slate-100 dark:bg-slate-800 rounded-sm" />
              <div className="w-6 h-4 bg-slate-100 dark:bg-slate-800 rounded-sm" />
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {currentScreen === 'splash' && (
            <motion.div 
              key="splash"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col relative overflow-hidden bg-[var(--bg-app)]"
            >
              <WaveBackground color="var(--primary-app)" opacity={0.6} />
              <WaveBackground color="var(--accent-pink)" opacity={0.3} flip />
              
              <div className="flex-1 flex flex-col items-center justify-center p-8 relative z-10">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-24 h-24 bg-surface dark:bg-slate-800 rounded-ui flex items-center justify-center shadow-lifted mb-8 border border-border-ui dark:border-slate-700"
                >
                  <Shield className="w-12 h-12 text-focus" />
                </motion.div>
                
                <h1 className="text-4xl font-black text-focus tracking-tighter mb-2 uppercase">
                  RapidReach
                </h1>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-12">{t('tagline')}</p>
                
                <div className="w-full max-w-xs space-y-4">
                  <button 
                    onClick={handleLogin}
                    className="w-full py-5 bg-surface dark:bg-slate-800 border border-border-ui dark:border-slate-700 rounded-ui shadow-soft flex items-center px-8 gap-4 hover:scale-[1.02] transition-all group"
                  >
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-focus group-hover:bg-primary group-hover:text-slate-800 transition-colors">
                      <User size={20} />
                    </div>
                    <span className="text-sm font-bold dark:text-white uppercase tracking-widest">{t('signInWithGoogle')}</span>
                  </button>
                </div>
              </div>

              <div className="p-8 text-center relative z-10">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                  By continuing, you agree to our <br/>
                  <span className="text-focus underline">Terms of Service</span> & <span className="text-focus underline">Privacy Policy</span>
                </p>
              </div>
            </motion.div>
          )}

          {currentScreen === 'home' && (
            <ScreenWrapper id="home">
              <div className="relative h-48 overflow-hidden">
                <WaveBackground color="var(--primary-app)" opacity={0.8} />
                <div className="absolute inset-0 flex items-center justify-between px-6 z-10">
                  <div>
                    <h2 className="text-2xl font-black text-focus tracking-tighter uppercase">
                      RapidReach
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest">System Active</span>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-surface dark:bg-slate-800 rounded-full shadow-lifted flex items-center justify-center border border-border-ui dark:border-slate-700">
                    <MapPin size={20} className="text-focus" />
                  </div>
                </div>
              </div>

              <div className="px-6 -mt-12 relative z-10 space-y-6">
                <div className="p-5 bg-surface dark:bg-slate-800 rounded-ui border border-border-ui dark:border-slate-700 shadow-soft flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('currentLocation')}</p>
                    <p className="text-sm font-bold dark:text-white tracking-tight">
                      {location[0].toFixed(4)}, {location[1].toFixed(4)}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-[var(--bg-app)] dark:bg-slate-900 rounded-ui flex items-center justify-center text-slate-400 shadow-inner">
                    <ChevronRight size={20} />
                  </div>
                </div>

                <motion.div 
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsConnecting(true)}
                  className="aspect-square bg-surface dark:bg-slate-800 rounded-full flex items-center justify-center relative shadow-lifted border-8 border-[var(--bg-app)] dark:border-slate-900 mx-auto w-64"
                >
                  <div className="absolute inset-4 rounded-full border-2 border-red-600/20 sos-pulse" />
                  <div className="absolute inset-8 rounded-full border border-red-600/10 sos-pulse" style={{ animationDelay: '0.5s' }} />
                  
                  <div className="flex flex-col items-center">
                    <div className="w-32 h-32 bg-red-600 rounded-full flex items-center justify-center shadow-soft mb-4">
                      <Shield size={48} className="text-white" />
                    </div>
                    <span className="text-xl font-black text-red-600 dark:text-red-500 tracking-widest uppercase">{t('sos')}</span>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">{t('holdToActivate')}</p>
                  </div>
                </motion.div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={startVoiceSOS} 
                    className={`py-4 bg-surface dark:bg-slate-800 border-2 rounded-ui shadow-soft flex flex-col items-center gap-2 hover:scale-[1.02] transition-all relative overflow-hidden ${isListening ? 'border-primary animate-pulse' : 'border-border-ui dark:border-slate-700'}`}
                  >
                    {isListening && <div className="absolute inset-0 bg-primary/10 animate-pulse pointer-events-none" />}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isListening ? 'bg-primary text-slate-800 scale-110 shadow-lifted' : 'bg-accent-orange/20 text-orange-400'}`}>
                      {isListening ? <Mic size={18} className="animate-bounce" /> : <Wind size={18} />}
                    </div>
                    <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                      {isListening ? t('listening') : t('voiceSos')}
                    </span>
                  </button>
                  <button onClick={() => setCurrentScreen('report')} className="py-4 bg-surface dark:bg-slate-800 border border-border-ui dark:border-slate-700 rounded-ui shadow-soft flex flex-col items-center gap-2 hover:scale-[1.02] transition-all">
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-focus">
                      <Activity size={18} />
                    </div>
                    <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest">{t('report')}</span>
                  </button>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('quickActions')}</p>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { icon: <Activity className="text-focus" />, title: t('reportIncident'), desc: t('oneTapAlert'), screen: 'report' },
                      { icon: <MapPin className="text-focus" />, title: t('trackResponder'), desc: activeIncident ? t('activeCase') : t('noActive'), screen: 'track' },
                      { icon: <Heart className="text-red-400" />, title: "Medical ID", desc: "Blood · Allergies", screen: 'profile' },
                      { icon: <MapIcon className="text-blue-400" />, title: "Safe Route", desc: "Danger heatmap", screen: 'community' }
                    ].map((item, i) => (
                      <button 
                        key={i} 
                        onClick={() => setCurrentScreen(item.screen as Screen)}
                        className="p-5 bg-surface dark:bg-slate-800 border border-border-ui dark:border-slate-700 rounded-ui shadow-soft text-left hover:scale-[1.02] transition-all group"
                      >
                        <div className="w-10 h-10 bg-[var(--bg-app)] dark:bg-slate-900 rounded-ui flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                          {item.icon}
                        </div>
                        <p className="text-xs font-bold dark:text-white uppercase tracking-widest mb-1">{item.title}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-surface dark:bg-slate-800 rounded-ui border border-border-ui dark:border-slate-700 overflow-hidden shadow-soft">
                  <div className="h-40 relative bg-[var(--bg-app)] dark:bg-slate-900">
                    <MapContainer key="home-map" center={location} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <Circle center={location} radius={1000} pathOptions={{ color: 'var(--primary-app)', fillColor: 'var(--primary-app)', fillOpacity: 0.1 }} />
                      <MapUpdater center={location} />
                    </MapContainer>
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-focus via-transparent to-transparent pointer-events-none" />
                    <div className="absolute top-4 left-4 px-3 py-1.5 bg-surface/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-ui text-[10px] font-bold text-focus flex items-center gap-2 border border-border-ui dark:border-slate-700 shadow-soft">
                      <div className="w-2 h-2 bg-focus rounded-full live-blink" /> LIVE DANGER HEATMAP
                    </div>
                  </div>
                  <div className="p-4 flex items-center gap-6 border-t border-border-ui dark:border-slate-700">
                    <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                      <div className="w-2.5 h-2.5 bg-focus rounded-full" /> High Risk
                    </div>
                    <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                      <div className="w-2.5 h-2.5 bg-blue-200 rounded-full" /> Caution
                    </div>
                    <div className="ml-auto text-[9px] text-slate-400 uppercase tracking-widest">Updated 2 min ago</div>
                  </div>
                </div>
              </div>
            </ScreenWrapper>
          )}

          {currentScreen === 'report' && (
            <ScreenWrapper id="report">
              <header className="h-16 px-6 flex items-center justify-between bg-surface dark:bg-slate-900 border-b border-border-ui dark:border-slate-800 sticky top-0 z-10">
                <div className="font-display text-xl font-bold tracking-tight text-focus">RapidReach</div>
                <div className="px-3 py-1 bg-primary/20 text-focus text-[10px] font-bold rounded-ui border border-primary/30 uppercase tracking-widest">Emergency Report</div>
              </header>

              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Incident Type</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { icon: <Stethoscope />, label: "Medical", phone: "108" },
                      { icon: <Flame />, label: "Fire", phone: "101" },
                      { icon: <ShieldAlert />, label: "Security", phone: "100" },
                      { icon: <Waves />, label: "Flood", phone: "100" },
                      { icon: <Wind />, label: "Rescue", phone: "100" },
                      { icon: <Car />, label: "Accident", phone: "102" }
                    ].map((item, i) => (
                      <button 
                        key={i}
                        onClick={() => reportIncident(item.label, 'moderate', item.phone)}
                        className="p-5 bg-surface dark:bg-slate-800 border border-border-ui dark:border-slate-700 rounded-ui flex flex-col items-center gap-3 hover:border-focus transition-all shadow-soft group"
                      >
                        <div className="text-slate-400 group-hover:text-focus transition-colors">{item.icon}</div>
                        <span className="text-[10px] font-bold dark:text-white uppercase tracking-tight">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-primary/10 border border-primary/20 dark:bg-slate-800 dark:border-slate-700 rounded-ui flex items-center gap-4 shadow-soft">
                    <MapPin className="text-focus" size={20} />
                    <div>
                      <p className="text-[10px] font-bold text-focus uppercase tracking-widest">Location Auto-Detected</p>
                      <p className="text-[9px] text-slate-400 uppercase tracking-widest">GPS locked · High accuracy</p>
                    </div>
                  </div>
                  <div className="h-40 rounded-ui overflow-hidden border border-border-ui dark:border-slate-700 relative shadow-soft">
                    <MapContainer key="report-map" center={location} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <Marker position={location} />
                      <MapUpdater center={location} />
                    </MapContainer>
                  </div>
                </div>

                <button 
                  onClick={() => reportIncident("General Emergency", "critical")}
                  className="w-full py-5 bg-primary text-slate-800 rounded-ui font-bold shadow-lifted flex items-center justify-center gap-3 text-sm uppercase tracking-widest hover:scale-[0.98] transition-all"
                >
                  <AlertCircle size={20} /> Send Emergency Alert
                </button>
              </div>
            </ScreenWrapper>
          )}

          {currentScreen === 'track' && (
            <ScreenWrapper id="track">
              <header className="h-16 px-6 flex items-center justify-between bg-surface dark:bg-slate-900 border-b border-border-ui dark:border-slate-800 sticky top-0 z-10">
                <div className="font-display text-xl font-bold tracking-tight text-focus">RapidReach</div>
                <div className="px-3 py-1 bg-[#F8F9FA] dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded-ui border border-border-ui dark:border-slate-700 uppercase tracking-widest">Live Tracking</div>
              </header>

              <div className="p-6 space-y-6">
                {activeIncident ? (
                  <div className="bg-surface dark:bg-slate-800 rounded-ui border border-border-ui dark:border-slate-700 overflow-hidden shadow-soft">
                    <div className="h-48 relative">
                      <MapContainer key="track-map" center={location} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Marker position={location} />
                        <Circle center={location} radius={200} pathOptions={{ color: '#00CFCC' }} />
                        <MapUpdater center={location} />
                      </MapContainer>
                      <div className="absolute top-4 left-4 px-3 py-1.5 bg-surface/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-ui text-[10px] font-bold text-slate-900 dark:text-white flex items-center gap-2 border border-border-ui dark:border-slate-700 shadow-soft">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> LIVE SIGNAL STREAM
                      </div>
                    </div>
                    <div className="p-5 space-y-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-bold dark:text-white">
                            {activeIncident.status === 'dispatched' ? 'Responder Assigned' : 'Finding Responder...'}
                          </p>
                          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                            {activeIncident.status === 'dispatched' ? 'Volunteer En Route' : 'System Searching'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-black text-focus">--:--</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Est. Arrival</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button className="flex-1 py-3 bg-primary text-slate-800 rounded-ui text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-lifted">
                          <MessageSquare size={16} /> Message
                        </button>
                        <button className="flex-1 py-3 bg-[#F8F9FA] dark:bg-slate-900 border border-border-ui dark:border-slate-700 rounded-ui text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 dark:text-white shadow-inner">
                          <Phone size={16} /> Call
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-12 text-center space-y-5">
                    <div className="w-20 h-20 bg-[#F8F9FA] dark:bg-slate-800 rounded-ui flex items-center justify-center mx-auto text-slate-300 shadow-inner">
                      <Activity size={36} />
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No active tracking</p>
                    <button onClick={() => setCurrentScreen('report')} className="text-focus text-[11px] font-bold uppercase tracking-widest underline decoration-2 underline-offset-4">Report an incident</button>
                  </div>
                )}

                {activeIncident && (
                  <div className="bg-surface dark:bg-slate-800 rounded-ui border border-border-ui dark:border-slate-700 overflow-hidden shadow-soft">
                    <div className="p-4 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Case Tracking</p>
                        <p className="text-[11px] font-mono text-slate-500">ID: {activeIncident.id?.slice(0, 8).toUpperCase() || 'PENDING'}</p>
                      </div>
                      <div className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 text-[10px] font-bold rounded-ui border border-emerald-100 uppercase tracking-widest">
                        {activeIncident.status.toUpperCase()}
                      </div>
                    </div>
                    <div className="p-5 space-y-6">
                      {[
                        { title: "Alert Received", time: activeIncident.createdAt?.toDate().toLocaleTimeString() || "Just now", status: 'done' },
                        { title: "Responder Dispatched", time: activeIncident.status === 'dispatched' ? "Assigned" : "Pending", status: activeIncident.status === 'dispatched' ? 'done' : 'pending' },
                        { title: "En Route to Location", time: activeIncident.status === 'dispatched' ? "Tracking" : "Waiting", status: activeIncident.status === 'dispatched' ? 'active' : 'pending' },
                        { title: "Arrived On Scene", time: "Pending", status: 'pending' }
                      ].map((step, i) => (
                        <div key={i} className="flex gap-5 relative">
                          {i !== 3 && <div className="absolute left-[11px] top-6 bottom-[-28px] w-px bg-slate-100 dark:bg-slate-700" />}
                          <div className={`w-6 h-6 rounded-ui flex items-center justify-center text-[10px] z-10 border shadow-soft ${
                            step.status === 'done' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 
                            step.status === 'active' ? 'bg-primary/20 border-primary/30 text-focus animate-pulse' : 
                            'bg-[#F8F9FA] border-border-ui text-slate-300'
                          }`}>
                            {step.status === 'done' ? '✓' : step.status === 'active' ? '⟳' : '○'}
                          </div>
                          <div>
                            <p className="text-sm font-bold dark:text-white tracking-tight">{step.title}</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">{step.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScreenWrapper>
          )}

          {currentScreen === 'community' && (
            <ScreenWrapper id="community">
              <header className="h-16 px-6 flex items-center justify-between bg-surface dark:bg-slate-900 border-b border-border-ui dark:border-slate-800 sticky top-0 z-10">
                <div className="font-display text-xl font-bold tracking-tight text-focus">RapidReach</div>
                <div className="px-3 py-1 bg-primary/20 text-focus text-[10px] font-bold rounded-ui border border-primary/30 uppercase tracking-widest">Community</div>
              </header>

              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Safe Route Navigator</p>
                  <div className="bg-surface dark:bg-slate-800 rounded-ui border border-border-ui dark:border-slate-700 overflow-hidden shadow-soft">
                    <div className="h-44 bg-[#F8F9FA] dark:bg-slate-900 relative">
                      <MapContainer key="community-map" center={location} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Circle center={location} radius={500} pathOptions={{ color: '#10b981', fillColor: '#10b981' }} />
                        <MapUpdater center={location} />
                      </MapContainer>
                      <div className="absolute top-4 left-4 px-3 py-1.5 bg-surface/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-ui text-[10px] font-bold text-emerald-600 flex items-center gap-2 border border-border-ui dark:border-slate-700 shadow-soft">
                        <MapIcon size={14} /> SAFE ROUTE ACTIVE
                      </div>
                    </div>
                    <div className="p-5 space-y-5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold dark:text-white uppercase tracking-tight">Recommended Safe Path</p>
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[9px] font-bold rounded-ui border border-emerald-100 uppercase tracking-widest">LOW RISK</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { val: "Real-time", label: "Analysis" },
                          { val: "Live", label: "Heatmap" }
                        ].map((stat, i) => (
                          <div key={i} className="p-3 bg-[#F8F9FA] dark:bg-slate-900 border border-border-ui dark:border-slate-700 rounded-ui text-center shadow-inner">
                            <p className="text-xs font-black dark:text-white">{stat.val}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1">{stat.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Community Network</p>
                  <div className="p-8 bg-surface dark:bg-slate-800 border border-border-ui dark:border-slate-700 rounded-ui text-center space-y-4 shadow-soft">
                    <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto text-focus">
                      <Users size={32} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold dark:text-white uppercase tracking-tight">Network Scanning</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest">Connecting to local volunteer grid...</p>
                    </div>
                  </div>
                </div>
              </div>
            </ScreenWrapper>
          )}

          {currentScreen === 'profile' && (
            <ScreenWrapper id="profile">
              <header className="h-16 px-6 flex items-center justify-between bg-surface dark:bg-slate-900 border-b border-border-ui dark:border-slate-800 sticky top-0 z-10">
                <div className="font-display text-xl font-bold tracking-tight text-focus">RapidReach</div>
                <div className="flex items-center gap-3">
                  <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-focus transition-colors">
                    <LogOut size={18} />
                  </button>
                  <div className="px-3 py-1 bg-[#F8F9FA] dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded-ui border border-border-ui dark:border-slate-700 uppercase tracking-widest">Profile</div>
                </div>
              </header>

              <div className="p-6 space-y-6">
                <div className="bg-surface dark:bg-slate-800 rounded-ui border border-border-ui dark:border-slate-700 overflow-hidden shadow-soft">
                  <div className="p-4 bg-[#F8F9FA] dark:bg-slate-900 border-b border-border-ui dark:border-slate-700 flex items-center justify-between">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('language')}</p>
                    <div className="flex bg-white dark:bg-slate-800 p-1 rounded-ui border border-border-ui dark:border-slate-700">
                      <button 
                        onClick={() => changeLanguage('en')}
                        className={`px-4 py-1 text-[10px] font-bold rounded-ui transition-all ${language === 'en' ? 'bg-primary text-slate-800 shadow-soft' : 'text-slate-400'}`}
                      >
                        EN
                      </button>
                      <button 
                        onClick={() => changeLanguage('hi')}
                        className={`px-4 py-1 text-[10px] font-bold rounded-ui transition-all ${language === 'hi' ? 'bg-primary text-slate-800 shadow-soft' : 'text-slate-400'}`}
                      >
                        हिन्दी
                      </button>
                    </div>
                  </div>
                  <div className="p-5 bg-primary/10 border-b border-border-ui dark:border-slate-800 flex items-center gap-5">
                    <div className="w-14 h-14 bg-surface dark:bg-slate-900 rounded-ui border border-border-ui dark:border-slate-700 flex items-center justify-center text-3xl shadow-soft">
                      🧑‍⚕️
                    </div>
                    <div className="flex-1">
                      <p className="text-lg font-bold dark:text-white tracking-tight">{profile?.displayName || "User"}</p>
                      <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-0.5">MED-ID: RR-{user?.uid.slice(0, 6).toUpperCase()}</p>
                    </div>
                    <div className="p-3 bg-surface border border-border-ui rounded-ui text-center min-w-[52px] shadow-soft">
                      <p className="text-xl font-black text-focus">{profile?.bloodType || "--"}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{t('bloodType')}</p>
                    </div>
                  </div>
                  <div className="p-5 space-y-5">
                    {[
                      { icon: "⚠️", label: t('allergies'), val: profile?.allergies || t('noneListed') },
                      { icon: "💊", label: t('medications'), val: profile?.medications || t('noneListed') },
                      { icon: "🫀", label: t('conditions'), val: profile?.conditions || t('noneListed') },
                      { icon: "📞", label: t('emergencyContact'), val: profile?.emergencyContact || t('noneListed') }
                    ].map((f, i) => (
                      <div key={i} className="flex gap-4">
                        <span className="text-xl">{f.icon}</span>
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{f.label}</p>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300 tracking-tight mt-0.5">{f.val}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={() => setShowMedEdit(true)}
                    className="w-full py-4 bg-[#F8F9FA] dark:bg-slate-900 border-t border-border-ui dark:border-slate-700 text-[11px] font-bold text-slate-500 hover:text-focus transition-colors uppercase tracking-widest shadow-inner"
                  >
                    ✏️ {t('editProfile')}
                  </button>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('familySafety')}</p>
                  <div className="p-6 bg-surface dark:bg-slate-800 border border-border-ui dark:border-slate-700 rounded-ui space-y-4 shadow-soft">
                    {profile?.familyMembers && profile.familyMembers.length > 0 ? (
                      <div className="space-y-3">
                        {profile.familyMembers.map((member, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-[#F8F9FA] dark:bg-slate-900 rounded-ui border border-border-ui dark:border-slate-700 shadow-inner">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-focus font-bold text-[10px]">
                                {member.name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-[11px] font-bold dark:text-white uppercase tracking-tight">{member.name}</p>
                                <p className="text-[8px] text-slate-400 uppercase tracking-widest">{member.relation}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 rounded-full">
                              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                              <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest">{t('safe')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center space-y-3">
                        <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto text-focus">
                          <Heart size={24} />
                        </div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest leading-relaxed">Add family members to track their safety status in real-time.</p>
                      </div>
                    )}
                    <button 
                      onClick={() => setShowAddMember(true)}
                      className="w-full text-focus text-[10px] font-bold uppercase tracking-widest border-b border-focus pb-1"
                    >
                      {t('addMember')}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('emergencyContacts')}</p>
                  <div className="bg-surface dark:bg-slate-800 rounded-ui border border-border-ui dark:border-slate-700 overflow-hidden shadow-soft">
                    {[
                      { icon: "🚔", name: "Police Control Room", sub: "Pan India Helpline", phone: "100" },
                      { icon: "🚑", name: "Medical Helpline", sub: "Pan India Helpline", phone: "108" },
                      { icon: "👩", name: "Women's Helpline", sub: "Pan India Helpline", phone: "181" },
                      { icon: "🚒", name: "Fire Service", sub: "Pan India Helpline", phone: "101" }
                    ].map((c, i) => (
                      <div key={i} className="p-4 flex items-center gap-4 border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-[#F8F9FA] transition-colors cursor-pointer group">
                        <div className="w-10 h-10 bg-[#F8F9FA] dark:bg-slate-900 rounded-ui flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform">
                          {c.icon}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold dark:text-white tracking-tight">{c.name}</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">{c.sub}</p>
                        </div>
                        <button 
                          onClick={() => window.location.href = `tel:${c.phone}`}
                          className="px-4 py-2 bg-primary text-slate-800 text-[10px] font-bold rounded-ui uppercase tracking-widest shadow-soft hover:scale-105 transition-transform"
                        >
                          Call
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScreenWrapper>
          )}
        </AnimatePresence>

        {/* Bottom Navigation */}
        {currentScreen !== 'splash' && (
          <nav className="h-20 bg-surface/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-border-ui dark:border-slate-800 flex items-center justify-around px-2 pb-4 absolute bottom-0 left-0 right-0 z-40 rounded-t-ui shadow-lifted">
            {[
              { id: 'home', icon: <Shield size={20} />, label: t('sos') },
              { id: 'report', icon: <Activity size={20} />, label: t('report') },
              { id: 'track', icon: <MapPin size={20} />, label: t('trackResponder') },
              { id: 'community', icon: <Users size={20} />, label: t('network') },
              { id: 'profile', icon: <User size={20} />, label: t('health') }
            ].map((item) => (
              <button 
                key={item.id}
                onClick={() => setCurrentScreen(item.id as Screen)}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-ui transition-all ${
                  currentScreen === item.id ? 'text-focus bg-primary/20 scale-110' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {item.icon}
                <span className="text-[8px] font-bold uppercase tracking-widest">{item.label}</span>
                {currentScreen === item.id && <motion.div layoutId="nav-dot" className="w-1 h-1 bg-focus rounded-full mt-0.5" />}
              </button>
            ))}
          </nav>
        )}

        {/* Overlays */}
        <AnimatePresence>
          {isConnecting && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-8"
              onClick={() => setIsConnecting(false)}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-surface dark:bg-slate-800 rounded-ui p-8 w-full max-w-xs text-center space-y-6 border border-border-ui dark:border-slate-700 shadow-lifted"
                onClick={e => e.stopPropagation()}
              >
                <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto relative shadow-lifted">
                  <div className="absolute inset-0 border-4 border-red-600 rounded-full animate-ping opacity-20" />
                  <Shield className="w-10 h-10 text-white" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">{t('connectingHelp')}</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed uppercase tracking-widest">{t('broadcasting')}</p>
                </div>
                <button 
                  onClick={() => setIsConnecting(false)}
                  className="w-full py-4 bg-[#F8F9FA] dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-ui text-[10px] font-bold uppercase tracking-widest shadow-inner"
                >
                  {t('cancelRequest')}
                </button>
              </motion.div>
            </motion.div>
          )}

          {showMedEdit && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end justify-center"
              onClick={() => setShowMedEdit(false)}
            >
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                className="bg-surface dark:bg-slate-800 rounded-t-ui p-8 w-full max-w-md space-y-6 max-h-[90vh] overflow-y-auto border-t border-border-ui dark:border-slate-700 shadow-lifted"
                onClick={e => e.stopPropagation()}
              >
                <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto" />
                <h3 className="font-display text-xl font-bold tracking-tight text-center dark:text-white uppercase">{t('medicalProfile')}</h3>
                
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('bloodType')}</p>
                    <input 
                      defaultValue={profile?.bloodType}
                      onChange={(e) => setProfile(prev => prev ? { ...prev, bloodType: e.target.value } : null)}
                      className="w-full p-4 bg-[#F8F9FA] dark:bg-slate-900 border border-border-ui dark:border-slate-700 rounded-ui text-xs dark:text-white outline-none focus:border-focus shadow-inner"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('emergencyContact')}</p>
                    <input 
                      defaultValue={profile?.emergencyContact}
                      onChange={(e) => setProfile(prev => prev ? { ...prev, emergencyContact: e.target.value } : null)}
                      className="w-full p-4 bg-[#F8F9FA] dark:bg-slate-900 border border-border-ui dark:border-slate-700 rounded-ui text-xs dark:text-white outline-none focus:border-focus shadow-inner"
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('allergies')}</p>
                    <input 
                      defaultValue={profile?.allergies}
                      onChange={(e) => setProfile(prev => prev ? { ...prev, allergies: e.target.value } : null)}
                      className="w-full p-4 bg-[#F8F9FA] dark:bg-slate-900 border border-border-ui dark:border-slate-700 rounded-ui text-xs dark:text-white outline-none focus:border-focus shadow-inner"
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('medications')}</p>
                    <input 
                      defaultValue={profile?.medications}
                      onChange={(e) => setProfile(prev => prev ? { ...prev, medications: e.target.value } : null)}
                      className="w-full p-4 bg-[#F8F9FA] dark:bg-slate-900 border border-border-ui dark:border-slate-700 rounded-ui text-xs dark:text-white outline-none focus:border-focus shadow-inner"
                    />
                  </div>
                </div>

                <button 
                  onClick={() => updateMedicalProfile(profile || {})}
                  className="w-full py-5 bg-primary text-slate-800 rounded-ui font-bold text-sm shadow-lifted uppercase tracking-widest"
                >
                  {t('saveProfile')}
                </button>
                <button onClick={() => setShowMedEdit(false)} className="w-full text-[10px] font-bold text-slate-400 text-center uppercase tracking-widest">{t('cancel')}</button>
              </motion.div>
            </motion.div>
          )}

          {showAddMember && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end justify-center"
              onClick={() => setShowAddMember(false)}
            >
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                className="bg-surface dark:bg-slate-800 rounded-t-ui p-8 w-full max-w-md space-y-6 border-t border-border-ui dark:border-slate-700 shadow-lifted"
                onClick={e => e.stopPropagation()}
              >
                <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto" />
                <h3 className="font-display text-xl font-bold tracking-tight text-center dark:text-white uppercase">{t('addFamilyMember')}</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('memberName')}</p>
                    <input 
                      value={newMember.name}
                      onChange={(e) => setNewMember(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full p-4 bg-[#F8F9FA] dark:bg-slate-900 border border-border-ui dark:border-slate-700 rounded-ui text-xs dark:text-white outline-none focus:border-focus shadow-inner"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('relation')}</p>
                    <input 
                      value={newMember.relation}
                      onChange={(e) => setNewMember(prev => ({ ...prev, relation: e.target.value }))}
                      placeholder="e.g. Father, Mother, Brother"
                      className="w-full p-4 bg-[#F8F9FA] dark:bg-slate-900 border border-border-ui dark:border-slate-700 rounded-ui text-xs dark:text-white outline-none focus:border-focus shadow-inner"
                    />
                  </div>
                </div>

                <button 
                  onClick={addFamilyMember}
                  className="w-full py-5 bg-primary text-slate-800 rounded-ui font-bold text-sm shadow-lifted uppercase tracking-widest"
                >
                  {t('addMember')}
                </button>
                <button onClick={() => setShowAddMember(false)} className="w-full text-[10px] font-bold text-slate-400 text-center uppercase tracking-widest">{t('cancel')}</button>
              </motion.div>
            </motion.div>
          )}

          {toast && (
            <motion.div 
              initial={{ opacity: 0, y: 50, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 50, x: '-50%' }}
              className="fixed bottom-24 left-1/2 bg-slate-900 text-white px-6 py-3 rounded-ui text-[10px] font-bold shadow-lifted z-[200] whitespace-nowrap border border-slate-700 uppercase tracking-widest"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </ErrorBoundary>
  );
}

