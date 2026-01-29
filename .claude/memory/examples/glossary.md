# Glossary (용어집)

프로젝트 전반에서 사용되는 핵심 용어 정의입니다.

## Core Concepts

| 용어 | 설명 |
|------|------|
| **Entity** | 데이터베이스 테이블과 매핑되는 객체 |
| **Service** | 비즈니스 로직을 처리하는 계층 |
| **Controller** | API 엔드포인트 진입점 |
| **Repository** | 데이터 접근 계층 |

## Status Values

| 상태 | 설명 |
|------|------|
| `ACTIVE` | 활성 상태 |
| `INACTIVE` | 비활성 상태 |
| `PENDING` | 대기 중 |
| `COMPLETED` | 완료됨 |

## Soft Delete Pattern

```sql
-- 활성 데이터만 조회
WHERE deletedAt IS NULL
```
