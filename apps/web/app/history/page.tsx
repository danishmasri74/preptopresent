import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <ComingSoon
      active="/history"
      title="History"
      body="Your rehearsals will appear here once you've done your first one."
    />
  );
}
