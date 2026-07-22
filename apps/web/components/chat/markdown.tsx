"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

function Pre({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) {
  return (
    <div className="group relative">
      <button
        className="absolute right-2 top-2 hidden rounded bg-secondary px-2 py-1 text-xs group-hover:block"
        onClick={(e) => {
          const code = (e.currentTarget.nextElementSibling as HTMLElement)?.innerText ?? "";
          navigator.clipboard.writeText(code);
          toast("Código copiado");
        }}
      >
        Copiar
      </button>
      <pre {...props} className="overflow-x-auto rounded-lg bg-[#2B2B39] p-4 text-sm">
        {children}
      </pre>
    </div>
  );
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none prose-headings:font-semibold prose-a:text-primary">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: Pre }}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
