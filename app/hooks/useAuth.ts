"use client"; // 🔥 Next.js에게 "이 파일은 브라우저에서만 실행해!"라고 알려주는 마법의 한 줄입니다.

import { useState, useEffect } from 'react';
import { auth, db, googleProvider } from '../firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'GUEST' | 'PENDING' | 'MEMBER' | 'ADMIN';
  mappedOwnerId?: string | null; // 기존 오너 데이터와 연결될 ID
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 🔥 auth 모듈이 미처 로드되지 않았을 때의 에러를 방지하는 방어 코드
    if (!auth) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // DB에서 해당 유저 정보 가져오기
        const userDocRef = doc(db, 'user_accounts', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          setAuthUser(userDoc.data() as AuthUser);
        } else {
          // 최초 로그인 시 PENDING(대기) 상태로 DB에 등록!
          const newAuthUser: AuthUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'Unknown',
            photoURL: firebaseUser.photoURL || '',
            role: 'PENDING',
            mappedOwnerId: null
          };
          await setDoc(userDocRef, newAuthUser);
          setAuthUser(newAuthUser);
        }
      } else {
        setAuthUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    if (!auth) return; // 🔥 방어 코드
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Google Login Error:", error);
    }
  };

  const logout = async () => {
    if (!auth) return; // 🔥 방어 코드
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  return { user, authUser, isLoading, loginWithGoogle, logout };
};