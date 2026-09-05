import type { NormsFile, NormsRegistry } from "@/lib/scoring/types";

import agility from "@data/norms/v2/agility_5_10_5.json";
import balance from "@data/norms/v2/balance_eyes_closed.json";
import broadJump from "@data/norms/v2/broad_jump.json";
import carry from "@data/norms/v2/farmer_carry.json";
import mile from "@data/norms/v2/mile_run.json";
import pullUps from "@data/norms/v2/pull_ups.json";
import pushUps from "@data/norms/v2/push_ups.json";
import sitToRise from "@data/norms/v2/sit_to_rise.json";

/**
 * The norms set, in battery order.
 *
 * Imported statically rather than read from disk so the browser, the server
 * and the share-card renderer all see exactly the same numbers, and so a
 * missing file is a build error rather than a runtime 500.
 *
 * The scoring engine still takes this as an argument - it never imports this
 * module.
 */
export const NORMS: NormsFile[] = [
  mile,
  pullUps,
  pushUps,
  broadJump,
  carry,
  agility,
  balance,
  sitToRise,
] as unknown as NormsFile[];

const bySlug = new Map(NORMS.map((f) => [f.test_variant, f]));

export const normsRegistry: NormsRegistry = {
  get: (slug) => bySlug.get(slug),
  slugs: () => [...bySlug.keys()],
};

export function normsFor(slug: string): NormsFile | undefined {
  return bySlug.get(slug);
}
