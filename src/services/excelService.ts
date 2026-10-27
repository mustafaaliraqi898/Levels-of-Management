import * as XLSX from 'xlsx';

export interface ParsedStudentRow {
  rowNumber: number;
  name: string;
  className: string;
  sectionName: string;
  registrationNumber: string;
  fatherPhone: string;
  /** Resolved automatically against the school's existing classes and sections. */
  classId?: string;
  sectionId?: string;
  errors: string[];
  isValid: boolean;
}

export interface ExcelParseResult {
  success: boolean;
  errorMessage?: string;
  totalRows: number;
  validRows: ParsedStudentRow[];
  invalidRows: ParsedStudentRow[];
  headersFound: {
    nameIndex: number;
    classIndex: number;
    sectionIndex: number;
    regIndex: number;
    phoneIndex: number;
  };
}

const emptyHeaders = () => ({
  nameIndex: -1,
  classIndex: -1,
  sectionIndex: -1,
  regIndex: -1,
  phoneIndex: -1,
});

/**
 * Creates one common Excel template for every class and section in the school.
 * The class and section are read from each row during import; the user does not
 * need to select a destination in the application.
 */
export function downloadStudentTemplate(): void {
  const wb = XLSX.utils.book_new();

  const studentsHeaders = [
    'اسم الطالب',
    'الصف',
    'الشعبة (إن وجدت)',
    'رقم القيد',
    'رقم هاتف الأب',
  ];
  const wsStudents = XLSX.utils.aoa_to_sheet([studentsHeaders]);
  wsStudents['!cols'] = [
    { wch: 35 },
    { wch: 25 },
    { wch: 20 },
    { wch: 20 },
    { wch: 22 },
  ];
  wsStudents['!views'] = [{ rightToLeft: true }];

  const instructionsData = [
    ['تعليمات وإرشادات ملء قالب استيراد الطلاب الموحد:'],
    [''],
    ['1. اسم الطالب (إجباري): اكتب اسم الطالب الثلاثي أو الرباعي كاملاً كما في الوثائق الرسمية.'],
    ['2. الصف (إجباري): اكتب اسم الصف كما هو مسجل في البرنامج، مثل: الرابع العلمي.'],
    ['3. الشعبة (حسب الحاجة): اكتب اسم الشعبة كما هو مسجل في البرنامج. اتركها فارغة إذا كان الصف لا يحتوي على شعب.'],
    ['4. رقم القيد (اختياري): رقم القيد الإداري للطالب، ويجب ألا يكون مكرراً داخل الملف أو مسجلاً مسبقاً لطالب آخر.'],
    ['5. رقم هاتف الأب (اختياري): رقم هاتف ولي الأمر. يفضّل تنسيق العمود كنص للمحافظة على الصفر في بداية الرقم.'],
    ['6. يمكن وضع طلاب صفوف وشعب مختلفة في ملف واحد؛ سيحدد البرنامج الصف والشعبة لكل طالب تلقائياً من بيانات الصف نفسه.'],
    ['7. إذا كان للصف شعبة واحدة فقط وترك حقل الشعبة فارغاً، سيضع البرنامج الطالب في تلك الشعبة تلقائياً. أما إذا كان للصف عدة شعب فيجب تحديد الشعبة.'],
    ['8. احفظ الملف بصيغة .xlsx، ثم اختره من «استيراد الطلاب من Excel» وراجع المعاينة والأخطاء قبل اعتماد الاستيراد.'],
  ];
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
  wsInstructions['!cols'] = [{ wch: 115 }];
  wsInstructions['!views'] = [{ rightToLeft: true }];

  XLSX.utils.book_append_sheet(wb, wsStudents, 'الطلاب');
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'تعليمات');
  XLSX.writeFile(wb, 'قالب_استيراد_الطلاب_الموحد.xlsx', { bookType: 'xlsx' });
}

/** Parses and validates students from the unified Excel template. */
export async function parseStudentExcelFile(
  file: File,
  existingRegistrationNumbers: Set<string>
): Promise<ExcelParseResult> {
  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });

    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      return {
        success: false,
        errorMessage: 'الملف لا يحتوي على أي صفحات عمل صالحة.',
        totalRows: 0,
        validRows: [],
        invalidRows: [],
        headersFound: emptyHeaders(),
      };
    }

    const sheetName = wb.SheetNames.find(
      (name) => name.trim() === 'الطلاب' || name.toLowerCase().includes('student')
    ) || wb.SheetNames[0];

    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });

    if (rows.length === 0) {
      return {
        success: false,
        errorMessage: 'صفحة العمل فارغة ولا تحتوي على بيانات.',
        totalRows: 0,
        validRows: [],
        invalidRows: [],
        headersFound: emptyHeaders(),
      };
    }

    let headerRowIndex = -1;
    let nameIndex = -1;
    let classIndex = -1;
    let sectionIndex = -1;
    let regIndex = -1;
    let phoneIndex = -1;

    for (let r = 0; r < Math.min(10, rows.length); r++) {
      const row = rows[r] || [];
      let rowHasNameHeader = false;
      for (let c = 0; c < row.length; c++) {
        const cell = String(row[c] ?? '').trim().toLowerCase();
        if (cell.includes('اسم الطالب') || cell.includes('الاسم') || cell === 'اسم' || cell === 'name') {
          nameIndex = c;
          rowHasNameHeader = true;
        } else if (cell === 'الصف' || cell.includes('الصف الدراسي') || cell === 'class' || cell.includes('class name')) {
          classIndex = c;
        } else if (cell.includes('الشعبة') || cell === 'section' || cell.includes('section name')) {
          sectionIndex = c;
        } else if (cell.includes('رقم القيد') || cell.includes('القيد') || cell.includes('registration')) {
          regIndex = c;
        } else if (
          cell.includes('هاتف الأب') ||
          cell.includes('رقم الهاتف') ||
          cell.includes('هاتف') ||
          cell.includes('الهاتف') ||
          cell.includes('phone')
        ) {
          phoneIndex = c;
        }
      }
      if (rowHasNameHeader) {
        headerRowIndex = r;
        break;
      }
    }

    if (nameIndex === -1 || classIndex === -1) {
      return {
        success: false,
        errorMessage: 'لم يتم العثور على عمودي «اسم الطالب» و«الصف» في الملف. نزّل قالب Excel الموحد الجديد وأدخل بيانات كل طالب في صف مستقل.',
        totalRows: 0,
        validRows: [],
        invalidRows: [],
        headersFound: { nameIndex, classIndex, sectionIndex, regIndex, phoneIndex },
      };
    }

    const validRows: ParsedStudentRow[] = [];
    const invalidRows: ParsedStudentRow[] = [];
    const seenRegInFile = new Set<string>();
    const dataRows = rows.slice(headerRowIndex + 1);

    dataRows.forEach((row, idx) => {
      const rowNumber = headerRowIndex + 2 + idx;
      const name = String(row[nameIndex] ?? '').trim();
      const className = String(row[classIndex] ?? '').trim();
      const sectionName = sectionIndex !== -1 ? String(row[sectionIndex] ?? '').trim() : '';
      const reg = regIndex !== -1 ? String(row[regIndex] ?? '').trim() : '';
      const phone = phoneIndex !== -1 ? String(row[phoneIndex] ?? '').trim() : '';

      if (!name && !className && !sectionName && !reg && !phone) return;

      const errors: string[] = [];
      if (!name) {
        errors.push('اسم الطالب فارغ');
      } else if (name.length < 3) {
        errors.push('اسم الطالب قصير جداً (أقل من 3 أحرف)');
      }

      if (!className) errors.push('اسم الصف فارغ');

      if (reg) {
        if (seenRegInFile.has(reg)) {
          errors.push(`رقم القيد «${reg}» مكرر داخل هذا الملف في أكثر من صف`);
        } else {
          seenRegInFile.add(reg);
        }
        if (existingRegistrationNumbers.has(reg)) {
          errors.push(`رقم القيد «${reg}» مسجل مسبقاً لطالب آخر في النظام`);
        }
      }

      const rowObj: ParsedStudentRow = {
        rowNumber,
        name,
        className,
        sectionName,
        registrationNumber: reg,
        fatherPhone: phone,
        errors,
        isValid: errors.length === 0,
      };
      if (rowObj.isValid) validRows.push(rowObj);
      else invalidRows.push(rowObj);
    });

    return {
      success: true,
      totalRows: validRows.length + invalidRows.length,
      validRows,
      invalidRows,
      headersFound: { nameIndex, classIndex, sectionIndex, regIndex, phoneIndex },
    };
  } catch (e) {
    return {
      success: false,
      errorMessage: `حدث خطأ أثناء معالجة وقراءة ملف Excel: ${e instanceof Error ? e.message : 'تنسيق الملف غير صالح'}`,
      totalRows: 0,
      validRows: [],
      invalidRows: [],
      headersFound: emptyHeaders(),
    };
  }
}
