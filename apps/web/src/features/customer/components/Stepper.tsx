type StepperProps = {
  itemName: string;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
};

export function Stepper({
  itemName,
  quantity,
  onIncrement,
  onDecrement,
  disabled = false
}: StepperProps) {
  return (
    <div
      className="flex items-center bg-ember rounded-lg overflow-hidden"
      aria-label={`${itemName} quantity`}
    >
      <button
        className="w-[30px] h-8 bg-transparent text-[#1a0d06] text-base font-bold flex items-center justify-center shrink-0 cursor-pointer hover:bg-black/10 active:bg-black/20 transition disabled:opacity-50"
        aria-label={`Decrease ${itemName}`}
        disabled={disabled}
        onClick={onDecrement}
        type="button"
      >
        −
      </button>
      <span className="text-[13px] font-bold text-[#1a0d06] w-[22px] text-center select-none">
        {quantity}
      </span>
      <button
        className="w-[30px] h-8 bg-transparent text-[#1a0d06] text-base font-bold flex items-center justify-center shrink-0 cursor-pointer hover:bg-black/10 active:bg-black/20 transition disabled:opacity-50"
        aria-label={`Increase ${itemName}`}
        disabled={disabled}
        onClick={onIncrement}
        type="button"
      >
        +
      </button>
    </div>
  );
}
