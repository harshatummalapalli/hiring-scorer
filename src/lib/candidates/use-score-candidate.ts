"use client";

import { useCallback, useState } from "react";

export function useScoreCandidate(onSuccess?: () => void) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCandidate, setPickerCandidate] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [preselectedJobId, setPreselectedJobId] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runScore = useCallback(
    async (candidateId: string, roleBriefId: string) => {
      setScoring(true);
      setError(null);
      try {
        const res = await fetch(`/api/candidates/${candidateId}/score`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleBriefId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Scoring failed");
        setPickerOpen(false);
        setPickerCandidate(null);
        onSuccess?.();
        return json;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Scoring failed";
        setError(message);
        throw err;
      } finally {
        setScoring(false);
      }
    },
    [onSuccess],
  );

  const requestScore = useCallback(
    (
      candidateId: string,
      candidateName: string,
      explicitJobId?: string | null,
    ) => {
      if (explicitJobId) {
        return runScore(candidateId, explicitJobId);
      }
      setPickerCandidate({ id: candidateId, name: candidateName });
      setPreselectedJobId(null);
      setPickerOpen(true);
      return Promise.resolve(null);
    },
    [runScore],
  );

  const requestScoreWithDefaultJob = useCallback(
    (
      candidateId: string,
      candidateName: string,
      defaultJobId?: string | null,
    ) => {
      setPickerCandidate({ id: candidateId, name: candidateName });
      setPreselectedJobId(defaultJobId ?? null);
      setPickerOpen(true);
      return Promise.resolve(null);
    },
    [],
  );

  const confirmPicker = useCallback(
    (jobId: string) => {
      if (!pickerCandidate) return Promise.resolve(null);
      return runScore(pickerCandidate.id, jobId);
    },
    [pickerCandidate, runScore],
  );

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setPickerCandidate(null);
  }, []);

  return {
    scoring,
    error,
    pickerOpen,
    pickerCandidate,
    preselectedJobId,
    requestScore,
    requestScoreWithDefaultJob,
    confirmPicker,
    closePicker,
    runScore,
  };
}
