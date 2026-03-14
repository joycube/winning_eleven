"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { CalendarDays, MessageSquare, Flame, ChevronRight, Image as ImageIcon, Clock } from 'lucide-react';
import { FALLBACK_IMG } from '../types';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

// 실제 매치톡 DB를 참조하는 전용 프리뷰 컴포넌트
const RecentMatchTalkPreview = ({ match, owners, onEnter }: any) => {
    const [latestComment, setLatestComment] = useState<any>(null);

    useEffect(() => {
        if (!match.id) return;
        const q = query(collection(db, 'match_comments'), where('matchId', '==', match.id));
        const unsubscribe = onSnapshot(q, (snap) => {
            const docs = snap.docs.map((d: any) => d.data());
            if (docs.length > 0) {
                docs.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
                setLatestComment(docs[0]);
            } else {
                setLatestComment(null);
            }
        });
        return () => unsubscribe();
    }, [match.id]);

    const getOwnerProfileLocal = (uid: string, name: string) => {
        const found = owners?.find((o:any) => o.uid === uid || o.nickname === name);
        return found?.photo || FALLBACK_IMG;
    };

    return (
        <div onClick={onEnter} className="bg-[#080d1a] border-t border-slate-800/80 py-3 px-4 sm:px-6 flex items-center justify-between group/talk cursor-pointer hover:bg-[#0b1221] transition-colors">
            {latestComment ? (
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <img src={getOwnerProfileLocal(latestComment.authorUid, latestComment.authorName)} className="w-5 h-5 rounded-full object-cover border border-slate-700 bg-slate-800 shrink-0" alt="" onError={(e:any)=>{e.target.src=FALLBACK_IMG}} />
                    <div className="flex items-baseline gap-1.5 min-w-0">
                        <span className="text-[10px] font-black text-blue-400 shrink-0">{latestComment.authorName}</span>
                        <span className="text-[11px] text-slate-300 font-medium truncate">
                            {latestComment.text?.startsWith('[STICKER]') ? '(스티커를 보냈습니다 ✨)' : latestComment.text}
                        </span>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-2 min-w-0 flex-1 opacity-70 group-hover/talk:opacity-100 transition-opacity">
                    <MessageSquare size={12} className="text-slate-500 shrink-0" />
                    <span className="text-[10px] font-bold text-slate-400 truncate">가장 먼저 코멘트(매치톡)를 남겨보세요!</span>
                </div>
            )}
            <div className="flex items-center text-[9px] font-black text-slate-500 group-hover/talk:text-blue-400 transition-colors shrink-0 pl-3">
                매치톡 입장 <ChevronRight size={12} className="ml-0.5" />
            </div>
        </div>
    );
};

// 🔥 날짜/시간 정렬을 완벽하게 잡아주는 유틸리티 함수
const getTimestamp = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    if (typeof val.toDate === 'function') return val.toDate().getTime();
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? 0 : parsed;
};

export default function L_LockerRoomDashboard({ user, notices, seasons, masterTeams, owners, activeSeason, posts, uidDict, setViewMode, setCategory, setSelectedPostId }: any) {
  const [communityTab, setCommunityTab] = useState<'HOT' | 'FREE'>('HOT');
  const [matchTab, setMatchTab] = useState<'UPCOMING' | 'RECENT'>('UPCOMING');
  
  const activeOrLatestSeason = useMemo(() => {
      if (!seasons || seasons.length === 0) return null;
      const active = seasons.find((s: any) => s.status === 'ACTIVE');
      return active || [...seasons].sort((a: any, b: any) => b.id - a.id)[0];
  }, [seasons]);

  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);

  useEffect(() => {
      if (activeOrLatestSeason && !selectedSeasonId) {
          setSelectedSeasonId(activeOrLatestSeason.id);
      }
  }, [activeOrLatestSeason, selectedSeasonId]);

  const currentDashboardSeason = useMemo(() => {
      return seasons?.find((s: any) => s.id === selectedSeasonId) || activeOrLatestSeason;
  }, [seasons, selectedSeasonId, activeOrLatestSeason]);

  // --- 유틸 함수 ---
  const getRealLogoLocal = (teamName: string, fallback: string) => {
      if (!teamName || teamName === 'TBD' || teamName === 'BYE') return fallback || FALLBACK_IMG;
      const matched = masterTeams?.find((m: any) => (m.name || '').toLowerCase() === teamName.toLowerCase() || (m.teamName || '').toLowerCase() === teamName.toLowerCase());
      return matched?.logo || fallback || FALLBACK_IMG;
  };

  const getTeamMasterInfo = (teamName: string) => {
      if (!masterTeams || masterTeams.length === 0) return undefined;
      const cleanTarget = teamName.replace(/\s+/g, '').toLowerCase();
      return (masterTeams as any[]).find((t: any) => (t.name || t.teamName || '').replace(/\s+/g, '').toLowerCase() === cleanTarget);
  };

  const getOwnerProfile = (idOrName: string, fallbackName?: string) => {
      const search1 = idOrName?.toString().trim();
      const search2 = fallbackName?.toString().trim();
      
      const found = owners?.find((o:any) => 
          o.docId === search1 || String(o.id) === search1 || o.uid === search1 || o.nickname === search1 ||
          (search2 && o.nickname === search2)
      );
      return found?.photo || FALLBACK_IMG;
  };

  // --- 대진표 재계산 ---
  const processedRounds = useMemo(() => {
      if (!currentDashboardSeason || !currentDashboardSeason.rounds) return [];

      const displayRounds = JSON.parse(JSON.stringify(currentDashboardSeason.rounds));

      const fillTeamData = (match: any, side: 'home' | 'away', teamName: string) => {
          match[side] = teamName;
          const master = getTeamMasterInfo(teamName);
          match[`${side}Logo`] = master?.logo || FALLBACK_IMG;
          const owner = owners?.find((o:any) => o.nickname === master?.ownerName || o.legacyName === master?.ownerName);
          match[`${side}Owner`] = owner?.nickname || master?.ownerName || '-';
          match[`${side}OwnerUid`] = owner?.uid || master?.ownerUid || '';
      };

      if (currentDashboardSeason.type === 'LEAGUE_PLAYOFF') {
          const calcAgg = (leg1: any, leg2: any) => {
              if (!leg1) return null;
              let s1 = 0, s2 = 0;
              let isLeg1Done = leg1.status === 'COMPLETED';
              let isLeg2Done = leg2 && leg2.status === 'COMPLETED';
              const t1 = leg1.home; const t2 = leg1.away;
              
              if (isLeg1Done) { s1 += Number(leg1.homeScore); s2 += Number(leg1.awayScore); }
              if (isLeg2Done && leg2) { 
                  if (leg2.home === t2) { s2 += Number(leg2.homeScore); s1 += Number(leg2.awayScore); } 
                  else { s1 += Number(leg2.homeScore); s2 += Number(leg2.awayScore); }
              }
              
              let aggWinner = 'TBD';
              if (leg2 && leg2.aggWinner && leg2.aggWinner !== 'TBD') aggWinner = leg2.aggWinner;
              else if (leg1 && leg1.aggWinner && leg1.aggWinner !== 'TBD') aggWinner = leg1.aggWinner;
              else if (isLeg1Done && (!leg2 || isLeg2Done)) {
                  if (s1 > s2) aggWinner = t1;
                  else if (s2 > s1) aggWinner = t2;
              }
              return { ...leg1, aggWinner };
          };

          const po4Rounds = displayRounds.filter((r: any) => r.name === 'ROUND_OF_4').flatMap((r: any) => r.matches);
          const poFinalRounds = displayRounds.filter((r: any) => r.name === 'SEMI_FINAL').flatMap((r: any) => r.matches);
          const grandFinalRounds = displayRounds.filter((r: any) => r.name === 'FINAL').flatMap((r: any) => r.matches);

          const poSemi1_leg1 = po4Rounds.find((m: any) => m.matchLabel?.includes('5위') && m.matchLabel?.includes('1차전'));
          const poSemi1_leg2 = po4Rounds.find((m: any) => m.matchLabel?.includes('2위') && m.matchLabel?.includes('2차전'));
          const poSemi2_leg1 = po4Rounds.find((m: any) => m.matchLabel?.includes('4위') && m.matchLabel?.includes('1차전'));
          const poSemi2_leg2 = po4Rounds.find((m: any) => m.matchLabel?.includes('3위') && m.matchLabel?.includes('2차전'));

          const compSemi1 = calcAgg(poSemi1_leg1, poSemi1_leg2);
          const compSemi2 = calcAgg(poSemi2_leg1, poSemi2_leg2);

          if (compSemi1?.aggWinner && compSemi1.aggWinner !== 'TBD') {
              poFinalRounds.forEach((m: any) => fillTeamData(m, 'home', compSemi1.aggWinner));
          }
          if (compSemi2?.aggWinner && compSemi2.aggWinner !== 'TBD') {
              poFinalRounds.forEach((m: any) => fillTeamData(m, 'away', compSemi2.aggWinner));
          }

          const poFinal_leg1 = poFinalRounds.find((m: any) => m.matchLabel?.includes('1차전'));
          const poFinal_leg2 = poFinalRounds.find((m: any) => m.matchLabel?.includes('2차전'));
          const compPoFinal = calcAgg(poFinal_leg1, poFinal_leg2);

          if (compPoFinal?.aggWinner && compPoFinal.aggWinner !== 'TBD') {
              grandFinalRounds.forEach((m: any) => fillTeamData(m, 'away', compPoFinal.aggWinner));
          }
      }
      return displayRounds;
  }, [currentDashboardSeason, masterTeams, owners]);

  // --- 데이터 추출 ---
  const upcomingMatchesList = useMemo(() => {
      const matches: any[] = [];
      processedRounds.forEach((r: any) => {
          r.matches?.forEach((m: any) => {
              const isNotPlayed = m.status === 'SCHEDULED' || m.status === 'PENDING' || (!m.homeScore && !m.awayScore && m.status !== 'COMPLETED');
              if (isNotPlayed && m.home !== 'BYE' && m.away !== 'BYE') {
                  matches.push({ ...m, matchLabel: r.name }); 
              }
          });
      });
      return matches.slice(0, 5); 
  }, [processedRounds]);

  const recentMatchesList = useMemo(() => {
      const matches: any[] = [];
      processedRounds.forEach((r: any) => {
          r.matches?.forEach((m: any) => {
              if (m.status === 'COMPLETED' && m.home !== 'BYE' && m.away !== 'BYE') {
                  matches.push({ ...m, matchLabel: r.name }); 
              }
          });
      });
      return matches.reverse().slice(0, 5); 
  }, [processedRounds]);

  const hotPosts = [...posts].sort((a: any, b: any) => (b.views || 0) + ((b.comments?.length || 0) * 2) - ((a.views || 0) + ((a.comments?.length || 0) * 2))).slice(0, 5);

  // LIVE FEED: 커뮤니티 데이터 가공
  const communityComments = useMemo(() => {
      let allComments: any[] = [];
      posts.forEach((p: any) => {
          if (p.comments && Array.isArray(p.comments)) {
              allComments.push(...p.comments.map((c: any) => ({ ...c, type: 'COMMUNITY', targetId: p.id })));
          }
          if (p.replies && Array.isArray(p.replies)) {
              allComments.push(...p.replies.map((c: any) => ({ ...c, type: 'COMMUNITY', targetId: p.id })));
          }
      });
      
      allComments.sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));
      
      const recent = allComments.slice(0, 10).map((c: any) => ({
          id: c.id || Math.random().toString(),
          name: c.authorName || c.ownerName || '익명',
          uid: c.authorUid || c.ownerUid || c.authorName || c.ownerName,
          text: c.text,
          type: c.type,
          targetId: c.targetId
      }));

      if (recent.length === 0) {
          return owners?.slice(0, 3).map((o:any) => ({ id: Math.random(), name: o.nickname, uid: o.uid, text: "오늘도 활기찬 리그! 🔥", type: 'COMMUNITY', targetId: '' })) || [];
      }
      return recent;
  }, [posts, owners]);

  // LIVE FEED: 스케줄 매치톡 최신 데이터 수신
  const [matchCommentsData, setMatchCommentsData] = useState<any[]>([]);
  useEffect(() => {
      const q = query(collection(db, 'match_comments'), orderBy('createdAt', 'desc'), limit(15));
      const unsubscribe = onSnapshot(q, (snap) => {
          const docs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
          setMatchCommentsData(docs);
      });
      return () => unsubscribe();
  }, []);

  const matchComments = useMemo(() => {
      const sortedMatchComments = [...matchCommentsData].sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));
      
      const recent = sortedMatchComments.slice(0, 10).map((c: any) => ({
          id: c.id,
          name: c.authorName || c.ownerName || '익명',
          uid: c.authorUid || c.ownerUid || c.authorName || c.ownerName,
          text: c.text,
          type: 'MATCH',
          targetId: c.matchId,
          seasonId: c.seasonId
      }));

      if (recent.length === 0) {
          return owners?.slice(0, 3).map((o:any) => ({ id: Math.random(), name: o.nickname, uid: o.uid, text: "경기 기대됩니다! ⚽", type: 'MATCH', targetId: '' })) || [];
      }
      return recent;
  }, [matchCommentsData, owners]);

  // --- 네비게이션 핸들러 ---
  const handlePostClick = (post: any) => {
      setSelectedPostId(post.id);
      setViewMode('LIST');
      const params = new URLSearchParams(window.location.search);
      params.set('view', 'LOCKERROOM'); params.set('postId', post.id);
      window.history.pushState(null, '', `/?${params.toString()}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMatchTalkClick = (m: any) => {
      const targetSeasonId = m.seasonId || selectedSeasonId || (seasons && seasons.length > 0 ? seasons[0].id : 0);
      window.location.href = `/?view=SCHEDULE&season=${targetSeasonId}&matchId=${m.id}`;
  };

  const handleTickerItemClick = (msg: any) => {
      if (!msg.targetId) return;
      if (msg.type === 'COMMUNITY') {
          handlePostClick({ id: msg.targetId });
      } else if (msg.type === 'MATCH') {
          let sId = msg.seasonId;
          if (!sId) {
              for (const s of seasons) {
                  for (const r of s.rounds || []) {
                      if (r.matches?.find((m:any) => m.id === msg.targetId)) {
                          sId = s.id; break;
                      }
                  }
                  if (sId) break;
              }
          }
          handleMatchTalkClick({ id: msg.targetId, seasonId: sId || selectedSeasonId });
      }
  };

  // --- 컴포넌트 렌더러 ---
  const renderTierBadge = (tier?: string) => {
      const t = (tier || 'C').toUpperCase();
      const colors = t === 'S' ? 'bg-yellow-500 text-black shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 
                     t === 'A' ? 'bg-slate-300 text-black' : 
                     t === 'B' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300';
      return <span className={`px-1 py-[1px] rounded-[3px] text-[8px] font-black leading-none ${colors}`}>{t}</span>;
  };

  const renderRankCondition = (rank?: number, condition?: string) => {
      const rColors = rank === 1 ? 'text-yellow-500' : rank === 2 ? 'text-slate-300' : rank === 3 ? 'text-orange-400' : 'text-slate-400';
      const cConfig: any = { 'A': '↑', 'B': '↗', 'C': '→', 'D': '↘', 'E': '⬇' };
      const cColor: any = { 'A': 'text-emerald-400', 'B': 'text-teal-400', 'C': 'text-slate-400', 'D': 'text-orange-400', 'E': 'text-red-500' };
      const cond = condition?.toUpperCase() || 'C';
      
      return (
          <div className="flex items-center gap-1 text-[9px] font-black bg-slate-950 px-1.5 py-[2px] rounded border border-slate-700/50 shadow-inner shrink-0">
              {rank && rank > 0 ? <span className={rColors}>R.{rank}</span> : <span className="text-slate-600">R.-</span>}
              <span className={cColor[cond]}>{cConfig[cond]}</span>
          </div>
      );
  };

  const renderMatchRow = (m: any, isRecent: boolean) => {
      const homeMaster = getTeamMasterInfo(m.home);
      const awayMaster = getTeamMasterInfo(m.away);
      const hRate = Number(m.homePredictRate) > 0 ? Number(m.homePredictRate) : 50;
      const aRate = Number(m.awayPredictRate) > 0 ? Number(m.awayPredictRate) : 50;
      
      const pureSeasonName = currentDashboardSeason?.name?.replace(/^(🏆|🏳️|⚔️|⚽|🗓️|⭐)\s*/, '') || '';

      return (
          <div className="flex flex-col bg-slate-900/40 relative transition-colors group">
              <div 
                  onClick={() => isRecent && handleMatchTalkClick(m)} 
                  className={`flex justify-between items-center px-2 py-5 sm:px-6 sm:py-6 ${isRecent ? 'hover:bg-slate-800/40 cursor-pointer' : ''}`}
              >
                  {/* HOME */}
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 justify-end min-w-0">
                      <div className="flex flex-col items-end gap-1 min-w-0">
                          <span className="text-[13px] sm:text-[15px] font-black text-white truncate max-w-[85px] sm:max-w-[140px] leading-none">{m.home}</span>
                          <div className="flex items-center gap-1 mt-1">
                              {m.home !== 'TBD' && renderTierBadge(homeMaster?.tier)}
                              {m.home !== 'TBD' && renderRankCondition(homeMaster?.real_rank, homeMaster?.condition)}
                          </div>
                      </div>
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full p-1.5 shadow-md shrink-0">
                          <img src={getRealLogoLocal(m.home, m.homeLogo)} className="w-full h-full object-contain" alt="" onError={(e:any)=>{e.target.src=FALLBACK_IMG}} />
                      </div>
                  </div>
                  
                  {/* CENTER */}
                  <div className="w-[80px] sm:w-[100px] shrink-0 flex flex-col items-center justify-center px-1">
                      <span className="text-[8px] text-blue-400 font-black mb-0.5 truncate w-full text-center tracking-tighter opacity-80">{pureSeasonName}</span>
                      <span className="text-[9px] text-slate-500 font-bold mb-1.5 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 uppercase tracking-widest text-center line-clamp-1">{m.matchLabel || 'MATCH'}</span>
                      {isRecent ? (
                          <div className="flex items-center gap-1.5 text-[20px] sm:text-[24px] font-black italic tracking-tighter leading-none">
                              <span className={Number(m.homeScore) > Number(m.awayScore) ? 'text-emerald-400' : 'text-slate-200'}>{m.homeScore}</span>
                              <span className="text-slate-600 text-sm">:</span>
                              <span className={Number(m.awayScore) > Number(m.homeScore) ? 'text-emerald-400' : 'text-slate-200'}>{m.awayScore}</span>
                          </div>
                      ) : (
                          <span className="text-[12px] sm:text-[14px] font-black text-slate-600 italic mt-1">VS</span>
                      )}
                  </div>

                  {/* AWAY */}
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 justify-start min-w-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full p-1.5 shadow-md shrink-0">
                          <img src={getRealLogoLocal(m.away, m.awayLogo)} className="w-full h-full object-contain" alt="" onError={(e:any)=>{e.target.src=FALLBACK_IMG}} />
                      </div>
                      <div className="flex flex-col items-start gap-1 min-w-0">
                          <span className="text-[13px] sm:text-[15px] font-black text-white truncate max-w-[85px] sm:max-w-[140px] leading-none">{m.away}</span>
                          <div className="flex items-center gap-1 mt-1">
                              {m.away !== 'TBD' && renderRankCondition(awayMaster?.real_rank, awayMaster?.condition)}
                              {m.away !== 'TBD' && renderTierBadge(awayMaster?.tier)}
                          </div>
                      </div>
                  </div>
              </div>

              {!isRecent && m.home !== 'TBD' && m.away !== 'TBD' && (
                  <div className="px-8 sm:px-12 pb-4 flex flex-col gap-1 w-full max-w-[320px] mx-auto opacity-80 pointer-events-none">
                      <div className="flex justify-between text-[8px] font-black px-1">
                          <span className="text-emerald-500">{hRate}%</span>
                          <span className="text-slate-600 tracking-widest uppercase scale-90">WIN PROBABILITY</span>
                          <span className="text-blue-500">{aRate}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full flex overflow-hidden">
                          <div style={{ width: `${hRate}%` }} className="h-full bg-emerald-500" />
                          <div style={{ width: `${aRate}%` }} className="h-full bg-blue-500" />
                      </div>
                  </div>
              )}

              {isRecent && <RecentMatchTalkPreview match={m} owners={owners} onEnter={() => handleMatchTalkClick(m)} />}
          </div>
      );
  };

  // 라이브 피드 개별 아이템 렌더링
  const renderTickerMessage = (msg: any) => {
      const isSticker = msg.text?.startsWith('[STICKER]');
      return (
          <div key={msg.id + Math.random()} onClick={() => handleTickerItemClick(msg)} className="flex items-center shrink-0 mx-1.5 cursor-pointer hover:bg-slate-800/80 px-3 py-1 rounded-xl transition-all group/item">
              <div className="flex items-center gap-1.5 mr-1.5 shrink-0">
                  <img src={getOwnerProfile(msg.uid, msg.name)} className="w-5 h-5 rounded-full object-cover border border-slate-700 bg-slate-800 shrink-0 shadow-sm" alt="" onError={(e:any)=>{e.target.src=FALLBACK_IMG}} />
                  <span className="text-[11px] text-blue-400 font-black whitespace-nowrap shrink-0 group-hover/item:text-blue-300 transition-colors">{msg.name}:</span>
              </div>
              {isSticker ? (
                  <img src={msg.text.replace('[STICKER]', '')} className="h-6 w-auto object-contain drop-shadow-sm ml-0.5" alt="sticker" />
              ) : (
                  <span className="text-slate-300 text-[12px] font-medium whitespace-nowrap shrink-0 group-hover/item:text-white transition-colors">{msg.text}</span>
              )}
          </div>
      );
  };

  return (
      <div className="animate-in fade-in pb-10 mt-2 text-left overflow-x-hidden">
          <style jsx>{`
              .no-scrollbar::-webkit-scrollbar { display: none; }
              .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
              @keyframes ticker-ltr { 0% { transform: translateX(-50%); } 100% { transform: translateX(0); } }
              
              .ticker-track-1 { display: flex; width: max-content; animation: ticker-ltr 45s linear infinite; }
              .ticker-track-1:hover { animation-play-state: paused; }
              
              .ticker-track-2 { display: flex; width: max-content; animation: ticker-ltr 32s linear infinite; animation-delay: -16s; }
              .ticker-track-2:hover { animation-play-state: paused; }
          `}</style>

          {/* 1. 공지사항 */}
          {notices && notices.length > 0 && (
              <div className="bg-[#0f172a] rounded-2xl border border-slate-800 shadow-xl overflow-hidden divide-y divide-slate-800/50 mb-6">
                  {notices.slice(0, 3).map((notice: any) => (
                      <div key={notice.id} onClick={() => handlePostClick(notice)} className="flex items-center p-3 sm:p-4 hover:bg-slate-800/40 transition-colors cursor-pointer group">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                              <span className="bg-slate-800/80 border border-slate-700/80 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded shrink-0 shadow-inner">공지</span>
                              <span className="text-slate-100 font-bold text-[13px] sm:text-[14px] truncate group-hover:text-emerald-400 transition-colors pr-1">{notice.title}</span>
                          </div>
                      </div>
                  ))}
              </div>
          )}

          {/* LIVE FEED */}
          <div className="bg-gradient-to-r from-[#0B1120] to-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col gap-2 relative overflow-hidden shadow-lg mb-6">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 z-20"></div>
              
              <div className="flex items-center gap-2 pl-2 mb-1 z-20">
                  <div className="bg-blue-900/30 p-1.5 rounded-lg shrink-0">
                      <MessageSquare size={14} className="text-blue-400" />
                  </div>
                  <span className="text-xs font-black text-white italic uppercase tracking-widest">LIVE FEED</span>
                  <span className="text-[9px] text-emerald-400 font-bold px-2 py-0.5 bg-emerald-950/30 rounded-full border border-emerald-900/50 animate-pulse ml-2">REAL-TIME</span>
              </div>
              
              <div className="absolute left-0 w-12 h-full bg-gradient-to-r from-[#0B1120] to-transparent z-10 pointer-events-none"></div>
              <div className="absolute right-0 w-12 h-full bg-gradient-to-l from-slate-900 to-transparent z-10 pointer-events-none"></div>

              <div className="flex flex-col gap-1 overflow-hidden relative z-0 py-1">
                  <div className="ticker-track-1">
                      {[...communityComments, ...communityComments].map(renderTickerMessage)}
                  </div>
                  <div className="ticker-track-2">
                      {[...matchComments, ...matchComments].map(renderTickerMessage)}
                  </div>
              </div>
          </div>

          {/* 2. 리그 커뮤니티 */}
          <div className="mb-6">
              <div className="flex items-center justify-between mb-4 px-1">
                  <h3 className="text-sm font-black text-white italic tracking-widest uppercase flex items-center gap-2">
                      <Flame size={16} className="text-orange-500" /> LEAGUE COMMUNITY
                  </h3>
                  <span onClick={() => { 
                      setCategory('전체'); 
                      setViewMode('LIST'); 
                      const params = new URLSearchParams(window.location.search);
                      params.set('view', 'LOCKERROOM'); params.delete('postId');
                      window.history.pushState(null, '', `/?${params.toString()}`);
                      window.scrollTo({ top: 0, behavior: 'smooth' }); 
                  }} className="text-[10px] text-slate-500 font-bold uppercase tracking-wider cursor-pointer hover:text-white transition-colors">더보기 &gt;</span>
              </div>
              
              <div className="bg-[#050b14] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                  <div className="flex border-b border-slate-800 h-[45px] bg-slate-950/50">
                      <button onClick={() => setCommunityTab('HOT')} className={`flex-1 h-full flex justify-center items-center text-[11px] font-black tracking-widest transition-all ${communityTab === 'HOT' ? 'bg-slate-900 text-orange-400 border-b-2 border-orange-400' : 'text-slate-500 hover:text-slate-300'}`}>🔥 HOT</button>
                      <button onClick={() => setCommunityTab('FREE')} className={`flex-1 h-full flex justify-center items-center text-[11px] font-black tracking-widest transition-all ${communityTab === 'FREE' ? 'bg-slate-900 text-white border-b-2 border-white' : 'text-slate-500 hover:text-slate-300'}`}>📝 최신글</button>
                  </div>

                  <div className="p-4">
                      {posts && posts.filter((p:any) => !!p.imageUrl).length > 0 && (
                          <div className="flex overflow-x-auto gap-3 no-scrollbar pb-4 border-b border-slate-800/60 mb-2">
                              {posts.filter((p:any) => !!p.imageUrl).slice(0, 5).map((post:any, i:number) => (
                                  <div key={i} onClick={() => handlePostClick(post)} className="min-w-[130px] w-[130px] shrink-0 flex flex-col gap-2 cursor-pointer group">
                                      <div className="w-full h-[100px] bg-slate-800 rounded-xl overflow-hidden relative border border-slate-700/50 group-hover:border-slate-500 transition-colors">
                                          <img src={post.imageUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="thumbnail" />
                                          <div className="absolute top-1.5 right-1.5 bg-black/60 p-1 rounded text-white"><ImageIcon size={10}/></div>
                                      </div>
                                      <span className="text-[11px] font-bold text-slate-300 truncate leading-tight group-hover:text-white transition-colors pr-1">{post.title}</span>
                                  </div>
                              ))}
                          </div>
                      )}

                      <div className="flex flex-col divide-y divide-slate-800/50">
                          {(communityTab === 'HOT' ? hotPosts : posts.slice(0, 5)).map((post:any, idx:number) => {
                              const ytMatch = post.youtubeUrl?.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?([a-zA-Z0-9_-]{11})/);
                              const ytId = post.youtubeId || (ytMatch ? ytMatch[1] : null);
                              const thumbSrc = post.imageUrl || (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null);
                              const commentCount = post.comments?.length || 0;
                              const displayNum = communityTab === 'HOT' ? idx + 1 : posts.length - idx;

                              return (
                                  <div key={post.id} onClick={() => handlePostClick(post)} className="flex items-center justify-between py-3 hover:bg-slate-800/40 transition-colors cursor-pointer group px-2">
                                      <div className="flex items-center gap-3 min-w-0 flex-1">
                                          <span className="text-slate-500 font-bold italic text-[14px] w-5 text-center shrink-0">{displayNum}</span>
                                          <div className="flex flex-col min-w-0 flex-1 gap-1">
                                              <div className="flex items-center gap-2 min-w-0">
                                                  <span className="bg-slate-800 border border-slate-700/80 text-slate-300 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">{post.cat}</span>
                                                  <span className="text-slate-200 font-medium text-[14px] truncate pr-1">{post.title}</span>
                                              </div>
                                              <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500 ml-[44px]">
                                                  <span>{post.authorName}</span>
                                                  <span className="w-0.5 h-0.5 bg-slate-600 rounded-full"></span>
                                                  <span>조회 {post.views || 0}</span>
                                              </div>
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-3 shrink-0 ml-2">
                                          {thumbSrc && <img src={thumbSrc} className="w-11 h-11 rounded-lg object-cover border border-slate-700 block shrink-0" onError={(e: any) => { e.target.style.display = 'none'; }} />}
                                          <div className={`flex flex-col items-center justify-center rounded-xl w-11 h-11 border shrink-0 transition-colors ${commentCount > 0 ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-400' : 'bg-slate-800/50 border-slate-700 text-slate-500'}`}>
                                              <span className="text-[14px] font-black leading-none">{commentCount}</span>
                                              <span className="text-[9px] font-bold mt-0.5">댓글</span>
                                          </div>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  </div>
              </div>
          </div>

          {/* 4. 경기 정보 (UPCOMING / RECENT) */}
          <div className="mb-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 px-1 gap-3">
                  <h3 className="text-sm font-black text-white italic tracking-widest uppercase flex items-center gap-2 shrink-0">
                      <CalendarDays size={16} className="text-blue-500" /> MATCH CENTER
                  </h3>
                  {seasons && seasons.length > 0 && (
                      <div className="relative w-full sm:w-auto min-w-[200px]">
                          <select
                              value={selectedSeasonId || ''}
                              onChange={(e) => setSelectedSeasonId(Number(e.target.value))}
                              className="w-full appearance-none bg-slate-950 border border-slate-700 text-white text-xs font-bold py-2 pl-3 pr-8 rounded-lg outline-none focus:border-blue-500 shadow-sm cursor-pointer"
                          >
                              {seasons.map((s:any) => {
                                  const pureName = s.name.replace(/^(🏆|🏳️|⚔️|⚽|🗓️|⭐)\s*/, '');
                                  let icon = '🏳️'; if (s.type === 'CUP') icon = '🏆'; if (s.type === 'TOURNAMENT') icon = '⚔️'; if (s.type === 'LEAGUE_PLAYOFF') icon = '⭐';
                                  return <option key={s.id} value={s.id}>{icon} {pureName}</option>;
                              })}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                          </div>
                      </div>
                  )}
              </div>

              {(!seasons || seasons.length === 0) ? (
                  <div className="bg-[#050b14] border border-slate-800 rounded-2xl p-10 flex flex-col items-center justify-center text-center shadow-xl">
                      <CalendarDays size={40} className="text-slate-600 mb-4" />
                      <span className="text-sm font-black text-slate-300 italic">현재 진행 중인 시즌이 없습니다.</span>
                  </div>
              ) : (
                  <div className="bg-[#050b14] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                      <div className="flex border-b border-slate-800 h-[45px] bg-slate-950/50">
                          <button onClick={() => setMatchTab('UPCOMING')} className={`flex-1 h-full flex justify-center items-center gap-1.5 text-[11px] font-black tracking-widest transition-all ${matchTab === 'UPCOMING' ? 'bg-slate-900 text-blue-400 border-b-2 border-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>
                              <CalendarDays size={14}/> UPCOMING
                          </button>
                          <button onClick={() => setMatchTab('RECENT')} className={`flex-1 h-full flex justify-center items-center gap-1.5 text-[11px] font-black tracking-widest transition-all ${matchTab === 'RECENT' ? 'bg-slate-900 text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
                              <Clock size={14}/> RECENT
                          </button>
                      </div>

                      <div className="flex flex-col bg-[#050b14]">
                          {(matchTab === 'UPCOMING' ? upcomingMatchesList : recentMatchesList).length > 0 ? (
                              <div className="flex flex-col divide-y divide-slate-800/80">
                                  {(matchTab === 'UPCOMING' ? upcomingMatchesList : recentMatchesList).map((match: any, idx: number) => (
                                      <React.Fragment key={idx}>
                                          {renderMatchRow(match, matchTab === 'RECENT')}
                                      </React.Fragment>
                                  ))}
                              </div>
                          ) : (
                              <div className="bg-slate-900/30 p-8 flex flex-col items-center justify-center text-center">
                                  <CalendarDays size={32} className="text-slate-600 mb-2 opacity-50" />
                                  <span className="text-xs font-bold text-slate-500">해당하는 매치 기록이 없습니다.</span>
                              </div>
                          )}
                      </div>
                  </div>
              )}
          </div>
      </div>
  );
}