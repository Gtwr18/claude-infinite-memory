#!/usr/bin/env node

/**
 * Claude Learnings 커밋 준비 스크립트
 *
 * learnings.md를 파싱하고 관련 파일을 검색합니다.
 * 실제 파일 수정은 LLM(Claude)이 담당합니다.
 *
 * Usage:
 *   node commit-learnings.mjs [--threshold 0.5]
 */

import pg from 'pg';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

const LEARNINGS_PATH = '.claude/learnings.md';
const MEMORY_DIR = '.claude/memory';
const DEFAULT_THRESHOLD = 0.6;
const HYBRID_ALPHA = 0.6;

function initEnv() {
  const envPath = path.resolve('.env.ai');
  if (fs.existsSync(envPath)) {
    config({ path: envPath });
  }
}

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

// learnings.md 파싱
function parseLearnings(content) {
  const learnings = [];

  const pendingMatch = content.match(/## Pending\n([\s\S]*?)(?=\n## Committed|$)/);
  if (!pendingMatch) {
    return learnings;
  }

  const pendingSection = pendingMatch[1];

  // 새 포맷 + 기존 포맷 호환
  const entryRegex = /### \[([^\]]+)\](?:\s+([^\n]*))?\n\*\*type\*\*: (\w+)\n\*\*confidence\*\*: (\w+)\n\n#### Content\n([\s\S]*?)(?=#### Context|---|\n### \[|$)/g;

  let match;
  while ((match = entryRegex.exec(pendingSection)) !== null) {
    const [fullMatch, timestamp, legacyTarget, type, confidence, rawContent] = match;

    const contentLines = rawContent.trim().split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('-'))
      .map(line => line.substring(1).trim());

    const contextMatch = pendingSection.match(new RegExp(
      `### \\[${timestamp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\][\\s\\S]*?#### Context\\n([^#][^\\n]*)`
    ));
    const context = contextMatch ? contextMatch[1].trim() : '';

    learnings.push({
      timestamp,
      legacyTarget: legacyTarget || null,
      type,
      confidence,
      content: contentLines,
      context,
      raw: fullMatch,
    });
  }

  return learnings;
}

// Hybrid 검색으로 관련 파일 찾기
async function searchRelatedFiles(contentArray, threshold) {
  initEnv();

  const searchText = contentArray.join(' ');
  const queryEmbedding = await createEmbedding(searchText);

  if (!queryEmbedding) {
    return { files: [], error: 'Embedding 생성 실패' };
  }

  const embeddingStr = `[${queryEmbedding.join(',')}]`;
  const client = await getDbClient();

  if (!client) {
    return { files: [], error: 'DB 연결 실패' };
  }

  try {
    const result = await client.query(`
      WITH scores AS (
        SELECT DISTINCT ON (file_path)
          file_path,
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
        ($3 * vector_score + (1 - $3) * bm25_norm) as similarity
      FROM normalized
      WHERE ($3 * vector_score + (1 - $3) * bm25_norm) >= $4
      ORDER BY similarity DESC
      LIMIT 3
    `, [embeddingStr, searchText, HYBRID_ALPHA, threshold]);

    return {
      files: result.rows.map(row => ({
        filePath: row.file_path,
        similarity: row.similarity
      })),
      error: null
    };

  } catch (error) {
    return { files: [], error: error.message };
  } finally {
    await client.end();
  }
}

// 메인 함수
async function prepareLearningsCommit(options = {}) {
  const { threshold = DEFAULT_THRESHOLD } = options;

  const learningsPath = path.resolve(LEARNINGS_PATH);

  if (!fs.existsSync(learningsPath)) {
    return {
      success: false,
      error: 'learnings.md not found',
      learnings: [],
      memoryDir: path.resolve(MEMORY_DIR)
    };
  }

  const content = fs.readFileSync(learningsPath, 'utf-8');
  const learnings = parseLearnings(content);

  if (learnings.length === 0) {
    return {
      success: true,
      message: 'No pending learnings',
      learnings: [],
      memoryDir: path.resolve(MEMORY_DIR)
    };
  }

  // 각 학습 항목에 대해 관련 파일 검색
  const results = [];

  for (const learning of learnings) {
    const searchResult = await searchRelatedFiles(learning.content, threshold);

    results.push({
      ...learning,
      relatedFiles: searchResult.files,
      searchError: searchResult.error
    });
  }

  return {
    success: true,
    threshold,
    learningsPath,
    memoryDir: path.resolve(MEMORY_DIR),
    learnings: results
  };
}

// CLI
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Claude Learnings 커밋 준비

learnings.md를 파싱하고 관련 파일을 검색합니다.
실제 파일 수정은 LLM(Claude)이 담당합니다.

Usage:
  node commit-learnings.mjs [options]

Options:
  --threshold N   유사도 임계값 (0.0-1.0, 기본값: 0.6)
  --help, -h      도움말

Output:
  JSON 형식으로 learnings + 관련 파일 정보 반환
`);
  process.exit(0);
}

const options = { threshold: DEFAULT_THRESHOLD };

const thresholdIndex = args.indexOf('--threshold');
if (thresholdIndex !== -1 && args[thresholdIndex + 1]) {
  options.threshold = parseFloat(args[thresholdIndex + 1]);
}

prepareLearningsCommit(options)
  .then(result => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch(error => {
    console.log(JSON.stringify({
      success: false,
      error: error.message
    }, null, 2));
    process.exit(1);
  });
