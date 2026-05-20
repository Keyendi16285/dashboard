// /**
//  * dashboard-main.js
//  * Central navigation, session management, and authentication routing
//  * for dashboard.massfoia.com
//  */

// document.addEventListener("DOMContentLoaded", () => {
//     // 1. Extract token from URL if redirected from a login provider
//     const urlParams = new URLSearchParams(window.location.search);
//     const tokenFromUrl = urlParams.get('token');

//     if (tokenFromUrl) {
//         // Store the token securely for the duration of the browser session
//         sessionStorage.setItem("access_token", tokenFromUrl);
        
//         // Clean up the URL query string so the token isn't exposed in the address bar
//         const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
//         window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
//     }

//     // 2. Enforce Session Authentication
//     const token = sessionStorage.getItem("access_token");
//     if (!token) {
//         // If no token is found, redirect to the login interface
//         // Update this URL if your login screen is located at a different path or domain (e.g., https://auth.massfoia.com)
//         window.location.href = "/login.html"; 
//         return;
//     }

//     // Initialize dashboard elements if authentication passes
//     initializeDashboard();
// });

// /**
//  * Safely redirects the user to an independent MASSFOIA application
//  * while passing the current session token as a query parameter.
//  * * @param {string} baseUrl - The target application destination URL
//  */
// function navigateWithToken(baseUrl) {
//     // Retrieve the token from session storage [cite: 1]
//     const token = sessionStorage.getItem("access_token");
    
//     if (token) {
//         // Determine if the URL already contains an existing query parameter string
//         const separator = baseUrl.includes('?') ? '&' : '?';
//         // Append the token to the URL so the destination app can recognize the session [cite: 5, 43]
//         window.location.href = `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
//     } else {
//         // Fallback to base URL if session token is missing (the destination app will catch and redirect to login)
//         window.location.href = baseUrl;
//     }
// }

// /**
//  * Destroys the current session token and routes the user back to the login screen.
//  */
// function logout() {
//     sessionStorage.removeItem("access_token");
//     window.location.href = "/login.html";
// }

// /**
//  * Runs setup requirements for the Hub page upon verification of a valid session.
//  */
// function initializeDashboard() {
//     console.log("MASSFOIA Application Hub initialized successfully.");
//     // You can extend this function to inject user profile information into the UI if desired
// }

/**
 * dashboard-main.js
 * Central navigation, session management, and single-sign-on (SSO) authentication
 * for dashboard.massfoia.com launchpad
 */

// 1. CAPTURE AUTHENTICATION TOKEN FROM URL QUERY PARAMETERS (SSO Handshake)
const urlParams = new URLSearchParams(window.location.search);
const tokenFromUrl = urlParams.get('token');

if (tokenFromUrl) {
    // Commit the token securely to browser storage
    sessionStorage.setItem("access_token", tokenFromUrl);
    
    // Clean up the browser address bar so the token string is not leaked or bookmarkable
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
}

// 2. TIGHTENED AUTHENTICATION SCRIPT GUARD
(function verifyAccess() {
    const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");

    if (!token) {
        // Fallback context mirroring your standard environment protocol
        const currentUrl = window.location.origin;
        const loginUrl = `https://casetracker.massfoia.com/login?redirect_url=${encodeURIComponent(currentUrl)}`;
        
        window.location.replace(loginUrl);
        throw new Error("Unauthorized: Redirecting to centralized login portal..."); 
    }
})();

/**
 * Safely routes the user to an independent application suite domain
 * while appending the current session token to preserve their login context.
 * * @param {string} baseUrl - Target destination URL (e.g. https://papers.massfoia.com/)
 */
window.navigateWithToken = function(baseUrl) {
    const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");
    
    if (token) {
        // Evaluate if the destination string already utilizes URL queries
        const separator = baseUrl.includes('?') ? '&' : '?';
        window.location.href = `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
    } else {
        // If local reference dropped unexpectedly, send directly to base target to auto-trigger login fallback
        window.location.href = baseUrl;
    }
};

/**
 * Destroys all credential trace scopes and loops back to login parameters.
 */
window.logout = function() {
    sessionStorage.clear();
    localStorage.clear();
    
    const currentUrl = window.location.origin;
    window.location.replace(`https://casetracker.massfoia.com/login?redirect_url=${encodeURIComponent(currentUrl)}`);
};

// Log successful asset boot completion
console.log("MASSFOIA Hub Security Engine deployed successfully.");