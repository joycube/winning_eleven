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

        return () => { u1(); uAccounts(); u2(); u3(); u4(); u5(); u6(); };
    }, []);

    /**
     * 🔥 [데이터 통합 마법]
     * 명부 관리 데이터(rawOwners)와 G메일 가입자 데이터(userAccounts)를 결합합니다.
     * 이제 owners 배열 안에 구단주의 닉네임과 UID(8p954v...)가 한 몸이 되어 내려갑니다!
     */
    const owners = useMemo(() => {
        return rawOwners.map(owner => {
            const linkedAccount = userAccounts.find(acc => acc.mappedOwnerId === owner.nickname);
            return {
                ...owner,
                uid: linkedAccount ? linkedAccount.uid : undefined,
            };
        });
    }, [rawOwners, userAccounts]);

    return { seasons, owners, masterTeams, leagues, banners, historyRecords, isLoaded };
};
