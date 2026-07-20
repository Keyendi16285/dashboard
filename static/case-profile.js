/**
 * Case Single Profile Landing Page Routing Engine
 */
(async function initCaseHub() {
    // The login gate lives in auth.js; here we just read the active token for
    // the authenticated fetch and the cross-origin links below.
    const token = getActiveToken();

    // Extract dynamic Case numeric database ID sequence parameter from URL structure boundary
    const pathSegments = window.location.pathname.split('/').filter(seg => seg !== "");
    const caseId = pathSegments[pathSegments.length - 1];

    const titleHeader = document.getElementById('case-title');
    const metaSubheader = document.getElementById('case-meta');

    if (!caseId || isNaN(caseId)) {
        if (titleHeader) titleHeader.innerText = "Error: Invalid Case Reference Node Path";
        return;
    }

    try {
        // Query specific case payload data parameters out of backend endpoints configuration
        const response = await authFetch(`/api/cases/${caseId}`);

        if (!response.ok) throw new Error(`Query returned bad status tracking response: ${response.status}`);
        const caseRecord = await response.json();

        // Bind information contexts to UI
        if (titleHeader) titleHeader.innerText = caseRecord.case_name;
        if (metaSubheader) {
            metaSubheader.innerText = `Database Registry Key ID: ${caseRecord.id} | Case Indexed Number: ${caseRecord.case_number}`;
        }

        // Build URL parameters for external cross-domain link routing.
        //
        // Case Tracker supports an EXACT single-case lookup by primary key via
        // ?case_id= (WHERE id == case_id), so we use the case id there for a
        // pinpoint redirect. The case id is the shared case-entries primary key,
        // consistent across every app on the case_management database.
        //
        // Returnalyzer and Papers only do a TEXT search (name/number, and for
        // Papers the defendant/case number) — they have no id-based filter — so we
        // pass the unique case NUMBER, the most precise key they support. Papers in
        // particular stores the case number in its case_name field, so a case-name
        // search would not match there. Fall back to the case name only when the
        // number is missing.
        const textSearch = (caseRecord.case_number && caseRecord.case_number !== "None")
            ? caseRecord.case_number
            : caseRecord.case_name;
        const urlSafeSearch = encodeURIComponent(textSearch);

        const linkCaseTracker = document.getElementById('link-casetracker');
        const linkReturnalyzer = document.getElementById('link-returnalyzer');
        const linkPapers = document.getElementById('link-papers');

        if (linkCaseTracker) {
            // Case Tracker's case list is served at "/" (there is no "/cases" page).
            // ?case_id= gives an exact one-case filter.
            linkCaseTracker.href = `https://casetracker.massfoia.com/?case_id=${caseRecord.id}&token=${token}`;
        }
        if (linkReturnalyzer) {
            linkReturnalyzer.href = `https://returnalyzer.massfoia.com/cases?search=${urlSafeSearch}&token=${token}`;
        }
        if (linkPapers) {
            linkPapers.href = `https://papers.massfoia.com/?search=${urlSafeSearch}&token=${token}`;
        }

        // Remaining ecosystem apps — same behavior as the links above: open in a
        // new tab carrying the case NUMBER as the search term plus the SSO token.
        // (Their code isn't in this workspace, so we use the unique case number,
        // the safe text key; the token still enables SSO regardless.)
        const ecosystemLinks = [
            { id: 'link-complaintinator',       base: 'https://complaintinator.massfoia.com/' },
            { id: 'link-demandinator',          base: 'https://demandinator.massfoia.com/' },
            { id: 'link-expensifier',           base: 'https://expensifier.massfoia.com/' },
            { id: 'link-draftinator',           base: 'https://draftinator.massfoia.com/' },
            { id: 'link-settlomatic-pre',       base: 'https://settlomatic.massfoia.com/pre' },
            { id: 'link-settlomatic-post',      base: 'https://settlomatic.massfoia.com/post' },
            { id: 'link-settlomatic-collect',   base: 'https://settlomatic.massfoia.com/cash' },
            { id: 'link-settlomatic-received',  base: 'https://settlomatic.massfoia.com/received' },
        ];
        ecosystemLinks.forEach(({ id, base }) => {
            const el = document.getElementById(id);
            if (el) {
                const sep = base.includes('?') ? '&' : '?';
                el.href = `${base}${sep}search=${urlSafeSearch}&token=${token}`;
            }
        });

        // Case-level activity feed: this case's own changes AND its defendants'.
        loadActivityFeed(`/api/cases/${caseId}/activity`, { showDefendant: true });

    } catch (error) {
        console.error("Case Profile Engine Context Generation Fault:", error);
        if (titleHeader) titleHeader.innerText = "Failed to synchronize profile connection metrics.";
    }
})();