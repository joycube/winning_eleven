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

    // 🛠️ [UI 픽스 v2] 방어적 타임아웃 — 환경별 분기
    //   - 프로덕션 (Vercel): 30초 (Firestore/Auth 정상 응답 시간 충분히 확보 — 회귀 방지)
    //   - StackBlitz/webcontainer: 4초 (cross-origin hang 빠르게 폴백)
    const isWebContainerEnv = (() => {
      if (typeof window === 'undefined') return false;
      const host = window.location?.hostname || '';
      let isInIframe = false;
      try { isInIframe = window.self !== window.top; } catch { isInIframe = true; }
      return (
        host.includes('webcontainer.io') ||
        host.includes('stackblitz.io') ||
        host.includes('stackblitz.com') ||
        host.includes('local-credentialless') ||
        (isInIframe && host.includes('local-'))
      );
    })();
    const AUTH_TIMEOUT_MS = isWebContainerEnv ? 3000 : 30000;
    const authTimeoutRef = setTimeout(() => {
      console.warn(`[useAuth] onAuthStateChanged timeout — forcing logged-out state (env: ${isWebContainerEnv ? 'webcontainer' : 'production'})`);
      setUser(null);
      setAuthUser(null);
      setIsLoading(false);
    }, AUTH_TIMEOUT_MS);

    // Redirect로 돌아왔을 때의 결과를 처리 (백그라운드에서 조용히 실행됨)
    getRedirectResult(auth).catch((error) => {
      console.error("Redirect Login Error:", error);
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // 응답 도착 — 타임아웃 취소
      clearTimeout(authTimeoutRef);

      setUser(firebaseUser);
      if (firebaseUser) {
        // DB에서 해당 유저 정보 가져오기
        try {
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
        } catch (e) {
          // 🛠️ [UI 픽스 v2] Firestore 호출 실패해도 로딩 끝내기 (게스트 모드처럼 동작)
          console.error('[useAuth] user_accounts fetch error:', e);
          setAuthUser(null);
        }
      } else {
        setAuthUser(null);
      }
      setIsLoading(false);
    });

    return () => {
      clearTimeout(authTimeoutRef);
      unsubscribe();
    };
  }, []);

  // 🛠️ [UI 픽스 v2] StackBlitz / webcontainer 환경 감지
  //   - StackBlitz 프리뷰는 webcontainer.io 의 iframe(local-credentialless 모드)에서 동작
  //   - Firebase Auth signInWithPopup 은 cross-origin 제약으로 작동 불가
  //   - 이 환경에서는 의미 없는 에러 대신 친절한 안내 표시
  const isWebContainerPreview = (): boolean => {
    if (typeof window === 'undefined') return false;
    const host = window.location?.hostname || '';
    let isInIframe = false;
    try { isInIframe = window.self !== window.top; } catch { isInIframe = true; }
    return (
      host.includes('webcontainer.io') ||
      host.includes('stackblitz.io') ||
      host.includes('stackblitz.com') ||
      host.includes('local-credentialless') ||
      (isInIframe && host.includes('local-'))
    );
  };

  const loginWithGoogle = async () => {
    if (!auth) return;

    // 🛠️ [UI 픽스 v2] StackBlitz 프리뷰에서는 Firebase Auth 가 작동하지 않음 — 사전 안내 후 종료
    if (isWebContainerPreview()) {
      alert(
        '🧪 StackBlitz 프리뷰에서는 Google 로그인이 작동하지 않습니다.\n\n' +
        '이는 webcontainer iframe 의 cross-origin 제약으로 인한 알려진 제한입니다.\n\n' +
        '실제 배포된 사이트(Vercel)에서 테스트해주세요:\n' +
        'https://winning-eleven-rust.vercel.app/'
      );
      return;
    }

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
        // 🛠️ [UI 픽스 v2] webcontainer/iframe 환경에서 onload 후에 다른 에러 코드가 올 수도 있음 — 폴백 체크
        if (isWebContainerPreview() || error.code === 'auth/operation-not-supported-in-this-environment') {
          alert(
            '🧪 현재 환경(StackBlitz/iframe 등)에서는 Google 로그인을 지원하지 않습니다.\n' +
            '실제 배포된 사이트(Vercel)에서 테스트해주세요.'
          );
        } else {
          // 사용자가 창을 그냥 닫은 게 아니라면 다른 에러 메시지 표출
          alert("로그인 중 오류가 발생했습니다. Safari 등 외부 브라우저를 이용해주세요.");
        }
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