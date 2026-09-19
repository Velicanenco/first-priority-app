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

  function getInitData() {
    return (typeof window !== "undefined" && window.__tg?.initData) || "";
  }

  async function apiFetch(path, { method = "GET", body } = {}) {
    const initData = getInitData();
    if (!initData) {
      const err = new Error("no-telegram-context");
      err.code = "NO_INIT_DATA";
      throw err;
    }

    let res;
    try {
      res = await fetch(BACKEND_URL + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: "tma " + initData,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (networkErr) {
      const err = new Error("network-error");
      err.code = "NETWORK_ERROR";
      err.cause = networkErr;
      throw err;
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
  };
})();
