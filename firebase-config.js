// ── firebase-config.js ───────────────────────────────────────
// Config pública de Firebase (no es secreta por diseño en apps web
// estáticas). Compartida por index.html, login.html y splash.html
// para evitar duplicación y desincronización al rotar claves.
//
// La protección real está en:
//   1. Google Cloud Console → API Key restringida a tu dominio
//   2. Firebase Console → Firestore → Reglas de seguridad
// ─────────────────────────────────────────────────────────────
window.firebaseConfig = {
  apiKey:            "AIzaSyA1iZHd2X0xfNNxtdg8VFPGj0gNJjO7iCI",
  authDomain:        "control-vacaciones-50415.firebaseapp.com",
  projectId:         "control-vacaciones-50415",
  storageBucket:     "control-vacaciones-50415.appspot.com",
  messagingSenderId: "158631364453",
  appId:             "1:158631364453:web:4ed0af369aaaec0cbe838c"
};
