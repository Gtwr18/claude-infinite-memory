<p align="center">
  <img src="https://img.shields.io/badge/Claude_Code-Memory_System-blueviolet?style=for-the-badge&logo=anthropic" alt="Claude Code Memory System"/>
</p>

<h1 align="center">🧠 Self-Learning AI OS</h1>

<p align="center">
  <strong>A memory system that enables Claude Code to learn and evolve across sessions</strong>
</p>

<p align="center">
  🇺🇸 English | <a href="./README_KR.md">🇰🇷 한국어</a>
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

Claude Code is powerful, but **all context is lost when the session ends.**

Are you repeating the same explanations every time?

```
You: "In our project, User works like this..."
You: "Oh, and like I mentioned last time..."
You: "Do I have to explain this again..."
```

**Self-Learning AI OS** makes Claude **permanently remember** what it learns from conversations.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔄 **Auto Context Injection** | Automatically retrieves relevant past learnings for your questions |
| 📚 **Incremental Learning** | Accumulates knowledge discovered in each session |
| 🔍 **Hybrid Search** | Accurate search combining Vector + BM25 |
| 🏷️ **Domain Separation** | Systematically organize knowledge by topic |
| 🤖 **Auto Memory Refresh** | Suggests Memory sync when codebase changes |

---

## 🚀 Quick Start

### 1. Add to Your Project

```bash
# Option A: Add as submodule
git submodule add https://github.com/YOUR_USERNAME/selfLearningAiOS.git memory-system
cp -r memory-system/.claude ./

# Option B: Clone and start fresh
git clone https://github.com/YOUR_USERNAME/selfLearningAiOS.git my-project
cd my-project
```

### 2. Database Setup

```sql
-- Run in PostgreSQL
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

### 3. Environment Variables

```bash
# Create .env.ai file
cat > .env.ai << 'EOF'
AI_VECTOR_DB_HOST=localhost
AI_VECTOR_DB_PORT=5432
AI_VECTOR_DB_USER=postgres
AI_VECTOR_DB_PASSWORD=yourpassword
AI_VECTOR_DB_NAME=ai_memory
OPENAI_API_KEY=sk-...
EOF
```

### 4. Install Dependencies & Sync

```bash
cd .claude/hooks/memory
npm init -y && npm install pg dotenv openai
node sync-db.mjs
```

**Done!** Now Claude Code will automatically learn from your conversations.

---

## 🔄 How It Works

### Overall Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SELF-LEARNING AI OS                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐                                                            │
│  │    User     │                                                            │
│  │  "How does  │                                                            │
│  │ inventory   │                                                            │
│  │   work?"    │                                                            │
│  └──────┬──────┘                                                            │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     🪝 HOOK: inject-context.mjs                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  1. Extract keywords from query: "inventory", "work"        │   │   │
│  │  │  2. Hybrid search in Vector DB (Vector 60% + BM25 40%)      │   │   │
│  │  │  3. Check similarity:                                       │   │   │
│  │  │     • >= 65% → Inject context via <memory-context> tag      │   │   │
│  │  │     • < 65%  → Show <memory-learning-required> tag          │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                           │
│                                 ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         🤖 CLAUDE CODE                               │   │
│  │                                                                      │   │
│  │   Input:                                                             │   │
│  │   ┌────────────────────────────────────────────────────────────┐   │   │
│  │   │ <memory-context>                                           │   │   │
│  │   │ # Inventory Management (85% match)                         │   │   │
│  │   │ - Stock Entity: linked to warehouses table                 │   │   │
│  │   │ - Stock decrease: use StockService.decrease() method       │   │   │
│  │   │ </memory-context>                                          │   │   │
│  │   │                                                            │   │   │
│  │   │ User: "How does inventory work?"                           │   │   │
│  │   └────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │   When new information is discovered → Record in learnings.md       │   │
│  │                                                                      │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                           │
│                                 ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      📝 learnings.md (Temporary Storage)             │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │ ### [2026-01-29T10:15:00]                                   │   │   │
│  │  │ **type**: new                                               │   │   │
│  │  │ **confidence**: high                                        │   │   │
│  │  │                                                             │   │   │
│  │  │ #### Content                                                │   │   │
│  │  │ - Stock.minQuantity column is the safety stock threshold    │   │   │
│  │  │ - Alert is sent when stock falls below minQuantity          │   │   │
│  │  │                                                             │   │   │
│  │  │ #### Context                                                │   │   │
│  │  │ Discovered while analyzing StockService                     │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                           │
│                                 │  Run /memory-commit                       │
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
│                                 │  Run /memory-sync                         │
│                                 ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    🗄️ PostgreSQL + pgvector                          │   │
│  │                                                                      │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │  claude_memory table                                        │   │   │
│  │   │  ┌──────────┬─────────┬────────────────┬─────────────────┐ │   │   │
│  │   │  │ file_path│ content │ embedding      │ content_tsv     │ │   │   │
│  │   │  ├──────────┼─────────┼────────────────┼─────────────────┤ │   │   │
│  │   │  │ stock.md │ Stock.. │ [0.12, -0.34..]│ 'stock' 'entity'│ │   │   │
│  │   │  │ ...      │ ...     │ ...            │ ...             │ │   │   │
│  │   │  └──────────┴─────────┴────────────────┴─────────────────┘ │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │   • embedding: OpenAI text-embedding-3-small (1536 dimensions)      │   │
│  │   • content_tsv: For PostgreSQL Full-Text Search                    │   │
│  │   • Hybrid Search: Vector similarity + BM25 keyword matching        │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Branching Based on Similarity

```
                              ┌─────────────┐
                              │  User Query │
                              │ "inventory?"│
                              └──────┬──────┘
                                     │
                                     ▼
                         ┌───────────────────────┐
                         │   🪝 Hook: Run Search  │
                         │   Vector + BM25       │
                         └───────────┬───────────┘
                                     │
                                     ▼
                         ┌───────────────────────┐
                         │   Similarity Check    │
                         │   Threshold: 65%      │
                         └───────────┬───────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
        ┌───────────────────────┐       ┌───────────────────────┐
        │   ✅ >= 65% (Enough)  │       │   ⚠️ < 65% (Not Enough)│
        │                       │       │                       │
        │ <memory-context>      │       │ <memory-learning-     │
        │ Inject relevant       │       │  required>            │
        │ context               │       │ Indicate learning     │
        │ </memory-context>     │       │ is needed             │
        └───────────┬───────────┘       └───────────┬───────────┘
                    │                               │
                    ▼                               ▼
        ┌───────────────────────┐       ┌───────────────────────┐
        │   🤖 Claude works     │       │  🔍 memory-learner    │
        │   directly with       │       │     agent invoked     │
        │   context             │       └───────────┬───────────┘
        └───────────────────────┘                   │
                                                    ▼
                                        ┌───────────────────────┐
                                        │ codebase-context-     │
                                        │ finder invoked        │
                                        │                       │
                                        │ • Explore codebase    │
                                        │ • Analyze Entity/Svc  │
                                        │ • Collect info        │
                                        └───────────┬───────────┘
                                                    │
                                                    ▼
                                        ┌───────────────────────┐
                                        │  📝 Update Memory     │
                                        │  (After user approval)│
                                        │                       │
                                        │ • Add new info        │
                                        │ • Modify existing     │
                                        │ • Sync to Vector DB   │
                                        └───────────┬───────────┘
                                                    │
                                                    ▼
                                        ┌───────────────────────┐
                                        │  🤖 Claude proceeds   │
                                        │  (with fresh context) │
                                        └───────────────────────┘
```

### Learning Loop Summary

```
  ┌──────────────────────────────────────────────────────────────────┐
  │                                                                  │
  │   1️⃣ Query       2️⃣ Search        3️⃣ Branch                     │
  │   ┌─────┐      ┌─────┐       ┌──────────────────────┐          │
  │   │User │ ──▶  │Hook │  ──▶  │  >= 65%? │  < 65%?  │          │
  │   │Query│      │Search│      │    │           │    │          │
  │   └─────┘      └─────┘       └────┼───────────┼────┘          │
  │                                   │           │                 │
  │                   ┌───────────────┘           └──────────┐      │
  │                   ▼                                      ▼      │
  │           ┌────────────┐                     ┌────────────────┐ │
  │           │ 4️⃣ Work     │                     │memory-learner │ │
  │           │ directly   │                     │ • Code explore │ │
  │           └─────┬──────┘                     │ • Memory update│ │
  │                 │                            └───────┬────────┘ │
  │                 │                                    │          │
  │                 └────────────────┬───────────────────┘          │
  │                                  ▼                              │
  │                          ┌────────────┐                         │
  │                          │ 5️⃣ Response │                         │
  │                          │ + Learning │                         │
  │                          └─────┬──────┘                         │
  │                                │                                │
  │   ┌─────┐      ┌─────┐       ┌─┴───┐                           │
  │   │ DB  │ ◀──  │Sync │  ◀──  │Commit│  ◀──  learnings.md       │
  │   └─────┘      └─────┘       └─────┘                           │
  │   8️⃣ Save       7️⃣ Sync       6️⃣ Commit                         │
  │                                                                  │
  │   ─────────────────────────────────────────────────────▶        │
  │                     Repeat from 1️⃣ in next session               │
  │                                                                  │
  └──────────────────────────────────────────────────────────────────┘
```

### Step-by-Step Explanation

| Step | What happens? | Auto/Manual |
|------|---------------|-------------|
| 1️⃣ Query | User asks Claude Code a question | Manual |
| 2️⃣ Search | Hook searches Vector DB for relevant Memory | **Auto** |
| 3️⃣ Branch | Branch into two paths based on similarity | **Auto** |
| ↳ **>= 65%** | Context injected directly → proceed with work | **Auto** |
| ↳ **< 65%** | memory-learner explores codebase → updates Memory → work | **Auto** |
| 4️⃣ Response | Claude provides accurate answer using context | Auto |
| 5️⃣ Learning | Record newly discovered info in learnings.md | Auto |
| 6️⃣ Commit | Merge to Memory files via `/memory-commit` | Manual |
| 7️⃣ Sync | Sync Memory files to Vector DB | **Auto** |
| 8️⃣ Save | Persist with embeddings in DB | Auto |

### memory-learner Detailed Workflow

This agent is automatically invoked when similarity is below 65%:

```
┌─────────────────────────────────────────────────────────────────┐
│                      memory-learner Workflow                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Invoke codebase-context-finder                              │
│     • Explore Frontend → Backend → Entity                       │
│     • Understand code structure                                 │
│                                                                 │
│  2. Compare with existing Memory                                │
│     • Missing information                                       │
│     • Conflicting information                                   │
│     • Outdated information                                      │
│                                                                 │
│  3. Propose updates to user                                     │
│     ┌─────────────────────────────────────────────────┐        │
│     │ 🆕 Add: Stock.minQuantity field description     │        │
│     │ 🔄 Update: Stock decrease logic                 │        │
│     │                                                 │        │
│     │ [1] Apply all  [2] Select  [3] Skip             │        │
│     └─────────────────────────────────────────────────┘        │
│                                                                 │
│  4. On approval: Modify Memory files + Sync DB                  │
│                                                                 │
│  5. Proceed with original task using fresh context              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### codebase-context-finder: Frontend-First Philosophy

> 💡 **Assumption**: This assumes a **Monorepo** structure where Frontend, Backend, and shared modules are co-located.

When understanding the codebase, we **start from the UI (user) and trace down to the database**.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend-First Code Exploration               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   "Tell me about inventory management"                          │
│                                                                 │
│   Step 1: 🖥️ Frontend (UI)                                      │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │ pages/inventory/                                        │  │
│   │ ├── StockList.tsx      ← What user sees                 │  │
│   │ ├── StockDetail.tsx    ← What data is displayed         │  │
│   │ └── components/        ← What actions are available     │  │
│   │                                                         │  │
│   │ 💡 UI is the definition of functionality.               │  │
│   │    What user sees = Requirements                        │  │
│   └─────────────────────────────────────────────────────────┘  │
│                          │                                      │
│                          ▼ Trace API calls                      │
│   Step 2: 🔌 API Layer                                          │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │ GET /api/stocks        → StockController.findAll()      │  │
│   │ POST /api/stocks/decrease → StockController.decrease()  │  │
│   └─────────────────────────────────────────────────────────┘  │
│                          │                                      │
│                          ▼ Trace service methods                │
│   Step 3: ⚙️ Service (Core Business Logic)                      │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │ StockService.ts                                         │  │
│   │ ├── decrease()    ← Stock decrease logic                │  │
│   │ ├── checkAlert()  ← Safety stock alert logic            │  │
│   │ └── transfer()    ← Warehouse transfer logic            │  │
│   │                                                         │  │
│   │ 💡 Service is the core of business logic.               │  │
│   └─────────────────────────────────────────────────────────┘  │
│                          │                                      │
│                          ▼ Check data structure                 │
│   Step 4: 🗃️ Entity & Cron                                      │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │ Stock.entity.ts                                         │  │
│   │ ├── id, quantity, minQuantity, warehouseId             │  │
│   │ └── @ManyToOne(() => Warehouse)                        │  │
│   │                                                         │  │
│   │ StockAlertCron.ts      ← Automated scheduled job        │  │
│   │ └── @Cron('0 9 * * *') checkLowStock()                 │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│   📊 Final context generated:                                   │
│   "Stock is managed via Stock entity. When below minQuantity,  │
│    StockAlertCron sends alerts daily at 9 AM."                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Why start from Frontend?**

| Approach | Problem |
|----------|---------|
| Start from DB | Many tables, unclear what's important |
| Start from Backend | Hundreds of APIs, unclear where to begin |
| **Start from UI** | What user sees = actual feature = correct starting point |

---

## 🎯 Mother Agent Customization

The **main agent (Mother Agent)** in this system can be freely configured to match your purpose.

The Memory System provides **knowledge storage + automatic learning infrastructure**, and you define the role of the agent running on top of it.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Mother Agent Configuration Examples           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   📦 E-commerce        → Order/Shipping/CS automation agent     │
│   🏥 Healthcare        → Patient data analysis/report agent     │
│   📊 Analytics         → Data pipeline management agent         │
│   🏭 Manufacturing     → Production line monitoring agent       │
│   🍳 Kitchen Ops       → Kitchen operations optimization agent  │
│                                                                 │
│   Memory System provides the ability to                         │
│   "learn and remember" regardless of domain.                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 💼 Real-World Case: AI Kitchen Operations

This system is actively used in **multiple directly-operated kitchen operations**.

### Implemented AI OS

| Domain | Automated Functions |
|--------|---------------------|
| 👥 **HR Management** | Attendance anomaly detection, schedule optimization, staffing suggestions |
| 📦 **Inventory Management** | Safety stock alerts, auto-ordering, expiration tracking |
| ✅ **Quality Control** | Cooking quality checklists, anomaly pattern detection |
| 🧼 **Hygiene Management** | HACCP inspection automation, hygiene report generation |

### Core Value

```
Before: "How did we do this last time..." (repeating explanations every time)
After:  Memory accumulates all operational knowledge → instant accurate answers
```

Claude Code **remembers all operational context**, and knowledge is not lost even when staff changes.

---

## 🚀 About Blitz Dynamics

<p align="center">
  <strong>🍳 Building Autonomous Kitchens</strong>
</p>

We're developing **kitchen systems that maintain consistent quality without human intervention** using AI and automation technology.

If you're interested, please reach out:

📧 **dltkddn0323@snu.ac.kr**

🌐 **https://team.blitz-dynamics.com/**

---

## 📖 Commands

| Command | Description |
|---------|-------------|
| `/memory-search <query>` | Search for relevant context in Memory |
| `/memory-commit` | Merge learnings.md content into Memory |
| `/memory-sync` | Sync Memory folder with Vector DB |

---

## 🏗️ Architecture

```
your-project/
├── .claude/                    # 🧠 Memory System
│   ├── memory/                 # Learned knowledge storage
│   │   ├── {domain}/           #   Domain-specific folders
│   │   └── examples/           #   Templates
│   │
│   ├── hooks/memory/           # Automation scripts
│   │   ├── inject-context.mjs  #   Context injection
│   │   ├── search.mjs          #   Vector search
│   │   ├── sync-db.mjs         #   DB sync
│   │   └── commit-learnings.mjs#   Learning commit
│   │
│   ├── agents/                 # Sub-agent definitions
│   │   ├── memory-learner.md   #   Memory updater
│   │   └── codebase-context-finder.md
│   │
│   ├── skills/                 # Skill definitions
│   ├── learnings.md            # Session learning temp storage
│   ├── settings.json           # Hook settings
│   └── CLAUDE.md               # Claude instructions
│
├── workspace/                  # 📁 Your codebase (optional)
└── .env.ai                     # 🔐 Environment variables
```

---

## ⚙️ Customization

### Modify CLAUDE.md

Add your project information to `.claude/CLAUDE.md`:

```markdown
## Project Overview
- Project Name: Your Project
- Tech Stack: TypeScript, React, PostgreSQL
- Main Directory: workspace/src

## Codebase Location
The working codebase is in the `workspace/` directory.
```

### Add Memory Domain

```bash
# Create new domain folder
mkdir -p .claude/memory/billing

# Write knowledge file
cat > .claude/memory/billing/overview.md << 'EOF'
# Billing Domain

## Key Concepts
- Invoice: Billing document
- Payment: Transaction record

## Entities
| Entity | Table | Description |
|--------|-------|-------------|
| Invoice | invoices | Invoice information |
EOF

# Sync to DB
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
