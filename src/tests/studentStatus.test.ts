import assert from 'assert';

// Polyfill browser globals for Node.js environment before importing storage module
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
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

// Dynamically import real project code
const { LocalStorageEngine, buildGradeKey } = await import('../services/storage.js');
import { Student } from '../types/index.js';

async function runTests() {
  console.log('--------------------------------------------------');
  console.log('🚀 Running Student Status (Regular / Affiliated) Test Suite...');
  console.log('--------------------------------------------------\n');

  let passedCount = 0;
  let failedCount = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      console.log(`  ✅ PASSED: ${name}`);
      passedCount++;
    } catch (err: any) {
      console.error(`  ❌ FAILED: ${name}`);
      console.error(`     Error: ${err.message || err}`);
      failedCount++;
    }
  }

  function createTestFixture() {
    const engine = new LocalStorageEngine();
    const state = (engine as any).state;

    state.academicYears = [
      { id: 'ay-2025', name: '2024–2025', isCurrent: false },
      { id: 'ay-2026', name: '2025–2026', isCurrent: true },
    ];

    state.classes = [
      { id: 'c-1', name: 'الأول المتوسط', stage: 'متوسط', order: 1, academicYearId: 'ay-2025' },
      { id: 'c-2', name: 'الثاني المتوسط', stage: 'متوسط', order: 2, academicYearId: 'ay-2026' },
    ];

    state.sections = [
      { id: 'sec-a', classId: 'c-1', name: 'أ' },
      { id: 'sec-b', classId: 'c-2', name: 'أ' },
    ];

    state.students = [];
    state.grades = {};

    return { engine, state };
  }

  // Test 1: New student defaults to 'regular' when no status specified
  await test('Default status is "regular" when status not explicitly provided', () => {
    const { engine, state } = createTestFixture();
    const created = engine.addStudent({
      name: 'علي حسن أحمد',
      academicYearId: 'ay-2026',
      classId: 'c-2',
      sectionId: 'sec-b',
    }) as Student;

    assert.strictEqual(created.status, 'regular');
    const inState = state.students.find((s: Student) => s.id === created.id);
    assert.strictEqual(inState.status, 'regular');
  });

  // Test 2: Add student with status 'affiliated' persists 'affiliated'
  await test('Adding student with status "affiliated" saves correctly', () => {
    const { engine, state } = createTestFixture();
    const created = engine.addStudent({
      name: 'محمد كريم جاسم',
      academicYearId: 'ay-2026',
      classId: 'c-2',
      sectionId: 'sec-b',
      status: 'affiliated',
    }) as Student;

    assert.strictEqual(created.status, 'affiliated');
    const inState = state.students.find((s: Student) => s.id === created.id);
    assert.strictEqual(inState.status, 'affiliated');
  });

  // Test 3: Updating student status from 'regular' to 'affiliated' preserves grades and other data
  await test('Updating student status from "regular" to "affiliated" preserves all grades', () => {
    const { engine, state } = createTestFixture();
    const student = engine.addStudent({
      name: 'أحمد محمود عباس',
      registrationNumber: '10293',
      fatherPhone: '07701234567',
      academicYearId: 'ay-2026',
      classId: 'c-2',
      sectionId: 'sec-b',
      status: 'regular',
    }) as Student;

    // Add a grade for this student
    const gradeKey = buildGradeKey('ay-2026', 'c-2', 'sec-b', 'sub-math', student.id);
    state.grades[gradeKey] = {
      id: gradeKey,
      academicYearId: 'ay-2026',
      classId: 'c-2',
      sectionId: 'sec-b',
      subjectId: 'sub-math',
      studentId: student.id,
      midtermScore: 88,
      finalExamScore: 92,
      effectiveFinalScore: 90,
      passedFinal: true,
    };

    // Now update student status to 'affiliated'
    engine.updateStudent({
      ...student,
      status: 'affiliated',
    });

    const updated = state.students.find((s: Student) => s.id === student.id);
    assert.strictEqual(updated.status, 'affiliated');
    assert.strictEqual(updated.name, 'أحمد محمود عباس');
    assert.strictEqual(updated.registrationNumber, '10293');

    // Verify grade record is completely intact
    const gradeAfter = state.grades[gradeKey];
    assert.ok(gradeAfter, 'Grade record must still exist');
    assert.strictEqual(gradeAfter.midtermScore, 88);
    assert.strictEqual(gradeAfter.finalExamScore, 92);
  });

  // Test 4: Updating student status from 'affiliated' to 'regular'
  await test('Updating student status from "affiliated" to "regular" works smoothly', () => {
    const { engine, state } = createTestFixture();
    const student = engine.addStudent({
      name: 'سامر قاسم مهدي',
      academicYearId: 'ay-2026',
      classId: 'c-2',
      sectionId: 'sec-b',
      status: 'affiliated',
    }) as Student;

    assert.strictEqual(student.status, 'affiliated');

    engine.updateStudent({
      ...student,
      status: 'regular',
    });

    const updated = state.students.find((s: Student) => s.id === student.id);
    assert.strictEqual(updated.status, 'regular');
  });

  // Test 5: Promotion preserves student status in the target year
  await test('Executing student promotion carries forward the affiliated status', async () => {
    const { engine, state } = createTestFixture();
    const affStudent = engine.addStudent({
      name: 'يوسف حيدر رضا',
      registrationNumber: '5566',
      academicYearId: 'ay-2025',
      classId: 'c-1',
      sectionId: 'sec-a',
      status: 'affiliated',
    }) as Student;

    const regStudent = engine.addStudent({
      name: 'حسن علي جواد',
      registrationNumber: '7788',
      academicYearId: 'ay-2025',
      classId: 'c-1',
      sectionId: 'sec-a',
      status: 'regular',
    }) as Student;

    // Promote both students to ay-2026, class c-2
    const result = await engine.executeStudentPromotion({
      sourceYearId: 'ay-2025',
      targetYearId: 'ay-2026',
      promotions: [
        {
          sourceStudentId: affStudent.id,
          studentName: affStudent.name,
          registrationNumber: affStudent.registrationNumber,
          gender: 'male',
          action: 'promote',
          targetClassId: 'c-2',
          targetSectionId: 'sec-b',
          notes: 'ناجح',
          reason: 'ناجح',
        },
        {
          sourceStudentId: regStudent.id,
          studentName: regStudent.name,
          registrationNumber: regStudent.registrationNumber,
          gender: 'male',
          action: 'promote',
          targetClassId: 'c-2',
          targetSectionId: 'sec-b',
          notes: 'ناجح',
          reason: 'ناجح',
        },
      ],
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.promotedCount, 2);

    const promotedAff = state.students.find((s: Student) => s.academicYearId === 'ay-2026' && s.name === affStudent.name);
    assert.ok(promotedAff, 'Promoted affiliated student must exist in ay-2026');
    assert.strictEqual(promotedAff.status, 'affiliated', 'Affiliated status must be preserved');

    const promotedReg = state.students.find((s: Student) => s.academicYearId === 'ay-2026' && s.name === regStudent.name);
    assert.ok(promotedReg, 'Promoted regular student must exist in ay-2026');
    assert.strictEqual(promotedReg.status, 'regular', 'Regular status must be preserved');
  });

  // Test 6: Filtering by status logic
  await test('Filtering students by all, regular, and affiliated behaves as expected', () => {
    const list: Student[] = [
      { id: '1', name: 'أ', academicYearId: 'ay-2026', classId: 'c', sectionId: 's', seatNumber: 1, status: 'regular' },
      { id: '2', name: 'ب', academicYearId: 'ay-2026', classId: 'c', sectionId: 's', seatNumber: 2, status: 'affiliated' },
      { id: '3', name: 'ج', academicYearId: 'ay-2026', classId: 'c', sectionId: 's', seatNumber: 3 }, // undefined status -> treated as regular
    ];

    const filterFn = (filterStatus: 'all' | 'regular' | 'affiliated') => {
      return list.filter((s) => {
        return filterStatus === 'all' || (filterStatus === 'affiliated' ? s.status === 'affiliated' : s.status !== 'affiliated');
      });
    };

    assert.strictEqual(filterFn('all').length, 3);
    assert.strictEqual(filterFn('regular').length, 2); // 'أ' and 'ج'
    assert.strictEqual(filterFn('affiliated').length, 1); // 'ب'
    assert.strictEqual(filterFn('affiliated')[0].name, 'ب');
  });

  console.log('\n--------------------------------------------------');
  console.log(`Results: ${passedCount} Passed, ${failedCount} Failed`);
  console.log('--------------------------------------------------');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
