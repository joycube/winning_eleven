"use client";
import React, { useState, useRef } from 'react'; 
import { Trophy, Settings, LogIn, LogOut, BellRing } from 'lucide-react'; 
import { useAuth } from '../hooks/useAuth';
import { usePushNotification } from '../hooks/usePushNotification'; 
import { QuickArcadeDraftModal } from './QuickArcadeDraftModal'; 

interface TopBarProps {
  setCurrentView?: (view: any) => void;
  masterTeams?: any[]; 
  owners?: any[]; 
}

export const TopBar = ({ setCurrentView, masterTeams = [], owners = [] }: TopBarProps) => {
    const { authUser, loginWithGoogle, logout } = useAuth();
    const { requestPermissionAndSaveToken } = usePushNotification(); 

    const [isArcadeDraftOpen, setIsArcadeDraftOpen] = useState(false);
    const [isCharging, setIsCharging] = useState(false);
    const pressTimer = useRef<NodeJS.Timeout | null>(null);

    const handlePressStart = () => {
        setIsCharging(true);
        pressTimer.current = setTimeout(() => {
            setIsCharging(false);
            setIsArcadeDraftOpen(true);
        }, 3000); 
    };

    const handlePressEnd = () => {
        setIsCharging(false);
        if (pressTimer.current) clearTimeout(pressTimer.current);
    };

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes intense-overload {
                    0%   { transform: translate(0, 0) scale(1); filter: brightness(1); }
                    20%  { transform: translate(-2px, 2px) scale(1.02); filter: brightness(1.2); }
                    40%  { transform: translate(3px, -2px) scale(1.05); filter: brightness(1.4); }
                    60%  { transform: translate(-4px, 3px) scale(1.08); filter: brightness(1.8); }
                    80%  { transform: translate(4px, -4px) scale(1.12); filter: brightness(2.2); }
                    100% { transform: translate(-2px, 2px) scale(1.15); filter: brightness(3) contrast(1.5); }
                }
                @keyframes text-glitch-spark {
                    0%, 100% { text-shadow: 0 0 10px #38bdf8; }
                    25% { text-shadow: -2px 0px 0px rgba(255,0,0,0.8), 2px 0px 0px rgba(0,255,255,0.8), 0 0 20px #0ea5e9; color: #e0f2fe; }
                    50% { text-shadow: 2px 0px 0px rgba(255,0,0,0.8), -2px 0px 0px rgba(0,255,255,0.8), 0 0 30px #bae6fd; color: #fff; }
                    75% { text-shadow: -1px 2px 0px rgba(255,0,0,0.8), 1px -2px 0px rgba(0,255,255,0.8), 0 0 50px #ffffff; color: #bae6fd; }
                }
                @keyframes spark-slash-1 {
                    0% { opacity: 0; transform: scaleX(0) translateY(-5px) rotate(3deg); }
                    50% { opacity: 1; transform: scaleX(1.2) translateY(5px) rotate(-3deg); filter: drop-shadow(0 0 8px #fff); }
                    100% { opacity: 0; transform: scaleX(0) translateY(10px) rotate(5deg); }
                }
                @keyframes spark-slash-2 {
                    0% { opacity: 0; transform: scaleX(0) translateY(10px) rotate(-5deg); }
                    50% { opacity: 1; transform: scaleX(1.5) translateY(-5px) rotate(10deg); filter: drop-shadow(0 0 10px #38bdf8); }
                    100% { opacity: 0; transform: scaleX(0) translateY(-10px) rotate(-8deg); }
                }
                .surge-active {
                    animation: intense-overload 3s cubic-bezier(0.5, 0, 1, 1) forwards, text-glitch-spark 0.1s infinite linear;
                    position: relative;
                    z-index: 100;
                }
                .surge-active::before, .surge-active::after {
                    content: ""; position: absolute; left: -10%; width: 120%; height: 2px; background: #fff; opacity: 0; pointer-events: none; z-index: 101;
                }
                .surge-active::before { top: 40%; animation: spark-slash-1 0.15s infinite linear; }
                .surge-active::after { top: 60%; animation: spark-slash-2 0.2s infinite linear reverse; }
                .surge-icon { animation: intense-overload 3s forwards, text-glitch-spark 0.1s infinite; }
            `}} />

            <div className="bg-[#050b14]/95 backdrop-blur-md border-b border-slate-800/50 py-3 px-3 sm:px-6 flex justify-between items-center sticky top-0 z-50 shadow-lg overflow-hidden">
                
                <div 
                    className="flex items-center gap-1.5 sm:gap-2 cursor-pointer min-w-0 mr-2 relative shrink-0" 
                    onMouseDown={handlePressStart}
                    onMouseUp={handlePressEnd}
                    onMouseLeave={handlePressEnd}
                    onTouchStart={handlePressStart}
                    onTouchEnd={handlePressEnd}
                >
                    <Trophy className={`text-emerald-500 shrink-0 w-5 h-5 sm:w-6 sm:h-6 md:w-[26px] md:h-[26px] transition-all duration-300 ${isCharging ? 'surge-icon' : ''}`} />
                    
                    {/* 🚨 1줄 형태로 복구 & 폰트 최적화 & whitespace-nowrap으로 줄바꿈/잘림 방지 */}
                    <h1 
                        className={`text-white font-black italic tracking-tighter text-[13px] xs:text-[14px] sm:text-[18px] md:text-[22px] drop-shadow-md whitespace-nowrap select-none transition-all ${isCharging ? 'surge-active' : ''}`}
                    >
                        eFOOTBALL   Live   EVOLUTION™
                    </h1>
                </div>

                <div className="flex items-center gap-2.5 sm:gap-4 shrink-0 ml-auto">
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
                            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900 border border-slate-700 pl-1 pr-1 sm:pr-3 py-1 rounded-full shadow-inner">
                                <img src={authUser.photoURL || ''} alt="Profile" className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border border-slate-600 object-cover shrink-0" />
                                {/* 모바일에서는 닉네임 숨김 */}
                                <span className="hidden sm:block text-[11px] font-bold text-slate-300 truncate max-w-[90px]">
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

            {isArcadeDraftOpen && (
                <QuickArcadeDraftModal 
                    masterTeams={masterTeams} 
                    owners={owners} 
                    onClose={() => setIsArcadeDraftOpen(false)} 
                />
            )}
        </>
    );
};