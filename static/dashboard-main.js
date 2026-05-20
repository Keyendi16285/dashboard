/**
 * dashboard-main.js
 * Central navigation, session management, and authentication routing
 * for dashboard.massfoia.com
 */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Extract token from URL if redirected from a login provider
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');

    if (tokenFromUrl) {
        // Store the token securely for the duration of the browser session
        sessionStorage.setItem("access_token", tokenFromUrl);
        
        // Clean up the URL query string so the token isn't exposed in the address bar
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
    }

    // 2. Enforce Session Authentication
    const token = sessionStorage.getItem("access_token");
    if (!token) {
        // If no token is found, redirect to the login interface
        // Update this URL if your login screen is located at a different path or domain (e.g., https://auth.massfoia.com)
        window.location.href = "/login.html"; 
        return;
    }

    // Initialize dashboard elements if authentication passes
    initializeDashboard();
});

/**
 * Safely redirects the user to an independent MASSFOIA application
 * while passing the current session token as a query parameter.
 * * @param {string} baseUrl - The target application destination URL
 */
function navigateWithToken(baseUrl) {
    // Retrieve the token from session storage [cite: 1]
    const token = sessionStorage.getItem("access_token");
    
    if (token) {
        // Determine if the URL already contains an existing query parameter string
        const separator = baseUrl.includes('?') ? '&' : '?';
        // Append the token to the URL so the destination app can recognize the session [cite: 5, 43]
        window.location.href = `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
    } else {
        // Fallback to base URL if session token is missing (the destination app will catch and redirect to login)
        window.location.href = baseUrl;
    }
}

/**
 * Destroys the current session token and routes the user back to the login screen.
 */
function logout() {
    sessionStorage.removeItem("access_token");
    window.location.href = "/login.html";
}

/**
 * Runs setup requirements for the Hub page upon verification of a valid session.
 */
function initializeDashboard() {
    console.log("MASSFOIA Application Hub initialized successfully.");
    // You can extend this function to inject user profile information into the UI if desired
}