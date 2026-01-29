# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

---

## Memory System Overview

이 프로젝트는 **Memory Learning System**을 사용합니다.
Claude가 세션을 넘어 지식을 축적하고, 코드베이스와 대화에서 학습한 내용을 영구 저장합니다.

---

## Memory Learning Loop (핵심!)

> **⚠️ 이 섹션은 전체 워크플로우의 핵심입니다. 반드시 숙지하세요.**

### 전체 루프 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    STEP 0: Memory 컨텍스트 확인              │
│  ┌─────────────────┐     ┌─────────────────────────────┐   │
│  │ <memory-context>│     │ <memory-learning-required>  │   │
│  │   (>= 65%)      │     │        (< 65%)              │   │
│  └────────┬────────┘     └──────────────┬──────────────┘   │
│           │                             │                   │
│           ▼                             ▼                   │
│      바로 작업              memory-learner 호출 → 작업      │
└───────────┬─────────────────────────────┬───────────────────┘
            │                             │
            ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    STEP 1: 작업 실행                         │
└───────────────────────────────┬─────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│              STEP 2: Learning Capture (필수!)                │
│                                                             │
│  작업 중 발견한 새 정보/오류 → learnings.md에 기록           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ <memory-flush-suggested> 태그 있으면                 │   │
│  │ → /memory-commit 실행하여 Memory에 반영              │   │
│  └─────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    STEP 3: 응답 완료                         │
│                         ↓                                   │
│                  다음 요청 → STEP 0                          │
└─────────────────────────────────────────────────────────────┘
```

### STEP 0: Hook 태그 확인

| 태그 | 의미 | 동작 |
|------|------|------|
| `<memory-context>` | 유사도 >= 65%, 컨텍스트 충분 | 바로 작업 진행 |
| `<memory-learning-required>` | 유사도 < 65%, Memory 부족 | **memory-learner 호출 필수** |

### STEP 2: Learning Capture 규칙

**작업 중 아래 상황 발생 시 learnings.md에 기록:**

| 상황 | type | 예시 |
|------|------|------|
| 코드베이스에서 새 정보 발견 | `new` | Entity 구조, 비즈니스 로직 |
| 사용자가 오류 지적 | `correction` | "그거 틀렸어" → 올바른 정보 |
| Memory와 코드가 다름 | `outdated` | Memory엔 A, 코드엔 B |
| 사용자가 규칙 설명 | `new` | "우리는 이렇게 해" |

**`<memory-flush-suggested>` 태그가 있으면:**
→ learnings.md에 5개 이상 쌓임
→ `/memory-commit` 실행하여 Memory에 반영 + learnings.md 정리

### memory-learner 호출 방법

```
Task(
  subagent_type="memory-learner",
  prompt="""
  **사용자 요청**: {원본 요청}
  **트리거 이유**: low_similarity | user_feedback | correction
  **키워드**: {요청에서 추출한 키워드}
  """
)
```

### 필수 규칙

1. **`<memory-learning-required>` 태그 발견 시 memory-learner 호출** (예외 없음)
2. **작업 중 새 정보/오류 발견 시 learnings.md에 기록** (Learning Capture)
3. **`<memory-flush-suggested>` 태그 발견 시 /memory-commit 실행**
4. **memory-learner가 반환한 컨텍스트를 작업에 활용**

---

## Memory System 구조

```
.claude/
├── memory/                  # 비즈니스 지식 (벡터화 대상)
│   ├── {domain}/            # 도메인별 폴더
│   │   └── *.md             # 지식 문서
│   └── common/              # 공통 (용어집 등)
│       └── glossary.md
│
├── learnings.md             # 세션 중 학습 임시 저장
│
├── hooks/memory/            # 메모리 시스템 스크립트
│   ├── inject-context.mjs   # 컨텍스트 자동 주입
│   ├── check-learnings.mjs  # Pending 항목 체크
│   ├── search.mjs           # 벡터 검색
│   ├── sync-db.mjs          # DB 동기화
│   └── commit-learnings.mjs # 학습 커밋
│
└── agents/
    ├── memory-learner.md        # Memory 최신화 에이전트
    └── codebase-context-finder.md  # 코드베이스 탐색 에이전트
```

### 명령어

| 명령어 | 설명 |
|--------|------|
| `/memory-search <검색어>` | 메모리에서 관련 컨텍스트 검색 |
| `/memory-commit` | learnings.md 학습 내용을 memory 파일에 병합 |
| `/memory-sync` | memory 폴더와 DB 동기화 |

### 역할 분리

| 구분 | 역할 | 위치 |
|------|------|------|
| **Memory** | 무엇을 (WHAT) - 비즈니스 지식, 용어, 개념 | `.claude/memory/` |
| **Skills** | 어떻게 (HOW) - 테이블 스키마, SQL 패턴, 코드 참조 | `.claude/skills/` |

---

## 세션 중 학습 기록

새로운 비즈니스 지식을 발견하면 `learnings.md`에 기록:

```markdown
### [2026-01-29T10:15:00]
**type**: new
**confidence**: high

#### Content
- 발견한 내용을 여기에 기록

#### Context
어떤 상황에서 발견했는지

---
```

세션 종료 전 `/memory-commit`으로 영구 저장합니다.

---

## Frontend-First 코드베이스 이해

코드베이스를 이해할 때 **UI부터 시작해서 데이터베이스까지 추적**합니다.

```
UI (Frontend) → API (GraphQL/REST) → Service → Entity → Database
```

**왜 Frontend부터인가?**
- UI가 기능의 정의입니다
- 사용자가 보는 것이 곧 요구사항입니다
- 데이터 흐름을 자연스럽게 따라갈 수 있습니다

---

## Database Access

### 환경변수 파일
**파일 위치**: `./.env.ai`

```bash
# 벡터 DB (Memory 저장용)
AI_VECTOR_DB_HOST=localhost
AI_VECTOR_DB_PORT=5432
AI_VECTOR_DB_USER=postgres
AI_VECTOR_DB_PASSWORD=password
AI_VECTOR_DB_NAME=ai_memory

# OpenAI (임베딩용)
OPENAI_API_KEY=sk-...
```

---

## Communication Guidelines

1. **한국어로 소통** - 운영 담당자와의 모든 대화는 한국어
2. **데이터 기반 판단** - 추측보다 실제 데이터 조회 후 판단
3. **새로운 지식 발견 시 기록** - learnings.md에 즉시 기록
