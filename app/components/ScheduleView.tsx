import React from 'react';
import { MatchCard } from './MatchCard'; // MatchCard 연결
import { Season, Match } from '../types';

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
  const currentSeason = seasons.find(s => s.id === viewSeasonId);

  // 🔥 [추가] 스테이지(그룹) 명칭 한글 변환 함수
  const getKoreanStageName = (stage: string) => {
    const s = stage.toUpperCase();
    
    // 토너먼트 명칭 매핑
    if (s.includes('ROUND OF 32') || s.includes('32')) return '32강';
    if (s.includes('ROUND OF 16') || s.includes('16')) return '16강';
    if (s.includes('QUARTER') || s.includes('8')) return '8강';
    if (s.includes('SEMI') || s.includes('4')) return '준결승'; // 4강 -> 준결승
    if (s.includes('THIRD')) return '3·4위전';
    if (s.includes('FINAL')) return '결승';
    
    // 리그 명칭 매핑 (ROUND 1 -> 1라운드)
    if (s.includes('ROUND')) {
        const num = s.replace(/[^0-9]/g, ''); // 숫자만 추출
        return `${num}라운드`;
    }
    
    return stage; // 매칭 안되면 원본 반환
  };

  return (
    <div className="space-y-6 animate-in fade-in">
        {/* 시즌 선택 셀렉터 */}
        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
            <select value={viewSeasonId} onChange={(e) => setViewSeasonId(Number(e.target.value))} className="w-full bg-slate-950 text-white text-sm p-3 rounded-xl border border-slate-700">
                {seasons.map(s => <option key={s.id} value={s.id}>🗓️ {s.name}</option>)}
            </select>
        </div>
        
        {/* 라운드 및 스테이지별 그룹핑 렌더링 */}
        {currentSeason?.rounds?.map((r, rIdx) => {
            const uniqueStages = Array.from(new Set(r.matches.map(m => m.stage)));

            return (
                <div key={rIdx} className="space-y-6"> {/* 스테이지 간 간격 확보 */}
                    {uniqueStages.map((stageName) => {
                        // 🔥 [수정 1-1] 게임 그룹 명칭 한글화 (ex: 8강, 1라운드)
                        const displayStageName = getKoreanStageName(stageName);
                        
                        return (
                            <div key={stageName} className="space-y-2">
                                {/* 🔥 헤더 분리: 한글 명칭 적용 */}
                                <h3 className="text-xs font-bold text-slate-500 pl-2 border-l-2 border-emerald-500 uppercase">
                                    {displayStageName}
                                </h3>
                                
                                {/* 해당 스테이지에 속한 경기만 필터링하여 1단 리스트로 출력 */}
                                <div className="grid md:grid-cols-1 gap-2">
                                    {r.matches
                                        .filter(m => m.stage === stageName)
                                        .map((m, mIdx) => {
                                            // 🔥 [수정 2] 부전승 여부 체크
                                            const isBye = m.away === 'BYE' || m.away === 'BYE (부전승)' || m.status === 'BYE';

                                            // 🔥 [수정 1-2] 게임 명칭 생성 (ex: 8강 1게임, 1라운드 2게임)
                                            // 기존 m.matchLabel 대신 화면 표시용 라벨을 덮어씌움
                                            const customMatchLabel = `${displayStageName} ${mIdx + 1}게임`;
                                            const displayMatch = { ...m, matchLabel: customMatchLabel };

                                            return (
                                                <div key={m.id} className="relative">
                                                    <MatchCard 
                                                        match={displayMatch} 
                                                        onClick={onMatchClick}
                                                        activeRankingData={activeRankingData}
                                                        historyData={historyData}
                                                    />
                                                    
                                                    {/* 🔥 [수정 2] 부전승 코멘터리 노출 (오버레이) */}
                                                    {isBye && (
                                                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center rounded-xl z-10 pointer-events-none">
                                                            <div className="bg-slate-900/90 text-emerald-400 text-xs font-bold px-4 py-2 rounded-full border border-emerald-500/50 shadow-2xl flex items-center gap-2">
                                                                <span>✨</span>
                                                                <span>{m.home} 부전승 진출! (Walkover)</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    }
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
    </div>
  );
};