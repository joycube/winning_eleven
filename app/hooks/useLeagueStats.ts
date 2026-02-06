// app/hooks/useLeagueStats.ts
import { useMemo } from 'react';
import { Season, Team, FALLBACK_IMG } from '../types';

export const useLeagueStats = (seasons: Season[], viewSeasonId: number) => {
    
    // 1. 현재 선택된 시즌의 랭킹 계산
    const activeRankingData = useMemo(() => {
        // 시즌 데이터가 없거나 로딩 전이면 빈 값 반환 (에러 방지)
        if (!seasons || seasons.length === 0) return { teams: [], owners: [], players: [], highlights: [] };

        const targetSeason = seasons.find(s => s.id === viewSeasonId);
        if(!targetSeason?.teams) return { teams: [], owners: [], players: [], highlights: [] };
        
        const teamStats = new Map<string, Team>();
        targetSeason.teams.forEach(t => teamStats.set(t.name, { ...t, win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0 }));
        const playerStatsMap = new Map<string, any>(); 
        
        targetSeason.rounds?.forEach(r => r.matches.forEach(m => {
          // 🔥 [수정 1] 데이터 안전성 확보 (부전승/TBD 상황에서 배열이 없어도 크래시 방지)
          const homeScorers = m.homeScorers || [];
          const awayScorers = m.awayScorers || [];
          const homeAssists = m.homeAssists || [];
          const awayAssists = m.awayAssists || [];

          // 🔥 [수정 2] FINISHED -> COMPLETED 변경 및 부전승 로직 안정화
          if(m.status === 'COMPLETED' || m.status === 'BYE') {
            const h = Number(m.homeScore || 0), a = Number(m.awayScore || 0);
            const ht = teamStats.get(m.home); 
            const at = teamStats.get(m.away);

            if(ht) { 
                ht.gf+=h; ht.ga+=a; ht.gd = ht.gf - ht.ga; 
                if(h>a) { ht.win++; ht.points+=3; } else if(h<a) { ht.loss++; } else { ht.draw++; ht.points++; } 
            }
            // 부전승(BYE)이 아닐 때만 어웨이 팀 스탯 계산
            if(at && m.away !== 'BYE' && m.away !== 'BYE (부전승)') { 
                at.gf+=a; at.ga+=h; at.gd = at.gf - at.ga; 
                if(a>h) { at.win++; at.points+=3; } else if(a<h) { at.loss++; } else { at.draw++; at.points++; } 
            }
          }
          
          // 🔥 [수정 3] FINISHED -> COMPLETED 변경 및 이미지 Fallback 적용
          if(m.status === 'COMPLETED') {
            [...homeScorers, ...awayScorers].forEach(s => { 
                const isHome = homeScorers.includes(s);
                const key = `${s.name.trim()}-${isHome ? m.home : m.away}-${isHome ? m.homeOwner : m.awayOwner}`;
                
                // TBD 또는 이미지 없을 때 대체 이미지 적용
                const teamLogo = (isHome ? m.homeLogo : m.awayLogo) || FALLBACK_IMG;

                if(!playerStatsMap.has(key)) playerStatsMap.set(key, {
                    name: s.name.trim(), 
                    team: isHome ? m.home : m.away, 
                    teamLogo: teamLogo, 
                    owner: isHome ? m.homeOwner : m.awayOwner, 
                    goals: 0, 
                    assists: 0
                }); 
                playerStatsMap.get(key).goals += s.count; 
            });

            [...homeAssists, ...awayAssists].forEach(s => { 
                const isHome = homeAssists.includes(s);
                const key = `${s.name.trim()}-${isHome ? m.home : m.away}-${isHome ? m.homeOwner : m.awayOwner}`;
                
                // TBD 또는 이미지 없을 때 대체 이미지 적용
                const teamLogo = (isHome ? m.homeLogo : m.awayLogo) || FALLBACK_IMG;

                if(!playerStatsMap.has(key)) playerStatsMap.set(key, {
                    name: s.name.trim(), 
                    team: isHome ? m.home : m.away, 
                    teamLogo: teamLogo, 
                    owner: isHome ? m.homeOwner : m.awayOwner, 
                    goals: 0, 
                    assists: 0
                }); 
                playerStatsMap.get(key).assists += s.count; 
            });
          }
        }));
    
        const teams = Array.from(teamStats.values()).sort((a,b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf).map((t, i) => {
            let prize = 0;
            const played = t.win + t.draw + t.loss;
            if (played > 0 && targetSeason.prizes) {
                if(i === 0) prize = targetSeason.prizes.first;
                else if(i === 1) prize = targetSeason.prizes.second;
                else if(i === 2) prize = targetSeason.prizes.third;
            }
            return { ...t, rank: i+1, currentPrize: prize };
        });
    
        const ownerMap = new Map<string, any>();
        teams.forEach(t => { 
            if(!ownerMap.has(t.ownerName)) ownerMap.set(t.ownerName, {name:t.ownerName, win:0, draw:0, loss:0, points:0, prize:0}); 
            const o = ownerMap.get(t.ownerName); 
            o.win+=t.win; o.draw+=t.draw; o.loss+=t.loss; o.points+=t.points; o.prize+=(t.currentPrize||0);
        });
        
        // 🔥 [수정 4] 하이라이트 승자 로고 처리 (TBD/Null 일 때 FALLBACK_IMG)
        const highlights = targetSeason.rounds?.flatMap(r => r.matches).filter(m => m.youtubeUrl).map(m => {
            const isHomeWin = Number(m.homeScore) > Number(m.awayScore);
            const isAwayWin = Number(m.awayScore) > Number(m.homeScore);
            
            const winner = isHomeWin ? m.home : (isAwayWin ? m.away : 'DRAW');
            const winnerLogo = (isHomeWin ? m.homeLogo : (isAwayWin ? m.awayLogo : FALLBACK_IMG)) || FALLBACK_IMG;

            return { ...m, winner, winnerLogo };
        }) || [];
    
        return { teams, owners: Array.from(ownerMap.values()).sort((a,b)=>b.points-a.points || b.prize-a.prize), players: Array.from(playerStatsMap.values()).sort((a:any,b:any)=>b.goals-a.goals), highlights };
    }, [seasons, viewSeasonId]);

    // 2. 역대 통합 기록 계산
    const historyData = useMemo(() => {
        const ownerHist = new Map<string, any>(); const teamHist = new Map<string, any>(); const playerHistMap = new Map<string, any>();
        
        if (!seasons) return { owners: [], teams: [], players: [] };

        seasons.forEach(s => {
            if(!s.teams) return;
            const sTeamStats = new Map<string, any>();
            s.teams.forEach(t => sTeamStats.set(t.name, { ...t, win:0, draw:0, loss:0, points:0 }));
            
            s.rounds?.forEach(r => r.matches.forEach(m => {
                // 🔥 [수정 5] 데이터 안전성 확보 (통합 기록)
                const homeScorers = m.homeScorers || [];
                const awayScorers = m.awayScorers || [];
                const homeAssists = m.homeAssists || [];
                const awayAssists = m.awayAssists || [];

                if(m.status === 'COMPLETED' || m.status === 'BYE') {
                    const h=Number(m.homeScore||0), a=Number(m.awayScore||0);
                    const ht=sTeamStats.get(m.home), at=sTeamStats.get(m.away);
                    if(ht) { if(h>a) {ht.win++; ht.points+=3;} else if(h<a) ht.loss++; else {ht.draw++; ht.points++;} }
                    if(at && m.away!=='BYE' && m.away!=='BYE (부전승)') { if(a>h) {at.win++; at.points+=3;} else if(a<h) at.loss++; else {at.draw++; at.points++;} }
                }
                
                if(m.status === 'COMPLETED') {
                    [...homeScorers, ...awayScorers].forEach(p => { 
                        const isHome = homeScorers.includes(p);
                        const key = `${p.name.trim()}-${isHome ? m.home : m.away}-${isHome ? m.homeOwner : m.awayOwner}`;
                        const teamLogo = (isHome ? m.homeLogo : m.awayLogo) || FALLBACK_IMG;

                        if(!playerHistMap.has(key)) playerHistMap.set(key, {
                            name: p.name.trim(), 
                            team: isHome ? m.home : m.away, 
                            teamLogo: teamLogo, 
                            owner: isHome ? m.homeOwner : m.awayOwner, 
                            goals: 0, 
                            assists: 0
                        }); 
                        playerHistMap.get(key).goals += p.count; 
                    });
                    
                    [...homeAssists, ...awayAssists].forEach(p => { 
                        const isHome = homeAssists.includes(p);
                        const key = `${p.name.trim()}-${isHome ? m.home : m.away}-${isHome ? m.homeOwner : m.awayOwner}`;
                        const teamLogo = (isHome ? m.homeLogo : m.awayLogo) || FALLBACK_IMG;

                        if(!playerHistMap.has(key)) playerHistMap.set(key, {
                            name: p.name.trim(), 
                            team: isHome ? m.home : m.away, 
                            teamLogo: teamLogo, 
                            owner: isHome ? m.homeOwner : m.awayOwner, 
                            goals: 0, 
                            assists: 0
                        }); 
                        playerHistMap.get(key).assists += p.count; 
                    });
                }
            }));
            
            // ... 기존 로직 유지 ...
            Array.from(sTeamStats.values()).sort((a,b)=>b.points-a.points).forEach((t, idx) => {
                const played = t.win + t.draw + t.loss;
                if(!ownerHist.has(t.ownerName)) ownerHist.set(t.ownerName, {name:t.ownerName, win:0, draw:0, loss:0, points:0, prize:0, golds:0, silvers:0, bronzes:0});
                const o = ownerHist.get(t.ownerName);
                o.win+=t.win; o.draw+=t.draw; o.loss+=t.loss; o.points+=t.points;
                if(played > 0) {
                    if(idx===0) {o.golds++; o.prize+=(s.prizes?.first||0);} else if(idx===1) {o.silvers++; o.prize+=(s.prizes?.second||0);} else if(idx===2) {o.bronzes++; o.prize+=(s.prizes?.third||0);}
                }
                if(!teamHist.has(t.name)) teamHist.set(t.name, {name:t.name, logo:t.logo, owner:t.ownerName, win:0, draw:0, loss:0, points:0});
                const tm = teamHist.get(t.name); tm.win+=t.win; tm.draw+=t.draw; tm.loss+=t.loss; tm.points+=t.points;
            });
        });
        return { owners: Array.from(ownerHist.values()).sort((a,b)=>b.points-a.points || b.prize-a.prize), teams: Array.from(teamHist.values()).sort((a,b)=>b.points-a.points), players: Array.from(playerHistMap.values()).sort((a:any,b:any)=>b.goals-a.goals) };
    }, [seasons]);

    return { activeRankingData, historyData };
};