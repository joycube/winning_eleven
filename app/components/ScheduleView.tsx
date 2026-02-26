// components/ScheduleView.tsx
import React, { useState, useEffect } from 'react';
import { collection, getDocs, query } from 'firebase/firestore'; 
import { db } from '../firebase'; 
import { MatchCard } from './MatchCard'; 
import { CupSchedule } from './CupSchedule'; 
import { Season, Match, MasterTeam } from '../types'; 

// 🔥 캡처 라이브러리 추가
import { toPng } from 'html-to-image';
// 🔥 [에러 해결] Vercel 빌드 시 TypeScript 예외 처리
// @ts-ignore
import download from 'downloadjs';

const TBD_LOGO = "https://img.uefa.com/imgml/uefacom/club-generic-badge-new.svg";
const FALLBACK_IMG = "https://via.placeholder.com/64?text=FC";

const getTodayFormatted = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}.${month}.${day}`;
};

const BracketMatchBox = ({ match, title, highlight = false, isByeSlot = false }: any) => {
    if (!match) return null;
    
    const hScore = match.homeScore !== '' ? Number(match.homeScore) : null;
    const aScore = match.awayScore !== '' ? Number(match.awayScore) : null;
    
    let winner = match.aggWinner || 'TBD'; 
    if (winner === 'TBD' && match.status === 'COMPLETED') {
        if (hScore !== null && aScore !== null) {
            if (hScore > aScore) winner = match.home;
            else if (aScore > hScore) winner = match.away;
        }
    }

    const isHomeWin = winner !== 'TBD' && winner === match.home;
    const isAwayWin = winner !== 'TBD' && winner === match.away;

    const renderRow = (teamName: string, score: number | null, isWinner: boolean, owner: string, logo: string) => {
        const isTbd = teamName === 'TBD' || !teamName;
        const isBye = teamName === 'BYE';
        const displayLogo = logo || (isTbd || isBye ? TBD_LOGO : FALLBACK_IMG);
        const dispOwner = owner || '-';

        return (
            <div className={`flex items-center justify-between px-3 py-2.5 h-[50px] ${isWinner ? 'bg-gradient-to-r from-emerald-900/40 to-transparent' : ''} ${isTbd || isBye ? 'opacity-30' : ''}`}>
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-full shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0 ${isTbd || isBye ? 'bg-slate-700' : 'bg-white'}`}>
                        <img src={displayLogo} className={`${isTbd || isBye ? 'w-full h-full' : 'w-[70%] h-[70%]'} object-contain`} alt="" />
                    </div>
                    <div className="flex flex-col justify-center min-w-0">
                        <span className={`text-[11px] font-black leading-tight truncate uppercase tracking-tight ${isWinner ? 'text-white' : isTbd || isBye ? 'text-slate-500' : 'text-slate-400'}`}>
                            {teamName || 'TBD'}
                        </span>
                        {!isTbd && !isBye && (
                            <span className="text-[9px] text-slate-500 font-bold italic truncate mt-0.5">{dispOwner}</span>
                        )}
                        {isBye && <span className="text-[9px] text-slate-600 font-bold italic">Unassigned</span>}
                    </div>
                </div>
                <div className={`text-lg font-black italic tracking-tighter w-8 text-right ${isWinner ? 'text-emerald-400' : 'text-slate-600'}`}>
                    {isBye ? '0' : (score ?? '-')}
                </div>
            </div>
        );
    };

    return (
        <div className={`flex flex-col w-[200px] sm:w-[220px] ${isByeSlot ? 'opacity-70' : ''}`}>
            {title && <div className="text-[9px] font-bold text-slate-500 uppercase mb-1.5 pl-1 tracking-widest opacity-60">{title}</div>}
            <div className={`flex flex-col bg-[#0f141e]/90 backdrop-blur-md border rounded-xl overflow-hidden shadow-xl relative z-10 ${highlight ? 'border-yellow-500/50 shadow-yellow-500/20' : 'border-slate-800/50'}`}>
                {renderRow(match.home, hScore, isHomeWin, match.homeOwner, match.homeLogo)}
                <div className="h-[1px] bg-slate-800/40 w-full relative"></div>
                {renderRow(match.away, aScore, isAwayWin, match.awayOwner, match.awayLogo)}
            </div>
        </div>
    );
};


interface ScheduleViewProps {
  seasons: Season[];
  viewSeasonId: number;
  setViewSeasonId: (id: number) => void;
  onMatchClick: (m: Match) => void;
  activeRankingData: any;
  historyData: any;
}

export const ScheduleView = ({ 
  seasons, viewSeasonId, setViewSeasonId, onMatchClick,
  activeRankingData, historyData 
}: ScheduleViewProps) => {
  const [viewMode, setViewMode] = useState<'LEAGUE' | 'CUP' | 'LEAGUE_PLAYOFF'>('LEAGUE');
  const [masterTeams, setMasterTeams] = useState<MasterTeam[]>([]);
  const [owners, setOwners] = useState<any[]>([]);

  const [capturingMatchId, setCapturingMatchId] = useState<string | null>(null);

  const currentSeason = seasons.find(s => s.id === viewSeasonId);

  useEffect(() => {
    if (currentSeason?.type === 'CUP') {
        setViewMode('CUP');
    } else if (currentSeason?.type === 'LEAGUE_PLAYOFF') {
        setViewMode('LEAGUE_PLAYOFF');
    } else {
        setViewMode('LEAGUE');
    }
  }, [viewSeasonId, seasons, currentSeason]); 

  useEffect(() => {
    const fetchData = async () => {
      try {
        const teamQ = query(collection(db, 'master_teams'));
        const teamSnapshot = await getDocs(teamQ);
        const teams = teamSnapshot.docs.map(doc => ({
          id: doc.data().id,
          ...doc.data()
        })) as MasterTeam[];
        setMasterTeams(teams);

        const userQ = query(collection(db, 'users'));
        const userSnapshot = await getDocs(userQ);
        const userList = userSnapshot.docs.map(doc => doc.data());
        setOwners(userList);

      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, []);

  const getKoreanStageName = (stage: string, matchCount: number, seasonType: string = 'LEAGUE') => {
    const s = stage.toUpperCase();

    if (seasonType === 'LEAGUE' || seasonType === 'LEAGUE_PLAYOFF') {
        if (s.includes('ROUND_OF_4')) return '🔥 플레이오프 (4강)';
        if (s.includes('SEMI_FINAL')) return '🔥 플레이오프 (결승)';
        if (s.includes('FINAL')) return '🏆 대망의 최종 결승전';
        if (s.includes('ROUND') && /\d/.test(s)) return s.replace(/ROUND\s/i, '라운드 ').replace(/GAME/i, '경기');
    }

    if (s.includes('34') || s.includes('3RD')) return '🥉 3·4위전';
    if (s === 'FINAL') return '🏆 결승전';
    if (s.includes('SEMI')) return '4강 (준결승)';
    if (matchCount === 16) return '32강';
    if (matchCount === 8) return '16강';
    if (matchCount === 4) return '8강';
    if (matchCount === 2) return '4강 (준결승)';
    if (matchCount === 1) return '🏆 결승전';
    return stage;
  };

  const handleCaptureMatch = async (matchId: string, home: string, away: string) => {
    const element = document.getElementById(`match-card-wrap-${matchId}`);
    if (!element) return;
    
    setCapturingMatchId(matchId);

    try {
        await new Promise(resolve => setTimeout(resolve, 300));
        const dataUrl = await toPng(element, { cacheBust: true, backgroundColor: 'transparent', pixelRatio: 2, style: { margin: '0' }});
        const fileName = `match-${home}-vs-${away}-${Date.now()}.png`;
        download(dataUrl, fileName);
        
        if (navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
             try {
                 const blob = await (await fetch(dataUrl)).blob();
                 const file = new File([blob], fileName, { type: blob.type });
                 await navigator.share({ title: '🔥 Match Result', text: `${home} vs ${away} 경기 결과!`, files: [file] });
             } catch (shareErr) { }
        } else {
             alert('📷 기기에 매치카드가 저장되었습니다!');
        }
    } catch (error: any) {
        alert(`이미지 캡처에 실패했습니다.\n사파리/크롬 모바일의 외부 이미지 보안(CORS) 차단일 수 있습니다.\n\nPC 환경에서 시도해주세요!`);
    } finally {
        setCapturingMatchId(null);
    }
  };

  // 🔥 [TS 에러 픽스] (master as any)?.ownerName 으로 타입 에러 해결
  const getTeamInfo = (teamName: string) => {
      if (!teamName || teamName === 'TBD') return { name: 'TBD', logo: TBD_LOGO, owner: '-' };
      const tNorm = teamName.trim().toLowerCase().replace(/\s+/g, '');
      const stats = activeRankingData?.teams?.find((t: any) => t.name.trim().toLowerCase().replace(/\s+/g, '') === tNorm);
      const master = masterTeams.find(m => m.name.trim().toLowerCase().replace(/\s+/g, '') === tNorm);
      return {
          name: stats?.name || master?.name || teamName,
          logo: stats?.logo || master?.logo || FALLBACK_IMG,
          owner: stats?.ownerName || (master as any)?.ownerName || '-' // 🔥 TS 2339 해결
      };
  };

  // 🔥 [TS 에러 픽스] leg2가 존재하는지 && 조건 추가하여 타입 안전성 확보
  const calcAgg = (leg1: Match | undefined, leg2: Match | undefined) => {
      if (!leg1) return null;
      let s1 = 0, s2 = 0;
      let isLeg1Done = leg1.status === 'COMPLETED';
      let isLeg2Done = leg2 && leg2.status === 'COMPLETED';
      
      const t1 = leg1.home;
      const t2 = leg1.away;

      if (isLeg1Done) { 
          s1 += Number(leg1.homeScore); 
          s2 += Number(leg1.awayScore); 
      }
      if (isLeg2Done && leg2) { // 🔥 TS 18048 해결: leg2의 존재를 명확히 체크
          if (leg2.home === t2) {
              s2 += Number(leg2.homeScore);
              s1 += Number(leg2.awayScore);
          } else {
              s1 += Number(leg2.homeScore);
              s2 += Number(leg2.awayScore);
          }
      }

      let aggWinner = 'TBD';
      if (isLeg1Done && (!leg2 || isLeg2Done)) {
          if (s1 > s2) aggWinner = t1;
          else if (s2 > s1) aggWinner = t2;
      }

      return {
          ...leg1,
          homeScore: isLeg1Done || isLeg2Done ? String(s1) : '',
          awayScore: isLeg1Done || isLeg2Done ? String(s2) : '',
          status: (isLeg1Done && (!leg2 || isLeg2Done)) ? 'COMPLETED' : 'UPCOMING',
          aggWinner
      };
  };

  const displayRounds = currentSeason?.rounds ? JSON.parse(JSON.stringify(currentSeason.rounds)) : [];

  const po4Rounds = displayRounds.filter((r: any) => r.name === 'ROUND_OF_4').flatMap((r: any) => r.matches);
  const poFinalRounds = displayRounds.filter((r: any) => r.name === 'SEMI_FINAL').flatMap((r: any) => r.matches);
  const grandFinalRounds = displayRounds.filter((r: any) => r.name === 'FINAL').flatMap((r: any) => r.matches);

  const poSemi1_leg1 = po4Rounds.find((m: any) => m.matchLabel.includes('5위') && m.matchLabel.includes('1차전'));
  const poSemi1_leg2 = po4Rounds.find((m: any) => m.matchLabel.includes('2위') && m.matchLabel.includes('2차전'));
  const poSemi2_leg1 = po4Rounds.find((m: any) => m.matchLabel.includes('4위') && m.matchLabel.includes('1차전'));
  const poSemi2_leg2 = po4Rounds.find((m: any) => m.matchLabel.includes('3위') && m.matchLabel.includes('2차전'));

  const compSemi1 = calcAgg(poSemi1_leg1, poSemi1_leg2);
  const compSemi2 = calcAgg(poSemi2_leg1, poSemi2_leg2);

  if (compSemi1?.aggWinner && compSemi1.aggWinner !== 'TBD') {
      poFinalRounds.forEach((m: any) => {
          const info = getTeamInfo(compSemi1.aggWinner);
          m.home = info.name; m.homeLogo = info.logo; m.homeOwner = info.owner;
      });
  }
  if (compSemi2?.aggWinner && compSemi2.aggWinner !== 'TBD') {
      poFinalRounds.forEach((m: any) => {
          const info = getTeamInfo(compSemi2.aggWinner);
          m.away = info.name; m.awayLogo = info.logo; m.awayOwner = info.owner;
      });
  }

  const poFinal_leg1 = poFinalRounds.find((m: any) => m.matchLabel.includes('1차전'));
  const poFinal_leg2 = poFinalRounds.find((m: any) => m.matchLabel.includes('2차전'));
  const compPoFinal = calcAgg(poFinal_leg1, poFinal_leg2);

  if (compPoFinal?.aggWinner && compPoFinal.aggWinner !== 'TBD') {
      grandFinalRounds.forEach((m: any) => {
          const info = getTeamInfo(compPoFinal.aggWinner);
          m.away = info.name; m.awayLogo = info.logo; m.awayOwner = info.owner;
      });
  }

  const displayGrandFinal = grandFinalRounds.length > 0 ? grandFinalRounds[0] : null;

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 shadow-lg">
             <div className="flex items-center gap-3">
                <span className="text-slate-400 text-sm font-bold whitespace-nowrap hidden md:block">SELECT SEASON:</span>
                <select 
                    value={viewSeasonId} 
                    onChange={(e) => setViewSeasonId(Number(e.target.value))} 
                    className="w-full bg-slate-950 text-white text-sm font-bold p-3 rounded-xl border border-slate-700 focus:border-emerald-500 outline-none cursor-pointer transition-colors hover:border-slate-500"
                >
                    {seasons.map(s => (
                        <option key={s.id} value={s.id}>
                            {(() => {
                                const pureName = s.name.replace(/^(🏆|🏳️|⚔️|⚽|🗓️|⭐)\s*/, '');
                                let icon = '🏳️'; // LEAGUE
                                if (s.type === 'CUP') icon = '🏆';
                                if (s.type === 'TOURNAMENT') icon = '⚔️';
                                if (s.type === 'LEAGUE_PLAYOFF') icon = '⭐'; // 하이브리드 전용 아이콘
                                return `${icon} ${pureName}`;
                            })()}
                        </option>
                    ))}
                </select>
             </div>
        </div>

        {viewMode === 'CUP' ? (
            <CupSchedule 
                seasons={seasons}
                viewSeasonId={viewSeasonId}
                onMatchClick={onMatchClick}
                masterTeams={masterTeams}       
                activeRankingData={activeRankingData}
                historyData={historyData}
                owners={owners} 
            />
        ) : viewMode === 'LEAGUE_PLAYOFF' ? (
            <div className="space-y-12">
                <style dangerouslySetInnerHTML={{ __html: `
                    .bracket-tree { display: inline-flex; align-items: center; justify-content: flex-start; gap: 40px; padding: 10px 0 20px 4px; min-width: max-content; }
                    .bracket-column { display: flex; flex-direction: column; justify-content: center; gap: 20px; position: relative; }
                    .no-scrollbar::-webkit-scrollbar { display: none; }
                `}} />

                <div className="overflow-x-auto pb-4 no-scrollbar border-b border-slate-800/50 mb-8">
                    <div className="min-w-max md:min-w-[760px] px-2">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-1.5 h-6 bg-yellow-500 rounded-full shadow-[0_0_10px_#eab308]"></div>
                            <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">PLAYOFF BRACKET</h3>
                        </div>
                        <div className="bracket-tree no-scrollbar">
                            <div className="bracket-column">
                                <BracketMatchBox match={compSemi1} title="PO 4강 1경기 (합산)" />
                                <BracketMatchBox match={compSemi2} title="PO 4강 2경기 (합산)" />
                            </div>
                            <div className="bracket-column">
                                <BracketMatchBox match={compPoFinal} title="PO 결승 (합산)" />
                            </div>
                            <div className="bracket-column">
                                <div className="relative scale-110 ml-4">
                                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-2xl animate-bounce">👑</div>
                                    <BracketMatchBox match={displayGrandFinal} title="🏆 Grand Final (단판)" highlight />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-1.5 h-6 bg-emerald-500 rounded-full shadow-[0_0_10px_#10b981]"></div>
                        <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">MATCH SCHEDULE</h3>
                    </div>
                    {displayRounds.map((r: any, rIdx: number) => {
                        const uniqueStages = Array.from(new Set(r.matches.map((m: any) => m.stage)));
                        const totalMatchesInRound = r.matches.length;
                        return (
                            <div key={`hybrid-r-${rIdx}`} className="space-y-6">
                                {uniqueStages.map((stageName: any) => {
                                    const displayStageName = getKoreanStageName(stageName, totalMatchesInRound, 'LEAGUE_PLAYOFF');
                                    return (
                                        <div key={stageName} className="space-y-2">
                                            <h3 className="text-xs font-bold text-slate-500 pl-2 border-l-2 border-emerald-500 uppercase">
                                                {displayStageName}
                                            </h3>
                                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {r.matches.filter((m: any) => m.stage === stageName).map((m: any, mIdx: number) => {
                                                    let customMatchLabel = `${displayStageName} / ${mIdx + 1}경기`;
                                                    if (m.matchLabel && m.matchLabel.includes('PO')) customMatchLabel = m.matchLabel; 
                                                    else if (m.matchLabel && m.matchLabel.includes('결승전')) customMatchLabel = m.matchLabel;
                                                    
                                                    const pureSeasonName = currentSeason?.name?.replace(/^(🏆|🏳️|⚔️|⚽|🗓️|⭐)\s*/, '') || '';
                                                    return (
                                                        <div key={m.id} className="relative flex flex-col gap-1 mb-2">
                                                            <div className="flex justify-end w-full px-1">
                                                                <button onClick={(e) => { e.stopPropagation(); handleCaptureMatch(m.id, m.home, m.away); }} disabled={capturingMatchId === m.id} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-emerald-400 transition-colors bg-slate-900/50 px-2.5 py-1.5 rounded-lg border border-slate-800" title="결과 캡처 및 공유">
                                                                    {capturingMatchId === m.id ? '⏳ 캡처 중...' : '📸 이미지로 저장'}
                                                                </button>
                                                            </div>
                                                            <div id={`match-card-wrap-${m.id}`} className="relative rounded-xl overflow-hidden bg-[#0f172a] shadow-lg">
                                                                <MatchCard match={{ ...m, matchLabel: customMatchLabel }} onClick={onMatchClick} activeRankingData={activeRankingData} historyData={historyData} masterTeams={masterTeams} />
                                                                <div className="absolute bottom-2 right-3 text-[8px] text-slate-500/80 font-bold italic pointer-events-none z-10">{`시즌 '${pureSeasonName}' / ${getTodayFormatted()}`}</div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        ) : (
            <>
                {currentSeason?.rounds?.map((r, rIdx) => {
                    const uniqueStages = Array.from(new Set(r.matches.map(m => m.stage)));
                    const totalMatchesInRound = r.matches.length;
                    const seasonType = currentSeason.type || 'LEAGUE';

                    return (
                        <div key={rIdx} className="space-y-6">
                            {uniqueStages.map((stageName) => {
                                const displayStageName = getKoreanStageName(stageName, totalMatchesInRound, seasonType);
                                return (
                                    <div key={stageName} className="space-y-2">
                                        <h3 className="text-xs font-bold text-slate-500 pl-2 border-l-2 border-emerald-500 uppercase">
                                            {displayStageName}
                                        </h3>
                                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {r.matches.filter(m => m.stage === stageName).map((m, mIdx) => {
                                                const customMatchLabel = `${displayStageName} / ${mIdx + 1}경기`;
                                                const pureSeasonName = currentSeason?.name?.replace(/^(🏆|🏳️|⚔️|⚽|🗓️|⭐)\s*/, '') || '';
                                                
                                                return (
                                                    <div key={m.id} className="relative flex flex-col gap-1 mb-2">
                                                        <div className="flex justify-end w-full px-1">
                                                            <button onClick={(e) => { e.stopPropagation(); handleCaptureMatch(m.id, m.home, m.away); }} disabled={capturingMatchId === m.id} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-emerald-400 transition-colors bg-slate-900/50 px-2.5 py-1.5 rounded-lg border border-slate-800">
                                                                {capturingMatchId === m.id ? '⏳ 캡처 중...' : '📸 이미지로 저장'}
                                                            </button>
                                                        </div>
                                                        <div id={`match-card-wrap-${m.id}`} className="relative rounded-xl overflow-hidden bg-[#0f172a] shadow-lg">
                                                            <MatchCard match={{ ...m, matchLabel: customMatchLabel }} onClick={onMatchClick} activeRankingData={activeRankingData} historyData={historyData} masterTeams={masterTeams} />
                                                            <div className="absolute bottom-2 right-3 text-[8px] text-slate-500/80 font-bold italic pointer-events-none z-10">{`시즌 '${pureSeasonName}' / ${getTodayFormatted()}`}</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
                {(!currentSeason?.rounds || currentSeason.rounds.length === 0) && (
                    <div className="text-center py-10 text-slate-500">등록된 스케줄이 없습니다.</div>
                )}
            </>
        )}
    </div>
  );
};