import { redirect } from "next/navigation";
import { legacyRedirects } from "@/lib/routes";
export default function TutorDetailAlias() { redirect(legacyRedirects["/tutor-detail"]); }
