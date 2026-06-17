// 🛠️ [Finance v4 / P0] finance_ledger 와 Owner 매칭 통합 헬퍼
//
//   배경:
//     finance_ledger.ownerId 가 시기/쓰는 곳마다 다른 식별자로 저장되어 있음.
//     - AdminView 마감 처리 (상금 REVENUE): Firebase UID
//     - useAdminMatching 참가비 EXPENSE: UID 또는 Owner.id (모달이 넘긴 값)
//     - 옛 데이터: 닉네임 / 레거시명 / mappedOwnerId 등 다양
//
//   해결:
//     "한 ledger 가 어떤 owner 의 것인지" 를 묻는 단일 함수.
//     7가지 표기형 모두 시도해서 매칭율 최대화.

export interface LedgerLike {
  ownerId?: string;
  ownerUid?: string;
  [key: string]: any;
}

export interface OwnerLike {
  id?: number | string;
  uid?: string;
  docId?: string;
  nickname?: string;
  legacyName?: string | null;
  legacyNames?: string[];
  mappedOwnerId?: string;
  displayName?: string;
  [key: string]: any;
}

// 🌟 ledger 가 특정 owner 의 것인지 판정
export const isLedgerOfOwner = (ledger: LedgerLike | null | undefined, owner: OwnerLike | null | undefined): boolean => {
    if (!ledger || !owner) return false;
    const ledgerOwnerId = String(ledger.ownerId ?? '').trim();
    const ledgerOwnerUid = String(ledger.ownerUid ?? '').trim();
    if (!ledgerOwnerId && !ledgerOwnerUid) return false;

    // 1) ledger.ownerUid 가 owner.uid 와 일치 (가장 명시적)
    if (ledgerOwnerUid && owner.uid && ledgerOwnerUid === owner.uid) return true;

    if (!ledgerOwnerId) return false;

    // 2) ledger.ownerId 가 owner 의 여러 식별자 중 하나와 일치
    if (owner.uid && owner.uid === ledgerOwnerId) return true;
    if (owner.docId && owner.docId === ledgerOwnerId) return true;
    if (owner.id !== undefined && String(owner.id) === ledgerOwnerId) return true;
    if (owner.nickname && owner.nickname === ledgerOwnerId) return true;
    if (owner.legacyName && owner.legacyName === ledgerOwnerId) return true;
    if (Array.isArray(owner.legacyNames) && owner.legacyNames.includes(ledgerOwnerId)) return true;
    if (owner.mappedOwnerId && owner.mappedOwnerId === ledgerOwnerId) return true;
    if (owner.displayName && owner.displayName === ledgerOwnerId) return true;
    return false;
};

// 🌟 ledger 의 ownerId 가 매핑되는 owner 객체 반환 (없으면 null)
export const resolveOwnerByLedger = (ledger: LedgerLike | null | undefined, owners: OwnerLike[] | null | undefined): OwnerLike | null => {
    if (!ledger || !Array.isArray(owners) || owners.length === 0) return null;
    const ledgerOwnerId = String(ledger.ownerId ?? '').trim();
    const ledgerOwnerUid = String(ledger.ownerUid ?? '').trim();
    if (!ledgerOwnerId && !ledgerOwnerUid) return null;

    // 1) UID 우선
    if (ledgerOwnerUid) {
        const byUid = owners.find(o => o.uid === ledgerOwnerUid);
        if (byUid) return byUid;
    }

    // 2) ownerId 7가지 표기형 순회
    if (ledgerOwnerId) {
        for (const o of owners) {
            if (o.uid && o.uid === ledgerOwnerId) return o;
            if (o.docId && o.docId === ledgerOwnerId) return o;
            if (o.id !== undefined && String(o.id) === ledgerOwnerId) return o;
            if (o.nickname && o.nickname === ledgerOwnerId) return o;
            if (o.legacyName && o.legacyName === ledgerOwnerId) return o;
            if (Array.isArray(o.legacyNames) && o.legacyNames.includes(ledgerOwnerId)) return o;
            if (o.mappedOwnerId && o.mappedOwnerId === ledgerOwnerId) return o;
            if (o.displayName && o.displayName === ledgerOwnerId) return o;
        }
    }

    return null;
};
