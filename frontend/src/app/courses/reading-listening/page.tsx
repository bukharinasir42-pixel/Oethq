import { redirect } from "next/navigation";

// The Reading + Listening combo course has been retired in favour of the separate
// tiered Reading and Listening courses. Send any old links to the courses chooser.
export default function ReadingListeningCoursePage() {
  redirect("/courses");
}
