"use client";

/**
 * Khoá "một tab làm bài" trên cùng một trình duyệt bằng BroadcastChannel.
 * Tab đang làm bài trả lời "busy" khi tab mới hỏi; tab mới sẽ bị chặn.
 * (Khác trình duyệt/thiết bị được chặn thêm ở phía máy chủ bằng tabToken.)
 */
type Msg = { type: "ping"; from: string } | { type: "busy"; to: string };

export class TabLock {
  private id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  private ch: BroadcastChannel | null = null;
  private active = false;
  private waiting: (() => void) | null = null;
  onIntrusion: (() => void) | null = null;

  constructor() {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      this.ch = new BroadcastChannel("quiz-exam-tab-lock");
      this.ch.onmessage = (e: MessageEvent<Msg>) => {
        const m = e.data;
        if (m?.type === "ping" && m.from !== this.id && this.active) {
          this.ch?.postMessage({ type: "busy", to: m.from } satisfies Msg);
          this.onIntrusion?.();
        } else if (m?.type === "busy" && m.to === this.id) {
          this.waiting?.();
        }
      };
    }
  }

  /** true nếu đã có một tab khác đang làm bài. */
  isTakenElsewhere(timeoutMs = 450): Promise<boolean> {
    if (!this.ch) return Promise.resolve(false);
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        this.waiting = null;
        resolve(false);
      }, timeoutMs);
      this.waiting = () => {
        clearTimeout(t);
        this.waiting = null;
        resolve(true);
      };
      this.ch!.postMessage({ type: "ping", from: this.id } satisfies Msg);
    });
  }

  activate() {
    this.active = true;
  }

  release() {
    this.active = false;
  }

  close() {
    this.active = false;
    this.ch?.close();
    this.ch = null;
  }
}
