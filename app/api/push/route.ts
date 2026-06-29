// app/api/push/route.ts
// 🔒 [Critical 패치 v4] Firebase ID Token 인증 (로그인 회원이면 발송 허용)
//   - 게시글/댓글/매치톡 등 일반 회원 액션 알림을 위해 ADMIN 제한 → 로그인 회원 허용으로 완화.
//   - 게스트/비로그인은 ID Token 자체가 없어 401 로 거부됨.
import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

// 🚨 Firebase Admin 서버 초기화 (중복 방지)
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK_JSON || '{}');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error('Firebase Admin 초기화 에러:', error);
  }
}

/**
 * 요청 헤더의 Authorization: Bearer <ID Token> 을 검증합니다.
 * - 로그인된 회원(유효한 Firebase ID Token)이면 발송 허용
 * - 토큰이 없거나 만료/위조면 401 로 거부 (게스트/비로그인 차단)
 */
async function verifyAuthRequest(request: Request): Promise<{ ok: true; uid: string } | { ok: false; status: number; message: string }> {
  // 1. Authorization 헤더 파싱
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, message: '인증 토큰이 누락되었습니다.' };
  }
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) {
    return { ok: false, status: 401, message: '인증 토큰이 비어 있습니다.' };
  }

  // 2. Firebase ID Token 검증 — 통과하면 로그인된 회원으로 간주
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return { ok: true, uid: decoded.uid };
  } catch (err) {
    console.error('ID Token 검증 실패:', err);
    return { ok: false, status: 401, message: '유효하지 않은 토큰입니다.' };
  }
}

export async function POST(request: Request) {
  try {
    // 🔒 인증 검증 (로그인 회원이면 푸시 발송 허용)
    const auth = await verifyAuthRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const { title, body, targetTokens } = await request.json();

    if (!targetTokens || targetTokens.length === 0) {
      return NextResponse.json({ success: false, message: '발송할 토큰이 없습니다.' }, { status: 400 });
    }

    // 발송할 메시지 폼
    const message = {
      notification: { title, body },
      tokens: targetTokens, // 배열 형태로 여러 명에게 동시 발송
    };

    // Firebase를 통해 푸시 쏘기
    const response = await admin.messaging().sendEachForMulticast(message);
    return NextResponse.json({ success: true, response });

  } catch (error) {
    console.error('푸시 발송 에러:', error);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}
