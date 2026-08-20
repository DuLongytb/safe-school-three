// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyBNUUlJXVNFACeRYsFpKy5sfyLOYBg8HN0",
    authDomain: "shieldup-f9f03.firebaseapp.com",
    projectId: "shieldup-f9f03",
    storageBucket: "shieldup-f9f03.firebasestorage.app",
    messagingSenderId: "547128386315",
    appId: "1:547128386315:web:238e10ae2498912d90b80e",
    measurementId: "G-NK8MGQMMCS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;