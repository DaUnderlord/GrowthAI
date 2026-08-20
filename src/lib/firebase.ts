import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  getDoc,
  setDoc, 
  doc, 
  onSnapshot, 
  deleteDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Campaign, ClientProfile, ContentCalendarItem, UserProfile, UserRole, UserPrivileges } from '../types';
import { MOCK_CAMPAIGN_DATA } from '../data/mockCampaigns';
import { INITIAL_MOCK_CALENDAR } from '../data/mockCalendar';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore using the designated databaseId
const db = getFirestore(
  app, 
  firebaseConfig.firestoreDatabaseId || '(default)'
);

// Initialize Firebase Auth
const auth = getAuth(app);

export { app, db, auth };

// Collections
export const CLIENTS_COLLECTION = 'clients';
export const USERS_COLLECTION = 'users';
export const INVOICES_COLLECTION = 'invoices';
export const CAMPAIGNS_COLLECTION = 'campaigns';
export const CALENDAR_COLLECTION = 'calendarItems';

// Default Privileges Generator
export function getDefaultPrivileges(role: UserRole): UserPrivileges {
  if (role === 'super_admin' || role === 'admin') {
    return {
      can_create_account: true,
      can_delete_social_handle: true,
      can_add_team: true,
      can_invoice_management: true,
      can_manage_campaigns: true,
      can_manage_calendar: true,
      can_sync_social: true,
    };
  }
  if (role === 'manager') {
    return {
      can_create_account: false,
      can_delete_social_handle: false,
      can_add_team: false,
      can_invoice_management: true,
      can_manage_campaigns: true,
      can_manage_calendar: true,
      can_sync_social: true,
    };
  }
  return {
    can_create_account: false,
    can_delete_social_handle: false,
    can_add_team: false,
    can_invoice_management: false,
    can_manage_campaigns: true,
    can_manage_calendar: true,
    can_sync_social: false,
  };
}

// --- FIREBASE AUTHENTICATION FUNCTIONS ---

// 1. Register User with Firebase
export async function registerUserWithFirebase(
  email: string,
  pass: string,
  fullName: string,
  phone: string = '',
  companyName: string = '',
  role: UserRole = 'admin',
  avatarUrl?: string
): Promise<UserProfile> {
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  const uid = cred.user.uid;
  const avatar = avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=6366f1&color=fff&size=128`;
  
  const userProfile: UserProfile = {
    id: uid,
    name: fullName,
    email: email,
    phone: phone,
    companyName: companyName,
    role: role,
    avatar: avatar,
    createdAt: new Date().toISOString(),
    department: 'Growth Operations',
    privileges: getDefaultPrivileges(role)
  };

  await setDoc(doc(db, USERS_COLLECTION, uid), userProfile);
  return userProfile;
}

// 2. Login User with Firebase
export async function loginUserWithFirebase(email: string, pass: string): Promise<UserProfile> {
  const cred = await signInWithEmailAndPassword(auth, email, pass);
  const uid = cred.user.uid;
  const profileDoc = await getDoc(doc(db, USERS_COLLECTION, uid));
  
  if (profileDoc.exists()) {
    return profileDoc.data() as UserProfile;
  } else {
    // If user exists in Auth but not in Firestore yet, create default record
    const userProfile: UserProfile = {
      id: uid,
      name: cred.user.displayName || email.split('@')[0],
      email: email,
      role: 'admin',
      avatar: cred.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(email)}&background=6366f1&color=fff`,
      createdAt: new Date().toISOString(),
      privileges: getDefaultPrivileges('admin')
    };
    await setDoc(doc(db, USERS_COLLECTION, uid), userProfile);
    return userProfile;
  }
}

// 3. Login with Google Popup
export async function loginWithGoogle(): Promise<UserProfile> {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  const uid = cred.user.uid;
  const profileDoc = await getDoc(doc(db, USERS_COLLECTION, uid));
  
  if (profileDoc.exists()) {
    return profileDoc.data() as UserProfile;
  } else {
    const name = cred.user.displayName || cred.user.email?.split('@')[0] || 'User';
    const email = cred.user.email || '';
    const avatar = cred.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`;
    
    const userProfile: UserProfile = {
      id: uid,
      name,
      email,
      role: 'super_admin',
      avatar,
      createdAt: new Date().toISOString(),
      privileges: getDefaultPrivileges('super_admin')
    };
    await setDoc(doc(db, USERS_COLLECTION, uid), userProfile);
    return userProfile;
  }
}

// 4. Logout User
export async function logoutFirebase(): Promise<void> {
  await signOut(auth);
}

// 5. Auth State Listener
export function subscribeToAuthState(onUserChanged: (userProfile: UserProfile | null) => void) {
  return onAuthStateChanged(auth, async (fbUser) => {
    if (fbUser) {
      try {
        const profileDoc = await getDoc(doc(db, USERS_COLLECTION, fbUser.uid));
        if (profileDoc.exists()) {
          onUserChanged(profileDoc.data() as UserProfile);
        } else {
          // Construct fallback
          const userProfile: UserProfile = {
            id: fbUser.uid,
            name: fbUser.displayName || fbUser.email?.split('@')[0] || 'GrowthOS Member',
            email: fbUser.email || '',
            role: 'super_admin',
            avatar: fbUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(fbUser.email || 'User')}&background=6366f1&color=fff`,
            createdAt: new Date().toISOString(),
            privileges: getDefaultPrivileges('super_admin')
          };
          await setDoc(doc(db, USERS_COLLECTION, fbUser.uid), userProfile);
          onUserChanged(userProfile);
        }
      } catch (err) {
        console.warn('Error fetching user profile from Firestore:', err);
        onUserChanged(null);
      }
    } else {
      onUserChanged(null);
    }
  });
}

// --- SEED INITIAL DATA IF FIRESTORE IS EMPTY ---
export async function seedFirestoreIfEmpty(
  initialClients: ClientProfile[], 
  initialUsers: UserProfile[]
) {
  try {
    const clientsSnap = await getDocs(collection(db, CLIENTS_COLLECTION));
    if (clientsSnap.empty) {
      console.log('Seeding initial client data into Firestore...');
      for (const client of initialClients) {
        await setDoc(doc(db, CLIENTS_COLLECTION, client.id), client);
      }
    }

    const usersSnap = await getDocs(collection(db, USERS_COLLECTION));
    if (usersSnap.empty) {
      console.log('Seeding initial user data into Firestore...');
      for (const user of initialUsers) {
        await setDoc(doc(db, USERS_COLLECTION, user.id), user);
      }
    }

    const campaignsSnap = await getDocs(collection(db, CAMPAIGNS_COLLECTION));
    if (campaignsSnap.empty) {
      console.log('Seeding initial campaign data into Firestore...');
      const allCampaigns = Object.values(MOCK_CAMPAIGN_DATA).flat();
      for (const campaign of allCampaigns) {
        await setDoc(doc(db, CAMPAIGNS_COLLECTION, campaign.id), campaign);
      }
    }

    const calendarSnap = await getDocs(collection(db, CALENDAR_COLLECTION));
    if (calendarSnap.empty) {
      console.log('Seeding initial calendar data into Firestore...');
      for (const item of INITIAL_MOCK_CALENDAR) {
        await setDoc(doc(db, CALENDAR_COLLECTION, item.id), item);
      }
    }
  } catch (err) {
    console.warn('Firestore seeding check encountered an issue (non-blocking):', err);
  }
}

// Real-time listener for clients
export function subscribeToClients(onUpdate: (clients: ClientProfile[]) => void) {
  return onSnapshot(collection(db, CLIENTS_COLLECTION), (snapshot) => {
    const clientList: ClientProfile[] = [];
    snapshot.forEach((docSnap) => {
      clientList.push(docSnap.data() as ClientProfile);
    });
    if (clientList.length > 0) {
      onUpdate(clientList);
    }
  }, (err) => {
    console.warn('Error subscribing to Firestore clients:', err);
  });
}

// Real-time listener for users
export function subscribeToUsers(onUpdate: (users: UserProfile[]) => void) {
  return onSnapshot(collection(db, USERS_COLLECTION), (snapshot) => {
    const userList: UserProfile[] = [];
    snapshot.forEach((docSnap) => {
      userList.push(docSnap.data() as UserProfile);
    });
    if (userList.length > 0) {
      onUpdate(userList);
    }
  }, (err) => {
    console.warn('Error subscribing to Firestore users:', err);
  });
}

// Firestore operations
export async function saveClientToFirestore(client: ClientProfile) {
  try {
    await setDoc(doc(db, CLIENTS_COLLECTION, client.id), client, { merge: true });
  } catch (err) {
    console.error('Failed to save client to Firestore:', err);
  }
}

export async function saveUserToFirestore(user: UserProfile) {
  try {
    await setDoc(doc(db, USERS_COLLECTION, user.id), user, { merge: true });
  } catch (err) {
    console.error('Failed to save user to Firestore:', err);
  }
}

export function subscribeToCampaigns(
  clientId: string,
  onUpdate: (campaigns: Campaign[]) => void
) {
  return onSnapshot(collection(db, CAMPAIGNS_COLLECTION), (snapshot) => {
    const campaigns: Campaign[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Campaign;
      if (data.clientId === clientId) {
        campaigns.push(data);
      }
    });
    onUpdate(campaigns);
  }, (err) => {
    console.warn('Error subscribing to Firestore campaigns:', err);
  });
}

export async function saveCampaignToFirestore(campaign: Campaign) {
  try {
    await setDoc(doc(db, CAMPAIGNS_COLLECTION, campaign.id), campaign, { merge: true });
  } catch (err) {
    console.error('Failed to save campaign to Firestore:', err);
    throw err;
  }
}

export async function deleteCampaignFromFirestore(campaignId: string) {
  try {
    await deleteDoc(doc(db, CAMPAIGNS_COLLECTION, campaignId));
  } catch (err) {
    console.error('Failed to delete campaign from Firestore:', err);
    throw err;
  }
}

export function subscribeToCalendarItems(
  clientId: string,
  onUpdate: (items: ContentCalendarItem[]) => void
) {
  return onSnapshot(collection(db, CALENDAR_COLLECTION), (snapshot) => {
    const items: ContentCalendarItem[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as ContentCalendarItem;
      if (data.clientId === clientId) {
        items.push({
          ...data,
          clientId: data.clientId || clientId,
        });
      }
    });
    items.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    onUpdate(items);
  }, (err) => {
    console.warn('Error subscribing to Firestore calendar items:', err);
  });
}

export async function saveCalendarItemToFirestore(item: ContentCalendarItem) {
  try {
    await setDoc(doc(db, CALENDAR_COLLECTION, item.id), item, { merge: true });
  } catch (err) {
    console.error('Failed to save calendar item to Firestore:', err);
    throw err;
  }
}

export async function deleteCalendarItemFromFirestore(itemId: string) {
  try {
    await deleteDoc(doc(db, CALENDAR_COLLECTION, itemId));
  } catch (err) {
    console.error('Failed to delete calendar item from Firestore:', err);
    throw err;
  }
}

export async function saveCalendarItemsToFirestore(items: ContentCalendarItem[]) {
  try {
    await Promise.all(
      items.map((item) => setDoc(doc(db, CALENDAR_COLLECTION, item.id), item, { merge: true }))
    );
  } catch (err) {
    console.error('Failed to save calendar items to Firestore:', err);
    throw err;
  }
}
