import { useState, type FormEvent } from "react";
import { Bug, CheckCircle2, Loader2, X } from "lucide-react";
import { apiPost } from "../../../api/client.js";

type BugReportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  tableLabel?: string;
  screenName?: string;
  customerName?: string;
  customerMobile?: string;
};

export function BugReportModal({
  isOpen,
  onClose,
  tableLabel,
  screenName,
  customerName,
  customerMobile
}: BugReportModalProps) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      await apiPost("/api/bug-reports", {
        message: message.trim(),
        tableLabel: tableLabel || undefined,
        screen: screenName || undefined,
        customerName: customerName || undefined,
        customerMobile: customerMobile || undefined
      });
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setMessage("");
        onClose();
      }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) return;
    setSubmitted(false);
    setError(null);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Report a bug"
    >
      <div
        className="w-full max-w-[360px] bg-surface-2 border border-hairline rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] p-5 flex flex-col text-parchment"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-ember">
            <Bug size={18} aria-hidden="true" />
            <h3 className="text-[15px] font-bold text-parchment m-0">Report a bug</h3>
          </div>
          <button
            onClick={handleClose}
            type="button"
            className="p-1 rounded-lg text-clay hover:text-parchment transition cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="py-6 flex flex-col items-center justify-center text-center gap-2">
            <CheckCircle2 size={32} className="text-sage" />
            <div className="text-[14px] font-bold text-parchment">Report received!</div>
            <p className="text-[12px] text-clay m-0">
              Thanks for helping us polish D3.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-3">

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What went wrong or didn't work as expected?"
              rows={3}
              required
              autoFocus
              className="w-full bg-surface-1 border border-hairline rounded-xl p-3 text-parchment text-[13px] focus:outline-none focus:border-ember transition placeholder:text-clay-dim resize-none"
            />

            {error ? (
              <div className="text-[11.5px] text-rust bg-rust-bg/40 border border-rust/20 rounded-lg p-2">
                {error}
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10.5px] text-clay-dim ml-2">
                {/* {tableLabel ? `${tableLabel} · ` : ""} */}
                {screenName ? `Screen: ${screenName.toUpperCase()}` : ""}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="py-2 px-3 rounded-xl text-xs font-semibold text-clay hover:text-parchment transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !message.trim()}
                  className="bg-ember hover:bg-ember-hover active:bg-ember-deep text-[#1a0d06] rounded-xl py-2 px-3.5 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Report"
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
