import React from 'react';
import { TeamCard } from './TeamCard';
import { CupEntry, FALLBACK_IMG } from '../types'; // types 경로 확인 필요

interface AdminCupStep2Props {
    unassignedPool: CupEntry[];
    groups: { [key: string]: (CupEntry | null)[] };
    customConfig: { groupCount: number; teamCount: number };
    configMode: 'AUTO' | 'CUSTOM';
    
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
    unassignedPool, groups, customConfig, configMode,
    onDragStart, onDrop, onDragOver, onSlotClick, onUpdateStructure,
    onAutoDraw, onResetDraw, onCreateSchedule
}: AdminCupStep2Props) => {
    
    return (
        <div className="bg-black p-6 rounded-[2.5rem] border border-slate-800 relative">
            {/* 상단 헤더 & 컨트롤 패널 */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-b border-slate-800 pb-4 gap-4">
                <h3 className="text-white font-black italic uppercase tracking-tighter text-xl">Step 2. Group Draw Board</h3>
                
                <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-700">
                    <button onClick={() => onUpdateStructure('AUTO', 4, 4)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black italic transition-all ${configMode === 'AUTO' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>AUTO (16강)</button>
                    <div className="h-4 w-px bg-slate-700 mx-1"></div>
                    <div className="flex gap-2 items-center px-1">
                        <span className={`text-[10px] font-bold ${configMode === 'CUSTOM' ? 'text-white' : 'text-slate-500'}`}>CUSTOM:</span>
                        <select value={customConfig.groupCount} onChange={(e) => onUpdateStructure('CUSTOM', Number(e.target.value), customConfig.teamCount)} className="bg-slate-800 text-white text-[10px] p-1 rounded border border-slate-600 font-bold cursor-pointer hover:border-emerald-500"><option value="2">2 Groups</option><option value="4">4 Groups</option><option value="8">8 Groups</option></select>
                        <span className="text-[10px] text-slate-600">x</span>
                        <select value={customConfig.teamCount} onChange={(e) => onUpdateStructure('CUSTOM', customConfig.groupCount, Number(e.target.value))} className="bg-slate-800 text-white text-[10px] p-1 rounded border border-slate-600 font-bold cursor-pointer hover:border-emerald-500"><option value="2">2 Teams</option><option value="3">3 Teams</option><option value="4">4 Teams</option><option value="5">5 Teams</option></select>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button onClick={onResetDraw} className="px-4 py-2 bg-slate-800 text-slate-400 rounded-xl font-bold text-xs hover:bg-red-900 hover:text-white transition-colors">🔄 Reset</button>
                    <button onClick={onAutoDraw} className="px-6 py-2 bg-yellow-600 text-black rounded-xl font-black italic text-xs shadow-lg shadow-yellow-900/40 hover:bg-yellow-500 active:scale-95 transition-all">⚡ AUTO FILL</button>
                </div>
            </div>

            {/* 대기실 (Waiting Pool) */}
            <div className="mb-6 bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold text-slate-400">WAITING POOL ({unassignedPool.length})</span>
                    <span className="text-[10px] text-slate-600">Drag team to group slot or Click</span>
                </div>
                {unassignedPool.length === 0 ? (
                    <div className="text-center py-4 text-slate-600 text-xs italic">Step 1에서 팀을 선발해주세요.</div>
                ) : (
                    // 🔥 TeamCard 사용 + 반응형 그리드
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                        {unassignedPool.map(t => (
                            <TeamCard key={t.id} team={t} draggable={true} onDragStart={(e) => onDragStart(e, t)} />
                        ))}
                    </div>
                )}
            </div>

            {/* 조 추첨 보드 (드롭존) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.keys(groups).sort().slice(0, customConfig.groupCount).map(gName => (
                    <div key={gName} className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
                        <div className="bg-slate-800/80 px-4 py-3 flex justify-between items-center border-b border-slate-700">
                            <span className="text-sm font-black italic text-emerald-400">GROUP {gName}</span>
                            <span className="text-[10px] text-slate-500 font-bold">{groups[gName].filter(Boolean).length}/{customConfig.teamCount}</span>
                        </div>
                        <div className={`p-3 grid gap-2 ${customConfig.teamCount > 4 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                            {groups[gName].slice(0, customConfig.teamCount).map((slot, idx) => (
                                <div 
                                    key={idx} 
                                    onDragOver={onDragOver}
                                    onDrop={(e) => onDrop(e, gName, idx)}
                                    onClick={() => onSlotClick(gName, idx)} 
                                    className={`relative aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all group ${slot ? 'border-emerald-500/30 bg-emerald-900/10 hover:border-red-500/50 hover:bg-red-900/10' : 'border-slate-700 bg-slate-900/30 hover:border-yellow-500/50 hover:bg-slate-800'}`}
                                >
                                    {slot ? (
                                        <>
                                            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center p-1 shadow-md mb-1"><img src={slot.logo} className="w-full h-full object-contain" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} /></div>
                                            <span className="text-[10px] font-bold text-white truncate w-full text-center px-1">{slot.name}</span>
                                            <span className="text-[8px] text-emerald-400 font-bold">{slot.ownerName}</span>
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl backdrop-blur-sm"><span className="text-red-400 font-black text-xs">REMOVE ✕</span></div>
                                        </>
                                    ) : (
                                        <div className="text-slate-600 group-hover:text-yellow-500 transition-colors flex flex-col items-center"><span className="text-xl font-black">+</span><span className="text-[9px] font-bold">ADD TEAM</span></div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800 flex justify-center">
                <button onClick={onCreateSchedule} className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black italic rounded-2xl shadow-2xl text-lg transition-transform active:scale-95 flex items-center gap-3"><span>💾</span> CREATE SCHEDULE</button>
            </div>
        </div>
    );
};