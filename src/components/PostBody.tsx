import Image from "next/image";
import { Fragment, type ReactNode } from "react";
import type { PostBody as PostBodyDocument, PostBodyBlock, PostBodyInline } from "@/schemas/post.schema";

// Mise en forme partagée par l'éditeur (HTML de TipTap) et l'affichage du récit.
export const RICH_TEXT_CLASS_NAME =
  "flex flex-col gap-6 text-body-lg text-ink-soft [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-6";

const FONT_SIZE_CLASS_NAMES: Record<string, string> = {
  "14px": "text-body-md",
  "20px": "text-headline-sm font-normal",
  "24px": "text-headline-md font-normal",
};

// Seules les photos de notre bucket sont affichées, même si la base contenait autre chose.
const PHOTO_URL_PREFIX = "https://storage.googleapis.com/biirb-post-photos/";

// Rendu en éléments React à partir du JSON validé : aucun HTML venant de l'utilisateur n'est interprété.
export function PostBody({ body, fallbackAlt }: { body: PostBodyDocument; fallbackAlt: string }) {
  return <div className={RICH_TEXT_CLASS_NAME}>{body.content.map((block, index) => renderBlock(block, index, fallbackAlt))}</div>;
}

function renderBlock(block: PostBodyBlock, key: number, fallbackAlt: string): ReactNode {
  switch (block.type) {
    case "paragraph":
      return <p key={key}>{renderInline(block.content)}</p>;
    case "bulletList":
      return (
        <ul key={key}>
          {block.content.map((item, itemIndex) => (
            <li key={itemIndex}>
              {item.content.map((paragraph, paragraphIndex) => (
                <p key={paragraphIndex}>{renderInline(paragraph.content)}</p>
              ))}
            </li>
          ))}
        </ul>
      );
    case "image":
      if (!block.attrs.src.startsWith(PHOTO_URL_PREFIX)) return null;
      return (
        <Image
          key={key}
          src={block.attrs.src}
          alt={block.attrs.alt || fallbackAlt}
          width={1600}
          height={1067}
          sizes="(min-width: 1360px) 830px, (min-width: 1024px) 60vw, 100vw"
          className="h-auto w-full rounded-lg bg-surface-muted"
        />
      );
  }
}

function renderInline(content: PostBodyInline[] = []): ReactNode[] {
  return content.map((node, index) => {
    if (node.type === "hardBreak") return <br key={index} />;
    const formatted = (node.marks ?? []).reduce<ReactNode>((child, mark) => {
      switch (mark.type) {
        case "bold":
          return <strong>{child}</strong>;
        case "italic":
          return <em>{child}</em>;
        case "underline":
          return <u>{child}</u>;
        case "textStyle":
          return <span className={FONT_SIZE_CLASS_NAMES[mark.attrs.fontSize]}>{child}</span>;
      }
    }, node.text);
    return <Fragment key={index}>{formatted}</Fragment>;
  });
}
