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
    badgeColor: 'border-blue-200 dark:border-blue-500/40 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/15',
  },
  {
    id: 'midterm',
    title: 'درجة نصف السنة',
    order: 2,
    description: 'عرض الفصل الأول + إدخال درجة نصف السنة',
    icon: BookOpenCheck,
    badgeColor: 'border-teal-200 dark:border-teal-500/40 text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/15',
  },
  {
    id: 'term2',
    title: 'درجة الفصل الثاني',
    order: 3,
    description: 'إدخال الفصل الثاني + حساب السعي السنوي تلقائياً',
    icon: Award,
    badgeColor: 'border-amber-200 dark:border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15',
  },
  {
    id: 'final',
    title: 'درجة الامتحان النهائي',
    order: 4,
    description: 'إدخال الامتحان النهائي + حساب الدرجة النهائية تلقائياً',
    icon: GraduationCap,
    badgeColor: 'border-emerald-200 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15',
  },
  {
    id: 'second_round',
    title: 'امتحان الدور الثاني (الإكمال)',
    order: 5,
    description: 'إدخال درجة الإكمال للطلاب المكمّلين وحساب الدرجة النهائية بعد الإكمال',
    icon: RotateCcw,
    badgeColor: 'border-purple-200 dark:border-purple-500/40 text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/15',
  },
];

export const StageSelector: React.FC<StageSelectorProps> = ({
  currentStage,
  onChangeStage,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <span>المرحلة الدراسية المطلوبة لإدخال وتدقيق الدرجات</span>
          <span className="text-emerald-700 dark:text-emerald-400 font-mono text-[11px]">(تحديد الأعمدة ديناميكياً)</span>
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
                  ? 'bg-emerald-50/70 dark:bg-slate-800 border-emerald-600 dark:border-emerald-400 shadow-sm ring-1 ring-emerald-600/30 dark:ring-emerald-400/30'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100/70 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300'
              }`}
            >
              {isSelected && (
                <div className="absolute top-0 right-0 left-0 h-0.5 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 dark:from-emerald-400 dark:via-teal-400 dark:to-emerald-500" />
              )}

              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${stage.badgeColor}`}>
                  المرحلة {stage.order}
                </span>
                <Icon className={`w-5 h-5 ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`} />
              </div>

              <div>
                <h4 className={`font-bold text-sm ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                  {stage.title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
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
