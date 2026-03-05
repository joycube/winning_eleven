"use client";

import React from 'react';
import { MessageSquare, Trophy, CalendarDays, History, DollarSign, BadgeCheck } from 'lucide-react';

interface NavTabsProps {
  currentView: string;
  setCurrentView: (v: any) => void;
  hasNewNotice?: boolean;
}

export const NavTabs = ({ currentView, setCurrentView, hasNewNotice }: NavTabsProps) => {
    
    // 🔥 [디벨롭] 영문 메뉴명 변경 및 요청하신 순서대로 재배치 완료!
    const eFootballMenuItems = [
        { id: 'LOCKERROOM', label: 'LOCKER ROOM', icon: MessageSquare, gradient: 'from-[#ff2a5f] to-[#c70039]', shadow: 'shadow-[#c70039]/40', alert: hasNewNotice },
        { id: 'RANKING', label: 'SEASON', icon: Trophy, gradient: 'from-[#00d2ff] to-[#00b386]', shadow: 'shadow-[#00b386]/40' },
        { id: 'SCHEDULE', label: 'SCHEDULE', icon: CalendarDays, gradient: 'from-[#ff8a00] to-[#e52e71]', shadow: 'shadow-[#e52e71]/40' },
        { id: 'HISTORY', label: 'HALL OF FAME', icon: History, gradient: 'from-[#3b82f6] to-[#1d4ed8]', shadow: 'shadow-blue-700/40' },
        { id: 'FINANCE', label: 'FINANCE', icon: DollarSign, gradient: 'from-[#facc15] to-[#ca8a04]', shadow: 'shadow-[#ca8a04]/40' },
        { id: 'OWNERROOM', label: 'OWNER ROOM', icon: BadgeCheck, gradient: 'from-[#d400ff] to-[#6600cc]', shadow: 'shadow-[#6600cc]/40' }
    ];

    return (
        <div className="max-w-6xl mx-auto w-full px-2 sm:px-6 my-4 sm:my-8 animate-in fade-in slide-in-from-bottom-4">
            {/* 🔥 6개 아이템: 모바일은 3개씩 2줄, 태블릿/PC는 6개 1줄 배치 */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-4">
                {eFootballMenuItems.map((menu) => {
                    const Icon = menu.icon;
                    const isActive = currentView === menu.id;

                    return (
                        <div
                            key={menu.id}
                            onClick={() => setCurrentView(menu.id)}
                            className={`relative overflow-hidden rounded-2xl sm:rounded-[20px] cursor-pointer transition-all duration-300 group
                                ${isActive ? 'scale-105 shadow-2xl ' + menu.shadow + ' z-10' : 'hover:scale-105 hover:shadow-xl shadow-md ' + menu.shadow}
                                active:scale-95`}
                        >
                            {/* 1. 배경 그라데이션 */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${menu.gradient} ${isActive ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'} transition-opacity duration-300`}></div>
                            
                            {/* 2. 게임 UI 특유의 글로시(유리알 빛 반사) 효과 */}
                            <div className="absolute top-0 left-0 w-full h-[45%] bg-gradient-to-b from-white/30 to-transparent pointer-events-none"></div>

                            {/* 3. 공지사항 알림 점 (Red Dot) */}
                            {menu.alert && (
                                <div className="absolute top-2 right-2 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-500 rounded-full border-2 border-white shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-pulse z-20"></div>
                            )}

                            {/* 4. 아이콘 & 텍스트 콘텐츠 */}
                            <div className="relative flex flex-col items-center justify-center h-[80px] sm:h-[110px] px-1 z-10">
                                <Icon 
                                    className="text-white drop-shadow-md mb-1.5 sm:mb-2 w-6 h-6 sm:w-9 sm:h-9 transition-transform duration-300 group-hover:-translate-y-1" 
                                    strokeWidth={isActive ? 3 : 2.5} 
                                />
                                <span className="text-white font-black text-[10px] sm:text-[13px] tracking-tighter drop-shadow-md text-center leading-tight break-keep px-0.5">
                                    {menu.label}
                                </span>
                            </div>

                            {/* 5. 선택된 메뉴 하단 하이라이트 바 */}
                            {isActive && (
                                <div className="absolute bottom-0 left-0 w-full h-1.5 sm:h-2 bg-white shadow-[0_0_12px_rgba(255,255,255,1)]"></div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};