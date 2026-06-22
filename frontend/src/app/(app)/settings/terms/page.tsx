"use client";
import { useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import PageHeader from "@/components/PageHeader";
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Undo2, Redo2, Palette, CheckCircle, Loader2,
} from "lucide-react";
import { useTermsAndConditions } from "@/hooks/useTermsAndConditions";

const COLOR_OPTIONS = [
  { label: "Default", value: undefined },
  { label: "Red", value: "#ef4444" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Green", value: "#22c55e" },
  { label: "Orange", value: "#f97316" },
  { label: "Purple", value: "#a855f7" },
  { label: "Black", value: "#000000" },
  { label: "Gray", value: "#6b7280" },
];

function ToolbarButton({
  onClick,
  active,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded-md transition-colors ${
        active
          ? "bg-primary/20 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function EditorToolbar({ editor }: { editor: any }) {
  const [showColorPicker, setShowColorPicker] = useState(false);

  if (!editor) return null;

  const HEADINGS = [
    { label: "Paragraph", action: () => editor.chain().focus().setParagraph().run(), isActive: editor.isActive("paragraph") },
    { label: "H1", action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), isActive: editor.isActive("heading", { level: 1 }) },
    { label: "H2", action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), isActive: editor.isActive("heading", { level: 2 }) },
    { label: "H3", action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), isActive: editor.isActive("heading", { level: 3 }) },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-border bg-muted/30 rounded-t-xl">
      {/* Undo / Redo */}
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
        <Undo2 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
        <Redo2 className="w-4 h-4" />
      </ToolbarButton>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Heading dropdown */}
      <select
        onChange={(e) => {
          const val = e.target.value;
          if (val === "paragraph") editor.chain().focus().setParagraph().run();
          else editor.chain().focus().toggleHeading({ level: parseInt(val) as 1|2|3 }).run();
        }}
        value={
          editor.isActive("heading", { level: 1 }) ? "1"
          : editor.isActive("heading", { level: 2 }) ? "2"
          : editor.isActive("heading", { level: 3 }) ? "3"
          : "paragraph"
        }
        className="text-xs bg-background border border-border rounded-md px-2 py-1 text-foreground outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="paragraph">Paragraph</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
      </select>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Bold */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
        <Bold className="w-4 h-4" />
      </ToolbarButton>

      {/* Italic */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
        <Italic className="w-4 h-4" />
      </ToolbarButton>

      {/* Underline */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
        <UnderlineIcon className="w-4 h-4" />
      </ToolbarButton>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Bullet List */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet List">
        <List className="w-4 h-4" />
      </ToolbarButton>

      {/* Ordered List */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Ordered List">
        <ListOrdered className="w-4 h-4" />
      </ToolbarButton>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Text Color */}
      <div className="relative">
        <ToolbarButton onClick={() => setShowColorPicker(!showColorPicker)} title="Text Color">
          <Palette className="w-4 h-4" />
        </ToolbarButton>
        {showColorPicker && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowColorPicker(false)} />
            <div className="absolute top-full left-0 mt-1 z-20 bg-card border border-border rounded-lg shadow-lg p-2 flex gap-1">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value || "default"}
                  type="button"
                  onClick={() => {
                    if (c.value) {
                      editor.chain().focus().setColor(c.value).run();
                    } else {
                      editor.chain().focus().unsetColor().run();
                    }
                    setShowColorPicker(false);
                  }}
                  className="w-6 h-6 rounded-full border border-border hover:scale-110 transition-transform"
                  style={{ backgroundColor: c.value || "transparent" }}
                  title={c.label}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type TabType = "quote" | "invoice";

export default function TermsPage() {
  const { terms, isLoading, isSaving, save } = useTermsAndConditions();
  const [activeTab, setActiveTab] = useState<TabType>("quote");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const quoteEditor = useEditor({
    extensions: [StarterKit, Underline, TextStyle, Color],
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[300px] px-4 py-3",
      },
    },
  });

  const invoiceEditor = useEditor({
    extensions: [StarterKit, Underline, TextStyle, Color],
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[300px] px-4 py-3",
      },
    },
  });

  useEffect(() => {
    if (terms?.quote && quoteEditor && !quoteEditor.isDestroyed) {
      quoteEditor.commands.setContent(terms.quote);
    }
  }, [terms?.quote, quoteEditor]);

  useEffect(() => {
    if (terms?.invoice && invoiceEditor && !invoiceEditor.isDestroyed) {
      invoiceEditor.commands.setContent(terms.invoice);
    }
  }, [terms?.invoice, invoiceEditor]);

  const handleSave = async () => {
    const payload: Record<string, string> = {};
    if (quoteEditor) payload.quote = quoteEditor.getHTML();
    if (invoiceEditor) payload.invoice = invoiceEditor.getHTML();
    await save(payload as any);
    setSuccessMsg("Terms & Conditions saved successfully");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Terms & Conditions"
        subtitle="Manage quote and invoice terms"
        actions={
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 h-9 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity text-sm font-medium disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        }
      />

      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-success/10 text-success text-sm border border-success/20">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-xl w-fit border border-border">
        <button
          onClick={() => setActiveTab("quote")}
          className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === "quote"
              ? "bg-card text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Quote
        </button>
        <button
          onClick={() => setActiveTab("invoice")}
          className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === "invoice"
              ? "bg-card text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Invoice
        </button>
      </div>

      {/* Editor */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        {activeTab === "quote" && (
          <>
            <EditorToolbar editor={quoteEditor} />
            <EditorContent editor={quoteEditor} />
          </>
        )}
        {activeTab === "invoice" && (
          <>
            <EditorToolbar editor={invoiceEditor} />
            <EditorContent editor={invoiceEditor} />
          </>
        )}
      </div>
    </div>
  );
}
