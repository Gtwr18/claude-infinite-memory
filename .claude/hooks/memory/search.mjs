#!/usr/bin/env node
/**
 * search.mjs
 *
 * Memory 벡터 검색 CLI
 *
 * Usage:
 *   node search.mjs "검색어"
 *   node search.mjs "검색어" --hybrid --alpha 0.6
 *   node search.mjs "검색어" --json
 */

import pg from 'pg';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

const DEFAULT_TOP_K = 5;
const DEFAULT_THRESHOLD = 0.3;
const DEFAULT_HYBRID_ALPHA = 0.6;

function initEnv() {
  const envPath = path.resolve('.env.ai');
  if (fs.existsSync(envPath)) {
    config({ path: envPath });
  }
}

async function createEmbedding(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY가 설정되지 않았습니다.');
    return null;
  }

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
    console.error('임베딩 생성 실패:', error.message);
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
    console.error('DB 연결 실패:', error.message);
    return null;
  }
}

// Vector 검색
async function searchMemoryVector(query, options = {}) {
  const {
    topK = DEFAULT_TOP_K,
    threshold = DEFAULT_THRESHOLD,
    outputFormat = 'text'
  } = options;

  initEnv();

  const queryEmbedding = await createEmbedding(query);
  if (!queryEmbedding) {
    if (outputFormat === 'json') return [];
    return [];
  }

  const embeddingStr = `[${queryEmbedding.join(',')}]`;
  const client = await getDbClient();
  if (!client) {
    if (outputFormat === 'json') return [];
    return [];
  }

  try {
    const result = await client.query(`
      SELECT
        file_path,
        chunk_index,
        content,
        metadata,
        1 - (embedding <=> $1::vector) as similarity
      FROM claude_memory
      WHERE 1 - (embedding <=> $1::vector) >= $2
      ORDER BY similarity DESC
      LIMIT $3
    `, [embeddingStr, threshold, topK]);

    if (outputFormat === 'json') {
      return result.rows;
    }

    if (result.rows.length === 0) {
      console.log('검색 결과가 없습니다.');
      return [];
    }

    console.log(`\n🔍 "${query}" 검색 결과:\n`);
    console.log('─'.repeat(70));

    for (const row of result.rows) {
      const similarity = (row.similarity * 100).toFixed(1);
      console.log(`\n📄 ${row.file_path} (청크 #${row.chunk_index})`);
      console.log(`   유사도: ${similarity}%`);
      console.log('─'.repeat(70));

      const preview = row.content.substring(0, 500);
      console.log(preview);
      if (row.content.length > 500) {
        console.log('...(생략)');
      }
      console.log('─'.repeat(70));
    }

    return result.rows;

  } finally {
    await client.end();
  }
}

// Hybrid 검색 (Vector + BM25)
async function searchMemoryHybrid(query, options = {}) {
  const {
    topK = DEFAULT_TOP_K,
    alpha = DEFAULT_HYBRID_ALPHA,
    outputFormat = 'text'
  } = options;

  initEnv();

  const queryEmbedding = await createEmbedding(query);
  if (!queryEmbedding) {
    if (outputFormat === 'json') return [];
    return [];
  }

  const embeddingStr = `[${queryEmbedding.join(',')}]`;
  const client = await getDbClient();
  if (!client) {
    if (outputFormat === 'json') return [];
    return [];
  }

  try {
    const sql = `
      WITH scores AS (
        SELECT
          file_path,
          chunk_index,
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
        chunk_index,
        content,
        metadata,
        vector_score,
        bm25_norm as bm25_score,
        ($3 * vector_score + (1 - $3) * bm25_norm) as hybrid_score
      FROM normalized
      ORDER BY hybrid_score DESC
      LIMIT $4
    `;

    const result = await client.query(sql, [embeddingStr, query, alpha, topK]);

    if (outputFormat === 'json') {
      return result.rows;
    }

    if (result.rows.length === 0) {
      console.log('검색 결과가 없습니다.');
      return [];
    }

    console.log(`\n🔍 "${query}" Hybrid 검색 결과 (α=${alpha}):\n`);
    console.log(`   BM25 + Vector (${(alpha*100).toFixed(0)}% vec / ${((1-alpha)*100).toFixed(0)}% bm25)`);
    console.log('─'.repeat(70));

    for (const row of result.rows) {
      const vectorPct = (row.vector_score * 100).toFixed(1);
      const bm25Pct = (row.bm25_score * 100).toFixed(1);
      const hybridPct = (row.hybrid_score * 100).toFixed(1);

      console.log(`\n📄 ${row.file_path} (청크 #${row.chunk_index})`);
      console.log(`   Hybrid: ${hybridPct}% | Vector: ${vectorPct}% | BM25: ${bm25Pct}%`);
      console.log('─'.repeat(70));

      const preview = row.content.substring(0, 500);
      console.log(preview);
      if (row.content.length > 500) {
        console.log('...(생략)');
      }
      console.log('─'.repeat(70));
    }

    return result.rows;

  } finally {
    await client.end();
  }
}

// CLI 파싱
function parseArgs(args) {
  const options = {
    query: '',
    hybrid: false,
    alpha: DEFAULT_HYBRID_ALPHA,
    topK: DEFAULT_TOP_K,
    threshold: DEFAULT_THRESHOLD,
    json: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--hybrid' || arg === '-H') {
      options.hybrid = true;
    } else if (arg === '--alpha' || arg === '-a') {
      options.alpha = parseFloat(args[++i]) || DEFAULT_HYBRID_ALPHA;
    } else if (arg === '--limit' || arg === '-l') {
      options.topK = parseInt(args[++i]) || DEFAULT_TOP_K;
    } else if (arg === '--threshold' || arg === '-t') {
      options.threshold = parseFloat(args[++i]) || DEFAULT_THRESHOLD;
    } else if (arg === '--json' || arg === '-j') {
      options.json = true;
    } else if (!arg.startsWith('-')) {
      options.query = arg;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Memory Search CLI

Usage:
  node search.mjs "검색어" [options]

Options:
  --hybrid, -H    Hybrid 검색 (Vector + BM25 결합)
  --alpha, -a     Hybrid 가중치 (기본: 0.6 = Vector 60%)
  --limit, -l     결과 개수 (기본: 5)
  --threshold, -t 최소 유사도 (기본: 0.3)
  --json, -j      JSON 출력

Examples:
  node search.mjs "재고 관리"
  node search.mjs "재고 관리" --hybrid
  node search.mjs "재고 관리" --hybrid --alpha 0.5
  node search.mjs "재고 관리" --json
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  const options = parseArgs(args);

  if (!options.query) {
    console.error('검색어를 입력하세요.');
    return;
  }

  const outputFormat = options.json ? 'json' : 'text';

  let results;
  if (options.hybrid) {
    results = await searchMemoryHybrid(options.query, {
      topK: options.topK,
      alpha: options.alpha,
      outputFormat
    });
  } else {
    results = await searchMemoryVector(options.query, {
      topK: options.topK,
      threshold: options.threshold,
      outputFormat
    });
  }

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
  }
}

main().catch(console.error);
