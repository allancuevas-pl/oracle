import { expect, test, describe } from "vitest";
import { normaliseCompDate, normaliseCompDateFields, noteForRawDate } from "./compDates";

/**
 * The bug these prevent: a comp date field is a plain string, and the browse
 * recency filter compares it with a Convex `gte` — lexicographic on strings.
 * "Upon Completion" starts with "U" (85), which sorts above "2" (50), so it
 * passes every "since" filter while a genuine 2019 comp is excluded. The junk
 * rows were the ones surviving the filter.
 */
describe("normaliseCompDate", () => {
  test("passes a real ISO date through untouched", () => {
    expect(normaliseCompDate("2025-06-01")).toEqual({ date: "2025-06-01" });
  });

  test("keeps unparseable text as raw, never as a date", () => {
    // The five live offenders.
    expect(normaliseCompDate("Upon Completion")).toEqual({ raw: "Upon Completion" });
    expect(normaliseCompDate("Q4 25")).toEqual({ raw: "Q4 25" });
    expect(normaliseCompDate("Q1 26")).toEqual({ raw: "Q1 26" });
  });

  test("quarters are deliberately NOT guessed", () => {
    // Calendar Q4 and Australian financial-year Q4 are six months apart and
    // the source rarely says which. A wrong date in a valuation record is
    // worse than no date plus the original text.
    expect(normaliseCompDate("Q4 25").date).toBeUndefined();
  });

  test("a year-month becomes the first of the month", () => {
    expect(normaliseCompDate("2025-06")).toEqual({ date: "2025-06-01" });
  });

  test("reads slashed dates day-first, the Australian convention", () => {
    expect(normaliseCompDate("03/04/2025")).toEqual({ date: "2025-04-03" });
    expect(normaliseCompDate("3/4/2025")).toEqual({ date: "2025-04-03" });
    // Unambiguous case — 25 can only be the day.
    expect(normaliseCompDate("25/12/2024")).toEqual({ date: "2024-12-25" });
  });

  test("handles a year-first slashed date too", () => {
    expect(normaliseCompDate("2025/6/1")).toEqual({ date: "2025-06-01" });
  });

  test("parses month names", () => {
    expect(normaliseCompDate("Mar 2025")).toEqual({ date: "2025-03-01" });
    expect(normaliseCompDate("March 2025")).toEqual({ date: "2025-03-01" });
    expect(normaliseCompDate("Sep 2025")).toEqual({ date: "2025-09-01" });
    // Abbreviations longer than three letters, with or without the period,
    // are matched on their first three — agents write all of these.
    expect(normaliseCompDate("Sept. 2025")).toEqual({ date: "2025-09-01" });
    expect(normaliseCompDate("Sept 2025")).toEqual({ date: "2025-09-01" });
    // But a word that merely looks like one is not forced into a month.
    expect(normaliseCompDate("Settlement 2025").date).toBeUndefined();
  });

  test("rejects a date that matches the shape but isn't real", () => {
    // A regex match is not a calendar check.
    expect(normaliseCompDate("2025-02-31")).toEqual({ raw: "2025-02-31" });
    expect(normaliseCompDate("2025-13-01")).toEqual({ raw: "2025-13-01" });
    expect(normaliseCompDate("31/02/2025")).toEqual({ raw: "31/02/2025" });
  });

  test("empty input is neither a date nor a note", () => {
    expect(normaliseCompDate(undefined)).toEqual({});
    expect(normaliseCompDate(null)).toEqual({});
    expect(normaliseCompDate("")).toEqual({});
    expect(normaliseCompDate("   ")).toEqual({});
  });

  test("the whole point: junk no longer outranks a real date", () => {
    const cutoff = "2024-09-01";
    // Before: every one of these passed a "since Sep 2024" filter.
    for (const junk of ["Upon Completion", "Q4 25", "Q1 26"]) {
      expect(junk >= cutoff).toBe(true);              // the old behaviour
      expect(normaliseCompDate(junk).date).toBeUndefined(); // now it stores nothing
    }
    // A real recent date still passes, and a real old one still doesn't.
    expect(normaliseCompDate("2026-03-01").date! >= cutoff).toBe(true);
    expect(normaliseCompDate("2019-01-01").date! >= cutoff).toBe(false);
  });
});

describe("normaliseCompDateFields — the write-path shape", () => {
  test("clears the junk date and keeps the text in notes", () => {
    // Losing "Upon Completion" entirely would destroy real information about
    // the lease. It just isn't a date.
    const out = normaliseCompDateFields({ leaseDate: "Upon Completion" });
    expect(out.leaseDate).toBeUndefined();
    expect(out.notes).toContain("Upon Completion");
  });

  test("appends to existing notes rather than overwriting them", () => {
    const out = normaliseCompDateFields({
      leaseDate: "Q4 25",
      notes: "Agent said rent is net.",
    });
    expect(out.notes).toContain("Agent said rent is net.");
    expect(out.notes).toContain("Q4 25");
  });

  test("is idempotent — re-running never stacks the same note", () => {
    // The migration and the write path both call this; a comp saved twice
    // must not accumulate identical lines.
    const once = normaliseCompDateFields({ leaseDate: "Upon Completion" });
    const twice = normaliseCompDateFields({ leaseDate: "Upon Completion", notes: once.notes });
    expect(twice.notes).toBe(once.notes);
  });

  test("leaves a clean comp completely alone", () => {
    const clean = { leaseDate: "2025-06-01", saleDate: undefined, notes: "fine" };
    expect(normaliseCompDateFields(clean)).toEqual(clean);
  });

  test("covers every date field, including leaseExpiry", () => {
    // leaseExpiry feeds the WALE calculation, so junk there is not harmless.
    const out = normaliseCompDateFields({ leaseExpiry: "TBC", saleDate: "01/07/2025" });
    expect(out.leaseExpiry).toBeUndefined();
    expect(out.saleDate).toBe("2025-07-01");
    expect(out.notes).toContain("TBC");
  });

  test("does not invent a notes field when there is nothing to record", () => {
    expect(normaliseCompDateFields({ leaseDate: "2025-01-01" }).notes).toBeUndefined();
  });
});

describe("noteForRawDate", () => {
  test("names the field so the note is self-explanatory later", () => {
    expect(noteForRawDate(undefined, "leaseDate", "Upon Completion")).toBe(
      'leaseDate recorded as "Upon Completion"',
    );
  });
});
