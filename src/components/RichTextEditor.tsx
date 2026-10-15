"use client";

import { EditorContent, Extension, useEditor, useEditorState, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { FontSize, TextStyle } from "@tiptap/extension-text-style";
import { Placeholder } from "@tiptap/extensions";
import { useEffect, useImperativeHandle, useRef, useState, type ChangeEvent, type ReactNode, type Ref } from "react";
import { useTranslations } from "next-intl";
import { Icon, type IconName } from "@/components/ui/Icon";
import { RICH_TEXT_CLASS_NAME } from "@/components/PostBody";
import { BODY_FONT_SIZES, BODY_PHOTO_MAX, BODY_PHOTO_MAX_BYTES, BODY_UPLOAD_PREFIX } from "@/schemas/post.schema";

export type RichTextPayload = { body: string; photos: File[] };
export type RichTextEditorHandle = { getPayload: () => RichTextPayload | null };

const PHOTO_TYPES = "image/jpeg,image/png,image/webp";
const PHOTO_MAX_SIDE = 1600;
const FONT_SIZE_LABELS = { "14px": "small", "20px": "large", "24px": "xlarge" } as const;

// Un seul niveau de puces : Tab ne crée pas de sous-liste (refusée par l'API).
const SingleLevelLists = Extension.create({
  name: "singleLevelLists",
  priority: 1000,
  addKeyboardShortcuts: () => ({ Tab: () => true }),
});

export function RichTextEditor({ id, placeholder, ref }: { id: string; placeholder: string; ref: Ref<RichTextEditorHandle> }) {
  const t = useTranslations("PostEditor.editor");
  const photoInput = useRef<HTMLInputElement>(null);
  // Photos encore locales : URL d'aperçu (blob:) → fichier réduit à envoyer.
  const photos = useRef(new Map<string, File>());
  const [photoError, setPhotoError] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        orderedList: false,
        link: false,
      }),
      TextStyle,
      FontSize,
      Image.configure({ allowBase64: false }),
      Placeholder.configure({ placeholder }),
      SingleLevelLists,
    ],
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        class: `${RICH_TEXT_CLASS_NAME} min-h-64 px-4 py-4 focus:outline-none [&_img]:w-full [&_img]:rounded-lg [&_img.ProseMirror-selectednode]:ring-2 [&_img.ProseMirror-selectednode]:ring-accent [&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:text-ink-soft/50 [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]`,
      },
    },
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold") ?? false,
      italic: current?.isActive("italic") ?? false,
      underline: current?.isActive("underline") ?? false,
      bulletList: current?.isActive("bulletList") ?? false,
      fontSize: String(current?.getAttributes("textStyle").fontSize ?? ""),
      photoCount: current ? countImages(current.getJSON()) : 0,
    }),
  });

  useImperativeHandle(ref, () => ({
    getPayload: () => (editor && !editor.isEmpty ? toPayload(editor.getJSON(), photos.current) : null),
  }));

  useEffect(() => {
    const previews = photos.current;
    return () => previews.forEach((_, url) => URL.revokeObjectURL(url));
  }, []);

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !editor) return;
    const reduced = await shrinkPhoto(file).catch(() => null);
    setPhotoError(!reduced);
    if (!reduced) return;
    const url = URL.createObjectURL(reduced);
    photos.current.set(url, reduced);
    // Paragraphe ajouté après la photo : le curseur y va, sinon la photo reste sélectionnée et la frappe suivante la remplace.
    editor
      .chain()
      .focus()
      .insertContent([{ type: "image", attrs: { src: url, alt: "" } }, { type: "paragraph" }])
      .run();
  }

  if (!editor || !state) return <div className="min-h-80 rounded-lg bg-surface-muted" />;

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface focus-within:border-accent">
      <div role="toolbar" aria-label={t("toolbar")} className="flex flex-wrap items-center gap-1 border-b border-line bg-surface-muted p-2">
        <ToolbarButton icon="formatBold" label={t("bold")} active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolbarButton icon="formatItalic" label={t("italic")} active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolbarButton
          icon="formatUnderlined"
          label={t("underline")}
          active={state.underline}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <label className="flex items-center gap-1 rounded-lg px-2 text-ink-soft">
          <Icon name="formatSize" className="size-5" />
          <span className="sr-only">{t("size")}</span>
          <select
            value={state.fontSize}
            onChange={(event) => {
              // Rend le clavier au texte : sinon les flèches et Entrée agissent sur la liste.
              event.currentTarget.blur();
              setFontSize(editor, event.currentTarget.value);
            }}
            className="h-9 rounded-lg bg-transparent font-display text-label-md text-ink focus:outline-none"
          >
            <option value="">{t("sizes.normal")}</option>
            {BODY_FONT_SIZES.map((size) => (
              <option key={size} value={size}>
                {t(`sizes.${FONT_SIZE_LABELS[size]}`)}
              </option>
            ))}
          </select>
        </label>
        <ToolbarButton
          icon="formatListBulleted"
          label={t("bulletList")}
          active={state.bulletList}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          icon="image"
          label={t("photo", { max: BODY_PHOTO_MAX })}
          disabled={state.photoCount >= BODY_PHOTO_MAX}
          onClick={() => photoInput.current?.click()}
        >
          <span className="text-label-md">
            {state.photoCount}/{BODY_PHOTO_MAX}
          </span>
        </ToolbarButton>
        <input ref={photoInput} type="file" accept={PHOTO_TYPES} onChange={handlePhoto} className="sr-only" tabIndex={-1} aria-hidden="true" />
      </div>
      <EditorContent editor={editor} />
      {photoError && (
        <p role="alert" className="px-4 pb-3 text-body-sm text-error">
          {t("photoError")}
        </p>
      )}
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      // Garde le focus et la sélection dans le texte.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`flex h-9 min-w-9 items-center justify-center gap-1 rounded-lg px-2 transition focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:outline-none disabled:opacity-40 ${
        active ? "bg-ink text-surface" : "text-ink-soft hover:bg-surface hover:text-ink"
      }`}
    >
      <Icon name={icon} className="size-5" />
      {children}
    </button>
  );
}

function setFontSize(editor: Editor, size: string) {
  const chain = editor.chain().focus();
  if (size) chain.setFontSize(size).run();
  else chain.unsetFontSize().run();
}

function countImages(doc: JSONContent): number {
  return (doc.content ?? []).reduce((count, node) => count + (node.type === "image" ? 1 : countImages(node)), 0);
}

// Réduite à 1600 px en JPEG, qualité baissée jusqu'à passer sous la taille maximale acceptée par l'API.
async function shrinkPhoto(file: File): Promise<File | null> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.85, 0.75, 0.6, 0.45]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= BODY_PHOTO_MAX_BYTES) return new File([blob], "photo.jpg", { type: "image/jpeg" });
  }
  return null;
}

// Ne garde que ce que l'API accepte : photos collées d'ailleurs retirées, photos sorties des listes, sous-listes aplaties.
function toPayload(doc: JSONContent, localPhotos: Map<string, File>): RichTextPayload {
  const files: File[] = [];
  const image = (node: JSONContent): JSONContent[] => {
    const file = localPhotos.get(String(node.attrs?.src));
    if (!file || files.length >= BODY_PHOTO_MAX) return [];
    files.push(file);
    return [{ type: "image", attrs: { src: `${BODY_UPLOAD_PREFIX}${files.length - 1}`, alt: node.attrs?.alt || null } }];
  };
  const inline = (nodes: JSONContent[] = []) =>
    nodes.flatMap((node): JSONContent[] => {
      if (node.type === "hardBreak") return [{ type: "hardBreak" }];
      if (node.type !== "text" || !node.text) return [];
      const marks = (node.marks ?? []).flatMap((mark) => {
        if (mark.type === "bold" || mark.type === "italic" || mark.type === "underline") return [{ type: mark.type }];
        const fontSize = mark.attrs?.fontSize;
        if (mark.type === "textStyle" && (BODY_FONT_SIZES as readonly string[]).includes(fontSize)) {
          return [{ type: "textStyle", attrs: { fontSize } }];
        }
        return [];
      });
      return [{ type: "text", text: node.text, ...(marks.length > 0 ? { marks } : {}) }];
    });
  const paragraph = (node: JSONContent): JSONContent => ({ type: "paragraph", ...(node.content ? { content: inline(node.content) } : {}) });
  const listItems = (list: JSONContent, after: JSONContent[]): JSONContent[] =>
    (list.content ?? []).flatMap((item) => {
      const children = item.content ?? [];
      const paragraphs = children.filter((child) => child.type === "paragraph").map(paragraph);
      children.filter((child) => child.type === "image").forEach((child) => after.push(...image(child)));
      const nested = children.filter((child) => child.type === "bulletList").flatMap((child) => listItems(child, after));
      return [...(paragraphs.length > 0 ? [{ type: "listItem", content: paragraphs }] : []), ...nested];
    });

  const content = (doc.content ?? []).flatMap((node): JSONContent[] => {
    if (node.type === "paragraph") return [paragraph(node)];
    if (node.type === "image") return image(node);
    if (node.type === "bulletList") {
      const after: JSONContent[] = [];
      const items = listItems(node, after);
      return [...(items.length > 0 ? [{ type: "bulletList", content: items }] : []), ...after];
    }
    return [];
  });
  return { body: JSON.stringify({ type: "doc", content }), photos: files };
}
