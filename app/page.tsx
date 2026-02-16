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

// 훅 (데이터 가져오는 엔진)
import { useLeagueData } from './hooks/useLeagueData';
import { useLeagueStats } from './hooks/useLeagueStats';

// 🔥 [핵심 추가] 승률 박제 도우미 함수 import
import { calculateMatchSnapshot } from './utils/predictor';

// TBD 로고 정의
const TBD_LOGO = "https://img.uefa.com/imgml/uefacom/club-generic-badge-new.svg";

export default function FootballLeagueApp() {
  // 1. 데이터 로딩
  const { seasons, owners, masterTeams, leagues, banners, isLoaded } = useLeagueData();
  
  // 2. 화면 상태 관리
  const [currentView, setCurrentView] = useState<'RANKING' | 'SCHEDULE' | 'HISTORY' | 'ADMIN' | 'TUTORIAL'>('RANKING');
  const [viewSeasonId, setViewSeasonId] = useState<number>(0);
  const [adminTab, setAdminTab] = useState<any>('NEW'); 
  
  // 3. 통계 계산 (랭킹 등)
  const { activeRankingData, historyData } = useLeagueStats(seasons, viewSeasonId);
  
  // 4. 경기 수정 모달 상태
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  // ==================================================================================
  // 🔥 [중앙 제어] 구조 기반 대진표 연산 (RankingView와 ScheduleView 공유용)
  // ==================================================================================
  const knockoutStages = useMemo(() => {
    const currentSeason = seasons.find(s => s.id === viewSeasonId);
    if (!currentSeason || (currentSeason.type !== 'CUP' && currentSeason.type !== 'TOURNAMENT') || !currentSeason.rounds) return null;

    const getWinnerName = (match: Match | null): string => {
        if (!match || match.status !== 'COMPLETED') return 'TBD';
        const h = Number(match.homeScore || 0);
        const a = Number(match.awayScore || 0);
        return h > a ? match.home : a > h ? match.away : 'TBD';
    };

    const getTeamMeta = (name: string) => {
        if (!name || name === 'TBD') return { logo: TBD_LOGO, owner: '-' };
        const normName = name.toLowerCase().trim();
        const stats = activeRankingData?.teams?.find((t: any) => t.name.toLowerCase().trim() === normName);
        const master = masterTeams?.find((m: any) => (m.name || m.teamName || '').toLowerCase().trim() === normName);
        return {
            logo: stats?.logo || (master as any)?.logo || TBD_LOGO,
            owner: stats?.ownerName || (master as any)?.ownerName || 'CPU'
        };
    };

    const createPlaceholder = (vId: string): Match => ({ 
        id: vId, home: 'TBD', away: 'TBD', homeScore: '', awayScore: '', status: 'UPCOMING',
        seasonId: viewSeasonId, homeLogo: TBD_LOGO, awayLogo: TBD_LOGO, homeOwner: '-', awayOwner: '-',
        homePredictRate: 0, awayPredictRate: 0, stage: 'TOURNAMENT', matchLabel: 'TBD', youtubeUrl: '',
        homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: []
    } as Match);

    const slots = {
        roundOf8: Array.from({ length: 4 }, (_, i) => createPlaceholder(`v-r8-${i}`)),
        roundOf4: Array.from({ length: 2 }, (_, i) => createPlaceholder(`v-r4-${i}`)),
        final: [createPlaceholder('v-final')]
    };

    let hasActualRoundOf8 = false; // 🔥 8강 실제 데이터 유무 체크

    currentSeason.rounds.forEach((round, rIdx) => {
        if (!round.matches) return;
        round.matches.forEach((m, mIdx) => {
            const stage = m.stage?.toUpperCase() || "";
            // 조별리그 경기는 무시
            if (stage.includes("GROUP")) return;

            if (stage.includes("FINAL") && !stage.includes("SEMI") && !stage.includes("QUARTER")) {
                slots.final[0] = { ...m };
            } else if (stage.includes("SEMI") || (rIdx === 1 && mIdx < 2)) {
                slots.roundOf4[mIdx] = { ...m };
            } else if (stage.includes("ROUND_OF_8") || (rIdx === 0 && mIdx < 4)) {
                slots.roundOf8[mIdx] = { ...m };
                hasActualRoundOf8 = true; // 🔥 실제 8강 데이터가 있으면 true
            }
        });
    });

    const syncWinner = (target: any, side: 'home' | 'away', source: Match | null) => {
        if (!target || !source) return;
        const winner = getWinnerName(source);
        if (winner !== 'TBD' && (target[side] === 'TBD' || !target[side])) {
            target[side] = winner;
            const meta = getTeamMeta(winner);
            target[`${side}Logo`] = meta.logo;
            target[`${side}Owner`] = meta.owner;
        }
    };

    syncWinner(slots.roundOf4[0], 'home', slots.roundOf8[0]);
    syncWinner(slots.roundOf4[0], 'away', slots.roundOf8[1]);
    syncWinner(slots.roundOf4[1], 'home', slots.roundOf8[2]);
    syncWinner(slots.roundOf4[1], 'away', slots.roundOf8[3]);
    syncWinner(slots.final[0], 'home', slots.roundOf4[0]);
    syncWinner(slots.final[0], 'away', slots.roundOf4[1]);

    return {
        ...slots,
        roundOf8: hasActualRoundOf8 ? slots.roundOf8 : null // 🔥 8강 데이터 없으면 null 반환
    };
  }, [seasons, viewSeasonId, activeRankingData, masterTeams]);

  useEffect(() => {
    if (seasons.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const paramView = params.get('view');
    const paramSeasonId = Number(params.get('season'));
    if (paramView && ['RANKING', 'SCHEDULE', 'HISTORY', 'TUTORIAL', 'ADMIN'].includes(paramView)) setCurrentView(paramView as any);
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

  // ... (이하 기존 handleSaveMatchResult 등 로직 유지) ...
  // ==================================================================================
  // 🔥 [픽스 완료] 경기 결과 저장 및 가상 매치 실제 DB화 로직
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
          if (winningTeam && !isGroupStage && mAny.nextMatchId) {
              const tournamentRound = newRounds[currentRoundIndex];
              const targetMatch = tournamentRound.matches.find(m => m.id === mAny.nextMatchId);
              if (targetMatch) {
                  if (mAny.nextMatchSide === 'HOME') { targetMatch.home = winningTeam.name; targetMatch.homeLogo = winningTeam.logo; targetMatch.homeOwner = winningTeam.owner; }
                  else { targetMatch.away = winningTeam.name; targetMatch.awayLogo = winningTeam.logo; targetMatch.awayOwner = winningTeam.owner; }
                  if (targetMatch.home !== 'TBD' && targetMatch.away !== 'TBD') targetMatch.matchLabel = targetMatch.matchLabel.replace(' (TBD)', '');
              }
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
        {currentView === 'RANKING' && <RankingView seasons={seasons} viewSeasonId={viewSeasonId} setViewSeasonId={setViewSeasonId} activeRankingData={activeRankingData} owners={owners} knockoutStages={knockoutStages} />}
        {/* 🔥 에러 수정: props 전체를 any로 캐스팅하여 속성 누락 체크 방지 */}
        {currentView === 'SCHEDULE' && (
          <ScheduleView 
            {...({ seasons, viewSeasonId, setViewSeasonId, onMatchClick: handleMatchClick, activeRankingData, historyData, knockoutStages } as any)} 
          />
        )}
        {currentView === 'HISTORY' && <HistoryView historyData={historyData} owners={owners} />}
        {currentView === 'TUTORIAL' && <TutorialView />}
        {currentView === 'ADMIN' && <AdminView adminTab={adminTab} setAdminTab={setAdminTab} seasons={seasons} owners={owners} leagues={leagues} masterTeams={masterTeams} banners={banners || []} onAdminLogin={(pw) => pw === '0705'} onCreateSeason={handleCreateSeason} onSaveOwner={handleSaveOwner} onNavigateToSchedule={handleNavigateToSchedule} />}
      </main>
      <Footer />
      {editingMatch && <MatchEditModal match={editingMatch} onClose={() => setEditingMatch(null)} onSave={handleSaveMatchResult} isTournament={seasons.find(s=>s.id===editingMatch.seasonId)?.type === 'TOURNAMENT' || seasons.find(s=>s.id===editingMatch.seasonId)?.type === 'CUP'} teamPlayers={getTeamPlayers} />}
    </div>
  );
}