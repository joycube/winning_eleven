"use client";

import { getMessaging, getToken } from "firebase/messaging";
import { doc, setDoc } from "firebase/firestore"; // 🚨 updateDoc 제거
import { db } from '../firebase'; 

export const usePushNotification = () => {
  const requestPermissionAndSaveToken = async (userUid?: string | null) => {
    try {
      // 1. 서비스 워커 지원 여부 먼저 체크
      if (!('serviceWorker' in navigator)) {
        console.warn("이 브라우저/환경에서는 푸시 알림을 지원하지 않습니다.");
        return;
      }

      // 2. 권한 요청
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        // 🚨 핵심 픽스: 길 잃은 Firebase를 위해 서비스 워커를 수동으로 직접 등록(Register) 해줍니다!
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        
        const messaging = getMessaging();
        
        // 3. 토큰 발급 시 수동으로 등록한 워커(registration)를 억지로 주입!
        const token = await getToken(messaging, { 
          vapidKey: process.env.NEXT_PUBLIC_VAPID_KEY,
          serviceWorkerRegistration: registration // 👈 바로 이 부분입니다!
        });

        if (token) {
          if (userUid) {
            // 🚨 픽스: updateDoc 대신 setDoc + merge: true 사용
            await setDoc(doc(db, "users", userUid), { 
              fcmToken: token,
              pushEnabled: true
            }, { merge: true });
          } else {
            await setDoc(doc(db, "guest_tokens", token), {
              fcmToken: token,
              createdAt: Date.now()
            }, { merge: true });
          }
          alert("알림 설정이 완료되었습니다! 🔔\n이제 새로운 소식을 놓치지 않고 받을 수 있습니다.");
        }
      } else if (permission === 'denied') {
        alert("알림 권한이 차단되어 있습니다. 브라우저 설정에서 권한을 허용해주세요.");
      }
    } catch (error) {
      console.error("푸시 알림 설정 중 오류 발생:", error);
    }
  };

  return { requestPermissionAndSaveToken };
};