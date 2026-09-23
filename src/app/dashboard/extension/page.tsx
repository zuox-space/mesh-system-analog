import { getCurrentUser } from "@/lib/auth";
import { ExtensionCard } from "./ExtensionCard";

export default async function ExtensionPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="space-y-3 w-full">
      <ExtensionCard
        initialLinked={!!user.extensionToken}
        initialCode={user.pairCode}
        initialExpires={user.pairCodeExpires?.toISOString() || null}
      />
    </div>
  );
}