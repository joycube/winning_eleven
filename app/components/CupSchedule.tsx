/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';
// 🔥 types.ts 파일 위치에 맞춰 경로 수정 필요. 없으면 아래 주석 해제 후 사용.
// import { FALLBACK_IMG } from '../types'; 

// 임시 상수 (types.ts에 없다면 사용)
const FALLBACK_IMG = "https://via.placeholder.com/50?text=?";

// ------------------------------------------------------------------
// 🧩 [Interface] 데이터 타입 정의
// ------------------------------------------------------------------
interface Match {
    id: string;
    stage: 'GROUP' | 'QF' | 'SF' | 'FINAL';
    group?: string; // 조별리그일 경우 A, B, C, D
    home: string;
    homeLogo: string;
    homeScore: number | '';
    away: string;
    awayLogo: string;
    awayScore: number | '';
    status: 'UPCOMING' | 'FINISHED';
}

interface TeamStanding {
    rank: number;
    name: string;
    logo: string;
    played: number;
    gd: number;
    points: number;
}

// ------------------------------------------------------------------
// 🧩 [Component] Group Match Card (경기 일정 카드)
// ------------------------------------------------------------------
const GroupMatchCard = ({ match, onEdit }: { match: Match; onEdit: (id: string) => void }) => {
    const isPlayed = match.status === 'FINISHED';
    
    // 화면 표시용 점수 (빈 값일 경우 0 처리 안 함, UI 분기 처리)
    const displayHomeScore = match.homeScore === '' ? '-' : match.homeScore;
    const displayAwayScore = match.awayScore === '' ? '-' : match.awayScore;

    // 승자 색상 처리를 위한 로직
    const homeWin = isPlayed && (match.homeScore > match.awayScore);
    const awayWin = isPlayed && (match.awayScore > match.homeScore);

    return (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between hover:border-emerald-500/50 transition-all group relative overflow-hidden">
            {/* 배경 호버 효과 */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-900/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            {/* Home Team */}
            <div className="flex items-center gap-2 w-1/3 overflow-hidden">
                <img src={match.homeLogo || FALLBACK_IMG} className="w-8 h-8 object-contain" alt="Home" />
                <span className={`text-xs font-bold truncate ${homeWin ? 'text-emerald-400' : 'text-slate-300'}`}>
                    {match.home}
                </span>
            </div>

            {/* Score / VS */}
            <div className="flex flex-col items-center justify-center w-1/3 shrink-0 z-10">
                {isPlayed ? (
                    <div className="flex gap-2 text-xl font-black italic tracking-tighter text-white">
                        <span>{displayHomeScore}</span>
                        <span className="text-slate-600">:</span>
                        <span>{displayAwayScore}</span>
                    </div>
                ) : (
                    <span className="text-xs font-black text-slate-600 bg-slate-900 px-2 py-1 rounded">VS</span>
                )}
                <button 
                    onClick={() => onEdit(match.id)}
                    className="mt-1 text-[10px] text-slate-500 hover:text-emerald-400 underline decoration-slate-700 underline-offset-2 flex items-center gap-1 transition-colors"
                >
                    {isPlayed ? '📝 Detail' : '✏️ Input'}
                </button>
            </div>

            {/* Away Team */}
            <div className="flex items-center gap-2 w-1/3 justify-end overflow-hidden">
                <span className={`text-xs font-bold truncate text-right ${awayWin ? 'text-emerald-400' : 'text-slate-300'}`}>
                    {match.away}
                </span>
                <img src={match.awayLogo || FALLBACK_IMG} className="w-8 h-8 object-contain" alt="Away" />
            </div>
        </div>
    );
};

// ------------------------------------------------------------------
// 📊 [View] Group Stage View (조별리그 메인 뷰)
// ------------------------------------------------------------------
const GroupStageView = () => {
    // 🔥 [MOCK DATA] 나중에 Firebase에서 가져온 데이터로 교체해야 함
    const groups = ['A', 'B', 'C', 'D'];
    
    // 더미 매치 데이터
    const mockMatches: Match[] = [
        { id: '1', stage: 'GROUP', group: 'A', home: 'Real Madrid', homeLogo: '', homeScore: 2, away: 'Man City', awayLogo: '', awayScore: 1, status: 'FINISHED' },
        { id: '2', stage: 'GROUP', group: 'A', home: 'Bayern', homeLogo: '', homeScore: '', away: 'Inter', awayLogo: '', awayScore: '', status: 'UPCOMING' },
        { id: '3', stage: 'GROUP', group: 'A', home: 'Man City', homeLogo: '', homeScore: '', away: 'Bayern', awayLogo: '', awayScore: '', status: 'UPCOMING' },
        { id: '4', stage: 'GROUP', group: 'B', home: 'Arsenal', homeLogo: '', homeScore: 3, away: 'PSG', awayLogo: '', awayScore: 3, status: 'FINISHED' },
    ];

    // 더미 순위 데이터 (자동 계산 로직 구현 전 임시용)
    const mockStandings: TeamStanding[] = [
        { rank: 1, name: 'Real Madrid', logo: '', played: 1, gd: 1, points: 3 },
        { rank: 2, name: 'Man City', logo: '', played: 1, gd: -1, points: 0 },
        { rank: 3, name: 'Bayern', logo: '', played: 0, gd: 0, points: 0 },
        { rank: 4, name: 'Inter', logo: '', played: 0, gd: 0, points: 0 },
    ];

    // 점수 입력 모달 핸들러
    const handleEditMatch = (id: string) => {
        // TODO: 여기에 실제 점수 입력 모달(Modal)을 띄우는 로직 연결
        console.log(`Open Edit Modal for Match ID: ${id}`);
        alert("점수 입력 모달이 열립니다."); 
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
            {groups.map(gName => {
                // 해당 그룹의 경기만 필터링
                const groupMatches = mockMatches.filter(m => m.group === gName);
                
                return (
                    <div key={gName} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col gap-5 relative overflow-hidden">
                        {/* 그룹 배경 데코레이션 */}
                        <div className="absolute -right-10 -top-10 text-[100px] font-black text-white/5 pointer-events-none select-none italic">
                            {gName}
                        </div>

                        {/* 1. Header */}
                        <div className="flex justify-between items-center border-b border-slate-800 pb-3 z-10">
                            <div className="flex items-center gap-2">
                                <span className="bg-emerald-600 text-white text-xs font-black px-2 py-0.5 rounded shadow-lg shadow-emerald-900/50">GR</span>
                                <h3 className="text-white font-black italic text-xl tracking-tighter">GROUP {gName}</h3>
                            </div>
                            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/30 px-2 py-1 rounded border border-emerald-500/20">TOP 2 ADVANCE</span>
                        </div>

                        {/* 2. Standings Table (순위표) */}
                        <div className="bg-black/40 rounded-xl border border-slate-800/50 overflow-hidden z-10">
                            <table className="w-full text-left">
                                <thead className="bg-slate-950 text-[10px] text-slate-500 font-bold uppercase">
                                    <tr>
                                        <th className="p-2 w-8 text-center">#</th>
                                        <th className="p-2">Team</th>
                                        <th className="p-2 text-center w-8">P</th>
                                        <th className="p-2 text-center w-8">GD</th>
                                        <th className="p-2 text-center w-8 text-white">Pts</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-bold text-slate-300 divide-y divide-slate-800/50">
                                    {mockStandings.map((team, i) => (
                                        <tr key={i} className={`hover:bg-slate-800/30 transition-colors ${i < 2 ? 'bg-emerald-900/10' : ''}`}>
                                            <td className="p-2 text-center">
                                                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[9px] ${i < 2 ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-800 text-slate-500'}`}>
                                                    {team.rank}
                                                </span>
                                            </td>
                                            <td className="p-2 flex items-center gap-2">
                                                <div className="w-5 h-5 bg-white rounded-full shrink-0 flex items-center justify-center">
                                                    <img src={team.logo || FALLBACK_IMG} className="w-4 h-4 object-contain" alt=""/>
                                                </div>
                                                <span className={i < 2 ? 'text-white' : 'text-slate-400'}>{team.name}</span>
                                            </td>
                                            <td className="p-2 text-center text-slate-500">{team.played}</td>
                                            <td className="p-2 text-center text-slate-500">{team.gd > 0 ? `+${team.gd}` : team.gd}</td>
                                            <td className="p-2 text-center text-white font-black">{team.points}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* 3. Fixtures (경기 일정 - 카드형) */}
                        <div className="flex flex-col gap-2 z-10">
                            <div className="flex justify-between items-end px-1">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Match Schedule</span>
                                <span className="text-[9px] text-slate-600">{groupMatches.length} Matches</span>
                            </div>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                                {groupMatches.length > 0 ? (
                                    groupMatches.map((match) => (
                                        <GroupMatchCard key={match.id} match={match} onEdit={handleEditMatch} />
                                    ))
                                ) : (
                                    <div className="text-center py-4 text-xs text-slate-600 italic border border-dashed border-slate-800 rounded-lg">
                                        No matches scheduled yet.
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                );
            })}
        </div>
    );
};

// ------------------------------------------------------------------
// ⚔️ [View] Bracket View (토너먼트 뷰 - 시각화 전용)
// ------------------------------------------------------------------
const BracketView = () => (
    <div className="flex flex-col items-center justify-center min-h-[600px] bg-slate-950 rounded-3xl border border-slate-800 p-8 animate-in zoom-in-95 duration-500 relative overflow-hidden">
        {/* 은은한 배경 패턴 */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>
        
        <div className="text-center space-y-6 z-10 max-w-lg">
            <div className="flex justify-center">
                <span className="text-6xl">🏆</span>
            </div>
            <div>
                <h2 className="text-3xl font-black italic text-white tracking-tighter mb-2">KNOCKOUT STAGE</h2>
                <p className="text-slate-400 text-sm">
                    조별리그가 모두 종료되면<br/>
                    <strong className="text-emerald-400">상위 2팀</strong>이 자동으로 토너먼트에 진출합니다.
                </p>
            </div>
            
            {/* 대진표 느낌을 내는 스켈레톤 UI */}
            <div className="flex gap-2 justify-center mt-12 opacity-30 grayscale pointer-events-none select-none">
                <div className="flex flex-col gap-8 justify-center">
                    <div className="w-20 h-10 border border-slate-600 rounded bg-slate-900"></div>
                    <div className="w-20 h-10 border border-slate-600 rounded bg-slate-900"></div>
                </div>
                <div className="w-6 border-t border-r border-b border-slate-600 h-16 self-center"></div>
                <div className="w-24 h-14 border-2 border-yellow-600 rounded-xl bg-yellow-900/20 flex items-center justify-center text-yellow-500 font-bold self-center">
                    FINAL
                </div>
                <div className="w-6 border-t border-l border-b border-slate-600 h-16 self-center"></div>
                <div className="flex flex-col gap-8 justify-center">
                    <div className="w-20 h-10 border border-slate-600 rounded bg-slate-900"></div>
                    <div className="w-20 h-10 border border-slate-600 rounded bg-slate-900"></div>
                </div>
            </div>

            <button className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs transition-colors mt-4">
                View Detailed Bracket (Locked)
            </button>
        </div>
    </div>
);

// ------------------------------------------------------------------
// 🏆 [Main Page] Cup Schedule Container
// ------------------------------------------------------------------
export const CupSchedule = () => {
    // 탭 상태 관리 (기본값: GROUP)
    const [activeTab, setActiveTab] = useState<'GROUP' | 'KNOCKOUT'>('GROUP');

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
            {/* 1. Header & Tab Controller */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-800 pb-6">
                <div>
                    <h1 className="text-4xl font-black italic text-white tracking-tighter mb-1 flex items-center gap-3">
                        <span className="text-yellow-500 text-5xl drop-shadow-lg">🏆</span> SEASON CUP
                    </h1>
                    <p className="text-slate-400 text-sm font-bold pl-1">
                        Group Stage & Knockout Tournament
                    </p>
                </div>

                {/* 탭 버튼 그룹 */}
                <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
                    <button 
                        onClick={() => setActiveTab('GROUP')}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black italic transition-all duration-300 flex items-center gap-2 ${activeTab === 'GROUP' ? 'bg-emerald-600 text-white shadow-lg scale-105' : 'text-slate-500 hover:text-white'}`}
                    >
                        <span>📊</span> GROUP STAGE
                    </button>
                    <button 
                        onClick={() => setActiveTab('KNOCKOUT')}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black italic transition-all duration-300 flex items-center gap-2 ${activeTab === 'KNOCKOUT' ? 'bg-yellow-600 text-black shadow-lg scale-105' : 'text-slate-500 hover:text-white'}`}
                    >
                        <span>⚔️</span> TOURNAMENT
                    </button>
                </div>
            </div>

            {/* 2. Main Content Area */}
            <div className="min-h-[600px]">
                {activeTab === 'GROUP' ? <GroupStageView /> : <BracketView />}
            </div>
        </div>
    );
};