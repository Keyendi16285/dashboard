/**
 * Dashboard.massfoia - Database-Driven Logic
 *
 * Authentication (SSO handshake, the login gate and authFetch) lives in the
 * shared /static/auth.js, which loads before this file.
 */

async function loadDashboard() {
    const tableBody = document.getElementById('defendants-table-body');

    try {
        // authFetch (from auth.js) attaches the bearer token and handles 401s.
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

document.addEventListener('DOMContentLoaded', loadDashboard);