# CLAUDE.md — KeepThis

> 이 문서는 Claude Code가 이 프로젝트에서 작업할 때 따라야 하는 기준이다.
> 최종 업데이트: 2026-08-19 기준 확정 사항 전체 반영.

---

## 0. 가장 먼저 읽을 것

### 0.1 제품명과 브랜드 문구 (확정, 변경 금지)

| 항목 | 값 |
|---|---|
| 제품명 | `KeepThis` |
| 태그라인 | `Edit with AI. Keep the UX you intended.` |
| 카테고리 설명 | `A UX regression guard for AI-powered UI changes.` |

한 줄 소개 (한국어, 문서·발표용):

> AI가 UI를 수정한 뒤, 요청하지 않은 UX까지 함께 바뀌었는지 승인된 Baseline과 근거로 확인하는 가드레일.

표기 규칙:

- 제품명은 `KeepThis`로 붙여 쓰고 대문자 K와 T를 유지한다. `Keep This`, `keepthis`, `Keep-This`로 쓰지 않는다
- manifest의 `name`, README 제목, Side Panel 헤더에 위 표기를 그대로 사용한다
- 코드 식별자에서는 `keepthis` 또는 `keep-this`를 파일명·패키지명 관례에 맞게 사용한다
- 태그라인과 카테고리 설명은 위 원문을 수정하지 않는다. UI에 노출할 때도 그대로 쓴다

### 0.2 구현해야 하는 것 한 문장

Manifest V3 기반 Chrome Extension을 구현한다. 사용자가 현재 웹 화면을 `Baseline`으로 저장하고, Claude Code/Codex 등으로 화면을 수정한 뒤 `Check Changes`를 누르면 **코드가** DOM·레이아웃의 객관적 차이를 계산하고 **Gemini 2.5 Flash가** 그 차이가 사용자의 UX Guardrail과 충돌하는지만 해석한다. 결과는 근거·신뢰도·수정 지침이 포함된 최대 3개 이슈로 보여주며, 사용자는 현재 상태를 새 Baseline으로 `Accept`하거나 결과를 `Ignore`하거나 편집 가능한 `Fix Prompt`를 복사한다.

### 0.3 책임 분리 (절대 위반 금지)

```
Measurement              Interpretation               Decision
Chrome/TypeScript  →     Gemini API            →     User
무엇이 바뀌었는가         그 변화가 의도와 충돌하는가     수용·무시·수정
```

이 제품은 디자인을 채점하거나 초보 디자이너를 가르치는 코치가 **아니다**. AI로 빠르게 수정하는 동안 이전에 합의한 UX가 조용히 무너지는 것을 막는 UX Regression Guard다.

### 0.4 최종 제품 원칙

```
Do not ask AI to decide whether the design is good.
Ask code what changed,
ask AI whether that measured change conflicts with a user-approved guardrail,
and let the user decide what becomes the next baseline.
```

---

## 1. 프로젝트 현황

| 항목 | 값 |
|---|---|
| 형태 | Chrome Extension (Manifest V3) + Side Panel |
| 대상 환경 | `http://localhost/*`, `http://127.0.0.1/*` 전용 |
| 기간 | 기획 8/18~8/19, 구현 5일 규모의 MVP |
| 현재 진행 상황 | **`devlog/` 참고.** 이 표에 날짜별 계획을 적어두지 않는다 — 첫날 세운 예상 일정일 뿐이라 실제 진행과 어긋난다. 실제 작업일 기준 기록은 `devlog/INDEX.md`가 기준 |
| 이름 | `KeepThis` (확정). 이전 가칭 `Intent Guard`는 폐기 |
| UI 언어 | 영어 (D-05) |
| 문서 언어 | 한국어 |

### 1.1 Source of Truth

- 제품 요구사항의 Source of Truth는 Notion PRD다.
  `https://app.notion.com/p/intent-guard-v2-prd-3c15aad5f41380d88d98f7156c605e8d`
- PRD 본문(0~20장)과 결정 로그(21~22장)가 충돌하면 **21~22장을 우선**한다.
- 이 CLAUDE.md는 PRD의 작업용 요약이다. 충돌 시 PRD를 확인하고 사용자에게 보고한다.
- 로컬 `.md` 스냅샷 파일은 최신본이 아닐 수 있다.
- PRD 문서 제목과 URL에는 이전 가칭 `Intent Guard`가 남아 있다. 같은 문서를 가리키므로 다른 프로젝트로 오해하지 않는다. 제품명은 이 문서 0.1절이 기준이다.

---

## 2. 문제 정의와 근거

### 2.1 핵심 Job

> "방금 AI에게 요청한 수정 때문에, 원래 잘 되던 UX가 같이 흔들렸는가?"

CSS 오류나 접근성 위반이 없어도 다음이 조용히 바뀐다.

- Primary action의 우선순위
- 첫 화면에서 보이는 핵심 콘텐츠의 양
- 핵심 콘텐츠와 보조 컨트롤의 상대적 비중
- 탐색 → 미리보기 → 저장 같은 핵심 흐름
- 이전에 만족했던 정보 구조와 계층

### 2.2 이 문제가 구조적이라는 근거 (4단계)

**1단계 · 변화의 범위가 요구의 범위보다 넓다**
Claude Code는 국소 문자열 치환(Edit)과 파일 전수 재작성(Write)을 구분해 쓰고, 구조 변경이 커지면 재작성으로 전환한다. VISTA 벤치마크(2026) 실측: Claude Opus의 파일 수정 중 98.8%가 전수 재작성(rewrite share 0.988), Surgical Diff Score 22.4(최저). patch 지향 Codex 계열(GPT-5.5)은 Surgical 33.6(최고). 오동작이 아니라 설계된 동작이다.

**2단계 · 그 변화는 화면을 보는 것으로 드러나지 않는다**
같은 벤치마크에서 시각 재현도(CLIP)와 동작 정확도(behavior)가 정렬되지 않았다. GPT-5.5는 CLIP 0.853(최고) / behavior 0.283(최저), Opus는 behavior 0.336(최고) / CLIP 0.764.

**3단계 · 사람은 그 변화를 기억으로 잡지 못한다**
change blindness 연구의 설계 제언: 시스템은 변화 감지를 사람의 기억과 주의 과정에 맡기지 말고 전용 변화 감지 도구를 제공해야 한다. AI 프로토타이핑은 이 조건을 그대로 충족한다 — 주의는 방금 요구한 기능에 있고, 화면은 다시 로드되며, 비교 대상 화면은 이미 사라졌다.

**4단계 · 그래서 신뢰가 생기지 않고 검증 부담을 사용자가 떠안는다**
Figma AI 리포트: AI 산출물을 신뢰할 수 있다는 응답 32%, 프로젝트 대부분을 AI로 진행 20%. 싱가포르 정부 디자인 시스템(SGDS)은 디자인 시스템을 AI skill로 제공하고도 최종 인간 검토가 필요했고 버튼·레이아웃·인터랙션 패턴의 이탈을 보고했다.

**아직 검증되지 않은 것**: "전수 재작성된 파일 중 사용자가 원하지 않은 UX 변화가 포함된 비율"은 어떤 자료에도 없다. MVP 사용자 검증이 생산할 1차 데이터다. 이 수치를 추정해서 사실처럼 쓰지 않는다.

### 2.3 경쟁/대체 수단과의 차이

| 도구 | 답하는 질문 | KeepThis가 추가로 답하는 질문 |
|---|---|---|
| F12 / DevTools | DOM·CSS·네트워크가 왜 이렇게 동작하는가 | 이 정상적인 구현 변화가 승인한 UX 우선순위를 훼손했는가 |
| Lighthouse | 성능·접근성·SEO 문제가 있는가 | 기술 점수가 좋아도 핵심 콘텐츠나 Primary action이 밀렸는가 |
| Figma/Visual QA | 구현물이 디자인 명세와 같은가 | 고정 명세가 없을 때, 승인한 실제 상태를 유지하는가 |
| WDQ류 실시간 QA | 현재 화면에서 수정할 이슈가 무엇인가 | 현재 값이 아니라 Baseline 이후의 변화가 어떤 Guardrail과 충돌하는가 |
| 일반 AI Critic | 이 디자인을 어떻게 개선할까 | 보편 취향을 제안하지 않고 사용자가 정한 기준과의 충돌만 판단한다 |
| Claude/Codex | 요청한 코드를 생성·수정한다 | 그 수정의 브라우저 결과가 다른 UX를 퇴행시켰는지 독립적으로 확인한다 |

---

## 3. 확정 결정 (APPROVED — 임의 변경 금지)

| ID | 결정 |
|---|---|
| D-01 | Guardrail Skip 허용. `analysisMode = guardrails.length > 0 ? "intent_check" : "change_summary"` |
| D-02 | `Looks intentional`은 Ignore의 사유값. Baseline 변경은 전역 `Accept current state`만 |
| D-03 | 프로젝트 지침(CLAUDE.md 등) 읽기 MVP 완전 제외 |
| D-04 | Badge 자동 표시 및 실시간 감시 MVP 제외 |
| D-05 | MVP UI 문구는 영어로 통일. 한국어는 MVP 이후 |
| D-06 | `View change`는 P1. MVP DoD 제외 |
| D-07 | routeKey는 `origin + normalized pathname` |
| D-08 | Guardrail 후보는 Baseline 스냅샷에서 **코드가 관찰해** 제시한다. 사용자는 체크박스로 확인만 한다 (2026-08-22 승인, 아래 6.2절) |
| D-09 | 결과 화면은 **첫 화면 영향**을 먼저 보여주고, 측정 수치는 접힌 영역에 근거로 보관한다 (2026-08-22 승인, 아래 4.3절) |

### 3.1 D-01 · analysisMode 분기

```typescript
const analysisMode =
  guardrails.length > 0
    ? "intent_check"
    : "change_summary";
```

| analysisMode | 조건 | 결과 제목 | 표시 내용 | Intent-aware Fix |
|---|---|---|---|---|
| `intent_check` | Guardrail 1개 이상 | `Changes need attention` | Guardrail과 충돌하는 UX regression | 활성 |
| `change_summary` | Guardrail 0개 | `Meaningful changes since baseline` | 객관적 Before/Current 변화 요약만 | 제공 안 함 |

`change_summary` 모드 필수 안내:

```
No guardrails were selected.
These are significant changes, not confirmed UX regressions.
Add guardrails to check them against your intent.

[ Add guardrails ]
```

회복 흐름 (막다른 길 금지):

```
change_summary 결과
→ [ Add guardrails ]
→ Guardrail 추천/직접 입력 후 저장
→ [ Analyze again ]
→ 직전 Current snapshot과 Local Diff를 그대로 재사용해 intent_check로 재분석
→ Intent-aware issue + editable Fix Prompt 활성화
```

`Analyze again`은 페이지를 재수집하지 않는다. 동일 변경을 다른 관점으로 해석하는 것이므로 evidence 수치가 바뀌면 안 된다. Gemini 호출만 1회 추가된다. Guardrail 저장 없이 취소하면 기존 `change_summary` 결과로 돌아오고 결과가 사라지지 않는다.

Fix 기능 자체는 MVP 필수 범위에서 제거되지 않는다. 근거가 생기면 활성화되는 Intent-aware 기능이다.

### 3.2 D-02 · Ignore / Looks intentional / Accept 분리

| 동작 | 위치 | 의미 | Baseline 변경 |
|---|---|---|---|
| Ignore | 이슈 카드 | 이번 결과에서 이 이슈를 숨긴다 | 없음 |
| Looks intentional | Ignore의 사유 선택지 | 실수가 아니라 의도한 변화다 | 없음 |
| Accept current state | 결과 화면 footer | 현재 페이지 전체를 새 기준으로 승인한다 | 있음 |

```
Ignore reason

● Intentional change
○ Not relevant
○ Incorrect finding
```

UI 배치 고정:

```
Issue card
[ Ignore ] [ Fix ]

Results footer
[ Accept current state ]
```

`Accept current state`는 반드시 확인 dialog를 거친다. 본문에 "현재 페이지 전체가 새 Baseline이 되며, 선택한 이슈뿐 아니라 현재 화면의 다른 변화도 포함된다"는 의미가 포함되어야 한다(실제 UI는 영어).

Ignore 사유는 로컬에만 저장하고 이후 Gemini 요청 payload에 포함하지 않는다. AI 학습·fine-tuning에 사용하지 않는다.

### 3.3 D-07 · routeKey 정규화

| 입력 | routeKey | 규칙 |
|---|---|---|
| `http://localhost:3000/discover` | `http://localhost:3000/discover` | 기본 |
| `http://localhost:3000/discover/` | `http://localhost:3000/discover` | trailing slash 제거 |
| `http://localhost:3000/discover?filter=all` | `http://localhost:3000/discover` | query 제외 |
| `http://localhost:3000/discover#results` | `http://localhost:3000/discover` | 일반 anchor 무시 |
| `http://localhost:3000/#/discover` | `http://localhost:3000/#/discover` | SPA hash route 포함 |
| `http://localhost:3000/#!/discover` | `http://localhost:3000/#!/discover` | SPA hash route 포함 |

- hash가 `#/` 또는 `#!/`로 시작하면 SPA route로 보아 routeKey에 포함한다. 그 외 hash는 anchor로 보아 버린다.
- `/discover`와 `/discover?filter=all`은 동일한 페이지 계약과 Guardrail을 공유한다.
- MVP는 pathname당 Baseline 1개만 지원한다.
- origin은 소문자화하고 pathname은 원본 대소문자를 유지한다.
- query별 복수 Baseline과 query-key whitelist는 P1.

query가 다를 때 결과 화면 안내 (이슈 아님, severity·confidence·Fix 없음):

```
Page state changed
The baseline was captured with a different page state.

baseline: ?filter=none
current:  ?filter=all

Some differences may come from this state, not from your edits.
```

query 차이만을 근거로 regression·intent violation·unintended change로 분류하지 않는다.

---

## 4. UI 문구 규칙

### 4.1 절대 금지 (모든 모드)

- 프롬프트 인과 주장 — `This prompt caused...`, `Claude's latest edit broke...`
- 일반 디자인 평가 — 예쁘다, 모던하다, 프로페셔널하다, 트렌디하다, 시니어 디자이너 수준
- 전체 점수 — 예: `72/100`
- `Likely cause` → 대신 `Related changes` 사용
- 프롬프트 추적을 하지 않으므로 `Since last baseline` / `Compared with baseline`만 사용

### 4.2 `change_summary` 모드 추가 금지

- `Unintended change`
- `UX regression`
- `Intent violation`
- `잘못된 변화` 및 동등한 가치 판단 표현

### 4.3 결과 화면 정보 위계 (D-09, 2026-08-22 갱신)

1. **첫 화면 영향** — 코드가 계산한 "무엇이 보이지 않게 됐는가 / 몇 개가 줄었는가"를 맨 앞에 둔다
2. 각 영향의 근거가 되는 Before → Current 수치
3. 연결된 Guardrail과 UX 의미
4. Confidence와 제한 사항
5. **측정된 변화 전체 (기본 접힘)** — 원본 diff 항목과 변화 서술문. 삭제하지 않고 한 번의 클릭 뒤에 보관한다
6. View change (P1)
7. Fix (secondary action)

**갱신 배경**: 원래 위계는 "변화 요약"(예: "카테고리 바가 추가되어 57.5px 밀림")을 맨 앞에 뒀는데,
이건 사실이지 사용자가 판단할 수 있는 형태가 아니다. 코드는 이미 더 중요한 걸 계산해두고 있었다 —
fold 이탈 여부, 보이는 콘텐츠 수 변화, 첫 화면 컨트롤 수 변화. 이걸 앞세우고 픽셀 수치는 근거로
내린다. 다만 수치를 **버리지는 않는다**: 근거를 확인할 수 없으면 신뢰가 떨어지므로 접힌 영역에
그대로 유지한다.

이 재배치는 해석이 아니라 **측정값의 재서술**이다(0.3절 책임 분리 유지). 따라서 문구는 중립적이어야
하고 `change_summary` 모드에서도 그대로 쓸 수 있어야 한다(4.2절 금지 표현 준수).

`Fix`를 primary CTA로 크게 배치하거나 별도 Prompt 작성 페이지를 만들지 않는다.

---

## 5. 데이터 계약 (가장 먼저 구현)

```typescript
type RouteInfo = {
  routeKey: string;      // origin + normalized pathname (+ SPA hash route)
  fullUrl: string;       // 원본 URL 전체
  query: string | null;  // 정규화 전 query string
  hash: string | null;   // 정규화 전 hash
};

type Guardrail = {
  id: string;
  statement: string;           // "Reference content stays dominant"
  priority: "must" | "should";
  evidenceTypes: Array<"position" | "visibility" | "count" | "flow" | "visual">;
  scope: "route";
  enabled: boolean;
  source: "ai_suggested" | "user_written";   // 이 두 값만 허용
};

type BaselineRecord = {
  schemaVersion: 1;
  baselineId: string;
  route: RouteInfo;
  createdAt: string;
  screenshot: {
    mimeType: "image/jpeg";
    dataUrl: string;
    width: number;
    height: number;
  };
  snapshot: PageSnapshot;
  guardrails: Guardrail[];
};

type AiAnalysis = {
  analysisMode: "intent_check" | "change_summary";
  analysisStatus: "ok" | "insufficient_evidence";
  summary: string;
  issues: Array<{
    id: string;
    severity: "high" | "medium" | "low";
    title: string;
    evidence: Array<{
      evidenceId: string;   // local diff의 실제 id 또는 visual evidence id
      source: "dom" | "layout" | "visual";
      statement: string;
      before?: string;
      current?: string;
      delta?: string;
    }>;
    guardrailId: string | null;   // change_summary 모드에서는 null
    guardrail: string | null;     // change_summary 모드에서는 null
    whyItMatters: string;
    confidence: "high" | "medium" | "low";
    confidenceReason: string;
    fixInstruction: string;
  }>;
  preserved: Array<{
    guardrailId: string;
    statement: string;
    evidenceIds: string[];
  }>;
  insufficientEvidenceReasons: string[];
};
```

`PageSnapshot`과 `LocalDiff`는 아래 6장·7장 기준으로 정의한다.

### 5.1 JSON Schema 규칙

- `issues.maxItems = 3`
- 모든 이슈에 `evidence`, `confidence` 필수
- `intent_check` 모드에서만 `guardrailId`와 `fixInstruction`이 필수. `change_summary`에서는 `guardrailId`가 null이고 `fixInstruction`을 생성하지 않는다
- `analysisMode`는 로컬에서 계산해 prompt에 전달한다. 응답이 다른 값을 돌려주면 schema 오류로 처리한다
- `additionalProperties: false`를 가능한 범위에서 사용
- schema를 불필요하게 깊게 만들지 않는다
- parsing/schema 실패 시 한 번만 repair 재요청하거나 실패 상태와 Retry를 보여준다. **임의로 UI 데이터를 보정해 사실처럼 표시하지 않는다**

---

## 6. Baseline 저장 항목

| 항목 | 상세 |
|---|---|
| Screenshot | 현재 보이는 viewport, 압축 JPEG/WebP. full-page 캡처 아님 |
| RouteInfo | 위 D-07 규칙 |
| Viewport | width, height, devicePixelRatio, scrollX/Y |
| Timestamp/version | baselineId, createdAt, schemaVersion |
| Semantic DOM snapshot | landmark, heading, button/link/form, 주요 section/card 후보 |
| Element identity | `data-testid` → stable id → role+accessible name → 구조 경로/텍스트 hash 순서의 fingerprint |
| Geometry | `getBoundingClientRect()`의 x/y/width/height, viewport 내 노출률 |
| Visibility | computed visibility/display/opacity, viewport intersection |
| Interaction summary | button/link/input 수, CTA 후보, nav 항목 |
| Content hierarchy | h1–h6, landmark/section 순서, first viewport의 주요 영역 |
| Readiness signals | `document.readyState`, skeleton/aria-busy 후보, 주요 노드 수 |

**저장하지 않는 것**: input 값, password, hidden text, script/style, data attribute 원문 전체. 텍스트는 accessible name과 짧은 정규화 문자열/해시로 제한한다.

### 6.1 Guardrail 규칙

- Baseline 저장은 Guardrail 작성 때문에 막히지 않는다
- AI 추천은 최대 3개
- 사용자는 선택 해제·수정·직접 추가 가능
- 추상적 미적 형용사 대신 관찰 가능한 관계로 쓴다
- 추천 API가 실패해도 Baseline은 저장되며 정적 예시/수동 입력으로 계속할 수 있다
- Skip 허용 (D-01)

좋은 예:
- 첫 viewport에서 레퍼런스 콘텐츠가 필터보다 더 많은 영역을 차지한다
- `Save` 행동은 스크롤 없이 도달 가능하거나 기존보다 접근성이 낮아지지 않는다
- 추천 기능을 추가해도 `Browse → Preview → Save` 흐름은 유지한다

나쁜 예: 더 예쁘고 프로페셔널해야 한다 / 트렌디해야 한다 / 시니어 디자이너 수준이어야 한다

### 6.2 Guardrail 후보는 코드가 관찰한다 (D-08, 2026-08-22 승인)

Guardrail 후보는 Gemini 추천이 아니라 **방금 캡처한 Baseline 스냅샷에서 코드가 직접 계산**한다.
`src/diff/observe-baseline.ts`가 유일한 생성 지점이다.

**배경**: 빈 칸에 Guardrail을 쓰라는 건 "앞으로 어떤 AI 수정이 뭘 망가뜨릴지"를 예측하라는 요구인데,
사용자가 그걸 가장 모르는 시점에 묻는 것이었다. 그래서 대부분 Skip하게 되고, Skip하면
`change_summary` 모드로 떨어져 제품의 차별점(승인한 기준과의 충돌 판단)을 한 번도 못 보게 된다.
관찰 기반 후보는 이 순서를 뒤집는다 — 코드가 "지금 이미 관찰되는 사실"을 문장으로 제시하고
사용자는 한 번 탭으로 확인만 한다.

규칙:
- 모든 후보 문장은 **관찰 가능**해야 한다 (6.1절 원칙 그대로). 미적 판단 금지
- 후보를 만든 측정 기준과, 나중에 Check Changes가 그 Guardrail을 검사할 측정 기준이 **반드시 같아야**
  한다. 두 파일이 "컨트롤"의 정의에 대해 서로 다르게 판단하면 실제로 안 바뀐 것이 위반으로 잡힌다.
  이 때문에 `observe-baseline.ts`와 `compute-diff.ts`는 `src/diff/element-predicates.ts` 하나를 공유한다
- 상위 2개만 기본 선택 상태로 제시하고 나머지는 해제 상태로 제안한다
- 사용자가 **체크를 남긴 것만** Guardrail이 된다. 확인하지 않은 관찰은 제안일 뿐 저장하지 않는다
- `source`는 `user_written`을 유지한다 — AI가 관여하지 않았고, 그 문장이 지켜져야 한다고 주장하는 주체는
  사용자다. 코드는 문장을 초안했을 뿐이다 (AC-06의 두 값 제약 유지)
- 관찰할 게 없는 페이지에서는 빈 배열을 반환하고, 시트는 기존처럼 수동 입력으로 진행한다
  (6.1절 "Baseline 저장은 Guardrail 작성 때문에 막히지 않는다")

Gemini 기반 `recommendGuardrails`는 코드에 남아 있으나 이 시트에서 자동 호출하지 않는다.

저장 직후 bottom sheet:

```
Baseline saved
This is what is true of the page right now.
Keep the ones that must stay true.

[✓] "Cart" stays reachable without scrolling
[✓] At least 8 main content items stay visible without scrolling
[ ] The first screen keeps at most 3 controls

[ Add your own ]                        [ Done ]
```

---

## 7. Hybrid Diff Engine

### 7.1 원칙

AI에게 좌표와 개수를 추측하게 하지 않는다. 코드가 비교 가능한 사실을 먼저 계산하고, AI는 그 사실이 Guardrail과 충돌하는지만 해석한다.

### 7.2 Element matching 우선순위

1. 안정적인 `data-testid`/명시 식별자
2. 유일하고 동적이지 않은 `id`
3. role + accessible name
4. tag + 가까운 landmark/heading + 정규화 text hash
5. 제한된 구조 경로와 geometry 유사도

매칭 신뢰도가 낮으면 evidence에 `matchConfidence`를 기록하고 AI confidence 상한을 낮춘다.

### 7.3 코드가 계산할 것

- 요소/section/landmark 추가·삭제
- 주요 요소 x/y 이동량과 viewport 대비 비율
- width/height/area 변화
- first viewport 진입/이탈
- 노출 카드·이미지·CTA·interactive element 수 변화
- heading/section 순서 변화
- primary CTA 후보의 visibility와 위치 변화
- fixed/sticky overlay가 핵심 콘텐츠를 가리는지
- Baseline 대비 viewport mismatch
- readiness/누락 영역 이상

```json
{
  "routeKey": "http://localhost:3000/discover",
  "viewport": {
    "baseline": { "width": 1440, "height": 900 },
    "current": { "width": 1440, "height": 900 },
    "comparable": true
  },
  "changes": [
    {
      "kind": "position",
      "element": "reference-grid",
      "before": { "top": 214 },
      "current": { "top": 686 },
      "delta": { "top": 472 },
      "matchConfidence": "high"
    },
    {
      "kind": "visible_count",
      "element": "reference-card",
      "before": 8,
      "current": 2,
      "delta": -6
    },
    {
      "kind": "interactive_count",
      "scope": "first_viewport",
      "before": 3,
      "current": 9,
      "delta": 6
    }
  ]
}
```

Threshold는 오류 판정이 아니다. AI에 보낼 후보 변화의 양을 줄이는 신호다. 8px 이동을 무조건 regression으로 판정하지 말고, viewport 대비 큰 이동·fold 이탈·Guardrail 관련 요소 변화를 우선한다.

---

## 8. Gemini Flash 연동

### 8.1 기본 사항

- 기본 모델은 `src/storage/settings-repository.ts`의 `DEFAULT_GEMINI_MODEL` 한 곳에서만 정의한다(상수로 여기저기 박지 않음). 최초 구현 시 `gemini-2.5-flash`였으나, 2026-08-21 실제 API 호출에서 "This model models/gemini-2.5-flash is no longer available to new users." 404 오류로 확인되어 `gemini-3.6-flash`로 교체함(devlog day4 참고). 모델명이 다시 바뀌어도 이 절 본문을 매번 갱신할 필요는 없다 — 코드의 상수 위치가 기준이다
- API 호출은 content script나 대상 페이지가 아니라 **service worker에서만** 수행한다
- endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- 두 screenshot을 inline image part로 넣고 전체 payload 20MB 미만 유지
- `generationConfig.responseMimeType = "application/json"` + `responseJsonSchema`
- timeout, `429`, `5xx`, offline, invalid key를 구분한다
- `429`는 즉시 반복 호출하지 않고 사용자 주도 Retry와 간단한 backoff 사용
- 무료 티어를 SLA처럼 보장하지 않는다. 구현 당일 실제 quota를 확인한다

### 8.2 입력 순서

1. System/analysis rules
2. Guardrails
3. Local Diff JSON
4. Baseline screenshot (`BASELINE` 라벨)
5. Current screenshot (`CURRENT` 라벨)
6. Required output schema

### 8.3 프롬프트 계약 (원문 유지)

```
You are an evidence-constrained UX regression interpreter.

Determine only whether measured changes conflict with the user's guardrails.
Do not judge whether the interface is beautiful, modern, professional, trendy,
or generally well designed. Do not invent pixel values, DOM states, user intent,
or causal prompts. Prefer supplied DOM/layout evidence over visual inference.

Every issue must cite at least one supplied evidence item and one guardrail.
If evidence is visual-only, confidence cannot be high.
If the page appears incomplete, viewports are not comparable, or evidence is
insufficient, return analysisStatus="insufficient_evidence" instead of forcing
an issue. Return at most 3 issues, ordered by user impact.

Fix instructions must preserve explicitly new functionality where possible and
state what to keep, reduce/move, preserve, and not remove.
```

### 8.4 Severity와 Confidence

Severity는 UX 영향, Confidence는 근거의 강도다. **섞지 않는다.**

| Confidence | 조건 |
|---|---|
| High | 안정적으로 매칭된 DOM/layout 수치 2개 이상이 동일 Guardrail 충돌을 지지 |
| Medium | 객관적 수치 1개 + 일관된 시각 근거, 또는 일부 매칭 불확실성 |
| Low | visual-only 해석, 추상적 원칙, 동적 콘텐츠/viewport 영향 가능 |

High severity / Low confidence 조합도 가능하며, 이 경우 단정 문구 대신 확인 요청을 보여준다.

### 8.5 AI가 답하지 않는 질문

- 이 UI는 좋은 디자인인가
- 더 현대적/프로페셔널/예쁜가
- 시니어 디자이너 수준인가
- 이 산업의 표준 UX는 무엇인가
- 어떤 프롬프트가 원인이었는가 (추적 데이터가 없음)

근거가 없으면 이렇게 실패해야 한다:

```json
{
  "analysisStatus": "insufficient_evidence",
  "summary": "The current page is not comparable with the baseline.",
  "issues": [],
  "preserved": [],
  "insufficientEvidenceReasons": [
    "Major regions are still loading.",
    "The primary reference grid is missing from the current snapshot."
  ]
}
```

### 8.6 BYOK 보안 원칙

- 개발자 본인의 공용 API key를 extension source에 포함하지 않는다
- `chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })`로 content script 접근을 차단한다
- key를 DOM, React state 장기 로그, content script message payload, analytics에 넣지 않는다
- service worker의 Gemini client만 key를 읽는다
- UI에서 마지막 4자리 외 마스킹, `Delete key` 제공
- **"암호화 보관"이라고 주장하지 않는다.** `storage.local`에 평문으로 존재할 수 있다
- 전송 직전 무료 티어 데이터 경고를 다시 보여준다 (영어 UI)

경고 의미 기준: 분석 시 현재 viewport와 Baseline 이미지, 축약된 DOM/layout diff, Guardrails가 Google Gemini API로 전송된다. 무료 서비스에서는 제출 내용이 제품 개선에 사용될 수 있으므로 회사 비공개 화면, NDA 자료, 개인정보가 있는 페이지에는 사용하지 않도록 안내한다.

---

## 9. 기술 구조

### 9.1 스택

- Chrome Extension Manifest V3
- React + TypeScript
- Vite 기반 빌드 (기존 프로젝트가 있으면 기존 구조 우선)
- Zod 또는 동등한 runtime schema validator
- 테스트: Vitest 등 현재 프로젝트와 호환되는 최소 단위 테스트 도구
- 스타일: 경량 CSS/Tailwind 중 기존 환경 우선. **기능 검증이 시각 polish보다 우선**

### 9.2 구성요소

```
┌──────────── Target page (localhost) ────────────┐
│ Content Script                                 │
│  ├─ semantic DOM extraction                    │
│  ├─ getBoundingClientRect / visibility         │
│  ├─ viewport & readiness                       │
│  └─ returns sanitized Snapshot                 │
└───────────────────┬────────────────────────────┘
                    │ chrome.runtime messaging
┌───────────────────▼────────────────────────────┐
│ MV3 Extension Service Worker                   │
│  ├─ captureVisibleTab                          │
│  ├─ snapshot orchestration                     │
│  ├─ local diff engine                          │
│  ├─ storage repository                         │
│  ├─ Gemini client (key never sent to page)     │
│  └─ result/schema validation                   │
└──────────────┬──────────────────┬───────────────┘
       chrome.storage.local       │ messages
               │                  │
       Baseline/Settings      ┌────▼──────────────┐
                              │ React Side Panel  │
                              └───────────────────┘
```

### 9.3 권장 디렉터리 (기존 구조가 있으면 재생성 금지)

```
src/
  background/
    service-worker.ts
    gemini-client.ts
    snapshot-orchestrator.ts
  content/
    content-script.ts
    extract-snapshot.ts
    readiness.ts
  sidepanel/
    App.tsx
    screens/
    components/
  shared/
    types.ts
    schemas.ts
    route-key.ts
  diff/
    match-elements.ts
    compute-diff.ts
    thresholds.ts
  storage/
    baseline-repository.ts
    settings-repository.ts
manifest.json
demo/
  baseline-state/
  changed-state/
```

### 9.4 Manifest

```json
{
  "manifest_version": 3,
  "name": "KeepThis",
  "description": "A UX regression guard for AI-powered UI changes.",
  "permissions": ["sidePanel", "storage", "scripting", "activeTab"],
  "host_permissions": ["<all_urls>"],
  "background": { "service_worker": "service-worker.js", "type": "module" },
  "side_panel": { "default_path": "sidepanel.html" }
}
```

`host_permissions`는 `<all_urls>`다 (APPROVED, 2026-08-21 트러블슈팅 — devlog day4 참고). 원래는
`http://localhost/*`, `http://127.0.0.1/*`, Gemini 엔드포인트만 좁게 선언했으나, Side Panel에서
트리거되는 `chrome.tabs.captureVisibleTab`이 `activeTab`을 정상적으로 못 받는 크롬 플랫폼 자체의
제약(문서화된 버그) 때문에 `<all_urls>` 없이는 스크린샷 캡처가 동작하지 않는다는 게 실제 브라우저
검증 중 확인됐다. 이 변경으로 넓어진 건 **매니페스트 권한**뿐이다 — 실제 동작 범위는
`src/shared/route-key.ts`의 `isSupportedRoute()`가 코드 레벨에서 그대로 localhost/127.0.0.1(http)로
제한한다. `file://` host permission과 파일 읽기 권한은 여전히 넣지 않는다(D-03).

### 9.5 저장 제약

`chrome.storage.local` 기본 quota 10MB.

- screenshot은 viewport 한 장만 저장하고 JPEG/WebP로 축소·압축
- route당 Baseline 1개만 유지
- 저장 전 `getBytesInUse` 또는 직렬화 크기로 quota 점검
- quota 초과 시 기존 Baseline을 먼저 삭제하지 말고 저장을 중단
- 5일 MVP에서 history는 만들지 않는다

### 9.6 Side Panel 상태

1. **No Baseline** — 현재 URL, `Set as Baseline`, API 설정 진입
2. **Baseline Ready** — 저장 시점, Guardrails, `Check Changes`, Baseline 미리보기
3. **Analyzing** — snapshot/diff/API 단계와 취소·재시도
4. **Results** — 최대 3개 이슈, 보존된 항목, Accept/Ignore/Fix

Results 안에서 `Add guardrails` 편집기가 열리는 경로는 Results의 하위 상태로 처리한다.

설정 화면: Gemini API Key 입력/교체/삭제, 모델 ID, 무료 티어 주의 동의, 분석 대상 도메인 안내.

### 9.7 흐름·뎁스 최소화 결정 (APPROVED)

MV3 확장은 로컬 CLI(Claude Code 등)를 직접 실행하거나 프롬프트를 자동 입력할 수 없다(D-03·12.3 그대로 유지). 아래는 그 제약 안에서 뎁스를 줄이는 결정이다.

- **No Baseline 화면 인라인 API 키 입력**: API 키가 없으면 별도 Settings 화면으로 이동하지 않고, No Baseline 화면 안에 키 입력 필드를 바로 노출한다. Settings 화면 자체는 유지하되(교체·삭제용), 최초 설정 시의 화면 왕복 한 단계를 없앤다.
- **Fix Prompt Copy 직후 다음 행동 안내**: `Copy prompt` 클릭 시 다음에 뭘 해야 하는지 알려주는 짧은 확인 문구를 표시한다. 사용자마다 쓰는 외부 AI 도구가 다를 수 있으므로 특정 도구명(Claude Code 등)을 문구에 박지 않는다. 정확한 문구는 8단계 UI 작업 시 확정한다.
- **Side Panel 탭별 상태 유지**: Results 화면에서 Fix 등으로 다른 탭/앱으로 전환했다가 돌아와도 화면 상태가 초기화되지 않아야 한다. 외부에서 수정을 적용하고 돌아왔을 때 `Check Changes` 한 번의 클릭으로 재검증할 수 있어야 한다 — 화면 구현 시 지켜야 할 제약으로, 별도 저장 로직 추가가 필요한 것은 아니다.

---

## 10. 기능 요구사항

| ID | 요구사항 | 우선순위 | 수용 기준 |
|---|---|---|---|
| FR-01 | Side Panel 열기 | P0 | 현재 탭 옆에서 지속적으로 UI가 열린다 |
| FR-02 | Baseline 저장 | P0 | screenshot+snapshot+metadata가 동일 baselineId로 저장된다 |
| FR-03 | Guardrail 추천/편집 | P0 | 최대 3개 추천, 선택·수정·직접 추가 가능; API 실패 시 수동 진행 가능 |
| FR-04 | Current snapshot 수집 | P0 | Baseline과 동일 schema로 수집된다 |
| FR-05 | Local DOM/Layout Diff | P0 | 추가·삭제·이동·크기·가시성·fold·interaction count가 구조화된다 |
| FR-06 | Gemini multimodal 분석 | P0 | 두 screenshot, diff, guardrail을 보내고 schema-valid JSON을 받는다 |
| FR-07 | 결과 카드 | P0 | 최대 3개 이슈에 severity/evidence/guardrail/confidence 표시 |
| FR-08 | Fix Prompt 편집/복사 | P0 | **Guardrail 1개 이상이고 Intent-aware issue가 생성된 경우** editable Fix Prompt와 Copy 제공. `change_summary`에서는 이슈 단위 Fix 미제공 |
| FR-09 | Accept → 새 Baseline | P0 | 현재 상태가 Baseline으로 교체되고 다음 비교가 이를 사용한다 |
| FR-10 | Ignore | P0 | 해당 결과만 숨기며 Baseline 불변. **사유 3개 중 하나 선택** |
| FR-11 | Insufficient evidence 방어 | P0 | 불완전 화면에서 강제 평가하지 않고 Retry/visible-only 제공 |
| FR-12 | BYOK 설정 | P0 | key 저장·검증·교체·삭제와 데이터 경고 동작 |
| FR-13 | Error recovery | P0 | quota/rate/network/schema 오류에서 데이터 손상 없이 재시도 가능 |
| FR-14 | Before/Current preview (`View change`) | **P1** | MVP DoD 제외. P0가 Day 4 이전 완성 시에만 썸네일+토글까지 |
| FR-15 | Ignore reason 기록 | P1 | 선택 사유를 로컬 저장하고 분석에는 사용하지 않는다 |
| FR-16 | analysisMode 분기 | P0 | 로컬에서 결정. 결과 제목·허용 표현·Fix 활성화가 모드에 따라 달라진다 |
| FR-17 | Accept 확인 dialog | P0 | 실행 전 페이지 전체가 새 Baseline이 된다는 확인을 거친다 |
| FR-18 | Badge | P1 | 수동 Check 후에만 표시. MVP 제외 |
| FR-19 | Guardrail 추가 후 재분석 | P0 | `Add guardrails` → `Analyze again`으로 동일 변경이 `intent_check`로 재분석된다 |

---

## 11. 실패 방어

### 11.1 중단 또는 제한 조건

- Baseline이 없는 route
- baseline과 current viewport가 크게 다름
- `document.readyState !== "complete"`
- `aria-busy=true`, skeleton 후보 다수, 주요 영역 급감
- content script 접근 불가 페이지
- screenshot capture 실패
- 저장 quota 초과
- Gemini key 없음/무효
- network timeout / 429 / 5xx
- JSON schema validation 실패

### 11.2 사용자에게 보여줄 형태

```
Intent evaluation unavailable

The page is still loading and several major UI regions are missing.
Comparing it now could create false regressions.

[ Retry ]  [ Analyze visible elements only ]
```

`Analyze visible elements only` 선택 시 결과 전체를 `Limited analysis`로 표시하고 confidence 상한을 `Low`로 제한한다.

**어떤 오류에서도 기존 Baseline을 삭제하거나 덮어쓰지 않는다.**

---

## 12. MVP 범위

### 12.1 필수 구현

Manifest V3 Extension / React·TypeScript Side Panel / localhost·127.0.0.1 / BYOK key 설정·검증·삭제 / Set as Baseline / viewport screenshot 저장 / sanitized DOM·layout snapshot / Guardrail 최대 3개 추천·편집·저장 / Local Diff Engine / `Check Changes` / Gemini 실제 multimodal 요청 / structured JSON + runtime validation / 최대 3개 결과 카드 + preserved / confidence·insufficient evidence 방어 / Ignore / editable Fix Prompt + Copy / Accept → 새 Baseline / 정상·실패 데모용 localhost 샘플 화면 / README

### 12.2 Mock 허용

- API 장애 시 사용할 Guardrail fallback 예시
- demo 페이지 상태 전환용 데이터
- 사용자 테스트 기록 UI가 필요한 경우 정적 샘플

**핵심 분석 결과는 정상 데모에서 실제 Gemini API 호출로 동작해야 한다.**

### 12.3 명시적 제외 (구현 금지)

- Claude/Codex 프롬프트 자동 추적, Prompt Drift 타임라인
- Git/IDE/CLI integration
- Figma/reference crawling
- 자동 코드 수정, 자동 프롬프트 입력
- 전체 페이지 스크롤 캡처
- 다중 route 동시 분석, baseline history
- 로그인, 팀, 협업, 서버, 결제
- Chrome Web Store 배포
- 범용 웹사이트/민감 페이지 지원
- AI 모델 학습/fine-tuning
- 접근성·성능·SEO·일반 디자인 점수
- on-device Gemini Nano
- 프로젝트 지침(`CLAUDE.md`, `README.md`, `design-system.md`) 자동 탐색·읽기
- 로컬 파일 접근 권한, Native Messaging, companion app, guideline import 화면
- MutationObserver 상시 감시, background polling, 자동 Gemini 호출, 자동 Badge 갱신
- `View change`의 overlay, 비교 slider, pixel diff, bounding box

---

## 13. Acceptance Criteria

### AC-01 · analysisMode
- Guardrail 1개 이상 enabled → `analysisMode === "intent_check"`
- enabled 0개 → `analysisMode === "change_summary"`
- `analysisMode`는 로컬 계산값. 응답이 다른 값을 반환하면 schema 오류 처리하고 결과를 표시하지 않는다
- Guardrail을 모두 비활성화 후 재Check하면 모드가 바뀐다

### AC-02 · change_summary 표현
- 제목이 `Meaningful changes since baseline`
- 본문에 `regression`, `unintended`, `intent violation`, `wrong` 동등 표현 없음
- 각 항목은 Before/Current/Delta 수치만 표시
- `Add guardrails` 진입점 표시
- 이슈 단위 `Fix` 버튼 미노출
- `Add guardrails` → 최소 1개 저장 → `Analyze again`으로 이어짐
- `Analyze again`은 재수집 없이 직전 snapshot·Diff 재사용. evidence 수치가 직전 결과와 일치
- 재분석 후 모드가 `intent_check`로 바뀌고 Fix Prompt·Copy 제공
- 저장하지 않고 취소하면 기존 결과 화면으로 복귀하며 결과가 사라지지 않음

### AC-03 · intent_check 표현
- 제목이 `Changes need attention`
- 모든 이슈의 `guardrailId`가 저장된 Guardrail 목록에 실재
- 모든 이슈에 최소 1개 `evidenceId`가 있고 Local Diff evidence에 실재
- Guardrail 1개 이상 + Intent-aware issue 생성 시 editable Fix Prompt와 Copy 제공
- Fix drawer textarea 편집 가능, `Copy prompt`가 현재 편집된 문자열을 복사
- `fixInstruction`이 신규 기능 삭제를 요구하지 않고 유지·축소·이동·보존을 구분해 기술

### AC-04 · Ignore
- 사유 선택 UI 표시, 기본값 `Intentional change`
- 사유 3개: `Intentional change`, `Not relevant`, `Incorrect finding`
- 선택 후 해당 카드만 사라짐
- 전후 `baselineId` 동일
- 전후 저장된 Guardrail 배열 동일
- 사유는 로컬 저장, 이후 Gemini payload 미포함

### AC-05 · Accept current state
- footer에만 존재. 이슈 카드에 없음
- 확인 dialog 표시, 본문에 페이지 전체 승인 문장 포함
- 취소 시 `baselineId` 불변
- 승인 시 새 `baselineId` 생성, screenshot·snapshot 교체
- 교체 전부 성공 후에만 이전 Baseline 제거. 도중 실패 시 이전 Baseline 유지
- 갱신 직후 재Check하면 신규 이슈 0개 또는 preserved

### AC-06 · 프로젝트 지침 미접근
- manifest에 `file://` host permission 및 파일 읽기 권한 없음
- Native Messaging 관련 API 호출 없음
- UI에 지침 가져오기 진입점 없음
- Guardrail `source` 값이 `ai_suggested` / `user_written` 두 가지뿐

### AC-07 · 자동 감시 미구현
- `MutationObserver` 상시 감시, background polling(`setInterval`/`chrome.alarms` 기반 자동 분석) 없음
- `Check Changes`를 누르지 않으면 Gemini 호출 없음
- 페이지 이동만으로 API 요청 발생 안 함

### AC-08 · UI 언어
- Side Panel, 설정, 오류 상태, dialog의 모든 노출 문구가 영어
- UI 코드에 하드코딩된 한국어 문자열 없음

### AC-09 · View change 범위
- MVP DoD 체크리스트에 `View change` 없음
- 구현 시 썸네일+토글까지만. overlay·slider·pixel diff·bounding box 없음

### AC-10 · routeKey
- `origin + normalized pathname`만으로 생성
- `/discover`와 `/discover/`가 동일 routeKey
- `/discover`와 `/discover?filter=all`이 동일 routeKey, 같은 Baseline·Guardrail 사용
- `/discover#results`가 `/discover`와 동일 routeKey
- hash가 `#/` 또는 `#!/`로 시작하면 hash route path 포함. `/#/discover`와 `/#/settings`가 서로 다른 routeKey
- Baseline에 `fullUrl`, `query`, `hash`가 정규화 이전 값으로 저장
- query가 다르면 `Page state changed` 안내 표시, baseline/current query 값 병기
- 이 안내는 이슈가 아니며 severity·confidence·Fix 없음
- query만 다르고 Guardrail 관련 evidence 없으면 이슈 0개
- query 차이를 근거로 금지 표현 생성 안 됨
- 하나의 pathname에 저장된 Baseline이 항상 1개

---

## 14. Definition of Done

### Build & install
- [ ] 의존성 설치 후 명시된 명령으로 production build 성공
- [ ] 생성된 폴더를 Chrome `Load unpacked`로 설치 가능
- [ ] Manifest V3 오류 없고 Side Panel 열림

### Baseline
- [ ] localhost의 현재 visible viewport screenshot과 DOM/layout snapshot 저장
- [ ] 자동 저장 항목과 routeKey 확인 가능
- [ ] routeKey가 D-07 정규화 규칙을 따르며 query가 달라도 동일 Baseline을 찾음
- [ ] Baseline과 Current의 query가 다를 때 `Page state changed` 안내 표시
- [ ] Guardrail 추천·편집·저장 동작, 추천 실패 시에도 진행 가능
- [ ] screenshot/quota 실패 시 기존 Baseline 유지

### Check & AI
- [ ] Local Diff Engine이 Current와 Baseline을 비교
- [ ] Gemini에 두 screenshot + diff + Guardrails 전달
- [ ] 응답이 정의된 schema로 validate
- [ ] 이슈 최대 3개, 각각 severity/evidence/guardrail/confidence/fixInstruction 보유
- [ ] 근거 없는 일반 디자인 평가 미노출

### Actions
- [ ] Ignore는 이슈를 숨기지만 Baseline 불변
- [ ] Fix Prompt 편집·복사 가능하며 신규 기능 보존 조건 포함
- [ ] Accept가 현재 상태를 새 Baseline으로 안전하게 갱신
- [ ] Accept 후 재검사 시 새 Baseline 사용
- [ ] `Accept current state`가 확인 dialog를 거치며 취소 시 Baseline 불변
- [ ] Ignore 시 사유 3개 중 선택 가능, 어떤 선택에서도 Baseline·Guardrail 불변
- [ ] Guardrail 0개에서 Check 시 `change_summary` 모드로 동작하고 이슈 단위 Fix 대신 `Add guardrails` 표시
- [ ] `Add guardrails` 후 `Analyze again` 실행 시 `intent_check`로 재분석되고 Fix Prompt 제공
- [ ] `change_summary` 결과에 금지 표현 미출현

### Guardrails & errors
- [ ] loading/incomplete demo에서 `insufficient_evidence` 표시, high-confidence 이슈 미생성
- [ ] invalid key, offline, 429, schema error, unsupported page 상태 구분
- [ ] 어떤 실패에서도 기존 Baseline과 Guardrails 무손상
- [ ] key가 content script/target page/로그에 미출현

### Quality & handoff
- [ ] 핵심 diff/storage/schema unit test 통과
- [ ] typecheck와 production build 통과
- [ ] 정상 사례와 실패 방어 사례가 README 절차대로 재현
- [ ] README에 무료 티어 데이터 주의와 회사/NDA/개인정보 화면 사용 금지 명시
- [ ] 제외 범위를 구현했다고 오해하게 만드는 UI/문서 없음

---

## 15. 작업 순서

1. **Repository audit** — 현재 파일 구조, package manager, build/test 설정을 먼저 확인한다. 기존 코드가 있으면 활용하고 무작정 새 프로젝트를 만들지 않는다. 관련 없는 사용자 변경을 건드리지 않는다.
2. **Shared contracts first** — `PageSnapshot`, `BaselineRecord`, `RouteInfo`, `LocalDiff`, `Guardrail`, `AiAnalysis` 타입과 runtime schema를 먼저 만든다. message action과 error code를 enum/union으로 정의한다.
3. **Extension shell** — MV3 manifest, service worker, Side Panel, localhost 권한 연결. `Load unpacked` 설치 가능하게 한다.
4. **Snapshot pipeline** — sanitized DOM/layout 수집과 `captureVisibleTab`을 하나의 orchestrated operation으로 만든다. 부분 실패 시 저장하지 않는다. deterministic fixture로 unit test.
5. **Storage repository** — routeKey별 Baseline get/set/replace/delete 캡슐화. 원자적 교체와 quota 실패 테스트. API key access level 제한.
6. **Local Diff Engine** — pure function 중심. 정상/추가·삭제/fold 이동/viewport mismatch fixture 테스트. AI 호출 전 사람이 읽을 수 있는 evidence id 부여.
7. **Gemini client** — key/model/payload builder/timeout/error mapping 분리. structured output 후 runtime validation. 실제 secret을 source나 fixture에 커밋하지 않는다.
8. **Side Panel flow** — No Baseline → Saved → Check → Results를 먼저 완성. 이후 Guardrail editor, Ignore, Fix drawer, Copy, Accept 연결. 로딩·빈 상태·오류·insufficient evidence를 정상 결과와 동등하게 구현.
9. **Demo target** — 같은 URL에서 baseline/current/loading 세 상태를 재현할 샘플 페이지. 회귀 수치가 fixture와 실제 DOM에서 일치하게 한다.
10. **Verification and documentation** — typecheck, unit test, production build 실행. clean install부터 두 demo 수동 검증. README 작성.

---

## 16. 구현 원칙

- AI 응답을 신뢰 경계 밖의 입력으로 취급하고 항상 validate한다
- content script는 데이터 수집만 한다. secret·API 호출·제품 판단을 하지 않는다
- UI 문구에서 `detected fact`와 `AI interpretation`을 시각적으로 구분한다
- 한 번에 최대 3개 이슈만 노출한다
- 전체 점수(예: 72/100)를 사용하지 않는다
- 성공 경로만 hard-code한 mock으로 대체하지 않는다
- 구현 편의를 위해 scope를 확장하지 않는다
- 오류가 나면 기존 Baseline을 보존하는 것을 기능 완성보다 우선한다
- **실제로 실행하지 않은 검증을 통과했다고 말하지 않는다**
- Day 5에는 새 기능을 추가하지 않는다

### 16.1 Claude가 스스로 결정할 수 있는 범위

- 승인된 UX를 구현하기 위한 세부 코드 구조
- 이름 충돌이 없는 내부 함수·타입명
- 기존 스타일을 따르는 경미한 UI 정렬
- 명백한 버그 수정
- 요구사항을 바꾸지 않는 테스트·리팩터링

### 16.2 사용자 승인이 필요한 범위

- 제품 정의와 포지셔닝
- MVP 포함·제외 범위
- 핵심 user flow 변경
- 새로운 외부 서비스·API·비용 도입
- 개인정보·보안·데이터 처리 정책
- 위 3장의 확정 결정(D-01~D-07)을 뒤집는 변경

경계가 불분명하면 제품 결정으로 취급하고 사용자에게 선택을 요청한다.

---

## 17. 데모 시나리오

### 17.1 정상 사례

Baseline: reference grid가 y≈214px에서 시작, 첫 viewport에 card 8개, Save 접근 용이.
Guardrails: `Reference content stays dominant`, `Save remains easy to reach`, `Controls remain secondary to content`

수정 후 Current: filters 추가, Trending Collections 추가, grid가 y≈686px로 이동, visible cards 8→2, controls 3→9. **CSS 오류는 없음.**

기대 결과:
```
HIGH · HIGH CONFIDENCE
Primary content lost priority

Evidence
• Reference grid top: 214px → 686px (+472px)
• Visible reference cards: 8 → 2
• Controls in first viewport: 3 → 9

Guardrail
"Reference content stays dominant."

Why it matters
The new filters and recommendation region push the protected content below the fold.

[ Ignore ]  [ Fix ]
```

Fix Prompt는 filter/trending을 삭제하지 않고 footprint를 줄이거나 grid 아래로 옮긴다:
```
Keep the newly added category filters and recommendation feature, but restore
the original content-first browsing priority.

- Reduce the filters' vertical footprint.
- Move Trending Collections below the primary reference grid.
- Keep at least 6 reference cards visible in the initial viewport at 1440×900.
- Preserve the current navigation, color system, and responsive behavior.
- Do not remove the new filters; make them secondary to browsing.
```

### 17.2 실패 방어 사례

Current가 skeleton loading, primary grid 미렌더링, `aria-busy=true`.
→ 회귀를 억지로 생성하지 않고 `Intent evaluation unavailable`과 구체적 이유 표시. `Retry` / `Analyze visible elements only` 제공. visible-only 선택 시 `Limited analysis · Low confidence` 강제. 기존 Baseline 유지.

### 17.3 경쟁 차이 설명 장면

```
Traditional QA / DevTools
"CSS is valid; no implementation error detected."

KeepThis
"The new controls are valid, but they moved the protected reference grid
472px down and reduced visible cards from 8 to 2."
```

---

## 18. 성공 지표 (목표치이며 실측치가 아니다)

| 지표 | 정의 | 초기 목표 |
|---|---|---|
| Time to actionable fix | Check 클릭부터 복사 가능한 수정 프롬프트 확보까지 | 90초 이내 |
| Planted regression detection | 사전에 심은 Guardrail 위반 탐지율 | 정상 시나리오 100% |
| Evidence traceability | 표시된 이슈 중 실제 diff evidence id 보유 비율 | 100% |
| Structured response success | API 성공 응답 중 schema validation 통과율 | 95% 이상 |
| False certainty defense | 불완전 화면에서 high-confidence 판단을 내리지 않는 비율 | 100% |
| Baseline integrity | 실패·quota·API error 후 기존 Baseline 보존 | 100% |
| Concept comprehension | 사용자가 기존 QA와의 차이를 자기 말로 설명 | 5명 중 4명 이상 |

**목표 수치와 실제 측정 수치를 구분해서 표현한다. 측정하지 않은 개선 수치를 만들어내지 않는다.**

---

## 19. 미결 항목 (OPEN)

| 항목 | 상태 |
|---|---|
| pathname 대소문자 처리 | 기본값(origin 소문자화, pathname 원본 유지) 적용 예정. 미승인 |
| Notion PRD 제품명 교체 | PRD 본문의 `Intent Guard` 표기가 아직 남아 있다. CLAUDE.md가 우선 기준 |

미결 항목을 확정 사실처럼 코드나 문서에 반영하지 않는다.

---

## 20. 문서 작성 규칙

- 이 프로젝트 문서에서 `§` 기호를 사용하지 않는다. "PRD 21.7절", "PRD 2장"처럼 한글로 풀어서 쓴다
- `FACT`(확인됨) / `APPROVED`(승인됨) / `PROPOSAL`(미승인 제안) / `INFERENCE`(추론) / `OPEN`(결정 필요)를 구분해서 표기한다
- 추론을 FACT처럼 표현하지 않는다
- AI가 생성한 분석 결과를 실제 사용자 조사 결과처럼 표현하지 않는다

### 20.1 개발 로그 (devlog)

- 파일 단위는 15장의 파이프라인 "단계"가 아니라 **실제 작업일**이다. 하루 안에 여러 단계를 진행해도 새 파일을 만들지 않고 그날의 `devlog/dayN.md`에 `##` 섹션으로 계속 누적한다. 새 작업일이 시작될 때만 다음 번호로 새 파일을 만든다
- 실질적인 개발 작업(코드 작성·테스트·빌드 등 산출물이 있는 작업)이 끝났거나 기획 세부조정이 확정된 경우에만 [devlog/TEMPLATE.md](devlog/TEMPLATE.md) 형식으로 그날의 파일에 자동으로 기록하고, 새 파일을 만들었을 때만 `devlog/INDEX.md`에 한 줄 추가한다. 사용자가 매번 요청하지 않아도 항상 수행한다
- 사용자가 짧게 질문만 하거나, 개발 산출물 없이 세부 논의만 오가거나, 개발 작업이 아닌 요청인 경우에는 자동으로 기록하지 않는다. 대신 devlog에 기록할지 먼저 물어본다
- devlog를 갱신했으면 답변 마지막 줄에 갱신 사실을 알린다
- 원본 대화나 tool 출력을 그대로 옮기지 않는다. 결정·트러블슈팅(문제/원인/해결)·검증 결과만 압축해서 남긴다. 문제가 없었던 작업은 트러블슈팅 섹션을 생략한다
- 코드가 아니라 접근 방식·정책·범위 같은 **기획 세부조정**이 발생하면, 일반 트러블슈팅 형식 대신 "사용자의 요청/의문점"과 "변경 방안"을 구체적으로 남긴다 (TEMPLATE.md의 전용 형식 참고). 이 프로젝트에서 가장 중요하게 취급하는 기록이다
