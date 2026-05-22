// utils/pushUtil.ts
// 🔒 [Critical 패치 v4] Push API 호출 시 Firebase ID Token을 Authorization 헤더로 첨부 (C1 클라이언트측)
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase'; // firebase 셋업 파일 경로에 맞게 수정

export const sendAutoPush = async (title: string, body: string, specificToken?: string) => {
  try {
    let targetTokens: string[] = [];

    // 1. 특정 사람에게만 보낼 때 (예: 내 글에 댓글 달렸을 때)
    if (specificToken) {
      targetTokens = [specificToken];
    }
    // 2. 전체 발송일 때 (로그인 유저 + 게스트 유저 모두 긁어오기)
    else {
      // 회원 유저 토큰 가져오기
      const usersSnap = await getDocs(collection(db, 'users'));
      usersSnap.forEach(doc => {
        const data = doc.data();
        if (data.fcmToken && data.pushEnabled !== false) {
          targetTokens.push(data.fcmToken);
        }
      });

      // 게스트(비로그인) 유저 토큰 가져오기
      const guestsSnap = await getDocs(collection(db, 'guest_tokens'));
      guestsSnap.forEach(doc => {
        const data = doc.data();
        if (data.fcmToken) {
          targetTokens.push(data.fcmToken);
        }
      });
    }

    // 중복된 토큰 제거 (Vercel 에러 해결을 위해 Array.from으로 수정)
    targetTokens = Array.from(new Set(targetTokens));

    // 보낼 대상이 없으면 종료
    if (targetTokens.length === 0) return;

    // 🔒 [Critical 패치] 푸시 API는 이제 ADMIN 인증을 요구합니다.
    //   로그인된 ADMIN 사용자의 Firebase ID Token을 Authorization 헤더로 첨부.
    const currentUser = auth?.currentUser;
    if (!currentUser) {
      console.warn('푸시 발송 스킵: 로그인된 사용자가 없습니다.');
      return;
    }

    let idToken: string | null = null;
    try {
      idToken = await currentUser.getIdToken();
    } catch (e) {
      console.error('ID Token 발급 실패:', e);
      return;
    }

    if (!idToken) {
      console.warn('푸시 발송 스킵: ID Token 발급 실패.');
      return;
    }

    // 아까 만든 서버 API로 데이터 전송!
    const res = await fetch('/api/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ title, body, targetTokens }),
    });

    if (!res.ok) {
      // ADMIN이 아닌 일반 유저가 호출하면 401/403이 떨어집니다.
      // 자동 발송 흐름이므로 사용자에게 alert를 띄우지 않고 로그만 남깁니다.
      console.warn(`푸시 발송 실패 (status=${res.status})`);
      return;
    }

    console.log(`푸시 발송 요청 완료: ${targetTokens.length}명`);

  } catch (error) {
    console.error('푸시 알림 자동 발송 실패:', error);
  }
};
