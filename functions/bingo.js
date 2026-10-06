import paperless from "./paperless.json" with { type: "json" };
function hash(s) {
  let h = 0;
  for (const c of s) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
  return h;
}
export function bingoBoard(teamId) {
  const board = [...paperless.bingo]
    .sort((a, b) => hash(`${teamId}:${a}`) - hash(`${teamId}:${b}`))
    .slice(0, 24);
  board.splice(12, 0, "FREE");
  return board;
}
export function validBingo(teamId, marks, called) {
  const board = bingoBoard(teamId);
  const ok = (i) =>
    board[i] === "FREE" ||
    (marks.includes(board[i]) && called.includes(board[i]));
  return Array.from({ length: 5 }, (_, r) =>
    Array.from({ length: 5 }, (_, c) => r * 5 + c),
  )
    .concat(
      Array.from({ length: 5 }, (_, c) =>
        Array.from({ length: 5 }, (_, r) => r * 5 + c),
      ),
      [
        [0, 6, 12, 18, 24],
        [4, 8, 12, 16, 20],
      ],
    )
    .some((line) => line.every(ok));
}
