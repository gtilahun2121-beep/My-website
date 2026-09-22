-- =========================================================================
-- Member Invitations and Management
-- Date: 2026-09-22
-- Description: Support for member invitations and member management
-- =========================================================================

-- =========================================================================
-- MEMBER INVITATIONS TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS member_invitations (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id          UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_email       VARCHAR(255)   NOT NULL,
  equb_id             UUID           NOT NULL REFERENCES equb_groups(id) ON DELETE CASCADE,
  status              VARCHAR(20)    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  message             TEXT,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  responded_at        TIMESTAMP WITH TIME ZONE,
  UNIQUE (inviter_id, invitee_email, equb_id)
);

-- =========================================================================
-- MEMBER REMOVAL LOG
-- Tracks when members are removed and by whom (audit trail)
-- =========================================================================
CREATE TABLE IF NOT EXISTS member_removal_log (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id             UUID           NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  user_id             UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  equb_id             UUID           NOT NULL REFERENCES equb_groups(id) ON DELETE CASCADE,
  reason              TEXT           NOT NULL,
  refund_issued       BOOLEAN        DEFAULT false,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- INDEXES for Performance
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_member_invitations_status
  ON member_invitations(status);

CREATE INDEX IF NOT EXISTS idx_member_invitations_invitee
  ON member_invitations(invitee_email);

CREATE INDEX IF NOT EXISTS idx_member_invitations_equb
  ON member_invitations(equb_id);

CREATE INDEX IF NOT EXISTS idx_member_removal_log_user
  ON member_removal_log(user_id);

CREATE INDEX IF NOT EXISTS idx_member_removal_log_equb
  ON member_removal_log(equb_id);

-- =========================================================================
-- RLS POLICIES for Member Invitations
-- =========================================================================

-- Participants can view their own invitations
CREATE POLICY member_invitations_read ON member_invitations
  FOR SELECT TO public
  USING (
    invitee_email = (SELECT email FROM users WHERE id = current_user_id())
    OR inviter_id = current_user_id()
    OR current_user_role() = 'admin'
  );

-- Hosts can create invitations for their equbs
CREATE POLICY member_invitations_create ON member_invitations
  FOR INSERT TO public
  WITH CHECK (
    inviter_id = current_user_id()
    AND equb_id IN (
      SELECT id FROM equb_groups WHERE host_id = current_user_id()
    )
    OR current_user_role() = 'admin'
  );

-- Invitees can update their own invitations (accept/reject)
CREATE POLICY member_invitations_update ON member_invitations
  FOR UPDATE TO public
  USING (
    invitee_email = (SELECT email FROM users WHERE id = current_user_id())
  )
  WITH CHECK (
    invitee_email = (SELECT email FROM users WHERE id = current_user_id())
  );

-- Admins can manage removal logs
CREATE POLICY member_removal_log_read ON member_removal_log
  FOR SELECT TO public
  USING (
    current_user_role() = 'admin'
    OR user_id = current_user_id()
  );

-- Only admins can insert removal logs
CREATE POLICY member_removal_log_insert ON member_removal_log
  FOR INSERT TO public
  WITH CHECK (
    host_id = current_user_id() OR current_user_role() = 'admin'
  );

-- =========================================================================
-- Function to get pending invitations count for a user
-- =========================================================================
CREATE OR REPLACE FUNCTION get_pending_invitations_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_email VARCHAR(255);
  v_count INTEGER;
BEGIN
  SELECT email INTO v_email FROM users WHERE id = p_user_id;
  SELECT COUNT(*) INTO v_count FROM member_invitations 
  WHERE invitee_email = v_email AND status = 'pending';
  RETURN v_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- =========================================================================
-- Trigger to auto-accept membership when invitation is accepted
-- =========================================================================
CREATE OR REPLACE FUNCTION auto_create_membership_on_acceptance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Get user ID from email
    INSERT INTO memberships (user_id, equb_id)
    SELECT id, NEW.equb_id FROM users WHERE email = NEW.invitee_email
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_member_invitations_auto_accept
AFTER UPDATE ON member_invitations
FOR EACH ROW
EXECUTE FUNCTION auto_create_membership_on_acceptance();

-- =========================================================================
-- Trigger to prevent double membership through invitation system
-- =========================================================================
CREATE OR REPLACE FUNCTION prevent_duplicate_invitation()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM memberships m
    JOIN users u ON m.user_id = u.id
    WHERE u.email = NEW.invitee_email AND m.equb_id = NEW.equb_id
  ) THEN
    RAISE EXCEPTION 'User is already a member of this equb';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_prevent_duplicate_invitation
BEFORE INSERT ON member_invitations
FOR EACH ROW
EXECUTE FUNCTION prevent_duplicate_invitation();

-- =========================================================================
-- Comment for documentation
-- =========================================================================
COMMENT ON TABLE member_invitations IS
  'Stores member invitations sent by hosts to participants.
   Tracks invitation status (pending/accepted/rejected).
   When accepted, auto-creates membership record.';

COMMENT ON TABLE member_removal_log IS
  'Audit trail for member removals.
   Records who removed whom, reason, and whether refund was issued.';
