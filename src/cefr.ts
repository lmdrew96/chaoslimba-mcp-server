export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** Center points used when storing content. */
export const CEFR_CENTER_POINTS: Record<CefrLevel, number> = {
  A1: 1.5,
  A2: 2.5,
  B1: 4.0,
  B2: 6.0,
  C1: 8.0,
  C2: 9.5,
};

/** Non-overlapping display ranges (difficulty → CEFR). */
export const CEFR_DISPLAY_RANGES: Record<CefrLevel, { min: number; max: number }> = {
  A1: { min: 0, max: 2.0 },
  A2: { min: 2.1, max: 3.5 },
  B1: { min: 3.6, max: 5.0 },
  B2: { min: 5.1, max: 7.0 },
  C1: { min: 7.1, max: 9.0 },
  C2: { min: 9.1, max: 10.0 },
};

/** Overlapping query ranges (CEFR → difficulty) for i+1 comprehensible input. */
export const CEFR_QUERY_RANGES: Record<CefrLevel, { min: number; max: number }> = {
  A1: { min: 1.0, max: 2.5 },
  A2: { min: 2.0, max: 4.0 },
  B1: { min: 3.5, max: 5.5 },
  B2: { min: 5.0, max: 7.0 },
  C1: { min: 7.0, max: 9.0 },
  C2: { min: 9.0, max: 10.0 },
};

/** Returns a SQL CASE expression mapping difficulty_level to CEFR using display ranges. */
export function cefrCaseSql(column = 'difficulty_level'): string {
  return `CASE
  WHEN ${column} <= 2.0 THEN 'A1'
  WHEN ${column} <= 3.5 THEN 'A2'
  WHEN ${column} <= 5.0 THEN 'B1'
  WHEN ${column} <= 7.0 THEN 'B2'
  WHEN ${column} <= 9.0 THEN 'C1'
  ELSE 'C2'
END`;
}

export function difficultyToCefr(difficulty: number): CefrLevel {
  if (difficulty <= 2.0) return 'A1';
  if (difficulty <= 3.5) return 'A2';
  if (difficulty <= 5.0) return 'B1';
  if (difficulty <= 7.0) return 'B2';
  if (difficulty <= 9.0) return 'C1';
  return 'C2';
}
