import { SchoolClass, Section, Student, Subject } from '../types';

/**
 * دالة مركزية موحدة لتصفية الصفوف الدراسية التابعة لعام دراسي محدد
 *
 * القواعد المعتمدة:
 * 1. إذا كان الصف يمتلك `academicYearId` صريحاً:
 *    - يظهر حصراً في العام المطابق لمعرّفه (`c.academicYearId === targetYearId`).
 *    - لا يظهر في أي عام دراسي آخر نهائياً.
 * 2. إذا كان الصف قديماً بدون `academicYearId` (سجل تاريخي Legacy):
 *    - يُنسب بأمان إلى العام الدراسي الافتراضي/الرئيسي (`defaultYearId`) لمنع فقده أو اختفائه.
 *    - لا يتسرب ولا يظهر في السنوات الدراسية الأخرى (مثل الأعوام الجديدة).
 * 3. الحفاظ على الترتيب الأكاديمي المعتمد للصفوف (`c.order`).
 */
export function filterClassesByAcademicYear(
  classes: SchoolClass[],
  targetYearId?: string,
  defaultYearId?: string
): SchoolClass[] {
  if (!targetYearId) return [];

  return classes
    .filter((c) => {
      if (c.academicYearId) {
        return c.academicYearId === targetYearId;
      }
      // حماية السجلات القديمة: تظهر فقط عند اختيار العام الافتراضي/الحالي
      return Boolean(defaultYearId && targetYearId === defaultYearId);
    })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * تصفية الشُعب الدراسية لتقتصر على الشُعب التابعة للصفوف المحددة
 */
export function filterSectionsByClassIds(
  sections: Section[],
  classIds: string[] | Set<string>
): Section[] {
  const set = classIds instanceof Set ? classIds : new Set(classIds);
  return sections.filter((s) => set.has(s.classId));
}

/**
 * تصفية الطلاب التابعين لعام دراسي محدد
 */
export function filterStudentsByAcademicYear(
  students: Student[],
  targetYearId?: string
): Student[] {
  if (!targetYearId) return [];
  return students.filter((s) => s.academicYearId === targetYearId);
}

/**
 * تصفية المواد الدراسية لتقتصر على المواد التابعة للصفوف المحددة
 */
export function filterSubjectsByClassIds(
  subjects: Subject[],
  classIds: string[] | Set<string>
): Subject[] {
  const set = classIds instanceof Set ? classIds : new Set(classIds);
  return subjects
    .filter((sub) => set.has(sub.classId))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
