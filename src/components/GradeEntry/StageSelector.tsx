import React from 'react';
import { GradeStage } from '../../types';
import { CalendarDays, Award, BookOpenCheck, GraduationCap, RotateCcw } from 'lucide-react';

interface StageSelectorProps {
  currentStage: GradeStage;
  onChangeStage: (stage: GradeStage) => void;
}

export const STAGES_CONFIG: {
  id: GradeStage;
  title: string;
  order: number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeColor: string;
}[] = [
  {
    id: 'term1',
    title: 'درجة الفصل الأول',
    order: 1,
    description: 'إدخال درجات الفصل الأول الأساسية',
    icon: CalendarDays,
    badgeColor: 'border-[#DCE3ED] dark:border-[#2D3B4D] text-[#3156C9] dark:text-[#60A5FA] bg-[#3156C9]/8 dark:bg-[#2785F5]/12',
  },
  {
    id: 'midterm',
    title: 'درجة نصف السنة',
    order: 2,
    description: 'عرض الفصل الأول + إدخال درجة نصف السنة',
    icon: BookOpenCheck,
    badgeColor: 'border-[#DCE3ED] dark:border-[#2D3B4D] text-[#3156C9] dark:text-[#60A5FA] bg-[#3156C9]/8 dark:bg-[#2785F5]/12',
  },
  {
    id: 'term2',
    title: 'درجة الفصل الثاني',
    order: 3,
    description: 'إدخال الفصل الثاني + حساب السعي السنوي تلقائياً',
    icon: Award,
    badgeColor: 'border-[#DCE3ED] dark:border-[#2D3B4D] text-[#3156C9] dark:text-[#60A5FA] bg-[#3156C9]/8 dark:bg-[#2785F5]/12',
  },
  {
    id: 'final',
    title: 'درجة الامتحان النهائي',
    order: 4,
    description: 'إدخال الامتحان النهائي + حساب الدرجة النهائية تلقائياً',
    icon: GraduationCap,
    badgeColor: 'border-[#DCE3ED] dark:border-[#2D3B4D] text-[#059669] dark:text-[#10B981] bg-[#10B981]/10 dark:bg-[#10B981]/12',
  },
  {
    id: 'second_round',
    title: 'امتحان الدور الثاني (الإكمال)',
    order: 5,
    description: 'إدخال درجة الإكمال للطلاب المكمّلين وحساب الدرجة النهائية بعد الإكمال',
    icon: RotateCcw,
    badgeColor: 'border-[#DCE3ED] dark:border-[#2D3B4D] text-[#B45309] dark:text-[#D69B42] bg-[#D69B42]/10 dark:bg-[#D69B42]/12',
  },
];

export const StageSelector: React.FC<StageSelectorProps> = ({
  currentStage,
  onChangeStage,
}) => {
  return (
    <div className="bg-white dark:bg-[#1C2939] border border-[#DCE3ED] dark:border-[#2D3B4D] rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <label className="text-xs font-bold text-[#475569] dark:text-[#A8B5C7] tracking-wide flex items-center gap-2">
          <span>المرحلة الدراسية المطلوبة لإدخال وتدقيق الدرجات</span>
          <span className="text-[#3156C9] dark:text-[#60A5FA] font-mono text-[11px]">(تحديد الأعمدة ديناميكياً)</span>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {STAGES_CONFIG.map((stage) => {
          const isSelected = currentStage === stage.id;
          const Icon = stage.icon;

          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => onChangeStage(stage.id)}
              className={`text-right p-3.5 rounded-lg border transition-all duration-150 flex flex-col justify-between cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'bg-[#3156C9]/[0.07] dark:bg-[#2785F5]/15 border-[#3156C9] dark:border-[#2785F5] shadow-sm ring-1 ring-[#3156C9]/25 dark:ring-[#2785F5]/30'
                  : 'bg-[#F8FAFC] dark:bg-[#202E40] border-[#DCE3ED] dark:border-[#2D3B4D] hover:border-[#2785F5]/50 dark:hover:border-[#60A5FA]/40 hover:bg-[#EDF1F7] dark:hover:bg-[#26364B] text-[#475569] dark:text-[#A8B5C7]'
              }`}
            >
              {isSelected && (
                <div className="absolute top-0 right-0 left-0 h-0.5 bg-[#3156C9] dark:bg-[#2785F5]" />
              )}

              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${stage.badgeColor}`}>
                  المرحلة {stage.order}
                </span>
                <Icon className={`w-5 h-5 ${isSelected ? 'text-[#3156C9] dark:text-[#60A5FA]' : 'text-[#64748B] dark:text-[#8493A8]'}`} />
              </div>

              <div>
                <h4 className={`font-bold text-sm ${isSelected ? 'text-[#1E293B] dark:text-white' : 'text-[#1E293B] dark:text-[#E2E8F0]'}`}>
                  {stage.title}
                </h4>
                <p className="text-xs text-[#64748B] dark:text-[#8493A8] mt-1 line-clamp-1">
                  {stage.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
