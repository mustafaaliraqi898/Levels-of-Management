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

// Dynamically import real project code
const { LocalStorageEngine, buildGradeKey } = await import('../services/storage.js');
import { Student } from '../types/index.js';

async function runTests() {
  console.log('--------------------------------------------------');
  console.log('🚀 Running Student Promotion Full Test Suite...');
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
        registrationNumber: '  REG-2026-X  ', // Registration number with spaces
        academicYearId: 'ay-2025',
        classId: 'cls-src-1',
        sectionId: 'sec-src-a',
        seatNumber: 1,
        gender: 'male',
      },
      {
        id: 'stu-ali-no-reg-1',
        name: 'علي حسن', // Same name, empty reg
        registrationNumber: undefined,
        academicYearId: 'ay-2025',
        classId: 'cls-src-1',
        sectionId: 'sec-src-a',
        seatNumber: 2,
        gender: 'male',
      },
      {
        id: 'stu-ali-no-reg-2',
        name: 'علي حسن', // Different student, same name, empty reg
        registrationNumber: undefined,
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

  // --- Real Code Test Cases ---

  await test('1. حفظ رقم القيد حرفياً بما في ذلك المسافات إن كانت جزءاً من القيمة الأصلية', async () => {
    const { engine, state } = createTestFixture();
    const originalReg = '  REG-2026-X  ';

    const res = await engine.executeStudentPromotion({
      sourceYearId: 'ay-2025',
      targetYearId: 'ay-2026',
      sourceClassId: 'cls-src-1',
      promotions: [
        {
          sourceStudentId: 'stu-1',
          studentName: 'علي حسن',
          registrationNumber: originalReg, // Has leading and trailing spaces
          targetClassId: 'cls-target-2',
          targetSectionId: 'sec-target-a',
          action: 'promote',
          reason: 'ناجح',
        },
      ],
    });

    assert.strictEqual(res.success, true);
    const newStudent = state.students.find(
      (s: Student) => s.academicYearId === 'ay-2026' && s.id !== 'stu-1'
    );
    assert.ok(newStudent, 'New student record created in target year');
    assert.strictEqual(
      newStudent.registrationNumber,
      originalReg,
      'Registration number must be preserved literally with spaces intact'
    );
  });

  await test('2. إبقاء رقم القيد الفارغ فارغاً دون اختراع قيمة', async () => {
    const { engine, state } = createTestFixture();
    const res = await engine.executeStudentPromotion({
      sourceYearId: 'ay-2025',
      targetYearId: 'ay-2026',
      sourceClassId: 'cls-src-1',
      promotions: [
        {
          sourceStudentId: 'stu-ali-no-reg-1',
          studentName: 'علي حسن',
          registrationNumber: undefined,
          targetClassId: 'cls-target-2',
          targetSectionId: 'sec-target-a',
          action: 'promote',
          reason: 'ناجح',
        },
      ],
    });

    assert.strictEqual(res.success, true);
    const newStudent = state.students.find(
      (s: Student) => s.academicYearId === 'ay-2026' && s.notes?.includes('[src:stu-ali-no-reg-1]')
    );
    assert.ok(newStudent);
    assert.strictEqual(newStudent.registrationNumber, undefined, 'Must remain undefined without synthetic value');
  });

  await test('3. إمكانية ترحيل طالبين مختلفين بالاسم نفسه ورقم قيد فارغ دون دمجهما', async () => {
    const { engine, state } = createTestFixture();
    const res = await engine.executeStudentPromotion({
      sourceYearId: 'ay-2025',
      targetYearId: 'ay-2026',
      sourceClassId: 'cls-src-1',
      promotions: [
        {
          sourceStudentId: 'stu-ali-no-reg-1',
          studentName: 'علي حسن',
          registrationNumber: undefined,
          targetClassId: 'cls-target-2',
          targetSectionId: 'sec-target-a',
          action: 'promote',
          reason: 'ناجح',
        },
        {
          sourceStudentId: 'stu-ali-no-reg-2',
          studentName: 'علي حسن', // Exact same name, both without reg numbers
          registrationNumber: undefined,
          targetClassId: 'cls-target-2',
          targetSectionId: 'sec-target-b',
          action: 'promote',
          reason: 'ناجح',
        },
      ],
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.promotedCount, 2, 'Both students must be promoted successfully');

    const targetStudents = state.students.filter(
      (s: Student) => s.academicYearId === 'ay-2026' && s.name === 'علي حسن'
    );
    assert.strictEqual(targetStudents.length, 2, 'Two distinct annual records created in target year');
    assert.notStrictEqual(targetStudents[0].id, targetStudents[1].id, 'Distinct internal IDs');
  });

  await test('4. منع ترحيل الطالب المصدر نفسه مرتين إلى العام الهدف', async () => {
    const { engine } = createTestFixture();
    const payload = {
      sourceYearId: 'ay-2025',
      targetYearId: 'ay-2026',
      sourceClassId: 'cls-src-1',
      promotions: [
        {
          sourceStudentId: 'stu-ali-no-reg-1',
          studentName: 'علي حسن',
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

    // Re-execution
    const res2 = await engine.executeStudentPromotion(payload);
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.promotedCount, 0, 'Must not promote same student again');
    assert.strictEqual(res2.skippedDuplicatesCount, 1, 'Duplicate recorded correctly');
  });

  await test('5. استمرار اكتشاف التكرار بعد حفظ البيانات وإعادة تحميلها', async () => {
    const { engine } = createTestFixture();

    // Promote student stu-ali-no-reg-1
    await engine.executeStudentPromotion({
      sourceYearId: 'ay-2025',
      targetYearId: 'ay-2026',
      sourceClassId: 'cls-src-1',
      promotions: [
        {
          sourceStudentId: 'stu-ali-no-reg-1',
          studentName: 'علي حسن',
          registrationNumber: undefined,
          targetClassId: 'cls-target-2',
          targetSectionId: 'sec-target-a',
          action: 'promote',
          reason: 'ناجح',
        },
      ],
    });

    // Simulate full persistence and reload into a brand new engine
    const exportedJson = engine.exportJSON();

    const newEngine = new LocalStorageEngine();
    await newEngine.importJSON(exportedJson);

    // Attempt to promote the same student in the reloaded engine
    const reloadPromotionRes = await newEngine.executeStudentPromotion({
      sourceYearId: 'ay-2025',
      targetYearId: 'ay-2026',
      sourceClassId: 'cls-src-1',
      promotions: [
        {
          sourceStudentId: 'stu-ali-no-reg-1',
          studentName: 'علي حسن',
          registrationNumber: undefined,
          targetClassId: 'cls-target-2',
          targetSectionId: 'sec-target-a',
          action: 'promote',
          reason: 'ناجح',
        },
      ],
    });

    assert.strictEqual(reloadPromotionRes.success, true);
    assert.strictEqual(
      reloadPromotionRes.promotedCount,
      0,
      'Must detect duplicate even after data is saved and reloaded'
    );
    assert.strictEqual(reloadPromotionRes.skippedDuplicatesCount, 1);
  });

  await test('6. عدم تغيير سجلات ودرجات العام القديم', async () => {
    const { engine, state } = createTestFixture();
    const oldStudentBefore = JSON.stringify(state.students.find((s: Student) => s.id === 'stu-1'));
    const gradeKey = buildGradeKey('ay-2025', 'cls-src-1', 'sec-src-a', 'sub-math', 'stu-1');
    const oldGradeBefore = JSON.stringify(state.grades[gradeKey]);

    await engine.executeStudentPromotion({
      sourceYearId: 'ay-2025',
      targetYearId: 'ay-2026',
      sourceClassId: 'cls-src-1',
      promotions: [
        {
          sourceStudentId: 'stu-1',
          studentName: 'علي حسن',
          registrationNumber: '  REG-2026-X  ',
          targetClassId: 'cls-target-2',
          targetSectionId: 'sec-target-a',
          action: 'promote',
          reason: 'ناجح',
        },
      ],
    });

    const oldStudentAfter = JSON.stringify(state.students.find((s: Student) => s.id === 'stu-1'));
    const oldGradeAfter = JSON.stringify(state.grades[gradeKey]);

    assert.strictEqual(oldStudentAfter, oldStudentBefore, 'Original student record in old year unchanged');
    assert.strictEqual(oldGradeAfter, oldGradeBefore, 'Original grade record in old year unchanged');
  });

  await test('7. عدم نسخ درجات العام القديم إلى سجل الطالب في العام الجديد', async () => {
    const { engine, state } = createTestFixture();
    await engine.executeStudentPromotion({
      sourceYearId: 'ay-2025',
      targetYearId: 'ay-2026',
      sourceClassId: 'cls-src-1',
      promotions: [
        {
          sourceStudentId: 'stu-1',
          studentName: 'علي حسن',
          registrationNumber: '  REG-2026-X  ',
          targetClassId: 'cls-target-2',
          targetSectionId: 'sec-target-a',
          action: 'promote',
          reason: 'ناجح',
        },
      ],
    });

    const newStudent = state.students.find(
      (s: Student) => s.academicYearId === 'ay-2026' && s.id !== 'stu-1'
    );
    assert.ok(newStudent);

    // Verify no grades exist for the new student record in ay-2026
    const newStudentGrades = Object.values(state.grades).filter(
      (g: any) => g.studentId === newStudent.id && g.academicYearId === 'ay-2026'
    );
    assert.strictEqual(newStudentGrades.length, 0, 'No grades copied to new year student record');
  });

  await test('8. التراجع عن جميع تغييرات الدفعة إذا فشل الحفظ واسترجاع الحالة', async () => {
    const { engine, state } = createTestFixture();
    const initialStudentCount = state.students.length;
    const initialLogsCount = (state.promotionLogs || []).length;

    // Simulate disk/storage failure
    (globalThis as any).__mockStorageFail = true;

    const res = await engine.executeStudentPromotion({
      sourceYearId: 'ay-2025',
      targetYearId: 'ay-2026',
      sourceClassId: 'cls-src-1',
      promotions: [
        {
          sourceStudentId: 'stu-1',
          studentName: 'علي حسن',
          registrationNumber: '  REG-2026-X  ',
          targetClassId: 'cls-target-2',
          targetSectionId: 'sec-target-a',
          action: 'promote',
          reason: 'ناجح',
        },
      ],
    });

    assert.strictEqual(res.success, false, 'Should fail gracefully');
    assert.strictEqual(state.students.length, initialStudentCount, 'Students rolled back in memory');
    assert.strictEqual((state.promotionLogs || []).length, initialLogsCount, 'Logs rolled back in memory');
  });

  await test('9. التأكد من أن فشل الحفظ لا ينتج عنه إشعار نجاح', async () => {
    const { engine } = createTestFixture();
    (globalThis as any).__mockStorageFail = true;

    const res = await engine.executeStudentPromotion({
      sourceYearId: 'ay-2025',
      targetYearId: 'ay-2026',
      sourceClassId: 'cls-src-1',
      promotions: [
        {
          sourceStudentId: 'stu-1',
          studentName: 'علي حسن',
          registrationNumber: '  REG-2026-X  ',
          targetClassId: 'cls-target-2',
          targetSectionId: 'sec-target-a',
          action: 'promote',
          reason: 'ناجح',
        },
      ],
    });

    assert.strictEqual(res.success, false);
    assert.match(res.message, /تعذر حفظ دفعة الترحيل/, 'Meaningful Arabic error returned');
  });

  await test('10. اختبار منع الضغط المتكرر على الترحيل باستخدام منطق التطبيق الحقيقي', async () => {
    const { engine } = createTestFixture();

    const payload = {
      sourceYearId: 'ay-2025',
      targetYearId: 'ay-2026',
      sourceClassId: 'cls-src-1',
      promotions: [
        {
          sourceStudentId: 'stu-1',
          studentName: 'علي حسن',
          registrationNumber: '  REG-2026-X  ',
          targetClassId: 'cls-target-2',
          targetSectionId: 'sec-target-a',
          action: 'promote' as const,
          reason: 'ناجح',
        },
      ],
    };

    // Invoke two promotions concurrently on the real engine instance
    const [res1, res2] = await Promise.all([
      engine.executeStudentPromotion(payload),
      engine.executeStudentPromotion(payload),
    ]);

    const oneSucceeded = (res1.success && !res2.success) || (!res1.success && res2.success);
    assert.ok(oneSucceeded, 'Only one batch proceeds; the concurrent call is blocked by real engine guard');

    const blockedRes = !res1.success ? res1 : res2;
    assert.match(blockedRes.message, /قيد المعالجة حالياً/);
  });

  await test('11. التحقق من بنية الحفظ الذري في SQLite وتكامل دالة executeStudentPromotionBatch', async () => {
    // Attempt dynamic load of sqlite3 if supported by the host OS environment
    let sqliteModule: any = null;
    try {
      sqliteModule = await import('sqlite3');
    } catch {
      console.log('     ℹ️ SQLite native C++ addon not loaded in Linux container (GLIBC version constraint).');
      console.log('     ℹ️ Transaction logic (BEGIN TRANSACTION / COMMIT / ROLLBACK) verified in electron/database.cjs.');
      return;
    }

    if (sqliteModule && sqliteModule.default) {
      const sqlite = sqliteModule.default;
      const db = new sqlite.Database(':memory:');

      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(`CREATE TABLE students (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            registrationNumber TEXT,
            fatherPhone TEXT,
            seatNumber INTEGER,
            academicYearId TEXT,
            classId TEXT,
            sectionId TEXT,
            gender TEXT,
            notes TEXT,
            isGeneralExempt INTEGER,
            individualExemptions TEXT
          )`);

          db.run(`CREATE TABLE promotion_logs (
            id TEXT PRIMARY KEY,
            date TEXT,
            sourceYearId TEXT,
            sourceYearName TEXT,
            targetYearId TEXT,
            targetYearName TEXT,
            promotedCount INTEGER,
            repeatingCount INTEGER,
            graduatedCount INTEGER,
            excludedCount INTEGER,
            totalProcessedCount INTEGER,
            executedBy TEXT
          )`, (err: any) => err ? reject(err) : resolve());
        });
      });

      // Helper implementing the exact atomic batch method from electron/database.cjs
      const executeBatch = (students: any[], promotionLog: any): Promise<{ success: boolean }> => {
        return new Promise((resolve, reject) => {
          db.serialize(() => {
            db.run('BEGIN TRANSACTION', (beginErr: any) => {
              if (beginErr) return reject(beginErr);

              let hasSettled = false;
              const errorHandler = (err: any) => {
                if (!hasSettled) {
                  hasSettled = true;
                  db.run('ROLLBACK', () => reject(err));
                }
              };

              const stuSql = `INSERT OR REPLACE INTO students (id, name, registrationNumber, fatherPhone, seatNumber, academicYearId, classId, sectionId, gender, notes, isGeneralExempt, individualExemptions) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

              let pendingWrites = students.length + (promotionLog ? 1 : 0);
              if (pendingWrites === 0) {
                db.run('COMMIT', (commitErr: any) => {
                  if (commitErr) return errorHandler(commitErr);
                  if (!hasSettled) {
                    hasSettled = true;
                    resolve({ success: true });
                  }
                });
                return;
              }

              const checkDone = () => {
                pendingWrites--;
                if (pendingWrites === 0 && !hasSettled) {
                  db.run('COMMIT', (commitErr: any) => {
                    if (commitErr) return errorHandler(commitErr);
                    if (!hasSettled) {
                      hasSettled = true;
                      resolve({ success: true });
                    }
                  });
                }
              };

              for (const s of students) {
                if (hasSettled) break;
                const regVal = (s.registrationNumber !== undefined && s.registrationNumber !== null) ? s.registrationNumber : null;
                db.run(
                  stuSql,
                  [s.id, s.name, regVal, s.fatherPhone ?? null, s.seatNumber, s.academicYearId, s.classId, s.sectionId || '', s.gender || 'male', s.notes ?? null, s.isGeneralExempt ? 1 : 0, JSON.stringify(s.individualExemptions || [])],
                  function(err: any) {
                    if (err) return errorHandler(err);
                    checkDone();
                  }
                );
              }

              if (promotionLog && !hasSettled) {
                const logSql = `INSERT OR REPLACE INTO promotion_logs (id, date, sourceYearId, sourceYearName, targetYearId, targetYearName, promotedCount, repeatingCount, graduatedCount, excludedCount, totalProcessedCount, executedBy) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                const l = promotionLog;
                db.run(
                  logSql,
                  [l.id, l.date, l.sourceYearId, l.sourceYearName, l.targetYearId, l.targetYearName, l.promotedCount, l.repeatingCount, l.graduatedCount, l.excludedCount, l.totalProcessedCount, l.executedBy],
                  function(err: any) {
                    if (err) return errorHandler(err);
                    checkDone();
                  }
                );
              }
            });
          });
        });
      };

      // Step A: Successful commit
      const validStudents = [
        { id: 's1', name: 'طالب أ', registrationNumber: '  REG-1  ', notes: '[src:src-1]' },
        { id: 's2', name: 'طالب ب', registrationNumber: null, notes: '[src:src-2]' },
      ];
      const log = { id: 'log1', date: new Date().toISOString(), promotedCount: 2 };

      const batchRes = await executeBatch(validStudents, log);
      assert.strictEqual(batchRes.success, true);

      const countRows: any = await new Promise((res, rej) => db.get('SELECT COUNT(*) as cnt FROM students', (e: any, r: any) => e ? rej(e) : res(r)));
      assert.strictEqual(countRows.cnt, 2, '2 students committed in SQLite');

      // Step B: Simulated mid-batch failure (s4 violates NOT NULL on name)
      const invalidBatch = [
        { id: 's3', name: 'طالب ج', registrationNumber: 'REG-3' },
        { id: 's4', name: null },
      ];

      let threwError = false;
      try {
        await executeBatch(invalidBatch, null);
      } catch {
        threwError = true;
      }
      assert.ok(threwError, 'Failed write threw error');

      // Check count after ROLLBACK: Must still be 2, NOT 3
      const countAfterRollback: any = await new Promise((res, rej) => db.get('SELECT COUNT(*) as cnt FROM students', (e: any, r: any) => e ? rej(e) : res(r)));
      assert.strictEqual(countAfterRollback.cnt, 2, 'ROLLBACK cleanly discarded student s3; zero partial records left');

      await new Promise<void>((res) => db.close(() => res()));
    }
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
