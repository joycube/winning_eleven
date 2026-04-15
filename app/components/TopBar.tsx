"use client";
import React, { useState } from 'react'; // 🚨 useState 추가
import { Trophy, Settings, LogIn, LogOut, BellRing } from 'lucide-react'; 
import { useAuth } from '../hooks/useAuth';
import { usePushNotification } from '../hooks/usePushNotification'; 
import { useLongPress } from '../hooks/useLongPress'; // 🚨 롱프레스 훅 임포트
import { QuickArcadeDraftModal } from './QuickArcadeDraftModal'; // 🚨 히든 모달 컴포넌트 임포트

interface TopBarProps {
  setCurrentView?: (view: any) => void;
  masterTeams?: any[]; // 🚨 모달에 넘겨줄 마스터팀 데이터 프롭 추가
}

export const TopBar = ({ setCurrentView, masterTeams = [] }: TopBarProps) => {
    const { authUser, loginWithGoogle, logout } = useAuth();
    const { requestPermissionAndSaveToken } = usePushNotification(); 

    // 🚨 1. 아케이드 드래프트 모달 상태 및 롱프레스(3초) 훅 설정
    const [isArcadeDraftOpen, setIsArcadeDraftOpen] = useState(false);
    const longPressEvent = useLongPress(() => setIsArcadeDraftOpen(true), 3000);

    return (
        <>
            <div className="bg-[#050b14]/95 backdrop-blur-md border-b border-slate-800/50 py-3 px-3 sm:px-6 flex justify-between items-center sticky top-0 z-50 shadow-lg">
                
                <div className="flex items-center gap-1.5 sm:gap-2 cursor-pointer min-w-0 mr-4" onClick={() => setCurrentView && setCurrentView('LOCKERROOM')}>
                    <Trophy className="text-emerald-500 shrink-0 w-5 h-5 sm:w-6 sm:h-6 md:w-[26px] md:h-[26px]" />
                    {/* 🚨 2. 타이틀 텍스트에 롱프레스 이벤트 부착 및 텍스트 드래그 방지(select-none) */}
                    <h1 
                        {...longPressEvent}
                        className="text-white font-black italic tracking-tighter text-[14px] sm:text-[18px] md:text-[22px] drop-shadow-md truncate pr-2 select-none"
                    >
                        eFOOTBALL   Live   EVOLUTION™
                    </h1>
                </div>

                <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
                    
                    {/* 🚨 로그인 여부와 상관없이 항상 노출되는 알림 켜기 버튼 */}
                    <button 
                        onClick={() => requestPermissionAndSaveToken(authUser?.uid)}
                        className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-emerald-400 transition-colors shrink-0 shadow-sm"
                        title="실시간 알림 켜기"
                    >
                        <BellRing size={14} className="sm:w-[16px] sm:h-[16px]" />
                    </button>

                    {authUser?.role === 'ADMIN' && setCurrentView && (
                        <button 
                            onClick={() => setCurrentView('ADMIN')} 
                            className="text-slate-400 hover:text-emerald-400 transition-colors shrink-0"
                            title="관리자 마스터 페이지"
                        >
                            <Settings className="w-5 h-5 sm:w-[22px] sm:h-[22px]" />
                        </button>
                    )}

                    {authUser ? (
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900 border border-slate-700 pl-1 pr-2.5 sm:pr-3 py-1 rounded-full shadow-inner">
                                <img src={authUser.photoURL || ''} alt="Profile" className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border border-slate-600 object-cover shrink-0" />
                                <span className="text-[10px] sm:text-[11px] font-bold text-slate-300 truncate max-w-[70px] sm:max-w-[90px]">
                                    {authUser.mappedOwnerId || authUser.displayName}
                                </span>
                            </div>
                            <button onClick={logout} className="text-slate-500 hover:text-red-400 transition-colors shrink-0" title="로그아웃">
                                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={loginWithGoogle} 
                            className="flex items-center gap-1 sm:gap-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/50 px-3 sm:px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-black transition-all shadow-lg shrink-0"
                        >
                            <LogIn className="w-3 h-3 sm:w-4 sm:h-4" /> LOGIN
                        </button>
                    )}
                </div>
            </div>

            {/* 🚨 3. 조건부로 히든 모달 렌더링 */}
            {isArcadeDraftOpen && (
                <QuickArcadeDraftModal 
                    masterTeams={masterTeams} 
                    onClose={() => setIsArcadeDraftOpen(false)} 
                />
            )}
        </>
    );
};