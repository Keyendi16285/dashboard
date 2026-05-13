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
            // FIX: Append the &token= to the links so the other apps recognize the login
            const ctLink = `https://casetracker.massfoia.com/defendants?search=${encodeURIComponent(d.name)}&token=${token}`;
            // const ctLink = `http://localhost:8001/defendants?search=${encodeURIComponent(d.name)}&token=${token}`;
            const raLink = `https://returnalyzer.massfoia.com/defendants?search=${encodeURIComponent(d.name)}&token=${token}`;
            // const raLink = `http://localhost:8002/defendants?search=${encodeURIComponent(d.name)}&token=${token}`;
            const papersLink = `https://papers.massfoia.com/?search=${encodeURIComponent(d.name)}&token=${token}`;
            // &token=${token}

            return `
                <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
                    <td class="px-6 py-4">
                        <div class="text-sm font-bold text-slate-800">${d.name}</div>
                        <div class="text-[10px] text-slate-400 font-mono mt-0.5">ID: ${d.id}</div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="text-xs text-slate-600 font-medium">${d.case_name || 'No Name'}</div>
                        <div class="text-[10px] text-slate-400 font-mono mt-0.5">${d.case_number || 'N/A'}</div>
                    </td>
                    <td class="px-6 py-4 text-center">
                        <a href="${ctLink}" 
                           title="Open CaseTracker" class="inline-block hover:opacity-75 transition-opacity">
                           <img src="/static/casetracker-icon.png" alt="CaseTracker" class="h-6 w-6 mx-auto">
                        </a>
                    </td>
                    <td class="px-6 py-4 text-center">
                        <a href="${papersLink}" 
                           title="View Papers" class="inline-block hover:opacity-75 transition-opacity">
                           <img src="/static/papers-icon.png" alt="Papers" class="h-6 w-6 mx-auto">
                        </a>
                    </td>
                    <td class="px-6 py-4 text-center">
                        <a href="${raLink}" 
                           title="Analyze" class="inline-block hover:opacity-75 transition-opacity">
                           <img src="/static/returnalyzer-icon.png" alt="Returnalyzer" class="h-6 w-6 mx-auto">
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

window.handleLogout = function() {
    sessionStorage.clear();
    localStorage.clear();
    window.location.replace(`https://casetracker.massfoia.com/login`);
};

document.addEventListener('DOMContentLoaded', loadDashboard);