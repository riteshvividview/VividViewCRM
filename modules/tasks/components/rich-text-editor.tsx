"use client";

import { useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import { Placeholder } from "@tiptap/extension-placeholder";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBold, faItalic, faUnderline, faLink, faAlignLeft, faAlignCenter,
  faListUl, faListOl, faSquareCheck, faFont,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";

const COLORS = ["#e5e7eb", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"];

/** Plain text saved before rich text existed is wrapped so line breaks survive. */
function toHtml(value: string): string {
  if (!value) return "";
  if (/<\/?[a-z][\s\S]*>/i.test(value)) return value;
  return value.split(/\n{2,}/).map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`).join("");
}

function Btn({ on, active, title, children }: { on: () => void; active?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button" title={title} onMouseDown={(e) => e.preventDefault()} onClick={on}
      className={cn("flex h-7 w-7 items-center justify-center rounded text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground", active && "bg-muted text-foreground")}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const block = editor.isActive("heading", { level: 1 }) ? "h1" : editor.isActive("heading", { level: 2 }) ? "h2" : editor.isActive("heading", { level: 3 }) ? "h3" : "p";
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-t px-2 py-1.5">
      <select
        value={block}
        onChange={(e) => {
          const v = e.target.value;
          const chain = editor.chain().focus();
          if (v === "p") chain.setParagraph().run();
          else chain.toggleHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run();
        }}
        className="h-7 rounded bg-transparent px-1 text-[13px] text-muted-foreground hover:bg-muted focus:outline-none"
      >
        <option value="p">Normal text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <span className="mx-1 h-4 w-px bg-border" />
      <Btn title="Bold" active={editor.isActive("bold")} on={() => editor.chain().focus().toggleBold().run()}><FontAwesomeIcon icon={faBold} /></Btn>
      <Btn title="Italic" active={editor.isActive("italic")} on={() => editor.chain().focus().toggleItalic().run()}><FontAwesomeIcon icon={faItalic} /></Btn>
      <Btn title="Underline" active={editor.isActive("underline")} on={() => editor.chain().focus().toggleUnderline().run()}><FontAwesomeIcon icon={faUnderline} /></Btn>
      <span className="group relative">
        <Btn title="Text colour" on={() => {}}><FontAwesomeIcon icon={faFont} /></Btn>
        <span className="absolute left-0 top-7 z-20 hidden gap-1 rounded-md border bg-popover p-1.5 shadow-md group-hover:flex">
          {COLORS.map((c) => (
            <button key={c} type="button" onMouseDown={(e) => e.preventDefault()}
              onClick={() => (c === COLORS[0] ? editor.chain().focus().unsetColor().run() : editor.chain().focus().setColor(c).run())}
              className="h-4 w-4 rounded-full border" style={{ backgroundColor: c }} />
          ))}
        </span>
      </span>
      <Btn title="Link" active={editor.isActive("link")} on={() => {
        const prev = editor.getAttributes("link").href as string | undefined;
        const url = window.prompt("Link URL", prev ?? "https://");
        if (url === null) return;
        if (!url) editor.chain().focus().unsetLink().run();
        else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
      }}><FontAwesomeIcon icon={faLink} /></Btn>
      <span className="mx-1 h-4 w-px bg-border" />
      <Btn title="Align left" active={editor.isActive({ textAlign: "left" })} on={() => editor.chain().focus().setTextAlign("left").run()}><FontAwesomeIcon icon={faAlignLeft} /></Btn>
      <Btn title="Align center" active={editor.isActive({ textAlign: "center" })} on={() => editor.chain().focus().setTextAlign("center").run()}><FontAwesomeIcon icon={faAlignCenter} /></Btn>
      <Btn title="Checklist" active={editor.isActive("taskList")} on={() => editor.chain().focus().toggleTaskList().run()}><FontAwesomeIcon icon={faSquareCheck} /></Btn>
      <Btn title="Numbered list" active={editor.isActive("orderedList")} on={() => editor.chain().focus().toggleOrderedList().run()}><FontAwesomeIcon icon={faListOl} /></Btn>
      <Btn title="Bulleted list" active={editor.isActive("bulletList")} on={() => editor.chain().focus().toggleBulletList().run()}><FontAwesomeIcon icon={faListUl} /></Btn>
    </div>
  );
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  /** Called on blur — use for autosave. */
  onBlur?: (html: string) => void;
  placeholder?: string;
  className?: string;
  /** Toolbar position: bottom (Bordio task forms) or top (notes). */
  toolbar?: "top" | "bottom" | "none";
  minHeight?: number;
  autoFocus?: boolean;
  editable?: boolean;
}

/** Bordio-style rich text editor (HTML). */
export function RichTextEditor({ value, onChange, onBlur, placeholder = "Write your text here…", className, toolbar = "bottom", minHeight = 120, autoFocus, editable = true }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    autofocus: autoFocus ? "end" : false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } } }),
      TaskList, TaskItem.configure({ nested: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle, Color,
      Placeholder.configure({ placeholder }),
    ],
    content: toHtml(value),
    editorProps: { attributes: { class: "rich-text focus:outline-none px-3 py-2.5 text-sm leading-relaxed" } },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
    onBlur: ({ editor }) => onBlur?.(editor.isEmpty ? "" : editor.getHTML()),
  });

  // Follow external value changes (e.g. switching notes / tasks) without clobbering typing.
  useEffect(() => {
    if (!editor) return;
    const next = toHtml(value);
    if (next !== (editor.isEmpty ? "" : editor.getHTML()) && !editor.isFocused) editor.commands.setContent(next, { emitUpdate: false });
  }, [value, editor]);

  useEffect(() => { editor?.setEditable(editable); }, [editable, editor]);

  return (
    <div className={cn("flex flex-col rounded-lg border bg-background focus-within:border-primary/60", className)}>
      {editor && toolbar === "top" && <div className="order-first border-b [&>div]:border-t-0"><Toolbar editor={editor} /></div>}
      <div className="flex-1 overflow-y-auto" style={{ minHeight }} onClick={() => editor?.commands.focus()}>
        <EditorContent editor={editor} />
      </div>
      {editor && toolbar === "bottom" && <Toolbar editor={editor} />}
    </div>
  );
}

/** Read-only rendering of stored rich text (or legacy plain text). */
export function RichTextView({ html, className }: { html: string; className?: string }) {
  return <div className={cn("rich-text text-sm leading-relaxed", className)} dangerouslySetInnerHTML={{ __html: sanitize(toHtml(html)) }} />;
}

/** Minimal sanitiser for our own editor output: strips scripts, event handlers and javascript: URLs. */
function sanitize(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed)[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "$1=\"#\"");
}
