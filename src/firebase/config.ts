import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDX_1Z_ZCW1FtwoerKbOqMg7QxeUBG1G10",
    authDomain: "queen-s-tutor-app.firebaseapp.com",
    projectId: "queen-s-tutor-app",
    storageBucket: "queen-s-tutor-app.firebasestorage.app",
    messagingSenderId: "885711499602",
    appId: "1:885711499602:web:e7519eb7f997e44d0d4a8b"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
