import { notFound } from "next/navigation";
import {
  getMyInfoMockPayload,
  isMyInfoEnabled
} from "../../../../../packages/shared/src/myinfo-mock";
import { SignupForm } from "../SignupForm";

export const dynamic = "force-dynamic";

export default function MyInfoCallbackPage() {
  if (!isMyInfoEnabled()) {
    notFound();
  }

  const payload = getMyInfoMockPayload();

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-proppy-primary">
        Singpass MyInfo mock
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
        Complete signup with MyInfo
      </h1>
      <p className="mt-4 text-slate-700">
        We received your mocked MyInfo profile and prefilled your name and NRIC.
      </p>
      <SignupForm
        initialName={payload.name}
        initialNric={payload.uinfin}
        initialPhone={payload.mobileno}
        myinfoPayload={payload}
      />
    </main>
  );
}
