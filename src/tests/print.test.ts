/**
 * Print & PDF Isolation Unit Test Suite
 */
import { buildIsolatedReportHtml } from '../services/printService';

function runPrintTests() {
  console.log('--------------------------------------------------');
  console.log('🖨️ Running Print & PDF Isolation Test Suite...');
  console.log('--------------------------------------------------');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASSED: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAILED: ${testName}`);
      failed++;
    }
  }

  // Mock a DOM environment for testing HTML serialization if document is not defined
  if (typeof document === 'undefined') {
    // In Node test runner, provide minimal mock
    const fakeElement = {
      cloneNode: () => ({
        style: {},
        classList: { remove: () => {} },
        querySelectorAll: () => [],
        outerHTML: '<div id="test-report"><p>كشف درجات تجريبي</p></div>',
      }),
      querySelectorAll: () => [],
      outerHTML: '<div id="test-report"><p>كشف درجات تجريبي</p></div>',
    } as any;

    (global as any).document = {
      querySelectorAll: () => [],
      styleSheets: [],
    };

    const html = buildIsolatedReportHtml(fakeElement, true);

    assert(html.includes('dir="rtl"'), 'اتجاه الصفحة المعزولة RTL');
    assert(html.includes('lang="ar"'), 'لغة المستند عربي lang="ar"');
    assert(html.includes('size: A4 landscape !important;'), 'تطبيق حجم واتجاه الورقة A4 landscape');
    assert(
      html.includes("'Cairo'") && html.includes("'Segoe UI'") && html.includes("'Traditional Arabic'"),
      'تضمين حزمة الخطوط العربية الأساسية وبدائل Windows المحلية عند انقطاع الإنترنت'
    );
    assert(
      html.includes('table-header-group !important') && html.includes('page-break-inside: avoid'),
      'تطبيق قواعد عدم تكسير صفوف الجداول وتكرار رأس الجدول عند الانتقال بين الصفحات'
    );
    assert(html.includes('print-isolated-sheet'), 'تغليف التقرير بحاوية عزل نظيفة بدون هوامش أو تشويش');
    assert(html.includes('<div id="test-report">'), 'احتواء المستند المعزول على محتوى التقرير المطلوب');

    // Test 2: Student Card Individual Grade Card full table isolation & portrait test
    const fakeStudentCardElement = {
      cloneNode: () => ({
        style: {},
        classList: { remove: () => {} },
        querySelectorAll: () => [],
        outerHTML: `
          <div class="printable-card">
            <h1>بطاقة الدرجات للعام الدراسي 2025-2026</h1>
            <p>اسم الطالب: أحمد علي محمد</p>
            <table class="w-full border-collapse border border-slate-800">
              <thead>
                <tr>
                  <th>الدروس</th>
                  <th>معدل الفصل الأول</th>
                  <th>درجة نصف السنة</th>
                  <th>معدل النصف الثاني</th>
                  <th>معدل السعي السنوي</th>
                  <th>الدرجة النهائية</th>
                  <th>الملاحظات</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>الرياضيات</td>
                  <td>85</td>
                  <td>90</td>
                  <td>88</td>
                  <td>88</td>
                  <td>92</td>
                  <td>ناجح</td>
                </tr>
              </tbody>
            </table>
            <div>الحالة النهائية للطالب: ناجح</div>
            <div>مدير المدرسة والختم الرسمي</div>
          </div>
        `,
      }),
      querySelectorAll: () => [],
      outerHTML: `
        <div class="printable-card">
          <h1>بطاقة الدرجات للعام الدراسي 2025-2026</h1>
          <p>اسم الطالب: أحمد علي محمد</p>
          <table class="w-full border-collapse border border-slate-800">
            <thead>
              <tr>
                <th>الدروس</th>
                <th>معدل الفصل الأول</th>
                <th>درجة نصف السنة</th>
                <th>معدل النصف الثاني</th>
                <th>معدل السعي السنوي</th>
                <th>الدرجة النهائية</th>
                <th>الملاحظات</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>الرياضيات</td>
                <td>85</td>
                <td>90</td>
                <td>88</td>
                <td>88</td>
                <td>92</td>
                <td>ناجح</td>
              </tr>
            </tbody>
          </table>
          <div>الحالة النهائية للطالب: ناجح</div>
          <div>مدير المدرسة والختم الرسمي</div>
        </div>
      `,
    } as any;

    const studentCardHtml = buildIsolatedReportHtml(fakeStudentCardElement, false); // portrait
    assert(studentCardHtml.includes('size: A4 portrait !important;'), 'تطبيق اتجاه الورقة العمودي A4 portrait لبطاقة الطالب الفردية');
    assert(studentCardHtml.includes('بطاقة الدرجات للعام الدراسي'), 'حفظ عنوان بطاقة درجات الطالب الفردية');
    assert(studentCardHtml.includes('الدروس') && studentCardHtml.includes('الدرجة النهائية'), 'وجود كامل أعمدة جدول درجات الطالب الفردية في الطباعة');
    assert(studentCardHtml.includes('الرياضيات') && studentCardHtml.includes('92'), 'تضمين أسماء المواد ودرجات الطالب داخل المستند المعزول للطباعة');
    assert(studentCardHtml.includes('الحالة النهائية للطالب: ناجح'), 'ظهور ملخص الحالة النهائية والتوقيع الرسمي مع جدول الدرجات');
  }

  console.log('--------------------------------------------------');
  console.log(`📊 Print Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('--------------------------------------------------');

  if (failed > 0) {
    process.exit(1);
  }
}

runPrintTests();
