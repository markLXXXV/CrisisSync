import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  onSnapshot,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { UserProfile, Incident, SyncedContact, SafePoint, RouteInfo } from "../types";
import { calculateHaversineDistance } from "../lib/utils";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter",
  "https://overpass.private.coffee/api/interpreter"
];

// Simple in-memory cache to prevent frequent redundant requests
const safePointsCache: Record<string, { data: SafePoint[], expiry: number }> = {};
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

// Timeout for fetch calls to prevent hanging on bad mirrors
const FETCH_TIMEOUT = 10000; // 10 seconds

export const fetchRealSafePoints = async (lat: number, lng: number, radius: number = 8000, category?: string): Promise<SafePoint[]> => {
  // Round lat/lng slightly to improve cache hit rate for nearby users
  const cacheKey = `${lat.toFixed(4)}_${lng.toFixed(4)}_${radius}_${category || 'all'}`;
  const now = Date.now();

  if (safePointsCache[cacheKey] && safePointsCache[cacheKey].expiry > now) {
    return safePointsCache[cacheKey].data;
  }

  let filter = "";
  if (category === 'hospital') {
    filter = '["amenity"~"hospital|clinic|doctors"]';
  } else if (category === 'pharmacy') {
    filter = '["amenity"~"pharmacy|chemist"]';
  } else if (category === 'police') {
    filter = '["amenity"~"police|sheriff"]';
  } else if (category === 'shelter') {
    // Overpass OR logic for shelters
    const query = `
      [out:json][timeout:30];
      (
        node["amenity"~"shelter|bunker"](around:${radius},${lat},${lng});
        way["amenity"~"shelter|bunker"](around:${radius},${lat},${lng});
        node["emergency"~"shelter|evacuation_centre"](around:${radius},${lat},${lng});
        way["emergency"~"shelter|evacuation_centre"](around:${radius},${lat},${lng});
      );
      out center;
    `;
    return executeOverpassQuery(query, cacheKey, lat, lng);
  } else {
    filter = '["amenity"~"hospital|police|fire_station|shelter|pharmacy|bunker"]';
  }

  const query = `
    [out:json][timeout:30];
    (
      node${filter}(around:${radius},${lat},${lng});
      way${filter}(around:${radius},${lat},${lng});
      relation${filter}(around:${radius},${lat},${lng});
    );
    out center;
  `;
  
  return executeOverpassQuery(query, cacheKey, lat, lng);
};

const executeOverpassQuery = async (query: string, cacheKey: string, userLat: number, userLng: number): Promise<SafePoint[]> => {
  let lastError = null;
  const now = Date.now();
  const startIndex = Math.floor(Math.random() * OVERPASS_ENDPOINTS.length);
  
  for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
    const endpoint = OVERPASS_ENDPOINTS[(startIndex + i) % OVERPASS_ENDPOINTS.length];
    console.log(`[Overpass] Attempting sync via: ${endpoint}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      // Use POST instead of GET for better reliability and larger query support
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.status === 429) {
        console.warn(`Mirror ${endpoint} is rate-limited. Trying next...`);
        await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
        continue;
      }

      if (!response.ok) {
        throw new Error(`Overpass API responded with status ${response.status}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        continue; 
      }

      const data = await response.json();
      if (!data || !data.elements) return [];

      const results: SafePoint[] = data.elements.map((el: any) => {
        const type = el.tags.amenity || el.tags.emergency || 'safe_point';
        const mappedType = 
          type === 'fire_station' ? 'fire_station' : 
          (type === 'shelter' || type === 'evacuation_centre' || type === 'bunker' ? 'shelter' : 
          (type === 'hospital' || type === 'clinic' || type === 'doctors' ? 'hospital' : type));

        const lat = el.lat || el.center?.lat;
        const lng = el.lon || el.center?.lon;
        const dist = calculateHaversineDistance(userLat, userLng, lat, lng);

        // Advanced Categorization Logic
        let subCategory: 'Government' | 'Private' | 'General' = 'General';
        const operator = (el.tags.operator || el.tags.operator_type || el.tags.ownership || "").toLowerCase();
        const elName = (el.tags.name || "").toLowerCase();
        
        if (mappedType === 'hospital') {
          if (
            operator.includes('government') || 
            operator.includes('public') || 
            operator.includes('civil') || 
            el.tags.owner === 'government' ||
            elName.includes('government') ||
            elName.includes('govt') ||
            elName.includes('civil') ||
            elName.includes('district')
          ) {
            subCategory = 'Government';
          } else if (
            operator.includes('private') || 
            operator.includes('group') || 
            operator.includes('ltd') || 
            operator.includes('limited') ||
            elName.includes('private') ||
            elName.includes('care') ||
            elName.includes('clinic')
          ) {
            subCategory = 'Private';
          }
        }

        return {
          id: el.id.toString(),
          name: el.tags.name || `${(el.tags.amenity || el.tags.emergency || el.tags.building || 'Safe Point').replace('_', ' ')}`,
          type: mappedType,
          lat,
          lng,
          distance: +dist.toFixed(2),
          subCategory,
          address: el.tags['addr:street'] ? `${el.tags['addr:street']} ${el.tags['addr:housenumber'] || ''}` : undefined,
          phone: el.tags.phone || el.tags['contact:phone'],
          website: el.tags.website || el.tags['contact:website']
        };
      });

      // Tactical Sorting: Nearest First
      const sortedResults = results.sort((a, b) => (a.distance || 0) - (b.distance || 0));

      safePointsCache[cacheKey] = { data: sortedResults, expiry: now + CACHE_TTL };
      return sortedResults;

    } catch (error: any) {
      clearTimeout(timeoutId);
      lastError = error;
      // Log as warning during rotation to keep console cleaner
      console.warn(`[Overpass] Sensor node ${endpoint} offline. Rotating...`);
      // Small jittered delay before jumping to next mirror
      await new Promise(r => setTimeout(r, 300 + Math.random() * 500));
    }
  }

  console.error("All Overpass mirrors failed or were rate-limited.", lastError);
  return [];
};

export const fetchRoute = async (start: [number, number], end: [number, number]): Promise<RouteInfo | null> => {
  try {
    // Call our backend to bypass CORS and secure tokens
    // Format coordinates as lng,lat for the API
    const startStr = `${start[1]},${start[0]}`;
    const endStr = `${end[1]},${end[0]}`;
    const response = await fetch(`/api/route?start=${startStr}&end=${endStr}`);
    
    if (!response.ok) {
      throw new Error(`Routing cluster responded with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Tactical routing error, falling back to straight-line estimation:", error);
    // Ultimate fallback: Straight line if both Mapbox and OSRM (via backend) are dead
    return {
      distance: 0,
      duration: 0,
      coordinates: [start, end],
      trafficAware: false
    };
  }
};

export const saveUserProfile = async (profile: UserProfile) => {
  if (!auth.currentUser) return;
  const userDoc = doc(db, "users", auth.currentUser.uid);
  await setDoc(userDoc, {
    ...profile,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const userDoc = doc(db, "users", uid);
  const snap = await getDoc(userDoc);
  if (snap.exists()) {
    return snap.data() as UserProfile;
  }
  return null;
};

export const triggerSOS = async (lat: number, lng: number) => {
  if (!auth.currentUser) return;
  const incident: Partial<Incident> = {
    type: "SOS",
    status: "ACTIVATED",
    timestamp: new Date().toLocaleString(),
    location: { lat, lng },
    priority: "CRITICAL"
  };
  
  const docRef = await addDoc(collection(db, "incidents"), {
    ...incident,
    userId: auth.currentUser.uid,
    createdAt: serverTimestamp()
  });
  
  return docRef.id;
};

export const cancelSOS = async (incidentId: string) => {
  const docRef = doc(db, "incidents", incidentId);
  await updateDoc(docRef, {
    status: "CANCELLED",
    updatedAt: serverTimestamp()
  });
};

export const saveChatMessage = async (userId: string, role: 'user' | 'ai', content: string) => {
  const chatRef = collection(db, "users", userId, "chatHistory");
  await addDoc(chatRef, {
    userId,
    role,
    content,
    timestamp: serverTimestamp()
  });
};

export const getChatHistory = (userId: string, callback: (messages: {role: 'user' | 'ai', content: string}[]) => void) => {
  const chatRef = collection(db, "users", userId, "chatHistory");
  const q = query(chatRef, where("userId", "==", userId)); // We also need to sort by timestamp, but let's keep it simple first
  return onSnapshot(q, (snap) => {
    // Sort manually as we don't have an index yet for combined filter+sort
    const messages = snap.docs
      .map(doc => ({ ...doc.data() } as {role: 'user' | 'ai', content: string, timestamp: any}))
      .sort((a, b) => (a.timestamp?.toMillis() || 0) - (b.timestamp?.toMillis() || 0));
    callback(messages);
  });
};

export const subscribeToIncidents = (callback: (incidents: Incident[]) => void) => {
  const q = query(collection(db, "incidents"), where("status", "==", "ACTIVATED"));
  return onSnapshot(q, (snap) => {
    const incidents = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Incident));
    callback(incidents);
  });
};

export const broadcastSafetyStatus = async (userId: string) => {
  const safetyRef = collection(db, "safety_checks");
  await addDoc(safetyRef, {
    userId,
    status: 'SAFE',
    timestamp: serverTimestamp(),
    type: 'MANUAL_CHECK'
  });
};

export const saveSyncedContacts = async (userId: string, contacts: SyncedContact[]) => {
  const contactRef = collection(db, "users", userId, "contacts");
  const batch = contacts.map(async (contact) => {
    await addDoc(contactRef, {
      ...contact,
      syncedAt: serverTimestamp()
    });
  });
  await Promise.all(batch);
};

export const addContact = async (userId: string, contact: Omit<SyncedContact, 'id'>) => {
  const contactRef = collection(db, "users", userId, "contacts");
  await addDoc(contactRef, {
    ...contact,
    syncedAt: serverTimestamp()
  });
};

export const deleteContact = async (userId: string, contactId: string) => {
  const contactRef = doc(db, "users", userId, "contacts", contactId);
  const { deleteDoc } = await import("firebase/firestore");
  await deleteDoc(contactRef);
};

export const updateContact = async (userId: string, contactId: string, updates: Partial<SyncedContact>) => {
  const contactRef = doc(db, "users", userId, "contacts", contactId);
  await updateDoc(contactRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
};

export const subscribeToContacts = (userId: string, callback: (contacts: SyncedContact[]) => void) => {
  const contactRef = collection(db, "users", userId, "contacts");
  return onSnapshot(contactRef, (snap) => {
    const contacts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SyncedContact));
    callback(contacts);
  });
};
