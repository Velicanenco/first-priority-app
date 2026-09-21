/**
 * Backend API client — talks to the First Priority role/registration
 * backend (first-priority-backend) using Telegram's own initData as the
 * auth credential.
 *
 * There is no separate "login" step: every request just re-sends the raw
 * initData string Telegram gave this launch, and the backend re-verifies
 * its signature itself (see requireAuth.js on the server). The very first
 * verified request for a telegram_id creates that user server-side as a
 * plain "participant" — that's the whole registration flow. Nobody can
 * ever claim a higher role from the client; roles only change through the
 * invite-code endpoints below, and admin never through the app at all.
 */
(function () {
  const BACKEND_URL = "https://first-priority-global.onrender.com";

  // The backend runs on Render's free tier, which spins the service down
  // after ~15 minutes idle. The FIRST request after that has to wait for a
  // cold start (usually well under a minute, occasionally longer) — without
  // a bound on that wait, a stalled connection just sits there forever and
  // the UI looks frozen ("Checking Telegram data…" with no way out). This
  // timeout guarantees every call eventually resolves to a real error the
  // UI can show a retry button for, instead of hanging indefinitely.
  const TIMEOUT_MS = 55000;

  function getInitData() {
    return (typeof window !== "undefined" && window.__tg?.initData) || "";
  }

  async function apiFetch(path, { method = "GET", body, timeoutMs = TIMEOUT_MS } = {}) {
    const initData = getInitData();
    if (!initData) {
      const err = new Error("no-telegram-context");
      err.code = "NO_INIT_DATA";
      throw err;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res;
    try {
      res = await fetch(BACKEND_URL + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: "tma " + initData,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (networkErr) {
      const isAbort = networkErr && networkErr.name === "AbortError";
      const err = new Error(isAbort ? "timeout" : "network-error");
      err.code = isAbort ? "TIMEOUT" : "NETWORK_ERROR";
      err.cause = networkErr;
      throw err;
    } finally {
      clearTimeout(timer);
    }

    let data = null;
    try { data = await res.json(); } catch (e) { /* empty/non-JSON body */ }

    if (!res.ok) {
      const err = new Error((data && data.error) || `http_${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  window.fpApi = {
    me: () => apiFetch("/api/me"),
    redeemInvite: (code) => apiFetch("/api/invites/redeem", { method: "POST", body: { code } }),
    listGroups: () => apiFetch("/api/groups"),
    createGroup: (name, country) => apiFetch("/api/groups", { method: "POST", body: { name, country } }),
    inviteLeader: (group_id) => apiFetch("/api/invites/leader", { method: "POST", body: { group_id } }),
    inviteCoordinator: (country) => apiFetch("/api/invites/coordinator", { method: "POST", body: { country } }),
    getFive: () => apiFetch("/api/five"),
    saveFive: (entries) => apiFetch("/api/five", { method: "PUT", body: { entries } }),
    getStats: () => apiFetch("/api/stats"),
    getGroupStats: (groupId) => apiFetch("/api/stats/group/" + encodeURIComponent(groupId)),
  };
})();
