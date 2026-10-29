/**
 * ExchangeDesk - Dedicated Super Admin Portal Engine
 * Full Control: Pending Registration Approvals, Live Auction Supervisor,
 * Wallet Management, and Monetization Ledgers.
 */

import { api } from './api.js';
import { sound } from './sound.js';

const state = {
  activeTab: 'pending', // 'pending' | 'auctions' | 'buyers' | 'showrooms' | 'ledger' | 'config'
  stats: null,
  socket: null,
  auctions: [],
  serverTimeSkew: 0,
};

const el = {
  adminAuthGate: document.getElementById('adminAuthGate'),
  formAdminLogin: document.getElementById('formAdminLogin'),
  inputAdminPassword: document.getElementById('inputAdminPassword'),
  adminAppWrapper: document.getElementById('adminAppWrapper'),
  btnAdminLogout: document.getElementById('btnAdminLogout'),

  bannerPendingAlert: document.getElementById('bannerPendingAlert'),
  badgePendingCount: document.getElementById('badgePendingCount'),
  btnJumpToPending: document.getElementById('btnJumpToPending'),

  statRevenue: document.getElementById('statRevenue'),
  statGmv: document.getElementById('statGmv'),
  statLive: document.getElementById('statLive'),
  statPending: document.getElementById('statPending'),
  statLiquidity: document.getElementById('statLiquidity'),

  tabBtnPending: document.getElementById('tabBtnPending'),
  tabPendingBadge: document.getElementById('tabPendingBadge'),
  tabBtnDeposits: document.getElementById('tabBtnDeposits'),
  tabDepositsBadge: document.getElementById('tabDepositsBadge'),
  tabBtnRadar: document.getElementById('tabBtnRadar'),
  tabBtnAuctions: document.getElementById('tabBtnAuctions'),
  tabBtnBuyers: document.getElementById('tabBtnBuyers'),
  tabBtnShowrooms: document.getElementById('tabBtnShowrooms'),
  tabBtnLedger: document.getElementById('tabBtnLedger'),
  tabBtnConfig: document.getElementById('tabBtnConfig'),

  sectionPending: document.getElementById('sectionPending'),
  sectionDeposits: document.getElementById('sectionDeposits'),
  sectionRadar: document.getElementById('sectionRadar'),
  sectionAuctions: document.getElementById('sectionAuctions'),
  sectionBuyers: document.getElementById('sectionBuyers'),
  sectionShowrooms: document.getElementById('sectionShowrooms'),
  sectionLedger: document.getElementById('sectionLedger'),
  sectionConfig: document.getElementById('sectionConfig'),

  btnRefreshPending: document.getElementById('btnRefreshPending'),
  pendingShowroomCount: document.getElementById('pendingShowroomCount'),
  pendingShowroomsList: document.getElementById('pendingShowroomsList'),
  pendingBuyerCount: document.getElementById('pendingBuyerCount'),
  pendingBuyersList: document.getElementById('pendingBuyersList'),

  btnRefreshDeposits: document.getElementById('btnRefreshDeposits'),
  pendingDepositsCountBadge: document.getElementById('pendingDepositsCountBadge'),
  pendingDepositsList: document.getElementById('pendingDepositsList'),

  btnRefreshRadar: document.getElementById('btnRefreshRadar'),
  radarBidsList: document.getElementById('radarBidsList'),

  selectAuctionStatusFilter: document.getElementById('selectAuctionStatusFilter'),
  btnRefreshAuctions: document.getElementById('btnRefreshAuctions'),
  auctionsList: document.getElementById('auctionsList'),

  btnRefreshBuyers: document.getElementById('btnRefreshBuyers'),
  buyersList: document.getElementById('buyersList'),

  btnRefreshShowrooms: document.getElementById('btnRefreshShowrooms'),
  showroomsList: document.getElementById('showroomsList'),

  ledgerCountBadge: document.getElementById('ledgerCountBadge'),
  ledgerList: document.getElementById('ledgerList'),

  formConfig: document.getElementById('formConfig'),
  inputMinWallet: document.getElementById('inputMinWallet'),
  inputHandoverFee: document.getElementById('inputHandoverFee'),
  inputMinIncrement: document.getElementById('inputMinIncrement'),
  inputAuctionDuration: document.getElementById('inputAuctionDuration'),

  modalAdminAdjustWallet: document.getElementById('modalAdminAdjustWallet'),
  btnCloseAdminWalletModal: document.getElementById('btnCloseAdminWalletModal'),
  formAdminAdjustWallet: document.getElementById('formAdminAdjustWallet'),
  adminAdjustBuyerId: document.getElementById('adminAdjustBuyerId'),
  adminAdjustBuyerName: document.getElementById('adminAdjustBuyerName'),
  adminAdjustCurrentBalance: document.getElementById('adminAdjustCurrentBalance'),
  selectAdminWalletAction: document.getElementById('selectAdminWalletAction'),
  inputAdminWalletAmount: document.getElementById('inputAdminWalletAmount'),

  modalBids: document.getElementById('modalBids'),
  btnCloseBidsModal: document.getElementById('btnCloseBidsModal'),
  auditVehicleTitle: document.getElementById('auditVehicleTitle'),
  auditBidsList: document.getElementById('auditBidsList'),

  toastContainer: document.getElementById('toastContainer'),
};

function triggerHaptic() {
  if (navigator.vibrate) try { navigator.vibrate(15); } catch {}
}

async function initAdmin() {
  setupEventListeners();
  setupSocket();
  checkAdminSession();
  startAdminTimerLoop();
}

function startAdminTimerLoop() {
  setInterval(() => {
    const authoritativeNow = Date.now() + state.serverTimeSkew;
    state.auctions.forEach((auction) => {
      const timerEl = document.getElementById(`admin-timer-${auction.id}`);
      const timerBarEl = document.getElementById(`admin-timer-bar-${auction.id}`);
      if (!timerEl) return;

      if (auction.status !== 'LIVE') {
        timerEl.textContent = auction.status;
        timerEl.className = 'font-mono-numbers font-black text-xs text-slate-400';
        if (timerBarEl) timerBarEl.style.width = '0%';
        return;
      }

      const endsAt = new Date(auction.ends_at).getTime();
      const startsAt = new Date(auction.starts_at).getTime();
      const totalDuration = Math.max(endsAt - startsAt, 1);
      const remainingMs = endsAt - authoritativeNow;

      if (remainingMs <= 0) {
        timerEl.textContent = '00:00.0';
        timerEl.className = 'font-mono-numbers font-black text-xs text-red-500 animate-urgent';
        if (timerBarEl) timerBarEl.style.width = '0%';
        return;
      }

      const totalSeconds = Math.floor(remainingMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      const tenths = Math.floor((remainingMs % 1000) / 100);

      timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${tenths}`;

      const pct = Math.max(0, Math.min(100, (remainingMs / totalDuration) * 100));
      if (timerBarEl) {
        timerBarEl.style.width = `${pct}%`;
        if (minutes < 2) {
          timerBarEl.className = 'bg-red-500 h-full transition-all duration-100';
          timerEl.className = 'font-mono-numbers font-black text-xs text-red-400 animate-urgent';
        } else if (minutes < 4) {
          timerBarEl.className = 'bg-amber-400 h-full transition-all duration-200';
          timerEl.className = 'font-mono-numbers font-black text-xs text-amber-300';
        } else {
          timerBarEl.className = 'bg-emerald-500 h-full transition-all duration-300';
          timerEl.className = 'font-mono-numbers font-black text-xs text-emerald-400';
        }
      }
    });
  }, 100);
}

function checkAdminSession() {
  const session = localStorage.getItem('exchangedesk_admin_session');
  if (session) {
    el.adminAuthGate.classList.add('hidden');
    el.adminAppWrapper.classList.remove('hidden');
    loadAdminData();
    setInterval(loadAdminData, 4000);
  } else {
    el.adminAuthGate.classList.remove('hidden');
    el.adminAppWrapper.classList.add('hidden');
  }
}

function setupSocket() {
  if (typeof io === 'undefined') return;
  const socket = io();
  state.socket = socket;

  socket.on('feed_new_auction', () => loadAdminData());
  socket.on('bid_updated', (payload) => {
    sound.playBidTone();
    showToast(`Live Bid on ${payload.vehicleModel || 'Bike'}: ₹${parseFloat(payload.newHighestBid).toLocaleString('en-IN')} by ${payload.highestBidderName || 'Dealer'}`, 'info');
    loadAdminData();
    prependToRadar(payload);
  });
  socket.on('feed_bid_tick', (payload) => {
    loadAdminData();
    prependToRadar(payload);
  });
  socket.on('new_deposit_request', (payload) => {
    sound.playWinTone();
    showToast(`New Deposit Request: ₹${parseFloat(payload.amount).toLocaleString('en-IN')} from ${payload.buyerName}!`, 'warning', 8000);
    loadAdminData();
  });
  socket.on('deposit_request_approved', () => loadAdminData());
  socket.on('deposit_request_rejected', () => loadAdminData());
  socket.on('auction_closed', () => loadAdminData());
  socket.on('auction_completed', () => loadAdminData());
  socket.on('buyer_wallet_updated', () => loadAdminData());
  socket.on('buyer_status_changed', () => loadAdminData());
  socket.on('showroom_status_changed', () => loadAdminData());
}

function setupEventListeners() {
  // Login Form
  el.formAdminLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    triggerHaptic();
    const password = el.inputAdminPassword.value.trim();
    const res = await api.authLogin({ role: 'admin', password });
    if (res.success) {
      localStorage.setItem('exchangedesk_admin_session', JSON.stringify(res.user));
      el.adminAuthGate.classList.add('hidden');
      el.adminAppWrapper.classList.remove('hidden');
      showToast('Super Admin Console Unlocked!', 'success');
      sound.playWinTone();
      loadAdminData();
    } else {
      showToast(res.error || 'Invalid Admin Password', 'error');
      sound.playErrorBuzz();
    }
  });

  // Logout
  el.btnAdminLogout.addEventListener('click', () => {
    triggerHaptic();
    localStorage.removeItem('exchangedesk_admin_session');
    el.adminAppWrapper.classList.add('hidden');
    el.adminAuthGate.classList.remove('hidden');
    showToast('Logged out of Admin Console', 'info');
  });

  // Jump to Pending Banner Button
  el.btnJumpToPending.addEventListener('click', () => switchTab('pending'));

  // Tab Buttons
  el.tabBtnPending.addEventListener('click', () => switchTab('pending'));
  el.tabBtnDeposits?.addEventListener('click', () => switchTab('deposits'));
  el.tabBtnRadar?.addEventListener('click', () => switchTab('radar'));
  el.tabBtnAuctions.addEventListener('click', () => switchTab('auctions'));
  el.tabBtnBuyers.addEventListener('click', () => switchTab('buyers'));
  el.tabBtnShowrooms.addEventListener('click', () => switchTab('showrooms'));
  el.tabBtnLedger.addEventListener('click', () => switchTab('ledger'));
  el.tabBtnConfig.addEventListener('click', () => switchTab('config'));

  // Refresh Buttons
  el.btnRefreshPending.addEventListener('click', () => { triggerHaptic(); loadPendingApprovals(); });
  el.btnRefreshDeposits?.addEventListener('click', () => { triggerHaptic(); loadPendingDeposits(); });
  el.btnRefreshRadar?.addEventListener('click', () => { triggerHaptic(); loadLiveBiddingRadar(); });
  el.btnRefreshAuctions.addEventListener('click', () => { triggerHaptic(); loadAuctions(); });
  el.selectAuctionStatusFilter.addEventListener('change', () => loadAuctions());
  el.btnRefreshBuyers.addEventListener('click', () => { triggerHaptic(); loadBuyers(); });
  el.btnRefreshShowrooms.addEventListener('click', () => { triggerHaptic(); loadShowrooms(); });

  // Config Form
  el.formConfig.addEventListener('submit', async (e) => {
    e.preventDefault();
    triggerHaptic();
    await handleSaveConfig();
  });

  // Wallet Modal
  el.btnCloseAdminWalletModal.addEventListener('click', () => el.modalAdminAdjustWallet.classList.add('hidden'));
  el.formAdminAdjustWallet.addEventListener('submit', async (e) => {
    e.preventDefault();
    triggerHaptic();
    await handleWalletAdjustSubmit();
  });

  // Bids Modal Close
  el.btnCloseBidsModal.addEventListener('click', () => el.modalBids.classList.add('hidden'));
}

function switchTab(tab) {
  triggerHaptic();
  state.activeTab = tab;

  el.sectionPending.classList.add('hidden');
  el.sectionDeposits?.classList.add('hidden');
  el.sectionRadar?.classList.add('hidden');
  el.sectionAuctions.classList.add('hidden');
  el.sectionBuyers.classList.add('hidden');
  el.sectionShowrooms.classList.add('hidden');
  el.sectionLedger.classList.add('hidden');
  el.sectionConfig.classList.add('hidden');

  const activeBtn = 'px-3.5 py-2 rounded-xl bg-purple-600 text-white font-bold whitespace-nowrap shadow';
  const inactiveBtn = 'px-3.5 py-2 rounded-xl text-slate-400 hover:text-white font-bold whitespace-nowrap';

  el.tabBtnPending.className = tab === 'pending' ? 'px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold whitespace-nowrap flex items-center gap-1.5 shadow' : 'px-3.5 py-2 rounded-xl text-slate-400 hover:text-white font-bold whitespace-nowrap flex items-center gap-1.5';
  if (el.tabBtnDeposits) {
    el.tabBtnDeposits.className = tab === 'deposits' ? 'px-3.5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold whitespace-nowrap flex items-center gap-1.5 shadow' : 'px-3.5 py-2 rounded-xl text-slate-400 hover:text-white font-bold whitespace-nowrap flex items-center gap-1.5';
  }
  if (el.tabBtnRadar) {
    el.tabBtnRadar.className = tab === 'radar' ? activeBtn : inactiveBtn;
  }
  el.tabBtnAuctions.className = tab === 'auctions' ? activeBtn : inactiveBtn;
  el.tabBtnBuyers.className = tab === 'buyers' ? activeBtn : inactiveBtn;
  el.tabBtnShowrooms.className = tab === 'showrooms' ? activeBtn : inactiveBtn;
  el.tabBtnLedger.className = tab === 'ledger' ? activeBtn : inactiveBtn;
  el.tabBtnConfig.className = tab === 'config' ? activeBtn : inactiveBtn;

  if (tab === 'pending') { el.sectionPending.classList.remove('hidden'); loadPendingApprovals(); }
  else if (tab === 'deposits') { el.sectionDeposits?.classList.remove('hidden'); loadPendingDeposits(); }
  else if (tab === 'radar') { el.sectionRadar?.classList.remove('hidden'); loadLiveBiddingRadar(); }
  else if (tab === 'auctions') { el.sectionAuctions.classList.remove('hidden'); loadAuctions(); }
  else if (tab === 'buyers') { el.sectionBuyers.classList.remove('hidden'); loadBuyers(); }
  else if (tab === 'showrooms') { el.sectionShowrooms.classList.remove('hidden'); loadShowrooms(); }
  else if (tab === 'ledger') { el.sectionLedger.classList.remove('hidden'); loadLedger(); }
  else if (tab === 'config') { el.sectionConfig.classList.remove('hidden'); }
}

async function loadAdminData() {
  try {
    const statsData = await api.getAdminStats();
    if (statsData.success) {
      const s = statsData.stats;
      state.stats = s;
      el.statRevenue.textContent = `₹${s.totalRevenue.toLocaleString('en-IN')}`;
      el.statGmv.textContent = `₹${s.totalGmv.toLocaleString('en-IN')}`;
      el.statLive.textContent = s.liveAuctions;
      el.statPending.textContent = s.pendingApprovals || 0;
      el.badgePendingCount.textContent = s.pendingApprovals || 0;
      el.tabPendingBadge.textContent = (s.pendingBuyers || 0) + (s.pendingShowrooms || 0);
      if (el.tabDepositsBadge) el.tabDepositsBadge.textContent = s.pendingDeposits || 0;
      if (el.pendingDepositsCountBadge) el.pendingDepositsCountBadge.textContent = s.pendingDeposits || 0;
      el.statLiquidity.textContent = `₹${s.totalLiquidity.toLocaleString('en-IN')}`;

      if (s.pendingApprovals > 0) {
        el.bannerPendingAlert.classList.remove('hidden');
      } else {
        el.bannerPendingAlert.classList.add('hidden');
      }

      el.inputMinWallet.value = s.activeConfig.minWalletBalanceToBid;
      el.inputHandoverFee.value = s.activeConfig.handoverPlatformFee;
      el.inputMinIncrement.value = s.activeConfig.minBidIncrement;
      el.inputAuctionDuration.value = s.activeConfig.defaultAuctionDurationMinutes;
    }

    if (state.activeTab === 'pending') await loadPendingApprovals();
    else if (state.activeTab === 'deposits') await loadPendingDeposits();
    else if (state.activeTab === 'radar') await loadLiveBiddingRadar();
    else if (state.activeTab === 'auctions') await loadAuctions();
    else if (state.activeTab === 'buyers') await loadBuyers();
    else if (state.activeTab === 'showrooms') await loadShowrooms();
    else if (state.activeTab === 'ledger') await loadLedger();
  } catch (err) {
    console.error('Error loading admin stats:', err);
  }
}

// ============================================================================
// 1. PENDING APPROVALS DESK
// ============================================================================
async function loadPendingApprovals() {
  try {
    const res = await api.getPendingApprovals();
    if (res.success) {
      el.pendingShowroomCount.textContent = res.pendingShowrooms.length;
      el.pendingBuyerCount.textContent = res.pendingBuyers.length;

      // Showrooms
      if (res.pendingShowrooms.length === 0) {
        el.pendingShowroomsList.innerHTML = `<div class="p-6 text-center text-xs text-slate-500">No pending showroom registrations. All approved!</div>`;
      } else {
        el.pendingShowroomsList.innerHTML = res.pendingShowrooms
          .map((s) => `
            <div class="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs hover:border-slate-700">
              <div class="space-y-0.5">
                <div class="font-bold text-white">${s.name}</div>
                <div class="text-[10px] text-slate-400">${s.address}</div>
                <div class="text-[10px] text-slate-500">Phone: <strong class="text-white">${s.phone}</strong> • ${new Date(s.created_at).toLocaleTimeString()}</div>
              </div>
              <div class="flex items-center space-x-1.5">
                <button class="btn-approve-showroom px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow active:scale-95" data-id="${s.id}">
                  ✓ Approve & Activate ID
                </button>
                <button class="btn-reject-showroom px-2 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 font-bold text-xs" data-id="${s.id}" title="Reject">
                  ✕
                </button>
              </div>
            </div>
          `).join('');

        document.querySelectorAll('.btn-approve-showroom').forEach((btn) => {
          btn.addEventListener('click', async () => {
            triggerHaptic();
            const id = parseInt(btn.dataset.id, 10);
            const r = await api.approveRegistration('showroom', id);
            showToast(r.message, 'success');
            sound.playWinTone();
            loadAdminData();
          });
        });

        document.querySelectorAll('.btn-reject-showroom').forEach((btn) => {
          btn.addEventListener('click', async () => {
            triggerHaptic();
            const id = parseInt(btn.dataset.id, 10);
            if (confirm('Reject and discard this showroom registration?')) {
              const r = await api.rejectRegistration('showroom', id);
              showToast(r.message, 'info');
              loadAdminData();
            }
          });
        });
      }

      // Buyers
      if (res.pendingBuyers.length === 0) {
        el.pendingBuyersList.innerHTML = `<div class="p-6 text-center text-xs text-slate-500">No pending buyer registrations. All approved!</div>`;
      } else {
        el.pendingBuyersList.innerHTML = res.pendingBuyers
          .map((b) => `
            <div class="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs hover:border-slate-700">
              <div class="space-y-0.5">
                <div class="font-bold text-white">${b.business_name}</div>
                <div class="text-[10px] text-slate-400">Mobile: <strong class="text-white">${b.phone}</strong></div>
                <div class="text-[10px] text-emerald-400 font-bold">Initial Wallet Deposit: ₹${b.wallet_balance.toLocaleString('en-IN')}</div>
              </div>
              <div class="flex items-center space-x-1.5">
                <button class="btn-approve-buyer px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow active:scale-95" data-id="${b.id}">
                  ✓ Approve & Activate ID
                </button>
                <button class="btn-reject-buyer px-2 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 font-bold text-xs" data-id="${b.id}" title="Reject">
                  ✕
                </button>
              </div>
            </div>
          `).join('');

        document.querySelectorAll('.btn-approve-buyer').forEach((btn) => {
          btn.addEventListener('click', async () => {
            triggerHaptic();
            const id = parseInt(btn.dataset.id, 10);
            const r = await api.approveRegistration('buyer', id);
            showToast(r.message, 'success');
            sound.playWinTone();
            loadAdminData();
          });
        });

        document.querySelectorAll('.btn-reject-buyer').forEach((btn) => {
          btn.addEventListener('click', async () => {
            triggerHaptic();
            const id = parseInt(btn.dataset.id, 10);
            if (confirm('Reject and discard this buyer registration?')) {
              const r = await api.rejectRegistration('buyer', id);
              showToast(r.message, 'info');
              loadAdminData();
            }
          });
        });
      }
    }
  } catch (err) {
    console.error('Error loading pending:', err);
  }
}

// ============================================================================
// PENDING WALLET DEPOSITS APPROVAL
// ============================================================================
async function loadPendingDeposits() {
  try {
    const res = await api.getPendingApprovals();
    if (res.success) {
      const deposits = res.pendingDeposits || [];
      if (el.pendingDepositsCountBadge) el.pendingDepositsCountBadge.textContent = deposits.length;
      if (el.tabDepositsBadge) el.tabDepositsBadge.textContent = deposits.length;

      if (deposits.length === 0) {
        el.pendingDepositsList.innerHTML = `<div class="p-8 text-center text-xs text-slate-500">No pending wallet deposit requests. All clear!</div>`;
        return;
      }

      el.pendingDepositsList.innerHTML = deposits
        .map((d) => `
          <div class="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs hover:border-slate-700 transition flex-wrap gap-3">
            <div class="space-y-1">
              <div class="flex items-center space-x-2">
                <span class="font-extrabold text-white text-sm">${d.business_name}</span>
                <span class="text-[10px] text-slate-400">Mobile: <strong class="text-white">${d.phone}</strong></span>
              </div>
              <div class="text-[11px] text-slate-400">
                Current Wallet: <span class="font-mono text-slate-200">₹${Number(d.current_wallet || 0).toLocaleString('en-IN')}</span> • Method: <strong class="text-white">${d.payment_method}</strong>
                ${d.reference_id ? ` • Ref/UTR: <span class="font-mono text-emerald-400 font-bold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">${d.reference_id}</span>` : ''}
              </div>
              <div class="text-[10px] text-slate-500">Requested: ${new Date(d.created_at).toLocaleString()}</div>
            </div>

            <div class="flex items-center space-x-3">
              <div class="text-right">
                <div class="text-[9px] uppercase font-bold text-slate-400">Requested Amount</div>
                <div class="text-lg font-black font-mono-numbers text-emerald-400">₹${Number(d.amount || 0).toLocaleString('en-IN')}</div>
              </div>
              <div class="flex items-center space-x-1.5">
                <button class="btn-approve-deposit px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow active:scale-95 transition" data-id="${d.id}">
                  ✓ Approve & Credit
                </button>
                <button class="btn-reject-deposit px-2.5 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 font-bold text-xs" data-id="${d.id}">
                  ✕ Reject
                </button>
              </div>
            </div>
          </div>
        `)
        .join('');

      document.querySelectorAll('.btn-approve-deposit').forEach((btn) => {
        btn.addEventListener('click', async () => {
          triggerHaptic();
          const id = parseInt(btn.dataset.id, 10);
          btn.disabled = true;
          btn.textContent = 'Crediting...';
          try {
            const r = await api.approveDepositRequest(id);
            if (r.success) {
              showToast(r.message, 'success');
              sound.playWinTone();
              loadAdminData();
            } else {
              showToast(r.error || 'Approval failed', 'error');
              sound.playErrorBuzz();
              btn.disabled = false;
              btn.textContent = '✓ Approve & Credit';
            }
          } catch (err) {
            showToast('Network error: ' + err.message, 'error');
            sound.playErrorBuzz();
            btn.disabled = false;
            btn.textContent = '✓ Approve & Credit';
          }
        });
      });

      document.querySelectorAll('.btn-reject-deposit').forEach((btn) => {
        btn.addEventListener('click', async () => {
          triggerHaptic();
          const id = parseInt(btn.dataset.id, 10);
          const notes = prompt('Enter reason for rejecting deposit request:', 'Payment UTR verification failed');
          if (notes) {
            const r = await api.rejectDepositRequest(id, notes);
            showToast(r.message, 'info');
            loadAdminData();
          }
        });
      });
    }
  } catch (err) {
    console.error('Error loading pending deposits:', err);
  }
}

// ============================================================================
// LIVE BIDDING RADAR (CITY-WIDE STREAM)
// ============================================================================
async function loadLiveBiddingRadar() {
  try {
    const res = await api.getAdminLiveBidsFeed();
    if (res.success) {
      if (!el.radarBidsList) return;
      if (res.bids.length === 0) {
        el.radarBidsList.innerHTML = `<div class="p-8 text-center text-xs text-slate-500">No bids placed across the platform yet. Live engine listening...</div>`;
        return;
      }
      el.radarBidsList.innerHTML = res.bids
        .map((b, idx) => `
          <div class="p-3 ${idx === 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-900 border-slate-800'} border rounded-xl flex items-center justify-between text-xs transition">
            <div class="space-y-0.5">
              <div class="flex items-center space-x-2">
                <span class="font-bold text-white">${b.bidder_name}</span>
                <span class="text-[10px] text-slate-400">(${b.bidder_phone || ''})</span>
                <span class="font-mono text-[10px] text-slate-400 bg-slate-950 px-1 py-0.5 rounded border border-slate-800">RC: ${b.rc_number}</span>
              </div>
              <div class="text-[11px] text-slate-300">
                Bid on <strong>${b.vehicle_model}</strong> at <strong>${b.showroom_name}</strong>
              </div>
            </div>
            <div class="text-right">
              <div class="font-black font-mono-numbers text-sm ${idx === 0 ? 'text-emerald-400' : 'text-slate-200'}">
                ₹${parseFloat(b.amount).toLocaleString('en-IN')}
              </div>
              <div class="text-[9px] text-slate-400">${new Date(b.placed_at).toLocaleTimeString()}</div>
            </div>
          </div>
        `)
        .join('');
    }
  } catch (err) {
    console.error('Error loading live bids radar:', err);
  }
}

function prependToRadar(bid) {
  if (!el.radarBidsList) return;
  const item = document.createElement('div');
  item.className = 'p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs animate-bid-flash';
  item.innerHTML = `
    <div class="space-y-0.5">
      <div class="flex items-center space-x-2">
        <span class="font-bold text-white">${bid.highestBidderName || 'Dealer'}</span>
        <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase">👑 LIVE BID</span>
      </div>
      <div class="text-[11px] text-slate-300">
        Bid on <strong>${bid.vehicleModel || 'Bike'}</strong> (#${bid.auctionId})
      </div>
    </div>
    <div class="text-right">
      <div class="font-black font-mono-numbers text-sm text-emerald-400">
        ₹${parseFloat(bid.newHighestBid).toLocaleString('en-IN')}
      </div>
      <div class="text-[9px] text-slate-400">${new Date(bid.timestamp || Date.now()).toLocaleTimeString()}</div>
    </div>
  `;
  el.radarBidsList.prepend(item);
}

// ============================================================================
// 2. FLASH AUCTIONS SUPERVISOR
// ============================================================================
async function loadAuctions() {
  try {
    const filter = el.selectAuctionStatusFilter.value;
    const res = await api.getAdminAuctions(filter);
    if (res.success) {
      state.auctions = res.auctions || [];
      if (res.serverTime) {
        state.serverTimeSkew = res.serverTime - Date.now();
      }

      if (res.auctions.length === 0) {
        el.auctionsList.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">No auctions found under status "${filter}".</div>`;
        return;
      }
      el.auctionsList.innerHTML = res.auctions
        .map((a) => {
          const isLive = a.status === 'LIVE';
          const isCompleted = a.status === 'COMPLETED';
          const isCancelled = a.status === 'CANCELLED';
          const recentBids = a.recent_bids || [];
          const badge = isLive
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            : isCompleted
            ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
            : isCancelled
            ? 'bg-red-500/10 text-red-400 border-red-500/30'
            : 'bg-slate-800 text-slate-400 border-slate-700';

          return `
            <div class="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-3 hover:border-slate-700 transition">
              <div class="flex items-start justify-between gap-3">
                <div class="space-y-1">
                  <div class="flex items-center space-x-2">
                    <span class="font-extrabold text-white text-sm">#${a.id} ${a.vehicle_model} (${a.manufacturing_year})</span>
                    <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase border ${badge}">${a.status}</span>
                    <span class="font-mono text-[10px] text-emerald-400 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">RC: ${a.rc_number}</span>
                  </div>
                  <div class="text-[11px] text-slate-400">
                    Showroom Desk: <strong class="text-white">${a.showroom_name}</strong> (${a.showroom_phone || 'No phone'}) • Odometer: ${a.km_driven.toLocaleString('en-IN')} KM
                  </div>
                  <div class="text-[11px] text-slate-300">
                    Valuation: <strong class="text-emerald-400 font-mono-numbers text-xs">₹${a.current_highest_bid.toLocaleString('en-IN')}</strong> (Reserve: ₹${a.base_price.toLocaleString('en-IN')})
                    ${
                      a.highest_bidder_name
                        ? `• Lead Bidder: <span class="text-white font-bold">${a.highest_bidder_name}</span> (${a.bidder_phone || ''})`
                        : '• No bids placed'
                    }
                  </div>
                </div>

                <div class="flex items-center space-x-2 shrink-0">
                  ${
                    isLive
                      ? `
                    <button class="btn-extend-auction px-2.5 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30 text-xs font-bold active:scale-95 transition" data-id="${a.id}" title="Extend Timer by 5 Minutes">
                      ⏱️ +5m
                    </button>
                    <button class="btn-force-close px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow active:scale-95" data-id="${a.id}">
                      ⏹️ Force Close
                    </button>
                    <button class="btn-cancel-auction px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 text-xs font-bold" data-id="${a.id}">
                      🚫 Cancel
                    </button>
                  `
                      : ''
                  }
                  <button class="btn-view-bids px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/30 text-xs font-bold" data-id="${a.id}">
                    📋 Bids (${a.total_bids})
                  </button>
                </div>
              </div>

              <!-- Authoritative 10-Minute Rapid Timer Bar for Admin -->
              <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 space-y-1.5">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-400 font-bold flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}"></span>
                    Authoritative 10-Min Clock:
                  </span>
                  <span id="admin-timer-${a.id}" class="font-mono-numbers font-black text-xs text-emerald-400">--:--</span>
                </div>
                <div class="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                  <div id="admin-timer-bar-${a.id}" class="bg-emerald-500 h-full w-full transition-all duration-100"></div>
                </div>
              </div>

              <!-- Inline Recent Bids Stream -->
              ${
                recentBids.length > 0
                  ? `
                <div class="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60 space-y-1">
                  <div class="text-[9px] uppercase font-bold text-slate-500">Live Bids Stream:</div>
                  <div class="space-y-1">
                    ${recentBids.slice(0, 3).map((b, idx) => `
                      <div class="flex items-center justify-between text-[11px] ${idx === 0 ? 'text-emerald-300 font-bold' : 'text-slate-400'}">
                        <span>${idx === 0 ? '👑 ' : ''}${b.bidder_name} (${b.bidder_phone || ''})</span>
                        <span class="font-mono">₹${parseFloat(b.amount).toLocaleString('en-IN')} <span class="text-[9px] text-slate-500">(${new Date(b.placed_at).toLocaleTimeString()})</span></span>
                      </div>
                    `).join('')}
                  </div>
                </div>
              `
                  : ''
              }
            </div>
          `;
        })
        .join('');

      document.querySelectorAll('.btn-extend-auction').forEach((btn) => {
        btn.addEventListener('click', async () => {
          triggerHaptic();
          const id = parseInt(btn.dataset.id, 10);
          btn.disabled = true;
          const r = await api.extendAuction(id, 5);
          if (r.success) {
            showToast(r.message || 'Extended auction by 5 minutes!', 'success');
            sound.playWinTone();
            loadAuctions();
          } else {
            showToast(r.error || 'Failed to extend auction', 'error');
            sound.playErrorBuzz();
            btn.disabled = false;
          }
        });
      });

      document.querySelectorAll('.btn-force-close').forEach((btn) => {
        btn.addEventListener('click', async () => {
          triggerHaptic();
          const id = parseInt(btn.dataset.id, 10);
          if (confirm(`Force close live Auction #${id}? The current highest bidder will win immediately.`)) {
            const r = await api.forceCloseAuction(id);
            showToast(r.message, 'info');
            loadAuctions();
            loadAdminData();
          }
        });
      });

      document.querySelectorAll('.btn-cancel-auction').forEach((btn) => {
        btn.addEventListener('click', async () => {
          triggerHaptic();
          const id = parseInt(btn.dataset.id, 10);
          const reason = prompt('Enter reason for administrative cancellation:', 'Disputed vehicle specifications');
          if (reason) {
            const r = await api.cancelAuction(id, reason);
            showToast(r.message, 'info');
            loadAuctions();
            loadAdminData();
          }
        });
      });

      document.querySelectorAll('.btn-view-bids').forEach((btn) => {
        btn.addEventListener('click', () => {
          triggerHaptic();
          const id = parseInt(btn.dataset.id, 10);
          openAuditModal(id);
        });
      });
    }
  } catch (err) {
    console.error('Error loading auctions:', err);
  }
}

// ============================================================================
// 3. APPROVED BUYERS MANAGEMENT
// ============================================================================
async function loadBuyers() {
  try {
    const res = await api.getAdminBuyers();
    if (res.success) {
      const approvedOnly = res.buyers.filter((b) => b.is_approved !== false);
      if (approvedOnly.length === 0) {
        el.buyersList.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">No approved buyers found. Review pending registrations!</div>`;
        return;
      }
      el.buyersList.innerHTML = approvedOnly
        .map((b) => {
          const isBlocked = b.is_active === false;
          return `
            <div class="p-3.5 flex items-center justify-between text-xs hover:bg-slate-900/60 transition ${isBlocked ? 'opacity-70 bg-red-950/20' : ''}">
              <div class="space-y-1">
                <div class="flex items-center space-x-2">
                  <span class="font-bold text-white text-sm">${b.business_name}</span>
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-black ${b.is_verified ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'}">
                    ${b.is_verified ? 'KYC VERIFIED' : 'UNVERIFIED'}
                  </span>
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-black ${isBlocked ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}">
                    ${isBlocked ? '🚫 BLOCKED' : 'ACTIVE'}
                  </span>
                </div>
                <div class="text-[11px] text-slate-400">Contact: <strong class="text-white">${b.phone}</strong> • Bids: ${b.total_bids_placed} • Won: ${b.total_auctions_won}</div>
                <div class="text-xs font-black font-mono-numbers ${b.wallet_balance < 3000 ? 'text-amber-400' : 'text-emerald-400'}">
                  Wallet Balance: ₹${b.wallet_balance.toLocaleString('en-IN')}
                </div>
              </div>
              <div class="flex items-center space-x-2 flex-wrap gap-1">
                <button class="btn-toggle-buyer-status px-2.5 py-1 rounded-lg text-xs font-bold ${isBlocked ? 'bg-emerald-500 text-slate-950' : 'bg-red-500/20 text-red-300 border border-red-500/30'}" data-id="${b.id}">
                  ${isBlocked ? 'Unblock' : 'Block'}
                </button>
                <button class="btn-toggle-buyer-verify px-2.5 py-1 rounded-lg text-xs font-bold ${b.is_verified ? 'bg-slate-800 text-slate-300 hover:bg-amber-500/20' : 'bg-blue-500 text-white'}" data-id="${b.id}">
                  ${b.is_verified ? 'Revoke KYC' : 'Verify KYC'}
                </button>
                <button class="btn-open-wallet px-2.5 py-1 rounded-lg bg-purple-600/30 text-purple-300 hover:bg-purple-600/40 border border-purple-500/30 text-xs font-bold" data-id="${b.id}" data-name="${b.business_name}" data-balance="${b.wallet_balance}">
                  Adjust Wallet ±
                </button>
                <button class="btn-delete-buyer px-2 py-1 rounded-lg bg-red-950/60 text-red-400 hover:bg-red-900 text-xs font-bold" data-id="${b.id}" title="Delete">
                  ✕
                </button>
              </div>
            </div>
          `;
        })
        .join('');

      document.querySelectorAll('.btn-toggle-buyer-status').forEach((btn) => {
        btn.addEventListener('click', async () => {
          triggerHaptic();
          const id = parseInt(btn.dataset.id, 10);
          const r = await api.toggleBuyerStatus(id);
          showToast(r.message, 'info');
          loadBuyers();
          loadAdminData();
        });
      });

      document.querySelectorAll('.btn-toggle-buyer-verify').forEach((btn) => {
        btn.addEventListener('click', async () => {
          triggerHaptic();
          const id = parseInt(btn.dataset.id, 10);
          const r = await api.toggleBuyerVerification(id);
          showToast(r.message, 'info');
          loadBuyers();
          loadAdminData();
        });
      });

      document.querySelectorAll('.btn-open-wallet').forEach((btn) => {
        btn.addEventListener('click', () => {
          triggerHaptic();
          openWalletModal({
            id: parseInt(btn.dataset.id, 10),
            name: btn.dataset.name,
            balance: parseFloat(btn.dataset.balance),
          });
        });
      });

      document.querySelectorAll('.btn-delete-buyer').forEach((btn) => {
        btn.addEventListener('click', async () => {
          triggerHaptic();
          const id = parseInt(btn.dataset.id, 10);
          if (confirm(`Delete Buyer #${id}? This cannot be undone.`)) {
            const r = await api.deleteBuyer(id);
            showToast(r.message, 'info');
            loadBuyers();
            loadAdminData();
          }
        });
      });
    }
  } catch (err) {
    console.error('Error loading buyers:', err);
  }
}

// ============================================================================
// 4. APPROVED SHOWROOMS MANAGEMENT
// ============================================================================
async function loadShowrooms() {
  try {
    const res = await api.getShowrooms();
    if (res.success) {
      const approvedOnly = res.showrooms.filter((s) => s.is_approved !== false);
      if (approvedOnly.length === 0) {
        el.showroomsList.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">No approved showrooms found. Review pending registrations!</div>`;
        return;
      }
      el.showroomsList.innerHTML = approvedOnly
        .map((s) => {
          const isDeactivated = s.is_active === false;
          return `
            <div class="p-3.5 flex items-center justify-between text-xs hover:bg-slate-900/60 transition ${isDeactivated ? 'opacity-70 bg-red-950/20' : ''}">
              <div class="space-y-1">
                <div class="flex items-center space-x-2">
                  <span class="font-bold text-white text-sm">${s.name}</span>
                  <span class="px-2 py-0.5 rounded text-[9px] font-black ${isDeactivated ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}">
                    ${isDeactivated ? 'DEACTIVATED' : 'ACTIVE'}
                  </span>
                </div>
                <div class="text-[11px] text-slate-400">${s.address}</div>
                <div class="text-[11px] text-slate-500">Contact: <strong class="text-white">${s.phone}</strong></div>
              </div>
              <div class="flex items-center space-x-2">
                <span class="text-xs font-mono-numbers font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                  ${s.total_auctions || 0} listings
                </span>
                <button class="btn-toggle-showroom px-2.5 py-1 rounded-lg text-xs font-bold ${isDeactivated ? 'bg-emerald-500 text-slate-950' : 'bg-red-500/20 text-red-300 border border-red-500/30'}" data-id="${s.id}">
                  ${isDeactivated ? 'Activate' : 'Deactivate'}
                </button>
                <button class="btn-delete-showroom px-2 py-1 rounded-lg bg-red-950/60 text-red-400 hover:bg-red-900 text-xs font-bold" data-id="${s.id}" title="Delete">
                  ✕
                </button>
              </div>
            </div>
          `;
        })
        .join('');

      document.querySelectorAll('.btn-toggle-showroom').forEach((btn) => {
        btn.addEventListener('click', async () => {
          triggerHaptic();
          const id = parseInt(btn.dataset.id, 10);
          const r = await api.toggleShowroomStatus(id);
          showToast(r.message, 'info');
          loadShowrooms();
          loadAdminData();
        });
      });

      document.querySelectorAll('.btn-delete-showroom').forEach((btn) => {
        btn.addEventListener('click', async () => {
          triggerHaptic();
          const id = parseInt(btn.dataset.id, 10);
          if (confirm(`Delete Showroom #${id}? This cannot be undone.`)) {
            const r = await api.deleteShowroom(id);
            showToast(r.message, 'info');
            loadShowrooms();
            loadAdminData();
          }
        });
      });
    }
  } catch (err) {
    console.error('Error loading showrooms:', err);
  }
}

// ============================================================================
// 5. FEE LEDGER
// ============================================================================
async function loadLedger() {
  try {
    const res = await api.getAdminTransactions();
    if (res.success) {
      el.ledgerCountBadge.textContent = `${res.transactions.length} deductions`;
      if (res.transactions.length === 0) {
        el.ledgerList.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">No handover fee transactions recorded yet.</div>`;
        return;
      }
      el.ledgerList.innerHTML = res.transactions
        .map((tx) => `
          <div class="p-3.5 flex items-center justify-between text-xs hover:bg-slate-900/60 transition">
            <div class="space-y-0.5">
              <div class="flex items-center space-x-2">
                <span class="font-bold text-white text-sm">${tx.vehicle_model}</span>
                <span class="font-mono text-[10px] text-slate-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">${tx.rc_number}</span>
              </div>
              <div class="text-[11px] text-slate-400">
                Winning Buyer: <strong class="text-emerald-400">${tx.buyer_name}</strong> • Showroom: ${tx.showroom_name}
              </div>
              <div class="text-[10px] text-slate-500 font-mono-numbers">
                Txn #${tx.id} • ${new Date(tx.created_at).toLocaleString()}
              </div>
            </div>
            <div class="text-right">
              <div class="text-emerald-400 font-black font-mono-numbers text-base">+₹${tx.amount.toLocaleString('en-IN')}</div>
              <div class="text-[10px] text-slate-400">Auto-Monetized</div>
            </div>
          </div>
        `)
        .join('');
    }
  } catch (err) {
    console.error('Error loading ledger:', err);
  }
}

// ============================================================================
// 6. CONFIG TUNING
// ============================================================================
async function handleSaveConfig() {
  const minWallet = parseFloat(el.inputMinWallet.value);
  const fee = parseFloat(el.inputHandoverFee.value);
  const inc = parseFloat(el.inputMinIncrement.value);
  const dur = parseInt(el.inputAuctionDuration.value, 10);

  try {
    const res = await api.updateConfig({
      minWalletBalanceToBid: minWallet,
      handoverPlatformFee: fee,
      minBidIncrement: inc,
      defaultAuctionDurationMinutes: dur,
    });
    if (res.success) {
      showToast('Platform business rules updated dynamically', 'success');
      sound.playWinTone();
    }
  } catch (err) {
    showToast('Failed to update config: ' + err.message, 'error');
  }
}

// ============================================================================
// MODAL HANDLERS
// ============================================================================
function openWalletModal(buyer) {
  el.adminAdjustBuyerId.value = buyer.id;
  el.adminAdjustBuyerName.textContent = buyer.name;
  el.adminAdjustCurrentBalance.textContent = `₹${buyer.balance.toLocaleString('en-IN')}`;
  el.modalAdminAdjustWallet.classList.remove('hidden');
}

async function handleWalletAdjustSubmit() {
  const buyerId = parseInt(el.adminAdjustBuyerId.value, 10);
  const action = el.selectAdminWalletAction.value;
  const amount = parseFloat(el.inputAdminWalletAmount.value);

  if (isNaN(amount) || amount <= 0) return showToast('Enter valid amount', 'error');

  try {
    const res = await api.adjustBuyerWallet(buyerId, amount, action);
    if (res.success) {
      showToast(res.message, 'success');
      sound.playWinTone();
      el.modalAdminAdjustWallet.classList.add('hidden');
      loadBuyers();
      loadAdminData();
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function openAuditModal(auctionId) {
  el.modalBids.classList.remove('hidden');
  el.auditBidsList.innerHTML = `<div class="p-4 text-center text-xs text-slate-400">Loading audit history...</div>`;

  try {
    const res = await api.getAuctionDetails(auctionId, 'admin');
    if (res.success) {
      el.auditVehicleTitle.textContent = `${res.auction.vehicle_model} (Base: ₹${parseFloat(res.auction.base_price).toLocaleString('en-IN')})`;
      if (res.bids.length === 0) {
        el.auditBidsList.innerHTML = `<div class="p-6 text-center text-xs text-slate-400">No bids placed yet. Current valuation at reserve.</div>`;
        return;
      }
      el.auditBidsList.innerHTML = res.bids
        .map((bid, index) => {
          const isLatest = index === 0;
          return `
            <div class="flex items-center justify-between p-2 rounded-xl ${isLatest ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-slate-900 border border-slate-800'} text-xs">
              <div class="flex items-center space-x-2">
                <span class="w-4 h-4 rounded-full ${isLatest ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'} flex items-center justify-center text-[9px]">
                  #${res.bids.length - index}
                </span>
                <div>
                  <div class="font-bold text-white">${bid.bidder_name}</div>
                  <div class="text-[9px] text-slate-400">${new Date(bid.placed_at).toLocaleTimeString()}</div>
                </div>
              </div>
              <div class="text-right">
                <div class="font-black font-mono-numbers ${isLatest ? 'text-emerald-400 text-xs' : 'text-slate-300'}">
                  ₹${parseFloat(bid.amount).toLocaleString('en-IN')}
                </div>
                ${isLatest ? `<span class="text-[8px] text-emerald-400 font-bold uppercase">Highest</span>` : ''}
              </div>
            </div>
          `;
        })
        .join('');
    }
  } catch (err) {
    el.auditBidsList.innerHTML = `<div class="p-4 text-xs text-red-400">Error: ${err.message}</div>`;
  }
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-emerald-600 text-white' : type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-100 border border-slate-700';
  toast.className = `${bg} pointer-events-auto px-3.5 py-2.5 rounded-xl shadow-xl text-xs font-semibold flex items-center justify-between transition-all duration-300 transform translate-y-2 opacity-0`;
  toast.innerHTML = `<span>${message}</span><button class="ml-2 text-white/70 hover:text-white text-sm">&times;</button>`;
  el.toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.remove('translate-y-2', 'opacity-0'));
  const remove = () => { toast.classList.add('opacity-0', 'translate-y-2'); setTimeout(() => toast.remove(), 300); };
  toast.querySelector('button').addEventListener('click', remove);
  setTimeout(remove, 4000);
}

document.addEventListener('DOMContentLoaded', initAdmin);
