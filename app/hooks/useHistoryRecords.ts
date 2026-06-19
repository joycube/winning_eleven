"use client";

import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
// 🛠️ [Finance v4 / 옵션1] 메달·상금을 finance_ledger 단일 진실로 통일
import { resolveOwnerByLedger } from '../utils/financeMatching';

// 🔥 owners 명단을 받아서 빈틈없이 합쳐버립니다.
// 🛠️ [HoF 픽스 v3] playerKey 에 team 포함 — 같은 선수가 클럽/국대로 뛰면 별도 entry로 분리
//                  ownerMap 도 history_records.owners 배열을 우선 사용하도록 보강
// 🛠️ [Finance v4 / 옵션1 정제] seasons 파라미터로 진행 중 시즌의 W/D/L/PTS 합산
//   Owner 통계: seasons (라이브) 의 매치 데이터로 통일 → 마감 + 진행 모두 반영
//   Team / Player 통계: history_records 그대로 (변경 없음)
//   Medal / Prize: finance_ledger (마감된 시즌만)
// 🛠️ [옵션A-3] masterTeams 파라미터 추가 — owner 가 비어있거나 TBD 인 매치에 대해
//   masterTeams[teamName].ownerName/ownerUid 로 폴백 매칭 → 레거시 데이터 W/D/L 누락 방지
export const useHistoryRecords = (owners: any[] = [], seasons: any[] = [], masterTeams: any[] = []) => {
    const [rawDocs, setRawDocs] = useState<any[]>([]);
    // 🛠️ [Finance v4 / 옵션1] finance_ledger 도 함께 로드
    const [rawLedgers, setRawLedgers] = useState<any[]>([]);
    const [historyData, setHistoryData] = useState<any>({ teams: [], owners: [], players: [] });
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);

    // 1. DB 데이터는 딱 한 번만 불러옵니다.
    //    🛠️ [Finance v4 / 옵션1 보강] history_records 는 공개 / finance_ledger 는 로그인 필요
    //    비로그인 상태에선 ledger 가 권한 거부되므로 둘을 분리해서 fetch (allSettled)
    //    history_records 만 받아도 명예의 전당 W/D/L 표시는 정상 작동 (메달/상금은 0)
    useEffect(() => {
        const fetchAll = async () => {
            const [histResult, ledgerResult] = await Promise.allSettled([
                getDocs(collection(db, 'history_records')),
                getDocs(collection(db, 'finance_ledger')),
            ]);

            if (histResult.status === 'fulfilled') {
                setRawDocs(histResult.value.docs.map(d => d.data()));
            } else {
                console.error('history_records 로드 에러:', histResult.reason);
            }

            if (ledgerResult.status === 'fulfilled') {
                setRawLedgers(ledgerResult.value.docs.map(d => ({ id: d.id, ...d.data() })));
            } else {
                // 비로그인 시 권한 거부 — 정상 동작 (메달/상금만 미표시, 다른 통계는 정상)
                console.info('finance_ledger 접근 거부 — 비로그인 상태이거나 권한 없음. 메달/상금은 미표시');
            }

            setIsHistoryLoading(false);
        };
        fetchAll();
    }, []);

    // 2. 데이터와 오너 명단이 준비되면 스마트 병합을 시작합니다.
    //    🛠️ [Finance v4 / 옵션1] rawDocs 또는 rawLedgers 중 하나라도 있으면 진행
    useEffect(() => {
        if (rawDocs.length === 0 && rawLedgers.length === 0) return;

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

                // 🛠️ [Finance v4 / 옵션1] 메달·상금은 더 이상 teams 인덱스 기반으로 부여하지 않음
                //   하단의 finance_ledger 일괄 집계 블록에서 처리됨 (마감된 시즌만 인정)
            });

            // 🛠️ [Finance v4 / 옵션1 정제] 오너 W/D/L/PTS 는 history_records 가 아니라 아래 seasons 라이브 블록에서 일괄 계산
            //   이유: 마감 + 진행 시즌을 같이 보려면 한곳에서 통일된 소스로 계산해야 함

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

        // 🛠️ [Finance v4 / 옵션1 정제] 오너 W/D/L/PTS — seasons 라이브 데이터로 통일 (마감 + 진행 모두 반영)
        //   ownerMap 에 기존 history_records 기반 누적값이 있을 수 있으므로 라이브 합산은 별도 키 처리 후 머지
        //   owner 식별자 통합: nickname / uid / docId / id / legacyName / legacyNames / mappedOwnerId
        // 🛠️ [옵션A-3] masterTeams 폴백 추가 — owner 가 TBD/빈값인 매치에서 팀 이름으로 owner 추론
        const resolveOwnerKey = (ownerName: any, ownerUid?: string, teamName?: string): string | null => {
            let id = String(ownerUid || '').trim();
            let name = String(ownerName || '').trim();

            // 🛠️ [옵션A-3] 1차: owner 가 비어있거나 TBD 면 masterTeams 에서 팀명으로 보정
            const isInvalid = (v: string) => !v || ['', '-', 'CPU', 'SYSTEM', 'TBD', 'BYE'].includes(v);
            if ((isInvalid(name) || isInvalid(id)) && teamName) {
                const cleanT = (teamName || '').replace(/\s+/g, '').toLowerCase();
                const master: any = (masterTeams || []).find((t: any) =>
                    ((t?.name || t?.teamName || '').replace(/\s+/g, '').toLowerCase()) === cleanT
                );
                if (master && master.ownerName && !isInvalid(String(master.ownerName).trim())) {
                    if (isInvalid(name)) name = String(master.ownerName).trim();
                    if (isInvalid(id) && master.ownerUid) id = String(master.ownerUid).trim();
                }
            }

            if (!id && !name) return null;
            if (isInvalid(name) && isInvalid(id)) return null;

            const found = owners.find((o: any) =>
                (id && (o.uid === id || o.docId === id || String(o.id) === id)) ||
                (name && (o.nickname === name || o.legacyName === name || (Array.isArray(o.legacyNames) && o.legacyNames.includes(name)) || o.mappedOwnerId === name))
            );
            if (found) return String(found.uid || found.docId || found.id);
            return id || name;
        };

        // 모든 seasons (마감/진행 무관) 의 완료 매치 전부 누적
        // history_records 기반 누적값은 사용 안 함 (위에서 주석 처리됨) → 중복 없음
        (seasons || []).forEach((s: any) => {
            s?.rounds?.forEach((r: any) => {
                r?.matches?.forEach((m: any) => {
                    if (m?.status !== 'COMPLETED') return;
                    if (m.home === 'BYE' || m.away === 'BYE' || m.home === 'TBD' || m.away === 'TBD') return;

                    const hs = Number(m.homeScore || 0);
                    const as_ = Number(m.awayScore || 0);

                    // 🛠️ [옵션A-3] teamName 인자 추가 — masterTeams 폴백 트리거
                    const homeKey = resolveOwnerKey(m.homeOwner, m.homeOwnerUid, m.home);
                    const awayKey = resolveOwnerKey(m.awayOwner, m.awayOwnerUid, m.away);

                    const updateOwner = (key: string | null, ownerName: string, didWin: boolean, didDraw: boolean) => {
                        if (!key) return;
                        if (!ownerMap.has(key)) {
                            ownerMap.set(key, { id: key, name: ownerName || '', win: 0, draw: 0, loss: 0, pts: 0, golds: 0, silvers: 0, bronzes: 0, prize: 0 });
                        }
                        const stat = ownerMap.get(key);
                        if (ownerName && ownerName !== '-' && ownerName !== '정일수' && ownerName !== 'JK') stat.name = ownerName;
                        if (didWin) { stat.win += 1; stat.pts += 3; }
                        else if (didDraw) { stat.draw += 1; stat.pts += 1; }
                        else { stat.loss += 1; }
                    };

                    if (hs > as_) {
                        updateOwner(homeKey, m.homeOwner, true, false);
                        updateOwner(awayKey, m.awayOwner, false, false);
                    } else if (hs < as_) {
                        updateOwner(homeKey, m.homeOwner, false, false);
                        updateOwner(awayKey, m.awayOwner, true, false);
                    } else {
                        updateOwner(homeKey, m.homeOwner, false, true);
                        updateOwner(awayKey, m.awayOwner, false, true);
                    }
                });
            });
        });

        // 🛠️ [Finance v4 / 옵션1 + 폴백] 메달·상금 집계
        //   1차: finance_ledger 의 REVENUE 항목 (정확 — 실제 상금 amount, 모든 상별)
        //   폴백: finance_ledger 가 비어있으면 (비로그인 권한 거부 또는 데이터 없음)
        //         → history_records.teams[0/1/2] 인덱스 기반으로 산출 (기존 방식, 메달만 표시)
        //   목적: 비로그인 사용자에게도 명예의 전당의 메달이 보이도록 가시성 보장
        const revenueLedgers = rawLedgers.filter((l: any) => l?.type === 'REVENUE');
        const useLedger = revenueLedgers.length > 0;

        if (typeof window !== 'undefined') {
            console.info(`[useHistoryRecords] finance_ledger: ${rawLedgers.length}건 (REVENUE ${revenueLedgers.length}). owners: ${owners.length}명. 메달 산출 방식: ${useLedger ? 'ledger (정확)' : 'history_records.teams 폴백 (비로그인 또는 ledger 없음)'}`);
        }

        const unmatchedSamples: any[] = [];

        if (!useLedger) {
            // 🛠️ 폴백: 기존 방식 — history_records.teams[0/1/2] 로 메달 부여
            //   비로그인 시 finance_ledger 권한 거부되더라도 명예의 전당이 비어보이지 않게
            rawDocs.forEach((data: any) => {
                let teamsArray: any[] = [];
                if (data.teams && Array.isArray(data.teams)) {
                    teamsArray = data.teams;
                } else {
                    const numericKeys = Object.keys(data).filter(k => !isNaN(Number(k))).sort((a, b) => Number(a) - Number(b));
                    teamsArray = numericKeys.map(k => data[k]);
                }
                teamsArray.forEach((t: any, index: number) => {
                    if (!t || !t.name || t.name === 'BYE' || t.name === 'TBD') return;
                    if (index > 2) return;
                    const oId = getTrueUid(t.ownerId || t.ownerUid, t.owner || t.legacyName);
                    if (!oId || oId === '-' || oId === 'CPU') return;
                    if (!ownerMap.has(oId)) {
                        ownerMap.set(oId, { id: oId, name: t.owner || '', win: 0, draw: 0, loss: 0, pts: 0, golds: 0, silvers: 0, bronzes: 0, prize: 0 });
                    }
                    const s = ownerMap.get(oId);
                    if (index === 0) { s.golds = (s.golds || 0) + 1; s.prize = (s.prize || 0) + 50000; }
                    else if (index === 1) { s.silvers = (s.silvers || 0) + 1; s.prize = (s.prize || 0) + 30000; }
                    else if (index === 2) { s.bronzes = (s.bronzes || 0) + 1; s.prize = (s.prize || 0) + 10000; }
                });
            });
        }

        // 1차: finance_ledger 가 있을 때 — 정확한 메달/상금 산출
        rawLedgers.forEach((l: any) => {
            if (l?.type !== 'REVENUE') return;
            const title = String(l?.title || '');
            const amount = Number(l?.amount || 0);
            // owner 매칭
            const matched = resolveOwnerByLedger(l, owners);
            // owner 명단에 없으면 unmatched 누적 (진단용)
            if (!matched && unmatchedSamples.length < 3) {
                unmatchedSamples.push({ ownerId: l.ownerId, ownerUid: l.ownerUid, title: l.title, amount: l.amount });
            }
            // owner 명단에 없으면 기존 ownerMap 에 정착시키지 못함 → 식별자라도 사용
            const oid = matched
                ? (matched.uid || matched.docId || String(matched.id))
                : String(l.ownerUid || l.ownerId || '').trim();
            if (!oid) return;

            if (!ownerMap.has(oid)) {
                ownerMap.set(oid, { id: oid, name: matched?.nickname || '', win: 0, draw: 0, loss: 0, pts: 0, golds: 0, silvers: 0, bronzes: 0, prize: 0 });
            }
            const s = ownerMap.get(oid);
            if (matched?.nickname && matched.nickname !== '-' && matched.nickname !== '정일수' && matched.nickname !== 'JK') {
                s.name = matched.nickname;
            }
            s.prize = (s.prize || 0) + amount;

            // 메달 종류 판정 — 준우승 먼저 (우승 키워드 포함되어 있어 충돌)
            if (title.includes('준우승') || title.includes('2위')) {
                s.silvers = (s.silvers || 0) + 1;
            } else if (title.includes('3위')) {
                s.bronzes = (s.bronzes || 0) + 1;
            } else if (title.includes('우승') || title.includes('1위') || title.includes('champion') || title.toLowerCase().includes('champion')) {
                s.golds = (s.golds || 0) + 1;
            }
            // 그 외 키워드(득점왕/도움왕/최우수 등)는 메달엔 안 포함 — prize 합산에만 반영
        });

        // 🛠️ [v4 진단] unmatched ledger 요약 — 매칭 실패한 ledger 가 있으면 명단 미스 문제
        if (typeof window !== 'undefined' && unmatchedSamples.length > 0) {
            console.warn(`[useHistoryRecords] owner 매칭 실패한 ledger 발견 (샘플 ${unmatchedSamples.length}건):`, unmatchedSamples);
            console.warn('   → 명부의 legacyNames 추가, 또는 ledger.ownerId 정규화 필요');
        }

        const sortedOwners = Array.from(ownerMap.values()).sort((a, b) => b.pts - a.pts || b.golds - a.golds || b.win - a.win);
        const sortedTeams = Array.from(teamMap.values()).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
        const sortedPlayers = Array.from(playerMap.values());

        setHistoryData({ owners: sortedOwners, teams: sortedTeams, players: sortedPlayers });
    }, [rawDocs, rawLedgers, owners, seasons, masterTeams]); // 👈 owners + ledger + seasons + masterTeams 변화 시 재계산

    return { historyData, isHistoryLoading };
};