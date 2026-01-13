// Admin Service - Manage Users and Subscriptions
import {
    collection,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    where,
    onSnapshot,
    Timestamp,
    addDoc,
    limit
} from "firebase/firestore";
import { ref, set, remove, onValue, get } from "firebase/database";
import { auth, db, rtdb, TexaUser, COLLECTIONS, RTDB_PATHS } from "./firebase";

// Collection names - use from centralized config
const USERS_COLLECTION = COLLECTIONS.USERS;
const SUBSCRIPTIONS_COLLECTION = COLLECTIONS.TRANSACTIONS;

// Subscription Plan Interface
export interface SubscriptionPlan {
    id: string;
    name: string;
    durationDays: number;
    price: number;
    features: string[];
}

// Subscription Record Interface
export interface SubscriptionRecord {
    id: string;
    userId: string;
    userEmail: string;
    planName: string;
    startDate: string;
    endDate: string;
    price: number;
    status: 'active' | 'expired' | 'cancelled' | 'paid' | 'pending';
    createdAt: string;
}

// Stats Interface
export interface AdminStats {
    totalUsers: number;
    activeSubscriptions: number;
    expiredSubscriptions: number;
    totalRevenue: number;
    newUsersToday: number;
    adminCount: number;
}

// Get All Users (Realtime)
export const subscribeToUsers = (callback: (users: TexaUser[]) => void) => {
    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(usersRef, orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
        const users: TexaUser[] = [];
        snapshot.forEach((doc) => {
            users.push({ ...doc.data(), id: doc.id } as TexaUser);
        });
        callback(users);
    }, (error) => {
        console.error('Error fetching users:', error);
        callback([]);
    });
};

// Get All Users (One-time)
export const getAllUsers = async (): Promise<TexaUser[]> => {
    try {
        const usersRef = collection(db, USERS_COLLECTION);
        const q = query(usersRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        const users: TexaUser[] = [];
        snapshot.forEach((doc) => {
            users.push({ ...doc.data(), id: doc.id } as TexaUser);
        });

        return users;
    } catch (error) {
        console.error('Error getting users:', error);
        return [];
    }
};

export const createManualMember = async (input: {
    email: string;
    name?: string;
    role?: 'ADMIN' | 'MEMBER';
    isActive?: boolean;
    subscriptionDays?: number;
}): Promise<{ success: boolean; action?: 'updated' | 'created' }> => {
    const email = (input.email || '').trim().toLowerCase();
    const role = input.role ?? 'MEMBER';
    const isActive = input.isActive ?? true;
    const name = (input.name || '').trim();

    if (!email) throw new Error('Email tidak valid');

    const result = await callAdminApi<{ success: true; uid: string; action: 'created' | 'updated' }>(
        '/api/admin/create-user',
        {
            email,
            name,
            role,
            isActive,
            subscriptionDays: input.subscriptionDays
        }
    );

    return { success: true, action: result.action };
};

const ADMIN_API_BASE =
    (import.meta as any).env?.VITE_ADMIN_API_BASE || (import.meta.env.PROD ? '' : 'http://127.0.0.1:8787');

const callAdminApi = async <T>(path: string, body: any): Promise<T> => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Anda harus login sebagai admin');

    let res: Response;
    try {
        res = await fetch(`${ADMIN_API_BASE}${path}`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });
    } catch {
        throw new Error('Server admin belum jalan');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) throw new Error(data?.message || 'Permintaan gagal');
    return data as T;
};

export const createAuthMemberWithPassword = async (input: {
    email: string;
    password: string;
    name?: string;
    role?: 'ADMIN' | 'MEMBER';
    isActive?: boolean;
    subscriptionDays?: number;
}): Promise<{ success: true; uid: string; action: 'created' | 'updated' }> => {
    return callAdminApi('/api/admin/create-user', input);
};

export const setMemberPassword = async (input: {
    uid?: string;
    email?: string;
    password: string;
}): Promise<{ success: true }> => {
    return callAdminApi('/api/admin/set-password', input);
};

// Update User
export const updateUser = async (userId: string, data: Partial<TexaUser>): Promise<boolean> => {
    try {
        const userRef = doc(db, USERS_COLLECTION, userId);
        await updateDoc(userRef, {
            ...data,
            updatedAt: new Date().toISOString()
        });

        // Also update RTDB
        if (data.role || data.isActive !== undefined) {
            await set(ref(rtdb, `${RTDB_PATHS.USERS}/${userId}`), {
                role: data.role,
                isActive: data.isActive,
                updatedAt: new Date().toISOString()
            });
        }

        return true;
    } catch (error) {
        console.error('Error updating user:', error);
        return false;
    }
};

// Delete User
export const deleteUser = async (userId: string): Promise<boolean> => {
    try {
        // Delete from Firestore
        await deleteDoc(doc(db, USERS_COLLECTION, userId));

        // Delete from RTDB
        await remove(ref(rtdb, `${RTDB_PATHS.USERS}/${userId}`));

        return true;
    } catch (error) {
        console.error('Error deleting user:', error);
        return false;
    }
};

// Toggle User Active Status
export const toggleUserStatus = async (userId: string, isActive: boolean): Promise<boolean> => {
    return updateUser(userId, { isActive });
};

// Change User Role
export const changeUserRole = async (userId: string, role: 'ADMIN' | 'MEMBER'): Promise<boolean> => {
    return updateUser(userId, { role });
};

// Set User Subscription
export const setUserSubscription = async (
    userId: string,
    durationDays: number,
    planName: string = 'Premium',
    price: number = 0,
    userEmail?: string
): Promise<boolean> => {
    try {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + durationDays);

        // Update user's subscription end date
        await updateUser(userId, {
            subscriptionEnd: endDate.toISOString()
        });

        // Create subscription record
        const subscriptionData: Omit<SubscriptionRecord, 'id'> = {
            userId,
            userEmail: (userEmail || '').trim().toLowerCase(),
            planName,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            price,
            status: 'paid',
            createdAt: new Date().toISOString()
        };

        await addDoc(collection(db, SUBSCRIPTIONS_COLLECTION), subscriptionData);

        return true;
    } catch (error) {
        console.error('Error setting subscription:', error);
        return false;
    }
};

export const subscribeToSubscriptionRecords = (callback: (records: SubscriptionRecord[]) => void) => {
    const refCol = collection(db, SUBSCRIPTIONS_COLLECTION);
    const q = query(refCol, orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
        const records: SubscriptionRecord[] = [];
        snapshot.forEach((docSnap) => {
            records.push({ ...docSnap.data(), id: docSnap.id } as SubscriptionRecord);
        });
        callback(records);
    }, (error) => {
        console.error('Error fetching transactions:', error);
        callback([]);
    });
};

export const calculateTotalRevenue = (records: SubscriptionRecord[]): number => {
    return records
        .filter((r) => {
            const status = String((r as any).status || '').toLowerCase();
            const isPaidLike =
                status === '' ||
                status === 'paid' ||
                status === 'active' ||
                status === 'success' ||
                status === 'settlement' ||
                status === 'completed';
            return isPaidLike && typeof r.price === 'number' && r.price > 0;
        })
        .reduce((sum, r) => sum + r.price, 0);
};

// Remove User Subscription
export const removeUserSubscription = async (userId: string): Promise<boolean> => {
    try {
        await updateUser(userId, {
            subscriptionEnd: null
        });
        return true;
    } catch (error) {
        console.error('Error removing subscription:', error);
        return false;
    }
};

// Get Admin Stats
export const getAdminStats = (users: TexaUser[], totalRevenue: number = 0): AdminStats => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const activeSubscriptions = users.filter(u =>
        u.subscriptionEnd && new Date(u.subscriptionEnd) > now
    ).length;

    const expiredSubscriptions = users.filter(u =>
        u.subscriptionEnd && new Date(u.subscriptionEnd) <= now
    ).length;

    const newUsersToday = users.filter(u =>
        u.createdAt && new Date(u.createdAt) >= today
    ).length;

    const adminCount = users.filter(u => u.role === 'ADMIN').length;

    return {
        totalUsers: users.length,
        activeSubscriptions,
        expiredSubscriptions,
        totalRevenue,
        newUsersToday,
        adminCount
    };
};

// Search Users
export const searchUsers = (users: TexaUser[], searchTerm: string): TexaUser[] => {
    if (!searchTerm.trim()) return users;

    const term = searchTerm.toLowerCase();
    return users.filter(user =>
        user.email.toLowerCase().includes(term) ||
        user.name.toLowerCase().includes(term) ||
        user.id.toLowerCase().includes(term)
    );
};

// Filter Users by Status
export const filterUsersByStatus = (
    users: TexaUser[],
    filter: 'all' | 'active' | 'expired' | 'admin' | 'member'
): TexaUser[] => {
    const now = new Date();

    switch (filter) {
        case 'active':
            return users.filter(u => u.subscriptionEnd && new Date(u.subscriptionEnd) > now);
        case 'expired':
            return users.filter(u => !u.subscriptionEnd || new Date(u.subscriptionEnd) <= now);
        case 'admin':
            return users.filter(u => u.role === 'ADMIN');
        case 'member':
            return users.filter(u => u.role === 'MEMBER');
        default:
            return users;
    }
};

// Format Date for Display
export const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Calculate Days Remaining
export const getDaysRemaining = (endDate: string | null): number | null => {
    if (!endDate) return null;
    const now = new Date();
    const end = new Date(endDate);
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
};

// Get Status Badge
export const getSubscriptionStatus = (endDate: string | null): 'active' | 'expired' | 'none' => {
    if (!endDate) return 'none';
    const daysRemaining = getDaysRemaining(endDate);
    if (daysRemaining === null || daysRemaining <= 0) return 'expired';
    return 'active';
};
