---
description: "/memory-search - Memory 검색"
keywords: [memory, search, 메모리, 검색, 컨텍스트]
argument-hint: "검색어를 입력하세요"
---

# /memory-search - Memory 검색

메모리 시스템에서 관련 비즈니스 컨텍스트를 검색합니다.

## 사용법

```
/memory-search <검색어>
/memory-search <검색어> --hybrid
```

## 옵션

- `--hybrid`, `-H`: Hybrid 검색 (Vector + BM25 결합)
- `--alpha`, `-a`: Hybrid 가중치 (기본값: 0.6 = Vector 60%)
- `--limit`, `-l`: 반환할 결과 수 (기본값: 5)
- `--threshold`, `-t`: 최소 유사도 (기본값: 0.3)
- `--json`, `-j`: JSON 형식 출력

## Instructions for Claude

사용자가 `/memory-search`를 실행하면:

1. 검색어를 추출합니다
2. Bash 도구로 search.mjs 스크립트를 실행합니다:

```bash
node .claude/hooks/memory/search.mjs "검색어"
```

3. 옵션이 있으면 포함합니다:
   - `--hybrid`: BM25 결합 검색
   - `--limit 3`: 결과 수 제한

4. 검색 결과를 사용자에게 보여줍니다

## 예시 실행

```bash
# 기본 검색 (벡터 검색)
node .claude/hooks/memory/search.mjs "사용자 인증"

# Hybrid 검색 (벡터 + BM25)
node .claude/hooks/memory/search.mjs "사용자 인증" --hybrid

# JSON 출력
node .claude/hooks/memory/search.mjs "사용자 인증" --json
```
