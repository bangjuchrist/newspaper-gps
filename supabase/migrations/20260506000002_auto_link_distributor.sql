-- ============================================================
-- 배포자 자동 연결 트리거
-- 전화번호 OTP 로그인 시 distributors.auth_user_id 자동 설정
-- ============================================================

CREATE OR REPLACE FUNCTION auto_link_distributor()
RETURNS TRIGGER AS $$
DECLARE
  normalized_phone TEXT;
BEGIN
  -- Supabase phone auth는 +821012345678 형식으로 저장됨
  -- distributors 테이블은 01012345678 형식
  IF NEW.phone IS NOT NULL THEN
    -- +82XXXXXXXXX → 0XXXXXXXXX 변환
    normalized_phone := regexp_replace(NEW.phone, '^\+82', '0');

    UPDATE distributors
    SET auth_user_id = NEW.id
    WHERE (phone = normalized_phone OR phone = NEW.phone)
      AND auth_user_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- auth.users INSERT/UPDATE 시 트리거
CREATE OR REPLACE TRIGGER trg_auto_link_distributor
  AFTER INSERT OR UPDATE OF phone ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_distributor();
