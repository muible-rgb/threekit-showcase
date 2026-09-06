/**
 * What stands behind each event's numbers, for the methodology page.
 *
 * Condensed from docs/long_game_methodology_v1.0.0.md, which is the full
 * account with every source and every assumption. Grades and derivation
 * labels are NOT repeated here - they are read from the table itself, so they
 * cannot drift from what the app actually scores with.
 */
export interface BenchmarkNote {
  /** Key into the lookup's events. */
  event: string;
  /** One line: where the distribution comes from. */
  basis: string;
  /** The primary sources, short form. */
  sources: string[];
  /** The one thing to know before trusting the number. */
  limitation: string;
}

export const BENCHMARK_NOTES: Record<string, BenchmarkNote> = {
  mile_run: {
    event: "mile_run",
    basis:
      "VO2max reference distribution from the FRIEND registry (7,783 maximal treadmill tests, US, ages 20-79), adjusted 5% toward the general population, then converted to a mile time through the ACSM running and walking equations. Run, jog or walk - the model uses whichever gait is faster.",
    sources: [
      "Kaminsky LA, Arena R, Myers J. Mayo Clin Proc 2015;90:1515-23 (FRIEND).",
      "Wang CY et al. MSSE 2010 (NHANES 1999-2004 estimated VO2max).",
      "ACSM Guidelines, 11th ed., metabolic equations.",
    ],
    limitation:
      "A two-step conversion from a fitter-than-population source. Running economy varies 10-15% between people and is not modelled, so the tails are too tight. The top end under 30 is optimistic.",
  },
  pull_ups: {
    event: "pull_ups",
    basis:
      "No adult general-population norms exist. A hurdle model: the share who cannot do one rises from 30% of men and 80% of women at 20 to 94% and 99.5% at 89; among those who can, a log-normal count. Anchored on school fitness-test norms at 17, military entry data and training logs, all of which describe fitter groups than the population.",
    sources: [
      "National Children and Youth Fitness Study / Presidential Fitness Test norms (age 17).",
      "US Marine Corps PFT data; the women's 3-rep minimum was suspended in 2014.",
      "Strength Level crowd-sourced logs, used only as an upper bound.",
    ],
    limitation:
      "Every number is an assumption. The male zero share at 20-45 is the least trustworthy parameter in the whole framework; its plausible range moves the score for one pull-up at 30 by about 8 points either way.",
  },
  push_ups: {
    event: "push_ups",
    basis:
      "Men: Canada Fitness Survey (1981, about 15,000 people, ages 15-69), the CSEP norms reproduced in ACSM's Guidelines, with category cut-points at roughly P20, P40, P60 and P80. Women: the same survey's norms are for the modified knee push-up, converted to strict at a 0.45 ratio with an added zero share.",
    sources: [
      "Canada Fitness Survey 1981; CSEP CPAFLA / CSEP-PATH manuals.",
      "Suprak 2011, Ebben 2011 (loading of strict vs modified push-ups).",
    ],
    limitation:
      "The women's conversion from a different exercise is the weakest link, which is why women's push-ups grade C and men's B. The 1981 Canadian population was leaner than today's; expect the true middle to sit a few reps lower.",
  },
  broad_jump: {
    event: "broad_jump",
    basis:
      "Korea National Physical Fitness Survey 2017 (nationally representative, 3,763 adults aged 20-59): standing long jump means and SDs in two-year age lumps. Men 224 cm at 20 falling to 175 at 58; women 158 to 124. Past 59 the decline is extrapolated from force-plate jump-power data, with a growing share unable or unsafe to attempt.",
    sources: [
      "Korea Institute of Sport Science / KSPO 2017; analysis by Kang & Ryu (arXiv 2002.04160).",
      "Canadian Health Measures Survey cycle 5 (vertical jump, 20-69).",
      "He et al. 2023, China National Health Survey (vertical jump centiles to 80).",
    ],
    limitation:
      "An Asian-population source with no adult data past 59, so 30 years of the table is extrapolation. Older results in the app will be self-selected: people who decline the test do not enter one.",
  },
  farmer_carry: {
    event: "farmer_carry",
    basis:
      "No loaded-carry norms exist for any population. Built from grip-strength centiles (Dodds 2014, twelve British studies, 49,964 people), the Rohmert static-endurance curve for how long a grip holds a given fraction of its maximum, and age-specific loaded walking speed. Load 50 lb per hand for men, 35 for women.",
    sources: [
      "Dodds RM et al. PLoS ONE 2014;9:e113637 (grip strength across the life course).",
      "Rohmert 1960; Frey-Law & Avin 2010 (static endurance).",
      "Bohannon 1997; Bohannon & Williams Andrews 2011 (fast gait speed norms).",
    ],
    limitation:
      "Three assumed constants - handle factor, dynamic factor and the speed curve - could together move any distance by 40%. Only grip strength varies between people in the model, so the tails are too tight. Provisional until recalibrated.",
  },
  pro_agility_5_10_5: {
    event: "pro_agility_5_10_5",
    basis:
      "Published 5-10-5 norms are athlete norms. Young-adult medians (men 5.05 s, women 5.75 s) are set from recreationally active college samples shifted slower for a general population; the age shape follows the Korean 10-m shuttle to 59 and Timed-Up-and-Go norms past 60.",
    sources: [
      "Korea National Physical Fitness Survey 2017 (10-m shuttle, 20-59).",
      "Bohannon 2006 meta-analysis (Timed Up and Go, 60-99).",
      "Korhonen 2003 (masters sprint decline).",
    ],
    limitation:
      "The absolute level at every age is assumed. Hand timing adds about 0.2 s of noise, which is a full percentile band for a young adult.",
  },
  single_leg_balance_ec: {
    event: "single_leg_balance_ec",
    basis:
      "Two direct studies of eyes-closed single-leg stance, ages 18-99. Protocol strictness changes results about twofold between them; The Long Game's protocol (hands free, 60 s cap) is closer to the lenient one, so medians lean that way with the strict study as the lower bound. No sex difference in either.",
    sources: [
      "Bohannon RW et al. Phys Ther 1984;64:1067-70 (n=184, 20-79).",
      "Springer BA et al. J Geriatr Phys Ther 2007;30:8-15 (n=549, 18-99).",
      "Vereeck L et al. Int J Audiol 2008 (n=318, consistent).",
    ],
    limitation:
      "If you self-administer leniently, your score inflates. The 60 s ceiling limits discrimination above about the 88th percentile under 40; 14% of 25-year-olds reach it and tie.",
  },
  sit_to_rise: {
    event: "sit_to_rise",
    basis:
      "Araújo's Sitting-Rising Test reference scores from 6,141 adults, plus the 2,002-person mortality cohort. Modelled as a latent capability rounded to half points and clamped to 0-10, so the pile-up at 10 for young adults falls out of the rounding rather than being imposed. Fewer than 8% of adults over 55 score a perfect 10.",
    sources: [
      "Araújo CGS et al. Eur J Prev Cardiol 2020;27:888-90 (n=6,141).",
      "Brito LBB et al. Eur J Prev Cardiol 2014;21:892-8 (n=2,002, 51-80).",
    ],
    limitation:
      "The source is a private exercise-medicine clinic in Brazil, so the general population likely scores somewhat lower in mid-life. Self-scoring is more generous than an observer. Under 40, a 10 ties with the top 40-50% and scores in the mid-70s, which will feel low to a fit young user.",
  },
};

/** What the evidence grades mean, for a legend. */
export const GRADE_MEANING: Record<"A" | "B" | "C" | "D", string> = {
  A: "Strong direct normative evidence for this test and population.",
  B: "Good evidence, with a protocol or population mismatch.",
  C: "Substantial interpolation, a proxy measure, or a conversion chain.",
  D: "Provisional. No general-population norm exists; this is a model.",
};
