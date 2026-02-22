"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { updateDoc, doc, collection, writeBatch, getDocs, query, where } from 'firebase/firestore';
import { Season, MasterTeam, Owner, Team, League, FALLBACK_IMG, Match, CupEntry } from '../types';
import { getSortedTeamsLogic } from '../utils/helpers';
import { QuickDraftModal } from './QuickDraftModal';
import { TeamCard } from './TeamCard';
import { AdminCupStep2 } from './AdminCupStep2';
import { AdminCupStep3 } from './AdminCupStep3';

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
const LEAGUE_RANKING: { [key: string]: number } = {
  "PREMIER LEAGUE": 1, "LA LIGA": 2, "BUNDESLIGA": 3, "SERIE A": 4, "LIGUE 1": 5,
  "CHAMPIONS LEAGUE": 6, "EUROPA LEAGUE": 7, "EREDIVISIE": 8, "LIGA PORTUGAL": 9,
  "BRASILEIRAO": 10, "ARGENTINE LPF": 11, "MLS": 12, "SAUDI PRO LEAGUE": 13,
  "SUPER LIG": 14, "SCOTTISH PREMIERSHIP": 15, "K LEAGUE": 16, "J LEAGUE": 17,
  "EUROPE": 1, "SOUTH AMERICA": 2, "NORTH AMERICA": 3, "AFRICA": 4, "ASIA-OCEANIA": 5
};

const recordEntryFees = async (seasonId: number | string, seasonName: string, totalPrize: number, ownerIds: string[]) => {
  try {
      if (!ownerIds || ownerIds.length === 0 || !totalPrize) return;

      const ledgerRef = collection(db, 'finance_ledger');

      const q = query(ledgerRef, where("seasonId", "==", String(seasonId)), where("type", "==", "EXPENSE"));
      const existingDocs = await getDocs(q);
      
      if (!existingDocs.empty) {
          console.log("✅ [Finance] 이미 참가비가 징수된 시즌입니다. (2중 차감 스킵)");
          return; 
      }

      const entryFee = Math.floor(totalPrize / ownerIds.length);
      if (entryFee <= 0) return;

      const batch = writeBatch(db);

      ownerIds.forEach(ownerId => {
          const newDocRef = doc(ledgerRef); 
          batch.set(newDocRef, {
              seasonId: String(seasonId),
              ownerId: String(ownerId),
              type: 'EXPENSE',
              amount: entryFee,
              title: `${seasonName} 참가비 🎫`,
              createdAt: new Date().toISOString()
          });
      });

      await batch.commit();
      console.log(`✅ [Finance] ${ownerIds.length}명의 참가비(-${entryFee}원) 장부 기록 완료!`);
  } catch (error) {
      console.error("🚨 [Finance] 참가비 기록 중 에러 발생:", error);
  }
};

interface AdminCupSetupProps {
  targetSeason: Season;
  owners: Owner[];
  leagues: League[];
  masterTeams: MasterTeam[];
  onNavigateToSchedule: (seasonId: number) => void;
}

export const AdminCupSetup = ({ targetSeason, owners, leagues, masterTeams, onNavigateToSchedule }: AdminCupSetupProps) => {
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [randomResult, setRandomResult] = useState<MasterTeam | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [isDraftOpen, setIsDraftOpen] = useState(false);

  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterLeague, setFilterLeague] = useState('');
  const [filterTier, setFilterTier] = useState('ALL');
  const [searchTeam, setSearchTeam] = useState('');

  const [unassignedPool, setUnassignedPool] = useState<CupEntry[]>([]);
  const [groups, setGroups] = useState<{ [key: string]: (CupEntry | null)[] }>({ "A": [null, null, null, null], "B": [null, null, null, null], "C": [null, null, null, null], "D": [null, null, null, null] });
  
  const [configMode, setConfigMode] = useState<'AUTO' | 'CUSTOM'>('AUTO');
  const [customConfig, setCustomConfig] = useState({ groupCount: 4, teamCount: 4 });
  const [targetSlot, setTargetSlot] = useState<{ group: string, idx: number, isTournament?: boolean } | null>(null);
  const [draggedEntry, setDraggedEntry] = useState<CupEntry | null>(null);
  
  const [tournamentBracket, setTournamentBracket] = useState<(CupEntry | null)[]>([]);
  const [draggedTournamentEntry, setDraggedTournamentEntry] = useState<CupEntry | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const isGroupLocked = useMemo(() => targetSeason.rounds && targetSeason.rounds.length > 0, [targetSeason]);
  const isTournamentLocked = useMemo(() => targetSeason.rounds && targetSeason.rounds.length > 1, [targetSeason]);

  useEffect(() => {
    if (isTournamentLocked && targetSeason.rounds) {
      const knockoutRound = targetSeason.rounds.find(r => r.round === 2 || r.name.includes("Knockout"));
      if (knockoutRound && knockoutRound.matches) {
        let matches = [...knockoutRound.matches];
        matches.sort((a, b) => parseInt(a.id.split('_').pop() || '0') - parseInt(b.id.split('_').pop() || '0'));
        const isQuarterFinal = matches.some(m => m.stage.includes('8'));
        const firstStageMatches = matches.filter(m => isQuarterFinal ? m.stage.includes('8') : m.stage.includes('4'));
        const restoredBracket: (CupEntry | null)[] = Array(firstStageMatches.length * 2).fill(null);

        firstStageMatches.forEach((match, idx) => {
          if (match.home !== 'TBD') {
              const master = masterTeams.find(mt => mt.name === match.home);
              restoredBracket[idx*2] = { 
                  id: match.home==='BYE'?`bye_h_${idx}`:`restored_h_${match.id}`, masterId: match.home==='BYE'?-1:0, 
                  name: match.home, logo: match.homeLogo, ownerName: match.homeOwner, 
                  region: master?.region || '', tier: master?.tier || '',
                  realRankScore: 0, realFormScore: 0 
              };
          }
          if (match.away !== 'TBD') {
              const master = masterTeams.find(mt => mt.name === match.away);
              restoredBracket[idx*2+1] = { 
                  id: match.away==='BYE'?`bye_a_${idx}`:`restored_a_${match.id}`, masterId: match.away==='BYE'?-1:0, 
                  name: match.away, logo: match.awayLogo, ownerName: match.awayOwner, 
                  region: master?.region || '', tier: master?.tier || '',
                  realRankScore: 0, realFormScore: 0 
              };
          }
        });
        setTournamentBracket(restoredBracket);
      }
    }
  }, [isTournamentLocked, targetSeason, masterTeams]);

  useEffect(() => {
    if (targetSeason.groups && Object.keys(targetSeason.groups).length > 0) {
      const loadedGroups: any = {};
      const dbGroups = targetSeason.groups as { [key: string]: number[] };
      let maxTeams = 0;
      Object.keys(dbGroups).forEach(g => {
        maxTeams = Math.max(maxTeams, dbGroups[g].length);
        loadedGroups[g] = dbGroups[g].map(tid => {
          const t = targetSeason.teams?.find(team => team.id === tid);
          return t ? { id: `loaded_${tid}`, masterId: tid, name: t.name, logo: t.logo, ownerName: t.ownerName||'CPU', region: t.region, tier: t.tier, realRankScore: t.realRankScore, realFormScore: t.realFormScore } : null;
        }).filter(Boolean);
      });
      const gCount = Math.max(2, Object.keys(loadedGroups).length);
      const tCount = maxTeams < 2 ? 4 : maxTeams;
      const finalG: any = {};
      for(let i=0; i<gCount; i++) {
        const gName = ALPHABET[i];
        finalG[gName] = [...(loadedGroups[gName]||[]), ...Array(Math.max(0, tCount - (loadedGroups[gName]?.length||0))).fill(null)];
      }
      setGroups(finalG); setCustomConfig({ groupCount: gCount, teamCount: tCount }); setConfigMode('CUSTOM');
    }
  }, [targetSeason]);

  const { clubLeagues, nationalLeagues, allSortedLeagues } = useMemo(() => {
    const clubs = leagues.filter(l => l.category === 'CLUB');
    const nationals = leagues.filter(l => l.category === 'NATIONAL');
    const sortFunc = (a: League, b: League) => (LEAGUE_RANKING[a.name.toUpperCase()] || 999) - (LEAGUE_RANKING[b.name.toUpperCase()] || 999);
    return { clubLeagues: clubs.sort(sortFunc), nationalLeagues: nationals.sort(sortFunc), allSortedLeagues: [...clubs, ...nationals] };
  }, [leagues]);

  const availableTeams = useMemo(() => {
    const assigned = new Set([
        ...unassignedPool.map(t=>t.name), 
        ...Object.values(groups).flat().filter((t): t is CupEntry => t !== null).map(t=>t.name)
    ]);
    let teams = masterTeams.filter(t => !assigned.has(t.name));
    if (filterCategory !== 'ALL') teams = teams.filter(t => filterCategory === 'CLUB' ? t.category !== 'NATIONAL' : t.category === 'NATIONAL');
    if (filterLeague) teams = teams.filter(t => t.region === filterLeague);
    if (filterTier !== 'ALL') teams = teams.filter(t => t.tier?.trim() === filterTier);
    if (searchTeam) teams = teams.filter(t => t.name.toLowerCase().includes(searchTeam.toLowerCase()));
    return getSortedTeamsLogic(teams, '');
  }, [masterTeams, unassignedPool, groups, filterCategory, filterLeague, filterTier, searchTeam]);

  // 🔥 [TS 버그 해결 완벽 픽스] undefined 방어용 폴백(|| '') 적용
  const qualifiedTeams = useMemo(() => {
    if (!targetSeason.rounds?.[0]) return [];
    const matches = targetSeason.rounds[0].matches;
    
    type TeamStat = { name: string; points: number; gd: number; gf: number; group: string; logo: string; ownerName: string; };
    const stats: Record<string, TeamStat> = {};
    
    matches.filter(m => m.status === 'COMPLETED').forEach(m => {
      [m.home, m.away].forEach(t => { 
          if(!stats[t]) stats[t] = { 
              name: t, 
              points: 0, 
              gd: 0, 
              gf: 0, 
              group: m.group || '', // 🔥 해결 1: undefined가 들어오지 않도록 빈 문자열 폴백
              logo: (t === m.home ? m.homeLogo : m.awayLogo) || FALLBACK_IMG, 
              ownerName: (t === m.home ? m.homeOwner : m.awayOwner) || 'CPU' 
          }; 
      });
      const h=Number(m.homeScore), a=Number(m.awayScore);
      stats[m.home].gf+=h; stats[m.home].gd+=(h-a); stats[m.home].points+=(h>a?3:h===a?1:0);
      stats[m.away].gf+=a; stats[m.away].gd+=(a-h); stats[m.away].points+=(a>h?3:a===h?1:0);
    });

    const winners: CupEntry[] = [];
    
    // 🔥 해결 2: map 돌릴 때도 undefined 방어
    const groups = Array.from(new Set(matches.map(m => m.group || ''))).sort();

    groups.forEach((g: string) => {
      const gTeams = Object.values(stats).filter(t => t.group === g).sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
      
      if(gTeams[0]) {
        const master = masterTeams.find(mt => mt.name === gTeams[0].name);
        winners.push({
            ...gTeams[0], masterId: 0, id: `q_${g}_1`, 
            tier: master?.tier || 'N/A', region: master?.region || '',
            rank: 1, realRankScore: 80, realFormScore: 80
        } as CupEntry);
      }
      if(gTeams[1]) {
        const master = masterTeams.find(mt => mt.name === gTeams[1].name);
        winners.push({
            ...gTeams[1], masterId: 0, id: `q_${g}_2`, 
            tier: master?.tier || 'N/A', region: master?.region || '',
            rank: 2, realRankScore: 80, realFormScore: 80
        } as CupEntry);
      }
    });
    return winners;
  }, [targetSeason, masterTeams]);

  const tournamentWaitingPool = useMemo(() => {
    if(isTournamentLocked) return [];
    const assigned = new Set(tournamentBracket.filter((t): t is CupEntry => t !== null).map(t=>t.name));
    return qualifiedTeams.filter(t => !assigned.has(t.name));
  }, [qualifiedTeams, tournamentBracket, isTournamentLocked]);

  const handleRandom = () => {
    if (!selectedOwnerId) return alert("오너를 먼저 선택해주세요.");
    if (availableTeams.length === 0) return alert("조건에 맞는 팀이 없습니다.");
    if (isRolling) return;
    setIsRolling(true); setIsFlipping(false); setRandomResult(null);
    const final = availableTeams[Math.floor(Math.random() * availableTeams.length)];
    let count = 0;
    intervalRef.current = setInterval(() => {
      setRandomResult(availableTeams[Math.floor(Math.random() * availableTeams.length)]);
      if(++count > 20) { clearInterval(intervalRef.current!); setTimeout(()=>{ setRandomResult(final); setIsFlipping(true); setIsRolling(false); }, 200); }
    }, 60);
  };

  const handleSignTeam = (master: MasterTeam | null) => {
    const target = master || randomResult;
    if (!target || !selectedOwnerId) return !selectedOwnerId ? alert("오너 선택 필수") : null;
    const owner = owners.find(o => String(o.id) === String(selectedOwnerId));
    const allAssignedTeams = [...unassignedPool, ...Object.values(groups).flat().filter((t): t is CupEntry => t !== null)];
    if(allAssignedTeams.some(p => p.masterId === target.id)) return alert("이미 선발된 팀입니다.");
    setUnassignedPool(prev => [...prev, { id: `entry_${Date.now()}`, masterId: target.id, name: target.name, logo: target.logo, ownerName: owner!.nickname, region: target.region, tier: target.tier, realRankScore: target.realRankScore, realFormScore: target.realFormScore }]);
    setRandomResult(null); setIsFlipping(false);
  };

  const handleDraftApply = (newTeams: Team[]) => {
    const used = new Set([...unassignedPool.map(t => t.masterId), ...Object.values(groups).flat().filter((t): t is CupEntry => t !== null).map(t => t.masterId)]);
    setUnassignedPool(prev => [...prev, ...newTeams.filter(t => !used.has(t.id)).map((t,i) => ({ id:`draft_${Date.now()}_${i}`, masterId:t.id, name:t.name, logo:t.logo, ownerName:t.ownerName||'CPU', region:t.region, tier:t.tier, realRankScore:t.realRankScore, realFormScore:t.realFormScore }))]);
  };

  const handleDragStart = (e: React.DragEvent, entry: CupEntry) => { setDraggedEntry(entry); setDraggedTournamentEntry(entry); e.dataTransfer.effectAllowed = "move"; };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  
  const assignTeamToGroup = (entry: CupEntry, gName: string, idx: number) => {
    if(groups[gName].some(s => s && s.ownerName === entry.ownerName)) return alert(`Group ${gName}에 이미 같은 오너가 있습니다.`);
    setGroups(prev => ({...prev, [gName]: prev[gName].map((s,i) => i===idx?entry:s)}));
    setUnassignedPool(prev => prev.filter(p => p.id !== entry.id));
  };
  const handleDrop = (e: React.DragEvent, gName: string, idx: number) => { e.preventDefault(); if(!groups[gName][idx] && draggedEntry) { assignTeamToGroup(draggedEntry, gName, idx); setDraggedEntry(null); } };
  const handleSlotClick = (gName: string, idx: number) => {
    const entry = groups[gName][idx];
    if(entry) { setUnassignedPool(prev=>[...prev, entry]); setGroups(prev=>({...prev, [gName]: prev[gName].map((s,i)=>i===idx?null:s)})); }
    else { if(unassignedPool.length===0) return alert("대기실에 팀이 없습니다."); setTargetSlot({group:gName, idx, isTournament:false}); }
  };
  const handleAutoDraw = () => {
    if (unassignedPool.length === 0) return alert("대기실에 팀이 없습니다.");
    const tg = JSON.parse(JSON.stringify(groups)); const rem: CupEntry[] = [];
    [...unassignedPool].sort(() => 0.5 - Math.random()).forEach(t => {
      let placed = false;
      for (const k of Object.keys(tg)) { if(tg[k].includes(null) && !tg[k].some((s:any)=>s?.ownerName===t.ownerName)) { tg[k][tg[k].indexOf(null)]=t; placed=true; break; } }
      if (!placed) for (const k of Object.keys(tg)) { if(tg[k].includes(null)) { tg[k][tg[k].indexOf(null)]=t; placed=true; break; } }
      if (!placed) rem.push(t);
    });
    setGroups(tg); setUnassignedPool(rem);
  };

  const handleTournamentDrop = (e: React.DragEvent, idx: number) => { e.preventDefault(); if(draggedTournamentEntry) { const nb=[...tournamentBracket]; nb[idx]=draggedTournamentEntry; setTournamentBracket(nb); setDraggedTournamentEntry(null); } };
  const handleTournamentSlotClick = (idx: number) => {
    if(tournamentBracket[idx]) { const nb=[...tournamentBracket]; nb[idx]=null; setTournamentBracket(nb); }
    else { if(tournamentWaitingPool.length===0) return alert("진출 팀 없음"); setTargetSlot({group:'TOURNAMENT', idx, isTournament:true}); }
  };

  const handleCreateTournamentSchedule = async () => {
    let tb = [...tournamentBracket]; const tSize = tb.length>4?8:4;
    if(tb.length < tSize) tb = [...tb, ...Array(tSize - tb.length).fill(null)];
    if(tb.some(t=>t===null) && !confirm("빈 자리는 BYE(부전승) 처리됩니다.")) return;
    const proc = tb.map((t,i) => t || { id:`bye_${i}`, masterId:-1, name:'BYE', logo:FALLBACK_IMG, ownerName:'SYSTEM', region:'', tier:'', realRankScore:0, realFormScore:0 });
    const matches: any[] = []; const cnt = proc.length/2; const prefix = cnt===4?'ko_4':'ko_final';
    for(let i=0; i<proc.length; i+=2) {
      matches.push({
        id:`ko_${cnt}_${i/2}`, seasonId:targetSeason.id, stage:cnt===4?'ROUND_OF_8':'ROUND_OF_4', matchLabel:`${cnt===4?'8강':'4강'} ${i/2+1}경기`,
        home:proc[i].name, homeLogo:proc[i].logo, homeOwner:proc[i].ownerName, away:proc[i+1].name, awayLogo:proc[i+1].logo, awayOwner:proc[i+1].ownerName,
        homeScore:'', awayScore:'', status:'UPCOMING', homeScorers:[], awayScorers:[], homeAssists:[], awayAssists:[],
        nextMatchId: cnt>1?`${prefix}_${Math.floor(i/4)}`:null, nextMatchSide:(i/2)%2===0?'HOME':'AWAY'
      });
    }
    if(cnt===4) for(let j=0; j<2; j++) matches.push({id:`ko_4_${j}`, seasonId:targetSeason.id, stage:'ROUND_OF_4', matchLabel:`4강 ${j+1}경기`, home:'TBD', away:'TBD', homeLogo:FALLBACK_IMG, awayLogo:FALLBACK_IMG, homeOwner:'TBD', awayOwner:'TBD', homeScore:'', awayScore:'', status:'UPCOMING', homeScorers:[], awayScorers:[], homeAssists:[], awayAssists:[], nextMatchId:`ko_final_0`, nextMatchSide:j===0?'HOME':'AWAY'});
    matches.push({id:`ko_final_0`, seasonId:targetSeason.id, stage:'FINAL', matchLabel:`결승전`, home:'TBD', away:'TBD', homeLogo:FALLBACK_IMG, awayLogo:FALLBACK_IMG, homeOwner:'TBD', awayOwner:'TBD', homeScore:'', awayScore:'', status:'UPCOMING', homeScorers:[], awayScorers:[], homeAssists:[], awayAssists:[], nextMatchId:null});
    const rounds = [...(targetSeason.rounds||[])]; rounds[1] = { round:2, name:"Knockout Stage", seasonId:targetSeason.id, matches };
    await updateDoc(doc(db, "seasons", String(targetSeason.id)), { rounds, cupPhase:'KNOCKOUT' });
    alert("토너먼트 대진 생성 완료!"); onNavigateToSchedule(targetSeason.id);
  };

  const handleCreateSchedule = async () => {
    if(Object.values(groups).flat().some(t=>!t) && !confirm("빈 자리 존재. 진행합니까?")) return;
    const finalTeams: Team[] = [];
    const groupsForDB: { [key: string]: number[] } = {};
    const groupMatches: any[] = [];
    let matchCounter = 0; 

    Object.keys(groups).forEach(gName => {
      groupsForDB[gName] = [];
      const currentGroupTeams: Team[] = []; 

      groups[gName].forEach(entry => {
        if (entry) {
          const newTeam: Team = {
            id: Number(entry.masterId), seasonId: targetSeason.id, name: entry.name, logo: entry.logo, ownerName: entry.ownerName, region: entry.region, tier: entry.tier, win: 0, draw: 0, loss: 0, points: 0, gf: 0, ga: 0, gd: 0, realRankScore: entry.realRankScore || 80, realFormScore: entry.realFormScore || 80
          };
          finalTeams.push(newTeam); groupsForDB[gName].push(newTeam.id); currentGroupTeams.push(newTeam);
        }
      });

      for (let i = 0; i < currentGroupTeams.length; i++) {
        for (let j = i + 1; j < currentGroupTeams.length; j++) {
          const home = currentGroupTeams[i]; const away = currentGroupTeams[j];
          groupMatches.push({
            id: `match_${targetSeason.id}_${gName}_${matchCounter++}`, seasonId: targetSeason.id, stage: `GROUP STAGE`, matchLabel: `Group ${gName} Match`, group: gName, home: home.name, homeLogo: home.logo, homeOwner: home.ownerName, away: away.name, awayLogo: away.logo, awayOwner: away.ownerName, homeScore: '', awayScore: '', status: 'UPCOMING', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: []
          });
        }
      }
    });

    await updateDoc(doc(db, "seasons", String(targetSeason.id)), { teams: finalTeams, rounds: [{round:1, name:'Group Stage', seasonId:targetSeason.id, matches:groupMatches.sort(()=>0.5-Math.random())}], groups: groupsForDB, cupPhase: 'GROUP_STAGE', status: 'ACTIVE' });

    if (!isGroupLocked && (targetSeason as any).totalPrize) {
      const uniqueOwnerNames = Array.from(new Set(finalTeams.map(t => t.ownerName)));
      const uniqueOwnerIds = uniqueOwnerNames.map(name => {
          const owner = owners.find(o => o.nickname === name);
          return owner ? String(owner.id) : '';
      }).filter(id => id !== '');
      recordEntryFees(targetSeason.id, targetSeason.name, (targetSeason as any).totalPrize, uniqueOwnerIds);
    }
    alert("조별리그 시작!"); onNavigateToSchedule(targetSeason.id);
  };

  return (
    <div className="space-y-8 animate-in fade-in relative pb-20">
      <style jsx>{`
        .stage-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.92); z-index: 50; backdrop-filter: blur(8px); }
        .blast-circle { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.5); width: 100px; height: 100px; border-radius: 50%; border: 4px solid #fbbf24; box-shadow: 0 0 50px #fbbf24; z-index: 52; pointer-events: none; animation: blastOut 0.8s ease-out forwards; }
        @keyframes blastOut { 0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; border-width: 10px; } 100% { transform: translate(-50%, -50%) scale(4); opacity: 0; border-width: 0px; } }
        .fc-card-reveal { animation: card-flip 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; z-index: 55; }
        @keyframes card-flip { 0% { transform: rotateY(90deg) scale(0.8); filter: brightness(3); } 100% { transform: rotateY(0deg) scale(1.1); filter: brightness(1); } }
      `}</style>

      {(isRolling || isFlipping) && <div className="stage-overlay" />}
      {isFlipping && <div className="reveal-flash" />}

      <div className={`bg-slate-900 p-5 rounded-3xl border border-slate-800 relative ${isRolling || isFlipping ? 'z-[55]' : ''}`}>
        <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
          <h3 className="text-white font-black italic uppercase tracking-tighter">Step 1. Team & Owner Matching</h3>
          <div className="text-xs text-slate-400"> WaitingPool: <span className="text-emerald-400 font-bold text-lg">{unassignedPool.length}</span> Teams</div>
        </div>

        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-3 rounded-xl border border-slate-700 flex flex-col md:flex-row items-center justify-between gap-3 mb-4">
          <div className="text-center md:text-left"><p className="text-sm font-bold text-white">⚡ 빠른 팀 배정이 필요하신가요?</p><p className="text-xs text-slate-400">오너별로 팀을 일괄 배정하거나 드래프트를 진행합니다.</p></div>
          <button onClick={() => setIsDraftOpen(true)} disabled={isRolling} className="h-10 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-black italic rounded-lg shadow-lg text-xs transition-all">⚡ Quick Draft</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-[10px] text-slate-500 font-bold mb-1 block">SELECT OWNER</label>
            <select value={selectedOwnerId} onChange={e => setSelectedOwnerId(e.target.value)} disabled={isRolling} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-700 text-white font-bold text-sm">
              <option value="">👤 Select Owner</option>
              {owners.map(o => <option key={o.id} value={o.id}>{o.nickname}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-bold mb-1 block">RANDOM MATCH</label>
            <button onClick={handleRandom} disabled={isRolling || !selectedOwnerId} className={`w-full h-[46px] rounded-xl font-black italic text-white shadow-lg flex items-center justify-center gap-2 transition-all ${isRolling ? 'bg-slate-800 cursor-wait' : !selectedOwnerId ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500'}`}>
              {isRolling ? '🎰 ROLLING...' : '🎲 RANDOM DRAW'}
            </button>
          </div>
        </div>

        {randomResult && (
          <div className="flex justify-center py-6 relative perspective-1000">
            <div className={`relative p-6 rounded-[2rem] border-4 flex flex-col items-center gap-4 bg-slate-900 ${isFlipping ? 'fc-card-reveal' : ''} ${randomResult.tier==='S'?'border-yellow-500 shadow-yellow-500/50':'border-emerald-500'}`}>
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center p-2 shadow-inner"><img src={randomResult.logo} className="w-full h-full object-contain" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} /></div>
              <div className="text-center"><h2 className="text-xl font-black italic text-white uppercase">{randomResult.name}</h2><p className="text-xs text-slate-400">{randomResult.tier} Tier • {randomResult.region}</p></div>
              <button onClick={() => handleSignTeam(null)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl shadow-lg">SIGN ✅</button>
            </div>
          </div>
        )}

        {!randomResult && (
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="flex flex-wrap gap-2 mb-3">
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="bg-black text-white text-xs p-2 rounded border border-slate-700"><option value="ALL">All Categories</option><option value="CLUB">Club</option><option value="NATIONAL">National</option></select>
              <select value={filterLeague} onChange={e => setFilterLeague(e.target.value)} className="bg-black text-white text-xs p-2 rounded border border-slate-700"><option value="">All Leagues</option>{allSortedLeagues.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}</select>
              <input value={searchTeam} onChange={e => setSearchTeam(e.target.value)} placeholder="Search Team..." className="bg-black text-white text-xs p-2 rounded border border-slate-700 flex-1" />
            </div>
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-1">
              {!filterLeague && !searchTeam ? (
                <div className="space-y-4">
                  {(filterCategory === 'ALL' || filterCategory === 'CLUB') && (
                    <div>
                      <div className="flex items-center gap-2 mb-2"><div className="w-1 h-3 bg-emerald-500 rounded-full"></div><h4 className="text-emerald-500 font-black text-[10px] uppercase">Club Leagues</h4></div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                        {clubLeagues.map(l => (
                          <div key={l.id} onClick={() => setFilterLeague(l.name)} className="bg-slate-900 p-2 rounded-xl border border-slate-800 cursor-pointer hover:border-emerald-500 flex flex-col items-center gap-2 group transition-all">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center p-2"><img src={l.logo} className="w-full h-full object-contain" alt="" /></div>
                            <span className="text-[9px] text-slate-400 group-hover:text-white font-bold text-center truncate w-full">{l.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {(filterCategory === 'ALL' || filterCategory === 'NATIONAL') && (
                    <div>
                      <div className="flex items-center gap-2 mb-2"><div className="w-1 h-3 bg-blue-500 rounded-full"></div><h4 className="text-blue-500 font-black text-[10px] uppercase">National Teams</h4></div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                        {nationalLeagues.map(l => (
                          <div key={l.id} onClick={() => setFilterLeague(l.name)} className="bg-slate-900 p-2 rounded-xl border border-slate-800 cursor-pointer hover:border-blue-500 flex flex-col items-center gap-2 group transition-all">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center p-2"><img src={l.logo} className="w-full h-full object-contain" alt="" /></div>
                            <span className="text-[9px] text-slate-400 group-hover:text-white font-bold text-center truncate w-full">{l.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                  {availableTeams.map(t => (
                    <TeamCard key={t.id} team={t} onClick={() => handleSignTeam(t)} className="cursor-pointer" size="mini" />
                  ))}
                  {availableTeams.length === 0 && <div className="col-span-full text-center text-slate-500 py-10">No teams found</div>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <AdminCupStep2
        unassignedPool={unassignedPool} groups={groups} customConfig={customConfig} configMode={configMode} isLocked={isGroupLocked}
        onDragStart={handleDragStart} onDrop={handleDrop} onDragOver={handleDragOver} onSlotClick={handleSlotClick}
        onUpdateStructure={(m,g,t) => { if(confirm("초기화?")){ setUnassignedPool(prev=>[...prev, ...Object.values(groups).flat().filter((t): t is CupEntry => t !== null) as CupEntry[]]); const ng:any={}; for(let i=0;i<g;i++) ng[ALPHABET[i]]=Array(t).fill(null); setGroups(ng); setCustomConfig({groupCount:g, teamCount:t}); setConfigMode(m); }}}
        onAutoDraw={handleAutoDraw}
        onResetDraw={() => { if(confirm("리셋?")){ setUnassignedPool(prev=>[...prev, ...Object.values(groups).flat().filter((t): t is CupEntry => t !== null) as CupEntry[]]); const ng:any={}; Object.keys(groups).forEach(k=>ng[k]=Array(groups[k].length).fill(null)); setGroups(ng); }}}
        onCreateSchedule={handleCreateSchedule}
      />

      <AdminCupStep3
        waitingPool={tournamentWaitingPool} bracket={tournamentBracket} isLocked={isTournamentLocked}
        onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleTournamentDrop} onSlotClick={handleTournamentSlotClick}
        onAutoMatch={() => { const nb=Array(tournamentBracket.length).fill(null); const f=(g:string,r:number)=>qualifiedTeams.find(t=>t.group===g&&t.rank===r); if(qualifiedTeams.length===8){ nb[0]=f('A',1)||null; nb[1]=f('B',2)||null; nb[2]=f('C',1)||null; nb[3]=f('D',2)||null; nb[4]=f('B',1)||null; nb[5]=f('A',2)||null; nb[6]=f('D',1)||null; nb[7]=f('C',2)||null; } else if(qualifiedTeams.length===4){ nb[0]=f('A',1)||null; nb[1]=f('B',2)||null; nb[2]=f('B',1)||null; nb[3]=f('A',2)||null; } setTournamentBracket(nb); }}
        onRandomMatch={() => { const sh=[...qualifiedTeams].sort(()=>Math.random()-0.5); setTournamentBracket(Array(tournamentBracket.length).fill(null).map((_,i)=>sh[i]||null)); }}
        onCreateSchedule={handleCreateTournamentSchedule}
      />

      {targetSlot && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setTargetSlot(null)}>
          <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-800"><h3 className="text-white font-bold">Select Team</h3></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {(targetSlot.isTournament ? tournamentWaitingPool : unassignedPool).map(e => (
                <div key={e.id} onClick={() => { if(targetSlot.isTournament){ const nb=[...tournamentBracket]; nb[targetSlot.idx]=e; setTournamentBracket(nb); } else { assignTeamToGroup(e, targetSlot.group, targetSlot.idx); } setTargetSlot(null); }} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700 cursor-pointer hover:border-emerald-500">
                  <img src={e.logo} className="w-8 h-8 object-contain bg-white rounded-full p-1" alt="" />
                  <div><div className="text-sm font-bold text-white">{e.name}</div><div className="text-xs text-slate-400">{e.ownerName}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <QuickDraftModal isOpen={isDraftOpen} onClose={() => setIsDraftOpen(false)} owners={owners} masterTeams={masterTeams} onConfirm={handleDraftApply} />
    </div>
  );
};