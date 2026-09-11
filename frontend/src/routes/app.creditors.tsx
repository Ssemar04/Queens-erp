import { createFileRoute } from "@tanstack/react-router";
import { LedgerPage } from "@/components/ledger/LedgerPage";

export const Route = createFileRoute("/app/creditors")({
  component: () => <LedgerPage kind="creditor" />,
  head: () => ({ meta: [{ title: "Creditors · Stackwise" }] }),
});
