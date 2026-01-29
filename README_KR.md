<p align="center">
  <img src="https://img.shields.io/badge/Claude_Code-Memory_System-blueviolet?style=for-the-badge&logo=anthropic" alt="Claude Code Memory System"/>
</p>

<h1 align="center">🧠 Self-Learning AI OS</h1>

<p align="center">
  <strong>Claude Code가 세션을 넘어 학습하고 진화하는 메모리 시스템</strong>
</p>

<p align="center">
  <a href="./README.md">🇺🇸 English</a> | 🇰🇷 한국어
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-how-it-works">How It Works</a> •
  <a href="#-commands">Commands</a> •
  <a href="#-architecture">Architecture</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/PostgreSQL-pgvector-336791?style=flat-square&logo=postgresql" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js" alt="Node.js"/>
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License"/>
</p>

---

## 🤔 Why?

Claude Code는 강력하지만, **세션이 끝나면 모든 컨텍스트가 사라집니다.**

매번 같은 설명을 반복하고 계신가요?

```
You: "우리 프로젝트에서 User는 이렇게 동작하고..."
You: "아 그리고 저번에 말했던 것처럼..."
You: "이거 또 설명해야 하나..."
```

**Self-Learning AI OS**는 Claude가 대화에서 배운 것을 **영구적으로 기억**하게 합니다.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔄 **자동 컨텍스트 주입** | 질문과 관련된 이전 학습 내용을 자동으로 불러옴 |
| 📚 **점진적 학습** | 세션마다 발견한 지식을 축적 |
| 🔍 **Hybrid 검색** | Vector + BM25 결합으로 정확한 검색 |
| 🏷️ **도메인 분리** | 주제별로 지식을 체계적으로 관리 |
| 🤖 **자동 Memory 최신화** | 코드베이스 변경 시 Memory 동기화 제안 |

---

## 🚀 Quick Start

### 1. 프로젝트에 추가

```bash
# 방법 A: 서브모듈로 추가
git submodule add https://github.com/YOUR_USERNAME/selfLearningAiOS.git memory-system
cp -r memory-system/.claude ./

# 방법 B: 클론 후 시작
git clone https://github.com/YOUR_USERNAME/selfLearningAiOS.git my-project
cd my-project
```

### 2. Database 설정

```sql
-- PostgreSQL에서 실행
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE claude_memory (
  id SERIAL PRIMARY KEY,
  file_path VARCHAR(500) NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  content_tsv tsvector,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX ON claude_memory USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON claude_memory USING gin(content_tsv);

-- Full-text search trigger
CREATE OR REPLACE FUNCTION update_content_tsv() RETURNS trigger AS $$
BEGIN
  NEW.content_tsv := to_tsvector('simple', NEW.content);
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER claude_memory_tsv_trigger
  BEFORE INSERT OR UPDATE ON claude_memory
  FOR EACH ROW EXECUTE FUNCTION update_content_tsv();
```

### 3. 환경변수 설정

```bash
# .env.ai 파일 생성
cat > .env.ai << 'EOF'
AI_VECTOR_DB_HOST=localhost
AI_VECTOR_DB_PORT=5432
AI_VECTOR_DB_USER=postgres
AI_VECTOR_DB_PASSWORD=yourpassword
AI_VECTOR_DB_NAME=ai_memory
OPENAI_API_KEY=sk-...
EOF
```

### 4. Dependencies 설치 & 동기화

```bash
cd .claude/hooks/memory
npm init -y && npm install pg dotenv openai
node sync-db.mjs
```

**Done!** 이제 Claude Code와 대화하면 자동으로 학습합니다.

---

## 🔄 How It Works

### 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SELF-LEARNING AI OS                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐                                                            │
│  │    User     │                                                            │
│  │   "재고 관리 │                                                            │
│  │  어떻게 해?" │                                                            │
│  └──────┬──────┘                                                            │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     🪝 HOOK: inject-context.mjs                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  1. 사용자 질문에서 키워드 추출: "재고", "관리"              │   │   │
│  │  │  2. Vector DB에서 Hybrid 검색 (Vector 60% + BM25 40%)       │   │   │
│  │  │  3. 유사도 체크:                                             │   │   │
│  │  │     • >= 65% → <memory-context> 태그로 컨텍스트 주입         │   │   │
│  │  │     • < 65%  → <memory-learning-required> 태그 표시          │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                           │
│                                 ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         🤖 CLAUDE CODE                               │   │
│  │                                                                      │   │
│  │   입력:                                                              │   │
│  │   ┌────────────────────────────────────────────────────────────┐   │   │
│  │   │ <memory-context>                                           │   │   │
│  │   │ # 재고 관리 (85% match)                                    │   │   │
│  │   │ - Stock Entity: warehouses 테이블과 연결                   │   │   │
│  │   │ - 재고 차감: StockService.decrease() 메서드 사용           │   │   │
│  │   │ </memory-context>                                          │   │   │
│  │   │                                                            │   │   │
│  │   │ User: "재고 관리 어떻게 해?"                               │   │   │
│  │   └────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │   작업 중 새로운 정보 발견 시 → learnings.md에 기록                 │   │
│  │                                                                      │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                           │
│                                 ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      📝 learnings.md (임시 저장)                     │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │ ### [2026-01-29T10:15:00]                                   │   │   │
│  │  │ **type**: new                                               │   │   │
│  │  │ **confidence**: high                                        │   │   │
│  │  │                                                             │   │   │
│  │  │ #### Content                                                │   │   │
│  │  │ - Stock.minQuantity 컬럼이 안전재고 기준값임                │   │   │
│  │  │ - 재고가 minQuantity 이하면 알림 발송                       │   │   │
│  │  │                                                             │   │   │
│  │  │ #### Context                                                │   │   │
│  │  │ StockService 분석 중 발견                                   │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                           │
│                                 │  /memory-commit 실행                      │
│                                 ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    📚 Memory Files (.claude/memory/)                 │   │
│  │                                                                      │   │
│  │   inventory/              billing/              common/              │   │
│  │   ├── stock.md            ├── invoice.md        └── glossary.md     │   │
│  │   └── warehouse.md        └── payment.md                            │   │
│  │                                                                      │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                           │
│                                 │  /memory-sync 실행                        │
│                                 ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    🗄️ PostgreSQL + pgvector                          │   │
│  │                                                                      │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │  claude_memory 테이블                                       │   │   │
│  │   │  ┌──────────┬─────────┬────────────────┬─────────────────┐ │   │   │
│  │   │  │ file_path│ content │ embedding      │ content_tsv     │ │   │   │
│  │   │  ├──────────┼─────────┼────────────────┼─────────────────┤ │   │   │
│  │   │  │ stock.md │ Stock.. │ [0.12, -0.34..]│ 'stock' 'entity'│ │   │   │
│  │   │  │ ...      │ ...     │ ...            │ ...             │ │   │   │
│  │   │  └──────────┴─────────┴────────────────┴─────────────────┘ │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │   • embedding: OpenAI text-embedding-3-small (1536차원)             │   │
│  │   • content_tsv: PostgreSQL Full-Text Search용                      │   │
│  │   • Hybrid Search: Vector 유사도 + BM25 키워드 매칭 결합            │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 유사도에 따른 분기 처리

```
                              ┌─────────────┐
                              │  User Query │
                              │ "재고 관리?" │
                              └──────┬──────┘
                                     │
                                     ▼
                         ┌───────────────────────┐
                         │   🪝 Hook: 검색 실행    │
                         │   Vector + BM25 검색   │
                         └───────────┬───────────┘
                                     │
                                     ▼
                         ┌───────────────────────┐
                         │    유사도 체크         │
                         │    Threshold: 65%     │
                         └───────────┬───────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
        ┌───────────────────────┐       ┌───────────────────────┐
        │   ✅ >= 65% (충분)     │       │   ⚠️ < 65% (부족)      │
        │                       │       │                       │
        │ <memory-context>      │       │ <memory-learning-     │
        │ 관련 컨텍스트 주입     │       │  required>            │
        │ </memory-context>     │       │ Memory 학습 필요 표시  │
        └───────────┬───────────┘       └───────────┬───────────┘
                    │                               │
                    ▼                               ▼
        ┌───────────────────────┐       ┌───────────────────────┐
        │   🤖 Claude 바로 작업  │       │  🔍 memory-learner    │
        │   컨텍스트 활용해 응답 │       │     에이전트 호출      │
        └───────────────────────┘       └───────────┬───────────┘
                                                    │
                                                    ▼
                                        ┌───────────────────────┐
                                        │ codebase-context-     │
                                        │ finder 호출           │
                                        │                       │
                                        │ • 코드베이스 탐색      │
                                        │ • Entity/Service 분석 │
                                        │ • 관련 정보 수집       │
                                        └───────────┬───────────┘
                                                    │
                                                    ▼
                                        ┌───────────────────────┐
                                        │  📝 Memory 업데이트    │
                                        │  (사용자 승인 후)      │
                                        │                       │
                                        │ • 새 정보 추가         │
                                        │ • 기존 정보 수정       │
                                        │ • Vector DB 동기화    │
                                        └───────────┬───────────┘
                                                    │
                                                    ▼
                                        ┌───────────────────────┐
                                        │  🤖 Claude 작업 진행   │
                                        │  (최신 컨텍스트 활용)  │
                                        └───────────────────────┘
```

### Learning Loop 요약

```
  ┌──────────────────────────────────────────────────────────────────┐
  │                                                                  │
  │   1️⃣ 질문        2️⃣ 검색         3️⃣ 분기                        │
  │   ┌─────┐      ┌─────┐       ┌──────────────────────┐          │
  │   │User │ ──▶  │Hook │  ──▶  │  >= 65%? │  < 65%?  │          │
  │   │Query│      │검색  │       │    │           │    │          │
  │   └─────┘      └─────┘       └────┼───────────┼────┘          │
  │                                   │           │                 │
  │                   ┌───────────────┘           └──────────┐      │
  │                   ▼                                      ▼      │
  │           ┌────────────┐                     ┌────────────────┐ │
  │           │ 4️⃣ 바로 작업│                     │memory-learner │ │
  │           │ 컨텍스트활용 │                     │ • 코드 탐색   │ │
  │           └─────┬──────┘                     │ • Memory 갱신 │ │
  │                 │                            └───────┬────────┘ │
  │                 │                                    │          │
  │                 └────────────────┬───────────────────┘          │
  │                                  ▼                              │
  │                          ┌────────────┐                         │
  │                          │ 5️⃣ 응답     │                         │
  │                          │ + 학습기록  │                         │
  │                          └─────┬──────┘                         │
  │                                │                                │
  │   ┌─────┐      ┌─────┐       ┌─┴───┐                           │
  │   │ DB  │ ◀──  │Sync │  ◀──  │Commit│  ◀──  learnings.md       │
  │   └─────┘      └─────┘       └─────┘                           │
  │   8️⃣ 저장       7️⃣ 동기화     6️⃣ 커밋                            │
  │                                                                  │
  │   ─────────────────────────────────────────────────────▶        │
  │                     다음 세션에서 1️⃣로 반복                       │
  │                                                                  │
  └──────────────────────────────────────────────────────────────────┘
```

### 단계별 설명

| 단계 | 무슨 일이 일어나나요? | 자동/수동 |
|------|----------------------|----------|
| 1️⃣ 질문 | 사용자가 Claude Code에 질문 | 수동 |
| 2️⃣ 검색 | Hook이 Vector DB에서 관련 Memory 검색 | **자동** |
| 3️⃣ 분기 | 유사도에 따라 두 경로로 분기 | **자동** |
| ↳ **>= 65%** | 컨텍스트 바로 주입 → 작업 진행 | **자동** |
| ↳ **< 65%** | memory-learner가 코드베이스 탐색 → Memory 최신화 → 작업 | **자동** |
| 4️⃣ 응답 | Claude가 컨텍스트를 활용해 정확한 답변 | 자동 |
| 5️⃣ 학습 | 새로 발견한 정보를 learnings.md에 기록 | 자동 |
| 6️⃣ 커밋 | `/memory-commit`으로 Memory 파일에 병합 | 수동 |
| 7️⃣ 동기화 | Memory 파일을 Vector DB에 동기화 | **자동** |
| 8️⃣ 저장 | 임베딩과 함께 DB에 영구 저장 | 자동 |

### memory-learner 상세 동작

유사도가 65% 미만일 때 자동 호출되는 에이전트입니다:

```
┌─────────────────────────────────────────────────────────────────┐
│                      memory-learner 워크플로우                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. codebase-context-finder 호출                                │
│     • Frontend → Backend → Entity 순으로 탐색                   │
│     • 관련 코드 구조 파악                                        │
│                                                                 │
│  2. 기존 Memory와 비교                                          │
│     • 누락된 정보 (missing)                                      │
│     • 충돌하는 정보 (conflict)                                   │
│     • 오래된 정보 (outdated)                                     │
│                                                                 │
│  3. 사용자에게 업데이트 제안                                     │
│     ┌─────────────────────────────────────────────────┐        │
│     │ 🆕 추가 제안: Stock.minQuantity 필드 설명       │        │
│     │ 🔄 수정 제안: 재고 차감 로직 업데이트           │        │
│     │                                                 │        │
│     │ [1] 전체 적용  [2] 선택 적용  [3] 건너뛰기      │        │
│     └─────────────────────────────────────────────────┘        │
│                                                                 │
│  4. 승인 시 Memory 파일 수정 + DB 동기화                        │
│                                                                 │
│  5. 최신 컨텍스트로 원래 작업 진행                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### codebase-context-finder: Frontend-First 철학

> 💡 **가정**: Frontend, Backend, 공통 모듈이 한 곳에 모여있는 **모노레포(Monorepo)** 구조를 전제로 합니다.

코드베이스를 이해할 때 **UI(사용자)부터 시작해서 데이터베이스까지 추적**합니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend-First 코드 탐색                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   "재고 관리 기능을 알려줘"                                      │
│                                                                 │
│   Step 1: 🖥️ Frontend (UI)                                      │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │ pages/inventory/                                        │  │
│   │ ├── StockList.tsx      ← 사용자가 보는 화면             │  │
│   │ ├── StockDetail.tsx    ← 어떤 데이터를 표시하는지       │  │
│   │ └── components/        ← 어떤 액션이 가능한지           │  │
│   │                                                         │  │
│   │ 💡 UI가 기능의 정의입니다.                              │  │
│   │    사용자가 보는 것 = 요구사항                          │  │
│   └─────────────────────────────────────────────────────────┘  │
│                          │                                      │
│                          ▼ API 호출 추적                        │
│   Step 2: 🔌 API Layer                                          │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │ GET /api/stocks        → StockController.findAll()      │  │
│   │ POST /api/stocks/decrease → StockController.decrease()  │  │
│   └─────────────────────────────────────────────────────────┘  │
│                          │                                      │
│                          ▼ 서비스 메서드 추적                    │
│   Step 3: ⚙️ Service (핵심 비즈니스 로직)                        │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │ StockService.ts                                         │  │
│   │ ├── decrease()    ← 재고 차감 로직                      │  │
│   │ ├── checkAlert()  ← 안전재고 알림 로직                  │  │
│   │ └── transfer()    ← 창고간 이동 로직                    │  │
│   │                                                         │  │
│   │ 💡 서비스가 비즈니스 로직의 핵심입니다.                 │  │
│   └─────────────────────────────────────────────────────────┘  │
│                          │                                      │
│                          ▼ 데이터 구조 확인                      │
│   Step 4: 🗃️ Entity & Cron                                      │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │ Stock.entity.ts                                         │  │
│   │ ├── id, quantity, minQuantity, warehouseId             │  │
│   │ └── @ManyToOne(() => Warehouse)                        │  │
│   │                                                         │  │
│   │ StockAlertCron.ts      ← 자동화된 스케줄 작업           │  │
│   │ └── @Cron('0 9 * * *') checkLowStock()                 │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│   📊 최종 컨텍스트 생성:                                        │
│   "재고는 Stock 엔티티로 관리되며, minQuantity 이하시           │
│    StockAlertCron이 매일 9시에 알림을 발송합니다."              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**왜 Frontend부터인가?**

| 접근 방식 | 문제점 |
|----------|--------|
| DB부터 시작 | 테이블은 많은데 뭐가 중요한지 모름 |
| 백엔드부터 시작 | 수백 개의 API 중 어디서 시작할지 모름 |
| **UI부터 시작** | 사용자가 보는 것 = 실제 기능 = 정확한 출발점 |

---

## 🎯 Mother Agent 커스터마이징

이 시스템의 **메인 에이전트(Mother Agent)**는 당신의 목적에 맞게 자유롭게 구성할 수 있습니다.

Memory System은 **지식 저장소 + 자동 학습 인프라**를 제공하고, 그 위에서 동작하는 에이전트의 역할은 당신이 정의합니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Mother Agent 구성 예시                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   📦 E-commerce        → 주문/배송/CS 자동화 에이전트           │
│   🏥 Healthcare        → 환자 데이터 분석/리포트 에이전트       │
│   📊 Analytics         → 데이터 파이프라인 관리 에이전트        │
│   🏭 Manufacturing     → 생산 라인 모니터링 에이전트            │
│   🍳 Kitchen Ops       → 주방 운영 최적화 에이전트              │
│                                                                 │
│   Memory System은 도메인에 관계없이                             │
│   "학습하고 기억하는 능력"을 제공합니다.                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 💼 Real-World Case: AI Kitchen Operations

이 시스템은 실제로 **다수의 직영 주방 운영**에 적용되어 사용 중입니다.

### 구현된 AI OS

| 도메인 | 자동화된 기능 |
|--------|--------------|
| 👥 **인사 관리** | 근태 이상 감지, 스케줄 최적화, 인력 배치 제안 |
| 📦 **재고 관리** | 안전재고 알림, 발주 자동화, 유통기한 추적 |
| ✅ **품질 관리** | 조리 품질 체크리스트, 이상 패턴 감지 |
| 🧼 **위생 관리** | HACCP 점검 자동화, 위생 리포트 생성 |

### 핵심 가치

```
Before: "이거 저번에 어떻게 했더라..." (매번 반복 설명)
After:  Memory가 모든 운영 지식을 축적 → 즉시 정확한 답변
```

Claude Code가 주방 운영의 **모든 맥락을 기억**하고, 담당자가 바뀌어도 지식이 유실되지 않습니다.

---

## 🚀 About Blitz Dynamics

<p align="center">
  <strong>🍳 자율 운영 주방(Autonomous Kitchen)을 만듭니다</strong>
</p>

AI와 자동화 기술로 **사람의 개입 없이도 일관된 품질을 유지하는 주방 시스템**을 개발하고 있습니다.

관심 있으시다면 연락주세요:

📧 **dltkddn0323@snu.ac.kr**

🌐 **https://team.blitz-dynamics.com/**

---

## 📖 Commands

| Command | Description |
|---------|-------------|
| `/memory-search <query>` | Memory에서 관련 컨텍스트 검색 |
| `/memory-commit` | learnings.md 내용을 Memory에 병합 |
| `/memory-sync` | Memory 폴더와 Vector DB 동기화 |

---

## 🏗️ Architecture

```
your-project/
├── .claude/                    # 🧠 Memory System
│   ├── memory/                 # 학습된 지식 저장소
│   │   ├── {domain}/           #   도메인별 폴더
│   │   └── examples/           #   템플릿
│   │
│   ├── hooks/memory/           # 자동화 스크립트
│   │   ├── inject-context.mjs  #   컨텍스트 주입
│   │   ├── search.mjs          #   벡터 검색
│   │   ├── sync-db.mjs         #   DB 동기화
│   │   └── commit-learnings.mjs#   학습 커밋
│   │
│   ├── agents/                 # 서브에이전트 정의
│   │   ├── memory-learner.md   #   Memory 최신화
│   │   └── codebase-context-finder.md
│   │
│   ├── skills/                 # 스킬 정의
│   ├── learnings.md            # 세션 중 임시 학습
│   ├── settings.json           # Hook 설정
│   └── CLAUDE.md               # Claude 지시사항
│
├── workspace/                  # 📁 Your codebase (optional)
└── .env.ai                     # 🔐 Environment variables
```

---

## ⚙️ Customization

### CLAUDE.md 수정

`.claude/CLAUDE.md`에 프로젝트 정보를 추가하세요:

```markdown
## 프로젝트 개요
- 프로젝트명: Your Project
- 기술 스택: TypeScript, React, PostgreSQL
- 주요 디렉토리: workspace/src

## 코드베이스 위치
작업 대상 코드는 `workspace/` 디렉토리에 있습니다.
```

### Memory 도메인 추가

```bash
# 새 도메인 폴더 생성
mkdir -p .claude/memory/billing

# 지식 파일 작성
cat > .claude/memory/billing/overview.md << 'EOF'
# Billing Domain

## Key Concepts
- Invoice: 청구서
- Payment: 결제

## Entities
| Entity | Table | Description |
|--------|-------|-------------|
| Invoice | invoices | 청구서 정보 |
EOF

# DB 동기화
node .claude/hooks/memory/sync-db.mjs
```

---

## 📋 Requirements

- **PostgreSQL** with [pgvector](https://github.com/pgvector/pgvector) extension
- **Node.js** 18+
- **OpenAI API Key** (for embeddings)
- **[Claude Code](https://claude.ai/code)** CLI

---

## 🤝 Contributing

Contributions are welcome!

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📄 License

MIT License - feel free to use this in your own projects!

---

<p align="center">
  <sub>Built with 🧠 for Claude Code users who are tired of repeating themselves</sub>
</p>
