"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

function Pre({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) {
  return (
    <div className="group relative">
      <button
        className="absolute right-2 top-2 rounded bg-secondary px-2 py-1 text-xs opacity-80 sm:hidden sm:group-hover:block"
        onClick={(e) => {
          const code = (e.currentTarget.nextElementSibling as HTMLElement)?.innerText ?? "";
          navigator.clipboard.writeText(code);
          toast("Código copiado");
        }}
      >
        Copiar
      </button>
      <pre {...props} className="max-w-full overflow-x-auto rounded-lg bg-[#2B2B39] p-3 text-xs sm:p-4 sm:text-sm">
        {children}
      </pre>
    </div>
  );
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none break-words prose-headings:font-semibold prose-a:break-all prose-a:text-primary prose-table:block prose-table:max-w-full prose-table:overflow-x-auto">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: Pre }}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
