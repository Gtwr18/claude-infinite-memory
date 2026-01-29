---
description: "/memory-commit - 학습 내용 커밋"
keywords: [memory, commit, 학습, 커밋, learnings, 벡터검색]
argument-hint: "옵션: --threshold 0.6 (유사도 임계값)"
---

# /memory-commit - 학습 내용 커밋 (LLM 기반)

세션 중 learnings.md에 기록된 학습 내용을 **벡터 검색**으로 관련 파일을 찾고, **LLM이 직접 판단하여** memory 파일을 수정합니다.

## Instructions for Claude (필수!)

사용자가 `/memory-commit`을 실행하면 아래 단계를 **순서대로** 수행하세요:

### Step 1: 벡터 검색 실행

```bash
node .claude/hooks/memory/commit-learnings.mjs --threshold 0.5
```

출력: JSON 형식으로 learnings + 관련 파일 정보

### Step 2: 검색 결과 분석

JSON 결과에서 각 learning 항목의 `relatedFiles`를 확인합니다.

- 관련 파일이 없으면 → 사용자에게 **새 파일 생성 여부** 질문
- 관련 파일이 있으면 → Step 3으로 진행

### Step 3: 관련 파일 읽기

각 관련 파일을 **Read 도구로 전체 내용**을 읽습니다.

```
Read(file_path="{filePath}")
```

### Step 4: 비교 및 판단 (핵심!)

LLM이 직접 판단합니다:

1. **중복 확인**: 학습 내용이 이미 파일에 있는가?
   - 있으면 → 건너뛰거나 기존 내용 보완

2. **위치 결정**: 어디에 추가할지?
   - 관련 섹션 근처에 추가 (단순 파일 끝 추가 X)
   - 기존 구조와 일관성 유지

3. **통합 방식**: 어떻게 통합할지?
   - 기존 테이블에 행 추가
   - 기존 섹션에 bullet 추가
   - 새 섹션 생성

4. **불확실한 경우**: 사용자에게 질문
   - "이 내용을 어느 섹션에 추가할까요?"
   - "기존 내용 'X'와 충돌하는데 어떻게 처리할까요?"

### Step 5: 파일 수정

Edit 도구로 파일을 수정합니다.

```
Edit(file_path="{filePath}", old_string="...", new_string="...")
```

**주의**: 파일 끝에 무조건 추가하지 말고, 관련 섹션에 자연스럽게 통합하세요.

### Step 6: learnings.md 정리 (Flush)

처리 완료 후 learnings.md를 정리합니다:

1. **Pending 섹션 비우기**: 모든 처리된 항목 제거
2. **Committed에 요약 추가**: 이번 커밋 기록

```markdown
## Pending
<!-- 학습 항목이 없습니다 -->

---

## Committed
### [2026-01-29T12:00:00] → domain/file.md
- 처리된 항목 수: 3건
- 수정된 파일: 1개
```

**중요**: Committed 섹션이 너무 길어지면 (20개 이상) 오래된 기록은 삭제합니다.

### Step 7: 벡터 DB 동기화

```bash
node .claude/hooks/memory/sync-db.mjs
```

### Step 8: 결과 보고

사용자에게 결과를 보고합니다:

- 처리된 학습 항목 수
- 수정된 파일 목록
- 수정 내용 요약

---

## 사용법

```
/memory-commit
/memory-commit --threshold 0.6
```

## 옵션

- `--threshold N`: 유사도 임계값 (0.0-1.0, 기본값: 0.6)

## learnings.md 형식

```markdown
### [2026-01-29T10:15:00]
**type**: update
**confidence**: high

#### Content
- 학습한 내용 기록

#### Context
어떤 상황에서 발견했는지

---
```

## 유사도 임계값 가이드

| 임계값 | 설명 |
|--------|------|
| 0.4 | 넓은 범위 (많은 파일 후보) |
| 0.5 | 기본값 (권장) |
| 0.6 | 정밀 매칭 (가장 관련된 파일만) |
