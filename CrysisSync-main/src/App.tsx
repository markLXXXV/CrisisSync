/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, ReactNode, ChangeEvent, useCallback, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import { useMap, MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { 
  auth, 
  googleProvider, 
  microsoftProvider, 
  appleProvider,
  requestNotificationPermission,
  onForegroundMessage
} from "./lib/firebase";
import { 
  signInWithPopup, 
  onAuthStateChanged, 
  User as FirebaseUser,
  signOut
} from "firebase/auth";
import { 
  Home as HomeIcon, 
  ShieldAlert, 
  MapPin, 
  User, 
  Settings, 
  Activity, 
  Wifi, 
  MessageSquare, 
  ChevronRight,
  LogOut,
  Camera,
  Upload,
  AlertCircle,
  Clock,
  Navigation,
  CheckCircle2,
  Trash2,
  X,
  Phone,
  Plus,
  Flame,
  Heart,
  ExternalLink,
  Building2,
  Landmark,
  Search,
  Filter,
  Calendar,
  Crosshair,
  Pill,
  Tent
} from "lucide-react";
import { cn, compressImage } from "./lib/utils";
import { Tab, Incident, UserProfile, SyncedContact, SafePoint, RouteInfo } from "./types";
import { PulseSOS } from "./components/PulseSOS";
import { 
  GLOBAL_EMERGENCY_CONTACTS, 
  SAFE_POINT_ICONS, 
  SAFE_POINT_COLORS 
} from "./constants";
import { 
  saveUserProfile, 
  getUserProfile, 
  triggerSOS, 
  cancelSOS, 
  subscribeToIncidents,
  saveChatMessage,
  getChatHistory,
  broadcastSafetyStatus,
  saveSyncedContacts,
  subscribeToContacts,
  fetchRealSafePoints,
  fetchRoute,
  addContact,
  deleteContact,
  updateContact
} from "./services/dataService";

// Screens will be imported or defined here
// For now let's define them in the same file or better separate them soon.

export default function App() {
  const { t } = useTranslation();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);
  const [showAIHelp, setShowAIHelp] = useState(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [contacts, setContacts] = useState<SyncedContact[]>([]);
  const [globalLocation, setGlobalLocation] = useState<[number, number]>([23.01, 88.48]);
  
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setGlobalLocation([pos.coords.latitude, pos.coords.longitude]);
      });
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToIncidents((realtimeIncidents) => {
      setIncidents(realtimeIncidents);
      // If any incident is active and it's ours, set isSOSActive
      const mine = realtimeIncidents.find(i => i.status === 'ACTIVATED');
      if (mine) setIsSOSActive(true);
      else setIsSOSActive(false);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToContacts(user.uid, (syncedContacts) => {
      setContacts(syncedContacts);
    });
    return () => unsubscribe();
  }, [user]);

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('notifications_enabled');
    if (saved === 'true') {
      setIsNotificationsEnabled(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('notifications_enabled', isNotificationsEnabled.toString());
  }, [isNotificationsEnabled]);

  useEffect(() => {
    if (isNotificationsEnabled) {
      const unsubscribe = onForegroundMessage((payload) => {
        console.log("Foreground message received:", payload);
        if (Notification.permission === 'granted') {
          new Notification(payload.notification?.title || "Tactical Alert", {
            body: payload.notification?.body || "Node synchronization complete."
          });
        }
      });
      return () => unsubscribe?.();
    }
  }, [isNotificationsEnabled]);

  const triggerTestNotification = () => {
    if (Notification.permission === "granted") {
      new Notification("Tactical Alert 🚨", {
        body: "Neural link relay operational. This is a system check."
      });
    } else {
      alert("Notifications are not granted. Please enable in settings.");
    }
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Handle permission prompt on first load
  const [showPermissions, setShowPermissions] = useState(true);
  const [showEmergency, setShowEmergency] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
  const [showMedical, setShowMedical] = useState(false);
  const [initialCategory, setInitialCategory] = useState('hospital');

  useEffect(() => {
    const handleOpenNodes = (e: any) => {
      setInitialCategory(e.detail?.category || 'hospital');
      setShowMedical(true);
    };
    window.addEventListener('open-tactical-nodes', handleOpenNodes);
    return () => window.removeEventListener('open-tactical-nodes', handleOpenNodes);
  }, []);

  const onSOS = useCallback(async (lat: number, lng: number) => {
    const id = await triggerSOS(lat, lng);
    if (id) {
      setActiveIncidentId(id);
      setIsSOSActive(true);
    }
  }, []);

  const onCancelSOS = useCallback(async () => {
    if (activeIncidentId) {
      await cancelSOS(activeIncidentId);
      setActiveIncidentId(null);
      setIsSOSActive(false);
    }
  }, [activeIncidentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-tactical-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-tactical-red/30 border-t-tactical-red rounded-full animate-spin" />
          <p className="text-[10px] font-black text-tactical-red uppercase tracking-[0.3em] animate-pulse">Syncing Protocols...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className={cn(
      "min-h-screen font-sans selection:bg-tactical-red selection:text-white pb-24 transition-colors duration-300",
      theme === 'dark' ? "bg-tactical-bg text-zinc-100" : "bg-zinc-50 text-zinc-900"
    )}>
      {/* Tactical SOS Banner */}
      <AnimatePresence>
        {isSOSActive && (
          <motion.div 
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            exit={{ y: -100 }}
            className="fixed top-0 left-0 right-0 z-[110] bg-tactical-red text-white py-3 px-6 flex items-center justify-between shadow-[0_4px_30px_rgba(255,0,0,0.4)]"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                <AlertCircle size={20} />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-tighter">SOS BROADCAST ACTIVE</h4>
                <p className="text-[8px] font-bold opacity-80 uppercase tracking-widest">Neural link relay established • High Priority</p>
              </div>
            </div>
            <button 
              onClick={onCancelSOS}
              className="px-4 py-1.5 bg-white text-tactical-red rounded-full text-[10px] font-black uppercase hover:bg-zinc-100 transition-colors"
            >
              Terminate Signal
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Permission Modal */}
      <AnimatePresence>
        {showPermissions && (
          <PermissionModal onApply={() => setShowPermissions(false)} />
        )}
      </AnimatePresence>

      <main className="max-w-xl mx-auto px-4 pt-6">
        <Header activeTab={activeTab} />
        
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <HomeScreen 
              center={globalLocation}
              onSOS={onSOS} 
              onCancelSOS={onCancelSOS}
              onOpenAI={() => setShowAIHelp(true)} 
              onOpenEmergency={() => setShowEmergency(true)}
              onOpenSafety={() => setShowSafety(true)}
              onOpenMedical={() => setShowMedical(true)}
            />
          )}
          {activeTab === 'incidents' && (
            <IncidentsScreen incidents={incidents} />
          )}
          {activeTab === 'routes' && (
            <RoutesScreen 
              contacts={contacts} 
              center={globalLocation} 
              setCenter={setGlobalLocation} 
            />
          )}
          {activeTab === 'profile' && (
            <ProfileScreen contacts={contacts} />
          )}
          {activeTab === 'system' && (
            <SystemScreen 
              theme={theme} 
              setTheme={setTheme} 
              isNotificationsEnabled={isNotificationsEnabled}
              setIsNotificationsEnabled={setIsNotificationsEnabled}
              onTestNotification={triggerTestNotification}
            />
          )}
        </AnimatePresence>
      </main>

      {/* AI Help Panel */}
      <AnimatePresence>
        {showAIHelp && (
          <AIHelpPanel onClose={() => setShowAIHelp(false)} />
        )}
      </AnimatePresence>

      {/* Emergency Overlays */}
      <AnimatePresence>
        {showEmergency && <EmergencyServicesModal onClose={() => setShowEmergency(false)} />}
        {showSafety && <SafetyCheckModal onClose={() => setShowSafety(false)} />}
        {showMedical && <TacticalNodesModal center={globalLocation} onClose={() => setShowMedical(false)} initialCategory={initialCategory} />}
      </AnimatePresence>
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 z-50 px-4 py-3 flex justify-between items-center max-w-xl mx-auto border-t",
        theme === 'dark' ? "bg-tactical-card/90 backdrop-blur-md border-tactical-border text-zinc-400" : "bg-white/90 backdrop-blur-md border-zinc-200 text-zinc-500"
      )}>
        <NavItem active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={HomeIcon} label={t('common.home')} />
        <NavItem active={activeTab === 'incidents'} onClick={() => setActiveTab('incidents')} icon={AlertCircle} label={t('common.incidents')} />
        <NavItem active={activeTab === 'routes'} onClick={() => setActiveTab('routes')} icon={Activity} label={t('common.routes')} />
        <NavItem active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={User} label={t('common.profile')} />
        <NavItem active={activeTab === 'system'} onClick={() => setActiveTab('system')} icon={Settings} label={t('common.system')} />
      </nav>
    </div>
  );
}

function LanguageSwitcher({ variant = 'default' }: { variant?: 'default' | 'quick' }) {
  const { i18n } = useTranslation();

  const languages = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'hi', label: 'Hindi', flag: '🇮🇳' },
    { code: 'bn', label: 'Bengali', flag: '🇧🇩' },
    { code: 'es', label: 'Spanish', flag: '🇪🇸' },
    { code: 'ja', label: '日本語', flag: '🇯🇵' },
    { code: 'zh-CN', label: '简体中文', flag: '🇨🇳' },
    { code: 'zh-TW', label: '繁體中文', flag: '🇹🇼' }
  ];

  const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

  if (variant === 'quick') {
    return (
      <div className="flex gap-2 items-center bg-black/40 backdrop-blur-md p-1.5 rounded-full border border-white/10">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={cn(
              "w-7 h-7 flex items-center justify-center rounded-full text-[10px] font-bold transition-all",
              i18n.language === lang.code ? "bg-white text-black" : "text-white/40 hover:text-white"
            )}
            title={lang.label}
          >
            {lang.code.toUpperCase().split('-')[0]}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => i18n.changeLanguage(lang.code)}
          className={cn(
            "flex items-center gap-3 p-3 rounded-2xl border transition-all text-left",
            i18n.language === lang.code 
              ? "bg-white text-black border-white" 
              : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700"
          )}
        >
          <span className="text-lg">{lang.flag}</span>
          <span className="text-xs font-black uppercase tracking-tight">{lang.label}</span>
          {i18n.language === lang.code && <div className="ml-auto w-1.5 h-1.5 bg-black rounded-full" />}
        </button>
      ))}
    </div>
  );
}

function NavItem({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-all duration-200",
        active ? "text-tactical-red" : "hover:text-zinc-300"
      )}
    >
      <Icon size={20} strokeWidth={active ? 2.5 : 2} />
      <span className="text-[10px] font-bold tracking-tighter uppercase">{label}</span>
      {active && <motion.div layoutId="nav-pill" className="w-1 h-1 bg-tactical-red rounded-full mt-0.5" />}
    </button>
  );
}

function Header({ activeTab }: { activeTab: Tab }) {
  return (
    <header className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-tactical-red/10 border border-tactical-red/30 flex items-center justify-center rounded-lg">
          <ShieldAlert className="text-tactical-red" size={24} />
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tighter leading-none flex items-center gap-1">
            CRISIS<span className="text-tactical-red">SYNC</span>
          </h1>
          <p className="text-[8px] font-bold text-tactical-red tracking-[0.2em] uppercase">Tactical Response Mode</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 px-2 py-1 bg-tactical-red/10 rounded-full border border-tactical-red/20">
          <div className="w-1.5 h-1.5 bg-tactical-red rounded-full animate-pulse" />
          <span className="text-[9px] font-black text-tactical-red uppercase tracking-wider">Live</span>
        </div>
        {activeTab === 'profile' && (
           <button 
             onClick={() => signOut(auth)}
             className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
           >
             <LogOut size={16} className="text-tactical-red" />
           </button>
        )}
      </div>
    </header>
  );
}

// ----------------- SCREENS -----------------

function LoginScreen() {
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [loadingLocal, setLoadingLocal] = useState(true);

  useEffect(() => {
    // Standard fast app load simulation
    const timer = setTimeout(() => {
      setLoadingLocal(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = async (provider: any) => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Authentication failed:", error);
      if (error.code === 'auth/operation-not-allowed') {
        alert("This authentication provider is not yet enabled in the Firebase Console. Only Google Login is configured by default.");
      } else {
        alert(`Authentication Error: ${error.message}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-tactical-bg text-white flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Quick Language Switcher at top for accessibility */}
      <div className="absolute top-6 right-6 z-50">
        <LanguageSwitcher variant="quick" />
      </div>

      {/* Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-tactical-red/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] bg-blue-500/10 blur-[120px] rounded-full" />
      </div>

      <AnimatePresence mode="wait">
        {loadingLocal ? (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-6"
          >
            <div className="w-20 h-20 bg-tactical-red/10 border border-tactical-red/50 flex items-center justify-center rounded-3xl relative">
               <ShieldAlert size={40} className="text-tactical-red" />
               <motion.div 
                 animate={{ scale: [1, 1.4], opacity: [0.3, 0] }}
                 transition={{ repeat: Infinity, duration: 1.5 }}
                 className="absolute inset-0 border-2 border-tactical-red rounded-3xl"
               />
            </div>
            <div className="text-center">
              <h1 className="text-4xl font-black tracking-tighter mb-1 select-none">CRISIS<span className="text-tactical-red">SYNC</span></h1>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] opacity-80">{t('common.syncing')}</p>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="auth"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm flex flex-col items-center z-10"
          >
            <div className="text-center mb-10">
              <h1 className="text-3xl font-black tracking-tighter mb-3 uppercase">
                {isLogin ? t('common.welcome') : t('common.create_account')}
              </h1>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest max-w-[280px] mx-auto opacity-70">
                {isLogin 
                  ? t('common.access_dashboard')
                  : t('common.join_network')}
              </p>
            </div>

            <div className="w-full space-y-4">
               <AuthButton 
                 icon={<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" />} 
                 label={t('common.google')} 
                 onClick={() => handleLogin(googleProvider)}
               />
               <AuthButton 
                 icon={<div className="w-5 h-5 flex flex-wrap gap-0.5"><div className="w-[9px] h-[9px] bg-[#f25022]"/><div className="w-[9px] h-[9px] bg-[#7fba00]"/><div className="w-[9px] h-[9px] bg-[#00a4ef]"/><div className="w-[9px] h-[9px] bg-[#ffb900]"/></div>} 
                 label={t('common.microsoft')} 
                 onClick={() => handleLogin(microsoftProvider)}
               />
               <AuthButton 
                 icon={<div className="bg-white rounded-full p-0.5"><img src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" className="w-4 h-4" /></div>} 
                 label={t('common.apple')} 
                 onClick={() => handleLogin(appleProvider)}
               />
            </div>

            <div className="mt-8 flex items-center gap-3 w-full opacity-30">
               <div className="flex-1 h-[1px] bg-white" />
               <span className="text-[8px] font-black uppercase">{t('common.or')}</span>
               <div className="flex-1 h-[1px] bg-white" />
            </div>

            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="mt-6 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors underline underline-offset-8"
            >
              {isLogin ? t('common.need_account') : t('common.have_account')}
            </button>

            <p className="mt-12 text-[7px] font-bold text-zinc-600 uppercase tracking-widest text-center max-w-[240px] opacity-50">
              {t('common.disclaimer')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AuthButton({ icon, label, onClick }: { icon: ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center gap-4 bg-zinc-900 border border-tactical-border p-4 rounded-2xl hover:bg-zinc-800 hover:border-zinc-700 transition-all group active:scale-[0.98]"
    >
      <div className="flex-none transition-transform group-hover:scale-110">
        {icon}
      </div>
      <span className="flex-1 text-left text-xs font-black uppercase tracking-widest text-zinc-300">{label}</span>
      <ChevronRight size={16} className="text-zinc-600 group-hover:text-white transition-colors" />
    </button>
  );
}

function HomeScreen({ center, onSOS, onCancelSOS, onOpenAI, onOpenEmergency, onOpenSafety, onOpenMedical }: { 
  center: [number, number],
  onSOS: (lat: number, lng: number) => void, 
  onCancelSOS: () => void, 
  onOpenAI: () => void,
  onOpenEmergency: () => void,
  onOpenSafety: () => void,
  onOpenMedical: () => void
}) {
  const { t } = useTranslation();
  const [tracking, setTracking] = useState(true);
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [isAlerting, setIsAlerting] = useState(false);
  const vibrationIntervalRef = useRef<any>(null);

  // User Implementation: Global Audio Sentinel
  const alertSoundRef = useRef<HTMLAudioElement>(new Audio("/alert.mp3"));

  useEffect(() => {
    // SOS VIBRATION LOOP PROTOCOL
    if (isAlerting) {
      if (navigator.vibrate) {
        // Prevent redundant loops
        if (!vibrationIntervalRef.current) {
          vibrationIntervalRef.current = setInterval(() => {
            navigator.vibrate(800); // Pulse for 0.8s
          }, 900); // 100ms gap for stability
          // Initial immediate pulse
          navigator.vibrate(800);
        }
      }
    } else {
      // TERMINATE VIBRATION SIGNAL
      if (vibrationIntervalRef.current) {
        clearInterval(vibrationIntervalRef.current);
        vibrationIntervalRef.current = null;
      }
      if (navigator.vibrate) {
        navigator.vibrate(0); // Force immediate hardware halt
      }
    }

    return () => {
      if (vibrationIntervalRef.current) {
        clearInterval(vibrationIntervalRef.current);
      }
    };
  }, [isAlerting]);

  useEffect(() => {
    const alertSound = alertSoundRef.current;
    alertSound.preload = "auto";

    const unlockAudio = () => {
      alertSound.play()
        .then(() => {
          alertSound.pause();
          alertSound.currentTime = 0;
        })
        .catch(() => {});
    };

    document.addEventListener("click", unlockAudio, { once: true });

    return () => {
      document.removeEventListener("click", unlockAudio);
    };
  }, []);

  useEffect(() => {
    let interval: any;
    if (holding && !isAlerting) {
      interval = setInterval(() => {
        setHoldProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 5;
        });
      }, 100);
    } else {
      setHoldProgress(0);
    }
    return () => clearInterval(interval);
  }, [holding, isAlerting]);

  useEffect(() => {
    if (holdProgress === 100 && !isAlerting) {
      setIsAlerting(true);
      
      const alertSound = alertSoundRef.current;

      // sound
      alertSound.currentTime = 0;
      alertSound.play().catch(err => console.log("Sound error:", err));

      // Trigger SOS with actual center coordinates
      const timer = setTimeout(() => {
        onSOS(center[0], center[1]);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [holdProgress, isAlerting, onSOS, center]);

  const handleHoldStart = () => {
    setHolding(true);
  };

  const handleSOSClick = () => {
    if (isAlerting) {
      setIsAlerting(false);
      setHoldProgress(0);
      // SILENCE MISSION ALERTS on manual override
      if (alertSoundRef.current) {
        alertSoundRef.current.pause();
        alertSoundRef.current.currentTime = 0;
      }
      onCancelSOS();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8 pb-12"
    >
      <section className="flex justify-between items-start">
        <div>
          <h2 className="text-4xl font-black tracking-tighter mb-2">{t('common.home')}</h2>
          <p className="text-xs text-zinc-500 font-medium leading-relaxed max-w-[200px]">
            {t('common.access_dashboard')}
          </p>
        </div>
        <LanguageSwitcher variant="quick" />
      </section>

      <div className="grid grid-cols-2 gap-4">
        {/* ... (Tracking and Latency cards remain same) */}
        <div className="bg-tactical-card border border-tactical-border p-4 rounded-2xl relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Live<br/>Tracking</span>
            <div 
              onClick={() => setTracking(!tracking)}
              className={cn(
                "w-10 h-5 rounded-full p-0.5 cursor-pointer transition-colors duration-200",
                tracking ? "bg-tactical-green" : "bg-zinc-800"
              )}
            >
              <div className={cn(
                "w-4 h-4 bg-white rounded-full transition-transform duration-200",
                tracking ? "translate-x-5" : "translate-x-0"
              )} />
            </div>
          </div>
          <span className={cn(
            "text-[10px] font-black uppercase tracking-widest",
            tracking ? "text-tactical-green" : "text-zinc-600"
          )}>
            {tracking ? "Enabled" : "Disabled"}
          </span>
        </div>

        <div className="bg-tactical-card border border-tactical-border p-4 rounded-2xl">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Signal Strength<br/>& Latency</span>
            <Wifi size={16} className="text-tactical-green" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
               <span className="text-[10px] font-black text-tactical-green uppercase tracking-widest">Optimal / 99ms</span>
            </div>
            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Latency</span>
          </div>
        </div>
      </div>

      {/* SOS Button Area */}
      <PulseSOS 
        isAlerting={isAlerting}
        holdProgress={holdProgress}
        holding={holding}
        onClick={handleSOSClick}
        onHoldStart={handleHoldStart}
        onHoldEnd={() => setHolding(false)}
      />

      {/* SOS Signal Transmitted Card (Video 00:20) */}
      <AnimatePresence>
        {holdProgress === 100 && (
          <motion.div 
             initial={{ opacity: 0, scale: 0.9, y: 20 }}
             animate={{ opacity: 1, scale: 1, y: 0 }}
             className="bg-tactical-card border-2 border-tactical-red rounded-[32px] p-6 relative overflow-hidden"
          >
             <div className="absolute top-0 right-0 p-4">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-tactical-red/20 rounded-full border border-tactical-red/30">
                   <div className="w-1.5 h-1.5 bg-tactical-red rounded-full animate-pulse" />
                   <span className="text-[8px] font-black text-tactical-red uppercase">{t('emergency.active')}</span>
                </div>
             </div>
             
             <div className="flex gap-6 items-center">
                <div className="w-24 h-24 border-4 border-tactical-red rounded-2xl flex items-center justify-center bg-tactical-red/10 rotate-45">
                   <AlertCircle size={40} className="text-tactical-red -rotate-45" />
                </div>
                <div className="flex-1">
                   <h3 className="text-2xl font-black tracking-tighter uppercase mb-1">{t('emergency.signal_transmitted')}</h3>
                   <p className="text-[10px] text-zinc-400 font-bold uppercase leading-tight">
                      {t('emergency.responders_notified')}
                   </p>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-3 mt-6">
                <div className="flex items-center gap-3 p-3 bg-zinc-900 rounded-2xl border border-tactical-border">
                   <Activity size={16} className="text-yellow-400" />
                   <span className="text-[9px] font-black uppercase tracking-widest">{t('emergency.high_priority')}</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-zinc-900 rounded-2xl border border-tactical-border">
                   <MapPin size={16} className="text-blue-400" />
                   <span className="text-[9px] font-black uppercase tracking-widest">{t('emergency.gps_tracking')}</span>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="space-y-4">
         <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
               <Clock size={12} />
               {t('emergency.history')}
            </h3>
            <span className="text-[8px] font-bold text-zinc-700 uppercase tracking-widest">{t('emergency.latest')}</span>
         </div>
         <div className="bg-tactical-card border border-tactical-border rounded-3xl p-6 relative overflow-hidden group hover:border-tactical-red/30 transition-colors cursor-pointer">
            <div className="flex justify-between items-start mb-4">
               <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-tactical-red/10 border border-tactical-red/30 flex items-center justify-center">
                    <ShieldAlert size={14} className="text-tactical-red" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black tracking-tighter uppercase">{t('emergency.sos')}</h4>
                    <span className="text-[8px] font-black text-tactical-red px-1.5 py-0.5 bg-tactical-red/10 rounded uppercase">{t('emergency.active')}</span>
                  </div>
               </div>
               <div className="text-right">
                  <p className="text-[8px] font-black text-tactical-green uppercase mb-1">{t('emergency.activated')}</p>
                  <p className="text-[9px] font-bold text-zinc-500">19/04/2026, 12:49:35</p>
               </div>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-zinc-400 font-bold">
               <div className="flex items-center gap-1.5">
                  <MapPin size={10} strokeWidth={3} />
                  23.0103, 88.4869
               </div>
               <div className="w-1 h-1 bg-zinc-700 rounded-full" />
               <div className="flex items-center gap-1.5">
                  <Clock size={10} strokeWidth={3}/>
                  {t('emergency.duration')}: 5s
               </div>
            </div>
         </div>
      </section>

      <div className="space-y-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-4">
          <QuickAction icon={MessageSquare} label="AI HELP" sub="TACTICAL INTELLIGENCE LINE" color="yellow" onClick={onOpenAI} />
          <QuickAction icon={Navigation} label="EMERGENCY SERVICES" sub="GLOBAL SIGNAL NODES" color="blue" onClick={onOpenEmergency} />
          <QuickAction icon={ShieldAlert} label="SAFETY CHECK" sub="BROADCAST SAFE STATUS" color="green" onClick={onOpenSafety} />
          <QuickAction icon={Activity} label="NEARBY NODES" sub="HOSPITALS, POLICE, PHARMA" color="rose" onClick={onOpenMedical} />
        </div>
      </div>
    </motion.div>
  );
}

function QuickAction({ icon: Icon, label, sub, color, onClick }: { icon: any, label: string, sub: string, color: string, onClick?: () => void }) {
  const colors: Record<string, string> = {
    yellow: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
    blue: "text-blue-400 border-blue-400/30 bg-blue-400/5",
    green: "text-tactical-green border-tactical-green/30 bg-tactical-green/5",
    rose: "text-tactical-red border-tactical-red/30 bg-tactical-red/5"
  };

  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-start p-4 rounded-2xl border text-left hover:scale-[1.02] transition-transform",
        colors[color] || "text-zinc-400 border-tactical-border bg-tactical-card"
      )}
    >
      <Icon size={24} className="mb-4" />
      <span className="text-xs font-black tracking-tight mb-0.5">{label}</span>
      <span className="text-[7px] font-bold opacity-60 tracking-widest leading-none">{sub}</span>
    </button>
  );
}

// ----------------- MODALS & PANELS -----------------

function EmergencyServicesModal({ onClose }: { onClose: () => void }) {
  const [activeRegion, setActiveRegion] = useState(GLOBAL_EMERGENCY_CONTACTS[0].region);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        className="w-full max-w-lg bg-tactical-card border border-tactical-border rounded-t-[40px] sm:rounded-[40px] overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="p-8 pb-4 flex justify-between items-center bg-tactical-card z-10">
           <div>
             <h2 className="text-2xl font-black tracking-tighter uppercase">Signal Nodes</h2>
             <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">International Emergency Network</p>
           </div>
           <button onClick={onClose} className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
              <X size={20} />
           </button>
        </div>

        {/* Region Selector */}
        <div className="px-8 pb-4 flex gap-2 overflow-x-auto scrollbar-hide">
          {GLOBAL_EMERGENCY_CONTACTS.map(reg => (
            <button 
              key={reg.region}
              onClick={() => setActiveRegion(reg.region)}
              className={cn(
                "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                activeRegion === reg.region ? "bg-white text-black" : "bg-zinc-900 text-zinc-500 border border-zinc-800"
              )}
            >
              {reg.region}
            </button>
          ))}
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-3">
           <button 
             onClick={() => {
               onClose();
               // We need a way to open the medical modal but with a specific category
               // I'll add a helper or just rely on the user clicking the high-level categories
               window.dispatchEvent(new CustomEvent('open-tactical-nodes', { detail: { category: 'police' } }));
             }}
             className="w-full p-4 bg-blue-500/10 border border-blue-500/30 rounded-3xl flex items-center justify-between hover:bg-blue-500/20 transition-all mb-4"
           >
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                    <ShieldAlert size={20} />
                 </div>
                 <div className="text-left">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-blue-400 leading-none mb-1">Detect Nearby Police</span>
                    <span className="block text-[8px] font-bold text-zinc-500 uppercase">Live Geolocation Sync</span>
                 </div>
              </div>
              <ChevronRight size={16} className="text-zinc-600" />
           </button>

           <button 
             onClick={() => {
               onClose();
               window.dispatchEvent(new CustomEvent('open-tactical-nodes', { detail: { category: 'pharmacy' } }));
             }}
             className="w-full p-4 bg-purple-500/10 border border-purple-500/30 rounded-3xl flex items-center justify-between hover:bg-purple-500/20 transition-all mb-6"
           >
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                    <Pill size={20} />
                 </div>
                 <div className="text-left">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-purple-400 leading-none mb-1">Detect Nearby Pharmacies</span>
                    <span className="block text-[8px] font-bold text-zinc-500 uppercase">Supply Node Discovery</span>
                 </div>
              </div>
              <ChevronRight size={16} className="text-zinc-600" />
           </button>

           <div className="h-px bg-tactical-border/50 my-4 mx-4" />
           <p className="px-4 text-[8px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-2">Regional Protocols</p>

           {GLOBAL_EMERGENCY_CONTACTS.find(r => r.region === activeRegion)?.contacts.map((svc, i) => (
             <a 
               key={i} 
               href={`tel:${svc.number}`}
               className="flex items-center gap-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-3xl hover:bg-zinc-800 transition-all group"
             >
                <div className={cn("w-12 h-12 rounded-2xl bg-black/40 border border-current flex items-center justify-center transition-transform group-hover:scale-110", svc.color)}>
                   <svc.icon size={24} />
                </div>
                <div className="flex-1">
                   <h4 className="text-sm font-black uppercase tracking-tight text-zinc-200">{svc.name}</h4>
                   <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{svc.sub}</p>
                </div>
                <div className="text-right">
                   <span className="block text-lg font-black text-white">{svc.number}</span>
                   <span className="block text-[8px] font-black text-tactical-green uppercase">TAP TO CONNECT</span>
                </div>
             </a>
           ))}
        </div>

        <div className="p-8 pt-4 bg-tactical-card border-t border-tactical-border/50">
           <p className="text-[11px] font-bold text-zinc-400 mb-4 bg-blue-500/10 p-4 border border-blue-500/20 rounded-2xl leading-relaxed">
             <span className="text-blue-400 font-extrabold mr-1">PROTOCOL ALPHA:</span> 
             112 is a global emergency standard that works on almost any mobile network worldwide, even without a SIM card or on locked phones.
           </p>
           <p className="text-[8px] font-bold text-zinc-600 uppercase text-center tracking-[0.1em] leading-relaxed">
             CrisisSync provides direct node synchronization. Misuse of emergency signals is subject to local jurisdiction protocols.
           </p>
        </div>
      </motion.div>
    </div>
  );
}

function SafetyCheckModal({ onClose }: { onClose: () => void }) {
  const [broadcasted, setBroadcasted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleBroadcast = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      await broadcastSafetyStatus(auth.currentUser.uid);
      setBroadcasted(true);
    } catch (error) {
      console.error("Safety broadcast failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-sm bg-tactical-card border border-tactical-border p-8 rounded-[40px] text-center"
      >
        <div className="w-20 h-20 bg-tactical-green/10 border-2 border-tactical-green/30 rounded-3xl flex items-center justify-center mx-auto mb-6">
           {broadcasted ? <CheckCircle2 size={40} className="text-tactical-green" /> : <ShieldAlert size={40} className="text-tactical-green" />}
        </div>

        <h2 className="text-3xl font-black tracking-tighter uppercase mb-2">Safety Check</h2>
        <p className="text-xs text-zinc-500 font-medium leading-relaxed uppercase tracking-wider mb-8">
           {broadcasted 
            ? "Status updated. All emergency nodes and priority contacts have been notified of your safe status." 
            : "Broadcast your current safety status to all registered emergency contacts and local response nodes."}
        </p>

        {broadcasted ? (
          <div className="space-y-6">
             <div className="p-4 bg-tactical-green/5 border border-tactical-green/20 rounded-2xl">
                <div className="flex items-center gap-3 justify-center text-tactical-green mb-1">
                   <div className="w-1.5 h-1.5 bg-tactical-green rounded-full animate-pulse" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Signal Locked</span>
                </div>
                <p className="text-[8px] font-bold text-tactical-green/60 uppercase">Last updated: {new Date().toLocaleTimeString()}</p>
             </div>
             <button onClick={onClose} className="w-full py-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 font-black uppercase tracking-widest hover:text-white transition-colors">
                Back to Command
             </button>
          </div>
        ) : (
          <div className="space-y-4">
             <button 
               onClick={handleBroadcast}
               disabled={loading}
               className="w-full py-5 bg-tactical-green rounded-3xl text-tactical-bg font-black uppercase tracking-[0.2em] shadow-2xl shadow-tactical-green/20 hover:bg-tactical-green/80 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
             >
                {loading ? <div className="w-6 h-6 border-2 border-tactical-bg/30 border-t-tactical-bg rounded-full animate-spin" /> : <>I AM SAFE</>}
             </button>
             <button onClick={onClose} className="w-full py-4 bg-transparent text-zinc-600 font-black uppercase tracking-widest hover:text-zinc-400 transition-colors">
                Dismiss Signal
             </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function TacticalNodesModal({ center, onClose, initialCategory = 'hospital' }: { center: [number, number], onClose: () => void, initialCategory?: string }) {
  const [nodes, setNodes] = useState<SafePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(initialCategory);

  const categories = [
    { id: 'hospital', label: 'Hospitals', icon: Activity },
    { id: 'police', label: 'Police', icon: ShieldAlert },
    { id: 'pharmacy', label: 'Pharmacies', icon: Pill },
  ];

  useEffect(() => {
    const fetchNodes = async () => {
      setLoading(true);
      try {
        const data = await fetchRealSafePoints(center[0], center[1], 5000, category);
        setNodes(data);
      } catch (err) {
        console.error("Failed to sync nodes:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchNodes();
  }, [center, category]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        className="w-full max-w-lg bg-tactical-card border border-tactical-border rounded-t-[40px] sm:rounded-[40px] overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-8 pb-4 flex justify-between items-center">
           <div>
             <h2 className="text-2xl font-black tracking-tighter uppercase">Tactical Nodes</h2>
             <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Nearby Emergency Synchronization</p>
           </div>
           <button onClick={onClose} className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
              <X size={20} />
           </button>
        </div>

        {/* Category Tabs */}
        <div className="px-8 pb-4 flex gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all",
                category === cat.id ? "bg-white text-black border-white" : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700"
              )}
            >
              <cat.icon size={14} />
              {cat.label}
            </button>
          ))}
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-3 min-h-[300px]">
           {loading ? (
             <div className="flex flex-col items-center justify-center py-24 gap-4">
               <div className="w-12 h-12 border-4 border-tactical-red/10 border-t-tactical-red rounded-full animate-spin" />
               <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] animate-pulse">Fetching real nearby emergency services...</p>
             </div>
           ) : nodes.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-24 opacity-40">
               <ShieldAlert size={48} className="mb-4" />
               <p className="text-xs font-bold uppercase tracking-widest">No active nodes detected in 5KM radius.</p>
              </div>
            ) : (
              nodes.map((n, i) => {
                const dist = n.distance || 0;
                return (
                 <div key={i} className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-3xl relative group">
                    <div className="absolute top-4 right-4">
                       <span className={cn(
                         "text-[7px] font-black px-2 py-1 rounded border uppercase tracking-wider",
                         n.type === 'hospital' ? "bg-red-500/10 text-red-400 border-red-500/20" :
                         n.type === 'police' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                         "bg-purple-500/10 text-purple-400 border-purple-500/20"
                       )}>
                         {n.type}
                       </span>
                    </div>

                    <div className="flex justify-between items-start mb-4">
                       <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl border flex items-center justify-center shadow-lg",
                            n.type === 'hospital' ? "bg-red-500/10 border-red-500/30 text-red-500" :
                            n.type === 'police' ? "bg-blue-500/10 border-blue-500/30 text-blue-500" :
                            "bg-purple-500/10 border-purple-500/30 text-purple-500"
                          )}>
                             {n.type === 'hospital' ? <Activity size={24} /> : n.type === 'police' ? <ShieldAlert size={24} /> : <Pill size={24} />}
                          </div>
                          <div>
                             <h4 className="text-sm font-black uppercase tracking-tight text-zinc-200 pr-16 leading-tight">{n.name}</h4>
                             <div className="flex items-center gap-1.5 mt-1">
                                <MapPin size={10} className="text-zinc-600" />
                                <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest leading-none">
                                  {n.lat.toFixed(4)}, {n.lng.toFixed(4)}
                                </span>
                             </div>
                          </div>
                       </div>
                       <div className="text-right pt-6">
                          <span className="block text-sm font-black text-white">{dist.toFixed(2)} KM</span>
                          <span className="block text-[8px] font-bold text-zinc-600 uppercase tracking-widest">DRIVE RADIUS</span>
                       </div>
                    </div>

                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-zinc-800/50">
                       <div className="flex flex-col gap-0.5 max-w-[60%]">
                          <span className="text-[7px] font-bold text-zinc-600 uppercase tracking-widest">Sector Address</span>
                          <span className="text-[10px] font-bold text-zinc-400 truncate">{n.address || "Grid Reference Locked"}</span>
                       </div>
                       <div className="flex gap-2">
                          {n.phone && (
                            <a 
                              href={`tel:${n.phone}`}
                              className="w-10 h-10 bg-zinc-800 rounded-xl border border-zinc-700 text-tactical-green flex items-center justify-center hover:bg-zinc-700 transition-colors"
                              title="Connect to Node"
                            >
                               <Phone size={14} />
                            </a>
                          )}
                          <a 
                            href={`https://www.google.com/maps/dir/?api=1&destination=${n.lat},${n.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl font-black uppercase text-[9px] hover:bg-zinc-200 transition-colors"
                          >
                             <Navigation size={12} />
                             Route Node
                          </a>
                       </div>
                    </div>
                 </div>
                );
              })
            )}
        </div>
        
        <div className="p-8 pt-4 border-t border-tactical-border/30 bg-tactical-card/50">
           <button onClick={onClose} className="w-full py-5 bg-zinc-900 border border-zinc-800 text-zinc-400 font-black uppercase tracking-[0.2em] rounded-3xl hover:text-white transition-all">
              Dismiss Tactical Intel
           </button>
        </div>
      </motion.div>
    </div>
  );
}
function PermissionModal({ onApply }: { onApply: () => void }) {
  const { t } = useTranslation();
  const [perms, setPerms] = useState({ geo: false, mic: false, cam: false });
  const allPermsGranted = perms.geo && perms.mic && perms.cam;
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm bg-tactical-card border border-tactical-border p-8 rounded-[32px] relative"
      >
        <div className="absolute top-6 right-6 w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
          <ShieldAlert size={16} className={cn(allPermsGranted ? "text-tactical-green" : "text-tactical-red animate-pulse")} />
        </div>
        
        <h2 className="text-2xl font-black tracking-tighter mb-4 pr-12 text-white">{t('permissions.title')}</h2>
        <p className="text-xs text-zinc-500 font-medium leading-relaxed mb-8 uppercase tracking-wider opacity-80">
           {t('permissions.location_sub')}
        </p>

        <div className="space-y-4 mb-10">
          <PermissionToggle label={t('permissions.location')} active={perms.geo} onToggle={() => setPerms({...perms, geo: !perms.geo})} />
          <PermissionToggle label={t('permissions.mic')} active={perms.mic} onToggle={() => setPerms({...perms, mic: !perms.mic})} />
          <PermissionToggle label={t('permissions.camera')} active={perms.cam} onToggle={() => setPerms({...perms, cam: !perms.cam})} />
        </div>

        <button 
          onClick={allPermsGranted ? onApply : undefined}
          disabled={!allPermsGranted}
          className={cn(
            "w-full py-4 font-black uppercase tracking-widest rounded-2xl transition-all duration-300",
            allPermsGranted 
              ? "bg-white text-black hover:bg-zinc-200" 
              : "bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50"
          )}
        >
          {allPermsGranted ? t('permissions.apply') : t('permissions.apply')}
        </button>
      </motion.div>
    </div>
  );
}

function PermissionToggle({ label, active, onToggle }: { label: string, active: boolean, onToggle: () => void }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm font-bold text-zinc-300">{label}</span>
      <div 
        onClick={onToggle}
        className={cn(
          "w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200",
          active ? "bg-white" : "bg-zinc-800"
        )}
      >
        <div className={cn(
          "w-4 h-4 rounded-full transition-transform duration-200",
          active ? "translate-x-6 bg-black" : "translate-x-0 bg-zinc-600"
        )} />
      </div>
    </div>
  );
}

function AIHelpPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<{role: 'user' | 'ai', content: string, timestamp?: any}[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<{start: string, end: string}>({ start: "", end: "" });
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubscribe = getChatHistory(auth.currentUser.uid, (history) => {
      if (history.length > 0) {
        setMessages(history);
      } else {
        // Only add greeting if history is truly empty
        setMessages([{ role: 'ai', content: 'Hey! Ai chat bot this side, please describe your problem!' }]);
      }
    });
    return () => unsubscribe();
  }, []);

  const filteredMessages = useMemo(() => {
    return messages.filter(m => {
      const matchesSearch = m.content.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      if (dateRange.start || dateRange.end) {
        if (!m.timestamp) return true; // Keep initial messages/system ones
        const msgDate = m.timestamp?.toDate ? m.timestamp.toDate() : new Date();
        
        if (dateRange.start) {
          const startDate = new Date(dateRange.start);
          startDate.setHours(0, 0, 0, 0);
          if (msgDate < startDate) return false;
        }
        if (dateRange.end) {
          const endDate = new Date(dateRange.end);
          endDate.setHours(23, 59, 59, 999);
          if (msgDate > endDate) return false;
        }
      }
      return true;
    });
  }, [messages, searchTerm, dateRange]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !auth.currentUser) return;
    
    const userMsg = input;
    const userId = auth.currentUser.uid;
    setInput("");
    
    // Optimistic update
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      // Save user message to Firestore
      await saveChatMessage(userId, 'user', userMsg);

      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userMsg }],
          systemInstruction: "You are the CrisisSync AI help bot. Guide users clearly. STRICT RULES: 1. NO long paragraphs. 2. USE NUMBERS (1. 2. 3.) instead of bullets. 3. Add a line break after every point. 4. DO NOT use markdown like * or ###. 5. Format: 1 line intro (max 10 words), then points. 6. Emojis: 🚨 📍 📞 ⚠️ ✅. 7. Tone: Calm, Gen-Z. 8. Greeting: 'Hey! Ai chat bot this side, please describe your problem!'. 9. Example: 'Here is what to do:\\n1. Step\\n\\n2. Step\\n\\n⚠️ Important:\\n- Advice'"
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to connect to tactical AI node.");
      }

      const data = await response.json();
      const aiText = data.text || "I am unable to process your request right now.";
      
      // Save AI response to Firestore
      await saveChatMessage(userId, 'ai', aiText);
      
    } catch (e: any) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'ai', content: `🚨 [SIGNAL ERROR] ${e.message || "Connection to neural link severed."}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        className="w-full max-w-lg bg-tactical-bg border border-tactical-border rounded-t-[40px] sm:rounded-[40px] overflow-hidden flex flex-col max-h-[90vh] relative shadow-2xl shadow-yellow-400/5"
      >
        <header className="sticky top-0 z-[1000] bg-[#121212] p-6 border-b border-tactical-border flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center rounded-lg">
                <MessageSquare className="text-yellow-400" size={24} />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tighter uppercase">AI Assistant</h2>
                <p className="text-[7px] font-black text-tactical-green tracking-[0.2em] uppercase">Neural Link Active</p>
              </div>
           </div>
           <button 
             onClick={onClose} 
             className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white hover:border-yellow-400/50 transition-all shadow-lg"
           >
              <X size={20} />
           </button>
        </header>

        {/* Tactical Search & Filter Bar */}
        <div className="bg-tactical-card/50 border-b border-tactical-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
            <input 
              type="text" 
              placeholder="Search past protocols..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-900/50 border border-tactical-border/50 rounded-lg py-2 pl-9 pr-4 text-xs focus:border-yellow-400/50 outline-none transition-all placeholder:text-zinc-600"
            />
          </div>
          <button 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={cn(
              "p-2 rounded-lg border transition-all",
              isFilterOpen ? "bg-yellow-400 text-black border-yellow-400" : "bg-zinc-900/50 border-tactical-border/50 text-zinc-400"
            )}
          >
            <Filter size={16} />
          </button>
        </div>

        <AnimatePresence>
          {isFilterOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-3 pt-1 pb-2">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Start Window</label>
                  <div className="relative">
                    <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" size={10} />
                    <input 
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                      className="w-full bg-zinc-900 border border-tactical-border/30 rounded-md py-1.5 pl-7 pr-2 text-[10px] outline-none focus:border-yellow-400/30"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">End Window</label>
                  <div className="relative">
                    <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" size={10} />
                    <input 
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                      className="w-full bg-zinc-900 border border-tactical-border/30 rounded-md py-1.5 pl-7 pr-2 text-[10px] outline-none focus:border-yellow-400/30"
                    />
                  </div>
                </div>
              </div>
              {(dateRange.start || dateRange.end || searchTerm) && (
                <button 
                  onClick={() => {
                    setSearchTerm("");
                    setDateRange({ start: "", end: "" });
                  }}
                  className="text-[9px] text-yellow-400 font-bold uppercase tracking-widest hover:underline pb-2"
                >
                  Clear Mission Parameters
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
        {filteredMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-40">
            <Search size={48} className="text-zinc-600" />
            <div>
              <p className="text-sm font-bold">No matching data segments</p>
              <p className="text-xs">Adjust your tactical filters</p>
            </div>
          </div>
        )}
        {filteredMessages.map((m, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={i} 
            className={cn(
              "max-w-[85%] p-4 rounded-2xl relative",
              m.role === 'user' ? "ml-auto bg-zinc-800 border border-zinc-700" : "mr-auto bg-tactical-card border border-tactical-border"
            )}
          >
            <div className={cn(
              "absolute -top-4 w-6 h-6 flex items-center justify-center rounded-full border bg-tactical-bg",
              m.role === 'user' ? "-right-1 border-zinc-600" : "-left-1 border-yellow-400/30"
            )}>
              {m.role === 'user' ? <User size={12} /> : <MessageSquare size={12} className="text-yellow-400" />}
            </div>
            <div className={cn(
              "text-sm leading-relaxed",
              m.role === 'ai' ? "text-zinc-300 italic" : "text-white"
            )}>
              <div style={{ whiteSpace: "pre-line" }}>
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-zinc-500">
            <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest">Generating protocols...</span>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-tactical-border bg-tactical-card">
         <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
            <QuickSuggestedBtn text="🚨 Current hazards?" />
            <QuickSuggestedBtn text="📍 Best exit path?" />
            <QuickSuggestedBtn text="📞 Emergency numbers?" />
         </div>
         <div className="relative">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Enter synchronization command..."
              className="w-full bg-zinc-900 border border-tactical-border rounded-2xl p-4 pr-16 text-sm focus:outline-none focus:border-yellow-400/50 transition-colors"
            />
            <button 
              onClick={handleSend}
              className="absolute right-2 top-2 bottom-2 w-12 bg-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-500 disabled:opacity-50"
              disabled={isLoading || !input.trim()}
            >
              <Navigation size={18} className="rotate-90 fill-white" />
            </button>
         </div>
      </div>
    </motion.div>
    </div>
  );
}

function QuickSuggestedBtn({ text }: { text: string }) {
  return (
    <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl whitespace-nowrap text-xs font-bold text-zinc-300 hover:bg-zinc-700 transition-colors">
       <AlertCircle size={14} />
       {text}
    </button>
  );
}

function IncidentsScreen({ incidents }: { incidents: Incident[] }) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-tactical-red/10 border border-tactical-red/30 flex items-center justify-center rounded-2xl">
          <AlertCircle className="text-tactical-red" size={32} />
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tighter leading-none">Incident Folder</h2>
          <p className="text-[9px] font-bold text-zinc-500 tracking-wider uppercase mt-1">Personal Crisis Records & History</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
          <AlertCircle size={12} />
          Your Reported Incidents
        </h3>
        
        {incidents.map((incident) => (
          <div key={incident.id} className="bg-tactical-card border border-tactical-border rounded-2xl p-4 relative group hover:border-tactical-red/30 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                  incident.status === 'CANCELLED' ? "bg-zinc-800 text-zinc-400" : "bg-tactical-red/20 text-tactical-red"
                )}>
                  {incident.status}
                </div>
                <div className="px-2 py-0.5 bg-tactical-red text-white rounded text-[8px] font-black uppercase tracking-wider">
                  {incident.type}
                </div>
              </div>
              <div className="flex items-center gap-2 text-zinc-500">
                <Clock size={12} />
                <span className="text-[9px] font-bold">{incident.timestamp}</span>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <p className="text-xs font-bold text-zinc-300">Emergency SOS triggered by user.</p>
              <div className="flex items-center justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <MapPin size={10} />
                  GPS: {incident.location.lat}, {incident.location.lng}
                </div>
                <div>ID: {incident.id}</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-tactical-border/50">
               <button className="text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-tactical-red transition-colors flex items-center gap-1">
                  <Trash2 size={12} />
                  Delete Entry
               </button>
            </div>

            {incident.status === 'ACTIVATED' && (
              <div className="absolute top-2 right-2 flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-tactical-red rounded-full animate-pulse" />
                <span className="text-[8px] font-black text-tactical-red uppercase">Live</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// Leaflet icon fix
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

function MapEventsHandler({ onMoveEnd }: { onMoveEnd: (lat: number, lng: number) => void }) {
  useMapEvents({
    moveend: (e) => {
      const c = e.target.getCenter();
      onMoveEnd(c.lat, c.lng);
    }
  });
  return null;
}

function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    const currentCenter = map.getCenter();
    if (Math.abs(currentCenter.lat - center[0]) > 0.0001 || Math.abs(currentCenter.lng - center[1]) > 0.0001) {
      map.setView(center);
    }
  }, [center, map]);
  return null;
}

function RoutesScreen({ contacts, center, setCenter }: { contacts: SyncedContact[], center: [number, number], setCenter: (c: [number, number]) => void }) {
  const [safePoints, setSafePoints] = useState<SafePoint[]>([]);
  const [isLoadingPoints, setIsLoadingPoints] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteInfo | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<SafePoint | null>(null);

  const categories = [
    { id: 'hospital', label: 'Hospitals', icon: Activity },
    { id: 'pharmacy', label: 'Pharmacies', icon: Pill },
    { id: 'shelter', label: 'Safest Zones', icon: Tent },
    { id: 'police', label: 'Police Stations', icon: ShieldAlert },
  ];

  useEffect(() => {
    loadSafePoints(center[0], center[1]);
  }, []);

  const loadSafePoints = async (lat: number, lng: number, cat?: string) => {
    setIsLoadingPoints(true);
    // Update radius to 5km for better performance and local relevance
    const points = await fetchRealSafePoints(lat, lng, 5000, cat || undefined);
    setSafePoints(points);
    setIsLoadingPoints(false);
    setActiveRoute(null);
    setSelectedPoint(null);
  };

  const handlePointClick = async (point: SafePoint) => {
    setSelectedPoint(point);
    setIsLoadingPoints(true);
    const route = await fetchRoute(center, [point.lat, point.lng]);
    setActiveRoute(route);
    setIsLoadingPoints(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="space-y-4 flex flex-col h-[calc(100vh-160px)]"
    >
       <div className="flex-none flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-tactical-green/10 border border-tactical-green/30 flex items-center justify-center rounded-2xl">
              <MapPin className="text-tactical-green" size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tighter leading-none uppercase">Tactical Grid</h2>
              <p className="text-[8px] font-bold text-zinc-500 tracking-wider uppercase mt-1">Live Asset & Node Synchronization</p>
            </div>
          </div>
          {isLoadingPoints && (
            <div className="flex items-center gap-2 bg-tactical-green/10 px-3 py-1.5 rounded-full border border-tactical-green/30">
              <div className="w-1.5 h-1.5 bg-tactical-green rounded-full animate-ping" />
              <span className="text-[8px] font-black text-tactical-green uppercase tracking-widest leading-none">Syncing Nodes...</span>
            </div>
          )}
        </div>

        {/* Search Dashboard */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
           {categories.map((cat) => (
             <button 
               key={cat.id}
               onClick={() => {
                 setActiveCategory(cat.id === activeCategory ? null : cat.id);
                 loadSafePoints(center[0], center[1], cat.id === activeCategory ? undefined : cat.id);
               }}
               className={cn(
                 "flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all whitespace-nowrap",
                 activeCategory === cat.id 
                  ? "bg-white text-black border-white shadow-lg shadow-white/10" 
                  : "bg-tactical-card border-tactical-border text-zinc-400 hover:border-zinc-700"
               )}
             >
                <cat.icon size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">{cat.label}</span>
             </button>
           ))}
        </div>
      </div>

      <div className="flex-1 bg-tactical-card border border-tactical-border rounded-[32px] overflow-hidden relative shadow-2xl group">
         <div className="absolute inset-0 z-0">
           <MapContainer 
             center={center} 
             zoom={13} 
             scrollWheelZoom={true} 
             style={{ height: '100%', width: '100%' }}
             zoomControl={false}
           >
             <TileLayer
               url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
               attribution='&copy; OSM'
             />
             
             <MapEventsHandler onMoveEnd={(lat, lng) => setCenter([lat, lng])} />
             <MapRecenter center={center} />

             {/* Hazard Zone Overlay */}
             <Circle center={center} radius={1500} pathOptions={{ color: '#ff3e3e', fillColor: '#ff3e3e', fillOpacity: 0.05 }} />
             
             <Marker position={center} icon={L.divIcon({
               className: 'custom-user-icon',
               html: `<div class="w-10 h-10 bg-blue-500/20 border-2 border-blue-500 rounded-full flex items-center justify-center animate-pulse"><div class="w-4 h-4 bg-blue-500 rounded-full shadow-lg border-2 border-white"></div></div>`,
               iconSize: [40, 40],
               iconAnchor: [20, 20]
             })}>
                <Popup>
                  <div className="text-black font-black uppercase text-[10px]">Your Current Node</div>
                </Popup>
             </Marker>

             {/* Route Polyline */}
             {activeRoute && (
               <Polyline 
                 positions={activeRoute.coordinates} 
                 pathOptions={{ color: '#3b82f6', weight: 6, lineCap: 'round', lineJoin: 'round', opacity: 0.8 }} 
               />
             )}
             
             {/* Real Safe Points (POIs) */}
             {safePoints.map((point) => {
                const isSelected = selectedPoint?.id === point.id;
                const typeColor = SAFE_POINT_COLORS[point.type] || 'text-white';
                const dist = L.latLng(center).distanceTo(L.latLng(point.lat, point.lng)) / 1000;
                
                // Dynamic SVG generation
                let svgIcon = `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>`;
                if (point.type === 'hospital') svgIcon = `<path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z"/>`;
                if (point.type === 'pharmacy') svgIcon = `<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>`;
                if (point.type === 'police') svgIcon = `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="M12 8v4"/><path d="M12 16h.01"/>`;
                if (point.type === 'shelter') svgIcon = `<path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/><polyline points="13 11 9 17 11 17 7 23"/>`;

                return (
                  <Marker 
                    key={point.id} 
                    position={[point.lat, point.lng]} 
                    eventHandlers={{ click: () => handlePointClick(point) }}
                    icon={L.divIcon({
                      className: 'custom-div-icon',
                      html: `<div class="w-10 h-10 rounded-2xl bg-tactical-card border-2 flex items-center justify-center shadow-2xl transition-all duration-300 ${isSelected ? 'border-blue-500 scale-125 z-[500]' : 'border-zinc-700 hover:border-zinc-500'}"><div class="${typeColor}"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${svgIcon}</svg></div></div>`,
                      iconSize: [40, 40],
                      iconAnchor: [20, 20]
                    })}
                  >
                    <Popup>
                      <div className="text-black min-w-[180px] p-2">
                        <div className="flex items-center gap-2 mb-2">
                           <h4 className="font-black uppercase text-[12px] m-0 leading-tight">{point.name}</h4>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                           <span className={cn(
                             "text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider",
                             point.type === 'shelter' ? "bg-tactical-green/20 text-tactical-green font-bold" : "bg-zinc-100 text-zinc-600"
                           )}>
                             {point.type === 'shelter' ? 'SECURE ZONE' : point.type.replace('_', ' ')}
                           </span>
                           <span className="text-[10px] font-black text-blue-600 ml-auto flex items-center gap-1">
                             <Navigation size={10} /> {dist.toFixed(2)} KM
                           </span>
                        </div>
                        {point.address && <p className="text-[9px] font-medium m-0 mb-3 text-zinc-500 flex items-center gap-1"><MapPin size={8}/> {point.address}</p>}
                        <button 
                          onClick={() => handlePointClick(point)}
                          className="w-full py-2 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg active:scale-95"
                        >
                          Lock Extraction Route
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                );
             })}

             {/* Real Synced Contacts */}
             {contacts.map((contact, i) => (
                <Marker 
                  key={i} 
                  position={[contact.lat, contact.lng]} 
                  icon={L.divIcon({
                    className: 'custom-contact-icon',
                    html: `<div class="w-8 h-8 rounded-full bg-blue-500 border-2 border-white shadow-xl flex items-center justify-center transform hover:scale-110 transition-transform"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`,
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                  })}
                >
                  <Popup>
                    <div className="text-black">
                      <p className="font-black uppercase text-[10px] m-0">{contact.name}</p>
                      <p className="text-[8px] font-bold opacity-60 m-0">{contact.phone}</p>
                    </div>
                  </Popup>
                </Marker>
             ))}
           </MapContainer>
         </div>
         
         {/* HUD Overlays */}
         <div className="absolute top-4 left-4 z-[400] space-y-2 pointer-events-none">
            <LegendItem color="bg-tactical-red" label="Hazard Buffer" />
            <LegendItem color="bg-tactical-green" label="Conflict Shells" />
            <LegendItem color="bg-blue-500" label="Friendly Sync" />
         </div>

         {activeRoute && (
            <div className="absolute top-4 right-4 z-[400] bg-black/80 backdrop-blur-md border border-blue-500/30 p-3 rounded-2xl min-w-[120px] shadow-2xl">
               <div className="flex items-center gap-2 text-blue-400 mb-1">
                  <Navigation size={14} className="animate-pulse" />
                  <span className="text-[9px] font-black tracking-widest uppercase">
                    {activeRoute.trafficAware ? "Traffic Optimized" : "Shortest Route"}
                  </span>
               </div>
               <div className="flex flex-col">
                  <span className="text-xl font-black tracking-tighter text-white">{activeRoute.distance} KM</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">ETA: {activeRoute.duration} MIN</span>
                    {activeRoute.trafficAware && (
                      <div className="w-1.5 h-1.5 bg-tactical-green rounded-full" title="Traffic-Aware Enabled" />
                    )}
                  </div>
               </div>
            </div>
         )}

         <div className="absolute bottom-6 left-6 right-6 z-[400] flex gap-3">
            <button 
              onClick={() => {
                const nearest = safePoints[0];
                if (nearest) {
                  setCenter([nearest.lat, nearest.lng]);
                  handlePointClick(nearest);
                }
              }}
              className="flex-1 bg-tactical-green/90 backdrop-blur-md border border-tactical-green/40 px-5 py-4 rounded-3xl text-left group hover:bg-white hover:text-black transition-all shadow-2xl shadow-tactical-green/30 flex items-center justify-between"
            >
               <div>
                  <span className="block text-[8px] font-black uppercase tracking-[0.2em] mb-1 opacity-70">Nearest Secure Node</span>
                  <span className="block text-[13px] font-black tracking-tight truncate max-w-[150px]">
                    {safePoints[0]?.name || "Searching Sector..."}
                  </span>
               </div>
               <ChevronRight size={20} className="opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </button>
            <button 
              onClick={() => {
                if ("geolocation" in navigator) {
                  navigator.geolocation.getCurrentPosition((pos) => {
                    const newCenter: [number, number] = [pos.coords.latitude, pos.coords.longitude];
                    setCenter(newCenter);
                    loadSafePoints(newCenter[0], newCenter[1], activeCategory || undefined);
                  });
                }
              }}
              className="w-16 h-16 bg-tactical-bg/90 backdrop-blur-md border border-tactical-border/50 flex items-center justify-center rounded-3xl text-white hover:bg-white hover:text-black transition-all shadow-2xl"
            >
               <Crosshair size={28} />
            </button>
         </div>
      </div>

      <div className="flex-none p-4 bg-tactical-card border border-tactical-border rounded-3xl">
         <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 mb-3 flex items-center gap-2">
           <Building2 size={12} />
           Conflict Safety Protocol
         </h3>
         <div className="text-[10px] text-zinc-400 font-medium leading-relaxed uppercase tracking-wider">
           Map data synchronized with <span className="text-white font-bold">OSM Global Emergency Nodes</span>. Safe Zones include fortified shelters and bunkers for extreme situational resilience. Routing utilizes <span className="text-blue-400 font-bold">Shortest-Path Logic</span> for high-speed extraction.
         </div>
      </div>
    </motion.div>
  );
}

function LegendItem({ color, label }: { color: string, label: string }) {
  return (
    <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5 w-fit">
      <div className={cn("w-2 h-2 rounded-full", color)} />
      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-300">{label}</span>
    </div>
  );
}

function ProfileScreen({ contacts }: { contacts: SyncedContact[] }) {
  const [profile, setProfile] = useState<UserProfile>({
    uid: auth.currentUser?.uid || "",
    name: auth.currentUser?.displayName || "UNNAMED SIGNAL",
    email: auth.currentUser?.email || "NO EMAIL",
    phone: "",
    alternatePhone: "",
    address: "",
    pronouns: "",
    verified: auth.currentUser?.emailVerified || false,
    photoURL: auth.currentUser?.photoURL || "https://picsum.photos/seed/user/400/400",
    status: 'ACTIVE'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '' });

  useEffect(() => {
    if (auth.currentUser) {
      getUserProfile(auth.currentUser.uid).then(p => {
        if (p) setProfile(p);
      });
    }
  }, []);

  const handleImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setProfile(prev => ({ ...prev, photoURL: imageUrl }));
    }
  };

  const syncContacts = async () => {
    if (!auth.currentUser) return;
    
    setIsSaving(true); 
    
    try {
      // Simulation of a realistic contact sync process
      const mockContacts: Omit<SyncedContact, 'id'>[] = [
        { name: "John Doe", phone: "+1 (555) 012-3456", lat: 23.01 + (Math.random() - 0.5) * 0.03, lng: 88.48 + (Math.random() - 0.5) * 0.03, isEmergency: true },
        { name: "Alice Smith", phone: "+1 (555) 098-7654", lat: 23.01 + (Math.random() - 0.5) * 0.03, lng: 88.48 + (Math.random() - 0.5) * 0.03, isEmergency: true },
        { name: "Mike Tech", phone: "+1 (555) 444-1111", lat: 23.01 + (Math.random() - 0.5) * 0.03, lng: 88.48 + (Math.random() - 0.5) * 0.03, isEmergency: false },
        { name: "Global Relay", phone: "911-RESCUE", lat: 23.01 + (Math.random() - 0.5) * 0.03, lng: 88.48 + (Math.random() - 0.5) * 0.03, isEmergency: true }
      ];

      await new Promise(resolve => setTimeout(resolve, 2000)); 
      await saveSyncedContacts(auth.currentUser.uid, mockContacts as any);
      
      alert("Tactical Cloud Sync Complete: Signal Nodes discovered.");
    } catch (e) {
      console.error(e);
      alert("Sync Failed: Neural link unstable.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddManualContact = async () => {
    if (!auth.currentUser || !newContact.name || !newContact.phone) return;
    try {
      await addContact(auth.currentUser.uid, {
        name: newContact.name,
        phone: newContact.phone,
        lat: 23.01 + (Math.random() - 0.5) * 0.05,
        lng: 88.48 + (Math.random() - 0.5) * 0.05,
        isEmergency: true
      });
      setNewContact({ name: '', phone: '' });
      setShowAddContact(false);
    } catch (e) {
      alert("Failed to register node.");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    await saveUserProfile(profile);
    setIsSaving(false);
    alert("System Identity Synchronized.");
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="space-y-6 pb-24"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-4xl font-black tracking-tighter uppercase leading-none">System Identity</h2>
      </div>

      {/* Identity Card */}
      <div className="relative group p-6 bg-tactical-card border border-tactical-border rounded-[40px] flex flex-col items-center">
         <div className="relative w-48 h-48 mb-6 group">
            <div className="absolute inset-0 bg-blue-500/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <img 
              src={profile.photoURL} 
              className="w-full h-full object-cover rounded-[32px] border-2 border-tactical-border group-hover:border-blue-500/50 transition-colors"
              referrerPolicy="no-referrer"
            />
            <div className="absolute -bottom-2 -right-2 flex gap-2">
               {/* Camera Capture */}
               <input 
                 type="file" 
                 id="camera-upload" 
                 className="hidden" 
                 accept="image/*" 
                 capture="environment" 
                 onChange={handleImage} 
               />
               <label 
                 htmlFor="camera-upload" 
                 title="Take Photo"
                 className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-xl shadow-blue-500/20 text-white cursor-pointer hover:bg-blue-400 transition-colors"
               >
                  <Camera size={18} />
               </label>
               
               {/* Gallery Upload */}
               <input 
                 type="file" 
                 id="gallery-upload" 
                 className="hidden" 
                 accept="image/*" 
                 onChange={handleImage} 
               />
               <label 
                 htmlFor="gallery-upload" 
                 title="Upload from Gallery"
                 className="w-12 h-10 bg-zinc-800 border border-zinc-700 rounded-xl flex items-center justify-center shadow-xl shadow-black/20 text-white cursor-pointer hover:bg-zinc-700 transition-colors"
               >
                  <Upload size={18} />
               </label>
            </div>
         </div>

         <div className="text-center mb-6">
            <h3 className="text-2xl font-black tracking-tighter uppercase">{profile.name}</h3>
            <div className="flex items-center gap-2 justify-center mt-2">
               {profile.verified && <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded text-[10px] font-black uppercase tracking-wider">Verified Signal</span>}
               <span className="px-2 py-0.5 bg-zinc-800 text-zinc-500 border border-zinc-700 rounded text-[10px] font-black uppercase tracking-wider">Node Operative</span>
            </div>
         </div>
      </div>

      <div className="space-y-4">
        <ProfileField icon={User} label="Full Name" value={profile.name} onChange={(v) => setProfile({...profile, name: v})} />
        <ProfileField icon={Navigation} label="Primary Phone" value={profile.phone || ""} onChange={(v) => setProfile({...profile, phone: v})} />
      </div>

      {/* EMERGENCY CONTACTS SECTION */}
      <div className="space-y-4 pt-4 border-t border-tactical-border">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Emergency Contacts</h3>
          <button 
            onClick={() => setShowAddContact(!showAddContact)}
            className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 hover:bg-blue-500 hover:text-white transition-all group"
          >
            <Plus size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Add Node</span>
          </button>
        </div>

        {showAddContact && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-4 mb-4"
          >
             <div className="grid grid-cols-2 gap-4">
               <input 
                 placeholder="NAME"
                 className="bg-black border border-tactical-border p-3 rounded-xl text-[10px] font-black uppercase outline-none focus:border-blue-500 text-white"
                 value={newContact.name}
                 onChange={(e) => setNewContact({...newContact, name: e.target.value})}
               />
               <input 
                 placeholder="PHONE"
                 className="bg-black border border-tactical-border p-3 rounded-xl text-[10px] font-black uppercase outline-none focus:border-blue-500 text-white"
                 value={newContact.phone}
                 onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
               />
             </div>
             <button 
               onClick={handleAddManualContact}
               className="w-full py-3 bg-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-600/20"
             >
               Confirm Node Registration
             </button>
          </motion.div>
        )}

        <div className="space-y-2">
          {contacts.map((contact) => (
            <div key={contact.id} className="flex items-center justify-between p-4 bg-tactical-card border border-tactical-border rounded-2xl group hover:border-zinc-700 transition-all">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center border transition-colors",
                  contact.isEmergency ? "bg-tactical-red/10 border-tactical-red/30 text-tactical-red" : "bg-zinc-800 border-zinc-700 text-zinc-500"
                )}>
                  <User size={20} />
                </div>
                <div>
                  <span className="block text-xs font-black uppercase tracking-tight">{contact.name}</span>
                  <span className="block text-[8px] font-bold text-zinc-500 tracking-widest uppercase">{contact.phone}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => updateContact(auth.currentUser!.uid, contact.id!, { isEmergency: !contact.isEmergency })}
                  className={cn(
                    "p-2 rounded-lg border transition-all",
                    contact.isEmergency ? "bg-tactical-red text-white border-tactical-red" : "bg-zinc-900 border-zinc-800 text-zinc-600 hover:text-tactical-red"
                  )}
                  title={contact.isEmergency ? "Emergency Node Active" : "Set as Emergency Node"}
                >
                  <Heart size={14} fill={contact.isEmergency ? "currentColor" : "none"} />
                </button>
                <button 
                  onClick={() => deleteContact(auth.currentUser!.uid, contact.id!)}
                  className="p-2 bg-zinc-900 border border-zinc-800 text-zinc-600 rounded-lg hover:bg-tactical-red hover:text-white hover:border-tactical-red transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {contacts.length === 0 && !isSaving && (
            <div className="text-center py-8 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-3xl">
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">No trusted nodes found in sector</p>
            </div>
          )}
        </div>

        <button 
          onClick={syncContacts}
          disabled={isSaving}
          className="w-full p-4 bg-zinc-900/40 border border-zinc-800 rounded-2xl flex items-center justify-between hover:bg-zinc-800 transition-colors group disabled:opacity-50"
        >
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg flex items-center justify-center border bg-tactical-green/10 border-tactical-green/30">
                {isSaving ? <div className="w-4 h-4 border-2 border-tactical-green border-t-transparent rounded-full animate-spin" /> : <Activity size={16} className="text-tactical-green" />}
             </div>
             <div className="text-left">
                <span className="block text-xs font-black uppercase tracking-widest text-zinc-300">Sync Emergency Matrix</span>
                <span className="block text-[8px] font-bold text-zinc-600 uppercase italic">
                  {isSaving ? "Synchronizing nodes via simulated cloud..." : "PROTOTYPE: Simulates device contact integration"}
                </span>
             </div>
          </div>
          {!isSaving && <ChevronRight size={16} className="text-zinc-600 group-hover:text-zinc-300" />}
        </button>
        
        <p className="text-[8px] text-zinc-700 font-bold uppercase text-center px-4">
          Note: Real device contact synchronization requires native Android/iOS container permissions. This interface provides a simulated high-fidelity sync for prototype evaluation.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-6">
        <button 
          onClick={() => signOut(auth)}
          className="w-full py-5 bg-zinc-900 border border-zinc-800 rounded-3xl text-tactical-red font-black uppercase tracking-widest hover:bg-zinc-800 transition-colors flex items-center justify-center gap-3"
        >
           <LogOut size={20} />
           Log Out
        </button>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-5 bg-blue-600 rounded-3xl text-white font-black uppercase tracking-widest shadow-2xl shadow-blue-600/30 hover:bg-blue-500 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
        >
           {isSaving ? <Activity className="animate-spin" size={24} /> : <CheckCircle2 size={24} />}
           Save System Identity
        </button>
      </div>
    </motion.div>
  );
}

function ProfileStat({ label, value }: { label: string, value: string }) {
  return (
    <div className="text-center overflow-hidden">
      <span className="block text-[7px] font-bold text-zinc-600 uppercase tracking-widest mb-1 truncate">{label}</span>
      <span className="block text-[9px] font-black tracking-tight text-blue-400 truncate">{value}</span>
    </div>
  );
}

function ProfileField({ icon: Icon, label, value, disabled, onChange }: { icon: any, label: string, value: string, disabled?: boolean, onChange?: (v: string) => void }) {
  return (
    <div className="group space-y-2">
      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">{label}</label>
      <div className={cn(
        "flex items-center gap-4 p-4 bg-tactical-card border border-tactical-border rounded-2xl transition-colors",
        disabled ? "opacity-60" : "group-focus-within:border-blue-500/50"
      )}>
         <Icon size={18} className="text-zinc-600" />
         <input 
          value={value}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
          className="flex-1 bg-transparent text-sm font-bold placeholder:text-zinc-700 outline-none disabled:cursor-not-allowed"
         />
      </div>
    </div>
  );
}

function SystemScreen({ 
  theme, 
  setTheme, 
  isNotificationsEnabled, 
  setIsNotificationsEnabled,
  onTestNotification
}: { 
  theme: 'dark' | 'light', 
  setTheme: (t: 'dark' | 'light') => void,
  isNotificationsEnabled: boolean,
  setIsNotificationsEnabled: (v: boolean) => void,
  onTestNotification: () => void
}) {
  const { t } = useTranslation();

  const handleToggleNotifications = async () => {
    if (isNotificationsEnabled) {
      setIsNotificationsEnabled(false);
      return;
    }

    if (!("Notification" in window)) {
      alert("Notifications not supported in this sector's hardware.");
      return;
    }

    const token = await requestNotificationPermission();
    
    // If we got a token OR if permission is at least granted, we consider it enabled for the UI
    if (token || Notification.permission === 'granted') {
      setIsNotificationsEnabled(true);
      
      // Immediate feedback as per user's request
      new Notification("Notifications Enabled 🚨", {
        body: "Neural link relay operational. You will now receive alerts."
      });
    } else {
      // Alert already handled in requestNotificationPermission or will fall back to local system alert
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-zinc-800 border border-zinc-700 flex items-center justify-center rounded-2xl">
          <Settings className="text-zinc-400" size={32} />
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tighter leading-none uppercase">{t('common.system')}</h2>
          <p className="text-[9px] font-bold text-zinc-500 tracking-wider uppercase mt-1">{t('settings.security_sub')}</p>
        </div>
      </div>

      <section className="space-y-4">
         <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 px-1">{t('settings.language')}</h3>
         <div className="bg-tactical-card border border-tactical-border rounded-3xl p-6">
            <div className="space-y-4">
               <div className="space-y-1">
                  <h4 className="text-sm font-black tracking-tight">{t('settings.language')}</h4>
                  <p className="text-[10px] font-bold text-zinc-500 leading-relaxed uppercase tracking-wider">{t('settings.language_sub')}</p>
               </div>
               <LanguageSwitcher />
            </div>
         </div>
      </section>

      <section className="space-y-4">
         <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 px-1">{t('settings.theme')}</h3>
         <div className="bg-tactical-card border border-tactical-border rounded-3xl p-6">
            <div className="flex items-center justify-between">
               <div className="space-y-1">
                  <h4 className="text-sm font-black tracking-tight">{t('settings.theme')}</h4>
                  <p className="text-[10px] font-bold text-zinc-500 leading-relaxed uppercase tracking-wider">{t('settings.dark')} / {t('settings.light')}</p>
               </div>
               <div 
                 onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                 className={cn(
                  "w-16 h-8 rounded-full p-1 cursor-pointer transition-colors duration-300 flex items-center",
                  theme === 'dark' ? "bg-zinc-800 justify-start" : "bg-blue-600 justify-end"
                 )}
               >
                  <motion.div 
                    layout
                    className="w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center text-zinc-900"
                  >
                    {theme === 'dark' ? <Clock size={12} /> : <HomeIcon size={12} />}
                  </motion.div>
               </div>
            </div>
         </div>
      </section>

      <section className="space-y-4">
         <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 px-1">Notifications & Sync</h3>
         <div className="bg-tactical-card border border-tactical-border rounded-3xl p-6">
            <div className="flex items-center justify-between mb-6">
               <div className="space-y-1">
                  <h4 className="text-sm font-black tracking-tight">Push Alerts</h4>
                  <p className="text-[10px] font-bold text-zinc-500 leading-relaxed uppercase tracking-wider">Receive critical updates natively.</p>
               </div>
               <div 
                 onClick={handleToggleNotifications}
                 className={cn(
                  "w-16 h-8 rounded-full p-1 cursor-pointer transition-all duration-300 flex items-center",
                  isNotificationsEnabled ? "bg-blue-600 justify-end" : "bg-zinc-800 justify-start"
                 )}
               >
                  <motion.div 
                    layout
                    className="w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center"
                  >
                    <Wifi size={12} className={cn("transition-colors", isNotificationsEnabled ? "text-blue-600" : "text-zinc-900")} />
                  </motion.div>
               </div>
            </div>

            {isNotificationsEnabled && (
              <button 
                onClick={onTestNotification}
                className="w-full py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all flex items-center justify-center gap-2"
              >
                <AlertCircle size={14} />
                Trigger Diagnostic Signal
              </button>
            )}
         </div>
      </section>
    </motion.div>
  );
}
