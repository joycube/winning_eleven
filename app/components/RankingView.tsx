/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';
import { FALLBACK_IMG, Owner } from '../types'; 
import { getYouTubeThumbnail } from '../utils/helpers'; 

interface RankingViewProps {
  seasons: any[];
  viewSeasonId: number;
  setViewSeasonId: (id: number) => void;
  activeRankingData: any;
  owners?: Owner[]; 
}

export const RankingView = ({ seasons, viewSeasonId, setViewSeasonId, activeRankingData, owners = [] }: RankingViewProps) => {
  const [rankingTab, setRankingTab] = useState<'STANDINGS' | 'OWNERS' | 'PLAYERS' | 'HIGHLIGHTS'>('STANDINGS');
  const [rankPlayerMode, setRankPlayerMode] = useState<'GOAL' | 'ASSIST'>('GOAL');

  // 1️⃣ 현재 선택된 시즌의 상금 규칙(prizes) 찾기
  const currentSeason = seasons.find(s => s.id === viewSeasonId);
  const prizeRule = currentSeason?.prizes || { first: 0, second: 0, third: 0 };

  // 2️⃣ 팀 랭킹 정렬 로직 강화: 승점 > 득실 > 다득점
  const sortedTeams = [...(activeRankingData.teams || [])].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points; // 1. 승점
    if (b.gd !== a.gd) return b.gd - a.gd;                 // 2. 득실차
    return (b.gf || 0) - (a.gf || 0);                      // 3. 다득점
  });

  // 3️⃣ 팀 랭킹 기반 상금 매핑 (정렬된 팀 기준)
  const firstPrizeOwnerName = sortedTeams[0]?.ownerName;  
  const secondPrizeOwnerName = sortedTeams[1]?.ownerName; 
  const thirdPrizeOwnerName = sortedTeams[2]?.ownerName; 

  const getOwnerPrize = (ownerName: string) => {
    let totalPrize = 0;
    if (ownerName === firstPrizeOwnerName) totalPrize += (prizeRule.first || 0);
    if (ownerName === secondPrizeOwnerName) totalPrize += (prizeRule.second || 0);
    if (ownerName === thirdPrizeOwnerName) totalPrize += (prizeRule.third || 0);
    return totalPrize;
  };

  // 4️⃣ 선수 랭킹 공동 순위 계산 함수
  const getPlayerRanking = (players: any[]) => {
    const sortedPlayers = players
        .filter((p:any) => rankPlayerMode === 'GOAL' ? p.goals > 0 : p.assists > 0)
        .sort((a:any,b:any) => rankPlayerMode === 'GOAL' ? b.goals - a.goals : b.assists - a.assists);

    let currentRank = 1;
    let skip = 0; 

    return sortedPlayers.map((player, index, array) => {
        if (index > 0) {
            const prevPlayer = array[index - 1];
            const prevScore = rankPlayerMode === 'GOAL' ? prevPlayer.goals : prevPlayer.assists;
            const currScore = rankPlayerMode === 'GOAL' ? player.goals : player.assists;

            if (prevScore === currScore) {
                skip++;
            } else {
                currentRank += 1 + skip;
                skip = 0; 
            }
        }
        return { ...player, rank: currentRank };
    });
  };

  const rankedPlayers = getPlayerRanking(activeRankingData.players || []);

  // 🔥 [로직 이식] 컨디션(Form) 데이터에 따른 정확한 색상 및 아이콘 매핑
  // (스케줄표와 동일한 디자인 로직 적용)
  const renderCondition = (cond: string) => {
    const c = (cond || '').toUpperCase();
    
    // 공통 스타일: 검은 원형 배경 + 테두리 + 그림자
    const circleBase = "w-5 h-5 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center shadow-sm shrink-0";
    const iconBase = "text-[10px] font-bold leading-none";

    switch (c) {
        case 'A': // 최상 (Green Up)
            return <div className={`${circleBase} border-emerald-500/30`} title="최상(A)"><span className={`${iconBase} text-emerald-400`}>⬆</span></div>;
        case 'B': // 우수 (Lime Diag-Up)
            return <div className={`${circleBase} border-lime-500/30`} title="우수(B)"><span className={`${iconBase} text-lime-400`}>↗</span></div>;
        case 'C': // 보통 (Yellow Right)
            return <div className={`${circleBase} border-yellow-500/30`} title="보통(C)"><span className={`${iconBase} text-yellow-400`}>➡</span></div>;
        case 'D': // 나쁨 (Orange Diag-Down)
            return <div className={`${circleBase} border-orange-500/30`} title="나쁨(D)"><span className={`${iconBase} text-orange-400`}>↘</span></div>;
        case 'E': // 최악 (Red Down)
            return <div className={`${circleBase} border-red-500/30`} title="최악(E)"><span className={`${iconBase} text-red-500`}>⬇</span></div>;
        default:  // 데이터 없음
            return <div className={circleBase}><span className="text-[8px] text-slate-600">-</span></div>;
    }
  };

  // 🔥 [로직 이식] 리얼 랭킹(Real Rank) 데이터에 따른 배지 스타일 매핑
  // (1,2,3위에 따른 금/은/동 색상 패턴 적용)
  const getRealRankBadge = (rank: number | undefined | null) => {
    if (!rank) return <div className="bg-slate-800 text-slate-600 text-[9px] font-bold px-1.5 py-[1px] rounded-[4px] shrink-0 border border-slate-700/50 leading-none">-</div>;
    
    // 순위별 색상 패턴 적용
    let bgClass = "bg-slate-800 text-slate-400 border-slate-700"; // 기본 (4위 이하)
    
    if (rank === 1) bgClass = "bg-yellow-500 text-black border-yellow-600"; // 1위 (노랑/검정)
    else if (rank === 2) bgClass = "bg-slate-300 text-black border-slate-400"; // 2위 (실버/검정)
    else if (rank === 3) bgClass = "bg-orange-400 text-black border-orange-500"; // 3위 (브론즈/검정)

    return (
        <div className={`${bgClass} border text-[9px] font-black px-1.5 py-[1px] rounded-[4px] italic shadow-sm shrink-0 leading-none`}>
            R.{rank}
        </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in">
        {/* 스타일 정의 */}
        {/* @ts-ignore */}
        <style jsx>{`
            @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
            @keyframes softBounce { 0%, 100% { transform: translateY(0) rotate(-10deg); } 50% { transform: translateY(-5px) rotate(-10deg); } }
            .rank-1-shimmer { background: linear-gradient(120deg, rgba(234, 179, 8, 0.1) 30%, rgba(255, 255, 255, 0.2) 50%, rgba(234, 179, 8, 0.1) 70%); background-size: 200% 100%; animation: shimmer 3s infinite linear; }
            .crown-bounce { animation: softBounce 3s infinite ease-in-out; }
        `}</style>

        {/* 상단 시즌 선택 및 탭 버튼 */}
        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex flex-col gap-4">
            <select value={viewSeasonId} onChange={(e) => setViewSeasonId(Number(e.target.value))} className="w-full bg-slate-950 text-white text-sm p-3 rounded-xl border border-slate-700">
                {seasons.map(s => <option key={s.id} value={s.id}>🏆 {s.name}</option>)}
            </select>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {['STANDINGS', 'OWNERS', 'PLAYERS', 'HIGHLIGHTS'].map(sub => (
                    <button key={sub} onClick={() => setRankingTab(sub as any)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${rankingTab === sub ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{sub}</button>
                ))}
            </div>
        </div>

        {/* STANDINGS 탭 */}
        {rankingTab === 'STANDINGS' && (
            <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                <table className="w-full text-left text-xs uppercase border-collapse">
                    <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                        <tr>
                            <th className="p-4 w-8">#</th>
                            <th className="p-4">Club</th>
                            <th className="p-2 text-center">W</th>
                            <th className="p-2 text-center">D</th>
                            <th className="p-2 text-center">L</th>
                            <th className="p-2 text-center">GD</th>
                            <th className="p-2 text-center text-emerald-400">Pts</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedTeams.map((t: any, i: number) => (
                            <tr key={t.id} className={`border-b border-slate-800/50 ${i<3 ? 'bg-emerald-900/10' : ''}`}>
                                <td className={`p-4 text-center font-bold ${i===0?'text-yellow-400':i===1?'text-slate-300':i===2?'text-orange-400':'text-slate-600'}`}>{i+1}</td>
                                
                                <td className="p-4 flex items-center gap-4">
                                    {/* 🔥 [구조 변경] 엠블럼 + 하단 정보 배지 (2단 구조) */}
                                    <div className="flex flex-col items-center gap-1.5 flex-shrink-0 w-12">
                                        <img 
                                            src={t.logo} 
                                            // flex-shrink-0 으로 찌그러짐 방지
                                            className="w-9 h-9 rounded-full bg-white object-contain p-0.5 shadow-md flex-shrink-0" 
                                            alt="" 
                                            onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}
                                        />
                                        
                                        {/* 배지 컨테이너: 리얼 랭킹 + 폼 */}
                                        <div className="flex items-center gap-1">
                                            {/* 1. 리얼 랭킹 배지 (순위별 색상 로직 적용) */}
                                            {getRealRankBadge(t.real_rank)}
                                            
                                            {/* 2. 컨디션 아이콘 (등급별 색상 로직 적용) */}
                                            {renderCondition(t.condition)}
                                        </div>
                                    </div>

                                    {/* 팀 이름 및 오너 */}
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm tracking-tight">{t.name}</span>
                                        <span className="text-[10px] text-slate-500 font-medium">{t.ownerName}</span>
                                    </div>
                                </td>
                                
                                <td className="p-2 text-center text-slate-400">{t.win}</td>
                                <td className="p-2 text-center text-slate-400">{t.draw}</td>
                                <td className="p-2 text-center text-slate-400">{t.loss}</td>
                                <td className="p-2 text-center text-slate-500">{t.gd>0?`+${t.gd}`:t.gd}</td>
                                <td className="p-2 text-center text-emerald-400 font-bold text-sm">{t.points}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
        
        {/* OWNERS 탭 */}
        {rankingTab === 'OWNERS' && (
            <div className="space-y-4">
                {activeRankingData.owners.length > 0 && (() => {
                    const firstOwner = activeRankingData.owners[0];
                    const matchedOwner = (owners && owners.length > 0) 
                                ? owners.find(owner => owner.nickname === firstOwner.name) 
                                : null;
                    const displayPhoto = matchedOwner?.photo || FALLBACK_IMG;
                    const displayPrize = getOwnerPrize(firstOwner.name);

                    return (
                        <div className="relative w-full rounded-2xl overflow-hidden border border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.15)] mb-6 transform hover:scale-[1.02] transition-transform duration-300">
                            <div className="absolute inset-0 rank-1-shimmer z-0"></div>
                            <div className="relative z-10 flex flex-col md:flex-row items-center p-5 gap-4 bg-slate-900/40 backdrop-blur-sm">
                                <div className="relative pt-3"> 
                                    <div className="absolute -top-6 -left-4 text-5xl filter drop-shadow-lg z-20 crown-bounce origin-bottom-left" style={{ transform: 'rotate(-10deg)' }}>👑</div>
                                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-full p-[3px] bg-gradient-to-tr from-yellow-300 via-yellow-500 to-yellow-200 shadow-2xl relative z-10">
                                        <div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-900">
                                            <img src={displayPhoto} alt={firstOwner.name} className="w-full h-full object-cover"/>
                                        </div>
                                    </div>
                                    <div className="absolute -bottom-3 inset-x-0 flex justify-center z-30">
                                        <span className="bg-gradient-to-r from-yellow-600 to-yellow-500 text-white text-xs font-black px-4 py-1 rounded-full border-2 border-slate-900 shadow-lg tracking-wider">1st WINNER</span>
                                    </div>
                                </div>

                                <div className="flex-1 text-center md:text-left pt-3 md:pt-0">
                                    <h3 className="text-xs md:text-sm text-yellow-500 font-bold tracking-[0.2em] mb-0.5 uppercase">The Champion</h3>
                                    <h2 className="text-3xl md:text-4xl font-black text-white mb-3 drop-shadow-md tracking-tight">{firstOwner.name}</h2>
                                    
                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                                        <div className="bg-slate-900/80 rounded-xl px-4 py-2.5 border border-slate-700 min-w-[80px]">
                                            <span className="text-[10px] text-slate-400 block font-bold mb-0.5">POINTS</span>
                                            <span className="text-xl font-black text-emerald-400">{firstOwner.points}</span>
                                        </div>
                                        <div className="bg-slate-900/80 rounded-xl px-4 py-2.5 border border-slate-700 min-w-[100px]">
                                            <span className="text-[10px] text-slate-400 block font-bold mb-0.5">RECORD</span>
                                            <span className="text-lg font-bold text-white tracking-tight">{firstOwner.win}<span className="text-sm">W</span> <span className="text-slate-500">{firstOwner.draw}<span className="text-xs">D</span></span> <span className="text-red-400">{firstOwner.loss}<span className="text-xs">L</span></span></span>
                                        </div>
                                        <div className="bg-gradient-to-r from-yellow-600/30 to-yellow-900/30 rounded-xl px-5 py-2.5 border border-yellow-500/40">
                                            <span className="text-[10px] text-yellow-500 block font-black mb-0.5">PRIZE MONEY</span>
                                            <span className="text-xl font-black text-yellow-400">₩ {displayPrize.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* 2등부터 나머지 리스트 */}
                <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                    <table className="w-full text-left text-xs uppercase border-collapse">
                        <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                            <tr>
                                <th className="p-4 w-8">#</th>
                                <th className="p-4">Owner</th>
                                <th className="p-4 text-center">Record</th> 
                                <th className="p-4 text-center text-emerald-400">Pts</th>
                                <th className="p-4 text-right">Prize</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeRankingData.owners.slice(1).map((o: any, i: number) => { 
                                const actualRank = i + 2; 
                                const matchedOwner = (owners && owners.length > 0) 
                                    ? owners.find(owner => owner.nickname === o.name) 
                                    : null;
                                const displayPhoto = matchedOwner?.photo || FALLBACK_IMG;
                                const rankPrize = getOwnerPrize(o.name);

                                return (
                                    <tr key={i} className={`border-b border-slate-800/50 ${actualRank <= 3 ? 'bg-slate-800/30' : ''}`}>
                                        <td className={`p-4 text-center font-bold ${actualRank===2?'text-slate-300':actualRank===3?'text-orange-400':'text-slate-600'}`}>{actualRank}</td>
                                        
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full bg-slate-800 border overflow-hidden flex-shrink-0 shadow-lg ${actualRank===2 ? 'border-slate-400' : actualRank===3 ? 'border-orange-500' : 'border-slate-700'}`}>
                                                    <img src={displayPhoto} alt={o.name} className="w-full h-full object-cover" onError={(e:any) => e.target.src = FALLBACK_IMG} />
                                                </div>
                                                <div className="flex flex-col justify-center">
                                                    <span className={`font-bold text-sm whitespace-nowrap ${actualRank===2 ? 'text-slate-200' : actualRank===3 ? 'text-orange-200' : 'text-white'}`}>{o.name}</span>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="p-4 text-center text-slate-400 font-medium">
                                            <span className="text-white">{o.win}</span>W <span className="text-slate-500">{o.draw}D</span> <span className="text-red-400">{o.loss}L</span>
                                        </td>

                                        <td className="p-4 text-center text-emerald-400 font-black text-sm">{o.points}</td>
                                        <td className={`p-4 text-right font-bold ${rankPrize > 0 ? 'text-yellow-400' : 'text-slate-600'}`}>
                                            ₩ {rankPrize.toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* PLAYERS 탭 */}
        {rankingTab === 'PLAYERS' && (
             <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden">
                <div className="flex bg-slate-950 border-b border-slate-800">
                    <button onClick={()=>setRankPlayerMode('GOAL')} className={`flex-1 py-3 text-xs font-bold ${rankPlayerMode==='GOAL'?'text-yellow-400 bg-slate-900':'text-slate-500'}`}>⚽ TOP SCORERS</button>
                    <button onClick={()=>setRankPlayerMode('ASSIST')} className={`flex-1 py-3 text-xs font-bold ${rankPlayerMode==='ASSIST'?'text-blue-400 bg-slate-900':'text-slate-500'}`}>🅰️ TOP ASSISTS</button>
                </div>
                <table className="w-full text-left text-xs uppercase">
                    <thead className="bg-slate-900 text-slate-500"><tr><th className="p-3 w-8">#</th><th className="p-3">Player</th><th className="p-3">Team</th><th className="p-3 text-right">{rankPlayerMode}</th></tr></thead>
                    <tbody>
                        {rankedPlayers.slice(0, 20).map((p:any, i:number) => (
                            <tr key={i} className="border-b border-slate-800/50">
                                <td className={`p-3 text-center ${p.rank<=3?'text-emerald-400 font-bold':'text-slate-600'}`}>{p.rank}</td>
                                <td className="p-3 font-bold text-white">{p.name} <span className="text-[9px] text-slate-500 font-normal ml-1">({p.owner})</span></td>
                                <td className="p-3 text-slate-400 flex items-center gap-2"><img src={p.teamLogo} className="w-5 h-5 object-contain rounded-full bg-white p-0.5" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} /><span>{p.team}</span></td>
                                <td className={`p-3 text-right font-bold ${rankPlayerMode==='GOAL'?'text-yellow-400':'text-blue-400'}`}>{rankPlayerMode==='GOAL'?p.goals:p.assists}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {/* HIGHLIGHTS 탭 */}
        {rankingTab === 'HIGHLIGHTS' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {activeRankingData.highlights.map((m:any, idx:number) => {
                    const isDraw = m.homeScore === m.awayScore;
                    return (
                        <div key={idx} className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800 group hover:border-emerald-500 transition-all cursor-pointer" onClick={() => window.open(m.youtubeUrl, '_blank')}>
                            <div className="relative aspect-video">
                                <img src={getYouTubeThumbnail(m.youtubeUrl)} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="" />
                                <div className="absolute inset-0 flex items-center justify-center"><div className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-110 transition-transform">▶</div></div>
                            </div>
                            <div className="p-3 flex items-center gap-3">
                                {isDraw ? (
                                    <div className="relative w-8 h-8 flex-shrink-0">
                                        <img src={m.homeLogo} className="w-6 h-6 absolute top-0 left-0 rounded-full bg-white object-contain p-0.5 z-10 shadow-sm border border-slate-300" alt="" />
                                        <img src={m.awayLogo} className="w-6 h-6 absolute bottom-0 right-0 rounded-full bg-white object-contain p-0.5 opacity-80" alt="" />
                                    </div>
                                ) : (
                                    <img src={m.winnerLogo} className="w-8 h-8 rounded-full bg-white object-contain p-0.5" alt="" />
                                )}
                                
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">{m.stage} • {m.matchLabel}</p>
                                    <p className="text-xs font-bold text-white truncate">{m.home} <span className="text-emerald-400">{m.homeScore}:{m.awayScore}</span> {m.away}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {activeRankingData.highlights.length === 0 && <div className="col-span-3 text-center py-10 text-slate-500">등록된 하이라이트가 없습니다.</div>}
            </div>
        )}
    </div>
  );
};