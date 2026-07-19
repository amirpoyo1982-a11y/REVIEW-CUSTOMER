import { initializeApp }   from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
  import {
    getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
  } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
  import {
    getFirestore, collection, addDoc, onSnapshot,
    query, orderBy, serverTimestamp,
    doc, getDoc, setDoc, deleteDoc, updateDoc, Timestamp
  } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

  // ── Firebase ──────────────────────────────────────────────────
  const app = initializeApp({
    apiKey:"AIzaSyBOkyPe2f1tHu9OQiwHHpgfJTYM-KM7cuU",
    authDomain:"h4sx-6712c.firebaseapp.com",
    projectId:"h4sx-6712c",
    storageBucket:"h4sx-6712c.firebasestorage.app",
    messagingSenderId:"416803081247",
    appId:"1:416803081247:web:e201174233b953e539992a",
    measurementId:"G-J9QWB39V87"
  });
  const db = getFirestore(app);
  const auth = getAuth(app);

  // -- Opening loader -----------------------------------
  const pageLoader = document.getElementById("pageLoader");
  function hidePageLoader() {
    if (!pageLoader || pageLoader.classList.contains("hide")) return;
    pageLoader.classList.add("hide");
    setTimeout(() => pageLoader.remove(), 650);
  }
  window.addEventListener("load", () => setTimeout(hidePageLoader, 650));
  setTimeout(hidePageLoader, 4200);

  // -- Light / Dark mode ---------------------------------
  const btnThemeToggle = document.getElementById("btnThemeToggle");
  function setThemeMode(mode) {
    const safeMode = mode === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", safeMode);
    try { localStorage.setItem("h4sxTheme", safeMode); } catch(e) {}
    if (btnThemeToggle) btnThemeToggle.textContent = safeMode === "dark" ? "Dark" : "Light";
  }
  setThemeMode(document.documentElement.getAttribute("data-theme") || "light");
  btnThemeToggle?.addEventListener("click", () => {
    setThemeMode(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
  });

  // -- Hard refresh --------------------------------------
  const btnHardRefreshReview = document.getElementById("btnHardRefreshReview");
  function cleanHardRefreshParam() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("refresh")) return;
    url.searchParams.delete("refresh");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }
  async function hardRefreshReviewSite() {
    if (btnHardRefreshReview?.classList.contains("is-refreshing")) return;
    btnHardRefreshReview?.classList.add("is-refreshing");
    if (btnHardRefreshReview) btnHardRefreshReview.querySelector(".hard-refresh-text").textContent = "Refreshing";
    try {
      const keysToClear = [
        "h4sx_review_notice_hidden_until",
        "h4sxReviewCache",
        "h4sx_review_cache",
        "h4sx_reviews_cache"
      ];
      keysToClear.forEach(key => {
        try { localStorage.removeItem(key); } catch(e) {}
        try { sessionStorage.removeItem(key); } catch(e) {}
      });
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.map(name => caches.delete(name)));
      }
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }
    } catch (e) {
      console.log("Hard refresh review gagal clear cache sepenuhnya", e);
    } finally {
      const url = new URL(window.location.href);
      url.searchParams.set("refresh", Date.now().toString());
      window.location.replace(url.toString());
    }
  }
  cleanHardRefreshParam();
  btnHardRefreshReview?.addEventListener("click", hardRefreshReviewSite);
  window.hardRefreshReviewSite = hardRefreshReviewSite;

  // ── Butang scroll terus ke bahagian ulasan ──────────────────────

  // -- Review notice popup ---------------------------------
  // Popup ini tidak ikut Gist maintenance. Kalau overlay Gist aktif, popup tidak dibuka.
  const REVIEW_NOTICE_HIDE_KEY = "h4sx_review_notice_hidden_until";
  const REVIEW_NOTICE_HIDE_MS = 90 * 60 * 1000;
  let reviewNoticeTried = false;
  const reviewNoticePopup = document.getElementById("reviewNoticePopup");
  const reviewNoticeHideCheck = document.getElementById("reviewNoticeHideCheck");
  function reviewNoticeHidden() {
    try { return Date.now() < Number(localStorage.getItem(REVIEW_NOTICE_HIDE_KEY) || 0); }
    catch(e) { return false; }
  }
  function maintenanceOverlayActive() {
    return document.getElementById("shopClosedOverlay")?.classList.contains("active");
  }
  function openReviewNoticePopup() {
    return;
    if (reviewNoticeTried || !reviewNoticePopup || reviewNoticeHidden() || maintenanceOverlayActive()) return;
    reviewNoticeTried = true;
    reviewNoticePopup.classList.add("show");
    reviewNoticePopup.setAttribute("aria-hidden", "false");
  }
  function closeReviewNoticePopup(showMessage = false) {
    if (reviewNoticeHideCheck?.checked) {
      try { localStorage.setItem(REVIEW_NOTICE_HIDE_KEY, String(Date.now() + REVIEW_NOTICE_HIDE_MS)); } catch(e) {}
    }
    reviewNoticePopup?.classList.remove("show");
    reviewNoticePopup?.setAttribute("aria-hidden", "true");
    if (showMessage && reviewNoticeHideCheck?.checked) showToast("Notis disembunyikan selama 1 jam 30 minit.", "success");
  }
  document.getElementById("btnOkReviewNotice")?.addEventListener("click", () => closeReviewNoticePopup(true));
  document.getElementById("btnCloseReviewNotice")?.addEventListener("click", () => closeReviewNoticePopup(false));

  const mainReviewCard = document.querySelector(".main-card");
  const mobileReviewTabs = document.querySelectorAll("[data-mobile-review-tab]");
  const isMobileReviewLayout = () => window.matchMedia("(max-width: 859px)").matches;
  function setMobileReviewTab(tab = "form", shouldScroll = false) {
    const safeTab = tab === "reviews" ? "reviews" : "form";
    mainReviewCard?.setAttribute("data-mobile-tab", safeTab);
    mobileReviewTabs.forEach(btn => {
      const active = btn.dataset.mobileReviewTab === safeTab;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    if (shouldScroll && isMobileReviewLayout()) {
      const target = document.querySelector(".mobile-review-tabs") || mainReviewCard;
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  setMobileReviewTab("form");
  mobileReviewTabs.forEach(btn => {
    btn.addEventListener("click", () => setMobileReviewTab(btn.dataset.mobileReviewTab, true));
  });

  document.getElementById('btnScrollUlasan')?.addEventListener('click', () => {
    if (isMobileReviewLayout()) {
      setMobileReviewTab("reviews", true);
      return;
    }
    const sasaran = document.querySelector('.reviews-col-title') || document.getElementById('kotakPaparan');
    sasaran?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ── Admin gate ────────────────────────────────────────────────
  const ADMIN_UIDS = ["LWRN6IDv4OV1PZd7Vldgp6F9pdH3"];
  let currentUser = null;
  let latestCodeSnapshot = null;
  const adminOk = () => !!(currentUser && ADMIN_UIDS.includes(currentUser.uid));
  function mintaAdmin() {
    if (adminOk()) return true;
    bukaAdminLogin();
    return false;
  }
  
  function updateAdminUi() {
    const loggedIn = adminOk();
    if (btnLogoutAdmin) btnLogoutAdmin.style.display = loggedIn ? 'flex' : 'none';
    if (btnOpenAdminConfig) btnOpenAdminConfig.textContent = loggedIn ? '⚙️ Admin' : '🔐 Login Admin';
    document.querySelectorAll('[data-admin-ctrl-row]').forEach(row => {
      row.style.display = loggedIn ? 'flex' : 'none';
    });
  }
  function bukaAdminLogin() {
    adminLoginOverlayBg.classList.add('show');
    adminLoginModal.classList.add('show');
    setTimeout(() => adminLoginEmail.focus(), 50);
  }
  function tutupAdminLogin() {
    adminLoginOverlayBg.classList.remove('show');
    adminLoginModal.classList.remove('show');
    adminLoginPassword.value = '';
  }
  async function logoutAdmin() {
    await signOut(auth);
    showToast("Berjaya log keluar dari mod Admin.", "success");
  }
  window.logoutAdmin = logoutAdmin;

  // ── Shop Closed Status (Gist) ─────────────────────────────────
  const KEDAI_GIST_URL = 'https://gist.githubusercontent.com/amirpoyo1982-a11y/5ed3872290715d7833e788c7b0014f79/raw/kedai.json';
  const HARI_MS = ["ahad","isnin","selasa","rabu","khamis","jumaat","sabtu"];
  function flagOn(value) {
    return value === true || String(value).toLowerCase() === "true" || String(value).toLowerCase() === "on";
  }
  function flagOff(value) {
    return value === false || String(value).toLowerCase() === "false" || String(value).toLowerCase() === "close" || String(value).toLowerCase() === "off";
  }
  function isPreviewBypass() {
    const params = new URLSearchParams(window.location.search);
    return params.get("preview") === "1" || params.get("preview") === "true";
  }

  function semakDalamWaktu(bukaJam, tutupJam) {
    if (!bukaJam || !tutupJam) return true; // takde had waktu = anggap buka
    const now = new Date();
    const myTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kuala_Lumpur"}));
    const mins = myTime.getHours()*60 + myTime.getMinutes();
    const [bh,bm] = bukaJam.split(":").map(Number);
    const [th,tm] = tutupJam.split(":").map(Number);
    const bukaMins = bh*60 + (bm||0), tutupMins = th*60 + (tm||0);
    if (bukaMins === tutupMins) return true; // 24 jam
    if (bukaMins < tutupMins) {
      return mins >= bukaMins && mins < tutupMins;
    } else {
      // merentas tengah malam (cth: buka 09:00, tutup 04:00 esok)
      return mins >= bukaMins || mins < tutupMins;
    }
  }

  // ── Promo Banner From Kedai Gist ───────────────────────────────
  const reviewPromoShell = document.getElementById("reviewPromoShell");
  const reviewPromoViewport = document.getElementById("reviewPromoViewport");
  const reviewPromoTrack = document.getElementById("reviewPromoTrack");
  const reviewPromoDots = document.getElementById("reviewPromoDots");
  const reviewPromoPrev = document.getElementById("reviewPromoPrev");
  const reviewPromoNext = document.getElementById("reviewPromoNext");
  let reviewPromoItems = [];
  let reviewPromoIndex = 0;
  let reviewPromoTimer = null;
  let reviewPromoInterval = 5500;
  let reviewPromoDragStart = 0;
  let reviewPromoDragDelta = 0;
  let reviewPromoDragging = false;
  let reviewPromoDidDrag = false;

  function normalizePromoFit(value) {
    const fit = String(value || "").toLowerCase();
    return fit === "contain" || fit === "cover" ? fit : "cover";
  }

  function escapePromoAttr(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function getReviewPromoImage(item) {
    if (!item) return "";
    const isPhone = window.matchMedia("(max-width: 640px)").matches;
    return isPhone && item.mobileImg ? item.mobileImg : (item.img || item.image || "");
  }

  function stopReviewPromoAuto() {
    if (reviewPromoTimer) clearInterval(reviewPromoTimer);
    reviewPromoTimer = null;
  }

  function startReviewPromoAuto() {
    stopReviewPromoAuto();
    if (reviewPromoItems.length <= 1) return;
    reviewPromoTimer = setInterval(() => showReviewPromo(reviewPromoIndex + 1), reviewPromoInterval);
  }

  function showReviewPromo(nextIndex) {
    if (!reviewPromoTrack || !reviewPromoItems.length) return;
    reviewPromoIndex = (nextIndex + reviewPromoItems.length) % reviewPromoItems.length;
    reviewPromoTrack.style.transform = `translateX(-${reviewPromoIndex * 100}%)`;
    reviewPromoDots?.querySelectorAll("button").forEach((dot, index) => {
      dot.classList.toggle("active", index === reviewPromoIndex);
      dot.setAttribute("aria-current", index === reviewPromoIndex ? "true" : "false");
    });
  }

  function renderReviewPromoBanners(config = {}) {
    if (!reviewPromoShell || !reviewPromoTrack || !reviewPromoDots) return;
    const active = flagOn(config.promo_banner_active);
    const banners = Array.isArray(config.promo_banners) ? config.promo_banners.filter(item => getReviewPromoImage(item)) : [];
    reviewPromoItems = active ? banners : [];
    reviewPromoInterval = Math.max(2500, Number(config.promo_banner_interval) || 5500);
    reviewPromoIndex = 0;
    stopReviewPromoAuto();

    if (!reviewPromoItems.length) {
      reviewPromoShell.hidden = true;
      reviewPromoTrack.innerHTML = "";
      reviewPromoDots.innerHTML = "";
      return;
    }

    reviewPromoShell.hidden = false;
    reviewPromoTrack.innerHTML = reviewPromoItems.map((item, index) => {
      const img = getReviewPromoImage(item);
      const alt = escapePromoAttr(item.alt || item.title || "Promo H4SX Store");
      const fit = normalizePromoFit(item.fit);
      const pos = escapePromoAttr(item.position || "center center");
      const link = String(item.link || "").trim();
      const safeLink = escapePromoAttr(link);
      return `
        <a class="review-promo-slide${link ? " has-link" : ""}" data-promo-index="${index}" data-fit="${fit}" style="--promo-pos:${pos};" href="${safeLink || "#"}" aria-label="${alt}">
          <img src="${img}" alt="${alt}" loading="${index === 0 ? "eager" : "lazy"}" decoding="async" draggable="false">
        </a>
      `;
    }).join("");

    reviewPromoDots.innerHTML = reviewPromoItems.map((_, index) => (
      `<button type="button" aria-label="Banner ${index + 1}" data-promo-dot="${index}"></button>`
    )).join("");

    reviewPromoTrack.querySelectorAll(".review-promo-slide").forEach(slide => {
      slide.addEventListener("click", (event) => {
        const item = reviewPromoItems[Number(slide.dataset.promoIndex) || 0];
        if (reviewPromoDidDrag || !String(item?.link || "").trim()) {
          event.preventDefault();
        }
      });
    });
    reviewPromoDots.querySelectorAll("button").forEach(dot => {
      dot.addEventListener("click", () => {
        showReviewPromo(Number(dot.dataset.promoDot) || 0);
        startReviewPromoAuto();
      });
    });
    showReviewPromo(0);
    startReviewPromoAuto();
  }

  function moveReviewPromoBy(delta) {
    showReviewPromo(reviewPromoIndex + delta);
    startReviewPromoAuto();
  }

  reviewPromoPrev?.addEventListener("click", () => moveReviewPromoBy(-1));
  reviewPromoNext?.addEventListener("click", () => moveReviewPromoBy(1));
  reviewPromoViewport?.addEventListener("pointerdown", (event) => {
    if (reviewPromoItems.length <= 1) return;
    reviewPromoDragging = true;
    reviewPromoDidDrag = false;
    reviewPromoDragStart = event.clientX;
    reviewPromoDragDelta = 0;
    stopReviewPromoAuto();
  });
  reviewPromoViewport?.addEventListener("pointermove", (event) => {
    if (!reviewPromoDragging) return;
    reviewPromoDragDelta = event.clientX - reviewPromoDragStart;
    if (Math.abs(reviewPromoDragDelta) > 10) reviewPromoDidDrag = true;
  });
  reviewPromoViewport?.addEventListener("pointerup", () => {
    if (!reviewPromoDragging) return;
    reviewPromoDragging = false;
    if (Math.abs(reviewPromoDragDelta) > 42) showReviewPromo(reviewPromoIndex + (reviewPromoDragDelta < 0 ? 1 : -1));
    startReviewPromoAuto();
    setTimeout(() => {
      reviewPromoDragDelta = 0;
      reviewPromoDidDrag = false;
    }, 120);
  });
  reviewPromoViewport?.addEventListener("pointercancel", () => {
    reviewPromoDragging = false;
    reviewPromoDragDelta = 0;
    reviewPromoDidDrag = false;
    startReviewPromoAuto();
  });
  window.addEventListener("resize", () => {
    if (reviewPromoItems.length) renderReviewPromoBanners({ promo_banner_active: true, promo_banner_interval: reviewPromoInterval, promo_banners: reviewPromoItems });
  });

  function paparKedaiTutup(icon, tajuk, mesej, jamTeks) {
    const iconEl = document.querySelector('.shop-closed-icon');
    if (iconEl) iconEl.textContent = icon;
    document.querySelector('.shop-closed-title').textContent = tajuk;
    document.getElementById('shopClosedMsg').textContent = mesej;
    const overlayEl = document.getElementById('shopClosedOverlay');
    const type = /luar waktu/i.test(tajuk) ? 'hours' : (/(penyelenggaraan|selenggara|maintenance|maintain|update)/i.test(tajuk) ? 'maintenance' : 'closed');
    overlayEl?.setAttribute('data-closed-type', type);
    const timeEl = document.getElementById('shopClosedTime');
    if (jamTeks) {
      timeEl.textContent = '⏱ ' + jamTeks.replace(/\s*\|\s*$/, '');
      timeEl.style.display = 'inline-block';
    } else {
      timeEl.style.display = 'none';
    }
    overlayEl?.classList.add('active');
  }

  async function semakStatusKedai() {
    if (isPreviewBypass()) {
      document.getElementById('shopClosedOverlay').classList.remove('active');
      return;
    }
    try {
      const res = await fetch(KEDAI_GIST_URL + '?t=' + Date.now(), { cache: "no-store" });
      const data = await res.json();
      renderReviewPromoBanners(data);

      // 1. Maintenance khas untuk page ulasan sahaja.
      if (data && (
        flagOn(data.review_maintenance) ||
        flagOn(data.maintenance_review) ||
        flagOn(data.ulasan_maintenance) ||
        flagOn(data.reviews_maintenance)
      )) {
        paparKedaiTutup(
          '🔧',
          data.review_maintenance_title || 'Ulasan Dalam Penyelenggaraan',
          data.review_maintenance_message || data.review_maintenance_msg || 'Sistem ulasan sedang diproses dan dikemas semula. Kemungkinan besar feature ulasan akan berfungsi kembali dalam sekitar 2 hari lagi.',
          data.business_hours_text
        );
        return;
      }

      // 2. Mod penyelenggaraan global — untuk tutup semua website kalau perlu.
      if (data && flagOn(data.maintenance)) {
        paparKedaiTutup('🛠️', 'Dalam Penyelenggaraan', 'Kedai sedang dalam penyelenggaraan buat masa ini. Sila cuba lagi sebentar lagi.', data.business_hours_text);
        return;
      }

      // 3. Suis manual admin — bukakedai:false = tutup terus, tak kira jam
      if (data && flagOff(data.bukakedai)) {
        paparKedaiTutup('🚫', 'Kedai Ditutup Sementara', 'Kami sedang berehat. Sila kembali kemudian.', data.business_hours_text);
        return;
      }

      // 4. Hari cuti (tutup_hari)
      const hariIni = HARI_MS[new Date().getDay()];
      if (data && Array.isArray(data.tutup_hari) && data.tutup_hari.some(h => (h||"").toLowerCase() === hariIni)) {
        paparKedaiTutup('📅', 'Kedai Tutup Hari Ini', 'Kami tidak beroperasi pada hari ini.', data.business_hours_text);
        return;
      }

      // 5. Di luar waktu operasi (buka_jam / tutup_jam)
      if (data && !semakDalamWaktu(data.buka_jam, data.tutup_jam)) {
        paparKedaiTutup('🕐', 'Di Luar Waktu Operasi', 'Kami sedang tutup buat masa ini. Sila kembali semasa waktu operasi kami.', data.business_hours_text);
        return;
      }

      // Semua ok — kedai buka
      document.getElementById('shopClosedOverlay').classList.remove('active');
    } catch (e) {
      console.log('Gagal semak status kedai', e);
    }
  }
  semakStatusKedai();
  setInterval(semakStatusKedai, 60000); // Semak setiap 1 minit

  // ── Announcement Bar (Firebase) ───────────────────────────────
  const topAnnounceEl = document.getElementById('topAnnouncement');
  const announceTextWrap = document.getElementById('announcementTextWrap');
  const announcementTitle = document.getElementById('announcementTitle');
  const announcementFullText = document.getElementById('announcementFullText');
  const announcementToggle = document.getElementById('announcementToggle');
  function renderAnnouncementText(text) {
    if (!topAnnounceEl || !announceTextWrap || !announcementTitle || !announcementFullText || !announcementToggle) return;
    const clean = (text || "").trim();
    if (!clean) {
      topAnnounceEl.classList.remove('show', 'expanded');
      return;
    }
    const parts = clean.split(/\n+/).map(line => line.trim()).filter(Boolean);
    const title = parts.length > 1 ? parts[0] : 'Pengumuman H4SX STORE';
    const body = parts.length > 1 ? parts.slice(1).join('\n\n') : parts[0];
    announcementTitle.textContent = title;
    announceTextWrap.textContent = body.length > 140 ? body.slice(0, 140).trim() + '...' : body;
    announcementFullText.textContent = body;
    topAnnounceEl.classList.remove('expanded');
    announcementToggle.textContent = 'Baca';
    announcementToggle.style.display = body.length > 140 || parts.length > 1 ? 'inline-flex' : 'none';
    topAnnounceEl.classList.add('show');
  }
  announcementToggle?.addEventListener('click', () => {
    const expanded = topAnnounceEl.classList.toggle('expanded');
    announcementToggle.textContent = expanded ? 'Tutup' : 'Baca';
  });
  if (topAnnounceEl) {
    onSnapshot(doc(db, "config", "announcement"), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        renderAnnouncementText(d.text);
      } else {
        topAnnounceEl.classList.remove('show', 'expanded');
      }
    });
  }

  // -- Custom Badge Editor (Admin) ---------------------------------
  const badgeOverlayBg       = document.getElementById('badgeOverlayBg');
  const badgePanelModal      = document.getElementById('badgePanelModal');
  const badgeTextInput       = document.getElementById('badgeTextInput');
  const badgeColorInput      = document.getElementById('badgeColorInput');
  const badgeColorInput2     = document.getElementById('badgeColorInput2');
  const badgeTextColorInput  = document.getElementById('badgeTextColorInput');
  const badgeGlowColorInput  = document.getElementById('badgeGlowColorInput');
  const badgeGradientToggle  = document.getElementById('badgeGradientToggle');
  const badgeAnimatedToggle  = document.getElementById('badgeAnimatedToggle');
  const badgeLivePreview     = document.getElementById('badgeLivePreview');
  const btnSaveBadge         = document.getElementById('btnSaveBadge');
  const btnApplyBadgeAll     = document.getElementById('btnApplyBadgeAll');
  const btnRemoveBadge       = document.getElementById('btnRemoveBadge');
  const btnCancelBadge       = document.getElementById('btnCancelBadge');
  let editingBadgeId = null;

  function warnaHexSah(nilai, fallback) {
    return /^#[0-9a-f]{6}$/i.test(nilai || '') ? nilai : fallback;
  }
  function badgeStyle(data = {}) {
    const c1 = warnaHexSah(data.badgeColor, '#2fa8e0');
    const c2 = warnaHexSah(data.badgeColor2, '#7c3aed');
    const text = warnaHexSah(data.badgeTextColor, '#ffffff');
    const glow = warnaHexSah(data.badgeGlowColor, c1);
    const gradient = data.badgeGradient !== false;
    const bg = gradient ? `linear-gradient(120deg, ${c1}, ${c2}, ${c1})` : c1;
    return `background:${bg}; color:${text}; --badge-glow:${glow}; box-shadow:0 4px 16px -8px ${glow}, inset 0 1px 0 rgba(255,255,255,.26); border:none;`;
  }
  function medalStyle(data = {}) {
    const c1 = warnaHexSah(data.medalColor, '#f0a500');
    const c2 = warnaHexSah(data.medalColor2, '#e05252');
    const text = warnaHexSah(data.medalTextColor, '#ffffff');
    const glow = warnaHexSah(data.medalGlowColor, c1);
    const gradient = data.medalGradient !== false;
    const outline = data.medalOutline === true;
    const bg = gradient ? `linear-gradient(120deg, ${c1}, ${c2}, ${c1})` : c1;
    const border = outline ? `1.5px solid ${glow}` : '1px solid rgba(255,255,255,.48)';
    return `background:${bg}; color:${text}; --medal-glow:${glow}; border:${border}; box-shadow:0 5px 18px -9px ${glow}, inset 0 1px 0 rgba(255,255,255,.28);`;
  }
  function nameStyle(data = {}, isReviewAdmin = false) {
    if (data.nameColorEnabled !== true) {
      return isReviewAdmin ? 'color: var(--accent);' : '';
    }
    const c1 = warnaHexSah(data.nameColor, '#2fa8e0');
    const c2 = warnaHexSah(data.nameColor2, '#7c3aed');
    const glow = warnaHexSah(data.nameGlowColor, c1);
    const weight = ['700','800','900'].includes(String(data.nameWeight)) ? String(data.nameWeight) : '800';
    const gradient = data.nameGradient !== false;
    const base = `font-weight:${weight}; text-shadow:0 2px 12px ${glow}55;`;
    if (!gradient) return `${base} color:${c1};`;
    return `${base} color:${c1}; background:linear-gradient(120deg, ${c1}, ${c2}, ${c1}); background-size:230% 230%; -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;`;
  }
  function nameClass(data = {}) {
    return 'buyer-name custom-name' + (data.nameColorEnabled === true && data.nameAnimated !== false && data.nameGradient !== false ? ' is-animated' : '');
  }
  function medalMarkup(data = {}) {
    const teks = (data.medalText || '').trim();
    if (!teks) return '';
    const shape = ['pill','shield','round','ticket'].includes(data.medalShape) ? data.medalShape : 'pill';
    const size = ['sm','md','lg'].includes(data.medalSize) ? data.medalSize : 'sm';
    const animated = data.medalAnimated === false ? '' : ' is-animated';
    return `<span class="medal-badge medal-${shape} medal-${size}${animated}" style="${medalStyle(data)}">${escapeHtml(teks)}</span>`;
  }
  function bukaBadgeModal(id, teksSedia, warnaSedia, warnaTextSedia, warnaKeduaSedia, gradientSedia, animasiSedia, glowSedia) {
    editingBadgeId = id;
    badgeTextInput.value = teksSedia || '';
    badgeColorInput.value = warnaHexSah(warnaSedia, '#2fa8e0');
    badgeColorInput2.value = warnaHexSah(warnaKeduaSedia, '#7c3aed');
    badgeTextColorInput.value = warnaHexSah(warnaTextSedia, '#ffffff');
    badgeGlowColorInput.value = warnaHexSah(glowSedia, warnaHexSah(warnaSedia, '#2fa8e0'));
    badgeGradientToggle.checked = gradientSedia !== false;
    badgeAnimatedToggle.checked = animasiSedia !== false;
    kemaskiniBadgePreview();
    badgeOverlayBg.classList.add('show');
    badgePanelModal.classList.add('show');
    badgeTextInput.focus();
  }
  function tutupBadgeModal() {
    badgeOverlayBg.classList.remove('show');
    badgePanelModal.classList.remove('show');
    editingBadgeId = null;
  }
  function kemaskiniBadgePreview() {
    const teks = badgeTextInput.value.trim() || 'Preview';
    badgeLivePreview.textContent = teks;
    badgeLivePreview.className = 'verified-badge custom-badge' + (badgeAnimatedToggle.checked ? ' is-animated' : '');
    badgeLivePreview.style.cssText = badgeStyle({
      badgeColor: badgeColorInput.value,
      badgeColor2: badgeColorInput2.value,
      badgeTextColor: badgeTextColorInput.value,
      badgeGlowColor: badgeGlowColorInput.value,
      badgeGradient: badgeGradientToggle.checked
    });
  }
  [badgeTextInput, badgeColorInput, badgeColorInput2, badgeTextColorInput, badgeGlowColorInput, badgeGradientToggle, badgeAnimatedToggle]
    .forEach(el => el.addEventListener('input', kemaskiniBadgePreview));
  badgeOverlayBg.addEventListener('click', tutupBadgeModal);
  btnCancelBadge.addEventListener('click', tutupBadgeModal);

  const blockedReviewNamePatterns = [
    /^(anjing|babi|sial|bodoh|bangang|bangsat|celaka|laknat)+$/,
    /(pukimak|kimak|puki|butoh|butuh|kontol|memek|lancau|lanjiao|cibai|jibai|pundek)/,
    /(fuck|fucker|shit|bitch|asshole|dick|pussy)/,
    /(nigger|nigga|keling)/
  ];

  function normalizeReviewNameText(value = "") {
    return String(value)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[@4]/g, "a")
      .replace(/[!1|]/g, "i")
      .replace(/0/g, "o")
      .replace(/3/g, "e")
      .replace(/[$5]/g, "s")
      .replace(/7/g, "t")
      .replace(/[^a-z0-9]/g, "");
  }

  function isBlockedReviewName(name = "") {
    const clean = normalizeReviewNameText(name);
    if (!clean) return false;
    return blockedReviewNamePatterns.some(pattern => pattern.test(clean));
  }

  function cleanReplyName(name = "") {
    const clean = String(name || "pelanggan").replace(/\s+/g, " ").trim();
    return clean.slice(0, 40) || "pelanggan";
  }

  function buildAutoReply(name = "") {
    const replyName = cleanReplyName(name);
    return `Terima kasih, ${replyName}! Kami hargai masa anda memberi ulasan kepada H4SX STORE. Sokongan anda membantu pelanggan lain lebih yakin, dan kami akan terus perbaiki servis supaya pengalaman anda lebih kemas, laju dan selamat. 🙏💙`;
  }

  function withAutoReply(payload, dataDoc = {}) {
    const next = { ...payload };
    if (!dataDoc.balasanAdmin?.trim()) {
      next.balasanAdmin = buildAutoReply(dataDoc.nama || payload.nama);
      next.balasanPada = serverTimestamp();
    }
    return next;
  }

  const bulkSelectOverlayBg = document.getElementById('bulkSelectOverlayBg');
  const bulkSelectModal = document.getElementById('bulkSelectModal');
  const bulkSelectTitle = document.getElementById('bulkSelectTitle');
  const bulkReviewList = document.getElementById('bulkReviewList');
  const bulkSelectedCount = document.getElementById('bulkSelectedCount');
  const btnBulkSelectAll = document.getElementById('btnBulkSelectAll');
  const btnBulkClearAll = document.getElementById('btnBulkClearAll');
  const btnBulkConfirm = document.getElementById('btnBulkConfirm');
  const btnBulkCancel = document.getElementById('btnBulkCancel');
  let bulkAction = null;

  function bulkCheckedDocs() {
    const ids = [...bulkReviewList.querySelectorAll('.bulk-review-check:checked')].map(input => input.value);
    return allDocs.filter(item => ids.includes(item.id));
  }

  function updateBulkSelectedCount() {
    const jumlah = bulkReviewList.querySelectorAll('.bulk-review-check:checked').length;
    bulkSelectedCount.textContent = `${jumlah} dipilih`;
    btnBulkConfirm.disabled = jumlah === 0;
  }

  function tutupBulkSelect() {
    bulkSelectOverlayBg.classList.remove('show');
    bulkSelectModal.classList.remove('show');
    bulkAction = null;
    bulkReviewList.innerHTML = '';
  }

  function bukaBulkSelect({ title, confirmText, danger = false, onConfirm }) {
    if (!adminOk()) { bukaAdminLogin(); return; }
    if (!allDocs.length) { showToast("Tiada ulasan untuk dipilih.", "error"); return; }
    bulkAction = { onConfirm, danger };
    bulkSelectTitle.textContent = title;
    btnBulkConfirm.textContent = confirmText || 'Teruskan';
    btnBulkConfirm.classList.toggle('bulk-confirm-danger', danger);
    bulkReviewList.innerHTML = allDocs.map(data => {
      const nama = escapeHtml(data.nama || 'Pelanggan Misteri');
      const bintang = clampBintang(data.bintang);
      const masa = reviewDateText(data);
      const badge = data.badgeText?.trim() ? `<span class="bulk-mini-badge">${escapeHtml(data.badgeText)}</span>` : '';
      return `
        <label class="bulk-review-item">
          <input class="bulk-review-check" type="checkbox" value="${escapeHtml(data.id)}">
          <span class="bulk-review-main">
            <strong>${nama}</strong>
            <small>${'★'.repeat(bintang)}${'☆'.repeat(5-bintang)} · ${escapeHtml(masa)}</small>
          </span>
          ${badge}
        </label>`;
    }).join('');
    bulkReviewList.querySelectorAll('.bulk-review-check').forEach(input => {
      input.addEventListener('change', updateBulkSelectedCount);
    });
    updateBulkSelectedCount();
    bulkSelectOverlayBg.classList.add('show');
    bulkSelectModal.classList.add('show');
  }

  async function applyPayloadPilihan(basePayload, label, closeModalFn) {
    bukaBulkSelect({
      title: `Pilih ulasan untuk ${label}`,
      confirmText: `Apply ${label}`,
      onConfirm: async (selectedDocs) => {
        const tasks = selectedDocs.map(dataDoc => updateDoc(doc(db, "ratings", dataDoc.id), withAutoReply(basePayload, dataDoc)));
        await Promise.all(tasks);
        showToast(`${label} berjaya untuk ${selectedDocs.length} ulasan.`, "success");
        closeModalFn?.();
      }
    });
  }

  async function deletePilihan() {
    bukaBulkSelect({
      title: 'Pilih ulasan untuk delete',
      confirmText: 'Delete Pilihan',
      danger: true,
      onConfirm: async (selectedDocs) => {
        if (!confirm(`Padam ${selectedDocs.length} ulasan yang dipilih? Tindakan ni tak boleh diundur.`)) return false;
        await Promise.all(selectedDocs.map(dataDoc => deleteDoc(doc(db, "ratings", dataDoc.id))));
        showToast(`${selectedDocs.length} ulasan berjaya dipadam.`, "success");
      }
    });
  }

  btnBulkSelectAll.addEventListener('click', () => {
    bulkReviewList.querySelectorAll('.bulk-review-check').forEach(input => input.checked = true);
    updateBulkSelectedCount();
  });
  btnBulkClearAll.addEventListener('click', () => {
    bulkReviewList.querySelectorAll('.bulk-review-check').forEach(input => input.checked = false);
    updateBulkSelectedCount();
  });
  btnBulkCancel.addEventListener('click', tutupBulkSelect);
  bulkSelectOverlayBg.addEventListener('click', tutupBulkSelect);
  btnBulkConfirm.addEventListener('click', async () => {
    if (!bulkAction) return;
    const selectedDocs = bulkCheckedDocs();
    if (!selectedDocs.length) { showToast("Tick sekurang-kurangnya satu ulasan.", "error"); return; }
    btnBulkConfirm.disabled = true;
    const asalText = btnBulkConfirm.textContent;
    btnBulkConfirm.textContent = bulkAction.danger ? 'Memadam...' : 'Mengemaskini...';
    try {
      const result = await bulkAction.onConfirm(selectedDocs);
      if (result === false) {
        btnBulkConfirm.disabled = false;
        btnBulkConfirm.textContent = asalText;
        updateBulkSelectedCount();
        return;
      }
      tutupBulkSelect();
    } catch (err) {
      console.error(err);
      showToast("Gagal proses pilihan. Semak Firestore rules.", "error");
      btnBulkConfirm.disabled = false;
      btnBulkConfirm.textContent = asalText;
    }
  });

  function getBadgePayloadFromInputs() {
    const teks = badgeTextInput.value.trim();
    if (!teks) return null;
    return {
      badgeText: teks,
      badgeColor: badgeColorInput.value,
      badgeColor2: badgeColorInput2.value,
      badgeTextColor: badgeTextColorInput.value,
      badgeGlowColor: badgeGlowColorInput.value,
      badgeGradient: badgeGradientToggle.checked,
      badgeAnimated: badgeAnimatedToggle.checked
    };
  }

  async function simpanBadgePayload(payload, mesejBerjaya, dataDoc) {
    if (!editingBadgeId) return;
    try {
      // Rules 'update' wajibkan balasanAdmin sentiasa string sah - isi auto-reply
      // dulu kalau ulasan ni belum pernah dapat balasan.
      await updateDoc(doc(db,"ratings",editingBadgeId), withAutoReply(payload, dataDoc));
      showToast(mesejBerjaya, "success");
      tutupBadgeModal();
    } catch(err) {
      console.error(err);
      showToast("Gagal kemaskini badge.", "error");
    }
  }
  btnSaveBadge.addEventListener('click', () => {
    const payload = getBadgePayloadFromInputs();
    if (!payload) { showToast("Taip teks badge dulu, atau guna 'Buang Badge'.", "error"); return; }
    const dataDoc = allDocs.find(d=>d.id===editingBadgeId) || {};
    simpanBadgePayload(payload, "Badge berjaya disimpan!", dataDoc);
  });
  btnApplyBadgeAll.addEventListener('click', () => {
    const payload = getBadgePayloadFromInputs();
    if (!payload) { showToast("Taip teks role dulu sebelum apply semua.", "error"); return; }
    applyPayloadPilihan(payload, "Role", tutupBadgeModal);
  });
  btnRemoveBadge.addEventListener('click', () => {
    const dataDoc = allDocs.find(d=>d.id===editingBadgeId) || {};
    simpanBadgePayload({
      badgeText: null,
      badgeColor: null,
      badgeColor2: null,
      badgeTextColor: null,
      badgeGlowColor: null,
      badgeGradient: null,
      badgeAnimated: null
    }, "Badge dibuang, kembali ke default.", dataDoc);
  });

  // -- Customer Profile Editor (Admin) ----------------------------
  const customerOverlayBg = document.getElementById('customerOverlayBg');
  const customerPanelModal = document.getElementById('customerPanelModal');
  const customerNameInput = document.getElementById('customerNameInput');
  const customerColorInput = document.getElementById('customerColorInput');
  const customerEmojiInput = document.getElementById('customerEmojiInput');
  const customerAvatarPreview = document.getElementById('customerAvatarPreview');
  const customerAvatarText = document.getElementById('customerAvatarText');
  const customerNamePreview = document.getElementById('customerNamePreview');
  const nameColorEnabledToggle = document.getElementById('nameColorEnabledToggle');
  const nameColorInput = document.getElementById('nameColorInput');
  const nameColor2Input = document.getElementById('nameColor2Input');
  const nameGlowColorInput = document.getElementById('nameGlowColorInput');
  const nameGradientToggle = document.getElementById('nameGradientToggle');
  const nameAnimatedToggle = document.getElementById('nameAnimatedToggle');
  const nameWeightSelect = document.getElementById('nameWeightSelect');
  const customerMedalPreview = document.getElementById('customerMedalPreview');
  const medalLivePreview = document.getElementById('medalLivePreview');
  const medalTextInput = document.getElementById('medalTextInput');
  const medalColorInput = document.getElementById('medalColorInput');
  const medalColor2Input = document.getElementById('medalColor2Input');
  const medalTextColorInput = document.getElementById('medalTextColorInput');
  const medalGlowColorInput = document.getElementById('medalGlowColorInput');
  const medalShapeSelect = document.getElementById('medalShapeSelect');
  const medalSizeSelect = document.getElementById('medalSizeSelect');
  const medalGradientToggle = document.getElementById('medalGradientToggle');
  const medalAnimatedToggle = document.getElementById('medalAnimatedToggle');
  const medalOutlineToggle = document.getElementById('medalOutlineToggle');
  const reviewCollapseToggle = document.getElementById('reviewCollapseToggle');
  const reviewCollapseDefaultOpenToggle = document.getElementById('reviewCollapseDefaultOpenToggle');
  const reviewCollapseLinesSelect = document.getElementById('reviewCollapseLinesSelect');
  const reviewToggleColorInput = document.getElementById('reviewToggleColorInput');
  const reviewExpandLabelInput = document.getElementById('reviewExpandLabelInput');
  const reviewCollapseLabelInput = document.getElementById('reviewCollapseLabelInput');
  const btnSuggestCustomerProfile = document.getElementById('btnSuggestCustomerProfile');
  const btnRemoveCustomerImage = document.getElementById('btnRemoveCustomerImage');
  const btnSaveCustomer = document.getElementById('btnSaveCustomer');
  const btnApplyNameAll = document.getElementById('btnApplyNameAll');
  const btnApplyMedalAll = document.getElementById('btnApplyMedalAll');
  const btnRemoveNameColor = document.getElementById('btnRemoveNameColor');
  const btnRemoveMedal = document.getElementById('btnRemoveMedal');
  const btnCancelCustomer = document.getElementById('btnCancelCustomer');
  const profileSuggestions = [
    { warna:'#2fa8e0', emoji:'H' }, { warna:'#22c47a', emoji:'V' },
    { warna:'#7c3aed', emoji:'S' }, { warna:'#f0a500', emoji:'P' },
    { warna:'#ef5da8', emoji:'A' }, { warna:'#14b8a6', emoji:'Z' },
    { warna:'#0f2a45', emoji:'X' }, { warna:'#e05252', emoji:'M' }
  ];
  const medalPresets = {
    staff: { text:'STAFF', c1:'#2fa8e0', c2:'#22c47a', textColor:'#ffffff', glow:'#2fa8e0', shape:'pill', size:'sm', gradient:true, animated:true, outline:false },
    vip: { text:'VIP', c1:'#7c3aed', c2:'#ef5da8', textColor:'#ffffff', glow:'#7c3aed', shape:'shield', size:'md', gradient:true, animated:true, outline:false },
    top: { text:'#1', c1:'#f0a500', c2:'#e05252', textColor:'#ffffff', glow:'#f0a500', shape:'round', size:'md', gradient:true, animated:true, outline:false },
    og: { text:'OLD', c1:'#0f2a45', c2:'#2fa8e0', textColor:'#ffffff', glow:'#2fa8e0', shape:'ticket', size:'sm', gradient:true, animated:false, outline:true },
    trusted: { text:'TRUSTED', c1:'#22c47a', c2:'#14b8a6', textColor:'#ffffff', glow:'#22c47a', shape:'pill', size:'md', gradient:true, animated:true, outline:false },
    buyer: { text:'BUYER', c1:'#38bdf8', c2:'#2563eb', textColor:'#ffffff', glow:'#38bdf8', shape:'pill', size:'sm', gradient:true, animated:true, outline:false },
    legend: { text:'LEGEND', c1:'#f59e0b', c2:'#7c2d12', textColor:'#fff7ed', glow:'#f59e0b', shape:'shield', size:'lg', gradient:true, animated:true, outline:false },
    fast: { text:'FAST', c1:'#f97316', c2:'#ef4444', textColor:'#ffffff', glow:'#fb923c', shape:'ticket', size:'sm', gradient:true, animated:true, outline:false },
    safe: { text:'SAFE', c1:'#10b981', c2:'#0f766e', textColor:'#ffffff', glow:'#34d399', shape:'shield', size:'sm', gradient:true, animated:false, outline:true },
    rare: { text:'RARE', c1:'#ec4899', c2:'#8b5cf6', textColor:'#ffffff', glow:'#ec4899', shape:'round', size:'md', gradient:true, animated:true, outline:false },
    pro: { text:'PRO', c1:'#111827', c2:'#475569', textColor:'#ffffff', glow:'#64748b', shape:'pill', size:'sm', gradient:true, animated:false, outline:true },
    local: { text:'LOCAL', c1:'#06b6d4', c2:'#22c55e', textColor:'#ffffff', glow:'#06b6d4', shape:'ticket', size:'md', gradient:true, animated:true, outline:false },
    king: { text:'KING', c1:'#eab308', c2:'#ca8a04', textColor:'#ffffff', glow:'#facc15', shape:'shield', size:'md', gradient:true, animated:true, outline:true },
    new: { text:'NEW', c1:'#3b82f6', c2:'#60a5fa', textColor:'#ffffff', glow:'#60a5fa', shape:'round', size:'sm', gradient:true, animated:true, outline:false },
    oldsupport: { text:'OLD SUPPORT', c1:'#0f2a45', c2:'#f0a500', textColor:'#ffffff', glow:'#f0a500', shape:'ticket', size:'lg', gradient:true, animated:false, outline:true }
  };
  let editingCustomerId = null;
  let removeCustomerImage = false;

  function kemaskiniCustomerPreview() {
    const nama = customerNameInput.value.trim() || 'Pelanggan';
    const warna = warnaHexSah(customerColorInput.value, warnaAuto(nama));
    const avatar = (customerEmojiInput.value.trim() || nama.charAt(0) || 'H').slice(0, 4).toUpperCase();
    const medalText = medalTextInput.value.trim();
    const medalPreviewText = medalText || 'Preview';
    const medalClass = `medal-badge medal-${medalShapeSelect.value} medal-${medalSizeSelect.value}${medalAnimatedToggle.checked ? ' is-animated' : ''}`;
    const medalCss = medalStyle({
      medalColor: medalColorInput.value,
      medalColor2: medalColor2Input.value,
      medalTextColor: medalTextColorInput.value,
      medalGlowColor: medalGlowColorInput.value,
      medalGradient: medalGradientToggle.checked,
      medalOutline: medalOutlineToggle.checked
    });
    customerAvatarPreview.style.background = warna;
    customerAvatarText.textContent = avatar;
    customerNamePreview.textContent = nama;
    customerNamePreview.className = nameClass({
      nameColorEnabled: nameColorEnabledToggle.checked,
      nameAnimated: nameAnimatedToggle.checked,
      nameGradient: nameGradientToggle.checked
    });
    customerNamePreview.style.cssText = nameStyle({
      nameColorEnabled: nameColorEnabledToggle.checked,
      nameColor: nameColorInput.value,
      nameColor2: nameColor2Input.value,
      nameGlowColor: nameGlowColorInput.value,
      nameGradient: nameGradientToggle.checked,
      nameAnimated: nameAnimatedToggle.checked,
      nameWeight: nameWeightSelect.value
    });
    customerMedalPreview.textContent = medalPreviewText;
    customerMedalPreview.className = medalClass;
    customerMedalPreview.style.cssText = medalCss;
    customerMedalPreview.style.display = medalText ? 'inline-flex' : 'none';
    medalLivePreview.textContent = medalPreviewText;
    medalLivePreview.className = medalClass;
    medalLivePreview.style.cssText = medalCss;
  }

  function bukaCustomerModal(id, data = {}) {
    const nama = data.nama || 'Pelanggan';
    editingCustomerId = id;
    removeCustomerImage = false;
    customerNameInput.value = nama;
    customerColorInput.value = warnaHexSah(data.warnaProfil, warnaAuto(nama));
    customerEmojiInput.value = data.emojiProfil || nama.charAt(0).toUpperCase();
    nameColorEnabledToggle.checked = data.nameColorEnabled === true;
    nameColorInput.value = warnaHexSah(data.nameColor, '#2fa8e0');
    nameColor2Input.value = warnaHexSah(data.nameColor2, '#7c3aed');
    nameGlowColorInput.value = warnaHexSah(data.nameGlowColor, warnaHexSah(data.nameColor, '#2fa8e0'));
    nameGradientToggle.checked = data.nameGradient !== false;
    nameAnimatedToggle.checked = data.nameAnimated !== false;
    nameWeightSelect.value = ['700','800','900'].includes(String(data.nameWeight)) ? String(data.nameWeight) : '800';
    medalTextInput.value = data.medalText || '';
    medalColorInput.value = warnaHexSah(data.medalColor, '#f0a500');
    medalColor2Input.value = warnaHexSah(data.medalColor2, '#e05252');
    medalTextColorInput.value = warnaHexSah(data.medalTextColor, '#ffffff');
    medalGlowColorInput.value = warnaHexSah(data.medalGlowColor, warnaHexSah(data.medalColor, '#f0a500'));
    medalShapeSelect.value = ['pill','shield','round','ticket'].includes(data.medalShape) ? data.medalShape : 'pill';
    medalSizeSelect.value = ['sm','md','lg'].includes(data.medalSize) ? data.medalSize : 'sm';
    medalGradientToggle.checked = data.medalGradient !== false;
    medalAnimatedToggle.checked = data.medalAnimated !== false;
    medalOutlineToggle.checked = data.medalOutline === true;
    reviewCollapseToggle.checked = data.reviewTextCollapsed === true;
    reviewCollapseDefaultOpenToggle.checked = data.reviewTextDefaultOpen === true;
    reviewCollapseLinesSelect.value = String(Math.min(6, Math.max(2, parseInt(data.reviewTextLines) || 4)));
    reviewToggleColorInput.value = warnaHexSah(data.reviewToggleColor, '#2fa8e0');
    reviewExpandLabelInput.value = data.reviewExpandLabel || 'Lihat lagi ↓';
    reviewCollapseLabelInput.value = data.reviewCollapseLabel || 'Tutup ↑';
    btnRemoveCustomerImage.disabled = !data.profileImg;
    btnRemoveCustomerImage.textContent = data.profileImg ? 'Buang Gambar Profil' : 'Tiada Gambar Profil';
    kemaskiniCustomerPreview();
    customerOverlayBg.classList.add('show');
    customerPanelModal.classList.add('show');
    setTimeout(() => customerNameInput.focus(), 50);
  }

  function tutupCustomerModal() {
    customerOverlayBg.classList.remove('show');
    customerPanelModal.classList.remove('show');
    editingCustomerId = null;
    removeCustomerImage = false;
  }

  async function simpanCustomerPayload(payload, mesejBerjaya, dataDoc) {
    if (!editingCustomerId) return;
    try {
      await updateDoc(doc(db, "ratings", editingCustomerId), withAutoReply(payload, dataDoc));
      showToast(mesejBerjaya, "success");
      tutupCustomerModal();
    } catch (err) {
      console.error(err);
      showToast("Gagal kemaskini pelanggan.", "error");
    }
  }

  [customerNameInput, customerColorInput, customerEmojiInput, nameColorEnabledToggle, nameColorInput, nameColor2Input, nameGlowColorInput, nameGradientToggle, nameAnimatedToggle, nameWeightSelect, medalTextInput, medalColorInput, medalColor2Input, medalTextColorInput, medalGlowColorInput, medalShapeSelect, medalSizeSelect, medalGradientToggle, medalAnimatedToggle, medalOutlineToggle]
    .forEach(el => {
      el.addEventListener('input', kemaskiniCustomerPreview);
      el.addEventListener('change', kemaskiniCustomerPreview);
    });
  document.querySelectorAll('[data-medal-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = medalPresets[btn.dataset.medalPreset];
      if (!preset) return;
      medalTextInput.value = preset.text;
      medalColorInput.value = preset.c1;
      medalColor2Input.value = preset.c2;
      medalTextColorInput.value = preset.textColor;
      medalGlowColorInput.value = preset.glow;
      medalShapeSelect.value = preset.shape;
      medalSizeSelect.value = preset.size;
      medalGradientToggle.checked = preset.gradient;
      medalAnimatedToggle.checked = preset.animated;
      medalOutlineToggle.checked = preset.outline;
      kemaskiniCustomerPreview();
    });
  });
  customerOverlayBg.addEventListener('click', tutupCustomerModal);
  btnCancelCustomer.addEventListener('click', tutupCustomerModal);
  btnSuggestCustomerProfile.addEventListener('click', () => {
    const nama = customerNameInput.value.trim() || 'Pelanggan';
    const pilihan = profileSuggestions[Math.floor(Math.random() * profileSuggestions.length)];
    customerColorInput.value = pilihan.warna;
    customerEmojiInput.value = nama.charAt(0).toUpperCase() || pilihan.emoji;
    removeCustomerImage = true;
    btnRemoveCustomerImage.disabled = false;
    btnRemoveCustomerImage.textContent = 'Gambar akan dibuang';
    kemaskiniCustomerPreview();
  });
  btnRemoveCustomerImage.addEventListener('click', () => {
    removeCustomerImage = true;
    btnRemoveCustomerImage.disabled = false;
    btnRemoveCustomerImage.textContent = 'Gambar akan dibuang';
    kemaskiniCustomerPreview();
  });
  btnSaveCustomer.addEventListener('click', () => {
    const nama = customerNameInput.value.trim();
    if (nama.length < 1 || nama.length > 40) {
      showToast("Nama pelanggan mesti 1 hingga 40 aksara.", "error");
      return;
    }
    const emoji = customerEmojiInput.value.trim();
    const medal = medalTextInput.value.trim();
    const dataDoc = allDocs.find(d => d.id === editingCustomerId) || {};
    const payload = {
      nama,
      warnaProfil: customerColorInput.value,
      emojiProfil: emoji || null,
      nameColorEnabled: nameColorEnabledToggle.checked,
      nameColor: nameColorEnabledToggle.checked ? nameColorInput.value : null,
      nameColor2: nameColorEnabledToggle.checked ? nameColor2Input.value : null,
      nameGlowColor: nameColorEnabledToggle.checked ? nameGlowColorInput.value : null,
      nameGradient: nameColorEnabledToggle.checked ? nameGradientToggle.checked : null,
      nameAnimated: nameColorEnabledToggle.checked ? nameAnimatedToggle.checked : null,
      nameWeight: nameColorEnabledToggle.checked ? nameWeightSelect.value : null,
      medalText: medal || null,
      medalColor: medal ? medalColorInput.value : null,
      medalColor2: medal ? medalColor2Input.value : null,
      medalTextColor: medal ? medalTextColorInput.value : null,
      medalGlowColor: medal ? medalGlowColorInput.value : null,
      medalShape: medal ? medalShapeSelect.value : null,
      medalSize: medal ? medalSizeSelect.value : null,
      medalGradient: medal ? medalGradientToggle.checked : null,
      medalAnimated: medal ? medalAnimatedToggle.checked : null,
      medalOutline: medal ? medalOutlineToggle.checked : null,
      reviewTextCollapsed: reviewCollapseToggle.checked,
      reviewTextDefaultOpen: reviewCollapseDefaultOpenToggle.checked,
      reviewTextLines: parseInt(reviewCollapseLinesSelect.value) || 4,
      reviewToggleColor: reviewToggleColorInput.value,
      reviewExpandLabel: reviewExpandLabelInput.value.trim() || 'Lihat lagi ↓',
      reviewCollapseLabel: reviewCollapseLabelInput.value.trim() || 'Tutup ↑'
    };
    if (removeCustomerImage) payload.profileImg = null;
    simpanCustomerPayload(payload, "Profil pelanggan berjaya dikemaskini.", dataDoc);
  });
  function getNamePayloadFromInputs() {
    if (!nameColorEnabledToggle.checked) return null;
    return {
      nameColorEnabled: true,
      nameColor: nameColorInput.value,
      nameColor2: nameColor2Input.value,
      nameGlowColor: nameGlowColorInput.value,
      nameGradient: nameGradientToggle.checked,
      nameAnimated: nameAnimatedToggle.checked,
      nameWeight: nameWeightSelect.value
    };
  }
  btnApplyNameAll.addEventListener('click', () => {
    const payload = getNamePayloadFromInputs();
    if (!payload) { showToast("Aktifkan warna nama dulu sebelum apply semua.", "error"); return; }
    applyPayloadPilihan(payload, "Warna nama", tutupCustomerModal);
  });
  btnRemoveNameColor.addEventListener('click', () => {
    const dataDoc = allDocs.find(d => d.id === editingCustomerId) || {};
    simpanCustomerPayload({
      nameColorEnabled: false,
      nameColor: null,
      nameColor2: null,
      nameGlowColor: null,
      nameGradient: null,
      nameAnimated: null,
      nameWeight: null
    }, "Warna nama dibuang.", dataDoc);
  });
  function getMedalPayloadFromInputs() {
    const medal = medalTextInput.value.trim();
    if (!medal) return null;
    return {
      medalText: medal,
      medalColor: medalColorInput.value,
      medalColor2: medalColor2Input.value,
      medalTextColor: medalTextColorInput.value,
      medalGlowColor: medalGlowColorInput.value,
      medalShape: medalShapeSelect.value,
      medalSize: medalSizeSelect.value,
      medalGradient: medalGradientToggle.checked,
      medalAnimated: medalAnimatedToggle.checked,
      medalOutline: medalOutlineToggle.checked
    };
  }
  btnApplyMedalAll.addEventListener('click', () => {
    const payload = getMedalPayloadFromInputs();
    if (!payload) { showToast("Taip teks pingat dulu sebelum apply semua.", "error"); return; }
    applyPayloadPilihan(payload, "Pingat", tutupCustomerModal);
  });
  btnRemoveMedal.addEventListener('click', () => {
    const dataDoc = allDocs.find(d => d.id === editingCustomerId) || {};
    simpanCustomerPayload({
      medalText: null,
      medalColor: null,
      medalColor2: null,
      medalTextColor: null,
      medalGlowColor: null,
      medalShape: null,
      medalSize: null,
      medalGradient: null,
      medalAnimated: null,
      medalOutline: null
    }, "Pingat pelanggan dibuang.", dataDoc);
  });

  // -- Admin Config Modal ────────────────────────────────────────
  const btnOpenAdminConfig = document.getElementById('btnOpenAdminConfig');
  const btnLogoutAdmin = document.getElementById('btnLogoutAdmin');
  const btnOpenBulkDelete = document.getElementById('btnOpenBulkDelete');
  const adminOverlayBg = document.getElementById('adminOverlayBg');
  const adminPanelModal = document.getElementById('adminPanelModal');
  const btnCloseAdmin = document.getElementById('btnCloseAdmin');
  const btnSaveAdmin = document.getElementById('btnSaveAdmin');
  const adminAnnounceText = document.getElementById('adminAnnounceText');
  const adminCodePrefix = document.getElementById('adminCodePrefix');
  const adminCodeCount = document.getElementById('adminCodeCount');
  const btnGenerateCodes = document.getElementById('btnGenerateCodes');
  const btnRefreshCodes = document.getElementById('btnRefreshCodes');
  const adminCodeList = document.getElementById('adminCodeList');
  const adminOnlineVisitors = document.getElementById('adminOnlineVisitors');
  const adminTotalVisitors = document.getElementById('adminTotalVisitors');
  const adminLoginOverlayBg = document.getElementById('adminLoginOverlayBg');
  const adminLoginModal = document.getElementById('adminLoginModal');
  const adminLoginEmail = document.getElementById('adminLoginEmail');
  const adminLoginPassword = document.getElementById('adminLoginPassword');
  const btnAdminLogin = document.getElementById('btnAdminLogin');
  const btnCancelAdminLogin = document.getElementById('btnCancelAdminLogin');
  const AUTO_ZIXU_CONFIG_ID = "auto_post_zixu";
  const DEFAULT_ZIXU_MESSAGE = `📞 Link admin : https://wa.me/60193263016
☎️ Support Service : https://wa.me/60193263016
🛒 Website Market : https://h4sx-store.vercel.app/

⚠️ PERHATIAN ⚠️
Zixu tidak mempunyai sebarang akaun clone. Jika anda menemui mana-mana akaun yang mengaku sebagai Zixu, itu adalah 100% palsu (FAKE).

Zixu hanya menggunakan SATU nombor telefon rasmi dan semua ulasan (review) dikawal sepenuhnya oleh AI.

👑 Zixu Official Promoter H4SX Store Programmer 👑

☀️ Promote Link Buy Phone nom & Support Service Phone nom ☀️`;
  const DEFAULT_ZIXU_CONFIG = {
    enabled: false,
    intervalHours: 5,
    nama: "Z!xu Official",
    bintang: 5,
    ulasan: DEFAULT_ZIXU_MESSAGE,
    profileImg: "https://i.imgur.com/cLPulXQ.png",
    warnaProfil: "#0f2a45",
    badgeText: "ZIXU",
    badgeColor: "#9b5cff",
    badgeColor2: "#35d6ff",
    badgeTextColor: "#ffffff",
    badgeGlowColor: "#9b5cff",
    badgeGradient: true,
    badgeAnimated: true,
    medalText: "PAID PROMOTE",
    medalColor: "#a5b4fc",
    medalColor2: "#7c3aed",
    medalTextColor: "#ffffff",
    medalGlowColor: "#7c3aed",
    medalShape: "pill",
    medalSize: "sm",
    medalGradient: true,
    medalAnimated: true,
    medalOutline: false,
    nameColorEnabled: true,
    nameColor: "#8b5cf6",
    nameColor2: "#38bdf8",
    nameGlowColor: "#8b5cf6",
    nameGradient: true,
    nameAnimated: true,
    nameWeight: "900"
  };
  const autoZixuEnabled = document.getElementById('autoZixuEnabled');
  const autoZixuInterval = document.getElementById('autoZixuInterval');
  const autoZixuRating = document.getElementById('autoZixuRating');
  const autoZixuName = document.getElementById('autoZixuName');
  const autoZixuRole = document.getElementById('autoZixuRole');
  const autoZixuMedal = document.getElementById('autoZixuMedal');
  const autoZixuProfileImg = document.getElementById('autoZixuProfileImg');
  const autoZixuMessage = document.getElementById('autoZixuMessage');
  const autoZixuStatus = document.getElementById('autoZixuStatus');
  const btnRunZixuNow = document.getElementById('btnRunZixuNow');

  function isiAutoZixuForm(data = {}) {
    const cfg = { ...DEFAULT_ZIXU_CONFIG, ...data };
    if (!autoZixuEnabled) return;
    autoZixuEnabled.checked = cfg.enabled === true;
    autoZixuInterval.value = Math.max(1, Math.min(72, parseInt(cfg.intervalHours) || 5));
    autoZixuRating.value = Math.max(1, Math.min(5, parseInt(cfg.bintang) || 5));
    autoZixuName.value = cfg.nama || DEFAULT_ZIXU_CONFIG.nama;
    autoZixuRole.value = cfg.badgeText || DEFAULT_ZIXU_CONFIG.badgeText;
    autoZixuMedal.value = cfg.medalText || DEFAULT_ZIXU_CONFIG.medalText;
    autoZixuProfileImg.value = cfg.profileImg || "";
    autoZixuMessage.value = cfg.ulasan || DEFAULT_ZIXU_MESSAGE;
    if (autoZixuStatus) autoZixuStatus.textContent = cfg.lastPostAt?.toDate
      ? `Last post: ${cfg.lastPostAt.toDate().toLocaleString("ms-MY")}`
      : "Belum pernah auto post.";
  }
  function bacaAutoZixuForm(base = {}) {
    const intervalHours = Math.max(1, Math.min(72, parseInt(autoZixuInterval?.value) || 5));
    const rating = Math.max(1, Math.min(5, parseInt(autoZixuRating?.value) || 5));
    return {
      ...DEFAULT_ZIXU_CONFIG,
      ...base,
      enabled: autoZixuEnabled?.checked === true,
      intervalHours,
      bintang: rating,
      nama: (autoZixuName?.value || DEFAULT_ZIXU_CONFIG.nama).trim().slice(0, 40),
      ulasan: (autoZixuMessage?.value || DEFAULT_ZIXU_MESSAGE).trim().slice(0, 500),
      profileImg: (autoZixuProfileImg?.value || DEFAULT_ZIXU_CONFIG.profileImg).trim(),
      badgeText: (autoZixuRole?.value || DEFAULT_ZIXU_CONFIG.badgeText).trim().slice(0, 24),
      medalText: (autoZixuMedal?.value || DEFAULT_ZIXU_CONFIG.medalText).trim().slice(0, 18)
    };
  }
  async function loadAutoZixuConfig() {
    try {
      const snap = await getDoc(doc(db, "config", AUTO_ZIXU_CONFIG_ID));
      isiAutoZixuForm(snap.exists() ? snap.data() : DEFAULT_ZIXU_CONFIG);
      return snap.exists() ? snap.data() : DEFAULT_ZIXU_CONFIG;
    } catch(e) {
      console.error(e);
      isiAutoZixuForm(DEFAULT_ZIXU_CONFIG);
      return DEFAULT_ZIXU_CONFIG;
    }
  }
  async function saveAutoZixuConfig(extra = {}) {
    if (!adminOk()) return;
    const cfg = bacaAutoZixuForm(extra);
    await setDoc(doc(db, "config", AUTO_ZIXU_CONFIG_ID), cfg, { merge: true });
    return cfg;
  }
  function autoZixuReviewPayload(cfg = {}) {
    const data = { ...DEFAULT_ZIXU_CONFIG, ...cfg };
    return {
      nama: String(data.nama || DEFAULT_ZIXU_CONFIG.nama).trim().slice(0, 40),
      bintang: Math.max(1, Math.min(5, parseInt(data.bintang) || 5)),
      ulasan: String(data.ulasan || DEFAULT_ZIXU_MESSAGE).trim().slice(0, 500),
      diciptaPada: serverTimestamp(),
      profileImg: data.profileImg || DEFAULT_ZIXU_CONFIG.profileImg,
      warnaProfil: data.warnaProfil || DEFAULT_ZIXU_CONFIG.warnaProfil,
      badgeText: data.badgeText || DEFAULT_ZIXU_CONFIG.badgeText,
      badgeColor: data.badgeColor || DEFAULT_ZIXU_CONFIG.badgeColor,
      badgeColor2: data.badgeColor2 || DEFAULT_ZIXU_CONFIG.badgeColor2,
      badgeTextColor: data.badgeTextColor || DEFAULT_ZIXU_CONFIG.badgeTextColor,
      badgeGlowColor: data.badgeGlowColor || DEFAULT_ZIXU_CONFIG.badgeGlowColor,
      badgeGradient: data.badgeGradient !== false,
      badgeAnimated: data.badgeAnimated !== false,
      medalText: data.medalText || DEFAULT_ZIXU_CONFIG.medalText,
      medalColor: data.medalColor || DEFAULT_ZIXU_CONFIG.medalColor,
      medalColor2: data.medalColor2 || DEFAULT_ZIXU_CONFIG.medalColor2,
      medalTextColor: data.medalTextColor || DEFAULT_ZIXU_CONFIG.medalTextColor,
      medalGlowColor: data.medalGlowColor || DEFAULT_ZIXU_CONFIG.medalGlowColor,
      medalShape: data.medalShape || DEFAULT_ZIXU_CONFIG.medalShape,
      medalSize: data.medalSize || DEFAULT_ZIXU_CONFIG.medalSize,
      medalGradient: data.medalGradient !== false,
      medalAnimated: data.medalAnimated !== false,
      medalOutline: data.medalOutline === true,
      nameColorEnabled: data.nameColorEnabled === true,
      nameColor: data.nameColor || DEFAULT_ZIXU_CONFIG.nameColor,
      nameColor2: data.nameColor2 || DEFAULT_ZIXU_CONFIG.nameColor2,
      nameGlowColor: data.nameGlowColor || DEFAULT_ZIXU_CONFIG.nameGlowColor,
      nameGradient: data.nameGradient !== false,
      nameAnimated: data.nameAnimated !== false,
      nameWeight: data.nameWeight || DEFAULT_ZIXU_CONFIG.nameWeight,
      autoPostBy: "zixu",
      pinned: true,
      pinnedAt: serverTimestamp()
    };
  }
  async function postZixuReview(manual = false) {
    if (!adminOk()) {
      if (manual) showToast("Login admin dulu untuk post Z!xu.", "error");
      return false;
    }
    const snap = await getDoc(doc(db, "config", AUTO_ZIXU_CONFIG_ID));
    const saved = snap.exists() ? snap.data() : {};
    const cfg = manual ? bacaAutoZixuForm(saved) : { ...DEFAULT_ZIXU_CONFIG, ...saved };
    if (!manual && cfg.enabled !== true) return false;
    const intervalMs = Math.max(1, Math.min(72, parseInt(cfg.intervalHours) || 5)) * 60 * 60 * 1000;
    const lastMs = cfg.lastPostAt?.toMillis ? cfg.lastPostAt.toMillis() : 0;
    if (!manual && lastMs && Date.now() - lastMs < intervalMs) return false;
    const reviewRef = await addDoc(collection(db, "ratings"), autoZixuReviewPayload(cfg));
    await setDoc(doc(db, "config", AUTO_ZIXU_CONFIG_ID), {
      ...cfg,
      lastPostAt: serverTimestamp(),
      lastPostReviewId: reviewRef.id,
      updatedAt: serverTimestamp()
    }, { merge: true });
    if (autoZixuStatus) autoZixuStatus.textContent = "Z!xu baru sahaja post.";
    if (manual) showToast("Z!xu berjaya post sekarang.", "success");
    else showToast("Auto post Z!xu dihantar.", "success");
    return true;
  }
  async function checkAutoZixuPost() {
    if (!adminOk()) return;
    try { await postZixuReview(false); }
    catch(e) { console.error("Auto Z!xu gagal:", e); }
  }

  onAuthStateChanged(auth, user => {
    currentUser = user;
    if (user && !adminOk()) {
      showToast("Akaun ini bukan admin H4SX.", "error");
      signOut(auth);
      return;
    }
    updateAdminUi();
    if (latestCodeSnapshot) renderCodeListFromSnapshot(latestCodeSnapshot);
    try { renderReviews(); } catch (e) {}
    if (adminOk()) checkAutoZixuPost();
  });

  btnAdminLogin.addEventListener('click', async () => {
    const email = adminLoginEmail.value.trim();
    const password = adminLoginPassword.value;
    if (!email || !password) { showToast("Masukkan email dan password admin.", "error"); return; }
    btnAdminLogin.disabled = true; btnAdminLogin.textContent = "Login...";
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (!ADMIN_UIDS.includes(cred.user.uid)) {
        await signOut(auth);
        showToast("Akaun ini bukan admin H4SX.", "error");
        return;
      }
      tutupAdminLogin();
      showToast("Login admin berjaya.", "success");
    } catch (e) {
      console.error(e);
      showToast("Login admin gagal. Semak email/password.", "error");
    } finally {
      btnAdminLogin.disabled = false; btnAdminLogin.textContent = "Login";
    }
  });
  adminLoginPassword.addEventListener('keydown', e => {
    if (e.key === 'Enter') btnAdminLogin.click();
  });
  btnCancelAdminLogin.addEventListener('click', tutupAdminLogin);
  adminLoginOverlayBg.addEventListener('click', tutupAdminLogin);
  updateAdminUi();

  btnOpenAdminConfig.addEventListener('click', async () => {
    if (!mintaAdmin()) return;
    
    try {
      const snap = await getDoc(doc(db, "config", "announcement"));
      if (snap.exists()) adminAnnounceText.value = snap.data().text || DEFAULT_ANNOUNCEMENT_TEXT;
      else adminAnnounceText.value = DEFAULT_ANNOUNCEMENT_TEXT;
    } catch(e) {}
    await loadAutoZixuConfig();
    adminOverlayBg.classList.add('show');
    adminPanelModal.classList.add('show');
  });

  btnCloseAdmin.addEventListener('click', () => {
    adminOverlayBg.classList.remove('show');
    adminPanelModal.classList.remove('show');
  });

  btnOpenBulkDelete.addEventListener('click', () => {
    if (!mintaAdmin()) return;
    adminOverlayBg.classList.remove('show');
    adminPanelModal.classList.remove('show');
    deletePilihan();
  });

  btnSaveAdmin.addEventListener('click', async () => {
    btnSaveAdmin.disabled = true; btnSaveAdmin.textContent = "Menyimpan...";
    try {
      // Kita kena pastikan document wujud, setDoc dengan merge:true adalah cara yang betul
      await setDoc(doc(db, "config", "announcement"), { text: adminAnnounceText.value.trim() }, { merge: true });
      await saveAutoZixuConfig({ updatedAt: serverTimestamp() });
      showToast("Tetapan admin berjaya disimpan.", "success");
      btnCloseAdmin.click();
    } catch (e) {
      console.error(e);
      showToast("Gagal menyimpan tetapan. Sila semak rule Firebase.", "error");
    }
    btnSaveAdmin.disabled = false; btnSaveAdmin.textContent = "Simpan";
  });
  if (btnRunZixuNow) {
    btnRunZixuNow.addEventListener('click', async () => {
      if (!mintaAdmin()) return;
      btnRunZixuNow.disabled = true;
      btnRunZixuNow.textContent = "Posting...";
      try {
        await saveAutoZixuConfig({ updatedAt: serverTimestamp() });
        await postZixuReview(true);
      } catch(e) {
        console.error(e);
        showToast("Gagal post Z!xu. Semak rules ratings/config.", "error");
      } finally {
        btnRunZixuNow.disabled = false;
        btnRunZixuNow.textContent = "Post Z!xu Sekarang";
      }
    });
  }
  setInterval(checkAutoZixuPost, 5 * 60 * 1000);

  function randomCodePart(len = 6) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    crypto.getRandomValues(new Uint32Array(len)).forEach(n => out += chars[n % chars.length]);
    return out;
  }
  function cleanCodePrefix(value) {
    return (value || "H4SX").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "H4SX";
  }
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Kod ${text} dicopy.`, "success");
    } catch(e) {
      showToast(`Kod: ${text}`, "success");
    }
  }
  async function generateReviewCodes() {
    if (!mintaAdmin()) return;
    const prefix = cleanCodePrefix(adminCodePrefix.value);
    const count = Math.max(1, Math.min(200, parseInt(adminCodeCount.value) || 1));
    adminCodePrefix.value = prefix;
    adminCodeCount.value = String(count);
    btnGenerateCodes.disabled = true;
    btnGenerateCodes.textContent = "Generating...";
    try {
      const made = [];
      for (let i = 0; i < count; i++) {
        let code = `${prefix}-${randomCodePart(6)}`;
        while (made.includes(code)) code = `${prefix}-${randomCodePart(6)}`;
        made.push(code);
        await setDoc(doc(db, "review_codes", code), {
          kod: code,
          diciptaPada: serverTimestamp(),
          diciptaOleh: currentUser?.uid || "admin"
        });
      }
      showToast(`${made.length} kod berjaya dijana ke Firebase.`, "success");
    } catch(e) {
      console.error(e);
      showToast("Gagal generate kod. Semak rules review_codes admin create.", "error");
    } finally {
      btnGenerateCodes.disabled = false;
      btnGenerateCodes.textContent = "Generate Kod";
    }
  }
  function renderCodeListFromSnapshot(snapshot) {
    if (!adminOk()) {
      adminCodeList.textContent = "Login admin untuk lihat kod.";
      return;
    }
    const codes = [];
    snapshot.forEach(item => codes.push(item.id));
    codes.sort();
    if (!codes.length) {
      adminCodeList.textContent = "Tiada kod tersedia.";
      return;
    }
    adminCodeList.innerHTML = codes.map(code => `<button class="admin-code-pill" type="button" data-code="${escapeHtml(code)}">${escapeHtml(code)}</button>`).join("");
    adminCodeList.querySelectorAll("[data-code]").forEach(btn => {
      btn.addEventListener("click", () => copyText(btn.dataset.code));
    });
  }
  onSnapshot(collection(db, "review_codes"), snapshot => {
    latestCodeSnapshot = snapshot;
    renderCodeListFromSnapshot(snapshot);
  }, err => {
    console.error(err);
    if (adminCodeList) adminCodeList.textContent = "Gagal load kod. Semak rules Firebase.";
  });
  btnGenerateCodes.addEventListener("click", generateReviewCodes);
  btnRefreshCodes.addEventListener("click", () => showToast("Senarai kod auto update dari Firebase.", "success"));

  function getVisitorId() {
    const key = "h4sx_review_visitor_id";
    let id = localStorage.getItem(key);
    if (!id) {
      id = "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(key, id);
    }
    return id;
  }
  const visitorId = getVisitorId();
  async function updateVisitPresence(online = true) {
    try {
      const firstSeenKey = "h4sx_review_first_seen";
      let firstSeen = localStorage.getItem(firstSeenKey);
      if (!firstSeen) {
        firstSeen = new Date().toISOString();
        localStorage.setItem(firstSeenKey, firstSeen);
      }
      await setDoc(doc(db, "review_visits", visitorId), {
        page: "review",
        online,
        firstSeen,
        lastSeen: serverTimestamp(),
        userAgent: navigator.userAgent.slice(0, 140)
      }, { merge: true });
    } catch(e) {
      console.warn("Presence update gagal:", e);
    }
  }
  updateVisitPresence(true);
  setInterval(() => updateVisitPresence(document.visibilityState !== "hidden"), 20000);
  document.addEventListener("visibilitychange", () => updateVisitPresence(document.visibilityState !== "hidden"));
  window.addEventListener("pagehide", () => updateVisitPresence(false));

  onSnapshot(collection(db, "review_visits"), snapshot => {
    if (!adminOk()) {
      if (adminOnlineVisitors) adminOnlineVisitors.textContent = "0";
      if (adminTotalVisitors) adminTotalVisitors.textContent = "0";
      return;
    }
    const now = Date.now();
    let online = 0;
    snapshot.forEach(item => {
      const data = item.data();
      const last = data.lastSeen?.toMillis?.() || 0;
      if (data.online === true && now - last < 45000) online++;
    });
    adminOnlineVisitors.textContent = String(online);
    adminTotalVisitors.textContent = String(snapshot.size);
  }, err => {
    console.warn("Gagal baca visit stats:", err);
  });

  // ── Ticker ────────────────────────────────────────────────────
  const tickerItems = [
    { icon:"⚡", text:"Penghantaran Pantas 5–25 Minit" },
    { icon:"⭐", text:"300+ Pelanggan Berpuas Hati" },
    { icon:"💬", text:"Bantuan Terus Melalui WhatsApp" },
    { icon:"🔒", text:"Semak Detail Sebelum Bayar" },
    { icon:"🎮", text:"Item Roblox Terpilih" },
    { icon:"🛡️", text:"Pembelian Lebih Selamat" },
    { icon:"🌟", text:"Kedai Dipercayai Sejak 2024" },
    { icon:"📦", text:"Stock Sentiasa Ada" },
  ];
  const track = document.getElementById("tickerTrack");
  const buildTicker = (items) => items.map(i =>
    `<span class="ticker-item"><span class="ti">${i.icon}</span>${i.text}</span>`
  ).join("");
  // Duplicate for seamless loop
  track.innerHTML = buildTicker(tickerItems) + buildTicker(tickerItems);

  // ── Toast ─────────────────────────────────────────────────────
  const toastStack = document.getElementById("toastStack");
  function showToast(msg, type="info") {
    const icons = {success:"✅",error:"❌",info:"ℹ️"};
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${escapeHtml(msg)}</span>`;
    toastStack.appendChild(t);
    const rm = () => { t.classList.add("out"); t.addEventListener("animationend",()=>t.remove(),{once:true}); };
    const tid = setTimeout(rm, 3800);
    t.addEventListener("click", ()=>{ clearTimeout(tid); rm(); });
  }

  // ── DOM ───────────────────────────────────────────────────────
  const kodVerification = document.getElementById("kodVerification");
  const namaPelanggan   = document.getElementById("namaPelanggan");
  const btnGenerateName = document.getElementById("btnGenerateName");
  const pilihBintang    = document.getElementById("pilihBintang");
  const ulasanPelanggan = document.getElementById("ulasanPelanggan");
  const butangHantar    = document.getElementById("butangHantar");
  const kotakPaparan    = document.getElementById("kotakPaparan");
  const purataSkor      = document.getElementById("purataSkor");
  const purataBintang   = document.getElementById("purataBintang");
  const jumlahUlasanVal = document.getElementById("jumlahUlasanVal");
  const pctLima         = document.getElementById("pctLima");
  const avatarPreview   = document.getElementById("avatarPreview");
  const swatchRow       = document.getElementById("swatchRow");
  const emojiRow        = document.getElementById("emojiRow");
  const charCounter     = document.getElementById("charCounter");
  const sortSelect      = document.getElementById("sortSelect");
  const btnReviewScreenshot = document.getElementById("btnReviewScreenshot");
  const fileInput       = document.getElementById("fileInput");
  const dropZone        = document.getElementById("dropZone");
  const clipboardZone   = document.getElementById("clipboardZone");
  const urlGambar       = document.getElementById("urlGambar");
  const btnLoadUrl      = document.getElementById("btnLoadUrl");
  const btnPasteProfileImg = document.getElementById("btnPasteProfileImg");
  const btnClearImg     = document.getElementById("btnClearImg");
  const btnDadu         = document.getElementById("btnDadu");
  const feedbackImageInput   = document.getElementById("feedbackImageInput");
  const btnPickFeedbackImage = document.getElementById("btnPickFeedbackImage");
  const btnClearFeedbackImage = document.getElementById("btnClearFeedbackImage");
  const feedbackImagePreview = document.getElementById("feedbackImagePreview");
  document.querySelector(".form-col")?.addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target && e.target.tagName === "INPUT") {
      if (e.target === urlGambar) return;
      e.preventDefault();
    }
  });
  const feedbackImageModal = document.getElementById("feedbackImageModal");
  const feedbackImageModalImg = document.getElementById("feedbackImageModalImg");
  const btnCloseFeedbackImage = document.getElementById("btnCloseFeedbackImage");

  // ── Profile ───────────────────────────────────────────────────
  const WARNA = ['#2fa8e0','#7c5cbf','#22c47a','#f0a500','#e05252','#1a4470','#48a89e','#d96fb0'];
  const EMOJI  = ['😀','😎','🔥','🎮','👾','🐉','⚡','💎'];
  let pilihanWarna = null, pilihanEmoji = null, profileImgB64 = null, feedbackImgB64 = null;
  const NAMA_AUTO = [
    "Aiman", "Hakim", "Danish", "Aqil", "Farish", "Arif", "Nazri",
    "Syafiq", "Ammar", "Haziq", "Danial", "Adam", "Rizqi", "Rayyan", "Naufal",
    "Izzah", "Syahira", "Alya", "Nadia", "Sofea", "Humaira", "Aina", "Maisarah",
    "Zara", "Hana", "Mia", "Qistina", "Putri", "Nurul"
  ];
  const NAMA_SUFFIX = ["X", "Pro", "MY", "GG", "ID", "V2", "OP", "YT", "RX", "VX"];

  WARNA.forEach(w => {
    const sw = document.createElement("div");
    sw.className = "swatch"; sw.style.backgroundColor = w;
    sw.onclick = () => {
      pilihanWarna = w;
      document.querySelectorAll(".swatch").forEach(s=>s.classList.remove("active"));
      sw.classList.add("active"); updatePreview();
    };
    swatchRow.appendChild(sw);
  });

  EMOJI.forEach(em => {
    const opt = document.createElement("div");
    opt.className = "emoji-opt"; opt.textContent = em;
    opt.onclick = () => {
      pilihanEmoji = pilihanEmoji === em ? null : em;
      document.querySelectorAll(".emoji-opt").forEach(o=>o.classList.remove("active"));
      if (pilihanEmoji) { opt.classList.add("active"); clearProfileImg(false); }
      updatePreview();
    };
    emojiRow.appendChild(opt);
  });

  function warnaAuto(nama) {
    const n = (nama||"").trim();
    return n ? WARNA[n.length % WARNA.length] : WARNA[0];
  }
  function updatePreview() {
    const nama  = namaPelanggan.value.trim();
    const warna = pilihanWarna || warnaAuto(nama);
    const letter = avatarPreview.querySelector(".av-letter");
    avatarPreview.style.backgroundColor = warna;
    const oldImg = avatarPreview.querySelector("img.av-img");
    if (oldImg) oldImg.remove();
    if (profileImgB64) {
      const img = document.createElement("img");
      img.className = "av-img"; img.src = profileImgB64;
      avatarPreview.insertBefore(img, avatarPreview.querySelector(".av-edit-hint"));
      letter.textContent = "";
    } else {
      letter.textContent = pilihanEmoji || (nama ? nama.charAt(0).toUpperCase() : "H");
    }
  }
  namaPelanggan.addEventListener("input", updatePreview);
  btnGenerateName.addEventListener("click", () => {
    const nama = NAMA_AUTO[Math.floor(Math.random() * NAMA_AUTO.length)];
    const suffix = NAMA_SUFFIX[Math.floor(Math.random() * NAMA_SUFFIX.length)];
    namaPelanggan.value = `${nama}${suffix}`;
    pilihanWarna = WARNA[Math.floor(Math.random() * WARNA.length)];
    pilihanEmoji = null;
    document.querySelectorAll(".emoji-opt").forEach(o=>o.classList.remove("active"));
    document.querySelectorAll(".swatch").forEach(s=>s.classList.remove("active"));
    const warnaIndex = WARNA.indexOf(pilihanWarna);
    if (warnaIndex >= 0) swatchRow.children[warnaIndex]?.classList.add("active");
    clearProfileImg(false);
    updatePreview();
  });
  updatePreview();

  // Image upload tabs
  document.querySelectorAll(".img-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".img-tab").forEach(t=>t.classList.remove("active"));
      document.querySelectorAll(".img-tab-panel").forEach(p=>p.classList.remove("show"));
      tab.classList.add("active");
      document.getElementById(`panel-${tab.dataset.tab}`).classList.add("show");
    });
  });

  avatarPreview.addEventListener("click", () => fileInput.click());

  function compressImage(src, cb, onFail) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const SIZE = 80, c = document.createElement("canvas");
        c.width = c.height = SIZE;
        const ctx = c.getContext("2d");
        const min = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - min)/2, sy = (img.naturalHeight - min)/2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, SIZE, SIZE);
        // toDataURL akan throw SecurityError kalau canvas "tainted" —
        // ini berlaku bila server URL gambar tu tak bagi header CORS
        // (Access-Control-Allow-Origin). Byk website block ni secara default.
        const dataUrl = c.toDataURL("image/jpeg", 0.75);
        cb(dataUrl);
      } catch (e) {
        console.error("Gagal proses gambar (kemungkinan sekatan CORS):", e);
        if (onFail) onFail(e);
        else showToast("Gambar dari URL ni tak boleh dimuatkan sebab sekatan pelayan (CORS). Cuba host lain (cth: i.imgur.com) atau upload terus dari galeri.", "error");
      }
    };
    img.onerror = () => {
      if (onFail) onFail(new Error("load-failed"));
      else showToast("Gagal muatkan gambar. Cuba URL lain.", "error");
    };
    img.src = src;
  }
  function applyProfileImg(b64) {
    profileImgB64 = b64; pilihanEmoji = null;
    document.querySelectorAll(".emoji-opt").forEach(o=>o.classList.remove("active"));
    btnClearImg.classList.add("show"); updatePreview();
    showToast("Gambar profil berjaya dimuatkan! 📸", "success");
  }
  function applyProfileFile(file, sourceLabel = "gambar") {
    if (!file || !file.type?.startsWith("image/")) {
      showToast(`Clipboard tiada gambar. Copy gambar dulu, kemudian paste.`, "error");
      return;
    }
    if (file.size > 5*1024*1024) {
      showToast("Gambar profil terlalu besar. Max 5MB.", "error");
      return;
    }
    const r = new FileReader();
    r.onload = e => compressImage(e.target.result, applyProfileImg);
    r.readAsDataURL(file);
    showToast(`Memproses ${sourceLabel}...`, "info");
  }
  async function pasteProfileFromClipboard() {
    if (!navigator.clipboard?.read) {
      showToast("Browser ini tidak support baca gambar clipboard. Guna Ctrl+V atau upload galeri.", "error");
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find(t => t.startsWith("image/"));
        if (!type) continue;
        const blob = await item.getType(type);
        applyProfileFile(new File([blob], "clipboard-profile.png", { type }), "gambar clipboard");
        return;
      }
      showToast("Clipboard tiada gambar. Copy gambar dulu.", "error");
    } catch (err) {
      console.error(err);
      showToast("Tak dapat baca clipboard. Cuba tekan Ctrl+V dalam kotak Clipboard.", "error");
    }
  }
  function clearProfileImg(showMsg=true) {
    profileImgB64 = null; btnClearImg.classList.remove("show");
    fileInput.value = ""; urlGambar.value = ""; updatePreview();
    if (showMsg) showToast("Gambar profil dibuang.", "info");
  }
  btnClearImg.addEventListener("click", ()=>clearProfileImg(true));
  fileInput.addEventListener("change", () => {
    const f = fileInput.files[0];
    if (!f) return;
    applyProfileFile(f, "gambar profil");
  });
  dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("drag-over"); });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
  dropZone.addEventListener("drop", e => {
    e.preventDefault(); dropZone.classList.remove("drag-over");
    const f = e.dataTransfer.files[0];
    applyProfileFile(f, "gambar drop");
  });
  if (btnPasteProfileImg) btnPasteProfileImg.addEventListener("click", pasteProfileFromClipboard);
  if (clipboardZone) {
    clipboardZone.addEventListener("click", () => clipboardZone.focus());
    clipboardZone.addEventListener("paste", e => {
      const file = [...(e.clipboardData?.items || [])]
        .find(item => item.type.startsWith("image/"))?.getAsFile();
      if (file) {
        e.preventDefault();
        applyProfileFile(file, "gambar clipboard");
      }
    });
  }
  document.addEventListener("paste", e => {
    const activePanel = document.getElementById("panel-clipboard");
    if (!activePanel?.classList.contains("show")) return;
    const file = [...(e.clipboardData?.items || [])]
      .find(item => item.type.startsWith("image/"))?.getAsFile();
    if (file) {
      e.preventDefault();
      applyProfileFile(file, "gambar clipboard");
    }
  });
  btnLoadUrl.addEventListener("click", () => {
    const url = urlGambar.value.trim();
    if (!url || !url.startsWith("http")) { showToast("URL tidak sah.", "error"); return; }
    btnLoadUrl.textContent = "Memuatkan..."; btnLoadUrl.disabled = true;
    let selesai = false;
    const tamatkan = () => { selesai = true; btnLoadUrl.textContent = "Muat"; btnLoadUrl.disabled = false; };
    compressImage(
      url,
      b64 => { if (selesai) return; applyProfileImg(b64); tamatkan(); },
      err => {
        if (selesai) return;
        tamatkan();
        if (err && err.message === "load-failed") {
          showToast("Gagal muatkan gambar. Semak URL tu betul & terus ke fail gambar (.jpg/.png).", "error");
        } else {
          showToast("URL ni tak boleh dimuatkan sebab sekatan pelayan (CORS). Cuba host lain (cth: i.imgur.com) atau upload terus dari galeri.", "error");
        }
      }
    );
    setTimeout(()=>{ if (!selesai) { tamatkan(); showToast("Muat gambar mengambil masa terlalu lama. Cuba lagi.", "error"); } }, 8000);
  });
  urlGambar.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      btnLoadUrl.click();
    }
  });

  function compressFeedbackImage(src, cb) {
    const img = new Image();
    img.onload = () => {
      const maxSide = 900;
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      cb(c.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => showToast("Gagal proses gambar feedback. Cuba gambar lain.", "error");
    img.src = src;
  }
  function setFeedbackImage(b64) {
    feedbackImgB64 = b64;
    btnClearFeedbackImage.classList.add("show");
    feedbackImagePreview.textContent = "Gambar feedback sudah dipilih. Ia hanya muncul bila orang tekan See image.";
    showToast("Gambar feedback berjaya dimuatkan.", "success");
  }
  function clearFeedbackImage(showMsg=true) {
    feedbackImgB64 = null;
    feedbackImageInput.value = "";
    btnClearFeedbackImage.classList.remove("show");
    feedbackImagePreview.textContent = "";
    if (showMsg) showToast("Gambar feedback dibuang.", "info");
  }
  function openFeedbackImage(src) {
    if (!src) return;
    feedbackImageModalImg.src = src;
    feedbackImageModal.classList.add("show");
  }
  function closeFeedbackImage() {
    feedbackImageModal.classList.remove("show");
    feedbackImageModalImg.src = "";
  }
  btnPickFeedbackImage.addEventListener("click", () => feedbackImageInput.click());
  btnClearFeedbackImage.addEventListener("click", () => clearFeedbackImage(true));
  feedbackImageInput.addEventListener("change", () => {
    const f = feedbackImageInput.files[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { showToast("Fail feedback mesti gambar.", "error"); return; }
    if (f.size > 5*1024*1024) { showToast("Gambar feedback terlalu besar. Max 5MB.", "error"); return; }
    const r = new FileReader();
    r.onload = e => compressFeedbackImage(e.target.result, setFeedbackImage);
    r.readAsDataURL(f);
  });
  btnCloseFeedbackImage.addEventListener("click", closeFeedbackImage);
  feedbackImageModal.addEventListener("click", e => {
    if (e.target === feedbackImageModal) closeFeedbackImage();
  });

  // ── Dadu ──────────────────────────────────────────────────────
  const CDG_PREFIX = "cdg - ";
  let reviewSuggestionUsed = false;
  const CADANGAN = {
    5:[
      "Servis memang laju dan mudah faham. Lepas payment terus diproses, seller pun friendly. Memang trusted untuk beli digital item. 🔥",
      "Urusan sangat smooth dari mula sampai siap. Detail produk jelas, seller respons cepat, dan item masuk seperti yang dijanjikan. ⭐",
      "First time beli dekat sini tapi puas hati. Proses pantas, harga okay, dan seller bantu sampai selesai. Recommended. 🙏",
      "Digital item diterima dengan selamat dan tak pening nak deal. Seller explain elok-elok, jadi rasa yakin nak repeat order. 💎",
      "Servis terbaik, cepat respond dan tak buat customer tertunggu lama. H4SX STORE memang boleh dipercayai untuk order online. 🚀"
    ],
    4:[
      "Keseluruhan puas hati. Proses order jelas dan seller senang bincang. Ada lambat sikit tapi masih okay. 👍",
      "Produk digital diterima seperti info yang diberi. Harga berpatutan dan support pun membantu. Boleh repeat lagi. 🙂",
      "Seller baik dan cepat bantu bila ada soalan. Ada minor delay, tapi urusan tetap selesai dengan baik.",
      "Pengalaman beli yang menyenangkan. Komunikasi aktif dan item mengikut detail. Satu bintang kurang sebab tunggu sikit.",
      "H4SX STORE bagus untuk beli item digital. Kalau proses lagi laju sikit, memang boleh jadi 5 bintang. 😊"
    ],
    3:[
      "Urusan okay, cuma masa proses agak lambat daripada jangkaan. Seller masih bantu sampai selesai.",
      "Item digital diterima, tapi komunikasi boleh diperkemas lagi supaya customer tak tertanya-tanya.",
      "Pengalaman sederhana. Order selesai, cuma ada beberapa bahagian yang boleh dibuat lebih smooth.",
      "Seller respond lambat sikit. Item okay, cuma harap update status order lebih kerap lepas ni.",
      "Neutral saja. Tak kecewa sangat, tapi masih ada ruang untuk improve dari segi kelajuan dan info."
    ],
    2:[
      "Agak kecewa sebab proses ambil masa lama dan update kurang jelas. Harap boleh diperbaiki.",
      "Order selesai tapi proses agak panjang. Seller ada bantu, cuma komunikasi perlu lebih kemas.",
      "Respons lambat dan status order kurang jelas. Untuk digital product, customer memang perlukan update cepat.",
      "Ada masalah dengan order tapi akhirnya settle. Belum pasti nak repeat kalau proses masih sama.",
      "Kurang puas hati. Harap H4SX ambil maklum supaya servis digital item jadi lebih pantas dan tersusun."
    ],
    1:[
      "Sangat kecewa dengan proses order kali ini. Respons lambat dan masalah tidak diterangkan dengan jelas.",
      "Pengalaman tidak memuaskan. Harap H4SX ambil serius feedback ini dan perbaiki cara handle customer.",
      "Detail produk tidak sama seperti yang saya faham semasa order. Mohon lebih jelas untuk pembeli seterusnya.",
      "Proses menyusahkan dari awal sampai akhir. Harap ada perubahan besar pada support dan update order.",
      "Satu bintang untuk pengalaman kali ini. Mohon H4SX perbaiki kualiti servis digital product segera."
    ]
  };
  let lastDaduIdx = -1;
  btnDadu.addEventListener("click", () => {
    const rating = parseInt(pilihBintang.value)||5;
    const pool   = CADANGAN[rating] || CADANGAN[5];
    let idx;
    do { idx = Math.floor(Math.random()*pool.length); } while (idx===lastDaduIdx && pool.length>1);
    lastDaduIdx = idx;
    const teks = CDG_PREFIX + pool[idx];
    reviewSuggestionUsed = true;
    ulasanPelanggan.value = ""; charCounter.textContent = "0 / 500";
    ulasanPelanggan.focus();
    let i = 0;
    const iv = setInterval(()=>{
      if (i >= teks.length) { clearInterval(iv); return; }
      ulasanPelanggan.value += teks[i++];
      charCounter.textContent = `${ulasanPelanggan.value.length} / 500`;
    }, 16);
    const d = btnDadu.querySelector(".dice-icon");
    d.style.transform="rotate(360deg) scale(1.3)";
    setTimeout(()=>d.style.transform="",420);
  });

  ulasanPelanggan.addEventListener("input", ()=>{
    const l = ulasanPelanggan.value.length;
    charCounter.textContent = `${l} / 500`;
    charCounter.classList.toggle("warn", l>450);
    if (!ulasanPelanggan.value.trim()) reviewSuggestionUsed = false;
  });

  // ── Submit ────────────────────────────────────────────────────
  butangHantar.addEventListener("click", async () => {
    const kod    = kodVerification.value.trim().toUpperCase();
    const nama   = namaPelanggan.value.trim();
    const bintang = parseInt(pilihBintang.value);
    let ulasan = ulasanPelanggan.value.trim();

    if (!kod)  return showToast("Sila masukkan Kod Pengesahan.", "error");
    if (!nama) return showToast("Sila isi nama atau username.", "error");
    if (isBlockedReviewName(nama)) {
      return showToast("Nama ini tidak dibenarkan. Sila guna nama yang sopan.", "error");
    }
    if (ulasan && ulasan.length < 1) {
      return showToast("Ulasan mesti sekurang-kurangnya 10 aksara, atau kosongkan untuk rating sahaja.", "error");
    }
    const gunaCadangan = reviewSuggestionUsed || /^cdg\s*[-:]/i.test(ulasan);
    if (gunaCadangan && ulasan && !/^cdg\s*[-:]/i.test(ulasan)) {
      ulasan = (CDG_PREFIX + ulasan).slice(0, 500);
    }
    
    // Block nama yang mengandungi "h4sx" jika bukan admin
    const namaLower = nama.toLowerCase();
    if (namaLower.includes("h4sx") && !adminOk()) {
      return showToast("Nama ini dikhaskan untuk admin H4SX STORE sahaja.", "error");
    }

    butangHantar.disabled = true;
    butangHantar.textContent = "Menghantar...";
    try {
      const codeSnap = await getDoc(doc(db,"review_codes",kod));
      if (!codeSnap.exists()) {
        showToast("Kod pengesahan tidak sah atau telah digunakan.", "error"); 
        butangHantar.disabled = false; butangHantar.textContent = "🚀 Hantar Ulasan";
        return;
      }
      
      // Hantar field asas sahaja masa pelanggan submit.
      // Firestore rules public biasanya tolak field tambahan semasa create.
      const dataToSave = {
        nama: nama, 
        bintang: bintang, 
        ulasan: ulasan || "Tiada ulasan ditinggalkan.",
        diciptaPada: serverTimestamp()
      };
      if (pilihanWarna) dataToSave.warnaProfil = pilihanWarna;
      if (pilihanEmoji) dataToSave.emojiProfil = pilihanEmoji;
      if (profileImgB64) dataToSave.profileImg = profileImgB64;
      if (feedbackImgB64) dataToSave.feedbackImg = feedbackImgB64;
      console.log("Data yang cuba disimpan:", dataToSave);
      
      const refBaru = await addDoc(collection(db,"ratings"), dataToSave);
      await deleteDoc(doc(db,"review_codes",kod));

      // ── Auto-reply "terima kasih" untuk setiap ulasan baru ──────
      // Nota: rules 'create' sengaja block balasanAdmin (kena null semasa create),
      // jadi auto-reply ni kena dihantar sebagai 'update' selepas create berjaya —
      // sah ikut rules 'update' sebab nama/bintang/ulasan/diciptaPada tak diubah.
      try {
        await updateDoc(doc(db,"ratings",refBaru.id), {
          balasanAdmin: buildAutoReply(nama),
          balasanPada: serverTimestamp()
        });
      } catch(errBalasan) {
        console.error("Auto-reply gagal (ulasan tetap tersimpan):", errBalasan);
      }
      if (gunaCadangan) {
        try {
          await updateDoc(doc(db,"ratings",refBaru.id), {
            cdg: true,
            cadanganDigunakan: true
          });
        } catch(errCdg) {
          console.warn("Flag cdg gagal disimpan, prefix cdg masih ada dalam teks ulasan:", errCdg);
        }
      }

      // Reset
      kodVerification.value = namaPelanggan.value = ulasanPelanggan.value = "";
      pilihBintang.value = "5";
      reviewSuggestionUsed = false;
      pilihanWarna = pilihanEmoji = null;
      document.querySelectorAll(".swatch,.emoji-opt").forEach(el=>el.classList.remove("active"));
      clearProfileImg(false); clearFeedbackImage(false); charCounter.textContent = "0 / 500"; updatePreview();

      showToast("Ulasan berjaya dihantar! Terima kasih. 🙏", "success");
      setMobileReviewTab("reviews", true);
    } catch(err) {
      console.error("Ralat Firebase (Details):", err.code, err.message, err);
      // Papar sebab sebenar terus dalam toast supaya senang debug tanpa F12
      const sebab = err.code ? `(${err.code})` : (err.message || "");
      showToast(`Gagal hantar ulasan ${sebab}. Cuba lagi.`, "error");
    } finally {
      butangHantar.disabled = false; butangHantar.textContent = "🚀 Hantar Ulasan";
    }
  });

  // ── Admin reply ───────────────────────────────────────────────
  async function hantarBalasan(id, teks, btn) {
    if (!teks.trim()) { showToast("Taip balasan dahulu.", "error"); return; }
    btn.disabled=true; btn.textContent="Menghantar...";
    try {
      await updateDoc(doc(db,"ratings",id), { balasanAdmin:teks.trim(), balasanPada:serverTimestamp() });
      showToast("Balasan berjaya dikemaskini.", "success");
    } catch(err) {
      console.error(err); showToast("Gagal hantar balasan.", "error");
    } finally { btn.disabled=false; btn.textContent="Hantar Balasan"; }
  }

  async function simpanEditUlasan(id, teks, btn, dataDoc) {
    const ulasanBaru = teks.trim();
    if (ulasanBaru.length < 3) {
      showToast("Ulasan terlalu pendek.", "error");
      return;
    }
    if (ulasanBaru.length > 500) {
      showToast("Ulasan terlalu panjang. Maksimum 500 aksara.", "error");
      return;
    }
    btn.disabled = true;
    btn.textContent = "Menyimpan...";
    try {
      const payload = { ulasan: ulasanBaru, ulasanDieditPada: serverTimestamp() };
      if (!dataDoc.balasanAdmin?.trim()) {
        payload.balasanAdmin = buildAutoReply(dataDoc.nama);
        payload.balasanPada = serverTimestamp();
      }
      await updateDoc(doc(db,"ratings",id), payload);
      showToast("Ulasan pelanggan berjaya diedit.", "success");
    } catch(err) {
      console.error(err);
      showToast("Gagal edit ulasan. Pastikan rules admin benarkan update.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Simpan Ulasan";
    }
  }
  function timestampToDatetimeLocal(ts) {
    const date = ts?.toDate ? ts.toDate() : new Date();
    const pad = n => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  async function simpanEditMasa(id, value, btn, dataDoc) {
    if (!value) {
      showToast("Pilih tarikh dan masa dahulu.", "error");
      return;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      showToast("Tarikh atau masa tidak sah.", "error");
      return;
    }
    btn.disabled = true;
    btn.textContent = "Menyimpan...";
    try {
      const payload = { diciptaPada: Timestamp.fromDate(date), masaDieditPada: serverTimestamp() };
      if (!dataDoc.balasanAdmin?.trim()) {
        payload.balasanAdmin = buildAutoReply(dataDoc.nama);
        payload.balasanPada = serverTimestamp();
      }
      await updateDoc(doc(db,"ratings",id), payload);
      showToast("Tarikh dan masa review berjaya diedit.", "success");
    } catch(err) {
      console.error(err);
      showToast("Gagal edit masa. Semak rules admin update ratings.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Simpan Masa";
    }
  }

  // ── Filter & sort ─────────────────────────────────────────────
  let filterStar="all", sortMode="newest", allDocs=[];
  document.querySelectorAll(".filter-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      document.querySelectorAll(".filter-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active"); filterStar=btn.dataset.filter; renderReviews();
    });
  });
  sortSelect.addEventListener("change",()=>{ sortMode=sortSelect.value; renderReviews(); });

  // Selamatkan diri drpd data rosak/prank (cth: bintang disave sbg 999 terus
  // dari Firebase console) — sentiasa clamp ke julat sah 0–5 sebelum digunakan.
  function clampBintang(n) {
    n = parseInt(n) || 0;
    if (n < 0) return 0;
    if (n > 5) return 5;
    return n;
  }

  // ── Live snapshot ─────────────────────────────────────────────
  const q = query(collection(db,"ratings"), orderBy("diciptaPada","desc"));
  onSnapshot(q, snapshot=>{
    allDocs=[];
    let total=0, count=0, lima=0;
    snapshot.forEach(d=>{
      const data = { id:d.id, ...d.data() };
      allDocs.push(data);
      const b = clampBintang(d.data().bintang);
      total+=b; count++;
      if (b===5) lima++;
    });
    if (count===0) {
      purataSkor.textContent="0.0"; purataBintang.textContent="☆☆☆☆☆";
      jumlahUlasanVal.textContent="0"; pctLima.textContent="—";
    } else {
      const avg=(total/count).toFixed(1);
      purataSkor.textContent=avg;
      const r=clampBintang(Math.round(parseFloat(avg)));
      purataBintang.textContent="★".repeat(r)+"☆".repeat(5-r);
      jumlahUlasanVal.textContent=count;
      pctLima.textContent=Math.round((lima/count)*100)+"%";
    }
    renderReviews();
  });

  // ── Render ────────────────────────────────────────────────────
  function getCurrentReviewList() {
    let list=[...allDocs];
    if (filterStar!=="all") {
      list = filterStar==="12" ? list.filter(d=>clampBintang(d.bintang)<=2) : list.filter(d=>clampBintang(d.bintang)===parseInt(filterStar));
    }
    if (sortMode==="highest") list.sort((a,b)=>clampBintang(b.bintang)-clampBintang(a.bintang));
    else if (sortMode==="lowest") list.sort((a,b)=>clampBintang(a.bintang)-clampBintang(b.bintang));

    // Ulasan yang di-pin sentiasa naik ke atas (pin terbaru dulu),
    // ikutan yang lain kekal ikut sortMode yang dipilih.
    const dipin = list.filter(d=>d.pinned===true)
      .sort((a,b)=>(b.pinnedAt?.toMillis?.()||0)-(a.pinnedAt?.toMillis?.()||0));
    const takDipin = list.filter(d=>d.pinned!==true);
    list = [...dipin, ...takDipin];
    return list;
  }

  function renderReviews() {
    const list = getCurrentReviewList();

    kotakPaparan.innerHTML="";
    if (!list.length) {
      kotakPaparan.innerHTML=`<div class="no-reviews"><span class="no-icon">🔍</span><span>Tiada ulasan untuk penapis ini.</span></div>`;
      return;
    }

    list.forEach((data,i)=>{
      const id=data.id, score=clampBintang(data.bintang);
      const rawBintang=parseInt(data.bintang)||0;
      const rawNama=data.nama||"Pelanggan Misteri";
      let namaDisorok=rawNama;
      
      // Semak adakah ini admin yang post ulasan
      const isReviewAdmin = rawNama.toLowerCase().includes("h4sx");
      
      if (rawNama!=="Pelanggan Misteri" && !isReviewAdmin) {
        // Jangan sensor kalau tak perlu, tapi sebab tadi awak cakap "jngn bgi sensor untuk nama tu",
        // saya akan matikan sistem bintang-bintang nama (sensor) sepenuhnya untuk semua orang
        // ATAU hanya untuk admin? Saya akan matikan sensor untuk semua orang mengikut arahan "jngn bgi sensor untuk nama tu"
        namaDisorok = rawNama;
      }
      
      const warna=data.warnaProfil||warnaAuto(rawNama);
      const hasImg=!!(data.profileImg);
      const avatarIsi=data.emojiProfil||rawNama.charAt(0).toUpperCase();
      const adaBalasan=!!(data.balasanAdmin?.trim());
      const adaUlasan = !!(data.ulasan?.trim()) && data.ulasan !== "Tiada ulasan ditinggalkan.";
      const gunaCadangan = data.cdg === true || data.cadanganDigunakan === true || /^cdg\s*[-:]/i.test(String(data.ulasan || "").trim());
      const adaFeedbackImg = !!(data.feedbackImg);
      const gunaTextToggle = adaUlasan && data.reviewTextCollapsed === true;
      const textMulaBuka = data.reviewTextDefaultOpen === true;
      const textLines = Math.min(6, Math.max(2, parseInt(data.reviewTextLines) || 4));
      const expandLabel = data.reviewExpandLabel || "Lihat lagi ↓";
      const collapseLabel = data.reviewCollapseLabel || "Tutup ↑";
      const toggleColor = warnaHexSah(data.reviewToggleColor, "#2fa8e0");

      let masa="Baru sahaja";
      if (data.diciptaPada) masa=data.diciptaPada.toDate().toLocaleString("ms-MY",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true});
      let masaBalasan="";
      if (data.balasanPada) masaBalasan=data.balasanPada.toDate().toLocaleString("ms-MY",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true});

      const starHtml=Array.from({length:5},(_,si)=>`<span style="color:${si<score?"#f0a500":"#cde"}">${si<score?"★":"☆"}</span>`).join("");
      const avatarInner=hasImg?`<img src="${escapeHtml(data.profileImg)}" alt="">`:escapeHtml(avatarIsi);
      
      const customBadgeStyle = badgeStyle(data);
      const customBadgeClass = "verified-badge custom-badge" + (data.badgeAnimated === false ? "" : " is-animated");
      const verifiedTag = data.badgeText?.trim()
        ? `<span class="${customBadgeClass}" style="${customBadgeStyle}">${escapeHtml(data.badgeText)}</span>`
        : isReviewAdmin 
          ? `<span class="verified-badge custom-badge is-animated" style="${badgeStyle({ badgeColor:'#2fa8e0', badgeColor2:'#0f2a45', badgeTextColor:'#ffffff', badgeGlowColor:'#2fa8e0', badgeGradient:true })}">ADMIN RASMI</span>` 
          : `<span class="verified-badge">Verified</span>`;

      const card=document.createElement("div");
      card.className="review-card"+(data.pinned===true?" is-pinned":"");
      card.dataset.reviewId = id;
      card.style.animationDelay=`${i*36}ms`;
      card.innerHTML=`
        <div class="avatar" style="background:${warna}">${avatarInner}</div>
        <div class="review-content">
          <div class="review-header">
            <div class="buyer-name-container">
              ${data.pinned===true?`<span class="pin-badge">📌 Disematkan</span>`:""}
              <span class="${nameClass(data)}" style="${nameStyle(data, isReviewAdmin)}">${escapeHtml(namaDisorok)}</span>
              ${medalMarkup(data)}
              ${(rawBintang<0||rawBintang>5)?`<span style="background:linear-gradient(90deg,#f0a500,#e05252);color:#fff;font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:10px;letter-spacing:.3px;">${rawBintang} Bintang</span>`:""}
              ${verifiedTag}
              ${gunaCadangan?`<span class="suggestion-badge">cdg</span>`:""}
            </div>
            <div class="star-display">${starHtml}</div>
          </div>
          <div class="buyer-time">${masa}</div>
          ${adaUlasan
            ?`<p class="buyer-feedback${gunaTextToggle && !textMulaBuka ? " is-collapsed" : ""}" style="--review-lines:${textLines};">${formatMessageText(data.ulasan)}</p>
              ${gunaTextToggle ? `<button class="review-text-toggle" type="button" style="--toggle-color:${toggleColor};" data-open="${textMulaBuka ? "1" : "0"}" data-expand="${escapeHtml(expandLabel)}" data-collapse="${escapeHtml(collapseLabel)}">${escapeHtml(textMulaBuka ? collapseLabel : expandLabel)}</button>` : ""}`
            :`<p class="buyer-no-text">— Tiada ulasan teks —</p>`}
          <div class="admin-review-edit-form">
            <textarea maxlength="500" placeholder="Edit ulasan pelanggan...">${escapeHtml(data.ulasan || "")}</textarea>
            <div class="admin-reply-form-actions">
              <button class="btn-simpan-edit-ulasan">Simpan Ulasan</button>
              <button class="btn-batal-edit-ulasan">Batal</button>
            </div>
          </div>
          <div class="admin-time-edit-form">
            <input type="datetime-local" value="${escapeHtml(timestampToDatetimeLocal(data.diciptaPada))}">
            <div class="admin-reply-form-actions">
              <button class="btn-simpan-edit-masa">Simpan Masa</button>
              <button class="btn-batal-edit-masa">Batal</button>
            </div>
          </div>
          ${adaFeedbackImg?`<button class="btn-see-feedback" type="button">See image</button>`:""}
          ${adaBalasan?`
          <button class="admin-reply-view-toggle" type="button" aria-expanded="false">Balasan admin ↓</button>
          <div class="admin-reply-box">
            <div class="admin-reply-header">
              <img src="https://i.imgur.com/cLPulXQ.png" class="admin-reply-avatar" alt="Admin">
              <p class="admin-reply-label">H4SX STORE</p>
            </div>
            <p class="admin-reply-text">${formatMessageText(data.balasanAdmin)}</p>
            <p class="admin-reply-time">${masaBalasan}</p>
          </div>`:""}
          <div class="admin-reply-form-actions" style="margin-top:6px;${adminOk()?"":"display:none;"}" data-admin-ctrl-row>
            <button class="reply-toggle-btn admin-action-btn admin-action-edit" title="Edit balasan">${adaBalasan?"Edit":"Balas"}</button>
            <button class="btn-edit-ulasan admin-action-btn admin-action-review" title="Edit ulasan pelanggan">Edit Ulasan</button>
            <button class="btn-edit-masa admin-action-btn admin-action-time" title="Edit tarikh masa">Masa</button>
            <button class="btn-profile-ulasan admin-action-btn admin-action-profile" title="Edit nama, profil dan pingat">Profile</button>
            <button class="btn-pin-ulasan admin-action-btn admin-action-pin${data.pinned===true?" is-active":""}" title="Semat ulasan">${data.pinned===true?"Unpin":"Pin"}</button>
            <button class="btn-badge-ulasan admin-action-btn admin-action-badge" title="Edit role badge">Role</button>
            <button class="btn-padam-ulasan admin-action-btn admin-action-delete" title="Padam ulasan">Del</button>
          </div>
          <div class="admin-reply-form">
            <textarea maxlength="400" placeholder="Taip balasan rasmi H4SX STORE...">${adaBalasan?escapeHtml(data.balasanAdmin):""}</textarea>
            <div class="admin-reply-form-actions">
              <button class="btn-hantar-balasan">Hantar Balasan</button>
              <button class="btn-batal-balasan">Batal</button>
            </div>
          </div>
        </div>`;
      kotakPaparan.appendChild(card);

      const form=card.querySelector(".admin-reply-form");
      const ta=form.querySelector("textarea");
      const btnH=form.querySelector(".btn-hantar-balasan");
      const btnB=form.querySelector(".btn-batal-balasan");
      const toggleB=card.querySelector(".reply-toggle-btn");
      const editReviewForm=card.querySelector(".admin-review-edit-form");
      const editReviewTa=editReviewForm.querySelector("textarea");
      const btnEditReview=card.querySelector(".btn-edit-ulasan");
      const btnSaveEditReview=card.querySelector(".btn-simpan-edit-ulasan");
      const btnCancelEditReview=card.querySelector(".btn-batal-edit-ulasan");
      const editTimeForm=card.querySelector(".admin-time-edit-form");
      const editTimeInput=editTimeForm.querySelector("input");
      const btnEditTime=card.querySelector(".btn-edit-masa");
      const btnSaveEditTime=card.querySelector(".btn-simpan-edit-masa");
      const btnCancelEditTime=card.querySelector(".btn-batal-edit-masa");
      const btnPadam=card.querySelector(".btn-padam-ulasan");
      const btnPin=card.querySelector(".btn-pin-ulasan");
      const btnProfile=card.querySelector(".btn-profile-ulasan");
      const btnBadge=card.querySelector(".btn-badge-ulasan");
      const btnSeeFeedback=card.querySelector(".btn-see-feedback");
      const btnReplyView=card.querySelector(".admin-reply-view-toggle");
      const btnTextToggle=card.querySelector(".review-text-toggle");
      if (btnTextToggle) {
        const feedbackText = card.querySelector(".buyer-feedback");
        btnTextToggle.addEventListener("click", () => {
          const open = btnTextToggle.dataset.open !== "1";
          btnTextToggle.dataset.open = open ? "1" : "0";
          feedbackText.classList.toggle("is-collapsed", !open);
          btnTextToggle.textContent = open ? btnTextToggle.dataset.collapse : btnTextToggle.dataset.expand;
          btnTextToggle.setAttribute("aria-expanded", open ? "true" : "false");
        });
      }
      if (btnSeeFeedback) btnSeeFeedback.addEventListener("click", () => openFeedbackImage(data.feedbackImg));
      if (btnReplyView) {
        const replyBox = card.querySelector(".admin-reply-box");
        btnReplyView.addEventListener("click", () => {
          const open = replyBox.classList.toggle("show");
          btnReplyView.setAttribute("aria-expanded", open ? "true" : "false");
          btnReplyView.textContent = open ? "Tutup balasan ↑" : "Balasan admin ↓";
        });
      }
      toggleB.addEventListener("click",()=>{ if(!mintaAdmin())return; form.classList.toggle("show"); if(form.classList.contains("show"))ta.focus(); });
      btnB.addEventListener("click",()=>form.classList.remove("show"));
      btnH.addEventListener("click",()=>hantarBalasan(id,ta.value,btnH));
      btnEditReview.addEventListener("click",()=>{
        if(!mintaAdmin())return;
        editReviewForm.classList.toggle("show");
        if(editReviewForm.classList.contains("show")) editReviewTa.focus();
      });
      btnCancelEditReview.addEventListener("click",()=>editReviewForm.classList.remove("show"));
      btnSaveEditReview.addEventListener("click",()=>simpanEditUlasan(id, editReviewTa.value, btnSaveEditReview, data));
      btnEditTime.addEventListener("click",()=>{
        if(!mintaAdmin())return;
        editTimeForm.classList.toggle("show");
        if(editTimeForm.classList.contains("show")) editTimeInput.focus();
      });
      btnCancelEditTime.addEventListener("click",()=>editTimeForm.classList.remove("show"));
      btnSaveEditTime.addEventListener("click",()=>simpanEditMasa(id, editTimeInput.value, btnSaveEditTime, data));
      btnBadge.addEventListener("click", ()=>{
        if(!mintaAdmin())return;
        bukaBadgeModal(id, data.badgeText, data.badgeColor, data.badgeTextColor, data.badgeColor2, data.badgeGradient, data.badgeAnimated, data.badgeGlowColor);
      });
      btnProfile.addEventListener("click", ()=>{
        if(!mintaAdmin())return;
        bukaCustomerModal(id, data);
      });
      btnPin.addEventListener("click", async ()=>{
        if(!mintaAdmin())return;
        const nakPin = data.pinned!==true;
        btnPin.disabled=true; btnPin.textContent = nakPin ? "Menyemat..." : "Membuang pin...";
        try {
          const payload = nakPin
            ? { pinned:true, pinnedAt:serverTimestamp() }
            : { pinned:false, pinnedAt:null };
          // Rules 'update' anda wajibkan balasanAdmin sentiasa string sah (1-400 aksara).
          // Kalau ulasan lama ni tak pernah dapat balasan lagi, isi dulu auto-reply
          // supaya update pin ni tak ditolak oleh Firestore rules.
          if (!data.balasanAdmin?.trim()) {
            payload.balasanAdmin = buildAutoReply(data.nama);
            payload.balasanPada = serverTimestamp();
          }
          await updateDoc(doc(db,"ratings",id), payload);
          showToast(nakPin ? "Ulasan berjaya disematkan. 📌" : "Pin dibuang.", "success");
        } catch(err) {
          console.error(err);
          showToast("Gagal kemaskini pin.", "error");
        } finally {
          btnPin.disabled=false;
        }
      });
      btnPadam.addEventListener("click", async ()=>{
        if(!mintaAdmin())return;
        if(!confirm(`Padam ulasan daripada "${rawNama}" ni? Tindakan ni tak boleh diundur.`)) return;
        btnPadam.disabled=true; btnPadam.textContent="Memadam...";
        try {
          await deleteDoc(doc(db,"ratings",id));
          showToast("Ulasan berjaya dipadam.", "success");
        } catch(err) {
          console.error(err);
          showToast("Gagal padam ulasan.", "error");
          btnPadam.disabled=false; btnPadam.textContent="Del";
        }
      });
    });
  }

  function reviewDateText(data) {
    if (!data.diciptaPada) return "Baru sahaja";
    try {
      return data.diciptaPada.toDate().toLocaleDateString("ms-MY", { day:"numeric", month:"short", year:"numeric" });
    } catch(e) {
      return "Baru sahaja";
    }
  }
  function makeScreenshotReviewCard(data) {
    const rawNama = data.nama || "Pelanggan Misteri";
    const score = clampBintang(data.bintang);
    const warna = data.warnaProfil || warnaAuto(rawNama);
    const avatarIsi = data.emojiProfil || rawNama.charAt(0).toUpperCase();
    const avatar = data.profileImg ? `<img src="${escapeHtml(data.profileImg)}" alt="">` : escapeHtml(avatarIsi);
    const stars = "★".repeat(score) + "☆".repeat(5-score);
    const text = data.ulasan && data.ulasan !== "Tiada ulasan ditinggalkan."
      ? data.ulasan
      : "Rating sahaja, tiada ulasan teks.";
    const badge = data.badgeText?.trim() ? data.badgeText : "Verified";
    const replied = !!(data.balasanAdmin?.trim());
    const cleanText = text.length > 150 ? text.slice(0, 150).trim() + "..." : text;
    return `
      <div class="ss-review-card">
        <div class="ss-review-top">
          <div class="ss-avatar" style="background:${warna}">${avatar}</div>
          <div class="ss-review-meta">
            <div class="ss-review-name">${escapeHtml(rawNama)}</div>
            <div class="ss-review-date">${reviewDateText(data)}</div>
          </div>
          <span class="ss-badge">${escapeHtml(badge)}</span>
        </div>
        <div class="ss-stars">${stars}</div>
        <div class="ss-review-text">${formatMessageText(cleanText)}</div>
        ${replied ? `<div class="ss-admin-responded">Admin responded</div>` : ""}
      </div>`;
  }
  function getVisibleReviewList() {
    const byId = new Map(allDocs.map(item => [item.id, item]));
    const boxRect = kotakPaparan.getBoundingClientRect();
    const cards = [...kotakPaparan.querySelectorAll(".review-card")];
    const firstVisibleIndex = cards.findIndex(card => {
      const rect = card.getBoundingClientRect();
      const overlap = Math.min(rect.bottom, boxRect.bottom) - Math.max(rect.top, boxRect.top);
      return overlap > 24;
    });
    const startIndex = Math.max(0, firstVisibleIndex);
    const pickedCards = cards.slice(startIndex, startIndex + 6);
    return pickedCards.map(card => byId.get(card.dataset.reviewId)).filter(Boolean);
  }
  function canvasToPngBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas blob kosong"));
      }, "image/png");
    });
  }
  function downloadCanvasFallback(canvas) {
    const a = document.createElement("a");
    a.download = `h4sx-reviews-${Date.now()}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }
  async function copyReviewScreenshot() {
    if (!window.html2canvas) {
      showToast("Library screenshot belum siap dimuat. Cuba tekan sekali lagi.", "error");
      return;
    }
    const list = getVisibleReviewList();
    if (!list.length) {
      showToast("Tiada review yang sedang nampak untuk screenshot.", "error");
      return;
    }
    btnReviewScreenshot.disabled = true;
    btnReviewScreenshot.textContent = "Copying...";
    try {
      const board = document.createElement("div");
      board.className = "ss-capture-board";
      board.innerHTML = `
        <div class="ss-board-head">
          <img src="https://i.imgur.com/cLPulXQ.png" alt="H4SX">
          <div>
            <div class="ss-board-title">H4SX STORE Reviews</div>
            <div class="ss-board-sub">Feedback pelanggan terkini</div>
          </div>
          <div class="ss-board-stats">
            <strong>${escapeHtml(purataSkor.textContent || "0.0")}</strong>
            <span>${escapeHtml(jumlahUlasanVal.textContent || "0")} ulasan</span>
          </div>
        </div>
        <div class="ss-review-grid">${list.map(makeScreenshotReviewCard).join("")}</div>
        <div class="ss-board-foot">h4sx-store.vercel.app</div>`;
      document.body.appendChild(board);
      const canvas = await html2canvas(board, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false
      });
      board.remove();
      const blob = await canvasToPngBlob(canvas);
      if (navigator.clipboard?.write && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob })
        ]);
        showToast("Screenshot review dah dicopy ke clipboard.", "success");
      } else {
        downloadCanvasFallback(canvas);
        showToast("Browser tak support copy gambar. Screenshot dimuat turun sebagai backup.", "success");
      }
    } catch(e) {
      console.error(e);
      showToast("Gagal copy screenshot review. Cuba guna browser Chrome/Edge atau buka melalui HTTPS.", "error");
    } finally {
      btnReviewScreenshot.disabled = false;
      btnReviewScreenshot.textContent = "Copy SS";
    }
  }
  btnReviewScreenshot.addEventListener("click", copyReviewScreenshot);

  function escapeHtml(str) {
    const d=document.createElement("div"); d.textContent=str??""; return d.innerHTML;
  }
  function formatMessageText(str) {
    return escapeHtml(str ?? "")
      .replace(/\s+(?=\d+\s*:\s*H4SX-)/gi, "\n")
      .replace(/(\d+\s*:\s*)(H4SX-[A-Z0-9]+)/gi, "$1$2")
      .replace(/https?:\/\/[^\s<>"']+/gi, rawUrl => {
        const trailing = rawUrl.match(/[),.!?]+$/)?.[0] || "";
        const url = rawUrl.slice(0, rawUrl.length - trailing.length);
        return `<a class="message-link" href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${trailing}`;
      });
  }

  // -- H4SX Review Helper --------------------------------
  const reviewHelperPanel = document.getElementById("reviewHelperPanel");
  const reviewHelperBubble = document.getElementById("reviewHelperBubble");
  const reviewHelperClose = document.getElementById("reviewHelperClose");
  const reviewHelperMessages = document.getElementById("reviewHelperMessages");
  const reviewHelperInput = document.getElementById("reviewHelperInput");
  const reviewHelperSend = document.getElementById("reviewHelperSend");

  function openReviewHelper() {
    reviewHelperPanel?.classList.add("show");
    document.getElementById("reviewHelper")?.classList.add("is-open");
    reviewHelperBubble?.classList.add("hide");
    setTimeout(() => reviewHelperInput?.focus(), 80);
  }
  function closeReviewHelper() {
    reviewHelperPanel?.classList.remove("show");
    document.getElementById("reviewHelper")?.classList.remove("is-open");
    reviewHelperBubble?.classList.remove("hide");
  }
  function reviewHelperFormat(text) {
    return formatMessageText(text).replace(/\n/g, "<br>");
  }
  function appendReviewHelperMessage(type, text) {
    if (!reviewHelperMessages) return null;
    const msg = document.createElement("div");
    msg.className = `review-helper-msg ${type === "user" ? "user" : "bot"}`;
    msg.innerHTML = reviewHelperFormat(text);
    reviewHelperMessages.appendChild(msg);
    reviewHelperMessages.scrollTop = reviewHelperMessages.scrollHeight;
    return msg;
  }
  function setReviewHelperTyping(msg) {
    if (!msg) return;
    msg.classList.add("typing");
    msg.innerHTML = "<span></span><span></span><span></span>";
  }
  function typeReviewHelperMessage(msg, text) {
    if (!msg) return;
    const fullText = String(text || "");
    let index = 0;
    msg.classList.remove("typing");
    msg.textContent = "";
    const step = () => {
      index = Math.min(fullText.length, index + 12);
      msg.textContent = fullText.slice(0, index);
      reviewHelperMessages.scrollTop = reviewHelperMessages.scrollHeight;
      if (index < fullText.length) setTimeout(step, 3);
      else msg.innerHTML = reviewHelperFormat(fullText);
    };
    step();
  }
  function reviewHelperAnswer(question) {
    const q = String(question || "").toLowerCase();
    const wantsCode = /kod|code|verification|pengesahan/.test(q);
    const wantsReview = /review|ulasan|rating|bintang|hantar|cara/.test(q);
    const wantsAdmin = /admin|support|whatsapp|nombor|agent|chat/.test(q);
    const wantsMain = /website|kedai|store|utama|barang|produk|item|beli/.test(q);
    const wantsSafe = /safe|selamat|trusted|scam|tipu|legit|percaya/.test(q);
    const wantsThanks = /terima kasih|thanks|thank|tq/.test(q);
    const wantsHello = /^(hai|hi|hello|helo|weh|yo|assalam|salam)\b/.test(q.trim());

    if (wantsHello) {
      return "Hai boss. Saya helper untuk page review H4SX. Boleh tanya cara hantar ulasan, kod review, rating, link website utama atau WhatsApp admin.";
    }
    if (wantsThanks) {
      return "Sama-sama boss. Kalau nak hantar review, pastikan ada kod pengesahan dan pilih rating yang betul.";
    }
    if (wantsCode) {
      return "Kod pengesahan review ialah kod unik daripada admin selepas pembelian. Satu kod hanya boleh digunakan untuk satu ulasan supaya review kekal sah.\n\nKalau belum ada kod, chat admin: https://wa.me/60193263016";
    }
    if (wantsReview) {
      return "Cara hantar review:\n1. Masukkan kod pengesahan.\n2. Isi nama atau username.\n3. Pilih rating bintang.\n4. Tulis ulasan jika mahu, atau kosongkan untuk rating sahaja.\n5. Tekan Hantar Ulasan.";
    }
    if (wantsSafe) {
      return "Betul boss, pembeli memang patut semak dulu. Page ni kumpul review pembeli sah dengan kod pengesahan. Kalau ragu, boleh baca ulasan pelanggan dan tanya admin sebelum beli.\n\nWhatsApp admin: https://wa.me/60193263016";
    }
    if (wantsMain) {
      return "Boleh boss. Website utama H4SX untuk tengok item dan produk:\nhttps://h4sx-store.vercel.app/\n\nPage review ni pula untuk tengok pengalaman customer:\nhttps://review-customer-six.vercel.app/";
    }
    if (wantsAdmin) {
      return "Boleh boss. Untuk tanya lanjut atau minta kod review, terus WhatsApp admin H4SX:\nhttps://wa.me/60193263016";
    }
    return "Boleh boss, saya cuba bantu. Untuk page review ni, soalan paling sesuai ialah pasal kod pengesahan, cara hantar ulasan, rating, website utama, atau WhatsApp admin.";
  }
  function askReviewHelper(text) {
    const question = String(text ?? reviewHelperInput?.value ?? "").trim();
    if (!question) { showToast("Tulis soalan dulu.", "error"); return; }
    appendReviewHelperMessage("user", question);
    if (reviewHelperInput) reviewHelperInput.value = "";
    const thinking = appendReviewHelperMessage("bot", "");
    setReviewHelperTyping(thinking);
    setTimeout(() => typeReviewHelperMessage(thinking, reviewHelperAnswer(question)), 180);
  }
  reviewHelperBubble?.addEventListener("click", openReviewHelper);
  reviewHelperClose?.addEventListener("click", closeReviewHelper);
  reviewHelperSend?.addEventListener("click", () => askReviewHelper());
  reviewHelperInput?.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      askReviewHelper();
    }
  });
  document.querySelectorAll("[data-helper-preset]").forEach(btn => {
    btn.addEventListener("click", () => askReviewHelper(btn.dataset.helperPreset || btn.textContent));
  });

  // ── Block Inspect Element & DevTools ──────────────────────────
  function blockInspect() {
    // Halang klik kanan (Right Click)
    document.addEventListener('contextmenu', e => e.preventDefault());

    // Halang shortcut keyboard popular (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U)
    document.addEventListener('keydown', e => {
      if (
        e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u')) ||
        (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
        (e.metaKey && (e.key === 'U' || e.key === 'u'))
      ) {
        e.preventDefault();
        return false;
      }
    });

    // Detect DevTools dengan console profile
    let devtoolsOpen = false;
    const element = new Image();
    Object.defineProperty(element, 'id', {
      get: function () {
        devtoolsOpen = true;
        window.location.replace("about:blank"); // Kick keluar kalau buka console
      }
    });
    setInterval(() => {
      devtoolsOpen = false;
      console.log(element);
      console.clear(); // Clear terus supaya tak nampak apa-apa
    }, 1000);

    // Detect DevTools dengan debugger
    setInterval(() => {
      const before = new Date().getTime();
      debugger;
      const after = new Date().getTime();
      if (after - before > 100) {
        // DevTools is open and paused at debugger
        document.body.innerHTML = "Akses Ditolak";
        window.location.replace("about:blank");
      }
    }, 1000);
  }
  
  // Password admin sudah tiada dalam HTML. JangagVxzrkpQAOQ8DSsC3ykhHajavKq2n block inspect secara agresif
  // supaya Firebase Auth boleh restore sesi admin tanpa UI jadi pelik.

