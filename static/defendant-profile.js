/**
 * Defendant Profile Hub Engine
 * Handles dynamic data fetching and parameter injection for external app routing.
 */
(async function initProfileHub() {
    // 1. Authentication Layer Guard — the login gate lives in auth.js; here we
    //    just read the active token for the cross-origin links built below.
    const token = getActiveToken();

    // 2. Dynamic URL Segment Extraction
    // Path format expected: /defendants/830 -> splitting yields ["", "defendants", "830"]
    const pathSegments = window.location.pathname.split('/').filter(segment => segment !== "");
    const defendantId = pathSegments[pathSegments.length - 1];

    const nameHeader = document.getElementById('defendant-name');
    const metaSubheader = document.getElementById('defendant-meta');

    if (!defendantId || isNaN(defendantId)) {
        if (nameHeader) nameHeader.innerText = "Error: Invalid Defendant ID Reference";
        return;
    }

    try {
        // 3. Fetch data payload from backend API
        // authFetch (from auth.js) attaches the bearer token and handles 401s.
        const response = await authFetch(`/api/defendants/${defendantId}`);

        if (!response.ok) {
            throw new Error(`Server returned status code: ${response.status}`);
        }

        const defendant = await response.json();

        // 4. Update the Text Content elements in the DOM
        if (nameHeader) nameHeader.innerText = defendant.name;
        if (metaSubheader) {
            metaSubheader.innerText = `Database ID: ${defendant.id} | Case: ${defendant.case_name} | Case No: ${defendant.case_number}`;
        }

        // 5. Build safe URL parameters for cross-domain link routing
        const urlSafeName = encodeURIComponent(defendant.name);
        
        const linkCaseTracker = document.getElementById('link-casetracker');
        const linkPapers = document.getElementById('link-papers');
        const linkReturnalyzer = document.getElementById('link-returnalyzer');

        // 6. Direct mapping to app query ecosystems
        if (linkCaseTracker) {
            linkCaseTracker.href = `https://casetracker.massfoia.com/defendants?search=${urlSafeName}&token=${token}`;
        }
        if (linkPapers) {
            linkPapers.href = `https://papers.massfoia.com/?search=${urlSafeName}&token=${token}`;
        }
        if (linkReturnalyzer) {
            linkReturnalyzer.href = `https://returnalyzer.massfoia.com/defendants?search=${urlSafeName}&token=${token}`;
        }

    } catch (error) {
        console.error("Profile Runtime Error:", error);
        if (nameHeader) nameHeader.innerText = "Failed to load profile context records.";
        if (metaSubheader) metaSubheader.innerText = "Please check your network status or server console.";
    }
})();