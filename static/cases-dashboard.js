/**
 * Cases Dashboard Registry Loader Engine
 */
async function loadCasesDashboard() {
    const tableBody = document.getElementById('cases-table-body');

    try {
        // authFetch (from auth.js) attaches the bearer token and handles 401s.
        const response = await authFetch('/api/cases');

        if (!response.ok) throw new Error(`Server status returned: ${response.status}`);
        const data = await response.json();

        if (!data || data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-sm text-gray-500 italic">No valid case entries mapped inside database records.</td></tr>`;
            return;
        }

        tableBody.innerHTML = data.map(c => {
            // Dynamic URL Routing Generation
            const profilePageUrl = `/cases/${c.id}`;

            return `
            <tr class="hover:bg-gray-50/80 transition-colors">
                <td class="p-4 align-middle">
                    <span class="case-name text-[15px] leading-snug text-slate-900 block mb-0.5 break-words">${c.case_name || 'Unnamed Case'}</span>
                    <span class="block text-xs text-gray-400 font-mono">System Case ID: ${c.id}</span>
                </td>
                
                <td class="p-4 align-middle text-gray-800 font-mono text-sm overflow-hidden text-ellipsis whitespace-nowrap">
                    ${c.case_number || 'N/A'}
                </td>
                
                <td class="p-4 align-middle text-gray-700 text-sm font-medium overflow-hidden text-ellipsis whitespace-nowrap">
                    ${c.defendant_name || '<span class="text-gray-400 italic">No associated entity</span>'}
                </td>
                
                <td class="p-4 align-middle text-right whitespace-nowrap">
                    <a href="${profilePageUrl}" class="inline-flex items-center justify-center px-3.5 py-1.5 rounded-md bg-blue-600 text-white text-xs font-bold shadow-sm hover:bg-blue-700 transition-all">
                        Manage Case →
                    </a>
                </td>
            </tr>
            `;
        }).join('');

    } catch (error) {
        console.error("Cases Registry Engine Error:", error);
        tableBody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-sm text-red-500 font-medium">Failed to process application collection entries. Check network logs.</td></tr>`;
    }
}

// Fire execution block on load
document.addEventListener("DOMContentLoaded", loadCasesDashboard);