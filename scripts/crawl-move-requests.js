#!/usr/bin/env node
/**
 * 창원교차로 이사 견적 크롤러 (휴먼 속도)
 *
 * 사용법:
 *   node scripts/crawl-move-requests.js
 *   node scripts/crawl-move-requests.js --from=51 --to=100
 *
 * 결과:
 *   data/move-requests.json
 *   data/move-requests.csv
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const BASE_URL = 'https://move.cwkcr.com/request';
const CHECKPOINT = path.join(DATA_DIR, 'crawl-checkpoint.json');

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => a.slice(2).split('='))
    .filter(a => a.length === 2)
);
const PAGE_FROM = parseInt(args.from ?? '1');
const PAGE_TO   = parseInt(args.to   ?? '187');

// ─── 휴먼 타이밍 유틸 ───────────────────────────────────────────

// 가우시안 랜덤 (중앙값에 몰리는 자연스러운 분포)
function gauss(mean, std) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, Math.max(500, ms)));
}

// 페이지 읽는 시간 (3~8초, 가끔 길게)
function readingDelay() {
  const roll = Math.random();
  if (roll < 0.05) return gauss(15000, 3000);  // 5%: 커피 한 모금 (15초)
  if (roll < 0.15) return gauss(9000, 1500);   // 10%: 꼼꼼히 읽기 (9초)
  return gauss(5000, 1200);                     // 85%: 일반 읽기 (5초)
}

// 페이지 넘기기 전 클릭 준비 딜레이
function clickDelay() {
  return gauss(800, 200);
}

// 마우스를 자연스럽게 곡선으로 이동
async function humanMouseMove(page, x, y) {
  const steps = Math.floor(gauss(12, 4));
  await page.mouse.move(x, y, { steps: Math.max(5, steps) });
}

// 테이블 위를 훑어보는 행동 (스크롤 + 마우스 이동)
async function simulateReading(page) {
  const viewport = page.viewportSize() ?? { width: 1280, height: 800 };

  // 스크롤 다운 (천천히, 끊어서)
  const scrollSteps = Math.floor(Math.random() * 3) + 2;
  for (let i = 0; i < scrollSteps; i++) {
    const scrollY = Math.floor(gauss(200, 60));
    await page.mouse.wheel(0, scrollY);
    await sleep(gauss(400, 150));
  }

  // 마우스를 테이블 행 몇 곳에 올려두기
  const hoverCount = Math.floor(Math.random() * 3) + 1;
  for (let i = 0; i < hoverCount; i++) {
    const x = Math.floor(Math.random() * viewport.width * 0.6 + viewport.width * 0.1);
    const y = Math.floor(Math.random() * 300 + 200);
    await humanMouseMove(page, x, y);
    await sleep(gauss(350, 100));
  }

  // 가끔 스크롤 업
  if (Math.random() < 0.3) {
    await page.mouse.wheel(0, -Math.floor(gauss(100, 40)));
    await sleep(gauss(300, 100));
  }
}

// ─── 데이터 파싱 ────────────────────────────────────────────────

function parseRow(cells) {
  if (cells.length < 5) return null;
  const addr = cells[3].replace(/\s+/g, ' ').trim();
  const parts = addr.split('➔');
  const raw = cells[1].trim();
  const dp = raw.split('.');
  const date = dp.length === 3
    ? `20${dp[0]}-${dp[1].padStart(2,'0')}-${dp[2].padStart(2,'0')}`
    : raw;
  return {
    no:     cells[0].trim(),
    date,
    year:   date.slice(0, 4),
    month:  date.slice(0, 7),
    type:   cells[2].trim(),
    from:   (parts[0] ?? '').trim(),
    to:     (parts[1] ?? '').trim(),
    status: cells[4].trim(),
  };
}

function toCSV(rows) {
  const esc = v => `"${String(v).replace(/"/g, '""')}"`;
  const header = 'no,date,year,month,type,from,to,status';
  return [header, ...rows.map(r =>
    [r.no, r.date, r.year, r.month, r.type, r.from, r.to, r.status].map(esc).join(',')
  )].join('\n');
}

// ─── 체크포인트 ─────────────────────────────────────────────────

function loadCheckpoint() {
  if (fs.existsSync(CHECKPOINT)) {
    try {
      const cp = JSON.parse(fs.readFileSync(CHECKPOINT, 'utf-8'));
      console.log(`✅ 체크포인트: ${cp.data.length}건, p.${cp.lastPage}까지 완료`);
      return cp;
    } catch { /* ignore */ }
  }
  return { data: [], lastPage: PAGE_FROM - 1 };
}

function saveCheckpoint(data, lastPage) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify({ data, lastPage }));
}

// ─── 페이지 스크레이프 ──────────────────────────────────────────

async function scrapePage(page, pageNum) {
  // 직접 URL 입력 대신 페이지네이션 링크 클릭 (가능한 경우)
  const targetUrl = `${BASE_URL}?page=${pageNum}`;
  const currentUrl = page.url();

  if (currentUrl.startsWith('https://move.cwkcr.com')) {
    // 같은 도메인이면 링크 클릭 시도
    const link = page.locator(`a[href*="page=${pageNum}"]`).first();
    const linkExists = await link.count() > 0;

    if (linkExists) {
      await sleep(clickDelay());
      const viewport = page.viewportSize() ?? { width: 1280, height: 800 };
      const box = await link.boundingBox();
      if (box) {
        // 링크 근처로 먼저 이동 후 클릭
        await humanMouseMove(page,
          box.x + box.width / 2 + gauss(0, 5),
          box.y + box.height / 2 + gauss(0, 3)
        );
        await sleep(gauss(200, 80));
        await link.click();
      } else {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      }
    } else {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }
  } else {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  }

  await page.waitForSelector('table tbody tr', { timeout: 15000 });

  const bodyText = await page.locator('body').textContent();
  if (bodyText.includes('과도한 트래픽') || bodyText.includes('접근이 차단')) {
    throw new Error('IP_BLOCKED');
  }

  // 읽는 척 행동
  await simulateReading(page);

  const rows = await page.locator('table tbody tr').all();
  const results = [];
  for (const row of rows) {
    const cells = await row.locator('td').all();
    if (cells.length < 5) continue;
    const texts = await Promise.all(cells.map(c => c.textContent()));
    const parsed = parseRow(texts);
    if (parsed) results.push(parsed);
  }
  return results;
}

// ─── 분석 요약 출력 ─────────────────────────────────────────────

function printSummary(data) {
  const byYear = {}, byMonth = {}, fromCity = {}, toCity = {}, flow = {};

  data.forEach(r => {
    byYear[r.year]   = (byYear[r.year]   || 0) + 1;
    byMonth[r.month] = (byMonth[r.month] || 0) + 1;
    const fc = r.from.split(' ')[1] ?? r.from;
    const tc = r.to.split(' ')[1]   ?? r.to;
    fromCity[fc] = (fromCity[fc] || 0) + 1;
    toCity[tc]   = (toCity[tc]   || 0) + 1;
    if (fc && tc && fc !== tc) {
      const key = `${fc} → ${tc}`;
      flow[key] = (flow[key] || 0) + 1;
    }
  });

  const top = (obj, n) => Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0, n);

  console.log('\n═══════════════════════════════════════');
  console.log('             분석 요약');
  console.log('═══════════════════════════════════════');
  console.log('\n[ 연도별 ]');
  Object.entries(byYear).sort().forEach(([y,c]) => console.log(`  ${y}: ${c}건`));
  console.log('\n[ 월별 (최근 24개월) ]');
  Object.entries(byMonth).sort().slice(-24).forEach(([m,c]) => console.log(`  ${m}: ${c}건`));
  console.log('\n[ 출발 도시 TOP 10 ]');
  top(fromCity, 10).forEach(([c,n]) => console.log(`  ${c}: ${n}건`));
  console.log('\n[ 도착 도시 TOP 10 ]');
  top(toCity, 10).forEach(([c,n]) => console.log(`  ${c}: ${n}건`));
  console.log('\n[ 시외 이동 플로우 TOP 10 ]');
  top(flow, 10).forEach(([f,n]) => console.log(`  ${f}: ${n}건`));
  const same = data.filter(r => {
    const fc = r.from.split(' ')[1];
    const tc = r.to.split(' ')[1];
    return fc && tc && fc === tc;
  }).length;
  console.log(`\n[ 이동 유형 ]`);
  console.log(`  시내: ${same}건 (${(same/data.length*100).toFixed(1)}%)`);
  console.log(`  시외: ${data.length-same}건 (${((data.length-same)/data.length*100).toFixed(1)}%)`);
}

// ─── 메인 ───────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const cp = loadCheckpoint();
  const allData = cp.data;
  const startPage = Math.max(cp.lastPage + 1, PAGE_FROM);

  if (startPage > PAGE_TO) {
    console.log('✅ 이미 수집 완료. 분석 출력합니다.');
    printSummary(allData);
    return;
  }

  const totalPages = PAGE_TO - startPage + 1;
  const estMin = Math.round(totalPages * 6 / 60);
  const estMax = Math.round(totalPages * 10 / 60);
  console.log(`\n🚀 크롤링 시작: p.${startPage} ~ p.${PAGE_TO} (${totalPages}페이지)`);
  console.log(`⏱  예상 소요: ${estMin}~${estMax}분 (휴먼 속도)\n`);

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  });

  // navigator.webdriver 숨기기
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();

  // 로그인 확인
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await sleep(gauss(2000, 500));

  if (page.url().includes('idp.kcrwork') || page.url().includes('sign')) {
    console.log('⚠️  로그인 필요. 브라우저에서 로그인 후 Enter...');
    process.stdin.resume();
    await new Promise(r => process.stdin.once('data', r));
    process.stdin.pause();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await sleep(gauss(2000, 400));
  } else {
    console.log('✅ 로그인 확인\n');
  }

  let errors = 0;
  let pagesSinceBreak = 0;

  for (let p = startPage; p <= PAGE_TO; p++) {
    try {
      // 가끔 긴 휴식 (20~30페이지마다, 커피 한잔 타오는 느낌)
      pagesSinceBreak++;
      if (pagesSinceBreak >= Math.floor(gauss(25, 5)) && p < PAGE_TO) {
        const breakTime = gauss(30000, 8000); // 약 30초 휴식
        console.log(`\n☕ 잠깐 휴식... (${Math.round(breakTime/1000)}초)`);
        await sleep(breakTime);
        pagesSinceBreak = 0;
      }

      const rows = await scrapePage(page, p);
      allData.push(...rows);
      errors = 0;

      const pct = Math.round(((p - PAGE_FROM + 1) / (PAGE_TO - PAGE_FROM + 1)) * 100);
      process.stdout.write(`\r📄 p.${p}/${PAGE_TO} (${pct}%) | 누적 ${allData.length}건   `);

      if (p % 10 === 0) {
        saveCheckpoint(allData, p);
        process.stdout.write(`\n💾 체크포인트 저장 (p.${p})\n`);
      }

      if (p < PAGE_TO) {
        const delay = readingDelay();
        await sleep(delay);
      }

    } catch (err) {
      if (err.message === 'IP_BLOCKED') {
        console.log(`\n🚫 IP 차단! --from=${p} 로 나중에 재시작하세요.`);
        saveCheckpoint(allData, p - 1);
        break;
      }
      errors++;
      console.log(`\n⚠️  p.${p} 오류: ${err.message} (${errors}/3)`);
      if (errors >= 3) { saveCheckpoint(allData, p - 1); break; }
      await sleep(gauss(8000, 2000));
      p--;
    }
  }

  await browser.close();

  const jsonOut = path.join(DATA_DIR, 'move-requests.json');
  const csvOut  = path.join(DATA_DIR, 'move-requests.csv');
  fs.writeFileSync(jsonOut, JSON.stringify(allData, null, 2), 'utf-8');
  fs.writeFileSync(csvOut,  toCSV(allData), 'utf-8');
  if (fs.existsSync(CHECKPOINT)) fs.unlinkSync(CHECKPOINT);

  console.log(`\n\n✅ 완료! 총 ${allData.length}건`);
  console.log(`📁 ${jsonOut}`);
  console.log(`📁 ${csvOut}`);
  printSummary(allData);
}

main().catch(err => {
  console.error('\n❌ 오류:', err.message);
  process.exit(1);
});
