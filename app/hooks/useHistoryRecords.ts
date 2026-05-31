"use client";

import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// 🔥 owners 명단을 받아서 빈틈없이 합쳐버립니다.
// 🛠️ [HoF 픽스 v3] playerKey 에 team 포함 — 같은 선수가 클럽/국대로 뛰면 별도 entry로 분리
//                  ownerMap 도 history_records.owners 배열을 우선 사용하도록 보강
export const useHistoryRecords = (owners: any[] = []) => {
    const [rawDocs, setRawDocs] = useState<any[]>([]);
    const [historyData, setHistoryData] = useState<any>({ teams: [], owners: [], players: [] });
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);

    // 1. DB 데이터는 딱 한 번만 불러옵니다.
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const snap = await getDocs(collection(db, 'history_records'));
                setRawDocs(snap.docs.map(d => d.data()));
            } catch (error) {
                console.error("역대 기록 로드 에러:", error);
            } finally {
                setIsHistoryLoading(false);
            }
        };
        fetchHistory();
    }, []);

    // 2. 데이터와 오너 명단이 준비되면 스마트 병합을 시작합니다.
    useEffect(() => {
        if (rawDocs.length === 0) return;

        const ownerMap = new Map();
        const teamMap = new Map();
        const playerMap = new Map();

        // 🌟 [핵심 마법] DB의 값(ID 또는 이름)을 받아서, 무조건 '1개의 고유 UID'로 변환합니다.
        const getTrueUid = (dbId: any, dbName: any) => {
            const searchId = String(dbId || '').trim();
            const searchName = String(dbName || '').trim();

            const found = owners.find(o =>
                (o.uid && o.uid === searchId) ||
                (o.docId && o.docId === searchId) ||
                (o.nickname && o.nickname === searchName) ||
                (o.legacyName && o.legacyName === searchName) ||
                (o.mappedOwnerId && o.mappedOwnerId === searchName)
            );

            // 명단에서 찾았다면 진짜 UID 반환, 못 찾았다면 DB값 그대로 반환
            if (found) return found.uid || found.docId || String(found.id);
            return searchId !== '-' && searchId ? searchId : searchName;
        };

        rawDocs.forEach(data => {
            let teamsArray: any[] = [];
            if (data.teams && Array.isArray(data.teams)) {
                teamsArray = data.teams;
            } else {
                const numericKeys = Object.keys(data).filter(k => !isNaN(Number(k))).sort((a, b) => Number(a) - Number(b));
                teamsArray = numericKeys.map(k => data[k]);
            }

            const seasonTeamOwnerMap = new Map<string, { ownerId: string, ownerName: string }>();

            teamsArray.forEach((t, index) => {
                if (!t || !t.name || t.name === 'BYE' || t.name === 'TBD') return;

                const tName = t.name.trim();
                const rawId = t.ownerId || t.ownerUid || '-';
                const rawName = t.owner || t.legacyName || '-';

                // 🔥 스마트 엔진 가동: 파편화된 데이터를 단일 UID로 통일!
                const oId = getTrueUid(rawId, rawName);

                seasonTeamOwnerMap.set(tName, { ownerId: oId, ownerName: rawName });

                // [팀 합산] — 팀명 + 오너UID 조합으로 합산 (같은 팀이라도 오너 다르면 분리)
                const teamKey = `${tName}_${oId}`;
                if (!teamMap.has(teamKey)) {
                    teamMap.set(teamKey, {
                        name: tName, ownerId: oId, ownerName: rawName,
                        win: 0, draw: 0, loss: 0, gf: 0, ga: 0, gd: 0, pts: 0, logo: t.logo
                    });
                }
                const teamStats = teamMap.get(teamKey);
                teamStats.win += Number(t.win || 0);
                teamStats.draw += Number(t.draw || 0);
                teamStats.loss += Number(t.loss || 0);
                teamStats.gf += Number(t.gf || 0);
                teamStats.ga += Number(t.ga || 0);
                teamStats.gd += Number(t.gd || 0);
                teamStats.pts += Number(t.pts || 0);

                // [오너 합산] — history_records.owners 배열이 있으면 아래 별도 블록에서 처리.
                //              없는 시즌(레거시)을 위해 여기서도 teams 기반 폴백 유지.
                if (oId && oId !== '-' && oId !== 'CPU' && !(Array.isArray(data.owners) && data.owners.length > 0)) {
                    if (!ownerMap.has(oId)) {
                        ownerMap.set(oId, { id: oId, name: rawName, win: 0, draw: 0, loss: 0, pts: 0, golds: 0, silvers: 0, bronzes: 0, prize: 0 });
                    }
                    const ownerStats = ownerMap.get(oId);
                    if (rawName !== '-' && rawName !== '정일수' && rawName !== 'JK') ownerStats.name = rawName;

                    ownerStats.win += Number(t.win || 0);
                    ownerStats.draw += Number(t.draw || 0);
                    ownerStats.loss += Number(t.loss || 0);
                    ownerStats.pts += Number(t.pts || 0);
                }

                // 🥇🥈🥉 메달 / 상금 카운트 — 시즌 1~3위는 teams 정렬 순서 기반
                if (oId && oId !== '-' && oId !== 'CPU' && (index === 0 || index === 1 || index === 2)) {
                    if (!ownerMap.has(oId)) {
                        ownerMap.set(oId, { id: oId, name: rawName, win: 0, draw: 0, loss: 0, pts: 0, golds: 0, silvers: 0, bronzes: 0, prize: 0 });
                    }
                    const medalOwner = ownerMap.get(oId);
                    if (rawName !== '-' && rawName !== '정일수' && rawName !== 'JK') medalOwner.name = rawName;
                    if (index === 0) { medalOwner.golds = (medalOwner.golds || 0) + 1; medalOwner.prize = (medalOwner.prize || 0) + 50000; }
                    else if (index === 1) { medalOwner.silvers = (medalOwner.silvers || 0) + 1; medalOwner.prize = (medalOwner.prize || 0) + 30000; }
                    else if (index === 2) { medalOwner.bronzes = (medalOwner.bronzes || 0) + 1; medalOwner.prize = (medalOwner.prize || 0) + 10000; }
                }
            });

            // 🛠️ [HoF 픽스 v3] history_records.owners 명시 배열이 있으면 거기서 정확한 W/D/L/pts 가져오기
            if (Array.isArray(data.owners) && data.owners.length > 0) {
                data.owners.forEach((rawO: any) => {
                    const oid = getTrueUid(rawO.id || rawO.ownerId, rawO.name);
                    if (!oid || oid === '-' || oid === 'CPU') return;
                    if (!ownerMap.has(oid)) {
                        ownerMap.set(oid, { id: oid, name: rawO.name || '', win: 0, draw: 0, loss: 0, pts: 0, golds: 0, silvers: 0, bronzes: 0, prize: 0 });
                    }
                    const ownerStats = ownerMap.get(oid);
                    if (rawO.name && rawO.name !== '-' && rawO.name !== '정일수' && rawO.name !== 'JK') ownerStats.name = rawO.name;
                    ownerStats.win += Number(rawO.win || 0);
                    ownerStats.draw += Number(rawO.draw || 0);
                    ownerStats.loss += Number(rawO.loss || 0);
                    ownerStats.pts += Number(rawO.pts || 0);
                });
            }

            // [플레이어 합산]
            if (data.players && Array.isArray(data.players)) {
                data.players.forEach((p: any) => {
                    const pName = p.name?.trim();
                    if (!pName) return;
                    const pTeam = (p.team || '').trim();
                    const teamMeta = pTeam ? seasonTeamOwnerMap.get(pTeam) : null;

                    const rawPId = p.ownerId || p.ownerUid || teamMeta?.ownerId || '-';
                    const rawPName = p.owner || p.legacyName || teamMeta?.ownerName || '-';

                    const pOwnerId = getTrueUid(rawPId, rawPName);

                    // 🛠️ [HoF 픽스 v3] 팀명을 키에 포함 — 같은 선수가 클럽/국대로 뛰면 별도 entry로 분리
                    //   예) 음바페(Real Madrid) 와 음바페(FRANCE) 는 같은 (이준영) 이지만 별도 줄로 표시
                    const playerKey = `${pName}_${pTeam || '-'}_${pOwnerId}`;
                    if (!playerMap.has(playerKey)) {
                        playerMap.set(playerKey, { name: pName, goals: 0, assists: 0, team: pTeam, owner: rawPName, ownerId: pOwnerId, teamLogo: p.teamLogo });
                    }
                    const pStats = playerMap.get(playerKey);
                    pStats.goals += Number(p.goals || 0);
                    pStats.assists += Number(p.assists || 0);
                });
            }
        });

        const sortedOwners = Array.from(ownerMap.values()).sort((a, b) => b.pts - a.pts || b.golds - a.golds || b.win - a.win);
        const sortedTeams = Array.from(teamMap.values()).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
        const sortedPlayers = Array.from(playerMap.values());

        setHistoryData({ owners: sortedOwners, teams: sortedTeams, players: sortedPlayers });
    }, [rawDocs, owners]); // 👈 owners 배열이 로드되면 완벽히 결합하여 재계산합니다.

    return { historyData, isHistoryLoading };
};