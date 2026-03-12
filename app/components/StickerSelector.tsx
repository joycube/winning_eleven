"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState, useRef, useEffect } from 'react';

// 🔥 [중앙 관리소] 확장된 Noto Animated Emoji 스티커팩
export const STICKER_PACK = [
    { id: 'clown', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f921/512.gif' }, 
    { id: 'point', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f449_1f3fb/512.gif' }, 
    { id: 'tongue', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f61c/512.gif' }, 
    { id: 'joy', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f602/512.gif' }, 
    { id: 'zany', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f92a/512.gif' }, 
    { id: 'smirk', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f60f/512.gif' }, 
    { id: 'alien', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f47d/512.gif' }, 
    { id: 'devil', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f608/512.gif' }, 
    { id: 'rolling_eyes', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f644/512.gif' }, 
    { id: 'shush', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f92b/512.gif' }, 
    { id: 'propeller', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f601/512.gif' }, 
    { id: 'nerd', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f913/512.gif' }, 
    { id: 'shrug', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f937/512.gif' }, 
    { id: 'salt', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f9f2/512.gif' }, 
    { id: 'soap', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f9fc/512.gif' }, 
    { id: 'megaphone', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f4e3/512.gif' }, 
    { id: 'popcorn', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f37f/512.gif' }, 
    { id: 'eyes', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f440/512.gif' }, 
    { id: 'hundred', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f4af/512.gif' }, 
    { id: 'camera', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f4f9/512.gif' }, 
    { id: 'warn', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/26a0/512.gif' }, 
    { id: 'cry', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f62d/512.gif' }, 
    { id: 'mindblown', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f92f/512.gif' }, 
    { id: 'facepalm', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f926/512.gif' }, 
    { id: 'explode', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f4a5/512.gif' }, 
    { id: 'vomit', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f922/512.gif' }, 
    { id: 'poop', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f4a9/512.gif' }, 
    { id: 'ghost', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f47b/512.gif' }, 
    { id: 'chicken', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f414/512.gif' }, 
    { id: 'party', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f389/512.gif' }, 
    { id: 'party_face', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f973/512.gif' }, 
    { id: 'fire', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif' }, 
    { id: 'trophy', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f3c6/512.gif' }, 
    { id: 'crown', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f451/512.gif' }, 
    { id: 'sunglasses', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f60e/512.gif' }, 
    { id: 'muscle', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f4aa/512.gif' }, 
    { id: 'dance', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f57a/512.gif' }, 
    { id: 'soccer', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/26bd/512.gif' }, 
    { id: 'moneybag', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f4b0/512.gif' }, 
    { id: 'credit_card', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f4b3/512.gif' }, 
    { id: 'target', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f3af/512.gif' }, 
    { id: 'boxing_glove', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f94a/512.gif' }, 
    { id: 'robot', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f916/512.gif' }, 
    { id: 'brain', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f9e0/512.gif' }, 
    { id: 'zzz', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f634/512.gif' },
    { id: 'rage', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f621/512.gif' },       
    { id: 'scream', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f631/512.gif' },     
    { id: 'cursing', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f92c/512.gif' },    
    { id: 'pleading', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f97a/512.gif' },   
    { id: 'thinking', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f914/512.gif' },   
    { id: 'yawn', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f971/512.gif' },       
    { id: 'woozy', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f974/512.gif' },      
    { id: 'hot', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f975/512.gif' },        
    { id: 'cold', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f976/512.gif' },       
    { id: 'skull', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f480/512.gif' },      
    { id: 'bomb', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f4a3/512.gif' },       
    { id: 'siren', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f6a8/512.gif' },      
    { id: 'broken_heart', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f494/512.gif' },
    { id: 'rocket', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f680/512.gif' },     
    { id: 'goat', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f410/512.gif' },       
    { id: 'stonks_up', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f4c8/512.gif' },  
    { id: 'stonks_down', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f4c9/512.gif' },
    { id: 'medal_1st', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f947/512.gif' },  
    { id: 'clap', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f44f/512.gif' },       
    { id: 'pray', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f64f/512.gif' },       
    { id: 'handshake', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f91d/512.gif' },  
    { id: 'space_invader', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f47e/512.gif' }
];

interface StickerSelectorProps {
    onSelect: (stickerUrl: string) => void;
}

export const StickerSelector = ({ onSelect }: StickerSelectorProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleStickerClick = (url: string) => {
        onSelect(url);
        setIsOpen(false); 
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <button 
                type="button" 
                onClick={() => setIsOpen(!isOpen)}
                className={`w-10 h-10 flex items-center justify-center rounded-full transition-all shadow-sm border ${isOpen ? 'bg-slate-700 border-slate-500 text-yellow-400' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400 hover:text-white'} text-xl`}
                title="스티커 보내기"
            >
                😀
            </button>

            {/* 🔥 [수술 포인트] right-0 삭제, left-0 추가, z-index 극대화(z-[100]) */}
            {isOpen && (
                <div className="absolute bottom-full left-0 mb-3 w-[280px] sm:w-72 bg-[#1e293b] border border-slate-600 rounded-2xl shadow-2xl z-[100] animate-in fade-in slide-in-from-bottom-2 overflow-hidden">
                    <div className="bg-[#0f172a] px-4 py-2.5 border-b border-slate-700 flex justify-between items-center">
                        <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">Stickers</span>
                        <button type="button" onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white text-xs font-bold w-6 h-6 flex items-center justify-center bg-slate-800 rounded-full transition-colors">✕</button>
                    </div>
                    
                    <div className="p-3 grid grid-cols-5 gap-2 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600">
                        {STICKER_PACK.map((sticker) => (
                            <button
                                key={sticker.id}
                                type="button"
                                onClick={() => handleStickerClick(sticker.url)}
                                className="w-10 h-10 flex items-center justify-center hover:bg-slate-700 bg-slate-800/50 rounded-xl transition-all hover:scale-110 active:scale-95 border border-transparent hover:border-slate-500"
                                title={sticker.id}
                            >
                                <img 
                                    src={sticker.url} 
                                    alt={sticker.id} 
                                    className="w-8 h-8 object-contain drop-shadow-md" 
                                />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StickerSelector;