
// Background service worker for TEXA Tools Manager

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TEXA_OPEN_TOOL') {
    handleOpenTool(message).then(sendResponse);
    return true; // Keep channel open for async response
  }
});

async function handleOpenTool(data) {
  const { toolId, targetUrl, apiUrl } = data;
  console.log('Opening tool:', toolId, 'Target:', targetUrl, 'API:', apiUrl);

  try {
    if (!apiUrl) {
      // If no API URL, just open the target URL directly (fallback)
      await chrome.tabs.create({ url: targetUrl });
      return { success: true, message: 'Opened directly (no API URL)' };
    }

    // 1. Fetch cookies from API
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch cookies: ${response.statusText}`);
    }
    
    let cookiesData = await response.json();
    let cookies = [];

    // 2. Parse Data (Handle Firestore or standard JSON)
    // Check if it's a Firestore Document response
    if (cookiesData.fields) {
      console.log('Detected Firestore response');
      cookies = extractCookiesFromFirestore(cookiesData.fields);
    } 
    // Handle standard JSON
    else if (Array.isArray(cookiesData)) {
      cookies = cookiesData;
    } else if (cookiesData.cookies && Array.isArray(cookiesData.cookies)) {
      cookies = cookiesData.cookies;
    } else {
      // If it's a single object or unknown format, try to wrap it
      console.warn('Unknown cookie format, attempting to parse as list', cookiesData);
      cookies = [cookiesData];
    }

    if (!cookies || cookies.length === 0) {
      console.warn('No cookies found in response');
    }

    // 3. Inject cookies
    let injectedCount = 0;
    for (const cookie of cookies) {
      try {
        await setCookie(cookie, targetUrl);
        injectedCount++;
      } catch (err) {
        console.error('Failed to set cookie:', cookie, err);
      }
    }

    console.log(`Injected ${injectedCount} cookies`);

    // 4. Open Target URL
    await chrome.tabs.create({ url: targetUrl });
    
    return { success: true, injectedCount };

  } catch (error) {
    console.error('Error in handleOpenTool:', error);
    return { success: false, error: error.message };
  }
}

function extractCookiesFromFirestore(fields) {
  // Try to find a field that contains the cookie data
  // Common field names: 'cookies', 'data', 'json', 'content'
  // Or just look for the first field that looks like an array or a JSON string
  
  for (const key in fields) {
    const field = fields[key];
    
    // Case A: Stored as a JSON string in stringValue
    if (field.stringValue) {
      try {
        const parsed = JSON.parse(field.stringValue);
        if (Array.isArray(parsed)) return parsed;
        if (parsed.cookies && Array.isArray(parsed.cookies)) return parsed.cookies;
      } catch (e) {
        // Not a JSON string, ignore
      }
    }
    
    // Case B: Stored as a Firestore Array (arrayValue)
    // This is harder to map back to simple JSON, assuming user used JSON string for simplicity
    // But if they used structured data:
    if (field.arrayValue && field.arrayValue.values) {
      // TODO: Map Firestore array structure back to JS objects if needed
      // For now, prioritize JSON string parsing as it's most likely for "cookies"
    }
  }

  // Fallback: If specific fields exist
  if (fields.cookies && fields.cookies.stringValue) {
    try { return JSON.parse(fields.cookies.stringValue); } catch(e){}
  }

  return [];
}

function setCookie(cookieData, targetUrl) {
  // Normalize cookie data for chrome.cookies.set
  // Chrome expects: url, name, value, domain, path, secure, httpOnly, expirationDate, etc.
  
  // Calculate URL for the cookie if not provided
  // If domain starts with ., remove it for protocol prepending
  const domain = cookieData.domain || new URL(targetUrl).hostname;
  const rawDomain = domain.startsWith('.') ? domain.substring(1) : domain;
  // Ensure url is valid
  let url = cookieData.url;
  if (!url) {
     url = `https://${rawDomain}${cookieData.path || '/'}`;
  }

  const cookieDetails = {
    url: url,
    name: cookieData.name,
    value: cookieData.value,
    path: cookieData.path || '/',
    secure: cookieData.secure !== false, // Default to true unless explicitly false
    httpOnly: cookieData.httpOnly === true,
    // sameSite: cookieData.sameSite || 'no_restriction', // Optional, be careful
    // storeId: ... // defaults to current execution context
  };

  if (cookieData.domain) {
    cookieDetails.domain = cookieData.domain;
  }
  
  if (cookieData.expirationDate) {
    cookieDetails.expirationDate = cookieData.expirationDate;
  }

  return chrome.cookies.set(cookieDetails);
}
