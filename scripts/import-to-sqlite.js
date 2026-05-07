#!/usr/bin/env node
/**
 * 크롤링 데이터 → SQLite 변환
 * 실행: node scripts/import-to-sqlite.js
 *
 * 입력:  data/move-requests.json
 * 출력:  data/move-requests.db  (Metabase에서 연결)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const JSON_FILE = path.join(DATA_DIR, 'move-requests.json');
const DB_FILE   = path.join(DATA_DIR, 'move-requests.db');

if (!fs.existsSync(JSON_FILE)) {
  console.error('❌ data/move-requests.json 없음. 먼저 크롤링을 실행하세요.');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
console.log(`📂 데이터 로드: ${data.length}건`);

// SQLite SQL 생성
const ddl = `
DROP TABLE IF EXISTS requests;
CREATE TABLE requests (
  no      INTEGER PRIMARY KEY,
  date    TEXT,
  year    INTEGER,
  month   TEXT,
  type    TEXT,
  from_addr TEXT,
  to_addr   TEXT,
  from_city TEXT,
  to_city   TEXT,
  from_dong TEXT,
  to_dong   TEXT,
  is_local  INTEGER,
  status  TEXT
);
`;

function extractCity(addr) {
  const parts = addr.trim().split(' ');
  return parts[1] ?? addr;
}

function extractDong(addr) {
  const parts = addr.trim().split(' ');
  return parts[2] ?? '';
}

// INSERT 문 배치 생성
const BATCH = 500;
const inserts = [];

for (let i = 0; i < data.length; i += BATCH) {
  const batch = data.slice(i, i + BATCH);
  const values = batch.map(r => {
    const esc = v => String(v ?? '').replace(/'/g, "''");
    const fromCity = extractCity(r.from);
    const toCity   = extractCity(r.to);
    const fromDong = extractDong(r.from);
    const toDong   = extractDong(r.to);
    const isLocal  = fromCity === toCity ? 1 : 0;
    return `(${parseInt(r.no)||0},'${esc(r.date)}',${parseInt(r.year)||0},'${esc(r.month)}','${esc(r.type)}','${esc(r.from)}','${esc(r.to)}','${esc(fromCity)}','${esc(toCity)}','${esc(fromDong)}','${esc(toDong)}',${isLocal},'${esc(r.status)}')`;
  }).join(',\n  ');
  inserts.push(`INSERT INTO requests VALUES\n  ${values};`);
}

// 뷰 생성 (월별, 연도별, 플로우)
const views = `
-- 월별 집계 뷰
CREATE VIEW IF NOT EXISTS monthly_summary AS
SELECT
  month,
  year,
  CAST(substr(month, 6, 2) AS INTEGER) AS month_num,
  COUNT(*) AS total,
  SUM(CASE WHEN type='포장이사' THEN 1 ELSE 0 END) AS packed,
  SUM(CASE WHEN type='일반이사' THEN 1 ELSE 0 END) AS normal,
  SUM(CASE WHEN type='원룸이사' THEN 1 ELSE 0 END) AS oneroom,
  SUM(CASE WHEN is_local=1 THEN 1 ELSE 0 END) AS local_move,
  SUM(CASE WHEN is_local=0 THEN 1 ELSE 0 END) AS outer_move
FROM requests
GROUP BY month
ORDER BY month;

-- 연도별 집계 뷰
CREATE VIEW IF NOT EXISTS yearly_summary AS
SELECT
  year,
  COUNT(*) AS total,
  ROUND(COUNT(*) * 1.0 / 12, 1) AS monthly_avg,
  SUM(CASE WHEN type='포장이사' THEN 1 ELSE 0 END) AS packed,
  SUM(CASE WHEN type='일반이사' THEN 1 ELSE 0 END) AS normal,
  SUM(CASE WHEN is_local=1 THEN 1 ELSE 0 END) AS local_move,
  SUM(CASE WHEN is_local=0 THEN 1 ELSE 0 END) AS outer_move
FROM requests
GROUP BY year
ORDER BY year;

-- 출발 도시별 집계 뷰
CREATE VIEW IF NOT EXISTS from_city_summary AS
SELECT from_city, COUNT(*) AS cnt
FROM requests
WHERE from_city != ''
GROUP BY from_city
ORDER BY cnt DESC;

-- 도착 도시별 집계 뷰
CREATE VIEW IF NOT EXISTS to_city_summary AS
SELECT to_city, COUNT(*) AS cnt
FROM requests
WHERE to_city != ''
GROUP BY to_city
ORDER BY cnt DESC;

-- 시외 이동 플로우 뷰
CREATE VIEW IF NOT EXISTS flow_summary AS
SELECT
  from_city,
  to_city,
  COUNT(*) AS cnt
FROM requests
WHERE is_local = 0 AND from_city != '' AND to_city != ''
GROUP BY from_city, to_city
ORDER BY cnt DESC;
`;

// SQL 파일 작성
const sqlFile = path.join(DATA_DIR, '_import.sql');
fs.writeFileSync(sqlFile, [ddl, ...inserts, views].join('\n'), 'utf-8');

// 기존 DB 삭제 후 생성
if (fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE);

console.log('⚙️  SQLite DB 생성 중...');
execSync(`sqlite3 "${DB_FILE}" < "${sqlFile}"`, { stdio: 'inherit' });
fs.unlinkSync(sqlFile);

// 검증
const result = execSync(`sqlite3 "${DB_FILE}" "SELECT COUNT(*) FROM requests;"`, { encoding: 'utf-8' }).trim();
console.log(`✅ 완료! requests 테이블: ${result}건`);
console.log(`📁 ${DB_FILE}`);
console.log('\n--- 뷰 목록 ---');
const views_list = execSync(`sqlite3 "${DB_FILE}" ".tables"`, { encoding: 'utf-8' }).trim();
console.log(views_list);
console.log('\n--- 월별 요약 (최근 12개월) ---');
const monthly = execSync(`sqlite3 "${DB_FILE}" "SELECT month, total, packed, normal, local_move, outer_move FROM monthly_summary ORDER BY month DESC LIMIT 12;"`, { encoding: 'utf-8' }).trim();
console.log(monthly);
