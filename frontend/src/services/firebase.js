import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  setPersistence, 
  browserSessionPersistence,
  browserLocalPersistence ,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  fetchSignInMethodsForEmail
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDzSL34p5-nUEdPET7smaiydRe64ieTM7g",
  authDomain: "fitngro-dda45.firebaseapp.com",
  projectId: "fitngro-dda45",
  storageBucket: "fitngro-dda45.firebasestorage.app",
  messagingSenderId: "402250344414",
  appId: "1:402250344414:web:60fb137f35239d0ca05f4f"
};



const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Set dual persistence
setPersistence(auth, browserLocalPersistence)
  .then(() => console.log("Local persistence enabled"))
  .catch((error) => console.error("Persistence error:", error));

export { auth, db, googleProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, fetchSignInMethodsForEmail };