/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import React, { useState, useEffect, useMemo } from 'react'; 
import { db } from './firebase'; 
import { doc, updateDoc, setDoc, addDoc, collection } from 'firebase/firestore';
import { Season, Match } from './types';

// 컴포넌트들
import { TopBar } from './components/TopBar';
import { NavTabs } from './components/NavTabs';
import { BannerSlider } from './components/BannerSlider';
import { Footer } from './components/Footer';
import { RankingView } from './components/RankingView';
import { ScheduleView } from './components/ScheduleView';
import { HistoryView } from './components/HistoryView';
import { TutorialView } from './components/TutorialView';
import { AdminView } from './components/AdminView';
import { MatchEditModal } from './components/MatchEditModal';
// 🔥 [Finance] 컴포넌트 정식 임포트 완료
import { FinanceView } from './components/FinanceView'; 

// 훅 (데이터 가져오는 엔진)
import { useLeagueData } from './hooks/useLeagueData';
import { useLeagueStats } from './hooks/useLeagueStats';

// 🔥 승률 박제 도우미 함수 import
import { calculateMatchSnapshot } from './utils/predictor';

// TBD 로고 정의
const TBD_LOGO = "https://img.uefa.com/imgml/uefacom/club-generic-badge-new.svg";

export default function FootballLeagueApp() {
  // 1. 데이터 로딩
  const { seasons, owners, masterTeams, leagues, banners, isLoaded } = useLeagueData();
  
  // 2. 화면 상태 관리 (🔥 FINANCE 추가)
  const [currentView, setCurrentView] = useState<'RANKING' | 'SCHEDULE' | 'HISTORY' | 'FINANCE' | 'ADMIN' | 'TUTORIAL'>('RANKING');
  const [viewSeasonId, setViewSeasonId] = useState<number>(0);
  const [adminTab, setAdminTab] = useState<any>('NEW'); 
  
  // 3. 통계 계산 (랭킹 등)
  const { activeRankingData, historyData } = useLeagueStats(seasons, viewSeasonId);
  
  // 4. 경기 수정 모달 상태
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  // ==================================================================================
  // 🔥 [중앙 제어] 마스터 대진표 연산 (RankingView와 ScheduleView가 100% 동일하게 사용)
  // ==================================================================================
  const knockoutStages = useMemo(() => {
    const currentSeason = seasons.find(s => s.id === viewSeasonId);
    if (!currentSeason || (currentSeason.type !== 'CUP' && currentSeason.type !== 'TOURNAMENT') || !currentSeason.rounds) return null;

    // 1. 승자 판별 로직 (BYE 처리 강화)
    const getWinnerName = (match: Match | null): string => {
        if (!match) return 'TBD';
        const home = match.home?.trim();
        const away = match.away?.trim();

        // 부전승 처리: 한쪽이 BYE면 반대쪽이 무조건 승자 (TBD 제외)
        if (home === 'BYE' && away !== 'BYE' && away !== 'TBD') return away;
        if (away === 'BYE' && home !== 'BYE' && home !== 'TBD') return home;
        
        // 경기 미완료이거나 양쪽 다 BYE/TBD면 승자 없음
        if (match.status !== 'COMPLETED') return 'TBD';
        
        const h = Number(match.homeScore || 0);
        const a = Number(match.awayScore || 0);
        if (h > a) return match.home;
        if (a > h) return match.away;
        return 'TBD';
    };

    const getTeamMeta = (name: string) => {
        if (!name || name === 'TBD') return { logo: TBD_LOGO, owner: '-' };
        if (name === 'BYE') return { logo: TBD_LOGO, owner: 'SYSTEM' };
        const normName = name.toLowerCase().trim();
        const stats = activeRankingData?.teams?.find((t: any) => t.name.toLowerCase().trim() === normName);
        const master = masterTeams?.find((m: any) => (m.name || m.teamName || '').toLowerCase().trim() === normName);
        return {
            logo: stats?.logo || (master as any)?.logo || TBD_LOGO,
            owner: stats?.ownerName || (master as any)?.ownerName || 'CPU'
        };
    };

    const createPlaceholder = (vId: string, stageName: string): Match => ({ 
        id: vId, home: 'TBD', away: 'TBD', homeScore: '', awayScore: '', status: 'UPCOMING',
        seasonId: viewSeasonId, homeLogo: TBD_LOGO, awayLogo: TBD_LOGO, homeOwner: '-', awayOwner: '-',
        homePredictRate: 0, awayPredictRate: 0, stage: stageName, matchLabel: 'TBD', youtubeUrl: '',
        homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: []
    } as Match);

    const slots = {
        roundOf8: Array.from({ length: 4 }, (_, i) => createPlaceholder(`v-r8-${i}`, 'ROUND_OF_8')),
        roundOf4: Array.from({ length: 2 }, (_, i) => createPlaceholder(`v-r4-${i}`, 'ROUND_OF_4')),
        final: [createPlaceholder('v-final', 'FINAL')]
    };

    let hasActualRoundOf8 = false;

    // 2. 실제 데이터를 ID 기반으로 슬롯에 정확히 배치 (인덱스 꼬임 방지)
    currentSeason.rounds.forEach((round) => {
        round.matches?.forEach((m) => {
            const stage = m.stage?.toUpperCase() || "";
            if (stage.includes("GROUP")) return;

            // 매치 ID 끝자리 숫자 파싱 (예: ko_4_0 -> 0)
            const idMatch = m.id.match(/_(\d+)$/);
            const idx = idMatch ? parseInt(idMatch[1], 10) : 0;

            if (stage.includes("FINAL") && !stage.includes("SEMI") && !stage.includes("QUARTER")) {
                slots.final[0] = { ...m };
            } else if (stage.includes("SEMI") || stage.includes("ROUND_OF_4")) {
                if (idx < 2) slots.roundOf4[idx] = { ...m };
            } else if (stage.includes("ROUND_OF_8")) {
                if (idx < 4) slots.roundOf8[idx] = { ...m };
                hasActualRoundOf8 = true;
            }
        });
    });

    // 3. 승자 데이터 전파 (이전 라운드 점수 이월 방지 및 BYE 필터링)
    const sync = (target: any, side: 'home' | 'away', source: Match | null) => {
        if (!target || !source) return;
        const winner = getWinnerName(source);
        
        // 승자가 실제 팀이고, 다음 라운드 슬롯이 비어있거나 BYE/TBD일 때만 전파
        if (winner !== 'TBD' && winner !== 'BYE' && (target[side] === 'TBD' || !target[side] || target[side] === 'BYE')) {
            target[side] = winner;
            const meta = getTeamMeta(winner);
            target[`${side}Logo`] = meta.logo;
            target[`${side}Owner`] = meta.owner;
            // 🔥 [중요] 미래 매치의 점수는 항상 초기화 (빈 상태)
            target[`${side}Score`] = '';
        }
    };

    sync(slots.roundOf4[0], 'home', slots.roundOf8[0]);
    sync(slots.roundOf4[0], 'away', slots.roundOf8[1]);
    sync(slots.roundOf4[1], 'home', slots.roundOf8[2]);
    sync(slots.roundOf4[1], 'away', slots.roundOf8[3]);
    sync(slots.final[0], 'home', slots.roundOf4[0]);
    sync(slots.final[0], 'away', slots.roundOf4[1]);

    return {
        ...slots,
        roundOf8: hasActualRoundOf8 ? slots.roundOf8 : null
    };
  }, [seasons, viewSeasonId, activeRankingData, masterTeams]);

  useEffect(() => {
    if (seasons.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const paramView = params.get('view');
    const paramSeasonId = Number(params.get('season'));
    // 🔥 URL 파라미터에 FINANCE 추가
    if (paramView && ['RANKING', 'SCHEDULE', 'HISTORY', 'FINANCE', 'TUTORIAL', 'ADMIN'].includes(paramView)) setCurrentView(paramView as any);
    if (paramSeasonId && seasons.find(s => s.id === paramSeasonId)) setViewSeasonId(paramSeasonId);
    else if (viewSeasonId === 0 && seasons.length > 0) setViewSeasonId(seasons[0].id);
  }, [seasons]);

  useEffect(() => {
    if (viewSeasonId > 0) {
        const params = new URLSearchParams(window.location.search);
        params.set('view', currentView);
        params.set('season', String(viewSeasonId));
        window.history.replaceState(null, '', `?${params.toString()}`);
    }
  }, [currentView, viewSeasonId]);

  const handleMatchClick = (m: Match) => setEditingMatch(m);

  // ==================================================================================
  // 🔥 [픽스 완료] 경기 결과 저장 및 승자 전파 시 데이터 오염(점수 이월) 방지
  // ==================================================================================
  const handleSaveMatchResult = async (matchId: string, hScore: string, aScore: string, yt: string, records: any, manualWinner: 'HOME'|'AWAY'|null) => {
      if(!editingMatch) return;
      const s = seasons.find(se => se.id === editingMatch.seasonId);
      if(!s || !s.rounds) return;

      let newRounds = [...s.rounds];
      let currentRoundIndex = -1;

      const isVirtual = matchId.startsWith('v-');
      let vTargetRIdx = -1;
      let vTargetMIdx = 0;

      if (isVirtual) {
          if (matchId === 'v-final') vTargetRIdx = 2;
          else if (matchId.includes('r4')) { vTargetRIdx = 1; vTargetMIdx = parseInt(matchId.split('-')[2]) || 0; }
          else if (matchId.includes('r8')) { vTargetRIdx = 0; vTargetMIdx = parseInt(matchId.split('-')[2]) || 0; }

          while (newRounds.length <= vTargetRIdx) {
              const nextRnd = newRounds.length + 1;
              newRounds.push({ 
                round: nextRnd, 
                name: nextRnd === 3 ? 'Final' : nextRnd === 2 ? 'Semi-Final' : 'Quarter-Final',
                seasonId: viewSeasonId,
                matches: [] 
              });
          }
      }

      const predictionSnapshot = calculateMatchSnapshot(editingMatch.home, editingMatch.away, activeRankingData, historyData, masterTeams);

      newRounds = newRounds.map((r, rIdx) => {
          let matches = [...r.matches];
          let found = false;

          matches = matches.map((m) => {
              if (m.id === matchId) {
                  found = true;
                  currentRoundIndex = rIdx;
                  return { 
                      ...m, homeScore: hScore, awayScore: aScore, youtubeUrl: yt, status: 'COMPLETED',
                      homeScorers: records.homeScorers, awayScorers: records.awayScorers,
                      homeAssists: records.homeAssists, awayAssists: records.awayAssists,
                      homePredictRate: predictionSnapshot.homePredictRate,
                      awayPredictRate: predictionSnapshot.awayPredictRate
                  };
              }
              return m;
          });

          if (!found && isVirtual && rIdx === vTargetRIdx) {
              currentRoundIndex = rIdx;
              const newMatchData: Match = {
                  ...editingMatch,
                  id: `m-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  homeScore: hScore, awayScore: aScore, youtubeUrl: yt, status: 'COMPLETED',
                  homeScorers: records.homeScorers, awayScorers: records.awayScorers,
                  homeAssists: records.homeAssists, awayAssists: records.awayAssists,
                  homePredictRate: predictionSnapshot.homePredictRate,
                  awayPredictRate: predictionSnapshot.awayPredictRate
              };
              if (matches[vTargetMIdx]) matches[vTargetMIdx] = { ...matches[vTargetMIdx], ...newMatchData, id: matches[vTargetMIdx].id };
              else matches[vTargetMIdx] = newMatchData;
          }
          return { ...r, matches };
      });

      if ((s.type === 'TOURNAMENT' || s.type === 'CUP') && currentRoundIndex !== -1) {
          let winningTeam: {name: string, logo: string, owner: string} | null = null;
          const h = Number(hScore); const a = Number(aScore);
          const isGroupStage = editingMatch.matchLabel?.toUpperCase().includes('GROUP') || editingMatch.stage?.toUpperCase().includes('GROUP');

          if (editingMatch.away === 'BYE' || editingMatch.away === 'BYE (부전승)') winningTeam = {name: editingMatch.home, logo: editingMatch.homeLogo, owner: editingMatch.homeOwner};
          else if (manualWinner === 'HOME') winningTeam = {name: editingMatch.home, logo: editingMatch.homeLogo, owner: editingMatch.homeOwner};
          else if (manualWinner === 'AWAY') winningTeam = {name: editingMatch.away, logo: editingMatch.awayLogo, owner: editingMatch.awayOwner};
          else if (h > a) winningTeam = {name: editingMatch.home, logo: editingMatch.homeLogo, owner: editingMatch.homeOwner};
          else if (a > h) winningTeam = {name: editingMatch.away, logo: editingMatch.awayLogo, owner: editingMatch.awayOwner};
          else if (!isGroupStage) return alert("⚠️ 무승부입니다! 승자를 선택해주세요.");

          const mAny = editingMatch as any;
          // 🔥 [중요] 다음 매치 업데이트 시, 점수 필드를 명시적으로 비우고 상태를 'UPCOMING'으로 변경하여 데이터 오염 차단
          if (winningTeam && !isGroupStage && mAny.nextMatchId) {
              newRounds = newRounds.map(round => ({
                  ...round,
                  matches: round.matches.map(m => {
                      if (m.id === mAny.nextMatchId) {
                          const update = mAny.nextMatchSide === 'HOME' 
                              ? { home: winningTeam!.name, homeLogo: winningTeam!.logo, homeOwner: winningTeam!.owner }
                              : { away: winningTeam!.name, awayLogo: winningTeam!.logo, awayOwner: winningTeam!.owner };
                          
                          return { 
                              ...m, 
                              ...update,
                              homeScore: '', // 🔥 다음 경기의 점수 초기화
                              awayScore: '', // 🔥 다음 경기의 점수 초기화
                              status: 'UPCOMING' // 🔥 상태 초기화
                          };
                      }
                      return m;
                  })
              }));
          }
      }

      await updateDoc(doc(db, "seasons", String(s.id)), { rounds: newRounds });
      setEditingMatch(null);
  };

  const handleCreateSeason = async (name: string, type: string, mode: string, prize: number, prizesObj: any) => {
      if(!name) return alert("시즌 이름을 입력하세요.");
      const id = Date.now();
      const newSeason: any = { id, name, type: type as any, leagueMode: mode as any, status: 'ACTIVE', teams: [], rounds: [], prizes: prizesObj };
      await setDoc(doc(db, "seasons", String(id)), newSeason);
      setAdminTab(id); setViewSeasonId(id);
      alert("완료");
  };

  const handleSaveOwner = async (name: string, photo: string, editId: string | null) => {
      if(!name) return;
      if (editId) await updateDoc(doc(db, "users", editId), { nickname: name, photo });
      else await addDoc(collection(db, "users"), { id: Date.now(), nickname: name, photo });
      alert("완료");
  };

  const getTeamPlayers = (teamName: string) => {
      if (!activeRankingData?.players) return [];
      const players = new Set<string>();
      activeRankingData.players.forEach((p:any) => { if(p.team === teamName) players.add(p.name); });
      return Array.from(players);
  };

  const handleNavigateToSchedule = (seasonId: number) => {
      const s = seasons.find(item => item.id === seasonId);
      const isKnockout = (s?.cupPhase as any) === 'KNOCKOUT';
      setCurrentView('SCHEDULE'); setViewSeasonId(seasonId);
      const params = new URLSearchParams(window.location.search);
      params.set('view', 'SCHEDULE'); params.set('season', String(seasonId));
      if (isKnockout) params.set('phase', 'KNOCKOUT'); 
      window.history.replaceState(null, '', `?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white font-black italic tracking-tighter overflow-x-hidden pb-20">
      <div className="relative"><BannerSlider banners={banners || []} /><TopBar /></div>
      <NavTabs currentView={currentView} setCurrentView={setCurrentView} />
      <main className="max-w-6xl mx-auto px-4 md:px-8 space-y-8">
        {currentView === 'RANKING' && (
            <RankingView 
                seasons={seasons} 
                viewSeasonId={viewSeasonId} 
                setViewSeasonId={setViewSeasonId} 
                activeRankingData={activeRankingData} 
                owners={owners} 
                knockoutStages={knockoutStages} 
            />
        )}
        {currentView === 'SCHEDULE' && (
          <ScheduleView 
            {...({ seasons, viewSeasonId, setViewSeasonId, onMatchClick: handleMatchClick, activeRankingData, historyData, knockoutStages } as any)} 
          />
        )}
        {currentView === 'HISTORY' && <HistoryView historyData={historyData} owners={owners} />}
        
        {/* 🔥 FINANCE 뷰 정식 연결 완료! */}
        {currentView === 'FINANCE' && (
            <FinanceView owners={owners} seasons={seasons} />
        )}

        {currentView === 'TUTORIAL' && <TutorialView />}
        {currentView === 'ADMIN' && <AdminView adminTab={adminTab} setAdminTab={setAdminTab} seasons={seasons} owners={owners} leagues={leagues} masterTeams={masterTeams} banners={banners || []} onAdminLogin={(pw) => pw === '0705'} onCreateSeason={handleCreateSeason} onSaveOwner={handleSaveOwner} onNavigateToSchedule={handleNavigateToSchedule} />}
      </main>
      <Footer />
      {editingMatch && <MatchEditModal match={editingMatch} onClose={() => setEditingMatch(null)} onSave={handleSaveMatchResult} isTournament={seasons.find(s=>s.id===editingMatch.seasonId)?.type === 'TOURNAMENT' || seasons.find(s=>s.id===editingMatch.seasonId)?.type === 'CUP'} teamPlayers={getTeamPlayers} />}
    </div>
  );
}