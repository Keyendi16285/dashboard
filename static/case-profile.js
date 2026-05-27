/**
 * Case Single Profile Landing Page Routing Engine
 */
(async function initCaseHub() {
    const token = sessionStorage.getItem("access_token");
    if (!token) {
        window.location.replace("https://casetracker.massfoia.com/login");
        return;
    }

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
        const response = await fetch(`/api/cases/${caseId}`, {
            method: "GET",
            headers: { 
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) throw new Error(`Query returned bad status tracking response: ${response.status}`);
        const caseRecord = await response.json();

        // Bind information contexts to UI
        if (titleHeader) titleHeader.innerText = caseRecord.case_name;
        if (metaSubheader) {
            metaSubheader.innerText = `Database Registry Key ID: ${caseRecord.id} | Case Indexed Number: ${caseRecord.case_number}`;
        }

        // Build URL parameters for external cross-domain link routing
        const urlSafeCaseName = encodeURIComponent(caseRecord.case_name);

        const linkCaseTracker = document.getElementById('link-casetracker');
        const linkReturnalyzer = document.getElementById('link-returnalyzer');
        const linkPapers = document.getElementById('link-papers');

        if (linkCaseTracker) {
            linkCaseTracker.href = `https://casetracker.massfoia.com/cases?search=${urlSafeCaseName}&token=${token}`;
        }
        if (linkReturnalyzer) {
            linkReturnalyzer.href = `https://returnalyzer.massfoia.com/cases?search=${urlSafeCaseName}&token=${token}`;
        }
        if (linkPapers) {
            linkPapers.href = `https://papers.massfoia.com/?search=${urlSafeCaseName}&token=${token}`;
        }

    } catch (error) {
        console.error("Case Profile Engine Context Generation Fault:", error);
        if (titleHeader) titleHeader.innerText = "Failed to synchronize profile connection metrics.";
    }
})();