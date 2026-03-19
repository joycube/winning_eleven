import { useMemo } from 'react';
import { Season, Team, Owner, Prizes, FALLBACK_IMG } from '../types';

export const useLeagueStats = (seasons: Season[], viewSeasonId: number, owners: Owner[] = [], historyRecords: any[] = []) => {
    
    // 유틸리티: 팀명 표준화 (매칭 정확도 100% 보장)
    const norm = (s: any) => s ? String(s).trim().toLowerCase().replace(/\s+/g, '') : "";

    const getCanonicalOwnerName = (rawIdOrName: string) => {
        if (!rawIdOrName) return 'Unknown';
        const searchInput = rawIdOrName.toString().trim();

        const ownerByUid = owners.find(o => 
            String(o.docId) === searchInput || 
            String(o.id) === searchInput ||
            String((o as any).uid) === searchInput 
        );
        if (ownerByUid) return ownerByUid.nickname;

        const normalizedSearch = searchInput.replace(/\s+/g, '').toLowerCase();
        const ownerByName = owners.find(o => 
            (o.nickname || '').replace(/\s+/g, '').toLowerCase() === normalizedSearch
        );

        return ownerByName ? ownerByName.nickname : rawIdOrName;
    };

    // 🔥 'TBD' 유령 추적 및 실제 팀명 치환 (안전하게 유지)
    const resolveTbdMatches = (seasonId: string | number, seasonType: string, rawMatches: any[]) => {
        let resolved = rawMatches.map(m => ({ ...m })); 
        
        const getWinner = (m: any) => {
            if (!m || m.status !== 'COMPLETED') return 'TBD';
            if (m.aggWinner && m.aggWinner !== 'TBD') return m.aggWinner;
            const h = Number(m.homeScore || 0), a = Number(m.awayScore || 0);
            return h > a ? m.home : (a > h ? m.away : 'TBD');
        };

        if (seasonType === 'TOURNAMENT' || seasonType === 'CUP') {
            const orderedStages = ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'];
            for (let i = 0; i < orderedStages.length - 1; i++) {
                const currStageMatches = resolved.filter((m:any) => m.stage === orderedStages[i]).sort((a:any,b:any)=>String(a.id||'').localeCompare(String(b.id||'')));
                const nextStageMatches = resolved.filter((m:any) => m.stage === orderedStages[i+1]).sort((a:any,b:any)=>String(a.id||'').localeCompare(String(b.id||'')));
                
                if (currStageMatches.length > 0 && nextStageMatches.length > 0) {
                    nextStageMatches.forEach((nextM: any, idx: number) => {
                        if (nextM.home === 'TBD' || nextM.home === 'BYE') {
                            const m1 = currStageMatches[idx * 2];
                            if (m1) { nextM.home = getWinner(m1); nextM.homeLogo = (getWinner(m1) === m1.home ? m1.homeLogo : m1.awayLogo) || FALLBACK_IMG; }
                        }
                        if (nextM.away === 'TBD' || nextM.away === 'BYE') {
                            const m2 = currStageMatches[idx * 2 + 1];
                            if (m2) { nextM.away = getWinner(m2); nextM.awayLogo = (getWinner(m2) === m2.home ? m2.homeLogo : m2.awayLogo) || FALLBACK_IMG; }
                        }
                    });
                }
            }
        }
        else if (seasonType === 'LEAGUE_PLAYOFF') {
            const calcAggWinner = (leg1: any, leg2: any) => {
                if (!leg1) return 'TBD';
                if (leg2?.aggWinner && leg2.aggWinner !== 'TBD') return leg2.aggWinner;
                if (leg1?.aggWinner && leg1.aggWinner !== 'TBD') return leg1.aggWinner;
                let s1 = 0, s2 = 0;
                if (leg1.status === 'COMPLETED') { s1 += Number(leg1.homeScore); s2 += Number(leg1.awayScore); }
                if (leg2?.status === 'COMPLETED') {
                    if (leg2.home === leg1.away) { s2 += Number(leg2.homeScore); s1 += Number(leg2.awayScore); }
                    else { s1 += Number(leg2.homeScore); s2 += Number(leg2.awayScore); }
                }
                if (s1 > s2) return leg1.home;
                if (s2 > s1) return leg1.away;
                return 'TBD';
            };

            const sId = seasonId;
            const poSemi1_leg1 = resolved.find((m:any) => m.id === `po_${sId}_4_1_1` || (m.matchLabel?.includes('5위') && m.matchLabel?.includes('1차전')));
            const poSemi1_leg2 = resolved.find((m:any) => m.id === `po_${sId}_4_1_2` || (m.matchLabel?.includes('2위') && m.matchLabel?.includes('2차전')));
            const poSemi2_leg1 = resolved.find((m:any) => m.id === `po_${sId}_4_2_1` || (m.matchLabel?.includes('4위') && m.matchLabel?.includes('1차전')));
            const poSemi2_leg2 = resolved.find((m:any) => m.id === `po_${sId}_4_2_2` || (m.matchLabel?.includes('3위') && m.matchLabel?.includes('2차전')));

            const wSemi1 = calcAggWinner(poSemi1_leg1, poSemi1_leg2);
            const wSemi2 = calcAggWinner(poSemi2_leg1, poSemi2_leg2);

            const poFinals = resolved.filter((m:any) => m.stage === 'SEMI_FINAL');
            poFinals.forEach((m:any) => {
                if (m.home === 'TBD') m.home = wSemi1;
                if (m.away === 'TBD') m.away = wSemi2;
            });

            const pf_leg1 = poFinals.find((m:any) => m.matchLabel?.includes('1차전') || m.id === `po_${sId}_fin_1`);
            const pf_leg2 = poFinals.find((m:any) => m.matchLabel?.includes('2차전') || m.id === `po_${sId}_fin_2`);
            const wPoFinal = calcAggWinner(pf_leg1, pf_leg2);

            const grandFinals = resolved.filter((m:any) => m.stage === 'FINAL');
            grandFinals.forEach((m:any) => {
                if (m.away === 'TBD') m.away = wPoFinal;
            });
        }
        return resolved;
    };

    // 1. 현재 선택된 시즌의 실시간 랭킹
    const activeRankingData = useMemo(() => {
        if (!seasons || seasons.length === 0) return { teams: [], owners: [], players: [], regularPlayers: [], playoffPlayers: [], highlights: [] };
        const targetSeason = seasons.find(s => s.id === viewSeasonId);
        if(!targetSeason?.teams) return { teams: [], owners: [], players: [], regularPlayers: [], playoffPlayers: [], highlights: [] };
        
        const teamStats = new Map<string, Team>();
        targetSeason.teams.forEach(t => {
            const correctedOwnerName = getCanonicalOwnerName(t.ownerName);
            // 🔥 [디벨롭] 팀 스탯 Map의 키를 표준화(norm)하여 저장
            teamStats.set(norm(t.name), { ...t, ownerName: correctedOwnerName, win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0 });
        });

        const regularPlayerStatsMap = new Map<string, any>(); 
        const playoffPlayerStatsMap = new Map<string, any>(); 
        const isTournamentMode = targetSeason.type === 'TOURNAMENT';

        let rawMatches: any[] = [];
        targetSeason.rounds?.forEach(r => {
            (r.matches || []).forEach(m => {
                rawMatches.push({ ...m, roundName: r.name });
            });
        });
        
        let allMatches = resolveTbdMatches(targetSeason.id, targetSeason.type, rawMatches);

        allMatches.forEach(m => {
          const canonicalHomeOwner = getCanonicalOwnerName(m.homeOwner);
          const canonicalAwayOwner = getCanonicalOwnerName(m.awayOwner);
          
          const stageUpper = String(m.stage || '').toUpperCase();
          const roundNameUpper = String((m as any).roundName || '').toUpperCase();
          
          // 🔥 [디벨롭] 플레이오프 매치 판별 기준 정교화 (순위표 제외용)
          const isPlayoffMatch = ['FINAL', 'SEMI', 'QUARTER', '34', 'KNOCKOUT'].some(k => stageUpper.includes(k) || roundNameUpper.includes(k));

          if(m.status === 'COMPLETED' || m.status === 'BYE') {
            // 토너먼트 모드이거나, 플레이오프 매치가 아닌 경우(정규 리그)에만 순위표 집계
            if (isTournamentMode || !isPlayoffMatch) {
                const h = Number(m.homeScore || 0), a = Number(m.awayScore || 0);
                // 🔥 [디벨롭] 팀 탐색 시 표준화(norm) 적용 - 대소문자 무시
                const ht = teamStats.get(norm(m.home)); 
                const at = teamStats.get(norm(m.away));
                
                if(ht) { 
                    ht.gf+=h; ht.ga+=a; ht.gd = ht.gf - ht.ga; 
                    if(h>a) { ht.win++; ht.points+=3; } 
                    else if(h<a) { ht.loss++; } 
                    else { ht.draw++; ht.points++; } 
                }
                if(at && norm(m.away) !== 'bye') { 
                    at.gf+=a; at.ga+=h; at.gd = at.gf - at.ga; 
                    if(a>h) { at.win++; at.points+=3; } 
                    else if(a<h) { at.loss++; } 
                    else { at.draw++; at.points++; } 
                }
            }
          }
          
          if(m.status === 'COMPLETED') {
            let safeHomeOwner = canonicalHomeOwner;
            let safeAwayOwner = canonicalAwayOwner;
            if (m.home !== 'TBD' && m.home !== 'BYE') { const ht = teamStats.get(norm(m.home)); if (ht) safeHomeOwner = ht.ownerName; }
            if (m.away !== 'TBD' && m.away !== 'BYE') { const at = teamStats.get(norm(m.away)); if (at) safeAwayOwner = at.ownerName; }

            const processPlayers = (records: any[], isHome: boolean, type: 'goals'|'assists') => {
                records.forEach(s => { 
                    const owner = isHome ? safeHomeOwner : safeAwayOwner;
                    const team = isHome ? m.home : m.away;
                    const pName = (s.name || s).toString().trim();
                    const key = `${pName}-${norm(team)}-${owner}`;
                    
                    const targetMap = isPlayoffMatch ? playoffPlayerStatsMap : regularPlayerStatsMap;

                    if(!targetMap.has(key)) targetMap.set(key, { name: pName, team, teamLogo: (isHome ? m.homeLogo : m.awayLogo) || FALLBACK_IMG, owner, goals: 0, assists: 0 }); 
                    targetMap.get(key)[type] += (s.count || 1); 
                });
            };
            processPlayers(m.homeScorers || [], true, 'goals'); processPlayers(m.awayScorers || [], false, 'goals');
            processPlayers(m.homeAssists || [], true, 'assists'); processPlayers(m.awayAssists || [], false, 'assists');
          }
        });
    
        const teams = Array.from(teamStats.values()).sort((a,b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf).map((t, i) => {
            let prize = 0;
            if ((t.win + t.draw + t.loss) > 0 && targetSeason.prizes) {
                const p = targetSeason.prizes;
                if(i === 0) prize = p.first || 0; else if(i === 1) prize = p.second || 0; else if(i === 2) prize = p.third || 0;
            }
            return { ...t, rank: i+1, currentPrize: prize };
        });
    
        const ownerMap = new Map<string, any>();
        teams.forEach(t => { 
            if(!ownerMap.has(t.ownerName)) ownerMap.set(t.ownerName, {name:t.ownerName, win:0, draw:0, loss:0, points:0, prize:0}); 
            const o = ownerMap.get(t.ownerName); 
            o.win+=t.win; o.draw+=t.draw; o.loss+=t.loss; o.points+=t.points; o.prize+=(t.currentPrize||0);
        });

        const sortedRegularPlayers = Array.from(regularPlayerStatsMap.values()).sort((a:any,b:any)=>b.goals-a.goals);
        const sortedPlayoffPlayers = Array.from(playoffPlayerStatsMap.values()).sort((a:any,b:any)=>b.goals-a.goals);
        
        return { 
            teams, 
            owners: Array.from(ownerMap.values()).sort((a,b)=>b.points-a.points), 
            players: sortedRegularPlayers, 
            regularPlayers: sortedRegularPlayers, 
            playoffPlayers: sortedPlayoffPlayers, 
            highlights: [] 
        };
    }, [seasons, viewSeasonId, owners]);

    // 2. 역대 통합 기록 엔진
    const historyData = useMemo(() => {
        const ownerHist = new Map<string, any>(); 
        const teamHist = new Map<string, any>(); 
        const playerHistMap = new Map<string, any>();

        const initOwner = (idOrName: string) => {
            const canonical = getCanonicalOwnerName(idOrName);
            if (!ownerHist.has(canonical)) {
                ownerHist.set(canonical, { 
                    name: canonical, 
                    win: 0, draw: 0, loss: 0, points: 0, prize: 0, golds: 0, silvers: 0, bronzes: 0 
                });
            }
            return ownerHist.get(canonical);
        };

        historyRecords?.forEach(record => {
            const r = record as any;
            const sInfo = seasons.find(s => s.id === r.seasonId);
            const pConfig: Prizes = sInfo?.prizes || { first: 0, second: 0, third: 0, scorer: 0, assist: 0 };

            r.teams?.forEach((t: any) => {
                const ownerIdOrName = t.ownerId || t.legacyName || t.owner;
                const o = initOwner(ownerIdOrName);
                o.win += (t.win || 0); o.draw += (t.draw || 0); o.loss += (t.loss || 0); 
                o.points += Number(t.pts ?? t.points ?? 0);

                if (!teamHist.has(t.name)) teamHist.set(t.name, { name: t.name, logo: t.logo || FALLBACK_IMG, owner: getCanonicalOwnerName(ownerIdOrName), win: 0, draw: 0, loss: 0, points: 0 });
                const tm = teamHist.get(t.name);
                tm.win += (t.win || 0); tm.draw += (t.draw || 0); tm.loss += (t.loss || 0); 
                tm.points += Number(t.pts ?? t.points ?? 0);
            });

            r.players?.forEach((p: any) => {
                const ownerName = getCanonicalOwnerName(p.ownerId || p.legacyName || p.owner);
                const key = `${p.name}-${ownerName}`;
                if (!playerHistMap.has(key)) playerHistMap.set(key, { name: p.name, owner: ownerName, team: p.team, teamLogo: p.teamLogo || FALLBACK_IMG, goals: 0, assists: 0 });
                const pl = playerHistMap.get(key);
                pl.goals += (p.goals || 0); pl.assists += (p.assists || 0);
            });

            if (r.awards) {
                const aw = r.awards;
                if (aw.champion) { const o = initOwner(aw.champion); o.golds++; o.prize += Number(pConfig.champion || pConfig.first || 0); }
                else if (aw.first) { const o = initOwner(aw.first); o.golds++; o.prize += Number(pConfig.first || 0); }
                if (aw.second) { const o = initOwner(aw.second); o.silvers++; o.prize += Number(pConfig.second || 0); }
                if (aw.third) { const o = initOwner(aw.third); o.bronzes++; o.prize += Number(pConfig.third || 0); }
                
                if (aw.topScorer) { initOwner(aw.topScorer).prize += Number(pConfig.scorer || 0); }
                if (aw.topScorerPO && pConfig.poScorer) { initOwner(aw.topScorerPO).prize += Number(pConfig.poScorer); }
                if (aw.topAssist) { initOwner(aw.topAssist).prize += Number(pConfig.assist || 0); }
                if (aw.topAssistPO && pConfig.poAssist) { initOwner(aw.topAssistPO).prize += Number(pConfig.poAssist); }
            }
        });

        const activeSeasons = seasons?.filter(s => s.status !== 'COMPLETED') || [];
        activeSeasons.forEach(s => {
            const sTeamStats = new Map<string, any>();
            s.teams?.forEach(t => sTeamStats.set(norm(t.name), { ...t, ownerName: getCanonicalOwnerName(t.ownerName), win:0, draw:0, loss:0, points:0 }));

            const isTourney = s.type === 'TOURNAMENT';
            
            let rawMatches: any[] = [];
            s.rounds?.forEach(r => {
                (r.matches || []).forEach(m => {
                    rawMatches.push({ ...m, roundName: r.name });
                });
            });
            
            let allMatches = resolveTbdMatches(s.id, s.type, rawMatches);

            allMatches.forEach(m => {
                if(m.status === 'COMPLETED' || m.status === 'BYE') {
                    const stageUpper = String(m.stage || '').toUpperCase();
                    const roundNameUpper = String((m as any).roundName || '').toUpperCase();
                    
                    const isKnockout = ['FINAL', 'SEMI', 'QUARTER', 'ROUND_OF', '34', 'KNOCKOUT'].some(k => stageUpper.includes(k) || roundNameUpper.includes(k));
                    
                    if (isTourney || !isKnockout) {
                        const h=Number(m.homeScore||0), a=Number(m.awayScore||0);
                        const ht=sTeamStats.get(norm(m.home)), at=sTeamStats.get(norm(m.away));
                        if(ht) { if(h>a) {ht.win++; ht.points+=3;} else if(h<a) ht.loss++; else {ht.draw++; ht.points++;} }
                        if(at && norm(m.away)!=='bye') { if(a>h) {at.win++; at.points+=3;} else if(a<h) at.loss++; else {at.draw++; at.points++;} }
                    }
                }
            });

            Array.from(sTeamStats.values()).forEach(t => {
                const o = initOwner(t.ownerName);
                o.win+=t.win; o.draw+=t.draw; o.loss+=t.loss; o.points+=t.points;
                if (!teamHist.has(t.name)) teamHist.set(t.name, { name: t.name, logo: t.logo || FALLBACK_IMG, owner: t.ownerName, win: 0, draw: 0, loss: 0, points: 0 });
                const tm = teamHist.get(t.name); tm.win+=t.win; tm.draw+=t.draw; tm.loss+=t.loss; tm.points+=t.points;
            });
        });

        return { 
            owners: Array.from(ownerHist.values())
                .filter(o => !['-', 'TBD', 'Unknown', 'SYSTEM', 'BYE', ''].includes(o.name))
                .sort((a,b)=>b.points-a.points || b.prize-a.prize), 
            teams: Array.from(teamHist.values()).sort((a,b)=>b.points-a.points), 
            players: Array.from(playerHistMap.values()).sort((a:any,b:any)=>b.goals-a.goals) 
        };
    }, [seasons, owners, historyRecords]);

    return { activeRankingData, historyData };
};