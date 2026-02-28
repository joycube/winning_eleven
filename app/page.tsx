/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import React, { useState, useEffect, useMemo } from 'react'; 
import { db } from './firebase'; 
import { doc, updateDoc, setDoc, addDoc, collection, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Season, Match, Notice } from './types';

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
import { FinanceView } from './components/FinanceView'; 
import { NoticeView } from './components/NoticeView';

// 훅 (데이터 가져오는 엔진)
import { useLeagueData } from './hooks/useLeagueData';
import { useLeagueStats } from './hooks/useLeagueStats';
import { calculateMatchSnapshot } from './utils/predictor';

const TBD_LOGO = "https://img.uefa.com/imgml/uefacom/club-generic-badge-new.svg";

export default function FootballLeagueApp() {
  const { seasons, owners, masterTeams, leagues, banners, isLoaded } = useLeagueData();
  
  const [currentView, setCurrentView] = useState<'NOTICE' | 'RANKING' | 'SCHEDULE' | 'HISTORY' | 'FINANCE' | 'ADMIN' | 'TUTORIAL'>('NOTICE');
  const [viewSeasonId, setViewSeasonId] = useState<number>(0);
  const [adminTab, setAdminTab] = useState<any>('NEW'); 
  
  const { activeRankingData, historyData } = useLeagueStats(seasons, viewSeasonId);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  const [notices, setNotices] = useState<Notice[]>([]);
  const [latestPopupNotice, setLatestPopupNotice] = useState<Notice | null>(null);
  const [hideTicker, setHideTicker] = useState(false);
  const [hasNewNotice, setHasNewNotice] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
        const fetchedNotices = snap.docs.map(d => ({ id: d.id, ...d.data() } as Notice));
        setNotices(fetchedNotices); 
        
        const popupNotice = fetchedNotices.find(n => n.isPopup);
        if (popupNotice) {
            const hideUntil = localStorage.getItem(`hide_notice_${popupNotice.id}`);
            if (hideUntil && Date.now() < Number(hideUntil)) {
                setHideTicker(true);
            } else {
                setLatestPopupNotice(popupNotice);
                setHideTicker(false);
            }
        } else {
            setLatestPopupNotice(null);
        }
    }, (error) => {
        console.error("🚨 Error fetching notices:", error);
    });

    return () => unsubscribe(); 
  }, []);

  useEffect(() => {
      if (currentView === 'NOTICE') {
          localStorage.setItem('lastCheckedNoticeTime', String(Date.now()));
          setHasNewNotice(false);
      } else {
          let latestTime = 0;
          notices.forEach(n => {
              const time = new Date(n.updatedAt || n.createdAt).getTime();
              if (time > latestTime) latestTime = time;
          });
          const lastChecked = Number(localStorage.getItem('lastCheckedNoticeTime') || '0');
          if (latestTime > lastChecked) {
              setHasNewNotice(true);
          }
      }
  }, [currentView, notices]);

  const handleCloseTicker = () => {
      if (latestPopupNotice) {
          localStorage.setItem(`hide_notice_${latestPopupNotice.id}`, String(Date.now() + 86400000));
          setHideTicker(true);
      }
  };

  const knockoutStages = useMemo(() => {
    const currentSeason = seasons.find(s => s.id === viewSeasonId);
    if (!currentSeason || (currentSeason.type !== 'CUP' && currentSeason.type !== 'TOURNAMENT') || !currentSeason.rounds) return null;

    const getWinnerName = (match: Match | null): string => {
        if (!match) return 'TBD';
        const home = match.home?.trim();
        const away = match.away?.trim();

        if (home === 'BYE' && away !== 'BYE' && away !== 'TBD') return away;
        if (away === 'BYE' && home !== 'BYE' && home !== 'TBD') return home;
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

    currentSeason.rounds.forEach((round) => {
        round.matches?.forEach((m) => {
            const stage = m.stage?.toUpperCase() || "";
            if (stage.includes("GROUP")) return;

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

    const sync = (target: any, side: 'home' | 'away', source: Match | null) => {
        if (!target || !source) return;
        const winner = getWinnerName(source);
        if (winner !== 'TBD' && winner !== 'BYE' && (target[side] === 'TBD' || !target[side] || target[side] === 'BYE')) {
            target[side] = winner;
            const meta = getTeamMeta(winner);
            target[`${side}Logo`] = meta.logo;
            target[`${side}Owner`] = meta.owner;
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
    if (paramView && ['NOTICE', 'RANKING', 'SCHEDULE', 'HISTORY', 'FINANCE', 'TUTORIAL', 'ADMIN'].includes(paramView)) setCurrentView(paramView as any);
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

  // 🔥 [핵심 디벨롭] 토너먼트 매치 저장 및 자동 진출 알고리즘 완벽 탑재
  const handleSaveMatchResult = async (matchId: string, hScore: string, aScore: string, yt: string, records: any, manualWinner: 'HOME'|'AWAY'|null) => {
      if(!editingMatch) return;
      const s = seasons.find(se => se.id === editingMatch.seasonId);
      if(!s || !s.rounds) return;

      // 1. 순수 토너먼트 모드일 경우의 특수 알고리즘 (Tournament Tree Algorithm)
      if (s.type === 'TOURNAMENT') {
          let newRounds = JSON.parse(JSON.stringify(s.rounds)); // 깊은 복사
          let matches = newRounds[0].matches; // 토너먼트는 보통 round 1개 안에 매치를 다 때려넣음
          
          // 승자 결정 로직 (부전승, 수동 선택, 혹은 점수차)
          let winningTeam: {name: string, logo: string, owner: string} | null = null;
          const h = Number(hScore); const a = Number(aScore);
          
          if (editingMatch.away === 'BYE') winningTeam = {name: editingMatch.home, logo: editingMatch.homeLogo, owner: editingMatch.homeOwner};
          else if (editingMatch.home === 'BYE') winningTeam = {name: editingMatch.away, logo: editingMatch.awayLogo, owner: editingMatch.awayOwner};
          else if (manualWinner === 'HOME') winningTeam = {name: editingMatch.home, logo: editingMatch.homeLogo, owner: editingMatch.homeOwner};
          else if (manualWinner === 'AWAY') winningTeam = {name: editingMatch.away, logo: editingMatch.awayLogo, owner: editingMatch.awayOwner};
          else if (h > a) winningTeam = {name: editingMatch.home, logo: editingMatch.homeLogo, owner: editingMatch.homeOwner};
          else if (a > h) winningTeam = {name: editingMatch.away, logo: editingMatch.awayLogo, owner: editingMatch.awayOwner};
          else return alert("⚠️ 무승부입니다! 승자를 선택해주세요.");

          // 1-1. 현재 경기(자신) 상태를 업데이트
          const currentMatchIndex = matches.findIndex((m: any) => m.id === matchId);
          if (currentMatchIndex === -1) return;

          matches[currentMatchIndex] = {
              ...matches[currentMatchIndex],
              homeScore: hScore, awayScore: aScore, youtubeUrl: yt, status: 'COMPLETED',
              homeScorers: records.homeScorers, awayScorers: records.awayScorers,
              homeAssists: records.homeAssists, awayAssists: records.awayAssists
          };

          // 1-2. 다음 라운드(결승 등) 진출 로직!
          // 토너먼트 인덱스 공식: 내 인덱스가 i일 때, 다음 경기(부모 노드)의 인덱스는 (전체경기수/2 + Math.floor(i/2))
          const totalMatches = matches.length;
          
          // 대진표의 절반이 1라운드(예: 4강이면 2경기, 8강이면 4경기).
          // 현재 구현된 scheduler.ts를 보면 3인(4강 사이즈)일 때 총 3경기가 생성됨. (0번, 1번이 1라운드 / 2번이 결승)
          
          // 승자가 올라가야 할 다음 경기 인덱스 계산 (트리 구조)
          // 0번 경기와 1번 경기의 승자는 -> 2번 경기(결승)로 감.
          // 공식: 총 경기수가 3이면, 1라운드는 인덱스 0, 1. 결승은 2.
          let nextMatchIndex = -1;
          let isNextMatchHomeSide = currentMatchIndex % 2 === 0;

          if (totalMatches === 3) { // 4강(3인/4인) 셋업
              if (currentMatchIndex === 0 || currentMatchIndex === 1) nextMatchIndex = 2;
          } else if (totalMatches === 7) { // 8강 셋업
              if (currentMatchIndex >= 0 && currentMatchIndex <= 3) nextMatchIndex = 4 + Math.floor(currentMatchIndex / 2);
              else if (currentMatchIndex === 4 || currentMatchIndex === 5) nextMatchIndex = 6;
          } else if (totalMatches === 15) { // 16강 셋업
              if (currentMatchIndex >= 0 && currentMatchIndex <= 7) nextMatchIndex = 8 + Math.floor(currentMatchIndex / 2);
              else if (currentMatchIndex >= 8 && currentMatchIndex <= 11) nextMatchIndex = 12 + Math.floor((currentMatchIndex - 8) / 2);
              else if (currentMatchIndex === 12 || currentMatchIndex === 13) nextMatchIndex = 14;
          }

          // 다음 경기가 존재한다면, 승자를 TBD 자리에 꽂아넣기!
          if (nextMatchIndex !== -1 && winningTeam) {
              if (isNextMatchHomeSide) {
                  matches[nextMatchIndex].home = winningTeam.name;
                  matches[nextMatchIndex].homeLogo = winningTeam.logo;
                  matches[nextMatchIndex].homeOwner = winningTeam.owner;
              } else {
                  matches[nextMatchIndex].away = winningTeam.name;
                  matches[nextMatchIndex].awayLogo = winningTeam.logo;
                  matches[nextMatchIndex].awayOwner = winningTeam.owner;
              }
              // 만약 결승전에 상대방이 TBD가 아니라면 (둘 다 결정됐다면) 매치 상태를 '준비 완료'로 냅둠.
          }

          newRounds[0].matches = matches;
          await updateDoc(doc(db, "seasons", String(s.id)), { rounds: newRounds });
          setEditingMatch(null);
          return; // 토너먼트 로직 끝! 밑으로 안 내려감.
      }


      // 2. 토너먼트가 아닌 모드 (일반 리그, 하이브리드, 컵 모드 조별리그 등) 기존 저장 로직
      let newRounds = [...s.rounds];
      let currentRoundIndex = -1;

      const predictionSnapshot = calculateMatchSnapshot(editingMatch.home, editingMatch.away, activeRankingData, historyData, masterTeams);

      newRounds = newRounds.map((r, rIdx) => {
          let matches = [...r.matches];
          matches = matches.map((m) => {
              if (m.id === matchId) {
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
          return { ...r, matches };
      });

      // 컵 대회 넉아웃 스테이지(가상 뷰) 연동 로직 (기존 유지)
      if (s.type === 'CUP' && currentRoundIndex !== -1) {
          let winningTeam: {name: string, logo: string, owner: string} | null = null;
          const h = Number(hScore); const a = Number(aScore);
          const isGroupStage = editingMatch.matchLabel?.toUpperCase().includes('GROUP') || editingMatch.stage?.toUpperCase().includes('GROUP');

          if (editingMatch.away === 'BYE') winningTeam = {name: editingMatch.home, logo: editingMatch.homeLogo, owner: editingMatch.homeOwner};
          else if (manualWinner === 'HOME') winningTeam = {name: editingMatch.home, logo: editingMatch.homeLogo, owner: editingMatch.homeOwner};
          else if (manualWinner === 'AWAY') winningTeam = {name: editingMatch.away, logo: editingMatch.awayLogo, owner: editingMatch.awayOwner};
          else if (h > a) winningTeam = {name: editingMatch.home, logo: editingMatch.homeLogo, owner: editingMatch.homeOwner};
          else if (a > h) winningTeam = {name: editingMatch.away, logo: editingMatch.awayLogo, owner: editingMatch.awayOwner};
          else if (!isGroupStage) return alert("⚠️ 무승부입니다! 승자를 선택해주세요.");

          const mAny = editingMatch as any;
          if (winningTeam && !isGroupStage && mAny.nextMatchId) {
              newRounds = newRounds.map(round => ({
                  ...round,
                  matches: round.matches.map(m => {
                      if (m.id === mAny.nextMatchId) {
                          const update = mAny.nextMatchSide === 'HOME' 
                              ? { home: winningTeam!.name, homeLogo: winningTeam!.logo, homeOwner: winningTeam!.owner }
                              : { away: winningTeam!.name, awayLogo: winningTeam!.logo, awayOwner: winningTeam!.owner };
                          
                          return { ...m, ...update, homeScore: '', awayScore: '', status: 'UPCOMING' };
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
      
      {latestPopupNotice && !hideTicker && (
          <div className="w-full bg-[#050b14] border-b border-emerald-500/30 py-2.5 px-4 flex items-center justify-between z-50">
              <style>{`
                  @keyframes seamless-ticker {
                      0% { transform: translateX(0); }
                      100% { transform: translateX(-50%); }
                  }
                  .animate-ticker-seamless {
                      display: flex;
                      white-space: nowrap;
                      width: max-content;
                      animation: seamless-ticker 20s linear infinite;
                  }
                  .animate-ticker-seamless:hover {
                      animation-play-state: paused;
                  }
              `}</style>
              
              <div className="flex items-center w-full overflow-hidden">
                  <span className="shrink-0 bg-emerald-950/80 text-emerald-400 border border-emerald-500/50 px-2 py-0.5 rounded text-[10px] font-black mr-4 z-10 shadow-[0_0_10px_rgba(52,211,153,0.2)]">전체 공지</span>
                  
                  <div 
                      className="flex-1 overflow-hidden cursor-pointer flex"
                      onClick={() => {
                          setCurrentView('NOTICE');
                          if (typeof window !== 'undefined') {
                              const params = new URLSearchParams(window.location.search);
                              params.set('view', 'NOTICE');
                              params.set('noticeId', latestPopupNotice.id);
                              window.history.pushState(null, '', `?${params.toString()}`);
                              window.dispatchEvent(new Event('forceNoticeCheck'));
                          }
                      }} 
                  >
                      <div className="animate-ticker-seamless gap-16 pr-16 text-emerald-400/90 font-bold text-[11px] sm:text-xs tracking-widest drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">
                          <span>{latestPopupNotice.title}</span>
                          <span>{latestPopupNotice.title}</span>
                          <span>{latestPopupNotice.title}</span>
                          <span>{latestPopupNotice.title}</span>
                      </div>
                  </div>
              </div>

              <button 
                  onClick={handleCloseTicker} 
                  className="shrink-0 ml-4 bg-slate-800/80 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded text-[10px] font-black transition-all border border-slate-700/50 z-10"
                  title="오늘 하루 보지 않기"
              >
                  ✕ 닫기
              </button>
          </div>
      )}

      <div className="relative"><BannerSlider banners={banners || []} /><TopBar /></div>
      
      <NavTabs currentView={currentView} setCurrentView={setCurrentView} hasNewNotice={hasNewNotice} />
      
      <main className="max-w-6xl mx-auto px-4 md:px-8 space-y-8">
        
        {currentView === 'NOTICE' && (
            <NoticeView owners={owners} notices={notices} />
        )}

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