const localStore = new Map<string, string>();
const sessionStore = new Map<string, string>();

const createStorage = (store: Map<string, string>) => ({
  getItem: (key: string) => store.get(key) || null,
  setItem: (key: string, val: string) => { store.set(key, String(val)); },
  removeItem: (key: string) => { store.delete(key); },
  clear: () => { store.clear(); },
  key: (i: number) => Array.from(store.keys())[i] || null,
  length: 0,
});

if (typeof (global as any).window === 'undefined') {
  (global as any).window = global;
}
if (typeof (global as any).localStorage === 'undefined') {
  (global as any).localStorage = createStorage(localStore);
}
if (typeof (global as any).sessionStorage === 'undefined') {
  (global as any).sessionStorage = createStorage(sessionStore);
}
if (typeof (global as any).requestAnimationFrame === 'undefined') {
  (global as any).requestAnimationFrame = (cb: () => void) => { cb(); return 1; };
}

import { db } from '../services/storage';
import { authService } from '../services/auth';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ TEST FAILED: ${message}`);
  }
  console.log(`  ✅ PASSED: ${message}`);
}

async function runPermissionsTests() {
  console.log('--------------------------------------------------');
  console.log('🔒 Running Role-Based Access Control (RBAC) & Read-Only Tests...');
  console.log('--------------------------------------------------');

  // 1. Set admin session
  const adminSession = {
    user: {
      id: 'usr-admin-test',
      username: 'admin',
      role: 'admin' as const,
    },
    token: 'test-admin-token',
    loginTime: new Date().toISOString(),
  };
  authService.saveSession(adminSession);

  // Admin should be allowed to save grade
  const adminGradeRes = await db.saveGradeField(
    'ay-2026',
    'cls-1',
    'sec-1',
    'sub-1',
    'stu-1',
    'term1Score',
    'الفصل الأول',
    85
  );
  assert(adminGradeRes.success === true, 'المدير يستطيع حفظ وتعديل درجات الطلاب بنجاح');

  // 2. Set read-only user session
  const userSession = {
    user: {
      id: 'usr-user-test',
      username: 'viewer',
      role: 'user' as const,
    },
    token: 'test-user-token',
    loginTime: new Date().toISOString(),
  };
  authService.saveSession(userSession);

  // 3. User attempt to save grade must be rejected
  const initialGrade = db.getGradeRecord('ay-2026_cls-1_sec-1_sub-1_stu-1')?.term1Score;
  const userGradeRes = await db.saveGradeField(
    'ay-2026',
    'cls-1',
    'sec-1',
    'sub-1',
    'stu-1',
    'term1Score',
    'الفصل الأول',
    99
  );
  assert(userGradeRes.success === false, 'المستخدم العادي (Read-Only) يُرفض عند محاولة تعديل درجة طالب');
  const postAttemptGrade = db.getGradeRecord('ay-2026_cls-1_sec-1_sub-1_stu-1')?.term1Score;
  assert(initialGrade === postAttemptGrade, 'قاعدة البيانات لم تتأثر مطلقاً بمحاولة كتابة المستخدم العادي');

  // 4. User attempt to add student must be rejected
  const addStudentRes = db.addStudent({
    name: 'طالب غير مصرح به',
    academicYearId: 'ay-2026',
    classId: 'cls-1',
    sectionId: 'sec-1',
  }) as any;
  assert(addStudentRes.success === false, 'المستخدم العادي يُرفض عند محاولة إضافة طالب جديد');

  // 5. User attempt to update settings must be rejected
  const settingsRes = db.updateSettings({ schoolName: 'اسم جديد محظور' });
  assert(settingsRes.success === false, 'المستخدم العادي يُرفض عند محاولة تعديل إعدادات النظام');

  // 6. User attempt to add user must be rejected
  const addUserRes = db.addUser({
    username: 'hacker',
    passwordHash: '123',
    salt: '123',
    role: 'admin',
    isActive: true,
  });
  assert(addUserRes.success === false, 'المستخدم العادي يُرفض عند محاولة إضافة مستخدم جديد');

  // Clean up
  authService.clearSession();
  console.log('--------------------------------------------------');
  console.log('📊 All Permissions Tests Passed Successfully!');
  console.log('--------------------------------------------------');
}

runPermissionsTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
