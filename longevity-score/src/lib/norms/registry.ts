import type { NormsFile, NormsRegistry } from "@/lib/scoring/types";

import cooper from "@data/norms/v1/cooper_12min_run.json";
import deadHang from "@data/norms/v1/dead_hang.json";
import farmerCarry from "@data/norms/v1/farmer_carry_half_bw.json";
import grip from "@data/norms/v1/grip_strength_dynamometer.json";
import pushUps from "@data/norms/v1/push_ups.json";
import run400 from "@data/norms/v1/run_400m.json";
import balance from "@data/norms/v1/single_leg_balance_eyes_closed.json";
import sitRising from "@data/norms/v1/sit_rising_test.json";
import broadJump from "@data/norms/v1/standing_broad_jump.json";
import wallSit from "@data/norms/v1/wall_sit.json";

/**
 * The v1 norms set.
 *
 * Imported statically rather than read from disk so the client bundle, the
 * server, the share-card renderer and the edge all see exactly the same
 * numbers, and so a missing file is a build error rather than a runtime 500.
 *
 * The engine still takes this as an argument - it never imports this module.
 */
export const NORMS_V1: NormsFile[] = [
  grip,
  balance,
  sitRising,
  pushUps,
  broadJump,
  deadHang,
  farmerCarry,
  wallSit,
  run400,
  cooper,
] as unknown as NormsFile[];

const byslug = new Map(NORMS_V1.map((f) => [f.test_variant, f]));

export const normsRegistry: NormsRegistry = {
  get: (slug) => byslug.get(slug),
  slugs: () => [...byslug.keys()],
};

export function normsFor(slug: string): NormsFile | undefined {
  return byslug.get(slug);
}
