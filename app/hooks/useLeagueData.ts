// 🔥 [High 패치 H5] 타이밍 race condition 수정
//   - 기존: seasons 스냅샷 한 개만 도착해도 isLoaded = true → 다른 컬렉션은 빈 배열 상태에서
//           자식 컴포넌트들이 잘못된 owner 매칭/빈 차트를 캐싱하는 문제.
//   - 수정: 7개 컬렉션 각각의 도착 여부를 boolean 으로 추적 → 모두 true 일 때만 isLoaded = true.
//   - 추가: 각 onSnapshot 에 error 콜백 추가 — 권한 거부 등 발생 시 무한 로딩 방지.
import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Season, Owner, League, MasterTeam, Banner } from '../types';

type LoadedFlags = {
    owners: boolean;
    accounts: boolean;
    masterTeams: boolean;
    seasons: boolean;
    banners: boolean;
    leagues: boolean;
    historyRecords: boolean;
};

const INITIAL_FLAGS: LoadedFlags = {
    owners: false,
    accounts: false,
    masterTeams: false,
    seasons: false,
    banners: false,
    leagues: false,
    historyRecords: false,
};

export const useLeagueData = () => {
    const [seasons, setSeasons] = useState<Season[]>([]);
    const [rawOwners, setRawOwners] = useState<Owner[]>([]);
    const [userAccounts, setUserAccounts] = useState<any[]>([]);
    const [masterTeams, setMasterTeams] = useState<MasterTeam[]>([]);
    const [leagues, setLeagues] = useState<League[]>([]);
    const [banners, setBanners] = useState<Banner[]>([]);
    const [historyRecords, setHistoryRecords] = useState<any[]>([]);
    const [loadedFlags, setLoadedFlags] = useState<LoadedFlags>(INITIAL_FLAGS);

    // 모든 컬렉션이 1회 이상 도착했을 때 true
    const isLoaded = useMemo(
        () => Object.values(loadedFlags).every(Boolean),
        [loadedFlags]
    );

    useEffect(() => {
        const markLoaded = (key: keyof LoadedFlags) => {
            setLoadedFlags(prev => (prev[key] ? prev : { ...prev, [key]: true }));
        };

        // 공통 에러 핸들러 — 권한 거부 등으로 실패해도 해당 flag 를 true 로 잡아 무한 로딩 방지
        const onSnapErr = (label: keyof LoadedFlags) => (err: any) => {
            console.error(`[useLeagueData] ${label} snapshot error:`, err);
            markLoaded(label);
        };

        // 🛠️ [UI 픽스 v2] 방어적 타임아웃 — 환경별 분기
        //   - 프로덕션 (Vercel): 30초 — Firestore 가 정상 도착할 시간 충분히 확보 (회귀 방지)
        //   - StackBlitz/webcontainer: 4초 — cross-origin 차단으로 어차피 hang 되므로 빠르게 폴백
        //   - 일반 환경에선 onSnapshot 이 1~2초 안에 도착하므로 timeout 발화 자체가 거의 없음
        const isWebContainerEnv = (() => {
            if (typeof window === 'undefined') return false;
            const host = window.location?.hostname || '';
            let isInIframe = false;
            try { isInIframe = window.self !== window.top; } catch { isInIframe = true; }
            return (
                host.includes('webcontainer.io') ||
                host.includes('stackblitz.io') ||
                host.includes('stackblitz.com') ||
                host.includes('local-credentialless') ||
                (isInIframe && host.includes('local-'))
            );
        })();
        const LOAD_TIMEOUT_MS = isWebContainerEnv ? 4000 : 30000;
        const forceLoadTimer = setTimeout(() => {
            setLoadedFlags(prev => {
                const next = { ...prev };
                let changed = false;
                (Object.keys(next) as (keyof LoadedFlags)[]).forEach(k => {
                    if (!next[k]) { next[k] = true; changed = true; console.warn(`[useLeagueData] ${k} timeout — forcing loaded (env: ${isWebContainerEnv ? 'webcontainer' : 'production'})`); }
                });
                return changed ? next : prev;
            });
        }, LOAD_TIMEOUT_MS);

        // 1. Owners (명부 관리)
        const u1 = onSnapshot(
            query(collection(db, "users"), orderBy("id", "asc")),
            s => {
                setRawOwners(s.docs.map(d => ({ ...d.data(), docId: d.id } as unknown as Owner)));
                markLoaded('owners');
            },
            onSnapErr('owners')
        );

        // G메일 가입자(UID) 데이터
        const uAccounts = onSnapshot(
            collection(db, "user_accounts"),
            s => {
                setUserAccounts(s.docs.map(d => ({ uid: d.id, ...d.data() })));
                markLoaded('accounts');
            },
            onSnapErr('accounts')
        );

        // 2. Master Teams
        const u2 = onSnapshot(
            collection(db, "master_teams"),
            s => {
                setMasterTeams(s.docs.map(d => ({ ...d.data(), docId: d.id } as unknown as MasterTeam)));
                markLoaded('masterTeams');
            },
            onSnapErr('masterTeams')
        );

        // 3. Seasons
        const u3 = onSnapshot(
            query(collection(db, "seasons"), orderBy("id", "desc")),
            s => {
                setSeasons(s.docs.map(doc => doc.data() as Season));
                markLoaded('seasons');
            },
            onSnapErr('seasons')
        );

        // 4. Banners
        const u4 = onSnapshot(
            collection(db, "banners"),
            s => {
                setBanners(s.docs.map(d => ({ ...d.data(), docId: d.id } as unknown as Banner)));
                markLoaded('banners');
            },
            onSnapErr('banners')
        );

        // 5. Leagues
        const u5 = onSnapshot(
            collection(db, "leagues"),
            s => {
                setLeagues(s.docs.map(d => ({ ...d.data(), docId: d.id } as unknown as League)));
                markLoaded('leagues');
            },
            onSnapErr('leagues')
        );

        // 6. History Records
        const u6 = onSnapshot(
            collection(db, "history_records"),
            s => {
                setHistoryRecords(s.docs.map(doc => ({
                    ...doc.data(),
                    seasonId: Number(doc.id),
                })));
                markLoaded('historyRecords');
            },
            onSnapErr('historyRecords')
        );

        return () => {
            clearTimeout(forceLoadTimer);
            u1(); uAccounts(); u2(); u3(); u4(); u5(); u6();
        };
    }, []);

    /**
     * 🔥 [데이터 통합 마법]
     * 명부 관리 데이터(rawOwners)와 G메일 가입자 데이터(userAccounts)를 결합합니다.
     * 이제 owners 배열 안에 구단주의 닉네임과 UID(8p954v...)가 한 몸이 되어 내려갑니다!
     */
    // 🛠️ [UI 픽스 v3] 회귀 진단 + 강력 매칭
    //   - 정규화: trim + 공백/점/하이픈/언더바 제거 + 소문자 (L_PostDetail 와 동일 규칙)
    //   - linkedAccount 매칭 4단계 폴백:
    //       1) acc.uid === owner.uid / owner.docId  (가장 안전)
    //       2) acc.mappedOwnerId === owner.nickname / legacyName / legacyNames[]
    //       3) acc.displayName === owner.nickname / legacyName / legacyNames[]
    //       4) (디버그) 위 어디서도 못 잡으면 마지막에 console.warn 으로 안내
    //   - owner.photo 가 empty string '' 인 경우도 falsy 라 linkedAccount.photoURL 로 자동 폴백됨
    const owners = useMemo(() => {
        const normLoose = (v: any) => String(v ?? '').replace(/[\s\.\-\_]/g, '').toLowerCase();

        const enriched = rawOwners.map(owner => {
            const ownerDocId = String((owner as any).docId ?? '').trim();
            const ownerUid = String((owner as any).uid ?? '').trim();
            const nickN = normLoose((owner as any).nickname);
            const legacyN = normLoose((owner as any).legacyName);
            const legacyArrN = (((owner as any).legacyNames || []) as any[]).map(normLoose).filter(Boolean);

            const linkedAccount = userAccounts.find(acc => {
                if (!acc) return false;
                // 1) uid 직매칭 (handleApprove 로 만들어진 owner 는 docId === firebaseUser.uid)
                const accUid = String(acc.uid ?? '').trim();
                if (accUid && (accUid === ownerUid || accUid === ownerDocId)) return true;
                // 2) mappedOwnerId 매칭
                const mapN = normLoose(acc.mappedOwnerId);
                if (mapN) {
                    if (nickN && mapN === nickN) return true;
                    if (legacyN && mapN === legacyN) return true;
                    if (legacyArrN.includes(mapN)) return true;
                }
                // 3) displayName 매칭 (admin 이 아직 매핑 안 한 PENDING 사용자도 본인 사진은 보이도록)
                const dispN = normLoose(acc.displayName);
                if (dispN) {
                    if (nickN && dispN === nickN) return true;
                    if (legacyN && dispN === legacyN) return true;
                    if (legacyArrN.includes(dispN)) return true;
                }
                return false;
            });

            const ownerPhoto =
                (owner as any).photo
                || (owner as any).profileImage
                || (owner as any).photoUrl
                || (owner as any).photoURL
                || (linkedAccount?.photoURL ?? '')
                || (linkedAccount?.photoUrl ?? '')
                || (linkedAccount?.photo ?? '')
                || '';

            return {
                ...owner,
                uid: linkedAccount ? linkedAccount.uid : ownerUid,
                photo: ownerPhoto,
                photoURL: ownerPhoto,
            } as Owner;
        });

        // 디버그: photo 가 비어있는 owner 가 몇 명인지 한 번만 출력
        if (typeof window !== 'undefined' && enriched.length > 0) {
            const missing = enriched.filter(o => !(o as any).photo);
            if (missing.length > 0) {
                console.warn(
                    `[useLeagueData][v3-diag] photo 없음: ${missing.length}/${enriched.length}명`,
                    missing.slice(0, 5).map(o => ({
                        nickname: (o as any).nickname,
                        docId: (o as any).docId,
                        uid: (o as any).uid,
                        hasLinked: !!userAccounts.find(a => a.uid === (o as any).uid),
                    }))
                );
            }
        }

        return enriched;
    }, [rawOwners, userAccounts]);

    return { seasons, owners, masterTeams, leagues, banners, historyRecords, isLoaded };
};