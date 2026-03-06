"use client";
import React, { useEffect, useState } from 'react';

export default function InAppBrowserGuard() {
    const [showIOSPopup, setShowIOSPopup] = useState(false);

    useEffect(() => {
        // 유저가 접속한 브라우저 정보 가져오기
        const userAgent = navigator.userAgent.toLowerCase();
        const targetUrl = window.location.href;

        // 대표적인 인앱 브라우저 키워드 감지 (카톡, 인스타, 네이버, 라인, 다음 등)
        const isInApp = /kakaotalk|instagram|naver|line|daum/i.test(userAgent);

        if (isInApp) {
            const isAndroid = /android/i.test(userAgent);
            const isIOS = /iphone|ipad|ipod/i.test(userAgent);

            if (isAndroid) {
                // 🚀 안드로이드: 묻지도 따지지도 않고 크롬 브라우저로 강제 납치 (Intent URI)
                const intentUrl = `intent://${targetUrl.replace(/https?:\/\//i, '')}#Intent;scheme=https;package=com.android.chrome;end;`;
                window.location.href = intentUrl;
            } else if (isIOS) {
                // 🍎 iOS: 화면을 막지 않고, 부드러운 안내 팝업만 띄우기
                setShowIOSPopup(true);
            }
        }
    }, []);

    // 인앱 브라우저가 아니거나(일반 사파리/크롬), 안드로이드면 화면에 아무것도 그리지 않음
    if (!showIOSPopup) return null;

    // 아이폰 인앱 브라우저 유저에게만 하단에 띄워주는 부드러운 팝업
    return (
        <div className="fixed bottom-6 left-4 right-4 z-[99999] bg-[#0f172a] border border-slate-700 p-5 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-5">
            <div className="flex justify-between items-start mb-3">
                <h3 className="text-yellow-500 font-black text-[13px] flex items-center gap-1.5 tracking-tighter">
                    <span>🚨</span> 브라우저 환경 안내
                </h3>
                <button 
                    onClick={() => setShowIOSPopup(false)} 
                    className="text-slate-400 hover:text-white bg-slate-800 rounded-full w-6 h-6 flex items-center justify-center text-[10px] font-bold shadow-inner"
                    title="닫기"
                >
                    ✕
                </button>
            </div>
            <p className="text-slate-300 text-[12px] font-medium leading-relaxed mb-4 break-keep">
                인앱 상태에서는 구글 로그인에 제한이 있을 수도 있습니다.<br/>
                화면 하단의 <span className="text-emerald-400 font-bold">나침반 아이콘(또는 점 세개)</span>을 눌러 외부 브라우저(Safari)를 사용하시면 더 쾌적하게 이용할 수 있습니다.
            </p>
            <div className="flex gap-2">
                <button 
                    onClick={() => setShowIOSPopup(false)} 
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white text-[12px] font-bold py-3 rounded-xl transition-colors border border-slate-700 shadow-sm"
                >
                    팝업 닫고 그냥 구경하기
                </button>
            </div>
        </div>
    );
}