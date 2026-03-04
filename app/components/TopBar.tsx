"use client";
import React from 'react';
import { Trophy, Settings, LogIn, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface TopBarProps {
  setCurrentView?: (view: any) => void;
}

export const TopBar = ({ setCurrentView }: TopBarProps) => {
    // 🔥 에러 원인 수정: signInWithGoogle -> loginWithGoogle 로 이름 매칭 완료
    const { authUser, loginWithGoogle, logout } = useAuth();

    return (
        <div className="bg-[#050b14]/95 backdrop-blur-md border-b border-slate-800/50 py-3 px-4 sm:px-6 flex justify-between items-center sticky top-0 z-50 shadow-lg">
            {/* 왼쪽: 로고 */}
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentView && setCurrentView('LOCKERROOM')}>
                <Trophy className="text-emerald-500" size={22} />
                <h1 className="text-white font-black italic tracking-tighter text-lg md:text-xl drop-shadow-md">
                    LEAGUE CENTER
                </h1>
            </div>

            {/* 오른쪽: 로그인/로그아웃 및 관리자 메뉴 */}
            <div className="flex items-center gap-4">
                {/* 🔥 마스터 관리자에게만 보이는 비밀 톱니바퀴 */}
                {authUser?.role === 'ADMIN' && setCurrentView && (
                    <button 
                        onClick={() => setCurrentView('ADMIN')} 
                        className="text-slate-400 hover:text-emerald-400 transition-colors"
                        title="관리자 마스터 페이지"
                    >
                        <Settings size={20} />
                    </button>
                )}

                {/* 로그인/로그아웃 섹션 */}
                {authUser ? (
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 pl-1 pr-3 py-1 rounded-full shadow-inner">
                            <img src={authUser.photoURL || ''} alt="Profile" className="w-6 h-6 rounded-full border border-slate-600" />
                            <span className="text-[10px] font-bold text-slate-300 truncate max-w-[80px]">{authUser.mappedOwnerId || authUser.displayName}</span>
                        </div>
                        <button onClick={logout} className="text-slate-500 hover:text-red-400 transition-colors" title="로그아웃">
                            <LogOut size={18} />
                        </button>
                    </div>
                ) : (
                    <button 
                        onClick={loginWithGoogle} 
                        className="flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/50 px-3 py-1.5 rounded-full text-xs font-black transition-all shadow-lg"
                    >
                        <LogIn size={14} /> LOGIN
                    </button>
                )}
            </div>
        </div>
    );
};