/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { TeamCard } from './TeamCard';
import { CupEntry, FALLBACK_IMG } from '../types'; 

interface AdminCupStep2Props {
    unassignedPool: CupEntry[];
    groups: { [key: string]: (CupEntry | null)[] };
    customConfig: { groupCount: number; teamCount: number };
    configMode: 'AUTO' | 'CUSTOM';
    isLocked?: boolean; 
    
    // 핸들러 함수들
    onDragStart: (e: React.DragEvent, entry: CupEntry) => void;
    onDrop: (e: React.DragEvent, gName: string, idx: number) => void;
    onDragOver: (e: React.DragEvent) => void;
    onSlotClick: (gName: string, idx: number) => void;
    onUpdateStructure: (mode: 'AUTO' | 'CUSTOM', gCount: number, tCount: number) => void;
    onAutoDraw: () => void;
    onResetDraw: () => void;
    onCreateSchedule: () => void;
}

export const AdminCupStep2 = ({
    unassignedPool, groups, customConfig, configMode, isLocked = false,
    onDragStart, onDrop, onDragOver, onSlotClick, onUpdateStructure,
    onAutoDraw, onResetDraw, onCreateSchedule
}: AdminCupStep2Props) => {
    
    const handleLockedAction = (action: () => void) => {
        if (isLocked) {
            alert("🔒 조 편성이 이미 확정되었습니다.\n수정하려면 시즌 데이터를 초기화해야 합니다.");
            return;
        }
        action();
    };

    return (
        <div className={`bg-[#0b0e14] p-4 md:p-6 rounded-[2.5rem] border relative transition-all duration-300 ${isLocked ? 'border-slate-800 bg-[#05070a]' : 'border-slate-800'}`}>
            
            {/* 상단 헤더 & 컨트롤 패널 */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-b border-slate-800 pb-4 gap-4">
                <div className="flex items-center gap-3">
                    <h3 className="text-white font-black italic uppercase tracking-tighter text-xl">Step 2. Group Draw Board</h3>
                    {isLocked && (
                        <div className="flex items-center gap-1 bg-red-900/30 border border-red-500/30 px-3 py-1 rounded-full">
                            <span className="text-sm">🔒</span>
                            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">LOCKED</span>
                        </div>
                    )}
                </div>
                
                <div className={`flex items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-700 ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}>
                    <button onClick={() => !isLocked && onUpdateStructure('AUTO', 4, 4)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black italic transition-all ${configMode === 'AUTO' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>AUTO (16강)</button>
                    <div className="h-4 w-px bg-slate-700 mx-1"></div>
                    <div className="flex gap-2 items-center px-1">
                        <span className={`text-[10px] font-bold ${configMode === 'CUSTOM' ? 'text-white' : 'text-slate-500'}`}>CUSTOM:</span>
                        <select disabled={isLocked} value={customConfig.groupCount} onChange={(e) => onUpdateStructure('CUSTOM', Number(e.target.value), customConfig.teamCount)} className="bg-slate-800 text-white text-[10px] p-1 rounded border border-slate-600 font-bold cursor-pointer hover:border-emerald-500"><option value="2">2 Groups</option><option value="4">4 Groups</option><option value="8">8 Groups</option></select>
                        <span className="text-[10px] text-slate-600">x</span>
                        <select disabled={isLocked} value={customConfig.teamCount} onChange={(e) => onUpdateStructure('CUSTOM', customConfig.groupCount, Number(e.target.value))} className="bg-slate-800 text-white text-[10px] p-1 rounded border border-slate-600 font-bold cursor-pointer hover:border-emerald-500"><option value="2">2 Teams</option><option value="3">3 Teams</option><option value="4">4 Teams</option><option value="5">5 Teams</option></select>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button onClick={() => handleLockedAction(onResetDraw)} className={`px-4 py-2 rounded-xl font-bold text-xs transition-colors ${isLocked ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed' : 'bg-slate-800 text-slate-400 hover:bg-red-900 hover:text-white'}`}>🔄 Reset</button>
                    <button onClick={() => handleLockedAction(onAutoDraw)} className={`px-6 py-2 rounded-xl font-black italic text-xs shadow-lg transition-all ${isLocked ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed' : 'bg-yellow-600 text-black shadow-yellow-900/40 hover:bg-yellow-500 active:scale-95'}`}>⚡ AUTO FILL</button>
                </div>
            </div>

            {/* 대기실 (잠금 시 비활성화 & 드래그 차단) */}
            <div className={`mb-6 p-4 rounded-2xl border transition-all duration-300 ${isLocked ? 'bg-black/40 border-slate-800/50 opacity-40 grayscale pointer-events-none' : 'bg-slate-900/50 border-slate-700/50'}`}>
                <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">WAITING POOL ({unassignedPool.length})</span>
                    {!isLocked && <span className="text-[10px] text-slate-500 italic">Drag team to group slot or Click</span>}
                </div>
                {unassignedPool.length === 0 ? (
                    <div className="text-center py-4 text-slate-600 text-xs italic">Step 1에서 팀을 선발해주세요.</div>
                ) : (
                    // 🔥 대기실 그리드 간격 넓혀서 가독성 확보
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 max-h-[350px] overflow-y-auto custom-scrollbar p-1">
                        {unassignedPool.map(t => (
                            <TeamCard 
                                key={t.id} 
                                team={t} 
                                // 🔥 미니 사이즈 제거하고 일반/스몰 사이즈로 큼직하게 렌더링
                                size="small" 
                                draggable={!isLocked} 
                                onDragStart={(e) => !isLocked && onDragStart(e, t)} 
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* 조 추첨 보드 (잠금 시 드롭 차단) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {Object.keys(groups).sort().slice(0, customConfig.groupCount).map(gName => (
                    <div key={gName} className={`rounded-2xl border overflow-hidden flex flex-col transition-all ${isLocked ? 'bg-black/20 border-slate-800/30' : 'bg-slate-900/50 border-slate-800'}`}>
                        <div className="bg-slate-800/80 px-4 py-3 flex justify-between items-center border-b border-slate-700">
                            <span className="text-sm font-black italic text-emerald-400">GROUP {gName}</span>
                            <span className="text-[10px] text-slate-500 font-bold">{groups[gName].filter(Boolean).length}/{customConfig.teamCount}</span>
                        </div>
                        {/* 🔥 그룹 슬롯 그리드 최적화 (모바일에서 너무 찌그러지지 않도록) */}
                        <div className={`p-3 grid gap-3 ${customConfig.teamCount > 4 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
                            {groups[gName].slice(0, customConfig.teamCount).map((slot, idx) => (
                                <div 
                                    key={idx} 
                                    onDragOver={isLocked ? undefined : onDragOver}
                                    onDrop={(e) => !isLocked && onDrop(e, gName, idx)}
                                    onClick={() => !isLocked && onSlotClick(gName, idx)} 
                                    // 🔥 [핵심] aspect-video 제거하고 min-h-24 적용. 팀 카드가 들어갈 숨통 확보!
                                    className={`relative min-h-[96px] sm:min-h-[110px] rounded-xl border-2 flex flex-col items-center justify-center transition-all group overflow-hidden ${
                                        isLocked 
                                        ? 'border-slate-800/50 bg-black/20 cursor-default'
                                        : slot 
                                            ? 'border-emerald-500/30 bg-emerald-900/10 hover:border-red-500/50 hover:bg-red-900/10 cursor-pointer border-dashed' 
                                            : 'border-slate-700 bg-slate-900/30 hover:border-yellow-500/50 hover:bg-slate-800 border-dashed cursor-pointer'
                                    }`}
                                >
                                    {slot ? (
                                        <div className="w-full h-full">
                                            <TeamCard 
                                                team={slot} 
                                                // 🔥 mini 대신 small 적용하여 로고와 텍스트 시원하게 표시
                                                size="small" 
                                                className={`w-full h-full border-none shadow-none bg-transparent flex items-center justify-center ${isLocked ? 'grayscale opacity-80' : ''}`}
                                            />
                                            {!isLocked && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                                                    <span className="text-red-400 font-black text-xs">REMOVE ✕</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className={`flex flex-col items-center transition-colors ${isLocked ? 'text-slate-700' : 'text-slate-600 group-hover:text-yellow-500'}`}>
                                            <span className="text-xl font-black">{isLocked ? '-' : '+'}</span>
                                            <span className="text-[9px] font-bold">{isLocked ? 'EMPTY' : 'ADD TEAM'}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800 flex justify-center">
                {isLocked ? (
                    <div className="px-10 py-4 bg-slate-900 text-slate-500 font-black italic rounded-2xl border border-slate-800 flex items-center gap-3 cursor-not-allowed select-none">
                        <span>🔒</span> GROUP SCHEDULE FIXED
                    </div>
                ) : (
                    <button onClick={onCreateSchedule} className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black italic rounded-2xl shadow-2xl text-lg transition-transform active:scale-95 flex items-center gap-3"><span>💾</span> CREATE SCHEDULE</button>
                )}
            </div>
        </div>
    );
};