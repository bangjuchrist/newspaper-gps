import { describe, it, expect } from "vitest";

// 배포 이벤트 → 건수 계산 순수 함수 테스트
function calcDelivered(events: { type: string; count: number }[]) {
  return events.reduce((sum, e) => {
    if (e.type === "delivered") return sum + e.count;
    if (e.type === "undo") return sum - e.count;
    return sum;
  }, 0);
}

function canUndo(events: { type: string }[]) {
  if (events.length === 0) return false;
  return events[events.length - 1].type !== "undo";
}

describe("배포 건수 계산", () => {
  it("+1, +5, +10 이벤트를 합산한다", () => {
    const events = [
      { type: "delivered", count: 1 },
      { type: "delivered", count: 5 },
      { type: "delivered", count: 10 },
    ];
    expect(calcDelivered(events)).toBe(16);
  });

  it("undo는 -1 처리된다", () => {
    const events = [
      { type: "delivered", count: 5 },
      { type: "undo", count: 1 },
    ];
    expect(calcDelivered(events)).toBe(4);
  });

  it("undo 연속 2회 불가 — 마지막이 undo면 canUndo false", () => {
    const events = [
      { type: "delivered", count: 5 },
      { type: "undo", count: 1 },
    ];
    expect(canUndo(events)).toBe(false);
  });

  it("마지막이 delivered면 canUndo true", () => {
    const events = [
      { type: "delivered", count: 5 },
    ];
    expect(canUndo(events)).toBe(true);
  });

  it("이벤트가 없으면 canUndo false", () => {
    expect(canUndo([])).toBe(false);
  });
});
