"use client";
import React from 'react';
import { Trophy, Settings, LogIn, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface TopBarProps {
  setCurrentView?: (view: any) => void;
}

export const TopBar = ({ setCurrentView }: TopBarProps) => {
    const { authUser, loginWithGoogle, logout } = useAuth();

    return (
        <div className="bg-[#050b14]/95 backdrop-blur-md border-b border-slate-800/50 py-3 px-3 sm:px-6 flex justify-between items-center sticky top-0 z-50 shadow-lg">
            
            {/* 왼쪽: 로고 & 긴 타이틀 (모바일 깨짐 방지 레이아웃) */}
            <div className="flex items-center gap-1.5 sm:gap-2 cursor-pointer min-w-0 mr-2" onClick={() => setCurrentView && setCurrentView('LOCKERROOM')}>
                <Trophy className="text-emerald-500 shrink-0 w-4 h-4 sm:w-5 sm:h-5 md:w-[22px] md:h-[22px]" />
                <h1 className="text-white font-black italic tracking-tighter text-[12px] sm:text-[16px] md:text-xl drop-shadow-md truncate">
                    eFOOTBALL LIVE EVOLUTION
                </h1>
            </div>

            {/* 오른쪽: 로그인/로그아웃 및 관리자 메뉴 (우측 고정) */}
            <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
                {/* 🔥 마스터 관리자에게만 보이는 비밀 톱니바퀴 */}
                {authUser?.role === 'ADMIN' && setCurrentView && (
                    <button 
                        onClick={() => setCurrentView('ADMIN')} 
                        className="text-slate-400 hover:text-emerald-400 transition-colors"
                        title="관리자 마스터 페이지"
                    >
                        <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                )}

                {/* 로그인/로그아웃 섹션 */}
                {authUser ? (
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900 border border-slate-700 pl-1 pr-2.5 sm:pr-3 py-1 rounded-full shadow-inner">
                            <img src={authUser.photoURL || ''} alt="Profile" className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-slate-600 object-cover shrink-0" />
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-300 truncate max-w-[60px] sm:max-w-[80px]">
                                {authUser.mappedOwnerId || authUser.displayName}
                            </span>
                        </div>
                        <button onClick={logout} className="text-slate-500 hover:text-red-400 transition-colors shrink-0" title="로그아웃">
                            <LogOut className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                        </button>
                    </div>
                ) : (
                    <button 
                        onClick={loginWithGoogle} 
                        className="flex items-center gap-1 sm:gap-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/50 px-2.5 sm:px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-black transition-all shadow-lg shrink-0"
                    >
                        <LogIn className="w-3 h-3 sm:w-[14px] sm:h-[14px]" /> LOGIN
                    </button>
                )}
            </div>
        </div>
    );
};