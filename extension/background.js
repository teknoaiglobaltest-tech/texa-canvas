// =============================================
// TEXA Tools Manager - Background Service Worker
// Token Scraping & Auto-Login Flow
// =============================================

// Firebase REST API Configuration
const FIREBASE_PRIMARY = {
    projectId: 'tekno-cfaba',
    tokenPath: 'artifacts/my-token-vault/public/data/tokens/google_oauth_user_1'
};

const FIREBASE_BACKUP = {
    projectId: 'tekno-335f8',
    rtdbUrl: 'https://tekno-335f8-default-rtdb.asia-southeast1.firebasedatabase.app',
    tokenPath: 'texa_tokens/google_oauth_user_1'
};

const GOOGLE_LABS_URL = 'https://labs.google/fx/tools/flow';
const TOKEN_REGEX = /ya29\.[a-zA-Z0-9_-]{100,}/g;

function getFirestoreUrl(projectId, path) {
    return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
}

function getRtdbUrl(path) {
    return `${FIREBASE_BACKUP.rtdbUrl}/${path}.json`;
}

// =============================================
// STATE
// =============================================

let autoLoginTabId = null;
let isAutoLoginInProgress = false;
let tokenFoundCallback = null;

// =============================================
// MAIN SCRAPE FUNCTION
// =============================================

async function scrapeToken(forceNewTab = false) {
    console.log('🔄 TEXA: Starting token scrape...');

    try {
        // Method 1: Try existing Labs tabs
        if (!forceNewTab) {
            const labsTabs = await chrome.tabs.query({ url: '*://labs.google/*' });
            for (const tab of labsTabs) {
                if (!tab.url.includes('accounts.google.com')) {
                    console.log('🔄 TEXA: Found existing Labs tab:', tab.id);
                    const result = await extractTokenFromTab(tab.id);
                    if (result.success) {
                        return result;
                    }
                }
            }
        }

        // Method 2: Start auto-login flow (opens tab, auto-clicks, scrapes)
        console.log('🔄 TEXA: No token found, starting auto-login flow...');
        return await startAutoLoginFlow();

    } catch (error) {
        console.error('🔄 TEXA Error:', error);
        return { success: false, error: error.message };
    }
}

// Extract token from tab
async function extractTokenFromTab(tabId) {
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
                const regex = /ya29\.[a-zA-Z0-9_-]{100,}/g;
                const html = document.documentElement.outerHTML;
                const matches = html.match(regex);
                if (matches && matches.length > 0) {
                    return matches.reduce((a, b) => a.length > b.length ? a : b);
                }
                return null;
            }
        });

        if (results?.[0]?.result) {
            const token = results[0].result;
            console.log('✅ TEXA: Token extracted!');
            await saveToken(token, 'Tab Extraction');
            return { success: true, token, method: 'tab_extraction' };
        }
    } catch (e) {
        console.log('⚠️ TEXA: Cannot extract from tab:', e.message);
    }
    return { success: false };
}

// =============================================
// AUTO-LOGIN FLOW
// =============================================

function startAutoLoginFlow() {
    if (isAutoLoginInProgress) {
        console.log('⏳ TEXA: Auto-login already in progress');
        return Promise.resolve({ success: false, error: 'Already in progress' });
    }

    isAutoLoginInProgress = true;

    return new Promise(async (resolve) => {
        console.log('🚀 TEXA: Starting auto-login flow...');

        // Timeout for entire flow
        const timeout = setTimeout(() => {
            console.log('⏰ TEXA: Auto-login timeout');
            cleanup();
            resolve({ success: false, error: 'Timeout' });
        }, 90000); // 90 seconds for full flow

        const cleanup = async () => {
            isAutoLoginInProgress = false;
            chrome.tabs.onUpdated.removeListener(tabUpdateHandler);
            chrome.runtime.onMessage.removeListener(messageHandler);
            if (autoLoginTabId) {
                try {
                    // Only close if it's our auto-login tab
                    const tab = await chrome.tabs.get(autoLoginTabId);
                    if (tab) {
                        await chrome.tabs.remove(autoLoginTabId);
                        console.log('🗑️ TEXA: Closed auto-login tab');
                    }
                } catch (e) { }
                autoLoginTabId = null;
            }
        };

        // Tab update handler
        const tabUpdateHandler = async (tabId, changeInfo, tab) => {
            if (tabId !== autoLoginTabId) return;

            if (changeInfo.status === 'complete' && tab.url) {
                console.log('📄 TEXA: Tab loaded:', tab.url.substring(0, 50));

                // On Google Labs (not login page) - try to extract token
                if (tab.url.includes('labs.google') && !tab.url.includes('accounts.google.com')) {
                    console.log('✨ TEXA: On Google Labs, waiting to extract...');

                    // Wait for page to fully load
                    await new Promise(r => setTimeout(r, 3000));

                    const result = await extractTokenFromTab(tabId);
                    if (result.success) {
                        clearTimeout(timeout);
                        await cleanup();
                        resolve(result);
                    }
                }
                // On login page - autoLoginScript.js will handle clicking
            }
        };

        // Message handler for token found
        const messageHandler = async (msg, sender) => {
            if (msg.type === 'TEXA_TOKEN_FOUND' && msg.token) {
                console.log('✅ TEXA: Token found via message!');
                clearTimeout(timeout);
                await saveToken(msg.token, msg.source || 'Auto-Login');
                await cleanup();
                resolve({ success: true, token: msg.token, method: 'auto_login' });
            }

            if (msg.type === 'TEXA_AUTO_LOGIN_CLICKED') {
                console.log('👆 TEXA: Account clicked, action:', msg.action);
            }
        };

        chrome.tabs.onUpdated.addListener(tabUpdateHandler);
        chrome.runtime.onMessage.addListener(messageHandler);

        try {
            // Create the tab
            const tab = await chrome.tabs.create({
                url: GOOGLE_LABS_URL,
                active: true  // Make active so user can see if needed
            });

            autoLoginTabId = tab.id;
            console.log('📑 TEXA: Created tab:', tab.id);

        } catch (error) {
            clearTimeout(timeout);
            await cleanup();
            resolve({ success: false, error: error.message });
        }
    });
}

// =============================================
// TOKEN STORAGE
// =============================================

async function saveToken(token, source) {
    const timestamp = new Date().toISOString();
    console.log('💾 TEXA: Saving token from:', source);

    // Save to local storage immediately
    await chrome.storage.local.set({
        'texa_bearer_token': token,
        'texa_token_updated': timestamp,
        'texa_token_source': source
    });

    // Save to Firebase (primary + backup)
    const results = await Promise.allSettled([
        saveToPrimary(token, source, timestamp),
        saveToBackup(token, source, timestamp)
    ]);

    console.log('💾 TEXA: Primary:', results[0].status, '| Backup:', results[1].status);
    return results[0].status === 'fulfilled' || results[1].status === 'fulfilled';
}

async function saveToPrimary(token, source, timestamp) {
    const url = getFirestoreUrl(FIREBASE_PRIMARY.projectId, FIREBASE_PRIMARY.tokenPath);
    const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fields: {
                token: { stringValue: token },
                id: { stringValue: 'google_oauth_user_1' },
                updatedAt: { timestampValue: timestamp },
                source: { stringValue: source }
            }
        })
    });
    if (!response.ok) throw new Error(`Primary error: ${response.status}`);
    return { success: true };
}

async function saveToBackup(token, source, timestamp) {
    const url = getRtdbUrl(FIREBASE_BACKUP.tokenPath);
    const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            token,
            id: 'google_oauth_user_1',
            updatedAt: timestamp,
            source
        })
    });
    if (!response.ok) throw new Error(`Backup error: ${response.status}`);
    return { success: true };
}

async function getToken() {
    // Try primary Firebase
    try {
        const url = getFirestoreUrl(FIREBASE_PRIMARY.projectId, FIREBASE_PRIMARY.tokenPath);
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            const token = data.fields?.token?.stringValue;
            if (token) {
                return { success: true, token, source: 'primary', updatedAt: data.fields?.updatedAt?.timestampValue };
            }
        }
    } catch (e) {
        console.log('⚠️ TEXA: Primary fetch failed');
    }

    // Try backup Firebase
    try {
        const url = getRtdbUrl(FIREBASE_BACKUP.tokenPath);
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            if (data?.token) {
                return { success: true, token: data.token, source: 'backup', updatedAt: data.updatedAt };
            }
        }
    } catch (e) {
        console.log('⚠️ TEXA: Backup fetch failed');
    }

    // Try local cache
    const cached = await chrome.storage.local.get(['texa_bearer_token', 'texa_token_updated']);
    if (cached.texa_bearer_token) {
        return { success: true, token: cached.texa_bearer_token, source: 'cache', updatedAt: cached.texa_token_updated };
    }

    return { success: false, error: 'No token found' };
}

// =============================================
// MESSAGE HANDLERS
// =============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const type = message.type || message.action;
    console.log('📨 TEXA Background:', type);

    switch (type) {
        case 'TEXA_TOKEN_FOUND':
            saveToken(message.token, message.source || 'Content Script');
            sendResponse({ success: true });
            break;

        case 'TEXA_SCRAPE_TOKEN':
            scrapeToken(message.forceNew)
                .then(r => sendResponse(r))
                .catch(e => sendResponse({ success: false, error: e.message }));
            return true;

        case 'TEXA_GET_TOKEN':
            getToken()
                .then(r => sendResponse(r))
                .catch(e => sendResponse({ success: false, error: e.message }));
            return true;

        case 'TEXA_AUTO_LOGIN_CLICKED':
            console.log('👆 TEXA: Account clicked:', message.action);
            sendResponse({ success: true });
            break;

        case 'TEXA_OPEN_TOOL':
            handleOpenTool(message)
                .then(r => sendResponse(r))
                .catch(e => sendResponse({ success: false, error: e.message }));
            return true;

        case 'SAVE_TOKEN':
            saveToken(message.payload?.token, message.payload?.service)
                .then(() => sendResponse({ status: 'success' }))
                .catch(e => sendResponse({ status: 'error', msg: e.message }));
            return true;
    }
});

// =============================================
// TOOL OPENING
// =============================================

async function handleOpenTool(data) {
    const { targetUrl, apiUrl, authHeader } = data;

    if (!apiUrl) {
        await chrome.tabs.create({ url: targetUrl });
        return { success: true };
    }

    try {
        const response = await fetch(apiUrl, authHeader ? { headers: { 'Authorization': authHeader } } : {});
        if (response.ok) {
            const cookiesData = await response.json();
            const cookies = extractCookies(cookiesData);
            for (const cookie of cookies) {
                try { await setCookie(cookie, targetUrl); } catch (e) { }
            }
        }
    } catch (e) { }

    await chrome.tabs.create({ url: targetUrl });
    return { success: true };
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
    return Array.isArray(data) ? data : (data.cookies || []);
}

function setCookie(c, targetUrl) {
    const domain = c.domain || new URL(targetUrl).hostname;
    return chrome.cookies.set({
        url: c.url || `https://${domain.replace(/^\./, '')}${c.path || '/'}`,
        name: c.name,
        value: c.value,
        path: c.path || '/',
        secure: c.secure !== false,
        httpOnly: c.httpOnly === true,
        domain: c.domain,
        expirationDate: c.expirationDate,
        sameSite: c.sameSite
    });
}

// =============================================
// LIFECYCLE EVENTS
// =============================================

chrome.runtime.onStartup.addListener(() => {
    console.log('🔄 TEXA: Extension started');
    setTimeout(() => scrapeToken(), 5000);
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('✅ TEXA: Extension installed');
    chrome.alarms.create('tokenRefresh', { periodInMinutes: 30 });
    setTimeout(() => scrapeToken(), 10000);
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'tokenRefresh') {
        console.log('⏰ TEXA: Periodic refresh');
        scrapeToken();
    }
});

// Auto-scrape when visiting Labs
chrome.webNavigation.onCompleted.addListener((details) => {
    if (details.url.includes('labs.google') && !details.url.includes('accounts.google.com')) {
        console.log('📍 TEXA: User on Labs, scraping...');
        setTimeout(() => extractTokenFromTab(details.tabId), 2000);
    }
}, { url: [{ hostContains: 'labs.google' }] });

console.log('🚀 TEXA Tools Manager - Background Loaded');
