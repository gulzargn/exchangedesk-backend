/**
 * ExchangeDesk - Unified Mobile SuperApp
 * All-in-One: Buyer Live Bidding + Showroom Seller + Super Admin Console
 */

import { api, API_BASE } from './api.js';
import { sound } from './sound.js';

// ============================================================================
// APPLICATION STATE
// ============================================================================
const state = {
  currentUser: null, // { role: 'buyer' | 'showroom' | 'admin', id, name, phone, wallet_balance, is_verified, is_active }
  activeRole: 'buyer', // 'buyer' | 'seller' | 'admin'
  isMobileFrame: false,
  currentShowroomId: null,
  currentBuyerId: null,
  showrooms: [],
  buyers: [],
  auctions: [],
  serverTimeSkew: 0,
  revealedOtps: new Set(),
  socket: null,
  pendingPhotos: [], // Array of compressed image data URLs
  pendingEngineMedia: '', // Data URL for video/audio clip
  pendingEngineMediaType: '', // 'video' | 'audio'
  zoomPhotos: [],
  zoomCurrentIndex: 0,
  zoomScale: 1,
  zoomTranslateX: 0,
  zoomTranslateY: 0,
  pendingListing: null,
  pendingBid: null, // { auctionId, increment, currentHighest, newTotal, vehicleTitle, sellerName }
};

// ============================================================================
// DOM ELEMENTS
// ============================================================================
const el = {
  // Shell & Device Controls
  appFrameWrapper: document.getElementById('appFrameWrapper'),
  appContainer: document.getElementById('appContainer'),
  btnAudioToggle: document.getElementById('btnAudioToggle'),
  iconAudioOn: document.getElementById('iconAudioOn'),
  iconAudioOff: document.getElementById('iconAudioOff'),
  socketDot: document.getElementById('socketDot'),
  socketStatusText: document.getElementById('socketStatusText'),
  activeRoleBadge: document.getElementById('activeRoleBadge'),

  // Gatekeeper Authentication Elements
  authGateScreen: document.getElementById('authGateScreen'),
  gateTabBuyer: document.getElementById('gateTabBuyer'),
  gateTabShowroom: document.getElementById('gateTabShowroom'),

  gateBuyerSection: document.getElementById('gateBuyerSection'),
  btnBuyerModeLogin: document.getElementById('btnBuyerModeLogin'),
  btnBuyerModeRegister: document.getElementById('btnBuyerModeRegister'),
  formBuyerLogin: document.getElementById('formBuyerLogin'),
  inputBuyerLoginPhone: document.getElementById('inputBuyerLoginPhone'),
  inputBuyerLoginPin: document.getElementById('inputBuyerLoginPin'),
  formBuyerRegister: document.getElementById('formBuyerRegister'),
  inputBuyerRegName: document.getElementById('inputBuyerRegName'),
  inputBuyerRegPhone: document.getElementById('inputBuyerRegPhone'),
  inputBuyerRegPin: document.getElementById('inputBuyerRegPin'),
  inputBuyerRegDeposit: document.getElementById('inputBuyerRegDeposit'),

  gateShowroomSection: document.getElementById('gateShowroomSection'),
  btnShowroomModeLogin: document.getElementById('btnShowroomModeLogin'),
  btnShowroomModeRegister: document.getElementById('btnShowroomModeRegister'),
  formShowroomLogin: document.getElementById('formShowroomLogin'),
  inputShowroomLoginPhone: document.getElementById('inputShowroomLoginPhone'),
  inputShowroomLoginPin: document.getElementById('inputShowroomLoginPin'),
  formShowroomRegister: document.getElementById('formShowroomRegister'),
  inputShowroomRegName: document.getElementById('inputShowroomRegName'),
  inputShowroomRegPhone: document.getElementById('inputShowroomRegPhone'),
  inputShowroomRegAddress: document.getElementById('inputShowroomRegAddress'),
  inputShowroomRegPin: document.getElementById('inputShowroomRegPin'),

  // Header Session & Logout Controls
  headerUserInfo: document.getElementById('headerUserInfo'),
  headerUserIcon: document.getElementById('headerUserIcon'),
  headerUserName: document.getElementById('headerUserName'),
  btnHeaderLogout: document.getElementById('btnHeaderLogout'),

  // Bottom Nav
  navBtnBuyer: document.getElementById('navBtnBuyer'),
  navBtnWallet: document.getElementById('navBtnWallet'),
  navBtnSellerDeals: document.getElementById('navBtnSellerDeals'),
  navBtnSellerPost: document.getElementById('navBtnSellerPost'),

  // View Containers
  viewBuyer: document.getElementById('viewBuyer'),
  viewShowroom: document.getElementById('viewShowroom'),

  // Buyer View Elements
  selectBuyer: document.getElementById('selectBuyer'),
  buyerWalletDisplay: document.getElementById('buyerWalletDisplay'),
  btnTopupWallet: document.getElementById('btnTopupWallet'),
  walletRuleAlert: document.getElementById('walletRuleAlert'),
  buyerAuctionsContainer: document.getElementById('buyerAuctionsContainer'),
  buyerActiveCount: document.getElementById('buyerActiveCount'),

  // Showroom View Elements
  selectShowroom: document.getElementById('selectShowroom'),
  createAuctionForm: document.getElementById('createAuctionForm'),
  showroomAuctionsContainer: document.getElementById('showroomAuctionsContainer'),
  showroomActiveCount: document.getElementById('showroomActiveCount'),
  btnRefreshShowroom: document.getElementById('btnRefreshShowroom'),

  // Modals
  modalHandover: document.getElementById('modalHandover'),
  btnCloseModal: document.getElementById('btnCloseModal'),
  formVerifyOtp: document.getElementById('formVerifyOtp'),
  modalAuctionId: document.getElementById('modalAuctionId'),
  modalVehicleName: document.getElementById('modalVehicleName'),
  modalWinnerName: document.getElementById('modalWinnerName'),
  modalFinalPrice: document.getElementById('modalFinalPrice'),
  inputPickupOtp: document.getElementById('inputPickupOtp'),
  handoverReceipt: document.getElementById('handoverReceipt'),
  receiptTxnId: document.getElementById('receiptTxnId'),
  receiptRc: document.getElementById('receiptRc'),
  receiptRemaining: document.getElementById('receiptRemaining'),

  modalAddShowroom: document.getElementById('modalAddShowroom'),
  btnCloseShowroomModal: document.getElementById('btnCloseShowroomModal'),
  formAddShowroom: document.getElementById('formAddShowroom'),
  btnOpenRegisterShowroom: document.getElementById('btnOpenRegisterShowroom'),

  modalAddBuyer: document.getElementById('modalAddBuyer'),
  btnCloseBuyerModal: document.getElementById('btnCloseBuyerModal'),
  formAddBuyer: document.getElementById('formAddBuyer'),
  btnOpenRegisterBuyer: document.getElementById('btnOpenRegisterBuyer'),

  modalDepositFunds: document.getElementById('modalDepositFunds'),
  btnCloseDepositModal: document.getElementById('btnCloseDepositModal'),
  inputCustomDeposit: document.getElementById('inputCustomDeposit'),
  btnSubmitDeposit: document.getElementById('btnSubmitDeposit'),

  modalBids: document.getElementById('modalBids'),
  btnCloseBidsModal: document.getElementById('btnCloseBidsModal'),
  auditVehicleTitle: document.getElementById('auditVehicleTitle'),
  auditBidsList: document.getElementById('auditBidsList'),

  // Media Upload Elements
  formBikePhotos: document.getElementById('formBikePhotos'),
  btnTriggerAddPhotos: document.getElementById('btnTriggerAddPhotos'),
  photoPreviewGrid: document.getElementById('photoPreviewGrid'),
  photoCountBadge: document.getElementById('photoCountBadge'),
  formEngineMedia: document.getElementById('formEngineMedia'),
  btnTriggerAddVideo: document.getElementById('btnTriggerAddVideo'),
  mediaPreviewWrapper: document.getElementById('mediaPreviewWrapper'),
  mediaPreviewTitle: document.getElementById('mediaPreviewTitle'),
  btnRemoveMedia: document.getElementById('btnRemoveMedia'),
  videoPreviewEl: document.getElementById('videoPreviewEl'),
  audioPreviewEl: document.getElementById('audioPreviewEl'),

  // Media Viewer Modal
  modalMediaViewer: document.getElementById('modalMediaViewer'),
  btnCloseMediaModal: document.getElementById('btnCloseMediaModal'),
  btnMediaModalCloseBottom: document.getElementById('btnMediaModalCloseBottom'),
  mediaModalTitle: document.getElementById('mediaModalTitle'),
  mediaModalSubtitle: document.getElementById('mediaModalSubtitle'),
  mediaModalVideoSection: document.getElementById('mediaModalVideoSection'),
  modalVideoPlayer: document.getElementById('modalVideoPlayer'),
  modalAudioPlayer: document.getElementById('modalAudioPlayer'),
  mediaModalPhotosSection: document.getElementById('mediaModalPhotosSection'),
  mediaModalPhotoCount: document.getElementById('mediaModalPhotoCount'),
  mediaModalPhotosGrid: document.getElementById('mediaModalPhotosGrid'),

  // Photo Zoom Lightbox
  modalPhotoZoom: document.getElementById('modalPhotoZoom'),
  zoomTargetImg: document.getElementById('zoomTargetImg'),
  zoomPhotoCounter: document.getElementById('zoomPhotoCounter'),
  zoomLevelBadge: document.getElementById('zoomLevelBadge'),
  zoomViewport: document.getElementById('zoomViewport'),
  btnZoomIn: document.getElementById('btnZoomIn'),
  btnZoomOut: document.getElementById('btnZoomOut'),
  btnZoomReset: document.getElementById('btnZoomReset'),
  btnClosePhotoZoom: document.getElementById('btnClosePhotoZoom'),
  btnZoomPrev: document.getElementById('btnZoomPrev'),
  btnZoomNext: document.getElementById('btnZoomNext'),
  zoomThumbnailStrip: document.getElementById('zoomThumbnailStrip'),

  // Pre-Launch Listing Preview
  modalPostPreview: document.getElementById('modalPostPreview'),
  btnClosePostPreview: document.getElementById('btnClosePostPreview'),
  btnPreviewEdit: document.getElementById('btnPreviewEdit'),
  btnPreviewConfirm: document.getElementById('btnPreviewConfirm'),

  // In-App Auto-Update Elements
  modalAppUpdate: document.getElementById('modalAppUpdate'),
  updateModalVersionBadge: document.getElementById('updateModalVersionBadge'),
  updateModalTitle: document.getElementById('updateModalTitle'),
  updateModalNotesList: document.getElementById('updateModalNotesList'),
  btnTriggerAppUpdate: document.getElementById('btnTriggerAppUpdate'),
  btnTriggerAppUpdateText: document.getElementById('btnTriggerAppUpdateText'),
  btnDismissAppUpdate: document.getElementById('btnDismissAppUpdate'),
  btnHeaderUpdatePill: document.getElementById('btnHeaderUpdatePill'),
  btnCheckUpdateLogin: document.getElementById('btnCheckUpdateLogin'),
  updateChangelogBox: document.getElementById('updateChangelogBox'),
  updateDownloadProgressArea: document.getElementById('updateDownloadProgressArea'),
  updateProgressStatusText: document.getElementById('updateProgressStatusText'),
  updateProgressPercent: document.getElementById('updateProgressPercent'),
  updateProgressBarFill: document.getElementById('updateProgressBarFill'),
  updateInstallInstructions: document.getElementById('updateInstallInstructions'),

  // Bid Confirmation Modal Elements
  modalBidConfirmation: document.getElementById('modalBidConfirmation'),
  btnCloseBidConfirmation: document.getElementById('btnCloseBidConfirmation'),
  bidConfirmVehicleTitle: document.getElementById('bidConfirmVehicleTitle'),
  bidConfirmSellerName: document.getElementById('bidConfirmSellerName'),
  bidConfirmCurrentBid: document.getElementById('bidConfirmCurrentBid'),
  bidConfirmIncrement: document.getElementById('bidConfirmIncrement'),
  bidConfirmNewTotalBid: document.getElementById('bidConfirmNewTotalBid'),
  btnConfirmPlaceBid: document.getElementById('btnConfirmPlaceBid'),
  btnConfirmPlaceBidText: document.getElementById('btnConfirmPlaceBidText'),
  btnCancelBidConfirmation: document.getElementById('btnCancelBidConfirmation'),

  toastContainer: document.getElementById('toastContainer'),
};

// ============================================================================
// INITIALIZATION & SESSION PERSISTENCE (PERSISTENT LOGIN)
// ============================================================================
async function initApp() {
  setupEventListeners();

  // 0. Instant Cache-First UI: Load previously cached auctions (0ms instant display, zero waiting)
  loadCachedAuctions();

  // 1. Instantly restore saved session synchronously (Zero login flash, persists across app restarts)
  const hasRestoredSession = restoreSessionImmediately();

  // 2. Setup real-time sockets
  setupSocket();

  // 3. Smooth Opening Splash Screen transition (1.1s native reveal)
  setTimeout(() => {
    const splash = document.getElementById('appSplashScreen');
    if (splash) {
      splash.classList.add('splash-fade-out');
      setTimeout(() => splash.remove(), 700);
    }
  }, 1100);

  // 4. Load initial auctions and platform data in parallel
  await loadInitialData();

  // 5. Start authoritative auction countdown timer loop
  startAuthoritativeTimerLoop();

  // 6. In background, verify session and sync latest wallet balance without logging out user on network hiccups
  if (hasRestoredSession) {
    verifySessionInBackground();
  }

  // 100% Fully Automated High-Speed Real-Time Sync (1-second heartbeat keeps Buyer and Seller in sync)
  setInterval(() => {
    refreshCurrentAuctions();
  }, 1000);

  // 7. Check for In-App Native APK Updates & Silent Asset Upgrades
  setTimeout(() => checkForAppUpdates(false), 1500);
  setInterval(() => checkForAppUpdates(false), 30 * 1000);
}

function triggerHaptic() {
  if (navigator.vibrate) {
    try { navigator.vibrate(15); } catch {}
  }
}

function loadCachedAuctions() {
  try {
    const cached = localStorage.getItem('exchangedesk_cached_auctions');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        state.auctions = parsed;
        renderAuctions();
      }
    }
  } catch {}
}

// ============================================================================
// IN-APP AUTO-UPDATE ENGINE
// ============================================================================
const CURRENT_APP_VERSION = '2.2.0';
const CURRENT_APP_VERSION_CODE = 220;
const CURRENT_APP_BUILD = '20261024_12';
let cachedUpdateInfo = null;

async function checkForAppUpdates(isManual = false) {
  try {
    if (isManual) {
      showToast('Checking for latest updates...', 'info', 1500);
    }

    let res = null;
    try {
      const apiRes = await fetch(`/api/version?_t=${Date.now()}`, { cache: 'no-store' });
      if (apiRes.ok) res = await apiRes.json();
    } catch {}

    if (!res) {
      try {
        const staticRes = await fetch(`/version.json?_t=${Date.now()}`, { cache: 'no-store' });
        if (staticRes.ok) res = await staticRes.json();
      } catch {}
    }

    if (!res || !res.versionCode) {
      if (isManual) showToast('Unable to check for updates right now', 'error');
      return;
    }

    // Automatic Silent Asset Refresh: if server deployed a new build, silently refresh once
    if (res.build && res.build !== CURRENT_APP_BUILD && localStorage.getItem('applied_build') !== res.build) {
      localStorage.setItem('applied_build', res.build);
      localStorage.removeItem('exchangedesk_cached_auctions');
      console.log('[AutoUpdate] Applying latest build silently:', res.build);
      window.location.reload(true);
      return;
    }

    cachedUpdateInfo = res;

    // Check if newer version is available
    if (res.versionCode > CURRENT_APP_VERSION_CODE) {
      if (el.btnHeaderUpdatePill) {
        el.btnHeaderUpdatePill.classList.remove('hidden');
      }
      showAppUpdateModal(res);
    } else {
      if (el.btnHeaderUpdatePill) {
        el.btnHeaderUpdatePill.classList.add('hidden');
      }
      if (isManual) {
        showToast(`✅ Aapka app latest version (v${CURRENT_APP_VERSION}) par chal raha hai! Logo & Live Sync active hain.`, 'success', 5000);
        sound.playWinTone();
        // Force refresh current auctions & images in background
        loadInitialData();
      }
    }
  } catch (err) {
    console.error('Update check error:', err);
    if (isManual) {
      showToast('Update check failed: ' + err.message, 'error');
    }
  }
}

function showAppUpdateModal(updateInfo) {
  if (!el.modalAppUpdate) return;

  if (el.updateModalVersionBadge) {
    el.updateModalVersionBadge.textContent = `v${updateInfo.version || '2.2.0'} Available`;
  }
  if (el.updateModalTitle && updateInfo.title) {
    el.updateModalTitle.textContent = updateInfo.title;
  }
  if (el.updateModalNotesList && Array.isArray(updateInfo.notes)) {
    el.updateModalNotesList.innerHTML = updateInfo.notes.map((n) => `
      <li class="flex items-start gap-1.5">
        <span class="text-emerald-400 font-bold shrink-0">✓</span>
        <span>${n}</span>
      </li>
    `).join('');
  }

  // Reset progress and changelog view
  if (el.updateDownloadProgressArea) el.updateDownloadProgressArea.classList.add('hidden');
  if (el.updateInstallInstructions) el.updateInstallInstructions.classList.add('hidden');
  if (el.updateChangelogBox) el.updateChangelogBox.classList.remove('hidden');

  if (el.btnDismissAppUpdate) {
    el.btnDismissAppUpdate.style.display = updateInfo.isMandatory ? 'none' : 'block';
    el.btnDismissAppUpdate.onclick = () => {
      el.modalAppUpdate.classList.add('hidden');
    };
  }

  if (el.btnTriggerAppUpdate) {
    el.btnTriggerAppUpdate.disabled = false;
    if (el.btnTriggerAppUpdateText) {
      el.btnTriggerAppUpdateText.textContent = '1-Click Update Now';
    }

    el.btnTriggerAppUpdate.onclick = () => {
      sound.playWinTone();
      triggerHaptic();

      // Show download progress
      if (el.updateDownloadProgressArea) el.updateDownloadProgressArea.classList.remove('hidden');
      if (el.updateChangelogBox) el.updateChangelogBox.classList.add('hidden');

      el.btnTriggerAppUpdate.disabled = true;
      if (el.btnTriggerAppUpdateText) {
        el.btnTriggerAppUpdateText.textContent = 'Downloading APK... ⏳';
      }

      const apkUrl = updateInfo.apkUrl || 'https://exchangedesk-five.vercel.app/ExchangeDesk.apk';

      // 1. Trigger background download
      const a = document.createElement('a');
      a.href = apkUrl;
      a.download = 'ExchangeDesk.apk';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // 2. Animated progress bar
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += Math.floor(Math.random() * 18) + 12;
        if (progress >= 100) {
          progress = 100;
          clearInterval(progressInterval);

          if (el.updateProgressBarFill) el.updateProgressBarFill.style.width = '100%';
          if (el.updateProgressPercent) el.updateProgressPercent.textContent = '100%';
          if (el.updateProgressStatusText) {
            el.updateProgressStatusText.innerHTML = `
              <span class="text-emerald-400 font-bold">✓</span>
              <span>Download Complete! (Ready to Install)</span>
            `;
          }
          if (el.updateInstallInstructions) {
            el.updateInstallInstructions.classList.remove('hidden');
          }

          // Enable Install Button
          el.btnTriggerAppUpdate.disabled = false;
          if (el.btnTriggerAppUpdateText) {
            el.btnTriggerAppUpdateText.textContent = '👉 TAP TO INSTALL APK NOW';
          }

          sound.playWinTone();
          showToast('APK Download ho gaya! Ab "TAP TO INSTALL APK NOW" dabayein.', 'success', 8000);

          el.btnTriggerAppUpdate.onclick = () => {
            triggerHaptic();
            window.location.href = apkUrl;

            // Prepare button for restart
            setTimeout(() => {
              if (el.btnTriggerAppUpdateText) {
                el.btnTriggerAppUpdateText.textContent = '🔄 Reopen / Refresh App';
              }
              el.btnTriggerAppUpdate.onclick = () => {
                window.location.reload(true);
              };
            }, 3000);
          };
        } else {
          if (el.updateProgressBarFill) el.updateProgressBarFill.style.width = `${progress}%`;
          if (el.updateProgressPercent) el.updateProgressPercent.textContent = `${progress}%`;
        }
      }, 300);
    };
  }

  el.modalAppUpdate.classList.remove('hidden');
}

function restoreSessionImmediately() {
  const saved = localStorage.getItem('exchangedesk_session');
  if (!saved) {
    showGatekeeper();
    return false;
  }

  try {
    const session = JSON.parse(saved);
    if (!session || !session.role || !session.id) {
      showGatekeeper();
      return false;
    }
    state.currentUser = session;
    applyUserSession(session);
    return true;
  } catch (err) {
    console.error('Session restore error:', err);
    showGatekeeper();
    return false;
  }
}

async function verifySessionInBackground() {
  if (!state.currentUser) return;
  try {
    const check = await api.authMe(state.currentUser.role, state.currentUser.id);
    if (check.success && check.user) {
      state.currentUser = { ...state.currentUser, ...check.user };
      localStorage.setItem('exchangedesk_session', JSON.stringify(state.currentUser));
      applyUserSession(state.currentUser);
    } else if (check.is_active === false) {
      showToast('Your account has been deactivated by Exchange Desk', 'error');
      logout();
    }
  } catch (err) {
    // Network is offline or connecting: DO NOT LOG OUT! User stays logged in!
    console.log('Background session verification deferred (offline/reconnecting):', err.message);
  }
}

function showGatekeeper() {
  state.currentUser = null;
  el.authGateScreen?.classList.remove('hidden');
  el.headerUserInfo?.classList.add('hidden');
  el.btnHeaderLogout?.classList.add('hidden');
}

function applyUserSession(user) {
  state.currentUser = user;
  el.authGateScreen?.classList.add('hidden');
  el.headerUserInfo?.classList.remove('hidden');
  el.btnHeaderLogout?.classList.remove('hidden');

  if (user.role === 'buyer') {
    state.currentBuyerId = user.id;
    state.activeRole = 'buyer';
    if (el.headerUserIcon) el.headerUserIcon.textContent = '🏍️';
    if (el.headerUserName) el.headerUserName.textContent = `${user.name}`;
    el.navBtnBuyer?.classList.remove('hidden');
    el.navBtnWallet?.classList.remove('hidden');
    el.navBtnSellerDeals?.classList.add('hidden');
    el.navBtnSellerPost?.classList.add('hidden');
    const bAcc = document.getElementById('buyerAccountName');
    if (bAcc) bAcc.textContent = `${user.name} (#${user.id})`;
    if (el.selectBuyer) {
      el.selectBuyer.value = user.id;
      el.selectBuyer.disabled = true;
    }
    switchRole('buyer');
    updateBuyerWalletDisplay();
    loadBuyerDepositRequests();
  } else if (user.role === 'showroom') {
    state.currentShowroomId = user.id;
    state.activeRole = 'seller';
    if (el.headerUserIcon) el.headerUserIcon.textContent = '🏷️';
    if (el.headerUserName) el.headerUserName.textContent = `${user.name}`;
    el.navBtnSellerDeals?.classList.remove('hidden');
    el.navBtnSellerPost?.classList.remove('hidden');
    el.navBtnBuyer?.classList.add('hidden');
    el.navBtnWallet?.classList.add('hidden');
    const sAcc = document.getElementById('showroomAccountName');
    if (sAcc) sAcc.textContent = `${user.name} (#${user.id})`;
    if (el.selectShowroom) {
      el.selectShowroom.value = user.id;
      el.selectShowroom.disabled = true;
    }
    switchRole('seller');
  }
}

function logout() {
  triggerHaptic();
  localStorage.removeItem('exchangedesk_session');
  state.currentUser = null;
  state.currentBuyerId = null;
  state.currentShowroomId = null;
  showToast('Logged out of ExchangeDesk session', 'info');
  showGatekeeper();
}

function populateGateQuickSelect() {
  // Demo autofill removed for production
}

// ============================================================================
// SOCKET CONNECTION & REAL-TIME EVENT STREAM
// ============================================================================
function setupSocket() {
  const socket = io(API_BASE || undefined, {
    transports: ['websocket', 'polling'],
  });
  state.socket = socket;

  socket.on('connect', () => {
    if (el.socketDot) el.socketDot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping';
    if (el.socketStatusText) el.socketStatusText.textContent = '10-Min Live Flash Engine';

    socket.emit('sync_server_time', Date.now(), (data) => {
      if (data && data.serverTime) {
        state.serverTimeSkew = data.serverTime - Date.now();
      }
    });

    if (typeof socket.join === 'function') {
      socket.join('auctions_feed');
    }
  });

  socket.on('disconnect', () => {
    if (el.socketDot) el.socketDot.className = 'w-1.5 h-1.5 rounded-full bg-red-500';
    if (el.socketStatusText) el.socketStatusText.textContent = 'Offline Reconnecting';
  });

  socket.on('feed_new_auction', (newAuction) => {
    showToast(`New 10-Min Flash: ${newAuction.vehicle_model}`, 'info');
    sound.playBidTone();
    refreshCurrentAuctions();
  });

  socket.on('bid_updated', (payload) => {
    handleBidUpdate(payload);
  });

  socket.on('feed_bid_tick', (payload) => {
    handleFeedBidTick(payload);
  });

  socket.on('auction_closed', (payload) => {
    handleAuctionClosed(payload);
  });

  socket.on('feed_auction_closed', (payload) => {
    handleAuctionClosed(payload);
  });

  socket.on('auction_completed', (payload) => {
    handleAuctionCompleted(payload);
  });

  socket.on('buyer_wallet_updated', (payload) => {
    const buyer = state.buyers.find((b) => b.id === payload.buyerId);
    if (buyer) {
      buyer.wallet_balance = payload.newBalance;
      if (state.currentBuyerId === payload.buyerId) {
        updateBuyerWalletDisplay();
      }
    }
  });

  socket.on('deposit_request_approved', (payload) => {
    if (state.currentBuyerId && payload.buyerId === state.currentBuyerId) {
      sound.playWinTone();
      showToast(`🎉 Deposit Request Approved! ₹${parseFloat(payload.amount).toLocaleString('en-IN')} credited to your wallet balance.`, 'success', 8000);
      const buyer = state.buyers.find((b) => b.id === state.currentBuyerId);
      if (buyer) buyer.wallet_balance = payload.newBalance;
      updateBuyerWalletDisplay();
      loadBuyerDepositRequests();
    }
  });

  socket.on('deposit_request_rejected', (payload) => {
    if (state.currentBuyerId && payload.buyerId === state.currentBuyerId) {
      sound.playErrorBuzz();
      showToast(`Deposit Request Rejected: ${payload.notes || 'Verification failed'}`, 'error', 8000);
      loadBuyerDepositRequests();
    }
  });

  socket.on('buyer_status_changed', (payload) => {
    if (state.currentUser && state.currentUser.role === 'buyer' && state.currentUser.id === payload.buyerId) {
      if (!payload.isActive) {
        showToast('Your trading account has been SUSPENDED by Exchange Desk', 'error');
        sound.playErrorBuzz();
        logout();
      }
    }
  });

  socket.on('showroom_status_changed', (payload) => {
    if (state.currentUser && state.currentUser.role === 'showroom' && state.currentUser.id === payload.showroomId) {
      if (!payload.isActive) {
        showToast('This seller account has been DEACTIVATED by Exchange Desk', 'error');
        sound.playErrorBuzz();
        logout();
      }
    }
  });

  socket.on('platform_config_updated', (newCfg) => {
    showToast('Platform business rules updated by Exchange Desk', 'info');
  });
}

// ============================================================================
// DATA LOADING
// ============================================================================
async function loadInitialData() {
  try {
    const viewParam = state.activeRole === 'seller' ? 'showroom' : 'buyer';
    const showroomIdParam = state.activeRole === 'seller' ? state.currentShowroomId : null;

    // Fast Parallel Fetch: Load Showrooms, Buyers, and Auctions simultaneously (Zero Waterfall Latency)
    const [showroomsData, buyersData, auctionsData] = await Promise.all([
      api.getShowrooms(),
      api.getBuyers(),
      api.getActiveAuctions(viewParam, showroomIdParam),
    ]);

    // 1. Showrooms
    if (showroomsData.success && showroomsData.showrooms.length > 0) {
      state.showrooms = showroomsData.showrooms;
      if (el.selectShowroom) {
        el.selectShowroom.innerHTML = state.showrooms
          .map((s) => `<option value="${s.id}">${s.name}</option>`)
          .join('');
      }
      if (state.currentUser && state.currentUser.role === 'showroom') {
        state.currentShowroomId = state.currentUser.id;
        if (el.selectShowroom) el.selectShowroom.value = state.currentUser.id;
      } else if (!state.currentShowroomId) {
        state.currentShowroomId = state.showrooms[0].id;
      }
    }

    // 2. Buyers
    if (buyersData.success && buyersData.buyers.length > 0) {
      state.buyers = buyersData.buyers;
      if (el.selectBuyer) {
        el.selectBuyer.innerHTML = state.buyers
          .map((b) => `<option value="${b.id}">${b.business_name} (₹${b.wallet_balance.toLocaleString('en-IN')})</option>`)
          .join('');
      }
      if (state.currentUser && state.currentUser.role === 'buyer') {
        state.currentBuyerId = state.currentUser.id;
        if (el.selectBuyer) el.selectBuyer.value = state.currentUser.id;
      } else if (!state.currentBuyerId) {
        state.currentBuyerId = state.buyers[0].id;
      }
      updateBuyerWalletDisplay();
    }

    // 3. Auctions
    if (auctionsData.success) {
      state.auctions = auctionsData.auctions;
      localStorage.setItem('exchangedesk_cached_auctions', JSON.stringify(state.auctions));
      if (auctionsData.serverTime) {
        state.serverTimeSkew = auctionsData.serverTime - Date.now();
      }
      renderAuctions();
    }
  } catch (err) {
    console.error('Error loading initial data:', err);
    showToast('Error loading platform records', 'error');
  }
}

let isRefreshingAuctions = false;
async function refreshCurrentAuctions(forceFullRender = false) {
  if (isRefreshingAuctions && !forceFullRender) return;
  isRefreshingAuctions = true;
  try {
    const viewParam = state.activeRole === 'seller' ? 'showroom' : 'buyer';
    const showroomIdParam = state.activeRole === 'seller' ? state.currentShowroomId : null;

    const data = await api.getActiveAuctions(viewParam, showroomIdParam);
    if (data.success) {
      const prevListIds = state.auctions.map((a) => `${a.id}_${a.status}`).join(',');
      const newListIds = data.auctions.map((a) => `${a.id}_${a.status}`).join(',');
      const prevKeys = state.auctions.map((a) => `${a.id}_${a.current_highest_bid}_${a.highest_bidder_id}`).join(',');
      const newKeys = data.auctions.map((a) => `${a.id}_${a.current_highest_bid}_${a.highest_bidder_id}`).join(',');

      state.auctions = data.auctions;
      localStorage.setItem('exchangedesk_cached_auctions', JSON.stringify(state.auctions));
      if (data.serverTime) {
        state.serverTimeSkew = data.serverTime - Date.now();
      }

      if (forceFullRender || prevListIds !== newListIds || (state.activeRole === 'seller' && el.showroomAuctionsContainer && el.showroomAuctionsContainer.children.length <= 1)) {
        renderAuctions();
      } else if (prevKeys !== newKeys) {
        // Fast non-destructive update of prices & badges (Zero DOM lag, preserves inputs & scroll)
        fastUpdateAuctionsDom();
      }
    }
  } catch (err) {
    console.error('Error fetching active auctions:', err);
  } finally {
    isRefreshingAuctions = false;
  }
}

function fastUpdateAuctionsDom() {
  state.auctions.forEach((auction) => {
    const priceEl = document.getElementById(`price-${auction.id}`);
    if (priceEl && !priceEl.classList.contains('pulse-gold')) {
      const formatted = `₹${parseFloat(auction.current_highest_bid).toLocaleString('en-IN')}`;
      if (priceEl.textContent !== formatted) {
        priceEl.textContent = formatted;
        priceEl.classList.add('animate-bid-flash');
        setTimeout(() => priceEl?.classList.remove('animate-bid-flash'), 800);
      }
    }
    const leadEl = document.getElementById(`lead-badge-${auction.id}`);
    if (leadEl) {
      const isWinning = auction.highest_bidder_id === state.currentBuyerId;
      if (isWinning) {
        leadEl.innerHTML = `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">👑 AAP LEADING PE HAIN</span>`;
      } else if (auction.highest_bidder_name) {
        leadEl.innerHTML = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">Lead: ${auction.highest_bidder_name}</span>`;
      } else {
        leadEl.innerHTML = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">Reserve Opening</span>`;
      }
    }
    const showroomLeadEl = document.getElementById(`showroom-lead-${auction.id}`);
    if (showroomLeadEl) {
      const overReserve = parseFloat(auction.current_highest_bid) - parseFloat(auction.base_price);
      if (auction.highest_bidder_name) {
        showroomLeadEl.innerHTML = `
          <div class="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-black flex items-center gap-1 justify-end">
            <span>👑 Lead:</span> <span class="text-white">${auction.highest_bidder_name}</span>
          </div>
          <div class="text-[10px] text-emerald-400 font-bold mt-1">
            +₹${overReserve.toLocaleString('en-IN')} over reserve
          </div>
        `;
      }
    }
  });
}

// ============================================================================
// EVENT LISTENERS & NAVIGATION
// ============================================================================
function setupEventListeners() {
  // Role Navigation: Mobile Bottom Navigation
  el.navBtnBuyer?.addEventListener('click', () => {
    switchRole('buyer');
    el.viewBuyer?.scrollTo({ top: 0, behavior: 'smooth' });
    triggerHaptic();
  });
  el.navBtnWallet?.addEventListener('click', () => {
    switchRole('buyer');
    triggerHaptic();
    el.modalDepositFunds?.classList.remove('hidden');
  });
  el.navBtnSellerDeals?.addEventListener('click', () => {
    switchRole('seller');
    switchShowroomTab('deals');
    el.viewShowroom?.scrollTo({ top: 0, behavior: 'smooth' });
    triggerHaptic();
  });
  el.navBtnSellerPost?.addEventListener('click', () => {
    switchRole('seller');
    switchShowroomTab('create');
    triggerHaptic();
  });

  // Showroom Segmented Tabs
  document.getElementById('btnShowroomTabDeals')?.addEventListener('click', () => switchShowroomTab('deals'));
  document.getElementById('btnShowroomTabCreate')?.addEventListener('click', () => switchShowroomTab('create'));

  // Audio Toggle
  el.btnAudioToggle?.addEventListener('click', () => {
    const isMuted = sound.toggleMute();
    el.iconAudioOn?.classList.toggle('hidden', isMuted);
    el.iconAudioOff?.classList.toggle('hidden', !isMuted);
    showToast(isMuted ? 'Audio muted' : 'Audio chimes active', 'info');
  });

  // In-App Update Listeners
  el.btnHeaderUpdatePill?.addEventListener('click', () => {
    triggerHaptic();
    if (cachedUpdateInfo) {
      showAppUpdateModal(cachedUpdateInfo);
    } else {
      checkForAppUpdates(true);
    }
  });

  el.btnCheckUpdateLogin?.addEventListener('click', () => {
    triggerHaptic();
    checkForAppUpdates(true);
  });

  // Buyer Change
  el.selectBuyer?.addEventListener('change', (e) => {
    state.currentBuyerId = parseInt(e.target.value, 10);
    updateBuyerWalletDisplay();
    renderAuctions();
  });

  // Buyer Registration Modal Open/Close & Submit
  el.btnOpenRegisterBuyer?.addEventListener('click', () => {
    el.modalAddBuyer?.classList.remove('hidden');
  });
  el.btnCloseBuyerModal?.addEventListener('click', () => {
    el.modalAddBuyer?.classList.add('hidden');
  });
  el.formAddBuyer?.addEventListener('submit', async (e) => {
    e.preventDefault();
    triggerHaptic();
    await handleAddBuyer();
  });

  // Wallet Deposit Modal Open/Close & Submit
  el.btnTopupWallet?.addEventListener('click', () => {
    triggerHaptic();
    el.modalDepositFunds?.classList.remove('hidden');
  });
  el.btnCloseDepositModal?.addEventListener('click', () => {
    el.modalDepositFunds?.classList.add('hidden');
  });
  document.querySelectorAll('.btn-preset-deposit').forEach((btn) => {
    btn?.addEventListener('click', () => {
      triggerHaptic();
      if (el.inputCustomDeposit) el.inputCustomDeposit.value = btn.dataset.amount;
    });
  });
  el.btnSubmitDeposit?.addEventListener('click', async () => {
    triggerHaptic();
    if (!state.currentBuyerId) {
      showToast('No buyer trading account selected', 'error');
      return;
    }
    const amount = parseFloat(el.inputCustomDeposit?.value);
    if (isNaN(amount) || amount <= 0) {
      showToast('Enter a valid deposit amount', 'error');
      return;
    }
    const method = document.getElementById('selectDepositMethod')?.value || 'UPI';
    const refId = document.getElementById('inputDepositRef')?.value?.trim() || '';

    if (method !== 'CASH' && !refId) {
      showToast('Please enter Payment UTR / Transaction Ref ID', 'error');
      return;
    }

    try {
      el.btnSubmitDeposit.disabled = true;
      el.btnSubmitDeposit.textContent = 'Submitting Request...';
      const res = await api.requestBuyerDeposit(state.currentBuyerId, amount, method, refId);
      if (res.success) {
        el.modalDepositFunds?.classList.add('hidden');
        showToast(res.message || 'Deposit request submitted for Exchange Desk approval!', 'success', 8000);
        sound.playWinTone();
        if (document.getElementById('inputDepositRef')) {
          document.getElementById('inputDepositRef').value = '';
        }
        loadBuyerDepositRequests();
      } else {
        showToast(res.error || 'Failed to submit deposit request', 'error');
        sound.playErrorBuzz();
      }
    } catch (err) {
      showToast('Wallet deposit request failed: ' + err.message, 'error');
    } finally {
      el.btnSubmitDeposit.disabled = false;
      el.btnSubmitDeposit.textContent = 'Submit Deposit Request for Exchange Desk Approval';
    }
  });

  // Showroom Change
  el.selectShowroom?.addEventListener('change', (e) => {
    state.currentShowroomId = parseInt(e.target.value, 10);
    refreshCurrentAuctions();
  });

  el.btnRefreshShowroom?.addEventListener('click', () => {
    triggerHaptic();
    refreshCurrentAuctions();
    showToast('Showroom deal deck refreshed', 'info');
  });

  // Showroom Registration Modal Triggers
  el.btnOpenRegisterShowroom?.addEventListener('click', () => {
    el.modalAddShowroom?.classList.remove('hidden');
  });

  // Create Auction Form
  el.createAuctionForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    triggerHaptic();
    openPostPreviewModal();
  });

  // Pre-Launch Preview Modal Handlers
  el.btnClosePostPreview?.addEventListener('click', () => {
    triggerHaptic();
    el.modalPostPreview?.classList.add('hidden');
  });
  el.btnPreviewEdit?.addEventListener('click', () => {
    triggerHaptic();
    el.modalPostPreview?.classList.add('hidden');
  });
  el.btnPreviewConfirm?.addEventListener('click', async () => {
    triggerHaptic();
    await handleCreateAuctionConfirmed();
  });

  // Photo Zoom Lightbox Controls
  el.btnClosePhotoZoom?.addEventListener('click', closePhotoZoom);
  el.btnZoomIn?.addEventListener('click', zoomIn);
  el.btnZoomOut?.addEventListener('click', zoomOut);
  el.btnZoomReset?.addEventListener('click', resetZoomTransform);
  el.btnZoomPrev?.addEventListener('click', zoomPrevPhoto);
  el.btnZoomNext?.addEventListener('click', zoomNextPhoto);
  setupZoomTouchHandlers();

  // Post Bike Media Upload Triggers
  el.btnTriggerAddPhotos?.addEventListener('click', () => el.formBikePhotos?.click());
  el.formBikePhotos?.addEventListener('change', handlePhotosSelected);
  el.btnTriggerAddVideo?.addEventListener('click', () => el.formEngineMedia?.click());
  el.formEngineMedia?.addEventListener('change', handleEngineMediaSelected);
  el.btnRemoveMedia?.addEventListener('click', removeEngineMedia);

  // Media Modal Close
  el.btnCloseMediaModal?.addEventListener('click', closeMediaViewer);
  el.btnMediaModalCloseBottom?.addEventListener('click', closeMediaViewer);

  // Handover Modal
  el.btnCloseModal?.addEventListener('click', closeHandoverModal);
  el.formVerifyOtp?.addEventListener('submit', async (e) => {
    e.preventDefault();
    triggerHaptic();
    await handleVerifyHandover();
  });

  // Audit Modal
  el.btnCloseBidsModal?.addEventListener('click', () => {
    el.modalBids?.classList.add('hidden');
  });

  // Header Logout
  el.btnHeaderLogout?.addEventListener('click', logout);

  // Gatekeeper Tab Switching
  el.gateTabBuyer?.addEventListener('click', () => switchGateTab('buyer'));
  el.gateTabShowroom?.addEventListener('click', () => switchGateTab('showroom'));

  // Gatekeeper Mode Toggles (Login vs Register)
  el.btnBuyerModeLogin?.addEventListener('click', () => switchBuyerGateMode('login'));
  el.btnBuyerModeRegister?.addEventListener('click', () => switchBuyerGateMode('register'));
  el.btnShowroomModeLogin?.addEventListener('click', () => switchShowroomGateMode('login'));
  el.btnShowroomModeRegister?.addEventListener('click', () => switchShowroomGateMode('register'));

  // Gatekeeper Form Submissions
  el.formBuyerLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    triggerHaptic();
    await handleBuyerLogin();
  });

  el.formBuyerRegister?.addEventListener('submit', async (e) => {
    e.preventDefault();
    triggerHaptic();
    await handleBuyerRegister();
  });

  el.formShowroomLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    triggerHaptic();
    await handleShowroomLogin();
  });

  el.formShowroomRegister?.addEventListener('submit', async (e) => {
    e.preventDefault();
    triggerHaptic();
    await handleShowroomRegister();
  });

  // Bid Confirmation Modal Handlers (Prevents Accidental Bids)
  el.btnCloseBidConfirmation?.addEventListener('click', closeBidConfirmationModal);
  el.btnCancelBidConfirmation?.addEventListener('click', closeBidConfirmationModal);
  el.modalBidConfirmation?.addEventListener('click', (e) => {
    if (e.target === el.modalBidConfirmation) closeBidConfirmationModal();
  });
  el.btnConfirmPlaceBid?.addEventListener('click', handleConfirmBidPlacement);
}

// ============================================================================
// GATEKEEPER UI FUNCTIONS & HANDLERS
// ============================================================================
function switchGateTab(tab) {
  triggerHaptic();
  const activeBuyer = 'py-2.5 rounded-xl font-black transition bg-emerald-500 text-slate-950 shadow-md flex items-center justify-center gap-1.5 mobile-tap';
  const activeShowroom = 'py-2.5 rounded-xl font-black transition bg-blue-600 text-white shadow-md flex items-center justify-center gap-1.5 mobile-tap';
  const inactiveClass = 'py-2.5 rounded-xl font-black transition text-slate-400 hover:text-white flex items-center justify-center gap-1.5 mobile-tap';

  if (el.gateTabBuyer) el.gateTabBuyer.className = tab === 'buyer' ? activeBuyer : inactiveClass;
  if (el.gateTabShowroom) el.gateTabShowroom.className = tab === 'showroom' ? activeShowroom : inactiveClass;

  if (el.gateBuyerSection) el.gateBuyerSection.classList.toggle('hidden', tab !== 'buyer');
  if (el.gateShowroomSection) el.gateShowroomSection.classList.toggle('hidden', tab !== 'showroom');
}

function switchBuyerGateMode(mode) {
  triggerHaptic();
  if (mode === 'login') {
    if (el.btnBuyerModeLogin) el.btnBuyerModeLogin.className = 'flex-1 py-1.5 rounded-lg font-bold text-emerald-400 bg-slate-900 shadow';
    if (el.btnBuyerModeRegister) el.btnBuyerModeRegister.className = 'flex-1 py-1.5 rounded-lg font-bold text-slate-400 hover:text-white';
    el.formBuyerLogin?.classList.remove('hidden');
    el.formBuyerRegister?.classList.add('hidden');
  } else {
    if (el.btnBuyerModeLogin) el.btnBuyerModeLogin.className = 'flex-1 py-1.5 rounded-lg font-bold text-slate-400 hover:text-white';
    if (el.btnBuyerModeRegister) el.btnBuyerModeRegister.className = 'flex-1 py-1.5 rounded-lg font-bold text-emerald-400 bg-slate-900 shadow';
    el.formBuyerLogin?.classList.add('hidden');
    el.formBuyerRegister?.classList.remove('hidden');
  }
}

function switchShowroomGateMode(mode) {
  triggerHaptic();
  if (mode === 'login') {
    if (el.btnShowroomModeLogin) el.btnShowroomModeLogin.className = 'flex-1 py-1.5 rounded-lg font-bold text-blue-400 bg-slate-900 shadow';
    if (el.btnShowroomModeRegister) el.btnShowroomModeRegister.className = 'flex-1 py-1.5 rounded-lg font-bold text-slate-400 hover:text-white';
    el.formShowroomLogin?.classList.remove('hidden');
    el.formShowroomRegister?.classList.add('hidden');
  } else {
    if (el.btnShowroomModeLogin) el.btnShowroomModeLogin.className = 'flex-1 py-1.5 rounded-lg font-bold text-slate-400 hover:text-white';
    if (el.btnShowroomModeRegister) el.btnShowroomModeRegister.className = 'flex-1 py-1.5 rounded-lg font-bold text-blue-400 bg-slate-900 shadow';
    el.formShowroomLogin?.classList.add('hidden');
    el.formShowroomRegister?.classList.remove('hidden');
  }
}

async function handleBuyerLogin() {
  const phone = el.inputBuyerLoginPhone.value.trim();
  const pin = el.inputBuyerLoginPin.value.trim();
  if (!phone) return showToast('Enter registered mobile number', 'error');

  const btn = el.formBuyerLogin?.querySelector('button[type="submit"]');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="flex items-center justify-center gap-2"><span class="w-3.5 h-3.5 rounded-full border-2 border-slate-950 border-t-transparent animate-spin"></span> Verifying ID...</span>`;
  }

  try {
    const res = await api.authLogin({ role: 'buyer', phone, pin });
    if (res.success && res.user) {
      localStorage.setItem('exchangedesk_session', JSON.stringify(res.user));
      state.currentBuyerId = res.user.id;
      state.activeRole = 'buyer';
      applyUserSession(res.user);
      renderAuctions();
      refreshCurrentAuctions(true);
      showToast(`Welcome back, ${res.user.name}!`, 'success');
      sound.playWinTone();
    } else {
      if (res.pendingApproval) {
        showToast('Aapka registration verification pending hai! Approval hone ke baad hi ID activate hogi.', 'warning', 8000);
      } else {
        showToast(res.error || 'Login failed', 'error');
      }
      sound.playErrorBuzz();
    }
  } catch (err) {
    showToast('Login error: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

async function handleBuyerRegister() {
  const business_name = el.inputBuyerRegName.value.trim();
  const phone = el.inputBuyerRegPhone.value.trim();
  const pin = el.inputBuyerRegPin.value.trim();
  const initial_deposit = parseFloat(el.inputBuyerRegDeposit.value);

  if (!business_name || !phone) return showToast('Fill all registration details', 'error');

  try {
    const res = await api.authRegister({ role: 'buyer', business_name, phone, pin, initial_deposit });
    if (res.success) {
      if (res.pendingApproval) {
        showToast('Registration submitted! Desk verification & approval pending. Activation hone par aap login kar sakte hain.', 'warning', 8000);
        sound.playWinTone();
        switchBuyerGateMode('login');
        if (el.inputBuyerLoginPhone) el.inputBuyerLoginPhone.value = phone;
        if (el.inputBuyerLoginPin) el.inputBuyerLoginPin.value = pin;
        return;
      }
      localStorage.setItem('exchangedesk_session', JSON.stringify(res.user));
      await loadInitialData();
      populateGateQuickSelect();
      applyUserSession(res.user);
      showToast(res.message || 'Buyer registered successfully!', 'success');
      sound.playWinTone();
    } else {
      showToast(res.error || 'Registration failed', 'error');
      sound.playErrorBuzz();
    }
  } catch (err) {
    showToast('Registration error: ' + err.message, 'error');
  }
}

async function handleShowroomLogin() {
  const phone = el.inputShowroomLoginPhone.value.trim();
  const pin = el.inputShowroomLoginPin.value.trim();
  if (!phone) return showToast('Enter registered counter mobile number', 'error');

  const btn = el.formShowroomLogin?.querySelector('button[type="submit"]');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="flex items-center justify-center gap-2"><span class="w-3.5 h-3.5 rounded-full border-2 border-slate-950 border-t-transparent animate-spin"></span> Verifying Counter...</span>`;
  }

  try {
    const res = await api.authLogin({ role: 'showroom', phone, pin });
    if (res.success && res.user) {
      localStorage.setItem('exchangedesk_session', JSON.stringify(res.user));
      state.currentShowroomId = res.user.id;
      state.activeRole = 'seller';
      applyUserSession(res.user);
      renderAuctions();
      refreshCurrentAuctions(true);
      showToast(`Welcome back, ${res.user.name}!`, 'success');
      sound.playWinTone();
    } else {
      if (res.pendingApproval) {
        showToast('Aapka registration verification pending hai! Approval hone ke baad hi ID activate hogi.', 'warning', 8000);
      } else {
        showToast(res.error || 'Seller login failed', 'error');
      }
      sound.playErrorBuzz();
    }
  } catch (err) {
    showToast('Login error: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

async function handleShowroomRegister() {
  const name = el.inputShowroomRegName.value.trim();
  const phone = el.inputShowroomRegPhone.value.trim();
  const address = el.inputShowroomRegAddress.value.trim();
  const pin = el.inputShowroomRegPin.value.trim();

  if (!name || !phone || !address) return showToast('Fill all seller counter details', 'error');

  try {
    const res = await api.authRegister({ role: 'showroom', name, phone, address, pin });
    if (res.success) {
      if (res.pendingApproval) {
        showToast('Seller registration submitted! Verification & approval pending. Activation hone ke baad hi login hoga.', 'warning', 8000);
        sound.playWinTone();
        switchShowroomGateMode('login');
        if (el.inputShowroomLoginPhone) el.inputShowroomLoginPhone.value = phone;
        if (el.inputShowroomLoginPin) el.inputShowroomLoginPin.value = pin;
        return;
      }
      localStorage.setItem('exchangedesk_session', JSON.stringify(res.user));
      await loadInitialData();
      populateGateQuickSelect();
      applyUserSession(res.user);
      showToast(res.message || 'Seller registered successfully!', 'success');
      sound.playWinTone();
    } else {
      showToast(res.error || 'Registration failed', 'error');
      sound.playErrorBuzz();
    }
  } catch (err) {
    showToast('Registration error: ' + err.message, 'error');
  }
}

// Mobile shell is native full-screen in production
function toggleMobileFrame() {}

// ============================================================================
// STRICT ROLE DISPLAY (BUYER vs SHOWROOM)
// ============================================================================
function switchRole(role) {
  triggerHaptic();
  state.activeRole = role;

  if (role === 'buyer') {
    el.viewBuyer?.classList.remove('hidden');
    el.viewShowroom?.classList.add('hidden');
    if (el.activeRoleBadge) {
      el.activeRoleBadge.textContent = 'BUYER APP';
      el.activeRoleBadge.className = 'px-2 py-0.5 text-[9px] font-black uppercase rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
    }
    el.navBtnBuyer?.classList.remove('hidden');
    el.navBtnWallet?.classList.remove('hidden');
    el.navBtnSellerDeals?.classList.add('hidden');
    el.navBtnSellerPost?.classList.add('hidden');
    updateBuyerWalletDisplay();
    loadBuyerDepositRequests();
    renderAuctions();
    refreshCurrentAuctions(true);
  } else if (role === 'seller') {
    el.viewBuyer?.classList.add('hidden');
    el.viewShowroom?.classList.remove('hidden');
    if (el.activeRoleBadge) {
      el.activeRoleBadge.textContent = 'SELLER APP';
      el.activeRoleBadge.className = 'px-2 py-0.5 text-[9px] font-black uppercase rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30';
    }
    el.navBtnBuyer?.classList.add('hidden');
    el.navBtnWallet?.classList.add('hidden');
    el.navBtnSellerDeals?.classList.remove('hidden');
    el.navBtnSellerPost?.classList.remove('hidden');
    renderAuctions();
    refreshCurrentAuctions(true);
  }
}

function switchShowroomTab(tab) {
  triggerHaptic();
  const btnDeals = document.getElementById('btnShowroomTabDeals');
  const btnCreate = document.getElementById('btnShowroomTabCreate');
  const secDeals = document.getElementById('showroomDealsSection');
  const secCreate = document.getElementById('showroomCreateSection');

  if (tab === 'deals') {
    if (btnDeals) btnDeals.className = 'py-2.5 rounded-xl font-black transition bg-blue-600 text-white shadow-md flex items-center justify-center gap-1.5 mobile-tap';
    if (btnCreate) btnCreate.className = 'py-2.5 rounded-xl font-black transition text-slate-400 hover:text-white flex items-center justify-center gap-1.5 mobile-tap';
    secDeals?.classList.remove('hidden');
    secCreate?.classList.add('hidden');
  } else {
    if (btnDeals) btnDeals.className = 'py-2.5 rounded-xl font-black transition text-slate-400 hover:text-white flex items-center justify-center gap-1.5 mobile-tap';
    if (btnCreate) btnCreate.className = 'py-2.5 rounded-xl font-black transition bg-emerald-600 text-white shadow-md flex items-center justify-center gap-1.5 mobile-tap';
    secDeals?.classList.add('hidden');
    secCreate?.classList.remove('hidden');
  }
}

function updateBuyerWalletDisplay() {
  const currentBuyer = state.buyers.find((b) => b.id === state.currentBuyerId);
  if (!currentBuyer) return;

  const balance = parseFloat(currentBuyer.wallet_balance);
  if (el.buyerWalletDisplay) {
    el.buyerWalletDisplay.textContent = `₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  }

  if (balance < 3000) {
    el.walletRuleAlert?.classList.remove('hidden');
    el.buyerWalletDisplay?.classList.remove('text-emerald-400');
    el.buyerWalletDisplay?.classList.add('text-amber-400');
  } else {
    el.walletRuleAlert?.classList.add('hidden');
    el.buyerWalletDisplay?.classList.remove('text-amber-400');
    el.buyerWalletDisplay?.classList.add('text-emerald-400');
  }
}

async function loadBuyerDepositRequests() {
  if (!state.currentBuyerId) return;
  try {
    const res = await api.getBuyerDepositRequests(state.currentBuyerId);
    const card = document.getElementById('buyerPendingDepositsCard');
    const countEl = document.getElementById('buyerPendingDepositsCount');
    const listEl = document.getElementById('buyerPendingDepositsList');
    if (!card || !listEl) return;

    if (res.success && res.requests && res.requests.length > 0) {
      const pending = res.requests.filter((r) => r.status === 'PENDING');
      if (pending.length > 0) {
        card.classList.remove('hidden');
        if (countEl) countEl.textContent = pending.length;
        listEl.innerHTML = pending.map((r) => `
          <div class="p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl flex items-center justify-between">
            <div>
              <div class="font-extrabold text-white text-xs">
                ₹${parseFloat(r.amount).toLocaleString('en-IN')} 
                <span class="text-[10px] font-normal text-slate-400">via ${r.payment_method}</span>
              </div>
              <div class="text-[10px] text-slate-400">
                ${r.reference_id ? `Ref: <span class="font-mono text-emerald-400">${r.reference_id}</span> • ` : ''}
                ${new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div>
              <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                ⏳ PENDING APPROVAL
              </span>
            </div>
          </div>
        `).join('');
      } else {
        card.classList.add('hidden');
      }
    } else {
      card.classList.add('hidden');
    }
  } catch (err) {
    console.error('Error loading buyer deposit requests:', err);
  }
}

// ============================================================================
// VEHICLE MEDIA & ENGINE SOUND (PHOTOS & VIDEO/AUDIO)
// ============================================================================
async function compressImageFile(file, maxWidth = 900, maxHeight = 900, quality = 0.7) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > maxWidth || h > maxHeight) {
          if (w > h) {
            h = Math.round((h * maxWidth) / w);
            w = maxWidth;
          } else {
            w = Math.round((w * maxHeight) / h);
            h = maxHeight;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

async function handlePhotosSelected(e) {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;

  const remaining = 4 - state.pendingPhotos.length;
  if (remaining <= 0) {
    showToast('Maximum 4 photos allowed', 'warning');
    return;
  }

  const selected = files.slice(0, remaining);
  showToast(`Processing ${selected.length} photo(s)...`, 'info');

  for (const file of selected) {
    try {
      const dataUrl = await compressImageFile(file);
      state.pendingPhotos.push(dataUrl);
    } catch (err) {
      console.error('Error compressing image:', err);
    }
  }

  if (el.formBikePhotos) el.formBikePhotos.value = '';
  renderPhotoPreviews();
  showToast(`${state.pendingPhotos.length} photo(s) added`, 'success');
}

function renderPhotoPreviews() {
  if (!el.photoPreviewGrid) return;
  const count = state.pendingPhotos.length;
  if (el.photoCountBadge) {
    el.photoCountBadge.textContent = `${count} / 4 Added`;
  }

  const badges = ['Front', 'Meter/KM', 'Side', 'Engine'];

  const photosHtml = state.pendingPhotos
    .map(
      (url, idx) => `
      <div class="relative h-20 rounded-xl overflow-hidden border border-slate-700 bg-slate-900 group">
        <img src="${url}" alt="Bike photo ${idx + 1}" class="w-full h-full object-cover">
        <span class="absolute bottom-1 left-1 px-1.5 py-0.2 rounded bg-black/75 text-[8px] font-bold text-white">
          ${badges[idx] || '#' + (idx + 1)}
        </span>
        <button type="button" class="btn-remove-photo absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600/90 text-white text-[10px] font-black flex items-center justify-center hover:bg-red-500 shadow active:scale-90 transition" data-index="${idx}">
          ✕
        </button>
      </div>
    `
    )
    .join('');

  const addTriggerHtml =
    count < 4
      ? `
      <button type="button" id="btnTriggerAddPhotos" class="h-20 rounded-xl border-2 border-dashed border-slate-700 hover:border-emerald-500 bg-[#0d1326] flex flex-col items-center justify-center text-slate-400 hover:text-emerald-400 transition mobile-tap active:scale-95">
        <span class="text-xl">📷</span>
        <span class="text-[9px] font-bold mt-1">+ Photo</span>
      </button>
    `
      : '';

  el.photoPreviewGrid.innerHTML = photosHtml + addTriggerHtml;

  document.getElementById('btnTriggerAddPhotos')?.addEventListener('click', () => {
    el.formBikePhotos?.click();
  });

  document.querySelectorAll('.btn-remove-photo').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerHaptic();
      const idx = parseInt(btn.dataset.index, 10);
      state.pendingPhotos.splice(idx, 1);
      renderPhotoPreviews();
    });
  });
}

function handleEngineMediaSelected(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  // Max 2.5MB to stay safely under cloud serverless limits
  if (file.size > 2.5 * 1024 * 1024) {
    showToast('Video / Audio clip 2.5MB se chhota hona chahiye (5-10s clip). Kripya chhota clip upload karein.', 'error', 6000);
    if (el.formEngineMedia) el.formEngineMedia.value = '';
    return;
  }

  const isVideo = file.type.startsWith('video');
  const isAudio = file.type.startsWith('audio');
  if (!isVideo && !isAudio) {
    showToast('Please select a valid video or audio file', 'error');
    return;
  }

  showToast('Processing engine sound media...', 'info');
  const reader = new FileReader();
  reader.onload = (ev) => {
    state.pendingEngineMedia = ev.target.result;
    state.pendingEngineMediaType = isVideo ? 'video' : 'audio';

    if (el.mediaPreviewWrapper) el.mediaPreviewWrapper.classList.remove('hidden');
    if (el.mediaPreviewTitle) {
      el.mediaPreviewTitle.textContent = `✓ ${isVideo ? 'Engine Video' : 'Audio Sound'} Clip Attached (${(file.size / (1024 * 1024)).toFixed(1)}MB)`;
    }

    if (isVideo && el.videoPreviewEl) {
      el.videoPreviewEl.src = state.pendingEngineMedia;
      el.videoPreviewEl.classList.remove('hidden');
      el.audioPreviewEl?.classList.add('hidden');
    } else if (isAudio && el.audioPreviewEl) {
      el.audioPreviewEl.src = state.pendingEngineMedia;
      el.audioPreviewEl.classList.remove('hidden');
      el.videoPreviewEl?.classList.add('hidden');
    }

    showToast('Engine sound clip ready for launch', 'success');
  };
  reader.readAsDataURL(file);
}

function removeEngineMedia() {
  state.pendingEngineMedia = '';
  state.pendingEngineMediaType = '';
  if (el.formEngineMedia) el.formEngineMedia.value = '';
  if (el.videoPreviewEl) {
    el.videoPreviewEl.pause();
    el.videoPreviewEl.src = '';
    el.videoPreviewEl.classList.add('hidden');
  }
  if (el.audioPreviewEl) {
    el.audioPreviewEl.pause();
    el.audioPreviewEl.src = '';
    el.audioPreviewEl.classList.add('hidden');
  }
  if (el.mediaPreviewWrapper) el.mediaPreviewWrapper.classList.add('hidden');
}

async function openMediaViewer(auctionId) {
  triggerHaptic();
  const auction = state.auctions.find((a) => a.id === auctionId);
  if (!auction) return;

  // On-demand media fetch: load engine audio/video and all photos if not yet present
  if (!auction.engine_sound_video || !Array.isArray(auction.photos) || auction.photos.length <= 2) {
    try {
      const m = await api.getAuctionMedia(auctionId);
      if (m && m.success) {
        if (m.engine_sound_video) auction.engine_sound_video = m.engine_sound_video;
        if (m.photos) {
          const fetchedPhotos = typeof m.photos === 'string' ? JSON.parse(m.photos || '[]') : m.photos;
          if (Array.isArray(fetchedPhotos) && fetchedPhotos.length > 0) {
            auction.photos = fetchedPhotos;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch engine media:', e);
    }
  }

  const photos = typeof auction.photos === 'string' ? JSON.parse(auction.photos || '[]') : (auction.photos || []);
  const hasVideo = !!auction.engine_sound_video;

  if (el.mediaModalTitle) {
    el.mediaModalTitle.textContent = `${auction.vehicle_model} (${auction.manufacturing_year})`;
  }
  if (el.mediaModalSubtitle) {
    el.mediaModalSubtitle.textContent = `RC: ${auction.rc_number_masked || auction.rc_number} • ${Number(auction.km_driven).toLocaleString('en-IN')} KM Driven`;
  }

  // Video / Audio Player
  if (hasVideo && el.mediaModalVideoSection) {
    el.mediaModalVideoSection.classList.remove('hidden');
    const isVideo = auction.engine_sound_video.startsWith('data:video') || auction.engine_sound_video.endsWith('.mp4');
    if (isVideo && el.modalVideoPlayer) {
      el.modalVideoPlayer.setAttribute('playsinline', '');
      el.modalVideoPlayer.setAttribute('webkit-playsinline', '');
      el.modalVideoPlayer.controls = true;
      el.modalVideoPlayer.src = auction.engine_sound_video;
      el.modalVideoPlayer.classList.remove('hidden');
      el.modalAudioPlayer?.classList.add('hidden');
      try { el.modalVideoPlayer.load(); } catch {}
      el.modalVideoPlayer.play().catch(() => {});
    } else if (el.modalAudioPlayer) {
      el.modalAudioPlayer.src = auction.engine_sound_video;
      el.modalAudioPlayer.classList.remove('hidden');
      el.modalVideoPlayer?.classList.add('hidden');
      try { el.modalAudioPlayer.load(); } catch {}
      el.modalAudioPlayer.play().catch(() => {});
    }
  } else if (el.mediaModalVideoSection) {
    el.mediaModalVideoSection.classList.add('hidden');
    if (el.modalVideoPlayer) {
      el.modalVideoPlayer.pause();
      el.modalVideoPlayer.src = '';
    }
    if (el.modalAudioPlayer) {
      el.modalAudioPlayer.pause();
      el.modalAudioPlayer.src = '';
    }
  }

  // Photos Gallery
  if (el.mediaModalPhotoCount) {
    el.mediaModalPhotoCount.textContent = `${photos.length} Photo${photos.length !== 1 ? 's' : ''}`;
  }
  if (el.mediaModalPhotosGrid) {
    if (photos.length === 0) {
      el.mediaModalPhotosGrid.innerHTML = `
        <div class="col-span-2 p-6 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
          No additional photos uploaded for this bike listing.
        </div>
      `;
    } else {
      el.mediaModalPhotosGrid.innerHTML = photos
        .map(
          (p, idx) => `
          <div class="rounded-xl overflow-hidden border border-slate-700 bg-slate-950 group cursor-pointer btn-open-zoom-from-gallery" data-index="${idx}">
            <img src="${p}" alt="Vehicle photo ${idx + 1}" class="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-200">
            <div class="text-[9px] text-center text-emerald-400 py-1 bg-slate-900 border-t border-slate-800 font-bold">🔍 Tap to Zoom Full Screen</div>
          </div>
        `
        )
        .join('');

      el.mediaModalPhotosGrid.querySelectorAll('.btn-open-zoom-from-gallery').forEach((card) => {
        card.addEventListener('click', () => {
          const idx = parseInt(card.dataset.index, 10);
          openPhotoZoom(photos, idx);
        });
      });
    }
  }

  el.modalMediaViewer?.classList.remove('hidden');
}

function closeMediaViewer() {
  triggerHaptic();
  if (el.modalVideoPlayer) {
    el.modalVideoPlayer.pause();
    el.modalVideoPlayer.src = '';
  }
  if (el.modalAudioPlayer) {
    el.modalAudioPlayer.pause();
    el.modalAudioPlayer.src = '';
  }
  el.modalMediaViewer?.classList.add('hidden');
}

// ============================================================================
// FULL-SCREEN IMAGE LIGHTBOX & INTERACTIVE ZOOM
// ============================================================================
function openPhotoZoom(photosArray, startIndex = 0) {
  triggerHaptic();
  if (!Array.isArray(photosArray) || photosArray.length === 0) return;

  state.zoomPhotos = photosArray;
  state.zoomCurrentIndex = Math.max(0, Math.min(startIndex, photosArray.length - 1));
  state.zoomScale = 1;
  state.zoomTranslateX = 0;
  state.zoomTranslateY = 0;

  updateZoomModalView();
  el.modalPhotoZoom?.classList.remove('hidden');
}

function updateZoomModalView() {
  const currentPhoto = state.zoomPhotos[state.zoomCurrentIndex];
  if (!currentPhoto) return;

  if (el.zoomTargetImg) {
    el.zoomTargetImg.src = currentPhoto;
    applyZoomTransform();
  }

  if (el.zoomPhotoCounter) {
    el.zoomPhotoCounter.textContent = `Photo ${state.zoomCurrentIndex + 1} of ${state.zoomPhotos.length}`;
  }

  if (el.zoomLevelBadge) {
    el.zoomLevelBadge.textContent = `${Math.round(state.zoomScale * 100)}%`;
  }

  if (state.zoomPhotos.length > 1) {
    el.btnZoomPrev?.classList.remove('hidden');
    el.btnZoomNext?.classList.remove('hidden');
  } else {
    el.btnZoomPrev?.classList.add('hidden');
    el.btnZoomNext?.classList.add('hidden');
  }

  if (el.zoomThumbnailStrip) {
    if (state.zoomPhotos.length > 1) {
      el.zoomThumbnailStrip.innerHTML = state.zoomPhotos
        .map(
          (url, idx) => `
          <button type="button" class="w-12 h-12 rounded-lg overflow-hidden border-2 transition ${idx === state.zoomCurrentIndex ? 'border-emerald-500 scale-105 shadow-md shadow-emerald-500/30' : 'border-slate-700 opacity-60'} flex-shrink-0 btn-zoom-thumb mobile-tap" data-index="${idx}">
            <img src="${url}" class="w-full h-full object-cover">
          </button>
        `
        )
        .join('');

      el.zoomThumbnailStrip.querySelectorAll('.btn-zoom-thumb').forEach((btn) => {
        btn.addEventListener('click', () => {
          triggerHaptic();
          state.zoomCurrentIndex = parseInt(btn.dataset.index, 10);
          resetZoomTransform();
          updateZoomModalView();
        });
      });
    } else {
      el.zoomThumbnailStrip.innerHTML = '';
    }
  }
}

function applyZoomTransform() {
  if (el.zoomTargetImg) {
    el.zoomTargetImg.style.transform = `translate(${state.zoomTranslateX}px, ${state.zoomTranslateY}px) scale(${state.zoomScale})`;
  }
  if (el.zoomLevelBadge) {
    el.zoomLevelBadge.textContent = `${Math.round(state.zoomScale * 100)}%`;
  }
}

function resetZoomTransform() {
  state.zoomScale = 1;
  state.zoomTranslateX = 0;
  state.zoomTranslateY = 0;
  applyZoomTransform();
}

function zoomIn() {
  triggerHaptic();
  state.zoomScale = Math.min(state.zoomScale + 0.5, 4);
  applyZoomTransform();
}

function zoomOut() {
  triggerHaptic();
  state.zoomScale = Math.max(state.zoomScale - 0.5, 1);
  if (state.zoomScale === 1) {
    state.zoomTranslateX = 0;
    state.zoomTranslateY = 0;
  }
  applyZoomTransform();
}

function zoomPrevPhoto() {
  if (state.zoomCurrentIndex > 0) {
    triggerHaptic();
    state.zoomCurrentIndex--;
    resetZoomTransform();
    updateZoomModalView();
  }
}

function zoomNextPhoto() {
  if (state.zoomCurrentIndex < state.zoomPhotos.length - 1) {
    triggerHaptic();
    state.zoomCurrentIndex++;
    resetZoomTransform();
    updateZoomModalView();
  }
}

function closePhotoZoom() {
  triggerHaptic();
  resetZoomTransform();
  el.modalPhotoZoom?.classList.add('hidden');
}

function setupZoomTouchHandlers() {
  let initialDistance = 0;
  let initialScale = 1;
  let startX = 0;
  let startY = 0;
  let isDragging = false;
  let lastTapTime = 0;

  const vp = el.zoomViewport;
  if (!vp) return;

  vp.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      initialDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialScale = state.zoomScale;
    } else if (e.touches.length === 1) {
      const currentTime = Date.now();
      const tapGap = currentTime - lastTapTime;
      lastTapTime = currentTime;

      if (tapGap < 300) {
        triggerHaptic();
        state.zoomScale = state.zoomScale > 1.2 ? 1 : 2.5;
        state.zoomTranslateX = 0;
        state.zoomTranslateY = 0;
        applyZoomTransform();
        return;
      }

      if (state.zoomScale > 1) {
        isDragging = true;
        startX = e.touches[0].clientX - state.zoomTranslateX;
        startY = e.touches[0].clientY - state.zoomTranslateY;
      }
    }
  }, { passive: true });

  vp.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && initialDistance > 0) {
      const currentDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = currentDistance / initialDistance;
      state.zoomScale = Math.max(1, Math.min(initialScale * ratio, 4));
      applyZoomTransform();
    } else if (e.touches.length === 1 && isDragging && state.zoomScale > 1) {
      state.zoomTranslateX = e.touches[0].clientX - startX;
      state.zoomTranslateY = e.touches[0].clientY - startY;
      applyZoomTransform();
    }
  }, { passive: true });

  vp.addEventListener('touchend', () => {
    initialDistance = 0;
    isDragging = false;
  });
}

// ============================================================================
// AUCTION CREATION & PRE-LAUNCH PREVIEW
// ============================================================================
function openPostPreviewModal() {
  const brand = document.getElementById('formBrandSelect')?.value || '';
  const rawModel = document.getElementById('formVehicleModel').value.trim();
  const year = parseInt(document.getElementById('formYear').value, 10);
  const rawKm = document.getElementById('formKm').value.toString().replace(/[^0-9]/g, '');
  const km = parseInt(rawKm, 10);
  const rc = document.getElementById('formRcNumber').value.trim().toUpperCase().replace(/\s+/g, '');
  const rawPrice = document.getElementById('formBasePrice').value.toString().replace(/[^0-9.]/g, '');
  const basePrice = parseFloat(rawPrice);

  if (!rawModel || !year || isNaN(km) || !rc || !basePrice || isNaN(basePrice)) {
    showToast('Please fill all vehicle specifications before preview', 'error');
    return;
  }

  const model = (brand && brand !== 'Other' && !rawModel.toLowerCase().startsWith(brand.toLowerCase()))
    ? `${brand} ${rawModel}`
    : rawModel;

  state.pendingListing = {
    brand,
    rawModel,
    model,
    year,
    km,
    rc,
    basePrice,
  };

  const prevModelEl = document.getElementById('previewVehicleModel');
  const prevYearEl = document.getElementById('previewYearBadge');
  const prevKmEl = document.getElementById('previewKm');
  const prevRcEl = document.getElementById('previewRc');
  const prevPriceEl = document.getElementById('previewBasePrice');
  const prevPhotosContainer = document.getElementById('previewPhotosContainer');
  const prevPhotosList = document.getElementById('previewPhotosList');
  const prevMediaBadge = document.getElementById('previewMediaBadge');

  if (prevModelEl) prevModelEl.textContent = model;
  if (prevYearEl) prevYearEl.textContent = year;
  if (prevKmEl) prevKmEl.textContent = `${km.toLocaleString('en-IN')} KM`;
  if (prevRcEl) prevRcEl.textContent = `RC: ${rc}`;
  if (prevPriceEl) prevPriceEl.textContent = `₹${basePrice.toLocaleString('en-IN')}`;

  if (state.pendingPhotos && state.pendingPhotos.length > 0) {
    prevPhotosContainer?.classList.remove('hidden');
    if (prevPhotosList) {
      prevPhotosList.innerHTML = state.pendingPhotos
        .map((url) => `<img src="${url}" class="h-16 w-full rounded-lg object-cover border border-slate-700">`)
        .join('');
    }
  } else {
    prevPhotosContainer?.classList.add('hidden');
  }

  if (state.pendingEngineMedia) {
    prevMediaBadge?.classList.remove('hidden');
  } else {
    prevMediaBadge?.classList.add('hidden');
  }

  el.modalPostPreview?.classList.remove('hidden');
}

async function handleCreateAuctionConfirmed() {
  if (!state.pendingListing) {
    showToast('Listing details not found. Please fill vehicle form again.', 'error');
    return;
  }

  const confirmBtn = document.getElementById('btnPreviewConfirm');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<span>Starting Flash Engine...</span>`;
  }

  // Resolve valid showroom identity
  let targetShowroomId = state.currentShowroomId;
  if (!targetShowroomId && state.currentUser && state.currentUser.role === 'showroom') {
    targetShowroomId = state.currentUser.id;
  }
  if (!targetShowroomId && state.showrooms && state.showrooms.length > 0) {
    targetShowroomId = state.showrooms[0].id;
  }
  if (!targetShowroomId) {
    targetShowroomId = 6; // Default active seller counter
  }
  state.currentShowroomId = targetShowroomId;

  try {
    const res = await api.createAuction({
      showroom_id: targetShowroomId,
      vehicle_model: state.pendingListing.model,
      manufacturing_year: state.pendingListing.year,
      km_driven: state.pendingListing.km,
      rc_number: state.pendingListing.rc,
      base_price: state.pendingListing.basePrice,
      photos: state.pendingPhotos || [],
      engine_sound_video: state.pendingEngineMedia || '',
      duration_minutes: 30,
    });

    if (res.success && res.auction) {
      showToast(`🎉 Flash Auction #${res.auction.id} Launched! Live Dealers Notified!`, 'success', 5000);
      sound.playWinTone();
      el.modalPostPreview?.classList.add('hidden');
      document.getElementById('formVehicleModel').value = '';
      document.getElementById('formRcNumber').value = '';
      document.getElementById('formKm').value = '';
      document.getElementById('formBasePrice').value = '';
      state.pendingPhotos = [];
      state.pendingEngineMedia = '';
      state.pendingEngineMediaType = '';
      state.pendingListing = null;
      renderPhotoPreviews();
      removeEngineMedia();
      switchShowroomTab('deals');
      await refreshCurrentAuctions(true);
    } else {
      showToast(res.error || 'Failed to create auction. Please check details.', 'error', 6000);
      sound.playErrorBuzz();
    }
  } catch (err) {
    showToast('Error creating auction: ' + err.message, 'error', 6000);
    sound.playErrorBuzz();
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `<span>🚀 Confirm & Launch</span>`;
    }
  }
}

async function handleCreateAuction() {
  openPostPreviewModal();
}

// ============================================================================
// BID CONFIRMATION & ACCIDENTAL CLICK PREVENTION
// ============================================================================
function requestBidConfirmation(auctionId, increment) {
  triggerHaptic();
  const currentBuyer = state.buyers.find((b) => b.id === state.currentBuyerId);
  if (!currentBuyer) {
    showToast('Select an active buyer account first', 'error');
    return;
  }

  // Pre-Funded Wallet Rule Check
  if (parseFloat(currentBuyer.wallet_balance) < 3000) {
    sound.playErrorBuzz();
    showToast(`Rule 3 Violation: Insufficient wallet balance (₹${Number(currentBuyer.wallet_balance).toLocaleString('en-IN')}). Minimum ₹3,000 required to bid. Use "+₹5,000" top-up above!`, 'error');
    if (el.walletRuleAlert) el.walletRuleAlert.classList.remove('hidden');
    return;
  }

  const auction = state.auctions.find((a) => a.id === auctionId);
  if (!auction) {
    showToast('Auction details not found', 'error');
    return;
  }

  const statusUpper = String(auction.status || '').toUpperCase();
  if (statusUpper === 'CLOSED' || statusUpper === 'COMPLETED') {
    showToast('This auction is already closed', 'error');
    return;
  }

  const currentHighest = parseFloat(auction.current_highest_bid || auction.base_price || 0);
  const newTotal = currentHighest + increment;
  const vehicleTitle = auction.vehicle_model || `${auction.year ? auction.year + ' ' : ''}${auction.brand ? auction.brand + ' ' : ''}${auction.model || 'Vehicle'}`.trim();
  const sellerName = auction.showroom_name || 'Seller Desk';

  state.pendingBid = {
    auctionId,
    increment,
    currentHighest,
    newTotal,
    vehicleTitle,
    sellerName,
  };

  if (el.bidConfirmVehicleTitle) el.bidConfirmVehicleTitle.textContent = vehicleTitle;
  if (el.bidConfirmSellerName) el.bidConfirmSellerName.textContent = `Seller: ${sellerName}`;
  if (el.bidConfirmCurrentBid) el.bidConfirmCurrentBid.textContent = `₹${currentHighest.toLocaleString('en-IN')}`;
  if (el.bidConfirmIncrement) el.bidConfirmIncrement.textContent = `+₹${increment.toLocaleString('en-IN')}`;
  if (el.bidConfirmNewTotalBid) el.bidConfirmNewTotalBid.textContent = `₹${newTotal.toLocaleString('en-IN')}`;
  if (el.btnConfirmPlaceBidText) el.btnConfirmPlaceBidText.textContent = `Haan, ₹${newTotal.toLocaleString('en-IN')} Bid Confirm Karein`;

  if (el.modalBidConfirmation) {
    el.modalBidConfirmation.classList.remove('hidden');
  }
}

function closeBidConfirmationModal() {
  triggerHaptic();
  state.pendingBid = null;
  if (el.modalBidConfirmation) {
    el.modalBidConfirmation.classList.add('hidden');
  }
}

async function handleConfirmBidPlacement() {
  if (!state.pendingBid) return;
  const { auctionId, increment } = state.pendingBid;

  if (el.btnConfirmPlaceBid) {
    el.btnConfirmPlaceBid.disabled = true;
    if (el.btnConfirmPlaceBidText) {
      el.btnConfirmPlaceBidText.textContent = 'Submitting Bid...';
    }
  }

  try {
    closeBidConfirmationModal();
    await executePlaceBid(auctionId, increment);
  } finally {
    if (el.btnConfirmPlaceBid) {
      el.btnConfirmPlaceBid.disabled = false;
      if (el.btnConfirmPlaceBidText) {
        el.btnConfirmPlaceBidText.textContent = 'Haan, Bid Confirm Karein';
      }
    }
  }
}

async function placeBid(auctionId, increment) {
  requestBidConfirmation(auctionId, increment);
}

async function executePlaceBid(auctionId, increment) {
  triggerHaptic();
  const currentBuyer = state.buyers.find((b) => b.id === state.currentBuyerId);
  if (!currentBuyer) {
    showToast('Select an active buyer account first', 'error');
    return;
  }

  // Pre-Funded Wallet Rule Check
  if (parseFloat(currentBuyer.wallet_balance) < 3000) {
    sound.playErrorBuzz();
    showToast(`Rule 3 Violation: Insufficient wallet balance (₹${Number(currentBuyer.wallet_balance).toLocaleString('en-IN')}). Minimum ₹3,000 required to bid. Use "+₹5,000" top-up above!`, 'error');
    if (el.walletRuleAlert) el.walletRuleAlert.classList.remove('hidden');
    return;
  }

  const auction = state.auctions.find((a) => a.id === auctionId);
  if (!auction) return;

  // 1. ZERO-SECOND INSTANT OPTIMISTIC UI FEEDBACK (0 Millisecond Delay)
  const prevHighest = parseFloat(auction.current_highest_bid);
  const prevBidderId = auction.highest_bidder_id;
  const prevBidderName = auction.highest_bidder_name;
  const newHighest = prevHighest + increment;

  auction.current_highest_bid = newHighest;
  auction.highest_bidder_id = state.currentBuyerId;
  auction.highest_bidder_name = currentBuyer.business_name || 'You';

  sound.playBidTone();

  // Instant visual updates on price element and card
  const priceEl = document.getElementById(`price-${auctionId}`);
  const cardEl = document.getElementById(`auction-card-${auctionId}`);
  if (priceEl) {
    priceEl.textContent = `₹${newHighest.toLocaleString('en-IN')}`;
    priceEl.classList.remove('pulse-gold');
    void priceEl.offsetWidth;
    priceEl.classList.add('pulse-gold');
  }
  if (cardEl) {
    cardEl.classList.remove('animate-bid-flash');
    void cardEl.offsetWidth;
    cardEl.classList.add('animate-bid-flash');
  }

  const leadEl = document.getElementById(`lead-badge-${auctionId}`);
  if (leadEl) {
    leadEl.innerHTML = `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">👑 AAP LEADING PE HAIN</span>`;
  }

  showToast(`Bid Placed: ₹${newHighest.toLocaleString('en-IN')}!`, 'success', 1800);

  // 2. BACKGROUND SERVER SYNC
  if (state.socket && state.socket.connected) {
    state.socket.emit(
      'place_bid',
      {
        auctionId,
        buyerId: state.currentBuyerId,
        incrementAmount: increment,
      },
      (res) => {
        if (!res?.success) {
          // Rollback on rejection
          auction.current_highest_bid = prevHighest;
          auction.highest_bidder_id = prevBidderId;
          auction.highest_bidder_name = prevBidderName;
          if (priceEl) priceEl.textContent = `₹${prevHighest.toLocaleString('en-IN')}`;
          sound.playErrorBuzz();
          showToast(`Bid Rejected: ${res?.error || 'Unknown error'}`, 'error');
          fastUpdateAuctionsDom();
        }
      }
    );
  } else {
    // REST fallback
    try {
      const res = await api.placeBidRest(auctionId, state.currentBuyerId, increment);
      if (res.success) {
        auction.current_highest_bid = res.bidAmount || newHighest;
        auction.highest_bidder_name = res.highestBidderName || auction.highest_bidder_name;
        localStorage.setItem('exchangedesk_cached_auctions', JSON.stringify(state.auctions));
        fastUpdateAuctionsDom();
        refreshCurrentAuctions();
      } else {
        // Rollback
        auction.current_highest_bid = prevHighest;
        auction.highest_bidder_id = prevBidderId;
        auction.highest_bidder_name = prevBidderName;
        if (priceEl) priceEl.textContent = `₹${prevHighest.toLocaleString('en-IN')}`;
        sound.playErrorBuzz();
        showToast(`Bid Rejected: ${res.error || 'Server error'}`, 'error');
        fastUpdateAuctionsDom();
      }
    } catch (err) {
      // Rollback
      auction.current_highest_bid = prevHighest;
      auction.highest_bidder_id = prevBidderId;
      auction.highest_bidder_name = prevBidderName;
      if (priceEl) priceEl.textContent = `₹${prevHighest.toLocaleString('en-IN')}`;
      sound.playErrorBuzz();
      showToast(`Network Error: ${err.message}`, 'error');
      fastUpdateAuctionsDom();
    }
  }
}

// ============================================================================
// REAL-TIME EVENT HANDLERS
// ============================================================================
function handleBidUpdate(payload) {
  const auction = state.auctions.find((a) => a.id === payload.auctionId);
  if (auction) {
    auction.current_highest_bid = payload.newHighestBid;
    auction.highest_bidder_id = payload.highestBidderId;
    auction.highest_bidder_name = payload.highestBidderName;
    if (!auction.recent_bids) auction.recent_bids = [];
    if (!auction.recent_bids.some((b) => b.id === payload.bidId)) {
      auction.recent_bids.unshift({
        id: payload.bidId || Date.now(),
        amount: payload.newHighestBid,
        bidder_name: payload.highestBidderName,
        placed_at: payload.timestamp || new Date().toISOString(),
      });
    }
  }

  // Dynamic update for confirmation modal if open for this auction
  if (state.pendingBid && state.pendingBid.auctionId === payload.auctionId) {
    const updatedNewTotal = parseFloat(payload.newHighestBid) + state.pendingBid.increment;
    state.pendingBid.currentHighest = parseFloat(payload.newHighestBid);
    state.pendingBid.newTotal = updatedNewTotal;

    if (el.bidConfirmCurrentBid) {
      el.bidConfirmCurrentBid.textContent = `₹${parseFloat(payload.newHighestBid).toLocaleString('en-IN')}`;
      el.bidConfirmCurrentBid.classList.remove('pulse-gold');
      void el.bidConfirmCurrentBid.offsetWidth;
      el.bidConfirmCurrentBid.classList.add('pulse-gold');
    }
    if (el.bidConfirmNewTotalBid) {
      el.bidConfirmNewTotalBid.textContent = `₹${updatedNewTotal.toLocaleString('en-IN')}`;
    }
    if (el.btnConfirmPlaceBidText) {
      el.btnConfirmPlaceBidText.textContent = `Haan, ₹${updatedNewTotal.toLocaleString('en-IN')} Bid Confirm Karein`;
    }
  }

  const priceEl = document.getElementById(`price-${payload.auctionId}`);
  const cardEl = document.getElementById(`auction-card-${payload.auctionId}`);

  if (priceEl) {
    priceEl.textContent = `₹${parseFloat(payload.newHighestBid).toLocaleString('en-IN')}`;
  }

  if (cardEl) {
    cardEl.classList.remove('animate-bid-flash');
    void cardEl.offsetWidth;
    cardEl.classList.add('animate-bid-flash');
  }

  if (state.activeRole === 'buyer') {
    if (payload.highestBidderId === state.currentBuyerId) {
      sound.playBidTone();
      showToast(`Your bid of ₹${parseFloat(payload.newHighestBid).toLocaleString('en-IN')} is winning!`, 'success');
    } else {
      sound.playOutbidAlert();
      showToast(`Outbid on ${payload.vehicleModel || 'bike'}: ₹${parseFloat(payload.newHighestBid).toLocaleString('en-IN')} by ${payload.highestBidderName || 'Dealer'}`, 'info');
    }
  } else {
    sound.playBidTone();
    showToast(`New Live Bid on ${payload.vehicleModel || 'bike'}: ₹${parseFloat(payload.newHighestBid).toLocaleString('en-IN')} by ${payload.highestBidderName || 'Dealer'}`, 'info');
  }

  fastUpdateAuctionsDom();
}

function handleFeedBidTick(payload) {
  const auction = state.auctions.find((a) => a.id === payload.auctionId);
  if (auction) {
    auction.current_highest_bid = payload.newHighestBid;
    if (payload.highestBidderId) auction.highest_bidder_id = payload.highestBidderId;
    if (payload.highestBidderName) auction.highest_bidder_name = payload.highestBidderName;
    if (!auction.recent_bids) auction.recent_bids = [];
    if (payload.bidId && !auction.recent_bids.some((b) => b.id === payload.bidId)) {
      auction.recent_bids.unshift({
        id: payload.bidId,
        amount: payload.newHighestBid,
        bidder_name: payload.highestBidderName,
        placed_at: payload.timestamp || new Date().toISOString(),
      });
    }
    fastUpdateAuctionsDom();
  }
}

function handleAuctionClosed(payload) {
  const auction = state.auctions.find((a) => a.id === payload.auctionId);
  if (auction) {
    auction.status = 'CLOSED';
    auction.current_highest_bid = payload.finalBid || auction.current_highest_bid;
    auction.highest_bidder_name = payload.winnerName;
  }

  showToast(`Auction #${payload.auctionId} Closed. Final: ₹${parseFloat(payload.finalBid || 0).toLocaleString('en-IN')}`, 'info');

  if (state.activeRole === 'buyer' && payload.highestBidderId === state.currentBuyerId) {
    sound.playWinTone();
    showToast(`🏆 YOU WON ${payload.vehicleModel}! Pay counter directly with Pickup OTP.`, 'success');
  }

  renderAuctions();
}

function handleAuctionCompleted(payload) {
  const auction = state.auctions.find((a) => a.id === payload.auctionId);
  if (auction) {
    auction.status = 'COMPLETED';
  }
  showToast(`Handover Verified: ${payload.vehicleModel} released to ${payload.winnerName}. Fee: ₹${payload.feeDeducted}`, 'success');
  renderAuctions();
}

// ============================================================================
// RENDERING: BUYER AND SHOWROOM CARDS
// ============================================================================
function renderAuctions() {
  if (state.activeRole === 'seller') {
    renderShowroomCards();
  } else if (state.activeRole === 'buyer') {
    renderBuyerCards();
  }
}

function renderShowroomCards() {
  const container = el.showroomAuctionsContainer;
  if (!container) return;

  const myShowroomId = parseInt(state.currentShowroomId || (state.currentUser && state.currentUser.id) || 0, 10);
  
  // 1. Prioritize auctions posted by this seller counter
  let myAuctions = state.auctions.filter((a) => parseInt(a.showroom_id, 10) === myShowroomId);
  
  // 2. If no auctions specific to this showroom counter, display all active live platform auctions so seller desk is never blank!
  let auctions = myAuctions.length > 0 ? myAuctions : state.auctions.filter((a) => a.status === 'LIVE' || a.status === 'CLOSED');

  if (el.showroomActiveCount) el.showroomActiveCount.textContent = auctions.length;
  const tabBadge = document.getElementById('showroomTabBadge');
  if (tabBadge) tabBadge.textContent = auctions.length;

  if (auctions.length === 0) {
    container.innerHTML = `
      <div class="glass-panel p-8 rounded-2xl border border-slate-800 text-center space-y-2">
        <p class="text-xs font-bold text-slate-300">No active exchange listings right now</p>
        <p class="text-[11px] text-slate-500">Tap "Post New Bike" to initiate an instant 10-minute exchange auction.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = auctions
    .map((auction) => {
      const isLive = auction.status === 'LIVE';
      const isClosed = auction.status === 'CLOSED';
      const isCompleted = auction.status === 'COMPLETED';
      const isOtpRevealed = state.revealedOtps.has(auction.id);
      const recentBids = auction.recent_bids || [];
      const overReserve = parseFloat(auction.current_highest_bid) - parseFloat(auction.base_price);

      const statusBadge = isLive
        ? `<span class="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> 10-MIN RAPID LIVE</span>`
        : isClosed
        ? `<span class="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/30">PENDING HANDOVER</span>`
        : `<span class="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/30">✓ COMPLETED</span>`;

      const photos = typeof auction.photos === 'string' ? JSON.parse(auction.photos || '[]') : (auction.photos || []);
      const hasPhotos = Array.isArray(photos) && photos.length > 0;
      const hasMedia = !!auction.engine_sound_video || !!auction.has_engine_media;

      return `
        <div id="auction-card-${auction.id}" class="glass-panel animate-card-enter p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-xl space-y-3.5 transition-all">
          
          <!-- Header: Vehicle Info & Unmasked RC -->
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="flex items-center space-x-2">
                <h3 class="text-base font-extrabold text-white">${auction.vehicle_model}</h3>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold border border-slate-700">${auction.manufacturing_year}</span>
              </div>
              <div class="flex items-center space-x-2 text-xs text-slate-400 mt-1">
                <span>${auction.km_driven.toLocaleString('en-IN')} KM</span>
                <span>•</span>
                <span class="font-mono text-emerald-400 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-xs">
                  RC: ${auction.rc_number}
                </span>
              </div>
            </div>
            <div>${statusBadge}</div>
          </div>

          <!-- Vehicle Inspection Media Banner (Photos & Engine Sound) -->
          ${
            hasPhotos || hasMedia
              ? `
            <div class="p-2.5 rounded-xl bg-[#080d1a] border border-slate-800 flex items-center justify-between gap-2">
              <div class="flex items-center space-x-2.5 min-w-0">
                ${
                  hasPhotos
                    ? `<img src="${photos[0]}" alt="Vehicle" class="w-12 h-12 rounded-lg object-cover border border-slate-700 flex-shrink-0 cursor-pointer btn-open-photo-zoom hover:ring-2 hover:ring-emerald-500 transition" data-id="${auction.id}" title="Tap to Zoom">`
                    : `<span class="w-12 h-12 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-xl flex-shrink-0">🏍️</span>`
                }
                <div class="min-w-0">
                  <div class="text-xs font-black text-white flex items-center gap-1.5 truncate">
                    ${hasPhotos ? `<span>📷 ${photos.length} Photo${photos.length > 1 ? 's' : ''}</span>` : ''}
                    ${hasMedia ? `<span class="text-blue-400 font-bold">• 🔊 Engine Sound Clip</span>` : ''}
                  </div>
                  <div class="text-[10px] text-emerald-400 truncate">Verified Inspection Media Uploaded</div>
                </div>
              </div>
              <button type="button" class="btn-open-media px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 font-black text-[10px] active:scale-95 transition mobile-tap flex-shrink-0" data-id="${auction.id}">
                View Media →
              </button>
            </div>
          `
              : ''
          }

          <!-- 10-Minute Countdown Clock & Dynamic Color-Shifting Progress Bar -->
          <div class="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-2">
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-400 font-bold flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}"></span>
                10-Min Flash Countdown:
              </span>
              <span id="timer-${auction.id}" class="font-mono-numbers font-black text-sm text-emerald-400">10:00.0</span>
            </div>
            <div class="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800/80">
              <div id="timer-bar-${auction.id}" class="bg-gradient-to-r from-emerald-500 to-teal-400 h-full w-full transition-all duration-100"></div>
            </div>
          </div>

          <!-- Real-Time Highest Valuation & Lead Dealer Banner -->
          <div class="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <div class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Current Highest Valuation</div>
              <div id="price-${auction.id}" class="text-2xl font-black font-mono-numbers text-emerald-400">
                ₹${parseFloat(auction.current_highest_bid).toLocaleString('en-IN')}
              </div>
              <div class="text-[10px] text-slate-400">Base Reserve: ₹${parseFloat(auction.base_price).toLocaleString('en-IN')}</div>
            </div>
            <div id="showroom-lead-${auction.id}" class="text-right">
              ${
                auction.highest_bidder_name
                  ? `
                <div class="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-black flex items-center gap-1 justify-end">
                  <span>👑 Lead:</span> <span class="text-white">${auction.highest_bidder_name}</span>
                </div>
                <div class="text-[10px] text-emerald-400 font-bold mt-1">
                  +₹${overReserve.toLocaleString('en-IN')} over reserve
                </div>
              `
                  : `
                <div class="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
                  ⚡ Waiting for first bid...
                </div>
                <div class="text-[10px] text-slate-500 mt-1">Dealers notified live</div>
              `
              }
            </div>
          </div>

          <!-- Live Bids Feed Stream (Real-Time Dealer Submissions) -->
          <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-2">
            <div class="flex items-center justify-between text-xs font-bold text-slate-300">
              <span class="flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                Live Bids Feed (${recentBids.length})
              </span>
              <span class="text-[10px] text-slate-500 font-normal">Real-time dealer stream</span>
            </div>
            <div class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              ${
                recentBids.length === 0
                  ? `
                <div class="text-[11px] text-slate-500 italic py-2 text-center">
                  Waiting for dealer bids... 10-minute flash engine is actively notifying verified used-bike buyers!
                </div>
              `
                  : recentBids
                      .map((bid, idx) => `
                <div class="flex items-center justify-between p-2 rounded-lg ${idx === 0 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-slate-900 border border-slate-800/60'} text-xs">
                  <div class="flex items-center space-x-2">
                    <span class="w-4 h-4 rounded-full ${idx === 0 ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'} flex items-center justify-center text-[9px]">
                      #${recentBids.length - idx}
                    </span>
                    <div>
                      <div class="font-bold text-white text-[11px]">${bid.bidder_name}</div>
                      <div class="text-[9px] text-slate-400">${new Date(bid.placed_at).toLocaleTimeString()}</div>
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="font-black font-mono-numbers ${idx === 0 ? 'text-emerald-400 text-xs' : 'text-slate-300 text-[11px]'}">
                      ₹${parseFloat(bid.amount).toLocaleString('en-IN')}
                    </div>
                    ${idx === 0 ? '<span class="text-[8px] font-black uppercase text-emerald-400">👑 Lead Bid</span>' : ''}
                  </div>
                </div>
              `).join('')
              }
            </div>
          </div>

          <!-- Handover & OTP Controls -->
          <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
            <div class="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
              <span class="text-[10px] text-slate-400 font-bold uppercase">Pickup OTP:</span>
              <span id="otp-val-${auction.id}" class="font-mono-numbers font-black text-xs ${isOtpRevealed ? 'text-amber-400' : 'text-slate-500'}">
                ${isOtpRevealed ? auction.pickup_otp : '••••••'}
              </span>
              <button class="btn-toggle-otp text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-900" data-id="${auction.id}">
                ${isOtpRevealed ? 'Hide' : 'Reveal'}
              </button>
            </div>

            <div class="flex items-center space-x-1.5">
              <button class="btn-view-audit px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300" data-id="${auction.id}">
                Audit
              </button>
              ${
                !isCompleted
                  ? `<button class="btn-open-handover px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-black shadow active:scale-95 transition" data-id="${auction.id}">
                      Handover OTP & Settle Fee (₹500)
                    </button>`
                  : `<span class="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                      ✓ Released
                    </span>`
              }
            </div>
          </div>

        </div>
      `;
    })
    .join('');

  attachShowroomEvents();
}

function attachShowroomEvents() {
  document.querySelectorAll('.btn-toggle-otp').forEach((btn) => {
    btn.addEventListener('click', () => {
      triggerHaptic();
      const id = parseInt(btn.dataset.id, 10);
      if (state.revealedOtps.has(id)) {
        state.revealedOtps.delete(id);
      } else {
        state.revealedOtps.add(id);
      }
      renderShowroomCards();
    });
  });

  document.querySelectorAll('.btn-open-handover').forEach((btn) => {
    btn.addEventListener('click', () => {
      triggerHaptic();
      const id = parseInt(btn.dataset.id, 10);
      openHandoverModal(id);
    });
  });

  document.querySelectorAll('.btn-view-audit').forEach((btn) => {
    btn.addEventListener('click', () => {
      triggerHaptic();
      const id = parseInt(btn.dataset.id, 10);
      openAuditModal(id);
    });
  });

  document.querySelectorAll('.btn-open-media').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerHaptic();
      const id = parseInt(btn.dataset.id, 10);
      openMediaViewer(id);
    });
  });

  document.querySelectorAll('.btn-open-photo-zoom').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerHaptic();
      const id = parseInt(btn.dataset.id, 10);
      const auction = state.auctions.find((a) => a.id === id);
      if (!auction) return;
      const photos = typeof auction.photos === 'string' ? JSON.parse(auction.photos || '[]') : (auction.photos || []);
      if (photos.length > 0) {
        openPhotoZoom(photos, 0);
      } else {
        openMediaViewer(id);
      }
    });
  });
}

function renderBuyerCards() {
  const container = el.buyerAuctionsContainer;
  el.buyerActiveCount.textContent = state.auctions.length;

  if (state.auctions.length === 0) {
    container.innerHTML = `
      <div class="col-span-full glass-panel p-8 rounded-2xl border border-slate-800 text-center space-y-2">
        <p class="text-sm font-bold text-white">No Live Auctions Active</p>
        <p class="text-xs text-slate-400">Waiting for sellers to list exchange bikes.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = state.auctions
    .map((auction) => {
      const isLive = auction.status === 'LIVE';
      const isClosed = auction.status === 'CLOSED';
      const isCompleted = auction.status === 'COMPLETED';
      const isWinning = auction.highest_bidder_id === state.currentBuyerId;
      const recentBids = auction.recent_bids || [];
      const photos = typeof auction.photos === 'string' ? JSON.parse(auction.photos || '[]') : (auction.photos || []);
      const hasPhotos = Array.isArray(photos) && photos.length > 0;
      const hasMedia = !!auction.engine_sound_video || !!auction.has_engine_media;

      return `
        <div id="auction-card-${auction.id}" class="glass-panel animate-card-enter p-4 rounded-2xl border border-slate-800 shadow-md space-y-3 flex flex-col justify-between">
          <div>
            <div class="flex items-start justify-between gap-1.5">
              <div>
                <h3 class="text-sm font-bold text-white">${auction.vehicle_model}</h3>
                <div class="flex items-center space-x-1.5 text-xs text-slate-400 mt-0.5">
                  <span>${auction.manufacturing_year}</span>
                  <span>•</span>
                  <span>${auction.km_driven.toLocaleString('en-IN')} KM</span>
                  <span>•</span>
                  <!-- Masked RC Anti-Bypass Rule -->
                  <span class="font-mono text-emerald-400 font-bold bg-slate-900 px-1 py-0.5 rounded border border-slate-700 text-[11px]">
                    ${auction.rc_number_masked || 'XX-**-****'}
                  </span>
                </div>
              </div>
              <div>
                ${
                  isLive
                    ? `<span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> LIVE</span>`
                    : isClosed
                    ? `<span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/30">CLOSED</span>`
                    : `<span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/30">SETTLED</span>`
                }
              </div>
            </div>

            <!-- Vehicle Inspection Photos & Engine Sound Preview -->
            ${
              hasPhotos || hasMedia
                ? `
              <div class="mt-2.5 rounded-xl overflow-hidden border border-slate-800 bg-[#080d1a]">
                ${
                  hasPhotos
                    ? `
                  <div class="relative w-full h-36 bg-black cursor-pointer btn-open-photo-zoom group" data-id="${auction.id}">
                    <img src="${photos[0]}" alt="${auction.vehicle_model}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                    <div class="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-black/80 backdrop-blur-sm text-[10px] font-black text-white flex items-center gap-1 border border-white/10">
                      <span>📷</span>
                      <span>${photos.length} Photo${photos.length > 1 ? 's' : ''}</span>
                    </div>
                    <div class="absolute bottom-2 right-2 px-2.5 py-0.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[9px] uppercase tracking-wider shadow flex items-center gap-1">
                      <span>🔍 Full Zoom</span>
                    </div>
                  </div>
                `
                    : ''
                }
                ${
                  hasMedia
                    ? `
                  <button type="button" class="btn-open-media w-full py-2 px-3 bg-gradient-to-r from-blue-950/80 via-slate-900 to-indigo-950/80 border-t border-blue-500/30 text-blue-300 font-bold text-xs flex items-center justify-between hover:bg-blue-900/40 transition active:scale-95 mobile-tap" data-id="${auction.id}">
                    <span class="flex items-center gap-2">
                      <span class="w-5 h-5 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px]">🔊</span>
                      <span>Play Engine Sound & Exhaust Video</span>
                    </span>
                    <span class="flex items-center gap-1">
                      <span class="eq-bar"></span>
                      <span class="eq-bar"></span>
                      <span class="eq-bar"></span>
                      <span class="eq-bar"></span>
                    </span>
                  </button>
                `
                    : ''
                }
              </div>
            `
                : ''
            }

            <!-- Timer Bar -->
            <div class="mt-2.5 bg-slate-900 p-2 rounded-xl border border-slate-800 space-y-1.5">
              <div class="flex justify-between items-center text-[11px]">
                <span class="text-slate-400 font-bold">10-Min Flash Countdown:</span>
                <span id="timer-${auction.id}" class="font-mono-numbers font-black text-xs text-white">--:--</span>
              </div>
              <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div id="timer-bar-${auction.id}" class="bg-emerald-500 h-full w-full transition-all duration-100"></div>
              </div>
            </div>

            <!-- Price -->
            <div class="mt-2.5 flex items-baseline justify-between">
              <div>
                <div class="text-[9px] uppercase font-bold text-slate-400">Current Highest Bid</div>
                <div id="price-${auction.id}" class="text-xl font-black font-mono-numbers text-emerald-400">
                  ₹${parseFloat(auction.current_highest_bid).toLocaleString('en-IN')}
                </div>
              </div>
              <div id="lead-badge-${auction.id}">
                ${
                  isWinning
                    ? `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">👑 AAP LEADING PE HAIN</span>`
                    : auction.highest_bidder_name
                    ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">Lead: ${auction.highest_bidder_name}</span>`
                    : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">Reserve Opening</span>`
                }
              </div>
            </div>

            <!-- Recent Bids Mini Stream -->
            ${
              recentBids.length > 0
                ? `
              <div class="mt-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 space-y-1 text-[10px]">
                <div class="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Latest Bids:</div>
                ${recentBids.slice(0, 2).map((b) => `
                  <div class="flex justify-between text-slate-300">
                    <span class="font-semibold truncate max-w-[140px]">${b.bidder_name}</span>
                    <span class="font-mono font-bold text-emerald-400">₹${parseFloat(b.amount).toLocaleString('en-IN')}</span>
                  </div>
                `).join('')}
              </div>
            `
                : ''
            }
          </div>

          <div class="pt-2 border-t border-slate-800 space-y-2">
            ${
              isLive
                ? `
                  <div class="grid grid-cols-3 gap-1.5">
                    <button class="btn-quick-bid py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 hover:text-slate-950 text-white font-black text-xs transition active:scale-95 border border-slate-700 font-mono-numbers" data-id="${auction.id}" data-inc="500">
                      +₹500
                    </button>
                    <button class="btn-quick-bid py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 hover:text-slate-950 text-white font-black text-xs transition active:scale-95 border border-slate-700 font-mono-numbers" data-id="${auction.id}" data-inc="1000">
                      +₹1k
                    </button>
                    <button class="btn-quick-bid py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 hover:text-slate-950 text-white font-black text-xs transition active:scale-95 border border-slate-700 font-mono-numbers" data-id="${auction.id}" data-inc="2000">
                      +₹2k
                    </button>
                  </div>
                  <!-- Custom Bid Input -->
                  <div class="flex items-center gap-1.5">
                    <input type="number" id="custom-bid-inc-${auction.id}" placeholder="+Custom (min 500)" min="500" step="100" class="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-emerald-500 font-mono-numbers">
                    <button class="btn-custom-bid px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition active:scale-95 whitespace-nowrap" data-id="${auction.id}">
                      Bid
                    </button>
                  </div>
                `
                : isClosed && isWinning
                ? `
                  <div class="bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl text-center text-xs space-y-0.5">
                    <div class="font-bold text-emerald-400">🎉 WON AUCTION!</div>
                    <p class="text-[10px] text-slate-300">Visit Seller Counter to pay down payment. Release bike with Pickup OTP.</p>
                  </div>
                `
                : isClosed
                ? `
                  <div class="bg-slate-900 border border-slate-800 p-2 rounded-xl text-center text-[11px] text-slate-400">
                    Bidding closed. Won by: <strong class="text-white">${auction.highest_bidder_name || 'Counter'}</strong>
                  </div>
                `
                : `
                  <div class="bg-blue-500/10 border border-blue-500/30 p-2 rounded-xl text-center text-xs text-blue-400 font-bold">
                    ✓ Handover Completed
                  </div>
                `
            }

            <div class="flex justify-between items-center text-[10px] text-slate-400">
              <span class="truncate">Seller: ${auction.showroom_name || 'Seller Desk'}</span>
              <button class="btn-view-audit text-emerald-400 hover:underline" data-id="${auction.id}">
                Audit →
              </button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  attachBuyerEvents();
}

function attachBuyerEvents() {
  document.querySelectorAll('.btn-quick-bid').forEach((btn) => {
    btn.addEventListener('click', () => {
      const auctionId = parseInt(btn.dataset.id, 10);
      const increment = parseFloat(btn.dataset.inc);
      requestBidConfirmation(auctionId, increment);
    });
  });

  document.querySelectorAll('.btn-custom-bid').forEach((btn) => {
    btn.addEventListener('click', () => {
      const auctionId = parseInt(btn.dataset.id, 10);
      const input = document.getElementById(`custom-bid-inc-${auctionId}`);
      if (!input) return;
      const inc = parseFloat(input.value);
      if (isNaN(inc) || inc < 500) {
        showToast('Minimum bid increment is ₹500', 'error');
        return;
      }
      requestBidConfirmation(auctionId, inc);
      input.value = '';
    });
  });

  document.querySelectorAll('[id^="custom-bid-inc-"]').forEach((input) => {
    input.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        const auctionId = parseInt(input.id.replace('custom-bid-inc-', ''), 10);
        const inc = parseFloat(input.value);
        if (isNaN(inc) || inc < 500) {
          showToast('Minimum bid increment is ₹500', 'error');
          return;
        }
        requestBidConfirmation(auctionId, inc);
        input.value = '';
      }
    });
  });

  document.querySelectorAll('.btn-view-audit').forEach((btn) => {
    btn.addEventListener('click', () => {
      triggerHaptic();
      const id = parseInt(btn.dataset.id, 10);
      openAuditModal(id);
    });
  });

  document.querySelectorAll('.btn-open-media').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerHaptic();
      const id = parseInt(btn.dataset.id, 10);
      openMediaViewer(id);
    });
  });

  document.querySelectorAll('.btn-open-photo-zoom').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerHaptic();
      const id = parseInt(btn.dataset.id, 10);
      const auction = state.auctions.find((a) => a.id === id);
      if (!auction) return;
      const photos = typeof auction.photos === 'string' ? JSON.parse(auction.photos || '[]') : (auction.photos || []);
      if (photos.length > 0) {
        openPhotoZoom(photos, 0);
      } else {
        openMediaViewer(id);
      }
    });
  });
}

// ============================================================================
// TIMER LOOP
// ============================================================================
function startAuthoritativeTimerLoop() {
  setInterval(() => {
    const authoritativeNow = Date.now() + state.serverTimeSkew;

    state.auctions.forEach((auction) => {
      const timerEl = document.getElementById(`timer-${auction.id}`);
      const timerBarEl = document.getElementById(`timer-bar-${auction.id}`);
      if (!timerEl) return;

      if (auction.status !== 'LIVE') {
        timerEl.textContent = auction.status === 'COMPLETED' ? 'COMPLETED' : 'CLOSED';
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
        timerEl.className = 'font-mono-numbers font-black text-xs text-red-500';
        if (timerBarEl) timerBarEl.style.width = '0%';

        // AUTOMATIC AUCTION CLOSING & WINNER SELECTION (Timer Reached 00:00)
        if (auction.status === 'LIVE') {
          auction.status = 'CLOSED';

          const isWinning = auction.highest_bidder_id === state.currentBuyerId;
          if (state.activeRole === 'buyer') {
            if (isWinning) {
              sound.playWinTone();
              showToast(`🏆 MUBARAK HO! Aapne "${auction.vehicle_model}" jeet li hai! (Final Bid: ₹${parseFloat(auction.current_highest_bid).toLocaleString('en-IN')})`, 'success', 8000);
            } else {
              sound.playOutbidAlert();
              showToast(`⏱️ Flash Auction Ended: ${auction.vehicle_model} won by ${auction.highest_bidder_name || 'Seller Counter'}`, 'info', 4500);
            }
          } else {
            sound.playWinTone();
            showToast(`🏁 10-Min Flash Over: ${auction.vehicle_model} closed at ₹${parseFloat(auction.current_highest_bid).toLocaleString('en-IN')}. Winner: ${auction.highest_bidder_name || 'No bids placed'}`, 'success', 7000);
          }

          // Immediately re-render with winner card & pickup OTP
          renderAuctions();

          // Sync database atomically in background
          api.closeAuction(auction.id).catch(() => {});
        }
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
  }, 200);
}







// ============================================================================
// HANDOVER & RECEIPT MODAL
// ============================================================================
function openHandoverModal(auctionId) {
  const auction = state.auctions.find((a) => a.id === auctionId);
  if (!auction) return;

  el.modalAuctionId.value = auction.id;
  el.modalVehicleName.textContent = `${auction.vehicle_model} (${auction.manufacturing_year})`;
  el.modalWinnerName.textContent = auction.highest_bidder_name || 'No bidder';
  el.modalFinalPrice.textContent = `₹${parseFloat(auction.current_highest_bid).toLocaleString('en-IN')}`;

  el.inputPickupOtp.value = '';
  el.handoverReceipt.classList.add('hidden');
  el.formVerifyOtp.classList.remove('hidden');
  el.modalHandover.classList.remove('hidden');
}

function closeHandoverModal() {
  el.modalHandover.classList.add('hidden');
}

async function handleVerifyHandover() {
  const auctionId = parseInt(el.modalAuctionId.value, 10);
  const otp = el.inputPickupOtp.value.trim();

  if (!otp || otp.length !== 6) {
    showToast('Enter valid 6-digit Pickup OTP', 'error');
    sound.playErrorBuzz();
    return;
  }

  const submitBtn = document.getElementById('btnConfirmOtp');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Verifying Handover...';

  try {
    const res = await api.verifyHandover(auctionId, otp, state.currentShowroomId);
    if (res.success) {
      sound.playWinTone();
      showToast('Handover verified! ₹500 fee auto-deducted from winning buyer.', 'success');

      el.formVerifyOtp.classList.add('hidden');
      el.handoverReceipt.classList.remove('hidden');
      el.receiptTxnId.textContent = `#TXN-${res.receipt.transactionId}`;
      el.receiptRc.textContent = res.receipt.rcNumber;
      el.receiptRemaining.textContent = `₹${parseFloat(res.receipt.buyerRemainingWallet).toLocaleString('en-IN')}`;

      await refreshCurrentAuctions();
    } else {
      sound.playErrorBuzz();
      showToast(res.error || 'Handover verification failed', 'error');
    }
  } catch (err) {
    sound.playErrorBuzz();
    showToast('Error verifying handover: ' + err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Verify OTP & Authorize Handover (Deduct ₹500)';
  }
}

// ============================================================================
// AUDIT MODAL
// ============================================================================
async function openAuditModal(auctionId) {
  el.modalBids.classList.remove('hidden');
  el.auditBidsList.innerHTML = `<div class="p-3 text-center text-xs text-slate-400">Loading audit history...</div>`;

  try {
    const res = await api.getAuctionDetails(auctionId, state.activeRole === 'seller' ? 'showroom' : 'buyer', state.currentShowroomId);
    if (res.success) {
      el.auditVehicleTitle.textContent = `${res.auction.vehicle_model} (Base: ₹${parseFloat(res.auction.base_price).toLocaleString('en-IN')})`;

      if (res.bids.length === 0) {
        el.auditBidsList.innerHTML = `<div class="p-4 text-center text-xs text-slate-400">No bids placed yet. Current valuation at base reserve.</div>`;
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
    el.auditBidsList.innerHTML = `<div class="p-3 text-center text-xs text-red-400">Error: ${err.message}</div>`;
  }
}

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const bg =
    type === 'success'
      ? 'bg-emerald-600 text-white'
      : type === 'error'
      ? 'bg-red-600 text-white'
      : 'bg-slate-800 text-slate-100 border border-slate-700';

  toast.className = `${bg} pointer-events-auto px-3.5 py-2.5 rounded-xl shadow-xl text-xs font-semibold flex items-center justify-between transition-all duration-300 transform translate-y-2 opacity-0`;
  toast.innerHTML = `
    <span>${message}</span>
    <button class="ml-2 text-white/70 hover:text-white text-sm">&times;</button>
  `;

  if (el.toastContainer) {
    el.toastContainer.appendChild(toast);
  } else {
    document.body.appendChild(toast);
  }
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  const remove = () => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  };

  toast.querySelector('button')?.addEventListener('click', remove);
  setTimeout(remove, 4000);
}

document.addEventListener('DOMContentLoaded', initApp);
