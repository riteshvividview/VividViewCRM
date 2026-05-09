import { ComingSoon } from "@/components/shared/coming-soon";
import { PageHeader } from "@/components/shared/page-header";

export default function Page() {
  const title = "settings".split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return (
    <div>
      <PageHeader title={title} />
      <ComingSoon title={`${title} Module`} />
    </div>
  );
}
