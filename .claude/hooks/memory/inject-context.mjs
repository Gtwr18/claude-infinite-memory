#!/usr/bin/env node
/**
 * inject-context.mjs
 *
 * 사용자 요청에 대해 Memory에서 관련 컨텍스트를 검색하고 주입합니다.
 * Hybrid 검색 (Vector + BM25)을 사용합니다.
 *
 * Usage: node inject-context.mjs "사용자 질문"
 */

import pg from 'pg';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

// 설정
const SIMILARITY_THRESHOLD = 0.3;    // 검색용 최소 임계값
const LEARNING_THRESHOLD = 0.65;     // 0.65 미만이면 memory-learning 필요
const HYBRID_ALPHA = 0.6;            // Hybrid 검색: 벡터 60%, BM25 40%
const TOP_K = 5;

// 환경변수 로드
function initEnv() {
  const envPath = path.resolve('.env.ai');
  if (fs.existsSync(envPath)) {
    config({ path: envPath });
  }
}

// OpenAI 임베딩 생성
async function createEmbedding(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text
      })
    });

    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch (error) {
    return null;
  }
}

// DB 연결
async function getDbClient() {
  try {
    const client = new pg.Client({
      host: process.env.AI_VECTOR_DB_HOST || 'localhost',
      port: parseInt(process.env.AI_VECTOR_DB_PORT || '5432'),
      user: process.env.AI_VECTOR_DB_USER || 'postgres',
      password: process.env.AI_VECTOR_DB_PASSWORD || '',
      database: process.env.AI_VECTOR_DB_NAME || 'ai_memory'
    });
    await client.connect();
    return client;
  } catch (error) {
    return null;
  }
}

// Hybrid 검색 (Vector + BM25)
async function searchMemory(query) {
  initEnv();

  const queryEmbedding = await createEmbedding(query);
  if (!queryEmbedding) {
    return [];
  }

  const embeddingStr = `[${queryEmbedding.join(',')}]`;
  const client = await getDbClient();
  if (!client) {
    return [];
  }

  try {
    // Hybrid 쿼리: Vector 유사도 + BM25 (ts_rank) 결합
    const result = await client.query(`
      WITH scores AS (
        SELECT
          file_path,
          content,
          metadata,
          1 - (embedding <=> $1::vector) as vector_score,
          COALESCE(ts_rank(content_tsv, plainto_tsquery('simple', $2)), 0) as bm25_score
        FROM claude_memory
      ),
      normalized AS (
        SELECT *,
          CASE WHEN MAX(bm25_score) OVER () > 0
               THEN bm25_score / MAX(bm25_score) OVER ()
               ELSE 0 END as bm25_norm
        FROM scores
      )
      SELECT
        file_path,
        content,
        metadata,
        vector_score,
        bm25_norm as bm25_score,
        ($3 * vector_score + (1 - $3) * bm25_norm) as similarity
      FROM normalized
      WHERE ($3 * vector_score + (1 - $3) * bm25_norm) >= $4
      ORDER BY similarity DESC
      LIMIT $5
    `, [embeddingStr, query, HYBRID_ALPHA, SIMILARITY_THRESHOLD, TOP_K]);

    return result.rows;

  } catch (error) {
    return [];
  } finally {
    await client.end();
  }
}

// 컨텍스트 포맷팅
function formatContext(results, maxSimilarity) {
  // 유사도가 낮으면 memory-learning 필요 표시
  if (results.length === 0 || maxSimilarity < LEARNING_THRESHOLD) {
    let output = '\n<memory-learning-required>\n';
    output += `max_similarity: ${(maxSimilarity * 100).toFixed(0)}%\n`;
    output += `threshold: ${(LEARNING_THRESHOLD * 100).toFixed(0)}%\n`;
    output += 'reason: 관련 Memory가 부족합니다. memory-learner 서브에이전트를 호출하여 코드베이스에서 정보를 수집하고 Memory를 최신화한 후 작업을 진행하세요.\n';

    if (results.length > 0) {
      output += '\n## 참고 (낮은 유사도)\n';
      for (const row of results.slice(0, 2)) {
        const similarity = (row.similarity * 100).toFixed(0);
        const filename = row.file_path.split('/').pop();
        output += `- ${filename} (${similarity}%)\n`;
      }
    }

    output += '</memory-learning-required>\n';
    return output;
  }

  // 유사도 충분 - 컨텍스트 출력
  let output = '\n<memory-context>\n';
  output += `# Related Business Context (Auto-injected from Memory)\n`;
  output += `# max_similarity: ${(maxSimilarity * 100).toFixed(0)}%\n\n`;

  // 도메인별 그룹화
  const byDomain = {};
  for (const row of results) {
    if (row.similarity < LEARNING_THRESHOLD) continue;

    const domain = row.metadata?.domain || 'common';
    if (!byDomain[domain]) {
      byDomain[domain] = [];
    }
    byDomain[domain].push(row);
  }

  for (const [domain, rows] of Object.entries(byDomain)) {
    output += `## ${domain.toUpperCase()}\n\n`;

    for (const row of rows) {
      const similarity = (row.similarity * 100).toFixed(0);
      const filename = row.file_path.split('/').pop();
      output += `### ${filename} (${similarity}% match)\n\n`;

      // 내용 일부만 표시 (너무 길면 truncate)
      const content = row.content.length > 2000
        ? row.content.substring(0, 2000) + '\n...(truncated)'
        : row.content;
      output += content + '\n\n';
    }
  }

  output += '</memory-context>\n';
  return output;
}

// 메인
async function main() {
  const query = process.argv[2];

  if (!query || query.trim() === '') {
    return;
  }

  const results = await searchMemory(query);
  const maxSimilarity = results.length > 0
    ? Math.max(...results.map(r => r.similarity))
    : 0;

  const output = formatContext(results, maxSimilarity);
  console.log(output);
}

main().catch(() => {});
