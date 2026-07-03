import { initializeApp }   from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
  import {
    getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
  } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
  import {
    getFirestore, collection, addDoc, onSnapshot,
    query, orderBy, serverTimestamp,
    doc, getDoc, setDoc, deleteDoc, updateDoc
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

  // ── Butang scroll terus ke bahagian ulasan ──────────────────────
  document.getElementById('btnScrollUlasan')?.addEventListener('click', () => {
    const sasaran = document.querySelector('.reviews-col-title') || document.getElementById('kotakPaparan');
    sasaran?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ── Admin gate ────────────────────────────────────────────────
  const ADMIN_UIDS = ["LWRN6IDv4OV1PZd7Vldgp6F9pdH3"];
  let currentUser = null;
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
  const HARI_MS = ["ahad","isnin","selasa","rabu","khamis","jumaat","sabtu"];

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

  function paparKedaiTutup(icon, tajuk, mesej, jamTeks) {
    const iconEl = document.querySelector('#shopClosedOverlay > div > div:first-child');
    if (iconEl) iconEl.textContent = icon;
    document.querySelector('.shop-closed-title').textContent = tajuk;
    document.getElementById('shopClosedMsg').textContent = mesej;
    const timeEl = document.getElementById('shopClosedTime');
    if (jamTeks) {
      timeEl.textContent = '🕐 ' + jamTeks;
      timeEl.style.display = 'inline-block';
    } else {
      timeEl.style.display = 'none';
    }
    document.getElementById('shopClosedOverlay').classList.add('active');
  }

  async function semakStatusKedai() {
    try {
      const res = await fetch('https://gist.githubusercontent.com/amirpoyo1982-a11y/5ed3872290715d7833e788c7b0014f79/raw/kedai.json?t=' + Date.now(), { cache: "no-store" });
      const data = await res.json();

      // 1. Mod penyelenggaraan — paling utama
      if (data && data.maintenance === true) {
        paparKedaiTutup('🛠️', 'Dalam Penyelenggaraan', 'Kedai sedang dalam penyelenggaraan buat masa ini. Sila cuba lagi sebentar lagi.', data.business_hours_text);
        return;
      }

      // 2. Suis manual admin — bukakedai:false = tutup terus, tak kira jam
      if (data && data.bukakedai === false) {
        paparKedaiTutup('🚫', 'Kedai Ditutup Sementara', 'Kami sedang berehat. Sila kembali kemudian.', data.business_hours_text);
        return;
      }

      // 3. Hari cuti (tutup_hari)
      const hariIni = HARI_MS[new Date().getDay()];
      if (data && Array.isArray(data.tutup_hari) && data.tutup_hari.some(h => (h||"").toLowerCase() === hariIni)) {
        paparKedaiTutup('📅', 'Kedai Tutup Hari Ini', 'Kami tidak beroperasi pada hari ini.', data.business_hours_text);
        return;
      }

      // 4. Di luar waktu operasi (buka_jam / tutup_jam)
      if (data && !semakDalamWaktu(data.buka_jam, data.tutup_jam)) {
        paparKedaiTutup('🕐', 'Di Luar Waktu Operasi', 'Kami sedang tutup buat masa ini. Sila kembali semasa waktu operasi kami.', data.business_hours_text);
        return;
      }

      // Semua ok — kedai buka
      document.getElementById('shopClosedOverlay').classList.remove('active');
    } catch (e) { console.log('Gagal semak status kedai', e); }
  }
  semakStatusKedai();
  setInterval(semakStatusKedai, 60000); // Semak setiap 1 minit

  // ── Announcement Bar (Firebase) ───────────────────────────────
  const topAnnounceEl = document.getElementById('topAnnouncement');
  const announceTextWrap = document.getElementById('announcementTextWrap');
  const announcementTitle = document.getElementById('announcementTitle');
  const announcementFullText = document.getElementById('announcementFullText');
  const announcementToggle = document.getElementById('announcementToggle');
  const DEFAULT_ANNOUNCEMENT_TEXT = `KEMASKINI SISTEM H4SX STORE

Kami telah melancarkan sistem ulasan yang lebih mantap! Sebagai tanda penghargaan kepada pelanggan setia yang telah menyokong kami sejak awal, kini setiap pembeli lama akan diberikan lencana khas: "OLD SUPPORTER".

Terima kasih atas sokongan berterusan anda kepada H4SX STORE. Kepuasan anda adalah keutamaan kami! 💙`;
  function renderAnnouncementText(text) {
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
  announcementToggle.addEventListener('click', () => {
    const expanded = topAnnounceEl.classList.toggle('expanded');
    announcementToggle.textContent = expanded ? 'Tutup' : 'Baca';
  });
  onSnapshot(doc(db, "config", "announcement"), (snap) => {
    if (snap.exists()) {
      const d = snap.data();
      renderAnnouncementText(d.text);
    } else {
      topAnnounceEl.classList.remove('show', 'expanded');
    }
  });

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

  async function simpanBadgePayload(payload, mesejBerjaya, dataDoc) {
    if (!editingBadgeId) return;
    try {
      // Rules 'update' wajibkan balasanAdmin sentiasa string sah - isi auto-reply
      // dulu kalau ulasan ni belum pernah dapat balasan.
      if (!dataDoc.balasanAdmin?.trim()) {
        payload.balasanAdmin = "Terima kasih kerana meluangkan masa memberi ulasan kepada kami! Kepuasan anda adalah keutamaan H4SX STORE. 🙏💙";
        payload.balasanPada = serverTimestamp();
      }
      await updateDoc(doc(db,"ratings",editingBadgeId), payload);
      showToast(mesejBerjaya, "success");
      tutupBadgeModal();
    } catch(err) {
      console.error(err);
      showToast("Gagal kemaskini badge.", "error");
    }
  }
  btnSaveBadge.addEventListener('click', () => {
    const teks = badgeTextInput.value.trim();
    if (!teks) { showToast("Taip teks badge dulu, atau guna 'Buang Badge'.", "error"); return; }
    const dataDoc = allDocs.find(d=>d.id===editingBadgeId) || {};
    simpanBadgePayload({
      badgeText: teks,
      badgeColor: badgeColorInput.value,
      badgeColor2: badgeColorInput2.value,
      badgeTextColor: badgeTextColorInput.value,
      badgeGlowColor: badgeGlowColorInput.value,
      badgeGradient: badgeGradientToggle.checked,
      badgeAnimated: badgeAnimatedToggle.checked
    }, "Badge berjaya disimpan!", dataDoc);
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

  // -- Admin Config Modal ────────────────────────────────────────
  const btnOpenAdminConfig = document.getElementById('btnOpenAdminConfig');
  const btnLogoutAdmin = document.getElementById('btnLogoutAdmin');
  const adminOverlayBg = document.getElementById('adminOverlayBg');
  const adminPanelModal = document.getElementById('adminPanelModal');
  const btnCloseAdmin = document.getElementById('btnCloseAdmin');
  const btnSaveAdmin = document.getElementById('btnSaveAdmin');
  const adminAnnounceText = document.getElementById('adminAnnounceText');
  const adminLoginOverlayBg = document.getElementById('adminLoginOverlayBg');
  const adminLoginModal = document.getElementById('adminLoginModal');
  const adminLoginEmail = document.getElementById('adminLoginEmail');
  const adminLoginPassword = document.getElementById('adminLoginPassword');
  const btnAdminLogin = document.getElementById('btnAdminLogin');
  const btnCancelAdminLogin = document.getElementById('btnCancelAdminLogin');

  onAuthStateChanged(auth, user => {
    currentUser = user;
    if (user && !adminOk()) {
      showToast("Akaun ini bukan admin H4SX.", "error");
      signOut(auth);
      return;
    }
    updateAdminUi();
    try { renderReviews(); } catch (e) {}
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
    adminOverlayBg.classList.add('show');
    adminPanelModal.classList.add('show');
  });

  btnCloseAdmin.addEventListener('click', () => {
    adminOverlayBg.classList.remove('show');
    adminPanelModal.classList.remove('show');
  });

  btnSaveAdmin.addEventListener('click', async () => {
    btnSaveAdmin.disabled = true; btnSaveAdmin.textContent = "Menyimpan...";
    try {
      // Kita kena pastikan document wujud, setDoc dengan merge:true adalah cara yang betul
      await setDoc(doc(db, "config", "announcement"), { text: adminAnnounceText.value.trim() }, { merge: true });
      showToast("Tetapan admin berjaya disimpan.", "success");
      btnCloseAdmin.click();
    } catch (e) {
      console.error(e);
      showToast("Gagal menyimpan tetapan. Sila semak rule Firebase.", "error");
    }
    btnSaveAdmin.disabled = false; btnSaveAdmin.textContent = "Simpan";
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
  const fileInput       = document.getElementById("fileInput");
  const dropZone        = document.getElementById("dropZone");
  const urlGambar       = document.getElementById("urlGambar");
  const btnLoadUrl      = document.getElementById("btnLoadUrl");
  const btnClearImg     = document.getElementById("btnClearImg");
  const btnDadu         = document.getElementById("btnDadu");
  const feedbackImageInput   = document.getElementById("feedbackImageInput");
  const btnPickFeedbackImage = document.getElementById("btnPickFeedbackImage");
  const btnClearFeedbackImage = document.getElementById("btnClearFeedbackImage");
  const feedbackImagePreview = document.getElementById("feedbackImagePreview");
  const feedbackImageModal = document.getElementById("feedbackImageModal");
  const feedbackImageModalImg = document.getElementById("feedbackImageModalImg");
  const btnCloseFeedbackImage = document.getElementById("btnCloseFeedbackImage");

  // ── Profile ───────────────────────────────────────────────────
  const WARNA = ['#2fa8e0','#7c5cbf','#22c47a','#f0a500','#e05252','#1a4470','#48a89e','#d96fb0'];
  const EMOJI  = ['😀','😎','🔥','🎮','👾','🐉','⚡','💎'];
  let pilihanWarna = null, pilihanEmoji = null, profileImgB64 = null, feedbackImgB64 = null;
  const NAMA_AUTO = [
    "Aiman", "Hakim", "Danish", "Irfan", "Aqil", "Farish", "Arif", "Nazri",
    "Syafiq", "Ammar", "Haziq", "Danial", "Adam", "Rizqi", "Rayyan", "Naufal",
    "Izzah", "Syahira", "Alya", "Nadia", "Sofea", "Humaira", "Aina", "Maisarah",
    "Zara", "Hana", "Mia", "Qistina", "Putri", "Nurul"
  ];
  const NAMA_TAG = ["R.", "H.", "F.", "Z.", "P.", "A.", "N.", "S.", "M.", "K."];

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
    const tag = NAMA_TAG[Math.floor(Math.random() * NAMA_TAG.length)];
    namaPelanggan.value = `${nama} ${tag}`;
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
  function clearProfileImg(showMsg=true) {
    profileImgB64 = null; btnClearImg.classList.remove("show");
    fileInput.value = ""; urlGambar.value = ""; updatePreview();
    if (showMsg) showToast("Gambar profil dibuang.", "info");
  }
  btnClearImg.addEventListener("click", ()=>clearProfileImg(true));
  fileInput.addEventListener("change", () => {
    const f = fileInput.files[0];
    if (!f) return;
    if (f.size > 5*1024*1024) { showToast("Fail terlalu besar. Max 5MB.", "error"); return; }
    const r = new FileReader();
    r.onload = e => compressImage(e.target.result, applyProfileImg);
    r.readAsDataURL(f);
  });
  dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("drag-over"); });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
  dropZone.addEventListener("drop", e => {
    e.preventDefault(); dropZone.classList.remove("drag-over");
    const f = e.dataTransfer.files[0];
    if (!f || !f.type.startsWith("image/")) { showToast("Bukan gambar.", "error"); return; }
    if (f.size > 5*1024*1024) { showToast("Fail terlalu besar.", "error"); return; }
    const r = new FileReader();
    r.onload = ev => compressImage(ev.target.result, applyProfileImg);
    r.readAsDataURL(f);
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
  const CADANGAN = {
    5:[
      "Perkhidmatan sangat memuaskan! Barang sampai cepat dan dalam keadaan sempurna. Memang akan order lagi. Syabas H4SX STORE! 🔥",
      "Seller sangat responsif dan barang berkualiti tinggi. Packaging cantik dan selamat. 5 bintang pun rasa tak cukup! Highly recommended! ⭐",
      "Laju gila proses dan penghantaran. Barang sama macam dalam gambar. H4SX STORE memang boleh dipercayai 100%. Terima kasih! 🙏",
      "First time order tapi dah terus jadi pelanggan setia. Harga berpatutan, kualiti memang top. Tak rugi langsung! 💎",
      "Best seller! Comm cepat, barang tak tipu, hantar on time. Kalau boleh bagi 10 bintang bagi je! 🚀"
    ],
    4:[
      "Keseluruhannya puas hati. Barang okay dan seller senang nak communicate. Sedikit lambat tapi faham la. 👍",
      "Produk memuaskan dan sesuai dengan harga. Packaging standard tapi barang selamat. Boleh order lagi. 🙂",
      "Seller baik dan membantu. Barang sampai dalam masa dijanjikan. Ada minor issue tapi seller selesaikan cepat.",
      "Pengalaman membeli yang menyenangkan. Komunikasi aktif dan barang mengikut spesifikasi. Satu bintang kurang sebab delay sikit.",
      "H4SX STORE ada potensi besar. Kali ni 4 bintang, next time boleh dapat 5! 😊"
    ],
    3:[
      "Barang okay tapi masa penghantaran agak lambat. Seller okay tapi perlu improve komunikasi sikit.",
      "Produk sampai dalam keadaan baik tapi packaging boleh ditingkatkan. Untuk harga yang dibayar, sesuailah.",
      "Pengalaman sederhana. Ada expectation yang tak dipenuhi tapi barang berfungsi. Mungkin order lagi.",
      "Seller respond lambat sikit. Barang pun okay-okay je. Harap H4SX boleh improve.",
      "Neutral je. Tak terlalu kecewa, tak terlalu gembira. Ada sesuatu yang kurang tapi okay lah."
    ],
    2:[
      "Agak kecewa. Masa penghantaran sangat lama dan komunikasi kurang memuaskan. Harap ada penambahbaikan.",
      "Barang sampai dalam keadaan tidak memuaskan. Seller ada tolong tapi proses panjang. Perlu improve.",
      "Penghantaran lambat, seller lambat reply. Barang tak sama macam gambar. Memang tak berapa puas hati.",
      "Ada masalah dengan order tapi nasib baik seller akhirnya settle. Belum pasti nak order lagi.",
      "Kurang puas hati. Harap H4SX ambil maklum feedback ini untuk tingkatkan perkhidmatan."
    ],
    1:[
      "Sangat kecewa. Barang lambat, seller susah nak contact, dan barang tak sesuai. Harap ada penambahbaikan segera.",
      "Pengalaman yang sangat tidak memuaskan. Semoga H4SX ambil serius feedback ni.",
      "Barang langsung tak seperti yang diiklankan. Tidak akan recommend kepada sesiapa.",
      "Proses yang sangat menyusahkan dari awal sampai akhir. Harap ada perubahan besar.",
      "Satu bintang pun rasa banyak. Pengalaman terburuk. Mohon H4SX perbaiki kualiti segera."
    ]
  };
  let lastDaduIdx = -1;
  btnDadu.addEventListener("click", () => {
    const rating = parseInt(pilihBintang.value)||5;
    const pool   = CADANGAN[rating] || CADANGAN[5];
    let idx;
    do { idx = Math.floor(Math.random()*pool.length); } while (idx===lastDaduIdx && pool.length>1);
    lastDaduIdx = idx;
    const teks = pool[idx];
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
  });

  // ── Submit ────────────────────────────────────────────────────
  butangHantar.addEventListener("click", async () => {
    const kod    = kodVerification.value.trim().toUpperCase();
    const nama   = namaPelanggan.value.trim();
    const bintang = parseInt(pilihBintang.value);
    const ulasan = ulasanPelanggan.value.trim();

    if (!kod)  return showToast("Sila masukkan Kod Pengesahan.", "error");
    if (!nama) return showToast("Sila isi nama atau username.", "error");
    if (ulasan && ulasan.length < 1) {
      return showToast("Ulasan mesti sekurang-kurangnya 10 aksara, atau kosongkan untuk rating sahaja.", "error");
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
          balasanAdmin: "Terima kasih kerana meluangkan masa memberi ulasan kepada kami! Kepuasan anda adalah keutamaan H4SX STORE. 🙏💙",
          balasanPada: serverTimestamp()
        });
      } catch(errBalasan) {
        console.error("Auto-reply gagal (ulasan tetap tersimpan):", errBalasan);
      }

      // Reset
      kodVerification.value = namaPelanggan.value = ulasanPelanggan.value = "";
      pilihBintang.value = "5";
      pilihanWarna = pilihanEmoji = null;
      document.querySelectorAll(".swatch,.emoji-opt").forEach(el=>el.classList.remove("active"));
      clearProfileImg(false); clearFeedbackImage(false); charCounter.textContent = "0 / 500"; updatePreview();

      showToast("Ulasan berjaya dihantar! Terima kasih. 🙏", "success");
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
  function renderReviews() {
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
      const adaFeedbackImg = !!(data.feedbackImg);

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
      card.style.animationDelay=`${i*36}ms`;
      card.innerHTML=`
        <div class="avatar" style="background:${warna}">${avatarInner}</div>
        <div class="review-content">
          <div class="review-header">
            <div class="buyer-name-container">
              ${data.pinned===true?`<span class="pin-badge">📌 Disematkan</span>`:""}
              <span class="buyer-name" style="${isReviewAdmin ? 'color: var(--accent);' : ''}">${escapeHtml(namaDisorok)}</span>
              ${(rawBintang<0||rawBintang>5)?`<span style="background:linear-gradient(90deg,#f0a500,#e05252);color:#fff;font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:10px;letter-spacing:.3px;">${rawBintang} Bintang</span>`:""}
              ${verifiedTag}
            </div>
            <div class="star-display">${starHtml}</div>
          </div>
          <div class="buyer-time">${masa}</div>
          ${adaUlasan
            ?`<p class="buyer-feedback">${escapeHtml(data.ulasan)}</p>`
            :`<p class="buyer-no-text">— Tiada ulasan teks —</p>`}
          ${adaFeedbackImg?`<button class="btn-see-feedback" type="button">See image</button>`:""}
          ${adaBalasan?`
          <div class="admin-reply-box">
            <div class="admin-reply-header">
              <img src="https://i.imgur.com/LjWuizN.png" class="admin-reply-avatar" alt="Admin">
              <p class="admin-reply-label">H4SX STORE</p>
            </div>
            <p class="admin-reply-text">${escapeHtml(data.balasanAdmin)}</p>
            <p class="admin-reply-time">${masaBalasan}</p>
          </div>`:""}
          <div class="admin-reply-form-actions" style="margin-top:6px;${adminOk()?"":"display:none;"}" data-admin-ctrl-row>
            <button class="reply-toggle-btn admin-action-btn admin-action-edit" title="Edit balasan">${adaBalasan?"Edit":"Balas"}</button>
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
      const btnPadam=card.querySelector(".btn-padam-ulasan");
      const btnPin=card.querySelector(".btn-pin-ulasan");
      const btnBadge=card.querySelector(".btn-badge-ulasan");
      const btnSeeFeedback=card.querySelector(".btn-see-feedback");
      if (btnSeeFeedback) btnSeeFeedback.addEventListener("click", () => openFeedbackImage(data.feedbackImg));
      toggleB.addEventListener("click",()=>{ if(!mintaAdmin())return; form.classList.toggle("show"); if(form.classList.contains("show"))ta.focus(); });
      btnB.addEventListener("click",()=>form.classList.remove("show"));
      btnH.addEventListener("click",()=>hantarBalasan(id,ta.value,btnH));
      btnBadge.addEventListener("click", ()=>{
        if(!mintaAdmin())return;
        bukaBadgeModal(id, data.badgeText, data.badgeColor, data.badgeTextColor, data.badgeColor2, data.badgeGradient, data.badgeAnimated, data.badgeGlowColor);
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
            payload.balasanAdmin = "Terima kasih kerana meluangkan masa memberi ulasan kepada kami! Kepuasan anda adalah keutamaan H4SX STORE. 🙏💙";
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

  function escapeHtml(str) {
    const d=document.createElement("div"); d.textContent=str??""; return d.innerHTML;
  }

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
