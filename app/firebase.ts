import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAWo7owWvLFLcj1i9LGatdZkFgdrdvvS1k",
  authDomain: "efootball-29514.firebaseapp.com",
  projectId: "efootball-29514",
  storageBucket: "efootball-29514.firebasestorage.app",
  messagingSenderId: "692761560044",
  appId: "1:692761560044:web:3a8b22fa7801bf49ca36c9"
  // measurementId는 로그인/DB에 당장 필요 없으므로 생략했습니다.
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

// 🔥 구글 로그인 인증 모듈
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { db, auth, googleProvider };