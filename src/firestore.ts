import admin from "firebase-admin";
import path from "path";

// Inisialisasi Firebase Admin
const serviceAccountPath = path.resolve(__dirname, "../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
});

export const db = admin.firestore();
