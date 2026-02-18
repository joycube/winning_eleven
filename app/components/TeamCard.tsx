/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { FALLBACK_IMG } from '../types';
import { getTierBadgeColor } from '../utils/helpers';

interface TeamCardProps {
    team: {
        id: string | number;
        name: string;
        logo: string;
        ownerName?: string;
        region?: string;
        tier: string;
        group?: string; // 컵 대회용 (예: A조)
        rank?: number;  // 컵 대회용 (예: 1위)
        [key: string]: any;
    };
    onClick?: () => void;
    draggable?: boolean;
    onDragStart?: (e: React.DragEvent) => void;
    className?: string;
    // [수정] 빌드 오류 해결을 위한 size 속성 정의
    size?: string; 
}

export const TeamCard = ({ 
    team, 
    onClick, 
    draggable, 
    onDragStart, 
    className = '', 
    // [수정] size 기본값 설정
    size = 'default' 
}: TeamCardProps) => {
    
    const isS = team.tier === 'S';
    const isMini = size === 'mini' || size === 'list';

    // 사이즈별 동적 스타일 설정
    const containerPadding = isMini ? 'pt-3 pb-1 px-1' : 'pt-6 pb-2 px-2';
    const logoSize = isMini ? 'w-8 h-8' : 'w-12 h-12';
    const teamNameSize = isMini ? 'text-[10px]' : 'text-xs';
    const infoTextSize = isMini ? 'text-[7px]' : 'text-[8px]';

    return (
        <div 
            onClick={onClick}
            draggable={draggable}
            onDragStart={onDragStart}
            className={`
                relative group border-2 rounded-xl overflow-hidden transition-all hover:scale-105 hover:z-10 shadow-lg cursor-grab active:cursor-grabbing
                ${isS ? 'bg-gradient-to-b from-slate-800 to-slate-950 border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'bg-slate-900 border-slate-600'}
                ${className}
            `}
        >
            {/* 1. 상단 배경 데코 (mini가 아닐 때만 선명하게 노출) */}
            <div className={`absolute top-0 left-0 w-full h-1/3 bg-white/5 skew-y-6 transform origin-top-left pointer-events-none ${isMini ? 'opacity-30' : ''}`}></div>

            {/* 2. 오너 이름 (좌측 상단) */}
            {!isMini && team.ownerName && (
                <div className="absolute top-2 left-2 flex flex-col items-start z-10">
                    <span className="text-[9px] text-emerald-400 font-black italic uppercase tracking-tighter drop-shadow-md">
                        {team.ownerName}
                    </span>
                </div>
            )}

            {/* 3. 메인 컨텐츠 (로고 & 이름) */}
            <div className={`flex flex-col items-center justify-center ${containerPadding}`}>
                {/* 로고 이미지 */}
                <div className={`${logoSize} rounded-full bg-white flex items-center justify-center p-1 mb-1 shadow-lg z-10 ${isS ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-slate-900' : ''}`}>
                    <img 
                        src={team.logo} 
                        className="w-full h-full object-contain" 
                        alt={team.name} 
                        onError={(e: any) => e.target.src = FALLBACK_IMG} 
                    />
                </div>
                
                {/* 팀 이름 */}
                <p className={`${teamNameSize} font-black italic tracking-tighter text-white uppercase text-center leading-none w-full truncate px-1 z-10 drop-shadow-md`}>
                    {team.name}
                </p>
                
                {/* 하단 정보 (지역/티어/조별순위) */}
                <div className={`flex items-center gap-1 mt-1 ${isMini ? 'scale-90' : 'opacity-80'}`}>
                    {/* 토너먼트 대기실용 정보 (예: A조 1위) */}
                    {team.group && team.rank && (
                        <span className={`${infoTextSize} text-slate-400 font-bold uppercase`}>
                            {team.group}{team.rank}
                        </span>
                    )}
                    
                    {/* 일반 지역 정보 (mini가 아닐 때만) */}
                    {!isMini && !team.group && team.region && (
                        <span className="text-[8px] text-slate-400 font-bold uppercase truncate max-w-[40px]">
                            {team.region}
                        </span>
                    )}
                    
                    {/* 티어 뱃지 */}
                    <span className={`${infoTextSize} px-1 rounded shadow-sm font-black italic border ${getTierBadgeColor(team.tier)}`}>
                        {team.tier}
                    </span>
                </div>
            </div>
        </div>
    );
};