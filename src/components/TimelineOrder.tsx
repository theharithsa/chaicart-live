import { useLayoutEffect, useRef, useState } from "react";

type Card = { id: string; text: string };
type Drag = {
  id: string;
  pointerId: number;
  overId: string | null;
  left: number;
  top: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
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
  const [settling, setSettling] = useState<string | null>(null);
  const items = useRef(new Map<string, HTMLDivElement>());
  const positions = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    for (const [id, element] of items.current) {
      const top = element.getBoundingClientRect().top;
      const previous = positions.current.get(id);
      if (!reduced && previous !== undefined && previous !== top) {
        element.animate(
          [
            { transform: `translateY(${previous - top}px)` },
            { transform: "translateY(0)" },
          ],
          { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" },
        );
      }
    }
    positions.current.clear();
  }, [order]);
  const [announcement, setAnnouncement] = useState("");
  function move(id: string, to: number, landingTop?: number) {
    if (disabled) return;
    const from = order.indexOf(id);
    if (from < 0 || to < 0 || to >= order.length) return;
    if (from === to) {setSettling(id);return;}
    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, id);
    for (const [key, element] of items.current)
      positions.current.set(key, element.getBoundingClientRect().top);
    if (landingTop !== undefined) positions.current.set(id, landingTop);
    setSettling(id);
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
              ref={(element) => {
                if (element) items.current.set(id, element);
                else items.current.delete(id);
              }}
              onAnimationEnd={() => {
                if (settling === id) setSettling(null);
              }}
              role="listitem"
              data-timeline-id={id}
              key={id}
              className={`card spread timeline-event ${active ? "dragging" : ""} ${target ? (order.indexOf(drag!.id) < i ? "drop-target drop-after" : "drop-target drop-before") : ""} ${settling === id ? "settling" : ""}`}
            >
              <div className="row timeline-event-label">
                <button
                  type="button"
                  className="btn sm ghost timeline-drag-handle"
                  aria-label={`Drag event ${i + 1}: ${text}`}
                  disabled={disabled}
                  onPointerDown={(e) => {
                    if (disabled || !e.isPrimary || e.button !== 0) return;
                    const rect = e.currentTarget
                      .closest<HTMLElement>("[data-timeline-id]")!
                      .getBoundingClientRect();
                    setSettling(null);
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setDrag({
                      id,
                      pointerId: e.pointerId,
                      overId: id,
                      left: rect.left,
                      top: rect.top,
                      width: rect.width,
                      height: rect.height,
                      offsetX: e.clientX - rect.left,
                      offsetY: e.clientY - rect.top,
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
                      left: e.clientX - drag.offsetX,
                      top: e.clientY - drag.offsetY,
                      overId: target?.dataset.timelineId ?? null,
                    });
                    if (e.clientY < 70) window.scrollBy(0, -14);
                    else if (e.clientY > window.innerHeight - 70)
                      window.scrollBy(0, 14);
                  }}
                  onPointerUp={(e) => {
                    if (!drag || drag.pointerId !== e.pointerId) return;
                    if (drag.overId) move(drag.id, order.indexOf(drag.overId), drag.top);
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
        <div
          aria-hidden="true"
          className="card timeline-floating"
          style={{
            left: drag.left,
            top: drag.top,
            width: drag.width,
            minHeight: drag.height,
          }}
        >
          <span className="timeline-floating-grip">⠿</span>
          <span>
            {order.indexOf(drag.id) + 1}.{" "}
            {cards.find((card) => card.id === drag.id)?.text}
          </span>
        </div>
      )}
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
