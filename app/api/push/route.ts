// app/api/push/route.ts
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

export async function POST(request: Request) {
  try {
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