import {
  AcademicYear,
  SchoolClass,
  Section,
  Subject,
  Student,
  GradeRecord,
  AppSettings,
  ExemptionSettings,
} from '../types';
import { DatabaseState } from './storage';

// Canonical list of all subjects across all classes - REMOVED DEMO SUBJECTS
export const CANONICAL_SUBJECTS: Subject[] = [];

/**
 * Idempotently completes the database with all missing subjects.
 * Protects existing user data completely.
 */
export function completeDemoSeedData(state: DatabaseState): {
  state: DatabaseState;
  newSubjectsCount: number;
  newStudentsCount: number;
  newGradesCount: number;
} {
  return {
    state,
    newSubjectsCount: 0,
    newStudentsCount: 0,
    newGradesCount: 0,
  };
}
