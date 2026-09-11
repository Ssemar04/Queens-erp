import { createFileRoute } from "@tanstack/react-router";
import { LedgerPage } from "@/components/ledger/LedgerPage";

export const Route = createFileRoute("/app/debtors")({
  component: () => <LedgerPage kind="debtor" />,
  head: () => ({ meta: [{ title: "Debtors · Queenstech ERP" }] }),
});
