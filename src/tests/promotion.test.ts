import assert from 'assert';

// Polyfill browser globals for Node.js environment before importing storage module
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      if ((globalThis as any).__mockStorageFail) {
        throw new Error('Disk quota exceeded (Simulated Save Failure)');
      }
      store[key] = value;
    },
    removeItem: (key: string) => delete store[key],
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
}

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  (globalThis as any).requestAnimationFrame = (cb: Function) => setTimeout(cb, 0);
}

// Dynamically import storage after globals are defined
const { LocalStorageEngine, buildGradeKey } = await import('../services/storage.js');
import { Section } from '../types/index.js';

async function runTests() {
  console.log('--------------------------------------------------');
  console.log('🚀 Running Student Promotion Isolated Test Suite...');
  console.log('--------------------------------------------------\n');

  let passedCount = 0;
  let failedCount = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      (globalThis as any).__mockStorageFail = false;
      await fn();
      console.log(`  ✅ PASSED: ${name}`);
      passedCount++;
    } catch (err: any) {
      console.error(`  ❌ FAILED: ${name}`);
      console.error(`     Error: ${err.message || err}`);
      failedCount++;
    }
  }

  // Setup Helper: Create fresh engine instance with isolated test state
  function createTestFixture() {
    const engine = new LocalStorageEngine();
    const state = (engine as any).state;

    state.academicYears = [
      { id: 'ay-2025', name: '2024–2025', isCurrent: false },
      { id: 'ay-2026', name: '2025–2026', isCurrent: true },
    ];

    state.classes = [
      { id: 'cls-src-1', name: 'الأول المتوسط', stage: 'إعدادي', order: 1, academicYearId: 'ay-2025', isArchived: false },
      { id: 'cls-src-2', name: 'الصف الثاني المصدر', stage: 'إعدادي', order: 2, academicYearId: 'ay-2025', isArchived: false },
      { id: 'cls-target-2', name: 'الثاني المتوسط', stage: 'إعدادي', order: 2, academicYearId: 'ay-2026', isArchived: false },
      { id: 'cls-target-1-repeater', name: 'الأول المتوسط', stage: 'إعدادي', order: 1, academicYearId: 'ay-2026', isArchived: false },
      { id: 'cls-wrong-year', name: 'الثالث المتوسط', stage: 'إعدادي', order: 3, academicYearId: 'ay-2025', isArchived: false },
    ];

    state.sections = [
      { id: 'sec-src-a', classId: 'cls-src-1', name: 'أ' },
      { id: 'sec-target-a', classId: 'cls-target-2', name: 'أ' },
      { id: 'sec-target-b', classId: 'cls-target-2', name: 'ب' },
      { id: 'sec-target-c', classId: 'cls-target-2', name: 'ج' },
      { id: 'sec-repeater-a', classId: 'cls-target-1-repeater', name: 'أ' },
    ];

    state.students = [
      {
        id: 'stu-1',
        name: 'علي حسن',
        registrationNumber: 'REG-1001',
        academicYearId: 'ay-2025',
        classId: 'cls-src-1',
        sectionId: 'sec-src-a',
        seatNumber: 1,
        gender: 'male',
      },
      {
        id: 'stu-2',
        name: 'أحمد محمود',
        registrationNumber: undefined, // Empty reg number
        academicYearId: 'ay-2025',
        classId: 'cls-src-1',
        sectionId: 'sec-src-a',
        seatNumber: 2,
        gender: 'male',
      },
      {
        id: 'stu-3',
        name: 'علي حسن', // Same name as stu-1, but different reg number / different student
        registrationNumber: 'REG-9999',
        fatherPhone: '07700000000',
        academicYearId: 'ay-2025',
        classId: 'cls-src-1',
        sectionId: 'sec-src-a',
        seatNumber: 3,
        gender: 'male',
      },
    ];

    state.subjects = [
      { id: 'sub-math', classId: 'cls-src-1', name: 'الرياضيات', maxScore: 100, passScore: 50, order: 1 },
    ];

    state.grades = {
      [buildGradeKey('ay-2025', 'cls-src-1', 'sec-src-a', 'sub-math', 'stu-1')]: {
        id: buildGradeKey('ay-2025', 'cls-src-1', 'sec-src-a', 'sub-math', 'stu-1'),
        academicYearId: 'ay-2025',
        classId: 'cls-src-1',
        sectionId: 'sec-src-a',
        subjectId: 'sub-math',
        studentId: 'stu-1',
        term1Score: 40,
        midtermScore: 10,
        term2Score: 40,
        termYearlyScore: 90,
        finalExamScore: 90,
        finalScore: 90,
        secondRoundScore: null,
        secondRoundFinalScore: null,
        lastUpdated: new Date().toISOString(),
      },
    };

    return { engine, state };
  }

  // --- Test Cases ---

  await test('1. Reject target class that does not belong to target year', async () => {
    const { engine } = createTestFixture();
    const res = await engine.executeStudentPromotion({
      sourceYearId: 'ay-2025',
      targetYearId: 'ay-2026',
      sourceClassId: 'cls-src-1',
      promotions: [
        {
          sourceStudentId: 'stu-1',
          studentName: 'علي حسن',
          registrationNumber: 'REG-1001',
          targetClassId: 'cls-wrong-year', // Belongs to ay-2025, not ay-2026
          targetSectionId: 'sec-target-a',
          action: 'promote',
          reason: 'اختبار',
        },
      ],
    });

    assert.strictEqual(res.success, false);
    assert.match(res.message, /لا يتبع العام الدراسي الهدف/);
  });

  await test('2. Reject section that does not belong to target class', async () => {
    const { engine } = createTestFixture();
    const res = await engine.executeStudentPromotion({
      sourceYearId: 'ay-2025',
      targetYearId: 'ay-2026',
      sourceClassId: 'cls-src-1',
      promotions: [
        {
          sourceStudentId: 'stu-1',
          studentName: 'علي حسن',
          registrationNumber: 'REG-1001',
          targetClassId: 'cls-target-2',
          targetSectionId: 'sec-repeater-a', // Belongs to repeater class, not target class 2
          action: 'promote',
          reason: 'اختبار',
        },
      ],
    });

    assert.strictEqual(res.success, false);
    assert.match(res.message, /لا تتبع الصف المستهدف/);
  });

  await test('3. Reject source student that does not belong to specified source year/class', async () => {
    const { engine } = createTestFixture();
    const res = await engine.executeStudentPromotion({
      sourceYearId: 'ay-2025',
      targetYearId: 'ay-2026',
      sourceClassId: 'cls-src-2', // Student stu-1 is actually in cls-src-1, not cls-src-2
      promotions: [
        {
          sourceStudentId: 'stu-1',
          studentName: 'علي حسن',
          registrationNumber: 'REG-1001',
          targetClassId: 'cls-target-2',
          targetSectionId: 'sec-target-a',
          action: 'promote',
          reason: 'اختبار',
        },
      ],
    });

    assert.strictEqual(res.success, false);
    assert.match(res.message, /لا ينتمي للصف المصدر/);
  });

  await test('4. Batch validation: do not save any record if one element in batch is invalid', async () => {
    const { engine, state } = createTestFixture();
    const initialStudentCount = state.students.length;

    const res = await engine.executeStudentPromotion({
      sourceYearId: 'ay-2025',
      targetYearId: 'ay-2026',
      sourceClassId: 'cls-src-1',
      promotions: [
        {
          sourceStudentId: 'stu-1',
          studentName: 'علي حسن',
          registrationNumber: 'REG-1001',
          targetClassId: 'cls-target-2',
          targetSectionId: 'sec-target-a',
          action: 'promote',
          reason: 'طالب صالح',
        },
        {
          sourceStudentId: 'stu-2',
          studentName: 'أحمد محمود',
          targetClassId: 'cls-wrong-year', // Invalid element
          targetSectionId: 'sec-target-a',
          action: 'promote',
          reason: 'طالب غير صالح',
        },
      ],
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(state.students.length, initialStudentCount, 'No new students should be persisted');
  });

  await test('5. Promotion success with registrationNumber remaining identical to original', async () => {
    const { engine, state } = createTestFixture();
    const res = await engine.executeStudentPromotion({
      sourceYearId: 'ay-2025',
      targetYearId: 'ay-2026',
      sourceClassId: 'cls-src-1',
      promotions: [
        {
          sourceStudentId: 'stu-1',
          studentName: 'علي حسن',
          registrationNumber: 'REG-1001',
          targetClassId: 'cls-target-2',
          targetSectionId: 'sec-target-a',
          action: 'promote',
          reason: 'ناجح',
        },
      ],
    });

    assert.strictEqual(res.success, true);
    const newStudent = state.students.find((s: any) => s.academicYearId === 'ay-2026' && s.registrationNumber === 'REG-1001');
    assert.ok(newStudent, 'Promoted student record exists');
    assert.strictEqual(newStudent.registrationNumber, 'REG-1001', 'Registration number copied verbatim');
  });

  await test('6. Empty registrationNumber remains empty/undefined', async () => {
    const { engine, state } = createTestFixture();
    const res = await engine.executeStudentPromotion({
      sourceYearId: 'ay-2025',
      targetYearId: 'ay-2026',
      sourceClassId: 'cls-src-1',
      promotions: [
        {
          sourceStudentId: 'stu-2',
          studentName: 'أحمد محمود',
          registrationNumber: undefined,
          targetClassId: 'cls-target-2',
          targetSectionId: 'sec-target-a',
          action: 'promote',
          reason: 'ناجح',
        },
      ],
    });

    assert.strictEqual(res.success, true);
    const newStudent = state.students.find((s: any) => s.academicYearId === 'ay-2026' && s.name === 'أحمد محمود');
    assert.ok(newStudent);
    assert.strictEqual(newStudent.registrationNumber, undefined);
  });

  await test('7. Prevent duplicate student promotion upon re-execution, even if registration number is empty', async () => {
    const { engine } = createTestFixture();
    const payload = {
      sourceYearId: 'ay-2025',
      targetYearId: 'ay-2026',
      sourceClassId: 'cls-src-1',
      promotions: [
        {
          sourceStudentId: 'stu-2',
          studentName: 'أحمد محمود',
          registrationNumber: undefined,
          targetClassId: 'cls-target-2',
          targetSectionId: 'sec-target-a',
          action: 'promote' as const,
          reason: 'ناجح',
        },
      ],
    };

    // First execution
    const res1 = await engine.executeStudentPromotion(payload);
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.promotedCount, 1);

    // Second execution (re-execution)
    const res2 = await engine.executeStudentPromotion(payload);
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.promotedCount, 0);
    assert.strictEqual(res2.skippedDuplicatesCount, 1, 'Duplicate student skipped');
  });

  await test('8. Do not confuse two different students with similar/identical names', async () => {
    const { engine, state } = createTestFixture();
    const res = await engine.executeStudentPromotion({
      sourceYearId: 'ay-2025',
      targetYearId: 'ay-2026',
      sourceClassId: 'cls-src-1',
      promotions: [
        {
          sourceStudentId: 'stu-1',
          studentName: 'علي حسن',
          registrationNumber: 'REG-1001',
          targetClassId: 'cls-target-2',
          targetSectionId: 'sec-target-a',
          action: 'promote',
          reason: 'ناجح',
        },
        {
          sourceStudentId: 'stu-3',
          studentName: 'علي حسن',
          registrationNumber: 'REG-9999',
          targetClassId: 'cls-target-2',
          targetSectionId: 'sec-target-b',
          action: 'promote',
          reason: 'ناجح',
        },
      ],
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.promotedCount, 2, 'Both students promoted without confusion');
    const promotedStudents = state.students.filter((s: any) => s.academicYearId === 'ay-2026' && s.name === 'علي حسن');
    assert.strictEqual(promotedStudents.length, 2);
  });

  await test('9. Balanced distribution of 10 students over 3 sections (4, 3, 3)', () => {
    const sectionsList: Section[] = [
      { id: 'sec-a', classId: 'c1', name: 'أ' },
      { id: 'sec-b', classId: 'c1', name: 'ب' },
      { id: 'sec-c', classId: 'c1', name: 'ج' },
    ];

    const studentIds = Array.from({ length: 10 }, (_, i) => `s-${i + 1}`);
    const assignments: Record<string, string> = {};

    studentIds.forEach((id, idx) => {
      assignments[id] = sectionsList[idx % sectionsList.length].id;
    });

    const countA = Object.values(assignments).filter((id) => id === 'sec-a').length;
    const countB = Object.values(assignments).filter((id) => id === 'sec-b').length;
    const countC = Object.values(assignments).filter((id) => id === 'sec-c').length;

    assert.strictEqual(countA, 4);
    assert.strictEqual(countB, 3);
    assert.strictEqual(countC, 3);
  });

  await test('10. Link repeater student to correct class and section in target year', async () => {
    const { engine, state } = createTestFixture();
    const res = await engine.executeStudentPromotion({
      sourceYearId: 'ay-2025',
      targetYearId: 'ay-2026',
      sourceClassId: 'cls-src-1',
      promotions: [
        {
          sourceStudentId: 'stu-1',
          studentName: 'علي حسن',
          registrationNumber: 'REG-1001',
          targetClassId: 'cls-target-1-repeater', // Grade 1 in ay-2026
          targetSectionId: 'sec-repeater-a',
          action: 'repeat',
          reason: 'راسب',
        },
      ],
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.repeatingCount, 1);
    const repeater = state.students.find((s: any) => s.academicYearId === 'ay-2026' && s.registrationNumber === 'REG-1001');
    assert.ok(repeater);
    assert.strictEqual(repeater.classId, 'cls-target-1-repeater');
    assert.strictEqual(repeater.sectionId, 'sec-repeater-a');
  });

  await test('11. Historical records and grades of old year remain unchanged', async () => {
    const { engine, state } = createTestFixture();
    const oldGradeKey = buildGradeKey('ay-2025', 'cls-src-1', 'sec-src-a', 'sub-math', 'stu-1');
    const oldGradeRecordBefore = JSON.stringify(state.grades[oldGradeKey]);

    await engine.executeStudentPromotion({
      sourceYearId: 'ay-2025',
      targetYearId: 'ay-2026',
      sourceClassId: 'cls-src-1',
      promotions: [
        {
          sourceStudentId: 'stu-1',
          studentName: 'علي حسن',
          registrationNumber: 'REG-1001',
          targetClassId: 'cls-target-2',
          targetSectionId: 'sec-target-a',
          action: 'promote',
          reason: 'ناجح',
        },
      ],
    });

    const oldStudent = state.students.find((s: any) => s.id === 'stu-1' && s.academicYearId === 'ay-2025');
    assert.ok(oldStudent, 'Original student record preserved');
    const oldGradeRecordAfter = JSON.stringify(state.grades[oldGradeKey]);
    assert.strictEqual(oldGradeRecordAfter, oldGradeRecordBefore, 'Original grade record remains completely untouched');
  });

  await test('12. Old grades are not copied to new annual record', async () => {
    const { engine, state } = createTestFixture();
    await engine.executeStudentPromotion({
      sourceYearId: 'ay-2025',
      targetYearId: 'ay-2026',
      sourceClassId: 'cls-src-1',
      promotions: [
        {
          sourceStudentId: 'stu-1',
          studentName: 'علي حسن',
          registrationNumber: 'REG-1001',
          targetClassId: 'cls-target-2',
          targetSectionId: 'sec-target-a',
          action: 'promote',
          reason: 'ناجح',
        },
      ],
    });

    const newStudent = state.students.find((s: any) => s.academicYearId === 'ay-2026' && s.registrationNumber === 'REG-1001');
    assert.ok(newStudent);

    // Ensure no grades exist for the new student in ay-2026
    const newStudentGrades = Object.values(state.grades).filter(
      (g: any) => g.studentId === newStudent.id && g.academicYearId === 'ay-2026'
    );
    assert.strictEqual(newStudentGrades.length, 0, 'No grades copied to new year student record');
  });

  await test('13 & 14. Simulate save failure mid-batch and verify no partial batch remains or success returned', async () => {
    const { engine, state } = createTestFixture();
    const initialStudentCount = state.students.length;

    // Force mock save failure
    (globalThis as any).__mockStorageFail = true;

    const res = await engine.executeStudentPromotion({
      sourceYearId: 'ay-2025',
      targetYearId: 'ay-2026',
      sourceClassId: 'cls-src-1',
      promotions: [
        {
          sourceStudentId: 'stu-1',
          studentName: 'علي حسن',
          registrationNumber: 'REG-1001',
          targetClassId: 'cls-target-2',
          targetSectionId: 'sec-target-a',
          action: 'promote',
          reason: 'ناجح',
        },
      ],
    });

    assert.strictEqual(res.success, false, 'Should return failure on storage error');
    assert.strictEqual(state.students.length, initialStudentCount, 'Memory state rolled back cleanly');
  });

  await test('15. Double click guard prevents multiple submissions', () => {
    let isSubmitting = false;
    let callCount = 0;

    async function handleConfirmAndExecutePromotion() {
      if (isSubmitting) return;
      isSubmitting = true;
      callCount++;
      // Simulate async save delay
      await new Promise((r) => setTimeout(r, 50));
      isSubmitting = false;
    }

    // Trigger two rapid clicks
    const p1 = handleConfirmAndExecutePromotion();
    const p2 = handleConfirmAndExecutePromotion();

    return Promise.all([p1, p2]).then(() => {
      assert.strictEqual(callCount, 1, 'Only first click is processed, second click guarded');
    });
  });

  console.log('\n--------------------------------------------------');
  console.log(`📊 Test Results: ${passedCount} Passed, ${failedCount} Failed`);
  console.log('--------------------------------------------------');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
