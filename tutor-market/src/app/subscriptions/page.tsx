import { redirect } from "next/navigation";
import { legacyRedirects } from "@/lib/routes";
export default function SubscriptionsAlias() { redirect(legacyRedirects["/subscriptions"]); }
