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
      
      if (!existingDocs.empty) { return; }

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
  } catch (error) { console.error(error); }
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

  const [isGroupsLoaded, setIsGroupsLoaded] = useState(false);

  const qualifiedTeams = useMemo(() => {
    if (!targetSeason.rounds?.[0]) return [];
    const matches = targetSeason.rounds[0].matches;
    type TeamStat = { name: string; points: number; gd: number; gf: number; group: string; logo: string; ownerName: string; ownerUid?: string; };
    const stats: Record<string, TeamStat> = {};
    
    matches.filter(m => m.status === 'COMPLETED').forEach(m => {
      [m.home, m.away].forEach(t => { 
          if(!stats[t]) stats[t] = { name: t, points: 0, gd: 0, gf: 0, group: m.group || '', logo: (t === m.home ? m.homeLogo : m.awayLogo) || FALLBACK_IMG, ownerName: (t === m.home ? m.homeOwner : m.awayOwner) || 'CPU', ownerUid: (t === m.home ? (m as any).homeOwnerUid : (m as any).awayOwnerUid) || '' }; 
      });
      const h=Number(m.homeScore), a=Number(m.awayScore);
      stats[m.home].gf+=h; stats[m.home].gd+=(h-a); stats[m.home].points+=(h>a?3:h===a?1:0);
      stats[m.away].gf+=a; stats[m.away].gd+=(a-h); stats[m.away].points+=(a>h?3:a===h?1:0);
    });

    const winners: CupEntry[] = [];
    const groupsList = Array.from(new Set(matches.map(m => m.group || ''))).sort();
    groupsList.forEach((g: string) => {
      const gTeams = Object.values(stats).filter(t => t.group === g).sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
      [0, 1].forEach(rankIdx => {
        if(gTeams[rankIdx]) {
            const master = masterTeams.find(mt => mt.name === gTeams[rankIdx].name);
            winners.push({ ...gTeams[rankIdx], masterId: 0, id: `q_${g}_${rankIdx+1}`, tier: master?.tier || 'N/A', region: master?.region || '', rank: rankIdx+1, realRankScore: 80, realFormScore: 80 } as CupEntry);
        }
      });
    });
    return winners;
  }, [targetSeason, masterTeams]);

  useEffect(() => {
    if (!isTournamentLocked && qualifiedTeams.length > 0 && tournamentBracket.length !== qualifiedTeams.length) {
        setTournamentBracket(Array(qualifiedTeams.length).fill(null));
    }
  }, [isTournamentLocked, qualifiedTeams.length, tournamentBracket.length]);

  const handleHardReset = async () => {
    if (!confirm("⚠️ 위험: 시즌의 조 편성, 팀 정보, 스케줄이 모두 DB에서 삭제됩니다.\n초기화하시겠습니까?")) return;
    try {
      await updateDoc(doc(db, "seasons", String(targetSeason.id)), { teams: [], rounds: [], groups: {}, cupPhase: 'NONE', status: 'UPCOMING' });
      alert("✅ 조별리그 초기화 완료!");
      window.location.reload(); 
    } catch (err) { alert("초기화 실패"); }
  };

  const handleTournamentReset = async () => {
    if (!confirm("생성된 대진표를 비우고 팀들을 다시 대기실로 돌려보내시겠습니까?")) return;
    try {
      const newRounds = targetSeason.rounds ? [targetSeason.rounds[0]] : []; 
      await updateDoc(doc(db, "seasons", String(targetSeason.id)), { rounds: newRounds, cupPhase: 'GROUP_STAGE' });
      setTournamentBracket(Array(qualifiedTeams.length).fill(null));
      alert("✅ 대기실로 복귀 완료! 대진을 다시 짜주세요.");
    } catch (err) { alert("초기화 실패"); }
  };

  const handleResetDraftBracket = () => {
      if(confirm("현재 배치 중인 대진표를 비우고 대기실로 돌려보내시겠습니까?")) {
          setTournamentBracket(Array(qualifiedTeams.length).fill(null));
      }
  };

  const handleSaveEditOverride = async (matchIdsToUpdate: string[], updatedBracket: CupEntry[]) => {
      try {
          const rounds = [...targetSeason.rounds!];
          const koIndex = rounds.findIndex(r => r.round === 2 || r.name.includes("Knockout"));
          const matches = [...rounds[koIndex].matches!];

          let bIdx = 0;
          matches.forEach(m => {
              if (matchIdsToUpdate.includes(m.id)) {
                  const homeEntry = updatedBracket[bIdx++];
                  const awayEntry = updatedBracket[bIdx++];
                  if(homeEntry) { m.home = homeEntry.name; m.homeLogo = homeEntry.logo; m.homeOwner = homeEntry.ownerName; m.homeOwnerUid = homeEntry.ownerUid || ''; }
                  if(awayEntry) { m.away = awayEntry.name; m.awayLogo = awayEntry.logo; m.awayOwner = awayEntry.ownerName; m.awayOwnerUid = awayEntry.ownerUid || ''; }
              }
          });
          
          rounds[koIndex].matches = matches;
          await updateDoc(doc(db, "seasons", String(targetSeason.id)), { rounds });
          alert("✅ 내전 방지! 선택하신 대진으로 강제 재배치가 완료되었습니다.");
      } catch (error) {
          console.error(error);
          alert("재배치 저장 중 오류가 발생했습니다.");
      }
  };

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
              restoredBracket[idx*2] = { id: match.home==='BYE'?`bye_h_${idx}`:`restored_h_${match.id}`, masterId: match.home==='BYE'?-1:0, name: match.home, logo: match.homeLogo, ownerName: match.homeOwner, ownerUid: (match as any).homeOwnerUid, region: master?.region || '', tier: master?.tier || '', realRankScore: 0, realFormScore: 0 };
          }
          if (match.away !== 'TBD') {
              const master = masterTeams.find(mt => mt.name === match.away);
              restoredBracket[idx*2+1] = { id: match.away==='BYE'?`bye_a_${idx}`:`restored_a_${match.id}`, masterId: match.away==='BYE'?-1:0, name: match.away, logo: match.awayLogo, ownerName: match.awayOwner, ownerUid: (match as any).awayOwnerUid, region: master?.region || '', tier: master?.tier || '', realRankScore: 0, realFormScore: 0 };
          }
        });
        setTournamentBracket(restoredBracket);
      }
    }
  }, [isTournamentLocked, targetSeason, masterTeams]);

  useEffect(() => {
    if (!isGroupsLoaded && targetSeason.groups && Object.keys(targetSeason.groups).length > 0) {
      const loadedGroups: any = {};
      const dbGroups = targetSeason.groups as { [key: string]: any[] };
      let maxTeams = 0;
      Object.keys(dbGroups).forEach(g => {
        maxTeams = Math.max(maxTeams, dbGroups[g].length);
        loadedGroups[g] = dbGroups[g].map(tid => {
          const t = targetSeason.teams?.find(team => String(team.id) === String(tid));
          return t ? { id: `loaded_${tid}`, masterId: tid, name: t.name, logo: t.logo, ownerName: t.ownerName||'CPU', ownerUid: (t as any).ownerUid || '', region: t.region, tier: t.tier, realRankScore: t.realRankScore, realFormScore: t.realFormScore } : null;
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
      setIsGroupsLoaded(true);
    }
  }, [targetSeason, isGroupsLoaded]);

  const { clubLeagues, nationalLeagues, allSortedLeagues } = useMemo(() => {
    const clubs = leagues.filter(l => l.category === 'CLUB');
    const nationals = leagues.filter(l => l.category === 'NATIONAL');
    const sortFunc = (a: League, b: League) => (LEAGUE_RANKING[a.name.toUpperCase()] || 999) - (LEAGUE_RANKING[b.name.toUpperCase()] || 999);
    return { clubLeagues: clubs.sort(sortFunc), nationalLeagues: nationals.sort(sortFunc), allSortedLeagues: [...clubs, ...nationals] };
  }, [leagues]);

  const availableTeams = useMemo(() => {
    const assigned = new Set([...unassignedPool.map(t=>t.name), ...Object.values(groups).flat().filter((t): t is CupEntry => t !== null).map(t=>t.name)]);
    let teams = masterTeams.filter(t => !assigned.has(t.name));
    if (filterCategory !== 'ALL') teams = teams.filter(t => filterCategory === 'CLUB' ? t.category !== 'NATIONAL' : t.category === 'NATIONAL');
    if (filterLeague) teams = teams.filter(t => t.region === filterLeague);
    if (filterTier !== 'ALL') teams = teams.filter(t => t.tier?.trim() === filterTier);
    if (searchTeam) teams = teams.filter(t => t.name.toLowerCase().includes(searchTeam.toLowerCase()));
    return getSortedTeamsLogic(teams, '');
  }, [masterTeams, unassignedPool, groups, filterCategory, filterLeague, filterTier, searchTeam]);

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
    const owner = owners.find(o => String(o.id) === String(selectedOwnerId) || o.uid === selectedOwnerId);
    const allAssignedTeams = [...unassignedPool, ...Object.values(groups).flat().filter((t): t is CupEntry => t !== null)];
    if(allAssignedTeams.some(p => p.masterId === target.id)) return alert("이미 선발된 팀입니다.");
    setUnassignedPool(prev => [...prev, { id: `entry_${Date.now()}`, masterId: target.id, name: target.name, logo: target.logo, ownerName: owner!.nickname, ownerUid: owner!.uid || owner!.docId || '', region: target.region, tier: target.tier, realRankScore: target.realRankScore, realFormScore: target.realFormScore }]);
    setRandomResult(null); setIsFlipping(false);
  };

  const handleDraftApply = (newTeams: Team[]) => {
    const used = new Set([...unassignedPool.map(t => t.masterId), ...Object.values(groups).flat().filter((t): t is CupEntry => t !== null).map(t => t.masterId)]);
    setUnassignedPool(prev => [...prev, ...newTeams.filter(t => !used.has(t.id)).map((t,i) => ({ id:`draft_${Date.now()}_${i}`, masterId:t.id, name:t.name, logo:t.logo, ownerName:t.ownerName||'CPU', ownerUid: (t as any).ownerUid || '', region:t.region, tier:t.tier, realRankScore:t.realRankScore, realFormScore:t.realFormScore }))]);
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

  // 🔥 [가장 핵심 수술 포인트] ID 중복 발급을 원천 차단하는 완벽한 사다리 생성기
  const handleCreateTournamentSchedule = async () => {
    try {
      let tb = [...tournamentBracket]; 
      const tSize = tb.length > 4 ? 8 : 4;
      if(tb.length < tSize) tb = [...tb, ...Array(tSize - tb.length).fill(null)];
      if(tb.some(t=>t===null) && !confirm("빈 자리는 BYE(부전승) 처리됩니다.")) return;
      
      const proc = tb.map((t,i) => t || { id:`bye_${i}`, masterId:-1, name:'BYE', logo:FALLBACK_IMG, ownerName:'SYSTEM', ownerUid:'', region:'', tier:'', realRankScore:0, realFormScore:0 });
      const matches: any[] = []; 
      
      if (tSize === 8) {
          // 8강 생성 (ko_8_x 고유 ID 발급)
          for(let i=0; i<8; i+=2) {
              matches.push({ 
                  id:`ko_8_${i/2}`, seasonId:targetSeason.id, stage:'ROUND_OF_8', matchLabel:`8강 ${i/2+1}경기`, 
                  home:proc[i].name, homeLogo:proc[i].logo, homeOwner:proc[i].ownerName, homeOwnerUid: proc[i].ownerUid || '', 
                  away:proc[i+1].name, awayLogo:proc[i+1].logo, awayOwner:proc[i+1].ownerName, awayOwnerUid: proc[i+1].ownerUid || '', 
                  homeScore:'', awayScore:'', status:'UPCOMING', homeScorers:[], awayScorers:[], homeAssists:[], awayAssists:[], 
                  nextMatchId: `ko_4_${Math.floor(i/4)}`, nextMatchSide:(i/2)%2===0?'HOME':'AWAY' 
              });
          }
          // 4강 TBD 생성 (ko_4_x 고유 ID 발급)
          for(let j=0; j<2; j++) { 
              matches.push({
                  id:`ko_4_${j}`, seasonId:targetSeason.id, stage:'ROUND_OF_4', matchLabel:`4강 ${j+1}경기`, 
                  home:'TBD', away:'TBD', homeLogo:FALLBACK_IMG, awayLogo:FALLBACK_IMG, homeOwner:'TBD', homeOwnerUid:'', awayOwner:'TBD', awayOwnerUid:'', 
                  homeScore:'', awayScore:'', status:'UPCOMING', homeScorers:[], awayScorers:[], homeAssists:[], awayAssists:[], 
                  nextMatchId:`ko_final_0`, nextMatchSide:j===0?'HOME':'AWAY'
              }); 
          }
      } else {
          // 4팀 세팅일 경우 4강 바로 생성 (ko_4_x 고유 ID 발급)
          for(let i=0; i<4; i+=2) {
              matches.push({ 
                  id:`ko_4_${i/2}`, seasonId:targetSeason.id, stage:'ROUND_OF_4', matchLabel:`4강 ${i/2+1}경기`, 
                  home:proc[i].name, homeLogo:proc[i].logo, homeOwner:proc[i].ownerName, homeOwnerUid: proc[i].ownerUid || '', 
                  away:proc[i+1].name, awayLogo:proc[i+1].logo, awayOwner:proc[i+1].ownerName, awayOwnerUid: proc[i+1].ownerUid || '', 
                  homeScore:'', awayScore:'', status:'UPCOMING', homeScorers:[], awayScorers:[], homeAssists:[], awayAssists:[], 
                  nextMatchId: `ko_final_0`, nextMatchSide:(i/2)%2===0?'HOME':'AWAY' 
              });
          }
      }
      
      // 3·4위전 및 결승전
      matches.push({id:`ko_3rd_0`, seasonId:targetSeason.id, stage:'3RD_PLACE', matchLabel:`3·4위전`, home:'TBD', homeOwnerUid:'', away:'TBD', awayOwnerUid:'', homeLogo:FALLBACK_IMG, awayLogo:FALLBACK_IMG, homeOwner:'TBD', awayOwner:'TBD', homeScore:'', awayScore:'', status:'UPCOMING', homeScorers:[], awayScorers:[], homeAssists:[], awayAssists:[], nextMatchId:null});
      matches.push({id:`ko_final_0`, seasonId:targetSeason.id, stage:'FINAL', matchLabel:`결승전`, home:'TBD', homeOwnerUid:'', away:'TBD', awayOwnerUid:'', homeLogo:FALLBACK_IMG, awayLogo:FALLBACK_IMG, homeOwner:'TBD', awayOwner:'TBD', homeScore:'', awayScore:'', status:'UPCOMING', homeScorers:[], awayScorers:[], homeAssists:[], awayAssists:[], nextMatchId:null});
      
      const rounds = [...(targetSeason.rounds||[])]; rounds[1] = { round:2, name:"Knockout Stage", seasonId:targetSeason.id, matches };
      await updateDoc(doc(db, "seasons", String(targetSeason.id)), { rounds, cupPhase:'KNOCKOUT' });
      alert("✅ 토너먼트 대진 생성 완료!"); 
      onNavigateToSchedule(targetSeason.id);
    } catch (error) {
      console.error("Tournament Schedule Error:", error);
      alert(`❌ 토너먼트 스케줄 생성 중 오류가 발생했습니다: ${error}`);
    }
  };

  const handleCreateSchedule = async () => {
    try {
      const totalAssignedTeams = Object.values(groups).flat().filter(Boolean).length;
      if (totalAssignedTeams === 0) return alert("❌ 조별리그에 배정된 팀이 단 한 팀도 없습니다! 먼저 팀을 꽉 채워주세요.");
      if(Object.values(groups).flat().some(t=>!t) && !confirm("빈 자리가 있습니다. 부전승(BYE) 처리하고 이대로 스케줄을 생성하시겠습니까?")) return;
      
      const finalTeams: Team[] = [];
      const groupsForDB: { [key: string]: string[] } = {}; 
      const groupMatches: any[] = [];
      let matchCounter = 0; 

      Object.keys(groups).forEach(gName => {
        groupsForDB[gName] = [];
        const currentGroupTeams: Team[] = []; 
        groups[gName].forEach(entry => {
          if (entry) {
            const safeId = String(entry.masterId || entry.id || `custom_${Date.now()}`);
            const newTeam: Team = { id: safeId as any, seasonId: targetSeason.id, name: entry.name || 'Unknown', logo: entry.logo || FALLBACK_IMG, ownerName: entry.ownerName || 'SYSTEM', ownerUid: entry.ownerUid || '', region: entry.region || '', tier: entry.tier || 'C', win: 0, draw: 0, loss: 0, points: 0, gf: 0, ga: 0, gd: 0, realRankScore: entry.realRankScore || 80, realFormScore: entry.realFormScore || 80 };
            finalTeams.push(newTeam); groupsForDB[gName].push(safeId); currentGroupTeams.push(newTeam);
          }
        });
        for (let i = 0; i < currentGroupTeams.length; i++) {
          for (let j = i + 1; j < currentGroupTeams.length; j++) {
            const home = currentGroupTeams[i]; const away = currentGroupTeams[j];
            groupMatches.push({ id: `match_${targetSeason.id}_${gName}_${matchCounter++}`, seasonId: targetSeason.id, stage: `GROUP STAGE`, matchLabel: `Group ${gName} Match`, group: gName, home: home.name, homeLogo: home.logo, homeOwner: home.ownerName, homeOwnerUid: (home as any).ownerUid || '', away: away.name, awayLogo: away.logo, awayOwner: away.ownerName, awayOwnerUid: (away as any).ownerUid || '', homeScore: '', awayScore: '', status: 'UPCOMING', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [] });
          }
        }
      });

      await updateDoc(doc(db, "seasons", String(targetSeason.id)), { teams: finalTeams, rounds: [{round:1, name:'Group Stage', seasonId:targetSeason.id, matches:groupMatches.sort(()=>0.5-Math.random())}], groups: groupsForDB, cupPhase: 'GROUP_STAGE', status: 'ACTIVE' });
      if (!isGroupLocked && (targetSeason as any).totalPrize) {
        const uniqueOwnerUids = Array.from(new Set(finalTeams.map(t => (t as any).ownerUid))).filter(u => u);
        recordEntryFees(targetSeason.id, targetSeason.name, (targetSeason as any).totalPrize, uniqueOwnerUids as string[]);
      }
      alert("✅ 조별리그 스케줄 생성 성공!"); 
      onNavigateToSchedule(targetSeason.id);
    } catch (error) {
      console.error("Create Schedule Error:", error);
      alert(`❌ DB 저장 중 심각한 오류 발생 (관리자에게 문의): ${error}`);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in relative pb-20">
      {(isRolling || isFlipping) && <div className="fixed inset-0 bg-black/90 z-50 backdrop-blur-sm" />}

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
              {owners.map(o => <option key={o.id} value={o.uid || o.docId || String(o.id)}>{o.nickname}</option>)}
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
          <div className="flex justify-center py-6">
            <div className={`p-6 rounded-[2rem] border-4 flex flex-col items-center gap-4 bg-slate-900 ${randomResult.tier==='S'?'border-yellow-500 shadow-yellow-500/50':'border-emerald-500'}`}>
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center p-2"><img src={randomResult.logo} className="w-full h-full object-contain" alt="" /></div>
              <div className="text-center"><h2 className="text-xl font-black italic text-white uppercase">{randomResult.name}</h2></div>
              <button onClick={() => handleSignTeam(null)} className="w-full bg-emerald-600 text-white font-bold py-2 rounded-xl">SIGN ✅</button>
            </div>
          </div>
        )}

        {!randomResult && (
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="flex flex-wrap gap-2 mb-3">
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="bg-black text-white text-xs p-2 rounded border border-slate-700"><option value="ALL">All Categories</option><option value="CLUB">Club</option></select>
              <input value={searchTeam} onChange={e => setSearchTeam(e.target.value)} placeholder="Search Team..." className="bg-black text-white text-xs p-2 rounded border border-slate-700 flex-1" />
            </div>
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-1">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                  {availableTeams.map(t => (
                    <TeamCard key={t.id} team={t} onClick={() => handleSignTeam(t)} className="cursor-pointer" size="mini" />
                  ))}
                </div>
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
        onResetAll={handleHardReset}
      />

      <AdminCupStep3
        waitingPool={tournamentWaitingPool} bracket={tournamentBracket} isLocked={isTournamentLocked}
        targetSeason={targetSeason} masterTeams={masterTeams}
        onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleTournamentDrop} onSlotClick={handleTournamentSlotClick}
        onAutoMatch={() => { 
            const nb=Array(qualifiedTeams.length).fill(null); 
            const f=(g:string,r:number)=>qualifiedTeams.find(t=>t.group===g&&t.rank===r); 
            if(qualifiedTeams.length===8){ nb[0]=f('A',1)||null; nb[1]=f('B',2)||null; nb[2]=f('C',1)||null; nb[3]=f('D',2)||null; nb[4]=f('B',1)||null; nb[5]=f('A',2)||null; nb[6]=f('D',1)||null; nb[7]=f('C',2)||null; } 
            else if(qualifiedTeams.length===4){ nb[0]=f('A',1)||null; nb[1]=f('B',2)||null; nb[2]=f('B',1)||null; nb[3]=f('A',2)||null; } 
            setTournamentBracket(nb); 
        }}
        onRandomMatch={() => { 
            const sh=[...qualifiedTeams].sort(()=>Math.random()-0.5); 
            setTournamentBracket(Array(qualifiedTeams.length).fill(null).map((_,i)=>sh[i]||null)); 
        }}
        onCreateSchedule={handleCreateTournamentSchedule}
        onResetTournament={handleTournamentReset}
        onResetBracket={handleResetDraftBracket}
        onSaveEditOverride={handleSaveEditOverride} 
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
    </div>
  );
};

export default AdminCupSetup;