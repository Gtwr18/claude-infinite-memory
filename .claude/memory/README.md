# Memory Directory

pgvector DB에 동기화되는 비즈니스 컨텍스트 파일들입니다.

## Structure

```
memory/
├── examples/       # 예시 (동기화 제외)
├── {domain}/       # 도메인별 폴더
└── common/         # 공통 정보
```

## Sync

```bash
node .claude/hooks/memory/sync-db.mjs
```
