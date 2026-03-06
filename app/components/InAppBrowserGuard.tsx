"use client";
import React, { useEffect, useState } from 'react';

export default function InAppBrowserGuard() {
    const [showIOSPopup, setShowIOSPopup] = useState(false);

    useEffect(() => {
        // 유저가 접속한 브라우저 정보 가져오기
        const userAgent = navigator.userAgent.toLowerCase();
        const targetUrl = window.location.href;

        // 대표적인 인앱 브라우저 키워드 감지
        const isInApp = /kakaotalk|instagram|naver|line|daum/i.test(userAgent);

        if (isInApp) {
            const isAndroid = /android/i.test(userAgent);
            const isIOS = /iphone|ipad|ipod/i.test(userAgent);

            if (isAndroid) {
                // 🚀 안드로이드: 강제 크롬 브라우저 전환
                const intentUrl = `intent://${targetUrl.replace(/https?:\/\//i, '')}#Intent;scheme=https;package=com.android.chrome;end;`;
                window.location.href = intentUrl;
            } else if (isIOS) {
                // 🍎 iOS: 팝업 노출
                setShowIOSPopup(true);
            }
        }
    }, []);

    if (!showIOSPopup) return null;

    return (
        // 🔥 애니메이션 제거, bottom-5로 하단 고정, 좌우 너비 축소(max-w-[320px]), 패딩 축소(p-4 sm:p-5)
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 w-[90%] max-w-[320px] z-[99999] bg-[#0f172a] border border-slate-700 p-4 sm:p-5 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex flex-col items-center text-center">
            
            {/* 우측 상단 X 버튼 (간격 축소) */}
            <button 
                onClick={() => setShowIOSPopup(false)} 
                className="absolute top-3 right-3 text-slate-400 hover:text-white bg-slate-800 rounded-full w-6 h-6 flex items-center justify-center text-[10px] font-bold shadow-inner transition-colors"
                title="닫기"
            >
                ✕
            </button>

            {/* 타이틀 영역 (여백 축소) */}
            <h3 className="text-yellow-500 font-black text-[14px] flex items-center justify-center gap-1.5 tracking-widest mb-2">
                <span className="text-base pb-0.5">🚨</span> 서비스 이용 안내
            </h3>
            
            {/* 안내 문구 (폰트 및 상하 여백 축소) */}
            <p className="text-slate-300 text-[12px] font-medium leading-relaxed mb-4 break-keep">
                인앱 상태에서는 구글 로그인에 제한이 있을 수도 있습니다.<br/>
                외부 브라우저를 사용하시면 더 쾌적하게 이용할 수 있습니다.
            </p>
            
            {/* 하단 팝업 닫기 버튼 (크기 및 여백 축소) */}
            <button 
                onClick={() => setShowIOSPopup(false)} 
                className="w-full max-w-[200px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[12px] font-bold py-2.5 rounded-xl transition-colors border border-slate-700 shadow-sm"
            >
                팝업 닫기
            </button>

        </div>
    );
}