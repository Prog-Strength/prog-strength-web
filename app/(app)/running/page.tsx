import { redirect } from "next/navigation";

export default function RunningPage() {
  redirect("/activities?view=running");
}
