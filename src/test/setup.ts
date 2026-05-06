/// <reference types="vitest/globals" />
import "@testing-library/jest-dom";

// Supabase 환경변수 mock
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.NEXT_PUBLIC_KAKAO_MAP_KEY = "test-kakao-key";

// navigator.geolocation mock
Object.defineProperty(global.navigator, "geolocation", {
  value: {
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
    getCurrentPosition: vi.fn(),
  },
  configurable: true,
});

// navigator.wakeLock mock
Object.defineProperty(global.navigator, "wakeLock", {
  value: {
    request: vi.fn().mockResolvedValue({ release: vi.fn() }),
  },
  configurable: true,
});
