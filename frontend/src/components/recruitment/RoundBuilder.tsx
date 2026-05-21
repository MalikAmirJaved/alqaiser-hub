// src/components/recruitment/RoundBuilder.tsx
"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, Calendar, Users, Clock, FileText } from "lucide-react";
import SearchableSelect from "@/components/reuseable/SearchableSelect";

interface Round {
  round_number: number;
  round_title: string;
  interview_type: string;
  interviewer_id?: string;
  duration_minutes?: number;
  notes?: string;
}

interface RoundBuilderProps {
  onChange: (rounds: Round[]) => void;
  value?: Round[];
  employees: any[];
}

const INTERVIEW_TYPES = [
  { value: "TECHNICAL", label: "💻 Technical Interview" },
  { value: "HR", label: "👔 HR Interview" },
  { value: "MANAGERIAL", label: "📊 Managerial Interview" },
  { value: "CODING", label: "⌨️ Coding Test" },
  { value: "ASSIGNMENT", label: "📝 Assignment Review" },
  { value: "BEHAVIORAL", label: "🎯 Behavioral Assessment" },
  { value: "GROUP", label: "👥 Group Discussion" },
  { value: "PRESENTATION", label: "🎤 Presentation" },
  { value: "OTHER", label: "🔧 Other" },
];

export function RoundBuilder({ onChange, value = [], employees }: RoundBuilderProps) {
  const [roundCount, setRoundCount] = useState(value.length || 1);
  const [expandedRounds, setExpandedRounds] = useState<number[]>([]);

  const employeeOptions = employees.map(emp => ({
    value: emp.id.toString(),
    label: `${emp.first_name} ${emp.last_name || ""} - ${emp.department}`
  }));

  const toggleRoundExpand = (roundNum: number) => {
    setExpandedRounds(prev =>
      prev.includes(roundNum) ? prev.filter(r => r !== roundNum) : [...prev, roundNum]
    );
  };

  const updateRound = (roundNum: number, field: keyof Round, val: any) => {
    const updated = value.map(r =>
      r.round_number === roundNum ? { ...r, [field]: val } : r
    );
    onChange(updated);
  };

  const addRound = () => {
    const newRound: Round = {
      round_number: roundCount + 1,
      round_title: `Round ${roundCount + 1}`,
      interview_type: "TECHNICAL",
    };
    onChange([...value, newRound]);
    setRoundCount(roundCount + 1);
    setExpandedRounds([...expandedRounds, roundCount + 1]);
  };

  const removeRound = (roundNum: number) => {
    const updated = value.filter(r => r.round_number !== roundNum);
    // Renumber remaining rounds
    const renumbered = updated.map((r, idx) => ({ ...r, round_number: idx + 1 }));
    onChange(renumbered);
    setRoundCount(renumbered.length);
  };

  const handleCountChange = (count: number) => {
    if (count < 1) return;
    
    const newRounds: Round[] = [];
    for (let i = 1; i <= count; i++) {
      const existing = value.find(r => r.round_number === i);
      if (existing) {
        newRounds.push(existing);
      } else {
        newRounds.push({
          round_number: i,
          round_title: `Round ${i}`,
          interview_type: "TECHNICAL",
        });
      }
    }
    onChange(newRounds);
    setRoundCount(count);
  };

  return (
    <div className="space-y-4">
      {/* Round Count Selector */}
      <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
        <label className="text-sm font-medium">Number of Interview Rounds:</label>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5, 6].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => handleCountChange(num)}
              className={`w-10 h-10 rounded-md font-medium transition-all ${
                roundCount === num
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      {/* Rounds List */}
      <div className="space-y-3">
        {value.map((round) => (
          <div
            key={round.round_number}
            className="border border-border rounded-lg overflow-hidden bg-card"
          >
            {/* Round Header */}
            <div
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => toggleRoundExpand(round.round_number)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                  {round.round_number}
                </div>
                <div>
                  <div className="font-medium">{round.round_title || `Round ${round.round_number}`}</div>
                  <div className="text-xs text-muted-foreground">
                    {INTERVIEW_TYPES.find(t => t.value === round.interview_type)?.label || "Not configured"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRound(round.round_number);
                  }}
                  className="p-1.5 rounded-md hover:bg-red-500/15 text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                {expandedRounds.includes(round.round_number) ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Round Expanded Content */}
            {expandedRounds.includes(round.round_number) && (
              <div className="p-4 border-t border-border space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="text-sm flex flex-col gap-1">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Round Title *
                    </span>
                    <input
                      type="text"
                      value={round.round_title}
                      onChange={(e) => updateRound(round.round_number, "round_title", e.target.value)}
                      placeholder="e.g., Frontend Technical Round"
                      className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
                      required
                    />
                  </label>

                  <label className="text-sm flex flex-col gap-1">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" /> Interview Type
                    </span>
                    <SearchableSelect
                      value={round.interview_type}
                      onChange={(v) => updateRound(round.round_number, "interview_type", v)}
                      options={INTERVIEW_TYPES}
                      placeholder="Select type"
                    />
                  </label>

                  <label className="text-sm flex flex-col gap-1">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" /> Interviewer
                    </span>
                    <SearchableSelect
                      value={round.interviewer_id || ""}
                      onChange={(v) => updateRound(round.round_number, "interviewer_id", v ? v : undefined)}
                      options={employeeOptions}
                      placeholder="Assign interviewer"
                    />
                  </label>

                  <label className="text-sm flex flex-col gap-1">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Duration (minutes)
                    </span>
                    <input
                      type="number"
                      value={round.duration_minutes || ""}
                      onChange={(e) => updateRound(round.round_number, "duration_minutes", e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="e.g., 60"
                      className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                </div>

                <label className="text-sm flex flex-col gap-1">
                  <span className="text-muted-foreground">Notes / Instructions</span>
                  <textarea
                    rows={2}
                    value={round.notes || ""}
                    onChange={(e) => updateRound(round.round_number, "notes", e.target.value)}
                    placeholder="Add any notes or instructions for this round..."
                    className="bg-muted/40 border border-border rounded-md p-3 outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Round Button */}
      <button
        type="button"
        onClick={addRound}
        className="w-full p-3 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" /> Add Another Round
      </button>
    </div>
  );
}