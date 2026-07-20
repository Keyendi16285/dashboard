/**
 * activity-feed.js — shared activity-log renderer
 *
 * Loaded (after auth.js) by both the case and defendant profile pages. Fetches
 * the read-only activity feed and renders it into #activity-feed. The feed data
 * comes from the shared `activity_logs` table (written by Case Tracker); this is
 * display-only.
 */

/**
 * Fetches an activity feed from the given endpoint and renders it into
 * #activity-feed.
 * @param {string} url - activity endpoint (e.g. /api/cases/5/activity)
 * @param {{showDefendant?: boolean}} [opts] - showDefendant tags each row with
 *        the defendant name (useful on the case page, where rows mix case and
 *        defendant changes).
 */
async function loadActivityFeed(url, opts = {}) {
    const container = document.getElementById('activity-feed');
    if (!container) return;

    try {
        const response = await authFetch(url);
        if (!response.ok) throw new Error(`Activity request failed: ${response.status}`);
        const logs = await response.json();

        if (!logs || logs.length === 0) {
            container.innerHTML = `<p class="text-sm text-slate-500 italic">No activity recorded yet.</p>`;
            return;
        }

        container.innerHTML = logs.map(log => renderActivityEntry(log, opts)).join('');
    } catch (error) {
        console.error("Activity Feed Error:", error);
        container.innerHTML = `<p class="text-sm text-red-400">Could not load activity log.</p>`;
    }
}

// Action -> colour accent for the little badge on each row.
const ACTIVITY_ACTION_STYLES = {
    CREATE: 'bg-emerald-500/10 text-emerald-400',
    UPDATE: 'bg-blue-500/10 text-blue-400',
    DELETE: 'bg-red-500/10 text-red-400',
};

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatActivityTimestamp(ts) {
    if (!ts) return '';
    // Stored as naive UTC; append Z so the browser converts to local time.
    const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(ts) ? ts : `${ts}Z`);
    if (isNaN(d)) return escapeHtml(ts);
    return d.toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit'
    });
}

// Short relative time ("3d ago") for the compact registry summaries.
function activityTimeAgo(ts) {
    if (!ts) return '';
    const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(ts) ? ts : `${ts}Z`);
    if (isNaN(d)) return '';
    const secs = Math.floor((Date.now() - d.getTime()) / 1000);
    if (secs < 60) return 'just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
}

/**
 * Compact one-line activity summary for a registry table row (light theme).
 * `last` is the `last_activity` object from /api/cases or /api/defendants
 * (or null when there's no history).
 */
function renderActivitySummaryLine(last) {
    if (!last) {
        return `<span class="block text-xs text-gray-400 italic mt-1">No recent activity</span>`;
    }
    const when = activityTimeAgo(last.timestamp);
    let label = last.label || last.action || 'Activity';
    if (label.length > 60) label = label.slice(0, 57) + '…';
    const who = last.user_initial ? ` · ${escapeHtml(last.user_initial)}` : '';
    return `<span class="block text-xs text-gray-500 mt-1" title="${escapeHtml(last.label || '')}">🕓 ${escapeHtml(when)} — ${escapeHtml(label)}${who}</span>`;
}

function renderActivityEntry(log, opts = {}) {
    const action = (log.action || '').toUpperCase();
    const badge = ACTIVITY_ACTION_STYLES[action] || 'bg-slate-500/10 text-slate-300';

    // Prefer the pre-built human-readable label; fall back to a field diff.
    let summary = log.label;
    if (!summary) {
        summary = log.field_name
            ? `${log.field_name}: ${log.old_value ?? 'None'} → ${log.new_value ?? 'None'}`
            : `${action || 'Change'}`;
    }

    const who = log.user_initial ? `by ${escapeHtml(log.user_initial)}` : '';
    const when = formatActivityTimestamp(log.timestamp);

    // On the case page, tag defendant-scoped rows so it's clear which entity changed.
    let scopeTag = '';
    if (opts.showDefendant && log.entity_type === 'DEFENDANT' && log.defendant_name) {
        scopeTag = `<span class="text-[11px] font-semibold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded">${escapeHtml(log.defendant_name)}</span>`;
    }

    return `
        <div class="flex items-start gap-3 p-3 rounded-lg border border-slate-800 bg-slate-950/40">
            <span class="mt-0.5 text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${badge}">${escapeHtml(action || 'LOG')}</span>
            <div class="min-w-0 flex-1">
                <p class="text-sm text-slate-200 break-words">${escapeHtml(summary)}</p>
                <p class="text-xs text-slate-500 mt-0.5">
                    ${[scopeTag, who, when].filter(Boolean).join(' <span class="text-slate-700">·</span> ')}
                </p>
            </div>
        </div>
    `;
}
