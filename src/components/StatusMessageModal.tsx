"use client";

import { createPortal } from "react-dom";

export type StatusMessage = { type: "success" | "error"; text: string };

interface StatusMessageModalProps {
  message: StatusMessage | null;
  onClose: () => void;
}

export function StatusMessageModal({ message, onClose }: StatusMessageModalProps) {
  if (!message) return null;

  const isSuccess = message.type === "success";

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] overflow-y-auto bg-black/40"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="status-message-title"
          className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <h2
            id="status-message-title"
            className={`text-lg font-semibold ${
              isSuccess ? "text-green-700" : "text-red-600"
            }`}
          >
            {isSuccess ? "알림" : "오류"}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-800">{message.text}</p>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
                isSuccess
                  ? "bg-primary-600 hover:bg-primary-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              확인
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
