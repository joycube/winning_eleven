"use client"; // 🔥 Next.js에게 "이 파일은 브라우저에서만 실행해!"라고 알려주는 마법의 한 줄입니다.

import { useState, useEffect } from 'react';
import { auth, db, googleProvider } from '../firebase';
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
    if (!auth) {
      setIsLoading(false);
      return;
    }

    // Redirect로 돌아왔을 때의 결과를 처리 (백그라운드에서 조용히 실행됨)
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
    if (!auth) return;
    
    // 🔥 기기 및 브라우저 환경 감지 (인앱 브라우저인지 확인)
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isInAppBrowser = /KAKAOTALK|Instagram|NAVER|Line|Daum|everytime/i.test(userAgent);
    
    try {
      // 1️⃣ [1차 시도] 일단 모든 기기에서 Popup을 시도합니다. (카카오톡 등 인앱 브라우저 호환 복구)
      await signInWithPopup(auth, googleProvider);
      
    } catch (error: any) {
      console.error("Google Login Error:", error);
      
      // 2️⃣ [2차 우회] 사파리 등에서 '팝업 차단(popup-blocked)' 에러를 뱉어냈을 때!
      if (error.code === 'auth/popup-blocked') {
        
        if (isInAppBrowser) {
          // 인앱 브라우저인데 팝업까지 막혔다면, 외부 브라우저로 탈출을 유도해야 합니다.
          alert("🚨 현재 앱에서는 구글 로그인이 제한되어 있습니다. 우측 하단 메뉴를 눌러 'Safari(또는 인터넷)로 열기'를 선택해주세요!");
        } else {
          // 일반 사파리/크롬인데 팝업이 막혔다면, 에러 없이 부드럽게 Redirect 방식으로 재시도합니다.
          console.warn("팝업이 차단되어 Redirect 방식으로 자동 전환합니다.");
          await signInWithRedirect(auth, googleProvider);
        }
      } else if (error.code !== 'auth/cancelled-popup-request') {
         // 사용자가 창을 그냥 닫은 게 아니라면 다른 에러 메시지 표출
         alert("로그인 중 오류가 발생했습니다. Safari 등 외부 브라우저를 이용해주세요.");
      }
    }
  };

  const logout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  return { user, authUser, isLoading, loginWithGoogle, logout };
};