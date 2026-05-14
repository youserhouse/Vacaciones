// ── firebase.js ───────────────────────────────────────────────
// Inicialización de Firebase y sincronización con Firestore
//
// SEGURIDAD: Esta config es pública por diseño (web estática).
// La protección real está en:
//   1. Google Cloud Console → API Key restringida a tu dominio
//   2. Firebase Console → Firestore → Reglas de seguridad
// ─────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: "AIzaSyA1iZHd2X0xfNNxtdg8VFPGj0gNJjO7iCI",
  authDomain: "control-vacaciones-50415.firebaseapp.com",
  projectId: "control-vacaciones-50415",
  storageBucket: "control-vacaciones-50415.appspot.com",
  messagingSenderId: "158631364453",
  appId: "1:158631364453:web:4ed0af369aaaec0cbe838c"
};

try {
  firebase.initializeApp(firebaseConfig);
  diagMsg('✅ Firebase SDK cargado', '#4ade80');
} catch(e) {
  diagMsg('❌ Error SDK: ' + e.message, '#ff6666');
}

const db = firebase.firestore();
const auth = firebase.auth();
const DOC_REF = db.collection('vacaciones').doc('estado');
let isSyncing = false;
window.currentUser = null;

// Carga keys privadas desde Firestore → collection "config" → doc "secrets"
// Ejemplo: const key = await loadSecret('openai_key');
async function loadSecret(fieldName) {
  try {
    const snap = await db.collection('config').doc('secrets').get();
    if (snap.exists) {
      const val = snap.data()[fieldName];
      if (val) return val;
    }
    console.warn(`⚠️ Secret "${fieldName}" no encontrado en Firestore config/secrets`);
    return null;
  } catch(e) {
    console.warn(`⚠️ No se pudo leer secret "${fieldName}":`, e.message);
    return null;
  }
}
window.loadSecret = loadSecret;

// ── AUTH ──────────────────────────────────────────────────────
function loginWithGoogle() {
  const btn = document.getElementById('google-login-btn');
  const loading = document.getElementById('login-loading');
  const err = document.getElementById('login-error');
  btn.style.display = 'none';
  loading.style.display = 'block';
  loading.textContent = 'Conectando...';
  err.style.display = 'none';

  const provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope('email');

  auth.signInWithPopup(provider)
    .then(result => { console.log('Login OK:', result.user.email); })
    .catch(popupError => {
      console.warn('Popup failed, trying redirect:', popupError.code);
      if (['auth/popup-blocked','auth/popup-closed-by-user','auth/cancelled-popup-request'].includes(popupError.code)) {
        auth.signInWithRedirect(provider).catch(e => {
          btn.style.display = 'flex';
          loading.style.display = 'none';
          err.textContent = 'Error: ' + e.message;
          err.style.display = 'block';
        });
      } else {
        btn.style.display = 'flex';
        loading.style.display = 'none';
        err.textContent = 'Error: ' + popupError.message;
        err.style.display = 'block';
      }
    });
}

auth.getRedirectResult().then(result => {
  if (result && result.user) console.log('Redirect login OK:', result.user.email);
}).catch(e => {
  if (e.code !== 'auth/no-auth-event') console.warn('Redirect error:', e.message);
});

function logoutUser() { auth.signOut(); }

auth.onAuthStateChanged(user => {
  const loginScreen = document.getElementById('login-screen');
  const logoutBtn = document.getElementById('logout-btn');
  if (user) {
    window.currentUser = user;
    if (loginScreen) loginScreen.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
    startSync();
  } else {
    auth.signInAnonymously().catch(e => {
      console.warn('Anonymous auth failed:', e.message);
      if (loginScreen) loginScreen.style.display = 'none';
      startSync();
    });
  }
});

// ── FIRESTORE ─────────────────────────────────────────────────
window.saveToFirebase = async function() {
  if (!window.currentUser) {
    diagMsg('⚠️ Sin sesión — no se guarda', '#f5a623');
    return;
  }
  try {
    showSync('Guardando...');
    const s = window.state;
    const data = JSON.parse(JSON.stringify(s));
    delete data.selectedColor;
    delete data.activeFilters;
    if (Array.isArray(data.compatibleRoles)) {
      data.compatibleRoles = JSON.stringify(data.compatibleRoles);
    }
    await DOC_REF.set(data);
    diagMsg('✅ Guardado en Firebase', '#4ade80');
    setTimeout(hideSync, 1200);
    setTimeout(() => {
      const d = document.getElementById('firebase-diag');
      if (d) d.style.display = 'none';
    }, 3000);
  } catch(e) {
    diagMsg('❌ Error al guardar: ' + e.message, '#ff6666');
    console.error('Firebase save error:', e);
    hideSync();
  }
};

function mergeRemoteState(remote) {
  if (!remote) return;
  isSyncing = true;
  if (remote.employees) state.employees = remote.employees;
  if (remote.marks) state.marks = remote.marks;
  if (remote.festivos) state.festivos = remote.festivos;
  if (remote.nextId) state.nextId = remote.nextId;
  if (remote.conflictThreshold) state.conflictThreshold = remote.conflictThreshold;
  if (remote.conflictThresholdTotal) state.conflictThresholdTotal = remote.conflictThresholdTotal;
  if (remote.customRoles) state.customRoles = remote.customRoles;
  if (remote.compatibleRoles) {
    try {
      state.compatibleRoles = typeof remote.compatibleRoles === 'string'
        ? JSON.parse(remote.compatibleRoles)
        : remote.compatibleRoles;
    } catch(e) { state.compatibleRoles = [['Encargado','Piker']]; }
  }
  if (remote.theme) { state.theme = remote.theme; if (window.applyTheme) window.applyTheme(); }
  window.state = state;
  localStorage.setItem('vac-app-v3', JSON.stringify(state));
  setTimeout(() => { isSyncing = false; }, 500);
}

async function startSync() {
  showSync('Conectando...');
  diagMsg('🔄 Conectando a Firestore...', '#f5a623');
  try {
    const snap = await DOC_REF.get();
    if (snap.exists) {
      mergeRemoteState(snap.data());
      if (window.showView) {
        const activeTab = document.querySelector('.tab-btn.active');
        const idx = activeTab ? [...document.querySelectorAll('.tab-btn')].indexOf(activeTab) : 0;
        window.showView(['dashboard','annual','monthly'][idx]);
      }
      diagMsg('✅ Datos cargados', '#4ade80');
    } else {
      diagMsg('✅ Conectado — base de datos vacía', '#4ade80');
    }
    hideSync();
    setTimeout(() => {
      const d = document.getElementById('firebase-diag');
      if (d) d.style.display = 'none';
    }, 4000);
  } catch(e) {
    diagMsg('❌ Error Firestore: ' + e.message, '#ff6666');
    hideSync();
  }

  DOC_REF.onSnapshot(snap => {
    if (!snap.exists || isSyncing) return;
    mergeRemoteState(snap.data());
    if (window.showView) {
      const activeTab = document.querySelector('.tab-btn.active');
      const idx = activeTab ? [...document.querySelectorAll('.tab-btn')].indexOf(activeTab) : 0;
      window.showView(['dashboard','annual','monthly'][idx]);
    }
    showSync('✓ Sincronizado');
    setTimeout(hideSync, 1500);
  }, err => {
    console.warn('Firestore error:', err);
    hideSync();
  });
}
