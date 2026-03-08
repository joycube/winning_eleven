import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Season, Owner, League, MasterTeam, Banner } from '../types';

export const useLeagueData = () => {
    const [seasons, setSeasons] = useState<Season[]>([]);
    const [rawOwners, setRawOwners] = useState<Owner[]>([]); // 이름 변경: 결합 전 순수 오너 데이터
    const [userAccounts, setUserAccounts] = useState<any[]>([]); // 🔥 [추가] G메일 연동 계정 데이터
    const [masterTeams, setMasterTeams] = useState<MasterTeam[]>([]);
    const [leagues, setLeagues] = useState<League[]>([]);
    const [banners, setBanners] = useState<Banner[]>([]);
    const [historyRecords, setHistoryRecords] = useState<any[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // 1. Owners (명부 관리)
        const u1 = onSnapshot(query(collection(db, "users"), orderBy("id", "asc")), s => 
            setRawOwners(s.docs.map(d => ({ ...d.data(), docId: d.id } as unknown as Owner)))
        );

        // 🔥 [핵심 추가] G메일 가입자(UID) 데이터 실시간 호출
        const uAccounts = onSnapshot(collection(db, "user_accounts"), s => 
            setUserAccounts(s.docs.map(d => ({ uid: d.id, ...d.data() })))
        );

        // 2. Master Teams
        const u2 = onSnapshot(collection(db, "master_teams"), s => 
            setMasterTeams(s.docs.map(d => ({ ...d.data(), docId: d.id } as unknown as MasterTeam)))
        );

        // 3. Seasons
        const u3 = onSnapshot(query(collection(db, "seasons"), orderBy("id", "desc")), s => { 
            setSeasons(s.docs.map(doc => doc.data() as Season)); 
            setIsLoaded(true);
        });

        // 4. Banners
        const u4 = onSnapshot(collection(db, "banners"), s => 
            setBanners(s.docs.map(d => ({ ...d.data(), docId: d.id } as unknown as Banner)))
        );

        // 5. Leagues
        const u5 = onSnapshot(collection(db, "leagues"), s => 
            setLeagues(s.docs.map(d => ({ ...d.data(), docId: d.id } as unknown as League)))
        );

        // 6. History Records (스냅샷)
        const u6 = onSnapshot(collection(db, "history_records"), s => 
            setHistoryRecords(s.docs.map(doc => ({ 
                ...doc.data(), 
                seasonId: Number(doc.id) 
            })))
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
            // mappedOwnerId(연동된 닉네임)로 계정 정보를 찾습니다.
            const linkedAccount = userAccounts.find(acc => acc.mappedOwnerId === owner.nickname);
            return {
                ...owner,
                uid: linkedAccount ? linkedAccount.uid : undefined // UID를 오너 객체에 쾅! 박아줍니다.
            };
        });
    }, [rawOwners, userAccounts]);

    return { seasons, owners, masterTeams, leagues, banners, historyRecords, isLoaded };
};