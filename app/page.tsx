/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import React, { useState, useEffect, useMemo } from 'react'; 
import { db } from './firebase'; 
import { doc, updateDoc, setDoc, addDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Season, Match, Notice } from './types';

// 🔥 [성능 최적화] Next.js Dynamic Import 불러오기
import dynamic from 'next/dynamic';

import { TopBar } from './components/TopBar';
import { NavTabs } from './components/NavTabs';
import { BannerSlider } from './components/BannerSlider';
import { Footer } from './components/Footer';

import InAppBrowserGuard from './components/InAppBrowserGuard';

import { useLeagueData } from './hooks/useLeagueData';
import { useLeagueStats } from './hooks/useLeagueStats';
import { calculateMatchSnapshot } from './utils/predictor';
import { useAuth } from './hooks/useAuth';

const LockerRoomView = dynamic(() => import('./components/LockerRoomView'));
const OwnerRoomView = dynamic(() => import('./components/OwnerRoomView'));
const RankingView = dynamic(() => import('./components/RankingView').then(mod => mod.RankingView));
const ScheduleView = dynamic(() => import('./components/ScheduleView').then(mod => mod.ScheduleView));
const HistoryView = dynamic(() => import('./components/HistoryView').then(mod => mod.HistoryView));
const FinanceView = dynamic(() => import('./components/FinanceView').then(mod => mod.FinanceView));
const AdminView = dynamic(() => import('./components/AdminView').then(mod => mod.AdminView));
const MatchEditModal = dynamic(() => import('./components/MatchEditModal').then(mod => mod.MatchEditModal));

const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";

export default function FootballLeagueApp() {
  const { seasons, owners, masterTeams, leagues, banners, historyRecords, isLoaded } = useLeagueData();
  const { authUser, isLoading: isAuthLoading } = useAuth();
  
  const [currentView, setCurrentView] = useState<'LOCKERROOM' | 'RANKING' | 'SCHEDULE' | 'HISTORY' | 'FINANCE' | 'OWNERROOM' | 'ADMIN'>('LOCKERROOM');
  const [viewSeasonId, setViewSeasonId] = useState<number>(0);
  const [adminTab, setAdminTab] = useState<any>('NEW'); 
  
  const { activeRankingData, historyData } = useLeagueStats(seasons, viewSeasonId, owners, historyRecords);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  const [notices, setNotices] = useState<Notice[]>([]);
  const [latestPopupNotice, setLatestPopupNotice] = useState<Notice | null>(null);
  const [hideTicker, setHideTicker] = useState(false);
  const [hasNewNotice, setHasNewNotice] = useState(false);

  const getOwnerUidByName = (targetName: string) => {
      if (!targetName || ['-', 'TBD', 'BYE', 'SYSTEM', 'CPU'].includes(targetName.trim())) return undefined;
      const search = targetName.trim();
      const found = owners.find(o => o.nickname === search || o.legacyName === search || o.docId === search || o.uid === search);
      return found?.uid || found?.docId || undefined;
  };

  // 🔥 [핵심 수술] 하이브리드 엔진 데이터 뻥튀기 버그 수정
  const combinedHistoryData = useMemo(() => {
      const merged = {
          teams: JSON.parse(JSON.stringify(historyData?.teams || [])),
          owners: JSON.parse(JSON.stringify(historyData?.owners || [])),
          players: JSON.parse(JSON.stringify(historyData?.players || []))
      };

      const getOrCreate = (arr: any[], key: string, keyName: string, initial: any) => {
          let item = arr.find(x => x[keyName] === key);
          if (!item) {
              item = { [keyName]: key, ...initial };
              arr.push(item);
          }
          return item;
      };

      // 💡 [해결 1] '진행 중(ACTIVE)'인 시즌만 필터링하여 중복 합산 차단
      const activeSeasons = seasons?.filter(s => s.status === 'ACTIVE') || [];

      activeSeasons.forEach((s: any) => {
          s.rounds?.forEach((r: any) => {
              r.matches?.forEach((m: any) => {
                  if (m.status === 'COMPLETED' && m.home !== 'BYE' && m.away !== 'BYE' && !m.home?.includes('부전승')) {
                      
                      const hTeam = getOrCreate(merged.teams, m.home, 'name', { win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0, logo: m.homeLogo, owner: m.homeOwner });
                      const aTeam = getOrCreate(merged.teams, m.away, 'name', { win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0, logo: m.awayLogo, owner: m.awayOwner });
                      
                      const hOwner = getOrCreate(merged.owners, m.homeOwner, 'name', { win:0, draw:0, loss:0, points:0, prize:0, golds:0, silvers:0, bronzes:0 });
                      const aOwner = getOrCreate(merged.owners, m.awayOwner, 'name', { win:0, draw:0, loss:0, points:0, prize:0, golds:0, silvers:0, bronzes:0 });

                      const hScore = Number(m.homeScore || 0);
                      const aScore = Number(m.awayScore || 0);

                      hTeam.gf += hScore; hTeam.ga += aScore; hTeam.gd += (hScore - aScore);
                      aTeam.gf += aScore; aTeam.ga += hScore; aTeam.gd += (aScore - hScore);

                      if (hScore > aScore) {
                          hTeam.win += 1; hTeam.points += 3;
                          aTeam.loss += 1;
                          hOwner.win += 1; hOwner.points += 3;
                          aOwner.loss += 1;
                      } else if (aScore > hScore) {
                          aTeam.win += 1; aTeam.points += 3;
                          hTeam.loss += 1;
                          aOwner.win += 1; aOwner.points += 3;
                          hOwner.loss += 1;
                      } else {
                          hTeam.draw += 1; hTeam.points += 1;
                          aTeam.draw += 1; aTeam.points += 1;
                          hOwner.draw += 1; hOwner.points += 1;
                          aOwner.draw += 1; aOwner.points += 1;
                      }

                      // 💡 [해결 2] 선수 식별을 '이름 + 소속팀' 으로 구분하여 다른 팀 동명이인 퓨전 방지
                      const processPlayers = (playersList: any[], teamName: string, teamLogo: string, ownerName: string, isGoal: boolean) => {
                          playersList?.forEach((p: any) => {
                              const pName = p.name?.trim();
                              if (!pName) return;
                              
                              let pRec = merged.players.find((x:any) => x.name === pName && x.team === teamName);
                              if (!pRec) {
                                  pRec = { name: pName, team: teamName, goals: 0, assists: 0, teamLogo: teamLogo, owner: ownerName };
                                  merged.players.push(pRec);
                              }

                              if (isGoal) pRec.goals += Number(p.count || 1);
                              else pRec.assists += Number(p.count || 1);
                              
                              pRec.teamLogo = teamLogo;
                              pRec.owner = ownerName;
                          });
                      };

                      processPlayers(m.homeScorers, m.home, m.homeLogo, m.homeOwner, true);
                      processPlayers(m.awayScorers, m.away, m.awayLogo, m.awayOwner, true);
                      processPlayers(m.homeAssists, m.home, m.homeLogo, m.homeOwner, false);
                      processPlayers(m.awayAssists, m.away, m.awayLogo, m.awayOwner, false);
                  }
              });
          });
      });

      return merged;
  }, [historyData, seasons]);

  const handleViewChange = (newView: any) => {
      setCurrentView(newView);
      
      if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          params.set('view', newView);

          if (newView === 'LOCKERROOM') {
              params.delete('postId');
              params.delete('noticeId');
              window.history.pushState(null, '', `?${params.toString()}`);
              window.dispatchEvent(new Event('popstate')); 
          } else if (newView === 'RANKING' || newView === 'SCHEDULE') {
              if (seasons && seasons.length > 0) {
                  const latestSeasonId = seasons[0].id;
                  setViewSeasonId(latestSeasonId);
                  params.set('season', String(latestSeasonId));
              }
              window.history.pushState(null, '', `?${params.toString()}`);
          } else {
              window.history.pushState(null, '', `?${params.toString()}`);
          }
      }
  };

  useEffect(() => {
    if (currentView === 'ADMIN' && !isAuthLoading) {
      if (authUser?.role !== 'ADMIN') {
        alert('🚫 관리자 권한이 없습니다. 마스터 계정으로 로그인해주세요.');
        setCurrentView('LOCKERROOM');
      }
    }
  }, [currentView, authUser, isAuthLoading]);

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
      if (currentView === 'LOCKERROOM') {
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
        if (!name || name === 'TBD') return { logo: SAFE_TBD_LOGO, owner: '-', ownerUid: undefined };
        if (name === 'BYE') return { logo: SAFE_TBD_LOGO, owner: 'SYSTEM', ownerUid: undefined };
        const normName = name.toLowerCase().trim();
        const stats = activeRankingData?.teams?.find((t: any) => t.name.toLowerCase().trim() === normName);
        const master = masterTeams?.find((m: any) => (m.name || m.teamName || '').toLowerCase().trim() === normName);
        
        const ownerName = stats?.ownerName || (master as any)?.ownerName || 'CPU';
        return {
            logo: stats?.logo || (master as any)?.logo || SAFE_TBD_LOGO,
            owner: ownerName,
            ownerUid: getOwnerUidByName(ownerName) 
        };
    };

    const createPlaceholder = (vId: string, stageName: string): Match => ({ 
        id: vId, home: 'TBD', away: 'TBD', homeScore: '', awayScore: '', status: 'UPCOMING',
        seasonId: viewSeasonId, homeLogo: SAFE_TBD_LOGO, awayLogo: SAFE_TBD_LOGO, homeOwner: '-', awayOwner: '-',
        homeOwnerUid: undefined, awayOwnerUid: undefined,
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
                slots.final[0] = { ...m, homeLogo: m.homeLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.homeLogo, awayLogo: m.awayLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.awayLogo };
            } else if (stage.includes("SEMI") || stage.includes("ROUND_OF_4")) {
                if (idx < 2) slots.roundOf4[idx] = { ...m, homeLogo: m.homeLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.homeLogo, awayLogo: m.awayLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.awayLogo };
            } else if (stage.includes("ROUND_OF_8")) {
                if (idx < 4) slots.roundOf8[idx] = { ...m, homeLogo: m.homeLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.homeLogo, awayLogo: m.awayLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.awayLogo };
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
            target[`${side}OwnerUid`] = meta.ownerUid; 
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
    if (paramView && ['LOCKERROOM', 'RANKING', 'SCHEDULE', 'HISTORY', 'FINANCE', 'OWNERROOM', 'ADMIN'].includes(paramView)) setCurrentView(paramView as any);
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

  const handleSaveMatchResult = async (matchId: string, hScore: string, aScore: string, yt: string, records: any, manualWinner: 'HOME'|'AWAY'|null) => {
      if(!editingMatch) return;
      const s = seasons.find(se => se.id === editingMatch.seasonId);
      if(!s || !s.rounds) return;

      const injectUidToPlayers = (players: any[], teamOwnerName: string) => {
          const ownerUid = getOwnerUidByName(teamOwnerName);
          return players.map((p: any) => ({
              ...p,
              ownerUid: ownerUid 
          }));
      };

      const safeRecords = {
          homeScorers: injectUidToPlayers(records?.homeScorers || [], editingMatch.homeOwner),
          awayScorers: injectUidToPlayers(records?.awayScorers || [], editingMatch.awayOwner),
          homeAssists: injectUidToPlayers(records?.homeAssists || [], editingMatch.homeOwner),
          awayAssists: injectUidToPlayers(records?.awayAssists || [], editingMatch.awayOwner)
      };

      type WinTeamType = {name: string, logo: string, owner: string, ownerUid?: string};

      if (s.type === 'TOURNAMENT') {
          let newRounds = JSON.parse(JSON.stringify(s.rounds)); 
          let matches = newRounds[0].matches; 
          
          let winningTeam: WinTeamType | null = null;
          const h = Number(hScore); const a = Number(aScore);
          
          const hTeam: WinTeamType = {name: editingMatch.home, logo: editingMatch.homeLogo, owner: editingMatch.homeOwner, ownerUid: editingMatch.homeOwnerUid || getOwnerUidByName(editingMatch.homeOwner)};
          const aTeam: WinTeamType = {name: editingMatch.away, logo: editingMatch.awayLogo, owner: editingMatch.awayOwner, ownerUid: editingMatch.awayOwnerUid || getOwnerUidByName(editingMatch.awayOwner)};

          if (editingMatch.away === 'BYE' || editingMatch.away === 'BYE (부전승)') winningTeam = hTeam;
          else if (editingMatch.home === 'BYE' || editingMatch.home === 'BYE (부전승)') winningTeam = aTeam;
          else if (manualWinner === 'HOME') winningTeam = hTeam;
          else if (manualWinner === 'AWAY') winningTeam = aTeam;
          else if (h > a) winningTeam = hTeam;
          else if (a > h) winningTeam = aTeam;
          else return alert("⚠️ 무승부입니다! 승자를 선택해주세요.");

          const currentMatchIndex = matches.findIndex((m: any) => m.id === matchId);
          if (currentMatchIndex === -1) return;

          matches[currentMatchIndex] = {
              ...matches[currentMatchIndex],
              homeScore: hScore, awayScore: aScore, youtubeUrl: yt, status: 'COMPLETED',
              ...safeRecords
          };

          const totalMatches = matches.length;
          let nextMatchIndex = -1;
          let isNextMatchHomeSide = currentMatchIndex % 2 === 0;

          if (totalMatches === 3) { 
              if (currentMatchIndex <= 1) nextMatchIndex = 2;
          } else if (totalMatches === 7) { 
              if (currentMatchIndex <= 3) nextMatchIndex = 4 + Math.floor(currentMatchIndex / 2);
              else if (currentMatchIndex <= 5) nextMatchIndex = 6;
          } else if (totalMatches === 15) { 
              if (currentMatchIndex <= 7) nextMatchIndex = 8 + Math.floor(currentMatchIndex / 2);
              else if (currentMatchIndex <= 11) nextMatchIndex = 12 + Math.floor((currentMatchIndex - 8) / 2);
              else if (currentMatchIndex <= 13) nextMatchIndex = 14;
          }

          if (nextMatchIndex !== -1 && winningTeam) {
              if (isNextMatchHomeSide) {
                  matches[nextMatchIndex].home = winningTeam.name;
                  matches[nextMatchIndex].homeLogo = winningTeam.logo;
                  matches[nextMatchIndex].homeOwner = winningTeam.owner;
                  matches[nextMatchIndex].homeOwnerUid = winningTeam.ownerUid; 
              } else {
                  matches[nextMatchIndex].away = winningTeam.name;
                  matches[nextMatchIndex].awayLogo = winningTeam.logo;
                  matches[nextMatchIndex].awayOwner = winningTeam.owner;
                  matches[nextMatchIndex].awayOwnerUid = winningTeam.ownerUid; 
              }
          }

          newRounds[0].matches = matches;
          await updateDoc(doc(db, "seasons", String(s.id)), { rounds: newRounds });
          setEditingMatch(null);
          return; 
      }

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

      const predictionSnapshot = calculateMatchSnapshot(editingMatch.home, editingMatch.away, activeRankingData, combinedHistoryData || { allTimeStats: [] }, masterTeams);

      newRounds = newRounds.map((r, rIdx) => {
          let matches = [...r.matches];
          let found = false;

          matches = matches.map((m) => {
              if (m.id === matchId) {
                  found = true;
                  currentRoundIndex = rIdx;
                  return { 
                      ...m, homeScore: hScore, awayScore: aScore, youtubeUrl: yt, status: 'COMPLETED',
                      ...safeRecords,
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
                  ...safeRecords,
                  homePredictRate: predictionSnapshot.homePredictRate,
                  awayPredictRate: predictionSnapshot.awayPredictRate
              };
              if (matches[vTargetMIdx]) matches[vTargetMIdx] = { ...matches[vTargetMIdx], ...newMatchData, id: matches[vTargetMIdx].id };
              else matches[vTargetMIdx] = newMatchData;
          }
          return { ...r, matches };
      });

      if (s.type === 'CUP' && currentRoundIndex !== -1) {
          let winningTeam: WinTeamType | null = null;
          const h = Number(hScore); const a = Number(aScore);
          const isGroupStage = editingMatch.matchLabel?.toUpperCase().includes('GROUP') || editingMatch.stage?.toUpperCase().includes('GROUP');

          const hTeam: WinTeamType = {name: editingMatch.home, logo: editingMatch.homeLogo, owner: editingMatch.homeOwner, ownerUid: editingMatch.homeOwnerUid || getOwnerUidByName(editingMatch.homeOwner)};
          const aTeam: WinTeamType = {name: editingMatch.away, logo: editingMatch.awayLogo, owner: editingMatch.awayOwner, ownerUid: editingMatch.awayOwnerUid || getOwnerUidByName(editingMatch.awayOwner)};

          if (editingMatch.away === 'BYE' || editingMatch.away === 'BYE (부전승)') winningTeam = hTeam;
          else if (manualWinner === 'HOME') winningTeam = hTeam;
          else if (manualWinner === 'AWAY') winningTeam = aTeam;
          else if (h > a) winningTeam = hTeam;
          else if (a > h) winningTeam = aTeam;
          else if (!isGroupStage) return alert("⚠️ 무승부입니다! 승자를 선택해주세요.");

          const mAny = editingMatch as any;
          if (winningTeam && !isGroupStage && mAny.nextMatchId) {
              newRounds = newRounds.map(round => ({
                  ...round,
                  matches: round.matches.map(m => {
                      if (m.id === mAny.nextMatchId) {
                          const update = mAny.nextMatchSide === 'HOME' 
                              ? { home: winningTeam!.name, homeLogo: winningTeam!.logo, homeOwner: winningTeam!.owner, homeOwnerUid: winningTeam!.ownerUid } 
                              : { away: winningTeam!.name, awayLogo: winningTeam!.logo, awayOwner: winningTeam!.owner, awayOwnerUid: winningTeam!.ownerUid }; 
                          
                          return { 
                              ...m, 
                              ...update,
                              homeScore: '',
                              awayScore: '',
                              status: 'UPCOMING'
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
      
      <InAppBrowserGuard />

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
                          setCurrentView('LOCKERROOM'); 
                          if (typeof window !== 'undefined') {
                              const params = new URLSearchParams(window.location.search);
                              params.set('view', 'LOCKERROOM');
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

      <div className="relative"><BannerSlider banners={banners || []} /><TopBar setCurrentView={handleViewChange} /></div>
      <NavTabs currentView={currentView} setCurrentView={handleViewChange} hasNewNotice={hasNewNotice} />
      
      <main className="max-w-6xl mx-auto px-4 md:px-8 space-y-8">
        
        {currentView === 'LOCKERROOM' && (
            <LockerRoomView 
                user={authUser as any} 
                notices={notices} 
                seasons={seasons} 
                masterTeams={masterTeams} 
                owners={owners} 
                activeRankingData={activeRankingData} 
            />
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
            {...({ seasons, viewSeasonId, setViewSeasonId, onMatchClick: handleMatchClick, activeRankingData, historyData: combinedHistoryData, knockoutStages } as any)} 
          />
        )}
        
        {currentView === 'HISTORY' && <HistoryView historyData={combinedHistoryData} owners={owners} />}
        
        {currentView === 'FINANCE' && (
            <FinanceView owners={owners} seasons={seasons} user={authUser as any} />
        )}

        {currentView === 'OWNERROOM' && (
            <OwnerRoomView 
                user={authUser as any} 
                masterTeams={masterTeams} 
                historyData={combinedHistoryData} 
                seasons={seasons} 
                owners={owners} 
            />
        )}

        {currentView === 'ADMIN' && authUser?.role === 'ADMIN' && (
          <AdminView 
            adminTab={adminTab} 
            setAdminTab={setAdminTab} 
            seasons={seasons} 
            owners={owners} 
            leagues={leagues} 
            masterTeams={masterTeams} 
            banners={banners || []} 
            onAdminLogin={() => true} 
            onCreateSeason={handleCreateSeason} 
            onSaveOwner={handleSaveOwner} 
            onNavigateToSchedule={handleNavigateToSchedule} 
          />
        )}
      </main>
      <Footer />
      
      {editingMatch && (
        <MatchEditModal 
            match={editingMatch} 
            onClose={() => setEditingMatch(null)} 
            onSave={handleSaveMatchResult} 
            isTournament={seasons.find(s=>s.id===editingMatch.seasonId)?.type === 'TOURNAMENT' || seasons.find(s=>s.id===editingMatch.seasonId)?.type === 'CUP'} 
            teamPlayers={getTeamPlayers} 
            owners={owners}
        />
      )}
    </div>
  );
}