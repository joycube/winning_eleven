// app/api/push/route.ts
// 🔒 [Critical 패치 v4] Firebase ID Token 인증 + ADMIN 권한 검증 (C1)
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
 * 요청 헤더의 Authorization: Bearer <ID Token> 을 검증하고
 * 해당 사용자가 ADMIN 권한을 가졌는지 확인합니다.
 * - 일반 유저가 호출하면 403 으로 거부
 * - 토큰이 없거나 만료/위조면 401 로 거부
 */
async function verifyAdminRequest(request: Request): Promise<{ ok: true; uid: string } | { ok: false; status: number; message: string }> {
  // 1. Authorization 헤더 파싱
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, message: '인증 토큰이 누락되었습니다.' };
  }
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) {
    return { ok: false, status: 401, message: '인증 토큰이 비어 있습니다.' };
  }

  // 2. Firebase ID Token 검증
  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch (err) {
    console.error('ID Token 검증 실패:', err);
    return { ok: false, status: 401, message: '유효하지 않은 토큰입니다.' };
  }

  // 3. ADMIN 권한 확인 (user_accounts/{uid}.role === 'ADMIN')
  try {
    const userDoc = await admin.firestore().collection('user_accounts').doc(decoded.uid).get();
    const role = userDoc.exists ? (userDoc.data() as any)?.role : null;
    if (role !== 'ADMIN') {
      return { ok: false, status: 403, message: '관리자 권한이 필요합니다.' };
    }
  } catch (err) {
    console.error('권한 조회 실패:', err);
    return { ok: false, status: 500, message: '권한 확인 중 오류가 발생했습니다.' };
  }

  return { ok: true, uid: decoded.uid };
}

export async function POST(request: Request) {
  try {
    // 🔒 인증 검증 (ADMIN 만 푸시 발송 허용)
    const auth = await verifyAdminRequest(request);
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
