-- 커스텀 OTP 코드 테이블 (Supabase phone provider 대체)
CREATE TABLE IF NOT EXISTS otp_codes (
  phone       TEXT PRIMARY KEY,
  code        TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  attempts    INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 만료된 OTP 자동 정리 (선택)
CREATE INDEX IF NOT EXISTS otp_codes_expires_at_idx ON otp_codes (expires_at);
