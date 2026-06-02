// ============================================
// FILE: src/components/reuseable/StatsCards.tsx
// ============================================
import React from 'react';

// Define the structure for each stat card
interface StatCardData {
  id: string;
  label: string;
  value: number | string;
  valueClassName?: string; // Optional custom styling for the value (e.g., text-success, text-warning)
}

interface StatsCardsProps {
  stats: StatCardData[];
  className?: string; // Allow custom styling
}

export const StatsCards: React.FC<StatsCardsProps> = ({ 
  stats, 
  className = "" 
}) => {
  // Auto-adjust grid based on number of cards
  const getGridColumns = () => {
    const count = stats.length;
    
    // Responsive grid that adapts to any number of cards
    if (count === 1) return "grid-cols-1";
    if (count === 2) return "sm:grid-cols-2 grid-cols-1";
    if (count === 3) return "md:grid-cols-3 sm:grid-cols-2 grid-cols-1";
    if (count === 4) return "lg:grid-cols-4 md:grid-cols-2 grid-cols-1";
    if (count === 5) return "xl:grid-cols-5 lg:grid-cols-4 md:grid-cols-3 sm:grid-cols-2 grid-cols-1";
    if (count >= 6) return "2xl:grid-cols-6 xl:grid-cols-5 lg:grid-cols-4 md:grid-cols-3 sm:grid-cols-2 grid-cols-1";
    
    return "sm:grid-cols-4 grid-cols-1"; // default fallback
  };

  return (
    <div className={`grid ${getGridColumns()} gap-3 mb-4 ${className}`}>
      {stats.map((stat) => (
        <div key={stat.id} className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">{stat.label}</div>
          <div className={`text-xl font-semibold ${stat.valueClassName || ""}`}>
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
};