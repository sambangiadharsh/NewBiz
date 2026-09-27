import React, { useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  Bold,
  Italic,
  UnderlineIcon,
  Strikethrough,
  Link2,
  Link2Off,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Quote,
  Code,
  Undo2,
  Redo2,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Minus,
} from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  maxCharacters?: number;
  readOnly?: boolean;
}

// ─── Radix Tooltip Wrapper ──────────────────────────────────────────────────

const EditorTooltip: React.FC<{
  title: string;
  shortcut?: string;
  children: React.ReactNode;
}> = ({ title, shortcut, children }) => (
  <Tooltip.Root>
    <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content
        side="top"
        sideOffset={6}
        className="z-50 flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-100 bg-slate-900/95 backdrop-blur-md rounded-lg shadow-xl border border-slate-700/60 select-none animate-in fade-in-0 zoom-in-95 duration-150"
      >
        <span>{title}</span>
        {shortcut && (
          <kbd className="px-1.5 py-0.5 text-[9px] font-mono text-slate-300 bg-slate-800 border border-slate-700 rounded shadow-sm">
            {shortcut}
          </kbd>
        )}
        <Tooltip.Arrow className="fill-slate-900/95" />
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
);

const ToolbarButton: React.FC<{
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  shortcut?: string;
  children: React.ReactNode;
}> = ({ onClick, isActive, disabled, title, shortcut, children }) => (
  <EditorTooltip title={title} shortcut={shortcut}>
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      disabled={disabled}
      className={`p-1.5 rounded-lg transition-all duration-150 relative ${
        isActive
          ? 'bg-[#635BFF] text-white shadow-sm shadow-indigo-500/30'
          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
      } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  </EditorTooltip>
);

const Divider: React.FC = () => (
  <div className="w-px h-5 bg-slate-200 mx-1 self-center" />
);

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content,
  onChange,
  placeholder = 'Start writing your policy or page content...',
  maxCharacters = 100000,
  readOnly = false,
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { class: 'text-indigo-600 underline hover:text-indigo-800 cursor-pointer font-medium' },
      }),
      Placeholder.configure({ placeholder }),
      CharacterCount.configure({ limit: maxCharacters }),
    ],
    content: content || '',
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter target URL (e.g. https://example.com or mailto:...):', previousUrl);
    if (url === null) return;
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  }, [editor]);

  if (!editor) return null;

  const charCount = editor.storage.characterCount?.characters?.() ?? 0;
  const charPercent = Math.round((charCount / maxCharacters) * 100);

  return (
    <Tooltip.Provider delayDuration={150} skipDelayDuration={80}>
      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm transition-all focus-within:ring-2 focus-within:ring-[#635BFF]/30 focus-within:border-[#635BFF]">
        {/* Toolbar */}
        {!readOnly && (
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center gap-0.5">
            {/* History */}
            <ToolbarButton
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              title="Undo"
              shortcut="Ctrl+Z"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              title="Redo"
              shortcut="Ctrl+Shift+Z"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </ToolbarButton>

            <Divider />

            {/* Headings */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              isActive={editor.isActive('heading', { level: 1 })}
              title="Heading 1"
              shortcut="Ctrl+Alt+1"
            >
              <Heading1 className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              isActive={editor.isActive('heading', { level: 2 })}
              title="Heading 2"
              shortcut="Ctrl+Alt+2"
            >
              <Heading2 className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              isActive={editor.isActive('heading', { level: 3 })}
              title="Heading 3"
              shortcut="Ctrl+Alt+3"
            >
              <Heading3 className="w-3.5 h-3.5" />
            </ToolbarButton>

            <Divider />

            {/* Marks */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive('bold')}
              title="Bold"
              shortcut="Ctrl+B"
            >
              <Bold className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive('italic')}
              title="Italic"
              shortcut="Ctrl+I"
            >
              <Italic className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              isActive={editor.isActive('underline')}
              title="Underline"
              shortcut="Ctrl+U"
            >
              <UnderlineIcon className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              isActive={editor.isActive('strike')}
              title="Strikethrough"
              shortcut="Ctrl+Shift+X"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              isActive={editor.isActive('highlight')}
              title="Highlight Text"
              shortcut="Ctrl+Shift+H"
            >
              <Highlighter className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleCode().run()}
              isActive={editor.isActive('code')}
              title="Inline Code"
              shortcut="Ctrl+E"
            >
              <Code className="w-3.5 h-3.5" />
            </ToolbarButton>

            <Divider />

            {/* Alignment */}
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              isActive={editor.isActive({ textAlign: 'left' })}
              title="Align Left"
              shortcut="Ctrl+Shift+L"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              isActive={editor.isActive({ textAlign: 'center' })}
              title="Align Center"
              shortcut="Ctrl+Shift+E"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              isActive={editor.isActive({ textAlign: 'right' })}
              title="Align Right"
              shortcut="Ctrl+Shift+R"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign('justify').run()}
              isActive={editor.isActive({ textAlign: 'justify' })}
              title="Justify Text"
              shortcut="Ctrl+Shift+J"
            >
              <AlignJustify className="w-3.5 h-3.5" />
            </ToolbarButton>

            <Divider />

            {/* Lists */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              isActive={editor.isActive('bulletList')}
              title="Bullet List"
              shortcut="Ctrl+Shift+8"
            >
              <List className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={editor.isActive('orderedList')}
              title="Numbered List"
              shortcut="Ctrl+Shift+7"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              isActive={editor.isActive('blockquote')}
              title="Blockquote"
              shortcut="Ctrl+Shift+B"
            >
              <Quote className="w-3.5 h-3.5" />
            </ToolbarButton>

            <Divider />

            {/* Link */}
            <ToolbarButton
              onClick={setLink}
              isActive={editor.isActive('link')}
              title="Insert / Edit Link"
              shortcut="Ctrl+K"
            >
              <Link2 className="w-3.5 h-3.5" />
            </ToolbarButton>
            {editor.isActive('link') && (
              <ToolbarButton
                onClick={() => editor.chain().focus().unsetLink().run()}
                title="Remove Link"
              >
                <Link2Off className="w-3.5 h-3.5" />
              </ToolbarButton>
            )}

            <Divider />

            {/* Horizontal Rule */}
            <ToolbarButton
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              title="Insert Horizontal Divider"
            >
              <Minus className="w-3.5 h-3.5" />
            </ToolbarButton>
          </div>
        )}

        {/* Editor Content Area */}
        <EditorContent
          editor={editor}
          className="prose prose-slate max-w-none px-6 py-5 min-h-[340px] max-h-[640px] overflow-y-auto focus:outline-none 
            [&_.ProseMirror]:outline-none 
            [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-slate-400 
            [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] 
            [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left 
            [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none 
            [&_.ProseMirror_h1]:text-2xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:text-slate-900 [&_.ProseMirror_h1]:mb-3 [&_.ProseMirror_h1]:mt-4 
            [&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:text-slate-800 [&_.ProseMirror_h2]:mb-2 [&_.ProseMirror_h2]:mt-3 
            [&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:text-slate-800 
            [&_.ProseMirror_p]:text-sm [&_.ProseMirror_p]:text-slate-600 [&_.ProseMirror_p]:leading-relaxed
            [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5
            [&_.ProseMirror_li]:text-sm [&_.ProseMirror_li]:text-slate-600 [&_.ProseMirror_li]:my-1
            [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-indigo-400 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:text-slate-500 [&_.ProseMirror_blockquote]:italic
            [&_.ProseMirror_hr]:border-slate-200 [&_.ProseMirror_hr]:my-4"
        />

        {/* Footer: Character Count & System Info */}
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Tiptap Rich-Text Engine
          </span>
          <span className={`text-[11px] font-mono ${charPercent > 90 ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
            {charCount.toLocaleString()} / {maxCharacters.toLocaleString()} characters
          </span>
        </div>
      </div>
    </Tooltip.Provider>
  );
};
