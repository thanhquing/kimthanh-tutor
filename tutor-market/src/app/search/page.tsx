import { redirect } from "next/navigation";
import { legacyRedirects } from "@/lib/routes";
export default function SearchAlias() { redirect(legacyRedirects["/search"]); }
