import { TestType } from "@prisma/client";
import {
  buildAttemptTiming,
  getReadingPartADeadline,
  getReadingPartBCDeadline,
  isReadingPartAExpired,
  resolveReadingPartBCMinutes,
  scoreAttempt
} from "./test-engine.utils";

describe("test-engine utils", () => {
  it("builds reading timing with a Part A section window", () => {
    const startAt = new Date("2026-03-31T10:00:00.000Z");
    const timing = buildAttemptTiming(TestType.READING, 60, 15, startAt);

    expect(timing.section).toBe("READING_PART_A");
    expect(timing.timeRemainingSeconds).toBe(3600);
    expect(timing.expiresAt.toISOString()).toBe("2026-03-31T11:00:00.000Z");
    expect(timing.sectionExpiresAt.toISOString()).toBe("2026-03-31T10:15:00.000Z");
  });

  it("locks Reading Part A after the wall-clock deadline", () => {
    const startedAt = new Date("2026-03-31T10:00:00.000Z");
    expect(getReadingPartADeadline(startedAt, 15).toISOString()).toBe("2026-03-31T10:15:00.000Z");
    expect(isReadingPartAExpired(startedAt, 15, new Date("2026-03-31T10:14:59.000Z"))).toBe(false);
    expect(isReadingPartAExpired(startedAt, 15, new Date("2026-03-31T10:15:00.000Z"))).toBe(true);
    expect(resolveReadingPartBCMinutes(null)).toBe(45);
    expect(resolveReadingPartBCMinutes(0)).toBe(45);
    expect(getReadingPartBCDeadline(startedAt, 15, 45).toISOString()).toBe("2026-03-31T11:00:00.000Z");
  });

  it("scores answers and splits totals by part", () => {
    const result = scoreAttempt(
      [
        {
          id: "q1",
          part: "A",
          sequence: 1,
          type: "MCQ",
          correctAnswer: "Option A",
          points: 1
        },
        {
          id: "q2",
          part: "B",
          sequence: 21,
          type: "MCQ",
          correctAnswer: "hello",
          points: 2
        },
        {
          id: "q3",
          part: "C",
          sequence: 27,
          type: "MCQ",
          correctAnswer: "Option D",
          points: 3
        }
      ],
      {
        q1: " option a ",
        q2: "HELLO",
        q3: "Option C"
      },
      TestType.READING
    );

    expect(result).toEqual({
      score: 3,
      partAScore: 1,
      partBScore: 2,
      partCScore: 0,
      answeredCount: 3
    });
  });

  it("requires exact casing for reading Part A text answers", () => {
    const result = scoreAttempt(
      [
        {
          id: "q8",
          part: "A",
          sequence: 8,
          type: "FILL_BLANK",
          correctAnswer: "Diabetes",
          points: 1
        }
      ],
      { q8: "diabetes" },
      TestType.READING
    );

    expect(result.score).toBe(0);
  });
});
