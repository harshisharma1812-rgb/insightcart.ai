/**
 * InsightCart AI — Behavior Tracker
 * ──────────────────────────────────
 * Automatically tracks user interactions and sends them
 * to the Behavior Intelligence Engine via /api/behavior/events.
 *
 * Events tracked:
 *  - page_visit  (every page load)
 *  - view        (product views)
 *  - click       (product clicks)
 *  - search      (search queries)
 *  - add_to_cart (cart additions)
 *  - dwell       (time spent on page)
 */

const Tracker = (() => {
  // Session ID persisted for 30 minutes
  const SESSION_KEY = 'ic_session_id';
  const SESSION_TTL = 30 * 60 * 1000;

  let sessionId   = null;
  let pageStart   = Date.now();
  let eventQueue  = [];
  let flushTimer  = null;

  // ── Session Management ──────────────────────────────────────
  function getSessionId() {
    if (sessionId) return sessionId;

    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      const { id, ts } = JSON.parse(stored);
      if (Date.now() - ts < SESSION_TTL) {
        sessionId = id;
        return sessionId;
      }
    }

    // Generate new session ID
    sessionId = 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: sessionId, ts: Date.now() }));
    return sessionId;
  }

  // ── Queue & Flush ───────────────────────────────────────────
  function enqueue(eventData) {
    eventQueue.push({
      ...eventData,
      sessionId: getSessionId(),
      timestamp: new Date().toISOString(),
    });

    // Debounce flush — send every 2 seconds or when queue > 5
    clearTimeout(flushTimer);
    if (eventQueue.length >= 5) {
      flush();
    } else {
      flushTimer = setTimeout(flush, 2000);
    }
  }

  async function flush() {
    if (!eventQueue.length) return;
    const toSend = [...eventQueue];
    eventQueue = [];

    try {
      await fetch('http://localhost:5000/api/behavior/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(Auth.getToken() ? { Authorization: `Bearer ${Auth.getToken()}` } : {}),
        },
        body: JSON.stringify(toSend),
      });
    } catch (_) {
      // Silently fail — tracking should never interrupt UX
    }
  }

  // ── Public Track API ────────────────────────────────────────
  function track(eventType, data = {}) {
    enqueue({ eventType, ...data });
  }

  // ── Auto Page Visit Tracking ────────────────────────────────
  function trackPageVisit() {
    const page = window.location.pathname;
    track('page_visit', { metadata: { page, referrer: document.referrer } });
    pageStart = Date.now();
  }

  // ── Auto Dwell Time Tracking ────────────────────────────────
  function trackDwell() {
    const dwellMs = Date.now() - pageStart;
    if (dwellMs < 1000) return; // Ignore bounces < 1s
    track('dwell', { dwellMs, metadata: { page: window.location.pathname } });
  }

  // ── Auto Search Tracking ────────────────────────────────────
  function observeSearch(inputEl) {
    if (!inputEl) return;
    let lastQuery = '';
    inputEl.addEventListener('change', (e) => {
      const q = e.target.value.trim();
      if (q && q !== lastQuery && q.length >= 2) {
        lastQuery = q;
        track('search', { query: q });
      }
    });
  }

  // ── Init ────────────────────────────────────────────────────
  function init() {
    // Track page visit on load
    document.addEventListener('DOMContentLoaded', trackPageVisit);

    // Track dwell on page unload
    window.addEventListener('beforeunload', () => {
      trackDwell();
      flush(); // Synchronous flush attempt
      // Use sendBeacon for reliability on page unload
      const data = JSON.stringify([{
        eventType: 'dwell',
        dwellMs: Date.now() - pageStart,
        sessionId: getSessionId(),
        metadata: { page: window.location.pathname },
      }]);
      navigator.sendBeacon?.(
        'http://localhost:5000/api/behavior/events',
        new Blob([data], { type: 'application/json' })
      );
    });

    // Track visibility changes (tab switching)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        trackDwell();
      } else {
        pageStart = Date.now(); // Reset timer on return
      }
    });
  }

  // Initialize automatically
  init();

  return { track, observeSearch, flush, getSessionId };
})();

// Expose globally
window.Tracker = Tracker;
