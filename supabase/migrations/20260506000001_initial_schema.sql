-- ============================================================
-- newspaper-gps: 초기 스키마
-- ============================================================

-- 팀 테이블
CREATE TABLE teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  region      TEXT NOT NULL,
  manager_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 배포처(신문 거치대) 테이블
CREATE TABLE locations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  lat        DOUBLE PRECISION NOT NULL,
  lng        DOUBLE PRECISION NOT NULL,
  address    TEXT,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 배포자 테이블
CREATE TABLE distributors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  phone        TEXT NOT NULL,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(phone)
);

-- 배포 루트 테이블
CREATE TABLE routes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id           UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  distributor_id    UUID NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  planned_waypoints JSONB,         -- [{location_id, order}]
  last_lat          DOUBLE PRECISION,
  last_lng          DOUBLE PRECISION,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','active','paused','done')),
  started_at        TIMESTAMPTZ,
  paused_at         TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(distributor_id, date)
);

-- GPS 추적 포인트 테이블
CREATE TABLE route_gps_points (
  id          BIGSERIAL PRIMARY KEY,
  route_id    UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gps_points_route_recorded ON route_gps_points(route_id, recorded_at DESC);

-- GPS INSERT 시 routes.last_lat/lng 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_route_last_position()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE routes
  SET last_lat = NEW.lat, last_lng = NEW.lng
  WHERE id = NEW.route_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_last_position
AFTER INSERT ON route_gps_points
FOR EACH ROW EXECUTE FUNCTION update_route_last_position();

-- 배포 이벤트 테이블 (건수 입력, 잔여 초기값, 되돌리기)
CREATE TABLE distribution_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id       UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  distributor_id UUID NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  type           TEXT NOT NULL CHECK (type IN ('delivered','remaining_initial','undo')),
  count          INTEGER NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dist_events_route ON distribution_events(route_id, created_at DESC);

-- 완료 보고서 테이블
CREATE TABLE reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id       UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  distributor_id UUID NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  summary_text   TEXT,
  issues         JSONB DEFAULT '[]',    -- [{type, description, location_id?}]
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 보고서 사진 테이블
CREATE TABLE report_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id    UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

ALTER TABLE teams               ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributors        ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_gps_points    ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribution_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports             ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_photos       ENABLE ROW LEVEL SECURITY;

-- 헬퍼: 현재 사용자의 team_id 반환 (배포자)
CREATE OR REPLACE FUNCTION my_team_id()
RETURNS UUID AS $$
  SELECT team_id FROM distributors WHERE auth_user_id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 헬퍼: 현재 사용자 역할 확인
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT (raw_user_meta_data->>'role') = 'admin'
  FROM auth.users WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- teams: 관리자 전체, 배포자 자기 팀만
CREATE POLICY "teams_admin_all"        ON teams USING (is_admin());
CREATE POLICY "teams_distributor_own"  ON teams USING (id = my_team_id());

-- locations: 관리자 전체, 배포자 자기 팀만
CREATE POLICY "locations_admin_all"       ON locations USING (is_admin());
CREATE POLICY "locations_distributor_own" ON locations USING (team_id = my_team_id());

-- distributors: 관리자 전체, 배포자 자기 팀만
CREATE POLICY "distributors_admin_all"       ON distributors USING (is_admin());
CREATE POLICY "distributors_distributor_own" ON distributors USING (team_id = my_team_id());

-- routes: 관리자 전체, 배포자 자기 팀만
CREATE POLICY "routes_admin_all"       ON routes USING (is_admin());
CREATE POLICY "routes_distributor_own" ON routes USING (team_id = my_team_id());

-- route_gps_points: route를 통해 접근 권한 확인
CREATE POLICY "gps_admin_all" ON route_gps_points
  USING (is_admin());
CREATE POLICY "gps_distributor_own" ON route_gps_points
  USING (route_id IN (SELECT id FROM routes WHERE team_id = my_team_id()));

-- distribution_events: 관리자 전체, 배포자 자기 팀 route만
CREATE POLICY "events_admin_all" ON distribution_events
  USING (is_admin());
CREATE POLICY "events_distributor_own" ON distribution_events
  USING (route_id IN (SELECT id FROM routes WHERE team_id = my_team_id()));

-- reports: 관리자 전체, 배포자 본인 reports만
CREATE POLICY "reports_admin_all"       ON reports USING (is_admin());
CREATE POLICY "reports_distributor_own" ON reports
  USING (distributor_id IN (
    SELECT id FROM distributors WHERE auth_user_id = auth.uid()
  ));

-- report_photos: report를 통해 접근 권한 확인
CREATE POLICY "photos_admin_all" ON report_photos
  USING (is_admin());
CREATE POLICY "photos_distributor_own" ON report_photos
  USING (report_id IN (
    SELECT id FROM reports
    WHERE distributor_id IN (
      SELECT id FROM distributors WHERE auth_user_id = auth.uid()
    )
  ));

-- ============================================================
-- Realtime 활성화 (관리자 대시보드용)
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE distribution_events;
ALTER PUBLICATION supabase_realtime ADD TABLE routes;
ALTER PUBLICATION supabase_realtime ADD TABLE route_gps_points;
