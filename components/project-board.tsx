"use client";

import Link from "next/link";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState } from "react";

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

function BoardCard({
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
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-gray-200 bg-gray-50 p-4 ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      <div
        {...listeners}
        {...attributes}
        className="mb-3 cursor-grab rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 active:cursor-grabbing"
      >
        Drag issue
      </div>

      <Link
        href={`/dashboard/${workspaceId}/projects/${projectId}/issues/${issue.id}`}
        className="text-sm font-semibold text-gray-900 hover:underline"
      >
        {issue.title}
      </Link>

      <p className="mt-2 line-clamp-3 text-sm text-gray-600">
        {issue.description || "No description provided."}
      </p>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
        <span className="rounded-full bg-white px-2 py-1">
          {formatEnum(issue.type)}
        </span>

        <span className="rounded-full bg-white px-2 py-1">
          {formatEnum(issue.priority)}
        </span>

        <span className="rounded-full bg-white px-2 py-1">
          {issue.storyPoints ?? 0} pts
        </span>
      </div>

      <div className="mt-3 text-xs text-gray-500">
        <p>Assignee: {issue.assigneeLabel}</p>
        <p className="mt-1">Reporter: {issue.reporterLabel}</p>
      </div>
    </div>
  );
}

function BoardColumn({
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
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            {formatEnum(status)}
          </h3>

          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
            {issues.length}
          </span>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={`min-h-[220px] space-y-3 p-3 ${
          isOver ? "bg-gray-100" : ""
        }`}
      >
        {issues.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-4">
            <p className="text-sm text-gray-500">Drop issues here.</p>
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
}

export function ProjectBoard({
  workspaceId,
  projectId,
  projectArchived,
  initialIssues,
}: ProjectBoardProps) {
  const [issues, setIssues] = useState(initialIssues);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
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
      }
    );
  }, [issues]);

  async function handleDragEnd(event: DragEndEvent) {
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
          : item
      )
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
      }
    );

    if (!response.ok) {
      setIssues(previousIssues);

      const data = await response.json().catch(() => null);

      setErrorMessage(
        data?.error || "Could not move issue. The board was restored."
      );

      return;
    }

    setSuccessMessage("Issue moved successfully.");
  }

  const totalStoryPoints = issues.reduce((total, issue) => {
    return total + (issue.storyPoints ?? 0);
  }, 0);

  const completedIssues = issues.filter((issue) => issue.status === "DONE");

  const completedStoryPoints = completedIssues.reduce((total, issue) => {
    return total + (issue.storyPoints ?? 0);
  }, 0);

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {successMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Active issues</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {issues.length}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Done issues</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {completedIssues.length}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total points</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {totalStoryPoints}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Done points</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {completedStoryPoints}
          </p>
        </div>
      </div>

      {projectArchived ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          This project is archived. Board movement is disabled.
        </div>
      ) : null}

      <div className="overflow-x-auto pb-4">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
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