#!/usr/bin/env node
/**
 * check-learnings.mjs
 *
 * learnings.md의 Pending 항목 수를 체크하고,
 * threshold 이상이면 Memory 업데이트를 제안합니다.
 *
 * Usage: node check-learnings.mjs
 */

import fs from 'fs';
import path from 'path';

const LEARNINGS_FILE = '.claude/learnings.md';
const PENDING_THRESHOLD = 5; // 5개 이상이면 flush 제안

function countPendingItems() {
  const filePath = path.resolve(LEARNINGS_FILE);

  if (!fs.existsSync(filePath)) {
    return 0;
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // ## Pending 섹션과 ## Committed 섹션 사이의 내용 추출
  const pendingMatch = content.match(/## Pending\n([\s\S]*?)(?=\n## Committed|$)/);
  if (!pendingMatch) {
    return 0;
  }

  const pendingSection = pendingMatch[1];

  // ### [타임스탬프] 패턴으로 항목 수 카운트
  const itemMatches = pendingSection.match(/### \[\d{4}-\d{2}-\d{2}T/g);

  return itemMatches ? itemMatches.length : 0;
}

function main() {
  const count = countPendingItems();

  if (count >= PENDING_THRESHOLD) {
    console.log(`<memory-flush-suggested>`);
    console.log(`pending_count: ${count}`);
    console.log(`threshold: ${PENDING_THRESHOLD}`);
    console.log(`message: learnings.md에 ${count}개의 학습 항목이 쌓였습니다.`);
    console.log(`action: /memory-commit 명령으로 Memory에 반영하고 learnings.md를 정리하세요.`);
    console.log(`</memory-flush-suggested>`);
  }
}

main();
