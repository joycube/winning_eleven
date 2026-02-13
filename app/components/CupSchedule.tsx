/* eslint-disable @next/next/no-img-element */
import React, { useState, useMemo, useEffect } from 'react';
import { MatchCard } from './MatchCard'; 
import { Match, MasterTeam, Season } from '../types'; 

const FALLBACK_IMG = "https://via.placeholder.com/50?text=?";

// ------------------------------------------------------------------
// 🛠️ [Helper Functions]
// ------------------------------------------------------------------
const normalize = (str: string | number | undefined) => str ? String(str).replace(/\s+/g, '').toLowerCase() : "";

const renderCondition = (cond: string) => {
    const c = (cond || '').toUpperCase();
    const circleBase = "w-4 h-4 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center shadow-sm shrink-0";
    const iconBase = "text-[8px] font-bold leading-none";

    switch (c) {
        case 'A': return <div className={`${circleBase} border-emerald-500/30`} title="최상(A)"><span className={`${iconBase} text-emerald-400`}>⬆</span></div>;
        case 'B': return <div className={`${circleBase} border-lime-500/30`} title="우수(B)"><span className={`${iconBase} text-lime-400`}>↗</span></div>;
        case 'C': return <div className={`${circleBase} border-yellow-500/30`} title="보통(C)"><span className={`${iconBase} text-yellow-400`}>➡</span></div>;
        case 'D': return <div className={`${circleBase} border-orange-500/30`} title="나쁨(D)"><span className={`${iconBase} text-orange-400`}>↘</span></div>;
        case 'E': return <div className={`${circleBase} border-red-500/30`} title="최악(E)"><span className={`${iconBase} text-red-500`}>⬇</span></div>;
        default:  return <div className={circleBase}><span className="text-[8px] text-slate-600">-</span></div>;
    }
};

const getRealRankBadge = (rank: number | undefined | null) => {
    if (!rank) return null;
    let bgClass = "bg-slate-800 text-slate-400 border-slate-700"; 
    if (rank === 1) bgClass = "bg-yellow-500 text-black border-yellow-600";
    else if (rank === 2) bgClass = "bg-slate-300 text-black border-slate-400";
    else if (rank === 3) bgClass = "bg-orange-400 text-black border-orange-500";
    return (
        <div className={`${bgClass} border text-[8px] font-black px-1 py-[0.5px] rounded-[3px] italic shadow-sm shrink-0 leading-none`}>
            R.{rank}
        </div>
    );
};

// ------------------------------------------------------------------
// 🧩 [Interface] Props 정의
// ------------------------------------------------------------------
interface CupScheduleProps {
    seasons: Season[];
    viewSeasonId: number;
    onMatchClick: (m: Match) => void;
    masterTeams: MasterTeam[];      
    activeRankingData: any;         
    historyData: any;
    owners: any[]; 
}

interface TeamStanding {
    rank: number;
    name: string;
    logo: string;
    ownerName?: string; 
    realRank?: number;  
    condition?: string; 
    played: number;
    win: number;
    draw: number;
    loss: number;
    gf: number;
    ga: number;
    gd: number;
    points: number;
}

// ------------------------------------------------------------------
// 📊 [Component] Standings Table
// ------------------------------------------------------------------
const StandingsTable = ({ standings }: { standings: TeamStanding[] }) => {
    return (
        <div className="bg-[#0b101a] rounded-2xl border border-slate-800 overflow-hidden shadow-inner p-4">
            <div className="grid grid-cols-12 gap-2 text-[10px] text-slate-500 font-bold uppercase border-b border-slate-800 pb-3 mb-2 px-3">
                <div className="col-span-1 text-center">Rank</div>
                <div className="col-span-5 pl-2">Team</div>
                <div className="col-span-1 text-center">P</div>
                <div className="col-span-1 text-center">W</div>
                <div className="col-span-1 text-center">D</div>
                <div className="col-span-1 text-center">L</div>
                <div className="col-span-1 text-center">GD</div>
                <div className="col-span-1 text-center text-white">PTS</div>
            </div>

            <div className="space-y-1">
                {standings.map((team, i) => {
                    const isPromoted = i < 2; 
                    return (
                        <div 
                            key={i} 
                            className={`
                                relative grid grid-cols-12 gap-2 items-center py-3 px-3 rounded-xl transition-all overflow-hidden
                                ${isPromoted ? 'bg-[#0f1923] border border-slate-800' : 'bg-transparent border border-transparent'}
                            `}
                        >
                            {isPromoted && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
                            )}

                            <div className="col-span-1 flex justify-center z-10">
                                <span className={`w-6 h-6 flex items-center justify-center rounded-lg text-xs font-black ${isPromoted ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-500'}`}>
                                    {team.rank}
                                </span>
                            </div>

                            <div className="col-span-5 flex items-center gap-3 pl-2 z-10">
                                <div className="flex flex-col items-center gap-1.5 shrink-0 w-10">
                                    <div className="w-9 h-9 bg-white rounded-full p-0.5 shadow-sm">
                                        <img src={team.logo || FALLBACK_IMG} className="w-full h-full object-contain" alt=""/>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {getRealRankBadge(team.realRank)}
                                        {renderCondition(team.condition || '')}
                                    </div>
                                </div>
                                <div className="flex flex-col justify-center min-w-0">
                                    <span className={`leading-tight text-sm truncate ${isPromoted ? 'text-white font-bold' : 'text-slate-400'}`}>
                                        {team.name}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                                        {team.ownerName && team.ownerName !== '-' ? team.ownerName : ''}
                                    </span>
                                </div>
                            </div>

                            <div className="col-span-1 text-center text-slate-500 font-bold text-xs">{team.played}</div>
                            <div className="col-span-1 text-center text-slate-600 text-xs">{team.win}</div>
                            <div className="col-span-1 text-center text-slate-600 text-xs">{team.draw}</div>
                            <div className="col-span-1 text-center text-slate-600 text-xs">{team.loss}</div>
                            <div className="col-span-1 text-center text-slate-400 font-bold text-xs">{team.gd > 0 ? `+${team.gd}` : team.gd}</div>
                            
                            <div className="col-span-1 flex justify-center">
                                <span className={`w-8 py-0.5 rounded text-sm font-black text-center ${isPromoted ? 'text-emerald-400 bg-emerald-950/50 border border-emerald-500/30' : 'text-white'}`}>
                                    {team.points}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ------------------------------------------------------------------
// 📊 [View] Group Stage View
// ------------------------------------------------------------------
const GroupStageView = ({ 
    activeGroup, 
    setActiveGroup, 
    availableGroups, // 🔥 [추가] 유효한 조 목록
    matches, 
    onMatchClick,
    masterTeams,
    activeRankingData,
    historyData,
    owners 
}: { 
    activeGroup: string, 
    setActiveGroup: (g: string) => void,
    availableGroups: string[], // 🔥 [추가] 타입 정의
    matches: Match[],
    onMatchClick: (m: Match) => void,
    masterTeams: MasterTeam[],
    activeRankingData: any,
    historyData: any,
    owners: any[]
}) => {
    // const groups = ['A', 'B', 'C', 'D']; // 👈 기존 고정값 삭제

    const standings = useMemo(() => {
        const teamStats: { [key: string]: TeamStanding } = {};
        const groupTeams = new Set<string>();
        
        matches.forEach(m => {
            if (m.home) groupTeams.add(m.home);
            if (m.away) groupTeams.add(m.away);
        });

        groupTeams.forEach(teamName => {
            const targetName = normalize(teamName);
            const master = (masterTeams as any[]).find(mt => 
                normalize(mt.name) === targetName || 
                normalize(mt.team) === targetName ||
                normalize(String(mt.id)) === targetName 
            );

            let foundOwnerName = '-';
            const matchWithTeam = matches.find(m => m.home === teamName || m.away === teamName);
            if (matchWithTeam) {
                if (matchWithTeam.home === teamName && matchWithTeam.homeOwner) foundOwnerName = matchWithTeam.homeOwner;
                else if (matchWithTeam.away === teamName && matchWithTeam.awayOwner) foundOwnerName = matchWithTeam.awayOwner;
            }

            teamStats[teamName] = {
                rank: 0, 
                name: teamName, 
                logo: master?.logo || '',
                ownerName: foundOwnerName, 
                realRank: master?.real_rank,  
                condition: master?.condition, 
                played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, gd: 0, points: 0
            };
        });

        matches.forEach(m => {
            if (m.status === 'COMPLETED' && m.homeScore !== '' && m.awayScore !== '') {
                const home = teamStats[m.home];
                const away = teamStats[m.away];
                if (!home || !away) return;

                const hScore = Number(m.homeScore);
                const aScore = Number(m.awayScore);

                home.played++; away.played++;
                home.gf += hScore; home.ga += aScore; home.gd = home.gf - home.ga;
                away.gf += aScore; away.ga += hScore; away.gd = away.gf - away.ga;

                if (hScore > aScore) {
                    home.win++; home.points += 3;
                    away.loss++;
                } else if (hScore < aScore) {
                    away.win++; away.points += 3;
                    home.loss++;
                } else {
                    home.draw++; home.points += 1;
                    away.draw++; away.points += 1;
                }
            }
        });

        return Object.values(teamStats).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.gd !== a.gd) return b.gd - a.gd;
            return b.gf - a.gf;
        }).map((team, index) => ({ ...team, rank: index + 1 }));

    }, [matches, masterTeams]);

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex gap-2 border-b border-slate-800 pb-1 overflow-x-auto custom-scrollbar">
                {availableGroups.map(gName => ( // 🔥 [수정] availableGroups 기반 렌더링
                    <button 
                        key={gName}
                        onClick={() => setActiveGroup(gName)}
                        className={`px-6 py-3 rounded-t-xl text-sm font-black italic transition-all relative whitespace-nowrap ${
                            activeGroup === gName 
                            ? 'bg-[#0f141e] text-emerald-400 border-t border-x border-slate-700 z-10' 
                            : 'text-slate-500 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        GROUP {gName}
                        {activeGroup === gName && <div className="absolute bottom-[-1px] left-0 w-full h-[1px] bg-[#0f141e]"></div>}
                    </button>
                ))}
            </div>

            <div className="bg-[#0f141e] border border-slate-800 rounded-b-2xl rounded-tr-2xl rounded-bl-2xl p-6 shadow-2xl min-h-[500px] mt-[-5px]">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-black italic text-white flex items-center gap-3">
                        <span className="w-2 h-6 bg-emerald-500 rounded-sm shadow-[0_0_10px_#10b981]"></span>
                        GROUP {activeGroup} STANDINGS
                    </h3>
                    <div className="text-[10px] font-bold text-emerald-400 bg-emerald-950/40 px-3 py-1.5 rounded-full border border-emerald-500/30 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                        Top 2 Teams Advance
                    </div>
                </div>

                <div className="mb-8">
                    {standings.length > 0 ? (
                        <StandingsTable standings={standings} />
                    ) : (
                        <div className="p-8 text-center text-slate-500 italic border border-dashed border-slate-800 rounded-xl bg-[#0b101a]">
                            No team data available for Group {activeGroup}.
                        </div>
                    )}
                </div>

                <div>
                    <div className="flex items-center gap-2 mb-4 px-1 border-b border-slate-800 pb-2">
                        <span className="text-xl">📅</span>
                        <h4 className="text-lg font-black italic text-slate-300">MATCH FIXTURES</h4>
                    </div>
                    
                    {matches.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {matches.map((match, idx) => (
                                <div key={match.id} className="relative">
                                    <MatchCard 
                                        match={{ ...match, matchLabel: `GROUP ${activeGroup} / ${idx + 1}경기` }}
                                        onClick={onMatchClick}
                                        masterTeams={masterTeams}
                                        activeRankingData={activeRankingData}
                                        historyData={historyData}
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-10 text-center text-slate-500 italic border border-dashed border-slate-800 rounded-xl bg-[#0b101a]">
                            No matches scheduled for Group {activeGroup} yet.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const BracketView = () => (
    <div className="flex flex-col items-center justify-center min-h-[600px] bg-[#0f141e] rounded-3xl border border-slate-800 p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>
        <div className="text-center space-y-4 z-10">
            <h2 className="text-3xl font-black italic text-white tracking-tighter">TOURNAMENT BRACKET</h2>
            <p className="text-slate-400 text-sm">Knockout stage will be available after group stage.</p>
        </div>
    </div>
);

export const CupSchedule = ({ 
    seasons, 
    viewSeasonId, 
    onMatchClick, 
    masterTeams,
    activeRankingData,
    historyData,
    owners 
}: CupScheduleProps) => {
    const [activeTab, setActiveTab] = useState<'GROUP' | 'KNOCKOUT'>('GROUP');
    const currentSeason = seasons.find(s => s.id === viewSeasonId);

    // 🔥 [추가] 실제 데이터가 있는 조만 추출하는 로직
    const availableGroups = useMemo(() => {
        if (!currentSeason || !currentSeason.rounds) return [];
        const allMatches = currentSeason.rounds.flatMap(r => r.matches);
        const groupSet = new Set<string>();
        
        allMatches.forEach(m => {
            if (m.group) groupSet.add(m.group);
        });
        
        return Array.from(groupSet).sort();
    }, [currentSeason]);

    // 🔥 [수정] 초기값 설정 최적화
    const [activeGroup, setActiveGroup] = useState('A');

    // 시즌이 바뀌거나 데이터가 로드될 때 유효한 조가 있다면 첫 번째 조로 변경
    useEffect(() => {
        if (availableGroups.length > 0) {
            // 현재 선택된 조가 유효하지 않다면 첫 번째 조로 강제 이동
            if (!availableGroups.includes(activeGroup)) {
                setActiveGroup(availableGroups[0]);
            }
        }
    }, [availableGroups, activeGroup]);

    const groupMatches = useMemo(() => {
        if (!currentSeason || !currentSeason.rounds) return [];
        const allMatches = currentSeason.rounds.flatMap(r => r.matches);
        return allMatches.filter(m => {
            if (m.group) return m.group === activeGroup;
            return false; // 조별리그 탭에서는 조 정보가 없는 경기는 노출하지 않음
        });
    }, [currentSeason, activeGroup]);

    return (
        <div className="w-full max-w-6xl mx-auto space-y-6 pb-20 animate-in fade-in">
            <div className="flex justify-center mb-6">
                 <div className="flex bg-[#0f141e] p-1.5 rounded-2xl border border-slate-800 shadow-lg">
                    <button onClick={() => setActiveTab('GROUP')} className={`px-8 py-3 rounded-xl text-sm font-black italic transition-all ${activeTab === 'GROUP' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>📊 GROUP STAGE</button>
                    <button onClick={() => setActiveTab('KNOCKOUT')} className={`px-8 py-3 rounded-xl text-sm font-black italic transition-all ${activeTab === 'KNOCKOUT' ? 'bg-yellow-600 text-black shadow-lg' : 'text-slate-500 hover:text-white'}`}>⚔️ TOURNAMENT</button>
                </div>
            </div>

            {activeTab === 'GROUP' ? (
                <GroupStageView 
                    activeGroup={activeGroup} 
                    setActiveGroup={setActiveGroup}
                    availableGroups={availableGroups} // 🔥 진입 경로 추가
                    matches={groupMatches} 
                    onMatchClick={onMatchClick}
                    masterTeams={masterTeams}
                    activeRankingData={activeRankingData}
                    historyData={historyData}
                    owners={owners}
                />
            ) : (
                <BracketView />
            )}
        </div>
    );
};