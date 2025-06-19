// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAdY4Q-PV0G3FV44gkRs57ZRZ6yweZ27RI",
  authDomain: "recetas-con-lo-que-tengas.firebaseapp.com",
  projectId: "recetas-con-lo-que-tengas",
  storageBucket: "recetas-con-lo-que-tengas.firebasestorage.app",
  messagingSenderId: "933458426959",
  appId: "1:933458426959:web:713fafb8d825ec1fbc3e3a",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export default app;