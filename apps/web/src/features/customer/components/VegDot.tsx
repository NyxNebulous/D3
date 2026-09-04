type VegDotProps = {
  isVeg: boolean;
};

export function VegDot({ isVeg }: VegDotProps) {
  return (
    <span
      className={`w-3.5 h-3.5 rounded-[3px] shrink-0 border flex items-center justify-center ${
        isVeg ? "border-sage" : "border-rust"
      }`}
      aria-label={isVeg ? "Vegetarian" : "Non-vegetarian"}
      title={isVeg ? "Vegetarian" : "Non-vegetarian"}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isVeg ? "bg-sage" : "bg-rust"}`}
      />
    </span>
  );
}
