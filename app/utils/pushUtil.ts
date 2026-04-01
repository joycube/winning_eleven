// utils/pushUtil.ts
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase'; // firebase 셋업 파일 경로에 맞게 수정

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

    // 중복된 토큰 제거
    targetTokens = [...new Set(targetTokens)];

    // 보낼 대상이 없으면 종료
    if (targetTokens.length === 0) return;

    // 아까 만든 서버 API로 데이터 전송!
    await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, targetTokens }),
    });

    console.log(`푸시 발송 요청 완료: ${targetTokens.length}명`);

  } catch (error) {
    console.error('푸시 알림 자동 발송 실패:', error);
  }
};