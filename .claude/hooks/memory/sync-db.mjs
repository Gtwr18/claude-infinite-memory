#!/usr/bin/env node
/**
 * sync-db.mjs
 *
 * .claude/memory/ 폴더의 마크다운 파일들을 PostgreSQL 벡터 DB와 동기화합니다.
 *
 * Usage: node sync-db.mjs
 */

import pg from 'pg';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const MEMORY_DIR = '.claude/memory';
const CHUNK_SIZE = 1000; // 청크당 최대 문자 수

function initEnv() {
  const envPath = path.resolve('.env.ai');
  if (fs.existsSync(envPath)) {
    config({ path: envPath });
  }
}

async function createEmbedding(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
  }

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
  if (data.error) {
    throw new Error(data.error.message);
  }

  return data.data?.[0]?.embedding || null;
}

async function getDbClient() {
  const client = new pg.Client({
    host: process.env.AI_VECTOR_DB_HOST || 'localhost',
    port: parseInt(process.env.AI_VECTOR_DB_PORT || '5432'),
    user: process.env.AI_VECTOR_DB_USER || 'postgres',
    password: process.env.AI_VECTOR_DB_PASSWORD || '',
    database: process.env.AI_VECTOR_DB_NAME || 'ai_memory'
  });
  await client.connect();
  return client;
}

// 마크다운 파일을 청크로 분할
function chunkMarkdown(content, maxSize = CHUNK_SIZE) {
  const chunks = [];
  const sections = content.split(/\n(?=##?\s)/); // 헤딩 기준 분할

  let currentChunk = '';

  for (const section of sections) {
    if (currentChunk.length + section.length > maxSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = section;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + section;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [content];
}

// 파일 해시 계산
function calculateHash(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

// 로컬 메모리 파일 스캔
function scanLocalFiles(dir) {
  const files = {};
  const memoryPath = path.resolve(dir);

  if (!fs.existsSync(memoryPath)) {
    return files;
  }

  function scan(currentPath, relativePath = '') {
    const items = fs.readdirSync(currentPath);

    for (const item of items) {
      // README, 숨김 파일 제외
      if (item.startsWith('.') || item === 'README.md' || item === 'README2.md') {
        continue;
      }

      const fullPath = path.join(currentPath, item);
      const relPath = path.join(relativePath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scan(fullPath, relPath);
      } else if (item.endsWith('.md')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const domain = relativePath.split(path.sep)[0] || 'common';

        files[`memory/${relPath}`] = {
          content,
          hash: calculateHash(content),
          domain
        };
      }
    }
  }

  scan(memoryPath);
  return files;
}

// DB에서 기존 파일 정보 조회
async function getDbFiles(client) {
  const result = await client.query(`
    SELECT DISTINCT file_path, metadata->>'hash' as hash
    FROM claude_memory
  `);

  const files = {};
  for (const row of result.rows) {
    files[row.file_path] = row.hash;
  }
  return files;
}

// 파일 동기화
async function syncFile(client, filePath, fileInfo) {
  const chunks = chunkMarkdown(fileInfo.content);

  // 기존 청크 삭제
  await client.query('DELETE FROM claude_memory WHERE file_path = $1', [filePath]);

  // 새 청크 삽입
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = await createEmbedding(chunk);

    if (!embedding) {
      console.error(`   ⚠️ 임베딩 생성 실패: ${filePath} 청크 ${i}`);
      continue;
    }

    const embeddingStr = `[${embedding.join(',')}]`;

    await client.query(`
      INSERT INTO claude_memory (file_path, chunk_index, content, embedding, metadata)
      VALUES ($1, $2, $3, $4::vector, $5)
    `, [
      filePath,
      i,
      chunk,
      embeddingStr,
      JSON.stringify({
        domain: fileInfo.domain,
        hash: fileInfo.hash,
        updatedAt: new Date().toISOString()
      })
    ]);
  }

  return chunks.length;
}

async function main() {
  console.log('📚 Claude Memory DB 동기화 시작...\n');

  initEnv();

  const localFiles = scanLocalFiles(MEMORY_DIR);
  console.log(`📁 로컬 파일 스캔: ${Object.keys(localFiles).length}개 파일 발견`);

  const client = await getDbClient();

  try {
    const dbFiles = await getDbFiles(client);
    console.log(`📊 DB 기존 파일: ${Object.keys(dbFiles).length}개\n`);

    const toAdd = [];
    const toUpdate = [];
    const toDelete = [];

    // 추가/수정 대상 파악
    for (const [filePath, fileInfo] of Object.entries(localFiles)) {
      if (!dbFiles[filePath]) {
        toAdd.push(filePath);
      } else if (dbFiles[filePath] !== fileInfo.hash) {
        toUpdate.push(filePath);
      }
    }

    // 삭제 대상 파악
    for (const filePath of Object.keys(dbFiles)) {
      if (!localFiles[filePath]) {
        toDelete.push(filePath);
      }
    }

    console.log('📝 변경 사항:');
    console.log(`   - 추가: ${toAdd.length}개`);
    console.log(`   - 수정: ${toUpdate.length}개`);
    console.log(`   - 삭제: ${toDelete.length}개\n`);

    // 추가
    for (const filePath of toAdd) {
      console.log(`➕ 추가: ${filePath}`);
      const chunkCount = await syncFile(client, filePath, localFiles[filePath]);
      console.log(`   청크 수: ${chunkCount}`);
      console.log(`   임베딩 생성 중...`);
      console.log(`   ✓ 완료\n`);
    }

    // 수정
    for (const filePath of toUpdate) {
      console.log(`🔄 수정: ${filePath}`);
      const chunkCount = await syncFile(client, filePath, localFiles[filePath]);
      console.log(`   청크 수: ${chunkCount}`);
      console.log(`   임베딩 생성 중...`);
      console.log(`   ✓ 완료\n`);
    }

    // 삭제
    for (const filePath of toDelete) {
      console.log(`➖ 삭제: ${filePath}`);
      await client.query('DELETE FROM claude_memory WHERE file_path = $1', [filePath]);
      console.log(`   ✓ 완료\n`);
    }

    console.log('✅ 동기화 완료!');
    console.log(`   - ${toAdd.length}개 추가, ${toUpdate.length}개 수정, ${toDelete.length}개 삭제`);

  } finally {
    await client.end();
  }
}

main().catch(error => {
  console.error('❌ 동기화 실패:', error.message);
  process.exit(1);
});
