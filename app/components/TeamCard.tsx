/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { FALLBACK_IMG } from '../types';

interface TeamCardProps {
    team: {
        id: string | number;
        name: string;
        logo: string;
        ownerName?: string;
        region?: string;
        tier: string;
        group?: string;
        rank?: number;
        realRankScore?: number; // 실축 점수
        realFormScore?: number; // 컨디션 점수
        [key: string]: any;
    };
    onClick?: () => void;
    draggable?: boolean;
    onDragStart?: (e: React.DragEvent) => void;
    className?: string;
    size?: string; 
}

export const TeamCard = ({ 
    team, 
    onClick, 
    draggable, 
    onDragStart, 
    className = '', 
    size = 'default' 
}: TeamCardProps) => {
    
    const isS = team.tier === 'S';
    const isMini = size === 'mini' || size === 'list';

    // 컨디션 계산 로직 (점수 기반 화살표)
    const getConditionIcon = (score: number = 80) => {
        if (score >= 90) return { icon: '↑', color: 'text-emerald-400' };
        if (score >= 80) return { icon: '↗', color: 'text-teal-400' };
        if (score >= 70) return { icon: '→', color: 'text-slate-400' };
        if (score >= 60) return { icon: '↘', color: 'text-orange-400' };
        return { icon: '⬇', color: 'text-red-500' };
    };

    const condition = getConditionIcon(team.realFormScore);
    const realRank = team.real_rank || Math.max(1, 20 - Math.floor((team.realRankScore || 80) / 5)); // 임시 랭킹 계산

    return (
        <div 
            onClick={onClick}
            draggable={draggable}
            onDragStart={onDragStart}
            className={`
                relative group border-2 rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl cursor-pointer flex flex-col items-center justify-between
                ${isS ? 'bg-gradient-to-b from-slate-800 to-slate-950 border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'bg-slate-950 border-slate-700 hover:border-emerald-500'}
                ${isMini ? 'p-2 min-h-[110px]' : 'p-4 min-h-[160px]'}
                ${className}
            `}
        >
            {/* 1. 로고 & 티어 배지 섹션 */}
            <div className="relative mt-1">
                {/* 로고 원형 배경 */}
                <div className={`${isMini ? 'w-10 h-10' : 'w-16 h-16'} rounded-full bg-white flex items-center justify-center p-1.5 shadow-lg ring-2 ring-slate-800`}>
                    <img 
                        src={team.logo} 
                        className="w-full h-full object-contain" 
                        alt={team.name} 
                        onError={(e: any) => e.target.src = FALLBACK_IMG} 
                    />
                </div>
                
                {/* 🔥 티어 배지 (로고 우측 하단 오버레이) */}
                <div className={`absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border-2 border-slate-900 font-black text-black shadow-lg z-10
                    ${isMini ? 'w-5 h-5 text-[8px]' : 'w-6 h-6 text-[10px]'}
                    ${team.tier === 'S' ? 'bg-yellow-400' : team.tier === 'A' ? 'bg-slate-200' : 'bg-orange-600 text-white'}
                `}>
                    {team.tier}
                </div>
            </div>

            {/* 2. 팀 이름 & 스탯 섹션 */}
            <div className="flex flex-col items-center w-full mt-2 space-y-1">
                {/* 팀 이름 */}
                <p className={`${isMini ? 'text-[10px]' : 'text-sm'} font-black italic tracking-tighter text-white uppercase text-center leading-none w-full truncate px-1 drop-shadow-md`}>
                    {team.name}
                </p>

                {/* 🔥 스탯 배지 (순위 & 컨디션) */}
                <div className="flex items-center gap-1">
                    {/* 실축 순위 */}
                    <div className={`flex items-center justify-center rounded px-1.5 py-0.5 bg-yellow-500/90 text-black font-bold border border-yellow-600 ${isMini ? 'text-[7px]' : 'text-[9px]'}`}>
                        R.{realRank}
                    </div>
                    {/* 컨디션 */}
                    <div className={`flex items-center justify-center rounded px-1.5 py-0.5 bg-slate-800 border border-slate-700 ${isMini ? 'text-[7px]' : 'text-[9px]'}`}>
                        <span className={condition.color}>{condition.icon}</span>
                    </div>
                </div>
            </div>

            {/* 3. 오너 이름 (최하단) */}
            <div className={`w-full text-center border-t border-slate-800/50 pt-1.5 mt-1 ${isMini ? 'text-[8px]' : 'text-[10px]'}`}>
                {team.ownerName ? (
                    <span className="text-slate-500 font-bold tracking-wide truncate block">
                        {team.ownerName}
                    </span>
                ) : (
                    <span className="text-slate-700 italic text-[9px]">NO OWNER</span>
                )}
            </div>
        </div>
    );
};