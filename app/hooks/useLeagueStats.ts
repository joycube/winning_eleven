import { useMemo } from 'react';
import { Season, Team, Owner, Prizes, FALLBACK_IMG } from '../types';

export const useLeagueStats = (seasons: Season[], viewSeasonId: number, owners: Owner[] = [], historyRecords: any[] = []) => {
    
    /**
     * 🔥 [이름 통합 엔진] 
     * UID나 옛날 이름을 던지면 현재 명부의 '정답 닉네임'을 찾아옵니다.
     * 이 함수가 성적 통합의 핵심 열쇠입니다.
     */
    const getCanonicalOwnerName = (rawIdOrName: string) => {
        if (!rawIdOrName) return 'Unknown';
        const searchInput = rawIdOrName.toString().trim();

        // 1. UID(docId)나 숫자 ID로 마스터 명부에서 찾기 (최우선순위)
        // searchInput이 UID(8p954v...)일 때 o.docId와 매칭하여 '이준영'을 반환합니다.
        const ownerByUid = owners.find(o => 
            String(o.docId) === searchInput || 
            String(o.id) === searchInput ||
            String((o as any).uid) === searchInput // 계정 연동 UID 필드 대응
        );
        if (ownerByUid) return ownerByUid.nickname;

        // 2. 닉네임 텍스트로 찾기 (대소문자, 공백 무시)
        // 'NO.7 베컴'과 'No.7 베컴'을 동일인으로 인식하게 합니다.
        const normalizedSearch = searchInput.replace(/\s+/g, '').toLowerCase();
        const ownerByName = owners.find(o => 
            (o.nickname || '').replace(/\s+/g, '').toLowerCase() === normalizedSearch
        );

        // 찾았다면 시스템에 등록된 '정확한 닉네임'을 반환, 못 찾으면 원본 반환
        return ownerByName ? ownerByName.nickname : rawIdOrName;
    };

    // 1. 현재 선택된 시즌의 실시간 랭킹 (유지)
    const activeRankingData = useMemo(() => {
        if (!seasons || seasons.length === 0) return { teams: [], owners: [], players: [], highlights: [] };
        const targetSeason = seasons.find(s => s.id === viewSeasonId);
        if(!targetSeason?.teams) return { teams: [], owners: [], players: [], highlights: [] };
        
        const teamStats = new Map<string, Team>();
        targetSeason.teams.forEach(t => {
            const correctedOwnerName = getCanonicalOwnerName(t.ownerName);
            teamStats.set(t.name, { ...t, ownerName: correctedOwnerName, win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0 });
        });

        const playerStatsMap = new Map<string, any>(); 
        targetSeason.rounds?.forEach(r => r.matches.forEach(m => {
          const canonicalHomeOwner = getCanonicalOwnerName(m.homeOwner);
          const canonicalAwayOwner = getCanonicalOwnerName(m.awayOwner);
          if(m.status === 'COMPLETED' || m.status === 'BYE') {
            const stageUpper = (m.stage || '').toUpperCase();
            const isKnockoutMatch = ['FINAL', 'SEMI', 'QUARTER', 'ROUND_OF', 'PO', '34'].some(k => stageUpper.includes(k));
            if (!isKnockoutMatch) {
                const h = Number(m.homeScore || 0), a = Number(m.awayScore || 0);
                const ht = teamStats.get(m.home); const at = teamStats.get(m.away);
                if(ht) { ht.gf+=h; ht.ga+=a; ht.gd = ht.gf - ht.ga; if(h>a) { ht.win++; ht.points+=3; } else if(h<a) { ht.loss++; } else { ht.draw++; ht.points++; } }
                if(at && m.away !== 'BYE' && !m.away.includes('BYE')) { at.gf+=a; at.ga+=h; at.gd = at.gf - at.ga; if(a>h) { at.win++; at.points+=3; } else if(a<h) { at.loss++; } else { at.draw++; at.points++; } }
            }
          }
          if(m.status === 'COMPLETED') {
            const processPlayers = (records: any[], isHome: boolean, type: 'goals'|'assists') => {
                records.forEach(s => { 
                    const owner = isHome ? canonicalHomeOwner : canonicalAwayOwner;
                    const team = isHome ? m.home : m.away;
                    const pName = s.name?.trim() || s;
                    const key = `${pName}-${team}-${owner}`;
                    if(!playerStatsMap.has(key)) playerStatsMap.set(key, { name: pName, team, teamLogo: (isHome ? m.homeLogo : m.awayLogo) || FALLBACK_IMG, owner, goals: 0, assists: 0 }); 
                    playerStatsMap.get(key)[type] += (s.count || 1); 
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
                if(i === 0) prize = p.first; else if(i === 1) prize = p.second; else if(i === 2) prize = p.third;
            }
            return { ...t, rank: i+1, currentPrize: prize };
        });
    
        const ownerMap = new Map<string, any>();
        teams.forEach(t => { 
            if(!ownerMap.has(t.ownerName)) ownerMap.set(t.ownerName, {name:t.ownerName, win:0, draw:0, loss:0, points:0, prize:0}); 
            const o = ownerMap.get(t.ownerName); 
            o.win+=t.win; o.draw+=t.draw; o.loss+=t.loss; o.points+=t.points; o.prize+=(t.currentPrize||0);
        });
        
        return { teams, owners: Array.from(ownerMap.values()).sort((a,b)=>b.points-a.points), players: Array.from(playerStatsMap.values()).sort((a:any,b:any)=>b.goals-a.goals), highlights: [] };
    }, [seasons, viewSeasonId, owners]);

    // 2. 🔥 역대 통합 기록 엔진 (UID + 이름 성적 완벽 합산 로직)
    const historyData = useMemo(() => {
        const ownerHist = new Map<string, any>(); 
        const teamHist = new Map<string, any>(); 
        const playerHistMap = new Map<string, any>();

        const initOwner = (idOrName: string) => {
            // 🔥 [핵심] UID든 옛날 이름이든 먼저 '정답 닉네임'으로 변환한 뒤 Map의 Key로 사용합니다.
            // 이렇게 해야 '8p954v...'와 '이준영'이 하나의 '이준영' 칸으로 합쳐집니다.
            const canonical = getCanonicalOwnerName(idOrName);
            if (!ownerHist.has(canonical)) {
                ownerHist.set(canonical, { 
                    name: canonical, // 여기가 UID(외계어)가 아닌 실제 이름으로 박히게 됩니다.
                    win: 0, draw: 0, loss: 0, points: 0, prize: 0, golds: 0, silvers: 0, bronzes: 0 
                });
            }
            return ownerHist.get(canonical);
        };

        // 📦 [STEP A] 마감된 시즌 스냅샷(historyRecords) 합산
        historyRecords?.forEach(record => {
            const r = record as any;
            
            // 해당 시즌의 상금 정보를 Prizes 타입에 맞춰 안전하게 가져옴
            const sInfo = seasons.find(s => s.id === r.seasonId);
            const pConfig: Prizes = sInfo?.prizes || { first: 0, second: 0, third: 0, scorer: 0, assist: 0 };

            r.teams?.forEach((t: any) => {
                const ownerIdOrName = t.ownerId || t.legacyName || t.owner;
                const o = initOwner(ownerIdOrName);
                o.win += (t.win || 0); o.draw += (t.draw || 0); o.loss += (t.loss || 0); 
                // pts와 points 필드 통합 합산
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
                if (aw.topAssist) { initOwner(aw.topAssist).prize += Number(pConfig.assist || 0); }
            }
        });

        // 🏃‍♂️ [STEP B] 현재 진행 중인 시즌 실시간 합산
        const activeSeasons = seasons?.filter(s => s.status !== 'COMPLETED') || [];
        activeSeasons.forEach(s => {
            const sTeamStats = new Map<string, any>();
            s.teams?.forEach(t => sTeamStats.set(t.name, { ...t, ownerName: getCanonicalOwnerName(t.ownerName), win:0, draw:0, loss:0, points:0 }));

            s.rounds?.forEach(r => r.matches.forEach(m => {
                if(m.status === 'COMPLETED' || m.status === 'BYE') {
                    const isKnockout = ['FINAL', 'SEMI', 'QUARTER'].some(k => (m.stage||'').toUpperCase().includes(k));
                    if (!isKnockout) {
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

        // 🔥 [시스템 계정 필터링 반영] '-', 'TBD', 'Unknown', 'SYSTEM', 'BYE', 빈 문자열('') 등은 명예의 전당에서 제외
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