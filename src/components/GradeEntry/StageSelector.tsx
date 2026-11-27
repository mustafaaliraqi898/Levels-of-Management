import React from 'react';
import { GradeStage } from '../../types';
import { CalendarDays, Award, BookOpenCheck, GraduationCap, RotateCcw, Check } from 'lucide-react';

interface StageSelectorProps {
  currentStage: GradeStage;
  onChangeStage: (stage: GradeStage) => void;
}

type StageConfig = {
  id: GradeStage;
  title: string;
  order: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  selectedTone: string;
  iconTone: string;
};

export const STAGES_CONFIG: StageConfig[] = [
  {
    id: 'term1',
    title: 'الفصل الأول',
    order: 1,
    icon: CalendarDays,
    tone: 'border-[#C9D8FF] bg-[#F0F4FF] text-[#3156B8] dark:border-[#35558B] dark:bg-[#1D3150] dark:text-[#A9C3FF]',
    selectedTone: 'border-[#315BD2] bg-[#315BD2] text-white shadow-[0_6px_18px_rgba(49,91,210,0.22)] dark:border-[#6F96FF] dark:bg-[#315BD2] dark:text-white',
    iconTone: 'bg-white/75 text-[#315BD2] dark:bg-white/10 dark:text-[#D7E3FF]',
  },
  {
    id: 'midterm',
    title: 'نصف السنة',
    order: 2,
    icon: BookOpenCheck,
    tone: 'border-[#BCE7E2] bg-[#ECF9F7] text-[#087E78] dark:border-[#326B68] dark:bg-[#193B3D] dark:text-[#8CE0D6]',
    selectedTone: 'border-[#0D9488] bg-[#0D9488] text-white shadow-[0_6px_18px_rgba(13,148,136,0.20)] dark:border-[#42C7B9] dark:bg-[#087E78] dark:text-white',
    iconTone: 'bg-white/75 text-[#0D9488] dark:bg-white/10 dark:text-[#B6FFF4]',
  },
  {
    id: 'term2',
    title: 'الفصل الثاني',
    order: 3,
    icon: Award,
    tone: 'border-[#DCCBF7] bg-[#F5F0FD] text-[#7045B5] dark:border-[#5B4781] dark:bg-[#302747] dark:text-[#C9B1FF]',
    selectedTone: 'border-[#8056C7] bg-[#8056C7] text-white shadow-[0_6px_18px_rgba(128,86,199,0.20)] dark:border-[#B79AFF] dark:bg-[#7045B5] dark:text-white',
    iconTone: 'bg-white/75 text-[#8056C7] dark:bg-white/10 dark:text-[#E4D6FF]',
  },
  {
    id: 'final',
    title: 'الامتحان النهائي',
    order: 4,
    icon: GraduationCap,
    tone: 'border-[#F0D7A5] bg-[#FFF7E8] text-[#A66A12] dark:border-[#76572D] dark:bg-[#3A3021] dark:text-[#F2CA7A]',
    selectedTone: 'border-[#D18A27] bg-[#C27B17] text-white shadow-[0_6px_18px_rgba(193,123,23,0.20)] dark:border-[#E6B45A] dark:bg-[#A96C16] dark:text-white',
    iconTone: 'bg-white/75 text-[#B7791F] dark:bg-white/10 dark:text-[#FFE2A7]',
  },
  {
    id: 'second_round',
    title: 'الدور الثاني',
    order: 5,
    icon: RotateCcw,
    tone: 'border-[#D7DFE9] bg-[#F1F4F8] text-[#53657D] dark:border-[#46556A] dark:bg-[#263448] dark:text-[#C0CDDF]',
    selectedTone: 'border-[#647A98] bg-[#53657D] text-white shadow-[0_6px_18px_rgba(83,101,125,0.18)] dark:border-[#9BAEC8] dark:bg-[#53657D] dark:text-white',
    iconTone: 'bg-white/75 text-[#64748B] dark:bg-white/10 dark:text-[#E1EAF7]',
  },
];

export const StageSelector: React.FC<StageSelectorProps> = ({
  currentStage,
  onChangeStage,
}) => {
  return (
    <section className="rounded-2xl border border-[#DCE5F2] bg-white p-3.5 shadow-sm dark:border-[#2B3B52] dark:bg-[#172235] sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-black text-[#1E3356] dark:text-[#E7F0FF]">المرحلة الدراسية</h2>
          <p className="mt-0.5 text-[10px] font-medium text-[#71819A] dark:text-[#9EADC3]">اختر المرحلة المطلوبة لإدخال وتدقيق الدرجات</p>
        </div>
        <span className="hidden rounded-lg bg-[#F1F5FB] px-2.5 py-1 text-[10px] font-bold text-[#58709A] dark:bg-[#202F45] dark:text-[#A9B9D2] sm:inline-flex">
          تتغير أعمدة الجدول حسب المرحلة
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {STAGES_CONFIG.map((stage) => {
          const isSelected = currentStage === stage.id;
          const Icon = stage.icon;

          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => onChangeStage(stage.id)}
              aria-pressed={isSelected}
              className={`group relative flex min-h-[66px] items-center justify-between gap-2 overflow-hidden rounded-xl border px-3 py-2.5 text-right transition-all duration-150 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#315BD2]/25 cursor-pointer ${isSelected ? stage.selectedTone : stage.tone}`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isSelected ? 'bg-white/15 text-white' : stage.iconTone}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className={`mb-0.5 block text-[9px] font-bold opacity-75`}>المرحلة {stage.order}</span>
                  <span className="block truncate text-xs font-black sm:text-sm">{stage.title}</span>
                </span>
              </span>
              {isSelected && (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
};
