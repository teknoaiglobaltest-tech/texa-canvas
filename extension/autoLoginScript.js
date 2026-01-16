// =============================================
// TEXA Auto-Login Content Script
// Automatically clicks Google account for login
// Injected into accounts.google.com pages
// =============================================

(function () {
    console.log('TEXA: Auto-Login Script Active on', window.location.href);

    // Check if this is the account chooser page
    const isAccountChooser = window.location.href.includes('accounts.google.com') &&
        (window.location.href.includes('accountchooser') ||
            window.location.href.includes('signin') ||
            window.location.href.includes('oauth'));

    if (!isAccountChooser) {
        console.log('TEXA: Not account chooser page, skipping');
        return;
    }

    // Function to find and click the first available account
    function autoSelectAccount() {
        console.log('TEXA: Looking for Google accounts to click...');

        // Multiple selectors for different Google sign-in page variants
        const accountSelectors = [
            // Account list items (div with data-identifier)
            'div[data-identifier]',
            // Account buttons in list
            '.JDAKTe',
            // Account row containers
            '.aZvCDf',
            // Email/name text that's clickable
            '.lCoei.YZVTmd',
            // Use different account link
            '.BHzsHc',
            // Primary account container
            '.Xb9hP',
            // Account card
            '.g6SGLF'
        ];

        for (const selector of accountSelectors) {
            const accounts = document.querySelectorAll(selector);
            if (accounts.length > 0) {
                console.log(`TEXA: Found ${accounts.length} account(s) with selector: ${selector}`);

                // Click the first account (primary account)
                const firstAccount = accounts[0];
                console.log('TEXA: Auto-clicking first account...');

                // Trigger click
                firstAccount.click();

                // Also try dispatching events for more reliability
                firstAccount.dispatchEvent(new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                }));

                console.log('TEXA: Account clicked!');
                return true;
            }
        }

        return false;
    }

    // Function to click "Continue" or "Allow" buttons
    function autoClickContinue() {
        const continueSelectors = [
            // Continue button
            'button[data-idom-class*="continue"]',
            '#continue',
            'button:contains("Continue")',
            // Allow button for permissions
            '#submit_approve_access',
            'button[data-idom-class*="allow"]',
            // Next button
            'button.VfPpkd-LgbsSe[type="button"]',
            // Primary action button
            '.VfPpkd-LgbsSe-OWXEXe-k8QpJ'
        ];

        for (const selector of continueSelectors) {
            try {
                const buttons = document.querySelectorAll(selector);
                for (const button of buttons) {
                    const text = button.textContent?.toLowerCase() || '';
                    if (text.includes('continue') || text.includes('allow') || text.includes('next') ||
                        text.includes('lanjutkan') || text.includes('izinkan')) {
                        console.log('TEXA: Auto-clicking continue/allow button...');
                        button.click();
                        return true;
                    }
                }
            } catch (e) { }
        }

        return false;
    }

    // Run with retries
    let attempts = 0;
    const maxAttempts = 10;

    const interval = setInterval(() => {
        attempts++;
        console.log(`TEXA: Auto-login attempt ${attempts}/${maxAttempts}`);

        // Try to select account first
        if (autoSelectAccount()) {
            clearInterval(interval);
            console.log('TEXA: Auto-login completed!');

            // Notify background script
            chrome.runtime.sendMessage({
                type: 'TEXA_AUTO_LOGIN_CLICKED',
                url: window.location.href
            });
            return;
        }

        // Try to click continue/allow
        if (autoClickContinue()) {
            console.log('TEXA: Clicked continue/allow, waiting for next step...');
            // Don't stop interval, might need more clicks
        }

        if (attempts >= maxAttempts) {
            clearInterval(interval);
            console.log('TEXA: Max attempts reached, manual login may be required');
        }
    }, 1500);

    // Initial delay before starting
    setTimeout(() => {
        autoSelectAccount() || autoClickContinue();
    }, 1000);

    // Also observe DOM changes for dynamic content
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                // New content loaded, try to click
                setTimeout(() => {
                    autoSelectAccount() || autoClickContinue();
                }, 500);
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Cleanup after 30 seconds
    setTimeout(() => {
        clearInterval(interval);
        observer.disconnect();
    }, 30000);

})();
