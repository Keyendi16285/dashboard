/**
 * Dashboard.massfoia - Shared SSO Authentication
 *
 * Every page loads this first. Unauthenticated users are redirected to the
 * shared Case Tracker login page; on success Case Tracker redirects back to the
 * exact dashboard page they came from with a `?token=` we capture here. This is
 * the single source of truth for auth -- page scripts just call authFetch()
 * (or getActiveToken() for cross-origin links).
 */

const CASETRACKER_LOGIN_URL = "https://casetracker.massfoia.com/login";
const CASETRACKER_LOGOUT_URL = "https://casetracker.massfoia.com/logout?next=login";

// Builds the Case Tracker login URL that returns to THIS exact page after sign-in.
function loginRedirectUrl() {
    return `${CASETRACKER_LOGIN_URL}?redirect_url=${encodeURIComponent(window.location.href)}`;
}

(function enforceAuth() {
    // 1. SSO handshake: capture the ?token= handed back by the Case Tracker login.
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get("token");
    if (tokenFromUrl) {
        sessionStorage.setItem("access_token", tokenFromUrl);
        localStorage.setItem("access_token", tokenFromUrl);

        // Strip the token from the address bar, preserving any other query params.
        urlParams.delete("token");
        const remaining = urlParams.toString();
        const cleanUrl = window.location.protocol + "//" + window.location.host +
            window.location.pathname + (remaining ? `?${remaining}` : "");
        window.history.replaceState({ path: cleanUrl }, "", cleanUrl);
    }

    // 2. Gate: no token -> bounce to the Case Tracker login (returning here).
    const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");
    if (!token) {
        window.location.replace(loginRedirectUrl());
        throw new Error("Redirecting to Case Tracker login...");
    }
})();

// Current bearer token (used by authFetch and by direct cross-origin links).
function getActiveToken() {
    return sessionStorage.getItem("access_token") || localStorage.getItem("access_token");
}

/**
 * Shared fetch wrapper: attaches the bearer token and, on a 401, sends the user
 * back through the Case Tracker login (returning to the current page).
 */
async function authFetch(url, options = {}) {
    options.headers = { ...options.headers, "Authorization": `Bearer ${getActiveToken()}` };
    const response = await fetch(url, options);
    if (response.status === 401) {
        sessionStorage.removeItem("access_token");
        localStorage.removeItem("access_token");
        window.location.replace(loginRedirectUrl());
    }
    return response;
}

function handleLogout() {
    sessionStorage.clear();
    localStorage.removeItem("access_token");
    window.location.replace(CASETRACKER_LOGOUT_URL);
}
