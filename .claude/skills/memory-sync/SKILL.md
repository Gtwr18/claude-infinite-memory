---
description: "/memory-sync - DB 동기화"
keywords: [memory, sync, 동기화, pgvector, DB]
argument-hint: "옵션 없이 실행"
---

# /memory-sync - DB 동기화

`.claude/memory/` 폴더의 모든 파일을 pgvector DB에 동기화합니다.

## 사용법

```
/memory-sync
```

## 동기화 로직

1. memory/ 폴더 스캔 → 파일 목록 + content_hash 계산
2. DB에서 기존 file_path, content_hash 조회
3. 비교:
   - 새 파일 → INSERT (임베딩 생성 포함)
   - hash 변경 → DELETE all chunks + re-INSERT
   - 파일 삭제됨 → DELETE
4. 변경된 파일만 임베딩 생성

## 환경변수 필요

`.env.ai` 파일에 다음 환경변수가 필요합니다:

```bash
# Vector DB
AI_VECTOR_DB_HOST=localhost
AI_VECTOR_DB_PORT=5432
AI_VECTOR_DB_USER=postgres
AI_VECTOR_DB_PASSWORD=yourpassword
AI_VECTOR_DB_NAME=ai_memory

# OpenAI API
OPENAI_API_KEY=sk-...
```

## Instructions for Claude

사용자가 `/memory-sync`를 실행하면:

1. Bash 도구로 sync-db.mjs 스크립트를 실행합니다:

```bash
node .claude/hooks/memory/sync-db.mjs
```

2. 동기화 결과를 사용자에게 보고합니다:
   - 추가된 파일 수
   - 수정된 파일 수
   - 삭제된 파일 수

## 사용 시나리오

- memory 파일을 직접 편집한 후 DB 업데이트
- 초기 세팅 후 최초 데이터 로드
- DB와 파일 시스템 동기화 확인
