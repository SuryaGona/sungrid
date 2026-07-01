"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { memo, useEffect, useMemo, useRef, useState } from "react";

const ISSUE_STATUSES = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "REVIEW",
  "DONE",
] as const;

type IssueStatus = (typeof ISSUE_STATUSES)[number];

type BoardIssue = {
  id: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: string;
  type: string;
  storyPoints: number | null;
  position: number;
  reporterLabel: string;
  assigneeLabel: string;
  sprintLabel?: string | null;
};

type ProjectBoardProps = {
  workspaceId: string;
  projectId: string;
  projectArchived: boolean;
  initialIssues: BoardIssue[];
};

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const BoardCard = memo(function BoardCard({
  issue,
  workspaceId,
  projectId,
  projectArchived,
}: {
  issue: BoardIssue;
  workspaceId: string;
  projectId: string;
  projectArchived: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: issue.id,
      disabled: projectArchived,
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    willChange: isDragging ? "transform" : undefined,
    transition: isDragging ? "none" : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-[1.1rem] border border-white/10 bg-white/[0.045] p-4 ${
        isDragging
          ? "z-50 opacity-75"
          : "hover:border-amber-300/20 hover:bg-white/[0.065]"
      }`}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        className="mb-3 w-full cursor-grab rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-left text-xs font-bold text-white/50 hover:border-amber-300/25 hover:bg-amber-300/10 hover:text-amber-100 active:cursor-grabbing"
        style={{ touchAction: "none" }}
      >
        Drag issue
      </button>

      <Link
        href={`/dashboard/${workspaceId}/projects/${projectId}/issues/${issue.id}`}
        className="block break-words text-sm font-black leading-5 text-white hover:text-amber-100 hover:underline"
      >
        {issue.title}
      </Link>

      <p className="mt-2 line-clamp-3 break-words text-sm leading-6 text-white/48">
        {issue.description || "No description provided."}
      </p>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/50">
        <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1">
          {formatEnum(issue.type)}
        </span>

        <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1">
          {formatEnum(issue.priority)}
        </span>

        <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1">
          {issue.storyPoints ?? 0} pts
        </span>

        {issue.sprintLabel ? (
          <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1">
            {issue.sprintLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-3 space-y-1 text-xs leading-5 text-white/42">
        <p className="break-words">
          <span className="font-semibold text-white/55">Assignee:</span>{" "}
          {issue.assigneeLabel}
        </p>

        <p className="break-words">
          <span className="font-semibold text-white/55">Reporter:</span>{" "}
          {issue.reporterLabel}
        </p>
      </div>
    </div>
  );
});

const BoardColumn = memo(function BoardColumn({
  status,
  issues,
  workspaceId,
  projectId,
  projectArchived,
}: {
  status: IssueStatus;
  issues: BoardIssue[];
  workspaceId: string;
  projectId: string;
  projectArchived: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div className="rounded-[1.45rem] border border-white/10 bg-black/25 shadow-[0_14px_36px_rgba(0,0,0,0.2)]">
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-black text-white">
            {formatEnum(status)}
          </h3>

          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold text-white/60">
            {issues.length}
          </span>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={`min-h-[300px] space-y-3 p-3 ${
          isOver ? "bg-amber-300/[0.07]" : ""
        }`}
      >
        {issues.length === 0 ? (
          <div className="rounded-[1.1rem] border border-dashed border-white/10 p-4">
            <p className="text-sm text-white/35">Drop issues here.</p>
          </div>
        ) : (
          issues.map((issue) => (
            <BoardCard
              key={issue.id}
              issue={issue}
              workspaceId={workspaceId}
              projectId={projectId}
              projectArchived={projectArchived}
            />
          ))
        )}
      </div>
    </div>
  );
});

export function ProjectBoard({
  workspaceId,
  projectId,
  projectArchived,
  initialIssues,
}: ProjectBoardProps) {
  const router = useRouter();
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const pointerPositionRef = useRef<{ x: number; y: number } | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  const [mounted, setMounted] = useState(false);
  const [issues, setIssues] = useState(initialIssues);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  function stopAutoScroll() {
    isDraggingRef.current = false;

    if (autoScrollFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  }

  function runAutoScroll() {
    const boardElement = boardScrollRef.current;
    const pointerPosition = pointerPositionRef.current;

    if (!isDraggingRef.current) {
      autoScrollFrameRef.current = null;
      return;
    }

    if (!boardElement || !pointerPosition) {
      autoScrollFrameRef.current = requestAnimationFrame(runAutoScroll);
      return;
    }

    const rect = boardElement.getBoundingClientRect();
    const edgeSize = 180;
    const maxSpeed = 18;
    const maxScrollLeft = Math.max(
      0,
      boardElement.scrollWidth - boardElement.clientWidth,
    );

    const nearBoardY =
      pointerPosition.y >= rect.top - 100 &&
      pointerPosition.y <= rect.bottom + 100;

    if (nearBoardY) {
      let scrollAmount = 0;

      if (pointerPosition.x <= rect.left + edgeSize) {
        const intensity = Math.min(
          1,
          Math.max(0, (rect.left + edgeSize - pointerPosition.x) / edgeSize),
        );

        scrollAmount = -Math.ceil(maxSpeed * intensity);
      }

      if (pointerPosition.x >= rect.right - edgeSize) {
        const intensity = Math.min(
          1,
          Math.max(0, (pointerPosition.x - (rect.right - edgeSize)) / edgeSize),
        );

        scrollAmount = Math.ceil(maxSpeed * intensity);
      }

      if (scrollAmount !== 0) {
        const nextScrollLeft = Math.min(
          maxScrollLeft,
          Math.max(0, boardElement.scrollLeft + scrollAmount),
        );

        if (nextScrollLeft !== boardElement.scrollLeft) {
          boardElement.scrollLeft = nextScrollLeft;
        }
      }
    }

    autoScrollFrameRef.current = requestAnimationFrame(runAutoScroll);
  }

  function handleDragStart(event: DragStartEvent) {
    if (projectArchived) {
      return;
    }

    isDraggingRef.current = true;

    if (autoScrollFrameRef.current === null) {
      autoScrollFrameRef.current = requestAnimationFrame(runAutoScroll);
    }
  }

  function handleDragCancel() {
    stopAutoScroll();
  }

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      pointerPositionRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
    }

    window.addEventListener("pointermove", handlePointerMove);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      stopAutoScroll();
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const groupedIssues = useMemo(() => {
    return ISSUE_STATUSES.reduce<Record<IssueStatus, BoardIssue[]>>(
      (acc, status) => {
        acc[status] = issues
          .filter((issue) => issue.status === status)
          .sort((a, b) => a.position - b.position);

        return acc;
      },
      {
        BACKLOG: [],
        TODO: [],
        IN_PROGRESS: [],
        REVIEW: [],
        DONE: [],
      },
    );
  }, [issues]);

  async function handleDragEnd(event: DragEndEvent) {
    stopAutoScroll();

    const { active, over } = event;

    if (!over) {
      return;
    }

    const issueId = String(active.id);
    const targetStatus = String(over.id) as IssueStatus;

    if (!ISSUE_STATUSES.includes(targetStatus)) {
      return;
    }

    const issue = issues.find((item) => item.id === issueId);

    if (!issue || issue.status === targetStatus) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const previousIssues = issues;

    const nextPosition =
      issues.filter((item) => item.status === targetStatus).length + 1;

    setIssues((currentIssues) =>
      currentIssues.map((item) =>
        item.id === issueId
          ? {
              ...item,
              status: targetStatus,
              position: nextPosition,
            }
          : item,
      ),
    );

    const response = await fetch(
      `/api/workspaces/${workspaceId}/projects/${projectId}/issues/move`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          issueId,
          status: targetStatus,
        }),
      },
    );

    if (!response.ok) {
      setIssues(previousIssues);

      const data = await response.json().catch(() => null);

      setErrorMessage(
        data?.error || "Could not move issue. The board was restored.",
      );

      return;
    }

    setSuccessMessage("Issue moved successfully.");

    router.refresh();
  }

  if (!mounted) {
    return (
      <div className="space-y-4 overflow-hidden">
        {projectArchived ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/50">
            This project is archived. Board movement is disabled.
          </div>
        ) : null}

        <div className="rounded-[1.45rem] border border-white/10 bg-black/25 p-6 text-sm text-white/45 shadow-[0_14px_36px_rgba(0,0,0,0.2)]">
          Loading board.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-hidden">
      <style jsx global>{`
        .sungrid-board-scroll {
          overscroll-behavior-x: contain;
          scrollbar-width: thin;
          scrollbar-color: rgba(251, 191, 36, 0.72) rgba(255, 255, 255, 0.07);
        }

        .sungrid-board-scroll::-webkit-scrollbar {
          height: 10px;
        }

        .sungrid-board-scroll::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.07);
          border-radius: 999px;
        }

        .sungrid-board-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(
            90deg,
            rgba(251, 191, 36, 0.5),
            rgba(249, 115, 22, 0.65)
          );
          border-radius: 999px;
          border: 2px solid rgba(5, 5, 5, 0.88);
        }

        .sungrid-board-scroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(
            90deg,
            rgba(251, 191, 36, 0.82),
            rgba(249, 115, 22, 0.86)
          );
        }
      `}</style>

      {errorMessage ? (
        <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
          {successMessage}
        </div>
      ) : null}

      {projectArchived ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/50">
          This project is archived. Board movement is disabled.
        </div>
      ) : null}

      <div
        ref={boardScrollRef}
        className="sungrid-board-scroll max-w-full overflow-x-auto pb-4"
      >
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          autoScroll={false}
        >
          <div className="grid min-w-[1100px] grid-cols-5 gap-4">
            {ISSUE_STATUSES.map((status) => (
              <BoardColumn
                key={status}
                status={status}
                issues={groupedIssues[status]}
                workspaceId={workspaceId}
                projectId={projectId}
                projectArchived={projectArchived}
              />
            ))}
          </div>
        </DndContext>
      </div>
    </div>
  );
}