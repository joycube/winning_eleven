// app/utils/helpers.ts
// 🔥 [High 패치 v1] 닉네임 변경 통합 헬퍼 (H1) + 중복 검증 (H2) 추가
import { MasterTeam, Owner, FALLBACK_IMG } from '../types';
import { doc, arrayUnion, WriteBatch, Firestore } from 'firebase/firestore';

// ============================================================================
// 🔒 [High 패치 — H1 + H2] 닉네임 변경 통합 헬퍼
// ============================================================================

/**
 * 닉네임을 정규화 (대소문자/공백/특수문자 무시) — 중복 검사용.
 * 예) "Kim. K" → "kimk"
 */
const normalizeNickname = (s?: string | null): string =>
    (s || '').replace(/[\s\.\-\_]/g, '').toLowerCase();

/**
 * 닉네임 사용 가능 여부 검사 (H2).
 * 다른 owner 의 nickname / legacyName / legacyNames 와 충돌하는지 검사.
 * @param owners 전체 owner 목록 (자기 자신 포함 가능)
 * @param newNickname 변경하려는 새 닉네임
 * @param selfDocId 자기 자신의 docId (있으면 검사에서 제외)
 * @returns { ok: true } | { ok: false, conflictWith: string, reason: string }
 */
export const checkNicknameAvailable = (
    owners: Owner[],
    newNickname: string,
    selfDocId?: string | null
): { ok: true } | { ok: false; conflictWith: string; reason: string } => {
    const target = normalizeNickname(newNickname);
    if (!target) return { ok: false, conflictWith: '', reason: '닉네임이 비어 있습니다.' };

    for (const o of owners) {
        if (selfDocId && o.docId === selfDocId) continue;

        if (normalizeNickname(o.nickname) === target) {
            return { ok: false, conflictWith: o.nickname, reason: '다른 구단주의 현재 닉네임과 겹칩니다.' };
        }
        if ((o as any).legacyName && normalizeNickname((o as any).legacyName) === target) {
            return { ok: false, conflictWith: o.nickname, reason: '다른 구단주의 과거 닉네임(legacyName)과 겹칩니다.' };
        }
        const arr: string[] = (o as any).legacyNames || [];
        if (arr.some((n) => normalizeNickname(n) === target)) {
            return { ok: false, conflictWith: o.nickname, reason: '다른 구단주의 과거 닉네임 이력(legacyNames)과 겹칩니다.' };
        }
    }
    return { ok: true };
};

/**
 * 닉네임 변경 시 표준 writes 를 batch 에 추가 (H1).
 * - users/{ownerDocId}.nickname = newNickname
 * - users/{ownerDocId}.legacyNames = arrayUnion(oldNickname)
 * - user_accounts/{accountUid}.mappedOwnerId = newNickname (계정 연동돼 있을 때)
 *
 * 호출 측에서는 자신의 추가 필드(photo / role / favoriteTeamId 등)를 별도로 batch.update 해주면 됨.
 */
export const enqueueNicknameChange = (
    db: Firestore,
    batch: WriteBatch,
    opts: {
        ownerDocId: string;
        accountUid?: string | null;
        newNickname: string;
        oldNickname?: string | null;
    }
): void => {
    const { ownerDocId, accountUid, newNickname, oldNickname } = opts;

    // 1) users/{ownerDocId}.nickname + legacyNames 누적
    const userPayload: any = { nickname: newNickname };
    if (oldNickname && oldNickname !== newNickname) {
        userPayload.legacyNames = arrayUnion(oldNickname);
    }
    batch.update(doc(db, 'users', ownerDocId), userPayload);

    // 2) user_accounts/{accountUid}.mappedOwnerId 동기화 (계정 연동된 경우만)
    if (accountUid) {
        batch.update(doc(db, 'user_accounts', accountUid), { mappedOwnerId: newNickname });
    }
};

// ============================================================================
// 기존 헬퍼들 (변경 없음)
// ============================================================================


// 팀 정렬 및 검색 로직
export const getSortedTeamsLogic = (teams: MasterTeam[], search: string) => {
    let filtered = teams;
    if (search) {
        filtered = teams.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
    }
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
};

// 리그 목록 정렬 (유럽 5대 리그 우선)
export const getSortedLeagues = (leagues: string[]) => {
    const priority = ['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1'];
    return leagues.sort((a, b) => {
        const idxA = priority.indexOf(a);
        const idxB = priority.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });
};

// 티어 뱃지 색상 반환
export const getTierBadgeColor = (tier: string) => {
    switch (tier) {
        case 'S': return 'bg-purple-600 text-white border-purple-400';
        case 'A': return 'bg-emerald-600 text-white border-emerald-400';
        case 'B': return 'bg-blue-600 text-white border-blue-400';
        case 'C': return 'bg-slate-600 text-white border-slate-400';
        case 'D': return 'bg-orange-700 text-white border-orange-500';
        default: return 'bg-slate-800 text-slate-500';
    }
};

// 유튜브 썸네일 추출 함수
export const getYouTubeThumbnail = (url: string) => {
    if (!url) return FALLBACK_IMG;
    const vId = url.includes('youtu.be') 
        ? url.split('/').pop() 
        : url.split('v=')[1]?.split('&')[0];
    return vId ? `https://img.youtube.com/vi/${vId}/mqdefault.jpg` : FALLBACK_IMG;
};
