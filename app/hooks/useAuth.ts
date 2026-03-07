"use client"; // 🔥 Next.js에게 "이 파일은 브라우저에서만 실행해!"라고 알려주는 마법의 한 줄입니다.

import { useState, useEffect } from 'react';
import { auth, db, googleProvider } from '../firebase';
// 🔥 [수정] 모바일 사파리 방어를 위해 signInWithRedirect, getRedirectResult 추가 임포트
import { signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, User } from 'firebase/auth';
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

    // 🔥 [추가] 모바일 Redirect 로그인 후 돌아왔을 때 발생할 수 있는 에러를 조용히 처리해주는 배관
    getRedirectResult(auth).catch((error) => {
      console.error("Redirect Login Error:", error);
    });

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
      // 🔥 [핵심 픽스] 현재 접속한 기기가 모바일(아이폰/안드로이드)인지 판별합니다.
      const isMobile = /iPhone|iPad|iPod|Android/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');

      if (isMobile) {
        // 📱 모바일/사파리 환경: 팝업 차단을 피하기 위해 화면 전체가 넘어가는 Redirect 방식 사용!
        await signInWithRedirect(auth, googleProvider);
      } else {
        // 💻 PC 환경: 기존처럼 부드러운 Popup 방식 사용
        await signInWithPopup(auth, googleProvider);
      }
    } catch (error: any) {
      console.error("Google Login Error:", error);
      // 만약 PC 환경인데도 브라우저 설정 때문에 팝업이 차단되었다면, 강제로 Redirect 방식으로 우회 실행!
      if (error.code === 'auth/popup-blocked') {
        console.warn("팝업이 차단되어 Redirect 방식으로 재시도합니다.");
        await signInWithRedirect(auth, googleProvider);
      }
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