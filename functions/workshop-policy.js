export const reviewLimits = {
  "network-linkedin": 100,
  "network-github": 100,
  "network-x": 100,
  timeline: 50,
  "service-sort": 100,
  bingo: 30,
  "deploy-debate": 30,
  "shark-pitch": 50,
  architecture: 50,
  kitchen: 100,
  gallery: 50,
  downtime: 80,
  "treasure-hunt": 150,
  postmortem: 40,
  factory: 50,
};
export function teamRegion(teamId) {
  if (typeof teamId !== "string") return null;
  const match = /^(mumbai|chennai|pune|delhi)-1[a-f]$/.exec(teamId || "");
  return (
    match &&
    { mumbai: "west", chennai: "south", pune: "central", delhi: "north" }[
      match[1]
    ]
  );
}
export function canAward(role, teamId) {
  return (
    !!teamRegion(teamId) &&
    (role.facilitator || role.region === teamRegion(teamId))
  );
}
export function cloudQuestionResults(students, submissions, question, correct) {
  const byUid = new Map(
    submissions
      .filter((s) => s.activity === "cloud-or-not" && s.scope === "individual")
      .map((s) => [s.uid, s]),
  );
  return students.map((student) => {
    const sub = byUid.get(student.id);
    const answer =
      sub?.teamId === student.teamId
        ? sub.answers?.[String(question)]
        : undefined;
    return {
      uid: student.id,
      teamId: student.teamId,
      answer: answer ?? null,
      correct: answer === correct,
      credits: answer === correct ? 100 : 0,
    };
  });
}
export function checkReviewLimit(activity, teamId, points, applied) {
  if (typeof activity !== "string" || !Object.hasOwn(reviewLimits, activity))
    throw new Error("Unknown review rubric.");
  if (
    !Number.isInteger(points) ||
    points < 0 ||
    points > (reviewLimits[activity] ?? -1)
  )
    throw new Error("Credits outside this activity rubric.");
  if (!points) return;
  const keys = Object.keys(applied);
  if (
    activity === "bingo" &&
    keys.filter((k) => k.startsWith("review:bingo:")).length >= 3
  )
    throw new Error("The first three Bingo awards have already been applied.");
  if (
    activity === "gallery" &&
    keys.filter((k) => k.startsWith("review:gallery:")).length >= 4
  )
    throw new Error("Four Gallery awards have already been applied.");
  if (
    activity === "timeline" &&
    keys.some(
      (k) =>
        k.startsWith("review:timeline:") &&
        teamRegion(k.split(":")[2]) === teamRegion(teamId),
    )
  )
    throw new Error("This region already has its Timeline winner.");
}

export function correlationContext(value) {
  if (
    !value ||
    typeof value !== "object" ||
    ["traceId", "spanId", "transactionId"].some(
      (k) => typeof value[k] !== "string",
    ) ||
    !/^[a-f0-9]{32}$/.test(value.traceId || "") ||
    /^0+$/.test(value.traceId) ||
    !/^[a-f0-9]{16}$/.test(value.spanId || "") ||
    /^0+$/.test(value.spanId) ||
    !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(
      value.transactionId || "",
    )
  )
    return null;
  return {
    traceId: value.traceId,
    spanId: value.spanId,
    transactionId: value.transactionId,
  };
}
