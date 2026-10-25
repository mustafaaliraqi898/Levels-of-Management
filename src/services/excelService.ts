import * as XLSX from 'xlsx';

export interface ParsedStudentRow {
  rowNumber: number;
  name: string;
  registrationNumber: string;
  fatherPhone: string;
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
    regIndex: number;
    phoneIndex: number;
  };
}

/**
 * Creates and downloads the official school Excel template for importing students
 */
export function downloadStudentTemplate(): void {
  const wb = XLSX.utils.book_new();

  // 1. Sheet "الطلاب" (Students data entry sheet)
  const studentsHeaders = ['اسم الطالب', 'رقم القيد', 'رقم هاتف الأب'];
  
  // Create sheet with headers only (no dummy student names as requested)
  const wsStudents = XLSX.utils.aoa_to_sheet([studentsHeaders]);

  // Set column widths for comfortable typing
  wsStudents['!cols'] = [
    { wch: 35 }, // اسم الطالب
    { wch: 20 }, // رقم القيد
    { wch: 22 }, // رقم هاتف الأب
  ];

  // Enable Right-to-Left sheet view
  wsStudents['!views'] = [{ rightToLeft: true }];

  // 2. Sheet "تعليمات" (Guidelines sheet)
  const instructionsData = [
    ['تعليمات وإرشادات ملء قالب استيراد الطلاب:'],
    [''],
    ['1. اسم الطالب (إجباري): يُكتب اسم الطالب الثلاثي أو الرباعي كاملاً كما في الوثائق الرسمية.'],
    ['2. رقم القيد (يوصى به): الرقم التعريفي أو الإداري لسجل قيد الطالب بالمدرسة، ويجب أن يكون فريداً وغير مكرر.'],
    ['3. رقم هاتف الأب (اختياري): رقم هاتف ولي الأمر للتواصل الرسمي (مثال: 07701234567).'],
    ['4. التنظيم المدرسي (الصف والشعبة): لا تحتاج لكتابة الصف والشعبة في هذا الملف، حيث تقوم بتحديدهما مباشرة من شاشة الاستيراد في البرنامج.'],
    ['5. طريقة الاستيراد: بعد إدخال أسماء الطلاب، احفظ الملف بصيغة (.xlsx)، ثم انقر على زر «استيراد الطلاب من Excel» في النظام، واختر الصف والشعبة المستهدفة.'],
    ['6. المعاينة والتدقيق: سيقوم البرنامج بعرض معاينة كاملة لجميع السجلات والتحقق من عدم تكرار أرقام القيد قبل اعتماد الحفظ النهائي.'],
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
  wsInstructions['!cols'] = [{ wch: 100 }];
  wsInstructions['!views'] = [{ rightToLeft: true }];

  // Append sheets to workbook
  XLSX.utils.book_append_sheet(wb, wsStudents, 'الطلاب');
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'تعليمات');

  // Generate file and trigger download
  XLSX.writeFile(wb, 'قالب_استيراد_الطلاب.xlsx', { bookType: 'xlsx' });
}

/**
 * Parses an uploaded Excel file and validates student records
 */
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
        headersFound: { nameIndex: -1, regIndex: -1, phoneIndex: -1 },
      };
    }

    // Try to find sheet named "الطلاب", otherwise use the first sheet
    let sheetName = wb.SheetNames.find(
      (name) => name.trim() === 'الطلاب' || name.toLowerCase().includes('student')
    );
    if (!sheetName) {
      sheetName = wb.SheetNames[0];
    }

    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
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
        headersFound: { nameIndex: -1, regIndex: -1, phoneIndex: -1 },
      };
    }

    // Locate header row (check row 0 or row 1)
    let headerRowIndex = -1;
    let nameIndex = -1;
    let regIndex = -1;
    let phoneIndex = -1;

    for (let r = 0; r < Math.min(5, rows.length); r++) {
      const row = rows[r] || [];
      for (let c = 0; c < row.length; c++) {
        const cell = String(row[c] || '').trim().toLowerCase();
        if (cell.includes('اسم الطالب') || cell.includes('الاسم') || cell === 'اسم' || cell === 'name') {
          nameIndex = c;
          headerRowIndex = r;
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
      if (nameIndex !== -1) break;
    }

    if (nameIndex === -1) {
      return {
        success: false,
        errorMessage: 'لم يتم العثور على عمود «اسم الطالب» في الملف. يرجى التأكد من استخدام القالب الرسمي.',
        totalRows: 0,
        validRows: [],
        invalidRows: [],
        headersFound: { nameIndex: -1, regIndex: -1, phoneIndex: -1 },
      };
    }

    const validRows: ParsedStudentRow[] = [];
    const invalidRows: ParsedStudentRow[] = [];
    const seenRegInFile = new Set<string>();

    const dataRows = rows.slice(headerRowIndex + 1);

    dataRows.forEach((row, idx) => {
      const rowNumber = headerRowIndex + 2 + idx; // 1-based Excel row number
      const name = String(row[nameIndex] || '').trim();
      const reg = regIndex !== -1 ? String(row[regIndex] || '').trim() : '';
      const phone = phoneIndex !== -1 ? String(row[phoneIndex] || '').trim() : '';

      // Skip row if completely empty
      if (!name && !reg && !phone) {
        return;
      }

      const errors: string[] = [];

      // Validate name
      if (!name) {
        errors.push('اسم الطالب فارغ');
      } else if (name.length < 3) {
        errors.push('اسم الطالب قصير جداً (أقل من 3 أحرف)');
      }

      // Validate registration number
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
        registrationNumber: reg,
        fatherPhone: phone,
        errors,
        isValid: errors.length === 0,
      };

      if (rowObj.isValid) {
        validRows.push(rowObj);
      } else {
        invalidRows.push(rowObj);
      }
    });

    const totalRows = validRows.length + invalidRows.length;

    return {
      success: true,
      totalRows,
      validRows,
      invalidRows,
      headersFound: { nameIndex, regIndex, phoneIndex },
    };
  } catch (e) {
    return {
      success: false,
      errorMessage: `حدث خطأ أثناء معالجة وقراءة ملف Excel: ${e instanceof Error ? e.message : 'تنسيق الملف غير صالح'}`,
      totalRows: 0,
      validRows: [],
      invalidRows: [],
      headersFound: { nameIndex: -1, regIndex: -1, phoneIndex: -1 },
    };
  }
}
