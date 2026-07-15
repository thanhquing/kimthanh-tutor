import { redirect } from "next/navigation";
import { legacyRedirects } from "@/lib/routes";
export default function ParentProfileAlias() { redirect(legacyRedirects["/parent-profile"]); }
