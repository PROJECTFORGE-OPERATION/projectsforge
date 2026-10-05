import { KIND_LABEL, type Resource } from "@/lib/resources";

/**
 * One vetted resource link — shared by the roadmap weeks and the
 * Communication Skills section so both render identically. Video links carry
 * a ▶ marker so students can spot video material at a glance.
 */
export function ResourceLink({ resource }: { resource: Resource }) {
  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-xs text-mist transition hover:text-chalk"
    >
      <span className="tag shrink-0 !px-1.5 !text-[0.62rem]">
        {resource.kind === "video" && <span aria-hidden>▶ </span>}
        {KIND_LABEL[resource.kind]}
      </span>
      <span className="truncate underline decoration-line underline-offset-2">
        {resource.title}
      </span>
      <span aria-hidden className="text-[0.7rem]">
        ↗
      </span>
    </a>
  );
}
