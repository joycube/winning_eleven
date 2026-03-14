"use client";

import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export const ScrollToTop = () => {
    const [isVisible, setIsVisible] = useState(false);

    // 스크롤 위치 감지 (300px 이상 내려가면 버튼 표시)
    useEffect(() => {
        const toggleVisibility = () => {
            if (window.scrollY > 300) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };

        window.addEventListener('scroll', toggleVisibility);
        return () => window.removeEventListener('scroll', toggleVisibility);
    }, []);

    // 최상단으로 부드럽게 스크롤
    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        });
    };

    if (!isVisible) return null;

    return (
        <button
            onClick={scrollToTop}
            // 🔥 left-6을 right-6으로 변경하여 우측 하단으로 이동!
            className="fixed bottom-8 right-6 z-[999] p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)] border border-emerald-400 transition-all duration-300 hover:scale-110 animate-in fade-in slide-in-from-bottom-4 group"
            aria-label="최상단으로 이동"
        >
            <ArrowUp size={22} className="group-hover:-translate-y-1 transition-transform duration-300" />
        </button>
    );
};