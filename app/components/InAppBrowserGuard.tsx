"use client";
import React, { useEffect, useState } from 'react';

export default function InAppBrowserGuard() {
    const [isIOSInApp, setIsIOSInApp] = useState(false);

    useEffect(() => {
        // 유저가 접속한 브라우저 정보 가져오기
        const userAgent = navigator.userAgent.toLowerCase();
        const targetUrl = window.location.href;

        // 대표적인 인앱 브라우저 키워드 감지 (카톡, 인스타, 네이버, 라인, 다음)
        const isInApp = /kakaotalk|instagram|naver|line|daum/i.test(userAgent);

        if (isInApp) {
            const isAndroid = /android/i.test(userAgent);
            const isIOS = /iphone|ipad|ipod/i.test(userAgent);

            if (isAndroid) {
                // 🚀 안드로이드: 크롬 브라우저로 강제 탈출 (Intent URI)
                const intentUrl = `intent://${targetUrl.replace(/https?:\/\//i, '')}#Intent;scheme=https;package=com.android.chrome;end;`;
                window.location.href = intentUrl;
            } else if (isIOS) {
                // 🍎 iOS: 강제 탈출이 불가능하므로 안내 화면 띄우기
                setIsIOSInApp(true);
            }
        }
    }, []);

    // 인앱 브라우저가 아니거나 안드로이드면 이 컴포넌트는 화면에 아무것도 그리지 않음 (투명 망토)
    if (!isIOSInApp) return null;

    // 아이폰 인앱 브라우저 유저에게만 보여지는 강력한 차단막 화면
    return (
        <div className="fixed inset-0 z-[99999] bg-[#0f172a] flex flex-col items-center justify-center p-6 text-center">
            <div className="text-6xl mb-6">🚨</div>
            <h2 className="text-2xl font-black text-white italic tracking-tighter mb-4 leading-tight">
                현재 카카오톡 화면에서는<br/>구글 로그인이 차단됩니다!
            </h2>
            <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl mb-8 shadow-xl">
                <p className="text-slate-300 text-sm font-medium leading-relaxed">
                    구글의 보안 정책으로 인해<br/>
                    앱 내부 화면에서는 로그인이 불가능합니다.<br/><br/>
                    화면 우측 하단(또는 상단)의 <strong className="text-emerald-400">점 세개(⋮)</strong>나 <br/>
                    <strong className="text-emerald-400">나침반 모양 아이콘</strong>을 누른 후<br/><br/>
                    <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 px-2 py-1 rounded font-black">
                        [다른 브라우저로 열기]
                    </span> 또는<br/>
                    <span className="bg-blue-500/20 text-blue-400 border border-blue-500/50 px-2 py-1 rounded font-black mt-2 inline-block">
                        [Safari로 열기]
                    </span> 를<br/>
                    선택해 주세요!
                </p>
            </div>
            <div className="animate-bounce mt-4">
                <span className="text-4xl">👇</span>
            </div>
        </div>
    );
}