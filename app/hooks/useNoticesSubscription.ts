// app/hooks/useNoticesSubscription.ts
//
// 🛠️ [Day 2 분할] page.tsx 에서 분리
//   - Firestore notices 컬렉션 실시간 구독
//   - 팝업 공지 후보 추출 + "오늘 하루 보지 않기" 처리
//   - 사용자가 LockerRoom 진입 시 lastCheckedNoticeTime 갱신
//   - currentView 가 다른 곳일 때 새 공지 감지 → hasNewNotice 플래그

"use client";

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { Notice } from '../types';

export const useNoticesSubscription = (currentView: string) => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [latestPopupNotice, setLatestPopupNotice] = useState<Notice | null>(null);
  const [hideTicker, setHideTicker] = useState(false);
  const [hasNewNotice, setHasNewNotice] = useState(false);

  // 1. notices 실시간 구독
  useEffect(() => {
    const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const fetchedNotices = snap.docs.map(d => ({ id: d.id, ...d.data() } as Notice));
        setNotices(fetchedNotices);

        const popupNotice = fetchedNotices.find(n => n.isPopup);
        if (popupNotice) {
          const hideUntil = localStorage.getItem(`hide_notice_${popupNotice.id}`);
          if (hideUntil && Date.now() < Number(hideUntil)) {
            setHideTicker(true);
          } else {
            setLatestPopupNotice(popupNotice);
            setHideTicker(false);
          }
        } else {
          setLatestPopupNotice(null);
        }
      },
      (error) => {
        console.error("🚨 Error fetching notices:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  // 2. hasNewNotice 추적 (LockerRoom 진입 시 리셋, 다른 뷰면 신규 감지)
  useEffect(() => {
    if (currentView === 'LOCKERROOM') {
      localStorage.setItem('lastCheckedNoticeTime', String(Date.now()));
      setHasNewNotice(false);
    } else {
      let latestTime = 0;
      notices.forEach(n => {
        const time = new Date(n.updatedAt || n.createdAt).getTime();
        if (time > latestTime) latestTime = time;
      });
      const lastChecked = Number(localStorage.getItem('lastCheckedNoticeTime') || '0');
      if (latestTime > lastChecked) {
        setHasNewNotice(true);
      }
    }
  }, [currentView, notices]);

  const handleCloseTicker = () => {
    if (latestPopupNotice) {
      localStorage.setItem(`hide_notice_${latestPopupNotice.id}`, String(Date.now() + 86400000));
      setHideTicker(true);
    }
  };

  return {
    notices,
    latestPopupNotice,
    hideTicker,
    hasNewNotice,
    handleCloseTicker,
  };
};
