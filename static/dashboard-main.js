/**
 * dashboard-main.js
 * Central navigation for the dashboard.massfoia.com launchpad.
 *
 * Authentication (SSO handshake, the login gate, authFetch and logout) is handled
 * entirely by the shared /static/auth.js, which loads before this file. This file
 * only deals with cross-app navigation.
 */

/**
 * Safely routes the user to an independent application suite domain
 * while appending the current session token to preserve their login context.
 * @param {string} baseUrl - Target destination URL (e.g. https://papers.massfoia.com/)
 */
window.navigateWithToken = function(baseUrl) {
    const token = getActiveToken();

    if (token) {
        // Evaluate if the destination string already utilizes URL queries
        const separator = baseUrl.includes('?') ? '&' : '?';
        window.location.href = `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
    } else {
        // If local reference dropped unexpectedly, send directly to base target to auto-trigger login fallback
        window.location.href = baseUrl;
    }
};

// Logout is provided by the shared auth.js (handleLogout). Expose it under the
// name this page's markup expects.
window.logout = handleLogout;

console.log("MASSFOIA Hub navigation initialized.");