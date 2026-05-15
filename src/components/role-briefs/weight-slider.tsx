type WeightSliderProps = {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
};

export function WeightSlider({ id, label, value, onChange }: WeightSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>
        <span className="tabular-nums text-sm font-semibold text-slate-900">
          {value}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-slate-900"
      />
    </div>
  );
}
