import { ShieldAlert, Activity, Flame, Heart, User, AlertCircle, Building2, Landmark, Pill, Tent } from "lucide-react";

export const GLOBAL_EMERGENCY_CONTACTS = [
  {
    region: "Universal / EU",
    contacts: [
      { name: "Emergency (Universal)", number: "112", icon: ShieldAlert, color: "text-blue-400", sub: "Standard in EU & GSM networks" },
    ]
  },
  {
    region: "North America",
    contacts: [
      { name: "Emergency (USA/Canada)", number: "911", icon: ShieldAlert, color: "text-red-400", sub: "Police, Fire, Ambulance" },
    ]
  },
  {
    region: "United Kingdom",
    contacts: [
      { name: "Emergency (UK)", number: "999", icon: ShieldAlert, color: "text-red-500", sub: "Primary emergency number" },
      { name: "Non-Emergency (UK)", number: "101", icon: User, color: "text-zinc-500", sub: "Local police reports" },
    ]
  },
  {
    region: "Asia",
    contacts: [
      { name: "Emergency (India)", number: "112", icon: ShieldAlert, color: "text-orange-400", sub: "Unified emergency service" },
      { name: "Police (China)", number: "110", icon: ShieldAlert, color: "text-blue-500", sub: "Public security nodes" },
      { name: "Police (Japan)", number: "110", icon: ShieldAlert, color: "text-blue-400", sub: "Immediate responder" },
    ]
  },
  {
    region: "Oceania",
    contacts: [
      { name: "Emergency (Australia)", number: "000", icon: ShieldAlert, color: "text-red-600", sub: "Triple Zero (000)" },
    ]
  }
];

export const SAFE_POINT_ICONS: Record<string, any> = {
  hospital: Activity,
  police: ShieldAlert,
  shelter: Building2,
  fire_station: Flame,
  pharmacy: Pill,
  bunker: Tent
};

export const SAFE_POINT_COLORS: Record<string, string> = {
  hospital: "text-tactical-red",
  police: "text-blue-400",
  shelter: "text-tactical-green",
  fire_station: "text-orange-500",
  pharmacy: "text-purple-400",
  bunker: "text-amber-500"
};
