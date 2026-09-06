import { describe, expect, it } from "vitest";
import {
  ageBandLabel,
  COMPOSITE_CAPTION,
  percentileSentence,
  formatRaw,
  formatRawDelta,
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
  it("shows a running time as minutes and seconds", () => {
    expect(formatRaw(462, "s")).toBe("7:42");
    expect(formatRaw(605, "s")).toBe("10:05");
  });
  it("shows a stopwatch reading under a minute with its decimal", () => {
    expect(formatRaw(5.62, "s")).toBe("5.62s");
    expect(formatRaw(44.5, "s")).toBe("44.5s");
    expect(formatRaw(30, "s")).toBe("30s");
  });
  it("shows a jump in feet and inches", () => {
    expect(formatRaw(78, "in")).toBe(`6'6"`);
    expect(formatRaw(96, "in")).toBe(`8'0"`);
    expect(formatRaw(11, "in")).toBe(`11"`);
  });
  it("rounds reps and distances to whole numbers", () => {
    expect(formatRaw(29, "reps")).toBe("29");
    expect(formatRaw(280, "ft")).toBe("280 ft");
    expect(formatRaw(182.4, "lb")).toBe("182 lb");
  });
  it("keeps a decimal on points", () => {
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

describe("percentileSentence", () => {
  it("says a single test's percentile properly, for the right group and age", () => {
    expect(percentileSentence(84.2, "F", 74)).toBe("84th percentile among women age 74");
    expect(percentileSentence(51, "M", 39)).toBe("51st percentile among men age 39");
  });
});

describe("COMPOSITE_CAPTION", () => {
  it("never calls the composite a percentile", () => {
    expect(COMPOSITE_CAPTION).not.toMatch(/better than|th percentile/i);
    expect(COMPOSITE_CAPTION).toMatch(/mean/i);
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

describe("formatRawDelta", () => {
  it("shows a big time change as minutes and seconds", () => {
    // A 148-second mile improvement read as "-148.0" before. Nobody thinks
    // about a mile that way.
    expect(formatRawDelta(-148, "s")).toBe("-2:28");
    expect(formatRawDelta(75, "s")).toBe("+1:15");
  });
  it("keeps a small time change on the stopwatch scale", () => {
    expect(formatRawDelta(-0.34, "s")).toBe("-0.34s");
    expect(formatRawDelta(12.5, "s")).toBe("+12.5s");
  });
  it("uses each unit's own shape", () => {
    expect(formatRawDelta(3, "reps")).toBe("+3");
    expect(formatRawDelta(-9, "in")).toBe(`-9"`);
    expect(formatRawDelta(50, "ft")).toBe("+50 ft");
    expect(formatRawDelta(-0.5, "points")).toBe("-0.5");
  });
});
