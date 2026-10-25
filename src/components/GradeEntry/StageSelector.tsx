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
    badgeColor: 'border-blue-500/50 text-blue-400 bg-blue-500/10',
  },
  {
    id: 'midterm',
    title: 'درجة نصف السنة',
    order: 2,
    description: 'عرض الفصل الأول + إدخال درجة نصف السنة',
    icon: BookOpenCheck,
    badgeColor: 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10',
  },
  {
    id: 'term2',
    title: 'درجة الفصل الثاني',
    order: 3,
    description: 'إدخال الفصل الثاني + حساب السعي السنوي تلقائياً',
    icon: Award,
    badgeColor: 'border-amber-500/50 text-amber-400 bg-amber-500/10',
  },
  {
    id: 'final',
    title: 'درجة الامتحان النهائي',
    order: 4,
    description: 'إدخال الامتحان النهائي + حساب الدرجة النهائية تلقائياً',
    icon: GraduationCap,
    badgeColor: 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10',
  },
  {
    id: 'second_round',
    title: 'امتحان الدور الثاني (الإكمال)',
    order: 5,
    description: 'إدخال درجة الإكمال للطلاب المكمّلين وحساب الدرجة النهائية بعد الإكمال',
    icon: RotateCcw,
    badgeColor: 'border-purple-500/50 text-purple-400 bg-purple-500/10',
  },
];

export const StageSelector: React.FC<StageSelectorProps> = ({
  currentStage,
  onChangeStage,
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <span>المرحلة الدراسية المطلوبة لإدخال وتدقيق الدرجات</span>
          <span className="text-emerald-400 font-mono text-[11px]">(تحديد الأعمدة ديناميكياً)</span>
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
                  ? 'bg-gradient-to-br from-slate-800 to-slate-850 border-emerald-500/80 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500/40'
                  : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-850/60 text-slate-300'
              }`}
            >
              {isSelected && (
                <div className="absolute top-0 right-0 left-0 h-0.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />
              )}
              
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${stage.badgeColor}`}>
                  المرحلة {stage.order}
                </span>
                <Icon className={`w-5 h-5 ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`} />
              </div>

              <div>
                <h4 className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                  {stage.title}
                </h4>
                <p className="text-xs text-slate-400 mt-1 line-clamp-1">
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
