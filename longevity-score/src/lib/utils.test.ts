import { describe, expect, it } from "vitest";
import {
  ageBandLabel,
  betterThanSentence,
  formatRaw,
  formatSigned,
  oneDecimal,
  ordinal,
  rawImproved,
} from "./utils";

describe("rawImproved", () => {
  it("treats a bigger number as better on a higher-is-better test", () => {
    expect(rawImproved("higher_better", 5)).toBe(true);
    expect(rawImproved("higher_better", -5)).toBe(false);
  });

  it("treats a smaller number as better on a lower-is-better test", () => {
    // A faster 400m is a negative raw delta and an improvement.
    expect(rawImproved("lower_better", -18.1)).toBe(true);
    expect(rawImproved("lower_better", 4)).toBe(false);
  });

  it("says nothing when the number did not move", () => {
    expect(rawImproved("higher_better", 0)).toBeNull();
    expect(rawImproved("lower_better", 0)).toBeNull();
  });
});

describe("formatRaw", () => {
  it("shows times under a minute in seconds", () => {
    expect(formatRaw(44.6, "s")).toBe("44.6s");
  });
  it("shows times over a minute as minutes and seconds", () => {
    expect(formatRaw(66.5, "s")).toBe("1:06.5");
    expect(formatRaw(125.4, "s")).toBe("2:05.4");
  });
  it("rounds reps to whole numbers", () => {
    expect(formatRaw(29, "reps")).toBe("29");
  });
  it("keeps a decimal on kilos and points", () => {
    expect(formatRaw(57.5, "kg")).toBe("57.5 kg");
    expect(formatRaw(9.5, "points")).toBe("9.5");
  });
});

describe("formatSigned", () => {
  it("always shows the sign on a gain", () => {
    expect(formatSigned(4.25)).toBe("+4.3");
    expect(formatSigned(-4.25)).toBe("-4.3");
    expect(formatSigned(0)).toBe("0.0");
  });
});

describe("oneDecimal", () => {
  it("keeps the decimal even when it is zero", () => {
    expect(oneDecimal(74)).toBe("74.0");
    expect(oneDecimal(74.34)).toBe("74.3");
  });
});

describe("betterThanSentence", () => {
  it("uses the right group for each sex", () => {
    expect(betterThanSentence(74.3, "M")).toBe("Better than 74% of men your age");
    expect(betterThanSentence(74.3, "F")).toBe("Better than 74% of women your age");
  });
});

describe("ageBandLabel", () => {
  it("labels the five-year band", () => {
    expect(ageBandLabel(43, "M")).toBe("M 40-44");
    expect(ageBandLabel(78, "F")).toBe("F 75-79");
  });
});

describe("ordinal", () => {
  it("handles the awkward ones", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(4)).toBe("4th");
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(13)).toBe("13th");
    expect(ordinal(21)).toBe("21st");
  });
});
