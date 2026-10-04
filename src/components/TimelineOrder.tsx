import { useState } from "react";

type Card = { id: string; text: string };
type Drag = {
  id: string;
  pointerId: number;
  overId: string | null;
};

/** Pointer dragging works on mouse, pen and touch; move buttons preserve keyboard access. */
export default function TimelineOrder({
  cards,
  order,
  disabled,
  onChange,
}: {
  cards: Card[];
  order: string[];
  disabled: boolean;
  onChange: (order: string[]) => void;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [announcement, setAnnouncement] = useState("");
  function move(id: string, to: number) {
    if (disabled) return;
    const from = order.indexOf(id);
    if (from < 0 || to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, id);
    onChange(next);
    setAnnouncement(
      `Moved ${cards.find((c) => c.id === id)?.text} to position ${to + 1} of ${order.length}.`,
    );
  }
  return (
    <div className="stack">
      <p className="small muted">
        Drag the ⠿ handle to reorder events, or use the up and down buttons.
        Then submit your timeline.
      </p>
      <div
        className="timeline-order stack"
        role="list"
        aria-label="Timeline events in chronological order"
      >
        {order.map((id, i) => {
          const text = cards.find((c) => c.id === id)?.text ?? id;
          const active = !disabled && drag?.id === id;
          const target = !disabled && drag?.overId === id && drag.id !== id;
          return (
            <div
              role="listitem"
              data-timeline-id={id}
              key={id}
              className={`card spread timeline-event ${active ? "dragging" : ""} ${target ? "drop-target" : ""}`}
            >
              <div className="row timeline-event-label">
                <button
                  type="button"
                  className="btn sm ghost timeline-drag-handle"
                  aria-label={`Drag event ${i + 1}: ${text}`}
                  disabled={disabled}
                  onPointerDown={(e) => {
                    if (disabled || !e.isPrimary || e.button !== 0) return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setDrag({
                      id,
                      pointerId: e.pointerId,
                      overId: id,
                    });
                  }}
                  onPointerMove={(e) => {
                    if (!drag || drag.pointerId !== e.pointerId || disabled)
                      return;
                    const list = e.currentTarget.closest(".timeline-order");
                    const target = document
                      .elementsFromPoint(e.clientX, e.clientY)
                      .map((element) =>
                        element.closest<HTMLElement>("[data-timeline-id]"),
                      )
                      .find((element) => element && list?.contains(element));
                    setDrag({
                      ...drag,
                      overId: target?.dataset.timelineId ?? null,
                    });
                    if (e.clientY < 70) window.scrollBy(0, -14);
                    else if (e.clientY > window.innerHeight - 70)
                      window.scrollBy(0, 14);
                  }}
                  onPointerUp={(e) => {
                    if (!drag || drag.pointerId !== e.pointerId) return;
                    if (drag.overId) move(drag.id, order.indexOf(drag.overId));
                    setDrag(null);
                  }}
                  onPointerCancel={() => setDrag(null)}
                  onLostPointerCapture={() => setDrag(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setDrag(null);
                    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                      e.preventDefault();
                      move(id, i + (e.key === "ArrowUp" ? -1 : 1));
                    }
                  }}
                >
                  <span aria-hidden="true">⠿</span>
                </button>
                <span>
                  {i + 1}. {text}
                </span>
              </div>
              <div className="row timeline-move-buttons">
                <button
                  type="button"
                  aria-label={`Move event ${i + 1} up`}
                  className="btn sm ghost"
                  disabled={disabled || i === 0}
                  onClick={() => move(id, i - 1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move event ${i + 1} down`}
                  className="btn sm ghost"
                  disabled={disabled || i === order.length - 1}
                  onClick={() => move(id, i + 1)}
                >
                  ↓
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {!disabled && drag && (
        <p className="small" role="status">
          {drag.overId
            ? `Drop at position ${order.indexOf(drag.overId) + 1}.`
            : "Move over a timeline card to drop, or release outside to cancel."}
        </p>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
