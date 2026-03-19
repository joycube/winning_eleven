import { useMemo } from 'react';
import { Season, Team, Owner, Prizes, FALLBACK_IMG } from '../types';

export const useLeagueStats = (seasons: Season[], viewSeasonId: number, owners: Owner[] = [], historyRecords: any[] = []) => {
    
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

    // 1. 현재 선택된 시즌의 실시간 랭킹
    const activeRankingData = useMemo(() => {
        if (!seasons || seasons.length === 0) return { teams: [], owners: [], players: [], regularPlayers: [], playoffPlayers: [], highlights: [] };
        const targetSeason = seasons.find(s => s.id === viewSeasonId);
        if(!targetSeason?.teams) return { teams: [], owners: [], players: [], regularPlayers: [], playoffPlayers: [], highlights: [] };
        
        const teamStats = new Map<string, Team>();
        targetSeason.teams.forEach(t => {
            const correctedOwnerName = getCanonicalOwnerName(t.ownerName);
            teamStats.set(t.name, { ...t, ownerName: correctedOwnerName, win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0 });
        });

        const regularPlayerStatsMap = new Map<string, any>(); 
        const playoffPlayerStatsMap = new Map<string, any>(); 

        // 🔥 [수술 핵심 포인트 1] 토너먼트 모드인지 미리 확인
        const isTournamentMode = targetSeason.type === 'TOURNAMENT';

        targetSeason.rounds?.forEach(r => (r.matches || []).forEach(m => {
          const canonicalHomeOwner = getCanonicalOwnerName(m.homeOwner);
          const canonicalAwayOwner = getCanonicalOwnerName(m.awayOwner);
          
          const stageUpper = String(m.stage || '').toUpperCase();
          const roundNameUpper = String(r.name || '').toUpperCase();
          const isPlayoffMatch = ['FINAL', 'SEMI', 'QUARTER', 'ROUND_OF', 'PO', '34'].some(k => stageUpper.includes(k) || roundNameUpper.includes(k));

          if(m.status === 'COMPLETED' || m.status === 'BYE') {
            // 🔥 [수술 핵심 포인트 2] "토너먼트 모드이거나, 플레이오프 매치가 아닐 때만" 스탯을 합산해라!
            if (isTournamentMode || !isPlayoffMatch) {
                const h = Number(m.homeScore || 0), a = Number(m.awayScore || 0);
                const ht = teamStats.get(m.home); const at = teamStats.get(m.away);
                
                if(ht) { 
                    ht.gf+=h; ht.ga+=a; ht.gd = ht.gf - ht.ga; 
                    if(h>a) { ht.win++; ht.points+=3; } 
                    else if(h<a) { ht.loss++; } 
                    else { ht.draw++; ht.points++; } 
                }
                if(at && m.away !== 'BYE' && !m.away.includes('BYE')) { 
                    at.gf+=a; at.ga+=h; at.gd = at.gf - at.ga; 
                    if(a>h) { at.win++; at.points+=3; } 
                    else if(a<h) { at.loss++; } 
                    else { at.draw++; at.points++; } 
                }
            }
          }
          
          if(m.status === 'COMPLETED') {
            const processPlayers = (records: any[], isHome: boolean, type: 'goals'|'assists') => {
                records.forEach(s => { 
                    const owner = isHome ? canonicalHomeOwner : canonicalAwayOwner;
                    const team = isHome ? m.home : m.away;
                    const pName = (s.name || s).toString().trim();
                    const key = `${pName}-${team}-${owner}`;
                    
                    const targetMap = isPlayoffMatch ? playoffPlayerStatsMap : regularPlayerStatsMap;

                    if(!targetMap.has(key)) targetMap.set(key, { name: pName, team, teamLogo: (isHome ? m.homeLogo : m.awayLogo) || FALLBACK_IMG, owner, goals: 0, assists: 0 }); 
                    targetMap.get(key)[type] += (s.count || 1); 
                });
            };
            processPlayers(m.homeScorers || [], true, 'goals'); processPlayers(m.awayScorers || [], false, 'goals');
            processPlayers(m.homeAssists || [], true, 'assists'); processPlayers(m.awayAssists || [], false, 'assists');
          }
        }));
    
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
            s.teams?.forEach(t => sTeamStats.set(t.name, { ...t, ownerName: getCanonicalOwnerName(t.ownerName), win:0, draw:0, loss:0, points:0 }));

            // 🔥 [수술 핵심 포인트 3] 역대 기록 합산 시에도 토너먼트 모드 처리
            const isTourney = s.type === 'TOURNAMENT';

            s.rounds?.forEach(r => (r.matches || []).forEach(m => {
                if(m.status === 'COMPLETED' || m.status === 'BYE') {
                    const isKnockout = ['FINAL', 'SEMI', 'QUARTER'].some(k => String(m.stage||'').toUpperCase().includes(k));
                    
                    // 토너먼트 모드면 모든 경기 포함, 그 외엔 Knockout 제외
                    if (isTourney || !isKnockout) {
                        const h=Number(m.homeScore||0), a=Number(m.awayScore||0);
                        const ht=sTeamStats.get(m.home), at=sTeamStats.get(m.away);
                        if(ht) { if(h>a) {ht.win++; ht.points+=3;} else if(h<a) ht.loss++; else {ht.draw++; ht.points++;} }
                        if(at && m.away!=='BYE' && !m.away?.includes('BYE')) { if(a>h) {at.win++; at.points+=3;} else if(a<h) at.loss++; else {at.draw++; at.points++;} }
                    }
                }
            }));

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