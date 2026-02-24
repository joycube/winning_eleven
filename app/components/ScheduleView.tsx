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

// 🔥 오늘 날짜를 'YY.MM.DD' 형식으로 가져오는 헬퍼 함수
const getTodayFormatted = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}.${month}.${day}`;
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
  const [viewMode, setViewMode] = useState<'LEAGUE' | 'CUP'>('LEAGUE');
  const [masterTeams, setMasterTeams] = useState<MasterTeam[]>([]);
  const [owners, setOwners] = useState<any[]>([]);

  // 🔥 캡처 중인 매치 카드를 추적하는 상태 (로딩 스피너용)
  const [capturingMatchId, setCapturingMatchId] = useState<string | null>(null);

  const currentSeason = seasons.find(s => s.id === viewSeasonId);

  useEffect(() => {
    if (currentSeason?.type === 'CUP') {
        setViewMode('CUP');
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
    if (seasonType === 'LEAGUE') return stage.replace(/ROUND/i, '라운드 ').replace(/GAME/i, '경기');
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

  // 🔥 매치카드 캡처 전용 함수 (TS 에러 및 모바일 보안 에러 방어 로직 적용)
  const handleCaptureMatch = async (matchId: string, home: string, away: string) => {
    const element = document.getElementById(`match-card-wrap-${matchId}`);
    if (!element) return;
    
    setCapturingMatchId(matchId);

    try {
        // 모바일 환경에서 렌더링 타이밍 대기 (0.3초)
        await new Promise(resolve => setTimeout(resolve, 300));

        const dataUrl = await toPng(element, { 
            cacheBust: true, 
            // 🔥 Vercel 배포 에러의 주범이었던 useCORS 옵션은 html-to-image에 없는 문법이므로 삭제!
            backgroundColor: 'transparent', // 투명한 라운딩 유지
            pixelRatio: 2, 
            style: { margin: '0' }
        });
        
        const fileName = `match-${home}-vs-${away}-${Date.now()}.png`;
        
        // 1. 다운로드 실행
        download(dataUrl, fileName);
        
        // 2. 모바일일 경우 공유 시트 띄우기
        if (navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
             try {
                 const blob = await (await fetch(dataUrl)).blob();
                 const file = new File([blob], fileName, { type: blob.type });
                 await navigator.share({
                     title: '🔥 Match Result',
                     text: `${home} vs ${away} 경기 결과!`,
                     files: [file]
                 });
             } catch (shareErr) {
                 console.log('Share canceled or failed', shareErr);
             }
        } else {
             alert('📷 기기에 매치카드가 저장되었습니다!');
        }
    } catch (error: any) {
        console.error('캡처 실패:', error);
        // 🔥 [object Event] 경고창을 좀 더 친절하게 표시
        alert(`이미지 캡처에 실패했습니다.\n사파리/크롬 모바일의 외부 이미지 보안(CORS) 차단일 수 있습니다.\n\nPC 환경에서 시도해주세요!`);
    } finally {
        setCapturingMatchId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
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
                                const pureName = s.name.replace(/^(🏆|🏳️|⚔️|⚽|🗓️)\s*/, '');
                                let icon = '🏳️'; // LEAGUE
                                if (s.type === 'CUP') icon = '🏆';
                                if (s.type === 'TOURNAMENT') icon = '⚔️';
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
                                                const pureSeasonName = currentSeason?.name?.replace(/^(🏆|🏳️|⚔️|⚽|🗓️)\s*/, '') || '';
                                                
                                                return (
                                                    <div key={m.id} className="relative flex flex-col gap-1 mb-2">
                                                        
                                                        {/* 🔥 캡처 버튼을 매치카드 밖(위쪽)으로 꺼내서 우측 정렬 */}
                                                        <div className="flex justify-end w-full px-1">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleCaptureMatch(m.id, m.home, m.away); }}
                                                                disabled={capturingMatchId === m.id}
                                                                className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-emerald-400 transition-colors bg-slate-900/50 px-2.5 py-1.5 rounded-lg border border-slate-800"
                                                                title="결과 캡처 및 공유"
                                                            >
                                                                {capturingMatchId === m.id ? '⏳ 캡처 중...' : '📸 이미지로 저장'}
                                                            </button>
                                                        </div>

                                                        {/* 🔥 캡처 타겟 영역 (라운딩 유지 및 배경색 지정) */}
                                                        <div id={`match-card-wrap-${m.id}`} className="relative rounded-xl overflow-hidden bg-[#0f172a] shadow-lg">
                                                            <MatchCard 
                                                                match={{ ...m, matchLabel: customMatchLabel }} 
                                                                onClick={onMatchClick}
                                                                activeRankingData={activeRankingData}
                                                                historyData={historyData}
                                                                masterTeams={masterTeams} 
                                                            />
                                                            {/* 🔥 워터마크 (시즌명 / 날짜) - 매치카드 우측 하단에 살포시 얹힘 */}
                                                            <div className="absolute bottom-2 right-3 text-[8px] text-slate-500/80 font-bold italic pointer-events-none z-10">
                                                                시즌 '{pureSeasonName}' / {getTodayFormatted()}
                                                            </div>
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