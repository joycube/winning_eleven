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
        <>
            {/* 🔥 아래에서 위로 부드럽게 올라오는 커스텀 애니메이션 */}
            <style>{`
                @keyframes slideUpFade {
                    0% { transform: translateY(100%); opacity: 0; }
                    100% { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-up {
                    animation: slideUpFade 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>
            
            <div className="fixed bottom-6 left-4 right-4 z-[99999] bg-[#0f172a] border border-slate-700 p-6 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] animate-slide-up flex flex-col items-center text-center relative">
                
                {/* 우측 상단 X 버튼 */}
                <button 
                    onClick={() => setShowIOSPopup(false)} 
                    className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 rounded-full w-7 h-7 flex items-center justify-center text-[11px] font-bold shadow-inner transition-colors"
                    title="닫기"
                >
                    ✕
                </button>

                {/* 타이틀 영역 (중앙 정렬) */}
                <h3 className="text-yellow-500 font-black text-[15px] flex items-center justify-center gap-1.5 tracking-widest mb-4 mt-2">
                    <span className="text-lg pb-0.5">🚨</span> 서비스 이용 안내
                </h3>
                
                {/* 안내 문구 (중앙 정렬) */}
                <p className="text-slate-300 text-[13px] font-medium leading-relaxed mb-6 break-keep px-2">
                    인앱 상태에서는 구글 로그인에 제한이 있을 수도 있습니다.<br/>
                    외부 브라우저를 사용하시면 더 쾌적하게 이용할 수 있습니다.
                </p>
                
                {/* 하단 팝업 닫기 버튼 (중앙 정렬) */}
                <button 
                    onClick={() => setShowIOSPopup(false)} 
                    className="w-2/3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[13px] font-bold py-3 rounded-2xl transition-colors border border-slate-700 shadow-sm"
                >
                    팝업 닫기
                </button>

            </div>
        </>
    );
}