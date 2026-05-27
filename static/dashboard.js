/**
 * Dashboard.massfoia - Database-Driven Logic
 */

// 1. CAPTURE TOKEN FROM URL (SSO Handshake)
const urlParams = new URLSearchParams(window.location.search);
const tokenFromUrl = urlParams.get('token');

if (tokenFromUrl) {
    sessionStorage.setItem("access_token", tokenFromUrl);
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
}

// 2. TIGHTENED AUTHENTICATION CHECK
(function verifyAccess() {
    const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");

    if (!token) {
        const currentUrl = window.location.origin;
        const loginUrl = `https://casetracker.massfoia.com/login?redirect_url=${encodeURIComponent(currentUrl)}`;
        window.location.replace(loginUrl);
        throw new Error("Unauthorized: Redirecting to login...");
    }
})();

// Helper for Authenticated Requests
async function authFetch(url, options = {}) {
    const token = sessionStorage.getItem("access_token");
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
    return fetch(url, { ...options, headers });
}

async function loadDashboard() {
    const tableBody = document.getElementById('defendants-table-body');
    const token = sessionStorage.getItem("access_token"); // Get current token

    try {
        // FIX: Use authFetch instead of regular fetch to send the token to your API
        const response = await authFetch('/api/defendants');

        if (!response.ok) throw new Error(`Server responded with ${response.status}`);

        const data = await response.json();

        if (data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4" class="p-12 text-center text-slate-400 italic text-sm">No records found.</td></tr>`;
            return;
        }

        tableBody.innerHTML = data.map(d => {
            // Generate the internal dynamic profile path
            const profilePageUrl = `/defendants/${d.id}`;

            return `
            <tr class="border-b border-gray-200 hover:bg-gray-50">
                <td class="p-4 align-middle">
                    <span class="font-bold text-black text-base block mb-0.5">${d.name}</span>
                    <span class="block text-xs text-gray-500 font-mono">Database ID: ${d.id}</span>
                </td>
                
                <td class="p-4 align-middle text-gray-700 font-medium">
                    ${d.case_name || 'No Case Name Assigned'}
                </td>
                
                <td class="p-4 align-middle text-gray-600 font-mono text-sm">
                    ${d.case_number || 'N/A'}
                </td>
                
                <td class="p-4 align-middle text-center">
                    <a href="${profilePageUrl}" class="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold shadow-sm hover:bg-blue-700 transition-all">
                        Manage Profile →
                    </a>
                </td>
            </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Dashboard Load Error:", err);
        tableBody.innerHTML = `<tr><td colspan="4" class="p-12 text-center text-red-500 font-medium text-sm">Error loading data.</td></tr>`;
    }
}

window.handleLogout = function () {
    sessionStorage.clear();
    localStorage.clear();
    window.location.replace(`https://casetracker.massfoia.com/login`);
};

document.addEventListener('DOMContentLoaded', loadDashboard);