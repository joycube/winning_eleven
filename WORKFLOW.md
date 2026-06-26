# 🛠️ 작업 흐름 치트시트 (winning_eleven)

> 코드 수정 → 인터넷 반영까지, 헷갈릴 때 이 파일을 열어보세요.

---

## 📐 전체 구조

```
   [코드 수정]            [GitHub]              [자동 배포]
  StackBlitz  ──push──▶  winning_eleven  ──▶  Vercel (실제 사이트)
   또는 로컬               (중심 허브)         push만 하면 자동!
```

- 저장소: https://github.com/joycube/winning_eleven
- **핵심 원리:** 어디서 수정하든 → GitHub에 **push** → Vercel이 **자동 배포**

---

## 🔑 가장 중요한 규칙 3가지

1. **한 번에 한 곳에서만 수정** (StackBlitz 또는 로컬 — 동시에 X)
2. **열기 전에 pull, 닫기 전에 push** (동기화 사고 방지)
3. **StackBlitz ↔ 로컬은 직접 동기화 안 됨** → 항상 GitHub를 거쳐야 함

---

## ⚠️ 동기화는 자동이 아닙니다

```
StackBlitz  ◀──push/pull──▶  GitHub  ◀──push/pull──▶  로컬
                            (유일한 통로)
```

| 상황 | 해야 할 일 |
|---|---|
| StackBlitz에서 고친 걸 로컬에 반영 | StackBlitz에서 Push → 로컬에서 `git pull` |
| 로컬에서 고친 걸 StackBlitz에 반영 | 로컬에서 `git push` → StackBlitz에서 Pull/새로고침 |

---

## 1️⃣ 코드 수정

### 방법 A — StackBlitz (기존 방식)
1. 브라우저에서 `stackblitz.com/github/joycube/winning_eleven` 열기 (GitHub 최신 자동 로드)
2. 코드 수정
3. **Commit & Push** 버튼 → GitHub 반영

### 방법 B — 로컬 + Claude Code (이 폴더)
1. Claude에게 "○○ 고쳐줘" 요청 → 파일 수정
2. 아래 2️⃣ push 진행

---

## 2️⃣ GitHub에 push (로컬 작업 시)

### 최초 1회 — PAT(토큰) 발급
1. GitHub → 프로필 → **Settings**
2. **Developer settings** → **Personal access tokens** → **Tokens (classic)**
3. **Generate new token** → 권한 **`repo`** 체크 → 만료기간 설정 → 생성
4. 토큰 복사 (한 번만 보임! 메모 필수)

### 매번 — 수정 후
```bash
git pull              # (작업 시작 전) 최신 받기
# ... 코드 수정 ...
git add -A
git commit -m "무엇을 바꿨는지 메모"
git push              # 처음엔 사용자명(joycube) + 비밀번호=토큰 입력
```

> 💡 Claude에게 "올려줘"/"최신 받아줘"라고 하면 대신 해줍니다.

---

## 3️⃣ Vercel 배포 — 자동 (할 일 없음)

- GitHub `main`에 push → Vercel이 감지 → 빌드 → 배포 (1~2분)
- 배포 상태/주소 확인: https://vercel.com 대시보드
- **최초 1회만 확인:** Vercel에 `winning_eleven` 프로젝트가 연결돼 있는지
  - 안 돼 있으면: Vercel → **Add New → Project → winning_eleven import** (1회만)

---

## 📋 한눈에 요약

| 하고 싶은 것 | 무엇을 하면 됨 |
|---|---|
| 코드 고치기 | StackBlitz **또는** 로컬, 한 곳에서만 |
| 인터넷에 반영 | GitHub에 **push** (Vercel 자동) |
| 배포 확인 | vercel.com 대시보드 |
| 다른 기기/StackBlitz 최신화 | GitHub에서 **pull** |
| 작업 시작 전 | 항상 먼저 **pull** |
