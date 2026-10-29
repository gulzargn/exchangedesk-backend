export const API_BASE = (
  typeof window !== 'undefined' &&
  (window.Capacitor?.isNativePlatform?.() ||
   window.location.protocol === 'capacitor:' ||
   window.location.protocol === 'file:' ||
   window.location.hostname === 'localhost')
) ? 'https://exchangedesk-five.vercel.app' : '';

/**
 * Production API Client & Socket.io Wrapper for ExchangeDesk
 * Real-world dealer desks, verified buyers, and super admin operations
 */

export const api = {
  // Authentication & Gatekeeper Endpoints
  async authLogin(data) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async authRegister(data) {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async authMe(role, id) {
    const res = await fetch(`${API_BASE}/api/auth/me?role=${role}&id=${id}`);
    return res.json();
  },

  // Auctions Endpoints
  async getActiveAuctions(view = 'buyer', showroomId = null) {
    let url = `${API_BASE}/api/auctions/active?view=${view}&_t=${Date.now()}`;
    if (showroomId) url += `&showroom_id=${showroomId}`;
    const res = await fetch(url, { cache: 'no-store' });
    return res.json();
  },

  async closeAuction(id) {
    const res = await fetch(`${API_BASE}/api/auctions/${id}/close`, {
      method: 'POST',
    });
    return res.json();
  },

  async getAuctionMedia(id) {
    const res = await fetch(`${API_BASE}/api/auctions/${id}/media`);
    return res.json();
  },

  async getAuctionDetails(id, view = 'buyer', showroomId = null) {
    let url = `${API_BASE}/api/auctions/${id}?view=${view}`;
    if (showroomId) url += `&showroom_id=${showroomId}`;
    const res = await fetch(url);
    return res.json();
  },

  async createAuction(data) {
    try {
      const res = await fetch(`${API_BASE}/api/auctions/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        if (res.status === 413) {
          return {
            success: false,
            error: 'Photos ya video size bahot bada hai! Kripya chhota video clip ya kam photos select karein (under 2.5MB).'
          };
        }
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          return { success: false, error: `Server error (${res.status}): ${text.slice(0, 150)}` };
        }
      }

      return await res.json();
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async placeBidRest(auctionId, buyerId, incrementAmount) {
    const res = await fetch(`${API_BASE}/api/auctions/bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auctionId, buyerId, incrementAmount }),
    });
    return res.json();
  },

  async verifyHandover(auctionId, otp, showroomId = null) {
    const res = await fetch(`${API_BASE}/api/auctions/verify-handover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auction_id: auctionId,
        otp,
        showroom_id: showroomId,
      }),
    });
    return res.json();
  },

  // Buyers Endpoints
  async getBuyers() {
    const res = await fetch(`${API_BASE}/api/buyers`);
    return res.json();
  },

  async registerBuyer(data) {
    const res = await fetch(`${API_BASE}/api/buyers/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async topupBuyerWallet(buyerId, amount = 5000) {
    const res = await fetch(`${API_BASE}/api/buyers/${buyerId}/topup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    });
    return res.json();
  },

  async requestBuyerDeposit(buyerId, amount, payment_method = 'UPI', reference_id = '') {
    const res = await fetch(`${API_BASE}/api/buyers/${buyerId}/deposit-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, payment_method, reference_id }),
    });
    return res.json();
  },

  async getBuyerDepositRequests(buyerId) {
    const res = await fetch(`${API_BASE}/api/buyers/${buyerId}/deposit-requests`);
    return res.json();
  },

  async approveDepositRequest(requestId) {
    const res = await fetch(`${API_BASE}/api/admin/deposits/${requestId}/approve`, {
      method: 'POST',
    });
    return res.json();
  },

  async rejectDepositRequest(requestId, notes = '') {
    const res = await fetch(`${API_BASE}/api/admin/deposits/${requestId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    return res.json();
  },

  async extendAuction(auctionId, minutes = 5) {
    const res = await fetch(`${API_BASE}/api/admin/auctions/${auctionId}/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes }),
    });
    return res.json();
  },

  async getAdminLiveBidsFeed() {
    const res = await fetch(`${API_BASE}/api/admin/live-bids-feed`);
    return res.json();
  },

  // Showrooms Endpoints
  async getShowrooms() {
    const res = await fetch(`${API_BASE}/api/showrooms`);
    return res.json();
  },

  async registerShowroom(data) {
    const res = await fetch(`${API_BASE}/api/showrooms/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Super Admin Endpoints
  async getAdminStats() {
    const res = await fetch(`${API_BASE}/api/admin/stats`);
    return res.json();
  },

  async getAdminTransactions() {
    const res = await fetch(`${API_BASE}/api/admin/transactions`);
    return res.json();
  },

  async getAdminBuyers() {
    const res = await fetch(`${API_BASE}/api/admin/buyers`);
    return res.json();
  },

  async getPendingApprovals() {
    const res = await fetch(`${API_BASE}/api/admin/pending`);
    return res.json();
  },

  async approveRegistration(type, id) {
    const res = await fetch(`${API_BASE}/api/admin/approve/${type}/${id}`, {
      method: 'POST',
    });
    return res.json();
  },

  async rejectRegistration(type, id) {
    const res = await fetch(`${API_BASE}/api/admin/reject/${type}/${id}`, {
      method: 'POST',
    });
    return res.json();
  },

  async toggleBuyerVerification(buyerId) {
    const res = await fetch(`${API_BASE}/api/admin/buyers/${buyerId}/toggle-verify`, {
      method: 'POST',
    });
    return res.json();
  },

  async adjustBuyerWallet(buyerId, amount, action = 'credit') {
    const res = await fetch(`${API_BASE}/api/admin/buyers/${buyerId}/adjust-wallet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, action }),
    });
    return res.json();
  },

  async createShowroom(data) {
    const res = await fetch(`${API_BASE}/api/admin/showrooms/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async cancelAuction(auctionId, reason) {
    const res = await fetch(`${API_BASE}/api/admin/auctions/${auctionId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    return res.json();
  },

  async toggleBuyerStatus(buyerId) {
    const res = await fetch(`${API_BASE}/api/admin/buyers/${buyerId}/toggle-status`, {
      method: 'POST',
    });
    return res.json();
  },

  async deleteBuyer(buyerId) {
    const res = await fetch(`${API_BASE}/api/admin/buyers/${buyerId}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  async toggleShowroomStatus(showroomId) {
    const res = await fetch(`${API_BASE}/api/admin/showrooms/${showroomId}/toggle-status`, {
      method: 'POST',
    });
    return res.json();
  },

  async deleteShowroom(showroomId) {
    const res = await fetch(`${API_BASE}/api/admin/showrooms/${showroomId}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  async getAdminAuctions(status = 'ALL') {
    const res = await fetch(`${API_BASE}/api/admin/auctions?status=${status}`);
    return res.json();
  },

  async forceCloseAuction(auctionId) {
    const res = await fetch(`${API_BASE}/api/admin/auctions/${auctionId}/force-close`, {
      method: 'POST',
    });
    return res.json();
  },

  async updateConfig(data) {
    const res = await fetch(`${API_BASE}/api/admin/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
};
