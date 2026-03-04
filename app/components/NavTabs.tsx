"use client";
import React from 'react';
import { MessageSquare, Trophy, CalendarDays, History, DollarSign, BadgeCheck } from 'lucide-react'; // 🔥 User 대신 BadgeCheck 로 변경

interface NavTabsProps {
  currentView: string;
  setCurrentView: (v: any) => void;
  hasNewNotice?: boolean;
}

export const NavTabs = ({ currentView, setCurrentView, hasNewNotice }: NavTabsProps) => {
    // 🔥 [디벨롭] MYROOM을 OWNERROOM으로, 라벨을 '구단주'로 완벽 교체
    const tabs = [
        { id: 'LOCKERROOM', label: '락커룸', icon: MessageSquare, alert: hasNewNotice },
        { id: 'RANKING', label: '랭킹', icon: Trophy },
        { id: 'SCHEDULE', label: '스케줄', icon: CalendarDays },
        { id: 'HISTORY', label: '히스토리', icon: History },
        { id: 'FINANCE', label: '파이낸스', icon: DollarSign },
        { id: 'OWNERROOM', label: '구단주', icon: BadgeCheck }, 
    ];

    return (
        <div className="fixed bottom-0 left-0 w-full bg-[#0B1120] border-t border-slate-800 z-50 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
            <div className="flex justify-between items-center h-16 max-w-4xl mx-auto px-2 sm:px-6">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = currentView === tab.id;
                    return (
                        <button 
                            key={tab.id} 
                            onClick={() => setCurrentView(tab.id)} 
                            className={`relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 ${isActive ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <div className="relative">
                                <Icon size={isActive ? 22 : 20} className={`transition-all ${isActive ? 'drop-shadow-[0_0_10px_rgba(52,211,153,0.8)] scale-110' : ''}`} />
                                {tab.alert && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0B1120] animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>}
                            </div>
                            <span className={`text-[9px] sm:text-[10px] font-black tracking-widest transition-all ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                                {tab.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};