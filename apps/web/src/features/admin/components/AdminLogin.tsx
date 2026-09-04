import type { FormEvent } from "react";
import { Notice, type NoticeVariant } from "../../../components/Notice.js";
import { ThemeToggle } from "../../../components/ThemeToggle.js";

type NoticeState = {
  variant: NoticeVariant;
  title: string;
  subtitle: string;
};

type AdminLoginProps = {
  username: string;
  onUsernameChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  notice: NoticeState | null;
};

export function AdminLogin({
  username,
  onUsernameChange,
  password,
  onPasswordChange,
  onSubmit,
  busy,
  notice
}: AdminLoginProps) {
  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-canvas relative">
      <div className="absolute top-5 right-5">
        <ThemeToggle size={16} />
      </div>
      <div className="bg-surface-2 border border-hairline rounded-3xl p-8 px-7 w-full max-w-[400px] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="w-14 h-14 rounded-lg bg-ember flex items-center justify-center text-[22px] font-extrabold text-[#1a0d06] tracking-tight mx-auto mb-5 shrink-0">
          D3
        </div>
        <h1 className="text-[19px] font-bold text-parchment mb-1 text-center">Staff Sign In</h1>

        {notice ? (
          <div className="mt-1 mb-3">
            <Notice variant={notice.variant} title={notice.title} subtitle={notice.subtitle} />
          </div>
        ) : null}

        <form className="flex flex-col gap-3.5" onSubmit={onSubmit}>
          <div>
            <label
              className="block text-[11px] font-bold text-clay uppercase tracking-wider mb-1.5"
              htmlFor="staff-username"
            >
              Username
            </label>
            <input
              id="staff-username"
              autoComplete="username"
              value={username}
              onChange={(e) => onUsernameChange(e.target.value)}
              placeholder="staff username"
              required
              className="w-full bg-surface-1 border border-hairline rounded-lg p-3.5 px-3.5 text-parchment text-[15px] focus:outline-none focus:border-ember transition placeholder:text-clay-dim"
            />
          </div>

          <div>
            <label
              className="block text-[11px] font-bold text-clay uppercase tracking-wider mb-1.5"
              htmlFor="staff-password"
            >
              Password
            </label>
            <input
              id="staff-password"
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-surface-1 border border-hairline rounded-lg p-3.5 px-3.5 text-parchment text-[15px] focus:outline-none focus:border-ember transition placeholder:text-clay-dim"
            />
          </div>

          <button
            className="w-full bg-ember hover:bg-ember-hover active:bg-ember-deep active:scale-[0.98] text-[#1a0d06] rounded-[14px] py-3.5 px-5 text-[15px] font-bold flex items-center justify-center gap-2 transition cursor-pointer mt-1 disabled:opacity-55 disabled:cursor-not-allowed"
            disabled={busy}
            type="submit"
          >
            Sign in to dashboard
          </button>
        </form>
      </div>
    </div>
  );
}
