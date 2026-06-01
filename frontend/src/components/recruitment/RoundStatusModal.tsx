// src/components/recruitment/RoundStatusModal.tsx
"use client";

import { useState } from "react";
import { X, CheckCircle, XCircle, Clock, Calendar, User, MessageSquare, Star, ChevronDown} from "lucide-react";
import { DatePicker } from "@/components/reuseable/DatePicker";
interface Round {
  id: string;
  round_number: number;
  round_title: string;
  status: "PENDING" | "PASSED" | "FAILED" | "SCHEDULED" | "CANCELLED";
  interview_date?: string;
  feedback?: string;
  rating?: number;
  interviewer_name?: string;
}

interface RoundStatusModalProps {
  rounds: Round[];
  onClose: () => void;
  onUpdate?: (updates: Array<{ round_id: string; status: string; feedback?: string; rating?: number; interview_date?: string }>) => void;
  candidateName: string;
}

const STATUS_OPTIONS = [
  { value: "PENDING", label: "⏳ Pending", color: "bg-gray-500" },
  { value: "SCHEDULED", label: "📅 Scheduled", color: "bg-blue-500" },
  { value: "PASSED", label: "✅ Passed", color: "bg-green-500" },
  { value: "FAILED", label: "❌ Failed", color: "bg-red-500" },
  { value: "CANCELLED", label: "🚫 Cancelled", color: "bg-orange-500" },
];

export function RoundStatusModal({ rounds, onClose, onUpdate, candidateName }: RoundStatusModalProps) {
  const [roundUpdates, setRoundUpdates] = useState<Record<string, any>>({});
  const [selectedRound, setSelectedRound] = useState<string | null>(null);

  const sortedRounds = [...rounds].sort((a, b) => a.round_number - b.round_number);

  const updateRoundStatus = (roundId: string, field: string, value: any) => {
    setRoundUpdates(prev => ({
      ...prev,
      [roundId]: { ...prev[roundId], [field]: value, round_id: roundId }
    }));
  };

  const handleSubmit = () => {
    const updates = Object.values(roundUpdates);
    if (updates.length > 0 && onUpdate) {
      onUpdate(updates);
    }
    onClose();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PASSED": return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "FAILED": return <XCircle className="w-4 h-4 text-red-500" />;
      case "SCHEDULED": return <Calendar className="w-4 h-4 text-blue-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border flex items-center justify-between p-4 z-10">
          <div>
            <h2 className="font-semibold text-lg">Interview Rounds Status</h2>
            <p className="text-sm text-muted-foreground">{candidateName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {/* Rounds Timeline */}
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-border" />

            {sortedRounds.map((round, idx) => {
              const currentStatus = roundUpdates[round.id]?.status || round.status;
              const isFailed = currentStatus === "FAILED";
              const isSelected = selectedRound === round.id;

              return (
                <div key={round.id} className="relative mb-6">
                  {/* Timeline dot */}
                  <div className={`absolute left-4 top-1 w-4 h-4 rounded-full border-2 border-background ${
                    currentStatus === "PASSED" ? "bg-green-500" :
                    currentStatus === "FAILED" ? "bg-red-500" :
                    currentStatus === "SCHEDULED" ? "bg-blue-500" :
                    "bg-gray-400"
                  }`} />

                  {/* Round Card */}
                  <div className="ml-12">
                    <div
                      className={`bg-muted/30 rounded-lg border overflow-hidden transition-all ${
                        isSelected ? "border-primary" : "border-border"
                      }`}
                    >
                      <div
                        className="p-4 cursor-pointer hover:bg-muted/20 transition-colors"
                        onClick={() => setSelectedRound(isSelected ? null : round.id)}
                      >
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                              {round.round_number}
                            </div>
                            <div>
                              <div className="font-medium">{round.round_title}</div>
                              <div className="text-xs text-muted-foreground">
                                {round.interviewer_name ? `Interviewer: ${round.interviewer_name}` : "No interviewer assigned"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                              currentStatus === "PASSED" ? "bg-green-500/15 text-green-600" :
                              currentStatus === "FAILED" ? "bg-red-500/15 text-red-600" :
                              currentStatus === "SCHEDULED" ? "bg-blue-500/15 text-blue-600" :
                              "bg-gray-500/15 text-gray-600"
                            }`}>
                              {getStatusIcon(currentStatus)}
                              {STATUS_OPTIONS.find(s => s.value === currentStatus)?.label || currentStatus}
                            </span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${isSelected ? "rotate-180" : ""}`} />
                          </div>
                        </div>
                      </div>

                      {/* Expanded Content */}
                      {isSelected && (
                        <div className="p-4 border-t border-border space-y-4">
                          {/* Status Selection */}
                          <div className="grid sm:grid-cols-2 gap-3">
                            <label className="text-sm flex flex-col gap-1">
                              <span className="text-muted-foreground">Status</span>
                              <div className="flex flex-wrap gap-2">
                                {STATUS_OPTIONS.map(opt => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                      updateRoundStatus(round.id, "status", opt.value);
                                      // If setting to PASSED/FAILED, also update timestamp
                                      if (opt.value === "PASSED" || opt.value === "FAILED") {
                                        updateRoundStatus(round.id, "interview_date", new Date().toISOString());
                                      }
                                    }}
                                    className={`px-3 py-1.5 rounded-md text-sm transition-all ${
                                      currentStatus === opt.value
                                        ? `${opt.color} text-white`
                                        : "bg-muted hover:bg-muted/80"
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </label>

                            <label className="text-sm flex flex-col gap-1">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> Interview Date
                              </span>
                              <DatePicker
                                value={roundUpdates[round.id]?.interview_date || round.interview_date}
                                onChange={(v) => updateRoundStatus(round.id, "interview_date", v)}
                              />
                            </label>
                          </div>

                          {/* Feedback */}
                          <label className="text-sm flex flex-col gap-1">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" /> Feedback
                            </span>
                            <textarea
                              rows={3}
                              value={roundUpdates[round.id]?.feedback !== undefined ? roundUpdates[round.id].feedback : round.feedback || ""}
                              onChange={(e) => updateRoundStatus(round.id, "feedback", e.target.value)}
                              placeholder="Add detailed feedback about this round..."
                              className="bg-muted/40 border border-border rounded-md p-3 outline-none focus:ring-2 focus:ring-ring"
                            />
                          </label>

                          {/* Rating */}
                          <label className="text-sm flex flex-col gap-1">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Star className="w-3 h-3" /> Rating (1-10)
                            </span>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min="1"
                                max="10"
                                value={roundUpdates[round.id]?.rating !== undefined ? roundUpdates[round.id].rating : round.rating || 5}
                                onChange={(e) => updateRoundStatus(round.id, "rating", parseInt(e.target.value))}
                                className="flex-1"
                              />
                              <span className="w-8 text-center font-medium">
                                {roundUpdates[round.id]?.rating !== undefined ? roundUpdates[round.id].rating : round.rating || 5}
                              </span>
                            </div>
                          </label>

                          {/* Warning for cascade rejection */}
                          {isFailed && round.round_number < sortedRounds.length && (
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3 text-sm text-yellow-600">
                              ⚠️ This round is marked as FAILED. All subsequent rounds will be automatically rejected.
                              You can manually update later rounds if needed.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="sticky bottom-0 bg-card border-t border-border p-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 h-9 rounded-md border border-border hover:bg-muted">
            Cancel
          </button>
          {onUpdate && (
            <button onClick={handleSubmit} className="px-4 h-9 rounded-md bg-primary text-primary-foreground hover:opacity-90">
              Save Changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}